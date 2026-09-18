const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

// Get Chat Message History
router.get('/:chatId', authMiddleware, async (req, res) => {
  await db.markChatAsRead(req.params.chatId, req.user.id);
  const io = req.app.get('io');
  if (io) {
    io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
    if (req.params.chatId.includes('_')) {
      const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
      if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
    }
  }
  const messages = await db.getMessages(req.params.chatId);
  res.json(messages);
});

// Mark Chat Messages as Read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  await db.markChatAsRead(req.params.chatId, req.user.id);
  const io = req.app.get('io');
  if (io) {
    io.to(req.params.chatId).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
    if (req.params.chatId.includes('_')) {
      const otherId = req.params.chatId.split('_').find(id => id !== req.user.id);
      if (otherId) io.to(`user_${otherId}`).emit('chat_read_update', { chatId: req.params.chatId, userId: req.user.id });
    }
  }
  res.json({ success: true });
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

module.exports = router;
