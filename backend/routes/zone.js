const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const GameScore = require('../models/GameScore');

// In-Memory & Persistent daily trivia state
let currentDailyTrivia = {
  id: 'trivia_today',
  question: '🔥 Daily Pulse Poll: What gives you the best vibe during chat sessions?',
  options: [
    { id: 'opt_1', text: '🎵 Lofi Soundscapes & 4K Live Wallpapers', votes: [] },
    { id: 'opt_2', text: '⚡ 3D Floating Emoji Bursts & Dust Notes', votes: [] },
    { id: 'opt_3', text: '🎮 Playing Pulse Zone Mini-Games', votes: [] },
    { id: 'opt_4', text: '👑 Unlocking VIP Pro Themes & Auras', votes: [] }
  ]
};

// Get Daily Trivia Poll
router.get('/daily-trivia', authMiddleware, async (req, res) => {
  try {
    const totalVotes = currentDailyTrivia.options.reduce((acc, opt) => acc + opt.votes.length, 0);
    const hasVoted = currentDailyTrivia.options.some(opt => opt.votes.includes(req.userId));
    const votedOptionId = currentDailyTrivia.options.find(opt => opt.votes.includes(req.userId))?.id || null;

    const formattedOptions = currentDailyTrivia.options.map(opt => {
      const votesCount = opt.votes.length;
      const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        text: opt.text,
        votesCount,
        percentage
      };
    });

    res.json({
      id: currentDailyTrivia.id,
      question: currentDailyTrivia.question,
      totalVotes,
      hasVoted,
      votedOptionId,
      options: formattedOptions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily trivia' });
  }
});

// Vote on Daily Trivia
router.post('/daily-trivia/vote', authMiddleware, async (req, res) => {
  try {
    const { optionId } = req.body;
    const userId = req.userId;

    const hasVoted = currentDailyTrivia.options.some(opt => opt.votes.includes(userId));
    if (hasVoted) {
      return res.status(400).json({ error: 'Already voted today' });
    }

    const targetOpt = currentDailyTrivia.options.find(opt => opt.id === optionId);
    if (!targetOpt) {
      return res.status(404).json({ error: 'Option not found' });
    }

    targetOpt.votes.push(userId);

    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { $inc: { pulseSparks: 20 } },
      { new: true }
    ).select('id pulseSparks').lean();

    res.json({
      success: true,
      rewardSparks: 20,
      newSparksBalance: updatedUser?.pulseSparks || 120
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Fetch Mini-Games Leaderboard permanently from MongoDB GameScore
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const scores = await GameScore.find({})
      .sort({ score: -1 })
      .limit(20)
      .lean();

    const leaderboardList = scores.map((s, idx) => ({
      id: s.userId || `score_${idx}`,
      displayName: s.displayName,
      avatar: s.avatar,
      gameName: s.gameName,
      score: s.score,
      timestamp: s.updatedAt
    }));

    res.json(leaderboardList);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Submit Mini-Game Score & Earn Reward Sparks
router.post('/game-score', authMiddleware, async (req, res) => {
  try {
    const { gameName, score } = req.body;
    const userId = req.userId;

    if (!score || score <= 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const user = await User.findOne({ id: userId }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rewardSparks = Math.min(Math.floor(score / 50), 50);

    let updatedUser = null;
    if (rewardSparks > 0) {
      updatedUser = await User.findOneAndUpdate(
        { id: userId },
        { $inc: { pulseSparks: rewardSparks } },
        { new: true }
      ).select('id pulseSparks').lean();
    }

    // Save/Update highest score per user in MongoDB GameScore collection
    const existingScoreDoc = await GameScore.findOne({ userId, gameName }).lean();
    if (!existingScoreDoc || score > existingScoreDoc.score) {
      await GameScore.findOneAndUpdate(
        { userId, gameName },
        {
          userId,
          displayName: user.displayName || user.username,
          avatar: user.avatar || '',
          gameName: gameName || 'Arrow Puzzle',
          score,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // Fetch fresh top 20 scores from MongoDB
    const topScores = await GameScore.find({})
      .sort({ score: -1 })
      .limit(20)
      .lean();

    const leaderboardList = topScores.map((s, idx) => ({
      id: s.userId || `score_${idx}`,
      displayName: s.displayName,
      avatar: s.avatar,
      gameName: s.gameName,
      score: s.score,
      timestamp: s.updatedAt
    }));

    res.json({
      success: true,
      rewardSparks,
      newSparksBalance: updatedUser?.pulseSparks || user.pulseSparks,
      leaderboard: leaderboardList
    });
  } catch (err) {
    console.error('Error submitting game score:', err);
    res.status(500).json({ error: 'Failed to submit game score' });
  }
});

module.exports = router;
