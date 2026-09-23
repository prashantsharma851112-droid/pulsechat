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
const { uploadToCloudinary } = require('./utils/cloudinary');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
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

// Catch-all for unhandled /api/* requests so they ALWAYS return JSON 404, NEVER HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found.` });
});

// Serve Frontend static files if built together
const frontendDist = path.join(__dirname, '../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

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

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('⚡ Socket Connected:', socket.id);

  // User explicitly signals going offline (data turned off / app hidden)
  socket.on('user_offline', (userId) => {
    const id = userId || socket.userId;
    if (id) {
      onlineUsers.delete(id);
      io.emit('user_status', { userId: id, status: 'offline', lastSeen: new Date().toISOString() });
      io.emit('online_users_list', Array.from(onlineUsers.keys()));
    }
  });

  // User comes online (mobile data ON / socket connected)
  socket.on('setup', async (userId) => {
    socket.userId = userId;
    socket.join(`user_${userId}`); // Join user's personal private room
    socket.join(userId);           // Also join direct userId room
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, status: 'online' });
    io.emit('online_users_list', Array.from(onlineUsers.keys()));

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
  const dispatchWebPush = async (targetUserId, title, body, tag, chatTargetId, messageId = null, senderId = null, isGroup = false) => {
    try {
      const targetUser = await User.findOne({ id: targetUserId });
      if (targetUser && targetUser.pushSubscriptions && targetUser.pushSubscriptions.length > 0) {
        const queryParams = new URLSearchParams();
        if (chatTargetId) queryParams.set('openChat', chatTargetId);
        if (senderId) queryParams.set('senderId', senderId);
        if (isGroup) queryParams.set('isGroup', '1');

        const pushPayload = {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag,
          data: {
            url: `/?${queryParams.toString()}`,
            chatId: chatTargetId,
            messageId,
            senderId,
            isGroup: !!isGroup
          }
        };

        const deadEndpoints = [];
        for (const sub of targetUser.pushSubscriptions) {
          try {
            const res = await webpush.sendPushNotification(sub, pushPayload);
            if (res && res.expired) {
              deadEndpoints.push(sub.endpoint);
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
      }
    } catch (e) {
      console.warn('Push notification dispatch error:', e.message);
    }
  };

  // Send Real-Time Message (Fast parallel check & instant emission)
  socket.on('send_message', async (messageData, ackCallback) => {
    const { chatId, senderId, receiverId, isGroup, content, type, audioUrl, mediaUrl, fileName, fileSize, pollData, giftData, callData, isViewOnce, replyTo, clientTempId } = messageData;

    try {
      // Parallelize block status and chat settings check
      const [blockStatus, chatSetting] = await Promise.all([
        (receiverId && !isGroup) ? db.isUserBlocked(senderId, receiverId) : Promise.resolve({ isBlocked: false }),
        db.getChatSetting(chatId)
      ]);

      // Check if blocked in 1-to-1 chat
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

      // Strict Friendship Check for 1-to-1 chats:
      // Users must be confirmed friends (or have existing chat history) to send messages
      if (receiverId && !isGroup && receiverId !== senderId) {
        const [senderDoc, receiverDoc] = await Promise.all([
          User.findOne({ id: senderId }).select('friends').lean(),
          User.findOne({ id: receiverId }).select('friends').lean()
        ]);
        const areFriends = Boolean(senderDoc?.friends?.includes(receiverId) && receiverDoc?.friends?.includes(senderId));
        if (!areFriends) {
          const Message = require('./models/Message');
          const hasHistory = await Message.exists({ chatId });
          if (!hasHistory) {
            socket.emit('message_blocked', {
              chatId,
              receiverId,
              reason: 'Friend request required. You must be friends to exchange direct messages.'
            });
            if (typeof ackCallback === 'function') {
              ackCallback({
                error: 'not_friends',
                message: 'You must send and have an accepted Friend Request to message this user.'
              });
            }
            return;
          }
        }
      }

      const isDisappearing = Boolean(chatSetting && chatSetting.disappearingEnabled);
      const expiresAt = isDisappearing ? new Date(Date.now() + (chatSetting.disappearingDuration || 86400) * 1000) : null;

      // Cloudinary Auto-Upload: Offload heavy Base64 media to Cloudinary CDN
      // to keep MongoDB Atlas free tier storage 100% clean and fast
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

      const newMsg = {
        id: 'msg_' + Date.now(),
        clientTempId: clientTempId || null,
        chatId,
        senderId,
        receiverId: receiverId || '',
        isGroup: !!isGroup,
        content: content || '',
        type: type || 'text',
        audioUrl: finalAudioUrl,
        mediaUrl: finalMediaUrl,
        fileName: fileName || null,
        fileSize: fileSize || null,
        pollData: pollData || null,
        giftData: giftData || null,
        callData: callData || null,
        isViewOnce: !!isViewOnce,
        viewedBy: [],
        status: 'sent',
        timestamp: new Date().toISOString(),
        reactions: {},
        replyTo: replyTo || null,
        expiresAt
      };

      // 1. Instant Ack to sender
      if (typeof ackCallback === 'function') {
        ackCallback({ success: true, message: newMsg });
      }

      // 2. Immediate zero-latency emission to chat room AND direct user channels
      io.to(chatId).emit('new_message', newMsg);
      io.to(`user_${senderId}`).emit('new_message', newMsg);
      if (receiverId && !isGroup) {
        io.to(`user_${receiverId}`).emit('new_message', newMsg);
      }

      // 3. Concurrently save to MongoDB (zero blocking on emission)
      const savePromise = db.saveMessage(newMsg).catch(err => {
        console.error('Error saving message to DB:', err);
      });

      // Background notifications (non-blocking)
      setImmediate(async () => {
        try {
          await savePromise;
          if (receiverId && !isGroup) {
            const sender = await User.findOne({ id: senderId }).select('displayName username avatar').lean();
            const notifPayload = {
              ...newMsg,
              senderName: sender?.displayName || sender?.username || senderId,
              senderAvatar: sender?.avatar || null
            };
            io.to(`user_${receiverId}`).emit('message_notification', notifPayload);

            const bodyText = newMsg.type === 'text'
              ? (newMsg.content || 'New message')
              : `Sent a ${newMsg.type}`;
            dispatchWebPush(receiverId, `💬 ${notifPayload.senderName}`, bodyText, `pc-${chatId}`, chatId, newMsg.id, senderId, false);
          } else if (isGroup) {
            const Group = require('./models/Group');
            const [group, sender] = await Promise.all([
              Group.findOne({ id: chatId }).lean(),
              User.findOne({ id: senderId }).select('displayName username avatar').lean()
            ]);

            if (group && group.members) {
              const senderName = sender?.displayName || sender?.username || senderId;
              const notifPayload = {
                ...newMsg,
                isGroup: true,
                groupName: group.name,
                senderName,
                senderAvatar: group.avatar || sender?.avatar || null
              };
              const bodyText = newMsg.type === 'text'
                ? `${senderName}: ${newMsg.content}`
                : `${senderName} sent a ${newMsg.type}`;

              group.members.forEach(memberId => {
                if (memberId !== senderId) {
                  io.to(`user_${memberId}`).emit('new_message', newMsg);
                  io.to(`user_${memberId}`).emit('message_notification', notifPayload);
                  dispatchWebPush(memberId, `👥 ${group.name}`, bodyText, `pc-${chatId}`, chatId, newMsg.id, senderId, true);
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
    if (readerId) {
      const reader = await User.findOne({ id: readerId }).select('hideReadReceipts');
      if (reader && reader.hideReadReceipts) {
        return; // Ghost Unseen Mode: do not mark read or send blue ticks!
      }
    }
    const updatedMsg = await db.updateMessageStatus(messageId, 'read');
    io.to(chatId).emit('message_read_update', { messageId, status: 'read' });
    if (updatedMsg && updatedMsg.senderId) {
      io.to(`user_${updatedMsg.senderId}`).emit('message_read_update', { messageId, status: 'read' });
    }
  });

  socket.on('mark_chat_read', async ({ chatId, userId }) => {
    const readerId = userId || socket.userId;
    if (readerId) {
      const reader = await User.findOne({ id: readerId }).select('hideReadReceipts');
      if (reader && reader.hideReadReceipts) {
        return; // Ghost Unseen Mode: do not mark chat read!
      }
    }
    await db.markChatAsRead(chatId, readerId);
    io.to(chatId).emit('chat_read_update', { chatId, userId: readerId });
    if (chatId && chatId.includes('_')) {
      const parts = chatId.split('_');
      const otherId = parts.find(id => id !== readerId);
      if (otherId) {
        io.to(`user_${otherId}`).emit('chat_read_update', { chatId, userId: readerId });
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
      io.to(chatId).emit('reaction_updated', { messageId, reactions: updatedMsg.reactions });
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

    // Notify all online group members
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
      io.emit('user_status', { userId: socket.userId, status: 'offline', lastSeen: new Date().toISOString() });
      io.emit('online_users_list', Array.from(onlineUsers.keys()));
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
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
