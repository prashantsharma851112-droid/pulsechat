import { saveMessagesToLocalDb, getMessagesFromLocalDb, deleteMessagesFromLocalDb, updateMessageInLocalDb, clearChatFromLocalDb, cleanOldMessagesFromLocalDb } from './localDatabase';

const STORAGE_KEYS = {
  USER: 'pulsechat_user',
  TOKEN: 'pulsechat_token',
  RECENT_PREFIX: 'pulsechat_recent_',
  GROUPS_PREFIX: 'pulsechat_groups_',
  MESSAGES_PREFIX: 'pulsechat_msgs_',
  OUTBOX_PREFIX: 'pulsechat_outbox_',
  ALL_USERS_PREFIX: 'pulsechat_allusers_',
  FRIENDS_PREFIX: 'pulsechat_friends_'
};

// json parse wrapper
function safeParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

// user cache
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
      console.warn('LocalStorage error setting user', e);
    }
  }
}

// recent chats
export function getCachedRecentChats(userId) {
  if (typeof window === 'undefined') return [];
  const userObj = getCachedUser();
  const keysToCheck = Array.from(new Set([
    userId,
    userObj?.id,
    userObj?._id ? String(userObj._id) : null
  ].filter(Boolean)));

  let raw = [];
  for (const k of keysToCheck) {
    const candidate = safeParse(localStorage.getItem(`${STORAGE_KEYS.RECENT_PREFIX}${k}`), []);
    if (Array.isArray(candidate) && candidate.length > raw.length) {
      raw = candidate;
    }
  }

  if (!Array.isArray(raw)) return [];
  return raw
    .filter(c => c && c.id && c.id !== 'user' && c.id !== 'undefined' && c.id !== 'null')
    .sort((a, b) => {
      const tA = new Date(a.lastMessageTimestamp || a.lastMessageTime || 0).getTime();
      const tB = new Date(b.lastMessageTimestamp || b.lastMessageTime || 0).getTime();
      return tB - tA;
    });
}

