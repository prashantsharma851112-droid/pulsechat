import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Token if present
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  status?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId?: string;
  isGroup?: boolean;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'poll' | 'call';
  audioUrl?: string | null;
  mediaUrl?: string | null;
  isViewOnce?: boolean;
  viewedBy?: string[];
  pollData?: any;
  callData?: any;
  status?: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  members: string[];
  createdAt: string;
}

// API Service Methods
export const ApiService = {
  // Check Username Availability
  checkUsername: async (username: string): Promise<boolean> => {
    try {
      const res = await api.get(`/auth/check-username/${encodeURIComponent(username)}`);
      return res.data.available;
    } catch {
      return false;
    }
  },

  // Auth: Register
  register: async (data: { email: string; password: string; username: string; displayName: string }) => {
    const res = await api.post('/auth/register', data);
    return res.data; // { token, user }
  },

  // Auth: Login
  login: async (data: { identifier: string; password: string }) => {
    const res = await api.post('/auth/login', data);
    return res.data; // { token, user }
  },

  // Auth: Verify Current Session
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data.user as User;
  },

  // Send 6-Digit OTP
  sendOtp: async (email: string) => {
    const res = await api.post('/auth/send-otp', { email });
    return res.data;
  },

  // Verify OTP
  verifyOtp: async (email: string, otp: string, userId?: string) => {
    const res = await api.post('/auth/verify-otp', { email, otp, userId });
    return res.data;
  },

  // Get All Active Users
  getUsers: async (): Promise<User[]> => {
    const res = await api.get('/users');
    return res.data;
  },

  // Get Chat Messages for a specific chatId
  getMessages: async (chatId: string): Promise<Message[]> => {
    const res = await api.get(`/messages/${chatId}`);
    return res.data;
  },

  // Get User Groups
  getGroups: async (): Promise<Group[]> => {
    const res = await api.get('/groups');
    return res.data;
  },

  // Create New Group
  createGroup: async (data: { name: string; description?: string; members: string[] }) => {
    const res = await api.post('/groups/create', data);
    return res.data;
  },
};

export default api;
