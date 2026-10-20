require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;
const receiptSecret = process.env.RECEIPT_SECRET;

if (!jwtSecret || typeof jwtSecret !== 'string' || !jwtSecret.trim()) {
  throw new Error(
    "FATAL CONFIGURATION ERROR: Required environment variable 'JWT_SECRET' is missing. " +
    "Please define a cryptographically secure JWT_SECRET in your environment or .env file."
  );
}

if (!receiptSecret || typeof receiptSecret !== 'string' || !receiptSecret.trim()) {
  throw new Error(
    "FATAL CONFIGURATION ERROR: Required environment variable 'RECEIPT_SECRET' is missing. " +
    "Please define a cryptographically secure RECEIPT_SECRET (at least 32 characters) for HMAC delivery receipts in your environment or .env file."
  );
}

if (isProduction && (jwtSecret.trim().length < 32 || receiptSecret.trim().length < 32)) {
  throw new Error(
    "FATAL CONFIGURATION ERROR: 'JWT_SECRET' and 'RECEIPT_SECRET' must each be at least 32 characters long in production environments."
  );
}

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: jwtSecret.trim(),
  RECEIPT_SECRET: receiptSecret.trim(),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL || null,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || null,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || null,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:support@pulsechat.app'
};

