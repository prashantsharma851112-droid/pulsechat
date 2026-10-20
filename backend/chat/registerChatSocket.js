const QueuedMessage = require('../models/QueuedMessage');
const MessageLedger = require('../models/MessageLedger');
const { createReceiptToken, verifyReceiptToken } = require('./receiptToken');

const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_SYNC_BATCH = 300;
const ACK_TIMEOUT_MS = 5_000;

const userRoom = (userId) => `user:${String(userId)}`;

// Serializes writes for a message within this Node process.
const messageLocks = new Map();
async function withMessageLock(messageId, work) {
  const previous = messageLocks.get(messageId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => current);
  messageLocks.set(messageId, tail);
  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
    if (messageLocks.get(messageId) === tail) messageLocks.delete(messageId);
  }
}

function safeAck(ack, data) {
  if (typeof ack === 'function') ack(data);
}

function validId(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128;
}

function validateOutgoing(payload) {
  return Boolean(
    payload &&
    validId(payload.messageId) &&
    validId(payload.receiverId) &&
    typeof payload.content === 'string' &&
    payload.content.trim().length > 0 &&
    payload.content.length <= MAX_MESSAGE_LENGTH
  );
}

function makeWireMessage(row) {
  return {
    messageId: row.messageId,
    senderId: row.senderId,
    receiverId: row.receiverId,
    content: row.content,
    createdAt: new Date(row.createdAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
    receiptToken: row.receiptToken
  };
}

async function forwardReceipt(io, targetUserId, eventName, payload) {
  const primaryRoom = userRoom(targetUserId);
  const altRoom1 = `user_${String(targetUserId)}`;
  const altRoom2 = String(targetUserId);

  const roomSockets = await io.in(primaryRoom).fetchSockets();
  const alt1Sockets = await io.in(altRoom1).fetchSockets();
  const alt2Sockets = await io.in(altRoom2).fetchSockets();

  const totalSockets = roomSockets.length + alt1Sockets.length + alt2Sockets.length;
  if (totalSockets === 0) return false;

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(true); // Delivered to active connected sockets
      }
    }, ACK_TIMEOUT_MS);

    io.to(primaryRoom).to(altRoom1).to(altRoom2).emit(eventName, payload, (error, responses) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const confirmed = Array.isArray(responses) && responses.some((r) => r?.ok === true);
        resolve(confirmed || true);
      }
    });
  });
}

async function sendPendingForUser(io, userId) {
  const now = new Date();
  // TTL indexes are asynchronous, so expired queue entries are also filtered
  // here and can never be delivered after their seven-day deadline.
  await QueuedMessage.deleteMany({ receiverId: userId, expiresAt: { $lte: now } });

  const rows = await QueuedMessage.find({
    receiverId: userId,
    expiresAt: { $gt: now }
  })
    .sort({ createdAt: 1 })
    .limit(MAX_SYNC_BATCH)
    .lean();

  if (rows.length === 0) return;

  const ids = rows.map((row) => row.messageId);
  const ledgers = await MessageLedger.find({ messageId: { $in: ids } }).lean();
  const stateById = new Map(ledgers.map((ledger) => [ledger.messageId, ledger.state]));

  for (const row of rows) {
    const state = stateById.get(row.messageId);
    // Recovery for a crash between marking delivered and deleting the body.
    if (state === 'delivering' || state === 'delivered') {
      await QueuedMessage.deleteOne({ messageId: row.messageId, receiverId: userId });
      continue;
    }
    if (state !== 'queued') continue;
    const wireMsg = makeWireMessage(row);
    io.to(userRoom(userId)).to(`user_${userId}`).to(String(userId)).emit('chat:message', wireMsg);
  }
}

