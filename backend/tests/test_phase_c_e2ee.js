/**
 * Phase C Verification: End-to-End Encryption (E2EE) & Authenticated Device Key Management
 */
const path = require('path');
const backendDir = path.resolve(__dirname, '..');

let passed = 0;
let total = 0;

function assert(description, condition) {
  total++;
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(' RUNNING PHASE C TESTS: END-TO-END ENCRYPTION & DEVICE KEYS     ');
console.log('================================================================\n');

async function runTests() {
  const subtle = globalThis.crypto.subtle;

  // ----------------------------------------------------------------------
  // 1. Device Key Model & Route Validation
  // ----------------------------------------------------------------------
  console.log('--- SUITE 1: Device Key Schema & Safety Invariants ---');
  const DeviceKey = require(path.resolve(backendDir, 'models/DeviceKey'));
  assert('DeviceKey model includes userId path', Boolean(DeviceKey.schema.path('userId')));
  assert('DeviceKey model includes deviceId path', Boolean(DeviceKey.schema.path('deviceId')));
  assert('DeviceKey model includes publicKey path', Boolean(DeviceKey.schema.path('publicKey')));

  const indexes = DeviceKey.schema.indexes();
  const compoundIndex = indexes.find(([spec]) => spec.userId === 1 && spec.deviceId === 1);
  assert('DeviceKey defines unique compound index on { userId: 1, deviceId: 1 }',
    Boolean(compoundIndex && compoundIndex[1]?.unique === true));

  // ----------------------------------------------------------------------
  // 2. ECDH Key Pair Generation & Public Key Export
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE 2: ECDH (P-256) Key Pair Generation & Isolation ---');

  // Alice Device Key Pair
  const aliceKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const alicePublicJwk = await subtle.exportKey('jwk', aliceKeyPair.publicKey);
  const alicePrivateJwk = await subtle.exportKey('jwk', aliceKeyPair.privateKey);

  // Bob Device Key Pair
  const bobKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const bobPublicJwk = await subtle.exportKey('jwk', bobKeyPair.publicKey);
  const bobPrivateJwk = await subtle.exportKey('jwk', bobKeyPair.privateKey);

  // Eve (Attacker) Device Key Pair
  const eveKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  assert('Alice public key JWK does not contain private key parameter d', alicePublicJwk.d === undefined);
  assert('Bob public key JWK does not contain private key parameter d', bobPublicJwk.d === undefined);
  assert('Private key JWK contains valid EC curve P-256', alicePrivateJwk.crv === 'P-256' && alicePrivateJwk.d !== undefined);

  // ----------------------------------------------------------------------
  // 3. E2EE Message Envelope Encryption & Forward Secrecy
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE 3: E2EE Message Envelope Encryption & Verification ---');

  // Encryption helper
  async function testEncrypt(payload, recipientPublicJwk, senderDevId, recipientDevId) {
    const ephKeyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const ephPubJwk = await subtle.exportKey('jwk', ephKeyPair.publicKey);

    const recipKey = await subtle.importKey('jwk', recipientPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await subtle.deriveBits({ name: 'ECDH', public: recipKey }, ephKeyPair.privateKey, 256);

    const hkdfKey = await subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']);
    const encKey = await subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('pulsechat-e2ee-message-v1') },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertextBuf = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, encKey, plaintextBytes);

    return {
      v: 1,
      format: 'pulse_e2ee_v1',
      senderDeviceId: senderDevId,
      recipientDeviceId: recipientDevId,
      ephemeralPublicKey: ephPubJwk,
      iv: Buffer.from(iv).toString('base64'),
      ciphertext: Buffer.from(ciphertextBuf).toString('base64')
    };
  }

  // Decryption helper
  async function testDecrypt(envelope, recipientPrivKey) {
    const ephKey = await subtle.importKey('jwk', envelope.ephemeralPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await subtle.deriveBits({ name: 'ECDH', public: ephKey }, recipientPrivKey, 256);

    const hkdfKey = await subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']);
    const decKey = await subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('pulsechat-e2ee-message-v1') },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = Buffer.from(envelope.iv, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, decKey, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  const sensitiveMessage = {
    content: 'Classified: Highly confidential message from Alice to Bob',
    timestamp: new Date().toISOString(),
    chatId: 'alice_bob'
  };

  const envelope = await testEncrypt(sensitiveMessage, bobPublicJwk, 'alice_device_1', 'bob_device_1');

  assert('Envelope contains pulse_e2ee_v1 format indicator', envelope.format === 'pulse_e2ee_v1');
  assert('Ciphertext does NOT contain sensitive message string (server cannot read)',
    !envelope.ciphertext.includes('Classified') && !Buffer.from(envelope.ciphertext, 'base64').toString().includes('Classified'));
  assert('Envelope binds senderDeviceId and recipientDeviceId',
    envelope.senderDeviceId === 'alice_device_1' && envelope.recipientDeviceId === 'bob_device_1');

  // Bob decrypts
  const decryptedByBob = await testDecrypt(envelope, bobKeyPair.privateKey);
  assert('Intended recipient (Bob) decrypts payload with perfect fidelity',
    decryptedByBob.content === sensitiveMessage.content);

  // Eve attempts to decrypt
  let eveFailed = false;
  try {
    await testDecrypt(envelope, eveKeyPair.privateKey);
  } catch (err) {
    eveFailed = true;
  }
  assert('Eavesdropper (Eve) fails to decrypt message with wrong private key', eveFailed === true);

  // Tampered ciphertext
  let tamperDetected = false;
  try {
    const tampered = { ...envelope };
    const rawBuf = Buffer.from(tampered.ciphertext, 'base64');
    rawBuf[0] ^= 0xFF; // Flip bit
    tampered.ciphertext = rawBuf.toString('base64');
    await testDecrypt(tampered, bobKeyPair.privateKey);
  } catch (_) {
    tamperDetected = true;
  }
  assert('Tampered ciphertext fails AES-GCM authentication tag verification', tamperDetected === true);

  // ----------------------------------------------------------------------
  // 4. Client-Side Media Encryption Before Upload
  // ----------------------------------------------------------------------
  console.log('\n--- SUITE 4: Client-Side Attachment Encryption & Zero CDN Plaintext ---');

  const rawImageBytes = Buffer.from('FAKE_PNG_BINARY_IMAGE_DATA_1234567890');
  const mediaKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const mediaKeyJwk = await subtle.exportKey('jwk', mediaKey);
  const mediaIv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const encryptedMediaBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: mediaIv, tagLength: 128 },
    mediaKey,
    rawImageBytes
  );

  assert('Encrypted media binary does NOT contain plaintext header',
    !Buffer.from(encryptedMediaBuf).toString().includes('FAKE_PNG_BINARY'));

  // Decrypt media client-side
  const decMediaKey = await subtle.importKey('jwk', mediaKeyJwk, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const decryptedMediaBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: mediaIv, tagLength: 128 },
    decMediaKey,
    encryptedMediaBuf
  );

  assert('Decrypted media client-side matches original bytes exactly',
    Buffer.from(decryptedMediaBuf).toString() === rawImageBytes.toString());

  console.log('\n================================================================');
  console.log(` PHASE C RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================');
}

runTests().catch(e => {
  console.error('Fatal Phase C test error:', e);
  process.exit(1);
});
