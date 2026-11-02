/**
 * forensic_test_scoring_contract.cjs
 * Comprehensive Database Comparison & Leaderboard Scoring Contract Forensic Test.
 * 
 * Verifies:
 * 1. Before vs After database state for Chat Chess vs App Chess.
 * 2. Proves that completing a Chat Chess match modifies ZERO competitive DB records.
 * 3. Proves that spoofed submissions (with matchId, chatId, or mode flags) are rejected with HTTP 400.
 * 4. Proves that legitimate App Chess win increments competitive score exactly once.
 * 5. Proves replay-attack idempotency and anti-cheat score caps.
 */

const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const config = require('../config');
const User = require('../models/User');
const GameScore = require('../models/GameScore');
const zoneRoutes = require('../routes/zone');
const chessMatchManager = require('../chat/chessMatchManager');

async function runScoringContractTests() {
  console.log('================================================================');
  console.log('   PULSECHAT CHESS LEADERBOARD SCORING CONTRACT FORENSICS      ');
  console.log('================================================================\n');

  await mongoose.connect(config.MONGO_URI);
  console.log('✓ Connected to MongoDB.\n');

  const app = express();
  app.use(express.json());
  app.set('io', { emit: () => {}, to: () => ({ emit: () => {} }) });
  app.use('/api/zone', zoneRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/zone`;

  const aliceId = `alice_chess_${Date.now()}`;
  const bobId = `bob_chess_${Date.now()}`;
  let aliceUser, bobUser;

  try {
    aliceUser = await User.create({
      id: aliceId,
      username: `alice_${Date.now().toString(36)}`,
      email: `alice_${Date.now()}@example.com`,
      displayName: 'Alice Champion',
      passwordHash: 'testhashed123'
    });

    bobUser = await User.create({
      id: bobId,
      username: `bob_${Date.now().toString(36)}`,
      email: `bob_${Date.now()}@example.com`,
      displayName: 'Bob Challenger',
      passwordHash: 'testhashed123'
    });

    const aliceToken = jwt.sign(
      { id: aliceUser.id, username: aliceUser.username, email: aliceUser.email },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // =========================================================================
    // STEP 1: CAPTURE BASELINE BEFORE-STATE
    // =========================================================================
    console.log('[STEP 1] Baseline Database State Before Any Games');
    const beforeAliceDoc = await GameScore.findOne({ userId: aliceId }).lean();
    const beforeBobDoc = await GameScore.findOne({ userId: bobId }).lean();
    const beforeLeaderboard = await fetch(`${baseUrl}/leaderboard?game=chess`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    }).then(r => r.json());

    console.log('  Alice GameScore Doc:', beforeAliceDoc ? 'EXISTS' : 'NONE (null)');
    console.log('  Bob   GameScore Doc:', beforeBobDoc ? 'EXISTS' : 'NONE (null)');
    console.log('  Chess Leaderboard Entries:', beforeLeaderboard.length);
    assert.strictEqual(beforeAliceDoc, null, 'Alice should have no score record');
    assert.strictEqual(beforeBobDoc, null, 'Bob should have no score record');

    // =========================================================================
    // STEP 2: CONDUCT COMPLETE 1V1 CHAT CHESS MATCH
    // =========================================================================
    console.log('\n[STEP 2] Simulating Real 1v1 Chat Chess Match (Alice vs Bob)');
    const chatId = `${aliceId}_${bobId}`;
    const chatMatch = chessMatchManager.createMatch({
      chatId,
      whitePlayer: { id: aliceId, name: 'Alice' },
      blackPlayer: { id: bobId, name: 'Bob' }
    });
    console.log(`  Match Created: ${chatMatch.matchId} in Chat: ${chatId}`);

    // Play Scholar's mate: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    chessMatchManager.applyMove(chatMatch.matchId, aliceId, { from: 'e2', to: 'e4' }, 1);
    chessMatchManager.applyMove(chatMatch.matchId, bobId, { from: 'e7', to: 'e5' }, 2);
    chessMatchManager.applyMove(chatMatch.matchId, aliceId, { from: 'f1', to: 'c4' }, 3);
    chessMatchManager.applyMove(chatMatch.matchId, bobId, { from: 'b8', to: 'c6' }, 4);
    chessMatchManager.applyMove(chatMatch.matchId, aliceId, { from: 'd1', to: 'h5' }, 5);
    chessMatchManager.applyMove(chatMatch.matchId, bobId, { from: 'g8', to: 'f6' }, 6);
    const mateResult = chessMatchManager.applyMove(chatMatch.matchId, aliceId, { from: 'h5', to: 'f7' }, 7);

    assert.strictEqual(mateResult.match.status, 'checkmate', 'Chat match must be checkmate');
    assert.strictEqual(mateResult.match.winner, aliceId, 'Alice must be winner');
    console.log(`  Chat Match Concluded: Status=${mateResult.match.status}, Winner=${mateResult.match.winner}`);

    // =========================================================================
    // STEP 3: PROVE CHAT CHESS MATCH DID NOT TOUCH ANY COMPETITIVE DB RECORDS
    // =========================================================================
    console.log('\n[STEP 3] Database Invariance Verification: Post-Chat Match Check');
    const midAliceDoc = await GameScore.findOne({ userId: aliceId }).lean();
    const midBobDoc = await GameScore.findOne({ userId: bobId }).lean();

    console.log('  Alice GameScore Doc post-chat match:', midAliceDoc ? 'MODIFIED ✗' : 'STRICTLY NULL ✓');
    console.log('  Bob   GameScore Doc post-chat match:', midBobDoc ? 'MODIFIED ✗' : 'STRICTLY NULL ✓');
    assert.strictEqual(midAliceDoc, null, 'Chat Chess win must NOT create or alter Alice GameScore');
    assert.strictEqual(midBobDoc, null, 'Chat Chess loss must NOT create or alter Bob GameScore');

    // =========================================================================
    // STEP 4: ANTI-SPOOFING & CASUAL GAME ISOLATION ENFORCEMENT
    // =========================================================================
    console.log('\n[STEP 4] Spoofing Attack Vector Audit: Attempting to submit Chat Game as App Score');

    // Attack 1: Submitting with matchId
    const attack1 = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        matchId: chatMatch.matchId
      })
    });
    console.log(`  Attack 1 (Payload with matchId): HTTP ${attack1.status}`);
    assert.strictEqual(attack1.status, 400);
    const att1Data = await attack1.json();
    assert.strictEqual(att1Data.error, 'CASUAL_GAME_ISOLATION');

    // Attack 2: Submitting with chatId
    const attack2 = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        chatId
      })
    });
    console.log(`  Attack 2 (Payload with chatId): HTTP ${attack2.status}`);
    assert.strictEqual(attack2.status, 400);

    // Attack 3: Submitting with gameMode='friend'
    const attack3 = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        gameMode: 'friend'
      })
    });
    console.log(`  Attack 3 (Payload with gameMode='friend'): HTTP ${attack3.status}`);
    assert.strictEqual(attack3.status, 400);

    // Attack 4: Submitting disguised payload referencing active match
    const attack4 = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        stats: { matchId: chatMatch.matchId }
      })
    });
    console.log(`  Attack 4 (Nested stats.matchId): HTTP ${attack4.status}`);
    assert.strictEqual(attack4.status, 400);
    console.log('  ✓ All 4 spoofing vectors authoritatively rejected by backend with CASUAL_GAME_ISOLATION');

    // =========================================================================
    // STEP 5: LEGITIMATE APP CHESS (VS COMPUTER) SCORING
    // =========================================================================
    console.log('\n[STEP 5] Mode A: Legitimate App Chess (vs Computer AI) Submission');
    const validSubId = `sub_legit_app_chess_${Date.now()}`;
    const legitRes = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        stats: { outcome: 'win' },
        submissionId: validSubId
      })
    });
    assert.strictEqual(legitRes.status, 200);
    const legitData = await legitRes.json();
    assert.strictEqual(legitData.success, true);
    console.log(`  Legitimate Submission: HTTP 200, score=${legitData.score}`);

    // Verify DB state after legitimate win
    const postLegitDoc = await GameScore.findOne({ userId: aliceId }).lean();
    assert.ok(postLegitDoc, 'GameScore must now exist for Alice');
    assert.strictEqual(postLegitDoc.score, 300, 'Score must be 300');
    assert.strictEqual(postLegitDoc.gameStats.chess.bestScore, 300);
    assert.strictEqual(postLegitDoc.gameStats.chess.wins, 1);
    assert.strictEqual(postLegitDoc.gameStats.chess.maxLevel, 3);
    console.log('  ✓ GameScore created: totalScore=300, chess.bestScore=300, chess.wins=1, chess.maxLevel=3');

    // =========================================================================
    // STEP 6: REPLAY ATTACK IDEMPOTENCY
    // =========================================================================
    console.log('\n[STEP 6] Replay Attack Test: Submitting identical submissionId');
    const replayRes = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        stats: { outcome: 'win' },
        submissionId: validSubId
      })
    });
    assert.strictEqual(replayRes.status, 200);
    const replayData = await replayRes.json();
    assert.strictEqual(replayData.duplicate, true, 'Must report duplicate: true');
    console.log(`  Replay Submission Handled: duplicate=${replayData.duplicate}`);

    const postReplayDoc = await GameScore.findOne({ userId: aliceId }).lean();
    assert.strictEqual(postReplayDoc.score, 300, 'Score must NOT double count on replay');
    assert.strictEqual(postReplayDoc.gameStats.chess.wins, 1, 'Wins must NOT double count on replay');
    console.log('  ✓ Verified: Idempotency prevents double-counting (score stays 300, wins stays 1)');

    // =========================================================================
    // STEP 7: ANTI-CHEAT LEVEL CAP VERIFICATION
    // =========================================================================
    console.log('\n[STEP 7] Anti-Cheat Verification: Exceeding Max Score Cap for Level');
    const cheatRes = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 99999, // Exceeds level 2 cap of 200
        level: 2,
        stats: { outcome: 'win' },
        submissionId: `sub_cheat_${Date.now()}`
      })
    });
    console.log(`  Cheated Score Submission: HTTP ${cheatRes.status}`);
    assert.strictEqual(cheatRes.status, 400);
    const cheatData = await cheatRes.json();
    assert.strictEqual(cheatData.error, 'SCORE_EXCEEDS_MAX_LEVEL');
    console.log('  ✓ Verified: Anti-cheat rejected score exceeding level cap with SCORE_EXCEEDS_MAX_LEVEL');

    // =========================================================================
    // STEP 8: LEADERBOARD VISIBILITY AUDIT
    // =========================================================================
    console.log('\n[STEP 8] Final Leaderboard State');
    const afterLeaderboard = await fetch(`${baseUrl}/leaderboard?game=chess`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    }).then(r => r.json());

    const aliceEntry = afterLeaderboard.find(e => e.userId === aliceId);
    const bobEntry = afterLeaderboard.find(e => e.userId === bobId);

    console.log(`  Alice Leaderboard Entry: Rank #${afterLeaderboard.indexOf(aliceEntry) + 1}, Score=${aliceEntry?.score}, Detail=${aliceEntry?.detail}`);
    console.log(`  Bob Leaderboard Entry: ${bobEntry ? 'EXISTS ✗' : 'ABSENT (Strict Isolation Verified) ✓'}`);
    assert.ok(aliceEntry, 'Alice must appear on leaderboard');
    assert.strictEqual(bobEntry, undefined, 'Bob must NOT appear on leaderboard from casual chat match');

    console.log('\n================================================================');
    console.log('   BEFORE VS AFTER DATABASE COMPARISON SUMMARY                   ');
    console.log('================================================================');
    console.log('Metric                   | Before All | Post Chat Match | Post Legit App Win');
    console.log('-------------------------+------------+-----------------+--------------------');
    console.log(`Alice totalScore         | 0          | 0 (No Change)   | 300 (+300)`);
    console.log(`Alice chess.wins         | 0          | 0 (No Change)   | 1 (+1)`);
    console.log(`Alice Leaderboard Status | Unranked   | Unranked        | Ranked (Score 300)`);
    console.log(`Bob totalScore           | 0          | 0 (No Change)   | 0 (No Change)`);
    console.log(`Bob Leaderboard Status   | Unranked   | Unranked        | Unranked`);
    console.log('================================================================\n');
    console.log('>>> ALL LEADERBOARD SCORING CONTRACT TESTS PASSED! <<<\n');
  } finally {
    if (aliceUser) {
      await User.deleteOne({ id: aliceId });
      await GameScore.deleteOne({ userId: aliceId });
    }
    if (bobUser) {
      await User.deleteOne({ id: bobId });
      await GameScore.deleteOne({ userId: bobId });
    }
    server.close();
    await mongoose.disconnect();
  }
}

runScoringContractTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Forensic test failure:', err);
    process.exit(1);
  });
