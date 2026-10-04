const User = require('../models/User');
const mongoose = require('mongoose');

const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB max per file
const MAX_VIDEO_FILE_BYTES = 50 * 1024 * 1024; // 50 MB max for videos / reels / stories
const MAX_DAILY_FILE_BYTES = 100 * 1024 * 1024; // 100 MB max per 24 hours (1 day)

/**
 * Checks single file size limit (10MB image, 50MB video) and 24h daily quota (100MB total).
 * If allowed, automatically updates user's dailyFileBytesUsed in MongoDB.
 */
async function checkAndUpdateFileQuota(userId, fileSizeBytes, isVideo = false) {
  const bytes = Number(fileSizeBytes) || 0;
  if (bytes <= 0) return { success: true };

  const singleFileLimit = isVideo ? MAX_VIDEO_FILE_BYTES : MAX_SINGLE_FILE_BYTES;

  // 1. Single file limit check
  if (bytes > singleFileLimit) {
    const limitMB = (singleFileLimit / (1024 * 1024)).toFixed(0);
    return {
      success: false,
      code: 'SINGLE_FILE_LIMIT_EXCEEDED',
      error: `File size exceeds the ${limitMB}MB limit (${(bytes / (1024 * 1024)).toFixed(2)}MB). Max allowed is ${limitMB}MB.`
    };
  }

  if (!userId) return { success: true };

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const todayStr = new Date().toISOString().split('T')[0];

    const user = await User.findOne({
      $or: [
        { id: userId },
        ...(isObjectId ? [{ _id: userId }] : []),
        { username: userId }
      ]
    });

    if (!user) return { success: true };

    let currentUsed = user.dailyFileBytesUsed || 0;
    if (user.dailyFileBytesResetDate !== todayStr) {
      currentUsed = 0;
      user.dailyFileBytesUsed = 0;
      user.dailyFileBytesResetDate = todayStr;
    }

    if (currentUsed + bytes > MAX_DAILY_FILE_BYTES) {
      const usedMB = (currentUsed / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        code: 'DAILY_QUOTA_EXCEEDED',
        error: `Daily file sharing limit of 10MB reached! (Used: ${usedMB}MB / 10MB). You cannot send files over 10MB total per day.`
      };
    }

    user.dailyFileBytesUsed = currentUsed + bytes;
    user.dailyFileBytesResetDate = todayStr;
    await user.save();

    return { success: true, totalUsedBytes: user.dailyFileBytesUsed };
  } catch (err) {
    console.error('File quota check error:', err);
    return { success: true }; // Fallback to allow on DB errors
  }
}

module.exports = {
  MAX_SINGLE_FILE_BYTES,
  MAX_DAILY_FILE_BYTES,
  checkAndUpdateFileQuota
};
