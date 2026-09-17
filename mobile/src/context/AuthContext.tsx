import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';
import { User, ApiService } from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore stored token & user on app startup
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        const storedUser = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          initSocket(parsedUser.id);

          // Refresh user session from server
          try {
            const freshUser = await ApiService.getMe();
            setUser(freshUser);
            await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(freshUser));
          } catch {
            // Keep stored session if offline
          }
        }
      } catch (err) {
        console.error('Error bootstrapping auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, newToken);
    await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(newUser));
    initSocket(newUser.id);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    disconnectSocket();
    await AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      AsyncStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
