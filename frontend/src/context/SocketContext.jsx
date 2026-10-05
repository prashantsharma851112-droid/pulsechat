import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { BACKEND_URL } from '../utils/config';
import { subscribeUserToPush, showPushNotification } from '../utils/notifications';
import { updateUserProfileInStorage } from '../utils/offlineStorage';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [lastNotification, setLastNotification] = useState(null);
  const [vibeAuras, setVibeAuras] = useState({});

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
        try {
          newSocket.emit('get_vibe_auras');
        } catch (e) {}
      });

      newSocket.on('vibe_auras_list', (aurasList) => {
        if (aurasList) {
          setVibeAuras(aurasList);
        }
      });

      newSocket.on('vibe_aura_updated', (cleanAura) => {
        if (cleanAura) {
          const isCleared = Boolean(cleanAura.cleared || cleanAura.auraType === 'none' || (!cleanAura.mood && !cleanAura.isLowBattery && !cleanAura.inGame));
          setVibeAuras(prev => {
            const next = { ...prev };
            const uId = cleanAura.userId ? String(cleanAura.userId) : null;
            const uName = cleanAura.username ? String(cleanAura.username) : null;
            if (isCleared) {
              if (uId) delete next[uId];
              if (uName) delete next[uName];
            } else {
              if (uId) next[uId] = cleanAura;
              if (uName) next[uName] = cleanAura;
            }
            return next;
          });
          try {
            const curId = userRef.current?.id;
            if (cleanAura.userId) {
              updateUserProfileInStorage(cleanAura.userId, { vibeAura: isCleared ? null : cleanAura }, curId);
            }
          } catch (e) {}
        }
      });

      newSocket.on('typing_start', ({ chatId, username }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: username || 'Someone' }));
      });

      newSocket.on('typing_stop', ({ chatId }) => {
        setTypingMap(prev => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
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

      newSocket.on('chat_wallpaper_updated', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_wallpaper_updated', { detail: data }));
        } catch (e) {}
      });

      newSocket.on('chat_theme_updated', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_theme_updated', { detail: data }));
        } catch (e) {}
      });

      newSocket.on('chat_music_updated', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_music_updated', { detail: data }));
        } catch (e) {}
      });

      newSocket.on('stealth_dust_dissolved', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_stealth_dust_dissolved', { detail: data }));
          if (data?.chatId) {
            const targetIds = [data.messageId, data.messageMongoId, data.clientTempId].filter(Boolean).map(String);
            if (targetIds.length > 0) {
              const keys = [`pulsechat_msgs_${data.chatId}`];
              if (data.chatId.includes('_')) {
                const parts = data.chatId.split('_');
                keys.push(`pulsechat_msgs_${parts[1]}_${parts[0]}`);
              }
              keys.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                  const msgs = JSON.parse(raw);
                  if (Array.isArray(msgs)) {
                    const updated = msgs.filter(m =>
                      !targetIds.includes(String(m.id)) &&
                      !targetIds.includes(String(m._id)) &&
                      (!m.clientTempId || !targetIds.includes(String(m.clientTempId)))
                    );
                    localStorage.setItem(k, JSON.stringify(updated));
                  }
                }
              });
            }
          }
        } catch (e) {}
      });

      newSocket.on('reaction_updated', (data) => {
        try {
          if (data && data.isAdded) {
            window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
              detail: { emoji: data.emoji || '❤️', mode: 'reaction', duration: 3 }
            }));
          }
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
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap, lastNotification, vibeAuras }}>
      {children}
    </SocketContext.Provider>
  );
}
