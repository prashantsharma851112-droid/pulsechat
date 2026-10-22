/**
 * PulseChat Ephemeral QR Device-to-Device History Transfer Signaling
 * - Manages single-use, short-lived (120s) pairing sessions.
 * - Relays E2EE handshake and ciphertext history chunks.
 * - Strictly NEVER stores, inspects, or logs plaintext messages or private keys.
 */

const crypto = require('crypto');

// In-memory ephemeral pairing sessions (Auto-expires in 120 seconds)
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

function registerQrSyncSocket(io, socket) {
  const callerId = socket.authenticatedUserId;

  // 1. New device creates pairing session
  socket.on('qr_sync:initiate', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { ephemeralPublicKey } = data || {};
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

      activeSyncSessions.set(sessionId, {
        sessionId,
        pairingToken,
        userId: callerId,
        newDeviceSocketId: socket.id,
        newDevicePublicKey: ephemeralPublicKey,
        status: 'pending',
        expiresAt
      });

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

  // 2. Old device approves transfer after scanning QR code
  socket.on('qr_sync:approve', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { sessionId, pairingToken, ephemeralPublicKey } = data || {};
      const session = activeSyncSessions.get(sessionId);

      if (!session) {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED_OR_NOT_FOUND' });
        return;
      }

      if (session.expiresAt <= Date.now()) {
        activeSyncSessions.delete(sessionId);
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_EXPIRED' });
        return;
      }

      if (session.pairingToken !== pairingToken) {
        if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAIRING_TOKEN' });
        return;
      }

      // Strict account isolation: both devices must belong to the exact same authenticated user
      if (session.userId !== callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'ACCOUNT_MISMATCH' });
        return;
      }

      if (session.status !== 'pending') {
        if (typeof ack === 'function') ack({ success: false, error: 'SESSION_ALREADY_USED' });
        return;
      }

      session.status = 'approved';
      session.oldDeviceSocketId = socket.id;
      session.oldDevicePublicKey = ephemeralPublicKey;

      socket.join(sessionId);

      // Notify new device with old device's ephemeral public key
      io.to(session.newDeviceSocketId).emit('qr_sync:paired', {
        sessionId,
        oldDevicePublicKey: ephemeralPublicKey
      });

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          newDevicePublicKey: session.newDevicePublicKey
        });
      }
    } catch (err) {
      console.error('Error approving qr_sync session:', err);
      if (typeof ack === 'function') ack({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  // 3. Ephemeral Relay for encrypted history chunk
  socket.on('qr_sync:chunk', (data) => {
    const { sessionId, chunkIndex, totalChunks, encryptedPayload, iv } = data || {};
    const session = activeSyncSessions.get(sessionId);
    if (!session || session.status !== 'approved' || session.userId !== callerId) {
      return;
    }

    // Determine target recipient socket
    const targetSocketId = socket.id === session.oldDeviceSocketId
      ? session.newDeviceSocketId
      : session.oldDeviceSocketId;

    if (targetSocketId) {
      io.to(targetSocketId).emit('qr_sync:chunk_received', {
        sessionId,
        chunkIndex,
        totalChunks,
        encryptedPayload,
        iv
      });
    }
  });

  // 4. Complete session and clean up
  socket.on('qr_sync:complete', ({ sessionId }) => {
    const session = activeSyncSessions.get(sessionId);
    if (session && session.userId === callerId) {
      io.to(sessionId).emit('qr_sync:finished', { sessionId });
      activeSyncSessions.delete(sessionId);
    }
  });

  // 5. Cancel session
  socket.on('qr_sync:cancel', ({ sessionId }) => {
    const session = activeSyncSessions.get(sessionId);
    if (session && session.userId === callerId) {
      io.to(sessionId).emit('qr_sync:cancelled', { sessionId });
      activeSyncSessions.delete(sessionId);
    }
  });
}

module.exports = {
  registerQrSyncSocket,
  activeSyncSessions
};
