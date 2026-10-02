const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const SupportTicket = require('../models/SupportTicket');
const db = require('../database/db');
const { sendSupportReplyEmail } = require('../utils/mailer');

// In-memory stats cache for instant 0ms responses
let cachedStatsPayload = null;
let lastStatsCacheTimestamp = 0;
const STATS_CACHE_TTL = 3000; // 3 seconds TTL

const invalidateAdminCache = () => {
  lastStatsCacheTimestamp = 0;
  cachedStatsPayload = null;
};

// Middleware to check Admin status (0ms instant check)
const adminOnly = async (req, res, next) => {
  try {
    if (req.user && req.user.isAdmin) {
      req.adminUser = req.user;
      return next();
    }
    const mongoose = require('mongoose');
    const userId = req.user?.id || req.user?._id;
    const username = req.user?.username;

    if (!userId && !username) {
      return res.status(401).json({ error: 'Unauthorized user session.' });
    }

    const isObjectId = userId && mongoose.Types.ObjectId.isValid(userId);
    const user = isObjectId
      ? await User.findById(userId).select('isAdmin id username').lean()
      : await User.findOne({
          $or: [
            ...(userId ? [{ id: userId }] : []),
            ...(username ? [{ username: username }] : [])
          ]
        }).select('isAdmin id username').lean();

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Access denied: Master Admin privileges required.' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    console.error('adminOnly middleware error:', err);
    res.status(500).json({ error: 'Failed to verify admin status.' });
  }
};

// GET Live Admin System Stats & User Metrics (Super Fast & Cached)
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const now = Date.now();
    const isFreshRequested = req.query.fresh === 'true';

    const getLiveDetails = req.app.get('getLiveOnlineUsersDetails');
    const getOnlineMap = req.app.get('getRawOnlineUsersMap');

    let liveOnlineUserIds = [];
    let hiddenUserIds = [];

    if (typeof getLiveDetails === 'function') {
      const details = getLiveDetails();
      liveOnlineUserIds = details.rawOnlineIds || [];
      hiddenUserIds = details.hiddenUserIds || [];
    } else if (typeof getOnlineMap === 'function') {
      const onlineMap = getOnlineMap();
      liveOnlineUserIds = onlineMap ? Array.from(onlineMap.keys()) : [];
    }

    const onlineSet = new Set(liveOnlineUserIds.map(String));
    const hiddenSet = new Set(hiddenUserIds.map(String));

    // Serve from memory cache if less than 3s old
    if (!isFreshRequested && cachedStatsPayload && (now - lastStatsCacheTimestamp < STATS_CACHE_TTL)) {
      const usersWithOnlineStatus = cachedStatsPayload.users.map(u => {
        const uId = u.id ? String(u.id) : '';
        const uMongoId = u.mongoId ? String(u.mongoId) : '';
        const uUsername = u.username ? String(u.username) : '';

        // Live connection check (counts ALL online users, even if stealth/hidden!)
        const isOnline = onlineSet.has(uId) || (uMongoId && onlineSet.has(uMongoId)) || (uUsername && onlineSet.has(uUsername));
        const isStealth = Boolean(u.hideOnlineStatus) || hiddenSet.has(uId) || (uMongoId && hiddenSet.has(uMongoId)) || (uUsername && hiddenSet.has(uUsername));

        return {
          ...u,
          hideOnlineStatus: isStealth,
          isLiveOnline: isOnline
        };
      });

      const liveOnlineCount = usersWithOnlineStatus.filter(u => u.isLiveOnline).length;
      const stealthOnlineCount = usersWithOnlineStatus.filter(u => u.isLiveOnline && u.hideOnlineStatus).length;

      return res.json({
        ...cachedStatsPayload,
        liveOnlineCount,
        stealthOnlineCount,
        users: usersWithOnlineStatus
      });
    }

    const [totalMessages, totalGroups, rawUsersList] = await Promise.all([
      Message.estimatedDocumentCount().catch(() => Message.countDocuments()),
      Group.estimatedDocumentCount().catch(() => Group.countDocuments()),
      User.find({})
        .sort({ createdAt: -1 })
        .select('id _id username displayName email avatar isEmailVerified isPro proTier isAdmin status hideOnlineStatus createdAt')
        .lean()
    ]);

    const formattedUsersList = rawUsersList.map(u => {
      const uStrId = u.id ? String(u.id) : (u._id ? u._id.toString() : '');
      const mongoIdStr = u._id ? u._id.toString() : '';
      const usernameStr = u.username ? String(u.username) : '';

      // User is physically connected right now
      const isOnline = onlineSet.has(uStrId) ||
        (mongoIdStr && onlineSet.has(mongoIdStr)) ||
        (usernameStr && onlineSet.has(usernameStr));

      // User has enabled stealth / hide online indicator
      const isStealth = Boolean(u.hideOnlineStatus) ||
        hiddenSet.has(uStrId) ||
        (mongoIdStr && hiddenSet.has(mongoIdStr)) ||
        (usernameStr && hiddenSet.has(usernameStr));

      return {
        id: uStrId,
        mongoId: mongoIdStr,
        username: u.username || 'user',
        displayName: u.displayName || u.username || 'User',
        email: u.email || '',
        avatar: u.avatar || '',
        isPro: Boolean(u.isPro),
        isAdmin: Boolean(u.isAdmin),
        proTier: u.proTier || 'none',
        createdAt: u.createdAt,
        hideOnlineStatus: isStealth,
        isLiveOnline: isOnline
      };
    });

    // Total online count includes ALL online users (whether stealth or normal)
    const liveOnlineCount = formattedUsersList.filter(u => u.isLiveOnline).length;
    const stealthOnlineCount = formattedUsersList.filter(u => u.isLiveOnline && u.hideOnlineStatus).length;

    const payload = {
      success: true,
      totalUsers: formattedUsersList.length,
      liveOnlineCount,
      stealthOnlineCount,
      totalMessages,
      totalGroups,
      users: formattedUsersList
    };

    cachedStatsPayload = payload;
    lastStatsCacheTimestamp = now;

    res.json(payload);
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats: ' + err.message });
  }
});

