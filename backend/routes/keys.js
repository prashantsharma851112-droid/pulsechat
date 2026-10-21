const express = require('express');
const { rateLimit } = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const DeviceIdentity = require('../models/DeviceIdentity');
const ToDeviceTxn = require('../models/ToDeviceTxn');

const MAX_TO_DEVICE_BODY_BYTES = 64 * 1024;
const MAX_TO_DEVICE_CONTENT_BYTES = 16 * 1024;
const DEVICE_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const TXN_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 120;

const ALLOWED_EVENT_TYPES = new Set([
  'm.room.encrypted',
  'm.room_key',
  'm.room_key_request',
  'm.forwarded_room_key',
  'm.dummy',
  'm.key.verification.start',
  'm.key.verification.accept',
  'm.key.verification.key',
  'm.key.verification.mac',
  'm.key.verification.cancel',
  'm.key.verification.done'
]);

const limiterStore = new Map();

const registerDeviceLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `keys-register:${safeUserId(req) || 'anon'}`
});

const revokeDeviceLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `keys-revoke:${safeUserId(req) || 'anon'}`
});

const toDeviceLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = safeUserId(req) || 'anon';
    const deviceId = String(req.get('x-device-id') || 'unknown');
    return `keys-to-device:${userId}:${deviceId}`;
  }
});

function trimLimiter(now) {
  for (const [key, value] of limiterStore.entries()) {
    if (!value || value.resetAt <= now) limiterStore.delete(key);
  }
}

