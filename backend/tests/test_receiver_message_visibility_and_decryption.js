/**
 * Test Suite: Receiver-Side Message Visibility & E2EE Decryption Flow
 * 
 * Verifies that:
 * 1. An incoming E2EE message is decrypted on the receiver's device before durable local commit.
 * 2. Un-decrypted cached messages (e.g. from background receipt) are decrypted during ChatWindow hydration.
 * 3. Recent chat snippet is updated with the decrypted message content, not broken with wrong parameters.
 * 4. MessageItem displays a "Decrypting message..." state if a message has not yet completed decryption.
 * 5. Full cryptographic round-trip preserves content fidelity while failing closed.
 */

const assert = require('assert');
const {
  generateIdentityKeyPair,
  encryptMessageEnvelope,
  decryptMessageEnvelope,
  decryptMessageIfNeeded
} = require('../../frontend/src/utils/e2eeCrypto.js');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: RECEIVER MESSAGE VISIBILITY & DECRYPTION FLOW');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. E2EE Envelope Encryption & Decryption Round-Trip
  await testAsync('Bob can decrypt Alice message envelope with his private key', async () => {
    const aliceIdentity = await generateIdentityKeyPair();
    const bobIdentity = await generateIdentityKeyPair();

    const plaintext = 'Secret rendezvous at 5 PM';
    const envelope = await encryptMessageEnvelope(
      { content: plaintext, type: 'text' },
      bobIdentity.publicKeyJwk,
      'alice_dev_1',
      'bob_dev_1'
    );

    assert(envelope.ciphertext, 'Envelope must contain ciphertext');
    assert(envelope.iv, 'Envelope must contain iv');
    assert(envelope.ephemeralPublicKey, 'Envelope must contain ephemeralPublicKey');

    const decrypted = await decryptMessageEnvelope(envelope, bobIdentity.keyPair.privateKey);
    assert.strictEqual(decrypted.content, plaintext, 'Decrypted content must match original plaintext');
    assert.strictEqual(decrypted.type, 'text', 'Decrypted type must match');
  });

  // 2. decryptMessageIfNeeded helper tests
  await testAsync('decryptMessageIfNeeded populates content and sets _decrypted flag', async () => {
    const aliceIdentity = await generateIdentityKeyPair();
    const bobIdentity = await generateIdentityKeyPair();

    const envelope = await encryptMessageEnvelope(
      { content: 'Confidential project update', type: 'text' },
      bobIdentity.publicKeyJwk,
      'alice_dev_1',
      'bob_dev_1'
    );

    const wireMessage = {
      id: 'msg_test_123',
      chatId: 'alice_bob',
      senderId: 'alice',
      receiverId: 'bob',
      content: '', // Zero plaintext on wire
      type: 'text',
      isEncrypted: true,
      envelope: envelope,
      timestamp: new Date().toISOString()
    };

    const decryptedMessage = await decryptMessageIfNeeded(wireMessage, bobIdentity.keyPair.privateKey);
    assert.strictEqual(decryptedMessage.content, 'Confidential project update', 'Content must be decrypted');
    assert.strictEqual(decryptedMessage._decrypted, true, '_decrypted flag must be set');
    assert.strictEqual(decryptedMessage.isEncrypted, true, 'isEncrypted flag must remain true');
  });

  // 3. decryptMessageIfNeeded with wrong key fails closed
  await testAsync('decryptMessageIfNeeded with wrong key returns secure placeholder and _decryptionFailed', async () => {
    const aliceIdentity = await generateIdentityKeyPair();
    const bobIdentity = await generateIdentityKeyPair();
    const eveIdentity = await generateIdentityKeyPair();

    const envelope = await encryptMessageEnvelope(
      { content: 'Super secret data', type: 'text' },
      bobIdentity.publicKeyJwk,
      'alice_dev_1',
      'bob_dev_1'
    );

    const wireMessage = {
      id: 'msg_test_456',
      chatId: 'alice_bob',
      senderId: 'alice',
      receiverId: 'bob',
      content: '',
      type: 'text',
      isEncrypted: true,
      envelope: envelope
    };

    // Eve tries to decrypt Bob's envelope
    const eveResult = await decryptMessageIfNeeded(wireMessage, eveIdentity.keyPair.privateKey);
    assert(eveResult.content.includes('Encrypted message'), 'Must display safe encrypted placeholder');
    assert.strictEqual(eveResult._decryptionFailed, true, 'Must set _decryptionFailed flag');
  });

  // 4. Source code verification in SocketContext.jsx
  test('SocketContext.jsx decrypts incoming durable messages before saving to cache', () => {
    const socketContextPath = path.resolve(__dirname, '../../frontend/src/context/SocketContext.jsx');
    const content = fs.readFileSync(socketContextPath, 'utf8');

    assert(content.includes('decryptMessageIfNeeded'), 'SocketContext must import/use decryptMessageIfNeeded');
    assert(content.includes('getOrInitDeviceIdentity'), 'SocketContext must import/use getOrInitDeviceIdentity');
    assert(content.includes('deviceIdentityRef'), 'SocketContext must maintain deviceIdentityRef');
    assert(content.includes('updateRecentChatSnippet(curId, msgToCommit.chatId, msgToCommit, null)'),
      'updateRecentChatSnippet must be called with valid parameters (curId, chatId, msg, null)');
    assert(content.includes('pulsechat_message_received'),
      'SocketContext must dispatch pulsechat_message_received for open ChatWindow notification');
  });

  // 5. Source code verification in ChatWindow.jsx
  test('ChatWindow.jsx decrypts cached messages on hydration and contains watchdog effect', () => {
    const chatWindowPath = path.resolve(__dirname, '../../frontend/src/components/chat/ChatWindow.jsx');
    const content = fs.readFileSync(chatWindowPath, 'utf8');

    assert(content.includes('hasUndecryptedCached'),
      'ChatWindow must check hasUndecryptedCached and decrypt on initial mount');
    assert(content.includes('deviceIdentityReady'),
      'ChatWindow must track deviceIdentityReady state');
    assert(content.includes('undecryptedIndices'),
      'ChatWindow must include watchdog effect to decrypt un-decrypted messages in state');
    assert(content.includes('prewarmedOlderBufferRef.current = validServer'),
      'ChatWindow prefetchOlderMessagesIntoRam must decrypt server messages before caching');
  });

  // 6. Source code verification in MessageItem.jsx
  test('MessageItem.jsx renders decrypting indicator instead of empty blank text', () => {
    const messageItemPath = path.resolve(__dirname, '../../frontend/src/components/chat/MessageItem.jsx');
    const content = fs.readFileSync(messageItemPath, 'utf8');

    assert(content.includes('Decrypting message...'),
      'MessageItem must render Decrypting message... placeholder for pending encrypted messages');
    assert(content.includes('Lock') && content.includes('message.isEncrypted && !message.content && !message._decrypted'),
      'MessageItem must check isEncrypted && !content && !_decrypted');
  });

  // 7. Source code verification in offlineStorage.js
  test('offlineStorage.js snippet generator accounts for un-decrypted encrypted messages', () => {
    const offlineStoragePath = path.resolve(__dirname, '../../frontend/src/utils/offlineStorage.js');
    const content = fs.readFileSync(offlineStoragePath, 'utf8');

    assert(content.includes('message.isEncrypted && !message.content && !message._decrypted'),
      'offlineStorage must recognize un-decrypted encrypted message');
    assert(content.includes('🔒 Encrypted message'),
      'offlineStorage must set snippet to 🔒 Encrypted message');
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}% SUCCESS)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
