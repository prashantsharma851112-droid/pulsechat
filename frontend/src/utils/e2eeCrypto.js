/**
 * PulseChat End-to-End Encryption (E2EE) Cryptographic Engine
 * Standard Web Crypto API Implementation:
 * - Asymmetric Key Agreement: ECDH (Curve P-256 / secp256r1)
 * - Symmetric Authenticated Encryption: AES-256-GCM (12-byte IV, 16-byte GCM tag)
 * - Key Derivation: HKDF-SHA256
 * - Ephemeral Key Agreement: Single-use ephemeral ECDH key pair per message
 * - Media Encryption: Client-side AES-256-GCM before CDN upload
 */

const DB_NAME = 'pulsechat_local_db';
const STORE_DEVICE_KEYS = 'device_keys';

// In-flight initialization mutex/promise map to prevent concurrent identity generation
const inFlightInitPromises = new Map();
// In-memory identity cache for environments where IndexedDB is unavailable
const inMemoryIdentityCache = new Map();

function getCryptoSubtle() {
  const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) || globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (subtle) is not available in this environment.');
  }
  return subtle;
}

function getCryptoRandomValues(arr) {
  const c = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
  if (!c || !c.getRandomValues) {
    throw new Error('Web Crypto API (getRandomValues) is not available.');
  }
  return c.getRandomValues(arr);
}

// Base64 helpers
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToArrayBuffer(base64) {
  let binary;
  if (typeof atob !== 'undefined') {
    binary = atob(base64);
  } else {
    binary = Buffer.from(base64, 'base64').toString('binary');
  }
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Access or create IndexedDB store for device keys (aligned with localDatabase version 2)
 */
function getDeviceKeyDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('chatId', 'chatId', { unique: false });
          msgStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('media_blobs')) {
          db.createObjectStore('media_blobs', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains(STORE_DEVICE_KEYS)) {
          db.createObjectStore(STORE_DEVICE_KEYS, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        db.onversionchange = () => {
          try { db.close(); } catch (_) {}
        };
        resolve(db);
      };
      request.onblocked = () => {
        console.warn('IndexedDB device_keys open blocked by another tab');
      };
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Generates an ECDH P-256 identity key pair
 */
export async function generateIdentityKeyPair() {
  const subtle = getCryptoSubtle();
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  return { keyPair, publicKeyJwk };
}

/**
 * Hydrates an existing stored identity record into an imported KeyPair,
 * performing safe migration from legacy JSON JWK if necessary.
 */
async function _hydrateIdentityRecord(record) {
  const subtle = getCryptoSubtle();
  if (record && record.publicKeyJwk && record.privateKey) {
    if (record.privateKey.extractable !== false) {
      throw new Error('Stored device identity private key is extractable; refusing to use it.');
    }
    const publicKey = await subtle.importKey(
      'jwk',
      record.publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
    return {
      keyPair: { publicKey, privateKey: record.privateKey },
      recordToPersist: null,
      identityRecord: record
    };
  } else if (record && record.publicKeyJwk && record.privateKeyJwk) {
    // Migrate the existing identity without generating or rotating its key.
    const privateKey = await subtle.importKey(
      'jwk',
      record.privateKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits']
    );
    const publicKey = await subtle.importKey(
      'jwk',
      record.publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
    const updated = { ...record, privateKey, migratedAt: new Date().toISOString() };
    delete updated.privateKeyJwk;
    return {
      keyPair: { publicKey, privateKey },
      recordToPersist: updated,
      identityRecord: updated
    };
  } else if (record) {
    throw new Error('Stored device identity is incomplete; refusing to replace it.');
  }
  return null;
}

async function _performGetOrInitDeviceIdentity(identityId) {
  const db = await getDeviceKeyDb();
  if (!db) {
    throw new Error('DURABLE_STORAGE_UNAVAILABLE: IndexedDB is required for E2EE device identity persistence.');
  }

  let existing = null;
  if (db.objectStoreNames && db.objectStoreNames.contains(STORE_DEVICE_KEYS)) {
    try {
      existing = await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_DEVICE_KEYS], 'readonly');
        const request = tx.objectStore(STORE_DEVICE_KEYS).get(identityId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event);
      });
    } catch (err) {
      console.warn('Could not read device identity from IndexedDB:', err);
    }
  }

  if (!existing) {
    existing = inMemoryIdentityCache.get(identityId) || null;
  }

  let keyPair;
  let identityRecord = existing;
  let recordToPersist = null;

  if (existing) {
    const hydrated = await _hydrateIdentityRecord(existing);
    keyPair = hydrated.keyPair;
    identityRecord = hydrated.identityRecord;
    recordToPersist = hydrated.recordToPersist;
  } else {
    const generated = await generateIdentityKeyPair();
    const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    identityRecord = {
      id: identityId,
      deviceId,
      publicKeyJwk: generated.publicKeyJwk,
      privateKey: generated.keyPair.privateKey,
      createdAt: new Date().toISOString()
    };
    recordToPersist = identityRecord;
    keyPair = generated.keyPair;
  }

  if (recordToPersist) {
    inMemoryIdentityCache.set(identityId, identityRecord);
    if (db && db.objectStoreNames && db.objectStoreNames.contains(STORE_DEVICE_KEYS)) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction([STORE_DEVICE_KEYS], 'readwrite');
          const request = tx.objectStore(STORE_DEVICE_KEYS).put(recordToPersist);
          request.onerror = (event) => reject(event);
          tx.oncomplete = resolve;
          tx.onerror = (event) => reject(event);
        });
      } catch (err) {
        console.warn('Could not persist device identity to IndexedDB:', err);
      }
    }
  }

  return {
    deviceId: identityRecord.deviceId,
    publicKeyJwk: identityRecord.publicKeyJwk,
    keyPair
  };
}

