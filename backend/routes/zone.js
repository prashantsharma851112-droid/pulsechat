const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const GameScore = require('../models/GameScore');

// Daily trivia poll state
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
    const currentUserId = req.userId || req.user?.id || req.user?.userId;
    const totalVotes = currentDailyTrivia.options.reduce((acc, opt) => acc + opt.votes.length, 0);
    const hasVoted = currentDailyTrivia.options.some(opt => opt.votes.includes(currentUserId));
    const votedOptionId = currentDailyTrivia.options.find(opt => opt.votes.includes(currentUserId))?.id || null;

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
    const userId = req.userId || req.user?.id || req.user?.userId;

    const hasVoted = currentDailyTrivia.options.some(opt => opt.votes.includes(userId));
    if (hasVoted) {
      return res.status(400).json({ error: 'Already voted today' });
    }

    const targetOpt = currentDailyTrivia.options.find(opt => opt.id === optionId);
    if (!targetOpt) {
      return res.status(404).json({ error: 'Option not found' });
    }

    targetOpt.votes.push(userId);

    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const updatedUser = await User.findOneAndUpdate(
      {
        $or: [
          { id: userId },
          ...(isObjectId ? [{ _id: userId }] : []),
          { username: userId }
        ]
      },
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

// Fetch Daily Task & 7-Day Streak Status
router.get('/daily-task', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const user = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let streakDays = user.gamingStreakCount || 0;
    const lastDate = user.lastGamingTaskDate || '';
    if (lastDate !== todayStr && lastDate !== yesterdayStr) {
      streakDays = 0;
    }

    const hasCrown = Boolean(
      user.hasKingCrown &&
      user.kingCrownExpiresAt &&
      new Date(user.kingCrownExpiresAt) > new Date()
    );

    res.json({
      taskCompletedToday: lastDate === todayStr,
      streakDays,
      hasKingCrown: hasCrown,
      kingCrownExpiresAt: user.kingCrownExpiresAt || null,
      pulseSparks: user.pulseSparks || 0
    });
  } catch (err) {
    console.error('Error fetching daily task:', err);
    res.status(500).json({ error: 'Failed to fetch daily task' });
  }
});

// Fetch Mini-Games Leaderboard permanently from MongoDB GameScore
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const scores = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(30)
      .lean();

    const userIds = scores.map(s => s.userId).filter(Boolean);
    const usersList = await User.find({ id: { $in: userIds } })
      .select('id hasKingCrown kingCrownExpiresAt avatar displayName username')
      .lean();

    const userMap = new Map();
    usersList.forEach(u => {
      userMap.set(u.id, u);
    });

    const leaderboardList = scores.map((s, idx) => {
      const uDoc = userMap.get(s.userId);
      const hasCrown = Boolean(
        uDoc &&
        uDoc.hasKingCrown &&
        uDoc.kingCrownExpiresAt &&
        new Date(uDoc.kingCrownExpiresAt) > new Date()
      );

      return {
        id: s.userId || `score_${idx}`,
        displayName: s.displayName,
        avatar: uDoc?.avatar || s.avatar || '',
        gameName: s.gameName,
        score: s.score || 0,
        level: s.level || 1,
        gamesPlayed: s.gamesPlayed || 1,
        hasKingCrown: hasCrown,
        isDailyChampion: idx === 0,
        timestamp: s.updatedAt
      };
    });

    res.json(leaderboardList);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Submit Mini-Game Score, Level & Earn Rewards / Streaks
