const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  avatar: { type: String, default: '' },
  gameName: { type: String, required: true },
  score: { type: Number, required: true, default: 0 },
  level: { type: Number, default: 1 },
  gamesPlayed: { type: Number, default: 1 },
  updatedAt: { type: Date, default: Date.now }
});

gameScoreSchema.index({ score: -1, level: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
