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
    const idFilters = [{ userId: canonicalId }];
    if (userDoc._id && userDoc._id.toString() !== canonicalId) {
      idFilters.push({ userId: userDoc._id.toString() });
    }

    // Check last daily claim
    const lastClaimTx = await SparksTransaction.findOne({
      $or: idFilters,
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

    const idFilters = [{ userId: canonicalId }];
    if (userDoc._id && userDoc._id.toString() !== canonicalId) {
      idFilters.push({ userId: userDoc._id.toString() });
    }

    const todayAdsCount = await SparksTransaction.countDocuments({
      $or: idFilters,
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

// 4. Unlock Pro Features with Sparks (Free users spend sparks, Pro users get it free)
router.post('/use-feature', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { featureKey } = req.body;
    const FEATURE_COSTS = {
      chat_game: { sparks: 5, title: 'Chat Game Play / Level 🎮', description: 'Unlocked chat game play round' },
      music_boost_5m: { sparks: 10, title: 'Music Listening 5m Boost 🎵⚡', description: 'Unlocked +5 minutes of music listening' },
      music_boost_30m: { sparks: 10, title: 'Music Listening 5m Boost 🎵⚡', description: 'Unlocked +5 minutes of music listening' },
      pro_theme_trial_5m: { sparks: 10, title: 'VIP Theme 5-Min Trial 🎨', description: '5-minute live trial of VIP Pro Theme' },
      pro_theme: { sparks: 10, title: 'VIP Theme 5-Min Trial 🎨', description: '5-minute live trial of VIP Pro Theme' },
      vibe_aura_trial_5m: { sparks: 10, title: 'VIP Aura 5-Min Trial 🔮', description: '5-minute live trial of VIP Neon Aura' },
      vibe_aura: { sparks: 10, title: 'VIP Aura 5-Min Trial 🔮', description: '5-minute live trial of VIP Neon Aura' },
      animated_3d_text: { sparks: 5, title: '3D VIP Text Message ✨', description: 'Sent 3D animated VIP text' },
    };

    const targetFeature = FEATURE_COSTS[featureKey];
    if (!targetFeature) {
      return res.status(400).json({ error: 'Invalid feature specified' });
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
    const isPro = Boolean(userDoc.isPro && (!userDoc.proExpiresAt || new Date(userDoc.proExpiresAt) > new Date()));

    // Pro users get all Pro features completely FREE!
    if (isPro) {
      return res.json({
        success: true,
        isPro: true,
        cost: 0,
        balance: userDoc.pulseSparks || 0,
        feature: featureKey
      });
    }

    const cost = targetFeature.sparks;
    const currentBalance = typeof userDoc.pulseSparks === 'number' ? userDoc.pulseSparks : 50;

    if (currentBalance < cost) {
      return res.status(400).json({
        error: `Insufficient Sparks. This feature requires ${cost} Sparks (Your balance: ${currentBalance}).`,
        insufficientSparks: true,
        requiredSparks: cost,
        currentBalance
      });
    }

    const newBalance = currentBalance - cost;
    userDoc.pulseSparks = newBalance;
    await userDoc.save();

    // Record debit transaction safely
    let tx = null;
    try {
      tx = await SparksTransaction.create({
        userId: canonicalId,
        type: 'debit',
        amount: cost,
        reason: `feature_${featureKey}`,
        title: targetFeature.title,
        description: targetFeature.description,
        balanceAfter: newBalance
      });
    } catch (txErr) {
      console.warn('Sparks debit transaction record warning:', txErr);
    }

    // Real-time socket broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${canonicalId}`).emit('sparks_updated', {
        pulseSparks: newBalance,
        spentAmount: cost,
        type: 'debit',
        title: `⚡ -${cost} Sparks (${targetFeature.title})`
      });
      io.to(`user_${canonicalId}`).emit('user_profile_updated', {
        userId: canonicalId,
        pulseSparks: newBalance
      });
    }

    res.json({
      success: true,
      isPro: false,
      cost,
      balance: newBalance,
      feature: featureKey,
      transaction: tx
    });
  } catch (err) {
    console.error('Error using feature with sparks:', err);
    res.status(500).json({ error: err.message || 'Failed to process Sparks unlock' });
  }
});

