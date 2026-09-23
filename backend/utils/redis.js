// PulseChat In-Memory RAM Caching Engine (Redis + Upstash)
// Provides 0.5ms - 2ms ultra-low latency RAM responses for live chats, online presence, and recent conversations.

const Redis = require('ioredis');
const config = require('../config');

let redisClient = null;
let isConnected = false;

const redisUrl = process.env.REDIS_URL || config.REDIS_URL || 'rediss://default:gQAAAAAABHrdAAIgcDFlZjAwNmFkZTFiZDA0NTIxYWFlYWFmMGY2NThjODJlZA@accurate-rattler-293597.upstash.io:6379';

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy(times) {
        // Exponential backoff up to 3s
        return Math.min(times * 150, 3000);
      }
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('⚡ [Redis] Upstash In-Memory RAM Cache Connected & Operational (0ms Latency)!');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn('⚠️ [Redis Warning] Connection notice:', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    console.warn('⚠️ [Redis Init Warning]:', err.message);
  }
}

// Safe Helper Wrappers that never throw or crash the app if Redis is temporarily unreachable
const redis = {
  client: redisClient,
  isConnected: () => isConnected && redisClient && redisClient.status === 'ready',

  // Raw Safe Get
  async get(key) {
    if (!this.isConnected()) return null;
    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },

  // Raw Safe Set with TTL in seconds
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected()) return false;
    try {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redisClient.setex(key, ttlSeconds, valStr);
      } else {
        await redisClient.set(key, valStr);
      }
      return true;
    } catch {
      return false;
    }
  },

  // Raw Safe Delete
  async del(key) {
    if (!this.isConnected()) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch {
      return false;
    }
  },

  // --- SPECIALIZED CHAT CACHE HELPERS ---

  // 1. Get Cached Chat Messages
  async getCachedMessages(chatId) {
    if (!chatId) return null;
    const raw = await this.get(`pulse_chat_msgs:${chatId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // 2. Set Cached Chat Messages (Default: 30 minutes in RAM)
  async setCachedMessages(chatId, messages, ttl = 1800) {
    if (!chatId || !Array.isArray(messages)) return;
    await this.set(`pulse_chat_msgs:${chatId}`, messages, ttl);
  },

  // 3. Invalidate Chat Messages Cache
  async invalidateChat(chatId) {
    if (!chatId) return;
    await this.del(`pulse_chat_msgs:${chatId}`);
  },

  // 4. Get Cached Recent Conversations for a user
  async getCachedRecent(userId) {
    if (!userId) return null;
    const raw = await this.get(`pulse_recent:${userId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // 5. Set Cached Recent Conversations (60s in RAM)
  async setCachedRecent(userId, conversations, ttl = 60) {
    if (!userId || !Array.isArray(conversations)) return;
    await this.set(`pulse_recent:${userId}`, conversations, ttl);
  },

  // 6. Invalidate Recent Conversations Cache
  async invalidateRecent(userId) {
    if (!userId) return;
    await this.del(`pulse_recent:${userId}`);
  },

  // 6b. Invalidate ALL Recent Conversations Caches across all users
  async invalidateAllRecent() {
    if (!this.isConnected()) return;
    try {
      const stream = redisClient.scanStream({ match: 'pulse_recent:*', count: 100 });
      stream.on('data', (keys) => {
        if (keys && keys.length > 0) {
          redisClient.del(keys).catch(() => {});
        }
      });
    } catch (e) {
      try {
        const keys = await redisClient.keys('pulse_recent:*');
        if (keys && keys.length > 0) {
          await redisClient.del(keys);
        }
      } catch {}
    }
  },

  // 7. Get Cached User Profile
  async getCachedUser(userId) {
    if (!userId) return null;
    const raw = await this.get(`pulse_user:${userId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // 8. Set Cached User Profile (15 mins in RAM)
  async setCachedUser(userId, profile, ttl = 900) {
    if (!userId || !profile) return;
    await this.set(`pulse_user:${userId}`, profile, ttl);
  },

  // 9. Invalidate User Profile Cache
  async invalidateUser(userId) {
    if (!userId) return;
    await this.del(`pulse_user:${userId}`);
  }
};

module.exports = redis;
