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

  // Persistent VIP Aura Trial Expiration Watchdog (checks every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      try {
        const currentUserIsPro = Boolean(userRef.current?.isPro || user?.isPro || userRef.current?.isAdmin || user?.isAdmin);
        const storedTrial = localStorage.getItem('pulsechat_aura_trial');
        if (storedTrial) {
          if (currentUserIsPro) {
            // Pro VIP users are immune: immediately remove any lingering trial key and never wipe VIP aura
            localStorage.removeItem('pulsechat_aura_trial');
          } else {
            const parsed = JSON.parse(storedTrial);
            if (parsed && parsed.expiresAt && now >= Number(parsed.expiresAt)) {
              localStorage.removeItem('pulsechat_aura_trial');
              const uid = userRef.current?.id || user?.id;
              if (uid && socket) {
                const clearData = {
                  userId: uid,
                  mood: '',
                  emoji: '',
                  auraColor: null,
                  auraType: 'none',
                  isLowBattery: false,
                  batteryLevel: null,
                  inGame: '',
                  cleared: true,
                  music: null
                };
                socket.emit('update_vibe_aura', clearData);
              }
              if (uid) {
                try { updateUserProfileInStorage(uid, { vibeAura: null }, uid); } catch (e) {}
                window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
                  detail: { targetUserId: uid, updates: { vibeAura: null } }
                }));
              }
            }
          }
        }
      } catch (e) {}

      // Sweep live vibeAuras state to purge any expired trial aura
      setVibeAuras(prev => {
        let changed = false;
        const next = { ...prev };
        for (const k in next) {
          const item = next[k];
          if (item?.isTrial && item?.trialExpiresAt && now >= Number(item.trialExpiresAt)) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [socket, user?.id]);

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
          const now = Date.now();
          const filtered = {};
          for (const k in aurasList) {
            const item = aurasList[k];
            if (!item?.trialExpiresAt || now <= Number(item.trialExpiresAt)) {
              filtered[k] = item;
            }
          }
          setVibeAuras(filtered);
        }
      });

      newSocket.on('vibe_aura_updated', (cleanAura) => {
        if (cleanAura) {
          const isExpired = cleanAura.trialExpiresAt && Date.now() > Number(cleanAura.trialExpiresAt);
          const isCleared = Boolean(isExpired || cleanAura.cleared || cleanAura.auraType === 'none' || (!cleanAura.mood && !cleanAura.isLowBattery && !cleanAura.inGame));
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

      // Daily Vibe Streak Reward (Sparks Drop & Neon Flame Aura Unlock)
      newSocket.on('streak_sparks_reward', (data) => {
        try {
          if (data && (data.streakCount >= 3 || data.auraUnlocked === 'neon_flame' || data.milestoneHit === 3)) {
            window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
              detail: { emoji: '🔥', mode: 'burst', duration: 5 }
            }));
            const streakMsg = `🔥 3-Day Streak Celebrated! +${data.bonusSparks || 15} Sparks Dropped & 'Neon Flame Aura' Unlocked! ✨`;
            setLastNotification({
              id: `streak_${Date.now()}`,
              title: '🔥 3-Day Vibe Streak Unlocked!',
              content: streakMsg,
              type: 'streak_reward',
              receivedAt: Date.now()
            });
            window.dispatchEvent(new CustomEvent('pulsechat_toast_notify', { detail: { message: streakMsg, type: 'streak' } }));
          }
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
