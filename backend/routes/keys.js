const express = require('express');
const router = express.Router();
const DeviceKey = require('../models/DeviceKey');
const OneTimePrekey = require('../models/OneTimePrekey');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Deep recursive check to ensure no private key material is ever uploaded.
 * Rejects parameters like 'd', 'priv', 'seed', 'privateKey', 'secretKey', or PEM private key strings.
 */
function containsPrivateKeyMaterial(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(obj)) return true;
    }
    return false;
  }
  if (seen.has(obj)) return false;
  seen.add(obj);

  const forbiddenKeys = new Set(['d', 'priv', 'seed', 'privatekey', 'secretkey', 'privkey', 'xprv']);

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.has(lowerKey)) {
      return true;
    }
    if (containsPrivateKeyMaterial(value, seen)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes user ID by stripping optional Matrix @ prefix and :domain suffix for comparison.
 */
function normalizeUserId(rawId) {
  if (!rawId) return '';
  return String(rawId).replace(/^@/, '').replace(/:.*$/, '').trim();
}

/**
 * POST /api/keys/upload
 * Milestone 1: Upload public device identity, signed prekeys, and one-time prekeys (OTKs).
 * Strictly rejects any private key material.
 */
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const authUserId = req.user?.id || req.userId;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    // Strict recursive private key rejection
    if (containsPrivateKeyMaterial(req.body)) {
      return res.status(400).json({ error: 'Private key material is strictly forbidden on server' });
    }

    const body = req.body || {};
    const deviceKeys = body.device_keys || body.deviceKeys || body;
    const rawUserId = deviceKeys.user_id || deviceKeys.userId || body.userId;

    // Authenticated ownership: ensure payload does not attempt to upload keys for another user
    if (rawUserId && normalizeUserId(rawUserId) !== normalizeUserId(authUserId)) {
      return res.status(403).json({ error: 'Cannot upload or modify keys for another user identity' });
    }

    const deviceId = deviceKeys.device_id || deviceKeys.deviceId || body.deviceId;
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return res.status(400).json({ error: 'Valid deviceId is required' });
    }

    const cleanDeviceId = String(deviceId).trim();
    const cleanUserId = String(authUserId).trim();

    // Extract device identity keys and signatures
    const keys = deviceKeys.keys || deviceKeys.publicKey || body.keys || body.publicKey;
    const signatures = deviceKeys.signatures || body.signatures || {};
    const algorithms = deviceKeys.algorithms || body.algorithms || ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'];
    const deviceLabel = body.deviceLabel || deviceKeys.deviceLabel || 'PulseChat Client';
    const fallbackKeys = body.fallback_keys || body.fallbackKeys || {};

    let fallbackKey = null;
    if (fallbackKeys && typeof fallbackKeys === 'object' && Object.keys(fallbackKeys).length > 0) {
      const firstEntry = Object.entries(fallbackKeys)[0];
      fallbackKey = {
        keyId: firstEntry[0],
        keyData: typeof firstEntry[1] === 'string' ? { key: firstEntry[1] } : firstEntry[1]
      };
    }

    // Upsert DeviceKey record
    await DeviceKey.findOneAndUpdate(
      { userId: cleanUserId, deviceId: cleanDeviceId },
      {
        $set: {
          userId: cleanUserId,
          deviceId: cleanDeviceId,
          publicKey: keys || {},
          keys: keys || {},
          signatures: signatures || {},
          algorithms: Array.isArray(algorithms) ? algorithms : [algorithms],
          fallbackKey: fallbackKey,
          deviceLabel: String(deviceLabel).substring(0, 50),
          revoked: false,
          revokedAt: null,
          lastActiveAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Insert One-Time Prekeys (OTKs)
    const oneTimeKeys = body.one_time_keys || body.oneTimeKeys || {};
    if (oneTimeKeys && typeof oneTimeKeys === 'object') {
      const otkEntries = Object.entries(oneTimeKeys);
      if (otkEntries.length > 0) {
        const bulkOps = otkEntries.map(([keyId, keyData]) => ({
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
                createdAt: new Date()
              }
            },
            upsert: true
          }
        }));

        await OneTimePrekey.bulkWrite(bulkOps, { ordered: false });
      }
    }

    // Count unconsumed OTKs for this device
    const unconsumedCount = await OneTimePrekey.countDocuments({
      userId: cleanUserId,
      deviceId: cleanDeviceId,
      isConsumed: false
    });

    res.json({
      success: true,
      deviceId: cleanDeviceId,
      one_time_key_counts: {
        signed_curve25519: unconsumedCount
      }
    });
  } catch (err) {
    console.error('Error in /api/keys/upload:', err);
    res.status(500).json({ error: 'Failed to upload keys' });
  }
});

