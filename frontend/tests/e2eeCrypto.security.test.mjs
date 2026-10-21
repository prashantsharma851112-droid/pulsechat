import assert from 'node:assert/strict';
import { test } from 'node:test';

const stores = new Map();
const objectStoreNames = {
  contains: (name) => stores.has(name)
};

class FakeStore {
  get(key) {
    const request = {};
    setTimeout(() => {
      request.result = stores.get('device_keys').get(key);
      request.onsuccess?.();
    }, 0);
    return request;
  }

  put(value) {
    stores.get('device_keys').set(value.id, value);
    const request = {};
    setTimeout(() => request.onsuccess?.(), 0);
    return request;
  }
}

class FakeDb {
  objectStoreNames = objectStoreNames;

  createObjectStore(name) {
    stores.set(name, new Map());
    return {
      createIndex() {}
    };
  }

  transaction() {
    const transaction = {
      objectStore: () => new FakeStore(),
      oncomplete: null,
      onerror: null
    };
    setTimeout(() => transaction.oncomplete?.(), 1);
    return transaction;
  }
}

globalThis.window = {
  crypto: globalThis.crypto,
  indexedDB: {
    open() {
      const request = {};
      setTimeout(() => {
        request.result = new FakeDb();
        request.onupgradeneeded?.({ target: { result: request.result } });
        request.onsuccess?.({ target: { result: request.result } });
      }, 0);
      return request;
    }
  }
};

const {
  generateIdentityKeyPair,
  getOrInitDeviceIdentity
} = await import('../src/utils/e2eeCrypto.js');

test('new identity private key is non-extractable and has no private JWK', async () => {
  const identity = await generateIdentityKeyPair();

  assert.equal(identity.privateKeyJwk, undefined);
  assert.equal(identity.keyPair.privateKey.extractable, false);
  await assert.rejects(
    globalThis.crypto.subtle.exportKey('jwk', identity.keyPair.privateKey)
  );
});

test('identities remain isolated by explicit user identity', async () => {
  const first = await getOrInitDeviceIdentity('security-user-a');
  const second = await getOrInitDeviceIdentity('security-user-b');

  assert.notEqual(first.deviceId, second.deviceId);
  assert.notDeepEqual(first.publicKeyJwk, second.publicKeyJwk);
  assert.equal(stores.get('device_keys').has('security-user-a'), true);
  assert.equal(stores.get('device_keys').has('security-user-b'), true);
});

test('legacy JWK is migrated without rotating the device identity', async () => {
  const legacyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJwk = await globalThis.crypto.subtle.exportKey('jwk', legacyPair.publicKey);
  const privateKeyJwk = await globalThis.crypto.subtle.exportKey('jwk', legacyPair.privateKey);
  stores.get('device_keys').set('legacy-user', {
    id: 'legacy-user',
    deviceId: 'legacy-device',
    publicKeyJwk,
    privateKeyJwk,
    createdAt: '2026-01-01T00:00:00.000Z'
  });

  const migrated = await getOrInitDeviceIdentity('legacy-user');
  const stored = stores.get('device_keys').get('legacy-user');

  assert.equal(migrated.deviceId, 'legacy-device');
  assert.deepEqual(migrated.publicKeyJwk, publicKeyJwk);
  assert.equal(stored.privateKeyJwk, undefined);
  assert.equal(stored.privateKey.extractable, false);
});

test('incomplete stored identity fails instead of silently replacing the key', async () => {
  stores.get('device_keys').set('incomplete-user', {
    id: 'incomplete-user',
    deviceId: 'incomplete-device',
    publicKeyJwk: { kty: 'EC' }
  });

  await assert.rejects(
    getOrInitDeviceIdentity('incomplete-user'),
    /Stored device identity is incomplete/
  );
});

test('extractable stored CryptoKey is rejected instead of weakening the boundary', async () => {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  stores.get('device_keys').set('extractable-user', {
    id: 'extractable-user',
    deviceId: 'extractable-device',
    publicKeyJwk: await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey),
    privateKey: keyPair.privateKey
  });

  await assert.rejects(
    getOrInitDeviceIdentity('extractable-user'),
    /private key is extractable/
  );
});
