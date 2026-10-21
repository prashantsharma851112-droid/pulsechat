const mongoose = require('mongoose');

const deviceIdentitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true },
    algorithms: { type: [String], default: [] },
    keys: { type: Object, required: true, default: {} },
    signatures: { type: Object, required: true, default: {} },
    oneTimeKeys: { type: Object, default: {} },
    fallbackKeys: { type: Object, default: {} },
    isRevoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { minimize: true, versionKey: false }
);

deviceIdentitySchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('DeviceIdentity', deviceIdentitySchema);