/**
 * Get or initialize persistent local device identity.
 * Concurrency:
 * - Coordinates across tabs via Web Locks API (navigator.locks.request).
 * - Coalesces concurrent calls within the same process via in-flight Promise map.
 * - Fails closed if durable IndexedDB storage is unavailable.
 */
export async function getOrInitDeviceIdentity(userId) {
  const identityId = typeof userId === 'string' ? userId.trim() : '';
  if (!identityId) {
    throw new Error('An authenticated userId is required for device identity storage.');
  }

  // Deduplicate concurrent initialization calls in the same process/tab
  if (inFlightInitPromises.has(identityId)) {
    return inFlightInitPromises.get(identityId);
  }

  const runWithCrossTabCoordination = async () => {
    const lockName = `pulsechat_device_identity_lock_${identityId}`;
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      return await navigator.locks.request(lockName, async () => {
        return await _performGetOrInitDeviceIdentity(identityId);
      });
    }
    return await _performGetOrInitDeviceIdentity(identityId);
  };

  const promise = (async () => {
    try {
      return await runWithCrossTabCoordination();
    } finally {
      inFlightInitPromises.delete(identityId);
    }
  })();

  inFlightInitPromises.set(identityId, promise);
  return promise;
}

/**
 * Single-device core envelope encryption helper (ECDH + HKDF + AES-256-GCM)
 */
async function _encryptSingleDeviceEnvelope(plaintextData, recipientPublicKeyJwk, senderDeviceId, recipientDeviceId) {
  const subtle = getCryptoSubtle();

  // 1. Generate single-use ephemeral key pair for perfect forward secrecy
  const ephemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

  // 2. Import recipient's public identity key
  const recipientKey = await subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. Derive 256 bits of shared secret using ECDH
  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // 4. Derive symmetric encryption key via HKDF (SHA-256)
  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const encKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16), // Fixed domain salt
      info: new TextEncoder().encode('pulsechat-e2ee-message-v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 5. Encrypt plaintext JSON payload with AES-256-GCM
  const iv = getCryptoRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(
    typeof plaintextData === 'string' ? plaintextData : JSON.stringify(plaintextData)
  );

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    encKey,
    encodedPlaintext
  );

  return {
    v: 1,
    format: 'pulse_e2ee_v1',
    senderDeviceId: String(senderDeviceId || 'unknown'),
    recipientDeviceId: String(recipientDeviceId || 'all'),
    ephemeralPublicKey: ephemeralPublicKeyJwk,
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer)
  };
}

/**
 * Encrypts a message payload for a recipient using ECDH + HKDF + AES-256-GCM
 * Supports multi-device delivery: creates per-device ciphertext entries when multiple target devices are provided.
 */
