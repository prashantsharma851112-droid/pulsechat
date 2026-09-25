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
    const isObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    const user = await User.findOne({
      $or: [
        { id: req.user.id },
        ...(isObjectId ? [{ _id: req.user.id }] : []),
        { username: req.user.username }
      ]
    }).lean();

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Access denied: Master Admin privileges required.' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin status.' });
  }
};

// GET Live Admin System Stats & User Metrics
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const getOnlineMap = req.app.get('getRawOnlineUsersMap');
    const onlineMap = typeof getOnlineMap === 'function' ? getOnlineMap() : null;
    const liveOnlineUserIds = onlineMap ? Array.from(onlineMap.keys()) : [];

    const [totalUsers, totalMessages, totalGroups, allUsers] = await Promise.all([
      User.countDocuments({ isAdmin: { $ne: true } }),
      Message.countDocuments({ type: { $ne: 'system' } }),
      Group.countDocuments(),
      User.find({ isAdmin: { $ne: true } })
        .sort({ createdAt: -1 })
        .select('id username displayName email avatar isEmailVerified isPro proTier status createdAt')
        .lean()
    ]);

    const onlineSet = new Set(liveOnlineUserIds);

    const usersWithOnlineStatus = allUsers.map(u => ({
      ...u,
      isLiveOnline: onlineSet.has(u.id) || onlineSet.has(u.username) || (u._id && onlineSet.has(u._id.toString()))
    }));

    const liveOnlineCount = usersWithOnlineStatus.filter(u => u.isLiveOnline).length;

    res.json({
      success: true,
      totalUsers,
      liveOnlineCount,
      totalMessages,
      totalGroups,
      users: usersWithOnlineStatus
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
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

    const updated = await db.updateUser(req.user.id, { isAdmin: true });
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    const { passwordHash, ...safeUser } = updated;
    safeUser.isAdmin = true;

    res.json({
      success: true,
      message: '👑 Stealth Master Admin Activated Successfully!',
      user: safeUser
    });
  } catch (err) {
    console.error('Claim admin error:', err);
    res.status(500).json({ error: 'Failed to claim admin status' });
  }
});

// Admin Toggle User Pro / VIP status
router.post('/toggle-user-pro', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { targetUserId, isPro } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'Target User ID required' });

    const updated = await db.updateUser(targetUserId, {
      isPro: Boolean(isPro),
      proTier: isPro ? 'yearly' : 'none'
    });

    const io = req.app.get('io');
    if (io && updated) {
      io.emit('user_profile_updated', {
        userId: updated.id,
        userMongoId: updated._id?.toString(),
        isPro: Boolean(updated.isPro),
        proTier: updated.proTier
      });
    }

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user Pro status' });
  }
});

module.exports = router;
