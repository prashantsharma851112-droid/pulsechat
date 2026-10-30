const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;
const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

const config = require('../config');
const User = require('../models/User');

const PROD_API = 'https://pulsechat-api-v2.onrender.com';
const PROD_FE = 'https://pulsechat-ten-theta.vercel.app';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

async function generateTestDeviceIdentity(userId) {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const deviceId = `pulse_dev_${userId}_${Date.now()}`;
  return { userId, deviceId, keyPair, publicKeyJwk };
}

async function encryptEnvelope(contentObj, recipientPublicKeyJwk, senderDeviceId, recipientDeviceId) {
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

  const hkdfKey = await subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']);
  const aesGcmKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('pulse_e2ee_message_key_v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plaintextBuffer = new TextEncoder().encode(JSON.stringify(contentObj));
  const ciphertextBuffer = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesGcmKey, plaintextBuffer);

  return {
    format: 'pulse_e2ee_v1',
    senderDeviceId: String(senderDeviceId),
    recipientDeviceId: String(recipientDeviceId),
    ephemeralPublicKey: ephemeralPublicKeyJwk,
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer)
  };
}

async function main() {
  console.log('================================================================');
  console.log('   PULSECHAT LIVE PRODUCTION DEPLOYMENT VERIFICATION           ');
  console.log('================================================================\n');

  console.log('[1/4] Verifying Live Production VAPID Endpoint...');
  const vapidRes = await fetch(`${PROD_API}/api/users/vapid-public-key`);
  console.log(`VAPID HTTP Status: ${vapidRes.status}`);
  assert.strictEqual(vapidRes.status, 200, 'Production VAPID endpoint must return HTTP 200');
  const vapidData = await vapidRes.json();
  assert(vapidData && vapidData.publicKey, 'Production VAPID key must be returned');
  console.log(`✅ Production VAPID Key Verified: ${vapidData.publicKey.slice(0, 24)}... (HTTP 200 OK)\n`);

  console.log('[2/4] Verifying Deployed Frontend Assets on Vercel...');
  const feRes = await fetch(PROD_FE);
  console.log(`Vercel Frontend HTTP Status: ${feRes.status}`);
  assert.strictEqual(feRes.status, 200, 'Frontend must return HTTP 200');
  const feHtml = await feRes.text();
  assert(feHtml.includes('index-CM4AL7dL.js'), 'Frontend must serve the newly built commit bundle (index-CM4AL7dL.js)');
  console.log('✅ Deployed bundle matches commit 63a5c88 build hash!\n');

  console.log('[3/4] Connecting Two Real Device Sessions to Live Render Backend...');
  await mongoose.connect(config.MONGO_URI);
  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';
  const aliceUser = await User.findOne({ id: aliceId }).lean();
  const bobUser = await User.findOne({ id: bobId }).lean();

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username, email: aliceUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username, email: bobUser.email }, config.JWT_SECRET, { expiresIn: '1d' });

  const aliceDev = await generateTestDeviceIdentity(aliceId);
  const bobDev = await generateTestDeviceIdentity(bobId);

  // Register device identity via live API
  await fetch(`${PROD_API}/api/users/${aliceId}/device-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({ deviceId: aliceDev.deviceId, publicKeyJwk: aliceDev.publicKeyJwk })
  });
  await fetch(`${PROD_API}/api/users/${bobId}/device-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({ deviceId: bobDev.deviceId, publicKeyJwk: bobDev.publicKeyJwk })
  });

  const aliceSocket = ioClient(PROD_API, { auth: { token: aliceToken, userId: aliceId }, transports: ['websocket'] });
  const bobSocket = ioClient(PROD_API, { auth: { token: bobToken, userId: bobId }, transports: ['websocket'] });

  await Promise.all([
    new Promise(res => aliceSocket.on('connect', res)),
    new Promise(res => bobSocket.on('connect', res))
  ]);
  console.log(`✅ Alice Socket Connected: ${aliceSocket.id}`);
  console.log(`✅ Bob Socket Connected: ${bobSocket.id}\n`);

  console.log('[4/4] Executing Live E2EE Messaging Flow (Alice -> Bob)...');
  const canonicalChatId = `${aliceId}::${bobId}`;
  const envelope = await encryptEnvelope({ text: 'Live production verification test', t: Date.now() }, bobDev.publicKeyJwk, aliceDev.deviceId, bobDev.deviceId);

  const bobMessagePromise = new Promise((resolve) => {
    bobSocket.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  const aliceDeliveredPromise = new Promise((resolve) => {
    aliceSocket.on('message_delivered_update', (data) => {
      resolve(data);
    });
  });

  const aliceReadPromise = new Promise((resolve) => {
    aliceSocket.on('chat_read_update', (data) => {
      resolve(data);
    });
  });

  // Alice sends message
  const ack = await new Promise((resolve) => {
    aliceSocket.emit('send_message', {
      chatId: canonicalChatId,
      tempId: `tmp_prod_${Date.now()}`,
      clientTempId: `tmp_prod_${Date.now()}`,
      content: '',
      isEncrypted: true,
      envelope,
      receiverId: bobId
    }, resolve);
  });

  assert(ack && ack.success, 'Server must return success ACK');
  console.log(`✅ Alice received successful ACK from live backend (Message ID: ${ack.message.id})`);

  const bobMsg = await bobMessagePromise;
  assert(bobMsg && bobMsg.id === ack.message.id, 'Bob must receive message with matching ID');
  console.log(`✅ Bob received encrypted message event on socket (Message ID: ${bobMsg.id})`);

  // Bob durably commits to local storage and emits message_delivered
  bobSocket.emit('message_delivered', {
    messageId: bobMsg.id,
    chatId: canonicalChatId,
    senderId: aliceId,
    receiptToken: bobMsg.receiptToken || null,
    clientTempId: bobMsg.clientTempId || null
  });

  const deliveredData = await aliceDeliveredPromise;
  assert(deliveredData && deliveredData.messageId === bobMsg.id, 'Alice must receive double-tick delivery update');
  console.log(`✅ Double-tick delivery update confirmed on Alice's device: ${deliveredData.status}`);

  // Bob opens chat and marks read
  bobSocket.emit('mark_chat_read', {
    chatId: canonicalChatId,
    userId: bobId
  });

  const readData = await aliceReadPromise;
  assert(readData && readData.readerId === bobId, 'Alice must receive blue-tick read update');
  console.log(`✅ Blue-tick read update confirmed on Alice's device: readerId=${readData.readerId}`);

  aliceSocket.disconnect();
  bobSocket.disconnect();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('   ALL LIVE PRODUCTION VERIFICATIONS PASSED (100% SUCCESS)      ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('❌ LIVE PRODUCTION VERIFICATION FAILED:', err);
  process.exit(1);
});
