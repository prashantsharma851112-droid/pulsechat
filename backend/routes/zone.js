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

// Helper to evaluate and sync Leaderboard Rank 1 (Gold Crown) & Rank 2 (Silver/Bronze Crown)
async function syncLeaderboardRankCrowns(io) {
  let rank1UserId = null;
  let rank2UserId = null;
  try {
    const top2Docs = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(2)
      .lean();

    if (top2Docs[0] && top2Docs[0].userId) rank1UserId = top2Docs[0].userId;
    if (top2Docs[1] && top2Docs[1].userId) rank2UserId = top2Docs[1].userId;

    const rankUserIds = [rank1UserId, rank2UserId].filter(Boolean);

    // 1. Remove crowns from users no longer in Rank 1 or Rank 2
    await User.updateMany(
      { id: { $nin: rankUserIds }, $or: [{ hasKingCrown: true }, { hasSilverCrown: true }] },
      { $set: { hasKingCrown: false, hasSilverCrown: false } }
    );

    // 2. Assign Rank 1 Gold Crown
    if (rank1UserId) {
      const u1 = await User.findOneAndUpdate(
        { id: rank1UserId },
        { $set: { hasKingCrown: true, hasSilverCrown: false, kingCrownExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000) } },
        { new: true }
      ).lean();
      if (io && u1) {
        io.emit('user_profile_updated', { userId: rank1UserId, updates: { hasKingCrown: true, hasSilverCrown: false } });
      }
    }

    // 3. Assign Rank 2 Silver/Bronze Crown
    if (rank2UserId) {
      const u2 = await User.findOneAndUpdate(
        { id: rank2UserId },
        { $set: { hasKingCrown: false, hasSilverCrown: true } },
        { new: true }
      ).lean();
      if (io && u2) {
        io.emit('user_profile_updated', { userId: rank2UserId, updates: { hasKingCrown: false, hasSilverCrown: true } });
      }
    }
  } catch (err) {
    console.error('Error syncing leaderboard crowns:', err);
  }
  return { rank1UserId, rank2UserId };
}

// Fetch Mini-Games Leaderboard permanently from MongoDB GameScore
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { rank1UserId, rank2UserId } = await syncLeaderboardRankCrowns(io);

    const scores = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(30)
      .lean();

    const userIds = scores.map(s => s.userId).filter(Boolean);
    const usersList = await User.find({ id: { $in: userIds } })
      .select('id hasKingCrown hasSilverCrown hasStreakCrown avatar displayName username')
      .lean();

    const userMap = new Map();
    usersList.forEach(u => {
      userMap.set(u.id, u);
    });

    const leaderboardList = scores.map((s, idx) => {
      const uDoc = userMap.get(s.userId);
      const isRank1 = idx === 0 || s.userId === rank1UserId;
      const isRank2 = idx === 1 || s.userId === rank2UserId;
      const hasCrown = isRank1 || Boolean(uDoc && uDoc.hasKingCrown);
      const hasSilverCrown = isRank2 || Boolean(uDoc && uDoc.hasSilverCrown);
      const hasStreakCrown = Boolean(uDoc && uDoc.hasStreakCrown);

      return {
        id: s.userId || `score_${idx}`,
        displayName: s.displayName,
        avatar: uDoc?.avatar || s.avatar || '',
        gameName: s.gameName,
        score: s.score || 0,
        level: s.level || 1,
        gamesPlayed: s.gamesPlayed || 1,
        hasKingCrown: hasCrown,
        hasSilverCrown,
        hasStreakCrown,
        isDailyChampion: isRank1,
        timestamp: s.updatedAt
      };
    });

    res.json(leaderboardList);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Fetch Current User's Saved Game Score & Max Level
