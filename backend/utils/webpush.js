// Zero-Dependency Native Web Push Utility for Node.js
// Implements VAPID (RFC 8292) and Push Encryption (RFC 8291 aes128gcm) using Node's crypto & https

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Base64URL helper
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

// Persistent VAPID Keypair
// Generated on prime256v1 (P-256) curve
let vapidKeyPair = null;
let vapidKeys = {
  publicKey: '',
  privateKey: ''
};

function initVapidKeys() {
  try {
    // Generate standard P-256 EC keys
    vapidKeyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Extract raw 65-byte uncompressed public key (0x04 + X + Y)
    const ecKey = crypto.createECDH('prime256v1');
    ecKey.setPrivateKey(crypto.createPrivateKey(vapidKeyPair.privateKey).export({ type: 'pkcs8', format: 'der' }).slice(-32));
    const rawPublicKey = ecKey.getPublicKey();

    vapidKeys.publicKey = toBase64Url(rawPublicKey);
    vapidKeys.privateKey = vapidKeyPair.privateKey;
  } catch (err) {
    console.error('Failed to initialize VAPID keys:', err);
  }
}

initVapidKeys();

function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

// Create VAPID Authorization JWT
function createVapidJwt(audience, subject = 'mailto:support@pulsechat.app') {
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

  // Sign with VAPID private key
  const derSig = signer.sign(vapidKeyPair.privateKey);

  // Convert DER signature to raw 64-byte IEEE P1363 (R || S) format
  const rLength = derSig[3];
  const rOffset = 4;
  let r = derSig.slice(rOffset, rOffset + rLength);
  if (r.length === 33 && r[0] === 0) r = r.slice(1);

  const sOffset = rOffset + rLength + 2;
  const sLength = derSig[sOffset - 1];
  let s = derSig.slice(sOffset, sOffset + sLength);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);

  // Pad to 32 bytes each if needed
  if (r.length < 32) r = Buffer.concat([Buffer.alloc(32 - r.length, 0), r]);
  if (s.length < 32) s = Buffer.concat([Buffer.alloc(32 - s.length, 0), s]);

  const rawSig = Buffer.concat([r, s]);
  return `${dataToSign}.${toBase64Url(rawSig)}`;
}

// Encrypt payload according to RFC 8291 (aes128gcm)
function encryptPayload(subscription, payloadBuffer) {
  const clientPublicKey = fromBase64Url(subscription.keys.p256dh);
  const clientAuthToken = fromBase64Url(subscription.keys.auth);

  // Generate 16-byte random salt
  const salt = crypto.randomBytes(16);

  // Generate ephemeral local ECDH key pair
  const localEcdh = crypto.createECDH('prime256v1');
  localEcdh.generateKeys();
  const localPublicKey = localEcdh.getPublicKey();

  // Shared secret
  const sharedSecret = localEcdh.computeSecret(clientPublicKey);

  // HKDF derivation helpers
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

  // Key derivation for aes128gcm
  const authInfo = Buffer.from('WebPush: info\0');
  const context = Buffer.concat([
    Buffer.from('P-256\0'),
    Buffer.from([0, 65]),
    clientPublicKey,
    Buffer.from([0, 65]),
    localPublicKey
  ]);

  const ikm = hkdf(clientAuthToken, sharedSecret, Buffer.concat([authInfo, context]), 32);

  const cekInfo = Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0')]);
  const nonceInfo = Buffer.concat([Buffer.from('Content-Encoding: nonce\0')]);

  const cek = hkdf(salt, ikm, cekInfo, 16);
  const nonce = hkdf(salt, ikm, nonceInfo, 12);

  // Padding delimiter (0x02 for final record)
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
 * @returns {Promise<boolean>}
 */
async function sendPushNotification(subscription, payload = null) {
  if (!subscription || !subscription.endpoint) {
    return false;
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
        Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`
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
            resolve(true);
          } else {
            // 410 or 404 indicates expired subscription
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.warn('Web Push dispatch error:', err.message);
        resolve(false);
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    } catch (err) {
      console.warn('Failed to dispatch Web Push:', err.message);
      resolve(false);
    }
  });
}

module.exports = {
  getVapidPublicKey,
  sendPushNotification
};
