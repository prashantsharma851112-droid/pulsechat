const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

// Get Chat Message History
router.get('/:chatId', authMiddleware, async (req, res) => {
  const messages = await db.getMessages(req.params.chatId);
  res.json(messages);
});

module.exports = router;
