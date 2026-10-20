const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createReceiptToken({ messageId, senderId, receiverId }, secret) {
  const body = base64url(JSON.stringify({ v: 1, messageId, senderId, receiverId }));
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
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createReceiptToken,
  verifyReceiptToken
};
