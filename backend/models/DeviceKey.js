const mongoose = require('mongoose');

const deviceKeySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true },
  publicKey: { type: Object, default: {} }, // Backwards compatibility for JWK / existing tests
  keys: { type: Map, of: String, default: {} }, // e.g. { 'ed25519:<deviceId>': '...', 'curve25519:<deviceId>': '...' }
  signatures: { type: Object, default: {} }, // { '<userId>': { 'ed25519:<deviceId>': '...' } }
  algorithms: { type: [String], default: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'] },
  fallbackKey: { type: Object, default: null }, // Fallback prekey if OTK pool is exhausted
  deviceLabel: { type: String, default: 'PulseChat Client' },
  revoked: { type: Boolean, default: false, index: true },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
});

deviceKeySchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('DeviceKey', deviceKeySchema);
