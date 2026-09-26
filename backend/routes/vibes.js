const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Vibe = require('../models/Vibe');
const User = require('../models/User');

// Create a new 24-hour Vibe Story
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { mediaUrl, caption, soundtrack, bgGradient } = req.body;
    const user = await User.findOne({ id: req.userId }).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const vibeId = 'vibe_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const newVibe = await Vibe.create({
      id: vibeId,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.name || user.username,
      avatar: user.avatar || '',
      mediaUrl: mediaUrl || null,
      caption: caption || '',
      soundtrack: soundtrack || 'lofi',
      bgGradient: bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      expiresAt
    });

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
    const activeVibes = await Vibe.find({ expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .lean();

    // Group stories by userId
    const groupedMap = new Map();
    activeVibes.forEach(v => {
      if (!groupedMap.has(v.userId)) {
        groupedMap.set(v.userId, {
          userId: v.userId,
          displayName: v.displayName,
          username: v.username,
          avatar: v.avatar,
          vibes: []
        });
      }
      groupedMap.get(v.userId).vibes.push(v);
    });

    const result = Array.from(groupedMap.values());
    res.json(result);
  } catch (err) {
    console.error('Error fetching active vibes:', err);
    res.status(500).json({ error: 'Failed to fetch Vibe Stories' });
  }
});

// Mark a Vibe Story as viewed by current user
router.post('/view/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const user = await User.findOne({ id: req.userId }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const alreadyViewed = vibe.views.some(v => v.userId === user.id);
    if (!alreadyViewed) {
      vibe.views.push({
        userId: user.id,
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
    const sender = await User.findOne({ id: req.userId });
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    if (emoji) {
      vibe.reactions.push({
        userId: sender.id,
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
        { id: vibe.userId },
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
    await Vibe.deleteOne({ id: vibeId, userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
