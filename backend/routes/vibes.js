const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const Vibe = require('../models/Vibe');
const User = require('../models/User');

// Create a new 24-hour Vibe Story
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      id,
      mediaUrl, caption, soundtrack, songTitle, artistName, albumArt, audioUrl, youtubeId, songStartTime,
      bgGradient, textStyle3D, animatedBg, textPos, musicPos, imagePos, imageFit, imageZoom,
      imageFilter, imageOpacity, textSize, textAlign, selectedStickers
    } = req.body;
    const targetUserId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);

    const user = await User.findOne({
      $or: [
        { id: targetUserId },
        ...(isObjectId ? [{ _id: targetUserId }] : []),
        { username: targetUserId }
      ]
    }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resolvedUserId = user.id || (user._id ? user._id.toString() : targetUserId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const vibeId = id || ('vibe_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    // Duplicate guard: prevent duplicate submission within 15s
    const existingRecent = await Vibe.findOne({
      userId: resolvedUserId,
      $or: [
        { id: vibeId },
        {
          createdAt: { $gt: new Date(Date.now() - 15000) },
          caption: (caption || '').trim(),
          mediaUrl: mediaUrl || null
        }
      ]
    }).lean();

    if (existingRecent) {
      return res.json({ success: true, vibe: existingRecent });
    }

    const newVibe = await Vibe.create({
      id: vibeId,
      userId: resolvedUserId,
      username: user.username || '',
      displayName: user.displayName || user.name || user.username || 'Pulse User',
      avatar: user.avatar || '',
      mediaUrl: mediaUrl || null,
      caption: caption || '',
      soundtrack: soundtrack || (audioUrl || youtubeId ? 'music_track' : 'lofi'),
      songTitle: songTitle || '',
      artistName: artistName || '',
      albumArt: albumArt || '',
      audioUrl: audioUrl || '',
      youtubeId: youtubeId || '',
      songStartTime: parseInt(songStartTime, 10) || 0,
      bgGradient: bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      textStyle3D: textStyle3D || 'none',
      animatedBg: animatedBg || 'none',
      textPos: textPos || { x: 50, y: 50 },
      musicPos: musicPos || { x: 20, y: 15 },
      imagePos: imagePos || { x: 50, y: 50 },
      imageFit: imageFit || 'contain',
      imageZoom: imageZoom || 1.0,
      imageFilter: imageFilter || 'none',
      imageOpacity: imageOpacity !== undefined ? imageOpacity : 0.92,
      textSize: textSize || 1.2,
      textAlign: textAlign || 'center',
      selectedStickers: Array.isArray(selectedStickers) ? selectedStickers : [],
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

    // Collect all user IDs/usernames to populate crown status & fresh avatar
    const uKeys = activeVibes.map(v => v.userId).filter(Boolean);
    const uNames = activeVibes.map(v => v.username).filter(Boolean);

    const usersMap = new Map();
    if (uKeys.length > 0 || uNames.length > 0) {
      const users = await User.find({
        $or: [
          { id: { $in: uKeys } },
          { username: { $in: uNames } }
        ]
      }).select('id _id username displayName avatar hasKingCrown hasSilverCrown hasStreakCrown').lean();

      users.forEach(u => {
        if (u.id) usersMap.set(u.id, u);
        if (u._id) usersMap.set(u._id.toString(), u);
        if (u.username) usersMap.set(u.username, u);
      });
    }

    // Group stories by userId and strictly deduplicate & sort
    const groupedMap = new Map();
    activeVibes.forEach(v => {
      const uKey = v.userId || (v.username ? `user_${v.username}` : 'unknown_user');
      const matchedUser = usersMap.get(v.userId) || usersMap.get(v.username);

      if (!groupedMap.has(uKey)) {
        groupedMap.set(uKey, {
          userId: uKey,
          displayName: matchedUser?.displayName || v.displayName || v.username || 'Pulse User',
          username: matchedUser?.username || v.username || '',
          avatar: matchedUser?.avatar || v.avatar || '',
          hasKingCrown: Boolean(matchedUser?.hasKingCrown),
          hasSilverCrown: Boolean(matchedUser?.hasSilverCrown),
          hasStreakCrown: Boolean(matchedUser?.hasStreakCrown),
          vibes: []
        });
      }

      const existingInGroup = groupedMap.get(uKey).vibes.some(ev => 
        ev.id === v.id ||
        (ev.caption === v.caption && ev.mediaUrl === v.mediaUrl && Math.abs(new Date(ev.createdAt).getTime() - new Date(v.createdAt).getTime()) < 20000)
      );

      if (!existingInGroup) {
        groupedMap.get(uKey).vibes.push(v);
      }
    });

    // Ensure vibes for every user are sorted: newest first (jo new lagaya vo aage), oldest last (jo pehle lagaya tha vo last)
    groupedMap.forEach(grp => {
      grp.vibes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    const result = Array.from(groupedMap.values()).filter(g => g.vibes && g.vibes.length > 0);
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

    // Deduplicate and sort newest first
    const seen = new Set();
    const cleanVibes = [];
    vibes.forEach(v => {
      const contentKey = `${v.caption || ''}_${v.mediaUrl || ''}_${Math.floor(new Date(v.createdAt).getTime() / 20000)}`;
      if (!seen.has(v.id) && !seen.has(contentKey)) {
        seen.add(v.id);
        seen.add(contentKey);
        cleanVibes.push(v);
      }
    });
    cleanVibes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      userId: user?.id || userId,
      displayName: user?.displayName || user?.username || 'User',
      username: user?.username || '',
      avatar: user?.avatar || '',
      vibes: cleanVibes
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user vibes' });
  }
});

// Mark a Vibe Story as viewed by current user
router.post('/view/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const targetUserId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
    const user = await User.findOne({
      $or: [
        { id: targetUserId },
        ...(isObjectId ? [{ _id: targetUserId }] : []),
        { username: targetUserId }
      ]
    }).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const resolvedUserId = user.id || (user._id ? user._id.toString() : targetUserId);
    const alreadyViewed = vibe.views.some(v => v.userId === resolvedUserId);
    if (!alreadyViewed) {
      vibe.views.push({
        userId: resolvedUserId,
        displayName: user.displayName || user.username || 'Pulse User',
        username: user.username || '',
        avatar: user.avatar || '',
        viewedAt: new Date()
      });
      await vibe.save();
    }

    res.json({ success: true, viewsCount: vibe.views.length, views: vibe.views });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Fetch detailed view list for a Vibe Story (Author only or viewers)
router.get('/views/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const vibe = await Vibe.findOne({ id: vibeId }).lean();
    if (!vibe) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, views: vibe.views || [], viewsCount: (vibe.views || []).length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch views' });
  }
});

// React emoji, send text reply, or tip Sparks on a Vibe Story (sends DM to author)
router.post('/react/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const { emoji, tipSparks, replyText } = req.body;
    const targetUserId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);

    const sender = await User.findOne({
      $or: [
        { id: targetUserId },
        ...(isObjectId ? [{ _id: targetUserId }] : []),
        { username: targetUserId }
      ]
    });

    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const resolvedSenderId = sender.id || (sender._id ? sender._id.toString() : targetUserId);

    if (emoji) {
      vibe.reactions.push({
        userId: resolvedSenderId,
        emoji,
        timestamp: new Date()
      });
    }

    if (tipSparks && Number(tipSparks) > 0) {
      const sparkAmount = Number(tipSparks);
      if ((sender.pulseSparks || 0) < sparkAmount) {
        return res.status(400).json({ error: 'Not enough Sparks balance' });
      }

      // 1. Deduct from Sender
      sender.pulseSparks = Math.max(0, (sender.pulseSparks || 0) - sparkAmount);
      await sender.save();

      vibe.sparksEarned = (vibe.sparksEarned || 0) + sparkAmount;

      // 2. Add / Credit to Story Author in MongoDB
      const authorObjectId = mongoose.Types.ObjectId.isValid(vibe.userId);
      const updatedAuthor = await User.findOneAndUpdate(
        {
          $or: [
            { id: vibe.userId },
            ...(authorObjectId ? [{ _id: vibe.userId }] : []),
            { username: vibe.username }
          ]
        },
        { $inc: { pulseSparks: sparkAmount } },
        { new: true }
      ).select('id _id username pulseSparks').lean();

      // 3. Broadcast real-time profile update to Author's socket room
      const io = req.app.get('io');
      if (io && updatedAuthor) {
        const canonicalAuthorId = updatedAuthor.id || updatedAuthor._id?.toString();
        io.to(`user_${canonicalAuthorId}`).emit('user_profile_updated', {
          userId: canonicalAuthorId,
          userMongoId: updatedAuthor._id ? updatedAuthor._id.toString() : null,
          pulseSparks: updatedAuthor.pulseSparks
        });
      }
    }

    await vibe.save();

    // Automatically send Direct Message to Story Author in Chat (WhatsApp / Insta style)
    let createdMsg = null;
    let storyAuthorId = vibe.userId;

    // Resolve canonical user ID for story author to guarantee exact chatId matching
    const authorUser = await User.findOne({
      $or: [
        { id: vibe.userId },
        { username: vibe.username },
        ...(mongoose.Types.ObjectId.isValid(vibe.userId) ? [{ _id: vibe.userId }] : [])
      ]
    }).select('id username').lean();

    if (authorUser && authorUser.id) {
      storyAuthorId = authorUser.id;
    }

    if (storyAuthorId && storyAuthorId !== resolvedSenderId) {
      const db = require('../database/db');
      const chatId = [resolvedSenderId, storyAuthorId].sort().join('_');

      let msgText = '';
      if (replyText && replyText.trim()) {
        msgText = `Replied to your story: "${replyText.trim()}"`;
      } else if (tipSparks > 0) {
        msgText = `Tipped ⚡ ${tipSparks} Sparks on your story!`;
      } else if (emoji) {
        msgText = `Reacted ${emoji} to your story`;
      }

      if (msgText) {
        createdMsg = {
          id: 'msg_vibe_' + Date.now(),
          chatId,
          senderId: resolvedSenderId,
          receiverId: storyAuthorId,
          isGroup: false,
          content: msgText,
          type: 'text',
          status: 'sent',
          timestamp: new Date().toISOString()
        };

        await db.saveMessage(createdMsg);

        const io = req.app.get('io');
        if (io) {
          io.to(chatId).emit('new_message', createdMsg);
          io.to(`user_${storyAuthorId}`).emit('message_notification', {
            ...createdMsg,
            senderName: sender.displayName || sender.username || 'Pulse User',
            senderAvatar: sender.avatar || null
          });
        }
      }
    }

    res.json({
      success: true,
      reactions: vibe.reactions,
      sparksEarned: vibe.sparksEarned,
      remainingSparks: sender.pulseSparks,
      createdMessage: createdMsg
    });
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
