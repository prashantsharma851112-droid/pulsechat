const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');
const mongoose = require('mongoose');

const User = require('../models/User');

const getOtherParticipantId = async (chatId, myUserId) => {
  if (!chatId || !myUserId) return null;
  try {
    const mongoose = require('mongoose');
    const me = await User.findOne({
      $or: [
        { id: myUserId },
        { username: myUserId },
        ...(mongoose.Types.ObjectId.isValid(myUserId) ? [{ _id: myUserId }] : [])
      ]
    }).select('id username _id').lean();
    const myKeys = [myUserId, me?.id, me?.username, me?._id?.toString()].filter(Boolean);

    let otherKey = null;
    for (const m of myKeys) {
      if (chatId.startsWith(m + '_')) {
        otherKey = chatId.slice(m.length + 1);
        break;
      } else if (chatId.endsWith('_' + m)) {
        otherKey = chatId.slice(0, -(m.length + 1));
        break;
      }
    }

    if (!otherKey && chatId.includes('_')) {
      const parts = chatId.split('_');
      otherKey = parts.find(p => !myKeys.includes(p));
    }

    if (otherKey) {
      const other = await User.findOne({
        $or: [
          { id: otherKey },
          { username: otherKey },
          ...(mongoose.Types.ObjectId.isValid(otherKey) ? [{ _id: otherKey }] : [])
        ]
      }).select('id username _id').lean();
      return other?.id || otherKey;
    }
    return null;
  } catch {
    return null;
  }
};

