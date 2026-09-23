const mongoose = require('mongoose');

// NOTE: we keep a custom string "id" field (e.g. "user_1234567890") instead of
// relying on Mongo's own _id. This is deliberate - the rest of the app
// (routes, sockets, and every frontend component) already references
// user.id / message.id as plain strings, so keeping that shape means we
// don't have to rewrite that logic, only how it's stored.
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, required: true, index: true },
  avatar: { type: String, default: '' },
  status: { type: String, default: 'Hey there! I am using PulseChat.' },
  isEmailVerified: { type: Boolean, default: false },
  otpCode: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  pushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }],
  blockedUsers: [{ type: String }],
  friends: [{ type: String }],
  hideReadReceipts: { type: Boolean, default: false },
  isPro: { type: Boolean, default: false },
  proExpiresAt: { type: Date, default: null },
  proTier: { type: String, default: 'none' }, // 'none' | 'monthly' | 'yearly'
  customBadge: { type: String, default: '' },
  pulseSparks: { type: Number, default: 50 }, // 50 Free Sparks on signup
  claimedFreeSparks: { type: Object, default: {} }, // { [planId]: ISO string timestamp of last 24h claim }
  hasUsed3DTrial: { type: Boolean, default: false }, // Tracks if 1st free 3D text trial was used
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ username: 1, displayName: 1 });

module.exports = mongoose.model('User', userSchema);

