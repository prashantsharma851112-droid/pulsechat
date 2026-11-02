/**
 * chessMatchManager.js
 * Authoritative Server-Side 1v1 Chess Match State Manager for PulseChat.
 * Validates every move with chess.js, enforces turns, sequential move numbers,
 * prevents illegal/stale moves, and manages ephemeral match TTLs.
 */

const { Chess } = require('chess.js');

const activeMatches = new Map(); // matchId -> matchState
const chatToMatchMap = new Map(); // chatId -> matchId
const MATCH_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours idle TTL

/**
 * Sweeps inactive matches exceeding TTL.
 */
function sweepStaleMatches() {
  const now = Date.now();
  for (const [matchId, match] of activeMatches.entries()) {
    if (now - (match.lastMoveAt || match.createdAt) > MATCH_TTL_MS) {
      chatToMatchMap.delete(match.chatId);
      activeMatches.delete(matchId);
    }
  }
}
setInterval(sweepStaleMatches, 15 * 60 * 1000);

function createMatch({ chatId, whitePlayer, blackPlayer }) {
  const matchId = `chess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const chess = new Chess();

  const match = {
    matchId,
    chatId,
    whitePlayer: {
      id: String(whitePlayer.id),
      name: whitePlayer.name || 'White',
      avatar: whitePlayer.avatar || ''
    },
    blackPlayer: {
      id: String(blackPlayer.id),
      name: blackPlayer.name || 'Black',
      avatar: blackPlayer.avatar || ''
    },
    fen: chess.fen(),
    turn: 'w',
    moveNumber: 1,
    history: [], // array of { from, to, promotion, san, color, moveNumber, timestamp }
    status: 'active', // 'active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned', 'abandoned'
    winner: null, // userId or 'draw' or null
    statusReason: null,
    inCheck: false,
    drawOfferFrom: null,
    createdAt: Date.now(),
    lastMoveAt: Date.now()
  };

  activeMatches.set(matchId, match);
  chatToMatchMap.set(chatId, matchId);
  return match;
}

function getMatch(matchId) {
  return activeMatches.get(matchId) || null;
}

function getMatchByChatId(chatId) {
  const matchId = chatToMatchMap.get(chatId);
  return matchId ? activeMatches.get(matchId) || null : null;
}

/**
 * Authoritatively validates and applies a chess move.
 */
function applyMove(matchId, userId, movePayload, moveNumber) {
  const match = activeMatches.get(matchId);
  if (!match) {
    return { success: false, error: 'MATCH_NOT_FOUND' };
  }

  if (match.status !== 'active' && match.status !== 'check') {
    return { success: false, error: 'MATCH_ALREADY_FINISHED', status: match.status };
  }

  const strUserId = String(userId);
  const expectedPlayerId = match.turn === 'w' ? match.whitePlayer.id : match.blackPlayer.id;

  // 1. Verify player turn identity
  if (strUserId !== expectedPlayerId) {
    return { success: false, error: 'NOT_YOUR_TURN' };
  }

  // 2. Verify sequential monotonic moveNumber
  if (typeof moveNumber === 'number' && moveNumber !== match.moveNumber) {
    return { success: false, error: 'STALE_MOVE_NUMBER', expectedMoveNumber: match.moveNumber };
  }

  // 3. Validate move legally using server's Chess instance
  let chess;
  try {
    chess = new Chess(match.fen);
  } catch (err) {
    return { success: false, error: 'INVALID_BOARD_STATE' };
  }

  let executedMove = null;
  try {
    executedMove = chess.move({
      from: movePayload.from,
      to: movePayload.to,
      promotion: movePayload.promotion || 'q'
    });
  } catch (e) {
    return { success: false, error: 'ILLEGAL_MOVE', details: e.message };
  }

  if (!executedMove) {
    return { success: false, error: 'ILLEGAL_MOVE' };
  }

  // 4. Update Authoritative Match State
  match.fen = chess.fen();
  match.turn = chess.turn();
  match.inCheck = chess.inCheck();
  match.lastMoveAt = Date.now();
  match.drawOfferFrom = null; // Any move cancels existing draw offers

  const historyEntry = {
    from: executedMove.from,
    to: executedMove.to,
    promotion: executedMove.promotion || null,
    san: executedMove.san,
    color: executedMove.color,
    moveNumber: match.moveNumber,
    timestamp: Date.now()
  };
  match.history.push(historyEntry);
  match.moveNumber += 1;

  // 5. Evaluate Game Over conditions
  if (chess.isCheckmate()) {
    match.status = 'checkmate';
    match.winner = strUserId; // The player who just delivered checkmate wins
    match.statusReason = `Checkmate! ${strUserId === match.whitePlayer.id ? match.whitePlayer.name : match.blackPlayer.name} wins!`;
  } else if (chess.isStalemate()) {
    match.status = 'stalemate';
    match.winner = 'draw';
    match.statusReason = 'Draw by Stalemate (no legal moves)';
  } else if (chess.isThreefoldRepetition()) {
    match.status = 'draw';
    match.winner = 'draw';
    match.statusReason = 'Draw by Threefold Repetition';
  } else if (chess.isInsufficientMaterial()) {
    match.status = 'draw';
    match.winner = 'draw';
    match.statusReason = 'Draw by Insufficient Material';
  } else if (chess.isDraw()) {
    match.status = 'draw';
    match.winner = 'draw';
    match.statusReason = 'Draw (50-move rule)';
  } else if (match.inCheck) {
    match.status = 'check';
    match.statusReason = `${match.turn === 'w' ? 'White' : 'Black'} is in Check!`;
  } else {
    match.status = 'active';
    match.statusReason = null;
  }

  return {
    success: true,
    match,
    move: executedMove,
    san: executedMove.san
  };
}

/**
 * Handle resignation by a player.
 */
function resignMatch(matchId, userId) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'MATCH_NOT_FOUND' };
  if (match.status !== 'active' && match.status !== 'check') {
    return { success: false, error: 'MATCH_ALREADY_FINISHED' };
  }

  const strUserId = String(userId);
  const isWhite = strUserId === match.whitePlayer.id;
  const isBlack = strUserId === match.blackPlayer.id;

  if (!isWhite && !isBlack) {
    return { success: false, error: 'NOT_A_MATCH_PARTICIPANT' };
  }

  match.status = 'resigned';
  match.winner = isWhite ? match.blackPlayer.id : match.whitePlayer.id;
  const resignerName = isWhite ? match.whitePlayer.name : match.blackPlayer.name;
  const winnerName = isWhite ? match.blackPlayer.name : match.whitePlayer.name;
  match.statusReason = `${resignerName} resigned. ${winnerName} wins!`;
  match.lastMoveAt = Date.now();

  return { success: true, match };
}

/**
 * Handle draw offer.
 */
function offerDraw(matchId, userId) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'MATCH_NOT_FOUND' };
  match.drawOfferFrom = String(userId);
  return { success: true, match };
}

/**
 * Handle draw response.
 */
function respondDraw(matchId, userId, accepted) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'MATCH_NOT_FOUND' };

  if (!accepted) {
    match.drawOfferFrom = null;
    return { success: true, accepted: false, match };
  }

  match.status = 'draw';
  match.winner = 'draw';
  match.statusReason = 'Match drawn by mutual agreement';
  match.drawOfferFrom = null;
  match.lastMoveAt = Date.now();
  return { success: true, accepted: true, match };
}

/**
 * Reset match for a rematch, swapping colors.
 */
function createRematch(matchId) {
  const oldMatch = activeMatches.get(matchId);
  if (!oldMatch) return null;

  // Swap colors
  const newWhite = oldMatch.blackPlayer;
  const newBlack = oldMatch.whitePlayer;

  return createMatch({
    chatId: oldMatch.chatId,
    whitePlayer: newWhite,
    blackPlayer: newBlack
  });
}

module.exports = {
  createMatch,
  getMatch,
  getMatchByChatId,
  applyMove,
  resignMatch,
  offerDraw,
  respondDraw,
  createRematch
};
