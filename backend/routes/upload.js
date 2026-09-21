const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');

// Upload single file/base64 to Cloudinary
// POST /api/upload
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { file, folder = 'pulsechat_media', resourceType = 'auto' } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file data provided' });
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
