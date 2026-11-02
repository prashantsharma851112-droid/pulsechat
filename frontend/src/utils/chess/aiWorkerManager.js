/**
 * aiWorkerManager.js
 * Manages the Chess AI Web Worker with fallback to async main-thread computation.
 * Supports calculation cancellation, timeouts, and clean termination.
 */

import { findBestMoveAsync } from './chessAI.js';

let activeWorker = null;
let currentCalculationId = 0;

function getWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!activeWorker) {
    try {
      activeWorker = new Worker(new URL('./chessWorker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      console.warn('Could not instantiate chess Web Worker, falling back to chunked async execution:', e);
      activeWorker = null;
    }
  }
  return activeWorker;
}

export function requestAIMove(chessInstance, level = 1) {
  currentCalculationId++;
  const calcId = currentCalculationId;
  const fen = chessInstance.fen();

  const worker = getWorker();

  if (!worker) {
    // Fallback: asynchronous sliced execution on main thread
    return findBestMoveAsync(chessInstance, level);
  }

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      clearTimeout(timeoutTimer);
    };

    const handleMessage = (e) => {
      const { type, move, calculationId } = e.data || {};
      if (calculationId !== calcId) return; // Stale calculation discarded

      if (type === 'MOVE_RESULT' && !resolved) {
        resolved = true;
        cleanup();
        resolve(move);
      }
    };

    const handleError = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        // Fallback to async calculation
        findBestMoveAsync(chessInstance, level).then(resolve);
      }
    };

    // Safety timeout in case worker stalls (capped at 5 seconds)
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        findBestMoveAsync(chessInstance, level).then(resolve);
      }
    }, 5000);

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    worker.postMessage({
      type: 'CALCULATE_MOVE',
      fen,
      level,
      calculationId: calcId
    });
  });
}

export function cancelAIMove() {
  currentCalculationId++;
}

export function terminateAIWorker() {
  if (activeWorker) {
    try {
      activeWorker.terminate();
    } catch (_) {}
    activeWorker = null;
  }
}
