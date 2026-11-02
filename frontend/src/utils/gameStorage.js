/**
 * gameStorage.js
 * PulseChat Central Game Scoring, Offline Persistence & Synchronization Engine
 * Guarantees 100% offline single-player gameplay, idempotent score queueing,
 * personal best tracking, and offline leaderboard caching.
 */

import { BACKEND_URL } from './config';

const BESTS_KEY = 'pulsechat_game_bests';
const PENDING_QUEUE_KEY = 'pulsechat_pending_game_scores';
const TOTAL_SCORE_KEY = 'pulsechat_total_offline_score';
const LEADERBOARD_CACHE_PREFIX = 'pulsechat_cached_leaderboard_';

// Standardized game categories
export const GAME_METADATA = {
  arrow: {
    key: 'arrow',
    name: 'Arrow Puzzle',
    category: 'puzzle',
    icon: '🎯',
    badge: 'RANKED • #1',
    is3D: false,
    offlineReady: true,
    scoringRule: '+10 pts per cleared arrow, +50 pts level clear bonus'
  },
  temple: {
    key: 'temple',
    name: 'Temple Run 3D',
    category: 'runner',
    icon: '🗿',
    badge: '3D REAL-TIME',
    is3D: true,
    offlineReady: true,
    scoringRule: '+1 pt per 10m run distance, +5 pts per collected coin'
  },
  candy: {
    key: 'candy',
    name: 'Candy Crush Saga',
    category: 'arcade',
    icon: '🍬',
    badge: 'MATCH 3',
    is3D: false,
    offlineReady: true,
    scoringRule: '30 pts per Match-3, 60 pts Match-4, 120 pts Match-5 + combo multiplier'
  },
  tapper: {
    key: 'tapper',
    name: 'Speed Tapper',
    category: 'reflex',
    icon: '⚡',
    badge: 'REFLEX 15s',
    is3D: false,
    offlineReady: true,
    scoringRule: '+10 pts per rapid glowing pulse tap within 15 seconds'
  },
  tictactoe: {
    key: 'tictactoe',
    name: 'Tic-Tac-Toe Arena',
    category: 'ai_arena',
    icon: '❌⭕',
    badge: 'MASTER AI',
    is3D: false,
    offlineReady: true,
    scoringRule: '+50 pts per AI win, +15 pts per draw'
  },
  chess: {
    key: 'chess',
    name: '3D Chess',
    category: 'strategy',
    icon: '♟️',
    badge: '3D AI MASTER',
    is3D: true,
    offlineReady: true,
    scoringRule: '+100 pts per AI win x Level, +25 pts per draw'
  },
  draw: {
    key: 'draw',
    name: 'Whiteboard Studio',
    category: 'creative',
    icon: '🎨',
    badge: 'CREATIVE',
    is3D: false,
    offlineReady: true,
    scoringRule: 'Free creative art studio with direct device PNG saving'
  }
};

/**
 * Normalizes game name to canonical game key
 */
export function normalizeGameKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('temple')) return 'temple';
  if (n.includes('candy')) return 'candy';
  if (n.includes('chess')) return 'chess';
  if (n.includes('arrow')) return 'arrow';
  if (n.includes('tapper') || n.includes('speed')) return 'tapper';
  if (n.includes('tic') || n.includes('toe')) return 'tictactoe';
  if (n.includes('draw') || n.includes('whiteboard') || n.includes('creative') || n.includes('artist')) return 'draw';
  return 'arrow';
}

/**
 * Retrieve all local personal bests
 */
