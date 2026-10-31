import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { BACKEND_URL } from '../utils/config';
import { subscribeUserToPush, showPushNotification } from '../utils/notifications';
import { updateUserProfileInStorage, appendCachedMessage, updateRecentChatSnippet, updateCachedMessageStatus } from '../utils/offlineStorage';
import { saveMessagesToLocalDb } from '../utils/localDatabase';
import { getOrInitDeviceIdentity, ensureDeviceIdentityRegistered, decryptMessageIfNeeded } from '../utils/e2eeCrypto';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [lastNotification, setLastNotification] = useState(null);
  const [vibeAuras, setVibeAuras] = useState({});

  const userRef = useRef(user);
  const deviceIdentityRef = useRef(null);
  const processedDurableMsgIdsRef = useRef(new Set());

  useEffect(() => {
    userRef.current = user;
    const myUserId = user?.id || user?._id;
    if (myUserId) {
      const initPromise = token
        ? ensureDeviceIdentityRegistered(myUserId, token, BACKEND_URL)
        : getOrInitDeviceIdentity(myUserId);
      initPromise
        .then(ident => {
          deviceIdentityRef.current = ident;
        })
        .catch(err => {
          console.warn('SocketContext: Device identity preload error:', err);
        });
    }
  }, [user, token]);

  // Silently register Web Push subscription if permission already granted (no prompt)
  useEffect(() => {
    if (user?.id && token) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush(token).catch(() => {});
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
      const authToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('pulsechat_token') || localStorage.getItem('token')) : null);
      const newSocket = io(BACKEND_URL, {
        auth: { token: authToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 200,
        reconnectionDelayMax: 1000,
        timeout: 8000
      });
      setSocket(newSocket);

      const sendSetup = () => {
        const curUser = userRef.current || user;
        const curId = curUser?.id || curUser?._id;
        const curToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('pulsechat_token') || localStorage.getItem('token')) : null);
        if (curId) {
          newSocket.emit('setup', curId);
          try {
            window.dispatchEvent(new Event('pulsechat_socket_reconnected'));
          } catch (e) {}
        }
        if (curId && curToken) {
          ensureDeviceIdentityRegistered(curId, curToken, BACKEND_URL)
            .then(ident => {
              if (ident) deviceIdentityRef.current = ident;
            })
            .catch(err => {
              console.warn('SocketContext: Device identity ensure error on connect:', err);
            });
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
      window.addEventListener('pagehide', handleOffline);
      window.addEventListener('beforeunload', handleOffline);

      // Instant user status updates (online / offline)
      newSocket.on('user_status', ({ userId, status }) => {
        if (!userId) return;
        const targetStr = String(userId).toLowerCase();
        if (status === 'offline') {
          setOnlineUsers(prev => prev.filter(u => String(u).toLowerCase() !== targetStr));
        } else if (status === 'online') {
          setOnlineUsers(prev => prev.some(u => String(u).toLowerCase() === targetStr) ? prev : [...prev, userId]);
        }
      });

      newSocket.on('online_users_list', (users) => {
        if (Array.isArray(users)) {
          setOnlineUsers(prev => {
            if (prev.length === users.length && prev.every((u, i) => u === users[i])) {
              return prev;
            }
            return users;
          });
        }
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
        const val = username || 'Someone';
        setTypingMap(prev => (prev[chatId] === val ? prev : { ...prev, [chatId]: val }));
      });

      newSocket.on('typing_stop', ({ chatId }) => {
        setTypingMap(prev => {
          if (!prev[chatId]) return prev;
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
      });

      const triggerPushIfBackground = (msg) => {
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
      };

      // Receiver-side Durable ACK Engine:
      // An incoming message is committed to local IndexedDB & cache FIRST before emitting 'message_delivered' ACK.
      // E2EE incoming messages are decrypted using the device private key before local caching so content is visible.
      // If network disconnects or browser crashes before local commit, server retains the message in queue.
      const handleIncomingDurableMessage = async (msg) => {
        if (!msg || !msg.id) return;
        const curUser = userRef.current || user;
        const curId = curUser?.id || curUser?._id;
        const myIds = new Set([curUser?.id, curUser?._id, curUser?.username].filter(Boolean).map(String));
        if (msg.senderId && myIds.has(String(msg.senderId))) return;

        // Message deduplication: prevent double-processing identical events or retry bursts
        const dId = String(msg.id || msg.clientTempId);
        if (dId) {
          if (processedDurableMsgIdsRef.current.has(dId)) return;
          processedDurableMsgIdsRef.current.add(dId);
          if (processedDurableMsgIdsRef.current.size > 500) {
            const arr = Array.from(processedDurableMsgIdsRef.current);
            processedDurableMsgIdsRef.current = new Set(arr.slice(arr.length - 250));
          }
        }

        // E2EE: Decrypt incoming encrypted message using local device private key before local caching
        let msgToCommit = msg;
        if (msg.isEncrypted && msg.envelope && !msg._decrypted) {
          let identity = deviceIdentityRef.current;
          if (!identity && curId) {
            try {
              identity = await getOrInitDeviceIdentity(curId);
              deviceIdentityRef.current = identity;
            } catch (err) {
              console.warn('SocketContext: Device identity init error:', err);
            }
          }
          if (identity?.keyPair?.privateKey) {
            try {
              msgToCommit = await decryptMessageIfNeeded(msg, identity.keyPair.privateKey, identity.deviceId);
            } catch (err) {
              console.warn('SocketContext: Message decryption error:', err);
            }
          }
        }

        // Check if recipient is actively viewing this specific chat right now
        const activeChatId = typeof window !== 'undefined' ? window.__pulsechat_active_chat_id : null;
        const activeChatObj = typeof window !== 'undefined' ? window.__pulsechat_active_chat : null;
        const isDocVisible = typeof document === 'undefined' || (document.visibilityState === 'visible' && !document.hidden);
        
        const chatParts = msgToCommit.chatId
          ? (msgToCommit.chatId.includes('::') ? msgToCommit.chatId.split('::') : (msgToCommit.chatId.includes('_') ? msgToCommit.chatId.split('_') : []))
          : [];

        const isSameChat = (id1, id2) => {
          if (!id1 || !id2) return false;
          if (id1 === id2) return true;
          const s1 = String(id1).replace(/::/g, '_');
          const s2 = String(id2).replace(/::/g, '_');
          if (s1 === s2) return true;
          if (s1.includes('_') && s2.includes('_')) {
            const p1 = s1.split('_').sort().join('_');
            const p2 = s2.split('_').sort().join('_');
            if (p1 === p2) return true;
          }
          return false;
        };

        const isViewingThisChat = Boolean(
          isDocVisible && (activeChatId || activeChatObj) && (
            (activeChatId && (
              isSameChat(activeChatId, msgToCommit.chatId) ||
              String(activeChatId) === String(msgToCommit.senderId) ||
              chatParts.includes(String(activeChatId))
            )) ||
            (activeChatObj && (
              isSameChat(activeChatObj.id, msgToCommit.chatId) ||
              isSameChat(activeChatObj._id, msgToCommit.chatId) ||
              String(activeChatObj.id) === String(msgToCommit.senderId) ||
              String(activeChatObj._id) === String(msgToCommit.senderId) ||
              (activeChatObj.username && String(activeChatObj.username).toLowerCase() === String(msgToCommit.senderUsername || '').toLowerCase()) ||
              chatParts.includes(String(activeChatObj.id)) ||
              (activeChatObj._id && chatParts.includes(String(activeChatObj._id)))
            ))
          )
        );

        // 1. Instant 0ms In-Memory UI Rendering:
        // Immediately notify active ChatWindow (if open) and trigger local notification
        // so the user experiences zero perceptible latency while durable disk persistence runs.
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_new_message', { detail: msgToCommit }));
          window.dispatchEvent(new CustomEvent('pulsechat_message_received', { detail: msgToCommit }));
        } catch (_) {}

        setLastNotification({ ...msgToCommit, receivedAt: Date.now() });

        if (!isViewingThisChat) {
          triggerPushIfBackground(msgToCommit);
        }

        // 2. Durable Local Storage Persistence & Double-Tick ACK:
        // Commit to localStorage & IndexedDB. Only AFTER local transaction completes,
        // emit 'message_delivered' ACK to the server with cryptographic receiptToken.
        try {
          if (msgToCommit.chatId) {
            appendCachedMessage(msgToCommit.chatId, msgToCommit);
            await saveMessagesToLocalDb(msgToCommit.chatId, [msgToCommit]);
            if (curId) {
              if (isViewingThisChat) {
                updateRecentChatSnippet(curId, msgToCommit.chatId, msgToCommit, null, {
                  isViewing: true,
                  increment: false
                });
              } else {
                updateRecentChatSnippet(curId, msgToCommit.chatId, msgToCommit, null);
              }
              window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
            }
          }
        } catch (e) {
          console.warn('Durable IndexedDB commit failed, suppressing delivery ACK:', e);
          return; // DO NOT send ACK if local persistence fails (quota full or transaction abort)
        }

        // 3. Emit delivery ACK ONLY AFTER local storage commit succeeds
        // Passes cryptographic receiptToken for verified tamper-proof queue deletion
        if (msg.status !== 'read') {
          newSocket.emit('message_delivered', {
            messageId: msg.id,
            chatId: msg.chatId,
            senderId: msg.senderId,
            receiptToken: msg.receiptToken || null,
            clientTempId: msg.clientTempId || null
          });
        }
      };

      // Real-time double-tick delivery update listener (sender receives confirmation when recipient commits to IndexedDB)
      newSocket.on('message_delivered_update', ({ messageId, clientTempId, chatId: cId, canonicalChatId, status }) => {
        const curId = userRef.current?.id || userRef.current?._id || user?.id || user?._id;
        const targetChatId = cId || canonicalChatId;
        if (targetChatId && curId) {
          updateCachedMessageStatus(targetChatId, messageId || clientTempId, { status: status || 'delivered' });
          if (clientTempId) updateCachedMessageStatus(targetChatId, clientTempId, { status: status || 'delivered' });
          updateRecentChatSnippet(curId, targetChatId, { status: status || 'delivered' }, null);
          window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
        }
      });

      // Fires for every incoming notification — save locally first and send delivery ack
      newSocket.on('message_notification', (msg) => {
        handleIncomingDurableMessage(msg);
      });

      // Also listen to direct new_message in active rooms
      newSocket.on('new_message', (msg) => {
        handleIncomingDurableMessage(msg);
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

      newSocket.on('chat_music_action', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_music_action', { detail: data }));
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
          const u = userRef.current || user;
          const myIds = [u?.id, u?._id, u?.userId].filter(Boolean).map(String);
          const reactionUserId = String(data?.userId || '');
          // Sender already saw immediate 0ms local reaction popup; only trigger for other room members
          if (data && data.isAdded && !myIds.includes(reactionUserId)) {
            window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
              detail: { emoji: data.emoji || '❤️', mode: 'reaction', duration: 1 }
            }));
          }
        } catch (e) {}
      });

      newSocket.on('emoji_burst_received', (data) => {
        try {
          window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
            detail: { emoji: data.emoji || '❤️', mode: 'burst', duration: 7, chatId: data.chatId, userId: data.userId }
          }));
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
        window.removeEventListener('pagehide', handleOffline);
        window.removeEventListener('beforeunload', handleOffline);
        window.removeEventListener('pulsechat_toggle_online_privacy', handleToggleOnlinePrivacy);
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [user?.id]);

  const contextValue = React.useMemo(() => ({
    socket,
    onlineUsers,
    typingMap,
    lastNotification,
    vibeAuras
  }), [socket, onlineUsers, typingMap, lastNotification, vibeAuras]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}
