import {
  encryptBackupPayload,
  decryptBackupPayload,
  filterMessagesForUser,
  validateBackupPayload,
  MAX_BACKUP_BYTE_SIZE
} from './backupCrypto';

// Local-First Device Database for PulseChat (IndexedDB)
// Emulates WhatsApp's SQLite local-first architecture on Web / PWA.
// Allows storing tens of thousands of messages, chats, and media locally on the user's phone/PC SSD.
// Queries run locally in 1-2 milliseconds with ZERO network calls!

const DB_NAME = 'pulsechat_local_db';
const DB_VERSION = 1;
const STORE_MESSAGES = 'messages';
const STORE_MEDIA = 'media_blobs';

let dbPromise = null;

function getDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Store: messages (keyed by message id, indexed by chatId and timestamp)
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          msgStore.createIndex('chatId', 'chatId', { unique: false });
          msgStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store: media_blobs (cached image/audio blobs)
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'url' });
        }
      };

      request.onsuccess = (e) => {
        resolve(e.target.result);
      };

      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB not supported or blocked:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Check if Chat Backup is enabled (DEFAULT ON for all users)
 */
export function isChatBackupEnabled(userId = '') {
  try {
    const key = `pulse_chat_backup_enabled_${userId || 'default'}`;
    const val = localStorage.getItem(key);
    if (val === null) return true; // Default is always ON
    return val === 'true';
  } catch (_) {
    return true;
  }
}

/**
 * Set Chat Backup enabled / disabled
 */
export function setChatBackupEnabled(userId = '', enabled = true) {
  try {
    const key = `pulse_chat_backup_enabled_${userId || 'default'}`;
    localStorage.setItem(key, String(enabled));
    window.dispatchEvent(new CustomEvent('pulsechat_backup_setting_changed', { detail: { enabled, userId } }));
  } catch (_) {}
}

/**
 * Save messages to local IndexedDB with true transaction completion promise.
 * Uses a single readwrite transaction and strictly resolves only on tx.oncomplete.
 * Rejects on quota error or transaction abort so caller can suppress delivery ACK.
 */
export async function saveMessagesToLocalDb(chatId, messages) {
  if (!chatId || !Array.isArray(messages) || messages.length === 0) return true;
  const db = await getDb();
  if (!db) throw new Error('IndexedDB is not available on this device.');

  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);

      for (const msg of messages) {
        if (msg && (msg.id || msg.clientTempId)) {
          // If message now has real ID, clean up old clientTempId optimistic entry
          if (msg.clientTempId && msg.id && String(msg.clientTempId) !== String(msg.id)) {
            try {
              store.delete(String(msg.clientTempId));
            } catch (_) {}
          }
          const record = {
            ...msg,
            id: String(msg.id || msg.clientTempId),
            chatId: String(canonicalChatId || chatId),
            timestamp: msg.timestamp || msg.createdAt || new Date().toISOString()
          };
          store.put(record);
        }
      }

      tx.oncomplete = () => resolve(true);
      tx.onabort = (e) => reject(tx.error || e || new Error('IndexedDB transaction aborted'));
      tx.onerror = (e) => reject(tx.error || e || new Error('IndexedDB transaction error'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Query messages from local IndexedDB by chatId with optional pagination.
 * Queries both standard and canonical sorted chatId to ensure full history symmetry.
 * Runs in 1-2 milliseconds on local storage.
 */
export async function getMessagesFromLocalDb(chatId, limit = 100, beforeTimestamp = null) {
  if (!chatId) return [];
  const db = await getDb();
  if (!db) return [];

  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  const targetKeys = Array.from(new Set([String(chatId), String(canonicalChatId)].filter(Boolean)));

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_MESSAGES], 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const index = store.index('chatId');

      const allResults = [];
      let pendingRequests = targetKeys.length;

      targetKeys.forEach(k => {
        const req = index.getAll(k);
        req.onsuccess = (e) => {
          if (Array.isArray(e.target.result)) {
            allResults.push(...e.target.result);
          }
          pendingRequests--;
          if (pendingRequests === 0) {
            // Deduplicate by unique id / clientTempId
            const uniqueMap = new Map();
            for (const item of allResults) {
              const uKey = String(item.id || item._id || item.clientTempId || '');
              if (uKey && !uniqueMap.has(uKey)) {
                uniqueMap.set(uKey, item);
              }
            }

            let all = Array.from(uniqueMap.values());
            // Sort chronologically
            all.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

            if (beforeTimestamp) {
              const beforeDate = new Date(beforeTimestamp).getTime();
              all = all.filter(m => new Date(m.timestamp || 0).getTime() < beforeDate);
            }

            if (limit && all.length > limit) {
              all = all.slice(-limit);
            }

            resolve(all);
          }
        };
        req.onerror = () => {
          pendingRequests--;
          if (pendingRequests === 0) {
            resolve([]);
          }
        };
      });
    } catch (err) {
      resolve([]);
    }
  });
}

