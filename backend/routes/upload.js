const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { checkAndUpdateFileQuota } = require('../utils/fileQuota');

// Instagram Architecture: Generate presigned upload params.
// The client uploads large media DIRECTLY to Cloudinary edge servers.
// 0 bytes of media pass through Render Node.js backend!
router.get('/signature', authMiddleware, (req, res) => {
  try {
    const { folder = 'pulsechat_media' } = req.query;
    if (!isCloudinaryConfigured()) {
      return res.json({ directUpload: false });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      return res.json({ directUpload: false });
    }

    const crypto = require('crypto');
    const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

    res.json({
      directUpload: true,
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder
    });
  } catch (err) {
    console.error('Signature route error:', err);
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
});

// Upload single file/base64 to Cloudinary (Fallback if direct upload not possible)
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
