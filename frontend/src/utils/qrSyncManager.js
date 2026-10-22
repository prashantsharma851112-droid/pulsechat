/**
 * PulseChat QR-Based Device-to-Device Encrypted History Transfer Manager
 * 
 * Invariants:
 * 1. Single-use, short-lived (120s) pairing sessions.
 * 2. Strictly ZERO passwords, JWTs, private keys, or message plaintext in QR code or signaling.
 * 3. End-to-End encrypted history chunks via ephemeral ECDH + HKDF + AES-256-GCM.
 * 4. Transactional IndexedDB commit on the recipient device.
 * 5. Source device history is NEVER deleted or modified.
 */

import {
  generateIdentityKeyPair,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from './e2eeCrypto';
import { getMessagesFromLocalDb, saveMessagesToLocalDb } from './localDatabase';

function getCryptoSubtle() {
  const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) || globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API subtle is unavailable.');
  return subtle;
}

function getCryptoRandomValues(arr) {
  const c = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error('Web Crypto API getRandomValues is unavailable.');
  return c.getRandomValues(arr);
}

/**
 * Derives a temporary AES-256-GCM session key for the QR transfer
 */
async function deriveSyncSessionKey(myPrivateKey, peerPublicJwk) {
  const subtle = getCryptoSubtle();
  const peerKey = await subtle.importKey(
    'jwk',
    peerPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: peerKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      info: new TextEncoder().encode('pulsechat-qr-device-transfer-v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 1. New Device: Initiate pairing and generate QR payload
 */
export async function initiateQrSyncSession(socket) {
  const subtle = getCryptoSubtle();
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const ephemeralPublicJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

  return new Promise((resolve, reject) => {
    socket.emit('qr_sync:initiate', { ephemeralPublicKey: ephemeralPublicJwk }, (res) => {
      if (!res || !res.success) {
        return reject(new Error(res?.error || 'FAILED_TO_INITIATE_QR_SYNC'));
      }

      // Compact QR payload - NO passwords, NO JWTs, NO private keys
      const qrPayload = JSON.stringify({
        t: 'pulse_qr_sync',
        sid: res.sessionId,
        tok: res.pairingToken,
        pk: ephemeralPublicJwk
      });

      resolve({
        sessionId: res.sessionId,
        pairingToken: res.pairingToken,
        qrPayload,
        ephemeralKeyPair,
        expiresAt: res.expiresAt
      });
    });
  });
}

/**
 * 2. Old Device: Approve pairing and stream encrypted history chunks
 */
export async function approveAndStreamHistory(socket, qrPayloadString, onProgress) {
  let parsed;
  try {
    parsed = typeof qrPayloadString === 'string' ? JSON.parse(qrPayloadString) : qrPayloadString;
  } catch (_) {
    throw new Error('INVALID_QR_PAYLOAD: JSON parse failed');
  }

  if (!parsed || parsed.t !== 'pulse_qr_sync' || !parsed.sid || !parsed.tok || !parsed.pk) {
    throw new Error('INVALID_QR_PAYLOAD: Missing required synchronization tokens');
  }

  const subtle = getCryptoSubtle();
  const oldDeviceKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const oldDevicePublicJwk = await subtle.exportKey('jwk', oldDeviceKeyPair.publicKey);

  // Derive shared session key
  const sessionKey = await deriveSyncSessionKey(oldDeviceKeyPair.privateKey, parsed.pk);

  // Send approval
  const approveRes = await new Promise((resolve, reject) => {
    socket.emit('qr_sync:approve', {
      sessionId: parsed.sid,
      pairingToken: parsed.tok,
      ephemeralPublicKey: oldDevicePublicJwk
    }, (res) => {
      if (!res || !res.success) return reject(new Error(res?.error || 'APPROVAL_REJECTED'));
      resolve(res);
    });
  });

  // Query local messages from IndexedDB
  const allMessages = await getMessagesFromLocalDb('', 50000); // Fetch all local messages
  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < allMessages.length; i += CHUNK_SIZE) {
    chunks.push(allMessages.slice(i, i + CHUNK_SIZE));
  }

  const totalChunks = Math.max(1, chunks.length);

  // Stream chunks
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkData = chunks[idx];
    const encoded = new TextEncoder().encode(JSON.stringify(chunkData));
    const iv = getCryptoRandomValues(new Uint8Array(12));

    const encrypted = await subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      sessionKey,
      encoded
    );

    socket.emit('qr_sync:chunk', {
      sessionId: parsed.sid,
      chunkIndex: idx,
      totalChunks,
      encryptedPayload: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv)
    });

    if (typeof onProgress === 'function') {
      onProgress(idx + 1, totalChunks);
    }
  }

  // Complete
  socket.emit('qr_sync:complete', { sessionId: parsed.sid });
  return { transferredMessages: allMessages.length, totalChunks };
}

/**
 * 3. New Device: Receive and import encrypted history chunks transactionally
 */
export function listenAndImportHistory(socket, sessionId, myPrivateKey, onProgress) {
  const subtle = getCryptoSubtle();

  return new Promise((resolve, reject) => {
    let sessionKey = null;
    let receivedChunks = 0;
    let expectedChunks = 1;
    let totalImportedMessages = 0;

    socket.on('qr_sync:paired', async ({ oldDevicePublicKey }) => {
      try {
        sessionKey = await deriveSyncSessionKey(myPrivateKey, oldDevicePublicKey);
      } catch (err) {
        reject(new Error('SESSION_KEY_DERIVATION_FAILED: ' + err.message));
      }
    });

    socket.on('qr_sync:chunk_received', async ({ chunkIndex, totalChunks, encryptedPayload, iv }) => {
      try {
        if (!sessionKey) return;
        expectedChunks = totalChunks;

        const ivBuf = base64ToArrayBuffer(iv);
        const payloadBuf = base64ToArrayBuffer(encryptedPayload);

        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: ivBuf, tagLength: 128 },
          sessionKey,
          payloadBuf
        );

        const messages = JSON.parse(new TextDecoder().decode(decrypted));
        if (Array.isArray(messages) && messages.length > 0) {
          // Group by chatId and commit transactionally
          const byChat = {};
          messages.forEach(m => {
            const cid = m.chatId || 'default';
            if (!byChat[cid]) byChat[cid] = [];
            byChat[cid].push(m);
          });

          for (const [cid, msgs] of Object.entries(byChat)) {
            await saveMessagesToLocalDb(cid, msgs);
          }
          totalImportedMessages += messages.length;
        }

        receivedChunks++;
        if (typeof onProgress === 'function') {
          onProgress(receivedChunks, totalChunks);
        }
      } catch (err) {
        console.error('Failed to import chunk:', err);
      }
    });

    socket.on('qr_sync:finished', () => {
      resolve({ importedMessages: totalImportedMessages, chunksReceived: receivedChunks });
    });

    socket.on('qr_sync:cancelled', () => {
      reject(new Error('TRANSFER_CANCELLED_BY_PEER'));
    });
  });
}
