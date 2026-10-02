const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, default: 'General Support' },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'replied'], default: 'pending' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
