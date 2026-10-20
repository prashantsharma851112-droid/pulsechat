const mongoose = require('mongoose');

const queuedMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 10000 },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    receiptToken: { type: String, required: true }
  },
  { versionKey: false, minimize: true }
);

queuedMessageSchema.index({ receiverId: 1, createdAt: 1 });

module.exports = mongoose.model('QueuedMessage', queuedMessageSchema);
