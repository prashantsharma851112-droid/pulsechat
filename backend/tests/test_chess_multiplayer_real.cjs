/**
 * test_chess_multiplayer_real.cjs
 * Real Socket.IO 1v1 Multiplayer Chess Integration Test.
 * Connects 2 authenticated sockets (Player White & Player Black),
 * verifies complete invitation, acceptance, authoritative move validation,
 * turn enforcement, illegal move rejection, draw negotiation, rematch, and sync.
 */

const path = require('path');
const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));
const chessMatchManager = require('../chat/chessMatchManager');

async function runMultiplayerTests() {
  console.log('================================================================');
  console.log('   PULSECHAT 1V1 REAL-TIME CHESS MULTIPLAYER SOCKET TEST       ');
  console.log('================================================================\n');

  // Setup standalone HTTP + Socket.IO server replicating server.js chess handlers
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  const onlineSockets = new Map();

  io.on('connection', (socket) => {
    socket.on('register_user', (userId, ack) => {
      socket.userId = String(userId);
      socket.join(`user_${userId}`);
      socket.join(userId);
      onlineSockets.set(String(userId), socket.id);
      if (typeof ack === 'function') ack({ success: true });
    });

    socket.on('join_chat', (chatId, ack) => {
      socket.join(chatId);
      if (chatId.includes('_')) {
        const canonical = chatId.split('_').sort().join('_');
        if (canonical !== chatId) socket.join(canonical);
      }
      if (typeof ack === 'function') ack({ success: true });
    });

    const relayChessEvent = (event, data) => {
      if (!data || !data.chatId) return;
      io.to(data.chatId).emit(event, data);
      if (data.chatId.includes('_')) {
        const canonical = data.chatId.split('_').sort().join('_');
        if (canonical !== data.chatId) io.to(canonical).emit(event, data);
      }
      if (data.recipient?.id) {
        io.to(`user_${data.recipient.id}`).emit(event, data);
        io.to(String(data.recipient.id)).emit(event, data);
      }
    };

    socket.on('chess_invite', (data) => {
      if (!data || !data.chatId) return;
      relayChessEvent('chess_invitation', data);
    });

    socket.on('chess_accept', (data) => {
      if (!data || !data.chatId) return;
      const { chatId, inviter, recipient, color } = data;
      const pickWhite = color === 'w' ? inviter : (color === 'b' ? recipient : inviter);
      const pickBlack = pickWhite.id === inviter.id ? recipient : inviter;

      const match = chessMatchManager.createMatch({
        chatId,
        whitePlayer: pickWhite,
        blackPlayer: pickBlack
      });

      relayChessEvent('chess_match_started', { chatId, match });
    });

    socket.on('chess_move', (data, ack) => {
      if (!data || !data.matchId) {
        if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAYLOAD' });
        return;
      }
      const userId = socket.userId || data.userId;
      const result = chessMatchManager.applyMove(data.matchId, userId, data.move, data.moveNumber);

      if (result.success) {
        if (typeof ack === 'function') ack({ success: true, move: result.move, san: result.san });
        relayChessEvent('chess_move_applied', {
          matchId: data.matchId,
          chatId: result.match.chatId,
          move: result.move,
          san: result.san,
          fen: result.match.fen,
          turn: result.match.turn,
          moveNumber: result.match.moveNumber,
          status: result.match.status,
          statusReason: result.match.statusReason,
          winner: result.match.winner,
          inCheck: result.match.inCheck
        });

        if (result.match.status !== 'active' && result.match.status !== 'check') {
          relayChessEvent('chess_game_over', {
            matchId: data.matchId,
            chatId: result.match.chatId,
            status: result.match.status,
            statusReason: result.match.statusReason,
            winner: result.match.winner
          });
        }
      } else {
        if (typeof ack === 'function') ack(result);
      }
    });

    socket.on('chess_draw_offer', (data) => {
      if (!data || !data.matchId) return;
      const userId = socket.userId || data.userId;
      const match = chessMatchManager.getMatch(data.matchId);
      if (!match) return;
      chessMatchManager.offerDraw(data.matchId, userId);
      relayChessEvent('chess_draw_offered', { ...data, chatId: match.chatId, userId });
    });

    socket.on('chess_draw_response', (data) => {
      if (!data || !data.matchId) return;
      const userId = socket.userId || data.userId;
      const result = chessMatchManager.respondDraw(data.matchId, userId, data.accepted);
      if (result.success) {
        if (data.accepted) {
          relayChessEvent('chess_game_over', {
            matchId: data.matchId,
            chatId: result.match.chatId,
            status: result.match.status,
            statusReason: result.match.statusReason,
            winner: result.match.winner
          });
        }
      }
    });

    socket.on('chess_rematch', (data) => {
      if (!data || !data.matchId) return;
      const newMatch = chessMatchManager.createRematch(data.matchId);
      if (newMatch) {
        relayChessEvent('chess_match_started', { chatId: newMatch.chatId, match: newMatch });
      }
    });

    socket.on('chess_sync', (data, ack) => {
      if (!data || !data.chatId) {
        if (typeof ack === 'function') ack({ hasActiveMatch: false });
        return;
      }
      const match = chessMatchManager.getMatchByChatId(data.chatId);
      if (typeof ack === 'function') {
        ack({
          hasActiveMatch: Boolean(match && match.status !== 'abandoned'),
          match: match || null
        });
      }
    });
  });

  const port = await new Promise(res => {
    server.listen(0, () => res(server.address().port));
  });

  const socketUrl = `http://127.0.0.1:${port}`;
  const chatId = 'alice_bob';

  const alice = ioClient(socketUrl, { reconnectionDelay: 100 });
  const bob = ioClient(socketUrl, { reconnectionDelay: 100 });

  await new Promise(r => alice.on('connect', r));
  await new Promise(r => bob.on('connect', r));

  await new Promise(r => alice.emit('register_user', 'alice', r));
  await new Promise(r => bob.emit('register_user', 'bob', r));
  await new Promise(r => alice.emit('join_chat', chatId, r));
  await new Promise(r => bob.emit('join_chat', chatId, r));

  await new Promise(r => setTimeout(r, 100));
  console.log('✓ Both Alice and Bob connected to Socket.IO test server\n');

  try {
    // 1. Invitation & Acceptance
    console.log('[TEST 1] Send & Receive Chess Invitation');
    const invitePromise = new Promise(resolve => {
      bob.once('chess_invitation', resolve);
    });

    alice.emit('chess_invite', {
      chatId,
      inviter: { id: 'alice', name: 'Alice', avatar: '' },
      recipient: { id: 'bob', name: 'Bob', avatar: '' },
      color: 'w' // Alice wants white
    });

    const receivedInvite = await invitePromise;
    assert.strictEqual(receivedInvite.chatId, chatId);
    assert.strictEqual(receivedInvite.inviter.id, 'alice');
    console.log('  ✓ Bob received Alice\'s chess invitation');

    // 2. Bob Accepts -> Match Started
    console.log('\n[TEST 2] Match Initialization on Acceptance');
    const matchStartBob = new Promise(resolve => bob.once('chess_match_started', resolve));
    const matchStartAlice = new Promise(resolve => alice.once('chess_match_started', resolve));

    bob.emit('chess_accept', receivedInvite);

    const [bobMatchData, aliceMatchData] = await Promise.all([matchStartBob, matchStartAlice]);
    assert.strictEqual(bobMatchData.match.matchId, aliceMatchData.match.matchId);
    assert.strictEqual(bobMatchData.match.whitePlayer.id, 'alice');
    assert.strictEqual(bobMatchData.match.blackPlayer.id, 'bob');
    assert.strictEqual(bobMatchData.match.turn, 'w');
    assert.strictEqual(bobMatchData.match.moveNumber, 1);
    console.log(`  ✓ Match initialized (${bobMatchData.match.matchId}) with Alice=White, Bob=Black`);

    const matchId = bobMatchData.match.matchId;

    // 3. Move 1: Alice (White) plays legal e2 -> e4
    console.log('\n[TEST 3] Legal Move by White (e2 -> e4)');
    const bobMovePromise1 = new Promise(resolve => bob.once('chess_move_applied', resolve));

    const ack1 = await new Promise(resolve => {
      alice.emit('chess_move', {
        matchId,
        move: { from: 'e2', to: 'e4', promotion: 'q' },
        moveNumber: 1
      }, resolve);
    });

    assert.strictEqual(ack1.success, true);
    assert.strictEqual(ack1.san, 'e4');

    const moveData1 = await bobMovePromise1;
    assert.strictEqual(moveData1.turn, 'b');
    assert.strictEqual(moveData1.moveNumber, 2);
    assert.strictEqual(moveData1.san, 'e4');
    console.log('  ✓ Move 1 applied: turn switched to Black, moveNumber updated to 2');

    // 4. Illegal Move Rejection: Bob tries to jump pawn illegally (e7 -> e4)
    console.log('\n[TEST 4] Server Rejection of Illegal Move');
    const ackIllegal = await new Promise(resolve => {
      bob.emit('chess_move', {
        matchId,
        move: { from: 'e7', to: 'e4' },
        moveNumber: 2
      }, resolve);
    });
    assert.strictEqual(ackIllegal.success, false);
    assert.strictEqual(ackIllegal.error, 'ILLEGAL_MOVE');
    console.log('  ✓ Illegal move e7->e4 authoritatively rejected by server');

    // 5. Turn Violation: Alice tries to move when it is Bob\'s turn
    console.log('\n[TEST 5] Turn Enforcement (Alice moving out of turn)');
    const ackOutOfTurn = await new Promise(resolve => {
      alice.emit('chess_move', {
        matchId,
        move: { from: 'g1', to: 'f3' },
        moveNumber: 2
      }, resolve);
    });
    assert.strictEqual(ackOutOfTurn.success, false);
    assert.strictEqual(ackOutOfTurn.error, 'NOT_YOUR_TURN');
    console.log('  ✓ Move rejected: server enforced NOT_YOUR_TURN');

    // 6. Stale Move Number Rejection: Bob sends wrong moveNumber
    console.log('\n[TEST 6] Monotonic Move Number Validation');
    const ackStale = await new Promise(resolve => {
      bob.emit('chess_move', {
        matchId,
        move: { from: 'e7', to: 'e5' },
        moveNumber: 99 // stale move number
      }, resolve);
    });
    assert.strictEqual(ackStale.success, false);
    assert.strictEqual(ackStale.error, 'STALE_MOVE_NUMBER');
    console.log('  ✓ Stale moveNumber 99 rejected with STALE_MOVE_NUMBER');

    // 7. Move 2: Bob (Black) plays legal e7 -> e5
    console.log('\n[TEST 7] Legal Move by Black (e7 -> e5)');
    const aliceMovePromise2 = new Promise(resolve => alice.once('chess_move_applied', resolve));

    const ack2 = await new Promise(resolve => {
      bob.emit('chess_move', {
        matchId,
        move: { from: 'e7', to: 'e5', promotion: 'q' },
        moveNumber: 2
      }, resolve);
    });
    assert.strictEqual(ack2.success, true);
    assert.strictEqual(ack2.san, 'e5');

    const moveData2 = await aliceMovePromise2;
    assert.strictEqual(moveData2.turn, 'w');
    assert.strictEqual(moveData2.moveNumber, 3);
    console.log('  ✓ Move 2 applied: turn switched back to White, moveNumber updated to 3');

    // 8. Draw Offer & Acceptance
    console.log('\n[TEST 8] Draw Offer and Mutual Agreement');
    const drawOfferBob = new Promise(resolve => bob.once('chess_draw_offered', resolve));
    alice.emit('chess_draw_offer', { matchId, userId: 'alice' });
    await drawOfferBob;
    console.log('  ✓ Bob received Alice\'s draw offer');

    const gameOverPromiseAlice = new Promise(resolve => alice.once('chess_game_over', resolve));
    const gameOverPromiseBob = new Promise(resolve => bob.once('chess_game_over', resolve));

    bob.emit('chess_draw_response', { matchId, userId: 'bob', accepted: true });

    const [endAlice, endBob] = await Promise.all([gameOverPromiseAlice, gameOverPromiseBob]);
    assert.strictEqual(endAlice.winner, 'draw');
    assert.strictEqual(endBob.winner, 'draw');
    console.log('  ✓ Game concluded with Draw by mutual agreement');

    // 9. Rematch (Swaps White and Black)
    console.log('\n[TEST 9] Rematch Creation & Role Inversion');
    const rematchPromise = new Promise(resolve => alice.once('chess_match_started', resolve));
    bob.emit('chess_rematch', { matchId });

    const rematchData = await rematchPromise;
    assert.notStrictEqual(rematchData.match.matchId, matchId, 'Rematch must create new matchId');
    assert.strictEqual(rematchData.match.whitePlayer.id, 'bob', 'Colors should be swapped in rematch');
    assert.strictEqual(rematchData.match.blackPlayer.id, 'alice');
    assert.strictEqual(rematchData.match.moveNumber, 1);
    console.log('  ✓ Rematch started with reversed player colors');

    // 10. Reconnection / State Sync
    console.log('\n[TEST 10] Active Match Reconnection State Sync (chess_sync)');
    const syncRes = await new Promise(resolve => {
      alice.emit('chess_sync', { chatId }, resolve);
    });
    assert.strictEqual(syncRes.hasActiveMatch, true);
    assert.strictEqual(syncRes.match.matchId, rematchData.match.matchId);
    console.log('  ✓ Active match recovered via chess_sync');

    console.log('\n>>> ALL REAL-TIME MULTIPLAYER TESTS PASSED SUCCESSFULLY! <<<\n');
  } finally {
    alice.disconnect();
    bob.disconnect();
    server.close();
  }
}

runMultiplayerTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Multiplayer test failure:', err);
    process.exit(1);
  });
