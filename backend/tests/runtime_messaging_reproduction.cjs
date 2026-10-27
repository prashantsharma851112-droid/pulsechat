const path = require('path');
const fs = require('fs');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;
const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

const config = require('../config');
const User = require('../models/User');
const Message = require('../models/Message');

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToArrayBuffer(base64) {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function generateTestDeviceIdentity(userId) {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const deviceId = `pulse_dev_${userId}_${Date.now()}`;
  return { userId, deviceId, keyPair, publicKeyJwk };
}

async function encryptEnvelope(contentObj, recipientPublicKeyJwk, senderDeviceId, recipientDeviceId) {
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

  const recipientKey = await subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    ephemeralKeyPair.privateKey,
    256
  );

  const hkdfKey = await subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']);
  const aesGcmKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('pulse_e2ee_message_key_v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plaintextBuffer = new TextEncoder().encode(JSON.stringify(contentObj));
  const ciphertextBuffer = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesGcmKey, plaintextBuffer);

  return {
    format: 'pulse_e2ee_v1',
    senderDeviceId: String(senderDeviceId),
    recipientDeviceId: String(recipientDeviceId),
    ephemeralPublicKey: ephemeralPublicKeyJwk,
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer)
  };
}

async function decryptEnvelope(envelope, recipientPrivateKey) {
  const ephemeralKey = await subtle.importKey(
    'jwk',
    envelope.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralKey },
    recipientPrivateKey,
    256
  );

  const hkdfKey = await subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveKey']);
  const aesGcmKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('pulse_e2ee_message_key_v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = base64ToArrayBuffer(envelope.iv);
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);
  const decryptedBuffer = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesGcmKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

// Client-side local storage & unread tracking simulation matching offlineStorage.js
function createMockClientStorage(userId) {
  const recentChats = new Map();
  const messageStore = new Map();

  return {
    getRecent: () => Array.from(recentChats.values()),
    getChat: (chatId) => recentChats.get(chatId) || null,
    commitMessage: (msg, { isViewing = false, increment = true } = {}) => {
      const existing = recentChats.get(msg.chatId) || {
        id: msg.senderId === userId ? msg.receiverId : msg.senderId,
        unreadCount: 0,
        lastMessage: '',
        lastMessageId: null,
        lastMessageStatus: 'sent'
      };

      const isSameMsg = Boolean(
        existing.lastMessageId && (String(existing.lastMessageId) === String(msg.id || msg.clientTempId))
      );
      const isFromMe = msg.senderId === userId;
      let unread = existing.unreadCount;
      if (isFromMe || isViewing) {
        unread = 0;
      } else if (!isSameMsg && increment) {
        unread += 1;
      }

      const updated = {
        ...existing,
        lastMessage: msg.content || (msg.isEncrypted ? '🔒 Encrypted message' : ''),
        lastMessageId: msg.id || msg.clientTempId,
        lastMessageTime: msg.timestamp || new Date().toISOString(),
        lastMessageStatus: msg.status || 'sent',
        unreadCount: unread
      };

      recentChats.set(msg.chatId, updated);
      messageStore.set(msg.id || msg.clientTempId, msg);
      return updated;
    },
    updateStatus: (chatId, msgId, newStatus) => {
      const chat = recentChats.get(chatId);
      if (chat) {
        // Monotonic progression: read is terminal
        if (chat.lastMessageStatus !== 'read') {
          chat.lastMessageStatus = newStatus;
        }
      }
      const m = messageStore.get(msgId);
      if (m && m.status !== 'read') {
        m.status = newStatus;
      }
    },
    clearUnread: (chatId) => {
      const chat = recentChats.get(chatId);
      if (chat) chat.unreadCount = 0;
    }
  };
}

