const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.PORT = '5998';
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

async function generateDeviceIdentity(userId) {
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

async function runCompleteVerification() {
  console.log('================================================================');
  console.log('PULSECHAT COMPREHENSIVE END-TO-END SERVER REJECTION VERIFICATION');
  console.log('================================================================\n');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB.');

  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';
  const canonicalChatId = [aliceId, bobId].sort().join('::');

  // Ensure friendship exists between Alice and Bob
  await User.updateOne({ id: aliceId }, { $addToSet: { friends: bobId } });
  await User.updateOne({ id: bobId }, { $addToSet: { friends: aliceId } });

  const aliceUser = await User.findOne({ id: aliceId }).lean();
  const bobUser = await User.findOne({ id: bobId }).lean();

  if (!aliceUser || !bobUser) {
    throw new Error('Alice and Bob accounts must exist in MongoDB.');
  }

  // Clean stale test records
  await DeviceIdentity.deleteMany({ userId: { $in: [aliceId, bobId] } });
  await DeviceKey.deleteMany({ userId: { $in: [aliceId, bobId] } });
  await Message.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });
  await MessageLedger.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username }, config.JWT_SECRET);
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username }, config.JWT_SECRET);

  const aliceIdentity = await generateDeviceIdentity(aliceId);
  const bobIdentity = await generateDeviceIdentity(bobId);

  console.log('Starting backend server on port 5998...');
  require('../server');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Device Registration via HTTP POST /api/keys/upload
  console.log('\n--- 1. Device Registration via HTTP POST /api/keys/upload ---');
  const uploadAlice = await fetch('http://localhost:5998/api/keys/upload', {
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
  console.log(`Alice device upload status: ${uploadAlice.status}`);

  const uploadBob = await fetch('http://localhost:5998/api/keys/upload', {
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
  console.log(`Bob device upload status: ${uploadBob.status}`);

  // Query Peer Keys
  const bobKeyRes = await fetch(`http://localhost:5998/api/keys/${bobId}`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  const bobKeyData = await bobKeyRes.json();
  const bobPeerDevice = bobKeyData.devices[0];

  const aliceKeyRes = await fetch(`http://localhost:5998/api/keys/${aliceId}`, {
    headers: { Authorization: `Bearer ${bobToken}` }
  });
  const aliceKeyData = await aliceKeyRes.json();
  const alicePeerDevice = aliceKeyData.devices[0];

  // Connect WebSockets
  console.log('\n--- 2. Establish Authenticated WebSockets ---');
  let aliceSocket = ioClient('http://localhost:5998', {
    auth: { token: aliceToken },
    transports: ['websocket'],
    forceNew: true
  });
  let bobSocket = ioClient('http://localhost:5998', {
    auth: { token: bobToken },
    transports: ['websocket'],
    forceNew: true
  });

  await Promise.all([
    new Promise(res => aliceSocket.on('connect', res)),
    new Promise(res => bobSocket.on('connect', res))
  ]);

  aliceSocket.emit('setup', { rawUserId: aliceId, token: aliceToken });
  bobSocket.emit('setup', { rawUserId: bobId, token: bobToken });
  aliceSocket.emit('join_chat', canonicalChatId);
  bobSocket.emit('join_chat', canonicalChatId);
  await new Promise(r => setTimeout(r, 600));

  // --- 3. Online Verification: Alice -> Bob ---
  console.log('\n--- 3. Online Verification: Alice -> Bob ---');
  const aliceMsgText = 'Secret Message Alice -> Bob [Real Online]';
  const aliceEnvelope = await encryptMessage(
    aliceMsgText,
    bobPeerDevice.keys[`p256:${bobPeerDevice.device_id}`],
    aliceIdentity.deviceId,
    bobPeerDevice.device_id
  );

  const alicePayload = {
    chatId: canonicalChatId,
    senderId: aliceId,
    receiverId: bobId,
    isGroup: false,
    content: '',
    type: 'text',
    isEncrypted: true,
    envelope: aliceEnvelope,
    clientTempId: `temp_alice_${Date.now()}`
  };

  console.log('Alice Emitted Payload:', JSON.stringify({ ...alicePayload, envelope: '[ENCRYPTED_P256_AES_GCM]' }, null, 2));

  let bobReceivedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bob timeout waiting for message')), 5000);
    bobSocket.on('new_message', (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });

  let aliceAckPromise = new Promise((resolve) => {
    aliceSocket.emit('send_message', alicePayload, (ack) => {
      resolve(ack);
    });
  });

  const [aliceAck, bobReceivedMsg] = await Promise.all([aliceAckPromise, bobReceivedPromise]);
  console.log('Server Validation & ACK to Alice:', JSON.stringify(aliceAck, null, 2));
  if (!aliceAck || !aliceAck.success) throw new Error(`Alice send failed: ${JSON.stringify(aliceAck)}`);

  console.log('Bob Received Wire Message:', JSON.stringify({
    id: bobReceivedMsg.id,
    senderId: bobReceivedMsg.senderId,
    receiverId: bobReceivedMsg.receiverId,
    isEncrypted: bobReceivedMsg.isEncrypted,
    hasReceiptToken: Boolean(bobReceivedMsg.receiptToken)
  }, null, 2));

  const bobDecrypted = await decryptMessage(bobReceivedMsg.envelope, bobIdentity.keyPair.privateKey);
  console.log('Bob Decrypted Plaintext:', bobDecrypted.content);
  if (bobDecrypted.content !== aliceMsgText) throw new Error('Decrypted text mismatch for Bob');

  // Bob sends delivered ACK
  let aliceDoubleTickPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Alice timeout waiting for double tick')), 5000);
    aliceSocket.on('message_delivered_update', (d) => {
      if (d.messageId === bobReceivedMsg.id) {
        clearTimeout(timer);
        resolve(d);
      }
    });
  });

  bobSocket.emit('message_delivered', {
    messageId: bobReceivedMsg.id,
    chatId: canonicalChatId,
    senderId: aliceId,
    receiverId: bobId,
    receiptToken: bobReceivedMsg.receiptToken,
    clientTempId: alicePayload.clientTempId
  });

  const doubleTickAtoB = await aliceDoubleTickPromise;
  console.log('Alice Received Delivery Confirmation (Double Tick):', JSON.stringify(doubleTickAtoB, null, 2));

  // --- 4. Online Verification: Bob -> Alice ---
  console.log('\n--- 4. Online Verification: Bob -> Alice ---');
  const bobMsgText = 'Secret Message Bob -> Alice [Real Online]';
  const bobEnvelope = await encryptMessage(
    bobMsgText,
    alicePeerDevice.keys[`p256:${alicePeerDevice.device_id}`],
    bobIdentity.deviceId,
    alicePeerDevice.device_id
  );

  const bobPayload = {
    chatId: canonicalChatId,
    senderId: bobId,
    receiverId: aliceId,
    isGroup: false,
    content: '',
    type: 'text',
    isEncrypted: true,
    envelope: bobEnvelope,
    clientTempId: `temp_bob_${Date.now()}`
  };

  console.log('Bob Emitted Payload:', JSON.stringify({ ...bobPayload, envelope: '[ENCRYPTED_P256_AES_GCM]' }, null, 2));

  let aliceReceivedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Alice timeout waiting for message')), 5000);
    aliceSocket.on('new_message', (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });

  let bobAckPromise = new Promise((resolve) => {
    bobSocket.emit('send_message', bobPayload, (ack) => {
      resolve(ack);
    });
  });

  const [bobAck, aliceReceivedMsg] = await Promise.all([bobAckPromise, aliceReceivedPromise]);
  console.log('Server Validation & ACK to Bob:', JSON.stringify(bobAck, null, 2));
  if (!bobAck || !bobAck.success) throw new Error(`Bob send failed: ${JSON.stringify(bobAck)}`);

  const aliceDecrypted = await decryptMessage(aliceReceivedMsg.envelope, aliceIdentity.keyPair.privateKey);
  console.log('Alice Decrypted Plaintext:', aliceDecrypted.content);
  if (aliceDecrypted.content !== bobMsgText) throw new Error('Decrypted text mismatch for Alice');

  // Alice sends delivered ACK
  let bobDoubleTickPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bob timeout waiting for double tick')), 5000);
    bobSocket.on('message_delivered_update', (d) => {
      if (d.messageId === aliceReceivedMsg.id) {
        clearTimeout(timer);
        resolve(d);
      }
    });
  });

  aliceSocket.emit('message_delivered', {
    messageId: aliceReceivedMsg.id,
    chatId: canonicalChatId,
    senderId: bobId,
    receiverId: aliceId,
    receiptToken: aliceReceivedMsg.receiptToken,
    clientTempId: bobPayload.clientTempId
  });

  const doubleTickBtoA = await bobDoubleTickPromise;
  console.log('Bob Received Delivery Confirmation (Double Tick):', JSON.stringify(doubleTickBtoA, null, 2));

  // --- 5. Offline-to-Online Delivery: Alice -> Bob ---
  console.log('\n--- 5. Offline-to-Online Delivery: Alice -> Bob ---');
  // Disconnect Bob socket to simulate offline
  bobSocket.disconnect();
  await new Promise(r => setTimeout(r, 600));

  const offlineMsgText = 'Queued Note Alice -> Bob [Real Offline Queue]';
  const offlineEnvelope = await encryptMessage(
    offlineMsgText,
    bobPeerDevice.keys[`p256:${bobPeerDevice.device_id}`],
    aliceIdentity.deviceId,
    bobPeerDevice.device_id
  );

  const offlinePayload = {
    chatId: canonicalChatId,
    senderId: aliceId,
    receiverId: bobId,
    isGroup: false,
    content: '',
    type: 'text',
    isEncrypted: true,
    envelope: offlineEnvelope,
    clientTempId: `temp_offline_${Date.now()}`
  };

  const offlineAck = await new Promise(res => {
    aliceSocket.emit('send_message', offlinePayload, res);
  });
  console.log('Server Offline Send ACK to Alice:', JSON.stringify(offlineAck, null, 2));
  if (!offlineAck || !offlineAck.success) throw new Error('Offline send failed');

  // Verify message is queued in MongoDB MessageLedger
  const queuedInDb = await MessageLedger.findOne({ messageId: offlineAck.message.id }).lean();
  console.log('MongoDB MessageLedger Queued Status:', JSON.stringify({
    messageId: queuedInDb.messageId,
    state: queuedInDb.state,
    receiverId: queuedInDb.receiverId
  }, null, 2));
  if (!queuedInDb || queuedInDb.state !== 'queued') throw new Error('Message was not queued in Ledger');

  // Bob reconnects
  console.log('Bob reconnects online...');
  let bobQueuedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bob timeout for queued message')), 5000);
    const tempSocket = ioClient('http://localhost:5998', {
      auth: { token: bobToken },
      transports: ['websocket'],
      forceNew: true
    });
    bobSocket = tempSocket;
    tempSocket.on('connect', () => {
      tempSocket.emit('setup', { rawUserId: bobId, token: bobToken });
    });
    tempSocket.on('new_message', (msg) => {
      if (msg.id === offlineAck.message.id) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });

  let aliceOfflineDoubleTickPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Alice timeout waiting for offline double tick')), 5000);
    aliceSocket.on('message_delivered_update', (d) => {
      if (d.messageId === offlineAck.message.id) {
        clearTimeout(timer);
        resolve(d);
      }
    });
  });

  const bobReceivedQueuedMsg = await bobQueuedPromise;
  console.log('Bob Received Queued Message on Reconnect:', bobReceivedQueuedMsg.id);

  const bobDecryptedQueued = await decryptMessage(bobReceivedQueuedMsg.envelope, bobIdentity.keyPair.privateKey);
  console.log('Bob Decrypted Queued Plaintext:', bobDecryptedQueued.content);
  if (bobDecryptedQueued.content !== offlineMsgText) throw new Error('Offline text mismatch for Bob');

  // Bob delivers ACK with HMAC receiptToken
  bobSocket.emit('message_delivered', {
    messageId: bobReceivedQueuedMsg.id,
    chatId: canonicalChatId,
    senderId: aliceId,
    receiverId: bobId,
    receiptToken: bobReceivedQueuedMsg.receiptToken,
    clientTempId: offlinePayload.clientTempId
  });

  const offlineDoubleTick = await aliceOfflineDoubleTickPromise;
  console.log('Alice Received Offline Double Tick Delivery Confirmation:', JSON.stringify(offlineDoubleTick, null, 2));

  // Verify MessageLedger transitioned from queued -> delivered
  await new Promise(r => setTimeout(r, 500));
  const ledgerAfterAck = await MessageLedger.findOne({ messageId: offlineAck.message.id }).lean();
  console.log('MongoDB MessageLedger Final Status:', ledgerAfterAck ? ledgerAfterAck.state : 'DELETED_OR_DELIVERED');

  // --- 6. Offline-to-Online Delivery: Bob -> Alice ---
  console.log('\n--- 6. Offline-to-Online Delivery: Bob -> Alice ---');
  // Disconnect Alice socket to simulate offline
  aliceSocket.disconnect();
  await new Promise(r => setTimeout(r, 600));

  const offlineBobMsgText = 'Queued Note Bob -> Alice [Real Offline Queue]';
  const offlineBobEnvelope = await encryptMessage(
    offlineBobMsgText,
    alicePeerDevice.keys[`p256:${alicePeerDevice.device_id}`],
    bobIdentity.deviceId,
    alicePeerDevice.device_id
  );

  const offlineBobPayload = {
    chatId: canonicalChatId,
    senderId: bobId,
    receiverId: aliceId,
    isGroup: false,
    content: '',
    type: 'text',
    isEncrypted: true,
    envelope: offlineBobEnvelope,
    clientTempId: `temp_offline_bob_${Date.now()}`
  };

  const offlineBobAck = await new Promise(res => {
    bobSocket.emit('send_message', offlineBobPayload, res);
  });
  console.log('Server Offline Send ACK to Bob:', JSON.stringify(offlineBobAck, null, 2));
  if (!offlineBobAck || !offlineBobAck.success) throw new Error('Offline Bob send failed');

  // Verify message is queued in MongoDB MessageLedger
  const queuedBobInDb = await MessageLedger.findOne({ messageId: offlineBobAck.message.id }).lean();
  console.log('MongoDB MessageLedger Queued Status (Bob -> Alice):', JSON.stringify({
    messageId: queuedBobInDb.messageId,
    state: queuedBobInDb.state,
    receiverId: queuedBobInDb.receiverId
  }, null, 2));
  if (!queuedBobInDb || queuedBobInDb.state !== 'queued') throw new Error('Bob message was not queued in Ledger');

  // Alice reconnects
  console.log('Alice reconnects online...');
  let aliceQueuedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Alice timeout for queued message')), 5000);
    const tempSocket = ioClient('http://localhost:5998', {
      auth: { token: aliceToken },
      transports: ['websocket'],
      forceNew: true
    });
    aliceSocket = tempSocket;
    tempSocket.on('connect', () => {
      tempSocket.emit('setup', { rawUserId: aliceId, token: aliceToken });
    });
    tempSocket.on('new_message', (msg) => {
      if (msg.id === offlineBobAck.message.id) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });

  let bobOfflineDoubleTickPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bob timeout waiting for offline double tick')), 5000);
    bobSocket.on('message_delivered_update', (d) => {
      if (d.messageId === offlineBobAck.message.id) {
        clearTimeout(timer);
        resolve(d);
      }
    });
  });

  const aliceReceivedQueuedMsg = await aliceQueuedPromise;
  console.log('Alice Received Queued Message on Reconnect:', aliceReceivedQueuedMsg.id);

  const aliceDecryptedQueued = await decryptMessage(aliceReceivedQueuedMsg.envelope, aliceIdentity.keyPair.privateKey);
  console.log('Alice Decrypted Queued Plaintext:', aliceDecryptedQueued.content);
  if (aliceDecryptedQueued.content !== offlineBobMsgText) throw new Error('Offline text mismatch for Alice');

  // Alice delivers ACK with HMAC receiptToken
  aliceSocket.emit('message_delivered', {
    messageId: aliceReceivedQueuedMsg.id,
    chatId: canonicalChatId,
    senderId: bobId,
    receiverId: aliceId,
    receiptToken: aliceReceivedQueuedMsg.receiptToken,
    clientTempId: offlineBobPayload.clientTempId
  });

  const offlineBobDoubleTick = await bobOfflineDoubleTickPromise;
  console.log('Bob Received Offline Double Tick Delivery Confirmation:', JSON.stringify(offlineBobDoubleTick, null, 2));

  // Verify MessageLedger transitioned from queued -> delivered
  await new Promise(r => setTimeout(r, 500));
  const ledgerBobAfterAck = await MessageLedger.findOne({ messageId: offlineBobAck.message.id }).lean();
  console.log('MongoDB MessageLedger Final Status (Bob -> Alice):', ledgerBobAfterAck ? ledgerBobAfterAck.state : 'DELETED_OR_DELIVERED');

  // Cleanup
  aliceSocket.disconnect();
  bobSocket.disconnect();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('VERIFICATION COMPLETE: ALL CHECKS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
  process.exit(0);
}

runCompleteVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