const resolveGhostMode = async (userId, chatId, req) => {
  if (req) {
    if (req.headers && req.headers['x-ghost-mode'] === 'true') return true;
    if (req.query && (req.query.ghost === 'true' || req.query.ghost === '1')) return true;
  }
  if (!userId) return false;
  try {
    const mongoose = require('mongoose');
    const u = await User.findOne({
      $or: [
        { id: userId },
        ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('id username _id hideReadReceipts ghostChats').lean();
    if (!u) return false;
    if (u.hideReadReceipts) return true;

    if (chatId && Array.isArray(u.ghostChats) && u.ghostChats.length > 0) {
      if (u.ghostChats.includes(chatId)) return true;

      const myKeys = [userId, u.id, u.username, u._id?.toString()].filter(Boolean);
      let otherTarget = null;
      for (const mKey of myKeys) {
        if (chatId.startsWith(mKey + '_')) {
          otherTarget = chatId.slice(mKey.length + 1);
          break;
        } else if (chatId.endsWith('_' + mKey)) {
          otherTarget = chatId.slice(0, -(mKey.length + 1));
          break;
        }
      }

      if (otherTarget && u.ghostChats.includes(otherTarget)) {
        return true;
      }

      for (const gId of u.ghostChats) {
        if (!gId) continue;
        const gStr = String(gId);
        if (chatId === gStr) return true;
        if (chatId.startsWith(gStr + '_') || chatId.endsWith('_' + gStr) || chatId.includes('_' + gStr + '_')) {
          return true;
        }
      }

      if (otherTarget) {
        const otherUser = await User.findOne({
          $or: [
            { id: otherTarget },
            { username: otherTarget },
            ...(mongoose.Types.ObjectId.isValid(otherTarget) ? [{ _id: otherTarget }] : [])
          ]
        }).select('id username _id').lean();
        if (otherUser) {
          const otherKeys = [otherUser.id, otherUser.username, otherUser._id?.toString()].filter(Boolean);
          if (otherKeys.some(k => u.ghostChats.includes(k))) {
            return true;
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
};

// Get Chat Settings (Disappearing Messages) - MUST BE BEFORE /:chatId
router.get('/settings/:chatId', authMiddleware, async (req, res) => {
  try {
    const setting = await db.getChatSetting(req.params.chatId);
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat settings' });
  }
});

// Toggle Disappearing Messages (24h) - MUST BE BEFORE /:chatId
router.put('/settings/:chatId/disappearing', authMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    const setting = await db.setDisappearingMessages(req.params.chatId, enabled, req.user.id);

    // Announce via system message
    const sysMsg = {
      id: 'msg_sys_' + Date.now(),
      chatId: req.params.chatId,
      senderId: 'system',
      receiverId: '',
      isGroup: !req.params.chatId.includes('_'),
      type: 'system',
      content: enabled ? '⏱️ Messages in this chat will disappear 24 hours after being sent.' : '⏱️ Disappearing messages was turned off.',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    await db.saveMessage(sysMsg);

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_setting_updated', setting);
      io.to(req.params.chatId).emit('new_message', sysMsg);
      if (req.params.chatId.includes('_')) {
        const parts = req.params.chatId.split('_');
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('chat_setting_updated', setting);
          io.to(`user_${uId}`).emit('new_message', sysMsg);
        });
      }
    }

    res.json({ success: true, setting, systemMessage: sysMsg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update disappearing messages' });
  }
});

// Set Chat Wallpaper (Live Themes or Custom Gallery Wallpapers) - MUST BE BEFORE /:chatId
router.put('/settings/:chatId/wallpaper', authMiddleware, async (req, res) => {
  try {
    const { wallpaperId, customWallpaperUrl } = req.body;
    const setting = await db.setChatWallpaper(req.params.chatId, wallpaperId, customWallpaperUrl, req.user?.id);

    const payload = {
      chatId: setting.chatId,
      originalChatId: req.params.chatId,
      wallpaperId: setting.wallpaperId,
      customWallpaperUrl: setting.customWallpaperUrl,
      customImage: setting.customWallpaperUrl,
      setBy: req.user?.id
    };

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_wallpaper_updated', payload);
      if (setting?.chatId && setting.chatId !== req.params.chatId) {
        io.to(setting.chatId).emit('chat_wallpaper_updated', payload);
      }
      if (req.params.chatId.includes('_')) {
        const parts = req.params.chatId.split('_');
        io.to(`${parts[1]}_${parts[0]}`).emit('chat_wallpaper_updated', payload);
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('chat_wallpaper_updated', payload);
          io.to(uId).emit('chat_wallpaper_updated', payload);
        });
      }
    }

    res.json({ success: true, setting, payload });
  } catch (err) {
    console.error('Failed to update chat wallpaper:', err);
    res.status(500).json({ error: 'Failed to update chat wallpaper' });
  }
});

// Set Chat Theme (Color theme) - MUST BE BEFORE /:chatId
router.put('/settings/:chatId/theme', authMiddleware, async (req, res) => {
  try {
    const { themeId } = req.body;
    const setting = await db.setChatTheme(req.params.chatId, themeId, req.user?.id);

    const payload = {
      chatId: setting?.chatId || req.params.chatId,
      originalChatId: req.params.chatId,
      themeId: setting?.chatTheme || themeId,
      setBy: req.user?.id
    };

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_theme_updated', payload);
      if (setting?.chatId && setting.chatId !== req.params.chatId) {
        io.to(setting.chatId).emit('chat_theme_updated', payload);
      }
      if (req.params.chatId.includes('_')) {
        const parts = req.params.chatId.split('_');
        io.to(`${parts[1]}_${parts[0]}`).emit('chat_theme_updated', payload);
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('chat_theme_updated', payload);
          io.to(uId).emit('chat_theme_updated', payload);
        });
      }
    }

    res.json({ success: true, setting, payload });
  } catch (err) {
    console.error('Failed to update chat theme:', err);
    res.status(500).json({ error: 'Failed to update chat theme' });
  }
});

