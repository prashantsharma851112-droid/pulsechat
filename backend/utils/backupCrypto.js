/**
 * PulseChat Backup & Restore Cryptography Engine (AES-256-GCM + PBKDF2)
 *
 * Provides authenticated encryption, password-based key derivation,
 * strict account scoping, and integrity verification for offline device backups.
 */

const crypto = require('crypto');

const BACKUP_VERSION = 2;
const BACKUP_FORMAT = 'pulse_encrypted_backup';
const BACKUP_ALGORITHM = 'AES-256-GCM';
const BACKUP_KDF = 'PBKDF2-SHA256';
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const TAG_BYTE_LENGTH = 16;
const TAG_LENGTH_BITS = 128;
const MAX_BACKUP_BYTE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_BACKUP_RECORD_COUNT = 50000;

function bufferToBase64(buf) {
  if (Buffer.isBuffer(buf)) {
    return buf.toString('base64');
  }
  return Buffer.from(buf).toString('base64');
}

function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64');
}

/**
 * Verify whether a userId is an authentic participant of a direct chat room
 * Handles IDs with underscores and prevents substring prefix/suffix collisions.
 */
function isParticipantInChat(chatId, userId) {
  if (!chatId || !userId) return false;
  const cid = String(chatId).trim();
  const uid = String(userId).trim();
  if (cid === uid) return true;

  // Standard split check
  const parts = cid.split('_');
  if (parts.includes(uid)) return true;

  // Canonical sorted join check (handles IDs with underscores)
  if (cid.startsWith(uid + '_')) {
    const otherId = cid.slice(uid.length + 1);
    if (otherId && [uid, otherId].sort().join('_') === cid) {
      return true;
    }
  }
  if (cid.endsWith('_' + uid)) {
    const otherId = cid.slice(0, -(uid.length + 1));
    if (otherId && [otherId, uid].sort().join('_') === cid) {
      return true;
    }
  }
  return false;
}

/**
 * Filter messages strictly scoped to a user account
 * Never export or restore messages from unrelated accounts.
 */
function filterMessagesForUser(messages, userId) {
  if (!Array.isArray(messages) || !userId) return [];
  const uid = String(userId).trim();
  if (!uid) return [];

  return messages.filter((msg) => {
    if (!msg || typeof msg !== 'object') return false;

    const sender = String(msg.senderId || msg.sender || msg.senderUsername || '').trim();
    const recipient = String(msg.recipientId || msg.receiverId || msg.recipient || '').trim();
    const chatId = String(msg.chatId || '').trim();

    if (sender === uid || recipient === uid) return true;
    if (isParticipantInChat(chatId, uid)) return true;

    return false;
  });
}

/**
 * Encrypt a backup payload using AES-256-GCM and PBKDF2-SHA256
 */
async function encryptBackupPayload(payload, password, userContext) {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('BACKUP_PASSWORD_REQUIRED: Backup password must be at least 6 characters.');
  }

  const currentUserId = String(userContext?.id || userContext?._id || '').trim();
  if (!currentUserId) {
    throw new Error('AUTHENTICATION_REQUIRED: Authenticated user required for backup export.');
  }

  // Generate cryptographically secure random salt and IV
  const salt = crypto.randomBytes(SALT_BYTE_LENGTH);
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);

  // Derive 256-bit AES key using PBKDF2 with SHA-256
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');

  // Serialize payload to JSON
  const plaintext = JSON.stringify(payload);

  // Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertextBuf = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag() // 16-byte authentication tag appended
  ]);

  // Return versioned envelope
  return {
    pulseBackup: true,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    algorithm: BACKUP_ALGORITHM,
    kdf: BACKUP_KDF,
    iterations: PBKDF2_ITERATIONS,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    tagLength: TAG_LENGTH_BITS,
    ciphertext: bufferToBase64(ciphertextBuf),
    createdAt: new Date().toISOString(),
    account: {
      id: currentUserId,
      username: userContext?.username || ''
    }
  };
}

/**
 * Decrypt a backup envelope using AES-256-GCM and PBKDF2-SHA256
 */
async function decryptBackupPayload(envelope, password) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('INVALID_BACKUP_FORMAT: Envelope must be an object.');
  }

  if (envelope.version !== BACKUP_VERSION || envelope.format !== BACKUP_FORMAT) {
    throw new Error(`UNSUPPORTED_VERSION: Expected ${BACKUP_FORMAT} version ${BACKUP_VERSION}.`);
  }

  if (envelope.algorithm !== BACKUP_ALGORITHM) {
    throw new Error(`UNSUPPORTED_ALGORITHM: Only ${BACKUP_ALGORITHM} is supported.`);
  }

  const iterations = Number(envelope.iterations);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000) {
    throw new Error('INVALID_KDF_PARAMETERS: PBKDF2 iteration count out of safe bounds.');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('PASSWORD_REQUIRED: Backup password is required to decrypt.');
  }

  if (!envelope.salt || !envelope.iv || !envelope.ciphertext) {
    throw new Error('MALFORMED_ENVELOPE: Missing cryptographic parameters.');
  }

  const salt = base64ToBuffer(envelope.salt);
  const iv = base64ToBuffer(envelope.iv);
  const rawCiphertext = base64ToBuffer(envelope.ciphertext);

  if (salt.length !== SALT_BYTE_LENGTH) {
    throw new Error('INVALID_SALT: Salt length must be 16 bytes.');
  }
  if (iv.length !== IV_BYTE_LENGTH) {
    throw new Error('INVALID_IV: IV length must be 12 bytes.');
  }
  if (rawCiphertext.length < TAG_BYTE_LENGTH) {
    throw new Error('INVALID_CIPHERTEXT: Ciphertext too short to contain authentication tag.');
  }

  // Derive 256-bit AES key using PBKDF2 with envelope's salt and iterations
  const key = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

  // Split ciphertext and 16-byte authentication tag
  const tag = rawCiphertext.subarray(rawCiphertext.length - TAG_BYTE_LENGTH);
  const ciphertext = rawCiphertext.subarray(0, rawCiphertext.length - TAG_BYTE_LENGTH);

  let decrypted;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    // Fail securely without leaking details
    throw new Error('DECRYPTION_FAILED: Invalid password or corrupted/tampered backup file.');
  }

  let payload;
  try {
    payload = JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    throw new Error('MALFORMED_PAYLOAD: Decrypted data is not valid JSON.');
  }

  return payload;
}