export async function encryptMessageEnvelope(plaintextData, recipientPublicKeyJwkOrTarget, senderDeviceId, recipientDeviceId, senderPublicKeyJwk = null) {
  const isMultiDevice = Boolean(
    recipientPublicKeyJwkOrTarget &&
    Array.isArray(recipientPublicKeyJwkOrTarget.devices) &&
    recipientPublicKeyJwkOrTarget.devices.length > 0
  );

  if (!isMultiDevice) {
    const pubJwk = recipientPublicKeyJwkOrTarget?.publicKeyJwk || recipientPublicKeyJwkOrTarget;
    return await _encryptSingleDeviceEnvelope(plaintextData, pubJwk, senderDeviceId, recipientDeviceId);
  }

  const targetDevices = [...recipientPublicKeyJwkOrTarget.devices];
  if (senderDeviceId && senderPublicKeyJwk) {
    if (!targetDevices.some(d => d.deviceId === senderDeviceId)) {
      targetDevices.push({ deviceId: senderDeviceId, publicKeyJwk: senderPublicKeyJwk });
    }
  }
  const deviceEnvelopes = {};
  let primaryEnvelope = null;

  for (const dev of targetDevices) {
    if (!dev || !dev.publicKeyJwk) continue;
    try {
      const devEnv = await _encryptSingleDeviceEnvelope(plaintextData, dev.publicKeyJwk, senderDeviceId, dev.deviceId);
      deviceEnvelopes[dev.deviceId] = devEnv;
      if (!primaryEnvelope) {
        primaryEnvelope = devEnv;
      }
    } catch (err) {
      console.warn(`Failed to encrypt envelope for device ${dev.deviceId}:`, err);
    }
  }

  if (!primaryEnvelope) {
    throw new Error('E2EE_ENCRYPTION_FAILED: Could not encrypt envelope for any recipient device.');
  }

  return {
    ...primaryEnvelope,
    devices: deviceEnvelopes
  };
}

/**
 * Decrypts an E2EE envelope using recipient's private key
 * Multi-device compatible: checks envelope.devices[myDeviceId] if available.
 */
export async function decryptMessageEnvelope(envelope, recipientPrivateKeyOrJwk, myDeviceId = '') {
  const subtle = getCryptoSubtle();

  if (!envelope || (!envelope.format && !envelope.devices)) {
    throw new Error('MALFORMED_E2EE_ENVELOPE: Invalid or missing cryptographic fields.');
  }

  // Multi-device selection: if per-device envelopes are present, select matching device entry
  let activeEnvelope = envelope;
  if (envelope.devices && typeof envelope.devices === 'object') {
    if (myDeviceId && envelope.devices[myDeviceId]) {
      activeEnvelope = envelope.devices[myDeviceId];
    } else if (envelope.recipientDeviceId && envelope.devices[envelope.recipientDeviceId]) {
      activeEnvelope = envelope.devices[envelope.recipientDeviceId];
    }
  }

  if (!activeEnvelope || !activeEnvelope.ephemeralPublicKey || !activeEnvelope.ciphertext || !activeEnvelope.iv) {
    throw new Error('MALFORMED_E2EE_ENVELOPE: Invalid or missing cryptographic fields.');
  }

  // 1. Resolve private key
  let privKey = recipientPrivateKeyOrJwk;
  if (recipientPrivateKeyOrJwk && typeof recipientPrivateKeyOrJwk === 'object' && recipientPrivateKeyOrJwk.kty === 'EC') {
    privKey = await subtle.importKey(
      'jwk',
      recipientPrivateKeyOrJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits']
    );
  }

  // 2. Import ephemeral public key
  const ephemeralKey = await subtle.importKey(
    'jwk',
    activeEnvelope.ephemeralPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. Derive shared secret
  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralKey },
    privKey,
    256
  );

  // 4. Derive symmetric key via HKDF
  const hkdfKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const decKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      info: new TextEncoder().encode('pulsechat-e2ee-message-v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 5. Decrypt ciphertext
  const ivBuffer = base64ToArrayBuffer(activeEnvelope.iv);
  const ciphertextBuffer = base64ToArrayBuffer(activeEnvelope.ciphertext);

  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer, tagLength: 128 },
      decKey,
      ciphertextBuffer
    );
    const decryptedString = new TextDecoder().decode(decryptedBuffer);
    try {
      return JSON.parse(decryptedString);
    } catch (_) {
      return decryptedString;
    }
  } catch (err) {
    throw new Error('E2EE_DECRYPTION_FAILED: Authentication tag verification failed or wrong key.');
  }
}

/**
 * Encrypts an attachment (image, voice, video) client-side before CDN upload
 */
