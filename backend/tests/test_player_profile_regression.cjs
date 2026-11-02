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

async function runPlayerProfileTests() {
  console.log('================================================================');
  console.log('   PULSECHAT PLAYER PROFILES END-TO-END REGRESSION TEST SUITE   ');
  console.log('================================================================\n');

  await mongoose.connect(config.MONGO_URI);
  console.log('✓ Connected to MongoDB.\n');

  // Create isolated express test app to test /api/zone routes
  const app = express();
  app.use(express.json());
  app.set('io', { emit: () => {}, to: () => ({ emit: () => {} }) });
  app.use('/api/zone', zoneRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/zone`;

  try {
    // 1. Fetch top scores to identify real players in database
    const topScores = await GameScore.find({}).sort({ score: -1, level: -1, gamesPlayed: -1 }).limit(5).lean();
    assert(topScores.length >= 2, 'Must have at least 2 game scores in database for testing.');

    const rank1Score = topScores[0];
    const rank2Score = topScores[1];

    const rank1User = await User.findOne({
      $or: [
        { id: rank1Score.userId },
        ...(mongoose.Types.ObjectId.isValid(rank1Score.userId) ? [{ _id: rank1Score.userId }] : [])
      ]
    }).lean();

    const rank2User = await User.findOne({
      $or: [
        { id: rank2Score.userId },
        ...(mongoose.Types.ObjectId.isValid(rank2Score.userId) ? [{ _id: rank2Score.userId }] : [])
      ]
    }).lean();

    assert(rank1User, `Rank 1 user doc not found for score userId: ${rank1Score.userId}`);
    assert(rank2User, `Rank 2 user doc not found for score userId: ${rank2Score.userId}`);

    // Create valid auth token for requests
    const testToken = jwt.sign(
      { id: rank1User.id, username: rank1User.username, email: rank1User.email },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // =========================================================================
    // TEST GROUP 1: Authentication & Unauthorized Access Safeguards
    // =========================================================================
    console.log('--- TEST GROUP 1: Authentication & Security Guardrails ---');

    // 1.1 Missing token
    const noAuthRes = await fetch(`${baseUrl}/profile/${rank1User.id}`);
    assert.strictEqual(noAuthRes.status, 401, 'Request without token must return 401 Unauthorized');
    console.log('  ✓ 1.1 Unauthenticated request rejected with HTTP 401');

    // 1.2 Invalid token
    const badAuthRes = await fetch(`${baseUrl}/profile/${rank1User.id}`, {
      headers: { Authorization: 'Bearer invalid_signature_token' }
    });
    assert.strictEqual(badAuthRes.status, 401, 'Request with invalid token must return 401 Unauthorized');
    console.log('  ✓ 1.2 Invalid token request rejected with HTTP 401');

    // 1.3 Non-existent player
    const notFoundRes = await fetch(`${baseUrl}/profile/non_existent_user_9999999`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(notFoundRes.status, 404, 'Non-existent player must return 404 Not Found');
    const notFoundData = await notFoundRes.json();
    assert.strictEqual(notFoundData.error, 'Player not found');
    console.log('  ✓ 1.3 Non-existent player safely returns 404 JSON error');

    // =========================================================================
    // TEST GROUP 2: Privacy Verification & Sensitive Field Exclusion
    // =========================================================================
    console.log('\n--- TEST GROUP 2: Privacy Verification & Safe DTO Projection ---');

    const profileRes = await fetch(`${baseUrl}/profile/${rank1User.id}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(profileRes.status, 200, 'Valid player request must return 200 OK');
    const profileData = await profileRes.json();
    assert(profileData.success === true && profileData.player, 'Response must have success: true and player DTO');

    const player = profileData.player;

    // Strict blacklist audit: sensitive fields must NEVER be returned in public player card
    const forbiddenFields = [
      'passwordHash', 'password', 'email', 'phoneNumber', 'phone', 
      'privateKeys', 'identityKey', 'preKeys', 'signedPreKey',
      'otpCode', 'otpExpires', 'pushSubscriptions', 'blockedUsers', 
      'ghostChats', 'isAdmin', 'referralCode', '__v'
    ];

    for (const field of forbiddenFields) {
      assert(
        player[field] === undefined,
        `SECURITY VIOLATION: Sensitive field '${field}' was exposed in public player profile!`
      );
    }
    console.log('  ✓ 2.1 Zero sensitive credentials exposed (passwordHash, email, privateKeys, phone excluded)');

    // =========================================================================
    // TEST GROUP 3: Gaming Identity, Crowns & Global Rank Accuracy
    // =========================================================================
    console.log('\n--- TEST GROUP 3: Gaming Identity, Global Rank & Crowns ---');

    assert.strictEqual(player.globalRank, 1, `Rank 1 player must have globalRank === 1 (got ${player.globalRank})`);
    assert.strictEqual(player.hasKingCrown, true, 'Rank 1 player must have hasKingCrown === true');
    assert.strictEqual(player.hasSilverCrown, false, 'Rank 1 player must not have hasSilverCrown');
    console.log(`  ✓ 3.1 #1 Gold Crown verified: globalRank=1, hasKingCrown=true (pts: ${player.totalScore.toLocaleString()})`);

    // Fetch Rank 2 profile
    const rank2Res = await fetch(`${baseUrl}/profile/${rank2User.id}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const rank2Data = await rank2Res.json();
    const player2 = rank2Data.player;

    assert.strictEqual(player2.globalRank, 2, `Rank 2 player must have globalRank === 2 (got ${player2.globalRank})`);
    assert.strictEqual(player2.hasSilverCrown, true, 'Rank 2 player must have hasSilverCrown === true');
    assert.strictEqual(player2.hasKingCrown, false, 'Rank 2 player must not have hasKingCrown');
    console.log(`  ✓ 3.2 #2 Silver Crown verified: globalRank=2, hasSilverCrown=true (pts: ${player2.totalScore.toLocaleString()})`);

    // Switching between multiple players must return isolated state
    assert.notStrictEqual(player.userId, player2.userId, 'Player 1 and Player 2 must have distinct userIds');
    assert.notStrictEqual(player.displayName, player2.displayName, 'Player 1 and Player 2 must have distinct names');
    console.log('  ✓ 3.3 Profile switching verified: Player 1 and Player 2 return isolated data');

    // =========================================================================
    // TEST GROUP 4: Game-Specific Records & Stat Integrity
    // =========================================================================
    console.log('\n--- TEST GROUP 4: Game-Specific Records & Data-Integrity ---');

    const expectedGames = ['arrow', 'temple', 'candy', 'tapper', 'tictactoe'];
    for (const game of expectedGames) {
      assert(player.gameStats && player.gameStats[game], `Game stats must include entry for '${game}'`);
    }

    assert(typeof player.gameStats.temple.bestDistance === 'number', 'Temple run bestDistance must be a number');
    assert(typeof player.gameStats.temple.totalCoins === 'number', 'Temple run totalCoins must be a number');
    assert(typeof player.gameStats.arrow.maxLevel === 'number', 'Arrow puzzle maxLevel must be a number');
    assert(typeof player.gameStats.candy.maxLevel === 'number', 'Candy crush maxLevel must be a number');
    assert(typeof player.gameStats.tapper.bestScore === 'number', 'Speed tapper bestScore must be a number');
    assert(typeof player.gameStats.tictactoe.wins === 'number', 'TicTacToe wins must be a number');
    assert(typeof player.gameStats.tictactoe.losses === 'number', 'TicTacToe losses must be a number');

    console.log('  ✓ 4.1 All game records present: Temple Run (dist & coins), Arrow (max lvl), Candy (lvl), Tapper (best), Tic-Tac-Toe (W/L)');

    // 4.2 Data Integrity for Rank 1 Player (Legacy Tic-Tac-Toe record)
    assert.strictEqual(player.arrowLevel, 1, `Rank 1 Tic-Tac-Toe player must have arrowLevel === 1, not 215! (got ${player.arrowLevel})`);
    assert.strictEqual(player.gameStats.arrow.maxLevel, 1, 'Arrow puzzle maxLevel must be 1 for Tic-Tac-Toe player');
    assert.strictEqual(player.gameStats.arrow.bestScore, 0, 'Arrow puzzle bestScore must be 0 for Tic-Tac-Toe player');
    assert.strictEqual(player.gameStats.tictactoe.wins, 215, `Tic-Tac-Toe wins must be 215, not 24,659! (got ${player.gameStats.tictactoe.wins})`);
    assert.strictEqual(player.gameStats.tictactoe.losses, 98, `Tic-Tac-Toe losses must be 98 (313-215)! (got ${player.gameStats.tictactoe.losses})`);
    assert.strictEqual(player.gameStats.tictactoe.gamesPlayed, 313, `Tic-Tac-Toe gamesPlayed must be 313, not 0! (got ${player.gameStats.tictactoe.gamesPlayed})`);
    assert.strictEqual(
      player.gameStats.tictactoe.wins + player.gameStats.tictactoe.losses + player.gameStats.tictactoe.draws,
      player.gameStats.tictactoe.gamesPlayed,
      'Tic-Tac-Toe wins + losses + draws must equal gamesPlayed'
    );
    assert.strictEqual(player.gameStats.temple.bestDistance, 0, 'Temple distance must be 0 for unplayed game');
    assert.strictEqual(player.gameStats.temple.bestScore, 0, 'Temple bestScore must be 0 (must not inherit global score)');
    assert.strictEqual(player.gameStats.candy.maxLevel, 1, 'Candy maxLevel must be 1 for unplayed game');
    console.log('  ✓ 4.2 Rank 1 Tic-Tac-Toe data-integrity verified: wins=215, losses=98, gamesPlayed=313 (reconciled), arrowLevel=1 (no leak)');

    // 4.3 Data Integrity for Temple Run player with structured stats (user_1790839774009)
    const templePlayerRes = await fetch(`${baseUrl}/profile/user_1790839774009`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    if (templePlayerRes.status === 200) {
      const templePlayerData = await templePlayerRes.json();
      const tp = templePlayerData.player;
      assert.strictEqual(tp.gameStats.temple.bestDistance, 1308, 'Temple bestDistance must match verified distance 1308');
      assert.strictEqual(tp.gameStats.temple.bestScore, 1308, 'Temple bestScore must be 1308, NOT global aggregate score 11449');
      console.log('  ✓ 4.3 Temple player verified: bestDistance=1308, bestScore=1308 (no global score overwrite)');
    }

    // 4.4 Data Integrity for Legacy Candy Crush player (user_1790222419836)
    const candyPlayerRes = await fetch(`${baseUrl}/profile/user_1790222419836`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    if (candyPlayerRes.status === 200) {
      const candyPlayerData = await candyPlayerRes.json();
      const cp = candyPlayerData.player;
      assert.strictEqual(cp.gameStats.candy.maxLevel, 174, 'Candy maxLevel must be 174');
      assert.strictEqual(cp.arrowLevel, 1, 'Candy player must have arrowLevel 1, not 174');
      assert.strictEqual(cp.gameStats.tictactoe.wins, 0, 'Candy player must have 0 Tic-Tac-Toe wins');
      console.log('  ✓ 4.4 Legacy Candy player verified: candy maxLevel=174, arrowLevel=1 (no cross-contamination)');
    }

    // =========================================================================
    // TEST GROUP 5: Verifiable Achievements System
    // =========================================================================
    console.log('\n--- TEST GROUP 5: Verifiable Achievements System ---');

    assert(Array.isArray(player.achievements), 'Achievements must be an array');
    console.log(`  ✓ Unlocked achievements for ${player.displayName}: ${player.achievements.length}`);

    // If score >= 100, Centurion must be present
    if (player.totalScore >= 100) {
      const centurion = player.achievements.find(a => a.id === 'centurion');
      assert(centurion, 'Player with 100+ points must have Centurion achievement');
      assert.strictEqual(centurion.title, 'Centurion');
      console.log('    ✓ Centurion achievement unlocked');
    }

    // If score >= 500, High Roller must be present
    if (player.totalScore >= 500) {
      const highRoller = player.achievements.find(a => a.id === 'high_roller');
      assert(highRoller, 'Player with 500+ points must have High Roller achievement');
      assert.strictEqual(highRoller.title, 'High Roller');
      console.log('    ✓ High Roller achievement unlocked');
    }

    // If score >= 1000, Grand Master must be present
    if (player.totalScore >= 1000) {
      const grandMaster = player.achievements.find(a => a.id === 'grand_master');
      assert(grandMaster, 'Player with 1000+ points must have Grand Master achievement');
      assert.strictEqual(grandMaster.title, 'Grand Master');
      console.log('    ✓ Grand Master achievement unlocked');
    }

    // AI Slayer must be unlocked for Ｒ𝓲𝐓ｉЌ (215 wins >= 3)
    const aiSlayer = player.achievements.find(a => a.id === 'ai_slayer');
    assert(aiSlayer, 'Player with 215 Tic-Tac-Toe wins must have AI Slayer achievement');
    console.log('    ✓ AI Slayer achievement unlocked (215 verified wins >= 3)');

    // Puzzle Tactician must NOT be unlocked for Ｒ𝓲𝐓ｉЌ (arrow level is 1, not >= 5)
    const puzzleTactician = player.achievements.find(a => a.id === 'puzzle_tactician');
    assert(!puzzleTactician, 'Player with Arrow level 1 must NOT have Puzzle Tactician achievement');
    console.log('    ✓ Puzzle Tactician correctly NOT awarded (verified arrowLevel=1 < 5)');

    // Jungle Raider must NOT be unlocked (temple distance is 0, not >= 300)
    const jungleRaider = player.achievements.find(a => a.id === 'jungle_raider');
    assert(!jungleRaider, 'Player with Temple distance 0 must NOT have Jungle Raider achievement');
    console.log('    ✓ Jungle Raider correctly NOT awarded (verified templeDistance=0 < 300)');

    // =========================================================================
    // TEST GROUP 6: Leaderboard List & Player Profile Continuity
    // =========================================================================
    console.log('\n--- TEST GROUP 6: Leaderboard Click-to-Profile Identifier Continuity ---');

    const lbRes = await fetch(`${baseUrl}/leaderboard?game=all`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(lbRes.status, 200, 'Leaderboard must return 200 OK');
    const lbList = await lbRes.json();
    assert(Array.isArray(lbList) && lbList.length > 0, 'Leaderboard must return non-empty array');

    const topPlayerRow = lbList[0];
    const topPlayerIdentifier = topPlayerRow.userId || topPlayerRow.id;
    assert(topPlayerIdentifier, 'Leaderboard row must contain identifiable userId or id');

    // Fetch profile using the exact identifier passed from leaderboard row click
    const linkedProfileRes = await fetch(`${baseUrl}/profile/${encodeURIComponent(topPlayerIdentifier)}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(linkedProfileRes.status, 200, 'Profile fetch using leaderboard row identifier must succeed');
    const linkedData = await linkedProfileRes.json();
    assert.strictEqual(linkedData.player.displayName, topPlayerRow.displayName, 'Resolved profile name must match leaderboard row name');
    console.log(`  ✓ 6.1 Leaderboard row identifier '${topPlayerIdentifier}' matches player profile '${linkedData.player.displayName}'`);

    console.log('\n================================================================');
    console.log('   ALL 6 TEST GROUPS PASSED WITH ZERO ERRORS (EXIT CODE 0)      ');
    console.log('================================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runPlayerProfileTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
