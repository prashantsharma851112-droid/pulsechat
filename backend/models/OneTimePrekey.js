const mongoose = require('mongoose');

const oneTimePrekeySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  keyId: { type: String, required: true },
  keyData: { type: Object, required: true }, // e.g. { key: "<curve25519-key>", signatures: { ... } }
  isConsumed: { type: Boolean, default: false, index: true },
  consumedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

oneTimePrekeySchema.index({ userId: 1, deviceId: 1, isConsumed: 1 });
oneTimePrekeySchema.index({ userId: 1, deviceId: 1, keyId: 1 }, { unique: true });

module.exports = mongoose.model('OneTimePrekey', oneTimePrekeySchema);
