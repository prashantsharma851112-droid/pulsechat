const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

const User = require('../models/User');

const resolveGhostMode = async (userId) => {
  if (!userId) return false;
  try {
    const mongoose = require('mongoose');
    const u = await User.findOne({
      $or: [
        { id: userId },
        ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('hideReadReceipts').lean();
    return Boolean(u && u.hideReadReceipts);
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
              const isGhostMode = await resolveGhostMode(req.user.id);

              await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
              const io = req.app.get('io');
              if (io) {
                io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                if (!isGhostMode) {
                  io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                  if (req.params.chatId.includes('_')) {
                    const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
                    if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
                  }
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
        const isGhostMode = await resolveGhostMode(req.user.id);

        await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
        const io = req.app.get('io');
        if (io) {
          // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
          io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });

          if (!isGhostMode) {
            io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
            if (req.params.chatId.includes('_')) {
              const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
              if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
            }
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
    const isGhostMode = await resolveGhostMode(req.user.id);

    await db.markChatAsRead(req.params.chatId, req.user.id, isGhostMode);
    const io = req.app.get('io');
    if (io) {
      // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
      io.to(`user_${req.user.id}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });

      if (!isGhostMode) {
        io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
        if (req.params.chatId.includes('_')) {
          const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
          if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
        }
      }
    }
    res.json({ success: true, ghostMode: isGhostMode });
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
    }

    if (type === '3d_text') {
      const senderUser = await User.findOne({ id: senderId });
      if (senderUser) {
        const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
        const hasUsedTrial = Boolean(senderUser.hasUsed3DTrial);

        if (!hasUsedTrial) {
          senderUser.hasUsed3DTrial = true;
          await senderUser.save();
        } else {
          if (!isPro) {
            return res.status(403).json({
              error: 'subscription_required',
              message: 'Aapka 3D Free Trial khatam ho chuka hai. 3D text stickers bhejne ke liye Pulse VIP subscription activate karein.'
            });
          }

          const SPARKS_COST = 10;
          const currentSparks = senderUser.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            return res.status(400).json({
              error: 'insufficient_sparks',
              message: `Sparks kam hain! 3D text bhejne ke liye 10 Sparks lagte hain, aapke paas sirf ${currentSparks} Sparks hain. VIP Store se free claim karein.`
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

module.exports = router;