// Set / Update Nickname for a participant in 1-on-1 chat - MUST BE BEFORE /:chatId
router.put('/settings/:chatId/nickname', authMiddleware, async (req, res) => {
  try {
    const { targetUserId, nickname } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const trimmed = typeof nickname === 'string' ? nickname.trim() : '';
    const setting = await db.setChatNickname(req.params.chatId, targetUserId, trimmed, req.user?.id);

    // Invalidate Redis recent chats cache for participants so fresh nicknames appear
    try {
      const redis = require('../utils/redis');
      const uIds = new Set([
        String(req.user?.id || ''),
        String(req.user?.username || ''),
        String(req.user?._id || ''),
        String(targetUserId)
      ]);
      if (req.params.chatId.includes('_')) {
        req.params.chatId.split('_').forEach(p => uIds.add(String(p)));
      }
      uIds.forEach(uId => {
        if (uId) redis.invalidateRecent(uId).catch(() => {});
      });
    } catch (e) {}

    // Create a system message announcing the change in this chat
    let targetName = 'them';
    try {
      const targetUser = await db.getUserById(targetUserId);
      if (targetUser) targetName = targetUser.displayName || targetUser.username || 'User';
    } catch (e) {}

    const isTargetSelf = String(targetUserId) === String(req.user?.id);
    const actorName = req.user?.displayName || req.user?.username || 'Someone';
    const sysContent = trimmed
      ? (isTargetSelf
          ? `✏️ ${actorName} set their nickname to "${trimmed}"`
          : `✏️ ${actorName} set the nickname for ${targetName} to "${trimmed}"`)
      : (isTargetSelf
          ? `✏️ ${actorName} removed their nickname`
          : `✏️ ${actorName} removed the nickname for ${targetName}`);

    const sysMsg = {
      id: 'msg_sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      chatId: req.params.chatId,
      senderId: 'system',
      receiverId: '',
      isGroup: !req.params.chatId.includes('_'),
      type: 'system',
      content: sysContent,
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    await db.saveMessage(sysMsg);

    const payload = {
      chatId: setting?.chatId || req.params.chatId,
      originalChatId: req.params.chatId,
      targetUserId,
      nickname: trimmed || null,
      nicknames: setting?.nicknames || {},
      updatedBy: req.user?.id,
      systemMessage: sysMsg
    };

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_nickname_updated', payload);
      io.to(req.params.chatId).emit('chat_setting_updated', setting);
      io.to(req.params.chatId).emit('new_message', sysMsg);

      if (setting?.chatId && setting.chatId !== req.params.chatId) {
        io.to(setting.chatId).emit('chat_nickname_updated', payload);
        io.to(setting.chatId).emit('chat_setting_updated', setting);
        io.to(setting.chatId).emit('new_message', sysMsg);
      }

      if (req.params.chatId.includes('_')) {
        const parts = req.params.chatId.split('_');
        io.to(`${parts[1]}_${parts[0]}`).emit('chat_nickname_updated', payload);
        io.to(`${parts[1]}_${parts[0]}`).emit('chat_setting_updated', setting);
        io.to(`${parts[1]}_${parts[0]}`).emit('new_message', sysMsg);

        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('chat_nickname_updated', payload);
          io.to(`user_${uId}`).emit('chat_setting_updated', setting);
          io.to(`user_${uId}`).emit('new_message', sysMsg);
          io.to(uId).emit('chat_nickname_updated', payload);
          io.to(uId).emit('chat_setting_updated', setting);
          io.to(uId).emit('new_message', sysMsg);
        });
      }
    }

    res.json({
      success: true,
      nickname: trimmed || null,
      nicknames: setting?.nicknames || {},
      setting,
      payload,
      systemMessage: sysMsg
    });
  } catch (err) {
    console.error('Failed to update chat nickname:', err);
    res.status(500).json({ error: 'Failed to update chat nickname' });
  }
});

