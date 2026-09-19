import React, { createContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../utils/config';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pulsechat_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (data) => {
    localStorage.setItem('pulsechat_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('pulsechat_token');
    setToken(null);
    setUser(null);
  };

  const updateUserProfile = (updatedUser) => {
    setUser(updatedUser);
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