// Admin Claim / Passcode Activation Route
router.post('/claim-admin', authMiddleware, async (req, res) => {
  try {
    const { secretCode } = req.body;
    const MASTER_SECRET = process.env.ADMIN_SECRET_KEY || 'pulse_master_admin_851112';

    if (!secretCode || secretCode.trim() !== MASTER_SECRET) {
      return res.status(400).json({ error: 'Invalid Master Admin Passcode.' });
    }

    const mongoose = require('mongoose');
    const userId = req.user?.id || req.user?._id;
    const username = req.user?.username;

    const isObjectId = userId && mongoose.Types.ObjectId.isValid(userId);
    const query = {
      $or: [
        ...(userId ? [{ id: userId }] : []),
        ...(isObjectId ? [{ _id: userId }] : []),
        ...(username ? [{ username: username }] : [])
      ]
    };

    const updated = await User.findOneAndUpdate(query, { isAdmin: true }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ error: 'User account not found in database.' });
    }

    const { passwordHash, otpCode, otpExpires, ...safeUser } = updated;
    safeUser.isAdmin = true;

    invalidateAdminCache();
    res.json({
      success: true,
      message: '👑 Stealth Master Admin Activated Successfully!',
      user: safeUser
    });
  } catch (err) {
    console.error('Claim admin error:', err);
    res.status(500).json({ error: 'Failed to claim admin status: ' + err.message });
  }
});

// Admin Toggle User Pro / VIP status
router.post('/toggle-user-pro', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { targetUserId, isPro } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'Target User ID required' });

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
    const query = isObjectId
      ? { $or: [{ id: targetUserId }, { _id: targetUserId }] }
      : { $or: [{ id: targetUserId }, { username: targetUserId }] };

    const updated = await User.findOneAndUpdate(
      query,
      {
        isPro: Boolean(isPro),
        proTier: isPro ? 'yearly' : 'none',
        proExpiresAt: isPro ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    invalidateAdminCache();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: updated.id || updated._id?.toString(),
        userMongoId: updated._id?.toString(),
        username: updated.username,
        isPro: Boolean(updated.isPro),
        proTier: updated.proTier
      });
    }

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Toggle user pro error:', err);
    res.status(500).json({ error: 'Failed to update user Pro status: ' + err.message });
  }
});

