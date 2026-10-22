/**
 * PulseChat E2EE Identity & Key Verification Manager
 * 
 * Cryptographic Foundation:
 * - Identity Signing Key: Ed25519 (for signing prekeys and authenticating device identity)
 * - Identity Exchange Key: Curve25519 (for X3DH key agreement and Double Ratchet root)
 * - Safety Numbers: Deterministic 60-digit Short Authentication String (SAS) computed as SHA-512(KeyA || KeyB)
 * - Trust-on-First-Use (TOFU) with Strict Key-Change Detection (MITM prevention)
 * - Zero Private Key Transmission: Private keys are strictly confined to IndexedDB
 */

const DB_NAME = 'pulsechat_local_db';
const STORE_TRUSTED_IDENTITIES = 'trusted_identities';
const REQUIRED_DEVICE_ALGORITHMS = ['m.olm.v1.curve25519-aes-sha2'];

// In-memory pin store for Trust-On-First-Use (TOFU) key pinning
const pinnedIdentityKeys = new Map();

export function pinDeviceKey(userId, deviceId, ed25519Fingerprint) {
  if (!userId || !deviceId || !ed25519Fingerprint) return;
  const key = `${userId}:${deviceId}`;
  pinnedIdentityKeys.set(key, String(ed25519Fingerprint));
}

export function getPinnedDeviceKey(userId, deviceId) {
  return pinnedIdentityKeys.get(`${userId}:${deviceId}`) || null;
}

export function clearPinnedDevices() {
  pinnedIdentityKeys.clear();
}

function hasFunction(obj, name) {
  return Boolean(obj) && typeof obj[name] === 'function';
}

function extractFingerprint(deviceInfo) {
  if (typeof deviceInfo?.fingerprint === 'function') {
    return deviceInfo.fingerprint();
  }
  if (typeof deviceInfo?.fingerprint === 'string') {
    return deviceInfo.fingerprint;
  }
  const keys = deviceInfo?.keys || {};
  const deviceId = deviceInfo?.deviceId || '';
  return keys[`ed25519:${deviceId}`] || keys['ed25519'] || null;
}

function ensureAlgorithms(deviceInfo) {
  const algorithms = Array.isArray(deviceInfo?.algorithms) ? deviceInfo.algorithms : [];
  for (const required of REQUIRED_DEVICE_ALGORITHMS) {
    if (!algorithms.includes(required)) {
      throw new Error(`UNTRUSTED_DEVICE: Missing required algorithm ${required}`);
    }
  }
}

export function assertMatrixDeviceTrusted(deviceInfo, options = {}) {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    throw new Error('UNTRUSTED_DEVICE: Missing device identity.');
  }
  if (!deviceInfo.deviceId || !deviceInfo.userId) {
    throw new Error('UNTRUSTED_DEVICE: Device identity is incomplete.');
  }
  ensureAlgorithms(deviceInfo);

  // Check explicit blocked status
  if (hasFunction(deviceInfo, 'isBlocked') && deviceInfo.isBlocked()) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is blocked.`);
  }
  if (deviceInfo.isBlocked === true || deviceInfo.blocked === true) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is blocked.`);
  }

  if (!deviceInfo.keys || !deviceInfo.signatures) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} has unsigned key material.`);
  }

  // 1. Explicit verification status on SDK object or plain object
  if (hasFunction(deviceInfo, 'isVerified')) {
    if (!deviceInfo.isVerified()) {
      throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is not verified.`);
    }
    return true;
  }
  if (typeof deviceInfo.isVerified === 'boolean') {
    if (!deviceInfo.isVerified) {
      throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is not verified.`);
    }
    return true;
  }
  if (typeof deviceInfo.verified === 'boolean') {
    if (!deviceInfo.verified) {
      throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is not verified.`);
    }
    return true;
  }

  // 2. Local trust enum (e.g. LocalTrust.Verified = 0)
  if (deviceInfo.localTrust !== undefined && deviceInfo.localTrust !== null) {
    if (deviceInfo.localTrust !== 0 && deviceInfo.localTrust !== 'verified') {
      throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} local trust is not verified.`);
    }
    return true;
  }

  // 3. Plain JSON object without SDK methods: TOFU Key-Pinning evaluation
  const fingerprint = extractFingerprint(deviceInfo);
  if (!fingerprint) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} lacks ed25519 identity key.`);
  }

  const pinned = getPinnedDeviceKey(deviceInfo.userId, deviceInfo.deviceId);
  if (pinned) {
    if (pinned !== fingerprint) {
      // CRITICAL: Fingerprint changed for an already-pinned device! Possible MITM
      throw new Error(
        `UNTRUSTED_DEVICE: Security Alert: Key mismatch for ${deviceInfo.userId}/${deviceInfo.deviceId}! Fingerprint changed.`
      );
    }
    return true;
  }

  // Not yet pinned:
  // If strict mode is requested, unverified first-seen devices fail closed.
  if (options.strict === true || options.requireExplicitVerification === true) {
    throw new Error(
      `UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is unverified and requires explicit verification.`
    );
  }

  // Trust On First Use (TOFU): pin the key on first sight
  pinDeviceKey(deviceInfo.userId, deviceInfo.deviceId, fingerprint);
  return true;
}

