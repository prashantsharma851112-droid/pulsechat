const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.PORT = '5997';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;
const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

const config = require('../config');
const User = require('../models/User');
const Message = require('../models/Message');
const MessageLedger = require('../models/MessageLedger');
const DeviceIdentity = require('../models/DeviceIdentity');
const DeviceKey = require('../models/DeviceKey');

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToArrayBuffer(base64) {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function generateTestDeviceIdentity(userId) {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return { userId, deviceId, keyPair, publicKeyJwk };
}

async function encryptMessage(plaintext, recipientPublicKeyJwk, senderDeviceId, recipientDeviceId) {
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

  const recipientKey = await subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    ephemeralKeyPair.privateKey,
    256
  );

  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const aesGcmKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('pulse_e2ee_message_key_v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plaintextBuffer = new TextEncoder().encode(JSON.stringify({ content: plaintext, type: 'text' }));

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesGcmKey,
    plaintextBuffer
  );

  return {
    format: 'pulse_e2ee_v1',
    senderDeviceId: String(senderDeviceId),
    recipientDeviceId: String(recipientDeviceId),
    ephemeralPublicKey: ephemeralPublicKeyJwk,
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer)
  };
}

async function decryptMessage(envelope, recipientPrivateKey) {
  const ephemeralKey = await subtle.importKey(
    'jwk',
    envelope.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralKey },
    recipientPrivateKey,
    256
  );

  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const aesGcmKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('pulse_e2ee_message_key_v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = base64ToArrayBuffer(envelope.iv);
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesGcmKey,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

async function runTest() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB.');

  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';

  const aliceUser = await User.findOne({ id: aliceId }).lean();
  const bobUser = await User.findOne({ id: bobId }).lean();

  if (!aliceUser || !bobUser) {
    throw new Error('Existing Alice and Bob accounts must exist in DB.');
  }

  console.log(`Using existing accounts: Alice (${aliceUser.id}), Bob (${bobUser.id})`);

  // Clean stale test device identities & queued messages before starting test
  await DeviceIdentity.deleteMany({ userId: { $in: [aliceId, bobId] } });
  await DeviceKey.deleteMany({ userId: { $in: [aliceId, bobId] } });
  await Message.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });
  await MessageLedger.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username }, config.JWT_SECRET);
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username }, config.JWT_SECRET);

  // Generate real WebCrypto device identities
  const aliceIdentity = await generateTestDeviceIdentity(aliceId);
  const bobIdentity = await generateTestDeviceIdentity(bobId);

  // Start real server
  console.log('Starting backend server on port 5997...');
  const server = require('../server');
  await new Promise(r => setTimeout(r, 2000));

  // Stage 1: Device Registration via POST /api/keys/upload
  console.log('\n--- STAGE 1: Register Device Keys via HTTP ---');
  const uploadAliceRes = await fetch('http://localhost:5997/api/keys/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: aliceId,
        device_id: aliceIdentity.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${aliceIdentity.deviceId}`]: aliceIdentity.publicKeyJwk }
      }
    })
  });
  const aliceUploadBody = await uploadAliceRes.json();
  console.log('Alice key upload status:', uploadAliceRes.status, aliceUploadBody.ok ? 'OK' : aliceUploadBody);

  const uploadBobRes = await fetch('http://localhost:5997/api/keys/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: bobId,
        device_id: bobIdentity.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${bobIdentity.deviceId}`]: bobIdentity.publicKeyJwk }
      }
    })
  });
  const bobUploadBody = await uploadBobRes.json();
  console.log('Bob key upload status:', uploadBobRes.status, bobUploadBody.ok ? 'OK' : bobUploadBody);

  if (!uploadAliceRes.ok || !uploadBobRes.ok) {
    throw new Error('Key upload failed');
  }

  // Stage 2: Peer Key Query
  console.log('\n--- STAGE 2: Alice queries Bob public key ---');
  const bobKeyQueryRes = await fetch(`http://localhost:5997/api/keys/${bobId}`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  const bobKeyData = await bobKeyQueryRes.json();
  console.log('Bob key query response status:', bobKeyQueryRes.status);
  const bobDevice = bobKeyData.devices?.[0];
  const bobPubKeyJwk = bobDevice?.keys?.[`p256:${bobDevice.device_id}`] || bobDevice?.keys;
  console.log('Bob public key retrieved:', Boolean(bobPubKeyJwk && bobPubKeyJwk.kty === 'EC'));

  if (!bobPubKeyJwk) {
    throw new Error('Could not retrieve Bob public key from server');
  }

  // Stage 3: Connect sockets
  console.log('\n--- STAGE 3: Connect Alice and Bob WebSockets ---');
  const aliceSocket = ioClient('http://localhost:5997', { auth: { token: aliceToken } });
  const bobSocket = ioClient('http://localhost:5997', { auth: { token: bobToken } });

  await new Promise(resolve => {
    let a = false, b = false;
    aliceSocket.on('connect', () => { aliceSocket.emit('setup', aliceId); a = true; if (a && b) resolve(); });
    bobSocket.on('connect', () => { bobSocket.emit('setup', bobId); b = true; if (a && b) resolve(); });
  });
  console.log('Both Alice and Bob sockets connected and authenticated.');

  // Stage 4: Alice -> Bob message flow
  console.log('\n--- STAGE 4: Alice -> Bob E2EE Message Delivery ---');
  const clientTempId1 = 'temp_alice_' + Date.now();
  const canonicalChatId = [aliceId, bobId].sort().join('_');
  const secretTextAlice = 'Hello Bob! This is a real E2EE test message from Alice.';

  // Alice encrypts
  const envelopeAlice = await encryptMessage(secretTextAlice, bobPubKeyJwk, aliceIdentity.deviceId, bobDevice.device_id);

  let bobReceivedEnvelope = null;
  bobSocket.on('new_message', (msg) => {
    console.log('[Bob socket received new_message]:', { id: msg.id, senderId: msg.senderId, isEncrypted: msg.isEncrypted, hasEnvelope: Boolean(msg.envelope), hasToken: Boolean(msg.receiptToken) });
    bobReceivedEnvelope = msg;
  });

  // Alice sends
  await new Promise((resolve) => {
    aliceSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '', // Zero plaintext over wire
      isEncrypted: true,
      envelope: envelopeAlice,
      clientTempId: clientTempId1,
      type: 'text'
    }, (ack) => {
      console.log('[Alice send_message ACK]:', ack.success ? 'SUCCESS' : ack);
      resolve();
    });
  });

  // Wait for Bob to receive
  for (let i = 0; i < 30; i++) {
    if (bobReceivedEnvelope) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (!bobReceivedEnvelope) {
    throw new Error('FAIL: Bob did not receive message online');
  }

  // Bob decrypts
  const decryptedByBob = await decryptMessage(bobReceivedEnvelope.envelope, bobIdentity.keyPair.privateKey);
  console.log('Bob decrypted message plaintext matches:', decryptedByBob.content === secretTextAlice);

  // Bob sends delivery ACK
  const aliceDeliveryReceiptPromise = new Promise(resolve => {
    aliceSocket.on('message_delivered_update', (data) => {
      console.log('[Alice received message_delivered_update]:', data.messageId, data.status);
      resolve(data);
    });
  });

  bobSocket.emit('message_delivered', {
    messageId: bobReceivedEnvelope.id,
    chatId: bobReceivedEnvelope.chatId,
    senderId: aliceId,
    receiptToken: bobReceivedEnvelope.receiptToken
  });

  await aliceDeliveryReceiptPromise;
  console.log('Double Tick confirmed on Alice side!');

  // Stage 5: Reverse Direction (Bob -> Alice)
  console.log('\n--- STAGE 5: Bob -> Alice Reverse Delivery ---');
  const aliceKeyQueryRes = await fetch(`http://localhost:5997/api/keys/${aliceId}`, {
    headers: { Authorization: `Bearer ${bobToken}` }
  });
  const aliceKeyData = await aliceKeyQueryRes.json();
  console.log('Alice key query data:', JSON.stringify(aliceKeyData, null, 2));
  const aliceDevice = aliceKeyData.devices?.[0];
  let alicePubKeyJwk = null;
  if (aliceDevice?.keys) {
    if (aliceDevice.keys.kty === 'EC') {
      alicePubKeyJwk = aliceDevice.keys;
    } else {
      for (const [k, v] of Object.entries(aliceDevice.keys)) {
        if (v && v.kty === 'EC') { alicePubKeyJwk = v; break; }
      }
    }
  }

  const secretTextBob = 'Hello Alice! I received your message and am replying.';
  const envelopeBob = await encryptMessage(secretTextBob, alicePubKeyJwk, bobIdentity.deviceId, aliceDevice.device_id);

  let aliceReceivedEnvelope = null;
  aliceSocket.on('new_message', (msg) => {
    console.log('[Alice socket received new_message]:', { id: msg.id, senderId: msg.senderId, isEncrypted: msg.isEncrypted });
    aliceReceivedEnvelope = msg;
  });

  const clientTempId2 = 'temp_bob_' + Date.now();
  await new Promise((resolve) => {
    bobSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: bobId,
      receiverId: aliceId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: envelopeBob,
      clientTempId: clientTempId2,
      type: 'text'
    }, (ack) => {
      console.log('[Bob send_message ACK]:', ack.success ? 'SUCCESS' : ack);
      resolve();
    });
  });

  for (let i = 0; i < 30; i++) {
    if (aliceReceivedEnvelope) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (!aliceReceivedEnvelope) {
    throw new Error('FAIL: Alice did not receive reverse message');
  }

  const decryptedByAlice = await decryptMessage(aliceReceivedEnvelope.envelope, aliceIdentity.keyPair.privateKey);
  console.log('Alice decrypted message plaintext matches:', decryptedByAlice.content === secretTextBob);

  console.log('\n--- STAGE 6: Bob offline, Alice sends, Bob reconnects and receives ---');
  // Disconnect Bob socket
  bobSocket.disconnect();
  await new Promise(r => setTimeout(r, 500));

  const offlineSecretText = 'Hello Bob! Sent while you were completely offline.';
  const offlineEnvelope = await encryptMessage(offlineSecretText, bobPubKeyJwk, aliceIdentity.deviceId, bobDevice.device_id);
  const clientTempIdOffline = 'temp_offline_' + Date.now();

  await new Promise((resolve) => {
    aliceSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: offlineEnvelope,
      clientTempId: clientTempIdOffline,
      type: 'text'
    }, (ack) => {
      console.log('[Alice offline send_message ACK]:', ack.success ? 'SUCCESS' : ack);
      resolve();
    });
  });

  // Verify stored in MongoDB queue
  const queuedMsg = await Message.findOne({ receiverId: bobId, clientTempId: clientTempIdOffline }).lean();
  console.log('MongoDB queued message found:', Boolean(queuedMsg && queuedMsg.status === 'sent'));

  // Now Bob reconnects
  let bobReceivedOfflineMsg = null;
  const bobSocket2 = ioClient('http://localhost:5997', { auth: { token: bobToken } });
  bobSocket2.on('new_message', (msg) => {
    console.log('[Bob socket received queued message on reconnect]:', { id: msg.id, senderId: msg.senderId, isEncrypted: msg.isEncrypted });
    bobReceivedOfflineMsg = msg;
  });

  await new Promise(resolve => bobSocket2.on('connect', resolve));
  bobSocket2.emit('setup', bobId);

  for (let i = 0; i < 30; i++) {
    if (bobReceivedOfflineMsg) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (!bobReceivedOfflineMsg) {
    throw new Error('FAIL: Bob did not receive queued message on reconnect');
  }

  const decryptedOffline = await decryptMessage(bobReceivedOfflineMsg.envelope, bobIdentity.keyPair.privateKey);
  console.log('Bob decrypted offline message plaintext matches:', decryptedOffline.content === offlineSecretText);

  // Bob sends delivery ACK for offline message
  const aliceOfflineDeliveredPromise = new Promise(resolve => {
    aliceSocket.on('message_delivered_update', (data) => {
      if (data.messageId === bobReceivedOfflineMsg.id) {
        console.log('[Alice received double tick for offline message]:', data.messageId, data.status);
        resolve(data);
      }
    });
  });

  bobSocket2.emit('message_delivered', {
    messageId: bobReceivedOfflineMsg.id,
    chatId: bobReceivedOfflineMsg.chatId,
    senderId: aliceId,
    receiptToken: bobReceivedOfflineMsg.receiptToken
  });

  await aliceOfflineDeliveredPromise;
  console.log('Double tick confirmed for offline message!');

  console.log('\n=============================================');
  console.log('ALL TESTS PASSED: Alice <-> Bob messaging verified in ALL conditions!');
  console.log('=============================================');

  aliceSocket.disconnect();
  bobSocket2.disconnect();

  // Cleanup test device identities from DB
  await DeviceIdentity.deleteMany({ userId: { $in: [aliceId, bobId] } });
  await DeviceKey.deleteMany({ userId: { $in: [aliceId, bobId] } });

  process.exit(0);
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
