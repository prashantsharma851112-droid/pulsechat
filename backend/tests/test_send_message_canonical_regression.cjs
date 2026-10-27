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

async function runRegressionSuite() {
  console.log('=== RUNNING TARGETED REGRESSION FOR SEND_MESSAGE CANONICAL FIX ===\n');

  const BASE_URL = 'http://localhost:5000';
  await mongoose.connect(config.MONGO_URI);

  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';
  const eveId = '6a6da10136031f6e69c4d7f7'; // ayuussh_07 (third party)

  const aliceUser = await User.findOne({ id: aliceId }).lean();
  const bobUser = await User.findOne({ id: bobId }).lean();
  const eveUser = await User.findOne({ _id: new mongoose.Types.ObjectId(eveId) }).lean();
  assert(aliceUser && bobUser && eveUser, 'Alice, Bob, and Eve must exist.');

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username, email: aliceUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username, email: bobUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const eveToken = jwt.sign({ id: eveUser.id || eveId, username: eveUser.username, email: eveUser.email }, config.JWT_SECRET, { expiresIn: '1d' });

  // Generate and register device keys for Alice & Bob
  const aliceIdent = await generateTestDeviceIdentity(aliceId);
  const bobIdent = await generateTestDeviceIdentity(bobId);

  await fetch(`${BASE_URL}/api/keys/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: aliceId,
        device_id: aliceIdent.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${aliceIdent.deviceId}`]: aliceIdent.publicKeyJwk }
      }
    })
  });

  await fetch(`${BASE_URL}/api/keys/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: bobId,
        device_id: bobIdent.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${bobIdent.deviceId}`]: bobIdent.publicKeyJwk }
      }
    })
  });

  // Query Bob key for Alice
  const bobKeyRes = await fetch(`${BASE_URL}/api/keys/${bobId}`, { headers: { Authorization: `Bearer ${aliceToken}` } });
  const bobKeyData = await bobKeyRes.json();
  const bobDevice = bobKeyData.devices?.[0];
  const bobPubKey = bobDevice?.keys?.[`p256:${bobDevice.device_id}`] || bobDevice?.keys;

  // Query Alice key for Bob
  const aliceKeyRes = await fetch(`${BASE_URL}/api/keys/${aliceId}`, { headers: { Authorization: `Bearer ${bobToken}` } });
  const aliceKeyData = await aliceKeyRes.json();
  const aliceDevice = aliceKeyData.devices?.[0];
  const alicePubKey = aliceDevice?.keys?.[`p256:${aliceDevice.device_id}`] || aliceDevice?.keys;

  // Connect sockets
  const aliceSocket = ioClient(BASE_URL, { auth: { token: aliceToken } });
  const bobSocket = ioClient(BASE_URL, { auth: { token: bobToken } });
  const eveSocket = ioClient(BASE_URL, { auth: { token: eveToken } });

  await new Promise(resolve => {
    let a = false, b = false, e = false;
    aliceSocket.on('connect', () => { aliceSocket.emit('setup', aliceId); a = true; if (a && b && e) resolve(); });
    bobSocket.on('connect', () => { bobSocket.emit('setup', bobId); b = true; if (a && b && e) resolve(); });
    eveSocket.on('connect', () => { eveSocket.emit('setup', eveUser.id || eveId); e = true; if (a && b && e) resolve(); });
  });

  const canonicalChatId = [aliceId, bobId].sort().join('::');

  // -------------------------------------------------------------
  // Test 1: Valid aliceId::bobId send succeeds for Alice -> Bob
  // -------------------------------------------------------------
  console.log('--- TEST 1: Valid aliceId::bobId send succeeds (Alice -> Bob) ---');
  const env1 = await encryptEnvelope({ content: 'Test Msg 1', type: 'text' }, bobPubKey, aliceIdent.deviceId, bobDevice.device_id);

  let bobReceivedMsg1 = null;
  bobSocket.on('new_message', (m) => { if (m.clientTempId === 't1_alice') bobReceivedMsg1 = m; });

  const ack1 = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: env1,
      clientTempId: 't1_alice',
      type: 'text'
    }, resolve);
  });

  assert.strictEqual(ack1.success, true, 'Alice send must succeed with ACK success: true');
  assert(ack1.message && ack1.message.id, 'ACK must contain message.id');

  // Wait for Bob to receive
  for (let i = 0; i < 20; i++) {
    if (bobReceivedMsg1) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert(bobReceivedMsg1, 'Bob must receive message 1');
  console.log('✅ TEST 1 PASSED: Alice -> Bob message delivered successfully under canonical :: chatId');

  // -------------------------------------------------------------
  // Test 2: Reverse-direction messaging succeeds (Bob -> Alice)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Reverse-direction messaging succeeds (Bob -> Alice) ---');
  const env2 = await encryptEnvelope({ content: 'Test Msg 2 Reply', type: 'text' }, alicePubKey, bobIdent.deviceId, aliceDevice.device_id);

  let aliceReceivedMsg2 = null;
  aliceSocket.on('new_message', (m) => { if (m.clientTempId === 't2_bob') aliceReceivedMsg2 = m; });

  const ack2 = await new Promise(resolve => {
    bobSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: bobId,
      receiverId: aliceId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: env2,
      clientTempId: 't2_bob',
      type: 'text'
    }, resolve);
  });

  assert.strictEqual(ack2.success, true, 'Bob send must succeed with ACK success: true');
  for (let i = 0; i < 20; i++) {
    if (aliceReceivedMsg2) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert(aliceReceivedMsg2, 'Alice must receive reverse message 2');
  console.log('✅ TEST 2 PASSED: Bob -> Alice reverse delivery verified under canonical :: chatId');

  // -------------------------------------------------------------
  // Test 3: Non-participant (Eve) cannot send into that conversation
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Non-participant (Eve) cannot send into Alice::Bob conversation ---');
  const eveAck = await new Promise(resolve => {
    eveSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: eveUser.id || eveId,
      receiverId: bobId,
      isGroup: false,
      content: 'Eve impersonation attempt',
      clientTempId: 't3_eve',
      type: 'text'
    }, resolve);
  });

  assert.strictEqual(eveAck.error, 'NOT_A_CHAT_PARTICIPANT', 'Eve must be rejected with NOT_A_CHAT_PARTICIPANT');
  console.log('✅ TEST 3 PASSED: Non-participant correctly rejected with NOT_A_CHAT_PARTICIPANT');

  // -------------------------------------------------------------
  // Test 4: Malformed IDs, extra delimiters, and empty participants
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Malformed IDs, extra delimiters, and empty participants rejected ---');
  // Extra delimiter
  const malformed1Ack = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: `${aliceId}::${bobId}::extra`,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: 'test',
      clientTempId: 't4_malformed1',
      type: 'text'
    }, resolve);
  });
  assert.strictEqual(malformed1Ack.error, 'MALFORMED_CHAT_ID');

  // Empty participant
  const malformed2Ack = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: `${aliceId}::`,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: 'test',
      clientTempId: 't4_malformed2',
      type: 'text'
    }, resolve);
  });
  assert.strictEqual(malformed2Ack.error, 'MALFORMED_CHAT_ID');

  // Identical participants
  const malformed3Ack = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: `${aliceId}::${aliceId}`,
      senderId: aliceId,
      receiverId: aliceId,
      isGroup: false,
      content: 'test',
      clientTempId: 't4_malformed3',
      type: 'text'
    }, resolve);
  });
  assert.strictEqual(malformed3Ack.error, 'MALFORMED_CHAT_ID');

  // Non-existent peer in canonical ID
  const invalidPeerAck = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: `${aliceId}::ghost_user_99999999`,
      senderId: aliceId,
      receiverId: 'ghost_user_99999999',
      isGroup: false,
      content: 'test',
      clientTempId: 't4_ghost',
      type: 'text'
    }, resolve);
  });
  assert.strictEqual(invalidPeerAck.error, 'INVALID_CHAT_RECIPIENT');

  console.log('✅ TEST 4 PASSED: All malformed, extra-delimited, and invalid-peer IDs rejected safely');

  // -------------------------------------------------------------
  // Test 5: Legacy conversation behavior remains safe and isolated
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Legacy underscore conversation behavior & isolation ---');
  const legacyUnderscoreChatId = [aliceId, bobId].sort().join('_');
  const envLegacy = await encryptEnvelope({ content: 'Legacy Message', type: 'text' }, bobPubKey, aliceIdent.deviceId, bobDevice.device_id);

  const legacyAck = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: legacyUnderscoreChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: envLegacy,
      clientTempId: 't5_legacy',
      type: 'text'
    }, resolve);
  });

  assert.strictEqual(legacyAck.success, true, 'Legacy underscore send must succeed for valid participants');

  // Third party (Eve) trying to inject into legacy chatId
  const legacyEveAck = await new Promise(resolve => {
    eveSocket.emit('send_message', {
      chatId: legacyUnderscoreChatId,
      senderId: eveUser.id || eveId,
      receiverId: bobId,
      isGroup: false,
      content: 'Eve into legacy',
      clientTempId: 't5_legacy_eve',
      type: 'text'
    }, resolve);
  });

  assert.strictEqual(legacyEveAck.error, 'NOT_A_CHAT_PARTICIPANT', 'Eve cannot inject into legacy underscore chat');
  console.log('✅ TEST 5 PASSED: Legacy underscore conversation supported without collision/injection');

  aliceSocket.disconnect();
  bobSocket.disconnect();
  eveSocket.disconnect();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('   ALL 5 REGRESSION TESTS PASSED (5/5) WITH ZERO FAILURES      ');
  console.log('================================================================\n');

  process.exit(0);
}

runRegressionSuite().catch(err => {
  console.error('\n❌ REGRESSION FAILURE:', err);
  process.exit(1);
});
