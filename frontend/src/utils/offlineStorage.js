// PulseChat Offline Storage & Auto-Sync Engine
// Caches chats, groups, message history, and outgoing message queue in localStorage

const STORAGE_KEYS = {
  USER: 'pulsechat_user',
  TOKEN: 'pulsechat_token',
  RECENT_PREFIX: 'pulsechat_recent_',
  GROUPS_PREFIX: 'pulsechat_groups_',
  MESSAGES_PREFIX: 'pulsechat_msgs_',
  OUTBOX_PREFIX: 'pulsechat_outbox_'
};

// Safe JSON parser
function safeParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

// User Profile Cache
export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  return safeParse(localStorage.getItem(STORAGE_KEYS.USER), null);
}

export function setCachedUser(user) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.USER);
  } else {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.warn('LocalStorage quota exceeded setting user', e);
    }
  }
}

// Recent Chats Cache (per user)
export function getCachedRecentChats(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`), []);
}

export function setCachedRecentChats(userId, chats) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(chats)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`, JSON.stringify(chats));
  } catch (e) {
    console.warn('LocalStorage quota exceeded setting recent chats', e);
  }
}

// Update the last message snippet in recent chats when offline message sent/received
export function updateRecentChatSnippet(userId, chatId, message) {
  if (!userId || !chatId || !message) return;
  const recent = getCachedRecentChats(userId);
  const updated = recent.map(c => {
    const isThisChat = c.id === chatId || (c.isGroup && c.id === chatId);
    if (isThisChat) {
      return {
        ...c,
        lastMessage: message.content || (message.type === 'voice' ? '🎤 Voice note' : 'Sent a file'),
        lastMessageTime: message.timestamp || new Date().toISOString(),
        lastMessageType: message.type || 'text'
      };
    }
    return c;
  });
  setCachedRecentChats(userId, updated);
}

// Groups Cache (per user)
export function getCachedGroups(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.GROUPS_PREFIX}${userId}`), []);
}

export function setCachedGroups(userId, groups) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(groups)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.GROUPS_PREFIX}${userId}`, JSON.stringify(groups));
  } catch (e) {
    console.warn('LocalStorage quota exceeded setting groups', e);
  }
}

// Message History Cache (per chatId) - keeps up to 250 latest messages
const MAX_CACHED_MESSAGES = 250;

export function getCachedMessages(chatId) {
  if (typeof window === 'undefined' || !chatId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`), []);
}

export function setCachedMessages(chatId, messages) {
  if (typeof window === 'undefined' || !chatId || !Array.isArray(messages)) return;
  try {
    const trimmed = messages.slice(-MAX_CACHED_MESSAGES);
    localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(trimmed));
  } catch (e) {
    // If quota exceeded, trim further
    try {
      const small = messages.slice(-100);
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(small));
    } catch (err) {
      console.warn('LocalStorage quota exceeded setting messages', err);
    }
  }
}

export function appendCachedMessage(chatId, message) {
  if (!chatId || !message) return;
  const current = getCachedMessages(chatId);
  const existingIdx = current.findIndex(m => m.id === message.id || (message.clientTempId && m.id === message.clientTempId));
  let updated;
  if (existingIdx !== -1) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...message };
  } else {
    updated = [...current, message];
  }
  setCachedMessages(chatId, updated);
}

export function updateCachedMessageStatus(chatId, messageId, status, newId = null) {
  if (!chatId || !messageId) return;
  const current = getCachedMessages(chatId);
  const updated = current.map(m => {
    if (m.id === messageId || m.clientTempId === messageId) {
      return {
        ...m,
        id: newId || m.id,
        status: status || m.status
      };
    }
    return m;
  });
  setCachedMessages(chatId, updated);
}

// Outbox / Pending Messages Queue (per user)
export function getOutbox(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`), []);
}

export function setOutbox(userId, queue) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`, JSON.stringify(queue));
  } catch (e) {
    console.warn('LocalStorage quota exceeded setting outbox', e);
  }
}

export function addToOutbox(userId, message) {
  if (!userId || !message) return;
  const outbox = getOutbox(userId);
  // Avoid duplicate tempIds
  const filtered = outbox.filter(m => m.id !== message.id && m.clientTempId !== message.id);
  filtered.push(message);
  setOutbox(userId, filtered);
}

export function removeFromOutbox(userId, messageIdOrTempId) {
  if (!userId || !messageIdOrTempId) return;
  const outbox = getOutbox(userId);
  const filtered = outbox.filter(m => m.id !== messageIdOrTempId && m.clientTempId !== messageIdOrTempId);
  setOutbox(userId, filtered);
}

// Network Connectivity Helpers
export function isDeviceOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function subscribeToNetworkChanges(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