/**
 * Remove deleted messages from local IndexedDB so they never reappear
 */
export async function deleteMessagesFromLocalDb(messageIds) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;
  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    for (const id of messageIds) {
      if (id) store.delete(String(id));
    }
  } catch (err) {
    console.warn('deleteMessagesFromLocalDb error:', err);
  }
}

/**
 * Remove all messages of a chat from local IndexedDB
 */
export async function clearChatFromLocalDb(chatId) {
  if (!chatId) return;
  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const index = store.index('chatId');
    const request = index.getAllKeys(String(chatId));
    request.onsuccess = (e) => {
      const keys = e.target.result || [];
      for (const k of keys) {
        store.delete(k);
      }
    };
  } catch (err) {
    console.warn('clearChatFromLocalDb error:', err);
  }
}

/**
 * Purge messages older than N days from local IndexedDB
 */
export async function cleanOldMessagesFromLocalDb(days = 7) {
  const db = await getDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const tx = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      const request = store.openCursor();
      let cleaned = 0;

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const msg = cursor.value;
          const t = new Date(msg.timestamp || msg.createdAt || 0).getTime();
          if (t && t < cutoffTime) {
            cursor.delete();
            cleaned++;
          }
          cursor.continue();
        } else {
          resolve(cleaned);
        }
      };

      request.onerror = () => resolve(cleaned);
      tx.oncomplete = () => resolve(cleaned);
      tx.onerror = () => resolve(cleaned);
    } catch (err) {
      console.warn('cleanOldMessagesFromLocalDb error:', err);
      resolve(0);
    }
  });
}

/**
 * Update a message in local IndexedDB (e.g. status='deleted', content='This message was deleted')
 */
export async function updateMessageInLocalDb(msgId, updates) {
  if (!msgId || !updates) return;
  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const getReq = store.get(String(msgId));
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
    };
  } catch (err) {
    console.warn('updateMessageInLocalDb error:', err);
  }
}

/**
 * Store a downloaded media Blob locally in IndexedDB (permanent disk cache).
 */
export async function saveMediaBlobToLocalDb(url, blob) {
  if (!url || !blob) return;
  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction([STORE_MEDIA], 'readwrite');
    tx.objectStore(STORE_MEDIA).put({ url, blob, cachedAt: Date.now() });
  } catch (_) {}
}

/**
 * Retrieve a cached media Blob from local IndexedDB.
 */
export async function getMediaBlobFromLocalDb(url) {
  if (!url) return null;
  const db = await getDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_MEDIA], 'readonly');
      const request = tx.objectStore(STORE_MEDIA).get(url);
      request.onsuccess = (e) => {
        resolve(e.target.result?.blob || null);
      };
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Retrieve all messages stored on this device across all chats (for full device backup)
 */
export async function getAllMessagesFromLocalDb() {
  const db = await getDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_MESSAGES], 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const request = store.getAll();
      request.onsuccess = (e) => {
        resolve(e.target.result || []);
      };
      request.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

/**
 * Get device storage stats (Total messages & estimated local space)
 */
export async function getLocalDatabaseStats() {
  const db = await getDb();
  if (!db) return { count: 0, sizeEstimated: '0 KB' };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_MESSAGES], 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const count = countReq.result || 0;
        const approxBytes = count * 350;
        const sizeEstimated = approxBytes < 1024 * 1024
          ? `${(approxBytes / 1024).toFixed(1)} KB`
          : `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`;
        resolve({ count, sizeEstimated });
      };
      countReq.onerror = () => resolve({ count: 0, sizeEstimated: '0 KB' });
    } catch (_) {
      resolve({ count: 0, sizeEstimated: '0 KB' });
    }
  });
}

/**
 * WhatsApp-Style Chat Export (Zero Server Bandwidth - 100% On-Device)
 * Generates a clean .txt transcript directly from IndexedDB / memory.
 */