export function chooseTrustedDevice(devicesById, options = {}) {
  const devices = Object.values(devicesById || {});
  for (const device of devices) {
    try {
      assertMatrixDeviceTrusted(device, options);
      return device;
    } catch {
      // Continue scanning for another trusted device.
    }
  }
  throw new Error('UNTRUSTED_DEVICE: No verifiable Matrix device available.');
}

function getCryptoSubtle() {
  const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) || globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API subtle is unavailable.');
  return subtle;
}

/**
 * Access or create IndexedDB store for trusted identities (TOFU)
 */
export function getTrustedIdentityDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      // Open version 3 to add STORE_TRUSTED_IDENTITIES
      const request = window.indexedDB.open(DB_NAME, 3);
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
        if (!db.objectStoreNames.contains('device_keys')) {
          db.createObjectStore('device_keys', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_TRUSTED_IDENTITIES)) {
          db.createObjectStore(STORE_TRUSTED_IDENTITIES, { keyPath: 'userId' });
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
 * Derives a deterministic 60-digit Safety Number (SAS) for out-of-band verification.
 * Standard format: 12 groups of 5 digits (60 digits total).
 */
export async function computeSafetyNumber(myUserId, myIdentityKey, peerUserId, peerIdentityKey) {
  const subtle = getCryptoSubtle();

  // Normalize and sort keys lexicographically to ensure identical output on both devices
  const isMineFirst = String(myUserId).localeCompare(String(peerUserId)) <= 0;
  const part1 = isMineFirst ? `${myUserId}:${myIdentityKey}` : `${peerUserId}:${peerIdentityKey}`;
  const part2 = isMineFirst ? `${peerUserId}:${peerIdentityKey}` : `${myUserId}:${myIdentityKey}`;

  const combinedBytes = new TextEncoder().encode(`pulsechat-safety-number-v1:${part1}||${part2}`);
  const hashBuffer = await subtle.digest('SHA-512', combinedBytes);
  const hashBytes = new Uint8Array(hashBuffer);

  // Convert first 32 bytes into 12 5-digit chunks
  const chunks = [];
  for (let i = 0; i < 12; i++) {
    const offset = i * 2;
    const val = (hashBytes[offset] << 8) | hashBytes[offset + 1];
    const chunk = String(val % 100000).padStart(5, '0');
    chunks.push(chunk);
  }

  return {
    raw: chunks.join(''),
    formatted: chunks.join(' ')
  };
}

/**
 * Trust-on-First-Use (TOFU) Verification:
 * - If new identity: stores and returns { status: 'NEW_TRUSTED' }
 * - If matches stored identity: returns { status: 'VERIFIED' }
 * - If identity key changed: returns { status: 'KEY_CHANGED', error: 'POSSIBLE_MITM_ATTACK' }
 */
export async function verifyRecipientIdentity(userId, receivedIdentityKey) {
  if (!userId || !receivedIdentityKey) {
    throw new Error('MISSING_IDENTITY_PARAMETERS');
  }

  const db = await getTrustedIdentityDb();
  if (!db) {
    // If running in environment without IndexedDB, flag unverified
    return { status: 'UNVERIFIED_NO_DB', userId, identityKey: receivedIdentityKey };
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_TRUSTED_IDENTITIES], 'readwrite');
      const store = tx.objectStore(STORE_TRUSTED_IDENTITIES);
      const req = store.get(String(userId));

      req.onsuccess = () => {
        const existing = req.result;
        if (!existing) {
          // Trust on first use
          store.put({
            userId: String(userId),
            identityKey: receivedIdentityKey,
            trustedAt: new Date().toISOString(),
            isManuallyVerified: false
          });
          resolve({ status: 'NEW_TRUSTED', userId, identityKey: receivedIdentityKey });
        } else if (existing.identityKey === receivedIdentityKey) {
          resolve({
            status: 'VERIFIED',
            userId,
            identityKey: receivedIdentityKey,
            isManuallyVerified: existing.isManuallyVerified
          });
        } else {
          // Key change detected! Server could be substituting public key
          resolve({
            status: 'KEY_CHANGED',
            userId,
            expectedKey: existing.identityKey,
            receivedKey: receivedIdentityKey,
            warning: 'SECURITY_ALERT: Recipient identity key has changed. Possible Man-in-the-Middle attack or new device.'
          });
        }
      };

      req.onerror = (e) => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Manually confirm a key change or mark recipient identity as verified
 */
export async function approveKeyChange(userId, newIdentityKey) {
  const db = await getTrustedIdentityDb();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_TRUSTED_IDENTITIES], 'readwrite');
      const store = tx.objectStore(STORE_TRUSTED_IDENTITIES);
      store.put({
        userId: String(userId),
        identityKey: newIdentityKey,
        trustedAt: new Date().toISOString(),
        isManuallyVerified: true
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}
