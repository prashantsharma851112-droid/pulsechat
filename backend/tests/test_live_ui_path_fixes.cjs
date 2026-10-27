const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser globals
const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.window = {
  dispatchEvent: () => {},
  __pulsechat_active_chat_id: null,
  __pulsechat_active_chat: null
};
global.document = {
  visibilityState: 'visible',
  hidden: false
};

async function main() {
  console.log('=== RUNNING TARGETED VERIFICATION FOR 4 DEFECTS & CONVERSATION INTEGRITY ===\n');

  // Load offlineStorage in Node ESM via wrapper
  const srcPath = path.resolve(__dirname, '../../frontend/src/utils/offlineStorage.js');
  let code = fs.readFileSync(srcPath, 'utf8');
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*localDatabase['"];?/g, 'const saveMessagesToLocalDb = async () => {}; const deleteMessagesFromLocalDb = async () => {};');

  const tempPath = path.resolve(__dirname, '_temp_offlineStorage_test.mjs');
  fs.writeFileSync(tempPath, code, 'utf8');

  // Load matchesConversation & getPeerKeyErrorMessage from ChatWindow
  const chatWindowPath = path.resolve(__dirname, '../../frontend/src/components/chat/ChatWindow.jsx');
  const chatWindowCode = fs.readFileSync(chatWindowPath, 'utf8');
  const matchesConvMatch = chatWindowCode.match(/export function matchesConversation\([\s\S]*?\n\}/);
  const getPeerKeyErrMatch = chatWindowCode.match(/export function getPeerKeyErrorMessage\([\s\S]*?\n\}/);

  const tempChatWindowPath = path.resolve(__dirname, '_temp_chatWindow_test.mjs');
  fs.writeFileSync(tempChatWindowPath, `${matchesConvMatch[0]}\n\n${getPeerKeyErrMatch[0]}`, 'utf8');

  const {
    updateRecentChatSnippet,
    clearUnreadCount,
    resolveNextMessageStatus,
    getCachedRecentChats,
    setCachedRecentChats
  } = await import('file:///' + tempPath.replace(/\\/g, '/'));

  const { matchesConversation, getPeerKeyErrorMessage } = await import('file:///' + tempChatWindowPath.replace(/\\/g, '/'));

  // Clean up temp files on exit
  const cleanup = () => {
    try { fs.unlinkSync(tempPath); } catch (_) {}
    try { fs.unlinkSync(tempChatWindowPath); } catch (_) {}
  };

  try {
    // -------------------------------------------------------------
    // Verification 1: Two incoming messages increment unread count correctly
    // -------------------------------------------------------------
    console.log('--- Verification 1: Two incoming messages increment unread count correctly ---');
    const userAliceId = 'user_alice_123';
    const userBobId = 'user_bob_456';
    const directChatId = [userAliceId, userBobId].sort().join('::');

    // Bob sends message 1 to Alice (Alice is not viewing)
    const msg1 = {
      id: 'msg_001',
      clientTempId: 'tmp_001',
      chatId: directChatId,
      senderId: userBobId,
      senderName: 'Bob',
      senderUsername: 'bob_the_builder',
      content: 'Hello Alice, message 1',
      timestamp: new Date(Date.now() - 5000).toISOString(),
      status: 'sent'
    };

    updateRecentChatSnippet(userAliceId, directChatId, msg1, null, { isViewing: false, increment: true });
    let recentAlice = getCachedRecentChats(userAliceId);
    assert.strictEqual(recentAlice.length, 1, 'Should have 1 recent chat');
    assert.strictEqual(recentAlice[0].unreadCount, 1, 'Unread count should be 1 after message 1');
    assert.strictEqual(recentAlice[0].lastMessage, 'Hello Alice, message 1');
    console.log('✅ Message 1 correctly created recent chat with unreadCount = 1');

    // Bob sends message 2 to Alice (Alice still not viewing)
    const msg2 = {
      id: 'msg_002',
      clientTempId: 'tmp_002',
      chatId: directChatId,
      senderId: userBobId,
      senderName: 'Bob',
      senderUsername: 'bob_the_builder',
      content: 'Hello Alice, message 2',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    updateRecentChatSnippet(userAliceId, directChatId, msg2, null, { isViewing: false, increment: true });
    recentAlice = getCachedRecentChats(userAliceId);
    assert.strictEqual(recentAlice.length, 1, 'Should still have 1 recent chat');
    assert.strictEqual(recentAlice[0].unreadCount, 2, 'Unread count should be 2 after message 2');
    assert.strictEqual(recentAlice[0].lastMessage, 'Hello Alice, message 2');
    console.log('✅ Message 2 correctly incremented unreadCount to 2');

    // -------------------------------------------------------------
    // Verification 2: Duplicate / replayed incoming events do not double-increment
    // -------------------------------------------------------------
    console.log('\n--- Verification 2: Duplicate/replayed incoming events do not double-increment ---');
    // Replay message 2 (same message ID and clientTempId)
    updateRecentChatSnippet(userAliceId, directChatId, msg2, null, { isViewing: false, increment: true });
    recentAlice = getCachedRecentChats(userAliceId);
    assert.strictEqual(recentAlice[0].unreadCount, 2, 'Unread count MUST remain 2 on replayed duplicate message');
    console.log('✅ Replaying msg2 kept unreadCount at 2 without double-incrementing');

    // -------------------------------------------------------------
    // Verification 3: Opening a chat clears/updates unread state correctly
    // -------------------------------------------------------------
    console.log('\n--- Verification 3: Opening a chat clears unread count ---');
    // Alice opens the chat with Bob
    clearUnreadCount(userAliceId, userBobId);
    recentAlice = getCachedRecentChats(userAliceId);
    assert.strictEqual(recentAlice[0].unreadCount, 0, 'Unread count should be reset to 0 after opening chat');
    console.log('✅ clearUnreadCount reset unreadCount to 0 for opened chat');

    // Bob sends message 3 while Alice IS viewing
    const msg3 = {
      id: 'msg_003',
      clientTempId: 'tmp_003',
      chatId: directChatId,
      senderId: userBobId,
      senderName: 'Bob',
      senderUsername: 'bob_the_builder',
      content: 'Are you there Alice?',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    updateRecentChatSnippet(userAliceId, directChatId, msg3, null, { isViewing: true, increment: false });
    recentAlice = getCachedRecentChats(userAliceId);
    assert.strictEqual(recentAlice[0].unreadCount, 0, 'Unread count remains 0 when viewing active conversation');
    console.log('✅ New message while viewing correctly preserved unreadCount = 0');

    // -------------------------------------------------------------
    // Verification 4: Reconnect delivery recovery updates correct conversation's tick
    // -------------------------------------------------------------
    console.log('\n--- Verification 4: Reconnect delivery recovery & monotonic status ---');
    const canonicalId = [userAliceId, userBobId].sort().join('::');
    const isMatched = matchesConversation(canonicalId, canonicalId, {
      isGroup: false,
      activeChatId: userBobId,
      activeChat: { id: userBobId, username: 'bob_the_builder' },
      currentUserId: userAliceId,
      user: { id: userAliceId },
      chatId: directChatId,
      partnerId: userBobId
    });
    assert.strictEqual(isMatched, true, 'matchesConversation MUST match unambiguous canonical :: chatId');
    console.log('✅ matchesConversation successfully matched unambiguous canonical "::" ID');

    // Ensure another conversation does NOT match
    const userEveId = 'user_eve_789';
    const isEveMatched = matchesConversation(canonicalId, canonicalId, {
      isGroup: false,
      activeChatId: userEveId,
      activeChat: { id: userEveId, username: 'eve' },
      currentUserId: userAliceId,
      user: { id: userAliceId },
      chatId: [userAliceId, userEveId].sort().join('::'),
      partnerId: userEveId
    });
    assert.strictEqual(isEveMatched, false, 'Eve conversation must NOT match Bob and Alice conversation');
    console.log('✅ Eve conversation isolated: does NOT match Bob and Alice conversation');

    // Monotonic status progression
    assert.strictEqual(resolveNextMessageStatus('pending', 'delivered'), 'delivered');
    assert.strictEqual(resolveNextMessageStatus('sent', 'delivered'), 'delivered');
    assert.strictEqual(resolveNextMessageStatus('delivered', 'read'), 'read');
    assert.strictEqual(resolveNextMessageStatus('read', 'delivered'), 'read', 'read status must NEVER downgrade to delivered');
    console.log('✅ Monotonic status progression verified: read is strictly terminal');

    // -------------------------------------------------------------
    // Verification 5: Collision test remains passing with '::' identities
    // -------------------------------------------------------------
    console.log('\n--- Verification 5: Collision test with :: identities ---');
    // User "user" & "a_b" vs User "user_a" & "b"
    const userA1 = 'user';
    const userB1 = 'a_b';
    const pair1 = [userA1, userB1].sort().join('::');

    const userA2 = 'user_a';
    const userB2 = 'b';
    const pair2 = [userA2, userB2].sort().join('::');

    assert.notStrictEqual(pair1, pair2, 'Pair 1 and Pair 2 MUST NOT collide under "::"');
    console.log(`Pair 1: ${pair1}`);
    console.log(`Pair 2: ${pair2}`);
    console.log('✅ Zero collision between compound usernames under "::" delimiter');

    // -------------------------------------------------------------
    // Verification 6: Missing-key and NOT_CONTACTS failures are explicit
    // -------------------------------------------------------------
    console.log('\n--- Verification 6: Missing-key and NOT_CONTACTS error handling ---');
    const notContactsResult = getPeerKeyErrorMessage({ error: 'NOT_CONTACTS', status: 403 });
    assert.strictEqual(notContactsResult.errorCode, 'NOT_CONTACTS');
    assert.strictEqual(notContactsResult.toast.includes('Sync Request'), true);
    console.log(`✅ NOT_CONTACTS handled explicitly: "${notContactsResult.toast}"`);

    const blockedResult = getPeerKeyErrorMessage({ error: 'BLOCKED', status: 403 });
    assert.strictEqual(blockedResult.errorCode, 'BLOCKED');
    assert.strictEqual(blockedResult.toast.includes('blocked'), true);
    console.log(`✅ BLOCKED handled explicitly: "${blockedResult.toast}"`);

    const noKeysResult = getPeerKeyErrorMessage({ error: 'NO_ACTIVE_KEYS', status: 200 });
    assert.strictEqual(noKeysResult.errorCode, 'NO_ACTIVE_KEYS');
    assert.strictEqual(noKeysResult.toast.includes('Waiting for recipient E2EE key'), true);
    console.log(`✅ NO_ACTIVE_KEYS handled explicitly: "${noKeysResult.toast}"`);

    const networkErrResult = getPeerKeyErrorMessage({ error: 'NETWORK_ERROR', status: 0 });
    assert.strictEqual(networkErrResult.errorCode, 'NETWORK_ERROR');
    assert.strictEqual(networkErrResult.toast.includes('Network error'), true);
    console.log(`✅ NETWORK_ERROR handled explicitly: "${networkErrResult.toast}"`);

    console.log('\n=============================================');
    console.log('ALL TARGETED VERIFICATIONS PASSED (6/6)');
    console.log('=============================================');
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
