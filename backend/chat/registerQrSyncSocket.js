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

  // 1. Initiator creates pairing session (Shows QR code)
  socket.on('qr_sync:initiate', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { ephemeralPublicKey, role = 'source', deviceName = 'PulseChat Device' } = data || {};
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
        initiatorSocketId: socket.id,
        initiatorPublicKey: ephemeralPublicKey,
        initiatorRole: role,
        initiatorDeviceName: deviceName,
        // Backward-compatibility aliases
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

  // 2. Responder scans QR code and requests pairing (Triggers approval prompt on initiator)
  socket.on('qr_sync:request_pair', async (data, ack) => {
    try {
      if (!callerId) {
        if (typeof ack === 'function') ack({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const { sessionId, pairingToken, ephemeralPublicKey, deviceName = 'New Phone', deviceId } = data || {};
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

      session.status = 'requested';
      session.responderSocketId = socket.id;
      session.responderPublicKey = ephemeralPublicKey;
      session.responderDevice = { deviceName, deviceId };
      // Backward-compatibility alias
      session.oldDeviceSocketId = socket.id;
      session.oldDevicePublicKey = ephemeralPublicKey;

      socket.join(sessionId);

      // Prompt the initiator device (e.g. old phone) for explicit user confirmation
      const promptTargetSocket = session.initiatorSocketId || session.newDeviceSocketId;
      if (promptTargetSocket) {
        io.to(promptTargetSocket).emit('qr_sync:prompt_approval', {
          sessionId,
          deviceName,
          deviceId
        });
      }

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          status: 'waiting_for_approval'
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

      session.status = 'approved';

      // If ephemeralPublicKey was provided on approval (legacy single-step approval flow)
      if (ephemeralPublicKey && !session.oldDevicePublicKey) {
        session.oldDeviceSocketId = socket.id;
        session.oldDevicePublicKey = ephemeralPublicKey;
        session.responderSocketId = socket.id;
        session.responderPublicKey = ephemeralPublicKey;
      }

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
          oldDevicePublicKey: responderPk
        });
      }

      // Notify responder
      if (responderSocket) {
        io.to(responderSocket).emit('qr_sync:paired', {
          sessionId,
          peerPublicKey: initiatorPk,
          newDevicePublicKey: initiatorPk,
          oldDevicePublicKey: initiatorPk
        });
      }

      if (typeof ack === 'function') {
        ack({
          success: true,
          sessionId,
          newDevicePublicKey: initiatorPk,
          peerPublicKey: responderPk
        });
      }
    } catch (err) {
      console.error('Error approving qr_sync session:', err);
      if (typeof ack === 'function') ack({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  // 4. Ephemeral Relay for encrypted history chunk
  socket.on('qr_sync:chunk', (data) => {
    const { sessionId, chunkIndex, totalChunks, encryptedPayload, iv } = data || {};
    const session = activeSyncSessions.get(sessionId);
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
        encryptedPayload,
        iv
      });
    }
  });

  // 5. Complete session and clean up
  socket.on('qr_sync:complete', ({ sessionId }) => {
    const session = activeSyncSessions.get(sessionId);
    if (session && session.userId === callerId) {
      io.to(sessionId).emit('qr_sync:finished', { sessionId });
      activeSyncSessions.delete(sessionId);
    }
  });

  // 6. Cancel session
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
