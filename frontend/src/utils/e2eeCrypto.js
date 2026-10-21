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
 * Access or create IndexedDB store for device keys
 */
function getDeviceKeyDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      // Use version 2 to ensure STORE_DEVICE_KEYS exists
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
      request.onsuccess = (e) => resolve(e.target.result);
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

  const existing = await new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_DEVICE_KEYS], 'readonly');
      const request = tx.objectStore(STORE_DEVICE_KEYS).get(identityId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event);
    } catch (err) {
      reject(err);
    }
  });

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
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_DEVICE_KEYS], 'readwrite');
        const request = tx.objectStore(STORE_DEVICE_KEYS).put(recordToPersist);
        request.onerror = (event) => reject(event);
        tx.oncomplete = resolve;
        tx.onerror = (event) => reject(event);
      } catch (err) {
        reject(err);
      }
    });
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
 * Encrypts a message payload for a recipient using ECDH + HKDF + AES-256-GCM
 */
export async function encryptMessageEnvelope(plaintextData, recipientPublicKeyJwk, senderDeviceId, recipientDeviceId) {
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
 * Decrypts an E2EE envelope using recipient's private key
 */
export async function decryptMessageEnvelope(envelope, recipientPrivateKeyOrJwk) {
  const subtle = getCryptoSubtle();

  if (!envelope || envelope.format !== 'pulse_e2ee_v1' || !envelope.ephemeralPublicKey || !envelope.ciphertext || !envelope.iv) {
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
    envelope.ephemeralPublicKey,
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
  const ivBuffer = base64ToArrayBuffer(envelope.iv);
  const ciphertextBuffer = base64ToArrayBuffer(envelope.ciphertext);

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
