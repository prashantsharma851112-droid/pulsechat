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

      // 4. Off-thread contact & recent chats search
      case 'SEARCH_CONTACTS': {
        const { contacts = [], query = '' } = payload || {};
        if (!query || !query.trim()) {
          result = [];
        } else {
          const q = query.trim().toLowerCase().replace(/^@/, '');
          result = contacts.filter((u) => {
            if (!u) return false;
            const nameMatch = typeof u.displayName === 'string' && u.displayName.toLowerCase().includes(q);
            const usernameMatch = typeof u.username === 'string' && u.username.toLowerCase().includes(q);
            const emailMatch = typeof u.email === 'string' && u.email.toLowerCase().includes(q);
            return nameMatch || usernameMatch || emailMatch;
          });
        }
        break;
      }

      // 5. Off-thread storage stats & media filtering calculation
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

          // Check Media (Images / Videos)
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

          // Check Documents / Files
          if ((m.type === 'document' || m.type === 'file' || (m.fileName && m.type !== 'image' && m.type !== 'video' && m.type !== 'audio' && m.type !== 'stealth_dust')) && (m.mediaUrl || m.fileUrl)) {
            fileItems.push(m);
            totalMediaBytes += estimateSize(m);
          }

          // Check Links
          if (m.type === 'text' && m.content) {
            const matches = m.content.match(/https?:\/\/[^\s]+/g);
            if (matches) {
              matches.forEach(url => linkItems.push({ url, timestamp: m.timestamp, id: m.id }));
            }
          }
        }

        result = {
          totalMediaBytes,
          mediaCount: mediaItems.length,
          filesCount: fileItems.length,
          linksCount: linkItems.length,
          mediaItems,
          fileItems,
          linkItems
        };
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
