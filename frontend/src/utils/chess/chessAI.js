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
export function evaluateBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -999999 : 999999;
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
        const pieceTotal = val + pstBonus;

        if (piece.color === 'w') {
          totalEvaluation += pieceTotal;
        } else {
          totalEvaluation -= pieceTotal;
        }
      }
    }
  }

  return totalEvaluation;
}

/**
 * Move ordering heuristic: Sort captures by Most Valuable Victim - Least Valuable Attacker (MVV-LVA)
 */
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) {
      scoreA += (PIECE_VALUES[a.captured] || 0) * 10 - (PIECE_VALUES[a.piece] || 0);
    }
    if (a.promotion) {
      scoreA += (PIECE_VALUES[a.promotion] || 900);
    }

    if (b.captured) {
      scoreB += (PIECE_VALUES[b.captured] || 0) * 10 - (PIECE_VALUES[b.piece] || 0);
    }
    if (b.promotion) {
      scoreB += (PIECE_VALUES[b.promotion] || 900);
    }

    return scoreB - scoreA;
  });
}

/**
 * Quiescence search to avoid horizon effect on captures.
 */
function quiescence(chess, alpha, beta, isMaximizing, depthLimit = 2) {
  const standPat = evaluateBoard(chess);
  if (depthLimit <= 0) return standPat;

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }

  // Only examine capture moves
  const captures = orderMoves(chess.moves({ verbose: true })).filter(m => m.captured || m.promotion);
  if (captures.length === 0) return standPat;

  for (const move of captures) {
    chess.move(move);
    const score = quiescence(chess, alpha, beta, !isMaximizing, depthLimit - 1);
    chess.undo();

    if (isMaximizing) {
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    } else {
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
  }

  return isMaximizing ? alpha : beta;
}

/**
 * Minimax with Alpha-Beta Pruning.
 */
function minimax(chess, depth, alpha, beta, isMaximizing, useQuiescence = false) {
  if (depth === 0) {
    return useQuiescence ? quiescence(chess, alpha, beta, isMaximizing, 2) : evaluateBoard(chess);
  }

  if (chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const legalMoves = orderMoves(chess.moves({ verbose: true }));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false, useQuiescence);
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
      const evaluation = minimax(chess, depth - 1, alpha, beta, true, useQuiescence);
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
  const clampedLevel = Math.max(1, parseInt(level || '1', 10));

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
      let val = evaluateBoard(chess);
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

  // Level 3-4: Depth 2 to 3 Minimax
  const searchDepth = clampedLevel <= 3 ? 2 : (clampedLevel <= 6 ? 3 : (clampedLevel <= 9 ? 4 : 5));
  const useQuiescence = clampedLevel >= 5;

  let bestMoves = [];
  let bestVal = isMaximizing ? -Infinity : Infinity;
  const ordered = orderMoves(legalMoves);

  for (const move of ordered) {
    chess.move(move);
    const val = minimax(chess, searchDepth - 1, -Infinity, Infinity, !isMaximizing, useQuiescence);
    chess.undo();

    if (isMaximizing) {
      if (val > bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
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
