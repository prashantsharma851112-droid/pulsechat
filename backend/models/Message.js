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
  type: { type: String, default: 'text' }, // 'text' | '3d_text' | 'voice' | 'image' | 'video' | 'document' | 'poll' | 'call' | 'gift'
  textStyle: { type: String, default: null },
  audioUrl: { type: String, default: null },
  mediaUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: String, default: null },
  pollData: { type: Object, default: null },
  giftData: { type: Object, default: null }, // { giftId, giftName, sparkAmount, icon, message, receiverName }
  callData: { type: Object, default: null }, // { isVideo: Boolean, status: String, duration: Number }
  isViewOnce: { type: Boolean, default: false },
  viewedBy: { type: Array, default: [] },
  status: { type: String, default: 'sent' }, // 'sent' | 'delivered' | 'read'
  readBy: { type: [String], default: [] }, // User IDs who have read this message
  timestamp: { type: String, default: () => new Date().toISOString() },
  reactions: { type: Object, default: {} },
  originalContent: { type: String, default: null },
  originalType: { type: String, default: null },
  originalAudioUrl: { type: String, default: null },
  originalMediaUrl: { type: String, default: null },
  originalPollData: { type: Object, default: null },
  // WhatsApp-style reply: quoted message data
  replyTo: { type: Object, default: null }, // { id, content, type, senderId, senderName }
  // Auto-decay / disappearing message expiry (MongoDB TTL index)
  expiresAt: { type: Date, default: null, index: { expires: 0 } }
});

messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ receiverId: 1, status: 1 });
messageSchema.index({ chatId: 1, timestamp: -1 });
messageSchema.index({ chatId: 1, timestamp: 1 });
messageSchema.index({ chatId: 1, readBy: 1 });
messageSchema.index({ senderId: 1, timestamp: -1 });
messageSchema.index({ receiverId: 1, timestamp: -1 });
messageSchema.index({ receiverId: 1, status: 1, senderId: 1 });
messageSchema.index({ receiverId: 1, status: 1, readBy: 1 });

module.exports = mongoose.model('Message', messageSchema);

