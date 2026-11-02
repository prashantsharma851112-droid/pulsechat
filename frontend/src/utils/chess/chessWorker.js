/**
 * chessWorker.js
 * Dedicated Web Worker for background Chess AI computation.
 * Ensures the main UI thread never drops a frame or experiences lag while searching.
 */

import { Chess } from 'chess.js';
import { calculateBestMove } from './chessAI.js';

self.onmessage = function (e) {
  const { type, fen, level, calculationId } = e.data || {};
  if (type === 'CALCULATE_MOVE') {
    try {
      const chess = new Chess(fen);
      const bestMove = calculateBestMove(chess, level);
      self.postMessage({
        type: 'MOVE_RESULT',
        move: bestMove,
        calculationId
      });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err.message,
        calculationId
      });
    }
  }
};