// Admin Permanent User Account Deletion Route
router.delete('/delete-user/:targetUserId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    if (!targetUserId) return res.status(400).json({ error: 'Target User ID is required.' });

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
    const query = isObjectId
      ? { $or: [{ id: targetUserId }, { _id: targetUserId }] }
      : { $or: [{ id: targetUserId }, { username: targetUserId }] };

    const userToDelete = await User.findOne(query).lean();
    if (!userToDelete) {
      return res.status(404).json({ error: 'Target user account not found in database.' });
    }

    const targetIdStr = userToDelete.id || (userToDelete._id ? userToDelete._id.toString() : '');
    const targetMongoIdStr = userToDelete._id ? userToDelete._id.toString() : '';

    // Prevent Admin from deleting their own account via dashboard
    const currentAdminId = (req.user?.id || req.user?._id || '').toString();
    if (targetIdStr === currentAdminId || targetMongoIdStr === currentAdminId) {
      return res.status(400).json({ error: 'You cannot delete your own Master Admin account.' });
    }

    // 1. Delete user record from MongoDB
    await User.deleteOne({ _id: userToDelete._id });

    // 2. Clean up messages involving this deleted user
    await Message.deleteMany({
      $or: [
        { senderId: targetIdStr },
        { receiverId: targetIdStr },
        ...(targetMongoIdStr ? [{ senderId: targetMongoIdStr }, { receiverId: targetMongoIdStr }] : [])
      ]
    });

    invalidateAdminCache();

    // 3. Emit real-time socket events for clean UI synchronization
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', {
        userId: targetIdStr,
        userMongoId: targetMongoIdStr,
        username: userToDelete.username
      });
      io.emit('user_profile_updated', {
        userId: targetIdStr,
        userMongoId: targetMongoIdStr,
        isDeleted: true
      });
    }

    res.json({
      success: true,
      message: `User @${userToDelete.username || userToDelete.displayName} permanently deleted from database.`
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user account: ' + err.message });
  }
});

// ==========================================
// USER SUPPORT QUERIES & TICKETS
// ==========================================

// 1. Submit User Support Query (Any authenticated user)
router.post('/support/submit', authMiddleware, async (req, res) => {
  try {
    const { subject, message, email: customEmail } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a message description.' });
    }

    const userId = req.user?.id || req.user?._id;
    const user = await User.findOne({
      $or: [
        ...(userId ? [{ id: userId }] : []),
        ...(req.user?.username ? [{ username: req.user.username }] : [])
      ]
    }).lean();

    const userEmail = (customEmail && customEmail.trim()) || user?.email || req.user?.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'A valid email address is required to receive support replies.' });
    }

    const ticketId = 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const ticket = new SupportTicket({
      id: ticketId,
      userId: String(userId || 'guest'),
      username: user?.username || req.user?.username || 'user',
      displayName: user?.displayName || req.user?.displayName || 'User',
      email: userEmail.toLowerCase().trim(),
      subject: subject || 'General Inquiry / Help',
      message: message.trim(),
      status: 'pending',
      createdAt: new Date()
    });

    await ticket.save();

    res.json({
      success: true,
      ticketId,
      email: userEmail,
      message: `Your query has been submitted successfully to the Admin Dashboard! You will receive a direct reply on your registered email: ${userEmail}.`
    });
  } catch (err) {
    console.error('Submit support ticket error:', err);
    res.status(500).json({ error: 'Failed to submit query: ' + err.message });
  }
});

// 2. Get All Support Tickets (Admin Only)
router.get('/support/tickets', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tickets = await SupportTicket.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, tickets });
  } catch (err) {
    console.error('Fetch support tickets error:', err);
    res.status(500).json({ error: 'Failed to fetch tickets: ' + err.message });
  }
});

// 3. Admin Reply to Support Ticket & Send Email (Admin Only)
router.post('/support/reply/:ticketId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ error: 'Please enter a reply message.' });
    }

    const ticket = await SupportTicket.findOne({ id: ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    ticket.adminReply = replyMessage.trim();
    ticket.status = 'replied';
    ticket.repliedAt = new Date();
    await ticket.save();

    // Send email to user's registered email
    const mailResult = await sendSupportReplyEmail(
      ticket.email,
      ticket.displayName || ticket.username,
      ticket.subject,
      ticket.message,
      replyMessage.trim()
    );

    res.json({
      success: true,
      message: `Reply sent successfully to user's registered email (${ticket.email})!`,
      delivered: mailResult?.delivered,
      ticket
    });
  } catch (err) {
    console.error('Reply support ticket error:', err);
    res.status(500).json({ error: 'Failed to send reply: ' + err.message });
  }
});

module.exports = router;
