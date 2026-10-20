const express = require('express');

const http = require('http');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config');
const db = require('./database/db');
const Message = require('./models/Message');
const User = require('./models/User');
const webpush = require('./utils/webpush');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const friendRoutes = require('./routes/friends');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const vibeRoutes = require('./routes/vibes');
const zoneRoutes = require('./routes/zone');
const sparksRoutes = require('./routes/sparks');
const legalRoutes = require('./routes/legal');
const { uploadToCloudinary } = require('./utils/cloudinary');
const { checkAndUpdateFileQuota } = require('./utils/fileQuota');
const redis = require('./utils/redis');

const compression = require('compression');
const app = express();
const server = http.createServer(app);

// Gzip/Brotli HTTP response compression (Instagram / high-scale efficiency: cuts JSON egress by 75-85%)
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to catch body parser errors (e.g. 413 Payload Too Large) as JSON instead of HTML
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'File size too large. Please upload an image or video under 50MB.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON request payload.' });
  }
  next(err);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vibes', vibeRoutes);
app.use('/api/zone', zoneRoutes);
app.use('/api/sparks', sparksRoutes);
app.use('/', legalRoutes); // Public Google Play URLs: /privacy, /terms
app.use('/api', legalRoutes);

// Health check endpoint for uptime monitoring & 0ms keep-alive
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redis.isConnected() ? 'connected (In-Memory RAM)' : 'standby (fallback mode)'
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ pong: true, time: Date.now() });
});

// Catch-all for unhandled /api/* requests so they ALWAYS return JSON 404, NEVER HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found.` });
});

// Automatic Redirect: Any user opening old Render link in browser is redirected ONCE to super-fast Vercel URL!
const VERCEL_REDIRECT_URL = 'https://pulsechat-ten-theta.vercel.app';

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const currentHost = (req.hostname || '').toLowerCase();
  if (currentHost.includes('onrender.com')) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect(302, VERCEL_REDIRECT_URL);
    }
  }
  next();
});

// Fallback status endpoint for API root
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '🚀 PulseChat API Server is live and running!',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Socket.io Real-Time Engine (WhatsApp / Instagram lightweight efficiency)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  perMessageDeflate: {
    threshold: 1024 // Compresses WebSocket frames > 1KB to save bandwidth
  },
  pingInterval: 25000, // Reduced chatty pings from 5s to 25s (80% bandwidth cut on idle sockets)
  pingTimeout: 60000,
  maxHttpBufferSize: 1e7
});

app.set('io', io);

const getOtherParticipantId = async (chatId, myUserId) => {
  if (!chatId || !myUserId) return null;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(myUserId);
    const me = await User.findOne({
      $or: [
        { id: myUserId },
        { username: myUserId },
        ...(isObjectId ? [{ _id: myUserId }] : [])
      ]
    }).select('id username _id').lean();
    const myKeys = [myUserId, me?.id, me?.username, me?._id?.toString()].filter(Boolean);

    let otherKey = null;
    for (const m of myKeys) {
      if (chatId.startsWith(m + '_')) {
        otherKey = chatId.slice(m.length + 1);
        break;
      } else if (chatId.endsWith('_' + m)) {
        otherKey = chatId.slice(0, -(m.length + 1));
        break;
      }
    }

    if (!otherKey && chatId.includes('_')) {
      const parts = chatId.split('_');
      otherKey = parts.find(p => !myKeys.includes(p));
    }

    // CRITICAL: If chatId is a single ID (e.g. partner ID), otherKey is directly chatId!
    if (!otherKey && !myKeys.includes(chatId) && !String(chatId).startsWith('group_')) {
      otherKey = chatId;
    }

    if (otherKey) {
      const isOtherObjectId = mongoose.Types.ObjectId.isValid(otherKey);
      const other = await User.findOne({
        $or: [
          { id: otherKey },
          { username: otherKey },
          ...(isOtherObjectId ? [{ _id: otherKey }] : [])
        ]
      }).select('id username _id').lean();
      return other?.id || otherKey;
    }
    return null;
  } catch {
    return null;
  }
};