export function setCachedRecentChats(userId, chats) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(chats)) return;
  try {
    const valid = chats.filter(c => c && c.id && c.id !== 'user' && c.id !== 'undefined' && c.id !== 'null');
    const sorted = [...valid].sort((a, b) => {
      const tA = new Date(a.lastMessageTimestamp || a.lastMessageTime || 0).getTime();
      const tB = new Date(b.lastMessageTimestamp || b.lastMessageTime || 0).getTime();
      return tB - tA;
    });
    const serialized = JSON.stringify(sorted);
    localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`, serialized);
    const userObj = getCachedUser();
    if (userObj?.id && String(userObj.id) !== String(userId)) {
      localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userObj.id}`, serialized);
    }
    if (userObj?._id && String(userObj._id) !== String(userId)) {
      localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userObj._id}`, serialized);
    }
  } catch (e) {
    console.warn('LocalStorage error setting recent chats', e);
  }
}

// deleted/hidden chats helper
export function getDeletedChatIds(userId) {
  if (typeof window === 'undefined' || !userId) return new Set();
  const raw = localStorage.getItem(`pulsechat_deleted_chats_${userId}`);
  return new Set(safeParse(raw, []));
}

export function addDeletedChatId(userId, chatId) {
  if (typeof window === 'undefined' || !userId || !chatId) return;
  const deletedSet = getDeletedChatIds(userId);
  deletedSet.add(chatId);
  try {
    localStorage.setItem(`pulsechat_deleted_chats_${userId}`, JSON.stringify(Array.from(deletedSet)));
  } catch (e) {}
}

export function restoreDeletedChatId(userId, chatId) {
  if (typeof window === 'undefined' || !userId || !chatId) return;
  const deletedSet = getDeletedChatIds(userId);
  if (deletedSet.has(chatId)) {
    deletedSet.delete(chatId);
    try {
      localStorage.setItem(`pulsechat_deleted_chats_${userId}`, JSON.stringify(Array.from(deletedSet)));
    } catch (e) {}
  }
}

// Helper to generate all potential conversation keys for a pair of users
export function getConversationCandidateKeys(user, contact) {
  if (!user || !contact) return [];
  const myKeys = [user?.id, user?._id, user?.username].filter(Boolean).map(String);
  const contactKeys = [contact?.id, contact?._id, contact?.username].filter(Boolean).map(String);
  const keys = new Set();

  if (contact?.chatId) keys.add(contact.chatId);
  if (contact?.isGroup) {
    if (contact?.id) keys.add(contact.id);
    if (contact?._id) keys.add(String(contact._id));
    return Array.from(keys);
  }

  for (const m of myKeys) {
    for (const c of contactKeys) {
      if (m && c && m !== c) {
        keys.add([m, c].sort().join('_'));
        keys.add(`${m}_${c}`);
        keys.add(`${c}_${m}`);
      }
    }
  }
  return Array.from(keys);
}

// Find absolute newest message stored locally across any conversation key variants
export function getLatestCachedMessageForContact(user, contact) {
  const candidateKeys = getConversationCandidateKeys(user, contact);
  let bestMsg = null;
  let bestTime = 0;
  for (const key of candidateKeys) {
    const msgs = getCachedMessages(key, user?.id);
    if (Array.isArray(msgs) && msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      const t = new Date(last?.timestamp || last?.createdAt || 0).getTime();
      if (t > bestTime) {
        bestTime = t;
        bestMsg = last;
      }
    }
  }
  return bestMsg;
}

// update last message snippet in recent chats
export function updateRecentChatSnippet(userId, chatId, message, targetChat) {
  if (!userId || !chatId || !message) return;
  restoreDeletedChatId(userId, chatId);
  if (targetChat?.id && targetChat.id !== 'user') restoreDeletedChatId(userId, targetChat.id);
  if (targetChat?._id) restoreDeletedChatId(userId, targetChat._id);

  let recent = getCachedRecentChats(userId);

  const userObj = getCachedUser();
  const myVariants = new Set([
    userId,
    userObj?.id,
    userObj?._id,
    userObj?.username
  ].filter(Boolean).map(String));

  const isFromMe = myVariants.has(String(message.senderId));

  const contactId = (!isFromMe && message.senderId && !myVariants.has(String(message.senderId)))
    ? message.senderId
    : (targetChat?.id || targetChat?._id || message.receiverId || null);

  const existingIdx = recent.findIndex(c => {
    if (!c) return false;
    if (contactId && (c.id === contactId || c._id === contactId || (c.username && String(c.username).toLowerCase() === String(contactId).toLowerCase()))) return true;
    if (targetChat?._id && (c.id === String(targetChat._id) || c._id === String(targetChat._id))) return true;
    if (targetChat?.id && (c.id === String(targetChat.id) || c._id === String(targetChat.id))) return true;
    if (targetChat?.username && c.username && String(c.username).toLowerCase() === String(targetChat.username).toLowerCase()) return true;
    if (message.senderUsername && c.username && String(c.username).toLowerCase() === String(message.senderUsername).toLowerCase()) return true;
    if (message.senderName && c.displayName && String(c.displayName).toLowerCase() === String(message.senderName).toLowerCase()) return true;
    if (message.senderName && c.username && String(c.username).toLowerCase() === String(message.senderName).toLowerCase()) return true;
    if (chatId && (c.id === chatId || c._id === chatId || (typeof chatId === 'string' && (chatId.includes(c.id) || (c._id && chatId.includes(c._id)))))) return true;
    return false;
  });

  let formattedContent = '';

  if (message.type === 'stealth_dust' || message.isDustText) {
    formattedContent = '⚡ Stealth Dust Text';
  } else if (message.type === 'story_reply' || message.storyReply) {
    const sr = message.storyReply;
    const isShared = (message.content && message.content.startsWith('Shared ')) || (!sr?.reactionEmoji && !sr?.tipSparks && !sr?.replyText);
    if (isShared) {
      formattedContent = isFromMe ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
    } else if (sr?.reactionEmoji) {
      formattedContent = isFromMe ? `You reacted ${sr.reactionEmoji} to story` : `Reacted ${sr.reactionEmoji} to your story`;
    } else if (sr?.tipSparks) {
      formattedContent = isFromMe ? `You tipped ⚡ ${sr.tipSparks} Sparks on story` : `Tipped ⚡ ${sr.tipSparks} Sparks on your story!`;
    } else if (sr?.replyText) {
      formattedContent = isFromMe ? `You replied: "${sr.replyText}"` : `Replied to your story: "${sr.replyText}"`;
    } else {
      formattedContent = isFromMe ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
    }
  } else if (message.type === 'text') {
    let raw = message.content || '';
    if (raw.startsWith('Replied to your story:')) {
      formattedContent = isFromMe ? raw.replace(/^Replied to your story:\s*/, 'You replied: ') : raw;
    } else if (raw.startsWith('Reacted ') && raw.includes(' to your story')) {
      formattedContent = isFromMe ? raw.replace(/\s*to your story$/, ' to story') : raw;
    } else if (raw.startsWith('Tipped ') && raw.includes(' on your story!')) {
      formattedContent = isFromMe ? raw.replace(/\s*on your story!$/, ' on story!') : raw;
    } else {
      formattedContent = raw;
    }
  } else if (message.type === '3d_text') {
    formattedContent = `✨ 3D: ${message.content}`;
  } else if (message.type === 'voice') {
    formattedContent = '🎤 Voice note';
  } else if (message.type === 'image' || message.type === 'fog_snap') {
    formattedContent = message.isFogSnap ? '🌫️ Fog Snap' : (message.content || '🖼️ Photo');
  } else if (message.type === 'video') {
    formattedContent = '🎥 Video';
  } else {
    formattedContent = message.content || 'Sent a file';
  }

  const msgTime = message.timestamp || new Date().toISOString();
  const snippet = {
    lastMessage: formattedContent,
    lastMessageTime: msgTime,
    lastMessageTimestamp: msgTime,
    lastMessageType: message.type || 'text',
    lastMessageFromMe: isFromMe,
    lastMessageStatus: message.status || 'sent'
  };

  let updatedEntry;
  if (existingIdx !== -1) {
    const existing = recent[existingIdx];
    updatedEntry = {
      ...existing,
      ...snippet,
      avatar: targetChat?.avatar || existing.avatar || '',
      displayName: targetChat?.displayName || targetChat?.name || existing.displayName,
      username: targetChat?.username || existing.username || '',
      isPro: targetChat?.isPro !== undefined ? Boolean(targetChat.isPro) : Boolean(existing.isPro),
      proTier: targetChat?.proTier || existing.proTier || null,
      customBadge: targetChat?.customBadge !== undefined ? targetChat.customBadge : (existing.customBadge || null)
    };
  } else if (targetChat) {
    const realContactId = (contactId && contactId !== userId && !myVariants.has(contactId) && !String(contactId).includes('_'))
      ? contactId
      : (targetChat?.id || targetChat?._id || (typeof chatId === 'string' && chatId.includes('_') ? chatId.split('_').find(p => !myVariants.has(p)) : chatId));

    updatedEntry = {
      id: realContactId || targetChat.id || targetChat._id || contactId || chatId,
      displayName: targetChat.displayName || targetChat.name || targetChat.username || 'Chat',
      username: targetChat.username || '',
      avatar: targetChat.avatar || '',
      isGroup: Boolean(targetChat.isGroup),
      isPro: Boolean(targetChat.isPro),
      proTier: targetChat.proTier || null,
      customBadge: targetChat.customBadge || null,
      unreadCount: 0,
      ...snippet
    };
  } else return;

  const filtered = recent.filter((_, i) => i !== existingIdx);
  const newRecent = [updatedEntry, ...filtered].sort((a, b) => {
    const tA = new Date(a.lastMessageTimestamp || a.lastMessageTime || 0).getTime();
    const tB = new Date(b.lastMessageTimestamp || b.lastMessageTime || 0).getTime();
    return tB - tA;
  });

  setCachedRecentChats(userId, newRecent);
  if (userObj?.id && userObj.id !== userId) setCachedRecentChats(userObj.id, newRecent);
  if (userObj?._id && String(userObj._id) !== String(userId)) setCachedRecentChats(userObj._id, newRecent);
}

// clear unread count
export function clearUnreadCount(userId, targetId) {
  if (!userId || !targetId) return;
  let recent = getCachedRecentChats(userId);
  let updated = false;
  const newRecent = recent.map(c => {
    const isMatch = Boolean(
      c.id === targetId ||
      c._id === targetId ||
      (c.username && c.username === targetId) ||
      (c.chatId && c.chatId === targetId) ||
      (typeof targetId === 'string' && (
        (c.id && targetId.includes(c.id)) ||
        (c._id && targetId.includes(c._id)) ||
        (c.username && targetId.includes(c.username))
      ))
    );
    if (isMatch) {
      if (c.unreadCount > 0 || c.unreadCount === undefined) {
        updated = true;
        return { ...c, unreadCount: 0 };
      }
    }
    return c;
  });
  if (updated) {
    setCachedRecentChats(userId, newRecent);
  }
}

// cached groups
export function getCachedGroups(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.GROUPS_PREFIX}${userId}`), []);
}