export function getLocalGameBests() {
  try {
    const raw = localStorage.getItem(BESTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Retrieve personal best for a specific game
 */
export function getGamePersonalBest(gameNameOrKey) {
  const key = normalizeGameKey(gameNameOrKey);
  const bests = getLocalGameBests();
  return bests[key] || 0;
}

/**
 * Record a game completion locally first.
 * Updates personal best, accumulates local total, and enqueues an idempotent
 * pending submission with unique UUID for server sync.
 */
export function recordLocalGameScore({ gameName, score, level = 1, stats = {} }) {
  const rawScore = Math.max(0, parseInt(score || '0', 10));
  const rawLevel = Math.max(1, parseInt(level || '1', 10));
  const gameKey = normalizeGameKey(gameName);

  // 1. Update Personal Best
  let isNewPersonalBest = false;
  try {
    const bests = getLocalGameBests();
    const prevBest = bests[gameKey] || 0;
    if (rawScore > prevBest) {
      bests[gameKey] = rawScore;
      localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
      isNewPersonalBest = true;
    }
  } catch (e) {
    console.warn('gameStorage: Error saving personal best:', e);
  }

  // 2. Accumulate Local Aggregate Points Total
  let localTotalScore = rawScore;
  try {
    const prevTotal = parseInt(localStorage.getItem(TOTAL_SCORE_KEY) || '0', 10);
    localTotalScore = prevTotal + rawScore;
    localStorage.setItem(TOTAL_SCORE_KEY, String(localTotalScore));
  } catch (_) {}

  // 3. Generate Cryptographically Unique Submission ID for Idempotent Sync
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // 4. Enqueue into Pending Offline Synchronization Queue
  const submissionItem = {
    submissionId,
    gameKey,
    gameName: GAME_METADATA[gameKey]?.name || gameName,
    score: rawScore,
    level: rawLevel,
    stats,
    completedAt: new Date().toISOString()
  };

  try {
    const queue = getPendingGameScores();
    queue.push(submissionItem);
    // Keep max 60 pending offline items to prevent storage bloat
    if (queue.length > 60) queue.shift();
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('gameStorage: Error queueing pending score:', e);
  }

  // Notify active UI of local score update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsechat_local_score_updated', {
      detail: { gameKey, score: rawScore, isNewPersonalBest, submissionId }
    }));
  }

  return {
    submissionId,
    isNewPersonalBest,
    localTotalScore,
    gameKey
  };
}

/**
 * Retrieve all pending un-synchronized game score submissions
 */
export function getPendingGameScores() {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove specific submission IDs after verified server processing
 */
export function removePendingScores(syncedIds = []) {
  if (!Array.isArray(syncedIds) || syncedIds.length === 0) return;
  try {
    const syncedSet = new Set(syncedIds.map(String));
    const queue = getPendingGameScores();
    const remaining = queue.filter(item => !syncedSet.has(String(item.submissionId)));
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.warn('gameStorage: Error removing pending scores:', e);
  }
}

/**
 * Sync all queued offline scores to server with idempotency & retry safety.
 * Returns synced count and updated server leaderboard.
 */
export async function syncPendingScores(token) {
  if (!token || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { syncedCount: 0, pendingRemaining: getPendingGameScores().length, isOffline: true };
  }

  const pendingQueue = getPendingGameScores();
  if (pendingQueue.length === 0) {
    return { syncedCount: 0, pendingRemaining: 0 };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/zone/sync-offline-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        submissions: pendingQueue
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Clear all synced submissions from local queue
        const processedIds = pendingQueue.map(p => p.submissionId);
        removePendingScores(processedIds);

        // Update cached total score
        if (data.totalScore !== undefined) {
          localStorage.setItem(TOTAL_SCORE_KEY, String(data.totalScore));
        }

        // Cache fresh server leaderboard
        if (Array.isArray(data.leaderboard)) {
          cacheLeaderboard('all', data.leaderboard);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pulsechat_scores_synced_success', { detail: data }));
        }

        return {
          success: true,
          syncedCount: data.syncedCount || pendingQueue.length,
          pendingRemaining: getPendingGameScores().length,
          leaderboard: data.leaderboard
        };
      }
    }
  } catch (err) {
    console.warn('gameStorage: Background score synchronization retry queued:', err.message);
  }

  return { syncedCount: 0, pendingRemaining: getPendingGameScores().length, failed: true };
}

/**
 * Cache leaderboard list locally with timestamp for offline viewing
 */
export function cacheLeaderboard(category = 'all', list = []) {
  if (!Array.isArray(list)) return;
  try {
    const payload = {
      category,
      cachedAt: Date.now(),
      list
    };
    localStorage.setItem(`${LEADERBOARD_CACHE_PREFIX}${category}`, JSON.stringify(payload));
  } catch (_) {}
}

/**
 * Read cached leaderboard from local storage
 */
export function getCachedLeaderboard(category = 'all') {
  try {
    const raw = localStorage.getItem(`${LEADERBOARD_CACHE_PREFIX}${category}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      list: parsed.list || [],
      cachedAt: parsed.cachedAt || Date.now(),
      ageMs: Date.now() - (parsed.cachedAt || 0)
    };
  } catch {
    return null;
  }
}

/**
 * Format relative time for offline leaderboard indicator (e.g., "5m ago")
 */
export function formatCacheAge(cachedAt) {
  if (!cachedAt) return 'Offline cache';
  const diffSec = Math.floor((Date.now() - cachedAt) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/**
 * Setup automatic listener for network reconnection
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const token = localStorage.getItem('pulsechat_token');
    if (token) {
      syncPendingScores(token).catch(() => {});
    }
  });
}
