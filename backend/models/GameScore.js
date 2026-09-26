const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  avatar: { type: String, default: '' },
  gameName: { type: String, required: true },
  score: { type: Number, required: true, index: true },
  updatedAt: { type: Date, default: Date.now }
});

gameScoreSchema.index({ score: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
