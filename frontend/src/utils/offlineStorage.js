// local storage helper functions

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
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`), []);
}

export function setCachedRecentChats(userId, chats) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(chats)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.RECENT_PREFIX}${userId}`, JSON.stringify(chats));
  } catch (e) {
    console.warn('LocalStorage error setting recent chats', e);
  }
}

// update last message snippet in recent chats
export function updateRecentChatSnippet(userId, chatId, message, targetChat) {
  if (!userId || !chatId || !message) return;
  let recent = getCachedRecentChats(userId);

  const contactId = targetChat?.id || message.receiverId || null;

  const existingIdx = recent.findIndex(c => {
    if (c.id === contactId) return true;
    if (c.id === chatId) return true;
    return false;
  });

  const snippet = {
    lastMessage: message.type === '3d_text'
      ? `✨ 3D: ${message.content}`
      : (message.content || (message.type === 'voice' ? '🎤 Voice note' : 'Sent a file')),
    lastMessageTime: message.timestamp || new Date().toISOString(),
    lastMessageType: message.type || 'text'
  };

  if (existingIdx !== -1) {
    const existingAvatar = recent[existingIdx].avatar;
    const incomingAvatar = targetChat?.avatar;
    const updated = {
      ...recent[existingIdx],
      ...snippet,
      avatar: incomingAvatar || existingAvatar || '',
      displayName: targetChat?.displayName || recent[existingIdx].displayName,
      isPro: targetChat?.isPro !== undefined ? Boolean(targetChat.isPro) : Boolean(recent[existingIdx].isPro),
      proTier: targetChat?.proTier || recent[existingIdx].proTier || null,
      customBadge: targetChat?.customBadge !== undefined ? targetChat.customBadge : (recent[existingIdx].customBadge || null)
    };
    const newRecent = [updated, ...recent.filter((_, i) => i !== existingIdx)];
    setCachedRecentChats(userId, newRecent);
  } else if (targetChat) {
    const newEntry = {
      id: targetChat.id || chatId,
      displayName: targetChat.displayName || targetChat.name || 'Chat',
      avatar: targetChat.avatar || '',
      isGroup: Boolean(targetChat.isGroup),
      isPro: Boolean(targetChat.isPro),
      proTier: targetChat.proTier || null,
      customBadge: targetChat.customBadge || null,
      unreadCount: 0,
      ...snippet
    };
    setCachedRecentChats(userId, [newEntry, ...recent]);
  }
}

// clear unread count
export function clearUnreadCount(userId, targetId) {
  if (!userId || !targetId) return;
  let recent = getCachedRecentChats(userId);
  let updated = false;
  const newRecent = recent.map(c => {
    if (c.id === targetId || (targetId.includes('_') && targetId.includes(c.id))) {
      if (c.unreadCount > 0) {
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
}

export function appendCachedMessage(chatId, message) {
  if (!chatId || !message) return;
  const msgs = getCachedMessages(chatId);
  if (msgs.some(m => (m.id && m.id === message.id) || (m.tempId && m.tempId === message.tempId))) {
    return;
  }
  setCachedMessages(chatId, [...msgs, message]);
}

export function updateCachedMessageStatus(chatId, messageIdOrTempId, updates) {
  if (!chatId || !messageIdOrTempId || !updates) return;
  const msgs = getCachedMessages(chatId);
  const updated = msgs.map(m => {
    if (m.id === messageIdOrTempId || m.tempId === messageIdOrTempId) {
      return { ...m, ...updates };
    }
    return m;
  });
  setCachedMessages(chatId, updated);
}

// outbox queue
export function getOutbox(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`), []);
}

export function addToOutbox(userId, pendingMessage) {
  if (!userId || !pendingMessage) return;
  const current = getOutbox(userId);
  if (!current.some(m => m.tempId === pendingMessage.tempId)) {
    localStorage.setItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`, JSON.stringify([...current, pendingMessage]));
  }
}

export function removeFromOutbox(userId, tempId) {
  if (!userId || !tempId) return;
  const current = getOutbox(userId);
  const updated = current.filter(m => m.tempId !== tempId);
  localStorage.setItem(`${STORAGE_KEYS.OUTBOX_PREFIX}${userId}`, JSON.stringify(updated));
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
      ...(updates.claimedFreeSparks !== undefined && { claimedFreeSparks: updates.claimedFreeSparks })
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