router.get('/my-score', authMiddleware, async (req, res) => {
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

    const resolvedUserId = user ? (user.id || (user._id ? user._id.toString() : userId)) : userId;
    const scoreDoc = await GameScore.findOne({ userId: resolvedUserId }).lean();

    res.json({
      success: true,
      level: scoreDoc?.level || 1,
      score: scoreDoc?.score || 0,
      gamesPlayed: scoreDoc?.gamesPlayed || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch personal game score' });
  }
});

// Set / Restore User's Level in Database
router.post('/set-level', authMiddleware, async (req, res) => {
  try {
    const { level } = req.body;
    const targetLevel = Math.max(1, parseInt(level || '1', 10));
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
    const resolvedUserId = user.id || (user._id ? user._id.toString() : userId);

    const doc = await GameScore.findOneAndUpdate(
      { userId: resolvedUserId },
      {
        $set: {
          displayName: user.displayName || user.username || 'Player',
          gameName: 'Arrow Puzzle',
          level: targetLevel,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, level: doc.level });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update level' });
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
    const existingScoreDoc = await GameScore.findOne({ userId: resolvedUserId }).lean();

    let newTotalScore = rawScore;
    let newLevel = Math.max(1, rawLevel);
    let newGamesCount = 1;

    if (existingScoreDoc) {
      newTotalScore = Math.max(existingScoreDoc.score + rawScore, rawScore);
      newLevel = Math.max(existingScoreDoc.level || 1, rawLevel);
      newGamesCount = (existingScoreDoc.gamesPlayed || 1) + 1;

      await GameScore.findOneAndUpdate(
        { userId: resolvedUserId },
        {
          displayName: user.displayName || user.username,
          avatar: user.avatar || '',
          gameName: gameName || existingScoreDoc.gameName || 'Arrow Puzzle',
          score: newTotalScore,
          level: newLevel,
          gamesPlayed: newGamesCount,
          updatedAt: new Date()
        }
      );

      await GameScore.deleteMany({ userId: resolvedUserId, _id: { $ne: existingScoreDoc._id } });
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

    const io = req.app.get('io');

    // Dynamically evaluate and transfer Rank 1 Gold Crown & Rank 2 Silver/Bronze Crown
    const { rank1UserId, rank2UserId } = await syncLeaderboardRankCrowns(io);
    const isNowRank1 = rank1UserId === resolvedUserId;
    const isNowRank2 = rank2UserId === resolvedUserId;

    // Performance Sparks earned for playing
    let earnedSparks = Math.min(Math.floor(rawScore / 50), 50);

    // Daily Gaming Task & 7-Day Streak Evaluation
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let taskCompletedToday = user.lastGamingTaskDate === todayStr;
    let dailyTaskSparks = 0;
    let newStreak = user.gamingStreakCount || 0;
    let unlocked7DayStreakReward = false;

    if (!taskCompletedToday) {
      taskCompletedToday = true;
      dailyTaskSparks = 30; // +30 Sparks for Daily Game Task!

      if (user.lastGamingTaskDate === yesterdayStr) {
        newStreak = (user.gamingStreakCount || 0) + 1;
      } else {
        newStreak = 1;
      }

      // Check 7-Day Streak Completion: Reward 1-Day Free VIP Pro Subscription + 1-Day Streak Crown!
      if (newStreak >= 7) {
        newStreak = 7;
        unlocked7DayStreakReward = true;
        user.isPro = true;
        user.proExpiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 1-Day Free VIP Pro Subscription
        user.proTier = 'streak_1day';
        user.hasStreakCrown = true;
        user.streakCrownExpiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 1-Day Streak Crown on DP
      }

      user.lastGamingTaskDate = todayStr;
      user.gamingStreakCount = newStreak;
    }

    // Check Expiry for 1-Day Streak Crown
    if (user.hasStreakCrown && user.streakCrownExpiresAt && new Date(user.streakCrownExpiresAt) <= new Date()) {
      user.hasStreakCrown = false;
    }
    // Check Expiry for Pro trial
    if (user.isPro && user.proExpiresAt && new Date(user.proExpiresAt) <= new Date()) {
      user.isPro = false;
      user.proTier = 'none';
    }

    if (isNowRank1) {
      user.hasKingCrown = true;
      user.hasSilverCrown = false;
    } else if (isNowRank2) {
      user.hasKingCrown = false;
      user.hasSilverCrown = true;
    } else {
      user.hasKingCrown = false;
      user.hasSilverCrown = false;
    }

    // Daily #1 Champion Reward (+100 Sparks)
    let dailyRankOneSparks = 0;
    if (isNowRank1 && user.claimedDailyFirstReward !== todayStr) {
      dailyRankOneSparks = 100;
      user.claimedDailyFirstReward = todayStr;
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
      .select('id hasKingCrown hasSilverCrown hasStreakCrown avatar')
      .lean();

    const userMap = new Map();
    usersList.forEach(u => userMap.set(u.id, u));

    const leaderboardList = topScores.map((s, idx) => {
      const uDoc = userMap.get(s.userId);
      const isRank1 = idx === 0 || s.userId === rank1UserId;
      const isRank2 = idx === 1 || s.userId === rank2UserId;
      const hasCrown = isRank1 || Boolean(uDoc && uDoc.hasKingCrown);
      const hasSilverCrown = isRank2 || Boolean(uDoc && uDoc.hasSilverCrown);
      const hasStreakCrown = Boolean(uDoc && uDoc.hasStreakCrown);

      return {
        id: s.userId || `score_${idx}`,
        displayName: s.displayName,
        avatar: uDoc?.avatar || s.avatar || '',
        gameName: s.gameName,
        score: s.score || 0,
        level: s.level || 1,
        gamesPlayed: s.gamesPlayed || 1,
        hasKingCrown: hasCrown,
        hasSilverCrown,
        hasStreakCrown,
        isDailyChampion: isRank1,
        timestamp: s.updatedAt
      };
    });

    if (io) {
      io.emit('leaderboard_updated', leaderboardList);
      io.to(`user_${resolvedUserId}`).emit('user_profile_updated', {
        userId: resolvedUserId,
        pulseSparks: user.pulseSparks,
        isPro: user.isPro,
        proTier: user.proTier,
        hasKingCrown: isNowRank1,
        hasSilverCrown: isNowRank2,
        hasStreakCrown: user.hasStreakCrown,
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
      unlocked7DayStreakReward,
      isPro: user.isPro,
      hasKingCrown: isNowRank1,
      hasSilverCrown: isNowRank2,
      hasStreakCrown: user.hasStreakCrown,
      leaderboard: leaderboardList
    });
  } catch (err) {
    console.error('Error submitting game score:', err);
    res.status(500).json({ error: 'Failed to submit game score' });
  }
});

module.exports = router;