// Helper function to execute referral reward
async function processReferralReward(newUserId, referralCodeInput, io = null) {
  if (!newUserId || !referralCodeInput) return null;

  const isObjId = mongoose.Types.ObjectId.isValid(newUserId);
  const newUser = await User.findOne({
    $or: [{ id: newUserId }, ...(isObjId ? [{ _id: newUserId }] : [])]
  });

  if (!newUser || newUser.hasClaimedReferral) return null;

  const cleanCode = referralCodeInput.trim().toUpperCase();
  // Find referrer by referralCode OR username
  const referrer = await User.findOne({
    $or: [
      { referralCode: cleanCode },
      { username: cleanCode.toLowerCase() },
      { username: referralCodeInput.trim().toLowerCase() }
    ]
  });

  if (!referrer) return null;
  const canonicalNewId = newUser.id || newUser._id.toString();
  const canonicalRefId = referrer.id || referrer._id.toString();

  // Cannot refer oneself!
  if (canonicalNewId === canonicalRefId || newUser.username === referrer.username) {
    return null;
  }

  // Credit Referrer +200 Sparks
  const refOldSparks = typeof referrer.pulseSparks === 'number' ? referrer.pulseSparks : 50;
  const refNewBalance = refOldSparks + 200;
  referrer.pulseSparks = refNewBalance;
  referrer.referralCount = (referrer.referralCount || 0) + 1;
  referrer.referralEarnings = (referrer.referralEarnings || 0) + 200;
  await referrer.save();

  // Credit New User +50 Sparks
  const newOldSparks = typeof newUser.pulseSparks === 'number' ? newUser.pulseSparks : 50;
  const newBalance = newOldSparks + 50;
  newUser.pulseSparks = newBalance;
  newUser.hasClaimedReferral = true;
  newUser.referredBy = canonicalRefId;
  await newUser.save();

  // Record Transactions
  try {
    await SparksTransaction.create({
      userId: canonicalRefId,
      type: 'credit',
      amount: 200,
      reason: 'referral_bonus',
      title: '🎁 Referral Bonus (+200 Sparks)',
      description: `@${newUser.username || 'friend'} joined PulseChat using your referral code!`,
      relatedUserId: canonicalNewId,
      relatedUserName: newUser.username || 'friend',
      balanceAfter: refNewBalance
    });

    await SparksTransaction.create({
      userId: canonicalNewId,
      type: 'credit',
      amount: 50,
      reason: 'referral_welcome',
      title: '🎉 Welcome Referral Bonus (+50 Sparks)',
      description: `Welcome bonus for joining via @${referrer.username || 'friend'}'s referral!`,
      relatedUserId: canonicalRefId,
      relatedUserName: referrer.username || 'friend',
      balanceAfter: newBalance
    });
  } catch (txErr) {
    console.warn('Referral SparksTransaction error:', txErr);
  }

  // Real-time socket broadcast
  if (io) {
    io.to(`user_${canonicalRefId}`).emit('sparks_updated', {
      pulseSparks: refNewBalance,
      earnedAmount: 200,
      type: 'credit',
      title: `🎁 +200 Sparks! @${newUser.username || 'friend'} joined via your referral link!`
    });
    io.to(`user_${canonicalRefId}`).emit('user_profile_updated', {
      userId: canonicalRefId,
      pulseSparks: refNewBalance
    });
    io.to(`user_${canonicalNewId}`).emit('sparks_updated', {
      pulseSparks: newBalance,
      earnedAmount: 50,
      type: 'credit',
      title: `🎉 +50 Sparks Welcome Bonus credited!`
    });
    io.to(`user_${canonicalNewId}`).emit('user_profile_updated', {
      userId: canonicalNewId,
      pulseSparks: newBalance
    });
  }

  return { referrer, newUser, refNewBalance, newBalance };
}

