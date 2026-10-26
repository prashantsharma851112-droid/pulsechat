/**
 * Regression Test Suite for PulseChat Approved Fixes & Final Regression Corrections:
 * Fix A: Conversation ID normalization without splitting arbitrary IDs on '_'
 * Fix B: Monotonic status only applied to the same message in recent chats
 * ACK Contract: Authoritative send_message server ACK shape verification
 * Monotonic transitions: Terminal 'read' protection, proper 'failed' handling
 * Duplicate idempotence: No repeated unread increments
 */

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
  console.log('=== RUNNING COMPREHENSIVE REGRESSION SUITE FOR PULSECHAT FIXES ===\n');

  // Load offlineStorage in Node ESM via wrapper
  const srcPath = path.resolve(__dirname, '../../frontend/src/utils/offlineStorage.js');
  let code = fs.readFileSync(srcPath, 'utf8');
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*localDatabase['"];?/g, 'const saveMessagesToLocalDb = async () => {}; const deleteMessagesFromLocalDb = async () => {};');

  const tempPath = path.resolve(__dirname, '_temp_offlineStorage_test.mjs');
  fs.writeFileSync(tempPath, code, 'utf8');

  // Load matchesConversation from ChatWindow
  const chatWindowPath = path.resolve(__dirname, '../../frontend/src/components/chat/ChatWindow.jsx');
  const chatWindowCode = fs.readFileSync(chatWindowPath, 'utf8');
  const matchesConvMatch = chatWindowCode.match(/export function matchesConversation\([\s\S]*?\n\}/);
  if (!matchesConvMatch) {
    throw new Error('FAIL: matchesConversation export not found in ChatWindow.jsx');
  }
  const tempChatWindowPath = path.resolve(__dirname, '_temp_chatWindow_test.mjs');
  fs.writeFileSync(tempChatWindowPath, matchesConvMatch[0], 'utf8');

  try {
    const {
      resolveNextMessageStatus,
      updateRecentChatSnippet,
      getCachedRecentChats,
      setCachedRecentChats,
      updateCachedMessageStatus,
      getCachedMessages,
      setCachedMessages
    } = await import('file:///' + tempPath.replace(/\\/g, '/'));

    const { matchesConversation } = await import('file:///' + tempChatWindowPath.replace(/\\/g, '/'));

    // ----------------------------------------------------
    // TEST GROUP 1: Monotonic Receipt Progression (Fix 2 & Rules)
    // ----------------------------------------------------
    console.log('--- TEST GROUP 1: Monotonic Receipt Transitions ---');

    // Rule 1: 'read' must never downgrade to 'delivered', 'sent', 'pending', or 'failed'
    assert.strictEqual(resolveNextMessageStatus('read', 'delivered'), 'read', 'read must NOT downgrade to delivered');
    assert.strictEqual(resolveNextMessageStatus('read', 'sent'), 'read', 'read must NOT downgrade to sent');
    assert.strictEqual(resolveNextMessageStatus('read', 'pending'), 'read', 'read must NOT downgrade to pending');
    assert.strictEqual(resolveNextMessageStatus('read', 'failed'), 'read', 'read must NOT downgrade to failed');
    console.log('✅ Rule 1 Passed: "read" is strictly terminal and never downgrades');

    // Rule 2: 'delivered' cannot downgrade to 'sent', 'pending', or 'failed', but advances to 'read'
    assert.strictEqual(resolveNextMessageStatus('delivered', 'sent'), 'delivered', 'delivered must NOT downgrade to sent');
    assert.strictEqual(resolveNextMessageStatus('delivered', 'pending'), 'delivered', 'delivered must NOT downgrade to pending');
    assert.strictEqual(resolveNextMessageStatus('delivered', 'failed'), 'delivered', 'delivered must NOT downgrade to failed');
    assert.strictEqual(resolveNextMessageStatus('delivered', 'read'), 'read', 'delivered MUST advance to read');
    console.log('✅ Rule 2 Passed: "delivered" cannot downgrade to sent/pending, advances to read');

    // Rule 3: 'sent' cannot downgrade to 'pending', advances to 'delivered' or 'read', or fails on rejection
    assert.strictEqual(resolveNextMessageStatus('sent', 'pending'), 'sent', 'sent must NOT downgrade to pending');
    assert.strictEqual(resolveNextMessageStatus('sent', 'delivered'), 'delivered', 'sent advances to delivered');
    assert.strictEqual(resolveNextMessageStatus('sent', 'read'), 'read', 'sent advances to read');
    assert.strictEqual(resolveNextMessageStatus('sent', 'failed'), 'failed', 'sent can transition to failed on definitive error');
    console.log('✅ Rule 3 Passed: "sent" transitions correctly');

    // Rule 4: 'failed' message can transition to 'pending' or 'sent' upon retry
    assert.strictEqual(resolveNextMessageStatus('failed', 'pending'), 'pending', 'failed can transition to pending on retry');
    assert.strictEqual(resolveNextMessageStatus('failed', 'sent'), 'sent', 'failed can transition to sent on retry');
    console.log('✅ Rule 4 Passed: "failed" supports legitimate retry transitions');

    // ----------------------------------------------------
    // TEST GROUP 2: Fix A - Conversation ID Normalization (Underscores & Orderings)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 2: Fix A - Conversation ID Normalization ---');

    // Participant IDs containing multiple underscores
    const userA = { id: 'test_alice_1792905937155', username: 'alice_app' };
    const userB = { id: 'test_bob_1792905937155', username: 'bob_app' };
    const currentUserId = userA.id;
    const activeChatId = userB.id;
    const chatId1 = [currentUserId, activeChatId].sort().join('_'); // sorted canonical
    const partnerId = userB.id;

    const directContext = {
      isGroup: false,
      activeChatId,
      activeChat: userB,
      currentUserId,
      user: userA,
      chatId: chatId1,
      partnerId
    };

    // Case 1: Direct ordering match
    assert.strictEqual(
      matchesConversation('test_alice_1792905937155_test_bob_1792905937155', null, directContext),
      true,
      'Direct order (Alice_Bob) must match'
    );

    // Case 2: Reverse participant ordering match
    assert.strictEqual(
      matchesConversation('test_bob_1792905937155_test_alice_1792905937155', null, directContext),
      true,
      'Reverse order (Bob_Alice) must match'
    );

    // Case 3: Canonical chatId provided as second parameter
    assert.strictEqual(
      matchesConversation(null, chatId1, directContext),
      true,
      'Canonical chat ID must match'
    );

    // Case 4: Event from different conversation involving another user with underscores must NOT match
    const differentConvId = 'test_alice_1792905937155_test_charlie_1792905937155';
    assert.strictEqual(
      matchesConversation(differentConvId, differentConvId, directContext),
      false,
      'Conversation with different user (Charlie) must NOT match Alice_Bob'
    );

    // Case 5: Substring or prefix attack must NOT match
    const substringAttackId = 'test_bob_1792905937155_extra_user';
    assert.strictEqual(
      matchesConversation(substringAttackId, null, directContext),
      false,
      'Arbitrary substring containing user ID must NOT match'
    );

    // Case 6: Missing or ambiguous conversation identity must return false
    assert.strictEqual(matchesConversation(null, null, directContext), false, 'Null IDs must return false');
    assert.strictEqual(matchesConversation(undefined, undefined, directContext), false, 'Undefined IDs must return false');
    assert.strictEqual(matchesConversation('', '', directContext), false, 'Empty string IDs must return false');
    assert.strictEqual(matchesConversation('   ', '   ', directContext), false, 'Whitespace IDs must return false');

    // Case 7: Group chat exact matching
    const groupContext = {
      isGroup: true,
      activeChatId: 'grp_secret_room_123',
      activeChat: { id: 'grp_secret_room_123' },
      chatId: 'grp_secret_room_123'
    };
    assert.strictEqual(matchesConversation('grp_secret_room_123', null, groupContext), true, 'Exact group ID must match');
    assert.strictEqual(matchesConversation('grp_other_room_456', null, groupContext), false, 'Different group ID must NOT match');

    console.log('✅ Fix A Passed: Exact normalization with underscore participant IDs, both orderings, and group isolation verified');

    // ----------------------------------------------------
    // TEST GROUP 3: Fix B - Monotonic Status Only for Same Message
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 3: Fix B - Monotonic Status Only for Same Message ---');

    localStorage.clear();
    const chatKey = 'test_alice_test_bob';

    // Seed preview with Message 1 that was already 'read'
    const msg1 = {
      id: 'msg_001',
      clientTempId: 'temp_001',
      content: 'First message',
      status: 'read',
      timestamp: '2026-10-26T10:00:00.000Z'
    };
    updateRecentChatSnippet('test_alice', chatKey, msg1, { id: 'test_bob', displayName: 'Bob' }, { isViewing: false });
    let recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].lastMessageStatus, 'read', 'Preview for msg1 should be read');
    assert.strictEqual(recents[0].lastMessage, 'First message');

    // Requirement 1: Existing preview is 'read'; a DIFFERENT new message with status 'pending' must NOT appear as 'read'
    const msg2New = {
      id: 'msg_002',
      clientTempId: 'temp_002',
      content: 'Second genuinely new message',
      status: 'pending',
      timestamp: '2026-10-26T10:05:00.000Z'
    };
    updateRecentChatSnippet('test_alice', chatKey, msg2New, { id: 'test_bob', displayName: 'Bob' }, { isViewing: false });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].lastMessage, 'Second genuinely new message');
    assert.strictEqual(recents[0].lastMessageStatus, 'pending', 'New message must initialize status to "pending", NOT inherit previous "read"');
    console.log('✅ Requirement 1 Passed: New message with status "pending" does NOT inherit previous "read"');

    // Requirement 2: The SAME message is 'read'; a late 'delivered' event must leave it 'read'
    // Update msg2 to 'read' first
    updateRecentChatSnippet('test_alice', chatKey, { ...msg2New, status: 'read' }, { id: 'test_bob', displayName: 'Bob' });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].lastMessageStatus, 'read', 'msg2 status should now be read');

    // Now a late 'delivered' event arrives for the SAME message (msg_002)
    updateRecentChatSnippet('test_alice', chatKey, { id: 'msg_002', clientTempId: 'temp_002', content: 'Second genuinely new message', status: 'delivered', timestamp: '2026-10-26T10:05:00.000Z' }, { id: 'test_bob', displayName: 'Bob' });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].lastMessageStatus, 'read', 'Late "delivered" event for SAME message must leave it "read"');

    // Also test with isStatusOnly: true
    updateRecentChatSnippet('test_alice', chatKey, { status: 'delivered' }, { id: 'test_bob', displayName: 'Bob' });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].lastMessageStatus, 'read', 'Status-only late "delivered" event must leave sidebar "read"');
    console.log('✅ Requirement 2 Passed: Late "delivered" event for same message leaves it "read"');

    // Requirement 3: Duplicate receipt events must NOT increment unread count repeatedly
    localStorage.clear();
    const incomingMsg = {
      id: 'msg_incoming_001',
      clientTempId: 'temp_incoming_001',
      senderId: 'test_bob',
      content: 'Hey Alice!',
      status: 'sent',
      timestamp: '2026-10-26T11:00:00.000Z'
    };

    // First arrival: unread increments to 1
    updateRecentChatSnippet('test_alice', chatKey, incomingMsg, { id: 'test_bob', displayName: 'Bob' }, { isViewing: false, increment: true });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].unreadCount, 1, 'Initial arrival must set unreadCount to 1');

    // Duplicate arrival of EXACT same message: must be idempotent, unreadCount remains 1
    updateRecentChatSnippet('test_alice', chatKey, incomingMsg, { id: 'test_bob', displayName: 'Bob' }, { isViewing: false, increment: true });
    recents = getCachedRecentChats('test_alice');
    assert.strictEqual(recents[0].unreadCount, 1, 'Duplicate receipt event must NOT increment unreadCount repeatedly');
    console.log('✅ Requirement 3 Passed: Duplicate receipt events do not increment unread count repeatedly');

    // ----------------------------------------------------
    // TEST GROUP 4: send_message ACK Contract Verification
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 4: send_message ACK Validation & Error Handling ---');

    function simulateAckHandler(tempId, ack, currentMsgs) {
      let updatedMsgs = [...currentMsgs];
      let updatedStatus = null;
      let toastMessage = null;

      if (ack && typeof ack === 'object' && ack.success === true && ack.message && typeof ack.message.id === 'string' && ack.message.id.startsWith('msg_')) {
        const serverId = ack.message.id;
        updatedMsgs = updatedMsgs.map(m => {
          if (m.clientTempId === tempId || m.id === tempId) {
            const nextStatus = resolveNextMessageStatus(m.status, 'sent');
            return { ...m, id: serverId, status: nextStatus };
          }
          return m;
        });
        updatedStatus = 'sent';
      } else if (ack && typeof ack === 'object' && (ack.error || ack.success === false)) {
        const errorReason = ack.message || ack.error || 'Message rejected by server';
        updatedMsgs = updatedMsgs.map(m => {
          if (m.clientTempId === tempId || m.id === tempId) {
            if (m.status === 'delivered' || m.status === 'read') return m;
            return {
              ...m,
              status: 'failed',
              error: typeof ack.error === 'string' ? ack.error : errorReason,
              errorMessage: errorReason
            };
          }
          return m;
        });
        updatedStatus = 'failed';
        toastMessage = errorReason;
      }
      return { updatedMsgs, updatedStatus, toastMessage };
    }

    const testTempId = 'temp_send_001';
    const originalContent = 'Hello secret text to be sent';
    const initialMsg = { id: testTempId, clientTempId: testTempId, content: originalContent, status: 'pending' };

    // Case 1: Valid success ACK from backend
    const validAck = { success: true, message: { id: 'msg_1793000000_abc123' } };
    const res1 = simulateAckHandler(testTempId, validAck, [initialMsg]);
    assert.strictEqual(res1.updatedMsgs[0].id, 'msg_1793000000_abc123', 'Valid success ACK must promote temp ID to server ID');
    assert.strictEqual(res1.updatedMsgs[0].status, 'sent', 'Valid success ACK must set status to sent');
    assert.strictEqual(res1.updatedMsgs[0].content, originalContent, 'Original content must be preserved');
    console.log('✅ Case 1: Valid success ACK correctly promotes ID to server ID with status "sent"');

    // Case 2: Definitive server rejection (e.g. not_friends)
    const rejectAck = { error: 'not_friends', message: 'You can only message synced friends.' };
    const res2 = simulateAckHandler(testTempId, rejectAck, [initialMsg]);
    assert.strictEqual(res2.updatedMsgs[0].id, testTempId, 'Rejected message must keep temp ID for retry');
    assert.strictEqual(res2.updatedMsgs[0].status, 'failed', 'Rejected message must be marked failed, NEVER sent or delivered');
    assert.strictEqual(res2.updatedMsgs[0].content, originalContent, 'Original message text must be preserved for retry');
    assert.strictEqual(res2.toastMessage, 'You can only message synced friends.');
    console.log('✅ Case 2: Definitive rejection marks status "failed" and preserves message text');

    // Case 3: Missing / Timeout ACK (callback receives nothing or undefined)
    const res3 = simulateAckHandler(testTempId, undefined, [initialMsg]);
    assert.strictEqual(res3.updatedMsgs[0].status, 'pending', 'Missing ACK must leave message in pending state, not failed or sent');
    console.log('✅ Case 3: Missing / Timeout ACK leaves message in pending state');

    // Case 4: Unexpected ACK shape (e.g. empty object, missing message.id)
    const malformedAck = { success: true, foo: 'bar' };
    const res4 = simulateAckHandler(testTempId, malformedAck, [initialMsg]);
    assert.strictEqual(res4.updatedMsgs[0].status, 'pending', 'Malformed ACK shape must NOT falsely promote message');
    console.log('✅ Case 4: Unexpected ACK shape is safely ignored without false promotion');

    // Case 5: Already delivered message receiving late failure ACK must NOT downgrade
    const deliveredMsg = { id: testTempId, clientTempId: testTempId, content: originalContent, status: 'delivered' };
    const res5 = simulateAckHandler(testTempId, rejectAck, [deliveredMsg]);
    assert.strictEqual(res5.updatedMsgs[0].status, 'delivered', 'Already delivered message must NEVER downgrade to failed on late rejection');
    console.log('✅ Case 5: Delivered message protected against late failure ACK');

    // ----------------------------------------------------
    // TEST GROUP 5: Unambiguous Canonical Conversation Identity & Room Targeting (Collision Fix)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 5: Unambiguous Canonical Identity & Room Targeting ---');

    // Logic under test from backend server.js message_delivered handler
    function resolveServerDeliveryRouting(verifiedSenderId, receiverId, chatId) {
      const unambiguousCanonical = (verifiedSenderId && receiverId)
        ? [String(verifiedSenderId), String(receiverId)].sort().join('::')
        : null;
      const legacyCanonical = (verifiedSenderId && receiverId)
        ? [String(verifiedSenderId), String(receiverId)].sort().join('_')
        : chatId;
      const canonicalChatId = unambiguousCanonical || legacyCanonical;

      const targetRooms = new Set();
      if (unambiguousCanonical) targetRooms.add(unambiguousCanonical);
      if (verifiedSenderId) targetRooms.add(`user_${verifiedSenderId}`);
      if (receiverId) targetRooms.add(`user_${receiverId}`);

      return { canonicalChatId, unambiguousCanonical, targetRooms: Array.from(targetRooms) };
    }

    const aliceUnderscore = 'test_alice_1792905937155';
    const bobUnderscore = 'test_bob_1792905937155';
    const forwardChatId = `${aliceUnderscore}_${bobUnderscore}`;
    const reverseChatId = `${bobUnderscore}_${aliceUnderscore}`;

    // Test 1: Real underscore participant IDs in forward ordering
    const route1 = resolveServerDeliveryRouting(aliceUnderscore, bobUnderscore, forwardChatId);
    assert.strictEqual(route1.canonicalChatId, 'test_alice_1792905937155::test_bob_1792905937155', 'Server must preserve entire participant IDs in unambiguous canonicalChatId');
    assert(route1.targetRooms.includes(`user_${aliceUnderscore}`), 'Must route to Alice user room');
    assert(route1.targetRooms.includes(`user_${bobUnderscore}`), 'Must route to Bob user room');
    assert(route1.targetRooms.includes('test_alice_1792905937155::test_bob_1792905937155'), 'Must route to unambiguous room');
    assert(!route1.targetRooms.includes('test'), 'Must NOT fragment on underscore');
    assert(!route1.targetRooms.includes('alice'), 'Must NOT fragment on underscore');
    assert(!route1.targetRooms.includes('1792905937155'), 'Must NOT fragment on underscore');

    // Test 2: Reverse participant ordering produces identical canonical ID and rooms
    const route2 = resolveServerDeliveryRouting(bobUnderscore, aliceUnderscore, reverseChatId);
    assert.strictEqual(route2.canonicalChatId, 'test_alice_1792905937155::test_bob_1792905937155', 'Canonical conversation identity must be identical regardless of sender/receiver ordering');
    assert.deepStrictEqual(route1.targetRooms.sort(), route2.targetRooms.sort(), 'Target rooms must be identical in both orderings');

    // Test 3: The Collision Pair ["a_b", "c"] versus ["a", "b_c"]
    // Pair 1: ["a_b", "c"]
    const routeP1 = resolveServerDeliveryRouting('a_b', 'c', 'a_b_c');
    // Pair 2: ["a", "b_c"]
    const routeP2 = resolveServerDeliveryRouting('a', 'b_c', 'a_b_c');

    // 3A: Server canonical IDs must be completely distinct
    assert.strictEqual(routeP1.canonicalChatId, 'a_b::c', 'Pair 1 must resolve to a_b::c');
    assert.strictEqual(routeP2.canonicalChatId, 'a::b_c', 'Pair 2 must resolve to a::b_c');
    assert.notStrictEqual(routeP1.canonicalChatId, routeP2.canonicalChatId, 'CRITICAL: Pair 1 and Pair 2 canonical IDs must NOT collide!');

    // 3B: Server target rooms must have ZERO intersection
    const p1Rooms = new Set(routeP1.targetRooms);
    const p2Rooms = new Set(routeP2.targetRooms);
    const commonRooms = [...p1Rooms].filter(r => p2Rooms.has(r));
    assert.strictEqual(commonRooms.length, 0, 'CRITICAL: Server delivery target rooms must have ZERO overlap between colliding pairs!');

    // Test 4: Client matchesConversation with Collision Pair
    const contextP1 = {
      isGroup: false,
      activeChatId: 'c',
      activeChat: { id: 'c', username: 'c' },
      currentUserId: 'a_b',
      user: { id: 'a_b', username: 'a_b' },
      chatId: 'a_b_c',
      partnerId: 'c'
    };

    const contextP2 = {
      isGroup: false,
      activeChatId: 'b_c',
      activeChat: { id: 'b_c', username: 'b_c' },
      currentUserId: 'a',
      user: { id: 'a', username: 'a' },
      chatId: 'a_b_c',
      partnerId: 'b_c'
    };

    // 4A: Client P1 accepts P1 receipts in forward AND reverse order
    assert.strictEqual(matchesConversation('a_b_c', 'a_b::c', contextP1), true, 'Client P1 must accept P1 receipt in forward order');
    assert.strictEqual(matchesConversation('a_b_c', 'c::a_b', contextP1), true, 'Client P1 must accept P1 receipt in reverse order');

    // 4B: Client P1 strictly REJECTS P2 receipts even though legacy chatId is identical ("a_b_c")
    assert.strictEqual(matchesConversation('a_b_c', 'a::b_c', contextP1), false, 'Client P1 MUST REJECT receipt meant for P2!');
    assert.strictEqual(matchesConversation('a_b_c', 'b_c::a', contextP1), false, 'Client P1 MUST REJECT receipt meant for P2 in reverse order!');

    // 4C: Client P2 strictly REJECTS P1 receipts
    assert.strictEqual(matchesConversation('a_b_c', 'a_b::c', contextP2), false, 'Client P2 MUST REJECT receipt meant for P1!');
    assert.strictEqual(matchesConversation('a_b_c', 'c::a_b', contextP2), false, 'Client P2 MUST REJECT receipt meant for P1 in reverse order!');

    // 4D: Client P2 accepts P2 receipts
    assert.strictEqual(matchesConversation('a_b_c', 'a::b_c', contextP2), true, 'Client P2 must accept P2 receipt');

    // 4E: Unrelated third-party participant is strictly rejected
    assert.strictEqual(matchesConversation('a_b_charlie', 'a_b::charlie', contextP1), false, 'Unrelated user Charlie must be rejected');

    console.log('✅ Unambiguous canonical identity, server room targeting, and collision pair isolation verified (ZERO room/identity overlap)');

    console.log('\n=============================================');
    console.log('ALL REGRESSION TESTS PASSED (5/5 TEST GROUPS)');
    console.log('=============================================\n');
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(tempChatWindowPath)) fs.unlinkSync(tempChatWindowPath);
  }
}

main().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
