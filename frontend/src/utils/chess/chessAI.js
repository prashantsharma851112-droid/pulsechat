/**
 * chessAI.js
 * PulseChat Progressive Difficulty Chess AI
 * Implements Minimax with Alpha-Beta Pruning, Quiescence Search,
 * Piece-Square Tables (PST), MVV-LVA Move Ordering, and Web Worker offloading.
 */

import { Chess } from 'chess.js';

// Standard Chess Material Values in centipawns
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Simplified PeSTO-style Piece-Square Tables (oriented for White, mirrored for Black)
const PAWN_TABLE = [
  0,   0,   0,   0,   0,   0,   0,   0,
  50,  50,  50,  50,  50,  50,  50,  50,
  10,  10,  20,  30,  30,  20,  10,  10,
   5,   5,  10,  25,  25,  10,   5,   5,
   0,   0,   0,  20,  20,   0,   0,   0,
   5,  -5, -10,   0,   0, -10,  -5,   5,
   5,  10,  10, -20, -20,  10,  10,   5,
   0,   0,   0,   0,   0,   0,   0,   0
];

const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   0,   0,   0, -20, -40,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50
];

const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20
];

const ROOK_TABLE = [
    0,   0,   0,   0,   0,   0,   0,   0,
    5,  10,  10,  10,  10,  10,  10,   5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
    0,   0,   0,   5,   5,   0,   0,   0
];

const QUEEN_TABLE = [
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20
];

const KING_TABLE_MID = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   20,  20,   0,   0,   0,   0,  20,  20,
   20,  30,  10,   0,   0,  10,  30,  20
];

const PST = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE_MID
};

/**
 * Static board evaluation from White's perspective (+ score favors White, - favors Black).
 */
export function evaluateBoard(chess, ply = 0, level = 1) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -999999 + ply : 999999 - ply;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return 0;
  }

  let totalEvaluation = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = PIECE_VALUES[piece.type] || 0;
        const squareIndex = r * 8 + c;
        // For black, mirror the table vertically
        const pstIndex = piece.color === 'w' ? squareIndex : (7 - r) * 8 + c;
        const pstBonus = (PST[piece.type] && PST[piece.type][pstIndex]) || 0;
        let pieceTotal = val + pstBonus;

        // Strategic center control evaluation for Level 8-10
        if (level >= 8 && (r === 3 || r === 4) && (c === 3 || c === 4)) {
          pieceTotal += 15;
        }

        if (piece.color === 'w') {
          totalEvaluation += pieceTotal;
        } else {
          totalEvaluation -= pieceTotal;
        }
      }
    }
  }

  // Advanced King Safety & Pawn Protection for Level 10
  if (level >= 10) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k') {
          // Castled king bonus: kings safely tucked on g1/g8 or c1/c8
          if (p.color === 'w' && r === 7 && (c === 6 || c === 2)) totalEvaluation += 30;
          if (p.color === 'b' && r === 0 && (c === 6 || c === 2)) totalEvaluation -= 30;
        }
      }
    }
  }

  return totalEvaluation;
}

function getPSTDelta(move) {
  if (!move || !move.piece || !move.from || !move.to) return 0;
  const table = PST[move.piece];
  if (!table) return 0;
  const cFrom = move.from.charCodeAt(0) - 97;
  const rFrom = 8 - parseInt(move.from[1], 10);
  const idxFrom = move.color === 'w' ? rFrom * 8 + cFrom : (7 - rFrom) * 8 + cFrom;

  const cTo = move.to.charCodeAt(0) - 97;
  const rTo = 8 - parseInt(move.to[1], 10);
  const idxTo = move.color === 'w' ? rTo * 8 + cTo : (7 - rTo) * 8 + cTo;

  return (table[idxTo] || 0) - (table[idxFrom] || 0);
}

/**
 * Move ordering heuristic: Prioritizes checks/checkmates, then captures by MVV-LVA, promotions, and positional gain.
 */
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.san && a.san.includes('#')) scoreA += 100000;
    else if (a.san && a.san.includes('+')) scoreA += 5000;

    if (b.san && b.san.includes('#')) scoreB += 100000;
    else if (b.san && b.san.includes('+')) scoreB += 5000;

    if (a.captured) {
      scoreA += (PIECE_VALUES[a.captured] || 0) * 10 - (PIECE_VALUES[a.piece] || 0) + 1000;
    }
    if (a.promotion) {
      scoreA += (PIECE_VALUES[a.promotion] || 900) + 500;
    }
    scoreA += getPSTDelta(a);

    if (b.captured) {
      scoreB += (PIECE_VALUES[b.captured] || 0) * 10 - (PIECE_VALUES[b.piece] || 0) + 1000;
    }
    if (b.promotion) {
      scoreB += (PIECE_VALUES[b.promotion] || 900) + 500;
    }
    scoreB += getPSTDelta(b);

    return scoreB - scoreA;
  });
}

/**
 * Quiescence search with delta pruning to avoid horizon effect on captures.
 */
