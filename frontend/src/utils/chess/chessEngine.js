/**
 * chessEngine.js
 * PulseChat Authoritative Chess Rules & State Engine
 * Wraps chess.js for complete FEN parsing, legal moves, castling, en passant,
 * promotion, check/checkmate/stalemate, 50-move rule, and threefold repetition.
 */

import { Chess } from 'chess.js';

export const PIECE_NAMES = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

export const INITIAL_PIECE_COUNTS = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1
};

export function createChessInstance(fen) {
  try {
    return fen ? new Chess(fen) : new Chess();
  } catch (err) {
    console.warn('Invalid FEN passed to createChessInstance, defaulting to starting position:', err);
    return new Chess();
  }
}

/**
 * Check if a move is valid and returns the move object, or null if illegal.
 */
export function isValidMove(chess, from, to, promotion = 'q') {
  if (!chess || !from || !to) return null;
  try {
    // Clone instance to test move non-destructively
    const clone = new Chess(chess.fen());
    const move = clone.move({ from, to, promotion });
    return move || null;
  } catch {
    return null;
  }
}

/**
 * Execute a move on the given chess instance.
 */
export function makeMove(chess, from, to, promotion = 'q') {
  if (!chess || !from || !to) return null;
  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

/**
 * Returns array of legal verbose moves for a specific square.
 */
export function getLegalMovesForSquare(chess, square) {
  if (!chess || !square) return [];
  try {
    return chess.moves({ square, verbose: true });
  } catch {
    return [];
  }
}

/**
 * Returns an 8x8 2D array representation of the board from rank 8 to rank 1.
 */
export function getBoardGrid(chess) {
  if (!chess) return [];
  try {
    return chess.board(); // 8x8 array: board[rankIndex][fileIndex], e.g. board[0][0] = a8
  } catch {
    return [];
  }
}

/**
 * Calculate captured pieces for both colors compared to initial 16 pieces.
 */
export function getCapturedPieces(chess) {
  if (!chess) return { white: [], black: [] };
  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  };

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        currentCounts[piece.color][piece.type]++;
      }
    }
  }

  const capturedWhite = []; // Pieces lost by White (captured by Black)
  const capturedBlack = []; // Pieces lost by Black (captured by White)

  Object.keys(INITIAL_PIECE_COUNTS).forEach(type => {
    const initial = INITIAL_PIECE_COUNTS[type];
    const whiteLost = Math.max(0, initial - currentCounts.w[type]);
    const blackLost = Math.max(0, initial - currentCounts.b[type]);

    for (let i = 0; i < whiteLost; i++) capturedWhite.push(type);
    for (let i = 0; i < blackLost; i++) capturedBlack.push(type);
  });

  return { white: capturedWhite, black: capturedBlack };
}

/**
 * Returns comprehensive game status flags.
 */
export function getGameStatus(chess) {
  if (!chess) {
    return {
      isGameOver: false,
      inCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      isThreefoldRepetition: false,
      isInsufficientMaterial: false,
      is50MoveRule: false,
      turn: 'w',
      winner: null,
      statusText: 'Active',
      reason: null
    };
  }

  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isThreefold = chess.isThreefoldRepetition();
  const isInsufficient = chess.isInsufficientMaterial();
  const isDraw = chess.isDraw();
  const inCheck = chess.inCheck();
  const isGameOver = chess.isGameOver();
  const turn = chess.turn(); // 'w' | 'b'

  let winner = null;
  let statusText = 'Active';
  let reason = null;

  if (isCheckmate) {
    winner = turn === 'w' ? 'b' : 'w';
    statusText = 'Checkmate';
    reason = `${winner === 'w' ? 'White' : 'Black'} wins by Checkmate!`;
  } else if (isStalemate) {
    statusText = 'Stalemate';
    reason = 'Draw by Stalemate (no legal moves)';
  } else if (isThreefold) {
    statusText = 'Draw';
    reason = 'Draw by Threefold Repetition';
  } else if (isInsufficient) {
    statusText = 'Draw';
    reason = 'Draw by Insufficient Material';
  } else if (isDraw) {
    statusText = 'Draw';
    reason = 'Draw (50-move rule or agreement)';
  } else if (inCheck) {
    statusText = 'Check';
    reason = `${turn === 'w' ? 'White' : 'Black'} is in Check!`;
  }

  return {
    isGameOver,
    inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isThreefoldRepetition: isThreefold,
    isInsufficientMaterial: isInsufficient,
    turn,
    winner,
    statusText,
    reason
  };
}

/**
 * Locate the king's square for a given color ('w' | 'b').
 */
export function getKingSquare(chess, color) {
  if (!chess) return null;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        return `${file}${rank}`;
      }
    }
  }
  return null;
}
