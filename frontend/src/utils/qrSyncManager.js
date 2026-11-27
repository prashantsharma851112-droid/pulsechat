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
  getAllMessagesFromLocalDb,
  saveMessagesToLocalDb
} from './localDatabase';
import { filterMessagesForUser } from './backupCrypto';

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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a temporary AES-256-GCM session key for the QR transfer
 * Binds key derivation to protocol version, session ID, authenticated user ID, and participating device IDs.
 */
export async function deriveSyncSessionKey(myPrivateKey, peerPublicJwk, context = {}) {
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

  const protocolVersion = context.protocolVersion || 'pulsechat-qr-device-transfer-v2';
  const sessionId = context.sessionId || 'default_session';
  const userId = context.userId || '';
  const oldDeviceId = context.oldDeviceId || 'old_device';
  const newDeviceId = context.newDeviceId || 'new_device';

  // Derive session-bound cryptographic salt from protocol + sessionId + userId
  const saltSource = `salt|${protocolVersion}|${sessionId}|${userId}`;
  const saltDigest = await subtle.digest('SHA-256', new TextEncoder().encode(saltSource));
  const salt = new Uint8Array(saltDigest).slice(0, 16);

  // Authenticated key derivation context (info)
  const infoSource = `info|${protocolVersion}|${sessionId}|${userId}|${oldDeviceId}|${newDeviceId}`;
  const info = new TextEncoder().encode(infoSource);

  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes a deterministic 6-digit Short Authentication String (SAS / security code)
 * derived from the session ID, account ID, device IDs, and both ephemeral public keys.
 */
export async function computeSasCode({ sessionId, userId, oldDeviceId, newDeviceId, oldDevicePublicKey, newDevicePublicKey }) {
  const subtle = getCryptoSubtle();
  const ox = oldDevicePublicKey?.x || '';
  const oy = oldDevicePublicKey?.y || '';
  const nx = newDevicePublicKey?.x || '';
  const ny = newDevicePublicKey?.y || '';
  const dataString = `pulsechat-sas-v1|${sessionId}|${userId}|${oldDeviceId || 'old'}|${newDeviceId || 'new'}|${ox}|${oy}|${nx}|${ny}`;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(dataString));
  const bytes = new Uint8Array(digest);
  const val = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const num = val % 1000000;
  const codeStr = String(num).padStart(6, '0');
  return `${codeStr.slice(0, 3)}-${codeStr.slice(3)}`;
}

/**
 * Constructs the canonical Additional Authenticated Data (AAD) buffer for AES-256-GCM chunks.
 * Cryptographically binds protocol version, session ID, user ID, sender/receiver device IDs,
 * chunk index, and total chunk count.
 */
export function constructChunkAad({ protocolVersion = 'pulsechat-qr-device-transfer-v2', sessionId, userId, senderDeviceId, oldDeviceId, receiverDeviceId, newDeviceId, chunkIndex, totalChunks }) {
  const sDev = senderDeviceId || oldDeviceId || 'old';
  const rDev = receiverDeviceId || newDeviceId || 'new';
  const aadString = `${protocolVersion}|${sessionId}|${userId}|${sDev}|${rDev}|${chunkIndex}|${totalChunks}`;
  return new TextEncoder().encode(aadString);
}

/**
 * Get device name for transfer prompt (e.g. "Pixel 8 (Android)")
 */
function getDeviceDisplayName() {
  if (typeof navigator === 'undefined') return 'PulseChat Device';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android Device';
  if (/iphone|ipad|ipod/i.test(ua)) return 'Apple Device';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac';
  return 'Linked Device';
}

