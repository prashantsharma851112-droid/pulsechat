const express = require('express');
const router = express.Router();
const db = require('../database/db');
const User = require('../models/User');
const webpush = require('../utils/webpush');
const authMiddleware = require('../middleware/authMiddleware');

// Get all registered users (except current user)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const results = await User.find({ id: { $ne: req.user.id } })
      .select('id username displayName avatar isEmailVerified status')
      .limit(100)
      .lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Persistent conversation list (shown by default in the sidebar) - includes
// anyone who has messaged you OR whom you've messaged, even without a search
router.get('/recent', authMiddleware, async (req, res) => {
  const conversations = await db.getRecentConversations(req.user.id);
  res.json(conversations);
});

// Search users by Name or @username (instant indexed regex lookup)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim().replace(/^@/, '');
    if (!query) return res.json([]);

    const results = await User.find({
      id: { $ne: req.user.id },
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ]
    })
    .select('id username displayName avatar isEmailVerified status')
    .limit(30)
    .lean();

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update Profile (DP / Avatar, Display Name, Status/Bio, Privacy)
router.put('/profile', authMiddleware, async (req, res) => {
  const { displayName, avatar, status, hideReadReceipts } = req.body;
  const updates = {};
  if (displayName) updates.displayName = displayName;
  if (avatar) updates.avatar = avatar;
  if (status !== undefined) updates.status = status;
  if (hideReadReceipts !== undefined) updates.hideReadReceipts = Boolean(hideReadReceipts);

  const updatedUser = await db.updateUser(req.user.id, updates);
  if (!updatedUser) return res.status(404).json({ error: 'User not found' });

  const { passwordHash, ...userWithoutPass } = updatedUser;
  res.json({ user: userWithoutPass });
});

// Update Privacy (Hide Read Receipts / Unseen Mode)
router.put('/privacy', authMiddleware, async (req, res) => {
  try {
    const { hideReadReceipts } = req.body;
    const updates = {};
    if (hideReadReceipts !== undefined) updates.hideReadReceipts = Boolean(hideReadReceipts);

    const updatedUser = await db.updateUser(req.user.id, updates);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...userWithoutPass } = updatedUser;
    res.json({ user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Block User
router.post('/block/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    const blocked = await db.blockUser(req.user.id, targetId);
    res.json({ success: true, blockedUsers: blocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock User
router.post('/unblock/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    const blocked = await db.unblockUser(req.user.id, targetId);
    res.json({ success: true, blockedUsers: blocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get List of Blocked Users
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const list = await db.getBlockedUsers(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Check Block Status with Target User
router.get('/:id/block-status', authMiddleware, async (req, res) => {
  try {
    const status = await db.isUserBlocked(req.user.id, req.params.id);
    res.json({
      isBlocked: status.isBlocked,
      isBlockedByMe: status.aBlockedB,
      isBlockedByThem: status.bBlockedA
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

// Change Password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const bcrypt = require('bcryptjs');
    const User = require('../models/User');
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = newHash;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Get VAPID Public Key for Web Push subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: webpush.getVapidPublicKey() });
});

// Save or Update Push Subscription for current user
router.post('/push-subscription', authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid push subscription data' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let subscriptions = user.pushSubscriptions || [];
    // Avoid duplicate endpoints
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    subscriptions.push({ endpoint, keys });

    user.pushSubscriptions = subscriptions;
    user.markModified('pushSubscriptions');
    await user.save();

    res.json({ success: true, count: subscriptions.length });
  } catch (err) {
    console.error('Failed to save push subscription:', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Unsubscribe from Web Push
router.delete('/push-subscription', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findOne({ id: req.user.id });
    if (user && user.pushSubscriptions) {
      user.pushSubscriptions = user.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
      user.markModified('pushSubscriptions');
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove push subscription:', err);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

// Get User Profile by ID (instant index lookup)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const target = await User.findOne({ id: req.params.id })
      .select('-passwordHash -friends -otpCode -otpExpires -pushSubscriptions')
      .lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