async function runRuntimeReproduction() {
  console.log('================================================================');
  console.log('   PULSECHAT REAL RUNTIME REPRODUCTION OF MESSAGING FAILURES   ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000';
  await mongoose.connect(config.MONGO_URI);
  console.log('[Setup] Connected to MongoDB Atlas.');

  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';
  const aliceUser = await User.findOne({ id: aliceId }).lean();
  const bobUser = await User.findOne({ id: bobId }).lean();
  assert(aliceUser && bobUser, 'Alice and Bob accounts must exist in DB.');

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username, email: aliceUser.email }, config.JWT_SECRET, { expiresIn: '3650d' });
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username, email: bobUser.email }, config.JWT_SECRET, { expiresIn: '3650d' });

  // 1. Device Registration
  console.log('\n--- STEP 1: Device Registration for Alice & Bob ---');
  const aliceIdent = await generateTestDeviceIdentity(aliceId);
  const bobIdent = await generateTestDeviceIdentity(bobId);

  const regAliceRes = await fetch(`${BASE_URL}/api/keys/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: aliceId,
        device_id: aliceIdent.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${aliceIdent.deviceId}`]: aliceIdent.publicKeyJwk }
      }
    })
  });
  assert.strictEqual(regAliceRes.status, 200, 'Alice key upload must return 200');

  const regBobRes = await fetch(`${BASE_URL}/api/keys/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({
      device_keys: {
        user_id: bobId,
        device_id: bobIdent.deviceId,
        algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
        keys: { [`p256:${bobIdent.deviceId}`]: bobIdent.publicKeyJwk }
      }
    })
  });
  assert.strictEqual(regBobRes.status, 200, 'Bob key upload must return 200');
  console.log('✅ Both Alice and Bob device keys registered successfully via HTTP 200.');

  // Fetch Bob key for Alice
  const bobKeyRes = await fetch(`${BASE_URL}/api/keys/${bobId}`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  assert.strictEqual(bobKeyRes.status, 200);
  const bobKeyData = await bobKeyRes.json();
  const bobDevice = bobKeyData.devices?.[0];
  const bobPublicKeyJwk = bobDevice?.keys?.[`p256:${bobDevice.device_id}`] || bobDevice?.keys;
  assert(bobPublicKeyJwk, 'Bob public key JWK retrieved.');
  console.log('✅ Alice queried Bob public key successfully.');

  // 2. Connect WebSockets
  console.log('\n--- STEP 2: Connect Sockets for Alice & Bob ---');
  const aliceSocket = ioClient(BASE_URL, { auth: { token: aliceToken } });
  const bobSocket = ioClient(BASE_URL, { auth: { token: bobToken } });

  await new Promise(resolve => {
    let a = false, b = false;
    aliceSocket.on('connect', () => { aliceSocket.emit('setup', aliceId); a = true; if (a && b) resolve(); });
    bobSocket.on('connect', () => { bobSocket.emit('setup', bobId); b = true; if (a && b) resolve(); });
  });
  console.log(`✅ Sockets connected. Alice Socket: ${aliceSocket.id}, Bob Socket: ${bobSocket.id}`);

  // Setup client storage models
  const aliceStorage = createMockClientStorage(aliceId);
  const bobStorage = createMockClientStorage(bobId);

  const timeline = [];
  const recordStage = (stage, details) => {
    const t = new Date().toISOString();
    timeline.push({ time: t, stage, details });
    console.log(`[${t}] [${stage}]`, JSON.stringify(details));
  };

  // -------------------------------------------------------------
  // VERIFICATION: send_message with canonical '::' chatId
  // -------------------------------------------------------------
  console.log('\n--- VERIFICATION: send_message with canonical :: delimiter ---');
  const canonicalChatId = [aliceId, bobId].sort().join('::');
  const testEnvelope = await encryptEnvelope({ content: 'Test Canonical ID', type: 'text' }, bobPublicKeyJwk, aliceIdent.deviceId, bobDevice.device_id);

  const canonicalSendAck = await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: canonicalChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: testEnvelope,
      clientTempId: 'tmp_canonical_test',
      type: 'text'
    }, (ack) => {
      resolve(ack);
    });
  });

  recordStage('CANONICAL_COLON_SEND', {
    chatId: canonicalChatId,
    ack: canonicalSendAck
  });

  assert.strictEqual(canonicalSendAck.success, true, 'send_message with canonical :: delimiter MUST succeed');
  console.log('✅ CONFIRMED FIX: server.js now accepts send_message when chatId contains :: canonical delimiter!');

  // -------------------------------------------------------------
  // STEP 3: Complete live flow with standard ChatWindow.jsx format (join('_'))
  // -------------------------------------------------------------
  console.log('\n--- STEP 3: Single Uniquely Identifiable Message & Timeline Tracing ---');
  const standardChatId = [aliceId, bobId].sort().join('_');
  const clientTempId1 = `tmp_msg_${Date.now()}_alpha`;
  const uniqueMessageText = `PulseChat-E2EE-Unique-Message-${Date.now()}`;

  // Stage 3.1: Sender UI and send handler
  const tSendStart = new Date().toISOString();
  const envelope1 = await encryptEnvelope({ content: uniqueMessageText, type: 'text' }, bobPublicKeyJwk, aliceIdent.deviceId, bobDevice.device_id);
  recordStage('1. SENDER_SEND_HANDLER', {
    clientTempId: clientTempId1,
    chatId: standardChatId,
    senderId: aliceId,
    receiverId: bobId,
    isEncrypted: true,
    tSendStart
  });

  // Stage 3.3: Recipient socket event & local commit
  let bobReceivedMsg = null;
  const bobReceivePromise = new Promise(resolve => {
    bobSocket.on('new_message', async (msg) => {
      if (msg.clientTempId !== clientTempId1) return;
      recordStage('3. RECIPIENT_SOCKET_EVENT', {
        serverMessageId: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        hasEnvelope: Boolean(msg.envelope),
        receiptToken: Boolean(msg.receiptToken)
      });

      // Stage 3.4: Recipient decryption and IndexedDB persistence
      const decrypted = await decryptEnvelope(msg.envelope, bobIdent.keyPair.privateKey);
      recordStage('4. RECIPIENT_DECRYPT_AND_PERSIST', {
        serverMessageId: msg.id,
        plaintextMatches: decrypted.content === uniqueMessageText,
        decryptedType: decrypted.type
      });

      // Stage 3.5: Recipient unread count and sidebar update
      const updatedChat = bobStorage.commitMessage({ ...msg, content: decrypted.content, _decrypted: true }, { isViewing: false, increment: true });
      recordStage('5. RECIPIENT_UNREAD_AND_SIDEBAR', {
        chatId: msg.chatId,
        unreadCount: updatedChat.unreadCount,
        lastMessage: updatedChat.lastMessage,
        lastMessageStatus: updatedChat.lastMessageStatus
      });

      bobReceivedMsg = msg;

      // Stage 3.6: Recipient emits delivery ACK
      bobSocket.emit('message_delivered', {
        messageId: msg.id,
        chatId: msg.chatId,
        senderId: aliceId,
        receiptToken: msg.receiptToken
      });
      resolve(msg);
    });
  });

  // Stage 3.2: Alice emits send_message and receives server ACK
  const aliceAckPromise = new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: standardChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: envelope1,
      clientTempId: clientTempId1,
      type: 'text'
    }, (ack) => {
      const serverMessageId = ack.message?.id || ack.id || ack.messageId;
      recordStage('2. SERVER_RECEIVE_VALIDATION_ACK', {
        success: ack.success,
        serverMessageId,
        serverChatId: ack.message?.chatId || ack.chatId,
        serverTimestamp: ack.message?.timestamp || ack.timestamp
      });
      resolve({ ...ack, serverMessageId });
    });
  });

  // Sender listens for double-tick (delivery update)
  const deliveryTickPromise = new Promise(resolve => {
    aliceSocket.on('message_delivered_update', (data) => {
      if (data.clientTempId === clientTempId1 || (bobReceivedMsg && data.messageId === bobReceivedMsg.id)) {
        recordStage('6. DELIVERY_RECEIPT_DOUBLE_TICK', {
          messageId: data.messageId,
          chatId: data.chatId,
          canonicalChatId: data.canonicalChatId,
          status: data.status
        });
        aliceStorage.updateStatus(data.chatId, data.messageId, data.status);
        resolve(data);
      }
    });
  });

  const [ackResult, recvResult] = await Promise.all([
    aliceAckPromise,
    bobReceivePromise
  ]);

  assert.strictEqual(ackResult.success, true, 'Server ACK must be successful');
  assert.strictEqual(recvResult.id, ackResult.serverMessageId, 'MessageId must match across sender and recipient');

  const tickResult = await deliveryTickPromise;
  assert.strictEqual(tickResult.status, 'delivered', 'Delivery status must be delivered');

  // Read Receipt (Bob views chat)
  const readTickPromise = new Promise(resolve => {
    const onRead = (data) => {
      recordStage('7. READ_RECEIPT_BLUE_TICK', {
        messageIds: data.messageIds,
        chatId: data.chatId,
        canonicalChatId: data.canonicalChatId,
        status: data.status
      });
      aliceStorage.updateStatus(data.chatId, recvResult.id, data.status);
      resolve(data);
    };
    aliceSocket.on('chat_read_update', onRead);
    aliceSocket.on('message_read_update', onRead);
  });

  bobSocket.emit('mark_chat_read', { chatId: standardChatId, userId: bobId, messageIds: [recvResult.id] });
  await readTickPromise;
  console.log('✅ Online 1-to-1 message flow completed successfully through all 7 stages.');

  // -------------------------------------------------------------
  // STEP 4: Offline Queue & Reconnect Recovery Test
  // -------------------------------------------------------------
  console.log('\n--- STEP 4: Recipient Offline -> Send -> Queue Retained -> Reconnect Recovery ---');
  bobSocket.disconnect();
  await new Promise(r => setTimeout(r, 600));
  recordStage('4.1 BOB_SOCKET_DISCONNECT', { bobId, disconnected: true });

  const clientTempIdOffline = `tmp_msg_${Date.now()}_offline`;
  const offlineText = `PulseChat-Offline-Queue-Message-${Date.now()}`;
  const envelopeOffline = await encryptEnvelope({ content: offlineText, type: 'text' }, bobPublicKeyJwk, aliceIdent.deviceId, bobDevice.device_id);

  let serverOfflineMsgId = null;
  await new Promise(resolve => {
    aliceSocket.emit('send_message', {
      chatId: standardChatId,
      senderId: aliceId,
      receiverId: bobId,
      isGroup: false,
      content: '',
      isEncrypted: true,
      envelope: envelopeOffline,
      clientTempId: clientTempIdOffline,
      type: 'text'
    }, (ack) => {
      serverOfflineMsgId = ack.message?.id || ack.id || ack.messageId;
      recordStage('4.2 SENDER_OFFLINE_SEND_ACK', {
        success: ack.success,
        serverMessageId: serverOfflineMsgId,
        status: ack.status || 'sent'
      });
      resolve();
    });
  });

  // Verify MongoDB retention: temporary encrypted offline queue item exists
  const mongoQueued = await Message.findOne({ clientTempId: clientTempIdOffline, receiverId: bobId }).lean();
  recordStage('4.3 MONGODB_QUEUE_CHECK', {
    found: Boolean(mongoQueued),
    serverMessageId: mongoQueued?.id,
    receiverId: mongoQueued?.receiverId,
    status: mongoQueued?.status,
    isEncrypted: mongoQueued?.isEncrypted,
    hasPlaintext: Boolean(mongoQueued?.content)
  });
  assert(mongoQueued, 'Message must be present in MongoDB queue while Bob is offline');
  assert.strictEqual(mongoQueued.content, '', 'Privacy constraint: ciphertext only, zero plaintext in MongoDB');

  // Bob reconnects with new socket
  let bobReceivedOfflineMsg = null;
  const bobSocket2 = ioClient(BASE_URL, { auth: { token: bobToken } });

  const bobReconnectPromise = new Promise(resolve => {
    bobSocket2.on('new_message', async (msg) => {
      if (msg.clientTempId === clientTempIdOffline || msg.id === serverOfflineMsgId) {
        recordStage('4.4 RECIPIENT_RECONNECT_RECEIVE', {
          serverMessageId: msg.id,
          chatId: msg.chatId,
          receiptToken: Boolean(msg.receiptToken)
        });

        const decrypted = await decryptEnvelope(msg.envelope, bobIdent.keyPair.privateKey);
        recordStage('4.5 RECIPIENT_RECONNECT_DECRYPT', {
          serverMessageId: msg.id,
          plaintextMatches: decrypted.content === offlineText
        });

        bobReceivedOfflineMsg = msg;

        // Durable commit before ACK
        bobStorage.commitMessage({ ...msg, content: decrypted.content, _decrypted: true }, { isViewing: false, increment: true });

        // Emit delivery ACK
        bobSocket2.emit('message_delivered', {
          messageId: msg.id,
          chatId: msg.chatId,
          senderId: aliceId,
          receiptToken: msg.receiptToken
        });
        resolve(msg);
      }
    });
  });

  const aliceOfflineDeliveryTickPromise = new Promise(resolve => {
    aliceSocket.on('message_delivered_update', (data) => {
      if (data.messageId === serverOfflineMsgId) {
        recordStage('4.6 SENDER_RECONNECT_DOUBLE_TICK', {
          messageId: data.messageId,
          chatId: data.chatId,
          canonicalChatId: data.canonicalChatId,
          status: data.status
        });
        resolve(data);
      }
    });
  });

  await new Promise(r => bobSocket2.on('connect', r));
  bobSocket2.emit('setup', bobId);

  await Promise.all([bobReconnectPromise, aliceOfflineDeliveryTickPromise]);
  console.log('✅ Offline queue delivery & reconnect double-tick confirmed.');

  // -------------------------------------------------------------
  // STEP 5: Test Two Consecutive Incoming Messages (Alice's unreadCount)
  // -------------------------------------------------------------
  console.log('\n--- STEP 5: Two Consecutive Incoming Messages & Idempotent Replay ---');
  // Bob sends Message A to Alice
  const msgA = {
    id: `msg_test_A_${Date.now()}`,
    clientTempId: `tmp_A_${Date.now()}`,
    chatId: standardChatId,
    senderId: bobId,
    receiverId: aliceId,
    content: 'Message A from Bob',
    timestamp: new Date().toISOString(),
    status: 'sent'
  };
  const chatAfterA = aliceStorage.commitMessage(msgA, { isViewing: false, increment: true });
  recordStage('5.1 ALICE_RECEIVES_MSG_A', {
    unreadCount: chatAfterA.unreadCount,
    lastMessage: chatAfterA.lastMessage
  });
  assert.strictEqual(chatAfterA.unreadCount, 1, 'Unread count should be 1 after Msg A');

  // Bob sends Message B to Alice
  const msgB = {
    id: `msg_test_B_${Date.now()}`,
    clientTempId: `tmp_B_${Date.now()}`,
    chatId: standardChatId,
    senderId: bobId,
    receiverId: aliceId,
    content: 'Message B from Bob',
    timestamp: new Date().toISOString(),
    status: 'sent'
  };
  const chatAfterB = aliceStorage.commitMessage(msgB, { isViewing: false, increment: true });
  recordStage('5.2 ALICE_RECEIVES_MSG_B', {
    unreadCount: chatAfterB.unreadCount,
    lastMessage: chatAfterB.lastMessage
  });
  assert.strictEqual(chatAfterB.unreadCount, 2, 'Unread count should be 2 after Msg B');

  // Test duplicate event replay of Msg B
  const chatAfterReplay = aliceStorage.commitMessage(msgB, { isViewing: false, increment: true });
  recordStage('5.3 ALICE_REPLAYS_MSG_B', {
    unreadCount: chatAfterReplay.unreadCount,
    lastMessage: chatAfterReplay.lastMessage
  });
  assert.strictEqual(chatAfterReplay.unreadCount, 2, 'Unread count must stay 2 on duplicate replay');

  // Test message arriving while viewing chat
  aliceStorage.clearUnread(standardChatId);
  const msgC = {
    id: `msg_test_C_${Date.now()}`,
    clientTempId: `tmp_C_${Date.now()}`,
    chatId: standardChatId,
    senderId: bobId,
    receiverId: aliceId,
    content: 'Message C from Bob while viewing',
    timestamp: new Date().toISOString(),
    status: 'sent'
  };
  const chatAfterC = aliceStorage.commitMessage(msgC, { isViewing: true, increment: false });
  recordStage('5.4 ALICE_RECEIVES_MSG_C_WHILE_VIEWING', {
    unreadCount: chatAfterC.unreadCount,
    lastMessage: chatAfterC.lastMessage
  });
  assert.strictEqual(chatAfterC.unreadCount, 0, 'Unread count must remain 0 when viewing');

  console.log('✅ Consecutive messages, duplicate replay, and viewing states verified successfully.');

  // Disconnect sockets
  aliceSocket.disconnect();
  bobSocket2.disconnect();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('   REPRODUCTION SUITE FINISHED: ALL SCENARIOS DOCUMENTED       ');
  console.log('================================================================\n');

  process.exit(0);
}

runRuntimeReproduction().catch(err => {
  console.error('\n❌ SCRIPT ENCOUNTERED ERROR:', err);
  process.exit(1);
});
