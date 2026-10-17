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
