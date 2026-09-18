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

module.exports = router;
