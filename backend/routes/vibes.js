const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const Vibe = require('../models/Vibe');
const User = require('../models/User');
const SparksTransaction = require('../models/SparksTransaction');

// Create a new 24-hour Vibe Story
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      id,
      mediaUrl, mediaType, caption, soundtrack, songTitle, artistName, albumArt, audioUrl, youtubeId, songStartTime,
      storyDuration, bgGradient, textStyle3D, animatedBg, textPos, musicPos, imagePos, imageFit, imageZoom,
      imageFilter, imageOpacity, textSize, textAlign, selectedStickers,
      musicScale, musicStyle, stickersData
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

    if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('blob:')) {
      return res.status(400).json({ error: 'Local blob URLs cannot be saved as media. Please ensure cloud upload completes.' });
    }

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
      mediaType: mediaType || (mediaUrl && (mediaUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i) || mediaUrl.includes('/video/')) ? 'video' : 'image'),
      caption: caption || '',
      soundtrack: soundtrack || (audioUrl || youtubeId ? 'music_track' : 'lofi'),
      songTitle: songTitle || '',
      artistName: artistName || '',
      albumArt: albumArt || '',
      audioUrl: audioUrl || '',
      youtubeId: youtubeId || '',
      songStartTime: parseInt(songStartTime, 10) || 0,
      storyDuration: parseInt(storyDuration, 10) || 15,
      bgGradient: bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      textStyle3D: textStyle3D || 'none',
      animatedBg: animatedBg || 'none',
      textPos: textPos || { x: 50, y: 50 },
      musicPos: musicPos || { x: 20, y: 15 },
      musicScale: Number(musicScale) || 1.0,
      musicStyle: musicStyle || 'pill',
      imagePos: imagePos || { x: 50, y: 50 },
      imageFit: imageFit || 'contain',
      imageZoom: imageZoom || 1.0,
      imageFilter: imageFilter || 'none',
      imageOpacity: imageOpacity !== undefined ? imageOpacity : 0.92,
      textSize: textSize || 1.2,
      textAlign: textAlign || 'center',
      selectedStickers: Array.isArray(selectedStickers) ? selectedStickers : [],
      stickersData: Array.isArray(stickersData) ? stickersData : [],
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
      }).select('id _id username displayName avatar hasKingCrown hasSilverCrown hasStreakCrown musicNote').lean();

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
          musicNote: matchedUser?.musicNote || null,
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

      const io = req.app.get('io');
      if (io) {
        io.emit('vibe_view_updated', {
          vibeId: vibe.id,
          authorId: vibe.userId,
          viewsCount: vibe.views.length,
          views: vibe.views
        });
      }
    }

    res.json({ success: true, viewsCount: vibe.views.length, views: vibe.views });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Fetch detailed view list and engagement for a Vibe Story (Author only or viewers)
router.get('/views/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const vibe = await Vibe.findOne({ id: vibeId }).lean();
    if (!vibe) return res.status(404).json({ error: 'Story not found' });
    res.json({
      success: true,
      views: vibe.views || [],
      viewsCount: (vibe.views || []).length,
      likes: vibe.likes || [],
      likesCount: (vibe.likes || []).length,
      reactions: vibe.reactions || [],
      replies: vibe.replies || [],
      sparksEarned: vibe.sparksEarned || 0,
      createdAt: vibe.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch views' });
  }
});

