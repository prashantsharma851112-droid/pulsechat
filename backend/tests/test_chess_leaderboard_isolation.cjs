/**
 * test_chess_leaderboard_isolation.cjs
 * Verifies:
 * 1. Mode A (App / Pulse Zone Computer Chess) properly updates GameScore,
 *    gameStats.chess, user profile, and chess leaderboard category.
 * 2. Mode B (Chat Games 1v1 Chess) has STRICT ISOLATION:
 *    Zero impact on GameScore, anti-replay, or competitive leaderboards.
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const config = require('../config');
const User = require('../models/User');
const GameScore = require('../models/GameScore');
const zoneRoutes = require('../routes/zone');

async function runIsolationTests() {
  console.log('================================================================');
  console.log('   PULSECHAT 3D CHESS: LEADERBOARD & STRICT ISOLATION TEST       ');
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

  const testUserId = `test_chess_isolation_${Date.now()}`;
  let createdUser = null;

  try {
    // Create test user in DB
    createdUser = await User.create({
      id: testUserId,
      username: `chess_tester_${Date.now().toString(36)}`,
      email: `chess_${Date.now()}@example.com`,
      displayName: 'Chess Master Tester',
      passwordHash: 'testhashedpassword123'
    });

    const testToken = jwt.sign(
      { id: createdUser.id, username: createdUser.username, email: createdUser.email },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // =========================================================================
    // 1. TEST MODE A: Pulse Zone Arcade / Computer Chess Scoring
    // =========================================================================
    console.log('[TEST 1] Mode A: Submit Chess Win to /api/zone/game-score');
    const submissionId = `sub_chess_${Date.now()}`;
    const scoreRes = await fetch(`${baseUrl}/game-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`
      },
      body: JSON.stringify({
        gameName: '3D Chess',
        score: 300,
        level: 3,
        stats: { outcome: 'win' },
        submissionId
      })
    });

    assert.strictEqual(scoreRes.status, 200, 'Score submission should return 200');
    const scoreData = await scoreRes.json();
    assert.strictEqual(scoreData.success, true, 'Score submission should succeed');
    console.log('  ✓ Mode A score submitted successfully');

    // Verify GameScore document has structured gameStats.chess
    const scoreDoc = await GameScore.findOne({ userId: testUserId }).lean();
    assert.ok(scoreDoc, 'GameScore document must exist');
    assert.ok(scoreDoc.gameStats?.chess, 'gameStats.chess must exist in document');
    assert.strictEqual(scoreDoc.gameStats.chess.bestScore, 300, 'bestScore should be 300');
    assert.strictEqual(scoreDoc.gameStats.chess.maxLevel, 3, 'maxLevel should be 3');
    assert.strictEqual(scoreDoc.gameStats.chess.wins, 1, 'wins should be 1');
    console.log('  ✓ GameScore.gameStats.chess verified with bestScore: 300, maxLevel: 3, wins: 1');

    // Verify /api/zone/leaderboard?game=chess
    console.log('\n[TEST 2] Verify Chess Category Leaderboard');
    const lbRes = await fetch(`${baseUrl}/leaderboard?game=chess`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(lbRes.status, 200);
    const lbData = await lbRes.json();
    assert.ok(Array.isArray(lbData), 'Leaderboard must be an array');
    const myEntry = lbData.find(e => e.userId === testUserId);
    assert.ok(myEntry, 'Player must appear on chess leaderboard');
    assert.strictEqual(myEntry.score, 300, 'Leaderboard display score should be 300');
    assert.strictEqual(myEntry.detail, 'Level 3 • 1W', 'Leaderboard detail must format Level and Wins');
    console.log('  ✓ Chess Leaderboard verified with correct rank & detail');

    // Verify /api/zone/profile/:userId
    console.log('\n[TEST 3] Verify Player Profile with Chess Stats & Achievements');
    const profRes = await fetch(`${baseUrl}/profile/${testUserId}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(profRes.status, 200);
    const profData = await profRes.json();
    assert.strictEqual(profData.success, true);
    assert.strictEqual(profData.player.gameStats.chess.bestScore, 300);
    assert.strictEqual(profData.player.gameStats.chess.wins, 1);
    const hasAchievement = profData.player.achievements.some(a => a.id === 'grandmaster_initiate');
    assert.ok(hasAchievement, 'Player should have Grandmaster Initiate achievement for winning against AI');
    console.log('  ✓ Player Profile verified with chess stats and Grandmaster Initiate achievement');

    // =========================================================================
    // 2. TEST MODE B: STRICT CHAT GAME ISOLATION AUDIT
    // =========================================================================
    console.log('\n[TEST 4] Mode B: Strict Chat Games Isolation Audit');

    // Static code audit on ChatChessModal.jsx
    const chatChessPath = path.resolve(__dirname, '../../frontend/src/components/chat/ChatChessModal.jsx');
    assert.ok(fs.existsSync(chatChessPath), 'ChatChessModal.jsx must exist');
    const chatChessContent = fs.readFileSync(chatChessPath, 'utf8');

    // Prohibit competitive score recording in Chat Game
    assert.ok(!chatChessContent.includes('/api/zone/game-score'), 'ChatChessModal must NOT call /api/zone/game-score');
    assert.ok(!chatChessContent.includes('recordLocalGameScore'), 'ChatChessModal must NOT record to local arcade bests');
    assert.ok(!chatChessContent.includes('onScoreUpdate'), 'ChatChessModal must NOT have onScoreUpdate prop');

    console.log('  ✓ ChatChessModal.jsx strictly isolated: 0 calls to /api/zone/game-score or recordLocalGameScore');

    console.log('\n>>> ALL CHESS LEADERBOARD & ISOLATION TESTS PASSED! <<<\n');
  } finally {
    // Cleanup test data
    if (createdUser) {
      await User.deleteOne({ id: testUserId });
      await GameScore.deleteOne({ userId: testUserId });
    }
    server.close();
    await mongoose.disconnect();
  }
}

runIsolationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failure:', err);
    process.exit(1);
  });
