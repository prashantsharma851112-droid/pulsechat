const mongoose = require('mongoose');

const toDeviceTxnSchema = new mongoose.Schema(
  {
    senderUserId: { type: String, required: true, index: true },
    senderDeviceId: { type: String, required: true, index: true },
    txnId: { type: String, required: true },
    eventType: { type: String, required: true },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: { expires: 24 * 60 * 60 }
    }
  },
  { minimize: true, versionKey: false }
);

toDeviceTxnSchema.index({ senderUserId: 1, senderDeviceId: 1, txnId: 1 }, { unique: true });

module.exports = mongoose.model('ToDeviceTxn', toDeviceTxnSchema);
