const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');
const Vibe = require('../models/Vibe');
const User = require('../models/User');

// Create a new 24-hour Vibe Story
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { mediaUrl, caption, soundtrack, bgGradient } = req.body;
    const isObjectId = mongoose.Types.ObjectId.isValid(req.userId);

    const user = await User.findOne({
      $or: [
        { id: req.userId },
        ...(isObjectId ? [{ _id: req.userId }] : []),
        { username: req.userId }
      ]
    }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resolvedUserId = user.id || (user._id ? user._id.toString() : req.userId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const vibeId = 'vibe_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const newVibe = await Vibe.create({
      id: vibeId,
      userId: resolvedUserId,
      username: user.username || '',
      displayName: user.displayName || user.name || user.username || 'Pulse User',
      avatar: user.avatar || '',
      mediaUrl: mediaUrl || null,
      caption: caption || '',
      soundtrack: soundtrack || 'lofi',
      bgGradient: bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      expiresAt
    });

    // Real-time broadcast to ALL connected users via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('new_vibe_posted', {
        userId: resolvedUserId,
        displayName: user.displayName || user.username || 'Pulse User',
        username: user.username || '',
        avatar: user.avatar || '',
        vibe: newVibe
      });
    }

    res.json({ success: true, vibe: newVibe });
  } catch (err) {
    console.error('Error creating vibe:', err);
    res.status(500).json({ error: 'Failed to create Vibe Story' });
  }
});

// Fetch all active 24-hour Vibe stories grouped by user
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeVibes = await Vibe.find({
      $or: [
        { expiresAt: { $gt: now } },
        { createdAt: { $gt: twentyFourHoursAgo } }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    // Group stories by userId
    const groupedMap = new Map();
    activeVibes.forEach(v => {
      const uKey = v.userId || (v.username ? `user_${v.username}` : 'unknown_user');
      if (!groupedMap.has(uKey)) {
        groupedMap.set(uKey, {
          userId: uKey,
          displayName: v.displayName || v.username || 'Pulse User',
          username: v.username || '',
          avatar: v.avatar || '',
          vibes: []
        });
      }
      groupedMap.get(uKey).vibes.push(v);
    });

    const result = Array.from(groupedMap.values());
    res.json(result);
  } catch (err) {
    console.error('Error fetching active vibes:', err);
    res.status(500).json({ error: 'Failed to fetch Vibe Stories' });
  }
});

// Fetch active vibes for a specific user ID or username
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);

    const user = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).lean();

    const searchIds = [
      userId,
      ...(user ? [user.id, user._id?.toString(), user.username] : [])
    ].filter(Boolean);

    const vibes = await Vibe.find({
      userId: { $in: searchIds },
      $or: [
        { expiresAt: { $gt: now } },
        { createdAt: { $gt: twentyFourHoursAgo } }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.json({
      userId: user?.id || userId,
      displayName: user?.displayName || user?.username || 'User',
      username: user?.username || '',
      avatar: user?.avatar || '',
      vibes
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user vibes' });
  }
});

// Mark a Vibe Story as viewed by current user
router.post('/view/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(req.userId);
    const user = await User.findOne({
      $or: [
        { id: req.userId },
        ...(isObjectId ? [{ _id: req.userId }] : []),
        { username: req.userId }
      ]
    }).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const resolvedUserId = user.id || (user._id ? user._id.toString() : req.userId);
    const alreadyViewed = vibe.views.some(v => v.userId === resolvedUserId);
    if (!alreadyViewed) {
      vibe.views.push({
        userId: resolvedUserId,
        displayName: user.displayName || user.username,
        avatar: user.avatar || ''
      });
      await vibe.save();
    }

    res.json({ success: true, viewsCount: vibe.views.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// React emoji or tip Sparks on a Vibe Story
router.post('/react/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const { emoji, tipSparks } = req.body;
    const isObjectId = mongoose.Types.ObjectId.isValid(req.userId);

    const sender = await User.findOne({
      $or: [
        { id: req.userId },
        ...(isObjectId ? [{ _id: req.userId }] : []),
        { username: req.userId }
      ]
    });

    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const resolvedSenderId = sender.id || (sender._id ? sender._id.toString() : req.userId);

    if (emoji) {
      vibe.reactions.push({
        userId: resolvedSenderId,
        emoji,
        timestamp: new Date()
      });
    }

    // Tip Sparks if requested
    if (tipSparks && Number(tipSparks) > 0) {
      const sparkAmount = Number(tipSparks);
      if ((sender.pulseSparks || 0) < sparkAmount) {
        return res.status(400).json({ error: 'Not enough Sparks balance' });
      }

      sender.pulseSparks = (sender.pulseSparks || 0) - sparkAmount;
      await sender.save();

      vibe.sparksEarned = (vibe.sparksEarned || 0) + sparkAmount;

      // Credit story creator
      await User.findOneAndUpdate(
        { $or: [{ id: vibe.userId }, { username: vibe.username }] },
        { $inc: { pulseSparks: sparkAmount } }
      );
    }

    await vibe.save();
    res.json({ success: true, reactions: vibe.reactions, sparksEarned: vibe.sparksEarned, remainingSparks: sender.pulseSparks });
  } catch (err) {
    console.error('Error reacting to vibe:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Delete own Vibe Story
router.delete('/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    await Vibe.deleteOne({ id: vibeId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