function rateLimited(key) {
  const now = Date.now();
  trimLimiter(now);
  const existing = limiterStore.get(key);
  if (!existing || existing.resetAt <= now) {
    limiterStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX_PER_WINDOW;
}

function safeUserId(req) {
  return String(req.user?.id || req.userId || '').trim();
}

function validEventType(eventType) {
  return typeof eventType === 'string' &&
    (ALLOWED_EVENT_TYPES.has(eventType) || eventType.startsWith('m.key.verification.'));
}

function validateTxnId(txnId) {
  return typeof txnId === 'string' && TXN_ID_RE.test(txnId);
}

function validateDeviceId(deviceId) {
  return typeof deviceId === 'string' && DEVICE_ID_RE.test(deviceId);
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function jsonSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function parseMessageEntries(messages) {
  if (!plainObject(messages)) return { error: 'INVALID_MESSAGES_SHAPE' };
  const users = Object.keys(messages);
  if (users.length !== 1) return { error: 'SINGLE_RECIPIENT_REQUIRED' };

  const recipientUserId = users[0];
  const perDevice = messages[recipientUserId];
  if (!plainObject(perDevice)) return { error: 'INVALID_DEVICE_MAP' };
  const devices = Object.keys(perDevice);
  if (devices.length !== 1) return { error: 'SINGLE_TARGET_DEVICE_REQUIRED' };

  const recipientDeviceId = devices[0];
  const content = perDevice[recipientDeviceId];
  if (!validateDeviceId(recipientDeviceId)) return { error: 'INVALID_DEVICE_ID' };
  if (!plainObject(content)) return { error: 'INVALID_CONTENT_SHAPE' };
  if (jsonSize(content) > MAX_TO_DEVICE_CONTENT_BYTES) return { error: 'CONTENT_TOO_LARGE' };
  return { recipientUserId: String(recipientUserId), recipientDeviceId, content };
}

function sanitizeDevicePayload(body) {
  if (!plainObject(body)) return { error: 'INVALID_PAYLOAD' };
  const { deviceId, algorithms, keys, signatures, oneTimeKeys = {}, fallbackKeys = {} } = body;
  if (!validateDeviceId(deviceId)) return { error: 'INVALID_DEVICE_ID' };
  if (!Array.isArray(algorithms) || algorithms.length === 0 || algorithms.some((a) => typeof a !== 'string')) {
    return { error: 'INVALID_ALGORITHMS' };
  }
  if (!plainObject(keys) || !plainObject(signatures)) return { error: 'INVALID_KEY_MATERIAL' };
  if (!plainObject(oneTimeKeys) || !plainObject(fallbackKeys)) return { error: 'INVALID_ONE_TIME_OR_FALLBACK_KEYS' };
  if (jsonSize(body) > MAX_TO_DEVICE_BODY_BYTES) return { error: 'PAYLOAD_TOO_LARGE' };
  return { deviceId, algorithms, keys, signatures, oneTimeKeys, fallbackKeys };
}

async function sendToDevice(io, senderUserId, senderDeviceId, recipientUserId, recipientDeviceId, eventType, txnId, content) {
  const room = `device:${recipientUserId}:${recipientDeviceId}`;
  const sockets = await io.in(room).fetchSockets();
  if (sockets.length === 0) return false;
  io.to(room).emit('keys:to_device', {
    eventType,
    txnId,
    senderUserId,
    senderDeviceId,
    recipientUserId,
    recipientDeviceId,
    content
  });
  return true;
}

function createKeysRouter() {
  const router = express.Router();

  router.post('/devices/register', authMiddleware, registerDeviceLimiter, async (req, res) => {
    const userId = safeUserId(req);
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (rateLimited(`register:${userId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

    const parsed = sanitizeDevicePayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const now = new Date();
    const update = {
      ...parsed,
      isRevoked: false,
      revokedAt: null,
      lastSeenAt: now
    };

    await DeviceIdentity.updateOne(
      { userId, deviceId: parsed.deviceId },
      { $set: update, $setOnInsert: { userId } },
      { upsert: true }
    );

    return res.json({ ok: true, userId, deviceId: parsed.deviceId });
  });

  router.post('/devices/:deviceId/revoke', authMiddleware, revokeDeviceLimiter, async (req, res) => {
    const userId = safeUserId(req);
    const { deviceId } = req.params;
    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!validateDeviceId(deviceId)) return res.status(400).json({ error: 'INVALID_DEVICE_ID' });
    if (rateLimited(`revoke:${userId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

    const result = await DeviceIdentity.updateOne(
      { userId, deviceId, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date(), lastSeenAt: new Date() } }
    );

    if (!result?.matchedCount) return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
    return res.json({ ok: true, revoked: true, userId, deviceId });
  });

  router.post('/to-device/:eventType/:txnId', authMiddleware, toDeviceLimiter, async (req, res) => {
    const senderUserId = safeUserId(req);
    const senderDeviceId = String(req.get('x-device-id') || '').trim();
    const { eventType, txnId } = req.params;

    if (!senderUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!validateDeviceId(senderDeviceId)) return res.status(400).json({ error: 'SENDER_DEVICE_ID_REQUIRED' });
    if (!validEventType(eventType)) return res.status(400).json({ error: 'UNSUPPORTED_EVENT_TYPE' });
    if (!validateTxnId(txnId)) return res.status(400).json({ error: 'INVALID_TXN_ID' });
    if (jsonSize(req.body) > MAX_TO_DEVICE_BODY_BYTES) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    if (rateLimited(`to_device:${senderUserId}:${senderDeviceId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

    const senderDevice = await DeviceIdentity.findOne({ userId: senderUserId, deviceId: senderDeviceId, isRevoked: false })
      .select('userId deviceId')
      .lean();
    if (!senderDevice) return res.status(403).json({ error: 'SENDER_DEVICE_NOT_REGISTERED' });

    const parsed = parseMessageEntries(req.body?.messages);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { recipientUserId, recipientDeviceId, content } = parsed;
    if (recipientUserId === senderUserId && recipientDeviceId === senderDeviceId) {
      return res.status(400).json({ error: 'SELF_TO_SELF_NOT_ALLOWED' });
    }

    const recipientUser = await User.findOne({ id: recipientUserId }).select('id').lean();
    if (!recipientUser) return res.status(404).json({ error: 'RECIPIENT_NOT_FOUND' });

    const recipientDevice = await DeviceIdentity.findOne({
      userId: recipientUserId,
      deviceId: recipientDeviceId,
      isRevoked: false
    }).select('userId deviceId').lean();
    if (!recipientDevice) return res.status(404).json({ error: 'TARGET_DEVICE_NOT_FOUND' });

    try {
      await ToDeviceTxn.create({
        senderUserId,
        senderDeviceId,
        txnId,
        eventType,
        createdAt: new Date()
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(200).json({ ok: true, idempotent: true, delivered: false });
      throw error;
    }

    const io = req.app.get('io');
    if (!io) return res.status(503).json({ error: 'DELIVERY_UNAVAILABLE' });
    const delivered = await sendToDevice(
      io,
      senderUserId,
      senderDeviceId,
      recipientUserId,
      recipientDeviceId,
      eventType,
      txnId,
      content
    );

    return res.status(200).json({
      ok: true,
      delivered,
      recipientUserId,
      recipientDeviceId,
      eventType,
      txnId
    });
  });

  return router;
}

module.exports = createKeysRouter;
module.exports.__private = {
  validEventType,
  validateTxnId,
  validateDeviceId,
  parseMessageEntries,
  sanitizeDevicePayload
};
