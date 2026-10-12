const crypto = require('crypto');

/**
 * Cloudflare R2 Storage Adapter with Zero Egress Fees ($0 Bandwidth).
 * S3-compatible API for storing photos, videos, and media files.
 *
 * Supports:
 * - Direct Pre-Signed Upload URLs (client uploads directly to R2 edge)
 * - Server-side upload fallback
 * - Automatic fallback to Cloudinary if R2 credentials are not set
 */

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getR2PublicDomain() {
  let domain = process.env.R2_PUBLIC_DOMAIN || process.env.R2_CUSTOM_DOMAIN || '';
  if (domain && !domain.startsWith('http://') && !domain.startsWith('https://')) {
    domain = `https://${domain}`;
  }
  return domain.replace(/\/+$/, '');
}

/**
 * Generate an AWS S3/Cloudflare R2 compatible pre-signed PUT URL
 * using standard Node.js crypto (no heavy AWS SDK package required).
 */
function generateR2PresignedUrl(fileName, contentType = 'application/octet-stream', expiresIn = 3600) {
  if (!isR2Configured()) return null;

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const safeFileName = encodeURIComponent(fileName).replace(/%2F/g, '/');
  const canonicalUri = `/${bucket}/${safeFileName}`;

  const queryParams = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresIn)],
    ['X-Amz-SignedHeaders', 'host']
  ];

  queryParams.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  function getSignatureKey(key, date, reg, svc) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(reg).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(svc).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const uploadUrl = `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  const publicDomain = getR2PublicDomain();
  const publicUrl = publicDomain
    ? `${publicDomain}/${safeFileName}`
    : `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${safeFileName}`;

  return {
    uploadUrl,
    publicUrl,
    key: safeFileName,
    provider: 'r2'
  };
}

/**
 * Upload binary buffer directly to Cloudflare R2 via HTTP PUT
 */
async function uploadBufferToR2(buffer, fileName, contentType = 'application/octet-stream') {
  if (!isR2Configured()) return null;
  const presigned = generateR2PresignedUrl(fileName, contentType);
  if (!presigned) return null;

  const res = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType
    },
    body: buffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${errText}`);
  }

  return presigned.publicUrl;
}

module.exports = {
  isR2Configured,
  getR2PublicDomain,
  generateR2PresignedUrl,
  uploadBufferToR2
};
