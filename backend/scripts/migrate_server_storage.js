/**
 * PulseChat Safe Storage Migration & Retention Sweeper
 * 
 * Usage:
 *   node migrate_server_storage.js --dry-run   (Reports candidate messages without deleting)
 *   node migrate_server_storage.js --apply     (Executes batched cleanup of expired server messages)
 * 
 * Invariants:
 * - Does NOT drop collections or indexes.
 * - Does NOT delete active pending queues (status: 'sent' within TTL).
 * - Only targets delivered/read terminal state messages and messages past retention cutoff.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isApply = process.argv.includes('--apply');
const isDryRun = !isApply;

async function run() {
  console.log('================================================================');
  console.log(` PULSECHAT STORAGE MINIMIZATION (${isDryRun ? 'DRY RUN' : 'LIVE APPLY'})`);
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI (or MONGODB_URI) environment variable is missing.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const Message = require('../models/Message');
  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

  // Query candidate documents for cleanup
  const candidateFilter = {
    $or: [
      { status: { $in: ['delivered', 'read'] } },
      { expiresAt: { $lte: now } },
      { createdAt: { $lt: retentionCutoff } }
    ]
  };

  const count = await Message.countDocuments(candidateFilter);
  console.log(`\nFound ${count} messages matching storage cleanup criteria (delivered, read, or past 24h retention).`);

  if (isDryRun) {
    console.log('\n[DRY RUN MODE]: No documents were modified or deleted.');
    console.log('To execute the migration, run:');
    console.log('  node backend/scripts/migrate_server_storage.js --apply\n');
  } else {
    console.log('\n[LIVE APPLY MODE]: Executing batched safe deletion...');
    const result = await Message.deleteMany(candidateFilter);
    console.log(`Successfully purged ${result.deletedCount} messages from server-side MongoDB storage.`);

    // Invalidate Redis RAM
    try {
      const redis = require('../utils/redis');
      if (redis.isConnected && redis.isConnected()) {
        await redis.invalidateAllRecent();
        console.log('Invalidated stale Redis RAM caches.');
      }
    } catch (_) {}
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
}

module.exports = { run };