export function setCachedGroups(userId, groups) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(groups)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.GROUPS_PREFIX}${userId}`, JSON.stringify(groups));
  } catch (e) {
    console.warn('LocalStorage error setting groups', e);
  }
}

// cached friends
export function getCachedFriends(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.FRIENDS_PREFIX}${userId}`), []);
}

export function setCachedFriends(userId, friends) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(friends)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.FRIENDS_PREFIX}${userId}`, JSON.stringify(friends));
  } catch (e) {
    console.warn('LocalStorage error setting friends', e);
  }
}

export function isCachedFriend(userId, targetId) {
  if (!userId || !targetId) return false;
  const friends = getCachedFriends(userId);
  return friends.some(f => f.id === targetId || f._id === targetId);
}

// all users cache
export function getCachedAllUsers(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.ALL_USERS_PREFIX}${userId}`), []);
}

export function setCachedAllUsers(userId, users) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(users)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.ALL_USERS_PREFIX}${userId}`, JSON.stringify(users));
  } catch (e) {
    console.warn('LocalStorage error setting all users', e);
  }
}

// merge new users into cached users list
export function mergeIntoAllUsersCache(userId, newUsers) {
  if (!userId || !Array.isArray(newUsers) || newUsers.length === 0) return;
  const current = getCachedAllUsers(userId);
  const map = new Map();
  current.forEach(u => map.set(u.id || u._id, u));
  newUsers.forEach(u => {
    const key = u.id || u._id;
    if (key) {
      const existing = map.get(key) || {};
      map.set(key, { ...existing, ...u });
    }
  });
  setCachedAllUsers(userId, Array.from(map.values()));
}

// message history cache
export function getDeletedForMeIds(userId) {
  if (typeof window === 'undefined' || !userId) return new Set();
  const raw = localStorage.getItem(`pulsechat_deleted_msg_ids_${userId}`);
  return new Set(safeParse(raw, []));
}

export function addDeletedForMeId(userId, messageId) {
  if (typeof window === 'undefined' || !userId || !messageId) return;
  const set = getDeletedForMeIds(userId);
  set.add(String(messageId));
  try {
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(`pulsechat_deleted_msg_ids_${userId}`, JSON.stringify(arr));
  } catch (e) {}
}

export function getCachedMessages(chatId, userId = null) {
  if (typeof window === 'undefined' || !chatId) return [];
  const msgs = safeParse(localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`), []);
  if (!Array.isArray(msgs)) return [];
  if (userId) {
    const deletedSet = getDeletedForMeIds(userId);
    if (deletedSet.size > 0) {
      return msgs.filter(m => !deletedSet.has(String(m.id)) && !deletedSet.has(String(m._id)) && !deletedSet.has(String(m.clientTempId)));
    }
  }
  return msgs;
}

