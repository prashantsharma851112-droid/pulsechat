import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { BACKEND_URL } from '../utils/config';
import { requestNotificationPermission, showPushNotification } from '../utils/notifications';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [lastNotification, setLastNotification] = useState(null);

  // User login hone par notification permission maango
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const newSocket = io(BACKEND_URL);
      setSocket(newSocket);

      newSocket.emit('setup', user.id);

      newSocket.on('online_users_list', (users) => {
        setOnlineUsers(users);
      });

      newSocket.on('typing_start', ({ chatId, username }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: username }));
      });

      newSocket.on('typing_stop', ({ chatId }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: null }));
      });

      // This fires for EVERY incoming message, regardless of whether the
      // relevant chat is currently open. We store it as an object (not an
      // array) that changes on every message, so components can watch it
      // with useEffect and react (refresh the sidebar list, show a toast).
      newSocket.on('message_notification', (msg) => {
        const notification = { ...msg, receivedAt: Date.now() };
        setLastNotification(notification);

        // Push notification show karo agar app background mein hai
        if (document.visibilityState === 'hidden' || document.hidden) {
          const senderName = msg.senderName || msg.senderId || 'Someone';
          const body = msg.type === 'text'
            ? (msg.content || 'New message')
            : `Sent a ${msg.type}`;
          showPushNotification(
            `💬 ${senderName}`,
            body,
            msg.senderAvatar || '/icon-192.png',
            `pulsechat-${msg.senderId}`
          );
        }
      });

      return () => newSocket.disconnect();
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap, lastNotification }}>
      {children}
    </SocketContext.Provider>
  );
}