// =========================================================================
// OPTION 1: PULSE STREAKS & FREEZE SHIELDS
// =========================================================================
router.get('/settings/:chatId/streak', authMiddleware, async (req, res) => {
  try {
    const setting = await db.getChatSetting(req.params.chatId);
    const userId = req.user.id;
    let shields = 0;
    if (setting.streakShields) {
      if (typeof setting.streakShields.get === 'function') {
        shields = setting.streakShields.get(userId) || 0;
      } else {
        shields = setting.streakShields[userId] || 0;
      }
    }

    res.json({
      success: true,
      chatId: req.params.chatId,
      streakCount: setting.streakCount || 0,
      lastStreakDate: setting.lastStreakDate || '',
      shields,
      streakShields: shields,
      streakFrozenUntil: setting.streakFrozenUntil || null,
      milestonesClaimed: setting.streakMilestonesClaimed || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

router.post('/settings/:chatId/streak/freeze', authMiddleware, async (req, res) => {
  try {
    const result = await db.buyStreakFreeze(req.params.chatId, req.user.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.user.id}`).emit('sparks_updated', { pulseSparks: result.pulseSparks });
      io.to(req.params.chatId).emit('streak_freeze_bought', {
        chatId: req.params.chatId,
        userId: req.user.id,
        shields: result.shields
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to buy streak freeze' });
  }
});

// =========================================================================
// OPTION 2: FOG SNAPS (SCRATCH-TO-REVEAL & SCREENSHOT ALERT)
// =========================================================================
router.post('/fog-snap/reveal', authMiddleware, async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    const Message = require('../models/Message');
    const msg = await Message.findOneAndUpdate(
      { id: messageId },
      { fogSnapStatus: 'revealed' },
      { new: true }
    );

    const io = req.app.get('io');
    if (io && chatId) {
      io.to(chatId).emit('fog_snap_revealed', { messageId, chatId, revealedBy: req.user.id });
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reveal fog snap' });
  }
});

router.post('/fog-snap/burn', authMiddleware, async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    const Message = require('../models/Message');
    const mongoose = require('mongoose');
    const redis = require('../utils/redis');

    const query = { $or: [{ id: messageId }] };
    if (mongoose.Types.ObjectId.isValid(messageId)) {
      query.$or.push({ _id: messageId });
    }

    const msg = await Message.findOneAndUpdate(
      query,
      { fogSnapStatus: 'burned', content: '🌫️ Fog Snap Evaporated', mediaUrl: null, $addToSet: { viewedBy: req.user.id } },
      { new: true }
    );

    // Invalidate Redis RAM cache
    if (chatId) {
      await redis.invalidateChat(chatId).catch(() => {});
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        const revChatId = `${parts[1]}_${parts[0]}`;
        await redis.invalidateChat(revChatId).catch(() => {});
        await redis.invalidateChat(parts[0]).catch(() => {});
        await redis.invalidateChat(parts[1]).catch(() => {});
        redis.invalidateRecent(parts[0]).catch(() => {});
        redis.invalidateRecent(parts[1]).catch(() => {});
      }
    }

    const io = req.app.get('io');
    if (io && chatId) {
      io.to(chatId).emit('fog_snap_burned', { messageId, chatId });
      if (chatId.includes('_')) {
        chatId.split('_').forEach(uId => io.to(`user_${uId}`).emit('fog_snap_burned', { messageId, chatId }));
      }
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to burn fog snap' });
  }
});

router.post('/fog-snap/screenshot', authMiddleware, async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    const Message = require('../models/Message');
    const alertData = {
      takenBy: req.user.id,
      userName: req.user.displayName || req.user.username,
      timestamp: new Date().toISOString()
    };
    await Message.updateOne({ id: messageId }, { screenshotAlert: alertData });

    // Broadcast immediate alert to chat room!
    const io = req.app.get('io');
    if (io && chatId) {
      io.to(chatId).emit('snap_screenshot_alert', {
        messageId,
        chatId,
        takenBy: req.user.id,
        userName: alertData.userName,
        timestamp: alertData.timestamp
      });
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('snap_screenshot_alert', {
            messageId,
            chatId,
            takenBy: req.user.id,
            userName: alertData.userName,
            timestamp: alertData.timestamp
          });
        });
      }
    }

    res.json({ success: true, alert: alertData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record screenshot alert' });
  }
});

// Get Chat Message History - ultra fast response with Redis RAM cache, non-blocking background read receipts
router.get('/:chatId', authMiddleware, async (req, res) => {
  try {
    const { limit, before } = req.query;
    const redis = require('../utils/redis');

    // 0. Instant RAM Cache Check for initial chat opening (0.5ms response time)
    if (!before) {
      try {
        const cached = await redis.getCachedMessages(req.params.chatId);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          res.json(cached);

          // Non-blocking background read mark and socket emission
          setImmediate(async () => {
            try {
              const isGhostMode = await resolveGhostMode(req.user.id, req.params.chatId, req);

              await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
              const io = req.app.get('io');
              if (io) {
                io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                const otherId = await getOtherParticipantId(req.params.chatId, req.user.id);

                if (isGhostMode) {
                  io.to(req.params.chatId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
                  if (otherId) {
                    io.to(`user_${otherId}`).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
                    io.to(otherId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
                  }
                  return;
                }

                io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                if (otherId) {
                  io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                  io.to(otherId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                }
              }
            } catch (bgErr) {}
          });
          return;
        }
      } catch {}
    }

    const messages = await db.getMessages(req.params.chatId, limit, before);
    res.json(messages);

    // Save to Redis RAM Cache for next instant open
    if (!before && Array.isArray(messages) && messages.length > 0) {
      redis.setCachedMessages(req.params.chatId, messages, 1800).catch(() => {});
    }

    // Non-blocking background read mark and socket emission
    setImmediate(async () => {
      try {
        const isGhostMode = await resolveGhostMode(req.user.id, req.params.chatId, req);

        await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
        const io = req.app.get('io');
        if (io) {
          // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
          io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
          const otherId = await getOtherParticipantId(req.params.chatId, req.user.id);

          if (isGhostMode) {
            io.to(req.params.chatId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
            if (otherId) {
              io.to(`user_${otherId}`).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
              io.to(otherId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
            }
            return;
          }

          io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
          if (otherId) {
            io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
            io.to(otherId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
          }
        }
      } catch (bgErr) {
        console.error('Background read mark error:', bgErr);
      }
    });
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark Chat Messages as Read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  try {
    const isGhostMode = await resolveGhostMode(req.user.id, req.params.chatId, req);

    await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
    const io = req.app.get('io');
    if (io) {
      // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
      io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      const otherId = await getOtherParticipantId(req.params.chatId, req.user.id);

      if (isGhostMode) {
        io.to(req.params.chatId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
        if (otherId) {
          io.to(`user_${otherId}`).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
          io.to(otherId).emit('messages_delivered', { chatId: req.params.chatId, status: 'delivered' });
        }
        return res.json({ success: true, ghostMode: true });
      }

      io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      if (otherId) {
        io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
        io.to(otherId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      }
    }
    res.json({ success: true, ghostMode: false });
  } catch (err) {
    console.error('PUT /:chatId/read error:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

const Message = require('../models/Message');

// Mark Chat Messages as Delivered (Called by Service Worker on background push receipt or client)
router.post('/delivered-ack', async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });

    const updatedMsg = await Message.findOneAndUpdate(
      { id: messageId, status: 'sent' },
      { status: 'delivered' },
      { new: true }
    );

    if (updatedMsg) {
      const io = req.app.get('io');
      if (io) {
        const targetChatId = chatId || updatedMsg.chatId;
        if (updatedMsg.senderId) {
          io.to(`user_${updatedMsg.senderId}`).emit('message_delivered_update', {
            messageId,
            chatId: targetChatId,
            status: 'delivered'
          });
          io.to(`user_${updatedMsg.senderId}`).emit('messages_delivered', {
            chatId: targetChatId,
            messageIds: [messageId],
            status: 'delivered'
          });
        }
        if (targetChatId) {
          io.to(targetChatId).emit('message_delivered_update', {
            messageId,
            chatId: targetChatId,
            status: 'delivered'
          });
          io.to(targetChatId).emit('messages_delivered', {
            chatId: targetChatId,
            messageIds: [messageId],
            status: 'delivered'
          });
        }
      }
    }
    res.json({ success: true, delivered: !!updatedMsg });
  } catch (err) {
    console.error('Error in delivered-ack route:', err);
    res.status(500).json({ error: 'Failed to acknowledge delivery' });
  }
});

// Send message via HTTP (Offline Outbox sync fallback)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { chatId, receiverId, isGroup, content, type, audioUrl, mediaUrl, pollData, replyTo, clientTempId } = req.body;
    const senderId = req.user.id;

    if (!chatId) return res.status(400).json({ error: 'chatId is required' });

    // Check if blocked in 1-to-1 chat
    if (receiverId && !isGroup) {
      const blockStatus = await db.isUserBlocked(senderId, receiverId);
      if (blockStatus.isBlocked) {
        return res.status(403).json({ error: 'Blocked contact' });
      }

      // Check friendship for 1-to-1: both users must be synced
      if (senderId !== receiverId) {
        const sUser = await User.findOne({
          $or: [
            { id: senderId },
            ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
            { username: senderId }
          ]
        });
        const rUser = await User.findOne({
          $or: [
            { id: receiverId },
            ...(mongoose.Types.ObjectId.isValid(receiverId) ? [{ _id: receiverId }] : []),
            { username: receiverId }
          ]
        });
        if (sUser && rUser) {
          const rIds = [rUser.id, rUser._id?.toString(), rUser.username, receiverId].filter(Boolean);
          const sIds = [sUser.id, sUser._id?.toString(), sUser.username, senderId].filter(Boolean);
          const isFriend = sUser.friends?.some(f => rIds.includes(f)) || rUser.friends?.some(f => sIds.includes(f));
          if (!isFriend) {
            return res.status(403).json({ error: 'You can only message synced friends.' });
          }
        }
      }
    }

    if (type === '3d_text') {
      const senderUser = await User.findOne({
        $or: [
          { id: senderId },
          ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
          { username: senderId }
        ]
      });
      if (senderUser) {
        const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
        const hasUsedTrial = Boolean(senderUser.hasUsed3DTrial);

        if (!hasUsedTrial) {
          senderUser.hasUsed3DTrial = true;
          await senderUser.save();
        } else if (!isPro) {
          const SPARKS_COST = 10;
          const currentSparks = senderUser.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            return res.status(400).json({
              error: 'insufficient_sparks',
              message: `Sparks kam hain! 3D text bhejne ke liye 10 Sparks lagte hain, aapke paas sirf ${currentSparks} Sparks hain. Sparks Wallet se Ad dekh kar ya Free Daily bonus se free claim karein.`
            });
          }

          senderUser.pulseSparks = currentSparks - SPARKS_COST;
          await senderUser.save();
        }
      }
    }

    if (type === 'stealth_dust') {
      const senderUser = await User.findOne({
        $or: [
          { id: senderId },
          ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
          { username: senderId }
        ]
      });
      if (senderUser) {
        const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
        if (!isPro) {
          const SPARKS_COST = 5;
          const currentSparks = senderUser.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            return res.status(400).json({
              error: 'insufficient_sparks',
              message: `Sparks kam hain! Dust text secret note ke liye 5 Sparks lagte hain.`
            });
          }
          senderUser.pulseSparks = currentSparks - SPARKS_COST;
          await senderUser.save();
        }
      }
    }

    if (type === 'poll') {
      const senderUser = await User.findOne({
        $or: [
          { id: senderId },
          ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
          { username: senderId }
        ]
      });
      if (senderUser) {
        const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
        if (!isPro) {
          const SPARKS_COST = 5;
          const currentSparks = senderUser.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            return res.status(400).json({
              error: 'insufficient_sparks',
              message: `Sparks kam hain! Poll create karne ke liye 5 Sparks lagte hain.`
            });
          }
          senderUser.pulseSparks = currentSparks - SPARKS_COST;
          await senderUser.save();
        }
      }
    }

    const chatSetting = await db.getChatSetting(chatId);
    const isDisappearing = Boolean(chatSetting && chatSetting.disappearingEnabled);
    const expiresAt = isDisappearing ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000) : null;

    // Cloudinary Auto-Upload for HTTP sync fallback
    let finalMediaUrl = mediaUrl || null;
    let finalAudioUrl = audioUrl || null;

    if (finalMediaUrl && typeof finalMediaUrl === 'string' && finalMediaUrl.startsWith('data:')) {
      try {
        const resType = type === 'video' ? 'video' : (type === 'audio' || type === 'voice' ? 'video' : 'auto');
        finalMediaUrl = await uploadToCloudinary(finalMediaUrl, 'pulsechat_media', resType);
      } catch (e) {
        console.warn('Cloudinary upload fallback:', e.message);
      }
    }

    if (finalAudioUrl && typeof finalAudioUrl === 'string' && finalAudioUrl.startsWith('data:')) {
      try {
        finalAudioUrl = await uploadToCloudinary(finalAudioUrl, 'pulsechat_voice', 'video');
      } catch (e) {
        console.warn('Cloudinary audio upload fallback:', e.message);
      }
    }

    const newMsg = {
      id: 'msg_' + Date.now(),
      clientTempId: clientTempId || null,
      chatId,
      senderId,
      receiverId: receiverId || '',
      isGroup: !!isGroup,
      content: content || '',
      type: type || 'text',
      audioUrl: finalAudioUrl,
      mediaUrl: finalMediaUrl,
      fileName: req.body.fileName || null,
      fileSize: req.body.fileSize || null,
      pollData: pollData || null,
      callData: null,
      isViewOnce: false,
      viewedBy: [],
      status: 'sent',
      timestamp: new Date().toISOString(),
      reactions: {},
      replyTo: replyTo || null,
      expiresAt
    };

    await db.saveMessage(newMsg);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('new_message', newMsg);
      if (receiverId && !isGroup) {
        const sender = await User.findOne({ id: senderId }).select('displayName username avatar');
        io.to(`user_${receiverId}`).emit('message_notification', {
          ...newMsg,
          senderName: sender?.displayName || sender?.username || senderId,
          senderAvatar: sender?.avatar || null
        });
      }
    }

    res.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Error in /api/messages/send route:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Run Instant Storage Cleanup
router.post('/auto-cleanup', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 30;
    const result = await db.runAutoCleanupJob(days);

    // Invalidate Redis RAM Cache
    try {
      const redis = require('../utils/redis');
      redis.invalidateAllRecent().catch(() => {});
    } catch {}

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Storage cleanup completed successfully! Removed ${result.deletedCount} old messages (${days}+ days old).`
    });
  } catch (err) {
    console.error('Instant auto-cleanup endpoint error:', err);
    res.status(500).json({ error: 'Failed to execute storage cleanup' });
  }
});

// YouTube / Full Song Audio Search Endpoint (Extracts full length direct audio tracks)
router.get('/youtube-search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);

    const endpoints = [
      'https://jiosaavn-api-tan.vercel.app/api/search/songs?query=',
      'https://saavn.dev/api/search/songs?query=',
      'https://jiosaavn-api-private-us.vercel.app/api/search/songs?query='
    ];

    let fullSongItems = [];

    for (const ep of endpoints) {
      try {
        const fetchRes = await fetch(ep + encodeURIComponent(q.trim()));
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          const results = data.data?.results || data.results;
          if (Array.isArray(results) && results.length > 0) {
            fullSongItems = results.map(song => {
              const audioObj = Array.isArray(song.downloadUrl)
                ? (song.downloadUrl.find(d => d.quality === '320kbps') || song.downloadUrl.find(d => d.quality === '160kbps') || song.downloadUrl[song.downloadUrl.length - 1])
                : null;
              const audioUrl = audioObj?.url || (typeof song.downloadUrl === 'string' ? song.downloadUrl : null);

              const imgObj = Array.isArray(song.image)
                ? (song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1])
                : null;
              const albumArt = imgObj?.url || (typeof song.image === 'string' ? song.image : null);

              const artist = Array.isArray(song.artists?.primary) && song.artists.primary.length > 0
                ? song.artists.primary.map(a => a.name).join(', ')
                : (song.primaryArtists || 'PulseChat Music');

              const title = (song.name || song.title || 'Full Song')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&#039;/g, "'");

              if (!audioUrl) return null;

              return {
                trackId: `full_${song.id || Math.random().toString(36).substr(2, 6)}`,
                songTitle: title,
                artistName: artist,
                albumArt: albumArt || '',
                audioUrl: audioUrl,
                duration: song.duration ? Number(song.duration) : 240,
                isFullSong: true
              };
            }).filter(Boolean);

            if (fullSongItems.length > 0) break;
          }
        }
      } catch (e) {
        console.warn('Saavn search endpoint error:', e.message);
      }
    }

    if (fullSongItems.length > 0) {
      return res.json(fullSongItems);
    }

    // YouTube Fallback Scraper if Saavn API yields zero items
    const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q.trim() + ' full song audio');
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
    const videoIds = Array.from(new Set(matches.map(m => m[1]))).slice(0, 10);

    const ytItems = await Promise.all(videoIds.map(async (vId) => {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
        if (!oembedRes.ok) return null;
        const info = await oembedRes.json();
        return {
          trackId: `yt_${vId}`,
          youtubeId: vId,
          songTitle: info.title || 'YouTube Track',
          artistName: info.author_name || 'YouTube Music',
          albumArt: info.thumbnail_url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          audioUrl: `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1`,
          isFullSong: true
        };
      } catch {
        return null;
      }
    }));

    res.json(ytItems.filter(Boolean));
  } catch (err) {
    console.error('Full song search error:', err);
    res.status(500).json({ error: 'Failed to search full song audio' });
  }
});