export function setCachedMessages(chatId, messages) {
  if (typeof window === 'undefined' || !chatId || !Array.isArray(messages)) return;
  // 1. Instant sync localStorage for 0ms initial load
  try {
    const trimmed = messages.slice(-250);
    localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(trimmed));
  } catch (e) {
    try {
      const trimmed = messages.slice(-100);
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('LocalStorage error setting messages', err);
    }
  }

  // 2. Asynchronous local-first IndexedDB storage for unlimited history (thousands of messages)
  try {
    saveMessagesToLocalDb(chatId, messages);
  } catch (_) {}
}

export function clearCachedMessages(chatId) {
  if (!chatId) return;
  try {
    localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`);
  } catch (e) {}
  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  if (canonicalChatId && canonicalChatId !== chatId) {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${canonicalChatId}`);
    } catch (e) {}
  }
  clearChatFromLocalDb(chatId);
  if (canonicalChatId && canonicalChatId !== chatId) {
    clearChatFromLocalDb(canonicalChatId);
  }
}

export async function getCachedMessagesFromLocalDb(chatId, limit = 100, beforeTimestamp = null) {
  return getMessagesFromLocalDb(chatId, limit, beforeTimestamp);
}

export function appendCachedMessage(chatId, message) {
  if (!chatId || !message) return;
  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  const targetKeys = new Set([chatId, canonicalChatId].filter(Boolean));

  for (const cId of targetKeys) {
    const msgs = getCachedMessages(cId);
    const targetId = message.id || message.clientTempId;
    const targetTempId = message.clientTempId || message.tempId;

    if (msgs.some(m =>
      (targetId && m.id === targetId) ||
      (targetTempId && (m.clientTempId === targetTempId || m.tempId === targetTempId || m.id === targetTempId)) ||
      (m.clientTempId && targetId && m.clientTempId === targetId)
    )) {
      continue;
    }
    setCachedMessages(cId, [...msgs, message]);
  }
}

