const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
process.env.PORT = '5999';
require('dotenv').config();

const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('../config');
const User = require('../models/User');
const Message = require('../models/Message');
const MessageLedger = require('../models/MessageLedger');

async function testDelivery() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB.');

  // Create temporary test users
  const ts = Date.now();
  const aliceId = 'test_alice_' + ts;
  const bobId = 'test_bob_' + ts;
  const canonicalChatId = [aliceId, bobId].sort().join('_');

  const alice = await User.create({
    id: aliceId,
    username: 'alice_' + ts,
    displayName: 'Alice Test',
    email: `alice_${ts}@test.com`,
    passwordHash: 'dummy_hash',
    friends: [bobId],
    hideOnlineStatus: false
  });

  const bob = await User.create({
    id: bobId,
    username: 'bob_' + ts,
    displayName: 'Bob Test',
    email: `bob_${ts}@test.com`,
    passwordHash: 'dummy_hash',
    friends: [aliceId],
    hideOnlineStatus: false
  });

  console.log(`Created test users: ${aliceId} and ${bobId}, chatId: ${canonicalChatId}`);

  const aliceToken = jwt.sign({ userId: aliceId, id: aliceId }, config.JWT_SECRET);
  const bobToken = jwt.sign({ userId: bobId, id: bobId }, config.JWT_SECRET);

  // Start real server from server.js
  // Let's import server logic or run server.js on port 5999
  process.env.PORT = '5999';
  console.log('Starting backend server on port 5999...');
  
  // Require server.js
  require('../server');

  // Wait 2 seconds for server to start listening
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- TEST CASE 1: Both devices online ---');
  let bobReceivedMessageOnline = null;

  const aliceSocket = ioClient('http://localhost:5999', {
    auth: { token: aliceToken }
  });

  const bobSocket = ioClient('http://localhost:5999', {
    auth: { token: bobToken }
  });

  await new Promise(resolve => {
    let aConn = false;
    let bConn = false;
    aliceSocket.on('connect', () => {
      console.log('Alice socket connected:', aliceSocket.id);
      aliceSocket.emit('setup', aliceId);
      aConn = true;
      if (aConn && bConn) resolve();
    });
    bobSocket.on('connect', () => {
      console.log('Bob socket connected:', bobSocket.id);
      bobSocket.emit('setup', bobId);
      bConn = true;
      if (aConn && bConn) resolve();
    });
  });

  // Bob joins chat or listens
  bobSocket.on('new_message', (msg) => {
    console.log('[Bob socket received new_message]:', { id: msg.id, senderId: msg.senderId, receiverId: msg.receiverId, chatId: msg.chatId, hasToken: Boolean(msg.receiptToken) });
    bobReceivedMessageOnline = msg;
  });

  aliceSocket.on('message_blocked', (data) => {
    console.error('[Alice received message_blocked]:', data);
  });

  // Wait a moment for rooms to be established
  await new Promise(r => setTimeout(r, 500));

  // Alice sends message to Bob
  const testMsgId = 'msg_test_' + ts;
  console.log('Alice sending message to Bob...');
  await new Promise((resolve, reject) => {
    aliceSocket.emit('send_message', {
      clientTempId: testMsgId,
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: 'Hello Bob online!',
      type: 'text'
    }, (ack) => {
      console.log('[Alice send_message ACK]:', ack);
      resolve();
    });
  });

  // Wait up to 3 seconds for Bob to receive
  for (let i = 0; i < 30; i++) {
    if (bobReceivedMessageOnline) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (bobReceivedMessageOnline) {
    console.log('[PASS] Case 1: Bob received message while online!');
    
    // Alice listens for delivery confirmation (double tick)
    const aliceGotDelivered = new Promise(resolve => {
      aliceSocket.on('message_delivered_update', (data) => {
        console.log('[Alice received message_delivered_update]:', data);
        resolve(data);
      });
    });

    // Bob sends delivery ACK
    console.log('Bob emitting message_delivered ACK...');
    bobSocket.emit('message_delivered', {
      messageId: bobReceivedMessageOnline.id,
      chatId: bobReceivedMessageOnline.chatId,
      senderId: aliceId,
      receiptToken: bobReceivedMessageOnline.receiptToken
    });

    await aliceGotDelivered;
    console.log('Alice confirmed double tick delivery receipt!');
  } else {
    console.error('[FAIL] Case 1: Bob DID NOT receive message while online!');
  }

  // Disconnect sockets
  aliceSocket.disconnect();
  bobSocket.disconnect();

  console.log('\n--- TEST CASE 2: Bob offline when message sent, reconnects later ---');
  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  // Connect ONLY Alice
  const aliceSocket2 = ioClient('http://localhost:5999', {
    auth: { token: aliceToken }
  });
  await new Promise(resolve => aliceSocket2.on('connect', resolve));
  aliceSocket2.emit('setup', aliceId);
  await new Promise(r => setTimeout(r, 500));

  // Alice sends message to Bob while Bob is offline
  const testMsgOfflineId = 'msg_offline_' + ts;
  console.log('Alice sending offline message to Bob...');
  await new Promise((resolve) => {
    aliceSocket2.emit('send_message', {
      clientTempId: testMsgOfflineId,
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: 'Hello Bob offline!',
      type: 'text'
    }, (ack) => {
      console.log('[Alice send_message ACK for offline]:', ack);
      resolve();
    });
  });

  // Check if saved in MongoDB Message queue
  const queuedMsg = await Message.findOne({ receiverId: bobId, clientTempId: testMsgOfflineId }).lean();
  console.log('MongoDB queued message found:', queuedMsg ? { id: queuedMsg.id, status: queuedMsg.status, receiverId: queuedMsg.receiverId } : 'NONE');

  // Now Bob comes online (connects)
  console.log('Bob coming online now...');
  let bobReceivedMessageOffline = null;
  const bobSocket2 = ioClient('http://localhost:5999', {
    auth: { token: bobToken }
  });

  bobSocket2.on('new_message', (msg) => {
    console.log('[Bob socket received queued new_message on reconnect]:', { id: msg.id, senderId: msg.senderId, receiverId: msg.receiverId, hasToken: Boolean(msg.receiptToken) });
    bobReceivedMessageOffline = msg;
  });

  await new Promise(resolve => bobSocket2.on('connect', resolve));
  bobSocket2.emit('setup', bobId);

  // Wait up to 3 seconds for Bob to receive queued message
  for (let i = 0; i < 30; i++) {
    if (bobReceivedMessageOffline) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (bobReceivedMessageOffline) {
    console.log('[PASS] Case 2: Bob received queued message after reconnecting!');
  } else {
    console.error('[FAIL] Case 2: Bob DID NOT receive queued message after reconnecting!');
  }

  // Cleanup test users and messages
  await User.deleteMany({ id: { $in: [aliceId, bobId] } });
  await Message.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });
  await MessageLedger.deleteMany({ $or: [{ senderId: aliceId }, { receiverId: aliceId }, { senderId: bobId }, { receiverId: bobId }] });

  aliceSocket2.disconnect();
  bobSocket2.disconnect();
  process.exit(bobReceivedMessageOnline && bobReceivedMessageOffline ? 0 : 1);
}

testDelivery().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
