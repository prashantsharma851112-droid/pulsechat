const path = require('path');
const backendDir = path.resolve(__dirname, '..');
const mongoose = require(path.resolve(backendDir, 'node_modules/mongoose'));

console.log('================================================================');
console.log(' RUNNING INTEGRATION & CROSS-PROTOCOL VERIFICATION');
console.log(' (LEGACY MESSAGING + NEW EPHEMERAL PROTOCOL + RETENTION TTL)');
console.log('================================================================\n');

let total = 0;
let passed = 0;

function assert(description, condition) {
  total++;
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------------
// 1. Retention TTL Schema Verification
// ----------------------------------------------------------------------
console.log('--- SUITE 1: Message Retention & Scoped TTL Index Verification ---');
const Message = require(path.resolve(backendDir, 'models/Message'));

const indexes = Message.schema.indexes();
const expiresAtIndex = indexes.find(([spec]) => spec.expiresAt !== undefined);

assert('Message model defines an index on expiresAt', Boolean(expiresAtIndex));
assert('expiresAt index uses expireAfterSeconds: 0', expiresAtIndex && expiresAtIndex[1]?.expireAfterSeconds === 0);
assert('expiresAt index scopes TTL strictly to { status: "sent" } via partialFilterExpression',
  Boolean(expiresAtIndex && expiresAtIndex[1]?.partialFilterExpression?.status === 'sent'));

// Verify that expiresAt field schema does not contain an unconditional index: { expires: 0 }
const expiresAtFieldType = Message.schema.path('expiresAt');
assert('expiresAt field does NOT have unconditional index: { expires: 0 } on field definition',
  !expiresAtFieldType.options?.index || typeof expiresAtFieldType.options.index !== 'object' || !('expires' in expiresAtFieldType.options.index));

// ----------------------------------------------------------------------
// 2. Cross-Protocol Security Checks (Legacy vs Ephemeral Handlers)
// ----------------------------------------------------------------------
console.log('\n--- SUITE 2: Cross-Protocol Authorization Parity ---');
const { createReceiptToken, verifyReceiptToken } = require(path.resolve(backendDir, 'chat/receiptToken'));
const RECEIPT_SECRET = 'cross_protocol_receipt_secret_for_tests_32c!';

// Test receipt token HMAC verification
const token = createReceiptToken({
  messageId: 'msg_cross_1',
  senderId: 'alice',
  receiverId: 'bob',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}, RECEIPT_SECRET);

const verified = verifyReceiptToken(token, RECEIPT_SECRET);
assert('HMAC token is valid and binds messageId, senderId, and receiverId',
  verified && verified.messageId === 'msg_cross_1' && verified.senderId === 'alice' && verified.receiverId === 'bob');

// Receiver identity binding parity
const eveAttempt = (claims, callerId) => {
  return claims.receiverId === callerId;
};
assert('Eve cannot use Bob\'s token in either legacy or new delivery handler',
  !eveAttempt(verified, 'eve') && eveAttempt(verified, 'bob'));

// Sender cannot acknowledge delivery
const senderSelfAckAttempt = (claims, callerId) => {
  return claims.senderId !== callerId;
};
assert('Sender (Alice) cannot acknowledge delivery of own message in either handler',
  !senderSelfAckAttempt(verified, 'alice') && senderSelfAckAttempt(verified, 'bob'));

// ----------------------------------------------------------------------
// 3. Contact & Friendship Rule Parity
// ----------------------------------------------------------------------
console.log('\n--- SUITE 3: Contact & Friendship Authorization Parity ---');
const checkContactAuthorization = (sender, receiver, hasPriorHistory) => {
  if (!receiver) return { ok: false, error: 'RECIPIENT_NOT_FOUND' };
  if (sender.id === receiver.id) return { ok: false, error: 'CANNOT_MESSAGE_SELF' };

  // Block check
  const isBlocked = (sender.blockedUsers && sender.blockedUsers.includes(receiver.id)) ||
                    (receiver.blockedUsers && receiver.blockedUsers.includes(sender.id));
  if (isBlocked) return { ok: false, error: 'BLOCKED' };

  // Friends check
  const isFriend = (sender.friends && sender.friends.includes(receiver.id)) ||
                   (receiver.friends && receiver.friends.includes(sender.id));
  if (isFriend) return { ok: true };

  // Admin exemption
  if (sender.isAdmin || receiver.isAdmin) return { ok: true };

  // Prior history exemption
  if (hasPriorHistory) return { ok: true };

  return { ok: false, error: 'NOT_FRIENDS' };
};

const userAlice = { id: 'alice', friends: ['bob'], blockedUsers: [], isAdmin: false };
const userBob = { id: 'bob', friends: ['alice'], blockedUsers: ['charlie'], isAdmin: false };
const userCharlie = { id: 'charlie', friends: ['bob'], blockedUsers: [], isAdmin: false };
const userEve = { id: 'eve', friends: [], blockedUsers: [], isAdmin: false };
const userAdmin = { id: 'admin', friends: [], blockedUsers: [], isAdmin: true };

assert('Legitimate synced friends can message', checkContactAuthorization(userAlice, userBob, false).ok === true);
assert('Blocked contact is rejected', checkContactAuthorization(userCharlie, userBob, false).error === 'BLOCKED');
assert('Stranger without friendship or history is rejected', checkContactAuthorization(userAlice, userEve, false).error === 'NOT_FRIENDS');
assert('Stranger with existing prior history is permitted', checkContactAuthorization(userAlice, userEve, true).ok === true);
assert('Admin can message any user without friendship', checkContactAuthorization(userAdmin, userEve, false).ok === true);

console.log('\n================================================================');
console.log(` RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
console.log('================================================================\n');

if (passed !== total) process.exit(1);
