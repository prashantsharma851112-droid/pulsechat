const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  avatar: { type: String, default: '' },
  gameName: { type: String, required: true, default: 'Arrow Puzzle' },
  score: { type: Number, required: true, default: 0 },
  level: { type: Number, default: 1 },
  maxUnlockedLevel: { type: Number, default: 1 },
  gamesPlayed: { type: Number, default: 1 },
  // Game-specific breakdown and best records
  gameStats: {
    arrow: {
      bestScore: { type: Number, default: 0 },
      maxLevel: { type: Number, default: 1 },
      gamesPlayed: { type: Number, default: 0 }
    },
    temple: {
      bestScore: { type: Number, default: 0 },
      bestDistance: { type: Number, default: 0 },
      totalCoins: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 }
    },
    candy: {
      bestScore: { type: Number, default: 0 },
      maxLevel: { type: Number, default: 1 },
      gamesPlayed: { type: Number, default: 0 }
    },
    tapper: {
      bestScore: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 }
    },
    tictactoe: {
      wins: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 }
    }
  },
  // Anti-replay / processed submission IDs (capped for efficiency)
  processedSubmissionIds: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

gameScoreSchema.index({ score: -1, level: -1 });
gameScoreSchema.index({ 'gameStats.temple.bestScore': -1 });
gameScoreSchema.index({ 'gameStats.candy.bestScore': -1 });
gameScoreSchema.index({ 'gameStats.arrow.bestScore': -1 });
gameScoreSchema.index({ 'gameStats.tapper.bestScore': -1 });
gameScoreSchema.index({ 'gameStats.tictactoe.wins': -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
