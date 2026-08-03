const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

// Get Chat Message History
router.get('/:chatId', authMiddleware, async (req, res) => {
  await db.markChatAsRead(req.params.chatId, req.user.id);
  const messages = await db.getMessages(req.params.chatId);
  res.json(messages);
});

// Mark Chat Messages as Read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  await db.markChatAsRead(req.params.chatId, req.user.id);
  res.json({ success: true });
});

module.exports = router;
