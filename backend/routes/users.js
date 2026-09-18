const express = require('express');
const router = express.Router();
const db = require('../database/db');
const User = require('../models/User');
const webpush = require('../utils/webpush');
const authMiddleware = require('../middleware/authMiddleware');

// Get all registered users (except current user)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await db.getUsers();
    const results = users
      .filter(u => u.id !== req.user.id)
      .map(({ passwordHash, ...u }) => u);
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

// Search users by Name or @username
router.get('/search', authMiddleware, async (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim().replace(/^@/, '');
  if (!query) return res.json([]); // don't list everyone when there's no search term

  const users = await db.getUsers();

  const results = users
    .filter(u => u.id !== req.user.id && (u.username.includes(query) || u.displayName.toLowerCase().includes(query)))
    .map(({ passwordHash, ...u }) => u);

  res.json(results);
});

// Update Profile (DP / Avatar, Display Name, Status/Bio)
router.put('/profile', authMiddleware, async (req, res) => {
  const { displayName, avatar, status } = req.body;
  const updates = {};
  if (displayName) updates.displayName = displayName;
  if (avatar) updates.avatar = avatar;
  if (status !== undefined) updates.status = status;

  const updatedUser = await db.updateUser(req.user.id, updates);
  if (!updatedUser) return res.status(404).json({ error: 'User not found' });

  const { passwordHash, ...userWithoutPass } = updatedUser;
  res.json({ user: userWithoutPass });
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

// Get User Profile by ID
router.get('/:id', authMiddleware, async (req, res) => {
  const users = await db.getUsers();
  const target = users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safeUser } = target;
  res.json(safeUser);
});

module.exports = router;
