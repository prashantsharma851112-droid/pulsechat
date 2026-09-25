import React, { createContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../utils/config';
import { getCachedUser, setCachedUser } from '../utils/offlineStorage';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [token, setToken] = useState(() => localStorage.getItem('pulsechat_token'));
  const [loading, setLoading] = useState(() => !getCachedUser() && !!localStorage.getItem('pulsechat_token'));
  const [savedAccounts, setSavedAccounts] = useState(() => {
    try {
      const stored = localStorage.getItem('pulsechat_saved_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const updateSavedAccountsList = (accountData, accountToken) => {
    if (!accountData || !accountToken) return;
    setSavedAccounts(prev => {
      const existingIdx = prev.findIndex(a => a.id === accountData.id || a.username === accountData.username);
      const entry = {
        id: accountData.id,
        username: accountData.username,
        displayName: accountData.displayName || accountData.username,
        avatar: accountData.avatar || '',
        email: accountData.email || '',
        isPro: Boolean(accountData.isPro),
        customBadge: accountData.customBadge || null,
        token: accountToken,
        lastActive: Date.now()
      };
      let next;
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...prev[existingIdx], ...entry };
      } else {
        next = [entry, ...prev];
      }
      try {
        localStorage.setItem('pulsechat_saved_accounts', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    if (token) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      })
        .then(async (res) => {
          clearTimeout(timeoutId);
          if (res.status === 401) {
            logout();
            return;
          }
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setCachedUser(data.user);
            updateSavedAccountsList(data.user, token);
          }
        })
        .catch((err) => {
          // Network error, timeout, or offline: DO NOT LOGOUT! Keep the cached user session.
          console.warn('Network offline or backend unreachable, keeping cached user session:', err);
        })
        .finally(() => setLoading(false));

      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (data) => {
    localStorage.setItem('pulsechat_token', data.token);
    setCachedUser(data.user);
    setToken(data.token);
    setUser(data.user);
    updateSavedAccountsList(data.user, data.token);
  };

  const logout = () => {
    localStorage.removeItem('pulsechat_token');
    setCachedUser(null);
    setToken(null);
    setUser(null);
  };

  const switchAccount = (accountId) => {
    const target = savedAccounts.find(a => a.id === accountId || a.username === accountId);
    if (!target || !target.token) return;

    localStorage.setItem('pulsechat_token', target.token);
    const minimalUser = {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      avatar: target.avatar,
      email: target.email,
      isPro: target.isPro,
      customBadge: target.customBadge
    };
    setCachedUser(minimalUser);
    setToken(target.token);
    setUser(minimalUser);
  };

  const addAccount = () => {
    localStorage.removeItem('pulsechat_token');
    setCachedUser(null);
    setToken(null);
    setUser(null);
  };

  const removeSavedAccount = (accountId) => {
    setSavedAccounts(prev => {
      const next = prev.filter(a => a.id !== accountId && a.username !== accountId);
      try {
        localStorage.setItem('pulsechat_saved_accounts', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (user?.id === accountId || user?.username === accountId) {
      const remaining = savedAccounts.filter(a => a.id !== accountId && a.username !== accountId);
      if (remaining.length > 0) {
        switchAccount(remaining[0].id);
      } else {
        logout();
      }
    }
  };

  // Listen for real-time profile updates (e.g. avatar, name, bio, pro status, sparks)
  useEffect(() => {
    const handleProfileUpdateEvent = (e) => {
      const data = e.detail?.updates || e.detail;
      if (!data) return;
      const targetUserId = e.detail?.targetUserId || data.userId || data.id;
      setUser(current => {
        if (!current) return current;
        const isMe = current.id === targetUserId ||
          (data.userMongoId && current._id === data.userMongoId) ||
          (data.username && current.username === data.username);
        if (!isMe) return current;

        const merged = {
          ...current,
          ...(data.displayName !== undefined && data.displayName !== '' && { displayName: data.displayName }),
          ...(data.avatar !== undefined && data.avatar !== '' && { avatar: data.avatar }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.isPro !== undefined && { isPro: Boolean(data.isPro) }),
          ...(data.proTier !== undefined && { proTier: data.proTier }),
          ...(data.customBadge !== undefined && { customBadge: data.customBadge }),
          ...(data.pulseSparks !== undefined && { pulseSparks: data.pulseSparks }),
          ...(data.hideOnlineStatus !== undefined && { hideOnlineStatus: Boolean(data.hideOnlineStatus) }),
          ...(data.autoCleanupEnabled !== undefined && { autoCleanupEnabled: Boolean(data.autoCleanupEnabled) })
        };
        setCachedUser(merged);
        const curToken = localStorage.getItem('pulsechat_token');
        if (curToken) updateSavedAccountsList(merged, curToken);
        return merged;
      });
    };

    window.addEventListener('pulsechat_user_profile_updated', handleProfileUpdateEvent);
    return () => window.removeEventListener('pulsechat_user_profile_updated', handleProfileUpdateEvent);
  }, []);

  const updateUserProfile = (updatedUser) => {
    setUser(updatedUser);
    setCachedUser(updatedUser);
    if (token) {
      updateSavedAccountsList(updatedUser, token);
    }
  };

  const blockUser = async (targetUserId) => {
    if (!token) return false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/block/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => ({
          ...prev,
          blockedUsers: data.blockedUsers
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to block user:', e);
    }
    return false;
  };

  const unblockUser = async (targetUserId) => {
    if (!token) return false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/unblock/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => ({
          ...prev,
          blockedUsers: data.blockedUsers
        }));
        return true;
      }
    } catch (e) {
      console.error('Failed to unblock user:', e);
    }
    return false;
  };

  const toggleHideReadReceipts = async (enabled) => {
    if (!token) return false;
    const prevSetting = Boolean(user?.hideReadReceipts);
    const nextUser = { ...user, hideReadReceipts: Boolean(enabled) };
    
    // 0ms Optimistic UI update & offline storage sync
    setUser(nextUser);
    setCachedUser(nextUser);
    updateSavedAccountsList(nextUser, token);

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ hideReadReceipts: Boolean(enabled) })
      });
      const data = await res.json();
      if (data.user) {
        const confirmed = { ...nextUser, ...data.user };
        setUser(confirmed);
        setCachedUser(confirmed);
        updateSavedAccountsList(confirmed, token);
        return true;
      }
    } catch (e) {
      console.error('Failed to update unseen mode on backend, rolling back:', e);
      const rollbackUser = { ...user, hideReadReceipts: prevSetting };
      setUser(rollbackUser);
      setCachedUser(rollbackUser);
      updateSavedAccountsList(rollbackUser, token);
    }
    return false;
  };

  const toggleHideOnlineStatus = async (enabled) => {
    if (!token) return false;
    const prevSetting = Boolean(user?.hideOnlineStatus);
    const nextUser = { ...user, hideOnlineStatus: Boolean(enabled) };

    // 0ms Optimistic UI update & offline storage sync
    setUser(nextUser);
    setCachedUser(nextUser);
    updateSavedAccountsList(nextUser, token);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_toggle_online_privacy', {
        detail: { hideOnlineStatus: Boolean(enabled) }
      }));
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ hideOnlineStatus: Boolean(enabled) })
      });
      const data = await res.json();
      if (data.user) {
        const confirmed = { ...nextUser, ...data.user };
        setUser(confirmed);
        setCachedUser(confirmed);
        updateSavedAccountsList(confirmed, token);
        return true;
      }
    } catch (e) {
      console.error('Failed to update hide online status on backend, rolling back:', e);
      const rollbackUser = { ...user, hideOnlineStatus: prevSetting };
      setUser(rollbackUser);
      setCachedUser(rollbackUser);
      updateSavedAccountsList(rollbackUser, token);
    }
    return false;
  };

  const toggleAutoCleanup = async (enabled) => {
    if (!token) return false;
    const prevSetting = user?.autoCleanupEnabled !== false;
    const nextUser = { ...user, autoCleanupEnabled: Boolean(enabled) };

    setUser(nextUser);
    setCachedUser(nextUser);
    updateSavedAccountsList(nextUser, token);

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ autoCleanupEnabled: Boolean(enabled) })
      });
      const data = await res.json();
      if (data.user) {
        const confirmed = { ...nextUser, ...data.user };
        setUser(confirmed);
        setCachedUser(confirmed);
        updateSavedAccountsList(confirmed, token);
        return true;
      }
    } catch (e) {
      console.error('Failed to update auto-cleanup setting on backend:', e);
      const rollbackUser = { ...user, autoCleanupEnabled: prevSetting };
      setUser(rollbackUser);
      setCachedUser(rollbackUser);
      updateSavedAccountsList(rollbackUser, token);
    }
    return false;
  };

  const runInstantCleanup = async (days = 30) => {
    if (!token) return { success: false, deletedCount: 0 };
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages/auto-cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Failed to execute instant storage cleanup:', e);
      return { success: false, error: e.message, deletedCount: 0 };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      savedAccounts,
      switchAccount,
      addAccount,
      removeSavedAccount,
      updateUserProfile,
      blockUser,
      unblockUser,
      toggleHideReadReceipts,
      toggleHideOnlineStatus,
      toggleAutoCleanup,
      runInstantCleanup
    }}>
      {children}
    </AuthContext.Provider>
  );
}
