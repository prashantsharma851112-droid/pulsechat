const express = require('express');
const mongoose = require('mongoose');
let rateLimit = null;
try {
  const mod = require('express-rate-limit');
  rateLimit = mod.rateLimit || mod;
} catch (_) {
  rateLimit = function(options = {}) {
    const windowMs = options.windowMs || 60000;
    const max = options.limit || options.max || 100;
    const keyGen = options.keyGenerator || ((req) => req.ip || 'anon');
    const store = new Map();
    return function fallbackRateLimiter(req, res, next) {
      const now = Date.now();
      const key = keyGen(req);
      const record = store.get(key);
      if (!record || record.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }
      record.count += 1;
      if (record.count > max) {
        return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded, please try again later.' });
      }
      return next();
    };
  };
}
const authMiddleware = require('../middleware/authMiddleware');

// Graceful models resolution: supports DeviceIdentity/ToDeviceTxn (PR #1)
// and DeviceKey/OneTimePrekey (main) seamlessly.
let User = null;
let DeviceIdentity = null;
let ToDeviceTxn = null;
let DeviceKey = null;
let OneTimePrekey = null;
let MessageLedger = null;

try { User = require('../models/User'); } catch (_) {}
try { DeviceIdentity = require('../models/DeviceIdentity'); } catch (_) {}
try { ToDeviceTxn = require('../models/ToDeviceTxn'); } catch (_) {}
try { DeviceKey = require('../models/DeviceKey'); } catch (_) {}
try { OneTimePrekey = require('../models/OneTimePrekey'); } catch (_) {}
try { MessageLedger = require('../models/MessageLedger'); } catch (_) {}

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

const SENSITIVE_KEY_NAMES = new Set([
  'd',
  'priv',
  'private',
  'privatekey',
  'private_key',
  'privkey',
  'priv_key',
  'secret',
  'secretkey',
  'secret_key',
  'seed',
  'sk',
  'xprv'
]);

const limiterStore = new Map();

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

function getHeader(req, name) {
  if (!req) return '';
  if (typeof req.get === 'function') {
    const val = req.get(name);
    if (val !== undefined && val !== null) return String(val);
  }
  if (req.headers && typeof req.headers === 'object') {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() === lower && v !== undefined && v !== null) {
        return String(v);
      }
    }
  }
  return '';
}

const toDeviceLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = safeUserId(req) || 'anon';
    const deviceId = getHeader(req, 'x-device-id') || 'unknown';
    return `keys-to-device:${userId}:${deviceId}`;
  }
});

function safeUserId(req) {
  return String(req.user?.id || req.userId || req.user?.userId || req.user?._id || '').trim();
}

function normalizeUserId(rawId) {
  if (!rawId) return '';
  return String(rawId).replace(/^@/, '').replace(/:.*$/, '').trim();
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

/**
 * Deep recursive check to ensure no private key material is ever uploaded or relayed.
 * Detects PEM private key headers, JWK private scalar 'd', and sensitive secret attributes.
 * Prevents false positives on innocent single letter 'd' properties.
 */
function containsPrivateKeyMaterial(obj, seen = new WeakSet(), depth = 0) {
  if (depth > 12 || !obj) return false;
  if (typeof obj === 'string') {
    const s = obj.toUpperCase();
    if (
      s.includes('BEGIN PRIVATE KEY') ||
      s.includes('BEGIN EC PRIVATE KEY') ||
      s.includes('BEGIN OPENSSH PRIVATE KEY') ||
      s.includes('BEGIN RSA PRIVATE KEY') ||
      s.includes('BEGIN ENCRYPTED PRIVATE KEY')
    ) {
      return true;
    }
    return false;
  }
  if (typeof obj !== 'object') return false;
  if (seen.has(obj)) return false;
  seen.add(obj);

  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEY_NAMES.has(lower)) {
      if (lower === 'd') {
        // JWK private scalar check: require string >= 16 chars or explicit JWK parameters
        if (typeof v === 'string' && (v.length >= 16 || obj.kty || obj.crv)) {
          return true;
        }
      } else {
        return true;
      }
    }
    if (containsPrivateKeyMaterial(v, seen, depth + 1)) return true;
  }
  return false;
}

