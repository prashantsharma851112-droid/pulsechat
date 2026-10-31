const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const usersWithPush = await mongoose.connection.db.collection('users').find({
    pushSubscriptions: { $exists: true, $ne: [] }
  }).toArray();
  console.log('Users with pushSubscriptions count:', usersWithPush.length);
  for (const u of usersWithPush) {
    console.log({
      id: u.id,
      username: u.username,
      subsCount: u.pushSubscriptions ? u.pushSubscriptions.length : 0
    });
  }
  await mongoose.disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
