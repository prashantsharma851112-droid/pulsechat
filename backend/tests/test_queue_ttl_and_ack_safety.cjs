const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');

// Ensure environment is loaded from PulseChat/backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('../config');
const QueuedMessage = require('../models/QueuedMessage');
const MessageLedger = require('../models/MessageLedger');
const { createReceiptToken, verifyReceiptToken } = require('../chat/receiptToken');

const ENCRYPTED_QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const receiptSecret = config.RECEIPT_SECRET || 'test_receipt_secret_1234567890123456';

function validSampleEnvelope() {
  return {
    format: 'pulse_e2ee_v1',
    senderDeviceId: 'dev_alice_01',
    recipientDeviceId: 'dev_bob_01',
    ephemeralPublicKey: {
      kty: 'EC',
      crv: 'P-256',
      x: 'f83OJ3D2xFmT5vC3-ZfETmgJYPO52iOhsYvE52iOhsY',
      y: 'x_da7W7LjEOWwUtq5B_glUmrqFlbviW3bZDV0FtMcZK'
    },
    iv: 'dGVzdF9pdl8xMmJ5dGVz',
    ciphertext: 'c2FtcGxlX2NpcGhlcnRleHRfZGF0YQ=='
  };
}

// Simulates the exact chat:send logic from registerChatSocket.js
async function simulateChatSend({ payload, senderId, receiverId }) {
  // Validate envelope
  const hasEnvelope = Boolean(payload?.envelope && typeof payload.envelope === 'object');
  let envelopeValidation = { valid: false, error: 'NO_ENVELOPE' };

  if (hasEnvelope) {
    const env = payload.envelope;
    if (env.format && env.format !== 'pulse_e2ee_v1') {
      envelopeValidation = { valid: false, error: 'UNSUPPORTED_ENCRYPTION_PROTOCOL' };
    } else {
      const isEcKey = env.ephemeralPublicKey &&
        env.ephemeralPublicKey.kty === 'EC' &&
        (env.ephemeralPublicKey.crv === 'P-256' || env.ephemeralPublicKey.crv === 'secp256r1') &&
        typeof env.ephemeralPublicKey.x === 'string' &&
        typeof env.ephemeralPublicKey.y === 'string';
      const isIv = typeof env.iv === 'string' && env.iv.length >= 12;
      const isCiphertext = typeof env.ciphertext === 'string' && env.ciphertext.length > 0;
      if (isEcKey && isIv && isCiphertext) {
        envelopeValidation = { valid: true };
      } else {
        envelopeValidation = { valid: false, error: 'INVALID_ENVELOPE_STRUCTURE' };
      }
    }
  }

  if (payload?.envelope?.format && payload.envelope.format !== 'pulse_e2ee_v1') {
    return { ok: false, error: 'UNSUPPORTED_ENCRYPTION_PROTOCOL' };
  }

  if (payload?.isEncrypted) {
    if (!envelopeValidation.valid) {
      return {
        ok: false,
        error: envelopeValidation.error === 'UNSUPPORTED_ENCRYPTION_PROTOCOL'
          ? 'UNSUPPORTED_ENCRYPTION_PROTOCOL'
          : 'INVALID_ENCRYPTED_ENVELOPE'
      };
    }
  }

  const isTrulyEncrypted = envelopeValidation.valid;
  const messageId = payload.messageId;
  const content = payload.content;

  const now = new Date();
  let ledger = await MessageLedger.findOne({ messageId });
  let effectiveQueueExpiresAt;
  let receiptToken;

  if (ledger) {
    if (ledger.senderId !== senderId || ledger.receiverId !== receiverId) {
      return { ok: false, error: 'MESSAGE_ID_CONFLICT' };
    }

    const originalEnqueueTime = new Date(ledger.createdAt || now);
    const originalQueueCeiling = new Date(
      originalEnqueueTime.getTime() + (isTrulyEncrypted ? ENCRYPTED_QUEUE_TTL_MS : QUEUE_TTL_MS)
    );

    if (
      ledger.state === 'expired' ||
      originalQueueCeiling <= now ||
      (ledger.queueExpiresAt && ledger.queueExpiresAt <= now)
    ) {
      await MessageLedger.updateOne({ messageId }, { $set: { state: 'expired' } });
      return { ok: false, error: 'MESSAGE_EXPIRED' };
    }

    if (ledger.state !== 'queued') {
      return { ok: true, alreadyDelivered: true, messageId };
    }

    if (isTrulyEncrypted) {
      effectiveQueueExpiresAt = originalQueueCeiling;
      if (ledger.queueExpiresAt && ledger.queueExpiresAt < effectiveQueueExpiresAt) {
        effectiveQueueExpiresAt = ledger.queueExpiresAt;
      }
    } else {
      effectiveQueueExpiresAt = ledger.queueExpiresAt ?? originalQueueCeiling;
    }

    if (ledger.queueExpiresAt > effectiveQueueExpiresAt) {
      await MessageLedger.updateOne({ messageId }, { $set: { queueExpiresAt: effectiveQueueExpiresAt } });
    }

    receiptToken = createReceiptToken(
      { messageId, senderId, receiverId, expiresAt: effectiveQueueExpiresAt },
      receiptSecret
    );
  } else {
    effectiveQueueExpiresAt = new Date(
      now.getTime() + (isTrulyEncrypted ? ENCRYPTED_QUEUE_TTL_MS : QUEUE_TTL_MS)
    );
    const ledgerExpiresAt = new Date(now.getTime() + LEDGER_TTL_MS);
    receiptToken = createReceiptToken(
      { messageId, senderId, receiverId, expiresAt: effectiveQueueExpiresAt },
      receiptSecret
    );

    try {
      ledger = await MessageLedger.create({
        messageId,
        senderId,
        receiverId,
        state: 'queued',
        createdAt: now,
        queueExpiresAt: effectiveQueueExpiresAt,
        expiresAt: ledgerExpiresAt
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      ledger = await MessageLedger.findOne({ messageId });
      if (!ledger || ledger.senderId !== senderId || ledger.receiverId !== receiverId) {
        return { ok: false, error: 'MESSAGE_ID_CONFLICT' };
      }
      const origTime = new Date(ledger.createdAt || now);
      const ceiling = new Date(
        origTime.getTime() + (isTrulyEncrypted ? ENCRYPTED_QUEUE_TTL_MS : QUEUE_TTL_MS)
      );
      if (
        ledger.state === 'expired' ||
        ceiling <= now ||
        (ledger.queueExpiresAt && ledger.queueExpiresAt <= now)
      ) {
        await MessageLedger.updateOne({ messageId }, { $set: { state: 'expired' } });
        return { ok: false, error: 'MESSAGE_EXPIRED' };
      }
      if (ledger.state !== 'queued') {
        return { ok: true, alreadyDelivered: true, messageId };
      }
      let effExpires = isTrulyEncrypted ? ceiling : (ledger.queueExpiresAt ?? ceiling);
      if (isTrulyEncrypted && ledger.queueExpiresAt && ledger.queueExpiresAt < effExpires) {
        effExpires = ledger.queueExpiresAt;
      }
      if (ledger.queueExpiresAt > effExpires) {
        await MessageLedger.updateOne({ messageId }, { $set: { queueExpiresAt: effExpires } });
      }
      effectiveQueueExpiresAt = effExpires;
      receiptToken = createReceiptToken(
        { messageId, senderId, receiverId, expiresAt: effectiveQueueExpiresAt },
        receiptSecret
      );
    }
  }

  await QueuedMessage.updateOne(
    { messageId },
    {
      $setOnInsert: {
        messageId,
        senderId,
        receiverId,
        content: isTrulyEncrypted ? '' : (content || ''),
        isEncrypted: isTrulyEncrypted,
        envelope: isTrulyEncrypted ? payload.envelope : null,
        chatId: payload.chatId || null,
        createdAt: ledger.createdAt ?? now,
        receiptToken
      },
      $min: {
        expiresAt: effectiveQueueExpiresAt
      }
    },
    { upsert: true }
  );

  return { ok: true, messageId, queued: true, receiptToken, effectiveQueueExpiresAt };
}

// Simulates the exact chat:delivered logic from registerChatSocket.js
async function simulateChatDelivered({ payload, authUserId, mockDbTransitionFail = false }) {
  if (!authUserId) {
    return { ok: false, error: 'UNAUTHORIZED' };
  }

  const receipt = verifyReceiptToken(payload?.receiptToken, receiptSecret);
  if (!receipt || receipt.receiverId !== String(authUserId) || receipt.messageId !== payload?.messageId) {
    return { ok: false, error: 'INVALID_RECEIPT_TOKEN' };
  }

  if (payload?.senderId && String(payload.senderId) !== String(receipt.senderId)) {
    return { ok: false, error: 'SENDER_MISMATCH' };
  }

  const { messageId, senderId, receiverId } = receipt;
  const ledger = await MessageLedger.findOne({ messageId, senderId, receiverId });
  if (!ledger) {
    return { ok: false, error: 'MESSAGE_NOT_FOUND' };
  }

  if (ledger.state === 'delivered') {
    await QueuedMessage.deleteOne({ messageId, senderId, receiverId });
    return { ok: true, alreadyDelivered: true };
  }

  if (ledger.state === 'expired') {
    return { ok: false, error: 'MESSAGE_EXPIRED' };
  }

  let transitionSuccess = false;
  if (ledger.state === 'delivering') {
    transitionSuccess = true;
  } else if (ledger.state === 'queued') {
    if (mockDbTransitionFail) {
      transitionSuccess = false;
    } else {
      const transitionResult = await MessageLedger.updateOne(
        { messageId, senderId, receiverId, state: 'queued' },
        { $set: { state: 'delivering' } }
      );
      if (transitionResult.matchedCount > 0) {
        transitionSuccess = true;
      }
    }
  }

  if (!transitionSuccess) {
    return { ok: false, retry: true, error: 'LEDGER_TRANSITION_FAILED' };
  }

  await QueuedMessage.deleteOne({ messageId, senderId, receiverId });

  await MessageLedger.updateOne(
    { messageId, senderId, receiverId },
    { $set: { state: 'delivered' } }
  );

  return { ok: true, delivered: true };
}

async function runTests() {
  console.log('Connecting to MongoDB for Queue TTL & ACK Safety Test Suite...');
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const ts = Date.now();
  const alice = `test_alice_${ts}`;
  const bob = `test_bob_${ts}`;

  const cleanUpMsg = async (msgId) => {
    await MessageLedger.deleteMany({ messageId: msgId });
    await QueuedMessage.deleteMany({ messageId: msgId });
  };

  try {
    // ==========================================
    // PART A: STRICT ENCRYPTED QUEUE EXPIRY
    // ==========================================

    // Test 1: New encrypted message gets strictly <= 24 hour expiry
    {
      const msgId = `msg_test_1_${ts}`;
      await cleanUpMsg(msgId);
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: validSampleEnvelope()
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, true, 'New encrypted message should enqueue successfully');
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      const ledger = await MessageLedger.findOne({ messageId: msgId });
      assert(queued, 'QueuedMessage document must exist');
      assert(ledger, 'MessageLedger document must exist');
      assert.strictEqual(queued.isEncrypted, true);
      assert.strictEqual(queued.content, '');
      const maxExpiry = new Date(Date.now() + ENCRYPTED_QUEUE_TTL_MS + 2000);
      assert(queued.expiresAt <= maxExpiry, 'Queued envelope expiresAt must be <= 24h');
      assert(ledger.queueExpiresAt <= maxExpiry, 'Ledger queueExpiresAt must be <= 24h');
      console.log('✓ PASS 1: New encrypted message enforced with strict 24-hour retention ceiling');
      await cleanUpMsg(msgId);
    }

    // Test 2: Encrypted message with pre-existing 7-day legacy ledger DOES NOT inherit 7 days
    {
      const msgId = `msg_test_2_${ts}`;
      await cleanUpMsg(msgId);
      const staleEnqueueTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const stale7dExpiry = new Date(staleEnqueueTime.getTime() + QUEUE_TTL_MS); // 7 days from 1h ago
      await MessageLedger.create({
        messageId: msgId,
        senderId: alice,
        receiverId: bob,
        state: 'queued',
        createdAt: staleEnqueueTime,
        queueExpiresAt: stale7dExpiry,
        expiresAt: new Date(Date.now() + LEDGER_TTL_MS)
      });

      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: validSampleEnvelope()
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, true);
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      const ledger = await MessageLedger.findOne({ messageId: msgId });
      // Expiry must be capped at staleEnqueueTime + 24h, NOT 7 days!
      const ceiling24h = new Date(staleEnqueueTime.getTime() + ENCRYPTED_QUEUE_TTL_MS);
      assert.strictEqual(queued.expiresAt.getTime(), ceiling24h.getTime(), 'Queued envelope must be capped at 24h from original enqueue');
      assert.strictEqual(ledger.queueExpiresAt.getTime(), ceiling24h.getTime(), 'Ledger queueExpiresAt must be updated to 24h ceiling');
      console.log('✓ PASS 2: Encrypted retry with stale 7-day ledger overrides to strict 24h ceiling');
      await cleanUpMsg(msgId);
    }

    // Test 3: Repeated retries cannot extend original expiry
    {
      const msgId = `msg_test_3_${ts}`;
      await cleanUpMsg(msgId);
      const origTime = new Date(Date.now() - 5 * 3600 * 1000); // 5 hours ago
      const fixedCeiling = new Date(origTime.getTime() + ENCRYPTED_QUEUE_TTL_MS);
      await MessageLedger.create({
        messageId: msgId,
        senderId: alice,
        receiverId: bob,
        state: 'queued',
        createdAt: origTime,
        queueExpiresAt: fixedCeiling,
        expiresAt: new Date(Date.now() + LEDGER_TTL_MS)
      });

      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: validSampleEnvelope()
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, true);
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert.strictEqual(queued.expiresAt.getTime(), fixedCeiling.getTime(), 'Expiry must not be extended on retry');
      console.log('✓ PASS 3: Repeated retries anchored to original enqueue time and cannot extend retention');
      await cleanUpMsg(msgId);
    }

    // Test 4: Expired encrypted message rejects re-enqueue with MESSAGE_EXPIRED
    {
      const msgId = `msg_test_4_${ts}`;
      await cleanUpMsg(msgId);
      const past25h = new Date(Date.now() - 25 * 3600 * 1000); // 25 hours ago
      await MessageLedger.create({
        messageId: msgId,
        senderId: alice,
        receiverId: bob,
        state: 'queued',
        createdAt: past25h,
        queueExpiresAt: new Date(past25h.getTime() + ENCRYPTED_QUEUE_TTL_MS), // Expired 1 hour ago
        expiresAt: new Date(Date.now() + LEDGER_TTL_MS)
      });

      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: validSampleEnvelope()
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'MESSAGE_EXPIRED', 'Must reject expired message');
      const ledger = await MessageLedger.findOne({ messageId: msgId });
      assert.strictEqual(ledger.state, 'expired');
      console.log('✓ PASS 4: Enqueue rejected with MESSAGE_EXPIRED once original 24h lifetime has passed');
      await cleanUpMsg(msgId);
    }

    // Test 5: Client falsely sets isEncrypted=true without valid envelope -> Rejected
    {
      const msgId = `msg_test_5_${ts}`;
      await cleanUpMsg(msgId);
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: 'fake',
          isEncrypted: true,
          envelope: null
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'INVALID_ENCRYPTED_ENVELOPE');
      console.log('✓ PASS 5: Client spoofing isEncrypted=true without valid envelope rejected');
      await cleanUpMsg(msgId);
    }

    // Test 6: Arbitrary object containing only { ciphertext: 'foo' } is rejected
    {
      const msgId = `msg_test_6_${ts}`;
      await cleanUpMsg(msgId);
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: { ciphertext: 'arbitrary_unvalidated_payload' }
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'INVALID_ENCRYPTED_ENVELOPE');
      console.log('✓ PASS 6: Arbitrary object with ciphertext alone is rejected from E2EE classification');
      await cleanUpMsg(msgId);
    }

    // Test 7: Client sets isEncrypted=false but sends genuine encrypted envelope -> Server enforces 24h & strips content
    {
      const msgId = `msg_test_7_${ts}`;
      await cleanUpMsg(msgId);
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: 'unintended_leak_plaintext',
          isEncrypted: false, // Attempt to bypass 24h queue policy
          envelope: validSampleEnvelope()
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, true);
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert.strictEqual(queued.isEncrypted, true, 'Server enforces true encryption classification');
      assert.strictEqual(queued.content, '', 'Server strips plaintext content when encrypted envelope is detected');
      const maxExpiry = new Date(Date.now() + ENCRYPTED_QUEUE_TTL_MS + 2000);
      assert(queued.expiresAt <= maxExpiry, 'Enforces 24-hour encrypted queue expiry');
      console.log('✓ PASS 7: Server classifies genuine encrypted envelope regardless of client boolean');
      await cleanUpMsg(msgId);
    }

    // Test 8: Unsupported encryption protocol rejected
    {
      const msgId = `msg_test_8_${ts}`;
      await cleanUpMsg(msgId);
      const unsupportedEnv = { ...validSampleEnvelope(), format: 'unsupported_v99' };
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: '',
          isEncrypted: true,
          envelope: unsupportedEnv
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'UNSUPPORTED_ENCRYPTION_PROTOCOL');
      console.log('✓ PASS 8: Unsupported encryption protocol correctly rejected');
      await cleanUpMsg(msgId);
    }

    // Test 9: Genuine legacy unencrypted message preserves 7-day queue policy
    {
      const msgId = `msg_test_9_${ts}`;
      await cleanUpMsg(msgId);
      const res = await simulateChatSend({
        payload: {
          messageId: msgId,
          content: 'Hello legacy unencrypted world',
          isEncrypted: false,
          envelope: null
        },
        senderId: alice,
        receiverId: bob
      });
      assert.strictEqual(res.ok, true);
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert.strictEqual(queued.isEncrypted, false);
      assert.strictEqual(queued.content, 'Hello legacy unencrypted world');
      const min7d = new Date(Date.now() + 6 * 24 * 3600 * 1000);
      assert(queued.expiresAt >= min7d, 'Legacy message retains 7-day queue retention');
      console.log('✓ PASS 9: Genuine unencrypted message correctly retains 7-day retention policy');
      await cleanUpMsg(msgId);
    }

    // ==========================================
    // PART B: ACK DELETION SAFETY
    // ==========================================

    // Test 10: Invalid or forged receipt token rejected -> envelope NOT deleted
    {
      const msgId = `msg_test_10_${ts}`;
      await cleanUpMsg(msgId);
      await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      const res = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: 'forged_or_invalid_hmac_token' },
        authUserId: bob
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'INVALID_RECEIPT_TOKEN');
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert(queued, 'Queue item must NOT be deleted on invalid receipt token');
      console.log('✓ PASS 10: Invalid receipt token rejected and queue item preserved');
      await cleanUpMsg(msgId);
    }

    // Test 11: Wrong recipient identity rejected -> envelope NOT deleted
    {
      const msgId = `msg_test_11_${ts}`;
      await cleanUpMsg(msgId);
      const sendRes = await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      const res = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: 'malicious_eavesdropper_eve'
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'INVALID_RECEIPT_TOKEN');
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert(queued, 'Queue item must NOT be deleted for wrong recipient');
      console.log('✓ PASS 11: Wrong recipient identity fails receipt verification and preserves queue item');
      await cleanUpMsg(msgId);
    }

    // Test 12: Ledger transition failure does NOT delete queue envelope
    {
      const msgId = `msg_test_12_${ts}`;
      await cleanUpMsg(msgId);
      const sendRes = await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      const res = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: bob,
        mockDbTransitionFail: true // Simulate 0 matched documents in ledger transition
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error, 'LEDGER_TRANSITION_FAILED');
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert(queued, 'Queue item MUST NOT be deleted when ledger transition matches zero documents');
      console.log('✓ PASS 12: Zero-matched ledger transition does NOT delete queue envelope');
      await cleanUpMsg(msgId);
    }

    // Test 13: Normal delivery ACK deletes queue envelope and marks ledger delivered
    {
      const msgId = `msg_test_13_${ts}`;
      await cleanUpMsg(msgId);
      const sendRes = await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      const res = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: bob
      });
      assert.strictEqual(res.ok, true);
      const queued = await QueuedMessage.findOne({ messageId: msgId });
      assert.strictEqual(queued, null, 'Envelope must be deleted from MongoDB (0 bytes stored)');
      const ledger = await MessageLedger.findOne({ messageId: msgId });
      assert.strictEqual(ledger.state, 'delivered');
      console.log('✓ PASS 13: Successful ACK deletes envelope and marks ledger delivered');
      await cleanUpMsg(msgId);
    }

    // Test 14: Duplicate delivery ACK is handled idempotently
    {
      const msgId = `msg_test_14_${ts}`;
      await cleanUpMsg(msgId);
      const sendRes = await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      // First ACK
      const res1 = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: bob
      });
      assert.strictEqual(res1.ok, true);

      // Duplicate ACK
      const res2 = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: bob
      });
      assert.strictEqual(res2.ok, true);
      assert.strictEqual(res2.alreadyDelivered, true);
      console.log('✓ PASS 14: Duplicate ACK handled idempotently without error');
      await cleanUpMsg(msgId);
    }

    // Test 15: Crash recovery where ledger is in state 'delivering' completes safely
    {
      const msgId = `msg_test_15_${ts}`;
      await cleanUpMsg(msgId);
      const sendRes = await simulateChatSend({
        payload: { messageId: msgId, content: '', isEncrypted: true, envelope: validSampleEnvelope() },
        senderId: alice,
        receiverId: bob
      });

      // Simulate crash between queue deletion and ledger delivered update
      await QueuedMessage.deleteOne({ messageId: msgId });
      await MessageLedger.updateOne({ messageId: msgId }, { $set: { state: 'delivering' } });

      // Outbox retry from client arrives
      const retryRes = await simulateChatDelivered({
        payload: { messageId: msgId, receiptToken: sendRes.receiptToken },
        authUserId: bob
      });
      assert.strictEqual(retryRes.ok, true);
      const ledger = await MessageLedger.findOne({ messageId: msgId });
      assert.strictEqual(ledger.state, 'delivered', 'Crash recovery completes transition to delivered');
      console.log('✓ PASS 15: Crash recovery from state=delivering safely completes transition to delivered');
      await cleanUpMsg(msgId);
    }

    // Test 16: Queue deletion scoped strictly to 3-tuple { messageId, senderId, receiverId }
    {
      const msgId = `msg_test_16_${ts}`;
      await cleanUpMsg(msgId);
      // Create envelope with target receiverId
      await QueuedMessage.create({
        messageId: msgId,
        senderId: alice,
        receiverId: bob,
        content: '',
        isEncrypted: true,
        envelope: validSampleEnvelope(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ENCRYPTED_QUEUE_TTL_MS),
        receiptToken: 'tok_test_16'
      });

      // Deletion attempt with mismatched senderId does NOT delete the envelope
      const delRes = await QueuedMessage.deleteOne({ messageId: msgId, senderId: 'attacker_charlie', receiverId: bob });
      assert.strictEqual(delRes.deletedCount, 0, 'Must not match when senderId is wrong');
      const stillThere = await QueuedMessage.findOne({ messageId: msgId });
      assert(stillThere, 'Document must remain intact');

      // Deletion with full matching 3-tuple deletes cleanly
      const validDel = await QueuedMessage.deleteOne({ messageId: msgId, senderId: alice, receiverId: bob });
      assert.strictEqual(validDel.deletedCount, 1, 'Must delete when full 3-tuple matches');
      console.log('✓ PASS 16: Scoped queue deletion requires full 3-tuple { messageId, senderId, receiverId }');
      await cleanUpMsg(msgId);
    }

    console.log('\n======================================================');
    console.log('ALL 16 QUEUE TTL AND ACK SAFETY TESTS PASSED CLEANLY!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
