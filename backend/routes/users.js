const express = require('express');
const router = express.Router();
const db = require('../database/db');
const User = require('../models/User');
const webpush = require('../utils/webpush');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Get all registered users (newest users first, up to 200)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const results = await User.find({ id: { $ne: req.user.id } })
      .sort({ createdAt: -1, _id: -1 })
      .select('id username displayName avatar isEmailVerified status email createdAt')
      .limit(200)
      .lean();
    res.json(results);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Persistent conversation list (shown by default in the sidebar) - includes
// anyone who has messaged you OR whom you've messaged, even without a search
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const conversations = await db.getRecentConversations(req.user.id);
    res.json(conversations);
  } catch (err) {
    console.error('Error in /recent route:', err);
    res.json([]);
  }
});

// Search users by Name, @username, or Email (instant indexed regex lookup with regex escaping)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const rawQuery = (req.query.q || '').trim();
    const query = rawQuery.toLowerCase().replace(/^@/, '');
    if (!query) return res.json([]);

    // Escape any regex special characters to prevent syntax errors
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const results = await User.find({
      id: { $ne: req.user.id },
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { displayName: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1, _id: -1 })
    .select('id username displayName avatar isEmailVerified status email createdAt')
    .limit(50)
    .lean();

    res.json(results);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update Profile (DP / Avatar, Display Name, Status/Bio, Privacy)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, avatar, status, hideReadReceipts } = req.body;
    const updates = {};
    if (displayName) updates.displayName = displayName.trim();
    if (avatar !== undefined) {
      if (avatar && typeof avatar === 'string' && avatar.startsWith('data:')) {
        updates.avatar = await uploadToCloudinary(avatar, 'pulsechat_avatars', 'image');
      } else {
        updates.avatar = avatar;
      }
    }
    if (status !== undefined) updates.status = status.trim();
    if (hideReadReceipts !== undefined) updates.hideReadReceipts = Boolean(hideReadReceipts);

    const updatedUser = await db.updateUser(req.user.id, updates);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...userWithoutPass } = updatedUser;

    // Broadcast profile update in real time to all connected users
    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: userWithoutPass.id,
        userMongoId: userWithoutPass._id ? userWithoutPass._id.toString() : null,
        username: userWithoutPass.username,
        displayName: userWithoutPass.displayName,
        avatar: userWithoutPass.avatar,
        status: userWithoutPass.status
      });
    }

    res.json({ user: userWithoutPass });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
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

// Get Specific User Profile by ID or username
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(targetId);
    const targetUser = await User.findOne({
      $or: [
        { id: targetId },
        ...(isObjectId ? [{ _id: targetId }] : []),
        { username: targetId }
      ]
    }).select('id username displayName avatar isEmailVerified status createdAt').lean();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(targetUser);
  } catch (err) {
    console.error('Fetch user by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
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
