const mongoose = require('mongoose');

const sparksTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true, index: true },
  amount: { type: Number, required: true },
  reason: {
    type: String,
    enum: [
      'story_tip_sent',
      'story_tip_received',
      'gift_sent',
      'gift_received',
      'sparks_purchase',
      'daily_claim',
      'ad_reward',
      'signup_bonus',
      'zone_reward',
      'ai_chat',
      'admin_adjustment',
      'vibe_tip_sent',
      'vibe_tip_received',
      'vibe_tip'
    ],
    default: 'story_tip_sent'
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
