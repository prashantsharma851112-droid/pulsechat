const mongoose = require('mongoose');

const chatSettingSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  disappearingEnabled: { type: Boolean, default: false },
  disappearingDuration: { type: Number, default: 86400 }, // in seconds (24h default)
  wallpaperId: { type: String, default: 'none' }, // 'ocean_waves_live', 'nature_forest_live', 'love_hearts_live', 'matrix_code_live', 'custom_image', 'none'
  customWallpaperUrl: { type: String, default: null }, // CDN/Cloudinary URL or hosted image
  chatTheme: { type: String, default: 'midnight_amoled' }, // 'midnight_amoled', 'cyber_pulse', etc.
  // Pulse Streaks (🔥 Daily Chat & Snap Streaks with Sparks Reward & Streak Freeze)
  streakCount: { type: Number, default: 0 },
  lastStreakDate: { type: String, default: '' }, // YYYY-MM-DD
  lastStreakSenderId: { type: String, default: '' },
  streakShields: { type: Map, of: Number, default: {} }, // { [userId]: number of freeze shields }
  streakFrozenUntil: { type: Date, default: null },
  streakMilestonesClaimed: { type: [Number], default: [] }, // [3, 7, 30]
  nicknames: { type: mongoose.Schema.Types.Mixed, default: {} }, // { [userId]: 'Custom Nickname' }
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: '' }
});

module.exports = mongoose.model('ChatSetting', chatSettingSchema);
