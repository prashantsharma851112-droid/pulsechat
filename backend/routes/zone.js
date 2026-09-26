const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

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

let zoneLeaderboard = []; // Array of { userId, displayName, avatar, gameName, score, timestamp }

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

// Vote on Daily Trivia & Earn +20 Bonus Sparks
router.post('/daily-trivia/vote', authMiddleware, async (req, res) => {
  try {
    const { optionId } = req.body;
    const userId = req.userId;

    const hasVoted = currentDailyTrivia.options.some(opt => opt.votes.includes(userId));
    if (hasVoted) {
      return res.status(400).json({ error: 'You have already participated in today’s poll!' });
    }

    const targetOpt = currentDailyTrivia.options.find(opt => opt.id === optionId);
    if (!targetOpt) {
      return res.status(404).json({ error: 'Invalid option selected' });
    }

    targetOpt.votes.push(userId);

    // Credit +20 Bonus Sparks to user for participating!
    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { $inc: { pulseSparks: 20 } },
      { new: true }
    ).select('id displayName avatar pulseSparks').lean();

    const totalVotes = currentDailyTrivia.options.reduce((acc, opt) => acc + opt.votes.length, 0);
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
      success: true,
      rewardSparks: 20,
      newSparksBalance: updatedUser?.pulseSparks || 0,
      totalVotes,
      hasVoted: true,
      votedOptionId: optionId,
      options: formattedOptions
    });
  } catch (err) {
    console.error('Error voting on trivia:', err);
    res.status(500).json({ error: 'Failed to record trivia vote' });
  }
});

// Fetch Mini-Games Leaderboard
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const sorted = [...zoneLeaderboard].sort((a, b) => b.score - a.score).slice(0, 15);
    res.json(sorted);
  } catch (err) {
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

    // Calculate reward sparks based on score (e.g. 1 spark per 50 pts, max 50 per game)
    const rewardSparks = Math.min(Math.floor(score / 50), 50);

    let updatedUser = null;
    if (rewardSparks > 0) {
      updatedUser = await User.findOneAndUpdate(
        { id: userId },
        { $inc: { pulseSparks: rewardSparks } },
        { new: true }
      ).select('id pulseSparks').lean();
    }

    // Add to leaderboard
    const newScoreEntry = {
      id: 'score_' + Date.now(),
      userId: user.id,
      displayName: user.displayName || user.username,
      avatar: user.avatar || '',
      gameName: gameName || 'Pulse Speed Tapper',
      score,
      timestamp: new Date().toISOString()
    };

    zoneLeaderboard.push(newScoreEntry);
    if (zoneLeaderboard.length > 50) {
      zoneLeaderboard = zoneLeaderboard.sort((a, b) => b.score - a.score).slice(0, 50);
    }

    res.json({
      success: true,
      rewardSparks,
      newSparksBalance: updatedUser?.pulseSparks || user.pulseSparks,
      leaderboard: zoneLeaderboard.sort((a, b) => b.score - a.score).slice(0, 15)
    });
  } catch (err) {
    console.error('Error submitting game score:', err);
    res.status(500).json({ error: 'Failed to submit game score' });
  }
});

module.exports = router;
