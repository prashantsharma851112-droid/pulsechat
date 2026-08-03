const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

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

// Get User Profile by ID
router.get('/:id', authMiddleware, async (req, res) => {
  const users = await db.getUsers();
  const target = users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safeUser } = target;
  res.json(safeUser);
});

module.exports = router;