// Permanent Dissolve Stealth Dust Note Endpoint
router.post('/dissolve-dust/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId, messageMongoId, clientTempId } = req.body || {};
    const Message = require('../models/Message');
    const redis = require('../utils/redis');
    const mongoose = require('mongoose');

    const orConditions = [];
    if (messageId) {
      orConditions.push({ id: String(messageId) });
      orConditions.push({ clientTempId: String(messageId) });
      if (mongoose.Types.ObjectId.isValid(String(messageId))) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageId)) });
      }
    }
    if (clientTempId) {
      orConditions.push({ id: String(clientTempId) });
      orConditions.push({ clientTempId: String(clientTempId) });
      if (mongoose.Types.ObjectId.isValid(String(clientTempId))) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(String(clientTempId)) });
      }
    }
    if (messageMongoId && mongoose.Types.ObjectId.isValid(String(messageMongoId))) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageMongoId)) });
    }

    if (orConditions.length > 0) {
      await Message.deleteMany({ $or: orConditions });
    }

    if (chatId) {
      await redis.invalidateChat(chatId).catch(() => {});
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        const revChatId = [parts[1], parts[0]].join('_');
        await redis.invalidateChat(revChatId).catch(() => {});
        await redis.invalidateChat(parts[0]).catch(() => {});
        await redis.invalidateChat(parts[1]).catch(() => {});
        redis.invalidateRecent(parts[0]).catch(() => {});
        redis.invalidateRecent(parts[1]).catch(() => {});
      }
    }

    const io = req.app.get('io');
    const payload = { chatId, messageId, messageMongoId, clientTempId };
    if (io && chatId) {
      io.to(chatId).emit('stealth_dust_dissolved', payload);
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        parts.forEach(uId => io.to(`user_${uId}`).emit('stealth_dust_dissolved', payload));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in dissolve-dust route:', err);
    res.status(500).json({ error: 'Failed to dissolve dust message' });
  }
});