// Instagram-Style Story Like & Unlike Toggle
router.post('/like/:vibeId', authMiddleware, async (req, res) => {
  try {
    const { vibeId } = req.params;
    const targetUserId = req.userId || req.user?.id || req.user?.userId;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);

    const sender = await User.findOne({
      $or: [
        { id: targetUserId },
        ...(isObjectId ? [{ _id: targetUserId }] : []),
        { username: targetUserId }
      ]
    }).lean();

    if (!sender) return res.status(404).json({ error: 'User not found' });

    const vibe = await Vibe.findOne({ id: vibeId });
    if (!vibe) return res.status(404).json({ error: 'Story not found' });

    const resolvedSenderId = sender.id || (sender._id ? sender._id.toString() : targetUserId);

    if (!Array.isArray(vibe.likes)) {
      vibe.likes = [];
    }

    const existingIndex = vibe.likes.findIndex(l => l.userId === resolvedSenderId);
    let isLiked = false;

    if (existingIndex > -1) {
      // Unlike
      vibe.likes.splice(existingIndex, 1);
      isLiked = false;
    } else {
      // Like
      vibe.likes.push({
        userId: resolvedSenderId,
        displayName: sender.displayName || sender.username || 'Pulse User',
        username: sender.username || '',
        avatar: sender.avatar || '',
        likedAt: new Date()
      });
      isLiked = true;

      // Ensure user is recorded in views if not already
      if (!Array.isArray(vibe.views)) vibe.views = [];
      if (!vibe.views.some(v => v.userId === resolvedSenderId)) {
        vibe.views.push({
          userId: resolvedSenderId,
          displayName: sender.displayName || sender.username || 'Pulse User',
          username: sender.username || '',
          avatar: sender.avatar || '',
          viewedAt: new Date()
        });
      }
    }

    await vibe.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('vibe_like_updated', {
        vibeId: vibe.id,
        authorId: vibe.userId,
        likesCount: vibe.likes.length,
        likes: vibe.likes,
        userId: resolvedSenderId,
        isLiked
      });

      // Real-time toast notification to author if someone liked their story
      if (isLiked && vibe.userId !== resolvedSenderId) {
        io.to(`user_${vibe.userId}`).emit('vibe_activity_notification', {
          type: 'like',
          vibeId: vibe.id,
          user: {
            userId: resolvedSenderId,
            displayName: sender.displayName || sender.username || 'Pulse User',
            username: sender.username || '',
            avatar: sender.avatar || ''
          },
          text: 'liked your story ❤️'
        });
      }
    }

    res.json({
      success: true,
      isLiked,
      likesCount: vibe.likes.length,
      likes: vibe.likes
    });
  } catch (err) {
    console.error('Error toggling like on vibe:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
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

    // Enforce friendship: Only synced friends can react, reply, or tip sparks on stories
    const isOwnStory = vibe.userId === resolvedSenderId ||
      (sender._id && vibe.userId === sender._id.toString()) ||
      (sender.username && vibe.userId === sender.username);

    if (!isOwnStory) {
      const authorUser = await User.findOne({
        $or: [
          { id: vibe.userId },
          ...(mongoose.Types.ObjectId.isValid(vibe.userId) ? [{ _id: vibe.userId }] : []),
          { username: vibe.userId }
        ]
      });

      if (authorUser) {
        const authorIds = [authorUser.id, authorUser._id?.toString(), authorUser.username, vibe.userId].filter(Boolean);
        const senderIds = [resolvedSenderId, sender.id, sender._id?.toString(), sender.username].filter(Boolean);
        const isFriend = sender.friends?.some(f => authorIds.includes(f)) || authorUser.friends?.some(f => senderIds.includes(f));
        if (!isFriend) {
          return res.status(403).json({ error: 'You can only react, reply or send sparks to stories from synced friends.' });
        }
      }
    }

    if (emoji) {
      if (!Array.isArray(vibe.reactions)) vibe.reactions = [];
      vibe.reactions.push({
        userId: resolvedSenderId,
        emoji,
        timestamp: new Date()
      });
    }

    if (!Array.isArray(vibe.replies)) vibe.replies = [];
    if (replyText || emoji || (tipSparks && Number(tipSparks) > 0)) {
      vibe.replies.push({
        id: 'reply_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        userId: resolvedSenderId,
        displayName: sender.displayName || sender.username || 'Pulse User',
        username: sender.username || '',
        avatar: sender.avatar || '',
        text: replyText ? replyText.trim() : '',
        emoji: emoji || '',
        tipSparks: (tipSparks && Number(tipSparks) > 0) ? Number(tipSparks) : 0,
        createdAt: new Date()
      });
    }

    if (tipSparks && Number(tipSparks) > 0) {
      const sparkAmount = Math.max(1, Math.floor(Number(tipSparks)));

      // Self-tipping check
      if (vibe.userId === resolvedSenderId || (sender._id && vibe.userId === sender._id.toString())) {
        return res.status(400).json({ error: 'You cannot send Sparks to your own story' });
      }

      const senderCurrentSparks = typeof sender.pulseSparks === 'number' ? sender.pulseSparks : 50;
      if (senderCurrentSparks < sparkAmount) {
        return res.status(400).json({
          error: `Insufficient Sparks balance. You have ${senderCurrentSparks} Sparks, need ${sparkAmount}.`,
          required: sparkAmount,
          balance: senderCurrentSparks
        });
      }

      // 1. Deduct from Sender
      const senderNewBalance = Math.max(0, senderCurrentSparks - sparkAmount);
      sender.pulseSparks = senderNewBalance;
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
      ).select('id _id username displayName avatar pulseSparks').lean();

      const canonicalAuthorId = updatedAuthor
        ? (updatedAuthor.id || updatedAuthor._id?.toString())
        : vibe.userId;

      // 3. Record Sparks Ledger History for Both Parties
      try {
        // Sender Debit Transaction
        await SparksTransaction.create({
          userId: resolvedSenderId,
          type: 'debit',
          amount: sparkAmount,
          reason: 'story_tip_sent',
          title: `Tipped @${vibe.username || 'user'}'s Story`,
          description: `Sent ⚡ ${sparkAmount} Sparks on story`,
          relatedUserId: canonicalAuthorId,
          relatedUserName: updatedAuthor?.displayName || updatedAuthor?.username || vibe.username || 'User',
          balanceAfter: senderNewBalance,
          metadata: { vibeId: vibe.id, mediaUrl: vibe.mediaUrl }
        });

        // Author Credit Transaction
        if (updatedAuthor) {
          await SparksTransaction.create({
            userId: canonicalAuthorId,
            type: 'credit',
            amount: sparkAmount,
            reason: 'story_tip_received',
            title: `Received Story Tip from @${sender.username || 'user'}`,
            description: `Received ⚡ ${sparkAmount} Sparks on your story`,
            relatedUserId: resolvedSenderId,
            relatedUserName: sender.displayName || sender.username || 'User',
            balanceAfter: updatedAuthor.pulseSparks,
            metadata: { vibeId: vibe.id, mediaUrl: vibe.mediaUrl }
          });
        }
      } catch (txErr) {
        console.warn('Failed to record SparksTransaction for story tip:', txErr);
      }

      // 4. Broadcast real-time profile and sparks updates to Both Users
      const io = req.app.get('io');
      if (io) {
        // Update Author
        if (updatedAuthor) {
          io.to(`user_${canonicalAuthorId}`).emit('sparks_updated', {
            pulseSparks: updatedAuthor.pulseSparks,
            addedAmount: sparkAmount,
            type: 'credit',
            title: `⚡ Received ${sparkAmount} Sparks from @${sender.username || 'user'}!`
          });
          io.to(`user_${canonicalAuthorId}`).emit('user_profile_updated', {
            userId: canonicalAuthorId,
            userMongoId: updatedAuthor._id ? updatedAuthor._id.toString() : null,
            pulseSparks: updatedAuthor.pulseSparks
          });
        }

        // Update Sender
        io.to(`user_${resolvedSenderId}`).emit('sparks_updated', {
          pulseSparks: senderNewBalance,
          deductedAmount: sparkAmount,
          type: 'debit',
          title: `⚡ Sent ${sparkAmount} Sparks to @${vibe.username || 'user'}`
        });
        io.to(`user_${resolvedSenderId}`).emit('user_profile_updated', {
          userId: resolvedSenderId,
          pulseSparks: senderNewBalance
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
        const storyReplyData = {
          storyId: vibe.id,
          mediaUrl: vibe.mediaUrl || null,
          mediaType: vibe.mediaUrl ? (vibe.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') : 'text',
          caption: vibe.caption || '',
          bgGradient: vibe.bgGradient || null,
          audioUrl: vibe.audioUrl || null,
          songTitle: vibe.songTitle || '',
          artistName: vibe.artistName || '',
          authorId: storyAuthorId,
          authorName: authorUser?.displayName || authorUser?.username || vibe.displayName || 'Pulse User',
          authorAvatar: authorUser?.avatar || vibe.avatar || '',
          reactionEmoji: emoji || null,
          replyText: replyText ? replyText.trim() : null,
          tipSparks: tipSparks > 0 ? Number(tipSparks) : 0,
          createdAt: vibe.createdAt ? new Date(vibe.createdAt).toISOString() : new Date().toISOString()
        };

        createdMsg = {
          id: 'msg_vibe_' + Date.now(),
          chatId,
          senderId: resolvedSenderId,
          receiverId: storyAuthorId,
          isGroup: false,
          content: msgText,
          type: 'story_reply',
          storyReply: storyReplyData,
          status: 'sent',
          timestamp: new Date().toISOString()
        };

        await db.saveMessage(createdMsg);

        try {
          const redis = require('../utils/redis');
          if (redis) {
            redis.invalidateRecent(resolvedSenderId).catch(() => {});
            redis.invalidateRecent(storyAuthorId).catch(() => {});
          }
        } catch (e) {}

        const io = req.app.get('io');
        if (io) {
          io.to(chatId).emit('new_message', createdMsg);
          io.to(`user_${storyAuthorId}`).emit('new_message', createdMsg);
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
