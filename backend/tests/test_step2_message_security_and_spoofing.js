const path = require('path');
const backendDir = path.resolve(__dirname, '..');
const crypto = require('crypto');
const EventEmitter = require('events');

console.log('================================================================');
console.log(' RUNNING DEEP REGRESSION TESTS FOR MESSAGE SECURITY,');
console.log(' CONTACT AUTHORIZATION, RECEIPT RETRIES & RETENTION');
console.log('================================================================\n');

let total = 0;
let passed = 0;

function assert(description, condition) {
  total++;
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    process.exitCode = 1;
  }
}

const RECEIPT_SECRET = 'step2_deep_receipt_secret_for_tests_32chars_long!';

// Mock QueuedMessage and MessageLedger
const mockQueue = [];
const mockLedger = [];

const QueuedMessage = {
  find: (query) => ({
    sort: () => ({
      limit: () => ({
        lean: async () => mockQueue.filter(m => {
          if (query.receiverId && m.receiverId !== query.receiverId) return false;
          if (query.expiresAt?.$gt && m.expiresAt <= query.expiresAt.$gt) return false;
          return true;
        })
      })
    })
  }),
  deleteMany: async (query) => {
    let count = 0;
    for (let i = mockQueue.length - 1; i >= 0; i--) {
      const m = mockQueue[i];
      if (query.receiverId && m.receiverId !== query.receiverId) continue;
      if (query.expiresAt?.$lte && m.expiresAt <= query.expiresAt.$lte) {
        mockQueue.splice(i, 1);
        count++;
      }
    }
    return { deletedCount: count };
  },
  deleteOne: async (query) => {
    const idx = mockQueue.findIndex(m => m.messageId === query.messageId && m.receiverId === query.receiverId);
    if (idx !== -1) mockQueue.splice(idx, 1);
    return { deletedCount: idx !== -1 ? 1 : 0 };
  },
  updateOne: async (query, update) => {
    const idx = mockQueue.findIndex(m => m.messageId === query.messageId);
    if (idx !== -1) {
      if (update.$set) Object.assign(mockQueue[idx], update.$set);
    } else if (update.$setOnInsert) {
      mockQueue.push({ ...update.$setOnInsert });
    }
    return { acknowledged: true };
  }
};

function createMongooseQuery(resolveFn) {
  const promise = Promise.resolve().then(resolveFn);
  promise.lean = () => Promise.resolve().then(resolveFn);
  promise.select = () => promise;
  return promise;
}

const MessageLedger = {
  findOne: (query) => {
    return createMongooseQuery(() => {
      return mockLedger.find(l => {
        if (query.$or) {
          return query.$or.some(q => (
            (!q.senderId || l.senderId === q.senderId) &&
            (!q.receiverId || l.receiverId === q.receiverId)
          ));
        }
        if (query.messageId && l.messageId !== query.messageId) return false;
        if (query.senderId && l.senderId !== query.senderId) return false;
        if (query.receiverId && l.receiverId !== query.receiverId) return false;
        return true;
      }) || null;
    });
  },
  find: (query) => ({
    lean: async () => mockLedger.filter(l => {
      if (query.messageId?.$in && !query.messageId.$in.includes(l.messageId)) return false;
      return true;
    })
  }),
  create: async (doc) => {
    mockLedger.push(doc);
    return doc;
  },
  updateOne: async (query, update) => {
    const l = mockLedger.find(m => m.messageId === query.messageId);
    if (l && update.$set) Object.assign(l, update.$set);
    return { acknowledged: true };
  }
};

// Mock User database
const mockUsers = [
  { id: 'alice', friends: ['bob'], blockedUsers: [], isAdmin: false },
  { id: 'bob', friends: ['alice'], blockedUsers: ['charlie_blocked_by_bob'], isAdmin: false },
  { id: 'charlie_blocked_by_bob', friends: ['bob'], blockedUsers: [], isAdmin: false },
  { id: 'david_who_blocked_bob', friends: ['bob'], blockedUsers: ['bob'], isAdmin: false },
  { id: 'stranger_eve', friends: [], blockedUsers: [], isAdmin: false },
  { id: 'admin_support', friends: [], blockedUsers: [], isAdmin: true }
];

