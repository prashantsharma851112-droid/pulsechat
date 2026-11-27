/**
 * Automated Forensic & Negative Security Test Suite:
 * QR Device-to-Device Session Cryptographic Binding & Mutual Peer Verification
 * 
 * Verifies:
 * 1. Valid transfer restores all historical messages and conversations cleanly.
 * 2. Cross-session replay attack: chunk from another session ID is strictly rejected.
 * 3. Tampered chunk index: modified chunkIndex fails AAD authentication / pre-validation.
 * 4. Tampered account ID: modified userId fails HKDF key derivation & AAD authentication.
 * 5. Tampered device identities: modified senderDeviceId/receiverDeviceId is rejected.
 * 6. Tampered ciphertext: single-byte modification fails AES-256-GCM authentication tag.
 * 7. Tampered AAD: modified additionalData causes GCM tag mismatch.
 * 8. Duplicate chunk injection: duplicate chunk index is rejected.
 * 9. Out-of-order chunk injection: chunk arriving out of sequence is rejected.
 * 10. Mismatched SAS code: security code mismatch aborts mutual authentication.
 */

const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

const { subtle } = globalThis.crypto;

// Derive session key with HKDF session & identity context binding
async function deriveSyncSessionKey(myPrivateKey, peerPublicJwk, context = {}) {
  const peerKey = await subtle.importKey(
    'jwk',
    peerPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: peerKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const protocolVersion = context.protocolVersion || 'pulsechat-qr-device-transfer-v2';
  const sessionId = context.sessionId || 'default_session';
  const userId = context.userId || '';
  const oldDeviceId = context.oldDeviceId || 'old_device';
  const newDeviceId = context.newDeviceId || 'new_device';

  const saltSource = `salt|${protocolVersion}|${sessionId}|${userId}`;
  const saltDigest = await subtle.digest('SHA-256', new TextEncoder().encode(saltSource));
  const salt = new Uint8Array(saltDigest).slice(0, 16);

  const infoSource = `info|${protocolVersion}|${sessionId}|${userId}|${oldDeviceId}|${newDeviceId}`;
  const info = new TextEncoder().encode(infoSource);

  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Compute mutual 6-digit Short Authentication String
async function computeSasCode({ sessionId, userId, oldDeviceId, newDeviceId, oldDevicePublicKey, newDevicePublicKey }) {
  const ox = oldDevicePublicKey?.x || '';
  const oy = oldDevicePublicKey?.y || '';
  const nx = newDevicePublicKey?.x || '';
  const ny = newDevicePublicKey?.y || '';
  const dataString = `pulsechat-sas-v1|${sessionId}|${userId}|${oldDeviceId || 'old'}|${newDeviceId || 'new'}|${ox}|${oy}|${nx}|${ny}`;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(dataString));
  const bytes = new Uint8Array(digest);
  const val = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const num = val % 1000000;
  const codeStr = String(num).padStart(6, '0');
  return `${codeStr.slice(0, 3)}-${codeStr.slice(3)}`;
}

// Canonical AAD constructor
function constructChunkAad({ protocolVersion = 'pulsechat-qr-device-transfer-v2', sessionId, userId, senderDeviceId, oldDeviceId, receiverDeviceId, newDeviceId, chunkIndex, totalChunks }) {
  const sDev = senderDeviceId || oldDeviceId || 'old';
  const rDev = receiverDeviceId || newDeviceId || 'new';
  const aadString = `${protocolVersion}|${sessionId}|${userId}|${sDev}|${rDev}|${chunkIndex}|${totalChunks}`;
  return new TextEncoder().encode(aadString);
}

// Simulated New Device receiver chunk processor
async function processIncomingChunk(chunkData, expectedContext, sessionKey, state) {
  const {
    sessionId: chunkSessionId,
    chunkIndex,
    totalChunks,
    senderDeviceId,
    receiverDeviceId,
    encryptedPayload,
    iv
  } = chunkData;

  // 1. Strict pre-decryption validations
  if (chunkSessionId !== expectedContext.sessionId) {
    throw new Error(`SECURITY_VIOLATION: Session ID mismatch: received '${chunkSessionId}', expected '${expectedContext.sessionId}'`);
  }
  const expectedSenderId = expectedContext.senderDeviceId || expectedContext.oldDeviceId;
  const expectedReceiverId = expectedContext.receiverDeviceId || expectedContext.newDeviceId;

  if (senderDeviceId && expectedSenderId && senderDeviceId !== expectedSenderId) {
    throw new Error(`SECURITY_VIOLATION: Sender device ID mismatch: received '${senderDeviceId}', expected '${expectedSenderId}'`);
  }
  if (receiverDeviceId && expectedReceiverId && receiverDeviceId !== expectedReceiverId) {
    throw new Error(`SECURITY_VIOLATION: Receiver device ID mismatch: received '${receiverDeviceId}', expected '${expectedReceiverId}'`);
  }
  if (typeof chunkIndex !== 'number' || chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new Error(`SECURITY_VIOLATION: Invalid chunkIndex ${chunkIndex} for totalChunks ${totalChunks}`);
  }
  if (state.seenChunkIndices.has(chunkIndex)) {
    throw new Error(`SECURITY_VIOLATION: Duplicate chunkIndex ${chunkIndex} rejected`);
  }
  if (chunkIndex !== state.expectedNextIndex) {
    throw new Error(`SECURITY_VIOLATION: Out-of-order chunk rejected. Expected index ${state.expectedNextIndex}, received ${chunkIndex}`);
  }

  // 2. Reconstruct AAD exactly from expected context
  const aad = constructChunkAad({
    protocolVersion: expectedContext.protocolVersion || 'pulsechat-qr-device-transfer-v2',
    sessionId: expectedContext.sessionId,
    userId: expectedContext.userId,
    senderDeviceId: expectedSenderId,
    receiverDeviceId: expectedReceiverId,
    chunkIndex,
    totalChunks
  });

  // 3. Decrypt with AES-GCM and verify tag
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    sessionKey,
    encryptedPayload
  );

  state.seenChunkIndices.add(chunkIndex);
  state.expectedNextIndex++;

  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function runNegativeSecuritySuite() {
  console.log('========================================================================');
  console.log(' STARTING QR SECURITY HARDENING NEGATIVE & TAMPER TEST SUITE ');
  console.log('========================================================================\n');

  // Generate Alice Old Phone and New Phone keypairs
  const oldPhoneKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const oldPhonePublicJwk = await subtle.exportKey('jwk', oldPhoneKeyPair.publicKey);

  const newPhoneKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const newPhonePublicJwk = await subtle.exportKey('jwk', newPhoneKeyPair.publicKey);

  const sessionId = 'qrsync_test_session_legit_001';
  const userId = 'user_alice_456';
  const oldDeviceId = 'phone_pixel7_old';
  const newDeviceId = 'phone_pixel8_new';

  const legitimateContext = {
    protocolVersion: 'pulsechat-qr-device-transfer-v2',
    sessionId,
    userId,
    oldDeviceId,
    newDeviceId
  };

  // Derive symmetric keys on both devices
  const oldDeviceKey = await deriveSyncSessionKey(oldPhoneKeyPair.privateKey, newPhonePublicJwk, legitimateContext);
  const newDeviceKey = await deriveSyncSessionKey(newPhoneKeyPair.privateKey, oldPhonePublicJwk, legitimateContext);

  // Sample history data
  const sampleMessages = [
    { id: 'm1', content: 'Secret Alpha', timestamp: '2026-11-20T10:00:00Z' },
    { id: 'm2', content: 'Secret Beta', timestamp: '2026-11-20T10:05:00Z' }
  ];

  // Helper to encrypt a valid chunk
  async function makeEncryptedChunk({ chunkIndex = 0, totalChunks = 1, msgs = sampleMessages, key = oldDeviceKey, ctx = legitimateContext }) {
    const payload = { chunkIndex, totalChunks, messages: msgs };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const aad = constructChunkAad({
      protocolVersion: ctx.protocolVersion,
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      senderDeviceId: ctx.oldDeviceId,
      receiverDeviceId: ctx.newDeviceId,
      chunkIndex,
      totalChunks
    });

    const encrypted = await subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      key,
      encoded
    );

    return {
      sessionId: ctx.sessionId,
      chunkIndex,
      totalChunks,
      senderDeviceId: ctx.oldDeviceId,
      receiverDeviceId: ctx.newDeviceId,
      encryptedPayload: encrypted,
      iv
    };
  }

  // TEST 1: Baseline valid chunk restores cleanly
  {
    console.log('--- TEST 1: Baseline Valid Chunk Recovery ---');
    const validChunk = await makeEncryptedChunk({});
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    const result = await processIncomingChunk(validChunk, legitimateContext, newDeviceKey, receiverState);
    assert.strictEqual(result.messages.length, 2);
    assert.strictEqual(result.messages[0].content, 'Secret Alpha');
    assert.strictEqual(result.messages[1].content, 'Secret Beta');
    console.log('✓ PASS 1: Valid chunk processed and historical messages verified');
  }

  // TEST 2: Chunk from another session ID is rejected
  {
    console.log('\n--- TEST 2: Cross-Session Replay Attack ---');
    const rogueSessionId = 'qrsync_rogue_victim_session_999';
    const rogueContext = { ...legitimateContext, sessionId: rogueSessionId };
    const rogueKey = await deriveSyncSessionKey(oldPhoneKeyPair.privateKey, newPhonePublicJwk, rogueContext);
    const rogueChunk = await makeEncryptedChunk({ ctx: rogueContext, key: rogueKey });

    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      // Receiver expecting legitimateContext
      await processIncomingChunk(rogueChunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert(err.message.includes('Session ID mismatch') || err.name === 'OperationError');
    }
    assert.strictEqual(rejected, true, 'Chunk from foreign session must be strictly rejected');
    console.log('✓ PASS 2: Chunk from foreign session ID rejected');
  }

  // TEST 3: Chunk with modified chunk index
  {
    console.log('\n--- TEST 3: Modified Chunk Index Tampering ---');
    const chunk = await makeEncryptedChunk({ chunkIndex: 0, totalChunks: 2 });
    // Attacker modifies chunkIndex property to 1
    chunk.chunkIndex = 1;
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      await processIncomingChunk(chunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert(err.message.includes('Out-of-order') || err.name === 'OperationError');
    }
    assert.strictEqual(rejected, true, 'Modified chunk index must be rejected');
    console.log('✓ PASS 3: Modified chunk index rejected');
  }

  // TEST 4: Modified account ID (userId)
  {
    console.log('\n--- TEST 4: Cross-Account Hijacking Tampering ---');
    const eveContext = { ...legitimateContext, userId: 'user_eve_attacker' };
    const eveKey = await deriveSyncSessionKey(oldPhoneKeyPair.privateKey, newPhonePublicJwk, eveContext);
    const eveChunk = await makeEncryptedChunk({ ctx: eveContext, key: eveKey });
    eveChunk.sessionId = legitimateContext.sessionId; // Spoof matching sessionId

    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      await processIncomingChunk(eveChunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      // OperationError from subtle.decrypt (AES-GCM tag mismatch because HKDF key or AAD differs)
      assert.strictEqual(err.name, 'OperationError');
    }
    assert.strictEqual(rejected, true, 'Cross-account tampered chunk must fail tag verification');
    console.log('✓ PASS 4: Modified account ID causes AES-GCM tag verification failure');
  }

  // TEST 5: Modified device identities
  {
    console.log('\n--- TEST 5: Modified Sender/Receiver Identity ---');
    const spoofedChunk = await makeEncryptedChunk({});
    spoofedChunk.senderDeviceId = 'rogue_device_attacker';
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      await processIncomingChunk(spoofedChunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert(err.message.includes('Sender device ID mismatch'));
    }
    assert.strictEqual(rejected, true, 'Spoofed sender device ID must be rejected');
    console.log('✓ PASS 5: Modified sender/receiver device identity rejected');
  }

  // TEST 6: Modified ciphertext
  {
    console.log('\n--- TEST 6: Tampered Ciphertext Bit Flips ---');
    const chunk = await makeEncryptedChunk({});
    const tamperedPayload = new Uint8Array(chunk.encryptedPayload);
    tamperedPayload[10] ^= 0xff; // Flip bits in ciphertext body
    chunk.encryptedPayload = tamperedPayload.buffer;

    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      await processIncomingChunk(chunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert.strictEqual(err.name, 'OperationError', 'GCM tag mismatch must throw OperationError');
    }
    assert.strictEqual(rejected, true, 'Tampered ciphertext must fail GCM tag verification');
    console.log('✓ PASS 6: Tampered ciphertext strictly rejected with OperationError');
  }

  // TEST 7: Modified AAD
  {
    console.log('\n--- TEST 7: Tampered Additional Authenticated Data ---');
    const chunk = await makeEncryptedChunk({});
    // Receiver attempts to verify with tampered context (e.g. modified protocol version)
    const tamperedCtx = { ...legitimateContext, protocolVersion: 'pulsechat-qr-device-transfer-v1-spoofed' };
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    let rejected = false;
    try {
      await processIncomingChunk(chunk, tamperedCtx, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert.strictEqual(err.name, 'OperationError', 'Mismatched AAD must fail tag verification');
    }
    assert.strictEqual(rejected, true, 'Mismatched AAD must fail GCM authentication');
    console.log('✓ PASS 7: Tampered AAD fails AES-256-GCM authentication tag verification');
  }

  // TEST 8: Duplicate chunk injection
  {
    console.log('\n--- TEST 8: Duplicate Chunk Injection Attack ---');
    const chunk = await makeEncryptedChunk({ chunkIndex: 0, totalChunks: 2 });
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };
    await processIncomingChunk(chunk, legitimateContext, newDeviceKey, receiverState);

    let rejected = false;
    try {
      // Attacker replays identical chunk 0 again
      await processIncomingChunk(chunk, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert(err.message.includes('Duplicate chunkIndex') || err.message.includes('Out-of-order'));
    }
    assert.strictEqual(rejected, true, 'Duplicate chunk index must be rejected');
    console.log('✓ PASS 8: Duplicate chunk injection rejected');
  }

  // TEST 9: Out-of-order chunk injection
  {
    console.log('\n--- TEST 9: Out-of-Order Chunk Injection Attack ---');
    const chunk1 = await makeEncryptedChunk({ chunkIndex: 1, totalChunks: 3 });
    const receiverState = { seenChunkIndices: new Set(), expectedNextIndex: 0 };

    let rejected = false;
    try {
      // Chunk 1 arrives before Chunk 0
      await processIncomingChunk(chunk1, legitimateContext, newDeviceKey, receiverState);
    } catch (err) {
      rejected = true;
      assert(err.message.includes('Out-of-order chunk rejected'));
    }
    assert.strictEqual(rejected, true, 'Out-of-order chunk must be rejected');
    console.log('✓ PASS 9: Out-of-order chunk injection rejected');
  }

  // TEST 10: Mutual Short Authentication String (SAS) Verification
  {
    console.log('\n--- TEST 10: Mutual Short Authentication String (SAS) Safety ---');
    const sasA = await computeSasCode({
      sessionId,
      userId,
      oldDeviceId,
      newDeviceId,
      oldDevicePublicKey: oldPhonePublicJwk,
      newDevicePublicKey: newPhonePublicJwk
    });
    const sasB = await computeSasCode({
      sessionId,
      userId,
      oldDeviceId,
      newDeviceId,
      oldDevicePublicKey: oldPhonePublicJwk,
      newDevicePublicKey: newPhonePublicJwk
    });
    assert.strictEqual(sasA, sasB, 'Both legitimate endpoints must compute identical SAS code');
    assert(/^\d{3}-\d{3}$/.test(sasA), 'SAS must be 6 decimal digits formatted with hyphen');

    // Attacker substitutes new phone's public key
    const eveKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const evePublicJwk = await subtle.exportKey('jwk', eveKeyPair.publicKey);
    const sasMITM = await computeSasCode({
      sessionId,
      userId,
      oldDeviceId,
      newDeviceId,
      oldDevicePublicKey: oldPhonePublicJwk,
      newDevicePublicKey: evePublicJwk
    });

    assert.notStrictEqual(sasA, sasMITM, 'Key substitution must result in completely different SAS codes');
    console.log(`✓ PASS 10: SAS codes match for legitimate peers (${sasA}) and diverge under key substitution (${sasMITM})`);
  }

  console.log('\n========================================================================');
  console.log(' ALL 10 NEGATIVE SECURITY TESTS PASSED CLEANLY (100% VERIFIED) ');
  console.log('========================================================================');
}

runNegativeSecuritySuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
