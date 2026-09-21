import React, { createContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../utils/config';
import { getCachedUser, setCachedUser } from '../utils/offlineStorage';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [token, setToken] = useState(() => localStorage.getItem('pulsechat_token'));
  const [loading, setLoading] = useState(() => !getCachedUser() && !!localStorage.getItem('pulsechat_token'));

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
  };

  const logout = () => {
    localStorage.removeItem('pulsechat_token');
    setCachedUser(null);
    setToken(null);
    setUser(null);
  };

  const updateUserProfile = (updatedUser) => {
    setUser(updatedUser);
    setCachedUser(updatedUser);
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
      updateUserProfile,
      blockUser,
      unblockUser,
      toggleHideReadReceipts
    }}>
      {children}
    </AuthContext.Provider>
  );
}