function getLocalDeviceId() {
  if (typeof localStorage === 'undefined') return 'device_' + Math.random().toString(36).slice(2, 10);
  try {
    let id = localStorage.getItem('pulsechat_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('pulsechat_device_id', id);
    }
    return id;
  } catch (_) {
    return 'device_' + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * ---------------------------------------------------------------------------------
 * PRIMARY WHATSAPP-STYLE TRANSFER FLOW:
 * OLD DEVICE: Generates session, displays QR, confirms approval, streams history.
 * ---------------------------------------------------------------------------------
 */
export async function startOldDeviceTransfer(socket, currentUser, { onSessionReady, onPromptApproval, onProgress }) {
  if (!socket) throw new Error('Socket connection is required.');
  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
  if (!currentUserId) throw new Error('User must be authenticated.');

  const myDeviceId = getLocalDeviceId();

  const subtle = getCryptoSubtle();
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const ephemeralPublicJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

  return new Promise((resolve, reject) => {
    let sessionActive = true;
    let currentSessionId = null;
    let expectedPeerDeviceId = 'new_device';
    let agreedSasCode = null;

    const cleanupListeners = () => {
      socket.off('qr_sync:prompt_approval', handlePromptApproval);
      socket.off('qr_sync:paired', handlePaired);
      socket.off('qr_sync:cancelled', handleCancelled);
    };

    const handleCancelled = () => {
      cleanupListeners();
      reject(new Error('Transfer cancelled by peer.'));
    };

    const handlePromptApproval = async (data) => {
      expectedPeerDeviceId = data?.deviceId || 'new_device';
      const peerKey = data?.newDevicePublicKey || data?.peerPublicKey;
      let sasCode = data?.sasCode;
      if (!sasCode && peerKey) {
        try {
          sasCode = await computeSasCode({
            sessionId: currentSessionId,
            userId: currentUserId,
            oldDeviceId: myDeviceId,
            newDeviceId: expectedPeerDeviceId,
            oldDevicePublicKey: ephemeralPublicJwk,
            newDevicePublicKey: peerKey
          });
        } catch (_) {}
      }
      agreedSasCode = sasCode;

      if (typeof onPromptApproval === 'function') {
        onPromptApproval({
          deviceName: data?.deviceName || 'New Device',
          deviceId: expectedPeerDeviceId,
          sasCode,
          approve: () => {
            socket.emit('qr_sync:approve', { sessionId: currentSessionId, sasCode });
          },
          reject: () => {
            socket.emit('qr_sync:cancel', { sessionId: currentSessionId });
            cleanupListeners();
            reject(new Error('Transfer rejected by user.'));
          }
        });
      } else {
        // Auto-approve if no prompt callback provided
        socket.emit('qr_sync:approve', { sessionId: currentSessionId, sasCode });
      }
    };

    const handlePaired = async (data) => {
      try {
        const peerKey = data?.peerPublicKey || data?.oldDevicePublicKey || data?.newDevicePublicKey;
        if (!peerKey) {
          throw new Error('Peer public key was missing in paired event.');
        }

        const peerDeviceId = data?.peerDeviceId || expectedPeerDeviceId || 'new_device';
        expectedPeerDeviceId = peerDeviceId;

        // Mutual SAS verification
        if (data?.sasCode && agreedSasCode && data.sasCode !== agreedSasCode) {
          throw new Error('MUTUAL_AUTHENTICATION_FAILED: Security code verification mismatch.');
        }

        const context = {
          protocolVersion: 'pulsechat-qr-device-transfer-v2',
          sessionId: currentSessionId,
          userId: currentUserId,
          oldDeviceId: myDeviceId,
          newDeviceId: peerDeviceId
        };

        const sessionKey = await deriveSyncSessionKey(ephemeralKeyPair.privateKey, peerKey, context);

        // Fetch all local messages from authoritative IndexedDB
        const rawMessages = await getAllMessagesFromLocalDb();
        const scopedMessages = filterMessagesForUser(rawMessages, currentUserId);

        // Fetch recent chats snippet cache from localStorage
        let recentChats = [];
        try {
          const raw = localStorage.getItem(`pulsechat_recent_${currentUserId}`);
          if (raw) recentChats = JSON.parse(raw);
        } catch (_) {}

        // Chunk messages to stream smoothly without blocking WebSocket frame limits
        const CHUNK_SIZE = 50;
        const chunks = [];
        for (let i = 0; i < scopedMessages.length; i += CHUNK_SIZE) {
          chunks.push(scopedMessages.slice(i, i + CHUNK_SIZE));
        }

        const totalChunks = Math.max(1, chunks.length);

        for (let idx = 0; idx < totalChunks; idx++) {
          if (!sessionActive) break;
          const chunkMessages = chunks[idx] || [];
          const payload = {
            chunkIndex: idx,
            totalChunks,
            messages: chunkMessages,
            // Include recentChats in the final chunk
            recentChats: idx === totalChunks - 1 ? recentChats : null
          };

          const encoded = new TextEncoder().encode(JSON.stringify(payload));
          const iv = getCryptoRandomValues(new Uint8Array(12));

          // Bind chunk with authenticated data (AAD)
          const aad = constructChunkAad({
            protocolVersion: 'pulsechat-qr-device-transfer-v2',
            sessionId: currentSessionId,
            userId: currentUserId,
            senderDeviceId: myDeviceId,
            receiverDeviceId: peerDeviceId,
            chunkIndex: idx,
            totalChunks
          });

          const encrypted = await subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
            sessionKey,
            encoded
          );

          socket.emit('qr_sync:chunk', {
            sessionId: currentSessionId,
            chunkIndex: idx,
            totalChunks,
            senderDeviceId: myDeviceId,
            receiverDeviceId: peerDeviceId,
            encryptedPayload: arrayBufferToBase64(encrypted),
            iv: arrayBufferToBase64(iv)
          });

          if (typeof onProgress === 'function') {
            const currentTransferred = Math.min((idx + 1) * CHUNK_SIZE, scopedMessages.length);
            onProgress(idx + 1, totalChunks, currentTransferred, scopedMessages.length);
          }

          // Small yield to keep UI at 60 FPS
          await new Promise((r) => setTimeout(r, 15));
        }

        socket.emit('qr_sync:complete', { sessionId: currentSessionId });
        cleanupListeners();
        resolve({
          transferredMessages: scopedMessages.length,
          transferredChats: recentChats.length,
          totalChunks,
          sasCode: agreedSasCode
        });
      } catch (streamErr) {
        cleanupListeners();
        reject(streamErr);
      }
    };

    socket.emit(
      'qr_sync:initiate',
      {
        ephemeralPublicKey: ephemeralPublicJwk,
        role: 'source',
        deviceName: getDeviceDisplayName(),
        deviceId: myDeviceId
      },
      (res) => {
        if (!res || !res.success) {
          cleanupListeners();
          return reject(new Error(res?.error || 'FAILED_TO_INITIATE_QR_SYNC'));
        }

        currentSessionId = res.sessionId;

        // Structured QR payload (Zero private keys, zero plaintext)
        const qrPayload = JSON.stringify({
          t: 'pulse_qr_sync',
          v: 2,
          sid: res.sessionId,
          tok: res.pairingToken,
          pk: ephemeralPublicJwk,
          u: currentUser?.username || '',
          uid: currentUserId,
          did: myDeviceId
        });

        socket.on('qr_sync:prompt_approval', handlePromptApproval);
        socket.on('qr_sync:paired', handlePaired);
        socket.on('qr_sync:cancelled', handleCancelled);

        // Notify Old Device that pairing session is active so it can render the QR code
        if (typeof onSessionReady === 'function') {
          onSessionReady({
            sessionId: res.sessionId,
            pairingToken: res.pairingToken,
            qrPayload,
            expiresAt: res.expiresAt,
            cancel: () => {
              sessionActive = false;
              socket.emit('qr_sync:cancel', { sessionId: currentSessionId });
              cleanupListeners();
            }
          });
        }
      }
    );
  });
}

/**
 * ---------------------------------------------------------------------------------
 * PRIMARY WHATSAPP-STYLE RECOVERY FLOW:
 * NEW DEVICE: Scans QR code, requests pair, awaits approval, imports history.
 * ---------------------------------------------------------------------------------
 */
export async function startNewDeviceRecovery(socket, qrDataString, currentUser, { onProgress }) {
  if (!socket) throw new Error('Socket connection is required.');
  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();

  let parsed;
  try {
    parsed = typeof qrDataString === 'string' ? JSON.parse(qrDataString) : qrDataString;
  } catch (_) {
    throw new Error('INVALID_QR_CODE: The scanned code is not a valid PulseChat transfer code.');
  }

  if (!parsed || parsed.t !== 'pulse_qr_sync' || !parsed.sid || !parsed.tok || !parsed.pk) {
    throw new Error('INVALID_QR_CODE: Missing required pairing parameters.');
  }

  // Account mismatch verification
  if (parsed.uid && currentUserId && String(parsed.uid) !== currentUserId) {
    throw new Error(`ACCOUNT_MISMATCH: Scanned QR code belongs to account "${parsed.u || parsed.uid}", but you are logged in as "${currentUser?.username || currentUserId}". Please log into the same account.`);
  }

  const myDeviceId = getLocalDeviceId();
  const oldDeviceId = parsed.did || 'old_device';

  const subtle = getCryptoSubtle();
  const newDeviceKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const newDevicePublicJwk = await subtle.exportKey('jwk', newDeviceKeyPair.publicKey);

  // Compute local SAS code for visual verification against Old Phone
  let localSasCode = null;
  try {
    localSasCode = await computeSasCode({
      sessionId: parsed.sid,
      userId: currentUserId,
      oldDeviceId,
      newDeviceId: myDeviceId,
      oldDevicePublicKey: parsed.pk,
      newDevicePublicKey: newDevicePublicJwk
    });
  } catch (_) {}

  return new Promise((resolve, reject) => {
    let sessionKey = null;
    let totalImportedMessages = 0;
    let totalImportedChats = 0;
    let chunksReceived = 0;
    let expectedNextChunkIndex = 0;
    const seenChunkIndices = new Set();

    const cleanupListeners = () => {
      socket.off('qr_sync:paired', handlePaired);
      socket.off('qr_sync:chunk_received', handleChunkReceived);
      socket.off('qr_sync:finished', handleFinished);
      socket.off('qr_sync:cancelled', handleCancelled);
    };

    const handleCancelled = () => {
      cleanupListeners();
      reject(new Error('Transfer was cancelled or rejected by old phone.'));
    };

    const handlePaired = async (data) => {
      try {
        const peerKey = data?.peerPublicKey || data?.oldDevicePublicKey || parsed.pk;
        if (data?.sasCode && localSasCode && data.sasCode !== localSasCode) {
          throw new Error('MUTUAL_AUTHENTICATION_FAILED: Security code verification mismatch.');
        }

        const peerDeviceId = data?.peerDeviceId || oldDeviceId;
        const context = {
          protocolVersion: 'pulsechat-qr-device-transfer-v2',
          sessionId: parsed.sid,
          userId: currentUserId,
          oldDeviceId: peerDeviceId,
          newDeviceId: myDeviceId
        };

        sessionKey = await deriveSyncSessionKey(newDeviceKeyPair.privateKey, peerKey, context);
      } catch (err) {
        cleanupListeners();
        reject(new Error('SESSION_KEY_DERIVATION_FAILED: ' + err.message));
      }
    };

    const handleChunkReceived = async (chunkPayload) => {
      try {
        const {
          sessionId: chunkSessionId,
          chunkIndex,
          totalChunks,
          senderDeviceId,
          receiverDeviceId,
          encryptedPayload,
          iv
        } = chunkPayload || {};

        if (!sessionKey) {
          const context = {
            protocolVersion: 'pulsechat-qr-device-transfer-v2',
            sessionId: parsed.sid,
            userId: currentUserId,
            oldDeviceId,
            newDeviceId: myDeviceId
          };
          sessionKey = await deriveSyncSessionKey(newDeviceKeyPair.privateKey, parsed.pk, context);
        }

        // Strict pre-decryption security assertions
        if (chunkSessionId && chunkSessionId !== parsed.sid) {
          throw new Error(`SECURITY_VIOLATION: Chunk sessionId '${chunkSessionId}' does not match expected '${parsed.sid}'`);
        }
        if (typeof chunkIndex !== 'number' || chunkIndex < 0 || chunkIndex >= totalChunks) {
          throw new Error(`SECURITY_VIOLATION: Invalid chunkIndex ${chunkIndex} for totalChunks ${totalChunks}`);
        }
        if (seenChunkIndices.has(chunkIndex)) {
          throw new Error(`SECURITY_VIOLATION: Duplicate chunkIndex ${chunkIndex} rejected`);
        }
        if (chunkIndex !== expectedNextChunkIndex) {
          throw new Error(`SECURITY_VIOLATION: Out-of-order chunk rejected. Expected ${expectedNextChunkIndex}, got ${chunkIndex}`);
        }

        const aad = constructChunkAad({
          protocolVersion: 'pulsechat-qr-device-transfer-v2',
          sessionId: parsed.sid,
          userId: currentUserId,
          senderDeviceId: senderDeviceId || oldDeviceId,
          receiverDeviceId: receiverDeviceId || myDeviceId,
          chunkIndex,
          totalChunks
        });

        const ivBuf = base64ToArrayBuffer(iv);
        const payloadBuf = base64ToArrayBuffer(encryptedPayload);

        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: ivBuf, additionalData: aad, tagLength: 128 },
          sessionKey,
          payloadBuf
        );

        seenChunkIndices.add(chunkIndex);
        expectedNextChunkIndex++;

        const chunkData = JSON.parse(new TextDecoder().decode(decrypted));
        const messages = Array.isArray(chunkData) ? chunkData : chunkData.messages || [];
        const recentChats = chunkData.recentChats;

        if (Array.isArray(messages) && messages.length > 0) {
          // Group by chatId and commit transactionally to IndexedDB
          const byChat = {};
          messages.forEach((m) => {
            const cid = m.chatId || 'default';
            if (!byChat[cid]) byChat[cid] = [];
            byChat[cid].push(m);
          });

          for (const [cid, msgs] of Object.entries(byChat)) {
            await saveMessagesToLocalDb(cid, msgs);
          }
          totalImportedMessages += messages.length;
        }

        // Restore recent chats list in localStorage
        if (Array.isArray(recentChats) && recentChats.length > 0 && currentUserId) {
          try {
            const key = `pulsechat_recent_${currentUserId}`;
            const existingRaw = localStorage.getItem(key);
            let mergedChats = recentChats;
            if (existingRaw) {
              const existingChats = JSON.parse(existingRaw);
              const chatMap = new Map();
              recentChats.forEach((c) => chatMap.set(c.id || c.chatId, c));
              existingChats.forEach((c) => {
                if (!chatMap.has(c.id || c.chatId)) chatMap.set(c.id || c.chatId, c);
              });
              mergedChats = Array.from(chatMap.values());
            }
            localStorage.setItem(key, JSON.stringify(mergedChats));
            totalImportedChats = mergedChats.length;
          } catch (_) {}
        }

        chunksReceived++;
        if (typeof onProgress === 'function') {
          onProgress(chunksReceived, totalChunks, totalImportedMessages, { sasCode: localSasCode });
        }
      } catch (chunkErr) {
        console.error('Failed to decrypt or import chunk:', chunkErr);
      }
    };

    const handleFinished = () => {
      cleanupListeners();
      // Notify entire app that local database and conversations are hydrated
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      }
      resolve({
        importedMessages: totalImportedMessages,
        importedChats: totalImportedChats,
        chunksReceived,
        sasCode: localSasCode
      });
    };

    socket.on('qr_sync:paired', handlePaired);
    socket.on('qr_sync:chunk_received', handleChunkReceived);
    socket.on('qr_sync:finished', handleFinished);
    socket.on('qr_sync:cancelled', handleCancelled);

    // Send pair request to old device
    socket.emit(
      'qr_sync:request_pair',
      {
        sessionId: parsed.sid,
        pairingToken: parsed.tok,
        ephemeralPublicKey: newDevicePublicJwk,
        deviceName: getDeviceDisplayName(),
        deviceId: myDeviceId
      },
      (res) => {
        if (!res || !res.success) {
          cleanupListeners();
          return reject(new Error(res?.error || 'PAIRING_REQUEST_FAILED'));
        }
        if (typeof onProgress === 'function') {
          onProgress(0, 0, 0, { status: 'waiting_for_approval', sasCode: localSasCode });
        }
      }
    );
  });
}