export async function exportChatTranscript({ chatId, chatTitle, currentUserId, currentUserName, fallbackMessages = [] }) {
  let msgs = [];
  try {
    msgs = await getMessagesFromLocalDb(chatId, 15000);
  } catch (_) {}

  if (!msgs || msgs.length === 0) {
    msgs = fallbackMessages || [];
  }

  // Deduplicate and sort chronologically
  const map = new Map();
  for (const m of msgs) {
    if (m) {
      const key = String(m.id || m._id || m.clientTempId || `${m.timestamp}_${m.content}`);
      if (!map.has(key)) map.set(key, m);
    }
  }
  const sorted = Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0)
  );

  const now = new Date();
  const exportHeader = [
    '======================================================================',
    ` PulseChat Conversation: ${chatTitle || 'Chat'}`,
    ` Export Date: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`,
    ` Total Messages: ${sorted.length}`,
    ' Architecture: 100% On-Device Storage (0 Server Bandwidth / 0 Cloud Hit)',
    '======================================================================',
    ''
  ].join('\r\n');

  const lines = sorted.map((m) => {
    const rawTime = m.timestamp || m.createdAt;
    const timeStr = rawTime
      ? new Date(rawTime).toLocaleString([], {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : 'Unknown Time';

    const isMe =
      (m.senderId && currentUserId && String(m.senderId) === String(currentUserId)) ||
      (m.sender && currentUserId && String(m.sender) === String(currentUserId)) ||
      (m.senderUsername && currentUserName && m.senderUsername === currentUserName);

    const senderLabel = isMe
      ? currentUserName || 'You'
      : m.senderUsername || m.senderName || chatTitle || 'User';

    let content = m.content || '';
    if (m.giftMetadata || m.isGift) {
      const giftName = m.giftMetadata?.name || 'Spark Gift';
      const sparks = m.giftMetadata?.sparks || 0;
      content = `🎁 [Spark Gift: ${giftName} (${sparks} Sparks)] ${content}`.trim();
    }
    if (m.mediaUrl || m.isImage || m.audioUrl) {
      const mediaTag = m.audioUrl ? '[Voice Note]' : '[Media Attachment]';
      const link = m.mediaUrl || m.audioUrl || '';
      content = `${mediaTag} ${content} ${link ? `(Link: ${link})` : ''}`.trim();
    }
    if (m.status === 'deleted' || m.isDeleted) {
      content = '🚫 [This message was deleted]';
    }

    return `[${timeStr}] ${senderLabel}: ${content}`;
  });

  const fullText =
    exportHeader +
    '\r\n' +
    lines.join('\r\n') +
    '\r\n\r\n======================================================================\r\nEnd of Conversation\r\n';

  const cleanName = (chatTitle || 'Chat').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PulseChat_${cleanName}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}.txt`;

  const fileBlob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });

  // Native Share sheet for mobile/tablets
  if (navigator.canShare && typeof navigator.share === 'function') {
    try {
      const file = new File([fileBlob], filename, { type: 'text/plain' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `PulseChat - ${chatTitle}`,
          text: `Chat export with ${chatTitle} (${sorted.length} messages)`
        });
        return { success: true, count: sorted.length, filename, shared: true };
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: true, count: sorted.length, filename, cancelled: true };
      }
    }
  }

  // Web / Desktop file download trigger
  const blobUrl = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

  return { success: true, count: sorted.length, filename, downloaded: true };
}

/**
 * WhatsApp-Style Full Device Backup (Zero Cloud Bandwidth / Authenticated Encryption)
 * Encrypts all local IndexedDB messages & cached chats into an AES-256-GCM .pulse archive.
 * Scoped strictly to the currently authenticated account.
 */
export async function createFullDeviceBackup(currentUser, password) {
  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
  if (!currentUserId) {
    throw new Error('AUTHENTICATION_REQUIRED: Log in to export backup.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('BACKUP_PASSWORD_REQUIRED: Please enter a backup password of at least 6 characters.');
  }

  const allMessages = await getAllMessagesFromLocalDb();
  const scopedMessages = filterMessagesForUser(allMessages, currentUserId);

  let recentChats = [];
  try {
    const rawChats = localStorage.getItem(`pulsechat_recent_${currentUserId}`);
    if (rawChats) recentChats = JSON.parse(rawChats);
  } catch (_) {}

  const now = new Date();
  const backupPayload = {
    app: 'PulseChat',
    version: 2,
    type: 'device_backup',
    createdAt: now.toISOString(),
    user: {
      id: currentUserId,
      username: currentUser?.username || '',
      displayName: currentUser?.displayName || ''
    },
    stats: {
      totalMessages: scopedMessages.length,
      totalChats: recentChats.length
    },
    recentChats,
    messages: scopedMessages
  };

  const encryptedEnvelope = await encryptBackupPayload(backupPayload, password, {
    id: currentUserId,
    username: currentUser?.username || ''
  });

  const jsonStr = JSON.stringify(encryptedEnvelope, null, 2);
  const fileBlob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `PulseChat_Backup_${currentUser?.username || 'user'}_${now.toISOString().slice(0, 10)}.pulse`;

  const blobUrl = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

  try {
    localStorage.setItem('pulse_last_backup_time', now.toISOString());
  } catch (_) {}

  const approxSize = jsonStr.length;
  const sizeFormatted = approxSize < 1024 * 1024
    ? `${(approxSize / 1024).toFixed(1)} KB`
    : `${(approxSize / (1024 * 1024)).toFixed(2)} MB`;

  return {
    success: true,
    totalMessages: scopedMessages.length,
    totalChats: recentChats.length,
    filename,
    size: sizeFormatted,
    backupTime: now.toISOString()
  };
}

/**
 * WhatsApp-Style Restore from Device Backup (Zero Cloud Bandwidth / Authenticated Encryption)
 * Decrypts with AES-256-GCM, validates account ownership, schema, and record limits,
 * and restores messages atomically into IndexedDB.
 */
export async function restoreFullDeviceBackup(fileContent, currentUser = null, password = '') {
  if (!fileContent) throw new Error('Backup file is empty.');

  if (typeof fileContent === 'string' && fileContent.length > MAX_BACKUP_BYTE_SIZE) {
    throw new Error('PAYLOAD_TOO_LARGE: Backup file exceeds the maximum 50MB size limit.');
  }

  const currentUserId = String(currentUser?.id || currentUser?._id || '').trim();
  if (!currentUserId) {
    throw new Error('AUTHENTICATION_REQUIRED: Log in to restore chat history.');
  }

  let data;
  try {
    data = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
  } catch (_) {
    throw new Error('INVALID_BACKUP_FORMAT: File is not valid JSON.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('INVALID_BACKUP_FORMAT: Corrupted backup structure.');
  }

  let validatedData;

  // Check if encrypted backup (version 2 or pulse_encrypted_backup)
  if (data.version === 2 || data.format === 'pulse_encrypted_backup' || data.ciphertext) {
    // Check account ownership in envelope
    if (data.account?.id && String(data.account.id).trim() !== currentUserId) {
      throw new Error(`ACCOUNT_MISMATCH: Backup belongs to account ${data.account.id}. Cannot restore into account ${currentUserId}.`);
    }

    if (!password) {
      throw new Error('PASSWORD_REQUIRED: Password is required to decrypt this backup.');
    }

    const decryptedPayload = await decryptBackupPayload(data, password);
    validatedData = validateBackupPayload(decryptedPayload, currentUser, data.account);
  } else if (data.app === 'PulseChat' || Array.isArray(data.messages) || Array.isArray(data)) {
    // Legacy unencrypted backup (version 1)
    const rawPayload = Array.isArray(data) ? { app: 'PulseChat', messages: data } : data;
    validatedData = validateBackupPayload(rawPayload, currentUser, rawPayload.user);
  } else {
    throw new Error('UNSUPPORTED_BACKUP: Unrecognized backup file format.');
  }

  const messagesToRestore = validatedData.messages || [];
  const recentChatsToRestore = validatedData.recentChats || [];

  const db = await getDb();
  if (!db) throw new Error('Local IndexedDB is unavailable on this device.');

  if (messagesToRestore.length > 0) {
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const chatBuckets = new Map();

    for (const msg of messagesToRestore) {
      store.put(msg);
      const cId = msg.chatId;
      if (!chatBuckets.has(cId)) chatBuckets.set(cId, []);
      chatBuckets.get(cId).push(msg);
    }

    // Wait for atomic completion of IndexedDB transaction
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = (e) => reject(tx.error || e || new Error('IndexedDB transaction aborted'));
      tx.onerror = (e) => reject(tx.error || e || new Error('IndexedDB transaction error'));
    });

    // Populate per-chat localStorage cache ONLY AFTER atomic tx.oncomplete
    chatBuckets.forEach((cMsgs, cId) => {
      try {
        const sorted = cMsgs.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        localStorage.setItem(`pulsechat_msgs_${cId}`, JSON.stringify(sorted.slice(-250)));
        if (cId.includes('_')) {
          const canonical = cId.split('_').sort().join('_');
          if (canonical !== cId) {
            localStorage.setItem(`pulsechat_msgs_${canonical}`, JSON.stringify(sorted.slice(-250)));
          }
        }
      } catch (_) {}
    });
  }

  // Restore recent chats if present in backup
  if (recentChatsToRestore.length > 0) {
    try {
      localStorage.setItem('cached_recent_chats', JSON.stringify(recentChatsToRestore));
      localStorage.setItem(`pulsechat_recent_${currentUserId}`, JSON.stringify(recentChatsToRestore));
    } catch (_) {}
  }

  try {
    localStorage.setItem('pulse_last_restore_time', new Date().toISOString());
  } catch (_) {}

  // Trigger real-time UI refresh
  try {
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
  } catch (_) {}

  return {
    success: true,
    restoredMessages: messagesToRestore.length,
    restoredChats: recentChatsToRestore.length
  };
}
