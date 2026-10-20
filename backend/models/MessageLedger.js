const mongoose = require('mongoose');

// Metadata only: no message text is stored here. This short-lived record makes
// chat:send retries idempotent even if the original socket ACK was lost.
const messageLedgerSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    state: {
      type: String,
      enum: ['queued', 'delivering', 'delivered', 'expired'],
      required: true,
      default: 'queued'
    },
    createdAt: { type: Date, required: true },
    queueExpiresAt: { type: Date, required: true },
    // Metadata-only idempotency record lives longer than the message queue body.
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { versionKey: false, minimize: true }
);

module.exports = mongoose.model('MessageLedger', messageLedgerSchema);