const resolveGhostMode = async (userId, chatId) => {
  if (!userId) return false;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const u = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('id username _id hideReadReceipts ghostChats').lean();
    if (!u) return false;
    if (u.hideReadReceipts) return true;

    if (chatId && Array.isArray(u.ghostChats) && u.ghostChats.length > 0) {
      if (u.ghostChats.includes(chatId)) return true;

      const myKeys = [userId, u.id, u.username, u._id?.toString()].filter(Boolean);
      let otherTarget = null;
      for (const mKey of myKeys) {
        if (chatId.startsWith(mKey + '_')) {
          otherTarget = chatId.slice(mKey.length + 1);
          break;
        } else if (chatId.endsWith('_' + mKey)) {
          otherTarget = chatId.slice(0, -(mKey.length + 1));
          break;
        }
      }

      if (otherTarget && u.ghostChats.includes(otherTarget)) {
        return true;
      }

      for (const gId of u.ghostChats) {
        if (!gId) continue;
        const gStr = String(gId);
        if (chatId === gStr) return true;
        if (chatId.startsWith(gStr + '_') || chatId.endsWith('_' + gStr) || chatId.includes('_' + gStr + '_')) {
          return true;
        }
      }

      if (otherTarget) {
        const isOtherObjectId = mongoose.Types.ObjectId.isValid(otherTarget);
        const otherUser = await User.findOne({
          $or: [
            { id: otherTarget },
            { username: otherTarget },
            ...(isOtherObjectId ? [{ _id: otherTarget }] : [])
          ]
        }).select('id username _id').lean();
        if (otherUser) {
          const otherKeys = [otherUser.id, otherUser.username, otherUser._id?.toString()].filter(Boolean);
          if (otherKeys.some(k => u.ghostChats.includes(k))) {
            return true;
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
};

const onlineUsers = new Map(); // userId -> socketId
const hiddenOnlineUsers = new Set(); // userId set of users with hideOnlineStatus enabled
const userVibeAuras = new Map(); // userId -> { mood, emoji, auraColor, auraType, isLowBattery, batteryLevel, inGame, updatedAt }

const getPublicOnlineUsers = () => {
  return Array.from(onlineUsers.keys()).filter(id => !hiddenOnlineUsers.has(id));
};

const getLiveOnlineUsersDetails = () => {
  const rawOnlineIds = new Set();

  // 1. Direct active sockets on the server
  if (io && io.sockets && io.sockets.sockets) {
    for (const [sId, s] of io.sockets.sockets) {
      if (s.connected && s.userId) {
        rawOnlineIds.add(String(s.userId));
        if (s.userCustomId) rawOnlineIds.add(String(s.userCustomId));
        if (s.userMongoId) rawOnlineIds.add(String(s.userMongoId));
        if (s.userUsername) rawOnlineIds.add(String(s.userUsername));
      }
    }
  }

  // 2. Active onlineUsers map (verify socket is still alive)
  for (const [uId, sId] of onlineUsers.entries()) {
    if (io && io.sockets && io.sockets.sockets && io.sockets.sockets.has(sId)) {
      rawOnlineIds.add(String(uId));
    }
  }

  return {
    rawOnlineIds: Array.from(rawOnlineIds),
    hiddenUserIds: Array.from(hiddenOnlineUsers)
  };
};

const updateUserOnlinePrivacy = (userId, hideOnlineStatus) => {
  if (hideOnlineStatus) {
    hiddenOnlineUsers.add(userId);
  } else {
    hiddenOnlineUsers.delete(userId);
  }
  if (hideOnlineStatus) {
    io.emit('user_status', { userId, status: 'offline', lastSeen: new Date().toISOString() });
  } else {
    if (onlineUsers.has(userId)) {
      io.emit('user_status', { userId, status: 'online' });
    }
  }
  io.emit('online_users_list', getPublicOnlineUsers());
};

app.set('updateUserOnlinePrivacy', updateUserOnlinePrivacy);
app.set('getRawOnlineUsersMap', () => onlineUsers);
app.set('getLiveOnlineUsersDetails', getLiveOnlineUsersDetails);

io.on('connection', (socket) => {
  console.log('⚡ Socket Connected:', socket.id);

  // User explicitly signals going offline (data turned off / app hidden)
  socket.on('user_offline', (userId) => {
    const id = userId || socket.userId;
    if (id) {
      const toDelete = [id, socket.userId, socket.userCustomId, socket.userMongoId, socket.userUsername].filter(Boolean);
      toDelete.forEach(k => onlineUsers.delete(String(k)));
      if (!hiddenOnlineUsers.has(id)) {
        io.emit('user_status', { userId: id, status: 'offline', lastSeen: new Date().toISOString() });
      }
      io.emit('online_users_list', getPublicOnlineUsers());
    }
  });

  // Dynamic socket event for toggling online status privacy in real time
  socket.on('toggle_online_privacy', ({ hideOnlineStatus, userId }) => {
    const targetId = userId || socket.userId;
    if (targetId) {
      updateUserOnlinePrivacy(targetId, Boolean(hideOnlineStatus));
    }
  });

  // Real-time actual presence check for interactive features (Games, Whiteboard, Music Sync)
  // Allows multiplayer/interactive activities to function even if user has stealth indicator on
  socket.on('check_real_presence', ({ targetUserId, targetUsername, targetMongoId }, callback) => {
    if (typeof callback !== 'function') return;
    const ids = [targetUserId, targetUsername, targetMongoId].filter(Boolean).map(String);
    let isActuallyConnected = false;
    for (const id of ids) {
      if (onlineUsers.has(id)) {
        isActuallyConnected = true;
        break;
      }
    }
    if (!isActuallyConnected && io && io.sockets && io.sockets.sockets) {
      for (const [sId, s] of io.sockets.sockets) {
        if (s.connected && (
          ids.includes(String(s.userId)) ||
          ids.includes(String(s.userCustomId)) ||
          ids.includes(String(s.userMongoId)) ||
          ids.includes(String(s.userUsername))
        )) {
          isActuallyConnected = true;
          break;
        }
      }
    }
    callback({ isOnline: isActuallyConnected });
  });

  // Helper to resolve all room names (id, Mongo _id, username) for a given user
  const resolveUserRooms = async (rawUserId) => {
    const rooms = new Set();
    if (!rawUserId) return [];
    const strId = String(rawUserId);
    rooms.add(strId);
    rooms.add(`user_${strId}`);
    try {
      const isOid = mongoose.Types.ObjectId.isValid(strId);
      const u = await User.findOne({
        $or: [
          { id: strId },
          ...(isOid ? [{ _id: strId }] : []),
          { username: strId }
        ]
      }).select('id _id username').lean();
      if (u) {
        if (u.id) { rooms.add(String(u.id)); rooms.add(`user_${u.id}`); }
        if (u._id) { const oid = u._id.toString(); rooms.add(oid); rooms.add(`user_${oid}`); }
        if (u.username) { rooms.add(String(u.username)); rooms.add(`user_${u.username}`); }
      }
    } catch {}
    return Array.from(rooms);
  };

  // User comes online (mobile data ON / socket connected)
  socket.on('setup', async (userId) => {
    socket.userId = userId;
    socket.join(`user_${userId}`); // Join user's personal private room
    socket.join(userId);           // Also join direct userId room
    onlineUsers.set(userId, socket.id);

    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(userId);
      const uDoc = await User.findOne({
        $or: [
          { id: userId },
          ...(isObjectId ? [{ _id: userId }] : []),
          { username: userId }
        ]
      }).select('id _id username hideOnlineStatus').lean();

      if (uDoc) {
        socket.userMongoId = uDoc._id ? uDoc._id.toString() : null;
        socket.userUsername = uDoc.username || null;
        socket.userCustomId = uDoc.id || null;
        if (uDoc.hideOnlineStatus) {
          hiddenOnlineUsers.add(userId);
          if (uDoc.id) hiddenOnlineUsers.add(uDoc.id);
          if (uDoc._id) hiddenOnlineUsers.add(uDoc._id.toString());
          if (uDoc.username) hiddenOnlineUsers.add(uDoc.username);
        } else {
          hiddenOnlineUsers.delete(userId);
          if (uDoc.id) hiddenOnlineUsers.delete(uDoc.id);
          if (uDoc._id) hiddenOnlineUsers.delete(uDoc._id.toString());
          if (uDoc.username) hiddenOnlineUsers.delete(uDoc.username);
        }

        if (uDoc.id) {
          socket.join(`user_${uDoc.id}`);
          socket.join(uDoc.id);
          onlineUsers.set(uDoc.id, socket.id);
        }
        if (uDoc._id) {
          const strId = uDoc._id.toString();
          socket.join(`user_${strId}`);
          socket.join(strId);
          onlineUsers.set(strId, socket.id);
        }
        if (uDoc.username) {
          socket.join(`user_${uDoc.username}`);
          socket.join(uDoc.username);
          onlineUsers.set(uDoc.username, socket.id);
        }
      }
    } catch {}

    if (!hiddenOnlineUsers.has(userId)) {
      io.emit('user_status', { userId, status: 'online' });
    }
    io.emit('online_users_list', getPublicOnlineUsers());

    // Mobile data on ya user connect hone par pending 'sent' messages ko 'delivered' mark karo
    try {
      const allUserVariants = Array.from(new Set([
        userId,
        socket.userCustomId,
        socket.userMongoId,
        socket.userUsername
      ].filter(Boolean)));

      const pendingMsgs = await Message.find({ receiverId: { $in: allUserVariants }, status: 'sent' }).lean();
      if (pendingMsgs.length > 0) {
        // 1. Deliver each queued message to the newly connected recipient
        for (const pMsg of pendingMsgs) {
          socket.emit('new_message', { ...pMsg, status: 'delivered' });
        }

        // 2. Sender ko notify karo taaki unke screen par Single Tick turant Double Tick bann jaye
        const senderMap = {};
        for (const msg of pendingMsgs) {
          if (!senderMap[msg.senderId]) senderMap[msg.senderId] = {};
          if (!senderMap[msg.senderId][msg.chatId]) senderMap[msg.senderId][msg.chatId] = [];
          senderMap[msg.senderId][msg.chatId].push(msg.id);
        }

        for (const [sId, chats] of Object.entries(senderMap)) {
          const sRooms = await resolveUserRooms(sId);
          for (const [cId, msgIds] of Object.entries(chats)) {
            const canonicalCId = (cId && cId.includes('_')) ? cId.split('_').sort().join('_') : cId;
            const delivPayload = { chatId: cId, canonicalChatId: canonicalCId, messageIds: msgIds, status: 'delivered' };
            sRooms.forEach(r => io.to(r).emit('messages_delivered', delivPayload));
            if (cId) io.to(cId).emit('messages_delivered', delivPayload);
            if (canonicalCId && canonicalCId !== cId) io.to(canonicalCId).emit('messages_delivered', delivPayload);

            for (const mId of msgIds) {
              const singlePayload = { messageId: mId, chatId: cId, canonicalChatId: canonicalCId, status: 'delivered' };
              sRooms.forEach(r => io.to(r).emit('message_delivered_update', singlePayload));
              if (cId) io.to(cId).emit('message_delivered_update', singlePayload);
              if (canonicalCId && canonicalCId !== cId) io.to(canonicalCId).emit('message_delivered_update', singlePayload);
            }
          }
        }

        // 3. Mark queued messages as delivered in MongoDB (Retain until read by recipient)
        await Message.updateMany(
          { _id: { $in: pendingMsgs.map(m => m._id) } },
          { $set: { status: 'delivered' } }
        );
      }
    } catch (err) {
      console.error('Error delivering pending messages on setup:', err);
    }
  });

  // Join Chat Room / Group Room
  socket.on('join_chat', (chatId) => {
    if (!chatId) return;
    socket.join(chatId);
    if (chatId.includes('_')) {
      const canonical = chatId.split('_').sort().join('_');
      socket.join(canonical);
    }
  });

  // Typing Indicators
  socket.on('typing_start', ({ chatId, userId, username, receiverId }) => {
    socket.to(chatId).emit('typing_start', { chatId, userId, username });
    if (receiverId) {
      socket.to(`user_${receiverId}`).emit('typing_start', { chatId, userId, username });
      socket.to(receiverId).emit('typing_start', { chatId, userId, username });
    }
  });

  socket.on('typing_stop', ({ chatId, userId, receiverId }) => {
    socket.to(chatId).emit('typing_stop', { chatId, userId });
    if (receiverId) {
      socket.to(`user_${receiverId}`).emit('typing_stop', { chatId, userId });
      socket.to(receiverId).emit('typing_stop', { chatId, userId });
    }
  });

  // Helper function to dispatch background web push (for closed app)
  const dispatchWebPush = async (targetUserId, title, body, tag, chatTargetId, messageId = null, senderId = null, isGroup = false, iconUrl = null) => {
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(targetUserId);
      const targetUser = await User.findOne({
        $or: [
          { id: targetUserId },
          ...(isObjectId ? [{ _id: targetUserId }] : []),
          { username: targetUserId }
        ]
      });

      if (targetUser && targetUser.pushSubscriptions && targetUser.pushSubscriptions.length > 0) {
        const queryParams = new URLSearchParams();
        if (chatTargetId) queryParams.set('openChat', chatTargetId);
        if (senderId) queryParams.set('senderId', senderId);
        if (isGroup) queryParams.set('isGroup', '1');

        const resolvedIcon = iconUrl || '/icon-192.png';

        const pushPayload = {
          title,
          body,
          icon: resolvedIcon,
          badge: '/icon-192.png',
          tag,
          data: {
            url: `/?${queryParams.toString()}`,
            chatId: chatTargetId,
            messageId,
            senderId,
            isGroup: !!isGroup,
            icon: resolvedIcon
          }
        };

        let pushDelivered = false;
        const deadEndpoints = [];
        for (const sub of targetUser.pushSubscriptions) {
          try {
            const res = await webpush.sendPushNotification(sub, pushPayload);
            if (res && res.expired) {
              deadEndpoints.push(sub.endpoint);
            } else if (res && !res.error && !res.expired) {
              pushDelivered = true;
            }
          } catch (err) {}
        }

        if (deadEndpoints.length > 0) {
          targetUser.pushSubscriptions = targetUser.pushSubscriptions.filter(
            s => !deadEndpoints.includes(s.endpoint)
          );
          targetUser.markModified('pushSubscriptions');
          await targetUser.save();
        }

        // Target user mobile data is ON -> Push delivered! Mark delivered in MongoDB (Retain until read)
        if (pushDelivered && messageId) {
          try {
            await Message.updateOne({ id: messageId, status: 'sent' }, { $set: { status: 'delivered' } });
            if (senderId) {
              io.to(`user_${senderId}`).emit('message_delivered_update', {
                messageId,
                chatId: chatTargetId,
                status: 'delivered'
              });
              io.to(`user_${senderId}`).emit('messages_delivered', {
                chatId: chatTargetId,
                messageIds: [messageId],
                status: 'delivered'
              });
              if (chatTargetId) {
                io.to(chatTargetId).emit('message_delivered_update', {
                  messageId,
                  chatId: chatTargetId,
                  status: 'delivered'
                });
                io.to(chatTargetId).emit('messages_delivered', {
                  chatId: chatTargetId,
                  messageIds: [messageId],
                  status: 'delivered'
                });
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Push notification dispatch error:', e.message);
    }
  };

  // Send Real-Time Message (Instant 0ms emission & parallel background save)
  socket.on('send_message', async (messageData, ackCallback) => {
    const {
      chatId, senderId, receiverId, isGroup, content, type, textStyle,
      audioUrl, mediaUrl, mediaUrls, fileName, fileSize, pollData, giftData, callData,
      isViewOnce, replyTo, storyReply, clientTempId,
      senderName, senderUsername, senderAvatar, senderIsPro, senderProTier, senderCustomBadge
    } = messageData;

    try {
      // 1. Instant fast block status check
      if (receiverId && !isGroup) {
        const blockStatus = await db.isUserBlocked(senderId, receiverId);
        if (blockStatus.isBlocked) {
          socket.emit('message_blocked', {
            chatId,
            receiverId,
            reason: blockStatus.bBlockedA
              ? 'You cannot send messages to this contact because you have been blocked.'
              : 'You have blocked this contact. Unblock to send messages.'
          });
          if (typeof ackCallback === 'function') ackCallback({ error: 'blocked' });
          return;
        }
      }

      // 1.1 Enforce 5MB single file limit & 10MB 24h daily transfer quota
      if (type === 'document' || type === 'image' || type === 'video' || type === 'voice' || mediaUrl || audioUrl) {
        let estimatedBytes = 0;
        if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
          estimatedBytes = Math.ceil((mediaUrl.length * 3) / 4);
        } else if (typeof audioUrl === 'string' && audioUrl.startsWith('data:')) {
          estimatedBytes = Math.ceil((audioUrl.length * 3) / 4);
        } else if (fileSize) {
          const num = parseFloat(fileSize);
          if (!isNaN(num)) {
            estimatedBytes = String(fileSize).toLowerCase().includes('mb') ? Math.ceil(num * 1024 * 1024) : Math.ceil(num * 1024);
          }
        }

        if (estimatedBytes > 0) {
          const quotaResult = await checkAndUpdateFileQuota(senderId, estimatedBytes);
          if (!quotaResult.success) {
            socket.emit('file_limit_error', { chatId, error: quotaResult.error });
            if (typeof ackCallback === 'function') ackCallback({ error: quotaResult.error });
            return;
          }
        }
      }

      // Fast resolution of sender details (from payload if available, else DB fallback)
      let resolvedSenderName = senderName || senderUsername || senderId;
      let resolvedSenderAvatar = senderAvatar || null;
      let resolvedSenderIsPro = Boolean(senderIsPro);
      let resolvedSenderProTier = senderProTier || 'none';
      let resolvedSenderCustomBadge = senderCustomBadge || '';

      if (!senderName) {
        try {
          const isSenderObj = mongoose.Types.ObjectId.isValid(senderId);
          const senderDoc = await User.findOne({
            $or: [
              { id: senderId },
              ...(isSenderObj ? [{ _id: senderId }] : []),
              { username: senderId }
            ]
          }).select('id _id displayName username avatar isPro proTier customBadge').lean();
          if (senderDoc) {
            resolvedSenderName = senderDoc.displayName || senderDoc.username || senderId;
            resolvedSenderAvatar = senderDoc.avatar || null;
            resolvedSenderIsPro = Boolean(senderDoc.isPro);
            resolvedSenderProTier = senderDoc.proTier || 'none';
            resolvedSenderCustomBadge = senderDoc.customBadge || '';
          }
        } catch (e) {}
      }

      // Fast check for disappearing messages setting (cached or default)
      let chatSetting = null;
      try {
        chatSetting = await db.getChatSetting(chatId);
      } catch (e) {}

      const isDisappearing = Boolean(chatSetting && chatSetting.disappearingEnabled);
      const expiresAt = isDisappearing
        ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day lifetime free storage rule

      // Cloudinary Auto-Upload: Offload heavy Base64 media to Cloudinary CDN
      let finalMediaUrl = mediaUrl || null;
      let finalAudioUrl = audioUrl || null;

      if (finalMediaUrl && typeof finalMediaUrl === 'string' && finalMediaUrl.startsWith('data:')) {
        try {
          const resType = type === 'video' ? 'video' : (type === 'audio' || type === 'voice' ? 'video' : 'auto');
          finalMediaUrl = await uploadToCloudinary(finalMediaUrl, 'pulsechat_media', resType);
        } catch (e) {
          console.warn('Cloudinary upload fallback:', e.message);
        }
      }

      if (finalAudioUrl && typeof finalAudioUrl === 'string' && finalAudioUrl.startsWith('data:')) {
        try {
          finalAudioUrl = await uploadToCloudinary(finalAudioUrl, 'pulsechat_voice', 'video');
        } catch (e) {
          console.warn('Cloudinary audio upload fallback:', e.message);
        }
      }

      // 3D Animated Text / Emoji Validation & Sparks Cost Engine:
      if (type === '3d_text') {
        const senderUser = await User.findOne({
          $or: [
            { id: senderId },
            ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
            { username: senderId }
          ]
        });
        if (senderUser) {
          const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
          const hasUsedTrial = Boolean(senderUser.hasUsed3DTrial);

          if (!hasUsedTrial) {
            senderUser.hasUsed3DTrial = true;
            await senderUser.save();
            socket.emit('user_profile_updated', {
              userId: senderId,
              hasUsed3DTrial: true
            });
            socket.emit('3d_trial_used', { hasUsed3DTrial: true });
          } else if (!isPro) {
            // Free users without subscription spend 10 Sparks
            const SPARKS_COST = 10;
            const currentSparks = senderUser.pulseSparks || 0;
            if (currentSparks < SPARKS_COST) {
              socket.emit('message_blocked', {
                chatId,
                receiverId,
                reason: `Sparks kam hain! 3D text bhejne ke liye 10 Sparks lagte hain, aapke paas sirf ${currentSparks} Sparks hain. Sparks Wallet se Ad dekh kar ya Free Daily claim karein.`
              });
              if (typeof ackCallback === 'function') ackCallback({ error: 'insufficient_sparks' });
              return;
            }

            senderUser.pulseSparks = currentSparks - SPARKS_COST;
            await senderUser.save();

            socket.emit('sparks_updated', { pulseSparks: senderUser.pulseSparks });
            socket.emit('user_profile_updated', {
              userId: senderId,
              pulseSparks: senderUser.pulseSparks
            });
          }
          // Pro users get it 100% free with 0 Sparks
        }
      }

      // Stealth Dust Note Validation & Sparks Cost Engine:
      if (type === 'stealth_dust') {
        const senderUser = await User.findOne({
          $or: [
            { id: senderId },
            ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
            { username: senderId }
          ]
        });
        if (senderUser) {
          const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
          if (!isPro) {
            const SPARKS_COST = 5;
            const currentSparks = senderUser.pulseSparks || 0;
            if (currentSparks < SPARKS_COST) {
              socket.emit('message_blocked', {
                chatId,
                receiverId,
                reason: `Sparks kam hain! Dust text secret note ke liye 5 Sparks lagte hain. Sparks Wallet se Ad dekh kar free Sparks lein.`
              });
              if (typeof ackCallback === 'function') ackCallback({ error: 'insufficient_sparks' });
              return;
            }
            senderUser.pulseSparks = currentSparks - SPARKS_COST;
            await senderUser.save();
            socket.emit('sparks_updated', { pulseSparks: senderUser.pulseSparks });
            socket.emit('user_profile_updated', {
              userId: senderId,
              pulseSparks: senderUser.pulseSparks
            });
          }
        }
      }

      // Interactive Poll Validation & Sparks Cost Engine:
      if (type === 'poll') {
        const senderUser = await User.findOne({
          $or: [
            { id: senderId },
            ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
            { username: senderId }
          ]
        });
        if (senderUser) {
          const isPro = Boolean(senderUser.isPro && senderUser.proExpiresAt && new Date(senderUser.proExpiresAt) > new Date());
          if (!isPro) {
            const SPARKS_COST = 5;
            const currentSparks = senderUser.pulseSparks || 0;
            if (currentSparks < SPARKS_COST) {
              socket.emit('message_blocked', {
                chatId,
                receiverId,
                reason: `Sparks kam hain! Poll create karne ke liye 5 Sparks lagte hain. Sparks Wallet se Ad dekh kar free Sparks lein.`
              });
              if (typeof ackCallback === 'function') ackCallback({ error: 'insufficient_sparks' });
              return;
            }
            senderUser.pulseSparks = currentSparks - SPARKS_COST;
            await senderUser.save();
            socket.emit('sparks_updated', { pulseSparks: senderUser.pulseSparks });
            socket.emit('user_profile_updated', {
              userId: senderId,
              pulseSparks: senderUser.pulseSparks
            });
          }
        }
      }

      // Auto-resolve receiverId for 1-on-1 chats if not explicitly provided
      let resolvedReceiverId = receiverId || '';
      if ((!resolvedReceiverId || resolvedReceiverId === 'user') && !isGroup && chatId) {
        resolvedReceiverId = await getOtherParticipantId(chatId, senderId) || '';
      }

      // Enforce friendship for 1-on-1 messages: non-synced users cannot send messages
      if (!isGroup && resolvedReceiverId && senderId !== resolvedReceiverId) {
        try {
          const sUser = await User.findOne({
            $or: [
              { id: senderId },
              ...(mongoose.Types.ObjectId.isValid(senderId) ? [{ _id: senderId }] : []),
              { username: senderId }
            ]
          });
          const rUser = await User.findOne({
            $or: [
              { id: resolvedReceiverId },
              ...(mongoose.Types.ObjectId.isValid(resolvedReceiverId) ? [{ _id: resolvedReceiverId }] : []),
              { username: resolvedReceiverId }
            ]
          });

          if (sUser && rUser) {
            const rIdentifiers = [rUser.id, rUser._id?.toString(), rUser.username, resolvedReceiverId].filter(Boolean);
            const sIdentifiers = [sUser.id, sUser._id?.toString(), sUser.username, senderId].filter(Boolean);
            const isFriend = sUser.friends?.some(f => rIdentifiers.includes(f)) || rUser.friends?.some(f => sIdentifiers.includes(f));
            if (!isFriend) {
              socket.emit('message_blocked', {
                chatId,
                receiverId: resolvedReceiverId,
                reason: 'Aap sirf apne synced friends ko message bhej sakte hain. Pehle Sync Request accept karwayein.'
              });
              if (typeof ackCallback === 'function') {
                ackCallback({ error: 'not_friends', message: 'You can only message synced friends.' });
              }
              return;
            }
          }
        } catch (e) {
          console.error('Error verifying friendship for send_message:', e);
        }
      }

      // Check if recipient is currently online (check all identifier variants)
      let isReceiverOnline = false;
      if (resolvedReceiverId && !isGroup) {
        if (onlineUsers.has(resolvedReceiverId)) {
          isReceiverOnline = true;
        } else {
          try {
            const rDoc = await User.findOne({
              $or: [
                { id: resolvedReceiverId },
                ...(mongoose.Types.ObjectId.isValid(resolvedReceiverId) ? [{ _id: resolvedReceiverId }] : []),
                { username: resolvedReceiverId }
              ]
            }).select('id _id username').lean();
            if (rDoc) {
              const rVars = [rDoc.id, rDoc._id?.toString(), rDoc.username].filter(Boolean);
              isReceiverOnline = rVars.some(v => onlineUsers.has(v));
            }
          } catch {}
        }
      }
      const initialStatus = isReceiverOnline ? 'delivered' : 'sent';

      const canonicalChatId = (!isGroup && senderId && resolvedReceiverId && resolvedReceiverId !== 'user')
        ? [senderId, resolvedReceiverId].sort().join('_')
        : chatId;

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        clientTempId: clientTempId || null,
        chatId: canonicalChatId,
        senderId,
        senderName: resolvedSenderName,
        senderUsername: senderUsername || '',
        senderAvatar: resolvedSenderAvatar,
        senderIsPro: resolvedSenderIsPro,
        senderProTier: resolvedSenderProTier,
        senderCustomBadge: resolvedSenderCustomBadge,
        receiverId: resolvedReceiverId,
        isGroup: !!isGroup,
        isForwarded: Boolean(messageData.isForwarded),
        content: content || '',
        type: type || 'text',
        textStyle: textStyle || (type === '3d_text' ? 'cyber-neon' : null),
        audioUrl: finalAudioUrl,
        mediaUrl: finalMediaUrl || (Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls[0] : null),
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : (finalMediaUrl ? [finalMediaUrl] : []),
        fileName: fileName || null,
        fileSize: fileSize || null,
        pollData: pollData || null,
        giftData: giftData || null,
        callData: callData || null,
        isViewOnce: Boolean(isViewOnce || messageData.isViewTwice),
        isViewTwice: Boolean(messageData.isViewTwice),
        viewLimit: messageData.isViewTwice ? 2 : (messageData.viewLimit || (isViewOnce ? 1 : 1)),
        viewCounts: {},
        isFogSnap: Boolean(messageData.isFogSnap || messageData.isDustImage),
        isDustImage: Boolean(messageData.isDustImage),
        fogSnapDuration: messageData.fogSnapDuration || 10,
        fogSnapStatus: 'unrevealed',
        viewedBy: [],
        status: initialStatus,
        timestamp: new Date().toISOString(),
        reactions: {},
        replyTo: replyTo || null,
        storyReply: storyReply || messageData.storyReply || null,
        isVanish: Boolean(messageData.isVanish),
        expiresAt
      };

      // 1. Instant Ack to sender
      if (typeof ackCallback === 'function') {
        ackCallback({ success: true, message: newMsg });
      }

      // 2. Immediate zero-latency emission to chat room and participants (deduplicated)
      const targetRooms = new Set();
      if (chatId) targetRooms.add(chatId);
      if (canonicalChatId && canonicalChatId !== chatId) targetRooms.add(canonicalChatId);
      if (senderId) {
        const sRooms = await resolveUserRooms(senderId);
        sRooms.forEach(r => targetRooms.add(r));
      }
      if (resolvedReceiverId && resolvedReceiverId !== 'user') {
        const rRooms = await resolveUserRooms(resolvedReceiverId);
        rRooms.forEach(r => targetRooms.add(r));
      }
      io.to(Array.from(targetRooms)).emit('new_message', newMsg);

      // Auto-update Pulse Streak for 1-on-1 chats
      if (!isGroup && resolvedReceiverId && senderId !== resolvedReceiverId) {
        db.updateChatStreak(chatId, senderId, resolvedReceiverId).then(streakInfo => {
          if (streakInfo) {
            const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
            io.to(chatId).emit('streak_updated', streakInfo);
            if (canonicalChatId && canonicalChatId !== chatId) {
              io.to(canonicalChatId).emit('streak_updated', streakInfo);
            }
            io.to(`user_${senderId}`).emit('streak_updated', streakInfo);
            io.to(`user_${resolvedReceiverId}`).emit('streak_updated', streakInfo);

            if (streakInfo.bonusSparks > 0 || streakInfo.milestoneHit === 3) {
              const rewardPayload = {
                bonusSparks: streakInfo.bonusSparks || 15,
                streakCount: streakInfo.streakCount,
                milestoneHit: streakInfo.milestoneHit,
                auraUnlocked: streakInfo.auraUnlocked || (streakInfo.streakCount >= 3 ? 'neon_flame' : null)
              };
              io.to(`user_${senderId}`).emit('streak_sparks_reward', rewardPayload);
              io.to(`user_${resolvedReceiverId}`).emit('streak_sparks_reward', rewardPayload);
              // Fetch latest sparks and notify
              User.findOne({ $or: [{ id: senderId }, { username: senderId }] }).select('pulseSparks hasNeonFlameAura').lean().then(u => {
                if (u) {
                  io.to(`user_${senderId}`).emit('sparks_updated', { pulseSparks: u.pulseSparks });
                  io.to(`user_${senderId}`).emit('user_profile_updated', { userId: senderId, hasNeonFlameAura: u.hasNeonFlameAura });
                }
              }).catch(() => {});
              User.findOne({ $or: [{ id: resolvedReceiverId }, { username: resolvedReceiverId }] }).select('pulseSparks hasNeonFlameAura').lean().then(u => {
                if (u) {
                  io.to(`user_${resolvedReceiverId}`).emit('sparks_updated', { pulseSparks: u.pulseSparks });
                  io.to(`user_${resolvedReceiverId}`).emit('user_profile_updated', { userId: resolvedReceiverId, hasNeonFlameAura: u.hasNeonFlameAura });
                }
              }).catch(() => {});
            }
          }
        }).catch(err => {
          console.error('Streak update error:', err);
        });
      }

      // Invalidate Redis recent cache for real-time order update
      if (resolvedReceiverId && !isGroup) {
        redis.invalidateRecent(resolvedReceiverId).catch(() => {});
        redis.invalidateRecent(senderId).catch(() => {});
      } else if (isGroup) {
        redis.invalidateAllRecent().catch(() => {});
      }

      // 3. Concurrently save to MongoDB (zero blocking on emission)
      const savePromise = db.saveMessage(newMsg).catch(err => {
        console.error('Error saving message to DB:', err);
      });

      // Background notifications & Push (non-blocking)
      setImmediate(async () => {
        try {
          await savePromise;
          if (resolvedReceiverId && !isGroup) {
            const bodyText = newMsg.isForwarded
              ? `➡️ Forwarded: ${newMsg.content || newMsg.type}`
              : (newMsg.type === 'text'
                  ? (newMsg.content || 'New message')
                  : (newMsg.type === '3d_text'
                      ? `✨ 3D Text: "${newMsg.content}"`
                      : `Sent a ${newMsg.type}`));
            dispatchWebPush(resolvedReceiverId, `💬 ${resolvedSenderName}`, bodyText, `pc-${chatId}`, chatId, newMsg.id, senderId, false, resolvedSenderAvatar);
          } else if (isGroup) {
            const Group = require('./models/Group');
            const group = await Group.findOne({ id: chatId }).lean();

            if (group && group.members) {
              const notifPayload = {
                ...newMsg,
                isGroup: true,
                groupName: group.name,
                senderName: resolvedSenderName,
                senderAvatar: group.avatar || resolvedSenderAvatar || null
              };
              const bodyText = newMsg.type === 'text'
                ? `${resolvedSenderName}: ${newMsg.content}`
                : (newMsg.type === '3d_text'
                    ? `${resolvedSenderName} sent 3D text: "${newMsg.content}" ✨`
                    : `${resolvedSenderName} sent a ${newMsg.type}`);

              group.members.forEach(memberId => {
                if (memberId !== senderId) {
                  io.to(`user_${memberId}`).emit('new_message', newMsg);
                  io.to(`user_${memberId}`).emit('message_notification', notifPayload);
                  dispatchWebPush(memberId, `👥 ${group.name}`, bodyText, `pc-${chatId}`, chatId, newMsg.id, senderId, true, notifPayload.senderAvatar);
                }
              });
            }
          }
        } catch (bgErr) {
          console.error('Background notification dispatch error:', bgErr);
        }
      });
    } catch (sendErr) {
      console.error('send_message error:', sendErr);
      if (typeof ackCallback === 'function') ackCallback({ error: 'Failed to send message' });
    }
  });

  // Message Delivered Acknowledgment from Recipient - WhatsApp Pure Post Office
  socket.on('message_delivered', async ({ messageId, chatId, senderId }) => {
    try {
      if (!messageId) return;
      // Mark as delivered in MongoDB - RETAIN until read by recipient!
      await Message.updateMany(
        { $or: [{ id: messageId }, { clientTempId: messageId }], status: 'sent' },
        { $set: { status: 'delivered' } }
      );
      const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      const singlePayload = { messageId, chatId, canonicalChatId, status: 'delivered' };
      const multiPayload = { chatId, canonicalChatId, messageIds: [messageId], status: 'delivered' };

      const resolvedSenderId = senderId || ((chatId && chatId.includes('_')) ? chatId.split('_').find(p => p !== socket.userId) : null);

      const targetRooms = new Set();
      if (chatId) targetRooms.add(chatId);
      if (canonicalChatId) targetRooms.add(canonicalChatId);

      if (resolvedSenderId) {
        const sRooms = await resolveUserRooms(resolvedSenderId);
        sRooms.forEach(r => targetRooms.add(r));
      }
      if (chatId && chatId.includes('_')) {
        for (const pId of chatId.split('_')) {
          const pRooms = await resolveUserRooms(pId);
          pRooms.forEach(r => targetRooms.add(r));
        }
      }

      targetRooms.forEach(r => {
        io.to(r).emit('message_delivered_update', singlePayload);
        io.to(r).emit('messages_delivered', multiPayload);
      });
    } catch (err) {
      console.error('Error handling message_delivered ack:', err);
    }
  });

  // View Once Opened Handler (Recipient opened photo/video -> Double Blue Tick & Viewed Badge)
  socket.on('view_once_opened', async ({ messageId, userId, chatId }) => {
    try {
      const updatedMsg = await db.markViewOnceOpened(messageId, userId);
      if (updatedMsg) {
        const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
        const viewPayload = {
          messageId: updatedMsg.id || messageId,
          messageMongoId: String(updatedMsg._id),
          viewedBy: updatedMsg.viewedBy,
          viewCounts: updatedMsg.viewCounts,
          status: updatedMsg.status || 'read'
        };
        const readPayload = { messageId: updatedMsg.id || messageId, messageMongoId: String(updatedMsg._id), chatId, canonicalChatId, status: 'read' };

        if (chatId) io.to(chatId).emit('view_once_updated', viewPayload);
        if (canonicalChatId && canonicalChatId !== chatId) io.to(canonicalChatId).emit('view_once_updated', viewPayload);
        if (chatId && chatId.includes('_')) {
          const parts = chatId.split('_');
          io.to(`${parts[1]}_${parts[0]}`).emit('view_once_updated', viewPayload);
          parts.forEach(uId => {
            io.to(`user_${uId}`).emit('view_once_updated', viewPayload);
            io.to(uId).emit('view_once_updated', viewPayload);
          });
        }

        if (updatedMsg.senderId) {
          io.to(`user_${updatedMsg.senderId}`).emit('view_once_updated', viewPayload);
          io.to(updatedMsg.senderId).emit('view_once_updated', viewPayload);
          io.to(`user_${updatedMsg.senderId}`).emit('message_read_update', readPayload);
          io.to(updatedMsg.senderId).emit('message_read_update', readPayload);
        }
        if (chatId) io.to(chatId).emit('message_read_update', readPayload);
        if (canonicalChatId && canonicalChatId !== chatId) io.to(canonicalChatId).emit('message_read_update', readPayload);
      }
    } catch (err) {
      console.error('view_once_opened error:', err);
    }
  });

  // Poll Vote Handler
  socket.on('vote_poll', async ({ messageId, optionId, userId, chatId }) => {
    const updatedMsg = await db.updatePollVote(messageId, optionId, userId);
    if (updatedMsg) {
      io.to(chatId).emit('poll_updated', { messageId, pollData: updatedMsg.pollData });
    }
  });

  // Poll Edit Handler (Creator can edit question, options, mark correct answer)
  socket.on('edit_poll', async ({ messageId, chatId, pollData }) => {
    const updatedMsg = await db.updatePollData(messageId, pollData);
    if (updatedMsg) {
      io.to(chatId).emit('poll_edited', { messageId, pollData: updatedMsg.pollData });
    }
  });

  // Unsend / Delete Message Handler
  socket.on('delete_message', async ({ messageId, chatId }) => {
    await db.deleteMessage(messageId);
    io.to(chatId).emit('message_deleted', { messageId });
  });

  // Delete Message For Me Handler (Single user deletion)
  socket.on('delete_message_for_me', async ({ messageId, chatId, userId }) => {
    const targetUser = userId || socket.userId;
    if (messageId && targetUser) {
      await db.deleteMessageForMe(messageId, targetUser);
    }
  });

  // Delete Multiple Messages For Me Handler
  socket.on('delete_multiple_messages_for_me', async ({ messageIds, chatId, userId }) => {
    const targetUser = userId || socket.userId;
    if (Array.isArray(messageIds) && targetUser) {
      await db.deleteMultipleMessagesForMe(messageIds, targetUser);
    }
  });

  // Restore Message Handler (Undo Delete)
  socket.on('restore_message', async ({ messageId, chatId }) => {
    const restoredMsg = await db.restoreMessage(messageId);
    if (restoredMsg) {
      io.to(chatId).emit('message_restored', { restoredMsg });
    }
  });

  // Clear Specific Chat Handler
  socket.on('clear_chat', async ({ chatId }) => {
    if (!chatId) return;
    const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
    await db.clearChatMessages(chatId);
    io.to(chatId).emit('chat_cleared', { chatId });
    if (canonicalChatId && canonicalChatId !== chatId) {
      io.to(canonicalChatId).emit('chat_cleared', { chatId: canonicalChatId });
    }
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      io.to(`${parts[1]}_${parts[0]}`).emit('chat_cleared', { chatId: `${parts[1]}_${parts[0]}` });
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_cleared', { chatId });
        io.to(uId).emit('chat_cleared', { chatId });
      });
    }
  });

  // Restore Cleared Chat Handler (Undo Clear Chat)
  socket.on('restore_chat_messages', async ({ chatId, messages }) => {
    await db.restoreChatMessages(messages);
    io.to(chatId).emit('chat_restored', { chatId, messages });
  });

  // Delete Multiple Selected Messages
  socket.on('delete_multiple_messages', async ({ messageIds, chatId }) => {
    await db.deleteMultipleMessages(messageIds);
    io.to(chatId).emit('multiple_messages_deleted', { messageIds, chatId });
  });

  // Restore Multiple Selected Messages (Undo Delete Selected)
  socket.on('restore_multiple_messages', async ({ messageIds, chatId }) => {
    await db.restoreMultipleMessages(messageIds);
    io.to(chatId).emit('multiple_messages_restored', { messageIds, chatId });
  });

  // Vanish Mode Handlers
  socket.on('toggle_vanish_mode', async ({ chatId, enabled, userId }) => {
    if (!chatId) return;
    const actorId = userId || socket.userId;
    const setting = await db.setVanishMode(chatId, enabled, actorId);
    const payload = {
      chatId: setting?.chatId || chatId,
      originalChatId: chatId,
      vanishMode: Boolean(setting?.vanishMode ?? enabled),
      setBy: actorId
    };
    io.to(chatId).emit('chat_vanish_mode_updated', payload);
    if (chatId.includes('_')) {
      const parts = chatId.split('_');
      io.to(`${parts[1]}_${parts[0]}`).emit('chat_vanish_mode_updated', payload);
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_vanish_mode_updated', payload);
        io.to(uId).emit('chat_vanish_mode_updated', payload);
      });
    }
  });

  socket.on('evaporate_vanish_messages', async ({ chatId }) => {
    if (!chatId) return;
    const deletedIds = await db.evaporateVanishMessages(chatId);
    if (deletedIds && deletedIds.length > 0) {
      const payload = {
        chatId,
        deletedMessageIds: deletedIds,
        count: deletedIds.length
      };
      io.to(chatId).emit('vanish_messages_evaporated', payload);
      if (chatId.includes('_')) {
        const parts = chatId.split('_');
        const canonical = parts.sort().join('_');
        io.to(canonical).emit('vanish_messages_evaporated', payload);
        io.to(`${parts[1]}_${parts[0]}`).emit('vanish_messages_evaporated', payload);
        parts.forEach(uId => {
          io.to(`user_${uId}`).emit('vanish_messages_evaporated', payload);
          io.to(uId).emit('vanish_messages_evaporated', payload);
        });
      }
    }
  });

  // Panic Wipe Handler
  socket.on('panic_wipe', async ({ userId }) => {
    await db.panicWipeChats(userId);
    socket.emit('chats_wiped');
  });

  // Read Receipt (Blue Double Tick) - WhatsApp Pure Event-Forwarding
  socket.on('mark_read', async ({ messageId, chatId, userId, senderId, isGhost }) => {
    const readerId = userId || socket.userId;
    const isGhostMode = Boolean(isGhost) || await resolveGhostMode(readerId, chatId);
    const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
    const senderTarget = senderId || ((chatId && chatId.includes('_')) ? chatId.split('_').find(p => p !== readerId) : null);

    const targetRooms = new Set();
    if (chatId) targetRooms.add(chatId);
    if (canonicalChatId) targetRooms.add(canonicalChatId);

    if (senderTarget) {
      const sRooms = await resolveUserRooms(senderTarget);
      sRooms.forEach(r => targetRooms.add(r));
    }
    if (readerId) {
      const rRooms = await resolveUserRooms(readerId);
      rRooms.forEach(r => targetRooms.add(r));
    }
    if (chatId && chatId.includes('_')) {
      for (const pId of chatId.split('_')) {
        const pRooms = await resolveUserRooms(pId);
        pRooms.forEach(r => targetRooms.add(r));
      }
    }

    if (isGhostMode) {
      const delivPayload = { messageId, chatId, canonicalChatId, status: 'delivered' };
      targetRooms.forEach(r => {
        io.to(r).emit('message_delivered_update', delivPayload);
        io.to(r).emit('messages_delivered', { chatId, canonicalChatId, messageIds: [messageId], status: 'delivered' });
      });
      return;
    }

    // Pure Stateless Event-Forwarding: Server acts as Post Office router
    const readPayload = { messageId, chatId, canonicalChatId, status: 'read' };
    const chatReadPayload = { chatId, canonicalChatId, userId: readerId, status: 'read' };

    targetRooms.forEach(r => {
      io.to(r).emit('message_read_update', readPayload);
      io.to(r).emit('chat_read_update', chatReadPayload);
    });

    // Delete read message from MongoDB ONLY after recipient has seen/read it (Blue Tick confirmed)
    if (!isGhostMode && messageId) {
      try {
        const isMongoId = mongoose.Types.ObjectId.isValid(messageId);
        await Message.deleteMany({
          $or: [
            { id: messageId },
            { clientTempId: messageId },
            ...(isMongoId ? [{ _id: messageId }] : [])
          ]
        });
      } catch (e) {}
    }
  });

  // Read Receipt for entire Chat (Blue Double Tick when recipient opens conversation)
  socket.on('mark_chat_read', async ({ chatId, userId, isGhost }) => {
    const readerId = userId || socket.userId;
    const isGhostMode = Boolean(isGhost) || await resolveGhostMode(readerId, chatId);
    const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
    const senderTarget = (chatId && chatId.includes('_')) ? chatId.split('_').find(p => p !== readerId) : null;

    const targetRooms = new Set();
    if (chatId) targetRooms.add(chatId);
    if (canonicalChatId) targetRooms.add(canonicalChatId);

    if (senderTarget) {
      const sRooms = await resolveUserRooms(senderTarget);
      sRooms.forEach(r => targetRooms.add(r));
    }
    if (readerId) {
      const rRooms = await resolveUserRooms(readerId);
      rRooms.forEach(r => targetRooms.add(r));
    }
    if (chatId && chatId.includes('_')) {
      for (const pId of chatId.split('_')) {
        const pRooms = await resolveUserRooms(pId);
        pRooms.forEach(r => targetRooms.add(r));
      }
    }

    if (isGhostMode) {
      const delivPayload = { chatId, canonicalChatId, status: 'delivered' };
      targetRooms.forEach(r => io.to(r).emit('messages_delivered', delivPayload));
      return;
    }

    const chatReadPayload = { chatId, canonicalChatId, userId: readerId, status: 'read' };
    targetRooms.forEach(r => io.to(r).emit('chat_read_update', chatReadPayload));

    // Delete read messages from MongoDB ONLY after recipient has seen/read them (Blue Tick confirmed)
    if (!isGhostMode) {
      try {
        await db.markChatAsRead(chatId, readerId, false);
        const candidateChatIds = [chatId, canonicalChatId].filter(Boolean);
        const readerVariants = Array.from(new Set([
          readerId,
          socket.userMongoId,
          socket.userUsername,
          socket.userCustomId
        ].filter(Boolean)));

        await Message.deleteMany({
          $or: [
            { chatId: { $in: candidateChatIds } },
            { receiverId: { $in: readerVariants } }
          ],
          senderId: { $nin: readerVariants }
        });
      } catch (e) {
        console.warn('Error deleting read messages from MongoDB:', e.message);
      }
    }
  });
      }
    }
  });

  // Pulse Aura Soundscapes Synchronization
  socket.on('set_aura', ({ chatId, auraId, userId }) => {
    io.to(chatId).emit('aura_changed', { chatId, auraId, setBy: userId });
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => io.to(`user_${uId}`).emit('aura_changed', { chatId, auraId, setBy: userId }));
    }
  });

  // Chat Live & Custom Wallpaper Real-Time Synchronization
  // Chat Live & Custom Wallpaper Real-Time Synchronization
  socket.on('set_chat_wallpaper', async (data) => {
    if (!data) return;
    const { chatId, wallpaperId, customWallpaperUrl, customImage, userId, setBy, isTrial, trialExpiresAt } = data;
    const finalCustomUrl = customWallpaperUrl || customImage || null;
    const finalUserId = userId || setBy || socket.userId || null;

    let userIsPro = Boolean(socket.userIsPro);
    if (!userIsPro && finalUserId) {
      try {
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(finalUserId);
        const userConditions = [
          { id: String(finalUserId) },
          { username: String(finalUserId) }
        ];
        if (isObjectId) userConditions.push({ _id: finalUserId });
        const u = await User.findOne({ $or: userConditions }).select('isPro proExpiresAt isAdmin').lean();
        if (u && (u.isAdmin || (u.isPro && (!u.proExpiresAt || new Date(u.proExpiresAt) > new Date())))) {
          userIsPro = true;
        }
      } catch (e) {}
    }

    const calculatedTrialExpiresAt = (!userIsPro && (isTrial || trialExpiresAt))
      ? (Number(trialExpiresAt) || (Date.now() + 5 * 60 * 1000))
      : null;

    let setting = null;
    try {
      setting = await db.setChatWallpaper(chatId, wallpaperId, finalCustomUrl, finalUserId, calculatedTrialExpiresAt);
    } catch (e) {
      console.error('Error saving chat wallpaper to database:', e);
    }

    const payload = {
      chatId: setting?.chatId || chatId,
      originalChatId: chatId,
      wallpaperId: setting?.wallpaperId || wallpaperId,
      customWallpaperUrl: setting?.customWallpaperUrl || finalCustomUrl,
      customImage: setting?.customWallpaperUrl || finalCustomUrl,
      userId: finalUserId,
      setBy: finalUserId,
      isTrial: Boolean(calculatedTrialExpiresAt),
      trialExpiresAt: calculatedTrialExpiresAt
    };

    io.to(chatId).emit('chat_wallpaper_updated', payload);
    if (setting?.chatId && setting.chatId !== chatId) {
      io.to(setting.chatId).emit('chat_wallpaper_updated', payload);
    }
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      io.to(`${parts[1]}_${parts[0]}`).emit('chat_wallpaper_updated', payload);
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_wallpaper_updated', payload);
        io.to(uId).emit('chat_wallpaper_updated', payload);
      });
    }

    // Server-side trial auto-expiration timer for 5-minute preview
    if (calculatedTrialExpiresAt) {
      const waitMs = Math.max(1000, calculatedTrialExpiresAt - Date.now());
      setTimeout(async () => {
        const curSetting = await db.getChatSetting(chatId);
        if (curSetting && curSetting.wallpaperId === wallpaperId) {
          const resetSetting = await db.setChatWallpaper(chatId, 'none', null, finalUserId, null);
          const resetPayload = {
            chatId: resetSetting?.chatId || chatId,
            originalChatId: chatId,
            wallpaperId: 'none',
            customWallpaperUrl: null,
            customImage: null,
            userId: finalUserId,
            setBy: 'system',
            trialExpired: true
          };
          io.to(chatId).emit('chat_wallpaper_updated', resetPayload);
          if (chatId.includes('_')) {
            const parts = chatId.split('_');
            io.to(`${parts[1]}_${parts[0]}`).emit('chat_wallpaper_updated', resetPayload);
            parts.forEach(uId => {
              io.to(`user_${uId}`).emit('chat_wallpaper_updated', resetPayload);
              io.to(uId).emit('chat_wallpaper_updated', resetPayload);
            });
          }
        }
      }, waitMs);
    }
  });

  // Chat Solid Color Theme Real-Time Synchronization
  socket.on('set_chat_theme', async ({ chatId, themeId, setBy, userId, isTrial, trialExpiresAt }) => {
    const finalUserId = userId || setBy || socket.userId || null;
    let userIsPro = Boolean(socket.userIsPro);
    if (!userIsPro && finalUserId) {
      try {
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(finalUserId);
        const userConditions = [
          { id: String(finalUserId) },
          { username: String(finalUserId) }
        ];
        if (isObjectId) userConditions.push({ _id: finalUserId });
        const u = await User.findOne({ $or: userConditions }).select('isPro proExpiresAt isAdmin').lean();
        if (u && (u.isAdmin || (u.isPro && (!u.proExpiresAt || new Date(u.proExpiresAt) > new Date())))) {
          userIsPro = true;
        }
      } catch (e) {}
    }

    const calculatedTrialExpiresAt = (!userIsPro && (isTrial || trialExpiresAt))
      ? (Number(trialExpiresAt) || (Date.now() + 5 * 60 * 1000))
      : null;

    let setting = null;
    try {
      setting = await db.setChatTheme(chatId, themeId, finalUserId, calculatedTrialExpiresAt);
    } catch (e) {
      console.error('Error saving chat theme to database:', e);
    }

    const payload = {
      chatId: setting?.chatId || chatId,
      originalChatId: chatId,
      themeId: setting?.chatTheme || themeId,
      setBy: finalUserId,
      isTrial: Boolean(calculatedTrialExpiresAt),
      trialExpiresAt: calculatedTrialExpiresAt
    };
    io.to(chatId).emit('chat_theme_updated', payload);
    if (setting?.chatId && setting.chatId !== chatId) {
      io.to(setting.chatId).emit('chat_theme_updated', payload);
    }
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      io.to(`${parts[1]}_${parts[0]}`).emit('chat_theme_updated', payload);
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_theme_updated', payload);
        io.to(uId).emit('chat_theme_updated', payload);
      });
    }

    // Server-side trial auto-expiration timer for 5-minute theme preview
    if (calculatedTrialExpiresAt) {
      const waitMs = Math.max(1000, calculatedTrialExpiresAt - Date.now());
      setTimeout(async () => {
        const curSetting = await db.getChatSetting(chatId);
        if (curSetting && curSetting.chatTheme === themeId) {
          const resetSetting = await db.setChatTheme(chatId, 'midnight_amoled', finalUserId, null);
          const resetPayload = {
            chatId: resetSetting?.chatId || chatId,
            originalChatId: chatId,
            themeId: 'midnight_amoled',
            setBy: 'system',
            trialExpired: true
          };
          io.to(chatId).emit('chat_theme_updated', resetPayload);
          if (chatId.includes('_')) {
            const parts = chatId.split('_');
            io.to(`${parts[1]}_${parts[0]}`).emit('chat_theme_updated', resetPayload);
            parts.forEach(uId => {
              io.to(`user_${uId}`).emit('chat_theme_updated', resetPayload);
              io.to(uId).emit('chat_theme_updated', resetPayload);
            });
          }
        }
      }, waitMs);
    }
  });

  // Stealth Dust Note Dissolve Handler (Permanent Deletion)
  socket.on('dissolve_stealth_dust', async ({ chatId, messageId, messageMongoId, clientTempId }) => {
    try {
      const orConditions = [];
      if (messageId) {
        orConditions.push({ id: String(messageId) });
        orConditions.push({ clientTempId: String(messageId) });
        if (mongoose.Types.ObjectId.isValid(String(messageId))) {
          orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageId)) });
        }
      }
      if (clientTempId) {
        orConditions.push({ id: String(clientTempId) });
        orConditions.push({ clientTempId: String(clientTempId) });
        if (mongoose.Types.ObjectId.isValid(String(clientTempId))) {
          orConditions.push({ _id: new mongoose.Types.ObjectId(String(clientTempId)) });
        }
      }
      if (messageMongoId && mongoose.Types.ObjectId.isValid(String(messageMongoId))) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(String(messageMongoId)) });
      }

      if (orConditions.length > 0) {
        await Message.deleteMany({ $or: orConditions });
      }

      if (chatId) {
        await redis.invalidateChat(chatId).catch(() => {});
        if (chatId.includes('_')) {
          const parts = chatId.split('_');
          const revChatId = [parts[1], parts[0]].join('_');
          await redis.invalidateChat(revChatId).catch(() => {});
          await redis.invalidateChat(parts[0]).catch(() => {});
          await redis.invalidateChat(parts[1]).catch(() => {});
          redis.invalidateRecent(parts[0]).catch(() => {});
          redis.invalidateRecent(parts[1]).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Stealth dust deletion error:', e.message);
    }
    const payload = { chatId, messageId, messageMongoId, clientTempId };
    if (chatId) io.to(chatId).emit('stealth_dust_dissolved', payload);
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => io.to(`user_${uId}`).emit('stealth_dust_dissolved', payload));
    }
  });

  // Dual-Sided Real-Time Chat Music Track Synchronization
  socket.on('chat_music_changed', ({ chatId, song, senderId }) => {
    const payload = { chatId, song, senderId };
    io.to(chatId).emit('chat_music_updated', payload);
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      const canonical = parts.slice().sort().join('_');
      const reversed = parts.slice().reverse().join('_');
      io.to(canonical).emit('chat_music_updated', payload);
      io.to(reversed).emit('chat_music_updated', payload);
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_music_updated', payload);
        io.to(String(uId)).emit('chat_music_updated', payload);
      });
    }
  });

  // Dual-Sided Real-Time Chat Music Play/Pause/Seek Playback Synchronization
  socket.on('chat_music_action', ({ chatId, action, currentTime, senderId }) => {
    if (!chatId) return;
    const payload = { chatId, action, currentTime, senderId };
    socket.to(chatId).emit('chat_music_action', payload);
    if (chatId.includes('_')) {
      const parts = chatId.split('_');
      const canonical = parts.slice().sort().join('_');
      const reversed = parts.slice().reverse().join('_');
      socket.to(canonical).emit('chat_music_action', payload);
      socket.to(reversed).emit('chat_music_action', payload);
      parts.forEach(uId => {
        if (String(uId) !== String(senderId)) {
          io.to(`user_${uId}`).emit('chat_music_action', payload);
          io.to(String(uId)).emit('chat_music_action', payload);
        }
      });
    }
  });

  // 3D Live Emoji Particle Burst Handler - Dual-Sided Broadcast
  socket.on('trigger_emoji_burst', async ({ chatId, emoji, userId }) => {
    if (!userId || !emoji) return;

    try {
      const u = await User.findOne({
        $or: [
          { id: userId },
          ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
          { username: userId }
        ]
      });

      if (u) {
        const isPro = Boolean(u.isPro && u.proExpiresAt && new Date(u.proExpiresAt) > new Date());
        if (!isPro) {
          const SPARKS_COST = 5;
          const currentSparks = u.pulseSparks || 0;
          if (currentSparks < SPARKS_COST) {
            socket.emit('message_blocked', {
              chatId,
              reason: `Sparks kam hain! Emoji Rain ke liye 5 Sparks lagte hain. Sparks Wallet se Ad dekh kar free Sparks lein.`
            });
            return;
          }
          u.pulseSparks = currentSparks - SPARKS_COST;
          await u.save();
          socket.emit('sparks_updated', { pulseSparks: u.pulseSparks });
          socket.emit('user_profile_updated', { userId, pulseSparks: u.pulseSparks });
        }
      }
    } catch (e) {
      console.error('Error handling sparks for emoji burst:', e);
    }

    const payload = { chatId, emoji, userId };
    io.to(chatId).emit('emoji_burst_received', payload);
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      const canonical = parts.slice().sort().join('_');
      const reversed = parts.slice().reverse().join('_');
      io.to(canonical).emit('emoji_burst_received', payload);
      io.to(reversed).emit('emoji_burst_received', payload);
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('emoji_burst_received', payload);
        io.to(String(uId)).emit('emoji_burst_received', payload);
      });
    }
  });

  // Helper to clear a user's vibe aura across memory, MongoDB, Redis, and all connected clients
  const clearUserAura = async (targetId) => {
    if (!targetId) return;
    const strId = String(targetId);
    userVibeAuras.delete(strId);
    if (socket.userId) userVibeAuras.delete(String(socket.userId));
    if (socket.userMongoId) userVibeAuras.delete(String(socket.userMongoId));
    if (socket.userUsername) userVibeAuras.delete(String(socket.userUsername));
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(strId);
      const clearConditions = [
        { id: strId },
        { username: strId }
      ];
      if (isObjectId) clearConditions.push({ _id: strId });
      await User.updateOne({ $or: clearConditions }, { $unset: { vibeAura: 1 } });
    } catch (e) {}

    redis.invalidateUser(strId).catch(() => {});
    if (socket.userMongoId) redis.invalidateUser(socket.userMongoId).catch(() => {});
    if (socket.userUsername) redis.invalidateUser(socket.userUsername).catch(() => {});

    io.emit('user_profile_updated', {
      userId: strId,
      vibeAura: null
    });

    io.emit('vibe_aura_updated', {
      userId: strId,
      username: socket.userUsername || '',
      cleared: true,
      mood: '',
      isLowBattery: false,
      batteryLevel: null,
      inGame: '',
      auraType: 'none',
      auraColor: null
    });
  };

  // =========================================================================
  // OPTION 3: PULSE VIBE RADAR & LIVE AURA SYNCHRONIZATION
  // =========================================================================
  socket.on('update_vibe_aura', async (auraData) => {
    if (!auraData || !auraData.userId) return;
    const isCleared = Boolean(
      auraData.cleared ||
      auraData.auraType === 'none' ||
      (!auraData.mood && !auraData.isLowBattery && !auraData.inGame)
    );

    if (isCleared) {
      await clearUserAura(auraData.userId);
      return;
    }

    const hasLowBattery = Boolean(auraData.isLowBattery);
    const resolvedUsername = socket.userUsername || auraData.username || '';

    // Check if user is Pro VIP
    let userIsPro = Boolean(socket.userIsPro);
    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(auraData.userId);
      const userConditions = [
        { id: String(auraData.userId) },
        { username: String(auraData.userId) }
      ];
      if (isObjectId) userConditions.push({ _id: auraData.userId });
      if (socket.userId) userConditions.push({ id: String(socket.userId) });
      if (socket.userMongoId) userConditions.push({ _id: socket.userMongoId });
      if (socket.userUsername) userConditions.push({ username: socket.userUsername });

      const uDoc = await User.findOne({ $or: userConditions }).select('isPro proExpiresAt isAdmin').lean();
      if (uDoc && (uDoc.isAdmin || (uDoc.isPro && (!uDoc.proExpiresAt || new Date(uDoc.proExpiresAt) > new Date())))) {
        userIsPro = true;
      }
    } catch (e) {}

    if (auraData.isPro && !auraData.isTrial) {
      userIsPro = true;
    }

    // VIP auras (dragon_glow, cyber_neon) for non-pro users are 5-min trials!
    // BUT for Pro VIP members (or streak unlocked), it is PERMANENT and NEVER expires!
    const isVipAura = auraData.auraType === 'dragon_glow' || auraData.auraType === 'cyber_neon';
    const isTrial = userIsPro ? Boolean(auraData.isTrial && auraData.trialExpiresAt) : Boolean(auraData.isTrial || auraData.trialExpiresAt || isVipAura);
    const trialExpiresAt = isTrial ? (Number(auraData.trialExpiresAt) || (Date.now() + 5 * 60 * 1000)) : null;

    const clean = {
      userId: auraData.userId,
      username: resolvedUsername,
      mood: (auraData.mood || '').trim(),
      emoji: auraData.emoji || '⚡',
      auraColor: auraData.auraColor || '#a855f7',
      auraType: auraData.auraType || 'neon_pulse',
      isLowBattery: hasLowBattery,
      batteryLevel: hasLowBattery && typeof auraData.batteryLevel === 'number' ? auraData.batteryLevel : null,
      inGame: auraData.inGame || '',
      isTrial: Boolean(isTrial),
      trialExpiresAt: trialExpiresAt,
      updatedAt: new Date().toISOString()
    };
    userVibeAuras.set(String(auraData.userId), clean);
    if (resolvedUsername) userVibeAuras.set(String(resolvedUsername), clean);
    if (socket.userId) userVibeAuras.set(String(socket.userId), clean);
    if (socket.userMongoId) userVibeAuras.set(String(socket.userMongoId), clean);

    try {
      const mongoose = require('mongoose');
      const isObjectId = mongoose.Types.ObjectId.isValid(auraData.userId);
      const updateConditions = [
        { id: String(auraData.userId) },
        { username: String(auraData.userId) }
      ];
      if (isObjectId) updateConditions.push({ _id: auraData.userId });
      await User.updateOne({ $or: updateConditions }, { vibeAura: clean });
    } catch (e) {}

    // Invalidate Redis user profile cache
    redis.invalidateUser(auraData.userId).catch(() => {});
    if (socket.userMongoId) redis.invalidateUser(socket.userMongoId).catch(() => {});
    if (socket.userUsername) redis.invalidateUser(socket.userUsername).catch(() => {});

    io.emit('user_profile_updated', {
      userId: auraData.userId,
      vibeAura: clean
    });

    io.emit('vibe_aura_updated', clean);

    // If trial, schedule exact server-side expiration timer
    if (clean.isTrial && clean.trialExpiresAt) {
      const waitMs = Math.max(1000, clean.trialExpiresAt - Date.now());
      setTimeout(async () => {
        const cur = userVibeAuras.get(String(auraData.userId));
        if (cur && cur.isTrial && cur.trialExpiresAt && Date.now() >= cur.trialExpiresAt - 1000) {
          await clearUserAura(auraData.userId);
        }
      }, waitMs);
    }
  });

  socket.on('get_vibe_auras', () => {
    const now = Date.now();
    for (const [k, v] of userVibeAuras.entries()) {
      if (v && v.isTrial && v.trialExpiresAt && now > Number(v.trialExpiresAt)) {
        userVibeAuras.delete(k);
      }
    }
    socket.emit('vibe_auras_list', Object.fromEntries(userVibeAuras.entries()));
  });

  // =========================================================================
  // OPTION 2: FOG SNAPS (SCRATCH-TO-REVEAL & SCREENSHOT ALERT)
  // =========================================================================
  socket.on('reveal_fog_snap', async ({ messageId, chatId, userId }) => {
    try {
      const mongoose = require('mongoose');
      const query = { $or: [{ id: messageId }] };
      if (mongoose.Types.ObjectId.isValid(messageId)) {
        query.$or.push({ _id: messageId });
      }
      const existing = await Message.findOne(query);
      if (!existing) return;

      const callerId = String(userId || socket.userId || '');
      if (callerId && (String(existing.senderId) === callerId)) {
        return; // Sender viewing their own sent media never triggers reveal broadcast
      }

      await Message.updateOne(query, { fogSnapStatus: 'revealed' });
      if (chatId) {
        io.to(chatId).emit('fog_snap_revealed', { messageId, chatId, revealedBy: callerId });
        if (chatId.includes('_')) {
          chatId.split('_').forEach(uId => io.to(`user_${uId}`).emit('fog_snap_revealed', { messageId, chatId, revealedBy: callerId }));
        }
      }
    } catch (e) {}
  });

  socket.on('burn_fog_snap', async ({ messageId, chatId }) => {
    try {
      const mongoose = require('mongoose');
      const redis = require('./utils/redis');
      const query = { $or: [{ id: messageId }] };
      if (mongoose.Types.ObjectId.isValid(messageId)) {
        query.$or.push({ _id: messageId });
      }
      const existing = await Message.findOne(query);
      if (!existing) return;

      const callerId = String(socket.userId || '');
      if (callerId && (String(existing.senderId) === callerId)) {
        return; // Sender closing or viewing sent dust image must NEVER burn it for recipient!
      }

      await Message.deleteOne(query);
      if (chatId) {
        await redis.invalidateChat(chatId).catch(() => {});
        if (chatId.includes('_')) {
          const parts = chatId.split('_');
          const revChatId = `${parts[1]}_${parts[0]}`;
          await redis.invalidateChat(revChatId).catch(() => {});
          await redis.invalidateChat(parts[0]).catch(() => {});
          await redis.invalidateChat(parts[1]).catch(() => {});
          redis.invalidateRecent(parts[0]).catch(() => {});
          redis.invalidateRecent(parts[1]).catch(() => {});
        }
        io.to(chatId).emit('fog_snap_burned', { messageId, chatId });
        if (chatId.includes('_')) {
          chatId.split('_').forEach(uId => io.to(`user_${uId}`).emit('fog_snap_burned', { messageId, chatId }));
        }
      }
    } catch (e) {}
  });

  socket.on('snap_screenshot_alert', async ({ messageId, chatId, userId, userName }) => {
    const alertData = {
      messageId,
      chatId,
      takenBy: userId,
      userName: userName || 'User',
      timestamp: new Date().toISOString()
    };
    try {
      await Message.updateOne({ id: messageId }, { screenshotAlert: alertData });
    } catch (e) {}
    if (chatId) {
      io.to(chatId).emit('snap_screenshot_alert', alertData);
      if (chatId.includes('_')) {
        chatId.split('_').forEach(uId => io.to(`user_${uId}`).emit('snap_screenshot_alert', alertData));
      }
    }
  });

  socket.on('mark_chat_read', async ({ chatId, userId, isGhost }) => {
    const readerId = userId || socket.userId;
    const isGhostMode = Boolean(isGhost) || await resolveGhostMode(readerId, chatId);
    const canonicalChatId = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;

    await db.markChatAsRead(chatId, readerId, isGhostMode);

    // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
    if (readerId) {
      io.to(`user_${readerId}`).emit('chat_read_update', { chatId, canonicalChatId, userId: readerId });
      io.to(readerId).emit('chat_read_update', { chatId, canonicalChatId, userId: readerId });
      redis.invalidateRecent(readerId).catch(() => {});
    }
    socket.emit('chat_read_update', { chatId, canonicalChatId, userId: readerId });

    const otherId = await getOtherParticipantId(chatId, readerId);

    if (isGhostMode) {
      // In Ghost Mode: emit DELIVERED (double grey tick) to sender, NEVER blue tick!
      const ghostPayload = { chatId, canonicalChatId, status: 'delivered' };
      if (chatId) io.to(chatId).emit('messages_delivered', ghostPayload);
      if (canonicalChatId && canonicalChatId !== chatId) io.to(canonicalChatId).emit('messages_delivered', ghostPayload);
      if (otherId) {
        io.to(`user_${otherId}`).emit('messages_delivered', ghostPayload);
        io.to(otherId).emit('messages_delivered', ghostPayload);
      }
      return;
    }

    // Normal Mode: emit READ (double blue tick)
    const normalPayload = { chatId, canonicalChatId, userId: readerId, status: 'read' };
    if (chatId) io.to(chatId).emit('chat_read_update', normalPayload);
    if (canonicalChatId && canonicalChatId !== chatId) io.to(canonicalChatId).emit('chat_read_update', normalPayload);
    if (otherId) {
      io.to(`user_${otherId}`).emit('chat_read_update', normalPayload);
      io.to(otherId).emit('chat_read_update', normalPayload);
    }
  });

  // Toggle Disappearing Messages via Socket
  socket.on('toggle_disappearing', async ({ chatId, enabled, userId }) => {
    const setting = await db.setDisappearingMessages(chatId, enabled, userId);
    const sysMsg = {
      id: 'msg_sys_' + Date.now(),
      chatId,
      senderId: 'system',
      receiverId: '',
      isGroup: !chatId.includes('_'),
      type: 'system',
      content: enabled ? '⏱️ Messages in this chat will disappear 24 hours after being sent.' : '⏱️ Disappearing messages was turned off.',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    await db.saveMessage(sysMsg);
    io.to(chatId).emit('chat_setting_updated', setting);
    io.to(chatId).emit('new_message', sysMsg);
    if (chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => {
        io.to(`user_${uId}`).emit('chat_setting_updated', setting);
        io.to(`user_${uId}`).emit('new_message', sysMsg);
      });
    }
  });

  // Emoji Reaction
  socket.on('add_reaction', async ({ messageId, chatId, emoji, userId }) => {
    const updatedMsg = await db.toggleReaction(messageId, emoji, userId);
    if (updatedMsg) {
      const userReactions = updatedMsg.reactions?.[emoji] || [];
      const isAdded = userReactions.includes(userId);
      const canonicalChatId = updatedMsg.chatId || chatId;
      const payload = { messageId: updatedMsg.id || messageId, chatId: canonicalChatId, reactions: updatedMsg.reactions, emoji, userId, isAdded };

      const targetRooms = new Set();
      if (chatId) targetRooms.add(chatId);
      if (canonicalChatId) targetRooms.add(canonicalChatId);
      if (canonicalChatId && canonicalChatId.includes('_')) {
        for (const uId of canonicalChatId.split('_')) {
          const uRooms = await resolveUserRooms(uId);
          uRooms.forEach(r => targetRooms.add(r));
          redis.invalidateRecent(uId).catch(() => {});
        }
      }

      targetRooms.forEach(r => io.to(r).emit('reaction_updated', payload));

      // A reaction proves beyond doubt that recipient has SEEN & READ the message!
      const isAuthor = updatedMsg.senderId && (
        String(updatedMsg.senderId) === String(userId) ||
        (socket.userMongoId && String(updatedMsg.senderId) === String(socket.userMongoId)) ||
        (socket.userUsername && String(updatedMsg.senderId) === String(socket.userUsername))
      );
      if (!isAuthor && isAdded) {
        const readPayload = { messageId: updatedMsg.id || messageId, chatId: canonicalChatId, status: 'read' };
        const chatReadPayload = { chatId: canonicalChatId, userId, status: 'read' };
        targetRooms.forEach(r => {
          io.to(r).emit('message_read_update', readPayload);
          io.to(r).emit('chat_read_update', chatReadPayload);
        });

        // Delete read message from MongoDB upon reaction read confirmation
        try {
          await Message.deleteMany({
            $or: [
              { id: updatedMsg.id || messageId },
              { clientTempId: updatedMsg.id || messageId },
              ...(mongoose.Types.ObjectId.isValid(messageId) ? [{ _id: messageId }] : [])
            ]
          });
        } catch (e) {}
      }
    }
  });

  // Real-Time Collaborative Whiteboard
  socket.on('wb_join', ({ chatId }) => {
    socket.join(chatId);
  });

  socket.on('wb_draw', ({ chatId, stroke }) => {
    socket.to(chatId).emit('wb_draw', stroke);
  });

  socket.on('wb_shape', ({ chatId, shape }) => {
    socket.to(chatId).emit('wb_shape', shape);
  });

  socket.on('wb_sticker', ({ chatId, sticker }) => {
    socket.to(chatId).emit('wb_sticker', sticker);
  });

  socket.on('wb_clear', ({ chatId }) => {
    socket.to(chatId).emit('wb_clear');
  });

  socket.on('wb_restore', ({ chatId, boardDataUrl }) => {
    socket.to(chatId).emit('wb_restore', { boardDataUrl });
  });

  socket.on('wb_text', ({ chatId, textItem }) => {
    socket.to(chatId).emit('wb_text', textItem);
  });

  socket.on('wb_text_update', ({ chatId, textItems }) => {
    socket.to(chatId).emit('wb_text_update', textItems);
  });

  socket.on('wb_board_color', ({ chatId, boardColor }) => {
    socket.to(chatId).emit('wb_board_color', { boardColor });
  });

  socket.on('wb_sticker_update', ({ chatId, stickerItems }) => {
    socket.to(chatId).emit('wb_sticker_update', stickerItems);
  });

  socket.on('wb_undo', ({ chatId, boardDataUrl }) => {
    socket.to(chatId).emit('wb_undo', { boardDataUrl });
  });

  // Real-Time Live Arrow Battle Game Socket Handlers
  socket.on('arrow_game_start', (data) => {
    if (data && data.chatId) {
      io.to(data.chatId).emit('arrow_game_start', data);
    }
  });

  socket.on('arrow_game_match_started', (data) => {
    if (data && data.chatId) {
      io.to(data.chatId).emit('arrow_game_match_started', data);
    }
  });

  socket.on('arrow_tap', (data) => {
    if (data && data.chatId) {
      io.to(data.chatId).emit('arrow_tap', data);
    }
  });

  // Real-Time Tic-Tac-Toe Arena Handlers
  const relayTicTacToeEvent = (eventName, data) => {
    if (!data || !data.chatId) return;
    socket.to(data.chatId).emit(eventName, data);
    if (data.chatId.includes('_')) {
      const parts = data.chatId.split('_');
      const canonical = parts.slice().sort().join('_');
      if (canonical !== data.chatId) socket.to(canonical).emit(eventName, data);
      parts.forEach(pId => {
        socket.to(`user_${pId}`).emit(eventName, data);
        socket.to(pId).emit(eventName, data);
      });
    }
  };

  socket.on('tictactoe_join', (data) => relayTicTacToeEvent('tictactoe_join', data));
  socket.on('tictactoe_state', (data) => relayTicTacToeEvent('tictactoe_state', data));
  socket.on('tictactoe_move', (data) => relayTicTacToeEvent('tictactoe_move', data));
  socket.on('tictactoe_reset', (data) => relayTicTacToeEvent('tictactoe_reset', data));

  // Audio/Video Call WebRTC Signaling (1-to-1)
  socket.on('call_user', async ({ userToCall, signalData, from, callerName, callerAvatar, isVideo }) => {
    // Check if target user has blocked caller or caller has blocked target user
    const blockStatus = await db.isUserBlocked(from, userToCall);
    if (blockStatus.isBlocked) {
      socket.emit('call_rejected', {
        reason: blockStatus.bBlockedA
          ? 'Cannot call this contact because you are blocked.'
          : 'You have blocked this contact. Unblock to call.'
      });
      return;
    }

    const payload = { signal: signalData, from, callerName, callerAvatar, isVideo };
    const recipientSocket = onlineUsers.get(userToCall);
    if (recipientSocket) {
      io.to(recipientSocket).emit('incoming_call', payload);
    }
    io.to(`user_${userToCall}`).to(userToCall).emit('incoming_call', payload);

    // Also dispatch background web push so recipient gets ringing notification even if browser/app is backgrounded
    dispatchWebPush(
      userToCall,
      `📞 Incoming ${isVideo ? 'Video' : 'Voice'} Call`,
      `${callerName || 'Someone'} is calling you...`,
      `pc-call-${from}`,
      from,
      null,
      from,
      false,
      callerAvatar || null
    );
  });

  socket.on('answer_call', (data) => {
    const callerSocket = onlineUsers.get(data.to);
    if (callerSocket) {
      io.to(callerSocket).emit('call_accepted', data.signal);
    }
    io.to(`user_${data.to}`).to(data.to).emit('call_accepted', data.signal);
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('ice_candidate', { candidate });
    }
    io.to(`user_${to}`).to(to).emit('ice_candidate', { candidate });
  });

  socket.on('reject_call', ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('call_rejected');
    }
    io.to(`user_${to}`).to(to).emit('call_rejected');
  });

  socket.on('end_call', ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('call_ended');
    }
    io.to(`user_${to}`).to(to).emit('call_ended');
  });

  // --- REAL-TIME MULTI-PARTY GROUP CALL SIGNALING ---
  const activeGroupCalls = new Map(); // groupId -> { groupName, isVideo, participants: Map(socketId -> { userId, displayName, avatar, socketId }) }

  socket.on('start_group_call', async ({ groupId, groupName, isVideo, callerId, callerName, callerAvatar, memberIds }) => {
    const callRoomId = `group_call_${groupId}`;
    socket.join(callRoomId);

    const participantInfo = { userId: callerId, displayName: callerName, avatar: callerAvatar, socketId: socket.id };

    if (!activeGroupCalls.has(groupId)) {
      activeGroupCalls.set(groupId, {
        groupId,
        groupName,
        isVideo,
        initiatorId: callerId,
        participants: new Map([[socket.id, participantInfo]])
      });

      // Save Group Call Started message to DB & emit to group chat
      const callMsg = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
        chatId: groupId,
        senderId: callerId,
        receiverId: '',
        isGroup: true,
        type: 'call',
        content: isVideo ? 'Group Video Call Started' : 'Group Voice Call Started',
        callData: {
          isVideo,
          status: 'ongoing',
          duration: 0
        },
        status: 'sent',
        timestamp: new Date().toISOString()
      };
      await db.saveMessage(callMsg);
      io.to(groupId).emit('new_message', callMsg);
    } else {
      activeGroupCalls.get(groupId).participants.set(socket.id, participantInfo);
    }

    // Notify all online group members & send web push
    if (Array.isArray(memberIds)) {
      memberIds.forEach(mId => {
        if (mId !== callerId) {
          const mSocketId = onlineUsers.get(mId);
          if (mSocketId) {
            io.to(mSocketId).emit('incoming_group_call', {
              groupId,
              groupName,
              isVideo,
              callerId,
              callerName,
              callerAvatar
            });
          }
          dispatchWebPush(
            mId,
            `📞 Group ${isVideo ? 'Video' : 'Voice'} Call`,
            `${callerName || 'Someone'} started a group call in ${groupName}`,
            `pc-call-${groupId}`,
            groupId,
            null,
            callerId,
            true,
            callerAvatar || null
          );
        }
      });
    }

    socket.emit('group_call_started', {
      groupId,
      groupName,
      isVideo,
      participants: [participantInfo]
    });
  });

  socket.on('join_group_call', ({ groupId, userId, displayName, avatar, isVideo }) => {
    const callRoomId = `group_call_${groupId}`;
    socket.join(callRoomId);

    const participantInfo = { userId, displayName, avatar, socketId: socket.id };
    let groupCall = activeGroupCalls.get(groupId);

    if (!groupCall) {
      groupCall = {
        groupId,
        groupName: 'Group Call',
        isVideo,
        participants: new Map()
      };
      activeGroupCalls.set(groupId, groupCall);
    }

    groupCall.participants.set(socket.id, participantInfo);
    const allParticipants = Array.from(groupCall.participants.values());

    socket.emit('group_call_joined', {
      groupId,
      groupName: groupCall.groupName,
      isVideo: groupCall.isVideo,
      participants: allParticipants
    });

    socket.to(callRoomId).emit('group_call_user_joined', {
      participant: participantInfo,
      participants: allParticipants
    });
  });

  socket.on('group_call_peer_signal', ({ toSocketId, fromSocketId, signal, candidate }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('group_call_peer_signal', {
        fromSocketId,
        signal,
        candidate
      });
    }
  });

  socket.on('leave_group_call', async ({ groupId, userId }) => {
    const callRoomId = `group_call_${groupId}`;
    socket.leave(callRoomId);

    const groupCall = activeGroupCalls.get(groupId);
    if (groupCall) {
      groupCall.participants.delete(socket.id);
      const remaining = Array.from(groupCall.participants.values());

      if (remaining.length === 0) {
        const lastGroupCall = { ...groupCall };
        activeGroupCalls.delete(groupId);

        // Save Group Call Ended message to DB & emit to group chat
        const endedMsg = {
          id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
          chatId: groupId,
          senderId: userId,
          receiverId: '',
          isGroup: true,
          type: 'call',
          content: lastGroupCall.isVideo ? 'Group Video Call Ended' : 'Group Voice Call Ended',
          callData: {
            isVideo: lastGroupCall.isVideo,
            status: 'completed',
            duration: 0
          },
          status: 'sent',
          timestamp: new Date().toISOString()
        };
        await db.saveMessage(endedMsg);
        io.to(groupId).emit('new_message', endedMsg);
      } else {
        io.to(callRoomId).emit('group_call_user_left', {
          socketId: socket.id,
          userId,
          participants: remaining
        });
      }
    }
  });

  // Real-time Auto-Open Modal Requests (Live Arrow Game, Tic-Tac-Toe, Live Drawboard, Music)
  const broadcastActivityOpen = (event, data) => {
    if (!data || !data.chatId) return;
    io.to(data.chatId).emit(event, data);
    if (data.chatId.includes('_')) {
      const canonical = data.chatId.split('_').sort().join('_');
      if (canonical !== data.chatId) io.to(canonical).emit(event, data);
    }
    if (data.receiverId) {
      io.to(`user_${data.receiverId}`).emit(event, data);
      io.to(data.receiverId).emit(event, data);
    }
  };

  socket.on('request_open_arrow_game', (data) => broadcastActivityOpen('auto_open_arrow_game', data));
  socket.on('request_open_whiteboard', (data) => broadcastActivityOpen('auto_open_whiteboard', data));
  socket.on('request_open_tictactoe', (data) => broadcastActivityOpen('auto_open_tictactoe', data));
  socket.on('request_open_music', (data) => broadcastActivityOpen('auto_open_music', data));

  // Symmetrical two-way close synchronization for live activities
  socket.on('request_close_arrow_game', (data) => broadcastActivityOpen('auto_close_arrow_game', data));
  socket.on('request_close_whiteboard', (data) => broadcastActivityOpen('auto_close_whiteboard', data));
  socket.on('request_close_tictactoe', (data) => broadcastActivityOpen('auto_close_tictactoe', data));

  // =========================================================================
  // REAL-TIME IN-GAME VOICE CHAT (FREE FIRE / DISCORD GAMING MIC & AUDIO)
  // =========================================================================
  socket.on('game_voice_join', ({ chatId, userId, userName, userAvatar }) => {
    if (!chatId || !userId) return;
    const canonicalChatId = String(chatId).includes('_') ? String(chatId).split('_').sort().join('_') : String(chatId);
    const room = `game_voice_${canonicalChatId}`;
    socket.join(room);
    if (room !== `game_voice_${chatId}`) {
      socket.join(`game_voice_${chatId}`);
    }
    socket.gameVoiceChatId = canonicalChatId;
    socket.gameVoiceUserId = String(userId);

    // Get any existing peers already in this game voice room
    const roomSet = io.sockets.adapter.rooms.get(room);
    const existingPeerSockets = Array.from(roomSet || []).filter(sId => sId !== socket.id);

    // Inform existing room peers that a new player joined
    socket.to(room).to(`game_voice_${chatId}`).emit('game_voice_peer_joined', {
      userId: String(userId),
      userName,
      userAvatar,
      socketId: socket.id
    });

    // Inform the joining player about existing peers in the room
    if (existingPeerSockets.length > 0) {
      const existingPeers = existingPeerSockets.map(sId => {
        const peerSock = io.sockets.sockets.get(sId);
        return {
          socketId: sId,
          userId: peerSock?.gameVoiceUserId || ''
        };
      }).filter(p => Boolean(p.userId));

      socket.emit('game_voice_room_users', { peers: existingPeers });
    }
  });

  socket.on('game_voice_signal', ({ chatId, toUserId, fromUserId, signal, type, toSocketId }) => {
    if (!chatId) return;
    const canonical = String(chatId).includes('_') ? String(chatId).split('_').sort().join('_') : String(chatId);
    const payload = {
      fromUserId: String(fromUserId || socket.gameVoiceUserId || ''),
      fromSocketId: socket.id,
      signal,
      type
    };

    if (toSocketId) {
      io.to(toSocketId).emit('game_voice_signal', payload);
    } else if (toUserId) {
      io.to(`user_${toUserId}`).to(String(toUserId)).emit('game_voice_signal', payload);
    } else {
      socket.to(`game_voice_${canonical}`).to(`game_voice_${chatId}`).emit('game_voice_signal', payload);
    }
  });

  socket.on('game_voice_state', ({ chatId, userId, isMuted, isDeafened }) => {
    if (!chatId) return;
    const canonical = String(chatId).includes('_') ? String(chatId).split('_').sort().join('_') : String(chatId);
    const room = `game_voice_${canonical}`;
    socket.to(room).to(`game_voice_${chatId}`).emit('game_voice_state_changed', {
      userId,
      isMuted,
      isDeafened
    });
  });

  socket.on('game_voice_leave', ({ chatId, userId }) => {
    if (!chatId) return;
    const canonical = String(chatId).includes('_') ? String(chatId).split('_').sort().join('_') : String(chatId);
    const room = `game_voice_${canonical}`;
    socket.leave(room);
    socket.leave(`game_voice_${chatId}`);
    socket.to(room).to(`game_voice_${chatId}`).emit('game_voice_peer_left', { userId });
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.gameVoiceChatId && socket.gameVoiceUserId) {
      io.to(`game_voice_${socket.gameVoiceChatId}`).emit('game_voice_peer_left', { userId: socket.gameVoiceUserId });
    }
    const toDelete = [socket.userId, socket.userCustomId, socket.userMongoId, socket.userUsername].filter(Boolean);
    toDelete.forEach(id => onlineUsers.delete(String(id)));
    if (socket.userId && !hiddenOnlineUsers.has(socket.userId)) {
      io.emit('user_status', { userId: socket.userId, status: 'offline', lastSeen: new Date().toISOString() });
    }
    io.emit('online_users_list', getPublicOnlineUsers());
    console.log('⚡ Socket Disconnected:', socket.id);
  });
});

