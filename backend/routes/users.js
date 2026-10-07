const express = require('express');
const router = express.Router();
const db = require('../database/db');
const User = require('../models/User');
const webpush = require('../utils/webpush');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Get all registered users (newest users first, up to 200)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const myUsername = req.user.username;
    const mongoose = require('mongoose');
    const excludeIds = [myId];
    if (mongoose.Types.ObjectId.isValid(myId)) excludeIds.push(myId);

    const results = await User.find({
      id: { $nin: excludeIds },
      ...(myUsername ? { username: { $ne: myUsername } } : {}),
      isHidden: { $ne: true },
      username: { $ne: 'reviewer' },
      email: { $ne: 'reviewer@pulsechat.app' }
    })
      .sort({ createdAt: -1, _id: -1 })
      .select('id username displayName avatar isEmailVerified status email createdAt isPro proTier customBadge pulseSparks hasKingCrown hasSilverCrown hasStreakCrown streakCrownExpiresAt kingCrownExpiresAt vibeAura')
      .limit(200)
      .lean();
    res.json(results);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Persistent conversation list (shown by default in the sidebar) - includes
// anyone who has messaged you OR whom you've messaged, even without a search
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const redis = require('../utils/redis');
    const cached = await redis.getCachedRecent(req.user.id);
    if (cached) {
      return res.json(cached);
    }

    const conversations = await db.getRecentConversations(req.user.id);
    if (Array.isArray(conversations)) {
      redis.setCachedRecent(req.user.id, conversations, 60).catch(() => {});
    }
    res.json(conversations);
  } catch (err) {
    console.error('Error in /recent route:', err);
    res.json([]);
  }
});

// Search users by Name, @username, or Email (instant indexed regex lookup with regex escaping)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const rawQuery = (req.query.q || '').trim();
    const query = rawQuery.toLowerCase().replace(/^@/, '');
    if (!query) return res.json([]);

    // Escape any regex special characters to prevent syntax errors
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const myId = req.user.id;
    const myUsername = req.user.username;
    const mongoose = require('mongoose');
    const excludeIds = [myId];
    if (mongoose.Types.ObjectId.isValid(myId)) excludeIds.push(myId);

    const results = await User.find({
      id: { $nin: excludeIds },
      ...(myUsername ? { username: { $ne: myUsername } } : {}),
      isHidden: { $ne: true },
      username: { $ne: 'reviewer' },
      email: { $ne: 'reviewer@pulsechat.app' },
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { displayName: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1, _id: -1 })
    .select('id username displayName avatar isEmailVerified status email createdAt isPro proTier customBadge pulseSparks hasKingCrown hasSilverCrown hasStreakCrown streakCrownExpiresAt kingCrownExpiresAt vibeAura')
    .limit(50)
    .lean();

    res.json(results);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update Profile (DP / Avatar, Username, Display Name, Status/Bio, Privacy)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.userId || req.user?.id || req.user?.userId;
    const { username, displayName, avatar, status, hideReadReceipts, hideOnlineStatus } = req.body;
    const updates = {};
    if (username !== undefined && username.trim() !== '') {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!cleanUsername || cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
      }
      const mongoose = require('mongoose');
      const excludeIds = [targetUserId, req.user?.id, req.user?.username].filter(Boolean);

      const existing = await User.findOne({
        username: cleanUsername,
        id: { $nin: excludeIds }
      });
      if (existing) {
        return res.status(400).json({ error: `Username @${cleanUsername} is already taken by another user.` });
      }
      updates.username = cleanUsername;
    }
    if (displayName) updates.displayName = displayName.trim();
    if (avatar !== undefined) {
      if (avatar && typeof avatar === 'string' && avatar.startsWith('data:')) {
        updates.avatar = await uploadToCloudinary(avatar, 'pulsechat_avatars', 'image');
      } else {
        updates.avatar = avatar;
      }
    }
    if (status !== undefined) updates.status = status.trim();
    if (hideReadReceipts !== undefined) updates.hideReadReceipts = Boolean(hideReadReceipts);
    if (hideOnlineStatus !== undefined) updates.hideOnlineStatus = Boolean(hideOnlineStatus);

    const updatedUser = await db.updateUser(targetUserId, updates);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...userWithoutPass } = updatedUser;

    // Synchronize avatar and display name across Vibe stories
    if (updates.avatar || updates.displayName || updates.username) {
      const Vibe = require('../models/Vibe');
      const syncObj = {};
      if (updates.avatar !== undefined) syncObj.avatar = userWithoutPass.avatar;
      if (updates.displayName) syncObj.displayName = userWithoutPass.displayName;
      if (updates.username) syncObj.username = userWithoutPass.username;

      const userQuery = {
        $or: [
          { userId: userWithoutPass.id },
          ...(userWithoutPass._id ? [{ userId: userWithoutPass._id.toString() }] : []),
          { username: userWithoutPass.username }
        ]
      };
      await Vibe.updateMany(userQuery, syncObj).catch(() => {});
    }

    // Broadcast profile update in real time to all connected users
    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: userWithoutPass.id,
        userMongoId: userWithoutPass._id ? userWithoutPass._id.toString() : null,
        username: userWithoutPass.username,
        displayName: userWithoutPass.displayName,
        avatar: userWithoutPass.avatar,
        status: userWithoutPass.status,
        isPro: Boolean(userWithoutPass.isPro),
        proTier: userWithoutPass.proTier,
        customBadge: userWithoutPass.customBadge,
        pulseSparks: userWithoutPass.pulseSparks,
        hideOnlineStatus: userWithoutPass.hideOnlineStatus,
        hasKingCrown: Boolean(userWithoutPass.hasKingCrown),
        hasSilverCrown: Boolean(userWithoutPass.hasSilverCrown),
        hasStreakCrown: Boolean(userWithoutPass.hasStreakCrown)
      });

      if (hideOnlineStatus !== undefined && typeof req.app.get('updateUserOnlinePrivacy') === 'function') {
        req.app.get('updateUserOnlinePrivacy')(targetUserId, userWithoutPass.hideOnlineStatus);
      }
    }

    res.json({ user: userWithoutPass });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update Privacy (Hide Read Receipts / Unseen Mode & Hide Online Status)