// 7. Get User's Referral Code, Link, Stats, and History
router.get('/referral-info', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized user' });

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    let userDoc = await User.findOne({
      $or: [{ id: userId }, ...(isObjId ? [{ _id: userId }] : [])]
    });

    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    // Ensure user has a clean referral code
    if (!userDoc.referralCode) {
      const cleanUsername = (userDoc.username || 'PULSE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      userDoc.referralCode = `${cleanUsername}${Math.floor(1000 + Math.random() * 9000)}`;
      await userDoc.save();
    }

    const host = req.get('host') || 'localhost:5173';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const origin = `${protocol}://${host}`;
    const referralLink = `${origin}/?ref=${encodeURIComponent(userDoc.referralCode)}`;

    const canonicalId = userDoc.id || userDoc._id.toString();
    const referralHistory = await SparksTransaction.find({
      userId: canonicalId,
      reason: 'referral_bonus'
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    res.json({
      success: true,
      referralCode: userDoc.referralCode,
      referralLink,
      referralCount: userDoc.referralCount || 0,
      referralEarnings: userDoc.referralEarnings || 0,
      hasClaimedReferral: !!userDoc.hasClaimedReferral,
      referredBy: userDoc.referredBy || null,
      history: referralHistory.map(h => ({
        id: h._id,
        relatedUserName: h.relatedUserName || 'Friend',
        amount: h.amount || 200,
        createdAt: h.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching referral info:', err);
    res.status(500).json({ error: 'Failed to fetch referral details' });
  }
});

// 8. Claim Referral Code (Manual entry by new user)
router.post('/claim-referral', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    const { referralCode } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized user' });
    if (!referralCode || !referralCode.trim()) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    const existingUser = await User.findOne({
      $or: [{ id: userId }, ...(isObjId ? [{ _id: userId }] : [])]
    });
    if (!existingUser) return res.status(404).json({ error: 'User not found' });

    // Strict Rule: Referral bonuses are strictly for newly registered users
    if (existingUser.createdAt) {
      const ageMs = Date.now() - new Date(existingUser.createdAt).getTime();
      if (ageMs > 2 * 60 * 60 * 1000) {
        return res.status(400).json({ error: 'Referral codes can only be claimed by new users during account registration.' });
      }
    }

    const io = req.app.get('io');
    const result = await processReferralReward(userId, referralCode.trim(), io);

    if (!result) {
      return res.status(400).json({ error: 'Invalid referral code, already claimed, or cannot refer yourself.' });
    }

    res.json({
      success: true,
      message: 'Referral code applied! +50 Sparks welcome bonus added to your wallet!',
      bonusSparks: 50,
      newBalance: result.newBalance,
      referredBy: result.referrer.username
    });
  } catch (err) {
    console.error('Error claiming referral:', err);
    res.status(500).json({ error: err.message || 'Failed to claim referral' });
  }
});

// 9. Permanently delete selected sparks transactions
router.post('/delete-transactions', authMiddleware, async (req, res) => {
  try {
    const userId = resolveCanonicalUserId(req);
    const { transactionIds } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized user' });
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'No transaction IDs provided' });
    }

    const isObjId = mongoose.Types.ObjectId.isValid(userId);
    const userDoc = await User.findOne({
      $or: [{ id: userId }, ...(isObjId ? [{ _id: userId }] : [])]
    }).select('id _id').lean();
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

    const canonicalId = userDoc.id || userDoc._id.toString();
    const userIds = [canonicalId];
    if (userDoc._id && userDoc._id.toString() !== canonicalId) {
      userIds.push(userDoc._id.toString());
    }

    const validObjectIds = transactionIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const result = await SparksTransaction.deleteMany({
      userId: { $in: userIds },
      $or: [
        { _id: { $in: validObjectIds } },
        { id: { $in: transactionIds } }
      ]
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: `${result.deletedCount || 0} transaction(s) permanently deleted.`
    });
  } catch (err) {
    console.error('Error deleting sparks transactions:', err);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

module.exports = router;
module.exports.processReferralReward = processReferralReward;
