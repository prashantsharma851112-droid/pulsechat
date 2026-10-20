const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createReceiptToken({ messageId, senderId, receiverId, expiresAt, exp }, secret) {
  // Normalize expiry to milliseconds timestamp
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : (exp ? Number(exp) : Date.now() + 30 * 24 * 60 * 60 * 1000);
  const body = base64url(JSON.stringify({
    v: 1,
    messageId,
    senderId,
    receiverId,
    exp: expiryMs,
    expiresAt: expiryMs
  }));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyReceiptToken(token, secret) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (
      payload?.v !== 1 ||
      typeof payload.messageId !== 'string' ||
      typeof payload.senderId !== 'string' ||
      typeof payload.receiverId !== 'string'
    ) return null;

    // Fail-closed validation: invalid, missing, or non-finite expiry strictly rejects
    const tokenExp = Number(payload.exp ?? payload.expiresAt);

    if (!Number.isFinite(tokenExp) || tokenExp <= Date.now()) {
      return null;
    }

    if (
      payload.exp != null &&
      payload.expiresAt != null &&
      Number(payload.exp) !== Number(payload.expiresAt)
    ) {
      return null;
    }

    payload.exp = tokenExp;
    payload.expiresAt = tokenExp;

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createReceiptToken,
  verifyReceiptToken
};
