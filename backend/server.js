const express = require('express');

const http = require('http');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config');
const db = require('./database/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

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
  }
});

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('⚡ Socket Connected:', socket.id);

  // User comes online
  socket.on('setup', (userId) => {
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, status: 'online' });
    io.emit('online_users_list', Array.from(onlineUsers.keys()));
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

  // Send Real-Time Message
  socket.on('send_message', async (messageData) => {
    const { chatId, senderId, receiverId, isGroup, content, type, audioUrl, mediaUrl, pollData, callData, isViewOnce } = messageData;

    const newMsg = {
      id: 'msg_' + Date.now(),
      chatId,
      senderId,
      receiverId: receiverId || '',
      isGroup: !!isGroup,
      content: content || '',
      type: type || 'text',
      audioUrl: audioUrl || null,
      mediaUrl: mediaUrl || null,
      pollData: pollData || null,
      callData: callData || null,
      isViewOnce: !!isViewOnce,
      viewedBy: [],
      status: receiverId && onlineUsers.has(receiverId) ? 'delivered' : 'sent',
      timestamp: new Date().toISOString(),
      reactions: {}
    };

    await db.saveMessage(newMsg);

    // Emit to room & direct recipient
    io.to(chatId).emit('new_message', newMsg);

    if (receiverId && !isGroup) {
      const recipientSocketId = onlineUsers.get(receiverId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('message_notification', newMsg);
      }
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
  socket.on('mark_read', async ({ messageId, chatId }) => {
    await db.updateMessageStatus(messageId, 'read');
    io.to(chatId).emit('message_read_update', { messageId, status: 'read' });
  });

  socket.on('mark_chat_read', async ({ chatId, userId }) => {
    await db.markChatAsRead(chatId, userId);
    io.to(chatId).emit('chat_read_update', { chatId, userId });
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
  socket.on('call_user', ({ userToCall, signalData, from, callerName, callerAvatar, isVideo }) => {
    const recipientSocket = onlineUsers.get(userToCall);
    if (recipientSocket) {
      io.to(recipientSocket).emit('incoming_call', { signal: signalData, from, callerName, callerAvatar, isVideo });
    }
  });

  socket.on('answer_call', (data) => {
    const callerSocket = onlineUsers.get(data.to);
    if (callerSocket) {
      io.to(callerSocket).emit('call_accepted', data.signal);
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('ice_candidate', { candidate });
    }
  });

  socket.on('reject_call', ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('call_rejected');
    }
  });

  socket.on('end_call', ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('call_ended');
    }
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
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(config.PORT, () => {
      console.log(`🚀 PulseChat Backend running on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
