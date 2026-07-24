const mongoose = require('mongoose');

// NOTE: we keep a custom string "id" field (e.g. "user_1234567890") instead of
// relying on Mongo's own _id. This is deliberate - the rest of the app
// (routes, sockets, and every frontend component) already references
// user.id / message.id as plain strings, so keeping that shape means we
// don't have to rewrite that logic, only how it's stored.
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, default: '' },
  status: { type: String, default: 'Hey there! I am using PulseChat.' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
