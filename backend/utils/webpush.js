// web push helper
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Base64URL helpers
function toBase64Url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

// In-memory VAPID keys loaded securely from environment variables or ephemeral keypair
let vapidKeyPair = {
  publicKey: '',
  privateKey: ''
};

let vapidKeys = {
  publicKey: '',
  privateKey: ''
};

/**
 * Generate standard P-256 EC Keypair and derive raw 65-byte uncompressed public key
 */
function generateP256KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });

  const jwk = publicKey.export({ format: 'jwk' });
  const x = fromBase64Url(jwk.x);
  const y = fromBase64Url(jwk.y);
  const rawPublicKey = Buffer.concat([Buffer.from([4]), x, y]);

  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  return {
    publicKeyPem,
    privateKeyPem,
    publicKeyBase64Url: toBase64Url(rawPublicKey)
  };
}

/**
 * Initialize VAPID Keys:
 * 1. Checks process.env (VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY)
 * 2. If missing in development/test, generates in-memory ephemeral keypair (never written to disk)
 */
function initVapidKeys() {
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const pub = process.env.VAPID_PUBLIC_KEY.trim();
      let priv = process.env.VAPID_PRIVATE_KEY.trim();
      if (priv.includes('\\n')) {
        priv = priv.replace(/\\n/g, '\n');
      }
      vapidKeys.publicKey = pub;
      vapidKeys.privateKey = priv;
      vapidKeyPair.privateKey = priv;
      return;
    }

    // In-memory ephemeral fallback (used only if environment variables are not yet configured)
    const generated = generateP256KeyPair();
    vapidKeys.publicKey = generated.publicKeyBase64Url;
    vapidKeys.privateKey = generated.privateKeyPem;
    vapidKeyPair.privateKey = generated.privateKeyPem;

    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ [WebPush] Warning: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not configured in environment variables. Web push notifications will use ephemeral keys that will reset upon container restart.');
    }
  } catch (err) {
    console.error('Failed to initialize VAPID keys:', err);
  }
}

initVapidKeys();

/**
 * Sync VAPID keys with MongoDB collection so cloud hosting like Render
 * preserves the exact same keys across container rebuilds.
 */
async function syncWithMongo(VapidKeyModel) {
  try {
    if (!VapidKeyModel) return;
    // Explicit environment variables always take precedence over MongoDB fallback
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      return;
    }
    const existing = await VapidKeyModel.findOne({ keyId: 'default_vapid_key' });
    if (existing && existing.publicKey && existing.privateKey) {
      vapidKeys.publicKey = existing.publicKey;
      vapidKeys.privateKey = existing.privateKey;
      vapidKeyPair.privateKey = existing.privateKey;
      console.log('🔑 Loaded persistent VAPID keys from MongoDB');
    } else {
      await VapidKeyModel.create({
        keyId: 'default_vapid_key',
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey
      });
      console.log('🔑 Stored new persistent VAPID keys to MongoDB');
    }
  } catch (err) {
    console.warn('MongoDB VAPID sync notice:', err.message);
  }
}

function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

/**
 * Create RFC 8292 VAPID Authorization JWT
 * Uses IEEE P1363 (raw R || S 64-byte) ECDSA signature
 */
function createVapidJwt(audience, subject = process.env.VAPID_SUBJECT || 'mailto:support@pulsechat.app') {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600, // 12 hours
    sub: subject
  };

  const encodedHeader = toBase64Url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('SHA256');
  signer.update(dataToSign);
  signer.end();

  // Sign using Node's standard IEEE P1363 output for raw 64-byte (R || S)
  const rawSig = signer.sign({
    key: vapidKeyPair.privateKey,
    dsaEncoding: 'ieee-p1363'
  });

  return `${dataToSign}.${toBase64Url(rawSig)}`;
}

/**
 * Encrypt payload strictly according to RFC 8291 (aes128gcm)
 */
