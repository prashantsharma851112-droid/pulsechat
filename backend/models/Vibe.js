const mongoose = require('mongoose');

const VibeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  mediaUrl: { type: String, default: null },
  caption: { type: String, default: '' },
  soundtrack: { type: String, default: 'lofi' },
  bgGradient: { type: String, default: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' },
  textStyle3D: { type: String, default: 'none' },
  animatedBg: { type: String, default: 'none' },
  views: [{
    userId: String,
    displayName: String,
    avatar: String,
    viewedAt: { type: Date, default: Date.now }
  }],
  reactions: [{
    userId: String,
    emoji: String,
    timestamp: { type: Date, default: Date.now }
  }],
  sparksEarned: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // Auto 24h expiration in MongoDB!
});

module.exports = mongoose.model('Vibe', VibeSchema);
