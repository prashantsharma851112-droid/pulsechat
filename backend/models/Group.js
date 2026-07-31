const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: 'Welcome to our group chat!' },
  avatar: { type: String, default: '' },
  adminId: { type: String, required: true },
  members: [{ type: String }], // Array of user.id
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