function encryptPayload(subscription, payloadBuffer) {
  const clientPublicKey = fromBase64Url(subscription.keys.p256dh);
  const clientAuthToken = fromBase64Url(subscription.keys.auth);

  // Generate 16-byte random salt
  const salt = crypto.randomBytes(16);

  // Ephemeral local ECDH key pair
  const localEcdh = crypto.createECDH('prime256v1');
  localEcdh.generateKeys();
  const localPublicKey = localEcdh.getPublicKey();

  // Shared secret via ECDH
  const sharedSecret = localEcdh.computeSecret(clientPublicKey);

  // HKDF Helpers
  function hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  function hkdf(saltBuf, ikm, info, length) {
    const prk = hmacSha256(saltBuf, ikm);
    let okm = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    let counter = 1;
    while (okm.length < length) {
      prev = hmacSha256(prk, Buffer.concat([prev, info, Buffer.from([counter])]));
      okm = Buffer.concat([okm, prev]);
      counter++;
    }
    return okm.slice(0, length);
  }

  // RFC 8291 Section 3.2:
  // info = "WebPush: info\0" || clientPublicKey || localPublicKey
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublicKey,
    localPublicKey
  ]);

  const ikm = hkdf(clientAuthToken, sharedSecret, info, 32);

  // RFC 8291 Section 3.3: Derive CEK & Nonce
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);

  // RFC 8188: Delimiter 0x02 for final record
  const paddedRecord = Buffer.concat([payloadBuffer, Buffer.from([2])]);

  // Cipher AES-128-GCM
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(paddedRecord), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Assemble RFC 8291 payload:
  // salt (16) + recordSize (4, 4096 = 0x00001000) + keyLength (1, 65 = 0x41) + localPublicKey (65) + ciphertext + tag
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([localPublicKey.length]),
    localPublicKey,
    ciphertext,
    tag
  ]);
}

/**
 * Send Web Push notification to a given PushSubscription
 * @param {Object} subscription - { endpoint, keys: { p256dh, auth } }
 * @param {Object|string} payload - JSON or text notification payload
 * @returns {Promise<{ success: boolean, expired?: boolean }>}
 */
async function sendPushNotification(subscription, payload = null) {
  if (!subscription || !subscription.endpoint) {
    return { success: false, expired: false };
  }

  return new Promise((resolve) => {
    try {
      const endpointUrl = new URL(subscription.endpoint);
      const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
      const jwt = createVapidJwt(audience);

      let bodyData = null;
      const headers = {
        TTL: '86400',
        Urgency: 'high',
        Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        'Crypto-Key': `p256ecdsa=${vapidKeys.publicKey}`
      };

      if (payload && subscription.keys && subscription.keys.p256dh && subscription.keys.auth) {
        const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
        bodyData = encryptPayload(subscription, Buffer.from(payloadStr, 'utf8'));
        headers['Content-Type'] = 'application/octet-stream';
        headers['Content-Encoding'] = 'aes128gcm';
        headers['Content-Length'] = bodyData.length;
      } else {
        headers['Content-Length'] = '0';
      }

      const reqOptions = {
        method: 'POST',
        headers: headers
      };

      const client = endpointUrl.protocol === 'https:' ? https : http;
      const req = client.request(subscription.endpoint, reqOptions, (res) => {
        let resData = '';
        res.on('data', chunk => { resData += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, expired: false });
          } else if (res.statusCode === 404 || res.statusCode === 410) {
            // Subscription has expired or unsubscribed
            resolve({ success: false, expired: true });
          } else {
            console.warn(`Web Push endpoint responded with status ${res.statusCode}: ${resData}`);
            resolve({ success: false, expired: false });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('Web Push dispatch error:', err.message);
        resolve({ success: false, expired: false });
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    } catch (err) {
      console.warn('Failed to dispatch Web Push:', err.message);
      resolve({ success: false, expired: false });
    }
  });
}

module.exports = {
  getVapidPublicKey,
  sendPushNotification,
  syncWithMongo
};
