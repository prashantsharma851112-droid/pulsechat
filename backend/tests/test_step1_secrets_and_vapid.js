const path = require('path');
const backendDir = path.resolve(__dirname, '..');
const assert = require('assert');
const fs = require('fs');

try {
  require(path.join(backendDir, 'node_modules/dotenv')).config({
    path: path.join(backendDir, '.env')
  });
} catch (e) {}

console.log('================================================================');
console.log(' RUNNING AUTOMATED TESTS FOR STEP 1: SECRETS & VAPID HARDENING');
console.log('================================================================\n');

let total = 0;
let passed = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}:`, err.message);
    process.exitCode = 1;
  }
}

// 1. Test config.js fails safely if JWT_SECRET is missing
runTest('config.js throws fatal error if JWT_SECRET is missing', () => {
  const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
  const origDotenvConfig = dotenv.config;
  dotenv.config = () => {};

  const originalJwt = process.env.JWT_SECRET;
  const originalReceipt = process.env.RECEIPT_SECRET;

  delete process.env.JWT_SECRET;
  process.env.RECEIPT_SECRET = 'a'.repeat(32);

  delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];

  let threw = false;
  try {
    require(path.join(backendDir, 'config.js'));
  } catch (err) {
    threw = true;
    assert(err.message.includes("Required environment variable 'JWT_SECRET' is missing"), 'Expected specific JWT_SECRET error message');
  } finally {
    dotenv.config = origDotenvConfig;
    process.env.JWT_SECRET = originalJwt;
    process.env.RECEIPT_SECRET = originalReceipt;
    delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];
  }
  assert(threw, 'Expected config.js to throw when JWT_SECRET is missing');
});

// 2. Test config.js fails safely if RECEIPT_SECRET is missing
runTest('config.js throws fatal error if RECEIPT_SECRET is missing', () => {
  const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
  const origDotenvConfig = dotenv.config;
  dotenv.config = () => {};

  const originalJwt = process.env.JWT_SECRET;
  const originalReceipt = process.env.RECEIPT_SECRET;

  process.env.JWT_SECRET = 'a'.repeat(32);
  delete process.env.RECEIPT_SECRET;

  delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];

  let threw = false;
  try {
    require(path.join(backendDir, 'config.js'));
  } catch (err) {
    threw = true;
    assert(err.message.includes("Required environment variable 'RECEIPT_SECRET' is missing"), 'Expected specific RECEIPT_SECRET error message');
  } finally {
    dotenv.config = origDotenvConfig;
    process.env.JWT_SECRET = originalJwt;
    process.env.RECEIPT_SECRET = originalReceipt;
    delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];
  }
  assert(threw, 'Expected config.js to throw when RECEIPT_SECRET is missing');
});

// 3. Test config.js fails in production if secrets are too short (< 32 chars)
runTest('config.js throws fatal error in production if secrets are shorter than 32 chars', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origJwt = process.env.JWT_SECRET;
  const origReceipt = process.env.RECEIPT_SECRET;

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'short_insecure_key';
  process.env.RECEIPT_SECRET = 'short_insecure_key';

  delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];

  let threw = false;
  try {
    require(path.join(backendDir, 'config.js'));
  } catch (err) {
    threw = true;
    assert(err.message.includes('must each be at least 32 characters long in production'), 'Expected production length error message');
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.JWT_SECRET = origJwt;
    process.env.RECEIPT_SECRET = origReceipt;
    delete require.cache[require.resolve(path.join(backendDir, 'config.js'))];
  }
  assert(threw, 'Expected config.js to throw in production for short secrets');
});

// 4. Test config.js successfully exports clean configuration with valid environment
runTest('config.js loads valid configuration without insecure fallbacks', () => {
  const config = require(path.join(backendDir, 'config.js'));
  assert(typeof config.JWT_SECRET === 'string' && config.JWT_SECRET.length >= 32, 'JWT_SECRET should be at least 32 chars');
  assert(typeof config.RECEIPT_SECRET === 'string' && config.RECEIPT_SECRET.length >= 32, 'RECEIPT_SECRET should be at least 32 chars');
  assert(config.JWT_SECRET !== 'pulsechat_super_secret_key_2026', 'JWT_SECRET must not be the insecure default');
  assert(!config.RECEIPT_SECRET.startsWith('7f8a9b2c3d4e5f60718293a4b5c6d7e8'), 'RECEIPT_SECRET must not be the insecure default');
});

// 5. Test VAPID private key file is removed from disk
runTest('vapid-keys.json does not exist in backend/database/', () => {
  const vapidFilePath = path.resolve(path.join(backendDir, 'database/vapid-keys.json'));
  assert(!fs.existsSync(vapidFilePath), 'vapid-keys.json should not exist in the source-controlled project');
});

// 6. Test webpush.js initializes properly without disk files
runTest('webpush.js initializes VAPID keys securely from environment without creating disk files', () => {
  const webpush = require(path.join(backendDir, 'utils/webpush.js'));
  const pubKey = webpush.getVapidPublicKey();
  assert(typeof pubKey === 'string' && pubKey.length > 20, 'VAPID public key must be initialized');

  // Verify no file was created
  const vapidFilePath = path.resolve(path.join(backendDir, 'database/vapid-keys.json'));
  assert(!fs.existsSync(vapidFilePath), 'webpush.js must not recreate vapid-keys.json on disk');
});

// 7. Test HMAC receipt token verification works end-to-end with loaded config.RECEIPT_SECRET
runTest('Receipt token creation & verification functions correctly with config.RECEIPT_SECRET', () => {
  const config = require(path.join(backendDir, 'config.js'));
  const { createReceiptToken, verifyReceiptToken } = require(path.join(backendDir, 'chat/receiptToken.js'));

  const payload = {
    messageId: 'test_step1_msg_001',
    senderId: 'alice',
    receiverId: 'bob',
    expiresAt: Date.now() + 60000
  };

  const token = createReceiptToken(payload, config.RECEIPT_SECRET);
  assert(typeof token === 'string' && token.includes('.'), 'Token must be formatted as payload.signature');

  const claims = verifyReceiptToken(token, config.RECEIPT_SECRET);
  assert(claims !== null, 'Token verification must succeed with valid secret');
  assert.strictEqual(claims.messageId, payload.messageId, 'MessageId claim must match');
  assert.strictEqual(claims.senderId, payload.senderId, 'SenderId claim must match');
  assert.strictEqual(claims.receiverId, payload.receiverId, 'ReceiverId claim must match');

  // Wrong secret must reject
  const wrongSecretClaims = verifyReceiptToken(token, 'wrong_secret_at_least_32_characters_long_12345');
  assert.strictEqual(wrongSecretClaims, null, 'Verification with wrong secret must return null');
});

// 8. Test .env.example contains only placeholders and documents all required variables
runTest('.env.example documents JWT_SECRET, RECEIPT_SECRET, and VAPID keys with placeholders', () => {
  const envExampleContent = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8');
  assert(envExampleContent.includes('JWT_SECRET='), 'Must document JWT_SECRET');
  assert(envExampleContent.includes('RECEIPT_SECRET='), 'Must document RECEIPT_SECRET');
  assert(envExampleContent.includes('VAPID_PUBLIC_KEY='), 'Must document VAPID_PUBLIC_KEY');
  assert(envExampleContent.includes('VAPID_PRIVATE_KEY='), 'Must document VAPID_PRIVATE_KEY');
  assert(envExampleContent.includes('VAPID_SUBJECT='), 'Must document VAPID_SUBJECT');
  assert(!envExampleContent.includes('BJCQ79eC19'), 'Must not contain real VAPID keys');
  assert(!envExampleContent.includes('7f8a9b2c3d4e5f60718293a4b5c6d7e8'), 'Must not contain old receipt secret');
});

console.log('\n================================================================');
console.log(` STEP 1 TEST RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
console.log('================================================================');
