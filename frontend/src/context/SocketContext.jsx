import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Silently register Web Push subscription if permission already granted (no prompt)
  useEffect(() => {
    if (user?.id && token) {
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
  }, [user?.id, token]);

  useEffect(() => {
    if (user?.id) {
      const newSocket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 200,
        reconnectionDelayMax: 1000,
        timeout: 8000
      });
      setSocket(newSocket);

      const sendSetup = () => {
        const curId = userRef.current?.id || user?.id;
        if (curId) {
          newSocket.emit('setup', curId);
          try {
            window.dispatchEvent(new Event('pulsechat_socket_reconnected'));
          } catch (e) {}
        }
      };

      // Always emit setup on connect/reconnect (Data ON / Network restored)
      newSocket.on('connect', sendSetup);
      if (newSocket.connected) {
        sendSetup();
      }

      // Handle mobile data toggling ON / OFF
      const handleOnline = () => {
        if (!newSocket.connected) {
          newSocket.connect();
        } else {
          sendSetup();
        }
      };

      const handleOffline = () => {
        const curId = userRef.current?.id || user?.id;
        if (curId) {
          try {
            newSocket.emit('user_offline', curId);
          } catch (e) {}
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

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
        const curId = userRef.current?.id || user?.id;
        if (msg.id && msg.senderId && msg.senderId !== curId) {
          newSocket.emit('message_delivered', {
            messageId: msg.id,
            chatId: msg.chatId,
            senderId: msg.senderId
          });
        }
      });

      // Also listen to direct new_message in active rooms
      newSocket.on('new_message', (msg) => {
        const curId = userRef.current?.id || user?.id;
        if (msg.senderId !== curId) {
          triggerPushIfBackground(msg);
          if (msg.id && msg.status !== 'read') {
            newSocket.emit('message_delivered', {
              messageId: msg.id,
              chatId: msg.chatId,
              senderId: msg.senderId
            });
          }
        }
      });

      newSocket.on('aura_changed', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_aura_changed', { detail: data }));
        } catch (e) {}
      });

      newSocket.on('stealth_dust_dissolved', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_stealth_dust_dissolved', { detail: data }));
        } catch (e) {}
      });

      newSocket.on('emoji_burst_received', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', { detail: { emoji: data.emoji || '❤️', mode: 'burst', duration: 5 } }));
        } catch (e) {}
      });

      // Listen to real-time friend/sync request and acceptance alerts
      newSocket.on('friend_notification', (data) => {
        const notif = {
          id: `fn_${Date.now()}`,
          isFriendRequest: data.type === 'friend_request',
          isFriendAccepted: data.type === 'friend_accepted',
          title: data.title || '⚡ Pulse Sync Update',
          senderName: data.senderName || data.title,
          senderId: data.senderId,
          senderAvatar: data.senderAvatar || null,
          content: data.body,
          type: 'text',
          receivedAt: Date.now()
        };
        setLastNotification(notif);
        const isHidden = typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.hidden);
        if (isHidden) {
          showPushNotification(
            data.title || 'Pulse Sync ⚡',
            data.body || 'You have a new sync notification.',
            data.senderAvatar || '/icon-192.png',
            `pulse-sync-${Date.now()}`,
            { url: '/?tab=friends' }
          );
        }
      });

      const handleToggleOnlinePrivacy = (e) => {
        if (newSocket && newSocket.connected && e.detail) {
          const curId = userRef.current?.id || user?.id;
          newSocket.emit('toggle_online_privacy', {
            hideOnlineStatus: Boolean(e.detail.hideOnlineStatus),
            userId: curId
          });
        }
      };

      window.addEventListener('pulsechat_toggle_online_privacy', handleToggleOnlinePrivacy);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('pulsechat_toggle_online_privacy', handleToggleOnlinePrivacy);
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap, lastNotification }}>
      {children}
    </SocketContext.Provider>
  );
}
