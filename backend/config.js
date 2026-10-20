require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'pulsechat_super_secret_key_2026',
  RECEIPT_SECRET: process.env.RECEIPT_SECRET || '7f8a9b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL || 'rediss://default:gQAAAAAABHrdAAIgcDFlZjAwNmFkZTFiZDA0NTIxYWFlYWFmMGY2NThjODJlZA@accurate-rattler-293597.upstash.io:6379'
};