/**
 * POST /api/keys/query
 * Query public device identities for requested user IDs.
 */
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const authUserId = req.user?.id || req.userId;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    let targetUserIds = [];
    if (req.body.device_keys && typeof req.body.device_keys === 'object') {
      targetUserIds = Object.keys(req.body.device_keys).map(id => normalizeUserId(id));
    } else if (Array.isArray(req.body.userIds)) {
      targetUserIds = req.body.userIds.map(id => normalizeUserId(id));
    } else if (req.body.userId) {
      targetUserIds = [normalizeUserId(req.body.userId)];
    }

    targetUserIds = targetUserIds.filter(Boolean);

    // Find non-revoked devices for requested users
    const devices = await DeviceKey.find({
      userId: { $in: targetUserIds },
      revoked: { $ne: true }
    }).lean();

    const device_keys = {};
    for (const dev of devices) {
      const uId = dev.userId;
      if (!device_keys[uId]) {
        device_keys[uId] = {};
      }
      device_keys[uId][dev.deviceId] = {
        user_id: dev.userId,
        device_id: dev.deviceId,
        algorithms: dev.algorithms || ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
        keys: dev.keys || dev.publicKey || {},
        signatures: dev.signatures || {},
        device_label: dev.deviceLabel,
        last_active_at: dev.lastActiveAt
      };
    }

    res.json({
      device_keys,
      failures: {}
    });
  } catch (err) {
    console.error('Error in /api/keys/query:', err);
    res.status(500).json({ error: 'Failed to query device keys' });
  }
});

/**
 * POST /api/keys/claim
 * Atomically claim and consume one OTK per requested target device.
 * Concurrency: Uses findOneAndUpdate with { isConsumed: false } to guarantee exactly-once claim.
 */
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const authUserId = req.user?.id || req.userId;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    const requests = [];
    const oneTimeKeysMap = req.body.one_time_keys || {};

    if (typeof oneTimeKeysMap === 'object' && Object.keys(oneTimeKeysMap).length > 0) {
      for (const [rawUserId, deviceMap] of Object.entries(oneTimeKeysMap)) {
        const uId = normalizeUserId(rawUserId);
        if (typeof deviceMap === 'object') {
          for (const dId of Object.keys(deviceMap)) {
            requests.push({ userId: uId, deviceId: String(dId).trim() });
          }
        }
      }
    } else if (Array.isArray(req.body.claims)) {
      for (const claim of req.body.claims) {
        if (claim.userId && claim.deviceId) {
          requests.push({ userId: normalizeUserId(claim.userId), deviceId: String(claim.deviceId).trim() });
        }
      }
    } else if (req.body.userId && req.body.deviceId) {
      requests.push({ userId: normalizeUserId(req.body.userId), deviceId: String(req.body.deviceId).trim() });
    }

    if (requests.length === 0) {
      return res.status(400).json({ error: 'No valid claims requested' });
    }

    const claimedResults = {};
    const failures = {};

    for (const { userId, deviceId } of requests) {
      // Atomic OTK claim
      const claimedOtk = await OneTimePrekey.findOneAndUpdate(
        { userId, deviceId, isConsumed: false },
        { $set: { isConsumed: true, consumedAt: new Date() } },
        { new: true, sort: { createdAt: 1 } }
      );

      if (!claimedResults[userId]) {
        claimedResults[userId] = {};
      }

      if (claimedOtk) {
        claimedResults[userId][deviceId] = {
          [claimedOtk.keyId]: claimedOtk.keyData
        };
      } else {
        // Fallback key lookup if OTK pool is exhausted
        const devDoc = await DeviceKey.findOne({ userId, deviceId, revoked: { $ne: true } }).lean();
        if (devDoc && devDoc.fallbackKey) {
          claimedResults[userId][deviceId] = {
            [devDoc.fallbackKey.keyId]: {
              ...devDoc.fallbackKey.keyData,
              fallback: true
            }
          };
        } else {
          if (!failures[userId]) failures[userId] = {};
          failures[userId][deviceId] = 'NO_PREKEYS_AVAILABLE';
        }
      }
    }

    res.json({
      one_time_keys: claimedResults,
      failures
    });
  } catch (err) {
    console.error('Error in /api/keys/claim:', err);
    res.status(500).json({ error: 'Failed to claim keys' });
  }
});

/**
 * DELETE /api/keys/devices/:deviceId
 * Revokes device identity and purges unconsumed OTKs.
 */
