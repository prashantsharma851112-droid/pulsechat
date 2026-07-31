const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  // chatId is a deterministic string built by the frontend as
  // [userId1, userId2].sort().join('_') - this app only supports 1-on-1
  // chats, so no separate "Room" collection is needed (unlike ChatSpace).
  chatId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  receiverId: { type: String, default: '' },
  isGroup: { type: Boolean, default: false },
  content: { type: String, default: '' },
  type: { type: String, default: 'text' }, // 'text' | 'audio' | 'image' | 'poll'
  audioUrl: { type: String, default: null },
  mediaUrl: { type: String, default: null },
  pollData: { type: Object, default: null }, // { question: String, options: [{ id, text, votes: [userId] }], isMultipleChoice: Boolean }
  status: { type: String, default: 'sent' }, // 'sent' | 'delivered' | 'read'
  timestamp: { type: String, default: () => new Date().toISOString() },
  reactions: { type: Object, default: {} }
});

module.exports = mongoose.model('Message', messageSchema);
