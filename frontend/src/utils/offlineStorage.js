// local storage & local-first IndexedDB helper functions
import { saveMessagesToLocalDb, getMessagesFromLocalDb, deleteMessagesFromLocalDb, updateMessageInLocalDb } from './localDatabase';

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
  if (typeof window === 'undefined' || !userId) return [];
  const raw = safeParse(localStorage.getItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`), []);
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
    localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`, JSON.stringify(sorted));
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

// update last message snippet in recent chats
export function updateRecentChatSnippet(userId, chatId, message, targetChat) {
  if (!userId || !chatId || !message) return;
  if (targetChat?.id === 'user' || message.receiverId === 'user') return;
  restoreDeletedChatId(userId, chatId);
  if (targetChat?.id) restoreDeletedChatId(userId, targetChat.id);
  if (targetChat?._id) restoreDeletedChatId(userId, targetChat._id);

  let recent = getCachedRecentChats(userId);

  const contactId = targetChat?.id || targetChat?._id || message.receiverId || (message.senderId !== userId ? message.senderId : null);

  const existingIdx = recent.findIndex(c => {
    if (contactId && (c.id === contactId || c._id === contactId || c.username === contactId)) return true;
    if (chatId && (c.id === chatId || c._id === chatId || (typeof chatId === 'string' && chatId.includes(c.id)))) return true;
    if (targetChat?.username && c.username === targetChat.username) return true;
    return false;
  });

  const isFromMe = message.senderId === userId;
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
    updatedEntry = {
      id: targetChat.id || targetChat._id || contactId || chatId,
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
export function getCachedMessages(chatId) {
  if (typeof window === 'undefined' || !chatId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`), []);
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

export async function getCachedMessagesFromLocalDb(chatId, limit = 100, beforeTimestamp = null) {
  return getMessagesFromLocalDb(chatId, limit, beforeTimestamp);
}

export function appendCachedMessage(chatId, message) {
  if (!chatId || !message) return;
  const msgs = getCachedMessages(chatId);
  const targetId = message.id || message.clientTempId;
  const targetTempId = message.clientTempId || message.tempId;

  if (msgs.some(m =>
    (targetId && m.id === targetId) ||
    (targetTempId && (m.clientTempId === targetTempId || m.tempId === targetTempId || m.id === targetTempId)) ||
    (m.clientTempId && targetId && m.clientTempId === targetId)
  )) {
    return;
  }
  setCachedMessages(chatId, [...msgs, message]);
}

export function updateCachedMessageStatus(chatId, messageIdOrTempId, updates) {
  if (!chatId || !messageIdOrTempId || !updates) return;
  const msgs = getCachedMessages(chatId);
  const updated = msgs.map(m => {
    if (m.id === messageIdOrTempId || m._id === messageIdOrTempId || m.clientTempId === messageIdOrTempId || m.tempId === messageIdOrTempId) {
      return typeof updates === 'string' ? { ...m, status: updates } : { ...m, ...updates };
    }
    return m;
  });
  setCachedMessages(chatId, updated);
}

export function removeCachedMessages(chatId, messageIds) {
  if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) return;
  const idsSet = new Set(messageIds.map(String));
  const msgs = getCachedMessages(chatId);
  const filtered = msgs.filter(m => !idsSet.has(String(m.id)) && !idsSet.has(String(m._id)) && !idsSet.has(String(m.clientTempId)));
  try {
    localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`, JSON.stringify(filtered.slice(-250)));
    deleteMessagesFromLocalDb(messageIds);
  } catch (e) {}
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

// Auto-cleanup local cached messages (keeps last N days safe, cleans older)
export function cleanupLocalMessageStorage(days = 7) {
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
  } catch (e) {
    console.warn('[OfflineStorage] Error cleaning local messages:', e);
  }
  return cleanedCount;
}
