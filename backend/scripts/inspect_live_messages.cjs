const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectMessages() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const docs = await db.collection('messages').find({}).toArray();
  console.log('Total documents in messages collection:', docs.length);
  docs.forEach((doc, i) => {
    console.log(`\n=== DOCUMENT ${i + 1} ===`);
    const sanitized = {};
    for (const [k, v] of Object.entries(doc)) {
      if (k === 'content') {
        sanitized[k] = {
          exists: true,
          type: typeof v,
          length: typeof v === 'string' ? v.length : 'N/A',
          isPlaintextString: typeof v === 'string' && !v.startsWith('{"v":') && !v.startsWith('pulse_'),
          maskedPreview: typeof v === 'string' ? (v.length > 4 ? v.slice(0, 2) + '***' + v.slice(-2) : '***') : v
        };
      } else if (k === 'envelope') {
        sanitized[k] = {
          exists: true,
          format: v?.format,
          hasDevices: Boolean(v?.devices),
          keys: Object.keys(v || {})
        };
      } else {
        sanitized[k] = v;
      }
    }
    console.log(JSON.stringify(sanitized, null, 2));
  });

  console.log('\n=== INDEXES ON MESSAGES COLLECTION ===');
  const indexes = await db.collection('messages').indexes();
  console.log(JSON.stringify(indexes, null, 2));

  await mongoose.disconnect();
}

inspectMessages().catch(err => {
  console.error(err);
  process.exit(1);
});
