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

      case 'CALCULATE_STORAGE_STATS': {
        const { messages = [] } = payload || {};
        let totalMediaBytes = 0;
        const mediaItems = [];
        const fileItems = [];
        const linkItems = [];

        const isPrivateEphemeral = (m) => {
          if (!m) return false;
          return Boolean(
            m.isViewOnce || m.viewMode === 'once' || m.type === 'viewOnce' ||
            m.isViewTwice || m.viewMode === 'twice' ||
            m.isDustImage || m.isDust || m.isFogSnap || m.isDustText || m.type === 'stealth_dust' || m.viewMode === 'dust'
          );
        };

        const estimateSize = (m) => {
          if (m.bytes && typeof m.bytes === 'number') return m.bytes;
          if (m.fileSize) {
            const s = String(m.fileSize).trim().toUpperCase();
            if (s.endsWith('MB')) return parseFloat(s) * 1024 * 1024;
            if (s.endsWith('KB')) return parseFloat(s) * 1024;
            if (s.endsWith('B')) return parseFloat(s);
          }
          if (m.type === 'video') return 2.5 * 1024 * 1024;
          if (m.type === 'image') return 380 * 1024;
          if (m.type === 'document') return 512 * 1024;
          if (m.type === 'audio' || m.type === 'voice') return 180 * 1024;
          return 120 * 1024;
        };

        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          if (!m || m.type === 'deleted' || m.isDeleted || isPrivateEphemeral(m)) continue;

          if (m.type === 'image' || m.type === 'video' || m.type === 'media' || m.mediaType === 'image' || m.mediaType === 'video') {
            if (m.mediaUrl) {
              mediaItems.push(m);
              totalMediaBytes += estimateSize(m);
            } else if (Array.isArray(m.mediaUrls) && m.mediaUrls.length > 0) {
              m.mediaUrls.forEach((url, idx) => {
                const subItem = { ...m, id: `${m.id || 'm'}_${idx}`, mediaUrl: url, type: 'image' };
                mediaItems.push(subItem);
                totalMediaBytes += estimateSize(subItem);
              });
            }
          } else if (m.type === 'image_group' && Array.isArray(m.mediaUrls)) {
            m.mediaUrls.forEach((url, idx) => {
              const subItem = { ...m, id: `${m.id || 'm'}_${idx}`, mediaUrl: url, type: 'image' };
              mediaItems.push(subItem);
              totalMediaBytes += estimateSize(subItem);
            });
          }

          if ((m.type === 'document' || m.type === 'file' || (m.fileName && m.type !== 'image' && m.type !== 'video' && m.type !== 'audio' && m.type !== 'stealth_dust')) && (m.mediaUrl || m.fileUrl)) {
            fileItems.push(m);
            totalMediaBytes += estimateSize(m);
          }

          if (m.type === 'text' && m.content) {
            const matches = m.content.match(/https?:\/\/[^\s]+/g);
            if (matches) {
              matches.forEach(url => linkItems.push({ url, timestamp: m.timestamp, id: m.id }));
            }
          }
        }

        return Promise.resolve({
          totalMediaBytes,
          mediaCount: mediaItems.length,
          filesCount: fileItems.length,
          linksCount: linkItems.length,
          mediaItems,
          fileItems,
          linkItems
        });
      }

      default:
        return Promise.resolve(null);
    }
  } catch (err) {
    return Promise.reject(err);
  }
}