export function updateCachedMessageStatus(chatId, messageIdOrTempId, updates) {
  if (!chatId || !messageIdOrTempId || !updates) return;
  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  const targetKeys = new Set([chatId, canonicalChatId].filter(Boolean));

  for (const cId of targetKeys) {
    const msgs = getCachedMessages(cId);
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    let changed = false;
    const updated = msgs.map(m => {
      if (
        m.id === messageIdOrTempId ||
        m._id === messageIdOrTempId ||
        m.clientTempId === messageIdOrTempId ||
        m.tempId === messageIdOrTempId ||
        (m.clientTempId && messageIdOrTempId && String(m.clientTempId) === String(messageIdOrTempId))
      ) {
        changed = true;
        return typeof updates === 'string' ? { ...m, status: updates } : { ...m, ...updates };
      }
      return m;
    });
    if (changed) {
      setCachedMessages(cId, updated);
    }
  }
}

export function markAllCachedMessagesRead(chatId, myUserId) {
  if (!chatId) return;
  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  const targetKeys = new Set([chatId, canonicalChatId].filter(Boolean));
  const userObj = getCachedUser();
  const myVars = new Set([myUserId, userObj?.id, userObj?._id, userObj?.username].filter(Boolean).map(String));

  for (const cId of targetKeys) {
    const msgs = getCachedMessages(cId);
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    let changed = false;
    const updated = msgs.map(m => {
      if (myVars.has(String(m.senderId)) && m.status !== 'read') {
        changed = true;
        return { ...m, status: 'read' };
      }
      return m;
    });
    if (changed) {
      setCachedMessages(cId, updated);
    }
  }
}

export function markAllCachedMessagesDelivered(chatId, myUserId) {
  if (!chatId) return;
  const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
  const targetKeys = new Set([chatId, canonicalChatId].filter(Boolean));
  const userObj = getCachedUser();
  const myVars = new Set([myUserId, userObj?.id, userObj?._id, userObj?.username].filter(Boolean).map(String));

  for (const cId of targetKeys) {
    const msgs = getCachedMessages(cId);
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    let changed = false;
    const updated = msgs.map(m => {
      if (myVars.has(String(m.senderId)) && m.status === 'sent') {
        changed = true;
        return { ...m, status: 'delivered' };
      }
      return m;
    });
    if (changed) {
      setCachedMessages(cId, updated);
    }
  }
}

