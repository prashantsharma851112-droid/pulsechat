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
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ hideReadReceipts: enabled })
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        return true;
      }
    } catch (e) {
      console.error('Failed to update unseen mode:', e);
    }
    return false;
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
      toggleHideReadReceipts
    }}>
      {children}
    </AuthContext.Provider>
  );
}
