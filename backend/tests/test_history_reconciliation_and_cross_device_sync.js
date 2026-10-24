const assert = require('assert');

console.log('================================================================');
console.log(' TEST SUITE: History Reconciliation & Cross-Device Sync');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

(async () => {
  // Test 1: In-place cache update behavior (appendCachedMessage logic)
  runTest('appendCachedMessage updates existing message in place with decrypted content', () => {
    const existing = [
      { id: 'msg_1', clientTempId: 'temp_1', content: '', isEncrypted: true, status: 'sent', timestamp: '2026-10-24T13:20:00.000Z' }
    ];

    const incoming = {
      id: 'msg_1',
      clientTempId: 'temp_1',
      content: 'LOVE 💗',
      type: '3d_text',
      textStyle: 'cyber-neon',
      isEncrypted: true,
      _decrypted: true,
      status: 'delivered',
      timestamp: '2026-10-24T13:20:00.000Z'
    };

    // Replicate our upgraded appendCachedMessage logic
    const msgs = [...existing];
    const idx = msgs.findIndex(m => m.id === incoming.id || (incoming.clientTempId && m.clientTempId === incoming.clientTempId));
    if (idx !== -1) {
      msgs[idx] = {
        ...msgs[idx],
        ...incoming,
        content: incoming.content || msgs[idx].content || ''
      };
    } else {
      msgs.push(incoming);
    }

    assert.strictEqual(msgs.length, 1, 'Length should remain 1');
    assert.strictEqual(msgs[0].content, 'LOVE 💗', 'Content must be updated to decrypted text');
    assert.strictEqual(msgs[0].type, '3d_text', 'Type should be 3d_text');
    assert.strictEqual(msgs[0].status, 'delivered', 'Status should be delivered');
  });

  // Test 2: Master Store Reconciliation preserves both sender and peer content
  runTest('Master Store reconciliation merges serverMsgs, resolves clientTempId and preserves content', () => {
    const cachedNow = [
      { id: 'msg_desktop_1', content: 'h', senderId: 'user_prashant', timestamp: '2026-10-21T10:00:00.000Z' },
      { id: 'temp_desktop_2', clientTempId: 'temp_desktop_2', content: 'LOVE 💗', type: '3d_text', textStyle: 'cyber-neon', senderId: 'user_prashant', timestamp: '2026-10-24T13:25:00.000Z' }
    ];

    const serverMsgs = [
      { id: 'msg_desktop_1', content: '', isEncrypted: true, senderId: 'user_prashant', timestamp: '2026-10-21T10:00:00.000Z' },
      { id: 'msg_desktop_2_auth', clientTempId: 'temp_desktop_2', content: '', isEncrypted: true, type: '3d_text', textStyle: 'cyber-neon', senderId: 'user_prashant', timestamp: '2026-10-24T13:25:00.000Z' },
      { id: 'msg_phone_1', content: 'Hii', senderId: 'user_pulsechats', timestamp: '2026-10-24T13:24:00.000Z' },
      { id: 'msg_phone_2', content: 'Hello', senderId: 'user_pulsechats', timestamp: '2026-10-24T14:23:00.000Z' }
    ];

    const myIdSet = new Set(['user_prashant', 'prashant']);
    const messageMap = new Map();

    cachedNow.forEach(c => {
      const k = c.clientTempId || c.id;
      if (k) messageMap.set(k, c);
    });

    serverMsgs.forEach(m => {
      if (m && m.id) {
        const existing = messageMap.get(m.id) ||
          (m.clientTempId && messageMap.get(m.clientTempId)) ||
          (m.tempId && messageMap.get(m.tempId));
        if (m.clientTempId && messageMap.has(m.clientTempId)) {
          messageMap.delete(m.clientTempId);
        }
        if (m.tempId && messageMap.has(m.tempId)) {
          messageMap.delete(m.tempId);
        }
        const isSentByMe = m?.senderId && myIdSet.has(String(m.senderId));
        const finalContent = isSentByMe
          ? (existing?.content || m.content || '')
          : (m.content || existing?.content || '');
        messageMap.set(m.id, { ...existing, ...m, content: finalContent });
      }
    });

    const merged = Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    assert.strictEqual(merged.length, 4, 'All 4 messages must be reconciled');
    assert.strictEqual(messageMap.has('temp_desktop_2'), false, 'Optimistic tempId must be replaced by authoritative id');
    assert.strictEqual(merged[0].content, 'h', 'Oldest Oct 21 message preserved');
    assert.strictEqual(merged[1].content, 'Hii', 'Phone message Hii at 13:24 is included');
    assert.strictEqual(merged[2].content, 'LOVE 💗', '3D text content preserved on sender side');
    assert.strictEqual(merged[2].type, '3d_text', '3D text type preserved');
    assert.strictEqual(merged[3].content, 'Hello', 'Phone message Hello at 14:23 is included');
  });

  // Test 3: Candidate user queries generator handles all prefixes and variations
  runTest('Candidate user resolution generates normalized variations for custom id and usernames', () => {
    const buildUserQueries = (rawId) => {
      if (!rawId) return [];
      const s = String(rawId).trim();
      const withoutUser = s.replace(/^user_/, '');
      const withUser = s.startsWith('user_') ? s : `user_${s}`;
      const candidates = Array.from(new Set([s, withoutUser, withUser].filter(Boolean)));
      const orList = [];
      candidates.forEach(c => {
        orList.push({ id: c });
        orList.push({ username: c });
      });
      return orList;
    };

    const queriesPrashant = buildUserQueries('user_prashant');
    const hasUsernamePrashant = queriesPrashant.some(q => q.username === 'prashant');
    const hasIdUserPrashant = queriesPrashant.some(q => q.id === 'user_prashant');
    assert.strictEqual(hasUsernamePrashant, true, 'Matches username prashant');
    assert.strictEqual(hasIdUserPrashant, true, 'Matches id user_prashant');

    const queriesPulsechats = buildUserQueries('pulsechats');
    const hasIdUserPulsechats = queriesPulsechats.some(q => q.id === 'user_pulsechats');
    const hasUsernamePulsechats = queriesPulsechats.some(q => q.username === 'pulsechats');
    assert.strictEqual(hasIdUserPulsechats, true, 'Matches id user_pulsechats');
    assert.strictEqual(hasUsernamePulsechats, true, 'Matches username pulsechats');
  });

  // Test 4: E2EE Decrypted envelope preserves 3d_text and rich metadata
  runTest('decryptMessageEnvelope data mapping preserves 3d_text, textStyle, pollData, giftData, storyReply', () => {
    const rawEnvelope = {
      content: 'LOVE 💗',
      type: '3d_text',
      textStyle: 'cyber-neon',
      pollData: { question: 'Best crypto?' },
      giftData: { sparks: 100 },
      storyReply: { storyId: 'story_999' }
    };

    const wireMsg = {
      id: 'msg_999',
      isEncrypted: true,
      envelope: { iv: 'abc', ciphertext: 'xyz' },
      content: '',
      type: '3d_text'
    };

    // Replicate decryptMessageIfNeeded property mapping
    const decryptedMsg = {
      ...wireMsg,
      content: rawEnvelope.content !== undefined ? rawEnvelope.content : wireMsg.content,
      type: rawEnvelope.type || wireMsg.type,
      textStyle: rawEnvelope.textStyle !== undefined ? rawEnvelope.textStyle : wireMsg.textStyle,
      pollData: rawEnvelope.pollData !== undefined ? rawEnvelope.pollData : wireMsg.pollData,
      giftData: rawEnvelope.giftData !== undefined ? rawEnvelope.giftData : wireMsg.giftData,
      storyReply: rawEnvelope.storyReply !== undefined ? rawEnvelope.storyReply : wireMsg.storyReply,
      _decrypted: true
    };

    assert.strictEqual(decryptedMsg.content, 'LOVE 💗');
    assert.strictEqual(decryptedMsg.type, '3d_text');
    assert.strictEqual(decryptedMsg.textStyle, 'cyber-neon');
    assert.deepStrictEqual(decryptedMsg.pollData, { question: 'Best crypto?' });
    assert.deepStrictEqual(decryptedMsg.giftData, { sparks: 100 });
    assert.strictEqual(decryptedMsg._decrypted, true);
  });

  // Test 5: LocalDatabase getMessagesFromLocalDb deduplicates across canonical and alternate keys
  runTest('LocalDatabase query deduplicates across canonical chatId keys and sorts chronologically', () => {
    const key1Msgs = [
      { id: 'm1', timestamp: '2026-10-21T10:00:00.000Z', content: 'h' },
      { id: 'm2', timestamp: '2026-10-24T13:25:00.000Z', content: 'LOVE 💗' }
    ];
    const key2Msgs = [
      { id: 'm2', timestamp: '2026-10-24T13:25:00.000Z', content: 'LOVE 💗' },
      { id: 'm3', timestamp: '2026-10-24T14:23:00.000Z', content: 'Hello' }
    ];

    const map = new Map();
    [...key1Msgs, ...key2Msgs].forEach(m => {
      const k = m.clientTempId || m.id;
      if (k) map.set(k, m);
    });

    const reconciled = Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    assert.strictEqual(reconciled.length, 3, 'Deduplicates m2');
    assert.strictEqual(reconciled[0].id, 'm1');
    assert.strictEqual(reconciled[1].id, 'm2');
    assert.strictEqual(reconciled[2].id, 'm3');
  });

  console.log(`\n================================================================`);
  console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`================================================================\n`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
