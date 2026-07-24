const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

// Live Username Availability Check
router.get('/check-username/:username', async (req, res) => {
  const username = req.params.username.toLowerCase().trim();
  const users = await db.getUsers();
  const exists = users.some(u => u.username.toLowerCase() === username);
  res.json({ available: !exists });
});

// Register with Email, Password & Unique @username
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, displayName } = req.body;

    if (!email || !password || !username || !displayName) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    const users = await db.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already registered.' });
    }
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: 'user_' + Date.now(),
      email: email.toLowerCase(),
      username: cleanUsername,
      passwordHash,
      displayName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      status: 'Hey there! I am using PulseChat.',
      createdAt: new Date().toISOString()
    };

    await db.saveUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPass } = newUser;
    res.status(201).json({ token, user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login via Email OR Username + Password
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter Email/Username and Password.' });
    }

    const users = await db.getUsers();
    const cleanId = identifier.toLowerCase().trim().replace(/^@/, '');
    const user = users.find(u => u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId);

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPass } = user;
    res.json({ token, user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Verify Current Session
router.get('/me', authMiddleware, async (req, res) => {
  const users = await db.getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { passwordHash: _, ...userWithoutPass } = user;
  res.json({ user: userWithoutPass });
});

module.exports = router;
