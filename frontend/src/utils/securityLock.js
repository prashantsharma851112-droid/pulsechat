// PulseChat Security Lock & Chat Preferences Helper
// Manages App Lock, Chat Lock, PIN authentication, and Chat Notification Mute list

export function getSecurityPin() {
  try {
    return localStorage.getItem('pulsechat_security_pin') || '';
  } catch (e) {
    return '';
  }
}

export function setSecurityPin(pin) {
  try {
    localStorage.setItem('pulsechat_security_pin', String(pin).trim());
    window.dispatchEvent(new CustomEvent('pulsechat_security_pin_changed'));
    return true;
  } catch (e) {
    return false;
  }
}

export function verifySecurityPin(pin) {
  const saved = getSecurityPin();
  if (!saved) return false;
  return String(pin).trim() === saved;
}

// App Lock
export function isAppLockEnabled() {
  try {
    return localStorage.getItem('pulsechat_app_lock_enabled') === 'true' && Boolean(getSecurityPin());
  } catch (e) {
    return false;
  }
}

export function setAppLockEnabled(enabled) {
  try {
    localStorage.setItem('pulsechat_app_lock_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('pulsechat_app_lock_changed', { detail: { enabled: !!enabled } }));
  } catch (e) {}
}

// Chat Lock (per-chat)
export function getLockedChats() {
  try {
    const raw = localStorage.getItem('pulsechat_locked_chats');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isChatLocked(chatId) {
  if (!chatId) return false;
  const list = getLockedChats();
  const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
  return list.includes(chatId) || list.includes(canonical);
}

export function setChatLocked(chatId, locked) {
  if (!chatId) return;
  try {
    const list = getLockedChats();
    const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
    let nextList;
    if (locked) {
      const set = new Set([...list, chatId, canonical]);
      nextList = Array.from(set);
    } else {
      nextList = list.filter(id => id !== chatId && id !== canonical);
      setChatHidden(chatId, false);
    }
    localStorage.setItem('pulsechat_locked_chats', JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('pulsechat_chat_lock_updated', { detail: { chatId, locked: !!locked } }));
  } catch (e) {}
}

// Hidden Locked Chats (Secret Mode: locked chat hidden from recent list, revealed when searched in search bar)
export function getHiddenLockedChats() {
  try {
    const raw = localStorage.getItem('pulsechat_hidden_locked_chats');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isChatHidden(chatId) {
  if (!chatId) return false;
  if (!isChatLocked(chatId)) return false;
  const list = getHiddenLockedChats();
  const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
  return list.includes(chatId) || list.includes(canonical);
}

export function setChatHidden(chatId, hidden) {
  if (!chatId) return;
  try {
    const list = getHiddenLockedChats();
    const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
    let nextList;
    if (hidden) {
      const set = new Set([...list, chatId, canonical]);
      nextList = Array.from(set);
    } else {
      nextList = list.filter(id => id !== chatId && id !== canonical);
    }
    localStorage.setItem('pulsechat_hidden_locked_chats', JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('pulsechat_chat_lock_updated', { detail: { chatId, hidden: !!hidden } }));
  } catch (e) {}
}

// Chat Notifications Mute
export function getMutedChats() {
  try {
    const raw = localStorage.getItem('pulsechat_muted_chats');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isChatMuted(chatId) {
  if (!chatId) return false;
  const list = getMutedChats();
  const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
  return list.includes(chatId) || list.includes(canonical);
}

export function setChatMuted(chatId, muted) {
  if (!chatId) return;
  try {
    const list = getMutedChats();
    const canonical = chatId.includes('_') ? chatId.split('_').sort().join('_') : chatId;
    let nextList;
    if (muted) {
      const set = new Set([...list, chatId, canonical]);
      nextList = Array.from(set);
    } else {
      nextList = list.filter(id => id !== chatId && id !== canonical);
    }
    localStorage.setItem('pulsechat_muted_chats', JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('pulsechat_muted_chats_updated', { detail: { chatId, muted: !!muted } }));
  } catch (e) {}
}

// Chat Archive (WhatsApp Style)
export function getArchivedChats(userId) {
  try {
    const raw = localStorage.getItem(`pulsechat_archived_chats_${userId || 'default'}`);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Deduplicate: Map each ID to its canonical conversation partner / target
    const uniqueChats = new Set();
    list.forEach(id => {
      if (!id || typeof id !== 'string') return;
      if (id.includes('_') && userId) {
        const parts = id.split('_');
        if (parts.length === 2 && parts.includes(userId)) {
          // It's a 1-on-1 composite ID involving the current user:
          // The true conversation target is the partner's ID
          const partnerId = parts[0] === userId ? parts[1] : parts[0];
          uniqueChats.add(partnerId);
          return;
        }
      }
      uniqueChats.add(id);
    });
    return Array.from(uniqueChats);
  } catch (e) {
    return [];
  }
}

export function isChatArchived(userId, chatId) {
  if (!chatId) return false;
  let target = chatId;
  if (chatId.includes('_') && userId) {
    const parts = chatId.split('_');
    if (parts.length === 2 && parts.includes(userId)) {
      target = parts[0] === userId ? parts[1] : parts[0];
    }
  }
  const list = getArchivedChats(userId);
  const composite = (!chatId.includes('_') && userId) ? [userId, chatId].sort().join('_') : null;
  return list.includes(target) || list.includes(chatId) || (composite ? list.includes(composite) : false);
}

export function setChatArchived(userId, chatId, archived) {
  if (!chatId) return;
  try {
    let target = chatId;
    if (chatId.includes('_') && userId) {
      const parts = chatId.split('_');
      if (parts.length === 2 && parts.includes(userId)) {
        target = parts[0] === userId ? parts[1] : parts[0];
      }
    }
    const current = getArchivedChats(userId);
    let nextList;
    if (archived) {
      const set = new Set(current);
      set.add(target);
      nextList = Array.from(set);
    } else {
      const composite = (userId && !target.includes('_')) ? [userId, target].sort().join('_') : null;
      const idsToRemove = new Set([chatId, target]);
      if (composite) idsToRemove.add(composite);
      if (chatId.includes('_')) {
        chatId.split('_').forEach(id => idsToRemove.add(id));
      }
      nextList = current.filter(id => !idsToRemove.has(id));
    }
    localStorage.setItem(`pulsechat_archived_chats_${userId || 'default'}`, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('pulsechat_archived_chats_updated', { detail: { chatId, target, archived: !!archived } }));
  } catch (e) {}
}
