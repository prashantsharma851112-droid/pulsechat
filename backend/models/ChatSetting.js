const mongoose = require('mongoose');

const chatSettingSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  disappearingEnabled: { type: Boolean, default: false },
  disappearingDuration: { type: Number, default: 86400 }, // in seconds (24h default)
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: '' }
});

module.exports = mongoose.model('ChatSetting', chatSettingSchema);
