const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { checkAndUpdateFileQuota } = require('../utils/fileQuota');

// Upload single file/base64 to Cloudinary
// POST /api/upload
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { file, folder = 'pulsechat_media', resourceType = 'auto' } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Estimate file byte size (if base64 or string)
    const fileSizeBytes = typeof file === 'string'
      ? Math.ceil((file.length * 3) / 4)
      : (req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : 0);

    const quotaResult = await checkAndUpdateFileQuota(req.user?.id || req.userId, fileSizeBytes);
    if (!quotaResult.success) {
      return res.status(400).json({ error: quotaResult.error });
    }

    const secureUrl = await uploadToCloudinary(file, folder, resourceType);

    res.json({
      success: true,
      url: secureUrl,
      isCloudinary: isCloudinaryConfigured() && secureUrl.includes('cloudinary.com')
    });
  } catch (err) {
    console.error('Upload route error:', err);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

module.exports = router;