router.put('/privacy', authMiddleware, async (req, res) => {
  try {
    const { hideReadReceipts, hideOnlineStatus, autoCleanupEnabled, ghostChats } = req.body;
    const updates = {};
    if (hideReadReceipts !== undefined) updates.hideReadReceipts = Boolean(hideReadReceipts);
    if (hideOnlineStatus !== undefined) updates.hideOnlineStatus = Boolean(hideOnlineStatus);
    if (autoCleanupEnabled !== undefined) updates.autoCleanupEnabled = Boolean(autoCleanupEnabled);
    if (ghostChats !== undefined && Array.isArray(ghostChats)) updates.ghostChats = ghostChats;

    const updatedUser = await db.updateUser(req.user.id, updates);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...userWithoutPass } = updatedUser;

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.user.id}`).emit('user_profile_updated', {
        userId: userWithoutPass.id,
        userMongoId: userWithoutPass._id?.toString(),
        hideReadReceipts: userWithoutPass.hideReadReceipts,
        ghostChats: userWithoutPass.ghostChats,
        hideOnlineStatus: userWithoutPass.hideOnlineStatus,
        autoCleanupEnabled: userWithoutPass.autoCleanupEnabled
      });

      if (hideOnlineStatus !== undefined && typeof req.app.get('updateUserOnlinePrivacy') === 'function') {
        req.app.get('updateUserOnlinePrivacy')(req.user.id, userWithoutPass.hideOnlineStatus);
      }
    }

    res.json({ user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Block User
router.post('/block/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    const blocked = await db.blockUser(req.user.id, targetId);
    res.json({ success: true, blockedUsers: blocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock User
router.post('/unblock/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    const blocked = await db.unblockUser(req.user.id, targetId);
    res.json({ success: true, blockedUsers: blocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get List of Blocked Users
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const list = await db.getBlockedUsers(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Check Block Status with Target User
router.get('/:id/block-status', authMiddleware, async (req, res) => {
  try {
    const status = await db.isUserBlocked(req.user.id, req.params.id);
    res.json({
      isBlocked: status.isBlocked,
      isBlockedByMe: status.aBlockedB,
      isBlockedByThem: status.bBlockedA
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

// Get Specific User Profile by ID or username (Microsecond RAM speed with Redis Cache)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    const redis = require('../utils/redis');
    const cached = await redis.getCachedUser(targetId);
    if (cached) {
      return res.json(cached);
    }

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(targetId);
    const targetUser = await User.findOne({
      $or: [
        { id: targetId },
        ...(isObjectId ? [{ _id: targetId }] : []),
        { username: targetId }
      ]
    }).select('id username displayName avatar isEmailVerified status createdAt isPro proTier customBadge pulseSparks hasKingCrown hasSilverCrown hasStreakCrown streakCrownExpiresAt kingCrownExpiresAt vibeAura').lean();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cache profile in Redis for 15 minutes (900 seconds)
    redis.setCachedUser(targetId, targetUser, 900).catch(() => {});
    if (targetUser.id && targetUser.id !== targetId) {
      redis.setCachedUser(targetUser.id, targetUser, 900).catch(() => {});
    }

    res.json(targetUser);
  } catch (err) {
    console.error('Fetch user by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Change Password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const bcrypt = require('bcryptjs');
    const User = require('../models/User');
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = newHash;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Get VAPID Public Key for Web Push subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: webpush.getVapidPublicKey() });
});

// Save or Update Push Subscription for current user
router.post('/push-subscription', authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid push subscription data' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let subscriptions = user.pushSubscriptions || [];
    // Avoid duplicate endpoints
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    subscriptions.push({ endpoint, keys });

    user.pushSubscriptions = subscriptions;
    user.markModified('pushSubscriptions');
    await user.save();

    res.json({ success: true, count: subscriptions.length });
  } catch (err) {
    console.error('Failed to save push subscription:', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Unsubscribe from Web Push
router.delete('/push-subscription', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findOne({ id: req.user.id });
    if (user && user.pushSubscriptions) {
      user.pushSubscriptions = user.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
      user.markModified('pushSubscriptions');
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove push subscription:', err);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

// Permanent Account Deletion (GDPR, Google Play Store Policy & Privacy Policy compliant)
router.post('/delete-account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, reasonDetail, confirmation } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Please select a reason for account deletion.' });
    }

    if (!confirmation || confirmation.trim().toUpperCase() !== 'DELETE') {
      return res.status(400).json({ error: 'Please type "DELETE" to confirm account deletion.' });
    }

    const Message = require('../models/Message');
    const FriendRequest = require('../models/FriendRequest');
    const Group = require('../models/Group');
    const Vibe = require('../models/Vibe');

    // 1. Permanently delete all messages sent by this user
    await Message.deleteMany({ senderId: userId });

    // 2. Permanently delete friend requests
    await FriendRequest.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }]
    });

    // 3. Remove user from all groups
    await Group.updateMany(
      { members: userId },
      { $pull: { members: userId, admins: userId } }
    );

    // 4. Remove user's vibes / stories
    await Vibe.deleteMany({ userId });

    // 5. Invalidate caches
    try {
      const redis = require('../utils/redis');
      if (redis && redis.invalidateRecent) {
        await redis.invalidateRecent(userId).catch(() => {});
      }
    } catch (e) {}

    // 6. Delete user account record
    await User.deleteOne({ id: userId });

    console.log(`[Account Deletion] User ${userId} permanently closed account. Reason: "${reason}" (${reasonDetail || 'N/A'})`);

    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
});

// Public Profile Card for Viral Social Sharing (pulsechat.me/@username)
router.get('/public/card/:username', async (req, res) => {
  try {
    const rawUsername = (req.params.username || '').trim().replace(/^@/, '');
    if (!rawUsername) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const User = require('../models/User');
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(rawUsername);

    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${rawUsername}$`, 'i') } },
        { id: rawUsername },
        ...(isObjectId ? [{ _id: rawUsername }] : [])
      ]
    }).select('id username displayName avatar status isPro proTier customBadge pulseSparks hasKingCrown hasSilverCrown hasStreakCrown vibeAura createdAt').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch streak data if available
    let streakCount = 0;
    let streakShields = 0;
    try {
      const Streak = mongoose.models.Streak || mongoose.model('Streak', new mongoose.Schema({
        chatId: String,
        streakCount: Number,
        shields: Number,
        lastStreakDate: String
      }, { strict: false }));
      const streakRecord = await Streak.findOne({
        chatId: { $regex: user.id }
      }).sort({ streakCount: -1 }).lean();
      if (streakRecord) {
        streakCount = streakRecord.streakCount || 0;
        streakShields = streakRecord.shields || 0;
      }
    } catch (e) {}

    // Fetch active Vibe story if exists
    let topVibe = null;
    try {
      const Vibe = mongoose.models.Vibe;
      if (Vibe) {
        const activeVibe = await Vibe.findOne({
          userId: user.id,
          expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).lean();
        if (activeVibe) {
          topVibe = {
            id: activeVibe.id || activeVibe._id,
            caption: activeVibe.caption,
            mediaUrl: activeVibe.mediaUrl,
            mediaType: activeVibe.mediaType || (activeVibe.mediaUrl ? 'image' : 'text'),
            bgGradient: activeVibe.bgGradient,
            songTitle: activeVibe.songTitle
          };
        }
      }
    } catch (e) {}

    res.json({
      success: true,
      card: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar,
        status: user.status || 'Chilling on PulseChat ⚡',
        isPro: Boolean(user.isPro),
        proTier: user.proTier || 'free',
        customBadge: user.customBadge || null,
        pulseSparks: user.pulseSparks || 100,
        hasKingCrown: Boolean(user.hasKingCrown),
        hasSilverCrown: Boolean(user.hasSilverCrown),
        hasStreakCrown: Boolean(user.hasStreakCrown),
        vibeAura: user.vibeAura || 'neon',
        createdAt: user.createdAt,
        streakCount,
        streakShields,
        topVibe
      }
    });
  } catch (err) {
    console.error('Error fetching public card:', err);
    res.status(500).json({ error: 'Failed to fetch public card' });
  }
});

module.exports = router;