router.post('/game-score', authMiddleware, async (req, res) => {
  try {
    const { gameName, score, level } = req.body;
    const userId = req.userId || req.user?.id || req.user?.userId;

    const rawScore = parseInt(score || '0', 10);
    const rawLevel = parseInt(level || '1', 10);

    if (isNaN(rawScore) || rawScore < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    let user = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const resolvedUserId = user.id || (user._id ? user._id.toString() : userId);

    // Save/Update Cumulative Score & Level per user in MongoDB GameScore collection
    const existingScoreDoc = await GameScore.findOne({ userId: resolvedUserId, gameName }).lean();

    let newTotalScore = rawScore;
    let newLevel = Math.max(1, rawLevel);
    let newGamesCount = 1;

    if (existingScoreDoc) {
      newTotalScore = Math.max(existingScoreDoc.score + rawScore, rawScore);
      newLevel = Math.max(existingScoreDoc.level || 1, rawLevel);
      newGamesCount = (existingScoreDoc.gamesPlayed || 1) + 1;

      await GameScore.findOneAndUpdate(
        { userId: resolvedUserId, gameName },
        {
          displayName: user.displayName || user.username,
          avatar: user.avatar || '',
          score: newTotalScore,
          level: newLevel,
          gamesPlayed: newGamesCount,
          updatedAt: new Date()
        }
      );
    } else {
      await GameScore.create({
        userId: resolvedUserId,
        displayName: user.displayName || user.username,
        avatar: user.avatar || '',
        gameName: gameName || 'Arrow Puzzle',
        score: newTotalScore,
        level: newLevel,
        gamesPlayed: 1,
        updatedAt: new Date()
      });
    }

    // Performance Sparks earned for playing
    let earnedSparks = Math.min(Math.floor(rawScore / 50), 50);

    // Daily Gaming Task & 7-Day Streak Evaluation
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let taskCompletedToday = user.lastGamingTaskDate === todayStr;
    let dailyTaskSparks = 0;
    let newStreak = user.gamingStreakCount || 0;
    let unlockedKingCrown = false;

    if (!taskCompletedToday) {
      taskCompletedToday = true;
      dailyTaskSparks = 30; // +30 Sparks for Daily Game Task!

      if (user.lastGamingTaskDate === yesterdayStr) {
        newStreak = (user.gamingStreakCount || 0) + 1;
      } else {
        newStreak = 1;
      }

      if (newStreak >= 7) {
        newStreak = 7;
        unlockedKingCrown = true;
        user.hasKingCrown = true;
        user.kingCrownExpiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 Hours King Crown on DP!
      }

      user.lastGamingTaskDate = todayStr;
      user.gamingStreakCount = newStreak;
    }

    // Check King Crown Expiry
    if (user.hasKingCrown && user.kingCrownExpiresAt && new Date(user.kingCrownExpiresAt) <= new Date()) {
      user.hasKingCrown = false;
    }

    // Daily #1 Champion Reward (+100 Sparks)
    let dailyRankOneSparks = 0;
    const currentLeaderboard = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(1)
      .lean();

    if (currentLeaderboard.length > 0 && currentLeaderboard[0].userId === resolvedUserId) {
      if (user.claimedDailyFirstReward !== todayStr) {
        dailyRankOneSparks = 100;
        user.claimedDailyFirstReward = todayStr;
      }
    }

    const totalSparksGained = earnedSparks + dailyTaskSparks + dailyRankOneSparks;
    user.pulseSparks = (user.pulseSparks || 0) + totalSparksGained;
    await user.save();

    // Fetch fresh top 30 scores from MongoDB for real-time broadcast
    const topScores = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(30)
      .lean();

    const allUserIds = topScores.map(s => s.userId).filter(Boolean);
    const usersList = await User.find({ id: { $in: allUserIds } })
      .select('id hasKingCrown kingCrownExpiresAt avatar')
      .lean();

    const userMap = new Map();
    usersList.forEach(u => userMap.set(u.id, u));

    const leaderboardList = topScores.map((s, idx) => {
      const uDoc = userMap.get(s.userId);
      const hasCrown = Boolean(
        uDoc &&
        uDoc.hasKingCrown &&
        uDoc.kingCrownExpiresAt &&
        new Date(uDoc.kingCrownExpiresAt) > new Date()
      );

      return {
        id: s.userId || `score_${idx}`,
        displayName: s.displayName,
        avatar: uDoc?.avatar || s.avatar || '',
        gameName: s.gameName,
        score: s.score || 0,
        level: s.level || 1,
        gamesPlayed: s.gamesPlayed || 1,
        hasKingCrown: hasCrown,
        isDailyChampion: idx === 0,
        timestamp: s.updatedAt
      };
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('leaderboard_updated', leaderboardList);
      io.to(`user_${resolvedUserId}`).emit('user_profile_updated', {
        userId: resolvedUserId,
        pulseSparks: user.pulseSparks,
        hasKingCrown: user.hasKingCrown,
        gamingStreakCount: user.gamingStreakCount
      });
    }

    res.json({
      success: true,
      rewardSparks: totalSparksGained,
      dailyTaskBonus: dailyTaskSparks,
      dailyRankOneBonus: dailyRankOneSparks,
      newSparksBalance: user.pulseSparks,
      streakDays: user.gamingStreakCount,
      unlockedKingCrown,
      hasKingCrown: Boolean(user.hasKingCrown && user.kingCrownExpiresAt && new Date(user.kingCrownExpiresAt) > new Date()),
      leaderboard: leaderboardList
    });
  } catch (err) {
    console.error('Error submitting game score:', err);
    res.status(500).json({ error: 'Failed to submit game score' });
  }
});

module.exports = router;
