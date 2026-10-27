const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

const config = require('../config');
const User = require('../models/User');
const Group = require('../models/Group');

async function runJoinChatAuthorizationRegression() {
  console.log('================================================================');
  console.log('   PULSECHAT JOIN_CHAT AUTHORIZATION REGRESSION TEST SUITE      ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000';
  await mongoose.connect(config.MONGO_URI);
  console.log('[Setup] Connected to MongoDB.');

  const aliceId = 'test_alice_1792905937155';
  const bobId = 'test_bob_1792905937155';
  const eveId = '6a6da10136031f6e69c4d7f7'; // ayuussh_07 (third party / stranger)

  const aliceUser = await User.findOne({ id: aliceId });
  const bobUser = await User.findOne({ id: bobId });
  const eveUser = await User.findOne({ _id: new mongoose.Types.ObjectId(eveId) });
  assert(aliceUser && bobUser && eveUser, 'Alice, Bob, and Eve must exist in DB.');

  // Find a group and a real member user for Group testing
  const testGroup = await Group.findOne({ id: 'group_1789989116166' }).lean() || await Group.findOne().lean();
  assert(testGroup, 'Test group must exist in DB.');
  const groupMemberUser = await User.findOne({ id: { $in: testGroup.members } }).lean();
  assert(groupMemberUser, 'Group member user must exist.');
  const groupMemberId = groupMemberUser.id;

  const aliceToken = jwt.sign({ id: aliceId, username: aliceUser.username, email: aliceUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const bobToken = jwt.sign({ id: bobId, username: bobUser.username, email: bobUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const eveToken = jwt.sign({ id: eveUser.id || eveId, username: eveUser.username, email: eveUser.email }, config.JWT_SECRET, { expiresIn: '1d' });
  const memberToken = jwt.sign({ id: groupMemberUser.id || groupMemberId, username: groupMemberUser.username, email: groupMemberUser.email }, config.JWT_SECRET, { expiresIn: '1d' });

  // Connect sockets
  const aliceSocket = ioClient(BASE_URL, { auth: { token: aliceToken } });
  const bobSocket = ioClient(BASE_URL, { auth: { token: bobToken } });
  const eveSocket = ioClient(BASE_URL, { auth: { token: eveToken } });
  const memberSocket = ioClient(BASE_URL, { auth: { token: memberToken } });

  await new Promise(resolve => {
    let a = false, b = false, e = false, m = false;
    aliceSocket.on('connect', () => { aliceSocket.emit('setup', aliceId); a = true; if (a && b && e && m) resolve(); });
    bobSocket.on('connect', () => { bobSocket.emit('setup', bobId); b = true; if (a && b && e && m) resolve(); });
    eveSocket.on('connect', () => { eveSocket.emit('setup', eveUser.id || eveId); e = true; if (a && b && e && m) resolve(); });
    memberSocket.on('connect', () => { memberSocket.emit('setup', groupMemberUser.id || groupMemberId); m = true; if (a && b && e && m) resolve(); });
  });
  console.log('✅ All test sockets connected and authenticated.');

  const canonicalChatId = [aliceId, bobId].sort().join('::');
  const legacyChatId = [aliceId, bobId].sort().join('_');

  try {
    // -------------------------------------------------------------
    // Test 1: Authorized friends can join a valid canonical conversation
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Authorized friends can join a valid canonical conversation ---');
    const aliceJoinAck = await new Promise(resolve => aliceSocket.emit('join_chat', canonicalChatId, resolve));
    assert.strictEqual(aliceJoinAck.success, true, 'Alice must successfully join canonical chat');
    assert(aliceJoinAck.rooms.includes(canonicalChatId), 'Alice socket must be present in canonical room');

    const bobJoinAck = await new Promise(resolve => bobSocket.emit('join_chat', canonicalChatId, resolve));
    assert.strictEqual(bobJoinAck.success, true, 'Bob must successfully join canonical chat');
    assert(bobJoinAck.rooms.includes(canonicalChatId), 'Bob socket must be present in canonical room');
    console.log('✅ TEST 1 PASSED: Authorized friends Alice & Bob joined canonical room successfully.');

    // -------------------------------------------------------------
    // Test 2: Stranger cannot join a fabricated direct room (myId::peerId or foreign conversation)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Stranger cannot join fabricated direct-chat rooms ---');
    const eveFabricatedChatId = [eveUser.id || eveId, aliceId].sort().join('::');
    const eveStrangerAck = await new Promise(resolve => eveSocket.emit('join_chat', eveFabricatedChatId, resolve));
    assert.strictEqual(eveStrangerAck.success, false, 'Stranger must be rejected');
    assert.strictEqual(eveStrangerAck.error, 'NOT_FRIENDS', 'Stranger rejection reason must be NOT_FRIENDS');
    assert(!eveStrangerAck.rooms.includes(eveFabricatedChatId), 'Stranger socket must NOT be in fabricated room');

    // Eve also attempts to join Alice & Bob conversation directly
    const eveEavesdropAck = await new Promise(resolve => eveSocket.emit('join_chat', canonicalChatId, resolve));
    assert.strictEqual(eveEavesdropAck.success, false, 'Third party must be rejected from private conversation');
    assert.strictEqual(eveEavesdropAck.error, 'NOT_A_CHAT_PARTICIPANT', 'Must be NOT_A_CHAT_PARTICIPANT');
    assert(!eveEavesdropAck.rooms.includes(canonicalChatId), 'Third party socket must NOT be in canonical conversation');
    console.log('✅ TEST 2 PASSED: Stranger and eavesdropper safely rejected and prevented from joining rooms.');

    // -------------------------------------------------------------
    // Test 3: Blocked participant cannot join direct-chat room
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Blocked participant cannot join direct-chat room ---');
    // Temporarily add Bob to Alice's blockedUsers
    await User.updateOne({ id: aliceId }, { $addToSet: { blockedUsers: bobId } });

    const bobBlockedAck = await new Promise(resolve => bobSocket.emit('join_chat', canonicalChatId, resolve));
    assert.strictEqual(bobBlockedAck.success, false, 'Blocked user must not be able to join chat');
    assert.strictEqual(bobBlockedAck.error, 'BLOCKED', 'Error must be BLOCKED');
    assert(!bobBlockedAck.rooms.includes(canonicalChatId), 'Blocked user socket must NOT be placed in canonical room');

    const aliceBlockedAck = await new Promise(resolve => aliceSocket.emit('join_chat', canonicalChatId, resolve));
    assert.strictEqual(aliceBlockedAck.success, false, 'User with block relationship must not be able to join chat');
    assert.strictEqual(aliceBlockedAck.error, 'BLOCKED', 'Error must be BLOCKED');

    // Remove block to restore clean state
    await User.updateOne({ id: aliceId }, { $pull: { blockedUsers: bobId } });
    console.log('✅ TEST 3 PASSED: Blocked participants fail-closed with BLOCKED and zero room memberships.');

    // -------------------------------------------------------------
    // Test 4: Malformed, identical, empty, and nonexistent peers rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Malformed, identical, empty, and nonexistent peers rejected ---');
    // 4.1 Nonexistent peer
    const ghostAck = await new Promise(resolve => aliceSocket.emit('join_chat', `${aliceId}::ghost_user_99999999`, resolve));
    assert.strictEqual(ghostAck.success, false);
    assert.strictEqual(ghostAck.error, 'INVALID_CHAT_PARTICIPANT');
    assert(!ghostAck.rooms.includes(`${aliceId}::ghost_user_99999999`));

    // 4.2 Identical participants
    const identicalAck = await new Promise(resolve => aliceSocket.emit('join_chat', `${aliceId}::${aliceId}`, resolve));
    assert.strictEqual(identicalAck.success, false);
    assert.strictEqual(identicalAck.error, 'IDENTICAL_PARTICIPANTS');
    assert(!identicalAck.rooms.includes(`${aliceId}::${aliceId}`));

    // 4.3 Empty participants
    const emptyAck1 = await new Promise(resolve => aliceSocket.emit('join_chat', `${aliceId}::`, resolve));
    assert.strictEqual(emptyAck1.success, false);
    assert.strictEqual(emptyAck1.error, 'MALFORMED_CHAT_ID');

    const emptyAck2 = await new Promise(resolve => aliceSocket.emit('join_chat', `::${aliceId}`, resolve));
    assert.strictEqual(emptyAck2.success, false);
    assert.strictEqual(emptyAck2.error, 'MALFORMED_CHAT_ID');

    // 4.4 Extra delimiters
    const extraDelimAck = await new Promise(resolve => aliceSocket.emit('join_chat', `${aliceId}::${bobId}::${eveId}`, resolve));
    assert.strictEqual(extraDelimAck.success, false);
    assert.strictEqual(extraDelimAck.error, 'MALFORMED_CHAT_ID');
    assert(!extraDelimAck.rooms.includes(`${aliceId}::${bobId}::${eveId}`));
    console.log('✅ TEST 4 PASSED: Nonexistent peer, self-chat, empty IDs, and extra delimiters rejected.');

    // -------------------------------------------------------------
    // Test 5: Legacy IDs cannot bypass authorization
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Legacy underscore IDs authorization and alias isolation ---');
    // Stranger Eve attempts to join legacy alice_eve or eve_alice
    const eveLegacyStrangerAck = await new Promise(resolve => eveSocket.emit('join_chat', `${eveUser.id || eveId}_${aliceId}`, resolve));
    assert.strictEqual(eveLegacyStrangerAck.success, false, 'Legacy join by stranger must be rejected');
    assert.strictEqual(eveLegacyStrangerAck.error, 'NOT_FRIENDS', 'Must reject stranger with NOT_FRIENDS');
    assert(!eveLegacyStrangerAck.rooms.includes(`${eveUser.id || eveId}_${aliceId}`));

    // Third party Eve attempts to join legacy alice_bob
    const eveLegacyEavesdropAck = await new Promise(resolve => eveSocket.emit('join_chat', legacyChatId, resolve));
    assert.strictEqual(eveLegacyEavesdropAck.success, false, 'Legacy join by non-member must be rejected');
    assert.strictEqual(eveLegacyEavesdropAck.error, 'NOT_A_CHAT_PARTICIPANT');
    assert(!eveLegacyEavesdropAck.rooms.includes(legacyChatId));

    // Identical legacy ID (alice_alice)
    const aliceSelfLegacyAck = await new Promise(resolve => aliceSocket.emit('join_chat', `${aliceId}_${aliceId}`, resolve));
    assert.strictEqual(aliceSelfLegacyAck.success, false);
    assert.strictEqual(aliceSelfLegacyAck.error, 'IDENTICAL_PARTICIPANTS');

    // Authorized friends Alice & Bob joining legacy chat
    const aliceValidLegacyAck = await new Promise(resolve => aliceSocket.emit('join_chat', legacyChatId, resolve));
    assert.strictEqual(aliceValidLegacyAck.success, true, 'Authorized friend must succeed on legacy chat');
    assert(aliceValidLegacyAck.rooms.includes(legacyChatId), 'Alice must be in legacy room');
    assert(aliceValidLegacyAck.rooms.includes(canonicalChatId), 'Alice must be in canonical alias room');
    console.log('✅ TEST 5 PASSED: Legacy IDs enforce identical authorization and cannot bypass security.');

    // -------------------------------------------------------------
    // Test 6: Legitimate group-chat joining remains functional
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Legitimate group-chat joining verification ---');
    // Valid member joining group
    const memberGroupAck = await new Promise(resolve => memberSocket.emit('join_chat', testGroup.id, resolve));
    assert.strictEqual(memberGroupAck.success, true, 'Legitimate group member must be allowed to join');
    assert(memberGroupAck.rooms.includes(testGroup.id), 'Member socket must be placed in group room');

    // Non-member (Eve) joining group
    const eveGroupAck = await new Promise(resolve => eveSocket.emit('join_chat', testGroup.id, resolve));
    assert.strictEqual(eveGroupAck.success, false, 'Non-member must be rejected from group');
    assert.strictEqual(eveGroupAck.error, 'NOT_A_GROUP_MEMBER');
    assert(!eveGroupAck.rooms.includes(testGroup.id), 'Non-member must NOT be placed in group room');

    // Nonexistent group
    const nonExistentGroupAck = await new Promise(resolve => memberSocket.emit('join_chat', 'group_fake_ghost_99999', resolve));
    assert.strictEqual(nonExistentGroupAck.success, false, 'Nonexistent group must be rejected');
    assert.strictEqual(nonExistentGroupAck.error, 'GROUP_NOT_FOUND');
    assert(!nonExistentGroupAck.rooms.includes('group_fake_ghost_99999'));
    console.log('✅ TEST 6 PASSED: Group chat membership enforcement preserved and functional.');

  } finally {
    // Ensure clean state
    await User.updateOne({ id: aliceId }, { $pull: { blockedUsers: bobId } });
    aliceSocket.disconnect();
    bobSocket.disconnect();
    eveSocket.disconnect();
    memberSocket.disconnect();
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log('   ALL 6 JOIN_CHAT AUTHORIZATION REGRESSIONS PASSED (100%)       ');
  console.log('================================================================\n');
  process.exit(0);
}

runJoinChatAuthorizationRegression().catch(err => {
  console.error('\n❌ TEST RUN FAILED WITH ERROR:', err);
  process.exit(1);
});