async function findUserByIdSafe(userId) {
  if (!userId || !User) return null;
  const s = String(userId).trim();
  const withoutUser = s.replace(/^user_/, '');
  const withUser = s.startsWith('user_') ? s : `user_${s}`;
  const candidates = Array.from(new Set([s, withoutUser, withUser].filter(Boolean)));
  const isObjId = mongoose.Types.ObjectId.isValid(s);
  const conditions = [];
  candidates.forEach(c => {
    conditions.push({ id: c });
    conditions.push({ username: c });
  });
  if (isObjId) conditions.push({ _id: s });
  return User.findOne({ $or: conditions })
    .select('id _id username blockedUsers friends isAdmin')
    .lean();
}

async function checkKeyExchangeAuthorization(senderId, recipientId) {
  if (senderId === recipientId) {
    return { authorized: true };
  }
  const [senderUser, recipientUser] = await Promise.all([
    findUserByIdSafe(senderId),
    findUserByIdSafe(recipientId)
  ]);
  if (!senderUser) return { authorized: false, error: 'UNAUTHORIZED_SENDER', status: 401 };
  if (!recipientUser) return { authorized: false, error: 'RECIPIENT_NOT_FOUND', status: 404 };

  const rIdStr = String(recipientUser.id || recipientId);
  const sIdStr = String(senderUser.id || senderId);

  const senderBlocked = Boolean(senderUser.blockedUsers && senderUser.blockedUsers.map(String).includes(rIdStr));
  const recipientBlocked = Boolean(recipientUser.blockedUsers && recipientUser.blockedUsers.map(String).includes(sIdStr));
  if (senderBlocked || recipientBlocked) {
    return {
      authorized: false,
      error: 'BLOCKED',
      reason: recipientBlocked ? 'RECIPIENT_BLOCKED_SENDER' : 'SENDER_BLOCKED_RECIPIENT',
      status: 403
    };
  }

  const sIdentifiers = [senderUser.id, senderUser._id?.toString(), senderUser.username, senderId].filter(Boolean).map(String);
  const rIdentifiers = [recipientUser.id, recipientUser._id?.toString(), recipientUser.username, recipientId].filter(Boolean).map(String);

  const isFriend = (senderUser.friends && senderUser.friends.some((f) => rIdentifiers.includes(String(f)))) ||
                   (recipientUser.friends && recipientUser.friends.some((f) => sIdentifiers.includes(String(f))));
  const isAdmin = Boolean(senderUser.isAdmin || recipientUser.isAdmin);

  if (isFriend || isAdmin) {
    return { authorized: true, senderUser, recipientUser };
  }

  // Check MessageLedger for prior conversation history
  if (typeof MessageLedger?.findOne === 'function') {
    const hasLedger = await MessageLedger.findOne({
      $or: [
        { senderId, receiverId: rIdStr },
        { senderId: rIdStr, receiverId: senderId },
        { senderId: { $in: sIdentifiers }, receiverId: { $in: rIdentifiers } },
        { senderId: { $in: rIdentifiers }, receiverId: { $in: sIdentifiers } }
      ]
    }).lean();
    if (hasLedger) {
      return { authorized: true, senderUser, recipientUser };
    }
  }

  return {
    authorized: false,
    error: 'NOT_CONTACTS',
    message: 'You can only exchange keys with synced contacts.',
    status: 403
  };
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
  if (containsPrivateKeyMaterial(body)) return { error: 'PRIVATE_KEY_MATERIAL_NOT_PERMITTED' };

  // Support both Matrix KeysUploadRequest (body.device_keys) and flat object structure
  const rawDevice = plainObject(body.device_keys) ? body.device_keys : (body.deviceKeys || body);
  const deviceId = rawDevice.device_id || rawDevice.deviceId || body.deviceId;
  const algorithms = rawDevice.algorithms || ['m.olm.v1.curve25519-aes-sha2'];
  const keys = rawDevice.keys || rawDevice.publicKey || body.keys || body.publicKey;
  const signatures = rawDevice.signatures || body.signatures || {};
  const oneTimeKeys = body.one_time_keys || body.oneTimeKeys || {};
  const fallbackKeys = body.fallback_keys || body.fallbackKeys || {};
  const deviceLabel = body.deviceLabel || rawDevice.deviceLabel || 'PulseChat Client';

  if (!validateDeviceId(deviceId)) return { error: 'INVALID_DEVICE_ID' };
  if (!Array.isArray(algorithms) || algorithms.length === 0 || algorithms.some((a) => typeof a !== 'string')) {
    return { error: 'INVALID_ALGORITHMS' };
  }
  if (!plainObject(keys) && typeof keys !== 'object') return { error: 'INVALID_KEY_MATERIAL' };
  if (!plainObject(signatures)) return { error: 'INVALID_KEY_MATERIAL' };
  if (!plainObject(oneTimeKeys) || !plainObject(fallbackKeys)) return { error: 'INVALID_ONE_TIME_OR_FALLBACK_KEYS' };
  if (jsonSize(body) > MAX_TO_DEVICE_BODY_BYTES) return { error: 'PAYLOAD_TOO_LARGE' };

  return { deviceId, algorithms, keys, signatures, oneTimeKeys, fallbackKeys, deviceLabel };
}

