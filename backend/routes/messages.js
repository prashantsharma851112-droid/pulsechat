const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

const User = require('../models/User');

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

// Get Chat Message History
router.get('/:chatId', authMiddleware, async (req, res) => {
  const currentUser = await User.findOne({ id: req.user.id }).select('hideReadReceipts');
  const isGhostMode = Boolean(currentUser && currentUser.hideReadReceipts);

  if (!isGhostMode) {
    await db.markChatAsRead(req.params.chatId, req.user.id);
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      if (req.params.chatId.includes('_')) {
        const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
        if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      }
    }
  }

  const messages = await db.getMessages(req.params.chatId);
  res.json(messages);
});

// Mark Chat Messages as Read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  const currentUser = await User.findOne({ id: req.user.id }).select('hideReadReceipts');
  const isGhostMode = Boolean(currentUser && currentUser.hideReadReceipts);

  if (!isGhostMode) {
    await db.markChatAsRead(req.params.chatId, req.user.id);
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      if (req.params.chatId.includes('_')) {
        const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
        if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
      }
    }
  }
  res.json({ success: true, ghostMode: isGhostMode });
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

    const chatSetting = await db.getChatSetting(chatId);
    const isDisappearing = Boolean(chatSetting && chatSetting.disappearingEnabled);
    const expiresAt = isDisappearing ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000) : null;

    const newMsg = {
      id: 'msg_' + Date.now(),
      clientTempId: clientTempId || null,
      chatId,
      senderId,
      receiverId: receiverId || '',
      isGroup: !!isGroup,
      content: content || '',
      type: type || 'text',
      audioUrl: audioUrl || null,
      mediaUrl: mediaUrl || null,
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

module.exports = router;
