import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { BACKEND_URL } from '../utils/config';
import { subscribeUserToPush, showPushNotification } from '../utils/notifications';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [lastNotification, setLastNotification] = useState(null);

  // Silently register Web Push subscription if permission already granted (no prompt)
  useEffect(() => {
    if (user && token) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush(token).catch(() => {});
        const handleFocus = () => {
          if (document.visibilityState === 'visible') {
            subscribeUserToPush(token).catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', handleFocus);
        return () => document.removeEventListener('visibilitychange', handleFocus);
      }
    }
  }, [user, token]);

  useEffect(() => {
    if (user) {
      const newSocket = io(BACKEND_URL);
      setSocket(newSocket);

      const sendSetup = () => {
        if (user?.id) {
          newSocket.emit('setup', user.id);
        }
      };

      // Always emit setup on connect/reconnect (Data ON / Network restored)
      newSocket.on('connect', sendSetup);
      if (newSocket.connected) {
        sendSetup();
      }

      // Handle mobile data toggling ON
      const handleOnline = () => {
        if (!newSocket.connected) {
          newSocket.connect();
        } else {
          sendSetup();
        }
      };
      window.addEventListener('online', handleOnline);

      newSocket.on('online_users_list', (users) => {
        setOnlineUsers(users);
      });

      newSocket.on('typing_start', ({ chatId, username }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: username }));
      });

      newSocket.on('typing_stop', ({ chatId }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: null }));
      });

      const triggerPushIfBackground = (msg) => {
        const isHidden = typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.hidden);
        if (isHidden) {
          const senderTitle = msg.isGroup ? (msg.groupName || 'Group') : (msg.senderName || msg.senderId || 'PulseChat');
          const body = msg.type === 'text'
            ? (msg.isGroup ? `${msg.senderName || 'Member'}: ${msg.content}` : (msg.content || 'New message'))
            : `Sent a ${msg.type}`;
          showPushNotification(
            `💬 ${senderTitle}`,
            body,
            msg.senderAvatar || '/icon-192.png',
            `pulsechat-${msg.chatId || msg.senderId}`,
            { chatId: msg.chatId, senderId: msg.senderId, isGroup: !!msg.isGroup }
          );
        }
      };

      // Fires for every incoming notification — also send delivery ack
      newSocket.on('message_notification', (msg) => {
        const notification = { ...msg, receivedAt: Date.now() };
        setLastNotification(notification);
        triggerPushIfBackground(msg);

        // Delivery ack bhejo taaki sender ko double tick dikhe
        if (msg.id && msg.senderId && msg.senderId !== user.id) {
          newSocket.emit('message_delivered', {
            messageId: msg.id,
            chatId: msg.chatId,
            senderId: msg.senderId
          });
        }
      });

      // Also listen to direct new_message in active rooms
      newSocket.on('new_message', (msg) => {
        if (msg.senderId !== user.id) {
          triggerPushIfBackground(msg);
          if (msg.id && msg.status === 'sent') {
            newSocket.emit('message_delivered', {
              messageId: msg.id,
              chatId: msg.chatId,
              senderId: msg.senderId
            });
          }
        }
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap, lastNotification }}>
      {children}
    </SocketContext.Provider>
  );
}
