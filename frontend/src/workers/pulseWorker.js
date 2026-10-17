/**
 * PulseChat Dedicated Multi-Threading Web Worker
 * Offloads heavy computational tasks (message search, mood/sentiment analysis,
 * message deduplication, and data parsing) off the UI thread to a separate CPU thread.
 */

self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};
  if (!id) return;

  try {
    let result = null;

    switch (type) {
      // 1. Off-thread message search and filtering
      case 'SEARCH_MESSAGES': {
        const { messages = [], query = '' } = payload || {};
        if (!query || !query.trim()) {
          result = [];
        } else {
          const lower = query.toLowerCase().trim();
          result = messages.filter((m) => {
            if (!m) return false;
            const textMatch = typeof m.text === 'string' && m.text.toLowerCase().includes(lower);
            const senderMatch = typeof m.senderName === 'string' && m.senderName.toLowerCase().includes(lower);
            const mediaNameMatch = typeof m.mediaName === 'string' && m.mediaName.toLowerCase().includes(lower);
            return textMatch || senderMatch || mediaNameMatch;
          }).map(m => m.id || m.clientTempId);
        }
        break;
      }

      // 2. Off-thread message deduplication and chronological sort
      case 'PROCESS_MESSAGES': {
        const { incomingMessages = [] } = payload || {};
        const seen = new Set();
        const deduplicated = [];

        for (let i = 0; i < incomingMessages.length; i++) {
          const msg = incomingMessages[i];
          if (!msg) continue;
          const key = msg.id || msg.clientTempId || `idx_${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(msg);
          }
        }

        // Sort chronologically
        deduplicated.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeA - timeB;
        });

        result = deduplicated;
        break;
      }

      // 3. Off-thread sentiment / vibe analysis
      case 'ANALYZE_VIBE': {
        const { messages = [] } = payload || {};
        let happyCount = 0;
        let fireCount = 0;
        let heartCount = 0;
        let chillCount = 0;

        const happyWords = ['happy', 'lol', 'haha', 'mast', 'badiya', 'awesome', 'great', 'love', 'wah', 'khush'];
        const fireWords = ['fire', 'op', 'pro', 'level', 'boom', 'blast', 'epic', 'lit'];
        const chillWords = ['chill', 'ok', 'theek', 'nice', 'cool', 'peace', 'sahi'];

        const recent = messages.slice(-25);
        for (const msg of recent) {
          const text = (msg.text || '').toLowerCase();
          for (const w of happyWords) if (text.includes(w)) happyCount++;
          for (const w of fireWords) if (text.includes(w)) fireCount++;
          for (const w of chillWords) if (text.includes(w)) chillCount++;
          if (text.includes('❤️') || text.includes('💖')) heartCount++;
          if (text.includes('🔥')) fireCount++;
        }

        let dominantVibe = 'chill';
        const maxScore = Math.max(happyCount, fireCount, heartCount, chillCount);
        if (maxScore > 0) {
          if (maxScore === fireCount) dominantVibe = 'fire';
          else if (maxScore === happyCount) dominantVibe = 'happy';
          else if (maxScore === heartCount) dominantVibe = 'heart';
        }

        result = { dominantVibe, scores: { happyCount, fireCount, heartCount, chillCount } };
        break;
      }

      default:
        result = null;
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error?.message || 'Worker error' });
  }
};
