const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const db = require('../database/db');

// Middleware to check Admin status
const adminOnly = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const userId = req.user?.id || req.user?._id;
    const username = req.user?.username;

    if (!userId && !username) {
      return res.status(401).json({ error: 'Unauthorized user session.' });
    }

    const isObjectId = userId && mongoose.Types.ObjectId.isValid(userId);
    const user = await User.findOne({
      $or: [
        ...(userId ? [{ id: userId }] : []),
        ...(isObjectId ? [{ _id: userId }] : []),
        ...(username ? [{ username: username }] : [])
      ]
    }).lean();

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Access denied: Master Admin privileges required.' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    console.error('adminOnly middleware error:', err);
    res.status(500).json({ error: 'Failed to verify admin status.' });
  }
};

// GET Live Admin System Stats & User Metrics
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const getOnlineMap = req.app.get('getRawOnlineUsersMap');
    const onlineMap = typeof getOnlineMap === 'function' ? getOnlineMap() : null;
    const liveOnlineUserIds = onlineMap ? Array.from(onlineMap.keys()) : [];

    const [totalUsersCount, totalMessages, totalGroups, rawUsersList] = await Promise.all([
      User.countDocuments({}),
      Message.countDocuments({ type: { $ne: 'system' } }),
      Group.countDocuments(),
      User.find({})
        .sort({ createdAt: -1 })
        .select('id _id username displayName email avatar isEmailVerified isPro proTier isAdmin status createdAt')
        .lean()
    ]);

    const onlineSet = new Set(liveOnlineUserIds);

    const formattedUsersList = rawUsersList.map(u => {
      const uStrId = u.id || (u._id ? u._id.toString() : '');
      const isOnline = onlineSet.has(uStrId) ||
        (u.username && onlineSet.has(u.username)) ||
        (u._id && onlineSet.has(u._id.toString()));

      return {
        id: uStrId,
        mongoId: u._id ? u._id.toString() : '',
        username: u.username || 'user',
        displayName: u.displayName || u.username || 'User',
        email: u.email || '',
        avatar: u.avatar || '',
        isPro: Boolean(u.isPro),
        isAdmin: Boolean(u.isAdmin),
        proTier: u.proTier || 'none',
        createdAt: u.createdAt,
        isLiveOnline: isOnline
      };
    });

    const liveOnlineCount = formattedUsersList.filter(u => u.isLiveOnline).length;

    res.json({
      success: true,
      totalUsers: totalUsersCount,
      liveOnlineCount,
      totalMessages,
      totalGroups,
      users: formattedUsersList
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats: ' + err.message });
  }
});

// Admin Claim / Passcode Activation Route
router.post('/claim-admin', authMiddleware, async (req, res) => {
  try {
    const { secretCode } = req.body;
    const MASTER_SECRET = process.env.ADMIN_SECRET_KEY || 'pulse_master_admin_851112';

    if (!secretCode || secretCode.trim() !== MASTER_SECRET) {
      return res.status(400).json({ error: 'Invalid Master Admin Passcode.' });
    }

    const mongoose = require('mongoose');
    const userId = req.user?.id || req.user?._id;
    const username = req.user?.username;

    const isObjectId = userId && mongoose.Types.ObjectId.isValid(userId);
    const query = {
      $or: [
        ...(userId ? [{ id: userId }] : []),
        ...(isObjectId ? [{ _id: userId }] : []),
        ...(username ? [{ username: username }] : [])
      ]
    };

    const updated = await User.findOneAndUpdate(query, { isAdmin: true }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ error: 'User account not found in database.' });
    }

    const { passwordHash, otpCode, otpExpires, ...safeUser } = updated;
    safeUser.isAdmin = true;

    res.json({
      success: true,
      message: '👑 Stealth Master Admin Activated Successfully!',
      user: safeUser
    });
  } catch (err) {
    console.error('Claim admin error:', err);
    res.status(500).json({ error: 'Failed to claim admin status: ' + err.message });
  }
});

// Admin Toggle User Pro / VIP status
router.post('/toggle-user-pro', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { targetUserId, isPro } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'Target User ID required' });

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
    const query = isObjectId
      ? { $or: [{ id: targetUserId }, { _id: targetUserId }] }
      : { $or: [{ id: targetUserId }, { username: targetUserId }] };

    const updated = await User.findOneAndUpdate(
      query,
      {
        isPro: Boolean(isPro),
        proTier: isPro ? 'yearly' : 'none',
        proExpiresAt: isPro ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: updated.id || updated._id?.toString(),
        userMongoId: updated._id?.toString(),
        username: updated.username,
        isPro: Boolean(updated.isPro),
        proTier: updated.proTier
      });
    }

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Toggle user pro error:', err);
    res.status(500).json({ error: 'Failed to update user Pro status: ' + err.message });
  }
});

module.exports = router;