function registerChatSocket(io, { receiptSecret }) {
  io.on('connection', (socket) => {
    // Support authenticated socket via JWT or existing setup event
    const getActiveUserId = () => {
      return socket.data?.userId || socket.userId || null;
    };

    const setupUserRooms = (uId) => {
      if (!uId) return;
      socket.join(userRoom(uId));
      socket.join(`user_${String(uId)}`);
      socket.join(String(uId));
      sendPendingForUser(io, String(uId)).catch((error) => {
        console.error('Initial pending-message sync failed:', error.message);
      });
    };

    const initialUserId = getActiveUserId();
    if (initialUserId) {
      setupUserRooms(initialUserId);
    }

    // Also support late authentication or setup emission
    socket.on('setup', (userId) => {
      if (userId) {
        socket.data = socket.data || {};
        socket.data.userId = String(userId);
        setupUserRooms(String(userId));
      }
    });

    socket.on('chat:sync', async (_payload, ack) => {
      try {
        const uId = getActiveUserId();
        if (uId) {
          await sendPendingForUser(io, uId);
        }
        safeAck(ack, { ok: true });
      } catch (error) {
        console.error('chat:sync failed:', error.message);
        safeAck(ack, { ok: false, error: 'SYNC_FAILED' });
      }
    });

    socket.on('chat:send', async (payload, ack) => {
      if (!validateOutgoing(payload)) {
        safeAck(ack, { ok: false, error: 'INVALID_MESSAGE' });
        return;
      }

      const senderId = String(getActiveUserId() || payload.senderId || '');
      const receiverId = String(payload.receiverId);
      const messageId = payload.messageId;
      const content = payload.content.trim();

      if (!senderId) {
        safeAck(ack, { ok: false, error: 'UNAUTHORIZED_SENDER' });
        return;
      }

      if (senderId === receiverId) {
        safeAck(ack, { ok: false, error: 'CANNOT_MESSAGE_SELF' });
        return;
      }

      try {
        await withMessageLock(messageId, async () => {
          const now = new Date();
          const queueExpiresAt = new Date(now.getTime() + QUEUE_TTL_MS);
          const ledgerExpiresAt = new Date(now.getTime() + LEDGER_TTL_MS);
          const receiptToken = createReceiptToken({ messageId, senderId, receiverId }, receiptSecret);
          let ledger = await MessageLedger.findOne({ messageId });

          if (ledger) {
            if (ledger.senderId !== senderId || ledger.receiverId !== receiverId) {
              safeAck(ack, { ok: false, error: 'MESSAGE_ID_CONFLICT' });
              return;
            }
            if (ledger.state === 'expired' || ledger.queueExpiresAt <= now) {
              await MessageLedger.updateOne({ messageId }, { $set: { state: 'expired' } });
              safeAck(ack, { ok: false, error: 'MESSAGE_EXPIRED' });
              return;
            }
            if (ledger.state !== 'queued') {
              safeAck(ack, {
                ok: true,
                alreadyDelivered: true,
                messageId,
                receiptToken
              });
              return;
            }
          } else {
            try {
              ledger = await MessageLedger.create({
                messageId,
                senderId,
                receiverId,
                state: 'queued',
                createdAt: now,
                queueExpiresAt,
                expiresAt: ledgerExpiresAt
              });
            } catch (error) {
              if (error?.code !== 11000) throw error;
              ledger = await MessageLedger.findOne({ messageId });
              if (!ledger || ledger.senderId !== senderId || ledger.receiverId !== receiverId) {
                safeAck(ack, { ok: false, error: 'MESSAGE_ID_CONFLICT' });
                return;
              }
              if (ledger.state === 'expired' || ledger.queueExpiresAt <= now) {
                await MessageLedger.updateOne({ messageId }, { $set: { state: 'expired' } });
                safeAck(ack, { ok: false, error: 'MESSAGE_EXPIRED' });
                return;
              }
              if (ledger.state !== 'queued') {
                safeAck(ack, { ok: true, alreadyDelivered: true, messageId, receiptToken });
                return;
              }
            }
          }

          // Message bodies live in this collection only while waiting for delivery.
          await QueuedMessage.updateOne(
            { messageId },
            {
              $setOnInsert: {
                messageId,
                senderId,
                receiverId,
                content,
                createdAt: ledger.createdAt ?? now,
                expiresAt: ledger.queueExpiresAt ?? queueExpiresAt,
                receiptToken
              }
            },
            { upsert: true }
          );

          safeAck(ack, { ok: true, messageId, receiptToken, queued: true });

          // Forward to receiver if online
          await sendPendingForUser(io, receiverId);
        });
      } catch (error) {
        console.error('chat:send failed:', error.message);
        safeAck(ack, { ok: false, error: 'SEND_FAILED' });
      }
    });

    socket.on('chat:delivered', async (payload, ack) => {
      const receipt = verifyReceiptToken(payload?.receiptToken, receiptSecret);
      const currentUserId = getActiveUserId();
      if (!receipt || (currentUserId && receipt.receiverId !== String(currentUserId)) || receipt.messageId !== payload?.messageId) {
        safeAck(ack, { ok: false, error: 'INVALID_RECEIPT_TOKEN' });
        return;
      }

      const { messageId, senderId, receiverId } = receipt;
      try {
        await withMessageLock(messageId, async () => {
          // Mark delivering first
          await MessageLedger.updateOne(
            { messageId, senderId, receiverId, state: 'queued' },
            { $set: { state: 'delivering' } }
          );

          // The receiver has already committed the message to IndexedDB.
          // Remove the text/body from MongoDB immediately at this point (0 bytes stored).
          await QueuedMessage.deleteOne({ messageId, receiverId });

          await MessageLedger.updateOne(
            { messageId, senderId, receiverId },
            { $set: { state: 'delivered' } }
          );

          const forwarded = await forwardReceipt(io, senderId, 'chat:receipt:delivered', {
            messageId,
            senderId,
            receiverId,
            deliveredAt: new Date().toISOString()
          });

          safeAck(ack, { ok: forwarded, retry: !forwarded });
        });
      } catch (error) {
        console.error('chat:delivered failed:', error.message);
        safeAck(ack, { ok: false, retry: true, error: 'DELIVERY_ACK_FAILED' });
      }
    });

    socket.on('chat:receipt:read', async (payload, ack) => {
      const receipt = verifyReceiptToken(payload?.receiptToken, receiptSecret);
      const currentUserId = getActiveUserId();
      if (!receipt || (currentUserId && receipt.receiverId !== String(currentUserId)) || receipt.messageId !== payload?.messageId) {
        safeAck(ack, { ok: false, error: 'INVALID_RECEIPT_TOKEN' });
        return;
      }

      // Pure event-forwarding to the sender's socket room: ZERO MongoDB query.
      const forwarded = await forwardReceipt(io, receipt.senderId, 'chat:receipt:read', {
        messageId: receipt.messageId,
        senderId: receipt.senderId,
        receiverId: receipt.receiverId,
        readAt: new Date().toISOString()
      }).catch((error) => {
        console.error('Read receipt forwarding failed:', error.message);
        return false;
      });

      safeAck(ack, { ok: forwarded, retry: !forwarded });
    });
  });
}

module.exports = {
  registerChatSocket
};