/**
 * Validate restored payload structure, account ownership, data types, and record bounds
 */
function validateBackupPayload(payload, currentUser, envelopeAccount = null) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('INVALID_BACKUP_STRUCTURE: Payload must be an object.');
  }

  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
  if (!currentUserId) {
    throw new Error('AUTHENTICATION_REQUIRED: Must be logged in to restore a backup.');
  }

  // Validate account ownership from envelope
  if (envelopeAccount?.id && String(envelopeAccount.id).trim() !== currentUserId) {
    throw new Error(`ACCOUNT_MISMATCH: Backup belongs to account ${envelopeAccount.id}. Cannot restore into account ${currentUserId}.`);
  }

  // Validate account ownership inside payload
  const payloadUserId = String(payload.user?.id || payload.user?._id || '').trim();
  if (payloadUserId && payloadUserId !== currentUserId) {
    throw new Error(`ACCOUNT_MISMATCH: Backup belongs to account ${payloadUserId}. Cannot restore into account ${currentUserId}.`);
  }

  // App identifier check
  if (payload.app !== 'PulseChat') {
    throw new Error('INVALID_APP_SIGNATURE: Backup is not a PulseChat archive.');
  }

  // Record count bounds
  const rawMessages = payload.messages;
  if (!Array.isArray(rawMessages)) {
    throw new Error('INVALID_MESSAGES_FORMAT: Messages must be an array.');
  }

  if (rawMessages.length > MAX_BACKUP_RECORD_COUNT) {
    throw new Error(`RECORD_COUNT_EXCEEDED: Backup contains ${rawMessages.length} messages, exceeding maximum limit of ${MAX_BACKUP_RECORD_COUNT}.`);
  }

  // Validate each message record against schema and prototype pollution
  const validatedMessages = [];
  const bannedKeys = ['__proto__', 'constructor', 'prototype'];

  for (let i = 0; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      continue; // Skip invalid entries
    }

    // Guard against prototype pollution
    let hasPollution = false;
    for (const key of Object.keys(msg)) {
      if (bannedKeys.includes(key)) {
        hasPollution = true;
        break;
      }
    }
    if (hasPollution) continue;

    // Check message ID
    const msgId = String(msg.id || msg.clientTempId || '').trim();
    if (!msgId || msgId.length > 128) continue;

    // Check chatId
    const chatId = String(msg.chatId || '').trim();
    if (!chatId || chatId.length > 128) continue;

    // Verify message involvement with current user
    const sender = String(msg.senderId || msg.sender || msg.senderUsername || '').trim();
    const recipient = String(msg.recipientId || msg.receiverId || msg.recipient || '').trim();
    const isParticipant = (sender === currentUserId) ||
      (recipient === currentUserId) ||
      isParticipantInChat(chatId, currentUserId);

    if (!isParticipant) {
      // Exclude messages belonging to foreign accounts
      continue;
    }

    // Validate timestamp
    const rawTime = msg.timestamp || msg.createdAt;
    const dateObj = rawTime ? new Date(rawTime) : new Date();
    const timestamp = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();

    // Sanitize content
    let content = typeof msg.content === 'string' ? msg.content.slice(0, 65536) : '';

    validatedMessages.push({
      id: msgId,
      chatId,
      senderId: sender || currentUserId,
      recipientId: recipient || '',
      content,
      type: typeof msg.type === 'string' ? msg.type.slice(0, 32) : 'text',
      timestamp,
      createdAt: timestamp,
      status: typeof msg.status === 'string' ? msg.status.slice(0, 32) : 'delivered'
    });
  }

  // Validate recent chats if present
  let validatedRecentChats = [];
  if (Array.isArray(payload.recentChats)) {
    validatedRecentChats = payload.recentChats.filter(chat => {
      if (!chat || typeof chat !== 'object') return false;
      const cId = String(chat.chatId || chat.id || '').trim();
      return cId.length > 0 && cId.length <= 128;
    }).slice(0, 500);
  }

  return {
    user: {
      id: currentUserId,
      username: payload.user?.username || currentUser?.username || ''
    },
    messages: validatedMessages,
    recentChats: validatedRecentChats
  };
}

module.exports = {
  BACKUP_VERSION,
  BACKUP_FORMAT,
  BACKUP_ALGORITHM,
  BACKUP_KDF,
  PBKDF2_ITERATIONS,
  SALT_BYTE_LENGTH,
  IV_BYTE_LENGTH,
  TAG_BYTE_LENGTH,
  TAG_LENGTH_BITS,
  MAX_BACKUP_BYTE_SIZE,
  MAX_BACKUP_RECORD_COUNT,
  encryptBackupPayload,
  decryptBackupPayload,
  filterMessagesForUser,
  validateBackupPayload,
  isParticipantInChat,
  bufferToBase64,
  base64ToBuffer
};