function countOneTimeKeys(oneTimeKeysObj) {
  const counts = {};
  if (!plainObject(oneTimeKeysObj)) return counts;
  for (const keyId of Object.keys(oneTimeKeysObj)) {
    const algorithm = keyId.split(':')[0] || 'signed_curve25519';
    counts[algorithm] = (counts[algorithm] || 0) + 1;
  }
  return counts;
}

async function sendToDevice(io, senderUserId, senderDeviceId, recipientUserId, recipientDeviceId, eventType, txnId, content) {
  const room = `device:${recipientUserId}:${recipientDeviceId}`;
  const sockets = await io.in(room).fetchSockets();

  const payload = {
    eventType,
    txnId,
    senderUserId,
    senderDeviceId,
    recipientUserId,
    recipientDeviceId,
    content
  };

  io.to(room).emit('keys:to_device', payload);
  io.to(`user_${recipientUserId}`).emit('to_device', {
    sender: `@${senderUserId}:pulsechat.local`,
    senderId: senderUserId,
    senderDeviceId,
    type: eventType,
    content,
    recipientDeviceId
  });

  return sockets.length > 0;
}

// ============================================================================
// ROUTER INITIALIZATION & ROUTE HANDLERS
// ============================================================================

const router = express.Router();

// 1. Device Key Upload & Registration (/upload, /devices/register, /register)
const handleKeyUpload = async (req, res) => {
  const authUserId = safeUserId(req);
  if (!authUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (rateLimited(`register:${authUserId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

  if (containsPrivateKeyMaterial(req.body)) {
    return res.status(400).json({ error: 'PRIVATE_KEY_MATERIAL_NOT_PERMITTED' });
  }

  const parsed = sanitizeDevicePayload(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  // Prevent identity spoofing: cannot upload keys under someone else's user ID
  const bodyUserId = req.body.device_keys?.user_id || req.body.userId || req.body.user_id;
  if (bodyUserId && normalizeUserId(bodyUserId) !== normalizeUserId(authUserId)) {
    return res.status(403).json({ error: 'CANNOT_UPLOAD_FOR_ANOTHER_USER' });
  }

  const cleanUserId = normalizeUserId(authUserId);
  const cleanDeviceId = parsed.deviceId;
  const now = new Date();

  // 1A. Sync to DeviceIdentity model (if present)
  let mergedOneTimeKeys = parsed.oneTimeKeys;
  if (DeviceIdentity) {
    const existingDev = await DeviceIdentity.findOne({ userId: cleanUserId, deviceId: cleanDeviceId }).lean();
    mergedOneTimeKeys = {
      ...(existingDev?.oneTimeKeys || {}),
      ...parsed.oneTimeKeys
    };

    const updateDev = {
      deviceId: cleanDeviceId,
      algorithms: parsed.algorithms,
      keys: parsed.keys,
      signatures: parsed.signatures,
      oneTimeKeys: mergedOneTimeKeys,
      fallbackKeys: { ...(existingDev?.fallbackKeys || {}), ...parsed.fallbackKeys },
      isRevoked: false,
      revokedAt: null,
      lastSeenAt: now
    };

    await DeviceIdentity.updateOne(
      { userId: cleanUserId, deviceId: cleanDeviceId },
      { $set: updateDev, $setOnInsert: { userId: cleanUserId } },
      { upsert: true }
    );
  }

  // 1B. Sync to DeviceKey & OneTimePrekey models (if present)
  let fallbackKeyObj = null;
  if (parsed.fallbackKeys && Object.keys(parsed.fallbackKeys).length > 0) {
    const firstEntry = Object.entries(parsed.fallbackKeys)[0];
    fallbackKeyObj = {
      keyId: firstEntry[0],
      keyData: typeof firstEntry[1] === 'string' ? { key: firstEntry[1] } : firstEntry[1]
    };
  }

  if (DeviceKey) {
    await DeviceKey.findOneAndUpdate(
      { userId: cleanUserId, deviceId: cleanDeviceId },
      {
        $set: {
          userId: cleanUserId,
          deviceId: cleanDeviceId,
          publicKey: parsed.keys,
          keys: parsed.keys,
          signatures: parsed.signatures,
          algorithms: parsed.algorithms,
          fallbackKey: fallbackKeyObj,
          deviceLabel: parsed.deviceLabel,
          revoked: false,
          revokedAt: null,
          lastActiveAt: now
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if (OneTimePrekey && Object.keys(parsed.oneTimeKeys).length > 0) {
    const bulkOps = Object.entries(parsed.oneTimeKeys).map(([keyId, keyData]) => ({
      updateOne: {
        filter: { userId: cleanUserId, deviceId: cleanDeviceId, keyId: String(keyId) },
        update: {
          $setOnInsert: {
            userId: cleanUserId,
            deviceId: cleanDeviceId,
            keyId: String(keyId),
            keyData: typeof keyData === 'string' ? { key: keyData } : keyData,
            isConsumed: false,
            consumedAt: null,
            createdAt: now
          }
        },
        upsert: true
      }
    }));
    await OneTimePrekey.bulkWrite(bulkOps, { ordered: false });
  }

  // Calculate unconsumed OTK count
  let otkCounts = countOneTimeKeys(mergedOneTimeKeys);
  if (OneTimePrekey) {
    const unconsumedCount = await OneTimePrekey.countDocuments({
      userId: cleanUserId,
      deviceId: cleanDeviceId,
      isConsumed: false
    });
    otkCounts = { signed_curve25519: unconsumedCount };
  }

  return res.json({
    ok: true,
    success: true,
    userId: cleanUserId,
    deviceId: cleanDeviceId,
    registeredAt: now,
    one_time_key_counts: otkCounts
  });
};

router.post('/upload', authMiddleware, registerDeviceLimiter, handleKeyUpload);
router.post('/devices/register', authMiddleware, registerDeviceLimiter, handleKeyUpload);
router.post('/register', authMiddleware, registerDeviceLimiter, handleKeyUpload);

// 2. Query Device Keys (/query, /:userId, /devices/my)
const handleQuery = async (req, res) => {
  const authUserId = safeUserId(req);
  if (!authUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const requestedUsers = plainObject(req.body?.device_keys)
    ? Object.keys(req.body.device_keys)
    : Array.isArray(req.body?.userIds)
    ? req.body.userIds
    : req.body?.userId
    ? [String(req.body.userId)]
    : req.params.userId
    ? [String(req.params.userId)]
    : [];

  const resultDeviceKeys = {};
  const failures = {};

  for (const rawTargetId of requestedUsers) {
    const targetUserId = normalizeUserId(rawTargetId);
    const authResult = await checkKeyExchangeAuthorization(normalizeUserId(authUserId), targetUserId);
    if (!authResult.authorized) {
      failures[rawTargetId] = authResult.error || 'UNAUTHORIZED';
      continue;
    }

    resultDeviceKeys[targetUserId] = {};

    const targetVariants = Array.from(new Set([
      targetUserId,
      authResult.recipientUser?.id,
      authResult.recipientUser?._id ? authResult.recipientUser._id.toString() : null,
      authResult.recipientUser?.username
    ].filter(Boolean).map(String)));

    const userQuery = (targetVariants.length === 1) ? targetVariants[0] : { $in: targetVariants };

    if (DeviceIdentity) {
      let q = DeviceIdentity.find({ userId: userQuery, isRevoked: false })
        .select('userId deviceId algorithms keys signatures');
      if (typeof q.sort === 'function') {
        q = q.sort({ lastSeenAt: -1, createdAt: -1 });
      }
      const devices = await q.lean();

      for (const dev of devices) {
        resultDeviceKeys[targetUserId][dev.deviceId] = {
          user_id: dev.userId,
          device_id: dev.deviceId,
          algorithms: dev.algorithms,
          keys: dev.keys,
          signatures: dev.signatures
        };
      }
    } else if (DeviceKey) {
      let q = DeviceKey.find({ userId: userQuery, revoked: { $ne: true } });
      if (typeof q.sort === 'function') {
        q = q.sort({ lastActiveAt: -1, createdAt: -1 });
      }
      const devices = await q.lean();
      for (const dev of devices) {
        resultDeviceKeys[targetUserId][dev.deviceId] = {
          user_id: dev.userId,
          device_id: dev.deviceId,
          algorithms: dev.algorithms,
          keys: dev.keys || dev.publicKey || {},
          signatures: dev.signatures || {},
          device_label: dev.deviceLabel,
          last_active_at: dev.lastActiveAt
        };
      }
    }
  }

  // Backwards compatibility for GET /:userId
  if (req.params.userId) {
    const uId = normalizeUserId(req.params.userId);
    const devList = Object.values(resultDeviceKeys[uId] || {});
    return res.json({ success: true, userId: req.params.userId, devices: devList });
  }

  return res.json({
    device_keys: resultDeviceKeys,
    failures
  });
};

router.post('/query', authMiddleware, handleQuery);
router.get('/:userId', authMiddleware, handleQuery);

router.get('/devices/my', authMiddleware, async (req, res) => {
  const authUserId = safeUserId(req);
  if (!authUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const cleanUserId = normalizeUserId(authUserId);

  let devices = [];
  if (DeviceIdentity) {
    devices = await DeviceIdentity.find({ userId: cleanUserId, isRevoked: false }).lean();
  } else if (DeviceKey) {
    devices = await DeviceKey.find({ userId: cleanUserId, revoked: { $ne: true } }).lean();
  }

  return res.json({ success: true, devices });
});

// 3. Claim One-Time Prekeys (/claim) - Atomic single-use claim
router.post('/claim', authMiddleware, async (req, res) => {
  const senderUserId = safeUserId(req);
  if (!senderUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const requests = [];
  const oneTimeKeysMap = req.body?.one_time_keys;

  if (plainObject(oneTimeKeysMap)) {
    for (const [rawUserId, deviceMap] of Object.entries(oneTimeKeysMap)) {
      if (plainObject(deviceMap)) {
        for (const [targetDeviceId, requestedAlgo] of Object.entries(deviceMap)) {
          requests.push({
            rawUserId,
            userId: normalizeUserId(rawUserId),
            deviceId: String(targetDeviceId).trim(),
            algorithm: requestedAlgo
          });
        }
      }
    }
  } else if (Array.isArray(req.body?.claims)) {
    for (const claim of req.body.claims) {
      if (claim.userId && claim.deviceId) {
        requests.push({
          rawUserId: claim.userId,
          userId: normalizeUserId(claim.userId),
          deviceId: String(claim.deviceId).trim(),
          algorithm: claim.algorithm || 'signed_curve25519'
        });
      }
    }
  } else if (req.body?.userId && req.body?.deviceId) {
    requests.push({
      rawUserId: req.body.userId,
      userId: normalizeUserId(req.body.userId),
      deviceId: String(req.body.deviceId).trim(),
      algorithm: req.body.algorithm || 'signed_curve25519'
    });
  }

  if (requests.length === 0) {
    return res.status(400).json({ error: 'INVALID_CLAIM_REQUEST' });
  }

  const claimed = {};
  const failures = {};

  for (const { rawUserId, userId, deviceId, algorithm } of requests) {
    const authResult = await checkKeyExchangeAuthorization(normalizeUserId(senderUserId), userId);
    if (!authResult.authorized) {
      failures[rawUserId] = authResult.error || 'UNAUTHORIZED';
      continue;
    }

    if (!claimed[rawUserId]) claimed[rawUserId] = {};

    const prefix = typeof algorithm === 'string' ? algorithm : 'signed_curve25519';

    // 3A. Atomic claim using OneTimePrekey model (if present and connected)
    if (OneTimePrekey && (mongoose.connection.readyState === 1 || !OneTimePrekey.schema)) {
      try {
        const claimedOtk = await OneTimePrekey.findOneAndUpdate(
          { userId, deviceId, isConsumed: false },
          { $set: { isConsumed: true, consumedAt: new Date() } },
          { new: true, sort: { createdAt: 1 } }
        );

        if (claimedOtk) {
          claimed[rawUserId][deviceId] = {
            [claimedOtk.keyId]: claimedOtk.keyData
          };
          continue;
        }
      } catch (_) {}
    }

    // 3B. Atomic claim using DeviceIdentity model (if present)
    if (DeviceIdentity) {
      const device = await DeviceIdentity.findOne({ userId, deviceId, isRevoked: false }).lean();
      if (!device) {
        failures[`${rawUserId}:${deviceId}`] = 'DEVICE_NOT_FOUND';
        continue;
      }

      const otks = device.oneTimeKeys || {};
      const candidateKeyIds = Object.keys(otks).filter((k) => k.startsWith(prefix) || k.includes(prefix));
      let claimedKeyId = null;
      let claimedKeyMaterial = null;

      for (const candidateKeyId of candidateKeyIds) {
        // Atomic conditional update ensures single-use claim under concurrency
        const updateResult = await DeviceIdentity.findOneAndUpdate(
          {
            userId,
            deviceId,
            isRevoked: false,
            [`oneTimeKeys.${candidateKeyId}`]: { $exists: true }
          },
          { $unset: { [`oneTimeKeys.${candidateKeyId}`]: 1 } },
          { new: false }
        );

        if (updateResult) {
          claimedKeyId = candidateKeyId;
          claimedKeyMaterial = otks[candidateKeyId] || updateResult.oneTimeKeys?.[candidateKeyId];
          break;
        }
      }

      if (claimedKeyId && claimedKeyMaterial) {
        claimed[rawUserId][deviceId] = {
          [claimedKeyId]: claimedKeyMaterial
        };
        continue;
      }
    }

    // Fallback key lookup if one-time prekeys are exhausted
    let fallbackObj = null;
    if (DeviceIdentity) {
      const dev = await DeviceIdentity.findOne({ userId, deviceId, isRevoked: false }).lean();
      if (dev?.fallbackKeys && Object.keys(dev.fallbackKeys).length > 0) {
        const fallbackKeyId = Object.keys(dev.fallbackKeys).find((k) => k.startsWith(prefix) || k.includes(prefix)) || Object.keys(dev.fallbackKeys)[0];
        fallbackObj = { [fallbackKeyId]: dev.fallbackKeys[fallbackKeyId] };
      }
    } else if (DeviceKey) {
      const dev = await DeviceKey.findOne({ userId, deviceId, revoked: { $ne: true } }).lean();
      if (dev?.fallbackKey) {
        fallbackObj = {
          [dev.fallbackKey.keyId]: {
            ...dev.fallbackKey.keyData,
            fallback: true
          }
        };
      }
    }

    if (fallbackObj) {
      claimed[rawUserId][deviceId] = fallbackObj;
    } else {
      if (!failures[rawUserId]) failures[rawUserId] = {};
      failures[rawUserId][deviceId] = 'NO_ONE_TIME_KEYS';
    }
  }

  return res.json({
    one_time_keys: claimed,
    failures
  });
});

// 4. Revoke Device (/devices/:deviceId/revoke, DELETE /devices/:deviceId, DELETE /:deviceId)
const handleRevoke = async (req, res) => {
  const authUserId = safeUserId(req);
  const { deviceId } = req.params;

  if (!authUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!validateDeviceId(deviceId)) return res.status(400).json({ error: 'INVALID_DEVICE_ID' });
  if (rateLimited(`revoke:${authUserId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

  const cleanUserId = normalizeUserId(authUserId);
  const cleanDeviceId = String(deviceId).trim();
  let modified = false;

  if (DeviceIdentity) {
    const resDev = await DeviceIdentity.updateOne(
      { userId: cleanUserId, deviceId: cleanDeviceId, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date(), lastSeenAt: new Date() } }
    );
    modified = Boolean(resDev?.matchedCount);
  }

  if (DeviceKey) {
    const resKey = await DeviceKey.updateOne(
      { userId: cleanUserId, deviceId: cleanDeviceId },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    modified = modified || Boolean(resKey?.matchedCount);
  }

  if (OneTimePrekey) {
    await OneTimePrekey.deleteMany({ userId: cleanUserId, deviceId: cleanDeviceId, isConsumed: false });
  }

  if (!modified) return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  return res.json({ ok: true, success: true, revoked: true, userId: cleanUserId, deviceId: cleanDeviceId });
};

router.post('/devices/:deviceId/revoke', authMiddleware, revokeDeviceLimiter, handleRevoke);
router.delete('/devices/:deviceId', authMiddleware, revokeDeviceLimiter, handleRevoke);
router.delete('/:deviceId', authMiddleware, revokeDeviceLimiter, handleRevoke);

// 5. To-Device Relay (/to-device/:eventType/:txnId, /sendToDevice/:eventType/:txnId, /to_device)
const handleToDevice = async (req, res) => {
  const senderUserId = safeUserId(req);
  const senderDeviceId = (getHeader(req, 'x-device-id') || req.body?.senderDeviceId || req.body?.sender_device_id || '').trim();
  const eventType = req.params.eventType || req.body?.eventType || req.body?.type;
  const txnId = req.params.txnId || req.body?.txnId || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!senderUserId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!validateDeviceId(senderDeviceId)) return res.status(400).json({ error: 'SENDER_DEVICE_ID_REQUIRED' });
  if (!validEventType(eventType)) return res.status(400).json({ error: 'UNSUPPORTED_EVENT_TYPE' });
  if (!validateTxnId(txnId)) return res.status(400).json({ error: 'INVALID_TXN_ID' });
  if (jsonSize(req.body) > MAX_TO_DEVICE_BODY_BYTES) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  if (containsPrivateKeyMaterial(req.body)) return res.status(400).json({ error: 'PRIVATE_KEY_MATERIAL_NOT_PERMITTED' });
  if (rateLimited(`to_device:${senderUserId}:${senderDeviceId}`)) return res.status(429).json({ error: 'RATE_LIMITED' });

  // Verify sender device registered and active
  let senderActive = false;
  if (DeviceIdentity) {
    const sDev = await DeviceIdentity.findOne({ userId: normalizeUserId(senderUserId), deviceId: senderDeviceId, isRevoked: false }).lean();
    senderActive = Boolean(sDev);
  } else if (DeviceKey) {
    const sKey = await DeviceKey.findOne({ userId: normalizeUserId(senderUserId), deviceId: senderDeviceId, revoked: { $ne: true } }).lean();
    senderActive = Boolean(sKey);
  }
  if (!senderActive) return res.status(403).json({ error: 'SENDER_DEVICE_NOT_REGISTERED' });

  const rawMessages = req.body?.messages || req.body?.toDeviceMessages || req.body;
  const parsed = parseMessageEntries(rawMessages);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const { recipientUserId, recipientDeviceId, content } = parsed;
  if (containsPrivateKeyMaterial(content)) {
    return res.status(400).json({ error: 'PRIVATE_KEY_MATERIAL_NOT_PERMITTED' });
  }

  // Self-to-self same device blocked
  if (recipientUserId === senderUserId && recipientDeviceId === senderDeviceId) {
    return res.status(400).json({ error: 'SELF_TO_SELF_NOT_ALLOWED' });
  }

  // Communication authorization check (friends/admin/ledger & blocklist)
  const authCheck = await checkKeyExchangeAuthorization(normalizeUserId(senderUserId), normalizeUserId(recipientUserId));
  if (!authCheck.authorized) {
    return res.status(authCheck.status || 403).json({
      error: authCheck.error || 'UNAUTHORIZED',
      message: authCheck.message || authCheck.reason
    });
  }

  // Verify recipient device exists and is active
  let recipientActive = false;
  if (DeviceIdentity) {
    const rDev = await DeviceIdentity.findOne({ userId: normalizeUserId(recipientUserId), deviceId: recipientDeviceId, isRevoked: false }).lean();
    recipientActive = Boolean(rDev);
  } else if (DeviceKey) {
    const rKey = await DeviceKey.findOne({ userId: normalizeUserId(recipientUserId), deviceId: recipientDeviceId, revoked: { $ne: true } }).lean();
    recipientActive = Boolean(rKey);
  }
  if (!recipientActive) return res.status(404).json({ error: 'TARGET_DEVICE_NOT_FOUND' });

  // Idempotency check with ToDeviceTxn
  if (ToDeviceTxn) {
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
  }

  const io = req.app?.get('io') || req.io;
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
};

router.post('/to-device/:eventType/:txnId', authMiddleware, toDeviceLimiter, handleToDevice);
router.put('/to-device/:eventType/:txnId', authMiddleware, toDeviceLimiter, handleToDevice);
router.put('/sendToDevice/:eventType/:txnId', authMiddleware, toDeviceLimiter, handleToDevice);
router.post('/sendToDevice/:eventType/:txnId', authMiddleware, toDeviceLimiter, handleToDevice);
router.post('/to_device', authMiddleware, async (req, res) => {
  try {
    const authUserId = safeUserId(req);
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    // Reject private key material
    if (containsPrivateKeyMaterial(req.body)) {
      return res.status(400).json({ error: 'Private key material is strictly forbidden' });
    }

    const { eventType, txnId, messages } = req.body;
    const toDeviceMessages = messages || req.body;

    const io = req.app?.get('io') || req.io;
    if (io && toDeviceMessages && typeof toDeviceMessages === 'object') {
      const messagesMap = toDeviceMessages.messages || toDeviceMessages;
      for (const [rawRecipientId, devicePayloads] of Object.entries(messagesMap)) {
        const recipientId = normalizeUserId(rawRecipientId);
        if (devicePayloads && typeof devicePayloads === 'object') {
          for (const [targetDeviceId, eventContent] of Object.entries(devicePayloads)) {
            io.to(`user_${recipientId}`).emit('to_device', {
              sender: `@${authUserId}:pulsechat.local`,
              senderId: authUserId,
              type: eventType || 'm.room.encrypted',
              content: eventContent,
              recipientDeviceId: targetDeviceId
            });
            io.to(`device:${recipientId}:${targetDeviceId}`).emit('to_device', {
              sender: `@${authUserId}:pulsechat.local`,
              senderId: authUserId,
              type: eventType || 'm.room.encrypted',
              content: eventContent,
              recipientDeviceId: targetDeviceId
            });
          }
        }
      }
    }

    // Matrix to-device standard response is empty JSON object
    return res.status(200).json({});
  } catch (err) {
    console.error('Error in /api/keys/to_device:', err);
    res.status(500).json({ error: 'Failed to process to_device event' });
  }
});

// ============================================================================
// EXPORTS: Support both `createKeysRouter()` factory AND direct router export
// ============================================================================

function createKeysRouter(req, res, next) {
  if (req && res && typeof next === 'function') {
    return router(req, res, next);
  }
  return router;
}

Object.setPrototypeOf(createKeysRouter, router);
Object.assign(createKeysRouter, router);

createKeysRouter.__private = {
  validEventType,
  validateTxnId,
  validateDeviceId,
  parseMessageEntries,
  sanitizeDevicePayload,
  containsPrivateKeyMaterial,
  countOneTimeKeys,
  normalizeUserId,
  checkKeyExchangeAuthorization
};

module.exports = createKeysRouter;
