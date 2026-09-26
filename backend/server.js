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
const { uploadToCloudinary } = require('./utils/cloudinary');
const redis = require('./utils/redis');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Middleware to catch body parser errors (e.g. 413 Payload Too Large) as JSON instead of HTML
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'File size too large. Please upload an image under 10MB.' });
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

// Socket.io Real-Time Engine
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 5000,
  pingTimeout: 5000
});

app.set('io', io);

const resolveGhostMode = async (userId) => {
  if (!userId) return false;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const u = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    }).select('hideReadReceipts').lean();
    return Boolean(u && u.hideReadReceipts);
  } catch {
    return false;
  }
};

const onlineUsers = new Map(); // userId -> socketId
const hiddenOnlineUsers = new Set(); // userId set of users with hideOnlineStatus enabled

const getPublicOnlineUsers = () => {
  return Array.from(onlineUsers.keys()).filter(id => !hiddenOnlineUsers.has(id));
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

io.on('connection', (socket) => {
  console.log('⚡ Socket Connected:', socket.id);

  // User explicitly signals going offline (data turned off / app hidden)
  socket.on('user_offline', (userId) => {
    const id = userId || socket.userId;
    if (id) {
      onlineUsers.delete(id);
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

        if (uDoc.id && uDoc.id !== userId) {
          socket.join(`user_${uDoc.id}`);
          socket.join(uDoc.id);
          onlineUsers.set(uDoc.id, socket.id);
        }
        if (uDoc._id) {
          const strId = uDoc._id.toString();
          if (strId !== userId) {
            socket.join(`user_${strId}`);
            socket.join(strId);
          }
        }
        if (uDoc.username && uDoc.username !== userId) {
          socket.join(`user_${uDoc.username}`);
          socket.join(uDoc.username);
        }
      }
    } catch {}

    if (!hiddenOnlineUsers.has(userId)) {
      io.emit('user_status', { userId, status: 'online' });
    }
    io.emit('online_users_list', getPublicOnlineUsers());

    // Mobile data on ya user connect hone par pending 'sent' messages ko 'delivered' mark karo
    try {
      const pendingMsgs = await Message.find({ receiverId: userId, status: 'sent' }).lean();
      if (pendingMsgs.length > 0) {
        await Message.updateMany({ receiverId: userId, status: 'sent' }, { status: 'delivered' });

        // Sender ko notify karo taaki unke screen par Single Tick turant Double Tick bann jaye
        const senderMap = {};
        for (const msg of pendingMsgs) {
          if (!senderMap[msg.senderId]) senderMap[msg.senderId] = {};
          if (!senderMap[msg.senderId][msg.chatId]) senderMap[msg.senderId][msg.chatId] = [];
          senderMap[msg.senderId][msg.chatId].push(msg.id);
        }

        for (const [sId, chats] of Object.entries(senderMap)) {
          for (const [cId, msgIds] of Object.entries(chats)) {
            io.to(`user_${sId}`).emit('messages_delivered', { chatId: cId, messageIds: msgIds, status: 'delivered' });
            io.to(cId).emit('messages_delivered', { chatId: cId, messageIds: msgIds, status: 'delivered' });
            for (const mId of msgIds) {
              io.to(`user_${sId}`).emit('message_delivered_update', { messageId: mId, chatId: cId, status: 'delivered' });
              io.to(cId).emit('message_delivered_update', { messageId: mId, chatId: cId, status: 'delivered' });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error delivering pending messages on setup:', err);
    }
  });

  // Join Chat Room / Group Room
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  // Typing Indicators
  socket.on('typing_start', ({ chatId, userId, username }) => {
    socket.to(chatId).emit('typing_start', { chatId, userId, username });
  });

  socket.on('typing_stop', ({ chatId, userId }) => {
    socket.to(chatId).emit('typing_stop', { chatId, userId });
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

        // Target user mobile data is ON -> Push delivered! Update status to 'delivered' and emit to sender!
        if (pushDelivered && messageId) {
          try {
            const updatedMsg = await Message.findOneAndUpdate(
              { id: messageId, status: 'sent' },
              { status: 'delivered' },
              { new: true }
            );
            if (updatedMsg && senderId) {
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
      audioUrl, mediaUrl, fileName, fileSize, pollData, giftData, callData,
      isViewOnce, replyTo, clientTempId,
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
      const expiresAt = isDisappearing ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000) : null;

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
        const senderUser = await User.findOne({ id: senderId });
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
          } else {
            if (!isPro) {
              socket.emit('message_blocked', {
                chatId,
                receiverId,
                reason: 'Aapka 3D Free Trial khatam ho chuka hai. 3D text stickers bhejne ke liye Pulse VIP subscription activate karein.'
              });
              if (typeof ackCallback === 'function') ackCallback({ error: 'subscription_required' });
              return;
            }

            const SPARKS_COST = 10;
            const currentSparks = senderUser.pulseSparks || 0;
            if (currentSparks < SPARKS_COST) {
              socket.emit('message_blocked', {
                chatId,
                receiverId,
                reason: `Sparks kam hain! 3D text bhejne ke liye 10 Sparks lagte hain, aapke paas sirf ${currentSparks} Sparks hain. VIP Store se free claim karein.`
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

      // Check if recipient is currently online
      const isReceiverOnline = Boolean(receiverId && !isGroup && onlineUsers.has(receiverId));
      const initialStatus = isReceiverOnline ? 'delivered' : 'sent';

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        clientTempId: clientTempId || null,
        chatId,
        senderId,
        senderName: resolvedSenderName,
        senderUsername: senderUsername || '',
        senderAvatar: resolvedSenderAvatar,
        senderIsPro: resolvedSenderIsPro,
        senderProTier: resolvedSenderProTier,
        senderCustomBadge: resolvedSenderCustomBadge,
        receiverId: receiverId || '',
        isGroup: !!isGroup,
        content: content || '',
        type: type || 'text',
        textStyle: textStyle || (type === '3d_text' ? 'cyber-neon' : null),
        audioUrl: finalAudioUrl,
        mediaUrl: finalMediaUrl,
        fileName: fileName || null,
        fileSize: fileSize || null,
        pollData: pollData || null,
        giftData: giftData || null,
        callData: callData || null,
        isViewOnce: !!isViewOnce,
        viewedBy: [],
        status: initialStatus,
        timestamp: new Date().toISOString(),
        reactions: {},
        replyTo: replyTo || null,
        expiresAt
      };

      // 1. Instant Ack to sender
      if (typeof ackCallback === 'function') {
        ackCallback({ success: true, message: newMsg });
      }

      // 2. Immediate zero-latency emission to chat room AND all recipient rooms
      io.to(chatId).emit('new_message', newMsg);

      const senderRooms = new Set([`user_${senderId}`, senderId]);
      senderRooms.forEach(room => io.to(room).emit('new_message', newMsg));

      if (receiverId && !isGroup) {
        const receiverRooms = new Set([`user_${receiverId}`, receiverId]);
        receiverRooms.forEach(room => {
          io.to(room).emit('new_message', newMsg);
          io.to(room).emit('message_notification', newMsg);
        });
      }

      // 3. Concurrently save to MongoDB (zero blocking on emission)
      const savePromise = db.saveMessage(newMsg).catch(err => {
        console.error('Error saving message to DB:', err);
      });

      // Background notifications & Push (non-blocking)
      setImmediate(async () => {
        try {
          await savePromise;
          if (receiverId && !isGroup) {
            const bodyText = newMsg.type === 'text'
              ? (newMsg.content || 'New message')
              : (newMsg.type === '3d_text'
                  ? `✨ 3D Text: "${newMsg.content}"`
                  : `Sent a ${newMsg.type}`);
            dispatchWebPush(receiverId, `💬 ${resolvedSenderName}`, bodyText, `pc-${chatId}`, chatId, newMsg.id, senderId, false, resolvedSenderAvatar);
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

  // Message Delivered Acknowledgment from Recipient
  socket.on('message_delivered', async ({ messageId, chatId, senderId }) => {
    try {
      if (!messageId) return;
      await Message.findOneAndUpdate({ id: messageId, status: 'sent' }, { status: 'delivered' });
      if (senderId) {
        io.to(`user_${senderId}`).emit('message_delivered_update', { messageId, chatId, status: 'delivered' });
        io.to(`user_${senderId}`).emit('messages_delivered', { chatId, messageIds: [messageId], status: 'delivered' });
      }
      if (chatId) {
        io.to(chatId).emit('message_delivered_update', { messageId, chatId, status: 'delivered' });
        io.to(chatId).emit('messages_delivered', { chatId, messageIds: [messageId], status: 'delivered' });
      }
    } catch (err) {
      console.error('Error handling message_delivered ack:', err);
    }
  });

  // View Once Opened Handler
  socket.on('view_once_opened', async ({ messageId, userId, chatId }) => {
    const updatedMsg = await db.markViewOnceOpened(messageId, userId);
    if (updatedMsg) {
      io.to(chatId).emit('view_once_updated', { messageId, viewedBy: updatedMsg.viewedBy });
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

  // Restore Message Handler (Undo Delete)
  socket.on('restore_message', async ({ messageId, chatId }) => {
    const restoredMsg = await db.restoreMessage(messageId);
    if (restoredMsg) {
      io.to(chatId).emit('message_restored', { restoredMsg });
    }
  });

  // Clear Specific Chat Handler
  socket.on('clear_chat', async ({ chatId }) => {
    await db.clearChatMessages(chatId);
    io.to(chatId).emit('chat_cleared', { chatId });
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

  // Panic Wipe Handler
  socket.on('panic_wipe', async ({ userId }) => {
    await db.panicWipeChats(userId);
    socket.emit('chats_wiped');
  });

  // Read Receipt (Blue Double Tick)
  socket.on('mark_read', async ({ messageId, chatId, userId }) => {
    const readerId = userId || socket.userId;
    const isGhostMode = await resolveGhostMode(readerId);
    const updateDoc = { $addToSet: { readBy: readerId } };
    if (!isGhostMode) updateDoc.status = 'read';
    const updatedMsg = await Message.findOneAndUpdate({ id: messageId }, updateDoc, { new: true }).lean();

    if (!isGhostMode) {
      io.to(chatId).emit('message_read_update', { messageId, status: 'read' });
      if (updatedMsg && updatedMsg.senderId) {
        io.to(`user_${updatedMsg.senderId}`).emit('message_read_update', { messageId, status: 'read' });
        io.to(updatedMsg.senderId).emit('message_read_update', { messageId, status: 'read' });
      }
    }
    if (readerId) {
      io.to(`user_${readerId}`).emit('chat_read_update', { chatId, userId: readerId });
      io.to(readerId).emit('chat_read_update', { chatId, userId: readerId });
    }
    socket.emit('chat_read_update', { chatId, userId: readerId });
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
  socket.on('set_chat_wallpaper', (data) => {
    if (!data) return;
    const { chatId, wallpaperId, customWallpaperUrl, customImage, userId, setBy } = data;
    const finalCustomUrl = customWallpaperUrl || customImage || null;
    const finalUserId = userId || setBy || null;

    const payload = {
      chatId,
      wallpaperId,
      customWallpaperUrl: finalCustomUrl,
      customImage: finalCustomUrl,
      userId: finalUserId,
      setBy: finalUserId
    };

    io.to(chatId).emit('chat_wallpaper_updated', payload);
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => io.to(`user_${uId}`).emit('chat_wallpaper_updated', payload));
    }
  });

  // Chat Solid Color Theme Real-Time Synchronization
  socket.on('set_chat_theme', ({ chatId, themeId, setBy }) => {
    io.to(chatId).emit('chat_theme_updated', { chatId, themeId, setBy });
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => io.to(`user_${uId}`).emit('chat_theme_updated', { chatId, themeId, setBy }));
    }
  });

  // Stealth Dust Note Dissolve Handler
  socket.on('dissolve_stealth_dust', async ({ chatId, messageId }) => {
    try {
      await db.deleteMessage(messageId);
    } catch (e) {}
    io.to(chatId).emit('stealth_dust_dissolved', { chatId, messageId });
  });

  // 3D Live Emoji Particle Burst Handler
  socket.on('trigger_emoji_burst', ({ chatId, emoji, userId }) => {
    io.to(chatId).emit('emoji_burst_received', { chatId, emoji, userId });
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      parts.forEach(uId => io.to(`user_${uId}`).emit('emoji_burst_received', { chatId, emoji, userId }));
    }
  });

  socket.on('mark_chat_read', async ({ chatId, userId }) => {
    const readerId = userId || socket.userId;
    const isGhostMode = await resolveGhostMode(readerId);
    await db.markChatAsRead(chatId, readerId, isGhostMode);

    // ALWAYS emit to reader so their sidebar/tab unread badge immediately clears!
    if (readerId) {
      io.to(`user_${readerId}`).emit('chat_read_update', { chatId, userId: readerId });
      io.to(readerId).emit('chat_read_update', { chatId, userId: readerId });
    }
    socket.emit('chat_read_update', { chatId, userId: readerId });

    if (!isGhostMode) {
      io.to(chatId).emit('chat_read_update', { chatId, userId: readerId });
      if (chatId && chatId.includes('_')) {
        const parts = chatId.split('_');
        const otherId = parts.find(id => id !== readerId);
        if (otherId) {
          io.to(`user_${otherId}`).emit('chat_read_update', { chatId, userId: readerId });
          io.to(otherId).emit('chat_read_update', { chatId, userId: readerId });
        }
      }
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

      io.to(chatId).emit('reaction_updated', { messageId, reactions: updatedMsg.reactions, emoji, userId, isAdded });
      if (chatId && chatId.includes('_')) {
        const parts = chatId.split('_');
        parts.forEach(uId => io.to(`user_${uId}`).emit('reaction_updated', { messageId, reactions: updatedMsg.reactions, emoji, userId, isAdded }));
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

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      if (!hiddenOnlineUsers.has(socket.userId)) {
        io.emit('user_status', { userId: socket.userId, status: 'offline', lastSeen: new Date().toISOString() });
      }
      io.emit('online_users_list', getPublicOnlineUsers());
    }
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
    server.listen(config.PORT, () => {
      console.log(`🚀 PulseChat Backend running on port ${config.PORT}`);

      // keep-alive ping
      const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || 'https://pulsechat-xzul.onrender.com';
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

      // auto-cleanup chats older than 7 days
      const AUTO_CLEANUP_INTERVAL = 12 * 60 * 60 * 1000;
      setTimeout(async () => {
        try {
          console.log('Running 7-day chat auto-cleanup...');
          await db.runAutoCleanupJob(7);
        } catch (e) {
          console.warn('Auto-cleanup startup error:', e.message);
        }
      }, 60 * 1000);

      setInterval(async () => {
        try {
          console.log('Running periodic chat auto-cleanup...');
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
