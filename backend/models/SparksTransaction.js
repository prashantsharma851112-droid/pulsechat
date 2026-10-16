const mongoose = require('mongoose');

const sparksTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true, index: true },
  amount: { type: Number, required: true },
  reason: {
    type: String,
    default: 'feature_unlock'
  },
  title: { type: String, required: true },
  description: { type: String },
  relatedUserId: { type: String },
  relatedUserName: { type: String },
  balanceAfter: { type: Number, required: true },
  metadata: { type: Object, default: {} }
}, {
  timestamps: true
});

sparksTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SparksTransaction', sparksTransactionSchema);
