const crypto = require('crypto');

let cloudinaryPkg = null;
try {
  cloudinaryPkg = require('cloudinary').v2;
} catch (e) {
  // Cloudinary npm package not installed yet, will use native REST API fallback
}

// Check if Cloudinary credentials are provided in environment
function isCloudinaryConfigured() {
  const hasKeys = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  return hasKeys || hasUrl;
}

// Configure Cloudinary SDK if available
if (cloudinaryPkg && isCloudinaryConfigured()) {
  if (process.env.CLOUDINARY_URL) {
    cloudinaryPkg.config();
  } else {
    cloudinaryPkg.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

/**
 * Uploads a base64 string or file buffer to Cloudinary.
 * Automatically saves MongoDB storage by replacing multi-MB base64 data
 * with a lightweight Cloudinary CDN URL (~80 bytes).
 *
 * @param {string} fileData - Base64 Data URI or existing URL
 * @param {string} folder - Folder name in Cloudinary (e.g. 'pulsechat_media', 'pulsechat_avatars')
 * @param {string} resourceType - 'auto' | 'image' | 'video' | 'raw'
 * @returns {Promise<string>} Secure HTTPS CDN URL of the uploaded asset
 */
async function uploadToCloudinary(fileData, folder = 'pulsechat_media', resourceType = 'auto') {
  if (!fileData || typeof fileData !== 'string') return fileData;

  // If already an external HTTP/HTTPS URL, don't re-upload
  if (fileData.startsWith('http://') || fileData.startsWith('https://')) {
    return fileData;
  }

  // If Cloudinary keys are not configured, return original data gracefully (no crash)
  if (!isCloudinaryConfigured()) {
    return fileData;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // 1. Try via Cloudinary SDK if available
  if (cloudinaryPkg && (cloudName || process.env.CLOUDINARY_URL)) {
    try {
      const result = await cloudinaryPkg.uploader.upload(fileData, {
        folder,
        resource_type: resourceType,
        overwrite: true
      });
      if (result && result.secure_url) {
        return result.secure_url;
      }
    } catch (sdkErr) {
      console.warn('Cloudinary SDK upload error, trying REST API fallback:', sdkErr.message);
    }
  }

  // 2. Zero-dependency native REST API fallback (works without npm install)
  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

      const formData = new URLSearchParams();
      formData.append('file', fileData);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('folder', folder);
      formData.append('signature', signature);

      const endpointType = resourceType === 'auto' ? 'auto' : resourceType;
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.secure_url) {
          return data.secure_url;
        }
      } else {
        const errText = await res.text();
        console.warn('Cloudinary REST API response not ok:', errText);
      }
    } catch (restErr) {
      console.warn('Cloudinary REST API upload failed:', restErr.message);
    }
  }

  // Fallback to original data if upload encounters an unexpected issue
  return fileData;
}

module.exports = {
  isCloudinaryConfigured,
  uploadToCloudinary
};
