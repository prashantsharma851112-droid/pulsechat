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

// Concurrency & Idempotency Safeguards
const activeScoreLocks = new Set();
const MAX_SUBMISSION_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14-day durable idempotency window

function parseSubmissionTimestamp(subId) {
  if (!subId || typeof subId !== 'string') return null;
  const match = subId.match(/^sub_(\d{10,14})_/);
  if (!match) return null;
  const ts = parseInt(match[1], 10);
  return isNaN(ts) ? null : ts;
}

// Helper: Normalize Game Identifier
function normalizeGameKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('temple')) return 'temple';
  if (n.includes('candy')) return 'candy';
  if (n.includes('arrow')) return 'arrow';
  if (n.includes('tapper') || n.includes('speed')) return 'tapper';
  if (n.includes('tic') || n.includes('toe')) return 'tictactoe';
  if (n.includes('draw') || n.includes('whiteboard') || n.includes('creative') || n.includes('artist')) return 'draw';
  return 'arrow';
}

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
    const updatedUser = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('id pulseSparks').lean();

    res.json({
      success: true,
      rewardSparks: 0,
      newSparksBalance: updatedUser?.pulseSparks || 0
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

// Helper: Evaluate and sync Leaderboard Rank 1 (Gold Crown) & Rank 2 (Silver Crown)
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

// Helper: Query and Format Leaderboard by Category
async function getLeaderboardList(gameCategory = 'all', rank1UserId, rank2UserId) {
  let query = {};
  let sort = { score: -1, level: -1, gamesPlayed: -1, updatedAt: 1 };

  if (gameCategory === 'temple') {
    query = { 'gameStats.temple.bestScore': { $gt: 0 } };
    sort = { 'gameStats.temple.bestScore': -1, score: -1, updatedAt: 1 };
  } else if (gameCategory === 'arrow') {
    query = { $or: [{ 'gameStats.arrow.bestScore': { $gt: 0 } }, { level: { $gt: 1 } }] };
    sort = { 'gameStats.arrow.maxLevel': -1, 'gameStats.arrow.bestScore': -1, level: -1, updatedAt: 1 };
  } else if (gameCategory === 'candy') {
    query = { 'gameStats.candy.bestScore': { $gt: 0 } };
    sort = { 'gameStats.candy.bestScore': -1, 'gameStats.candy.maxLevel': -1, updatedAt: 1 };
  } else if (gameCategory === 'tapper') {
    query = { 'gameStats.tapper.bestScore': { $gt: 0 } };
    sort = { 'gameStats.tapper.bestScore': -1, updatedAt: 1 };
  } else if (gameCategory === 'tictactoe') {
    query = { 'gameStats.tictactoe.wins': { $gt: 0 } };
    sort = { 'gameStats.tictactoe.wins': -1, 'gameStats.tictactoe.draws': -1, updatedAt: 1 };
  }

  let scores = await GameScore.find(query)
    .sort(sort)
    .limit(30)
    .lean();

  // If specific category has no entries yet, fallback to general top scores
  if (scores.length === 0 && gameCategory !== 'all') {
    scores = await GameScore.find({})
      .sort({ score: -1, level: -1, gamesPlayed: -1 })
      .limit(30)
      .lean();
  }

  const userIds = scores.map(s => s.userId).filter(Boolean);
  const usersList = await User.find({ id: { $in: userIds } })
    .select('id hasKingCrown hasSilverCrown hasStreakCrown avatar displayName username')
    .lean();

  const userMap = new Map();
  usersList.forEach(u => userMap.set(u.id, u));

  return scores.map((s, idx) => {
    const uDoc = userMap.get(s.userId);
    const isRank1 = idx === 0 || s.userId === rank1UserId;
    const isRank2 = idx === 1 || s.userId === rank2UserId;
    const hasCrown = isRank1 || Boolean(uDoc && uDoc.hasKingCrown);
    const hasSilverCrown = isRank2 || Boolean(uDoc && uDoc.hasSilverCrown);
    const hasStreakCrown = Boolean(uDoc && uDoc.hasStreakCrown);

    let displayScore = s.score || 0;
    let displayDetail = `Level ${s.level || 1}`;

    if (gameCategory === 'temple' && s.gameStats?.temple?.bestScore) {
      displayScore = s.gameStats.temple.bestScore;
      displayDetail = `${s.gameStats.temple.bestDistance || 0}m run`;
    } else if (gameCategory === 'candy' && s.gameStats?.candy?.bestScore) {
      displayScore = s.gameStats.candy.bestScore;
      displayDetail = `Level ${s.gameStats.candy.maxLevel || 1}`;
    } else if (gameCategory === 'arrow' && s.gameStats?.arrow?.maxLevel) {
      displayScore = s.gameStats.arrow.bestScore || s.score || 0;
      displayDetail = `Level ${s.gameStats.arrow.maxLevel}`;
    } else if (gameCategory === 'tapper' && s.gameStats?.tapper?.bestScore) {
      displayScore = s.gameStats.tapper.bestScore;
      displayDetail = `${displayScore} taps/15s`;
    } else if (gameCategory === 'tictactoe' && s.gameStats?.tictactoe) {
      displayScore = (s.gameStats.tictactoe.wins || 0) * 50;
      displayDetail = `${s.gameStats.tictactoe.wins || 0} Wins`;
    }

    return {
      id: s.userId || `score_${idx}`,
      userId: s.userId,
      displayName: s.displayName,
      username: uDoc?.username || '',
      avatar: uDoc?.avatar || s.avatar || '',
      gameName: s.gameName,
      score: displayScore,
      totalScore: s.score || 0,
      level: s.level || 1,
      detail: displayDetail,
      gamesPlayed: s.gamesPlayed || 1,
      gameStats: s.gameStats || {},
      hasKingCrown: hasCrown,
      hasSilverCrown,
      hasStreakCrown,
      isDailyChampion: isRank1,
      timestamp: s.updatedAt
    };
  });
}

// Fetch Mini-Games Leaderboard (Supports ?game=all|temple|arrow|candy|tapper|tictactoe)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { rank1UserId, rank2UserId } = await syncLeaderboardRankCrowns(io);
    const category = req.query.game || 'all';

    const leaderboardList = await getLeaderboardList(category, rank1UserId, rank2UserId);
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
      maxUnlockedLevel: scoreDoc?.maxUnlockedLevel || scoreDoc?.level || 1,
      score: scoreDoc?.score || 0,
      gamesPlayed: scoreDoc?.gamesPlayed || 0,
      gameStats: scoreDoc?.gameStats || {}
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch personal game score' });
  }
});

