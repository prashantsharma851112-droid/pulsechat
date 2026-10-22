const path = require('path');

console.log('================================================================');
console.log(' RUNNING TO-DEVICE KEY ROUTE SECURITY TESTS');
console.log('================================================================\n');

let total = 0;
let passed = 0;
function assert(description, condition) {
  total += 1;
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${description}`);
  } else {
    process.exitCode = 1;
    console.error(`[FAIL] ${description}`);
  }
}

const backendDir = path.resolve(__dirname, '..');
const routePath = path.resolve(backendDir, 'routes/keys');
const authPath = path.resolve(backendDir, 'middleware/authMiddleware');
const userPath = path.resolve(backendDir, 'models/User');
const devicePath = path.resolve(backendDir, 'models/DeviceIdentity');
const txnPath = path.resolve(backendDir, 'models/ToDeviceTxn');
const ledgerPath = path.resolve(backendDir, 'models/MessageLedger');

const users = new Map([
  ['alice', { id: 'alice', friends: ['bob'], blockedUsers: ['charlie_blocked_by_alice'], isAdmin: false }],
  ['bob', { id: 'bob', friends: ['alice'], blockedUsers: [], isAdmin: false }],
  ['stranger_eve', { id: 'stranger_eve', friends: [], blockedUsers: [], isAdmin: false }],
  ['charlie_blocked_by_alice', { id: 'charlie_blocked_by_alice', friends: ['alice'], blockedUsers: [], isAdmin: false }]
]);

const devices = new Map([
  ['alice:A1', {
    userId: 'alice',
    deviceId: 'A1',
    isRevoked: false,
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:A1': 'ed_alice_1', 'curve25519:A1': 'crv_alice_1' },
    signatures: { alice: { 'ed25519:A1': 'sig_alice_1' } },
    oneTimeKeys: { 'signed_curve25519:otk_a1': { key: 'ka1' } },
    fallbackKeys: {}
  }],
  ['alice:A2', {
    userId: 'alice',
    deviceId: 'A2',
    isRevoked: false,
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:A2': 'ed_alice_2', 'curve25519:A2': 'crv_alice_2' },
    signatures: { alice: { 'ed25519:A2': 'sig_alice_2' } },
    oneTimeKeys: {},
    fallbackKeys: {}
  }],
  ['bob:B1', {
    userId: 'bob',
    deviceId: 'B1',
    isRevoked: false,
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:B1': 'ed_bob_1', 'curve25519:B1': 'crv_bob_1' },
    signatures: { bob: { 'ed25519:B1': 'sig_bob_1' } },
    oneTimeKeys: { 'signed_curve25519:otk_b1': { key: 'kb1' } },
    fallbackKeys: {}
  }],
  ['stranger_eve:E1', {
    userId: 'stranger_eve',
    deviceId: 'E1',
    isRevoked: false,
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:E1': 'ed_eve' },
    signatures: {},
    oneTimeKeys: {},
    fallbackKeys: {}
  }],
  ['charlie_blocked_by_alice:C1', {
    userId: 'charlie_blocked_by_alice',
    deviceId: 'C1',
    isRevoked: false,
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:C1': 'ed_c1' },
    signatures: {},
    oneTimeKeys: {},
    fallbackKeys: {}
  }]
]);

const txns = new Set();
const emitted = [];

function mongooseResult(result) {
  return {
    select() { return this; },
    lean: async () => result
  };
}

const User = {
  findOne(query) {
    let targetId = query?.id;
    if (!targetId && Array.isArray(query?.$or)) {
      const idCond = query.$or.find((c) => c.id || c._id);
      targetId = idCond?.id || idCond?._id;
    }
    return mongooseResult(users.get(targetId) || null);
  }
};

const DeviceIdentity = {
  find(query) {
    const list = [];
    for (const d of devices.values()) {
      if (d.userId === query?.userId) {
        if (query?.isRevoked === false && d.isRevoked) continue;
        list.push(d);
      }
    }
    return mongooseResult(list);
  },
  findOne(query) {
    const key = `${query?.userId}:${query?.deviceId}`;
    const found = devices.get(key);
    if (!found) return mongooseResult(null);
    if (query?.isRevoked === false && found.isRevoked) return mongooseResult(null);
    return mongooseResult(found);
  },
  async findOneAndUpdate(query, update) {
    const key = `${query?.userId}:${query?.deviceId}`;
    const existing = devices.get(key);
    if (!existing) return null;
    if (query?.isRevoked === false && existing.isRevoked) return null;

    // Check atomic conditional key existence
    for (const [qk, qv] of Object.entries(query)) {
      if (qk.startsWith('oneTimeKeys.') && qv?.$exists === true) {
        const sub = qk.slice('oneTimeKeys.'.length);
        if (!existing.oneTimeKeys || !(sub in existing.oneTimeKeys)) {
          return null; // Atomic collision: key already claimed or missing
        }
      }
    }

    const snapshot = JSON.parse(JSON.stringify(existing));
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) {
        if (k.startsWith('oneTimeKeys.')) {
          const sub = k.slice('oneTimeKeys.'.length);
          if (existing.oneTimeKeys) delete existing.oneTimeKeys[sub];
        }
      }
    }
    Object.assign(existing, update.$set || {});
    devices.set(key, existing);
    return snapshot;
  },
  async updateOne(query, update, options = {}) {
    const key = `${query?.userId}:${query?.deviceId}`;
    const existing = devices.get(key);
    if (!existing && options.upsert) {
      devices.set(key, {
        userId: query.userId,
        deviceId: query.deviceId,
        isRevoked: false,
        ...update.$setOnInsert,
        ...update.$set
      });
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    if (!existing) return { matchedCount: 0, modifiedCount: 0 };
    if (query?.isRevoked === false && existing.isRevoked) return { matchedCount: 0, modifiedCount: 0 };

    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) {
        if (k.startsWith('oneTimeKeys.')) {
          const sub = k.slice('oneTimeKeys.'.length);
          if (existing.oneTimeKeys) delete existing.oneTimeKeys[sub];
        }
      }
    }
    Object.assign(existing, update.$set || {});
    devices.set(key, existing);
    return { matchedCount: 1, modifiedCount: 1 };
  }
};

const ToDeviceTxn = {
  async create(doc) {
    const key = `${doc.senderUserId}:${doc.senderDeviceId}:${doc.txnId}`;
    if (txns.has(key)) {
      const err = new Error('duplicate');
      err.code = 11000;
      throw err;
    }
    txns.add(key);
    return doc;
  }
};

const MessageLedger = {
  findOne() {
    return mongooseResult(null);
  }
};

require.cache[require.resolve(authPath)] = {
  exports: (req, _res, next) => {
    req.user = { id: req.headers['x-test-user'] || 'alice' };
    req.userId = req.user.id;
    next();
  },
  loaded: true
};

require.cache[require.resolve(userPath)] = { exports: User, loaded: true };
require.cache[require.resolve(devicePath)] = { exports: DeviceIdentity, loaded: true };
require.cache[require.resolve(txnPath)] = { exports: ToDeviceTxn, loaded: true };
require.cache[require.resolve(ledgerPath)] = { exports: MessageLedger, loaded: true };

delete require.cache[require.resolve(routePath)];
const createKeysRouter = require(routePath);
const { __private } = createKeysRouter;

function createMockIo() {
  return {
    in(room) {
      return {
        async fetchSockets() {
          if (room === 'device:bob:B1' || room === 'device:alice:A2') return [{ id: 'sock_1' }];
          return [];
        }
      };
    },
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
}

function getRouteHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath);
  if (!layer) throw new Error(`Missing route ${routePath}`);
  return layer.route.stack.map((s) => s.handle);
}

async function invoke(router, routePath, method, reqOverrides) {
  const handlers = getRouteHandler(router, routePath, method.toLowerCase());
  const req = {
    params: reqOverrides.params || {},
    body: reqOverrides.body || {},
    headers: reqOverrides.headers || {},
    app: { get: () => createMockIo() },
    get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    }
  };
  const result = { statusCode: 200, body: null };
  const res = {
    setHeader() { return this; },
    getHeader() { return undefined; },
    status(code) { result.statusCode = code; return this; },
    json(payload) { result.body = payload; return this; }
  };
  for (const handler of handlers) {
    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let resolved = false;
        const next = (err) => {
          if (resolved) return;
          resolved = true;
          if (err) reject(err);
          else resolve();
        };
        try {
          const ret = handler(req, res, next);
          if (ret && typeof ret.then === 'function') {
            ret.then(() => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            }).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    } else {
      await handler(req, res);
    }
    if (result.body) break;
  }
  return result;
}

async function run() {
  const router = createKeysRouter();

  // 1. Mandatory sender device header
  const invalidSender = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice' },
    params: { eventType: 'm.room_key', txnId: 'txn1' },
    body: { messages: { bob: { B1: { key: 'abc' } } } }
  });
  assert('Sender device header is mandatory for to-device sends', invalidSender.statusCode === 400 && invalidSender.body?.error === 'SENDER_DEVICE_ID_REQUIRED');

  // 2. Unknown sender device
  const senderNotRegistered = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'MISSING' },
    params: { eventType: 'm.room_key', txnId: 'txn2' },
    body: { messages: { bob: { B1: { key: 'abc' } } } }
  });
  assert('Unknown sender device is rejected', senderNotRegistered.statusCode === 403 && senderNotRegistered.body?.error === 'SENDER_DEVICE_NOT_REGISTERED');

  // 3. Multi-target device rejection
  const invalidShape = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn3' },
    body: { messages: { bob: { B1: { key: 'a' }, B2: { key: 'b' } } } }
  });
  assert('Multiple target devices in one request are rejected', invalidShape.statusCode === 400 && invalidShape.body?.error === 'SINGLE_TARGET_DEVICE_REQUIRED');

  // 4. Unknown recipient
  const recipientMissing = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn4' },
    body: { messages: { ghost: { B1: { key: 'abc' } } } }
  });
  assert('Unknown recipient user is rejected', recipientMissing.statusCode === 404 && recipientMissing.body?.error === 'RECIPIENT_NOT_FOUND');

  // 5. Contact authorization: stranger sending to-device is rejected with NOT_CONTACTS
  const strangerSend = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'stranger_eve', 'x-device-id': 'E1' },
    params: { eventType: 'm.room_key', txnId: 'txn_stranger' },
    body: { messages: { bob: { B1: { key: 'abc' } } } }
  });
  assert('Stranger without contact/friendship is rejected with NOT_CONTACTS', strangerSend.statusCode === 403 && strangerSend.body?.error === 'NOT_CONTACTS');

  // 6. Blocklist enforcement: sender blocked by recipient is rejected
  const blockedSend = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn_blocked' },
    body: { messages: { charlie_blocked_by_alice: { C1: { key: 'abc' } } } }
  });
  assert('Sending to-device to/from blocked contact is rejected with BLOCKED', blockedSend.statusCode === 403 && blockedSend.body?.error === 'BLOCKED');

  // 7. Private key material in body is rejected
  const privKeyLeak = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn_priv' },
    body: {
      messages: {
        bob: {
          B1: {
            algorithm: 'm.olm.v1.curve25519-aes-sha2',
            privateKey: 'MIICXAIBAAKCAQEA...'
          }
        }
      }
    }
  });
  assert('Payload containing privateKey is rejected with PRIVATE_KEY_MATERIAL_NOT_PERMITTED', privKeyLeak.statusCode === 400 && privKeyLeak.body?.error === 'PRIVATE_KEY_MATERIAL_NOT_PERMITTED');

  // 8. Self-to-self same device rejected
  const selfSameDevice = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn_self_same' },
    body: { messages: { alice: { A1: { session: 's1' } } } }
  });
  assert('Sending to-device to self on same device is rejected', selfSameDevice.statusCode === 400 && selfSameDevice.body?.error === 'SELF_TO_SELF_NOT_ALLOWED');

  // 9. Self-to-self other device (multi-device sync) is allowed
  const selfOtherDevice = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn_self_other' },
    body: { messages: { alice: { A2: { session: 's1' } } } }
  });
  assert('Self-device sync to different registered device is allowed', selfOtherDevice.statusCode === 200 && selfOtherDevice.body?.ok === true);

  // 10. Legitimate send to friend device succeeds
  const okSend = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn-ok' },
    body: { messages: { bob: { B1: { room_id: '!r:server', session_id: 's1' } } } }
  });
  assert('Authorized friend sender can deliver to registered target device', okSend.statusCode === 200 && okSend.body?.ok === true && okSend.body?.recipientDeviceId === 'B1');
  assert('To-device payload is emitted only to exact target room', emitted.some((e) => e.room === 'device:bob:B1' && e.event === 'keys:to_device'));

  // 11. Duplicate transaction ID is idempotent
  const duplicateTxn = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn-ok' },
    body: { messages: { bob: { B1: { room_id: '!r:server', session_id: 's1' } } } }
  });
  assert('Duplicate transaction ID is idempotent', duplicateTxn.statusCode === 200 && duplicateTxn.body?.idempotent === true);

  // 12. Keys Query endpoint filters out unauthorized strangers
  const queryResult = await invoke(router, '/query', 'post', {
    headers: { 'x-test-user': 'alice' },
    body: { device_keys: { bob: [], stranger_eve: [] } }
  });
  assert('Keys query returns authorized friend device keys', queryResult.statusCode === 200 && Boolean(queryResult.body?.device_keys?.bob?.B1));
  assert('Keys query isolates unauthorized strangers in failures map', queryResult.body?.failures?.stranger_eve === 'NOT_CONTACTS');

  // 13. Keys Claim endpoint claims and consumes one-time prekeys
  const claimResult = await invoke(router, '/claim', 'post', {
    headers: { 'x-test-user': 'alice' },
    body: { one_time_keys: { bob: { B1: 'signed_curve25519' } } }
  });
  assert('Keys claim successfully claims one-time key', claimResult.statusCode === 200 && Boolean(claimResult.body?.one_time_keys?.bob?.B1?.['signed_curve25519:otk_b1']));

  // 13b. Atomic single-use: second claim on consumed key does not duplicate (falls back or reports failure)
  const secondClaimResult = await invoke(router, '/claim', 'post', {
    headers: { 'x-test-user': 'alice' },
    body: { one_time_keys: { bob: { B1: 'signed_curve25519' } } }
  });
  assert('Second claim on consumed OTK does not duplicate already-claimed key', !secondClaimResult.body?.one_time_keys?.bob?.B1?.['signed_curve25519:otk_b1']);

  // 14. Private validator helper checks & false positive / false negative evaluation
  assert('Private validator rejects unsupported event types', __private.validEventType('m.bad.event') === false);
  assert('Private parser accepts single user/device content', !__private.parseMessageEntries({ bob: { B1: { a: 1 } } }).error);
  assert('Private key detection catches secret_key', __private.containsPrivateKeyMaterial({ secret_key: 'abc' }) === true);
  assert('Private key detection catches sk (libsodium secret key)', __private.containsPrivateKeyMaterial({ sk: 'secret_bytes' }) === true);
  assert('Private key detection catches PEM header', __private.containsPrivateKeyMaterial({ pem: '-----BEGIN EC PRIVATE KEY-----' }) === true);
  assert('Private key detection catches JWK private scalar d', __private.containsPrivateKeyMaterial({ kty: 'OKP', crv: 'Ed25519', d: 'base64_private_scalar_here' }) === true);
  assert('Private key detector does NOT false-positive on innocent d property', __private.containsPrivateKeyMaterial({ d: 5, label: 'delta' }) === false);
  assert('Private key detector does NOT false-positive on public keys or signatures', __private.containsPrivateKeyMaterial({
    'curve25519:A1': 'pub_curve25519_key_string',
    'ed25519:A1': 'pub_ed25519_key_string',
    signatures: { alice: { 'ed25519:A1': 'signature_string' } }
  }) === false);

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

run().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});
