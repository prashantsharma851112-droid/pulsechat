const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runForensics() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('================================================================');
  console.log('LIVE MONGODB ATLAS FORENSIC AUDIT');
  console.log('Database Name:', db.databaseName);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================');

  const collections = await db.listCollections().toArray();
  collections.sort((a, b) => a.name.localeCompare(b.name));
  console.log('\n--- 1. ALL COLLECTIONS & DOCUMENT COUNTS ---');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count} documents`);
  }

  console.log('\n--- 2. MESSAGE-RELATED COLLECTIONS & TTL INDEXES ---');
  const msgRelated = ['messages', 'queuedmessages', 'messageledgers', 'todevicetxns', 'vibes'];
  for (const name of msgRelated) {
    try {
      const indexes = await db.collection(name).indexes();
      console.log(`\nCollection: [${name}]`);
      indexes.forEach(idx => {
        console.log(`  Index: ${idx.name} | Key: ${JSON.stringify(idx.key)} | expireAfterSeconds: ${idx.expireAfterSeconds ?? 'none'}`);
      });
    } catch (err) {
      console.log(`  Could not inspect indexes for ${name}:`, err.message);
    }
  }

  console.log('\n--- 3. DETAILED SANITIZED INSPECTION OF [messages] ---');
  const msgs = await db.collection('messages').find({}).toArray();
  console.log(`Total documents in 'messages': ${msgs.length}`);
  msgs.forEach((m, idx) => {
    console.log(`\nMessage #${idx + 1}:`);
    console.log(`  _id:              ${m._id}`);
    console.log(`  clientTempId:     ${m.clientTempId || 'null'}`);
    console.log(`  chatId:           ${m.chatId || 'null'}`);
    console.log(`  senderId:         ${m.senderId}`);
    console.log(`  receiverId:       ${m.receiverId || 'null'}`);
    console.log(`  type:             ${m.type}`);
    console.log(`  isEncrypted:      ${m.isEncrypted}`);
    console.log(`  hasPlaintext:     ${Boolean(m.content && m.content.length > 0)}`);
    console.log(`  contentLength:    ${m.content ? m.content.length : 0}`);
    console.log(`  contentMasked:    ${m.content ? (m.content.slice(0, 3) + '***') : '(empty)'}`);
    console.log(`  hasEnvelope:      ${Boolean(m.envelope)}`);
    if (m.envelope) {
      console.log(`  envelope.format:  ${m.envelope.format || 'unknown'}`);
      console.log(`  envelope.hasDevices: ${Boolean(m.envelope.devices)}`);
    }
    console.log(`  status:           ${m.status}`);
    console.log(`  createdAt:        ${m.createdAt ? m.createdAt.toISOString() : 'null'}`);
    console.log(`  expiresAt:        ${m.expiresAt ? m.expiresAt.toISOString() : 'null'}`);
    const isExpired = m.expiresAt ? (new Date(m.expiresAt).getTime() < Date.now()) : false;
    console.log(`  isExpiredNow:     ${isExpired}`);
  });

  console.log('\n--- 4. DETAILED SANITIZED INSPECTION OF [queuedmessages] ---');
  const qmsgs = await db.collection('queuedmessages').find({}).toArray();
  console.log(`Total documents in 'queuedmessages': ${qmsgs.length}`);
  qmsgs.forEach((m, idx) => {
    console.log(`\nQueued Message #${idx + 1}:`);
    console.log(`  _id:          ${m._id}`);
    console.log(`  messageId:    ${m.messageId}`);
    console.log(`  isEncrypted:  ${m.isEncrypted}`);
    console.log(`  hasPlaintext: ${Boolean(m.content && m.content.length > 0)}`);
    console.log(`  expiresAt:    ${m.expiresAt ? m.expiresAt.toISOString() : 'null'}`);
  });

  console.log('\n--- 5. DETAILED SANITIZED INSPECTION OF [messageledgers] ---');
  const ledgers = await db.collection('messageledgers').find({}).limit(5).toArray();
  const totalLedgers = await db.collection('messageledgers').countDocuments();
  console.log(`Total documents in 'messageledgers': ${totalLedgers} (showing latest sample)`);
  ledgers.forEach((l, idx) => {
    console.log(`  Ledger #${idx + 1}: messageId: ${l.messageId} | status: ${l.status} | expiresAt: ${l.expiresAt ? l.expiresAt.toISOString() : 'null'}`);
  });

  console.log('\n================================================================');
  console.log('AUDIT COMPLETE - ZERO DATA MUTATED');
  console.log('================================================================');
  await mongoose.disconnect();
}

runForensics().catch(err => {
  console.error('Forensics error:', err);
  process.exit(1);
});