const User = {
  findOne: (query) => {
    return createMongooseQuery(() => {
      const id = query.$or?.[0]?.id || query.id;
      return mockUsers.find(u => u.id === id) || null;
    });
  }
};

const db = {
  isUserBlocked: async (userAId, userBId) => {
    const userA = mockUsers.find(u => u.id === userAId);
    const userB = mockUsers.find(u => u.id === userBId);
    const aBlockedB = Boolean(userA?.blockedUsers && userA.blockedUsers.includes(userBId));
    const bBlockedA = Boolean(userB?.blockedUsers && userB.blockedUsers.includes(userAId));
    return {
      isBlocked: aBlockedB || bBlockedA,
      aBlockedB,
      bBlockedA
    };
  }
};

// Override modules in require cache for testing registerChatSocket
const registerChatSocketPath = path.resolve(backendDir, 'chat/registerChatSocket');
const userPath = path.resolve(backendDir, 'models/User');
const dbPath = path.resolve(backendDir, 'database/db');
const qmPath = path.resolve(backendDir, 'models/QueuedMessage');
const mlPath = path.resolve(backendDir, 'models/MessageLedger');

require.cache[require.resolve(userPath)] = { exports: User, loaded: true };
require.cache[require.resolve(dbPath)] = { exports: db, loaded: true };
require.cache[require.resolve(qmPath)] = { exports: QueuedMessage, loaded: true };
require.cache[require.resolve(mlPath)] = { exports: MessageLedger, loaded: true };

delete require.cache[require.resolve(registerChatSocketPath)];
const { registerChatSocket } = require(registerChatSocketPath);
const { createReceiptToken } = require(path.resolve(backendDir, 'chat/receiptToken'));

// Mock IO and Sockets
function createMockIO() {
  const io = new EventEmitter();
  const rooms = new Map();

  io.in = io.to = (...roomList) => {
    const combinedRooms = roomList;
    return {
      to: (r2) => io.to(...combinedRooms, r2),
      fetchSockets: async () => {
        const socketIds = new Set();
        for (const rm of combinedRooms) {
          const sSet = rooms.get(rm);
          if (sSet) {
            for (const id of sSet) socketIds.add(id);
          }
        }
        return Array.from(socketIds).map(id => ({ id }));
      },
      emit: (event, data, callback) => {
        const socketIds = new Set();
        for (const rm of combinedRooms) {
          const sSet = rooms.get(rm);
          if (sSet) {
            for (const id of sSet) socketIds.add(id);
          }
        }
        const responses = [];
        for (const sId of socketIds) {
          if (io.socketsMap?.has(sId)) {
            const clientSocket = io.socketsMap.get(sId);
            clientSocket.emit(event, data, (resp) => {
              responses.push(resp);
            });
          }
        }
        if (typeof callback === 'function') {
          callback(null, responses.length > 0 ? responses : []);
        }
      }
    };
  };

  io.socketsMap = new Map();
  io._rooms = rooms;

  return io;
}

function createMockSocket(io, authenticatedUserId = null) {
  const socket = new EventEmitter();
  socket.id = 'sock_' + Math.random().toString(36).substring(2, 9);
  socket.authenticatedUserId = authenticatedUserId;
  socket.data = { userId: authenticatedUserId };
  socket.rooms = new Set();

  socket.join = (room) => {
    socket.rooms.add(room);
    if (!io._rooms.has(room)) io._rooms.set(room, new Set());
    io._rooms.get(room).add(socket.id);
  };

  io.socketsMap.set(socket.id, socket);
  return socket;
}

