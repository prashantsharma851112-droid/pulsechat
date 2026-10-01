const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userMongoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  planId: { type: String, required: true },
  planName: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: { type: String, default: 'UPI' },
  utr: { type: String, required: true, unique: true, index: true },
  senderUpi: { type: String },
  status: { type: String, enum: ['completed', 'pending', 'rejected'], default: 'completed' },
  appliedAt: { type: Date, default: Date.now },
  notes: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
