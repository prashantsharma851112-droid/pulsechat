/**
 * AUTHORIZED CLEANUP SCRIPT:
 * 1. Safely removes the two authorized legacy pre-E2EE message documents from MongoDB.
 * 2. Prunes redundant prefix indexes on 'messages' collection while preserving all required indexes.
 * 3. Confirms zero unintentional mutations.
 */

const mongoose = require('mongoose');
const assert = require('assert');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const TARGET_IDS = [
  '6ad5ff3454561568a21426e3', // Oct 19 legacy plaintext message
  '6aad256b99b5e18a50574ba7'  // Sept 18 legacy group image
];

async function executeAuthorizedCleanup() {
  console.log('================================================================');
  console.log(' PULSECHAT AUTHORIZED LEGACY MESSAGE CLEANUP');
  console.log(' Target IDs:', TARGET_IDS);
  console.log(' Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const messagesCol = db.collection('messages');

  // --- STEP 1: PRE-DELETION CONFIRMATION ---
  console.log('--- STEP 1: PRE-DELETION VERIFICATION ---');
  const targetObjectIds = TARGET_IDS.map(id => new mongoose.Types.ObjectId(id));
  const docsToDelete = await messagesCol.find({ _id: { $in: targetObjectIds } }).toArray();

  console.log(`Found ${docsToDelete.length} matching target documents in 'messages':`);
  docsToDelete.forEach((d, i) => {
    console.log(`  Target #${i + 1}: _id: ${d._id} | id: ${d.id} | timestamp: ${d.timestamp} | type: ${d.type} | isEncrypted: ${d.isEncrypted}`);
    assert(TARGET_IDS.includes(d._id.toString()), `Document ${d._id} must be in authorized list`);
  });

  assert.strictEqual(docsToDelete.length, 2, 'Must locate exactly the 2 authorized documents');

  // Check references across other collections
  console.log('\nChecking foreign references in other collections...');
  const collections = await db.listCollections().toArray();
  const targetMsgIds = docsToDelete.map(d => d.id).filter(Boolean);

  for (const c of collections) {
    if (c.name === 'messages') continue;
    const refCount = await db.collection(c.name).countDocuments({
      $or: [
        { messageId: { $in: targetMsgIds } },
        { id: { $in: targetMsgIds } }
      ]
    });
    if (refCount > 0) {
      console.log(`  Notice: Found ${refCount} reference(s) in collection [${c.name}]`);
    }
  }
  console.log('Foreign reference inspection complete.');

  // Total message count before deletion
  const totalBefore = await messagesCol.countDocuments();
  console.log(`Total messages in database before deletion: ${totalBefore}`);

  // --- STEP 2: EXECUTE PRECISE DELETION ---
  console.log('\n--- STEP 2: EXECUTING PRECISE DELETION ---');
  const deleteResult = await messagesCol.deleteMany({
    _id: { $in: targetObjectIds }
  });

  console.log(`Deleted Count: ${deleteResult.deletedCount}`);
  assert.strictEqual(deleteResult.deletedCount, 2, 'Must delete exactly 2 documents');

  const totalAfter = await messagesCol.countDocuments();
  console.log(`Total messages in database after deletion: ${totalAfter}`);
  assert.strictEqual(totalAfter, totalBefore - 2, 'Total messages must decrease by exactly 2');

  // Confirm neither target ID exists anymore
  const remaining = await messagesCol.find({ _id: { $in: targetObjectIds } }).toArray();
  assert.strictEqual(remaining.length, 0, 'Target documents must no longer exist in database');
  console.log('VERIFIED: Both target documents deleted cleanly.');

  // --- STEP 3: INSPECT & CLEANUP INDEXES ON [messages] ---
  console.log('\n--- STEP 3: INDEX INSPECTION & PRUNING ---');
  let currentIndexes = await messagesCol.indexes();
  console.log('Current indexes on messages collection:');
  currentIndexes.forEach(idx => {
    console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (expireAfterSeconds: ${idx.expireAfterSeconds ?? 'N/A'})`);
  });

  // Identify redundant indexes:
  // 1. 'chatId_1' is a redundant single-field prefix of 'chatId_1_timestamp_-1' and 'chatId_1_timestamp_1'.
  // 2. 'receiverId_1_status_1' is a redundant compound prefix of 'receiverId_1_status_1_senderId_1'.
  const redundantIndexNames = ['chatId_1', 'receiverId_1_status_1'];
  const droppedIndexes = [];

  for (const name of redundantIndexNames) {
    const exists = currentIndexes.some(i => i.name === name);
    if (exists) {
      console.log(`Dropping redundant prefix index: ${name}...`);
      await messagesCol.dropIndex(name);
      droppedIndexes.push(name);
      console.log(`Successfully dropped: ${name}`);
    } else {
      console.log(`Index ${name} not present or already dropped.`);
    }
  }

  // --- STEP 4: POST-CLEANUP VERIFICATION ---
  console.log('\n--- STEP 4: POST-CLEANUP VERIFICATION ---');
  const finalIndexes = await messagesCol.indexes();
  console.log('Preserved indexes on messages collection:');
  finalIndexes.forEach(idx => {
    console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
  });

  // Verify essential indexes are preserved
  const preservedNames = finalIndexes.map(i => i.name);
  const requiredIndexes = [
    '_id_',
    'id_1',
    'clientTempId_1',
    'expiresAt_1',
    'chatId_1_timestamp_-1',
    'receiverId_1_status_1_senderId_1'
  ];

  requiredIndexes.forEach(req => {
    assert(preservedNames.includes(req), `Critical index ${req} must be preserved!`);
  });
  console.log('VERIFIED: All critical and application-required indexes are safely preserved.');

  console.log('\n================================================================');
  console.log(' CLEANUP COMPLETE & VERIFIED SUCCESSFULLY');
  console.log(' Summary:');
  console.log(`   - Deleted Document Count: ${deleteResult.deletedCount}`);
  console.log(`   - Remaining Messages in DB: ${totalAfter}`);
  console.log(`   - Dropped Redundant Indexes: ${JSON.stringify(droppedIndexes)}`);
  console.log(`   - Preserved Indexes Count: ${finalIndexes.length}`);
  console.log('================================================================');

  await mongoose.disconnect();
}

executeAuthorizedCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
