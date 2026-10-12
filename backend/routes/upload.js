const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { isR2Configured, generateR2PresignedUrl, uploadBufferToR2 } = require('../utils/r2Storage');
const { checkAndUpdateFileQuota } = require('../utils/fileQuota');

// Instagram / Cloudflare Architecture: Generate presigned upload params.
// Priority 1: Cloudflare R2 (100% Free Egress Bandwidth, Zero data fees)
// Priority 2: Cloudinary Edge CDN
router.get('/signature', authMiddleware, (req, res) => {
  try {
    const { folder = 'pulsechat_media', fileName = '', contentType = 'image/jpeg' } = req.query;

    // 1. Cloudflare R2 Presigned Upload (Unlimited Free Bandwidth)
    if (isR2Configured()) {
      const uniqueFileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${fileName || 'media.bin'}`.replace(/\/{2,}/g, '/');
      const r2Presigned = generateR2PresignedUrl(uniqueFileName, contentType);
      if (r2Presigned) {
        return res.json({
          directUpload: true,
          provider: 'r2',
          uploadUrl: r2Presigned.uploadUrl,
          publicUrl: r2Presigned.publicUrl,
          key: r2Presigned.key
        });
      }
    }

    // 2. Cloudinary Edge CDN Upload
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
      provider: 'cloudinary',
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

    const isVideo = resourceType === 'video' || (typeof file === 'string' && (file.startsWith('data:video/') || file.includes('/video/')));
    const quotaResult = await checkAndUpdateFileQuota(req.user?.id || req.userId, fileSizeBytes, isVideo);
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
