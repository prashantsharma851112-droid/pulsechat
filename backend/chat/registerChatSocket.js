const mongoose = require('mongoose');
const QueuedMessage = require('../models/QueuedMessage');
const MessageLedger = require('../models/MessageLedger');
const User = require('../models/User');
const db = require('../database/db');
const { createReceiptToken, verifyReceiptToken } = require('./receiptToken');

const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ENCRYPTED_QUEUE_TTL_MS = 24 * 60 * 60 * 1000; // Strict 24-hour maximum queue lifetime for encrypted payloads
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_SYNC_BATCH = 300;
const ACK_TIMEOUT_MS = 5_000;

const userRoom = (userId) => `user:${String(userId)}`;

// Serializes writes for a message within this Node process.
const messageLocks = new Map();
const recentReadReceipts = new Set();
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
    id: row.messageId,
    chatId: row.chatId,
    senderId: row.senderId,
    receiverId: row.receiverId,
    content: row.content,
    createdAt: new Date(row.createdAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
    receiptToken: row.receiptToken,
    isEncrypted: Boolean(row.isEncrypted),
    envelope: row.envelope || null
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
        resolve(false); // Sockets did not acknowledge receipt within timeout
      }
    }, ACK_TIMEOUT_MS);

    io.to(primaryRoom).to(altRoom1).to(altRoom2).emit(eventName, payload, (error, responses) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (error) {
          resolve(false);
          return;
        }
        const confirmed = Array.isArray(responses) ? responses.some((r) => r?.ok === true) : true;
        resolve(confirmed);
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
    // Derive authenticated identity strictly from verified socket session
    const getActiveUserId = () => {
      return socket.authenticatedUserId || socket.data?.userId || socket.userId || null;
    };

    const setupUserRooms = (uId) => {
      if (!uId) return;
      socket.join(userRoom(uId));
      socket.join(`user_${String(uId)}`);
      socket.join(String(uId));
      if (socket.authenticatedDeviceId) {
        socket.join(`device:${String(uId)}:${String(socket.authenticatedDeviceId)}`);
      }
      sendPendingForUser(io, String(uId)).catch((error) => {
        console.error('Initial pending-message sync failed:', error.message);
      });
    };

    const initialUserId = getActiveUserId();
    if (initialUserId) {
      setupUserRooms(initialUserId);
    }

    // Reject client-supplied identity overrides; strictly ignore mismatches
    socket.on('setup', (clientSuppliedId) => {
      const authUserId = getActiveUserId();
      if (!authUserId) {
        console.warn(`[chat] Rejected unauthenticated setup from socket ${socket.id}`);
        return;
      }
      if (clientSuppliedId && String(clientSuppliedId) !== String(authUserId)) {
        console.warn(`[chat] Rejected setup identity mismatch: authenticated=${authUserId}, supplied=${clientSuppliedId}`);
        return;
      }
      setupUserRooms(authUserId);
    });

    socket.on('chat:sync', async (_payload, ack) => {
      try {
        const uId = getActiveUserId();
        if (!uId) {
          safeAck(ack, { ok: false, error: 'UNAUTHORIZED' });
          return;
        }
        await sendPendingForUser(io, uId);
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

      const authUserId = getActiveUserId();
      if (!authUserId) {
        safeAck(ack, { ok: false, error: 'UNAUTHORIZED_SENDER' });
        return;
      }

      // Strictly reject client-supplied identity mismatches
      if (payload.senderId && String(payload.senderId) !== String(authUserId)) {
        safeAck(ack, { ok: false, error: 'SENDER_IDENTITY_MISMATCH' });
        return;
      }

      const senderId = String(authUserId);
      const receiverId = String(payload.receiverId);
      const messageId = payload.messageId;
      const content = payload.content.trim();

      if (senderId === receiverId) {
        safeAck(ack, { ok: false, error: 'CANNOT_MESSAGE_SELF' });
        return;
      }

      // Enforce recipient authorization & contact rules under PulseChat policy (Strict Fail-Closed)
      try {
        if (!User || typeof User.findOne !== 'function') {
          safeAck(ack, { ok: false, error: 'AUTHORIZATION_UNAVAILABLE' });
          return;
        }

        // Safe User Query: Avoid Mongoose CastError on non-ObjectId custom string IDs
        const isReceiverObjId = mongoose.Types.ObjectId.isValid(receiverId);
        const receiverConditions = [{ id: receiverId }];
        if (isReceiverObjId) receiverConditions.push({ _id: receiverId });

        const receiver = await User.findOne({ $or: receiverConditions })
          .select('id username blockedUsers friends isAdmin')
          .lean();

        if (!receiver) {
          safeAck(ack, { ok: false, error: 'RECIPIENT_NOT_FOUND' });
          return;
        }

        if (typeof db?.isUserBlocked === 'function') {
          const blockCheck = await db.isUserBlocked(senderId, String(receiver.id));
          if (blockCheck.isBlocked) {
            safeAck(ack, {
              ok: false,
              error: blockCheck.bBlockedA ? 'RECIPIENT_BLOCKED_SENDER' : 'SENDER_BLOCKED_RECIPIENT'
            });
            return;
          }
        }

        const isSenderObjId = mongoose.Types.ObjectId.isValid(senderId);
        const senderConditions = [{ id: senderId }];
        if (isSenderObjId) senderConditions.push({ _id: senderId });

        const sender = await User.findOne({ $or: senderConditions })
          .select('id username friends isAdmin')
          .lean();

        if (!sender) {
          safeAck(ack, { ok: false, error: 'UNAUTHORIZED_SENDER' });
          return;
        }

        const sIdentifiers = [sender.id, sender._id?.toString(), sender.username, senderId].filter(Boolean);
        const rIdentifiers = [receiver.id, receiver._id?.toString(), receiver.username, receiverId].filter(Boolean);

        const isFriend = (sender.friends && sender.friends.some(f => rIdentifiers.includes(f))) ||
                         (receiver.friends && receiver.friends.some(f => sIdentifiers.includes(f)));
        const isAdmin = Boolean(sender.isAdmin || receiver.isAdmin);

        if (!isFriend && !isAdmin) {
          const hasLedger = typeof MessageLedger?.findOne === 'function' && await MessageLedger.findOne({
            $or: [
              { senderId, receiverId: String(receiver.id) },
              { senderId: String(receiver.id), receiverId: senderId }
            ]
          }).lean();

          if (!hasLedger) {
            safeAck(ack, {
              ok: false,
              error: 'NOT_FRIENDS',
              message: 'You can only message synced friends. Send a friend request first.'
            });
            return;
          }
        }
      } catch (authErr) {
        console.error('[chat:send] Recipient verification error (failing closed):', authErr.message);
        safeAck(ack, { ok: false, error: 'AUTHORIZATION_FAILED' });
        return;
      }

      try {
        await withMessageLock(messageId, async () => {
          const now = new Date();
          const queueExpiresAt = new Date(now.getTime() + (payload.isEncrypted ? ENCRYPTED_QUEUE_TTL_MS : QUEUE_TTL_MS));
          const ledgerExpiresAt = new Date(now.getTime() + LEDGER_TTL_MS);
          const receiptToken = createReceiptToken({ messageId, senderId, receiverId, expiresAt: queueExpiresAt }, receiptSecret);
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
                messageId
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
                safeAck(ack, { ok: true, alreadyDelivered: true, messageId });
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
                content: payload.isEncrypted ? '' : (content || ''),
                isEncrypted: Boolean(payload.isEncrypted),
                envelope: payload.envelope || null,
                chatId: payload.chatId || null,
                senderDeviceId: payload.senderDeviceId || null,
                recipientDeviceId: payload.recipientDeviceId || null,
                createdAt: ledger.createdAt ?? now,
                expiresAt: ledger.queueExpiresAt ?? queueExpiresAt,
                receiptToken
              }
            },
            { upsert: true }
          );

          safeAck(ack, { ok: true, messageId, queued: true });

          // Forward to receiver if online
          await sendPendingForUser(io, receiverId);
        });
      } catch (error) {
        console.error('chat:send failed:', error.message);
        safeAck(ack, { ok: false, error: 'SEND_FAILED' });
      }
    });

    socket.on('chat:delivered', async (payload, ack) => {
      const authUserId = getActiveUserId();
      if (!authUserId) {
        safeAck(ack, { ok: false, error: 'UNAUTHORIZED' });
        return;
      }

      const receipt = verifyReceiptToken(payload?.receiptToken, receiptSecret);
      if (!receipt || receipt.receiverId !== String(authUserId) || receipt.messageId !== payload?.messageId) {
        safeAck(ack, { ok: false, error: 'INVALID_RECEIPT_TOKEN' });
        return;
      }

      const { messageId, senderId, receiverId } = receipt;
      try {
        await withMessageLock(messageId, async () => {
          const ledger = await MessageLedger.findOne({ messageId, senderId, receiverId });
          if (ledger && ledger.state === 'delivered') {
            // Idempotent: already delivered. Clean up queue if lingering and return safe ACK
            await QueuedMessage.deleteOne({ messageId, receiverId });
            safeAck(ack, { ok: true, alreadyDelivered: true });
            return;
          }

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
      const authUserId = getActiveUserId();
      if (!authUserId) {
        safeAck(ack, { ok: false, error: 'UNAUTHORIZED' });
        return;
      }

      const receipt = verifyReceiptToken(payload?.receiptToken, receiptSecret);
      if (!receipt || receipt.receiverId !== String(authUserId) || receipt.messageId !== payload?.messageId) {
        safeAck(ack, { ok: false, error: 'INVALID_RECEIPT_TOKEN' });
        return;
      }

      // Idempotent replay protection for read receipts
      const readDedupeKey = `${receipt.messageId}:${receipt.receiverId}`;
      if (recentReadReceipts.has(readDedupeKey)) {
        safeAck(ack, { ok: true, alreadyRead: true });
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

      // Only mark deduplicated if forwarded successfully, allowing outbox retry if sender is offline
      if (forwarded) {
        recentReadReceipts.add(readDedupeKey);
        const timer = setTimeout(() => recentReadReceipts.delete(readDedupeKey), 10 * 60 * 1000);
        if (timer.unref) timer.unref();
      }

      safeAck(ack, { ok: forwarded, retry: !forwarded });
    });
  });
}

module.exports = {
  registerChatSocket
};