// Set / Restore User's Level in Database (Strictly verified and capped to max verified unlocked level)
router.post('/set-level', authMiddleware, async (req, res) => {
  try {
    const { level } = req.body;
    const requestedLevel = Math.max(1, parseInt(level || '1', 10));
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

    const existingScoreDoc = await GameScore.findOne({ userId: resolvedUserId }).lean();
    const maxUnlocked = existingScoreDoc ? Math.max(1, existingScoreDoc.maxUnlockedLevel || existingScoreDoc.level || 1) : 1;

    // Anti-cheat verification: User CANNOT jump beyond their verified unlocked level
    if (requestedLevel > maxUnlocked) {
      return res.status(403).json({
        error: `Aap sirf apne verified unlocked level (${maxUnlocked}) tak hi select/restore kar sakte hain! Aage ke level khel kar unlock karein.`,
        maxUnlocked
      });
    }

    const doc = await GameScore.findOneAndUpdate(
      { userId: resolvedUserId },
      {
        $set: {
          displayName: user.displayName || user.username || 'Player',
          gameName: 'Arrow Puzzle',
          level: requestedLevel,
          maxUnlockedLevel: maxUnlocked,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    const io = req.app.get('io');
    if (io) {
      await syncLeaderboardRankCrowns(io);
    }

    res.json({ success: true, level: doc.level, maxUnlockedLevel: doc.maxUnlockedLevel || maxUnlocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update level' });
  }
});

// Helper: Apply Single Score Update with Idempotency & Game-Specific Stats
async function applyScoreUpdate({ user, resolvedUserId, gameName, score, level, stats, submissionId }) {
  const rawScore = Math.max(0, parseInt(score || '0', 10));
  const rawLevel = Math.max(1, parseInt(level || '1', 10));
  const gameKey = normalizeGameKey(gameName);
  const isArrowGame = gameKey === 'arrow';

  let existingScoreDoc = await GameScore.findOne({ userId: resolvedUserId });

  // Idempotency: Prevent replaying or duplicate awarding of the exact same score session
  if (submissionId && existingScoreDoc?.processedSubmissionIds?.includes(submissionId)) {
    return {
      duplicate: true,
      currentScore: existingScoreDoc.score,
      level: existingScoreDoc.level
    };
  }

  let newTotalScore = rawScore;
  let newLevel = isArrowGame ? rawLevel : 1;
  let newMax = newLevel;
  let newGamesCount = 1;

  // Initialize or inherit game-specific statistics
  const currentStats = (existingScoreDoc && existingScoreDoc.gameStats) ? existingScoreDoc.gameStats : {};
  const gameEntry = currentStats[gameKey] || { bestScore: 0, gamesPlayed: 0 };

  gameEntry.bestScore = Math.max(gameEntry.bestScore || 0, rawScore);
  gameEntry.gamesPlayed = (gameEntry.gamesPlayed || 0) + 1;

  if (gameKey === 'temple') {
    gameEntry.bestDistance = Math.max(gameEntry.bestDistance || 0, Math.floor(stats?.distance || rawScore));
    gameEntry.totalCoins = (gameEntry.totalCoins || 0) + (stats?.coins || 0);
  } else if (gameKey === 'arrow') {
    gameEntry.maxLevel = Math.max(gameEntry.maxLevel || 1, rawLevel);
  } else if (gameKey === 'candy') {
    gameEntry.maxLevel = Math.max(gameEntry.maxLevel || 1, rawLevel);
  } else if (gameKey === 'tictactoe') {
    if (stats?.outcome === 'win') gameEntry.wins = (gameEntry.wins || 0) + 1;
    else if (stats?.outcome === 'draw') gameEntry.draws = (gameEntry.draws || 0) + 1;
    else if (stats?.outcome === 'loss') gameEntry.losses = (gameEntry.losses || 0) + 1;
  }

  currentStats[gameKey] = gameEntry;

  if (existingScoreDoc) {
    const currentMax = Math.max(existingScoreDoc.maxUnlockedLevel || 1, existingScoreDoc.level || 1);

    if (isArrowGame) {
      const maxAllowedLevel = currentMax + 1;
      newLevel = Math.min(Math.max(existingScoreDoc.level || 1, rawLevel), maxAllowedLevel);
      newMax = Math.max(currentMax, newLevel);
    } else {
      newLevel = existingScoreDoc.level || 1;
      newMax = currentMax;
    }

    newTotalScore = (existingScoreDoc.score || 0) + rawScore;
    newGamesCount = (existingScoreDoc.gamesPlayed || 0) + 1;

    const submissionQueue = Array.isArray(existingScoreDoc.processedSubmissionIds)
      ? existingScoreDoc.processedSubmissionIds
      : [];
    if (submissionId) {
      submissionQueue.push(submissionId);
      if (submissionQueue.length > 100) submissionQueue.shift();
    }

    existingScoreDoc.displayName = user.displayName || user.username || 'Player';
    existingScoreDoc.avatar = user.avatar || '';
    existingScoreDoc.gameName = gameName || existingScoreDoc.gameName || 'Arrow Puzzle';
    existingScoreDoc.score = newTotalScore;
    existingScoreDoc.level = newLevel;
    existingScoreDoc.maxUnlockedLevel = newMax;
    existingScoreDoc.gamesPlayed = newGamesCount;
    existingScoreDoc.gameStats = currentStats;
    existingScoreDoc.processedSubmissionIds = submissionQueue;
    existingScoreDoc.updatedAt = new Date();

    await existingScoreDoc.save();
    await GameScore.deleteMany({ userId: resolvedUserId, _id: { $ne: existingScoreDoc._id } });
  } else {
    newMax = isArrowGame ? newLevel : 1;
    const submissionQueue = submissionId ? [submissionId] : [];

    existingScoreDoc = await GameScore.create({
      userId: resolvedUserId,
      displayName: user.displayName || user.username || 'Player',
      avatar: user.avatar || '',
      gameName: gameName || 'Arrow Puzzle',
      score: newTotalScore,
      level: newLevel,
      maxUnlockedLevel: newMax,
      gamesPlayed: 1,
      gameStats: currentStats,
      processedSubmissionIds: submissionQueue,
      updatedAt: new Date()
    });
  }

  return {
    duplicate: false,
    scoreDoc: existingScoreDoc,
    newTotalScore,
    newLevel,
    newMax,
    newGamesCount
  };
}

// Submit Mini-Game Score, Level & Earn Rewards / Streaks
router.post('/game-score', authMiddleware, async (req, res) => {
  try {
    const { gameName, score, level, stats, submissionId } = req.body;
    const userId = req.userId || req.user?.id || req.user?.userId;

    const rawScore = parseInt(score || '0', 10);
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

    const updateResult = await applyScoreUpdate({
      user,
      resolvedUserId,
      gameName,
      score: rawScore,
      level: parseInt(level || '1', 10),
      stats,
      submissionId
    });

    if (updateResult.duplicate) {
      return res.json({
        success: true,
        duplicate: true,
        message: 'Score already submitted and verified',
        currentScore: updateResult.currentScore
      });
    }

    const io = req.app.get('io');
    const { rank1UserId, rank2UserId } = await syncLeaderboardRankCrowns(io);
    const isNowRank1 = rank1UserId === resolvedUserId;
    const isNowRank2 = rank2UserId === resolvedUserId;

    // Daily Gaming Task & 7-Day Streak Evaluation
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let taskCompletedToday = user.lastGamingTaskDate === todayStr;
    let newStreak = user.gamingStreakCount || 0;
    let unlocked7DayStreakReward = false;

    if (!taskCompletedToday) {
      taskCompletedToday = true;

      if (user.lastGamingTaskDate === yesterdayStr) {
        newStreak = (user.gamingStreakCount || 0) + 1;
      } else {
        newStreak = 1;
      }

      if (newStreak >= 7) {
        newStreak = 7;
        unlocked7DayStreakReward = true;
        user.isPro = true;
        user.proExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
        user.proTier = 'streak_1day';
        user.hasStreakCrown = true;
        user.streakCrownExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
      }

      user.lastGamingTaskDate = todayStr;
      user.gamingStreakCount = newStreak;
    }

    if (user.hasStreakCrown && user.streakCrownExpiresAt && new Date(user.streakCrownExpiresAt) <= new Date()) {
      user.hasStreakCrown = false;
    }
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

    if (isNowRank1 && user.claimedDailyFirstReward !== todayStr) {
      user.claimedDailyFirstReward = todayStr;
    }

    await user.save();

    const leaderboardList = await getLeaderboardList('all', rank1UserId, rank2UserId);

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
      rewardSparks: 0,
      newSparksBalance: user.pulseSparks || 0,
      streakDays: user.gamingStreakCount,
      unlocked7DayStreakReward,
      isPro: user.isPro,
      hasKingCrown: isNowRank1,
      hasSilverCrown: isNowRank2,
      hasStreakCrown: user.hasStreakCrown,
      totalScore: updateResult.newTotalScore,
      leaderboard: leaderboardList
    });
  } catch (err) {
    console.error('Error submitting game score:', err);
    res.status(500).json({ error: 'Failed to submit game score' });
  }
});

// Batch Synchronization for Locally Queued Offline Game Sessions
router.post('/sync-offline-scores', authMiddleware, async (req, res) => {
  try {
    const { submissions } = req.body;
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.json({ success: true, syncedCount: 0, message: 'No submissions to sync' });
    }

    const userId = req.userId || req.user?.id || req.user?.userId;
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

    let syncedCount = 0;
    let duplicateCount = 0;

    for (const sub of submissions) {
      if (!sub || typeof sub !== 'object') continue;
      const resUpdate = await applyScoreUpdate({
        user,
        resolvedUserId,
        gameName: sub.gameName,
        score: sub.score,
        level: sub.level,
        stats: sub.stats,
        submissionId: sub.submissionId
      });
      if (resUpdate.duplicate) {
        duplicateCount++;
      } else {
        syncedCount++;
      }
    }

    const io = req.app.get('io');
    const { rank1UserId, rank2UserId } = await syncLeaderboardRankCrowns(io);
    const updatedLeaderboard = await getLeaderboardList('all', rank1UserId, rank2UserId);

    if (io && syncedCount > 0) {
      io.emit('leaderboard_updated', updatedLeaderboard);
    }

    const updatedDoc = await GameScore.findOne({ userId: resolvedUserId }).lean();

    res.json({
      success: true,
      syncedCount,
      duplicateCount,
      totalScore: updatedDoc?.score || 0,
      leaderboard: updatedLeaderboard
    });
  } catch (err) {
    console.error('Error syncing offline scores:', err);
    res.status(500).json({ error: 'Failed to sync offline scores' });
  }
});

// Accessible Public Player Gaming Profile (Privacy-Safe)
router.get('/profile/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    if (!targetUserId) return res.status(400).json({ error: 'User ID is required' });

    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
    const userDoc = await User.findOne({
      $or: [
        { id: targetUserId },
        ...(isObjectId ? [{ _id: targetUserId }] : []),
        { username: targetUserId }
      ]
    }).select('id username displayName avatar bio isPro proTier hasKingCrown hasSilverCrown hasStreakCrown gamingStreakCount createdAt').lean();

    if (!userDoc) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const resolvedId = userDoc.id || userDoc._id.toString();
    const scoreDoc = await GameScore.findOne({ userId: resolvedId }).lean();

    // Compute global ranking
    const currentScore = scoreDoc?.score || 0;
    const higherScoresCount = await GameScore.countDocuments({
      score: { $gt: currentScore }
    });
    const globalRank = higherScoresCount + 1;

    // Build achievements based on player statistics
    const achievements = [];
    const totalScore = currentScore;
    const streak = userDoc.gamingStreakCount || 0;
    const arrowLvl = scoreDoc?.gameStats?.arrow?.maxLevel || scoreDoc?.level || 1;
    const templeDist = scoreDoc?.gameStats?.temple?.bestDistance || 0;
    const tictactoeWins = scoreDoc?.gameStats?.tictactoe?.wins || 0;
    const candyLvl = scoreDoc?.gameStats?.candy?.maxLevel || 1;

    if (totalScore >= 100) achievements.push({ id: 'centurion', title: 'Centurion', desc: 'Earned 100+ global points', icon: '⭐' });
    if (totalScore >= 500) achievements.push({ id: 'high_roller', title: 'High Roller', desc: 'Earned 500+ global points', icon: '💎' });
    if (totalScore >= 1000) achievements.push({ id: 'grand_master', title: 'Grand Master', desc: 'Crossed 1,000+ gaming points', icon: '👑' });
    if (streak >= 3) achievements.push({ id: 'streak_3', title: 'Flame Keeper', desc: 'Maintained 3-day gaming streak', icon: '🔥' });
    if (streak >= 7) achievements.push({ id: 'streak_7', title: 'Legendary Streak', desc: 'Completed full 7-day gaming quest', icon: '⚡' });
    if (arrowLvl >= 5) achievements.push({ id: 'arrow_5', title: 'Puzzle Tactician', desc: 'Cleared Level 5 in Arrow Puzzle', icon: '🎯' });
    if (templeDist >= 300) achievements.push({ id: 'temple_runner', title: 'Jungle Raider', desc: 'Ran 300m+ in Temple Run 3D', icon: '🗿' });
    if (candyLvl >= 3) achievements.push({ id: 'candy_master', title: 'Sugar Master', desc: 'Passed Level 3 in Candy Crush', icon: '🍬' });
    if (tictactoeWins >= 3) achievements.push({ id: 'ai_slayer', title: 'AI Slayer', desc: 'Defeated Master AI 3+ times', icon: '🤖' });

    res.json({
      success: true,
      player: {
        userId: resolvedId,
        username: userDoc.username,
        displayName: userDoc.displayName || userDoc.username,
        avatar: userDoc.avatar || '',
        bio: userDoc.bio || '',
        isPro: Boolean(userDoc.isPro),
        proTier: userDoc.proTier || 'none',
        hasKingCrown: Boolean(userDoc.hasKingCrown || globalRank === 1),
        hasSilverCrown: Boolean(userDoc.hasSilverCrown || globalRank === 2),
        hasStreakCrown: Boolean(userDoc.hasStreakCrown),
        gamingStreakCount: streak,
        globalRank,
        totalScore,
        arrowLevel: arrowLvl,
        gamesPlayed: scoreDoc?.gamesPlayed || 0,
        gameStats: scoreDoc?.gameStats || {
          arrow: { bestScore: 0, maxLevel: 1, gamesPlayed: 0 },
          temple: { bestScore: 0, bestDistance: 0, totalCoins: 0, gamesPlayed: 0 },
          candy: { bestScore: 0, maxLevel: 1, gamesPlayed: 0 },
          tapper: { bestScore: 0, gamesPlayed: 0 },
          tictactoe: { wins: 0, draws: 0, losses: 0, gamesPlayed: 0 }
        },
        achievements,
        memberSince: userDoc.createdAt
      }
    });
  } catch (err) {
    console.error('Error fetching player profile:', err);
    res.status(500).json({ error: 'Failed to fetch player profile' });
  }
});

// Claim Ad Reward (Rewarded Video Ad completion for in-game Revive)
router.post('/claim-ad-reward', authMiddleware, async (req, res) => {
  try {
    const { rewardType } = req.body;
    const userId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);

    const user = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('id pulseSparks').lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      rewardType: rewardType || 'revive',
      rewardSparks: 0,
      pulseSparks: user.pulseSparks || 0
    });
  } catch (err) {
    console.error('Error claiming ad reward:', err);
    res.status(500).json({ error: 'Failed to claim ad reward' });
  }
});

module.exports = router;