// Live In-Line Message Translation Endpoint (Sub-100ms ultra-fast with multi-engine fallback)
const translationCache = new Map();

router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang = 'en', sourceLang = 'auto' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for translation' });
    }

    const cleanText = text.trim();
    const cacheKey = `${sourceLang}_${targetLang}_${cleanText}`;
    if (translationCache.has(cacheKey)) {
      return res.json(translationCache.get(cacheKey));
    }

    // Try Google Translate Free GTX Endpoint
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText)}`;
      const gtxRes = await fetch(gtxUrl);
      if (gtxRes.ok) {
        const gtxData = await gtxRes.json();
        if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
          const translatedText = gtxData[0].map(item => item[0]).join('');
          const detectedSourceLang = gtxData[2] || sourceLang;
          const result = {
            success: true,
            originalText: cleanText,
            translatedText,
            sourceLang: detectedSourceLang,
            targetLang
          };
          if (translationCache.size > 2000) translationCache.clear();
          translationCache.set(cacheKey, result);
          return res.json(result);
        }
      }
    } catch (gtxErr) {
      console.warn('GTX translate fallback triggered:', gtxErr.message);
    }

    // Fallback: MyMemory API
    try {
      const mmLangPair = `${sourceLang === 'auto' ? 'autodetect' : sourceLang}|${targetLang}`;
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${encodeURIComponent(mmLangPair)}`;
      const mmRes = await fetch(mmUrl);
      if (mmRes.ok) {
        const mmData = await mmRes.json();
        if (mmData && mmData.responseData && mmData.responseData.translatedText) {
          const result = {
            success: true,
            originalText: cleanText,
            translatedText: mmData.responseData.translatedText,
            sourceLang: sourceLang,
            targetLang
          };
          translationCache.set(cacheKey, result);
          return res.json(result);
        }
      }
    } catch (mmErr) {
      console.warn('MyMemory translate fallback failed:', mmErr.message);
    }

    res.status(500).json({ error: 'Translation services currently unavailable' });
  } catch (err) {
    console.error('Translation endpoint error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

module.exports = router;

