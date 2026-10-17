/**
 * PulseChat Multi-Threading Worker Bridge
 * Seamlessly talks to the pulseWorker Web Worker on a separate CPU thread.
 * If Web Workers are unavailable or fail, provides automatic fallback to main thread.
 */

let workerInstance = null;
let taskIdCounter = 1;
const pendingTasks = new Map();

function getWorker() {
  if (workerInstance) return workerInstance;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  try {
    workerInstance = new Worker(
      new URL('./pulseWorker.js', import.meta.url),
      { type: 'module' }
    );

    workerInstance.onmessage = (e) => {
      const { id, success, result, error } = e.data || {};
      if (!id || !pendingTasks.has(id)) return;

      const { resolve, reject, timeoutId } = pendingTasks.get(id);
      pendingTasks.delete(id);
      clearTimeout(timeoutId);

      if (success) {
        resolve(result);
      } else {
        reject(new Error(error || 'Worker error'));
      }
    };

    workerInstance.onerror = (err) => {
      console.warn('[PulseWorker] Worker error occurred:', err);
    };

    return workerInstance;
  } catch (e) {
    console.warn('[PulseWorker] Web Worker initialization failed, using fallback:', e);
    return null;
  }
}

/**
 * Executes a task on the dedicated background thread.
 * @param {string} type - 'SEARCH_MESSAGES' | 'PROCESS_MESSAGES' | 'ANALYZE_VIBE'
 * @param {any} payload - Task input data
 * @returns {Promise<any>}
 */
export function runWorkerTask(type, payload) {
  const worker = getWorker();

  // If worker cannot be created, execute synchronously as fallback
  if (!worker) {
    return runFallback(type, payload);
  }

  return new Promise((resolve, reject) => {
    const id = `task_${Date.now()}_${taskIdCounter++}`;
    const timeoutId = setTimeout(() => {
      if (pendingTasks.has(id)) {
        pendingTasks.delete(id);
        // Fallback on timeout
        runFallback(type, payload).then(resolve).catch(reject);
      }
    }, 4000);

    pendingTasks.set(id, { resolve, reject, timeoutId });
    worker.postMessage({ id, type, payload });
  });
}

function runFallback(type, payload) {
  try {
    switch (type) {
      case 'SEARCH_MESSAGES': {
        const { messages = [], query = '' } = payload || {};
        if (!query || !query.trim()) return Promise.resolve([]);
        const lower = query.toLowerCase().trim();
        const matches = messages.filter((m) => {
          if (!m) return false;
          return (
            (m.text && m.text.toLowerCase().includes(lower)) ||
            (m.senderName && m.senderName.toLowerCase().includes(lower)) ||
            (m.mediaName && m.mediaName.toLowerCase().includes(lower))
          );
        }).map(m => m.id || m.clientTempId);
        return Promise.resolve(matches);
      }

      case 'PROCESS_MESSAGES': {
        const { incomingMessages = [] } = payload || {};
        const seen = new Set();
        const deduped = [];
        for (let i = 0; i < incomingMessages.length; i++) {
          const msg = incomingMessages[i];
          if (!msg) continue;
          const key = msg.id || msg.clientTempId || `idx_${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(msg);
          }
        }
        deduped.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeA - timeB;
        });
        return Promise.resolve(deduped);
      }

      case 'ANALYZE_VIBE': {
        return Promise.resolve({ dominantVibe: 'chill', scores: {} });
      }

      case 'SEARCH_CONTACTS': {
        const { contacts = [], query = '' } = payload || {};
        if (!query || !query.trim()) return Promise.resolve([]);
        const q = query.trim().toLowerCase().replace(/^@/, '');
        const matches = contacts.filter((u) => {
          if (!u) return false;
          return (
            (u.displayName && u.displayName.toLowerCase().includes(q)) ||
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q))
          );
        });
        return Promise.resolve(matches);
      }

      default:
        return Promise.resolve(null);
    }
  } catch (err) {
    return Promise.reject(err);
  }
}
