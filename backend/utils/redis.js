// redis helper

const Redis = require('ioredis');
const config = require('../config');

let redisClient = null;
let isConnected = false;

const redisUrl = process.env.REDIS_URL || config.REDIS_URL || '';

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy(times) {
        return Math.min(times * 150, 3000);
      }
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('Redis connected');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn('Redis connection notice:', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    console.warn('Redis init warning:', err.message);
  }
}

const redis = {
  client: redisClient,
  isConnected: () => isConnected && redisClient && redisClient.status === 'ready',

  // get key
  async get(key) {
    if (!this.isConnected()) return null;
    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },

  // set key with ttl
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

  // delete key
  async del(key) {
    if (!this.isConnected()) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch {
      return false;
    }
  },

  // get cached messages
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

  // set cached messages
  async setCachedMessages(chatId, messages, ttl = 1800) {
    if (!chatId || !Array.isArray(messages)) return;
    await this.set(`pulse_chat_msgs:${chatId}`, messages, ttl);
  },

  // invalidate chat cache
  async invalidateChat(chatId) {
    if (!chatId) return;
    await this.del(`pulse_chat_msgs:${chatId}`);
  },

  // get cached recent chats
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

  // set cached recent chats
  async setCachedRecent(userId, conversations, ttl = 60) {
    if (!userId || !Array.isArray(conversations)) return;
    await this.set(`pulse_recent:${userId}`, conversations, ttl);
  },

  // invalidate recent chats
  async invalidateRecent(userId) {
    if (!userId) return;
    await this.del(`pulse_recent:${userId}`);
  },

  // invalidate all recent chats
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

  // get cached user profile
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

  // set cached user profile
  async setCachedUser(userId, profile, ttl = 900) {
    if (!userId || !profile) return;
    await this.set(`pulse_user:${userId}`, profile, ttl);
  },

  // invalidate user profile
  async invalidateUser(userId) {
    if (!userId) return;
    await this.del(`pulse_user:${userId}`);
  }
};

module.exports = redis;
