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

const users = new Map([
  ['alice', { id: 'alice' }],
  ['bob', { id: 'bob' }]
]);
const devices = new Map([
  ['alice:A1', { userId: 'alice', deviceId: 'A1', isRevoked: false }],
  ['bob:B1', { userId: 'bob', deviceId: 'B1', isRevoked: false }]
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
    return mongooseResult(users.get(query?.id) || null);
  }
};

const DeviceIdentity = {
  findOne(query) {
    const key = `${query?.userId}:${query?.deviceId}`;
    const found = devices.get(key);
    if (!found) return mongooseResult(null);
    if (query?.isRevoked === false && found.isRevoked) return mongooseResult(null);
    return mongooseResult(found);
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

delete require.cache[require.resolve(routePath)];
const createKeysRouter = require(routePath);
const { __private } = createKeysRouter;

function createMockIo() {
  return {
    in(room) {
      return {
        async fetchSockets() {
          if (room === 'device:bob:B1') return [{ id: 'sock_b1' }];
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

  const invalidSender = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice' },
    params: { eventType: 'm.room_key', txnId: 'txn1' },
    body: { messages: { bob: { B1: { key: 'abc' } } } }
  });
  assert('Sender device header is mandatory for to-device sends', invalidSender.statusCode === 400 && invalidSender.body?.error === 'SENDER_DEVICE_ID_REQUIRED');

  const senderNotRegistered = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'MISSING' },
    params: { eventType: 'm.room_key', txnId: 'txn2' },
    body: { messages: { bob: { B1: { key: 'abc' } } } }
  });
  assert('Unknown sender device is rejected', senderNotRegistered.statusCode === 403 && senderNotRegistered.body?.error === 'SENDER_DEVICE_NOT_REGISTERED');

  const invalidShape = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn3' },
    body: { messages: { bob: { B1: { key: 'a' }, B2: { key: 'b' } } } }
  });
  assert('Multiple target devices in one request are rejected', invalidShape.statusCode === 400 && invalidShape.body?.error === 'SINGLE_TARGET_DEVICE_REQUIRED');

  const recipientMissing = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn4' },
    body: { messages: { ghost: { B1: { key: 'abc' } } } }
  });
  assert('Unknown recipient user is rejected', recipientMissing.statusCode === 404 && recipientMissing.body?.error === 'RECIPIENT_NOT_FOUND');

  const okSend = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn-ok' },
    body: { messages: { bob: { B1: { room_id: '!r:server', session_id: 's1' } } } }
  });
  assert('Authorized sender can deliver to one registered target device', okSend.statusCode === 200 && okSend.body?.ok === true && okSend.body?.recipientDeviceId === 'B1');
  assert('To-device payload is emitted only to exact target room', emitted.some((e) => e.room === 'device:bob:B1' && e.event === 'keys:to_device'));

  const duplicateTxn = await invoke(router, '/to-device/:eventType/:txnId', 'post', {
    headers: { 'x-test-user': 'alice', 'x-device-id': 'A1' },
    params: { eventType: 'm.room_key', txnId: 'txn-ok' },
    body: { messages: { bob: { B1: { room_id: '!r:server', session_id: 's1' } } } }
  });
  assert('Duplicate transaction ID is idempotent', duplicateTxn.statusCode === 200 && duplicateTxn.body?.idempotent === true);

  assert('Private validator rejects unsupported event types', __private.validEventType('m.bad.event') === false);
  assert('Private parser accepts single user/device content', !__private.parseMessageEntries({ bob: { B1: { a: 1 } } }).error);

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

run().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});
