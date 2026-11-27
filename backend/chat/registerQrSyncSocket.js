/**
 * PulseChat Ephemeral QR Device-to-Device History Transfer Signaling
 * - Manages single-use, short-lived (120s) pairing sessions.
 * - Relays E2EE handshake and ciphertext history chunks.
 * - Strictly NEVER stores, inspects, or logs plaintext messages or private keys.
 */

const crypto = require('crypto');
let redis = null;
try {
  redis = require('../utils/redis');
} catch (_) {
  // Fallback to in-memory sessions if redis utility or config is unavailable
}

// In-memory pairing sessions fallback
const activeSyncSessions = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of activeSyncSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSyncSessions.delete(sessionId);
    }
  }
}

setInterval(cleanExpiredSessions, 15000).unref();

function computeSasCodeSync({ sessionId, userId, oldDeviceId, newDeviceId, oldDevicePublicKey, newDevicePublicKey }) {
  const ox = oldDevicePublicKey?.x || '';
  const oy = oldDevicePublicKey?.y || '';
  const nx = newDevicePublicKey?.x || '';
  const ny = newDevicePublicKey?.y || '';
  const dataString = `pulsechat-sas-v1|${sessionId}|${userId}|${oldDeviceId || 'old'}|${newDeviceId || 'new'}|${ox}|${oy}|${nx}|${ny}`;
  const hash = crypto.createHash('sha256').update(dataString).digest();
  const val = hash.readUInt32BE(0);
  const num = val % 1000000;
  const codeStr = String(num).padStart(6, '0');
  return `${codeStr.slice(0, 3)}-${codeStr.slice(3)}`;
}

function getRedisSessionKey(sessionId) {
  return `pulse_qr_sync:${sessionId}`;
}

async function getSession(sessionId) {
  if (redis && redis.isConnected && redis.isConnected()) {
    try {
      const raw = await redis.client.get(getRedisSessionKey(sessionId));
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Redis getSession fallback:', e.message);
    }
  }
  return activeSyncSessions.get(sessionId) || null;
}

async function saveSession(session) {
  activeSyncSessions.set(session.sessionId, session);
  if (redis && redis.isConnected && redis.isConnected()) {
    try {
      const remainingSec = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
      await redis.client.set(getRedisSessionKey(session.sessionId), JSON.stringify(session), 'EX', remainingSec);
    } catch (e) {
      console.warn('Redis saveSession error:', e.message);
    }
  }
}

async function deleteSession(sessionId) {
  activeSyncSessions.delete(sessionId);
  if (redis && redis.isConnected && redis.isConnected()) {
    try {
      await redis.client.del(getRedisSessionKey(sessionId));
    } catch (e) {
      console.warn('Redis deleteSession error:', e.message);
    }
  }
}

