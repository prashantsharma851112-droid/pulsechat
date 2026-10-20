const DB_NAME = 'pulsechat-local-chat';
const DB_VERSION = 1;

let databasePromise;

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'messageId' });
        store.createIndex('conversationKey', 'conversationKey', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('direction', 'direction', { unique: false });
      }
      if (!db.objectStoreNames.contains('deliveryOutbox')) {
        db.createObjectStore('deliveryOutbox', { keyPath: 'messageId' });
      }
      if (!db.objectStoreNames.contains('readOutbox')) {
        db.createObjectStore('readOutbox', { keyPath: 'messageId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error || new Error('Could not open IndexedDB.'));
    };
    request.onblocked = () => {
      reject(new Error('IndexedDB upgrade is blocked. Close old PulseChat tabs and reload.'));
    };
  });
  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
  });
}

export function getConversationKey(userA, userB) {
  return [String(userA), String(userB)].sort().join(':');
}

const statusRank = { sending: 0, sent: 1, delivered: 2, read: 3, expired: 4, failed: 4 };

function mergeMessage(oldMessage, newMessage) {
  if (!oldMessage) return newMessage;
  const merged = { ...oldMessage, ...newMessage };

  // Never let a retry or a delayed server ACK roll a tick back.
  if (oldMessage.direction === 'outgoing' && newMessage.direction === 'outgoing') {
    const oldRank = statusRank[oldMessage.status] ?? 0;
    const newRank = statusRank[newMessage.status] ?? 0;
    merged.status = oldRank > newRank ? oldMessage.status : newMessage.status;
    merged.receiptToken = newMessage.receiptToken || oldMessage.receiptToken || null;
  }

  // Preserve local read state when the same incoming message is delivered again.
  if (oldMessage.direction === 'incoming' && newMessage.direction === 'incoming') {
    merged.isRead = Boolean(oldMessage.isRead || newMessage.isRead);
    merged.receiptToken = newMessage.receiptToken || oldMessage.receiptToken || null;
  }
  return merged;
}

export async function upsertMessage(message) {
  const db = await openDatabase();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const oldMessage = await requestToPromise(store.get(message.messageId));
  store.put(mergeMessage(oldMessage, message));
  await transactionDone(tx);
}

export async function getMessage(messageId) {
  const db = await openDatabase();
  const tx = db.transaction('messages', 'readonly');
  const result = await requestToPromise(tx.objectStore('messages').get(messageId));
  await transactionDone(tx);
  return result || null;
}

export async function getConversation(userId, peerId) {
  const db = await openDatabase();
  const tx = db.transaction('messages', 'readonly');
  const store = tx.objectStore('messages');
  const key = getConversationKey(userId, peerId);
  const results = await requestToPromise(store.index('conversationKey').getAll(key));
  await transactionDone(tx);
  return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function updateMessage(messageId, patch) {
  const db = await openDatabase();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const oldMessage = await requestToPromise(store.get(messageId));
  if (oldMessage) store.put(mergeMessage(oldMessage, { ...oldMessage, ...patch }));
  await transactionDone(tx);
  return oldMessage ? { ...oldMessage, ...patch } : null;
}

export async function getPendingOutgoing() {
  const db = await openDatabase();
  const tx = db.transaction('messages', 'readonly');
  const all = await requestToPromise(tx.objectStore('messages').getAll());
  await transactionDone(tx);
  return all.filter((message) => message.direction === 'outgoing' && message.status === 'sending');
}

export async function putOutbox(storeName, item) {
  if (!['deliveryOutbox', 'readOutbox'].includes(storeName)) {
    throw new Error('Invalid local outbox name.');
  }
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(item);
  await transactionDone(tx);
}

export async function getOutbox(storeName) {
  if (!['deliveryOutbox', 'readOutbox'].includes(storeName)) {
    throw new Error('Invalid local outbox name.');
  }
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const results = await requestToPromise(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return results;
}

export async function deleteOutboxItem(storeName, messageId) {
  if (!['deliveryOutbox', 'readOutbox'].includes(storeName)) {
    throw new Error('Invalid local outbox name.');
  }
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(messageId);
  await transactionDone(tx);
}