export function removeCachedMessages(chatId, messageIds, userId = null) {
  if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) return;
  const idsSet = new Set(messageIds.map(String));
  const msgs = getCachedMessages(chatId);
  const filtered = msgs.filter(m => !idsSet.has(String(m.id)) && !idsSet.has(String(m._id)) && !idsSet.has(String(m.clientTempId)));
  try {
    localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(filtered.slice(-250)));
    const canonicalChatId = (typeof chatId === 'string' && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
    if (canonicalChatId && canonicalChatId !== chatId) {
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${canonicalChatId}`, JSON.stringify(filtered.slice(-250)));
    }
    deleteMessagesFromLocalDb(messageIds);
  } catch (e) {}
  if (userId) {
    messageIds.forEach(id => addDeletedForMeId(userId, id));
  }
}

export function markCachedMessagesDeleted(chatId, messageIds) {
  if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) return;
  const idsSet = new Set(messageIds.map(String));
  const msgs = getCachedMessages(chatId);
  const updated = msgs.map(m => {
    if (idsSet.has(String(m.id)) || idsSet.has(String(m._id)) || idsSet.has(String(m.clientTempId))) {
      return { ...m, type: 'deleted', content: 'This message was deleted', mediaUrl: null, audioUrl: null, pollData: null };
    }
    return m;
  });
  setCachedMessages(chatId, updated);
  messageIds.forEach(id => {
    updateMessageInLocalDb(id, { type: 'deleted', content: 'This message was deleted', mediaUrl: null, audioUrl: null, pollData: null });
  });
}

// outbox queue
export function getOutbox(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`), []);
}

export function addToOutbox(userId, pendingMessage) {
  if (!userId || !pendingMessage) return;
  const current = getOutbox(userId);
  const key = pendingMessage.id || pendingMessage.clientTempId || pendingMessage.tempId;
  if (!key) return;

  const itemToSave = {
    ...pendingMessage,
    id: pendingMessage.id || key,
    clientTempId: pendingMessage.clientTempId || key,
    tempId: pendingMessage.tempId || key
  };

  const exists = current.some(m =>
    (m.id && (m.id === key || m.id === itemToSave.id || m.id === itemToSave.clientTempId)) ||
    (m.clientTempId && (m.clientTempId === key || m.clientTempId === itemToSave.clientTempId || m.clientTempId === itemToSave.id)) ||
    (m.tempId && (m.tempId === key || m.tempId === itemToSave.tempId))
  );

  if (!exists) {
    try {
      localStorage.setItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`, JSON.stringify([...current, itemToSave]));
    } catch (e) {
      console.warn('LocalStorage error adding to outbox', e);
    }
  }
}

export function removeFromOutbox(userId, tempId) {
  if (!userId || !tempId) return;
  const current = getOutbox(userId);
  const target = String(tempId);
  const updated = current.filter(m =>
    String(m.tempId || '') !== target &&
    String(m.id || '') !== target &&
    String(m.clientTempId || '') !== target
  );
  try {
    localStorage.setItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage error removing from outbox', e);
  }
}

export function clearOutbox(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`);
  } catch (e) {
    console.warn('LocalStorage error clearing outbox', e);
  }
}

// online network helpers
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