function registerQrSyncSocket(io, socket) {
  const callerId = socket.authenticatedUserId;

  // 1. Initiator creates pairing session (Shows QR code)
  socket.on('qr_sync:initiate', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { ephemeralPublicKey, role = 'source', deviceName = 'PulseChat Device', deviceId } = data || {};
      if (!ephemeralPublicKey || typeof ephemeralPublicKey !== 'object') {
        if (typeof ack === 'function') ack({ success: false, error: 'INVALID_EPHEMERAL_PUBLIC_KEY' });
        return;
      }

      // Reject if private key material is present
      if (ephemeralPublicKey.d) {
        if (typeof ack === 'function') ack({ success: false, error: 'PRIVATE_KEY_FORBIDDEN' });
        return;
      }

      const sessionId = `qrsync_${crypto.randomUUID()}`;
      const pairingToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + 120 * 1000; // 2 minutes hard cap
      const initiatorDeviceId = deviceId || (role === 'source' ? 'old_device' : 'new_device');

      const session = {
        sessionId,
        pairingToken,
        userId: callerId,
        initiatorSocketId: socket.id,
        initiatorPublicKey: ephemeralPublicKey,
        initiatorRole: role,
        initiatorDeviceId,
        initiatorDeviceName: deviceName,
        // Backward-compatibility aliases
        newDeviceSocketId: socket.id,
        newDevicePublicKey: ephemeralPublicKey,
        status: 'pending',
        expiresAt
      };

      if (redis && redis.isConnected && redis.isConnected()) {
        try {
          const res = await redis.client.set(getRedisSessionKey(sessionId), JSON.stringify(session), 'EX', 120, 'NX');
          if (!res) {
            if (typeof ack === 'function') ack({ success: false, error: 'SESSION_COLLISION' });
            return;
          }
        } catch (e) {
          console.warn('Redis initiate session warning:', e.message);
        }
      }

      activeSyncSessions.set(sessionId, session);
      socket.join(sessionId);

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          pairingToken,
          expiresAt
        });
      }
    } catch (err) {
      console.error('Error initiating qr_sync session:', err);
      if (typeof ack === 'function') ack({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  // 2. Responder scans QR code and requests pairing (Triggers approval prompt on initiator)
  socket.on('qr_sync:request_pair', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { sessionId, pairingToken, ephemeralPublicKey, deviceName = 'New Phone', deviceId = 'new_device' } = data || {};
      const session = await getSession(sessionId);

      if (!session) {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED_OR_NOT_FOUND' });
        return;
      }

      if (session.expiresAt <= Date.now()) {
        await deleteSession(sessionId);
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED' });
        return;
      }

      if (session.pairingToken !== pairingToken) {
        if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAIRING_TOKEN' });
        return;
      }

      if (session.userId !== callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'ACCOUNT_MISMATCH' });
        return;
      }

      if (session.status !== 'pending') {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_ALREADY_USED' });
        return;
      }

      // Reject if private key material is present
      if (ephemeralPublicKey?.d) {
        if (typeof ack === 'function') ack({ success: false, error: 'PRIVATE_KEY_FORBIDDEN' });
        return;
      }

      // Compute mutual Short Authentication String (SAS / security code)
      const sasCode = computeSasCodeSync({
        sessionId,
        userId: session.userId,
        oldDeviceId: session.initiatorDeviceId || 'old_device',
        newDeviceId: deviceId,
        oldDevicePublicKey: session.initiatorPublicKey,
        newDevicePublicKey: ephemeralPublicKey
      });

      session.status = 'requested';
      session.responderSocketId = socket.id;
      session.responderPublicKey = ephemeralPublicKey;
      session.responderDeviceId = deviceId;
      session.responderDeviceName = deviceName;
      session.sasCode = sasCode;
      // Backward-compatibility alias
      session.oldDeviceSocketId = socket.id;
      session.oldDevicePublicKey = ephemeralPublicKey;

      await saveSession(session);
      socket.join(sessionId);

      // Prompt the initiator device (e.g. old phone) for explicit user confirmation with SAS code
      const promptTargetSocket = session.initiatorSocketId || session.newDeviceSocketId;
      if (promptTargetSocket) {
        io.to(promptTargetSocket).emit('qr_sync:prompt_approval', {
          sessionId,
          deviceName,
          deviceId,
          sasCode,
          newDevicePublicKey: ephemeralPublicKey,
          peerPublicKey: ephemeralPublicKey
        });
      }

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          status: 'waiting_for_approval',
          sasCode
        });
      }
    } catch (err) {
      console.error('Error requesting pair in qr_sync:', err);
      if (typeof ack === 'function') ack({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  // 3. User approves transfer
  socket.on('qr_sync:approve', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { sessionId, pairingToken, ephemeralPublicKey, sasCode } = data || {};
      const session = await getSession(sessionId);

      if (!session) {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED_OR_NOT_FOUND' });
        return;
      }

      if (session.expiresAt <= Date.now()) {
        await deleteSession(sessionId);
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED' });
        return;
      }

      // Pairing token check if provided
      if (pairingToken && session.pairingToken !== pairingToken) {
        if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAIRING_TOKEN' });
        return;
      }

      // Account isolation
      if (session.userId !== callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'ACCOUNT_MISMATCH' });
        return;
      }

      if (session.status === 'approved') {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_ALREADY_USED' });
        return;
      }

      // If ephemeralPublicKey was provided on approval (legacy single-step approval flow)
      if (ephemeralPublicKey && !session.oldDevicePublicKey) {
        session.oldDeviceSocketId = socket.id;
        session.oldDevicePublicKey = ephemeralPublicKey;
        session.responderSocketId = socket.id;
        session.responderPublicKey = ephemeralPublicKey;
        session.sasCode = computeSasCodeSync({
          sessionId,
          userId: session.userId,
          oldDeviceId: session.initiatorDeviceId || 'old_device',
          newDeviceId: session.responderDeviceId || 'new_device',
          oldDevicePublicKey: session.initiatorPublicKey,
          newDevicePublicKey: ephemeralPublicKey
        });
      }

      // If client supplied sasCode, verify it matches
      if (sasCode && session.sasCode && sasCode !== session.sasCode) {
        if (typeof ack === 'function') ack({ success: false, error: 'SAS_CODE_MISMATCH' });
        return;
      }

      session.status = 'approved';
      await saveSession(session);

      socket.join(sessionId);

      const initiatorSocket = session.initiatorSocketId || session.newDeviceSocketId;
      const responderSocket = session.responderSocketId || session.oldDeviceSocketId;
      const initiatorPk = session.initiatorPublicKey || session.newDevicePublicKey;
      const responderPk = session.responderPublicKey || session.oldDevicePublicKey;

      // Notify initiator
      if (initiatorSocket) {
        io.to(initiatorSocket).emit('qr_sync:paired', {
          sessionId,
          peerPublicKey: responderPk,
          peerDeviceId: session.responderDeviceId || 'new_device',
          peerDeviceName: session.responderDeviceName || 'New Phone',
          oldDevicePublicKey: session.initiatorPublicKey,
          newDevicePublicKey: responderPk,
          sasCode: session.sasCode
        });
      }

      // Notify responder
      if (responderSocket) {
        io.to(responderSocket).emit('qr_sync:paired', {
          sessionId,
          peerPublicKey: initiatorPk,
          peerDeviceId: session.initiatorDeviceId || 'old_device',
          peerDeviceName: session.initiatorDeviceName || 'Old Phone',
          newDevicePublicKey: session.responderPublicKey,
          oldDevicePublicKey: initiatorPk,
          sasCode: session.sasCode
        });
      }

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          newDevicePublicKey: initiatorPk,
          peerPublicKey: responderPk,
          sasCode: session.sasCode
        });
      }
    } catch (err) {
      console.error('Error approving qr_sync session:', err);
      if (typeof ack === 'function') ack({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  // 4. Ephemeral Relay for encrypted history chunk
  socket.on('qr_sync:chunk', async (data) => {
    const { sessionId, chunkIndex, totalChunks, senderDeviceId, receiverDeviceId, encryptedPayload, iv } = data || {};
    const session = await getSession(sessionId);
    if (!session || session.status !== 'approved' || session.userId !== callerId) {
      return;
    }

    const initiatorSocket = session.initiatorSocketId || session.newDeviceSocketId;
    const responderSocket = session.responderSocketId || session.oldDeviceSocketId;

    // Relay to the other peer in the pairing
    const targetSocketId = socket.id === initiatorSocket ? responderSocket : initiatorSocket;

    if (targetSocketId) {
      io.to(targetSocketId).emit('qr_sync:chunk_received', {
        sessionId,
        chunkIndex,
        totalChunks,
        senderDeviceId,
        receiverDeviceId,
        encryptedPayload,
        iv
      });
    }
  });

  // 5. Complete session and clean up
  socket.on('qr_sync:complete', async ({ sessionId }) => {
    const session = await getSession(sessionId);
    if (session && session.userId === callerId) {
      io.to(sessionId).emit('qr_sync:finished', { sessionId });
      await deleteSession(sessionId);
    }
  });

  // 6. Cancel session
  socket.on('qr_sync:cancel', async ({ sessionId }) => {
    const session = await getSession(sessionId);
    if (session && session.userId === callerId) {
      io.to(sessionId).emit('qr_sync:cancelled', { sessionId });
      await deleteSession(sessionId);
    }
  });
}

module.exports = {
  registerQrSyncSocket,
  activeSyncSessions
};