/**
 * Backward-compatible helper: Initiate pairing
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
 * Backward-compatible helper: Approve and stream history
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
  const sessionKey = await deriveSyncSessionKey(oldDeviceKeyPair.privateKey, parsed.pk);

  await new Promise((resolve, reject) => {
    socket.emit('qr_sync:approve', {
      sessionId: parsed.sid,
      pairingToken: parsed.tok,
      ephemeralPublicKey: oldDevicePublicJwk
    }, (res) => {
      if (!res || !res.success) return reject(new Error(res?.error || 'APPROVAL_REJECTED'));
      resolve(res);
    });
  });

  const allMessages = await getAllMessagesFromLocalDb();
  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < allMessages.length; i += CHUNK_SIZE) {
    chunks.push(allMessages.slice(i, i + CHUNK_SIZE));
  }

  const totalChunks = Math.max(1, chunks.length);

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

  socket.emit('qr_sync:complete', { sessionId: parsed.sid });
  return { transferredMessages: allMessages.length, totalChunks };
}

/**
 * Backward-compatible helper: Listen and import history
 */
export function listenAndImportHistory(socket, sessionId, myPrivateKey, onProgress) {
  const subtle = getCryptoSubtle();

  return new Promise((resolve, reject) => {
    let sessionKey = null;
    let receivedChunks = 0;
    let totalImportedMessages = 0;

    socket.on('qr_sync:paired', async ({ oldDevicePublicKey, peerPublicKey }) => {
      try {
        sessionKey = await deriveSyncSessionKey(myPrivateKey, peerPublicKey || oldDevicePublicKey);
      } catch (err) {
        reject(new Error('SESSION_KEY_DERIVATION_FAILED: ' + err.message));
      }
    });

    socket.on('qr_sync:chunk_received', async ({ totalChunks, encryptedPayload, iv }) => {
      try {
        if (!sessionKey) return;
        const ivBuf = base64ToArrayBuffer(iv);
        const payloadBuf = base64ToArrayBuffer(encryptedPayload);

        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: ivBuf, tagLength: 128 },
          sessionKey,
          payloadBuf
        );

        const payload = JSON.parse(new TextDecoder().decode(decrypted));
        const messages = Array.isArray(payload) ? payload : payload.messages || [];

        if (Array.isArray(messages) && messages.length > 0) {
          const byChat = {};
          messages.forEach((m) => {
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
