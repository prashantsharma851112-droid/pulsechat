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

/**
 * Validates that a Cloudinary publicId is in canonical form and belongs strictly
 * to the application's permitted folders ('pulsechat_media/' or 'pulsechat_voice/').
 *
 * Strict validation:
 * - Must be a non-empty string <= 255 characters.
 * - Rejects absolute URLs and URL schemes (contains '://', '//', 'http:', etc.).
 * - Rejects directory traversal (contains '..', '/./', '\\').
 * - Rejects unexpected separators and special characters ('?', '#', '%', '\0', whitespace).
 * - Matches canonical structure: (pulsechat_media|pulsechat_voice)/[a-zA-Z0-9_\-]+
 *
 * @param {string} publicId
 * @returns {boolean}
 */
function isValidCloudinaryPublicId(publicId) {
  if (!publicId || typeof publicId !== 'string') return false;
  if (publicId.trim() !== publicId) return false;
  if (publicId.length === 0 || publicId.length > 255) return false;

  // Strict rejection of URL schemes, traversal, and malicious characters
  if (
    publicId.includes('://') ||
    publicId.includes('//') ||
    publicId.includes('\\') ||
    publicId.includes('..') ||
    publicId.includes('?') ||
    publicId.includes('#') ||
    publicId.includes('%') ||
    publicId.includes('\0') ||
    /\s/.test(publicId)
  ) {
    return false;
  }

  // Canonical pattern: exactly one permitted folder prefix followed by a valid asset identifier
  const canonicalRegex = /^(pulsechat_media|pulsechat_voice)\/[a-zA-Z0-9_\-]+$/;
  return canonicalRegex.test(publicId);
}

/**
 * Extracts publicId from a Cloudinary URL if present.
 * Example: https://res.cloudinary.com/cloud/image/upload/v12345/pulsechat_media/myphoto.jpg
 * Returns: "pulsechat_media/myphoto"
 */
function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:' || urlObj.hostname.toLowerCase() !== 'res.cloudinary.com') {
      return null;
    }

    const parts = urlObj.pathname.split('/');
    const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!configuredCloudName || parts[1] !== configuredCloudName) return null;

    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1 || uploadIndex >= parts.length - 1) return null;
    let pathAfterUpload = parts.slice(uploadIndex + 1);
    // Strip version tag (e.g. v12345678)
    if (pathAfterUpload[0] && /^v\d+$/.test(pathAfterUpload[0])) {
      pathAfterUpload = pathAfterUpload.slice(1);
    }
    const fullPathWithExt = pathAfterUpload.join('/');
    const isApplicationAsset = ['pulsechat_media/', 'pulsechat_voice/']
      .some(prefix => fullPathWithExt.startsWith(prefix));
    if (!isApplicationAsset) return null;

    const lastDot = fullPathWithExt.lastIndexOf('.');
    return lastDot !== -1 ? fullPathWithExt.substring(0, lastDot) : fullPathWithExt;
  } catch (_) {
    return null;
  }
}

/**
 * Deletes an asset from Cloudinary by publicId.
 * Safe no-op if Cloudinary is not configured.
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId || typeof publicId !== 'string') return false;

  // Validate publicId is strictly canonical and in permitted folders
  if (!isValidCloudinaryPublicId(publicId)) {
    console.warn('[Cloudinary Security] Invalid or unsafe publicId rejected for deletion');
    return false;
  }

  if (!isCloudinaryConfigured()) return false;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // 1. Try SDK if available
  if (cloudinaryPkg && (cloudName || process.env.CLOUDINARY_URL)) {
    try {
      const res = await cloudinaryPkg.uploader.destroy(publicId, {
        resource_type: resourceType === 'auto' ? 'image' : resourceType
      });
      return res?.result === 'ok' || res?.result === 'not found';
    } catch (sdkErr) {
      console.warn('Cloudinary SDK destroy error, trying REST API fallback:', sdkErr.message);
    }
  }

  // 2. Native REST API fallback
  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

      const formData = new URLSearchParams();
      formData.append('public_id', publicId);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);

      const endpointType = resourceType === 'auto' ? 'image' : resourceType;
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/destroy`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        return data?.result === 'ok' || data?.result === 'not found';
      }
    } catch (restErr) {
      console.warn('Cloudinary REST API destroy failed:', restErr.message);
    }
  }
  return false;
}

module.exports = {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  isValidCloudinaryPublicId
};
