// PulseChat Offline Storage & Auto-Sync Engine
// Caches chats, groups, message history, and outgoing message queue in localStorage

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

// Update the last message snippet in recent chats when offline message sent/received.
// targetChat is the full user/group object being chatted with (activeChat from state).
export function updateRecentChatSnippet(userId, chatId, message, targetChat) {
  if (!userId || !chatId || !message) return;
  let recent = getCachedRecentChats(userId);

  // Check if there's an existing entry for this contact/group
  // chatId for 1-to-1 is "userId1_userId2" — we match against the other party's id
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
    // Update existing entry and move to top (preserve and update avatar if fresher non-empty avatar provided)
    const existingAvatar = recent[existingIdx].avatar;
    const incomingAvatar = targetChat?.avatar;
    const updated = {
      ...recent[existingIdx],
      ...snippet,
      avatar: incomingAvatar || existingAvatar || ''
    };
    const newRecent = [updated, ...recent.filter((_, i) => i !== existingIdx)];
    setCachedRecentChats(userId, newRecent);
  } else if (targetChat) {
    // New conversation: prepend the target contact with snippet info
    const newEntry = {
      ...targetChat,
      ...snippet
    };
    setCachedRecentChats(userId, [newEntry, ...recent]);
  }
}

// Clear unread count for a specific contact or group across cached recent chats
export function clearUnreadCount(userId, targetIdOrChatId) {
  if (!userId || !targetIdOrChatId) return [];
  const recent = getCachedRecentChats(userId);
  if (!recent || recent.length === 0) return [];

  let changed = false;
  const updated = recent.map(c => {
    const isMatch =
      c.id === targetIdOrChatId ||
      c._id === targetIdOrChatId ||
      c.username === targetIdOrChatId ||
      (typeof targetIdOrChatId === 'string' && (
        targetIdOrChatId.includes(c.id) ||
        (c.username && targetIdOrChatId.includes(c.username))
      ));
    if (isMatch && (c.unreadCount || 0) > 0) {
      changed = true;
      return { ...c, unreadCount: 0 };
    }
    return c;
  });

  if (changed) {
    setCachedRecentChats(userId, updated);
  }
  return updated;
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

// Friends Cache (per user)
export function getCachedFriends(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.FRIENDS_PREFIX}${userId}`), []);
}

export function setCachedFriends(userId, friends) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(friends)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.FRIENDS_PREFIX}${userId}`, JSON.stringify(friends));
  } catch (e) {
    console.warn('LocalStorage quota exceeded setting friends', e);
  }
}

export function isCachedFriend(userId, targetId) {
  if (!userId || !targetId) return false;
  const friends = getCachedFriends(userId);
  return friends.some(f => f.id === targetId || f.username === targetId);
}

// All Known Users Cache (per user — everyone the app has fetched from /api/users)
export function getCachedAllUsers(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  return safeParse(localStorage.getItem(`${STORAGE_KEYS.ALL_USERS_PREFIX}${userId}`), []);
}

export function setCachedAllUsers(userId, users) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(users)) return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.ALL_USERS_PREFIX}${userId}`, JSON.stringify(users));
  } catch (e) {
    console.warn('LocalStorage quota exceeded setting all users', e);
  }
}

// Merge new users into existing cached all-users list (avoids duplicates)
export function mergeIntoAllUsersCache(userId, newUsers) {
  if (!userId || !Array.isArray(newUsers)) return;
  const existing = getCachedAllUsers(userId);
  const existingIds = new Set(existing.map(u => u.id));
  const merged = [...existing];
  for (const u of newUsers) {
    if (!existingIds.has(u.id)) {
      merged.push(u);
      existingIds.add(u.id);
    } else {
      // Update existing entry with fresher data
      const idx = merged.findIndex(e => e.id === u.id);
      if (idx !== -1) {
        const existingAvatar = merged[idx].avatar;
        merged[idx] = {
          ...merged[idx],
          ...u,
          avatar: u.avatar || existingAvatar || ''
        };
      }
    }
  }
  setCachedAllUsers(userId, merged);
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

// Synchronize a user's updated profile (DP, displayName, status) across ALL caches & dispatch event
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

  // 1. Update Recent Chats cache
  if (currentUserId) {
    const recent = getCachedRecentChats(currentUserId);
    if (recent && recent.length > 0) {
      const updatedRecent = recent.map(applyUpdates);
      setCachedRecentChats(currentUserId, updatedRecent);
    }

    // 2. Update All Users cache
    const allUsers = getCachedAllUsers(currentUserId);
    if (allUsers && allUsers.length > 0) {
      const updatedAllUsers = allUsers.map(applyUpdates);
      setCachedAllUsers(currentUserId, updatedAllUsers);
    }

    // 3. Update Friends cache
    const friends = getCachedFriends(currentUserId);
    if (friends && friends.length > 0) {
      const updatedFriends = friends.map(applyUpdates);
      setCachedFriends(currentUserId, updatedFriends);
    }
  }

  // 4. Update own profile if the current logged-in user changed their DP
  const currentUser = getCachedUser();
  if (currentUser && isMatch(currentUser)) {
    const updatedMe = applyUpdates(currentUser);
    setCachedUser(updatedMe);
  }

  // 5. Dispatch global window event so activeChat, ChatWindow, and FriendsTab update immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
      detail: { targetUserId, updates }
    }));
  }
}

// Synchronize an updated group (name, avatar, description, members) across ALL caches & dispatch event
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
    // 1. Update Groups cache
    const groups = getCachedGroups(currentUserId);
    if (groups && groups.length > 0) {
      const updatedGroups = groups.map(applyGroupUpdates);
      setCachedGroups(currentUserId, updatedGroups);
    }

    // 2. Update Recent Chats cache if this group is in recent chats
    const recent = getCachedRecentChats(currentUserId);
    if (recent && recent.length > 0) {
      const updatedRecent = recent.map(applyGroupUpdates);
      setCachedRecentChats(currentUserId, updatedRecent);
    }
  }

  // 3. Dispatch global window event so ChatWindow, Sidebar, and App update immediately (0ms)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsechat_group_updated', {
      detail: { groupId, updates }
    }));
  }
}

