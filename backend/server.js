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

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

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

  // Join Chat Room
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
    const { chatId, senderId, receiverId, content, type, audioUrl, mediaUrl } = messageData;

    const newMsg = {
      id: 'msg_' + Date.now(),
      chatId,
      senderId,
      receiverId,
      content: content || '',
      type: type || 'text',
      audioUrl: audioUrl || null,
      mediaUrl: mediaUrl || null,
      status: onlineUsers.has(receiverId) ? 'delivered' : 'sent',
      timestamp: new Date().toISOString(),
      reactions: {}
    };

    await db.saveMessage(newMsg);

    // Emit to room & direct recipient
    io.to(chatId).emit('new_message', newMsg);

    const recipientSocketId = onlineUsers.get(receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message_notification', newMsg);
    }
  });

  // Read Receipt (Blue Double Tick)
  socket.on('mark_read', async ({ messageId, chatId }) => {
    await db.updateMessageStatus(messageId, 'read');
    io.to(chatId).emit('message_read_update', { messageId, status: 'read' });
  });

  // Emoji Reaction
  socket.on('add_reaction', ({ messageId, chatId, emoji, userId }) => {
    io.to(chatId).emit('reaction_updated', { messageId, emoji, userId });
  });

  // Audio/Video Call Signaling
  socket.on('call_user', ({ userToCall, signalData, from, callerName, isVideo }) => {
    const recipientSocket = onlineUsers.get(userToCall);
    if (recipientSocket) {
      io.to(recipientSocket).emit('incoming_call', { signal: signalData, from, callerName, isVideo });
    }
  });

  socket.on('answer_call', (data) => {
    const callerSocket = onlineUsers.get(data.to);
    if (callerSocket) {
      io.to(callerSocket).emit('call_accepted', data.signal);
    }
  });

  socket.on('end_call', ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('call_ended');
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
