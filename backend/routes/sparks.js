const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const SparksTransaction = require('../models/SparksTransaction');

// Helper to resolve canonical user ID
const resolveCanonicalUserId = (req) => {
  return req.user?.id || req.userId || (req.user?._id ? req.user._id.toString() : null);
};

// 1. Get Sparks Wallet, current balance, and full transaction history
router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    const userDoc = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjId ? [{ _id: userId }] : [])
      ]
    }).select('id _id username displayName avatar pulseSparks isPro').lean();

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canonicalId = userDoc.id || userDoc._id.toString();
    const currentBalance = typeof userDoc.pulseSparks === 'number' ? userDoc.pulseSparks : 50;

    // Fetch transactions for this user (both string id and mongo id if different)
    const idFilters = [{ userId: canonicalId }];
    if (userDoc._id && userDoc._id.toString() !== canonicalId) {
      idFilters.push({ userId: userDoc._id.toString() });
    }

    const transactions = await SparksTransaction.find({
      $or: idFilters
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate total earned (credits) and total spent (debits)
    let totalEarned = 0;
    let totalSpent = 0;
    let lastDailyClaim = null;

    transactions.forEach(tx => {
      if (tx.type === 'credit') {
        totalEarned += Number(tx.amount) || 0;
      } else if (tx.type === 'debit') {
        totalSpent += Number(tx.amount) || 0;
      }
      if (tx.reason === 'daily_claim' && !lastDailyClaim) {
        lastDailyClaim = tx.createdAt;
      }
    });

    // Check if daily claim is available (24h cooldown)
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    let canClaimDaily = true;
    let nextClaimInMs = 0;

    if (lastDailyClaim) {
      const elapsed = now - new Date(lastDailyClaim).getTime();
      if (elapsed < DAY_MS) {
        canClaimDaily = false;
        nextClaimInMs = DAY_MS - elapsed;
      }
    }

    // Calculate rewarded ads watched today (max 3 per day)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const adsWatchedToday = transactions.filter(tx => 
      tx.reason === 'ad_reward' && new Date(tx.createdAt).getTime() >= startOfToday.getTime()
    ).length;

    res.json({
      success: true,
      balance: currentBalance,
      user: {
        id: canonicalId,
        username: userDoc.username,
        displayName: userDoc.displayName || userDoc.username,
        avatar: userDoc.avatar
      },
      totalEarned,
      totalSpent,
      transactions,
      canClaimDaily,
      dailyRewardAmount: 15,
      nextClaimInMs,
      adsWatchedToday: Math.min(3, adsWatchedToday),
      maxDailyAds: 3,
      adRewardAmount: 15,
      canWatchAd: adsWatchedToday < 3
    });
  } catch (err) {
    console.error('Error fetching sparks wallet:', err);
    res.status(500).json({ error: 'Failed to fetch sparks wallet' });
  }
});

// 2. Claim free daily login sparks (15 Sparks every 24 hours)
router.post('/claim-daily', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    const userDoc = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjId ? [{ _id: userId }] : [])
      ]
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canonicalId = userDoc.id || userDoc._id.toString();

    // Check last daily claim
    const lastClaimTx = await SparksTransaction.findOne({
      userId: canonicalId,
      reason: 'daily_claim'
    }).sort({ createdAt: -1 }).lean();

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (lastClaimTx) {
      const elapsed = now - new Date(lastClaimTx.createdAt).getTime();
      if (elapsed < DAY_MS) {
        const remainingHours = Math.ceil((DAY_MS - elapsed) / (1000 * 60 * 60));
        return res.status(400).json({
          error: `Daily Sparks already claimed! Come back in ${remainingHours} hour(s).`,
          nextClaimInMs: DAY_MS - elapsed
        });
      }
    }

    const rewardAmount = 15;
    const oldBalance = typeof userDoc.pulseSparks === 'number' ? userDoc.pulseSparks : 50;
    const newBalance = oldBalance + rewardAmount;
    userDoc.pulseSparks = newBalance;
    await userDoc.save();

    // Record credit transaction
    const tx = await SparksTransaction.create({
      userId: canonicalId,
      type: 'credit',
      amount: rewardAmount,
      reason: 'daily_claim',
      title: 'Daily Sparks Reward 🎁',
      description: 'Free daily login bonus collected',
      balanceAfter: newBalance
    });

    // Real-time socket broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${canonicalId}`).emit('sparks_updated', {
        pulseSparks: newBalance,
        addedAmount: rewardAmount,
        type: 'credit',
        title: '🎁 +15 Daily Sparks Claimed!'
      });
      io.to(`user_${canonicalId}`).emit('user_profile_updated', {
        userId: canonicalId,
        pulseSparks: newBalance
      });
    }

    res.json({
      success: true,
      balance: newBalance,
      addedAmount: rewardAmount,
      transaction: tx
    });
  } catch (err) {
    console.error('Error claiming daily sparks:', err);
    res.status(500).json({ error: 'Failed to claim daily sparks' });
  }
});

// 3. Claim Rewarded Video Ad Sparks (+15 Sparks per ad, max 3 ads per day)
router.post('/claim-ad-reward', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    const userDoc = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjId ? [{ _id: userId }] : [])
      ]
    });

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canonicalId = userDoc.id || userDoc._id.toString();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayAdsCount = await SparksTransaction.countDocuments({
      userId: canonicalId,
      reason: 'ad_reward',
      createdAt: { $gte: startOfToday }
    });

    if (todayAdsCount >= 3) {
      return res.status(400).json({
        error: 'Daily ad limit reached (3/3). Come back tomorrow to earn more free Sparks!',
        adsWatchedToday: 3,
        maxDailyAds: 3
      });
    }

    const rewardAmount = 15;
    const oldBalance = typeof userDoc.pulseSparks === 'number' ? userDoc.pulseSparks : 50;
    const newBalance = oldBalance + rewardAmount;
    userDoc.pulseSparks = newBalance;
    await userDoc.save();

    // Record credit transaction
    const tx = await SparksTransaction.create({
      userId: canonicalId,
      type: 'credit',
      amount: rewardAmount,
      reason: 'ad_reward',
      title: 'Rewarded Ad Bonus 🎬⚡',
      description: `Watched rewarded video ad (${todayAdsCount + 1}/3)`,
      balanceAfter: newBalance
    });

    // Real-time socket broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${canonicalId}`).emit('sparks_updated', {
        pulseSparks: newBalance,
        addedAmount: rewardAmount,
        type: 'credit',
        title: `🎬 +15 Sparks Earned from Ad! (${todayAdsCount + 1}/3)`
      });
      io.to(`user_${canonicalId}`).emit('user_profile_updated', {
        userId: canonicalId,
        pulseSparks: newBalance
      });
    }

    res.json({
      success: true,
      balance: newBalance,
      addedAmount: rewardAmount,
      adsWatchedToday: todayAdsCount + 1,
      maxDailyAds: 3,
      transaction: tx
    });
  } catch (err) {
    console.error('Error claiming ad reward sparks:', err);
    res.status(500).json({ error: 'Failed to claim ad reward sparks' });
  }
});

module.exports = router;
