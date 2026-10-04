const mongoose = require('mongoose');

const chatSettingSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  disappearingEnabled: { type: Boolean, default: false },
  disappearingDuration: { type: Number, default: 86400 }, // in seconds (24h default)
  wallpaperId: { type: String, default: 'none' }, // 'ocean_waves_live', 'nature_forest_live', 'love_hearts_live', 'matrix_code_live', 'custom_image', 'none'
  customWallpaperUrl: { type: String, default: null }, // CDN/Cloudinary URL or hosted image
  chatTheme: { type: String, default: 'midnight_amoled' }, // 'midnight_amoled', 'cyber_pulse', etc.
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: '' }
});

module.exports = mongoose.model('ChatSetting', chatSettingSchema);