router.delete('/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const authUserId = req.user?.id || req.userId;
    const { deviceId } = req.params;

    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const cleanDeviceId = String(deviceId).trim();
    const cleanUserId = String(authUserId).trim();

    // Mark device as revoked
    const result = await DeviceKey.updateOne(
      { userId: cleanUserId, deviceId: cleanDeviceId },
      { $set: { revoked: true, revokedAt: new Date() } }
    );

    // Purge unconsumed OTKs for this revoked device
    const deletedOtks = await OneTimePrekey.deleteMany({
      userId: cleanUserId,
      deviceId: cleanDeviceId,
      isConsumed: false
    });

    res.json({
      success: true,
      revoked: result.modifiedCount > 0 || result.matchedCount > 0,
      purgedOtks: deletedOtks.deletedCount
    });
  } catch (err) {
    console.error('Error revoking device key:', err);
    res.status(500).json({ error: 'Failed to revoke device key' });
  }
});

/**
 * POST /api/keys/to_device
 * Relay ephemeral to-device events for Olm Double Ratchet session setup.
 * Strictly ephemeral: does not store chat history.
 * Strictly rejects any private key material.
 */
router.post('/to_device', authMiddleware, async (req, res) => {
  try {
    const authUserId = req.user?.id || req.userId;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    // Reject private key material
    if (containsPrivateKeyMaterial(req.body)) {
      return res.status(400).json({ error: 'Private key material is strictly forbidden' });
    }

    const { eventType, txnId, messages } = req.body;
    const toDeviceMessages = messages || req.body;

    // Ephemeral relay: if Socket.IO io instance is attached, emit to recipient device rooms
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
          }
        }
      }
    }

    // Matrix to-device standard response is empty JSON object
    res.json({});
  } catch (err) {
    console.error('Error in /api/keys/to_device:', err);
    res.status(500).json({ error: 'Failed to process to_device event' });
  }
});

// ============================================================================
// LEGACY COMPATIBILITY ROUTES (PRESERVED FOR PHASE C / EXISTING TESTS)
// ============================================================================

// Register or update public device key (legacy)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { deviceId, publicKey, deviceLabel } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return res.status(400).json({ error: 'Valid deviceId is required' });
    }
    if (!publicKey || typeof publicKey !== 'object') {
      return res.status(400).json({ error: 'Valid public key object is required' });
    }

    // Never accept private key fields
    if (containsPrivateKeyMaterial(publicKey) || containsPrivateKeyMaterial(req.body)) {
      return res.status(400).json({ error: 'Private key must never be sent to server' });
    }

    const updated = await DeviceKey.findOneAndUpdate(
      { userId: String(userId), deviceId: String(deviceId).trim() },
      {
        userId: String(userId),
        deviceId: String(deviceId).trim(),
        publicKey,
        keys: publicKey,
        deviceLabel: deviceLabel ? String(deviceLabel).substring(0, 50) : 'PulseChat Client',
        revoked: false,
        lastActiveAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      deviceId: updated.deviceId,
      registeredAt: updated.createdAt
    });
  } catch (err) {
    console.error('Error registering device key:', err);
    res.status(500).json({ error: 'Failed to register device key' });
  }
});

// Get recipient's public device keys (legacy)
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ error: 'Target userId required' });

    const keys = await DeviceKey.find(
      { userId: String(targetUserId), revoked: { $ne: true } },
      { deviceId: 1, publicKey: 1, keys: 1, deviceLabel: 1, lastActiveAt: 1, _id: 0 }
    ).lean();

    res.json({ success: true, userId: targetUserId, devices: keys });
  } catch (err) {
    console.error('Error fetching device keys:', err);
    res.status(500).json({ error: 'Failed to fetch device keys' });
  }
});

// Revoke a device key (legacy endpoint /:deviceId)
router.delete('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { deviceId } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const result = await DeviceKey.deleteOne({
      userId: String(userId),
      deviceId: String(deviceId)
    });

    await OneTimePrekey.deleteMany({
      userId: String(userId),
      deviceId: String(deviceId)
    });

    res.json({ success: true, revoked: result.deletedCount > 0 });
  } catch (err) {
    console.error('Error revoking device key:', err);
    res.status(500).json({ error: 'Failed to revoke device key' });
  }
});

// List authenticated user's registered devices (legacy)
router.get('/devices/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const devices = await DeviceKey.find(
      { userId: String(userId), revoked: { $ne: true } },
      { deviceId: 1, deviceLabel: 1, createdAt: 1, lastActiveAt: 1, _id: 0 }
    ).lean();

    res.json({ success: true, devices });
  } catch (err) {
    console.error('Error listing user devices:', err);
    res.status(500).json({ error: 'Failed to list user devices' });
  }
});

module.exports = router;