mongoose.connect(config.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    try {
      const VapidKey = require('./models/VapidKey');
      await webpush.syncWithMongo(VapidKey);
    } catch (e) {
      console.warn('VapidKey sync warning:', e.message);
    }

    // Hydrate userVibeAuras from MongoDB on startup so active vibes survive server restarts
    try {
      const now = Date.now();
      for (const u of usersWithVibes) {
        if (u.vibeAura && !u.vibeAura.cleared && u.vibeAura.auraType !== 'none') {
          if (u.vibeAura.trialExpiresAt && now > Number(u.vibeAura.trialExpiresAt)) {
            User.updateOne({ _id: u._id }, { $unset: { vibeAura: 1 } }).catch(() => {});
            continue;
          }
          const clean = {
            ...u.vibeAura,
            userId: u.id || u.username,
            username: u.username || ''
          };
          if (u.id) userVibeAuras.set(String(u.id), clean);
          if (u._id) userVibeAuras.set(String(u._id), clean);
          if (u.username) userVibeAuras.set(String(u.username), clean);
        }
      }
      console.log(`[VibeRadar] Hydrated ${userVibeAuras.size} user vibe auras from DB`);

      // Server-wide background sweeper every 5 seconds for aura trial expiration
      setInterval(async () => {
        const curTime = Date.now();
        const expiredUserIds = new Set();
        for (const [k, val] of userVibeAuras.entries()) {
          if (val && val.isTrial && val.trialExpiresAt && curTime >= Number(val.trialExpiresAt)) {
            expiredUserIds.add(String(val.userId || k));
          }
        }
        for (const uid of expiredUserIds) {
          userVibeAuras.delete(uid);
          try {
            const isObjectId = mongoose.Types.ObjectId.isValid(uid);
            await User.updateOne({
              $or: [
                { id: uid },
                { username: uid },
                ...(isObjectId ? [{ _id: uid }] : [])
              ]
            }, { $unset: { vibeAura: 1 } });
          } catch (e) {}
          redis.invalidateUser(uid).catch(() => {});
          io.emit('user_profile_updated', { userId: uid, vibeAura: null });
          io.emit('vibe_aura_updated', {
            userId: uid,
            cleared: true,
            mood: '',
            isLowBattery: false,
            batteryLevel: null,
            inGame: '',
            auraType: 'none',
            auraColor: null
          });
        }
      }, 5000);
    } catch (vhErr) {
      console.warn('[VibeRadar] Vibe hydration warning:', vhErr.message);
    }
    server.listen(config.PORT, () => {
      console.log(`🚀 PulseChat Backend running on port ${config.PORT}`);

      // keep-alive ping
      const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || 'https://pulsechat-api-v2.onrender.com';
      if (renderUrl) {
        console.log(`Keep-Alive activated for: ${renderUrl}`);
        setInterval(() => {
          try {
            const https = renderUrl.startsWith('https') ? require('https') : require('http');
            https.get(`${renderUrl}/api/health`, (res) => {
            }).on('error', (err) => {
              console.warn('Keep-alive ping error:', err.message);
            });
          } catch (pingErr) {}
        }, 10 * 60 * 1000);
      }

      // WhatsApp Post Office auto-cleanup: 7-day max queue protection
      const AUTO_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000;
      setTimeout(async () => {
        try {
          console.log('Running 7-day Post Office queue cleanup (WhatsApp-style DB protection)...');
          await db.runAutoCleanupJob(7);
        } catch (e) {
          console.warn('Auto-cleanup startup error:', e.message);
        }
      }, 60 * 1000);

      setInterval(async () => {
        try {
          console.log('Running periodic 7-day Post Office queue cleanup...');
          await db.runAutoCleanupJob(7);
        } catch (e) {
          console.warn('Auto-cleanup interval error:', e.message);
        }
      }, AUTO_CLEANUP_INTERVAL);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