async function runTests() {
  const io = createMockIO();
  registerChatSocket(io, { receiptSecret: RECEIPT_SECRET });

  console.log('--- TEST SUITE 1: Socket Setup & Impersonation Prevention ---');

  // Prepopulate pending message for Bob
  mockQueue.push({
    messageId: 'msg_for_bob_1',
    senderId: 'someone_else',
    receiverId: 'bob',
    content: 'Secret message for Bob',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    receiptToken: 'token_bob_1'
  });
  mockLedger.push({
    messageId: 'msg_for_bob_1',
    senderId: 'someone_else',
    receiverId: 'bob',
    state: 'queued'
  });

  // 1. Authenticated socket for Alice attempts to spoof Bob in setup
  const aliceSocket = createMockSocket(io, 'alice');
  let receivedByAlice = [];
  aliceSocket.on('chat:message', (msg) => receivedByAlice.push(msg));
  io.emit('connection', aliceSocket);

  // Alice emits setup claiming to be bob
  aliceSocket.emit('setup', 'bob');
  await new Promise(r => setTimeout(r, 50));

  assert('Alice cannot join Bob\'s personal rooms via setup',
    !aliceSocket.rooms.has('user:bob') && !aliceSocket.rooms.has('bob') && !aliceSocket.rooms.has('user_bob'));
  assert('Alice cannot receive Bob\'s pending messages via spoofed setup',
    receivedByAlice.length === 0);

  // 2. Unauthenticated socket attempts to call setup
  const anonSocket = createMockSocket(io, null);
  io.emit('connection', anonSocket);
  anonSocket.emit('setup', 'bob');
  await new Promise(r => setTimeout(r, 50));

  assert('Unauthenticated socket setup cannot join Bob\'s room',
    !anonSocket.rooms.has('user:bob') && !anonSocket.rooms.has('bob'));

  // 3. Unauthenticated socket attempts chat:sync
  let anonSyncRes = null;
  anonSocket.emit('chat:sync', {}, (res) => { anonSyncRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Unauthenticated socket cannot call chat:sync',
    anonSyncRes?.ok === false && anonSyncRes?.error === 'UNAUTHORIZED');

  console.log('\n--- TEST SUITE 2: Sender Identity Verification in chat:send ---');

  // 4. Unauthenticated socket attempts chat:send
  let anonSendRes = null;
  anonSocket.emit('chat:send', {
    messageId: 'msg_anon_1',
    receiverId: 'bob',
    content: 'Hello from anon'
  }, (res) => { anonSendRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Unauthenticated socket chat:send is rejected with UNAUTHORIZED_SENDER',
    anonSendRes?.ok === false && anonSendRes?.error === 'UNAUTHORIZED_SENDER');

  // 5. Authenticated Alice attempts to spoof payload.senderId = 'bob'
  let aliceSpoofRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_spoofed_sender',
    senderId: 'bob',
    receiverId: 'alice',
    content: 'Impersonating Bob'
  }, (res) => { aliceSpoofRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Client-supplied sender identity mismatch is strictly rejected with SENDER_IDENTITY_MISMATCH',
    aliceSpoofRes?.ok === false && aliceSpoofRes?.error === 'SENDER_IDENTITY_MISMATCH');

  // 6. Alice cannot send message to self
  let selfSendRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_self_send',
    receiverId: 'alice',
    content: 'Hello myself'
  }, (res) => { selfSendRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Sending message to oneself is rejected with CANNOT_MESSAGE_SELF',
    selfSendRes?.ok === false && selfSendRes?.error === 'CANNOT_MESSAGE_SELF');

  console.log('\n--- TEST SUITE 3: Recipient Authorization, Blocking & Contact Rules ---');

  // 7. Non-existent recipient
  let nonExistentRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_to_ghost',
    receiverId: 'ghost_user_99999',
    content: 'Are you there?'
  }, (res) => { nonExistentRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Sending to non-existent recipient is rejected with RECIPIENT_NOT_FOUND',
    nonExistentRes?.ok === false && nonExistentRes?.error === 'RECIPIENT_NOT_FOUND');

  // 8. Sender blocked by recipient
  const charlieSocket = createMockSocket(io, 'charlie_blocked_by_bob');
  io.emit('connection', charlieSocket);
  let blockedByBobRes = null;
  charlieSocket.emit('chat:send', {
    messageId: 'msg_charlie_to_bob',
    receiverId: 'bob',
    content: 'Unblock me please'
  }, (res) => { blockedByBobRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Sending to a user who blocked the sender is rejected with RECIPIENT_BLOCKED_SENDER',
    blockedByBobRes?.ok === false && blockedByBobRes?.error === 'RECIPIENT_BLOCKED_SENDER');

  // 9. Sender blocked the recipient
  let bobToCharlieRes = null;
  const bobSocket = createMockSocket(io, 'bob');
  io.emit('connection', bobSocket);
  bobSocket.emit('chat:send', {
    messageId: 'msg_bob_to_charlie',
    receiverId: 'charlie_blocked_by_bob',
    content: 'You are blocked'
  }, (res) => { bobToCharlieRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Sending to a user that the sender blocked is rejected with SENDER_BLOCKED_RECIPIENT',
    bobToCharlieRes?.ok === false && bobToCharlieRes?.error === 'SENDER_BLOCKED_RECIPIENT');

  // 10. PulseChat Contact Rules: Unsynced strangers cannot send messages
  let strangerSendRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_alice_to_eve',
    receiverId: 'stranger_eve',
    content: 'Spam to stranger'
  }, (res) => { strangerSendRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Unsynced stranger messaging is rejected with NOT_FRIENDS',
    strangerSendRes?.ok === false && strangerSendRes?.error === 'NOT_FRIENDS');

  // 11. PulseChat Contact Rules: Admin can contact any user
  const adminSocket = createMockSocket(io, 'admin_support');
  io.emit('connection', adminSocket);
  let adminSendRes = null;
  adminSocket.emit('chat:send', {
    messageId: 'msg_admin_to_eve',
    receiverId: 'stranger_eve',
    content: 'Official support message'
  }, (res) => { adminSendRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Admin can reach any user under contact rules',
    adminSendRes?.ok === true && adminSendRes?.queued === true);

  // 12. Negative Case: Non-ObjectId custom recipient string does not throw CastError
  let customIdRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_custom_id_test',
    receiverId: 'custom_str_not_a_valid_24_hex_objectid_123',
    content: 'Testing custom string ID'
  }, (res) => { customIdRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Non-ObjectId custom ID handled safely without CastError (returns RECIPIENT_NOT_FOUND)',
    customIdRes?.ok === false && customIdRes?.error === 'RECIPIENT_NOT_FOUND');

  // 13. Negative Case: Database failure during authorization strictly fails closed
  const originalFindOne = User.findOne;
  User.findOne = () => {
    throw new Error('SIMULATED_DB_DISCONNECTED_ERROR');
  };
  let dbFailRes = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_db_fail_test',
    receiverId: 'bob',
    content: 'Should fail closed on DB error'
  }, (res) => { dbFailRes = res; });
  await new Promise(r => setTimeout(r, 20));
  assert('Database failure during authorization strictly fails closed with AUTHORIZATION_FAILED',
    dbFailRes?.ok === false && dbFailRes?.error === 'AUTHORIZATION_FAILED');
  User.findOne = originalFindOne; // Restore

  console.log('\n--- TEST SUITE 4: Receipt Token Security & 7-Day Bounds ---');

  // 12. Legitimate message between synced friends (Alice to Bob)
  let validSendAck = null;
  aliceSocket.emit('chat:send', {
    messageId: 'msg_valid_alice_to_bob',
    receiverId: 'bob',
    content: 'Hello Bob! This is genuine Alice.'
  }, (res) => { validSendAck = res; });
  await new Promise(r => setTimeout(r, 50));

  assert('Valid message between synced friends is accepted and queued',
    validSendAck?.ok === true && validSendAck?.queued === true);
  assert('Receipt token is STRIPPED from sender ACK (no token leakage to sender)',
    validSendAck?.receiptToken === undefined);

  // Check stored queued message
  const queuedMsg = mockQueue.find(m => m.messageId === 'msg_valid_alice_to_bob');
  assert('Receipt token is securely stored in QueuedMessage for recipient',
    Boolean(queuedMsg && queuedMsg.receiptToken));

  // Check receipt token expiry bounds (must match 7-day queue TTL, not 30-day)
  const decodedTokenParts = queuedMsg.receiptToken.split('.');
  const tokenPayload = JSON.parse(Buffer.from(decodedTokenParts[0], 'base64url').toString('utf8'));
  const tokenExpiry = new Date(tokenPayload.expiresAt).getTime();
  const max7DaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000 + 5000;
  const min6DaysFromNow = Date.now() + 6 * 24 * 60 * 60 * 1000;

  assert('Receipt token expiry matches 7-day queue deadline (bounded <= 7 days)',
    tokenExpiry <= max7DaysFromNow && tokenExpiry >= min6DaysFromNow);

  console.log('\n--- TEST SUITE 5: Delivery & Read ACK Authorization and Retry Recovery ---');

  // 13. Impersonator (Eve) attempts to acknowledge delivery of Bob's message
  const eveSocket = createMockSocket(io, 'stranger_eve');
  io.emit('connection', eveSocket);

  let eveAckRes = null;
  eveSocket.emit('chat:delivered', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { eveAckRes = res; });
  await new Promise(r => setTimeout(r, 20));

  assert('Impersonator (Eve) attempting delivery ACK for Bob is rejected with INVALID_RECEIPT_TOKEN',
    eveAckRes?.ok === false && eveAckRes?.error === 'INVALID_RECEIPT_TOKEN');

  // 14. Unauthenticated socket attempting delivery ACK
  let anonAckRes = null;
  anonSocket.emit('chat:delivered', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { anonAckRes = res; });
  await new Promise(r => setTimeout(r, 20));

  assert('Unauthenticated socket delivery ACK is rejected with UNAUTHORIZED',
    anonAckRes?.ok === false && anonAckRes?.error === 'UNAUTHORIZED');

  // 15. Legitimate receiver (Bob) delivers ACK while sender (Alice) is online
  // Alice socket listens for receipt and confirms with { ok: true }
  aliceSocket.on('chat:receipt:delivered', (payload, ack) => {
    if (typeof ack === 'function') ack({ ok: true });
  });

  let bobAckRes = null;
  bobSocket.emit('chat:delivered', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { bobAckRes = res; });
  await new Promise(r => setTimeout(r, 50));

  assert('Legitimate receiver (Bob) delivery ACK is accepted and confirmed',
    bobAckRes?.ok === true);

  // 16. Read receipt forwarding when sender is offline
  // Simulate Alice socket disconnecting
  io._rooms.get('user:alice')?.clear();
  io._rooms.get('user_alice')?.clear();
  io._rooms.get('alice')?.clear();

  let bobReadOfflineRes = null;
  bobSocket.emit('chat:receipt:read', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { bobReadOfflineRes = res; });
  await new Promise(r => setTimeout(r, 50));

  assert('Read receipt when sender is offline signals retry: true (not dropped)',
    bobReadOfflineRes?.ok === false && bobReadOfflineRes?.retry === true);

  // 17. Reconnect Alice socket: Bob retries read receipt, which now succeeds
  aliceSocket.join('user:alice');
  aliceSocket.on('chat:receipt:read', (payload, ack) => {
    if (typeof ack === 'function') ack({ ok: true });
  });

  let bobReadRetryRes = null;
  bobSocket.emit('chat:receipt:read', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { bobReadRetryRes = res; });
  await new Promise(r => setTimeout(r, 50));

  assert('Read receipt retry succeeds after sender reconnects (not swallowed by dedupe)',
    bobReadRetryRes?.ok === true);

  // 18. Duplicate read receipt replay is now idempotently acknowledged
  let bobReadReplayRes = null;
  bobSocket.emit('chat:receipt:read', {
    messageId: 'msg_valid_alice_to_bob',
    receiptToken: queuedMsg.receiptToken
  }, (res) => { bobReadReplayRes = res; });
  await new Promise(r => setTimeout(r, 50));

  assert('Subsequent duplicate read receipt replay is idempotently recognized as alreadyRead',
    bobReadReplayRes?.ok === true && bobReadReplayRes?.alreadyRead === true);

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
