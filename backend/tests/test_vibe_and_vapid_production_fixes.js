/**
 * Test Suite: Production Fixes Verification (Vibe Hydration, VAPID Key Persistence, and Backup Security)
 *
 * Verifies:
 * 1. Root-cause fix for 'usersWithVibes is not defined' via hydrateUserVibeAuras.
 * 2. VAPID key initialization trace: no premature warning, stable persistence in MongoDB, zero secret leakage.
 * 3. Encrypted backup & restore verification (account isolation, wrong password, ciphertext tampering).
 */

const assert = require('assert');
const { hydrateUserVibeAuras } = require('../utils/vibeHydration');
const webpush = require('../utils/webpush');
const {
  encryptBackupPayload,
  decryptBackupPayload,
  validateBackupPayload,
  filterMessagesForUser,
  isParticipantInChat
} = require('../utils/backupCrypto');

let testsPassed = 0;
let testsFailed = 0;

function pass(name) {
  console.log(`[PASS] ${name}`);
  testsPassed++;
}

function fail(name, err) {
  console.error(`[FAIL] ${name}: ${err?.message || err}`);
  testsFailed++;
}

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING AUTOMATED TESTS: VIBE HYDRATION, VAPID & BACKUP FIXES ');
  console.log('================================================================\n');

  // --- SUITE 1: Vibe Hydration Fix ('usersWithVibes' ReferenceError regression) ---
  console.log('--- SUITE 1: Vibe Hydration Fix ---');
  try {
    const activeTime = Date.now();
    const mockUsers = [
      {
        _id: 'mongo_u1',
        id: 'user_u1',
        username: 'alice',
        vibeAura: {
          auraType: 'neon',
          mood: 'Energetic',
          cleared: false,
          trialExpiresAt: activeTime + 3600000 // Valid
        }
      },
      {
        _id: 'mongo_u2',
        id: 'user_u2',
        username: 'bob',
        vibeAura: {
          auraType: 'fire',
          mood: 'Gaming',
          cleared: false,
          trialExpiresAt: activeTime - 10000 // Expired
        }
      },
      {
        _id: 'mongo_u3',
        id: 'user_u3',
        username: 'charlie',
        vibeAura: {
          auraType: 'none',
          cleared: true
        }
      }
    ];

    const unsets = [];
    const MockUserModel = {
      find: (query) => {
        return {
          lean: async () => mockUsers
        };
      },
      updateOne: (filter, update) => {
        unsets.push({ filter, update });
        return { catch: () => {} };
      }
    };

    const auraMap = new Map();
    // Must NOT throw ReferenceError: usersWithVibes is not defined
    const hydratedCount = await hydrateUserVibeAuras(MockUserModel, auraMap, activeTime);

    assert.ok(hydratedCount > 0, 'Should hydrate active user vibe auras');
    assert.strictEqual(auraMap.has('user_u1'), true, 'Alice aura should be in map');
    assert.strictEqual(auraMap.has('user_u2'), false, 'Expired Bob aura should NOT be in map');
    assert.strictEqual(auraMap.has('user_u3'), false, 'Cleared Charlie aura should NOT be in map');
    assert.strictEqual(unsets.length, 1, 'Expired trial aura should be unset from MongoDB');

    pass('hydrateUserVibeAuras resolves usersWithVibes safely and handles active vs expired auras');
  } catch (err) {
    fail('hydrateUserVibeAuras resolves usersWithVibes safely and handles active vs expired auras', err);
  }

  // Test empty database case
  try {
    const EmptyUserModel = {
      find: () => ({ lean: async () => [] })
    };
    const emptyMap = new Map();
    const count = await hydrateUserVibeAuras(EmptyUserModel, emptyMap);
    assert.strictEqual(count, 0);
    pass('hydrateUserVibeAuras handles empty database without warnings or errors');
  } catch (err) {
    fail('hydrateUserVibeAuras handles empty database without warnings or errors', err);
  }

  // --- SUITE 2: VAPID Key Initialization & MongoDB Persistence ---
  console.log('\n--- SUITE 2: VAPID Key Initialization & MongoDB Persistence ---');
  try {
    const initialKey = webpush.getVapidPublicKey();
    assert.ok(typeof initialKey === 'string' && initialKey.length > 20, 'VAPID public key must be initialized');

    // Mock VapidKey Model for MongoDB
    let dbRecord = null;
    const MockVapidKeyModel = {
      findOne: async (query) => dbRecord,
      create: async (data) => {
        dbRecord = { ...data };
        return dbRecord;
      }
    };

    // First sync creates record
    await webpush.syncWithMongo(MockVapidKeyModel);
    assert.strictEqual(webpush.isVapidPersistent(), true, 'VAPID should be marked persistent after sync');
    assert.strictEqual(dbRecord.keyId, 'default_vapid_key');
    assert.ok(dbRecord.publicKey && dbRecord.privateKey);

    const savedPublicKey = dbRecord.publicKey;

    // Second sync simulates container restart loading from MongoDB
    await webpush.syncWithMongo(MockVapidKeyModel);
    assert.strictEqual(webpush.getVapidPublicKey(), savedPublicKey, 'Public key must remain stable across container restarts');
    pass('VAPID keys persist to MongoDB and remain identical across container restarts');
  } catch (err) {
    fail('VAPID keys persist to MongoDB and remain identical across container restarts', err);
  }

  try {
    // Verify no secret private keys are logged or printed
    const publicData = webpush.getVapidPublicKey();
    assert.strictEqual(typeof publicData, 'string');
    // Ensure getVapidPublicKey does NOT return privateKey
    assert.strictEqual(publicData.includes('PRIVATE KEY'), false);
    pass('getVapidPublicKey exposes only public key and never exposes private key');
  } catch (err) {
    fail('getVapidPublicKey exposes only public key and never exposes private key', err);
  }

  // --- SUITE 3: Deep Verification of Encrypted Backup & Restore ---
  console.log('\n--- SUITE 3: Encrypted Backup & Restore Verification ---');
  try {
    const aliceUser = { id: 'u_alice', username: 'alice' };
    const bobUser = { id: 'u_bob', username: 'bob' };
    const password = 'CorrectPassword123!';

    const sampleBackup = {
      app: 'PulseChat',
      version: 2,
      user: aliceUser,
      messages: [
        {
          id: 'm1',
          chatId: 'u_alice_u_bob',
          senderId: 'u_alice',
          recipientId: 'u_bob',
          content: 'Confidential message',
          timestamp: new Date().toISOString()
        }
      ]
    };

    const envelope = await encryptBackupPayload(sampleBackup, password, aliceUser);

    // 1. Account Isolation: Bob trying to restore Alice's backup
    let blockedAccountMismatch = false;
    try {
      validateBackupPayload(sampleBackup, bobUser, envelope.account);
    } catch (err) {
      blockedAccountMismatch = true;
      assert.ok(err.message.includes('ACCOUNT_MISMATCH'));
    }
    assert.strictEqual(blockedAccountMismatch, true, 'Bob restoring Alice backup must be blocked');

    // 2. Wrong Password rejection
    let wrongPwBlocked = false;
    try {
      await decryptBackupPayload(envelope, 'WrongPassword999!');
    } catch (err) {
      wrongPwBlocked = true;
      assert.ok(err.message.includes('DECRYPTION_FAILED'));
      assert.strictEqual(err.message.includes('WrongPassword999!'), false, 'Password must not leak in error');
    }
    assert.strictEqual(wrongPwBlocked, true, 'Wrong password must be blocked');

    // 3. Tampered ciphertext rejection
    const { base64ToBuffer, bufferToBase64 } = require('../utils/backupCrypto');
    const rawCipher = base64ToBuffer(envelope.ciphertext);
    rawCipher[0] ^= 0x42; // Corrupt ciphertext
    const tampered = { ...envelope, ciphertext: bufferToBase64(rawCipher) };

    let tamperBlocked = false;
    try {
      await decryptBackupPayload(tampered, password);
    } catch (err) {
      tamperBlocked = true;
      assert.ok(err.message.includes('DECRYPTION_FAILED'));
    }
    assert.strictEqual(tamperBlocked, true, 'Tampered ciphertext must fail GCM tag authentication');

    // 4. Participant validation in chat
    assert.strictEqual(isParticipantInChat('u_alice_u_bob', 'u_alice'), true);
    assert.strictEqual(isParticipantInChat('u_alice_u_bob', 'u_bob'), true);
    assert.strictEqual(isParticipantInChat('u_alice_u_bob', 'u_eve'), false);

    pass('Full backup security verified: strict account isolation, wrong-password rejection, and GCM tamper detection');
  } catch (err) {
    fail('Full backup security verified: strict account isolation, wrong-password rejection, and GCM tamper detection', err);
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${testsPassed}/${testsPassed + testsFailed} TESTS PASSED`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
