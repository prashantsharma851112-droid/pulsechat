const mongoose = require('mongoose');
require('dotenv').config();

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const Message = require('../models/Message');
  const QueuedMessage = require('../models/QueuedMessage');
  const MessageLedger = require('../models/MessageLedger');

  const msgCount = await Message.countDocuments();
  const queuedCount = await QueuedMessage.countDocuments();
  const ledgerCount = await MessageLedger.countDocuments();

  console.log('Message count:', msgCount);
  console.log('QueuedMessage count:', queuedCount);
  console.log('MessageLedger count:', ledgerCount);

  const statuses = await Message.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('Message statuses:', statuses);

  const recent = await Message.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('id chatId senderId receiverId isGroup status createdAt expiresAt isEncrypted')
    .lean();
  console.log('Recent messages metadata:', recent);

  const ledgerRecent = await MessageLedger.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  console.log('Recent ledgers:', ledgerRecent);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
