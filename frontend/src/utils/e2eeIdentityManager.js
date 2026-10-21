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