// sync user profile in storage
export function updateUserProfileInStorage(targetUserId, updates, currentUserId) {
  if (!targetUserId || !updates) return;

  const { displayName, avatar, status, username, userMongoId } = updates;

  const isMatch = (u) => {
    if (!u) return false;
    if (u.id && (u.id === targetUserId || (userMongoId && u.id === userMongoId))) return true;
    if (u._id && (u._id === targetUserId || (userMongoId && u._id === userMongoId))) return true;
    if (username && u.username === username) return true;
    return false;
  };

  const applyUpdates = (u) => {
    if (!isMatch(u)) return u;
    return {
      ...u,
      ...(displayName !== undefined && displayName !== '' && { displayName }),
      ...(avatar !== undefined && avatar !== '' && { avatar }),
      ...(status !== undefined && { status }),
      ...(updates.isPro !== undefined && { isPro: updates.isPro }),
      ...(updates.proTier !== undefined && { proTier: updates.proTier }),
      ...(updates.customBadge !== undefined && { customBadge: updates.customBadge }),
      ...(updates.pulseSparks !== undefined && { pulseSparks: updates.pulseSparks }),
      ...(updates.hasUsed3DTrial !== undefined && { hasUsed3DTrial: updates.hasUsed3DTrial }),
      ...(updates.claimedFreeSparks !== undefined && { claimedFreeSparks: updates.claimedFreeSparks }),
      ...(updates.hasKingCrown !== undefined && { hasKingCrown: updates.hasKingCrown }),
      ...(updates.hasSilverCrown !== undefined && { hasSilverCrown: updates.hasSilverCrown }),
      ...(updates.hasStreakCrown !== undefined && { hasStreakCrown: updates.hasStreakCrown }),
      ...(updates.hasNeonFlameAura !== undefined && { hasNeonFlameAura: updates.hasNeonFlameAura }),
      ...(updates.vibeStreakCount !== undefined && { vibeStreakCount: updates.vibeStreakCount }),
      ...(updates.vibeAura !== undefined && { vibeAura: updates.vibeAura })
    };
  };

  if (currentUserId) {
    const recent = getCachedRecentChats(currentUserId);
    if (recent && recent.length > 0) {
      const updatedRecent = recent.map(applyUpdates);
      setCachedRecentChats(currentUserId, updatedRecent);
    }

    const allUsers = getCachedAllUsers(currentUserId);
    if (allUsers && allUsers.length > 0) {
      const updatedAllUsers = allUsers.map(applyUpdates);
      setCachedAllUsers(currentUserId, updatedAllUsers);
    }

    const friends = getCachedFriends(currentUserId);
    if (friends && friends.length > 0) {
      const updatedFriends = friends.map(applyUpdates);
      setCachedFriends(currentUserId, updatedFriends);
    }
  }

  const currentUser = getCachedUser();
  if (currentUser && isMatch(currentUser)) {
    const updatedMe = applyUpdates(currentUser);
    setCachedUser(updatedMe);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
      detail: { targetUserId, updates }
    }));
  }
}

// sync group in storage
export function updateGroupInStorage(groupId, updates, currentUserId) {
  if (!groupId || !updates) return;

  const { name, avatar, description, members } = updates;

  const isGroupMatch = (g) => {
    if (!g) return false;
    return g.id === groupId || g._id === groupId;
  };

  const applyGroupUpdates = (g) => {
    if (!isGroupMatch(g)) return g;
    return {
      ...g,
      ...(name !== undefined && name !== '' && { name, displayName: name }),
      ...(avatar !== undefined && avatar !== '' && { avatar }),
      ...(description !== undefined && { description }),
      ...(members !== undefined && { members })
    };
  };

  if (currentUserId) {
    const groups = getCachedGroups(currentUserId);
    if (groups && groups.length > 0) {
      const updatedGroups = groups.map(applyGroupUpdates);
      setCachedGroups(currentUserId, updatedGroups);
    }

    const recent = getCachedRecentChats(currentUserId);
    if (recent && recent.length > 0) {
      const updatedRecent = recent.map(applyGroupUpdates);
      setCachedRecentChats(currentUserId, updatedRecent);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsechat_group_updated', {
      detail: { groupId, updates }
    }));
  }
}

// Auto-cleanup local cached messages (keeps last N days safe, cleans older from localStorage & IndexedDB)
export async function cleanupLocalMessageStorage(days = 7) {
  if (typeof window === 'undefined') return 0;
  let cleanedCount = 0;
  try {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const keysToProcess = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX)) {
        keysToProcess.push(key);
      }
    }

    keysToProcess.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const remaining = parsed.filter((m) => {
              const t = new Date(m.timestamp || m.createdAt || 0).getTime();
              return !t || t >= cutoffTime;
            });
            cleanedCount += Math.max(0, parsed.length - remaining.length);
            localStorage.setItem(key, JSON.stringify(remaining));
          }
        }
      } catch (err) {}
    });

    // Also clean messages from device IndexedDB
    try {
      const idbCleaned = await cleanOldMessagesFromLocalDb(days);
      cleanedCount += (idbCleaned || 0);
    } catch (idbErr) {
      console.warn('[OfflineStorage] IndexedDB cleanup warning:', idbErr);
    }
  } catch (e) {
    console.warn('[OfflineStorage] Error cleaning local messages:', e);
  }
  return cleanedCount;
}
