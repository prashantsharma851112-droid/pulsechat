const mongoose = require('mongoose');

const queuedMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 50000 },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    receiptToken: { type: String, required: true },
    isEncrypted: { type: Boolean, default: false },
    envelope: { type: Object, default: null },
    chatId: { type: String, default: null },
    senderDeviceId: { type: String, default: null },
    recipientDeviceId: { type: String, default: null }
  },
  { versionKey: false, minimize: true }
);

queuedMessageSchema.index({ receiverId: 1, createdAt: 1 });

module.exports = mongoose.model('QueuedMessage', queuedMessageSchema);
