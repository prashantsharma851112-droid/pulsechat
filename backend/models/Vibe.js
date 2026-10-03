const mongoose = require('mongoose');

const VibeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  mediaUrl: { type: String, default: null },
  mediaType: { type: String, default: 'image' }, // 'image' | 'video'
  caption: { type: String, default: '' },
  soundtrack: { type: String, default: 'lofi' },
  songTitle: { type: String, default: '' },
  artistName: { type: String, default: '' },
  albumArt: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  youtubeId: { type: String, default: '' },
  songStartTime: { type: Number, default: 0 },
  storyDuration: { type: Number, default: 15 }, // 15s | 30s | 60s
  bgGradient: { type: String, default: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)' },
  textStyle3D: { type: String, default: 'none' },
  animatedBg: { type: String, default: 'none' },
  textPos: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 }
  },
  musicPos: {
    x: { type: Number, default: 20 },
    y: { type: Number, default: 15 }
  },
  musicScale: { type: Number, default: 1.0 },
  musicStyle: { type: String, default: 'pill' },
  imagePos: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 }
  },
  imageFit: { type: String, default: 'contain' },
  imageZoom: { type: Number, default: 1.0 },
  imageFilter: { type: String, default: 'none' },
  imageOpacity: { type: Number, default: 0.92 },
  textSize: { type: Number, default: 1.2 },
  textAlign: { type: String, default: 'center' },
  selectedStickers: [{ type: String }],
  stickersData: [{
    id: { type: String },
    emoji: { type: String },
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    scale: { type: Number, default: 1.0 }
  }],
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