export async function encryptAttachmentFile(fileArrayBuffer) {
  const subtle = getCryptoSubtle();
  const fileKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const fileKeyJwk = await subtle.exportKey('jwk', fileKey);
  const iv = getCryptoRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    fileKey,
    fileArrayBuffer
  );

  return {
    ciphertextBuffer,
    mediaKeyJwk: fileKeyJwk,
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypts an attachment client-side after downloading from CDN
 */
export async function decryptAttachmentFile(ciphertextBuffer, mediaKeyJwk, ivBase64) {
  const subtle = getCryptoSubtle();
  const fileKey = await subtle.importKey(
    'jwk',
    mediaKeyJwk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = base64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    fileKey,
    ciphertextBuffer
  );

  return decryptedBuffer;
}

// In-memory cache for peer device public keys to prevent redundant network fetches
const peerDeviceKeyCache = new Map();

// In-flight registration promises to prevent race conditions on concurrent calls
const registrationInFlight = new Map();

// In-memory set of verified device key registrations
const verifiedDeviceRegistrations = new Set();

/**
 * Invalidate cached registration state so that registration will be re-verified or re-uploaded.
 */
export function invalidateDeviceRegistration(userId, deviceId) {
  if (!userId && !deviceId) {
    verifiedDeviceRegistrations.clear();
  } else {
    verifiedDeviceRegistrations.delete(`${userId}_${deviceId}`);
  }
}

/**
 * Invalidate peer device public key cache
 */
export function invalidatePeerDeviceKeyCache(peerId) {
  if (!peerId) {
    peerDeviceKeyCache.clear();
  } else {
    peerDeviceKeyCache.delete(String(peerId).trim());
  }
}

/**
 * Validates whether the server actually has this device's public key registered
 */
export async function validateServerDeviceRegistration(userId, deviceId, token, apiBaseUrl = '') {
  if (!userId || !deviceId || !token) return false;
  try {
    const backendUrl = apiBaseUrl || (typeof window !== 'undefined' ? (window.__BACKEND_URL__ || '') : '');
    const res = await fetch(`${backendUrl}/api/keys/devices/my`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) return false;
    const data = await res.json();
    const devices = data.devices || [];
    const isRegistered = devices.some(d => (d.deviceId === deviceId || d.device_id === deviceId) && !d.revoked && !d.isRevoked);
    const regKey = `${userId}_${deviceId}`;
    if (isRegistered) {
      verifiedDeviceRegistrations.add(regKey);
    } else {
      verifiedDeviceRegistrations.delete(regKey);
    }
    return isRegistered;
  } catch (_) {
    return false;
  }
}

/**
 * Registers this device's public key with the backend key directory.
 * Idempotent, safe under concurrency, does not rely blindly on sessionStorage,
 * and preserves existing identity/private keys upon any network/server failure.
 */
export async function ensureDeviceIdentityRegistered(userId, token, apiBaseUrl = '', force = false) {
  if (!userId) return null;
  const identity = await getOrInitDeviceIdentity(userId);
  if (!token) return identity;

  const regKey = `${userId}_${identity.deviceId}`;

  // If already verified in memory for this session and not forced, return immediately
  if (!force && verifiedDeviceRegistrations.has(regKey)) {
    return identity;
  }

  // If an upload is currently in flight for this exact device, join that promise
  if (registrationInFlight.has(regKey)) {
    return registrationInFlight.get(regKey);
  }

  const p = (async () => {
    try {
      const backendUrl = apiBaseUrl || (typeof window !== 'undefined' ? (window.__BACKEND_URL__ || '') : '');
      const url = `${backendUrl}/api/keys/upload`;
      const payload = {
        device_keys: {
          user_id: String(userId),
          device_id: identity.deviceId,
          algorithms: ['m.olm.v1.curve25519-aes-sha2', 'pulse.p256.aes-gcm.v1'],
          keys: {
            [`p256:${identity.deviceId}`]: identity.publicKeyJwk
          }
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        verifiedDeviceRegistrations.add(regKey);
      } else {
        let errText = '';
        try { errText = await res.text(); } catch (_) {}
        console.warn(`[E2EE] Could not register device public key (HTTP ${res.status}):`, errText);
      }
    } catch (err) {
      console.warn('Could not register device public key with server:', err);
    } finally {
      registrationInFlight.delete(regKey);
    }

    return identity;
  })();

  registrationInFlight.set(regKey, p);
  return p;
}

/**
 * Fetches the peer's active device public key for E2EE session establishment
 */
export async function fetchPeerDevicePublicKey(peerId, token, apiBaseUrl = '', bypassCache = false) {
  if (!peerId) return null;
  const cleanPeerId = String(peerId).trim();

  if (!bypassCache) {
    const cachedEntry = peerDeviceKeyCache.get(cleanPeerId);
    if (cachedEntry && (!cachedEntry.expiresAt || cachedEntry.expiresAt > Date.now())) {
      return cachedEntry.result || cachedEntry;
    }
  }

  try {
    const backendUrl = apiBaseUrl || (typeof window !== 'undefined' ? (window.__BACKEND_URL__ || '') : '');
    const url = `${backendUrl}/api/keys/${encodeURIComponent(cleanPeerId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const devices = data.devices || [];
      const validDevices = [];
      for (const dev of devices) {
        if (!dev || dev.revoked || dev.isRevoked) continue;
        const keyObj = dev.keys || dev.publicKey;
        let pubJwk = null;
        if (keyObj && keyObj.kty === 'EC') {
          pubJwk = keyObj;
        } else if (keyObj && typeof keyObj === 'object') {
          for (const [k, v] of Object.entries(keyObj)) {
            if (v && typeof v === 'object' && v.kty === 'EC') {
              pubJwk = v;
              break;
            }
          }
        }
        if (pubJwk) {
          validDevices.push({
            deviceId: dev.device_id || dev.deviceId,
            publicKeyJwk: pubJwk
          });
        }
      }
      if (validDevices.length > 0) {
        const primary = validDevices[0];
        const result = {
          deviceId: primary.deviceId,
          publicKeyJwk: primary.publicKeyJwk,
          devices: validDevices
        };
        peerDeviceKeyCache.set(cleanPeerId, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
        return result;
      }
      peerDeviceKeyCache.delete(cleanPeerId);
      return { error: 'NO_ACTIVE_KEYS', status: 200 };
    } else {
      let errCode = 'FETCH_FAILED';
      try {
        const errData = await res.json();
        if (errData?.error) errCode = errData.error;
      } catch (_) {}
      return { error: errCode, status: res.status };
    }
  } catch (err) {
    console.warn('Failed to fetch peer device public key:', err);
    return { error: 'NETWORK_ERROR', status: 0 };
  }

  return { error: 'UNKNOWN_ERROR', status: 0 };
}

/**
 * Decrypts a message if it contains an E2EE envelope
 * Checks matching deviceId in multi-device envelopes to decrypt with appropriate private key.
 */
export async function decryptMessageIfNeeded(msg, privateKey, myDeviceId = '') {
  if (!msg || !msg.isEncrypted || !msg.envelope || !privateKey) {
    return msg;
  }
  // If already decrypted and has valid content, never re-decrypt
  if (msg._decrypted && msg.content && !msg._decryptionFailed) {
    return msg;
  }
  try {
    const decrypted = await decryptMessageEnvelope(msg.envelope, privateKey, myDeviceId);
    if (typeof decrypted === 'object' && decrypted !== null) {
      return {
        ...msg,
        content: decrypted.content !== undefined ? decrypted.content : msg.content,
        type: decrypted.type || msg.type,
        textStyle: decrypted.textStyle !== undefined ? decrypted.textStyle : msg.textStyle,
        replyTo: decrypted.replyTo !== undefined ? decrypted.replyTo : msg.replyTo,
        mediaUrl: decrypted.mediaUrl !== undefined ? decrypted.mediaUrl : msg.mediaUrl,
        audioUrl: decrypted.audioUrl !== undefined ? decrypted.audioUrl : msg.audioUrl,
        mediaKey: decrypted.mediaKey || msg.mediaKey,
        mediaIv: decrypted.mediaIv || msg.mediaIv,
        fileName: decrypted.fileName !== undefined ? decrypted.fileName : msg.fileName,
        fileSize: decrypted.fileSize !== undefined ? decrypted.fileSize : msg.fileSize,
        isViewOnce: decrypted.isViewOnce !== undefined ? decrypted.isViewOnce : msg.isViewOnce,
        isViewTwice: decrypted.isViewTwice !== undefined ? decrypted.isViewTwice : msg.isViewTwice,
        pollData: decrypted.pollData !== undefined ? decrypted.pollData : msg.pollData,
        giftData: decrypted.giftData !== undefined ? decrypted.giftData : msg.giftData,
        storyReply: decrypted.storyReply !== undefined ? decrypted.storyReply : msg.storyReply,
        _decrypted: true
      };
    } else if (typeof decrypted === 'string') {
      return {
        ...msg,
        content: decrypted,
        _decrypted: true
      };
    }
  } catch (err) {
    console.warn('Failed to decrypt message envelope:', err.message);
    if (msg.content && typeof msg.content === 'string' && msg.content.trim() !== '' && !msg._decryptionFailed) {
      return msg;
    }
    return {
      ...msg,
      content: '🔒 Encrypted message (cannot decrypt on this device)',
      _decryptionFailed: true
    };
  }
  return msg;
}
