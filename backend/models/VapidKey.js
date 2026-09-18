const mongoose = require('mongoose');

const vapidKeySchema = new mongoose.Schema({
  keyId: { type: String, default: 'default_vapid_key', unique: true },
  publicKey: { type: String, required: true },
  privateKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VapidKey', vapidKeySchema);
