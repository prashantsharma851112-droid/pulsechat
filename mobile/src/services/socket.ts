import { io, Socket } from 'socket.io-client';
import { CONFIG } from '../config';
import { Message } from './api';

let socket: Socket | null = null;

export const initSocket = (userId: string): Socket => {
  if (socket && socket.connected) {
    socket.emit('setup', userId);
    return socket;
  }

  socket = io(CONFIG.SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('⚡ Socket connected to server:', socket?.id);
    socket?.emit('setup', userId);
  });

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.log('❌ Socket connection error:', error);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinChatRoom = (chatId: string) => {
  if (socket) {
    socket.emit('join_chat', chatId);
  }
};

export const emitSendMessage = (messageData: Partial<Message>) => {
  if (socket) {
    socket.emit('send_message', messageData);
  }
};

export const emitTypingStart = (chatId: string, userId: string, username: string) => {
  if (socket) {
    socket.emit('typing_start', { chatId, userId, username });
  }
};

export const emitTypingStop = (chatId: string, userId: string) => {
  if (socket) {
    socket.emit('typing_stop', { chatId, userId });
  }
};