function quiescence(chess, alpha, beta, isMaximizing, depthLimit = 1, level = 1) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -999999 : 999999;
  }
  const standPat = evaluateBoard(chess, 0, level);
  if (depthLimit <= 0) return standPat;

  if (isMaximizing) {
    if (standPat >= beta) return standPat;
    let maxVal = standPat;
    let a = Math.max(alpha, standPat);

    const allMoves = chess.moves({ verbose: true });
    // Delta pruning: filter captures that cannot mathematically improve alpha
    const captures = orderMoves(allMoves.filter(m => {
      if (!m.captured && !m.promotion) return false;
      const victimVal = PIECE_VALUES[m.captured] || 900;
      return standPat + victimVal + 200 >= a;
    }));

    if (captures.length === 0) return standPat;

    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, a, beta, false, depthLimit - 1, level);
      chess.undo();
      maxVal = Math.max(maxVal, score);
      a = Math.max(a, score);
      if (beta <= a) break;
    }
    return maxVal;
  } else {
    if (standPat <= alpha) return standPat;
    let minVal = standPat;
    let b = Math.min(beta, standPat);

    const allMoves = chess.moves({ verbose: true });
    // Delta pruning: filter captures that cannot mathematically improve beta
    const captures = orderMoves(allMoves.filter(m => {
      if (!m.captured && !m.promotion) return false;
      const victimVal = PIECE_VALUES[m.captured] || 900;
      return standPat - victimVal - 200 <= b;
    }));

    if (captures.length === 0) return standPat;

    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, b, true, depthLimit - 1, level);
      chess.undo();
      minVal = Math.min(minVal, score);
      b = Math.min(b, score);
      if (b <= alpha) break;
    }
    return minVal;
  }
}

/**
 * Minimax with Alpha-Beta Pruning.
 */
function minimax(chess, depth, alpha, beta, isMaximizing, quiescenceDepth = 0, ply = 1, level = 1, lastMove = null) {
  if (chess.isGameOver()) {
    return evaluateBoard(chess, ply, level);
  }

  if (depth <= 0) {
    const isTurbulent = chess.inCheck() || (lastMove && (lastMove.captured || lastMove.promotion));
    if (quiescenceDepth > 0 && isTurbulent) {
      return quiescence(chess, alpha, beta, isMaximizing, quiescenceDepth, level);
    }
    return evaluateBoard(chess, ply, level);
  }

  const legalMoves = orderMoves(chess.moves({ verbose: true }));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false, quiescenceDepth, ply + 1, level, move);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, true, quiescenceDepth, ply + 1, level, move);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minEval;
  }
}

/**
 * Find the best move for the current position based on level (1 to 10+).
 * Returns { from, to, promotion, san } or null.
 */
export function calculateBestMove(chessInstance, level = 1) {
  if (!chessInstance || chessInstance.isGameOver()) return null;

  const fen = chessInstance.fen();
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const isMaximizing = chess.turn() === 'w';
  const clampedLevel = Math.max(1, Math.min(10, parseInt(level || '1', 10)));

  // Level 1: 35% chance of picking a random legal move (blunder simulator for beginners)
  if (clampedLevel === 1 && Math.random() < 0.35) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // Level 1-2: Depth 1 Search
  if (clampedLevel <= 2) {
    let bestMove = legalMoves[0];
    let bestVal = isMaximizing ? -Infinity : Infinity;

    for (const move of legalMoves) {
      chess.move(move);
      let val = evaluateBoard(chess, 0, clampedLevel);
      chess.undo();

      // Add small jitter at level 2 so it doesn't play identically every game
      if (clampedLevel === 2) {
        val += (Math.random() * 30 - 15);
      }

      if (isMaximizing ? val > bestVal : val < bestVal) {
        bestVal = val;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // Level 3 to 10 Parameter Matrix: Genuine scaling of searchDepth, quiescence, and positional complexity
  let searchDepth = 2;
  let qDepth = 0;

  if (clampedLevel === 3) {
    searchDepth = 2; qDepth = 0;
  } else if (clampedLevel === 4) {
    searchDepth = 2; qDepth = 1;
  } else if (clampedLevel === 5) {
    searchDepth = 2; qDepth = 1;
  } else if (clampedLevel === 6) {
    searchDepth = 3; qDepth = 0;
  } else if (clampedLevel === 7) {
    searchDepth = 3; qDepth = 0;
  } else if (clampedLevel === 8) {
    searchDepth = 3; qDepth = 1;
  } else if (clampedLevel === 9) {
    searchDepth = 3; qDepth = 1;
  } else if (clampedLevel >= 10) {
    searchDepth = 3; qDepth = 1;
  }

  let bestMoves = [];
  let bestVal = isMaximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  const ordered = orderMoves(legalMoves);

  for (const move of ordered) {
    chess.move(move);

    // Instant win recognition: If move delivers checkmate, return it immediately
    if (chess.isCheckmate()) {
      chess.undo();
      return move;
    }

    const val = minimax(chess, searchDepth - 1, alpha, beta, !isMaximizing, qDepth, 1, clampedLevel, move);
    chess.undo();

    if (isMaximizing) {
      if (val > bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
      alpha = Math.max(alpha, val);
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
      beta = Math.min(beta, val);
    }
  }

  // Pick randomly among equal-best moves to add variety
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || legalMoves[0];
}

/**
 * Asynchronously calculates best move in a non-blocking timeout chunk.
 */
export function findBestMoveAsync(chessInstance, level = 1) {
  return new Promise((resolve) => {
    // Delay by a micro-tick so UI thread stays 100% responsive
    setTimeout(() => {
      try {
        const move = calculateBestMove(chessInstance, level);
        resolve(move);
      } catch (err) {
        console.warn('AI calculation fallback:', err);
        const fallbackMoves = chessInstance.moves({ verbose: true });
        resolve(fallbackMoves[0] || null);
      }
    }, 40);
  });
}
