import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Paperclip, CheckSquare, Trash2, X, Check, MoreVertical, Info, CornerUpLeft, FileText, Ban, ShieldAlert, WifiOff, Palette, UserPlus, Presentation, Music, Flame, Zap, Volume2 } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import CreatePollModal from './CreatePollModal';
import WhiteboardModal from './WhiteboardModal';
import UserProfileModal from './UserProfileModal';
import GroupProfileModal from './GroupProfileModal';
import MediaUploadModal from './MediaUploadModal';
import ChatThemeModal from './ChatThemeModal';
import SolidThemeModal from './SolidThemeModal';
import ChatLiveWallpaper from './ChatLiveWallpaper';
import PulseProModal from './PulseProModal';
import GiftPickerModal from './GiftPickerModal';
import Animated3DTextModal from './Animated3DTextModal';
import PulseVipBadge from '../common/PulseVipBadge';
import { playSound, playPulseAuraSound, stopPulseAuraSound, setPulseAuraVolume } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';
import { isEmotionalTriggerMessage, calculateConversationMoodTimeline } from '../../utils/sentiment';
import {
  getCachedMessages,
  setCachedMessages,
  appendCachedMessage,
  updateCachedMessageStatus,
  getOutbox,
  addToOutbox,
  removeFromOutbox,
  updateRecentChatSnippet,
  mergeIntoAllUsersCache,
  getCachedAllUsers,
  isCachedFriend,
  isDeviceOnline,
  subscribeToNetworkChanges,
  updateGroupInStorage,
  clearUnreadCount
} from '../../utils/offlineStorage';

export default function ChatWindow({ activeChat, onBack, onStartCall, onStartGroupCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser, updateUserProfile } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap, lastNotification } = useContext(SocketContext);

  const isGroup = !!activeChat.isGroup;
  const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
  const isOnline = !isGroup && onlineUsers.includes(activeChat.id);
  const isTyping = typingMap[chatId] === activeChat.username;

  const getSenderPayload = () => ({
    senderName: user?.displayName || user?.username || 'User',
    senderUsername: user?.username || '',
    senderAvatar: user?.avatar || null,
    senderIsPro: Boolean(user?.isPro),
    senderProTier: user?.proTier || 'none',
    senderCustomBadge: user?.customBadge || ''
  });

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSolidThemeModal, setShowSolidThemeModal] = useState(false);
  const [auraVolume, setAuraVolume] = useState(() => {
    const saved = localStorage.getItem('pulsechat_aura_volume');
    return saved !== null ? Number(saved) : 0.7;
  });
  const [chatTheme, setChatTheme] = useState(() => {
    return localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || localStorage.getItem('pulsechat_chat_default_theme') || 'default';
  });
  const [selectedVibe, setSelectedVibe] = useState('⚡ Quick Pulse');

  const [chatAvatar, setChatAvatar] = useState(() => activeChat?.avatar || '');
  const [chatDisplayName, setChatDisplayName] = useState(() => activeChat?.displayName || activeChat?.name || '');
  const [chatIsPro, setChatIsPro] = useState(() => {
    if (activeChat?.isPro !== undefined) return Boolean(activeChat.isPro);
    if (user?.id) {
      const cached = getCachedAllUsers(user.id)?.find(u =>
        u.id === activeChat?.id || u.id === activeChat?._id || (activeChat?.username && u.username === activeChat.username)
      );
      if (cached?.isPro !== undefined) return Boolean(cached.isPro);
    }
    return false;
  });

  useEffect(() => {
    setChatAvatar(activeChat?.avatar || '');
    setChatDisplayName(activeChat?.displayName || activeChat?.name || '');
    let isProVal = activeChat?.isPro;
    if (isProVal === undefined && user?.id) {
      const cached = getCachedAllUsers(user.id)?.find(u =>
        u.id === activeChat?.id || u.id === activeChat?._id || (activeChat?.username && u.username === activeChat.username)
      );
      if (cached?.isPro !== undefined) isProVal = cached.isPro;
    }
    setChatIsPro(Boolean(isProVal));
  }, [activeChat?.id, activeChat?.avatar, activeChat?.displayName, activeChat?.name, activeChat?.isPro, user?.id]);

  // Fetch fresh profile on mount to guarantee VIP/Pro aura & badge are always up-to-date
  useEffect(() => {
    if (!isGroup && activeChat?.id && token) {
      fetch(`${BACKEND_URL}/api/users/${activeChat.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(userData => {
          if (userData && !userData.error) {
            const isProVal = Boolean(userData.isPro);
            if (userData.isPro !== undefined) {
              setChatIsPro(isProVal);
              if (activeChat) activeChat.isPro = isProVal;
            }
            if (userData.avatar) {
              setChatAvatar(userData.avatar);
              if (activeChat) activeChat.avatar = userData.avatar;
            }
            if (userData.displayName) {
              setChatDisplayName(userData.displayName);
              if (activeChat) activeChat.displayName = userData.displayName;
            }

            // Sync with Sidebar recent chats and all users immediately (0ms)
            window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
              detail: {
                targetUserId: activeChat.id,
                updates: {
                  userId: activeChat.id,
                  userMongoId: userData._id ? userData._id.toString() : null,
                  username: userData.username || activeChat.username,
                  displayName: userData.displayName || activeChat.displayName,
                  avatar: userData.avatar,
                  isPro: isProVal,
                  proTier: userData.proTier,
                  customBadge: userData.customBadge,
                  pulseSparks: userData.pulseSparks
                }
              }
            }));
          }
        })
        .catch(err => console.warn('Could not fetch activeChat profile:', err));
    }
  }, [activeChat?.id, isGroup, token]);

  // Real-time DP / Profile updates in ChatWindow header
  useEffect(() => {
    const handleProfileUpdate = (data) => {
      if (!data || isGroup) return;
      const isTarget = activeChat && (
        activeChat.id === data.userId ||
        (data.userMongoId && (activeChat.id === data.userMongoId || activeChat._id === data.userMongoId)) ||
        (data.username && activeChat.username === data.username)
      );
      if (isTarget) {
        if (data.isPro !== undefined) {
          setChatIsPro(Boolean(data.isPro));
          if (activeChat) activeChat.isPro = Boolean(data.isPro);
        }
        if (data.proTier) {
          if (activeChat) activeChat.proTier = data.proTier;
        }
        if (data.customBadge !== undefined) {
          if (activeChat) activeChat.customBadge = data.customBadge;
        }
        if (data.avatar) {
          setChatAvatar(data.avatar);
          if (activeChat) activeChat.avatar = data.avatar;
        }
        if (data.displayName) {
          setChatDisplayName(data.displayName);
          if (activeChat) activeChat.displayName = data.displayName;
        }
        if (data.status) {
          if (activeChat) activeChat.status = data.status;
        }

        // Also instantly update message sender avatars in active chat
        setMessages(prev => prev.map(m => {
          const isSender = (m.senderId && (m.senderId === data.userId || (data.userMongoId && m.senderId === data.userMongoId))) ||
            (m.sender && data.username && m.sender === data.username);
          if (isSender) {
            return {
              ...m,
              ...(data.avatar && { senderAvatar: data.avatar }),
              ...(data.displayName && { senderName: data.displayName })
            };
          }
          return m;
        }));
      }
    };

    if (socket) socket.on('user_profile_updated', handleProfileUpdate);
    const handleWindowEvent = (e) => {
      if (e.detail?.updates) {
        handleProfileUpdate({ userId: e.detail.targetUserId, ...e.detail.updates });
      }
    };
    window.addEventListener('pulsechat_user_profile_updated', handleWindowEvent);

    // Group updates listener (real-time name and avatar sync)
    const handleGroupUpdated = (data) => {
      if (!data || !isGroup) return;
      const targetId = data.groupId || data.id || data._id;
      if (targetId === activeChat.id || targetId === activeChat._id) {
        const updates = data.updates || data;
        if (updates.name) {
          setChatDisplayName(updates.name);
          activeChat.displayName = updates.name;
          activeChat.name = updates.name;
        }
        if (updates.avatar) {
          setChatAvatar(updates.avatar);
          activeChat.avatar = updates.avatar;
        }
      }
    };

    if (socket) socket.on('group_updated', handleGroupUpdated);
    const handleWindowGroupUpdated = (e) => {
      if (e.detail) {
        handleGroupUpdated(e.detail);
      }
    };
    window.addEventListener('pulsechat_group_updated', handleWindowGroupUpdated);

    return () => {
      if (socket) socket.off('user_profile_updated', handleProfileUpdate);
      if (socket) socket.off('group_updated', handleGroupUpdated);
      window.removeEventListener('pulsechat_user_profile_updated', handleWindowEvent);
      window.removeEventListener('pulsechat_group_updated', handleWindowGroupUpdated);
    };
  }, [socket, activeChat, isGroup]);

  const isDirectFriend = isGroup ||
    (activeChat?.lastMessage !== undefined && activeChat?.lastMessage !== null) ||
    activeChat?.hasHistory ||
    activeChat?.isFriend ||
    (getCachedMessages(chatId).length > 0) ||
    isCachedFriend(user?.id, activeChat?.id);

  const [friendshipStatus, setFriendshipStatus] = useState(() => isDirectFriend ? 'friends' : 'checking');
  const [friendRequestId, setFriendRequestId] = useState(null);

  const [chatWallpaper, setChatWallpaper] = useState(() => {
    return localStorage.getItem(`pulsechat_chat_wallpaper_${chatId}`) || 'none';
  });
  const [customWallpaper, setCustomWallpaper] = useState(() => {
    return localStorage.getItem(`pulsechat_custom_wallpaper_${chatId}`) || null;
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || localStorage.getItem('pulsechat_chat_default_theme') || 'midnight_amoled';
    setChatTheme(savedTheme);
    const savedWall = localStorage.getItem(`pulsechat_chat_wallpaper_${chatId}`) || 'none';
    setChatWallpaper(savedWall);
    const savedCustom = localStorage.getItem(`pulsechat_custom_wallpaper_${chatId}`);
    setCustomWallpaper(savedCustom || null);

    const handleWallpaperUpdated = (e) => {
      if (e.detail?.chatId === chatId) {
        const newWall = e.detail.wallpaperId || 'none';
        const customUrl = e.detail.customWallpaperUrl || null;
        setChatWallpaper(newWall);
        setCustomWallpaper(customUrl);
        if (newWall === 'none') {
          localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
        } else {
          localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
        }
        if (customUrl) {
          localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, customUrl);
        } else {
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
        }
      }
    };

    const handleThemeUpdated = (e) => {
      if (e.detail?.chatId === chatId) {
        const newTheme = e.detail.themeId || 'default';
        setChatTheme(newTheme);
        if (newTheme === 'default' || newTheme === 'midnight_amoled') {
          localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
        } else {
          localStorage.setItem(`pulsechat_chat_theme_${chatId}`, newTheme);
          localStorage.setItem('pulsechat_chat_default_theme', newTheme);
        }
      }
    };

    window.addEventListener('pulsechat_wallpaper_updated', handleWallpaperUpdated);
    window.addEventListener('pulsechat_theme_updated', handleThemeUpdated);

    return () => {
      window.removeEventListener('pulsechat_wallpaper_updated', handleWallpaperUpdated);
      window.removeEventListener('pulsechat_theme_updated', handleThemeUpdated);
    };
  }, [chatId]);

  const handleSelectChatTheme = (newTheme) => {
    setChatTheme(newTheme);
    if (newTheme === 'default' || newTheme === 'midnight_amoled') {
      localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
    } else {
      localStorage.setItem(`pulsechat_chat_theme_${chatId}`, newTheme);
      localStorage.setItem('pulsechat_chat_default_theme', newTheme);
    }
    if (socket) {
      socket.emit('set_chat_theme', { chatId, themeId: newTheme, userId: user?.id });
    }
  };

  const handleSelectChatWallpaper = (newWall, customUrl = customWallpaper) => {
    setChatWallpaper(newWall);
    if (newWall === 'none') {
      localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
    } else {
      localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
    }
    if (socket) {
      socket.emit('set_chat_wallpaper', { chatId, wallpaperId: newWall, customWallpaperUrl: customUrl, userId: user?.id });
    }
  };

  const handleSetCustomWallpaper = (dataUrl) => {
    setCustomWallpaper(dataUrl);
    if (dataUrl) {
      localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, dataUrl);
      handleSelectChatWallpaper('custom_image', dataUrl);
    } else {
      localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
      handleSelectChatWallpaper('none', null);
    }
  };

  const [messages, setMessages] = useState(() => {
    const cached = getCachedMessages(chatId);
    const outbox = getOutbox(user?.id);
    const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
    const cachedIds = new Set(cached.map(m => m.id));
    return [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))];
  });
  const [isNetConnected, setIsNetConnected] = useState(() => isDeviceOnline());

  const [text, setText] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [show3DTextModal, setShow3DTextModal] = useState(false);
  const [showActionGrid, setShowActionGrid] = useState(false);
  const [showEmojiBurstPicker, setShowEmojiBurstPicker] = useState(false);
  const actionGridRef = useRef(null);
  const [proModalTab, setProModalTab] = useState('pro');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reply state (WhatsApp style)
  const [replyTo, setReplyTo] = useState(null);
  const replyInputRef = useRef(null);

  // Track if this is the initial load (to use instant scroll vs smooth scroll)
  const isInitialLoad = useRef(true);

  // Multi-Select & Clear Chat states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [clearedBackup, setClearedBackup] = useState([]);
  const [clearedUndoSecs, setClearedUndoSecs] = useState(0);
  const [multiDeleteBackupIds, setMultiDeleteBackupIds] = useState([]);
  const [multiDeleteUndoSecs, setMultiDeleteUndoSecs] = useState(0);

  // Cooldown timer state (10s delayed send option)
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [cooldownMsg, setCooldownMsg] = useState(null);

  // Chat settings & block status
  const [chatSetting, setChatSetting] = useState({ disappearingEnabled: false });
  const [blockStatus, setBlockStatus] = useState({ isBlockedByMe: false, isBlockedByThem: false });

  // Pagination for infinite fast scroll
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Pulse Aura Soundscapes State
  const [activeAura, setActiveAura] = useState(() => {
    return localStorage.getItem(`pulsechat_aura_${chatId}`) || 'off';
  });
  const [showAuraMenu, setShowAuraMenu] = useState(false);

  useEffect(() => {
    const savedAura = localStorage.getItem(`pulsechat_aura_${chatId}`) || 'off';
    setActiveAura(savedAura);
    if (savedAura && savedAura !== 'off') {
      playPulseAuraSound(savedAura, auraVolume);
    }

    const handleAuraChange = (e) => {
      if (e.detail?.chatId === chatId) {
        const newAura = e.detail.auraId || 'off';
        setActiveAura(newAura);
        playPulseAuraSound(newAura, auraVolume);
        localStorage.setItem(`pulsechat_aura_${chatId}`, newAura);
      }
    };

    const handleStealthDissolved = (e) => {
      if (e.detail?.chatId === chatId && e.detail?.messageId) {
        setMessages(prev => prev.filter(m => m.id !== e.detail.messageId));
      }
    };

    window.addEventListener('pulsechat_aura_changed', handleAuraChange);
    window.addEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);

    return () => {
      window.removeEventListener('pulsechat_aura_changed', handleAuraChange);
      window.removeEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);
      stopPulseAuraSound();
    };
  }, [chatId, auraVolume]);

  const handleSelectAura = (auraId) => {
    if (auraId !== 'off' && !user?.isPro) {
      setShowAuraMenu(false);
      setShowProModal(true);
      return;
    }
    setActiveAura(auraId);
    playPulseAuraSound(auraId, auraVolume);
    localStorage.setItem(`pulsechat_aura_${chatId}`, auraId);
    setShowAuraMenu(false);
    if (socket) {
      socket.emit('set_aura', { chatId, auraId, userId: user?.id });
    }
  };

  const handleSendStealthDust = () => {
    setShowActionGrid(false);
    if (!user?.isPro) {
      setShowProModal(true);
      return;
    }
    const dustText = prompt("⚡ Enter your Dust Text Secret Note:\n(It will render blurred until recipient holds down, then shatters into digital dust)");
    if (!dustText || !dustText.trim()) return;

    const tempMsgId = 'msg_stealth_' + Date.now();
    const msgData = {
      ...getSenderPayload(),
      id: tempMsgId,
      clientTempId: tempMsgId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: dustText.trim(),
      type: 'stealth_dust',
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, msgData]);
    playSound('sent');
    if (socket) {
      socket.emit('send_message', msgData);
    }
  };

  const handleTriggerEmojiBurst = (emoji = '🔥') => {
    setShowActionGrid(false);
    setShowEmojiBurstPicker(false);
    if (!user?.isPro) {
      setShowProModal(true);
      return;
    }
    if (socket) {
      socket.emit('trigger_emoji_burst', { chatId, emoji, userId: user?.id });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', { detail: { emoji, mode: 'burst', duration: 5 } }));
    }
  };

  // Close 4-dot action grid on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionGridRef.current && !actionGridRef.current.contains(e.target)) {
        setShowActionGrid(false);
      }
    };
    if (showActionGrid) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showActionGrid]);

  // Automatic Outbox Sync when network or socket reconnects
  const syncOutbox = useCallback(() => {
    if (!user?.id || !socket || !socket.connected) return;
    const outbox = getOutbox(user.id);
    if (!outbox || outbox.length === 0) return;

    outbox.forEach((pendingMsg) => {
      socket.emit('send_message', {
        ...getSenderPayload(),
        chatId: pendingMsg.chatId,
        senderId: pendingMsg.senderId,
        receiverId: pendingMsg.receiverId,
        isGroup: pendingMsg.isGroup,
        content: pendingMsg.content,
        type: pendingMsg.type || 'text',
        audioUrl: pendingMsg.audioUrl,
        mediaUrl: pendingMsg.mediaUrl,
        pollData: pendingMsg.pollData,
        replyTo: pendingMsg.replyTo,
        clientTempId: pendingMsg.clientTempId || pendingMsg.id
      });

      // Optimistically update message status to 'sent'
      updateCachedMessageStatus(pendingMsg.chatId, pendingMsg.id, 'sent');
      setMessages(prev => prev.map(m => (m.id === pendingMsg.id || m.clientTempId === pendingMsg.id) ? { ...m, status: 'sent' } : m));
      removeFromOutbox(user.id, pendingMsg.id);
      if (pendingMsg.clientTempId) {
        removeFromOutbox(user.id, pendingMsg.clientTempId);
      }
    });
  }, [user?.id, socket]);

  useEffect(() => {
    const unsub = subscribeToNetworkChanges((online) => {
      setIsNetConnected(online);
      if (online) {
        syncOutbox();
      }
    });
    return unsub;
  }, [syncOutbox]);

  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        setIsNetConnected(true);
        syncOutbox();
      };
      socket.on('connect', handleConnect);
      if (socket.connected) {
        syncOutbox();
      }
      return () => socket.off('connect', handleConnect);
    }
  }, [socket, syncOutbox]);

  // Close 3-dots more menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.chat-header-more-container')) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [showMoreMenu]);

  // Load message history & group details
  useEffect(() => {
    // Chat badle toh reply aur initial scroll flag reset karo
    isInitialLoad.current = true;
    setReplyTo(null);
    setChatSetting({ disappearingEnabled: false });
    setBlockStatus({ isBlockedByMe: false, isBlockedByThem: false });

    if (activeChat) {
      // 1. Instantly display cached messages from local storage
      const cached = getCachedMessages(chatId);
      const outbox = getOutbox(user?.id);
      const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
      const cachedIds = new Set(cached.map(m => m.id));
      const combinedInitial = [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))];
      setMessages(combinedInitial);

      // Cache this contact/group into allUsers for future offline searches
      if (user?.id && !activeChat.isGroup) {
        mergeIntoAllUsersCache(user.id, [{ ...activeChat, avatar: chatAvatar || activeChat.avatar }]);
      }

      // 2. Fetch fresh messages if online (fast 50 latest limit)
      fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setHasMoreOlderMessages(data.length >= 50);
            const currentOutbox = getOutbox(user?.id);
            const pendingForChat = currentOutbox.filter(m => m.chatId === chatId);
            const serverIds = new Set(data.map(m => m.id));
            const activePending = pendingForChat.filter(p => !serverIds.has(p.id) && !serverIds.has(p.clientTempId));
            const merged = [...data, ...activePending];
            setMessages(merged);
            setCachedMessages(chatId, merged);
          }
        })
        .catch(() => {
          // Offline: messages already loaded from cache!
        });

      // Fetch disappearing messages setting
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data?.disappearingEnabled !== undefined) setChatSetting(data);
        })
        .catch(() => {});

      // Fetch block status (only for 1-to-1 chats)
      if (!isGroup) {
        fetch(`${BACKEND_URL}/api/users/${activeChat.id}/block-status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data) setBlockStatus(data);
          })
          .catch(() => {});
      }

      if (isGroup) {
        fetch(`${BACKEND_URL}/api/groups/${activeChat.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.memberUsers) {
              const map = {};
              data.memberUsers.forEach(u => {
                map[u.id] = u;
              });
              setGroupMembersMap(map);
            }
          });
      }

      // Zero out unread count immediately in cache and notify other components (0ms)
      if (user?.id && activeChat?.id) {
        clearUnreadCount(user.id, activeChat.id);
        if (chatId) clearUnreadCount(user.id, chatId);
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      }

      // Explicitly mark read via REST endpoint to guarantee DB update
      if (token && chatId) {
        fetch(`${BACKEND_URL}/api/messages/${chatId}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }

      if (socket) {
        socket.emit('join_chat', chatId);
        socket.emit('mark_chat_read', { chatId, userId: user.id });
      }
    }
  }, [activeChat, chatId, isGroup, token, socket, user.id]);

  // Re-join chat room immediately when socket reconnects
  useEffect(() => {
    const handleRejoin = () => {
      if (socket && chatId) {
        socket.emit('join_chat', chatId);
      }
    };
    window.addEventListener('pulsechat_socket_reconnected', handleRejoin);
    if (socket) socket.on('connect', handleRejoin);
    return () => {
      window.removeEventListener('pulsechat_socket_reconnected', handleRejoin);
      if (socket) socket.off('connect', handleRejoin);
    };
  }, [socket, chatId]);

  // Fail-safe real-time message listener from lastNotification
  useEffect(() => {
    if (lastNotification && lastNotification.chatId === chatId) {
      setMessages(prev => {
        if (prev.some(m => m.id === lastNotification.id || (m.clientTempId && m.clientTempId === lastNotification.clientTempId))) {
          return prev;
        }
        const updated = [...prev, lastNotification];
        setCachedMessages(chatId, updated);
        return updated;
      });
      if (lastNotification.senderId !== user.id) {
        playSound('received');
        socket?.emit('mark_read', { messageId: lastNotification.id, chatId });
      }
    }
  }, [lastNotification, chatId, user.id, socket]);

  // Fetch Friendship status for 1-to-1 chats
  useEffect(() => {
    if (isGroup) {
      setFriendshipStatus('friends');
      return;
    }
    // Existing conversation history allows instant chatting (0ms)
    const hasHistory = (activeChat?.lastMessage !== undefined && activeChat?.lastMessage !== null) ||
      activeChat?.hasHistory ||
      activeChat?.isFriend ||
      messages.length > 0 ||
      isCachedFriend(user?.id, activeChat?.id);

    if (hasHistory) {
      setFriendshipStatus('friends');
      return;
    }

    let isMounted = true;
    if (token && activeChat?.id) {
      fetch(`${BACKEND_URL}/api/friends/status/${activeChat.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          if (data?.status) {
            setFriendshipStatus(data.status);
            if (data.requestId) setFriendRequestId(data.requestId);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [activeChat?.id, activeChat?.lastMessage, activeChat?.hasHistory, activeChat?.isFriend, isGroup, token, messages.length, user?.id]);

  // Real-time friendship socket events
  useEffect(() => {
    if (!socket || isGroup) return;

    const handleReqAccepted = (data) => {
      if (data?.friend?.id === activeChat?.id || data?.friendId === activeChat?.id) {
        setFriendshipStatus('friends');
      }
    };

    const handleReqReceived = (data) => {
      const sId = data?.senderId || data?.request?.senderId;
      if (sId === activeChat?.id) {
        setFriendshipStatus('pending_received');
        const rId = data?.requestId || data?.id || data?.request?.id;
        if (rId) setFriendRequestId(rId);
      }
    };

    const handleReqCancelled = (data) => {
      if (data?.userId === activeChat?.id || data?.requestId === friendRequestId) {
        setFriendshipStatus('none');
      }
    };

    const handleReqRejected = (data) => {
      if (data?.userId === activeChat?.id || data?.requestId === friendRequestId) {
        setFriendshipStatus('none');
      }
    };

    const handleFriendRemoved = (data) => {
      if (data?.userId === activeChat?.id || data?.targetId === activeChat?.id) {
        setFriendshipStatus('none');
      }
    };

    socket.on('friend_request_accepted', handleReqAccepted);
    socket.on('friend_request_received', handleReqReceived);
    socket.on('friend_request_cancelled', handleReqCancelled);
    socket.on('friend_request_rejected', handleReqRejected);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('friend_request_accepted', handleReqAccepted);
      socket.off('friend_request_received', handleReqReceived);
      socket.off('friend_request_cancelled', handleReqCancelled);
      socket.off('friend_request_rejected', handleReqRejected);
      socket.off('friend_removed', handleFriendRemoved);
    };
  }, [socket, activeChat?.id, isGroup, friendRequestId]);

  const handleSendFriendRequest = async () => {
    if (!token || !activeChat?.id) return;
    try {
      setFriendshipStatus('pending_sent');
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${activeChat.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'accepted') {
        setFriendshipStatus('friends');
      } else if (data?.request?.id) {
        setFriendRequestId(data.request.id);
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!token || !friendRequestId) return;
    setFriendshipStatus('friends'); // 0ms Optimistic update
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/accept/${friendRequestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setFriendshipStatus('pending_received');
      }
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      setFriendshipStatus('pending_received');
    }
  };

  // Listen to incoming messages & poll/deletion updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isThisChat = Boolean(
        msg && (
          msg.chatId === chatId ||
          (!isGroup && (
            (msg.senderId === activeChat?.id && (msg.receiverId === user?.id || !msg.receiverId)) ||
            (msg.senderId === user?.id && msg.receiverId === activeChat?.id) ||
            (activeChat?._id && (msg.senderId === activeChat._id || msg.receiverId === activeChat._id)) ||
            (activeChat?.username && (msg.senderName === activeChat.username || msg.senderUsername === activeChat.username))
          )) ||
          (isGroup && activeChat?.id && (msg.chatId === activeChat.id || msg.chatId === activeChat._id))
        )
      );

      if (isThisChat) {
        setMessages(prev => {
          const matchIdx = prev.findIndex(m =>
            (msg.clientTempId && (m.id === msg.clientTempId || m.clientTempId === msg.clientTempId)) ||
            m.id === msg.id
          );
          let updated;
          if (matchIdx !== -1) {
            updated = [...prev];
            updated[matchIdx] = msg;
          } else {
            updated = [...prev, msg];
          }
          setCachedMessages(chatId, updated);
          return updated;
        });

        if (msg.clientTempId) {
          removeFromOutbox(user?.id, msg.clientTempId);
        }

        updateRecentChatSnippet(user?.id, chatId, msg, activeChat);
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

        if (msg.senderId !== user.id) {
          playSound('received');
          socket.emit('mark_read', { messageId: msg.id, chatId });
        }
      }
    };

    const handlePollUpdate = ({ messageId, pollData }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pollData } : m));
    };

    const handlePollEdit = ({ messageId, pollData }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pollData } : m));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
    };

    const handleReadUpdate = ({ messageId, status }) => {
      setMessages(prev => {
        const next = prev.map(m => m.id === messageId ? { ...m, status: 'read' } : m);
        setCachedMessages(chatId, next);
        return next;
      });
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    const handleMessageRestored = ({ restoredMsg }) => {
      setMessages(prev => prev.map(m => m.id === restoredMsg.id ? restoredMsg : m));
    };

    const handleChatCleared = ({ chatId: targetChatId }) => {
      if (targetChatId === chatId) setMessages([]);
    };

    const handleChatRestored = ({ chatId: targetChatId, messages: restoredMsgs }) => {
      if (targetChatId === chatId && Array.isArray(restoredMsgs)) {
        setMessages(restoredMsgs);
      }
    };

    const handleMultipleDeleted = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId) {
        setMessages(prev => prev.map(m => targetIds.includes(m.id) ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
      }
    };

    const handleMultipleRestored = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId) {
        fetch(`${BACKEND_URL}/api/messages/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setMessages(data);
          });
      }
    };

    const handleChatReadUpdate = ({ chatId: targetChatId, userId }) => {
      if (targetChatId === chatId && userId !== user.id) {
        setMessages(prev => {
          const next = prev.map(m => m.senderId === user.id ? { ...m, status: 'read' } : m);
          setCachedMessages(chatId, next);
          return next;
        });
      }
    };

    const handleMessageDeliveredUpdate = ({ messageId, status }) => {
      setMessages(prev => {
        const next = prev.map(m => m.id === messageId ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) } : m);
        setCachedMessages(chatId, next);
        return next;
      });
    };

    const handleMessagesDelivered = ({ messageIds, status }) => {
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const idSet = new Set(messageIds);
        setMessages(prev => {
          const next = prev.map(m => idSet.has(m.id) ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) } : m);
          setCachedMessages(chatId, next);
          return next;
        });
      }
    };

    const handleChatSettingUpdated = (setting) => {
      if (setting && setting.chatId === chatId) {
        setChatSetting(setting);
      }
    };

    const handleMessageBlocked = ({ reason }) => {
      alert(reason || 'Message blocked: Communication not allowed.');
    };

    socket.on('new_message', handleNewMessage);
    socket.on('poll_updated', handlePollUpdate);
    socket.on('poll_edited', handlePollEdit);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_read_update', handleReadUpdate);
    socket.on('chat_read_update', handleChatReadUpdate);
    socket.on('message_delivered_update', handleMessageDeliveredUpdate);
    socket.on('messages_delivered', handleMessagesDelivered);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_restored', handleMessageRestored);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_restored', handleChatRestored);
    const handleGroupUpdated = (data) => {
      if (!data) return;
      if (isGroup && (data.id === activeChat?.id || data._id === activeChat?.id)) {
        if (data.name) {
          activeChat.displayName = data.name;
          activeChat.name = data.name;
        }
        if (data.avatar) {
          activeChat.avatar = data.avatar;
          setChatAvatar(data.avatar);
        }
      }
    };

    socket.on('multiple_messages_deleted', handleMultipleDeleted);
    socket.on('multiple_messages_restored', handleMultipleRestored);
    socket.on('chat_setting_updated', handleChatSettingUpdated);
    socket.on('message_blocked', handleMessageBlocked);
    socket.on('group_updated', handleGroupUpdated);

    const handleGroupWindowEvent = (e) => {
      if (e.detail?.groupId && e.detail?.updates) {
        if (isGroup && (activeChat?.id === e.detail.groupId || activeChat?._id === e.detail.groupId)) {
          if (e.detail.updates.name) {
            activeChat.displayName = e.detail.updates.name;
            activeChat.name = e.detail.updates.name;
          }
          if (e.detail.updates.avatar) {
            activeChat.avatar = e.detail.updates.avatar;
            setChatAvatar(e.detail.updates.avatar);
          }
        }
      }
    };
    window.addEventListener('pulsechat_group_updated', handleGroupWindowEvent);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('poll_updated', handlePollUpdate);
      socket.off('poll_edited', handlePollEdit);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_read_update', handleReadUpdate);
      socket.off('chat_read_update', handleChatReadUpdate);
      socket.off('message_delivered_update', handleMessageDeliveredUpdate);
      socket.off('messages_delivered', handleMessagesDelivered);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_restored', handleMessageRestored);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_restored', handleChatRestored);
      socket.off('multiple_messages_deleted', handleMultipleDeleted);
      socket.off('multiple_messages_restored', handleMultipleRestored);
      socket.off('chat_setting_updated', handleChatSettingUpdated);
      socket.off('message_blocked', handleMessageBlocked);
      socket.off('group_updated', handleGroupUpdated);
      window.removeEventListener('pulsechat_group_updated', handleGroupWindowEvent);
    };
  }, [socket, chatId, user.id, token, isGroup, activeChat]);

  const [undoMessageId, setUndoMessageId] = useState(null);

  const handleUndoDelete = () => {
    if (undoMessageId && socket) {
      socket.emit('restore_message', { messageId: undoMessageId, chatId });
      setUndoMessageId(null);
    }
  };

  const handleTriggerUndoToast = (msgId) => {
    setUndoMessageId(msgId);
    setTimeout(() => {
      setUndoMessageId(prev => (prev === msgId ? null : prev));
    }, 6000);
  };

  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      // Pehli baar load ho toh instantly last message pe jaao
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      isInitialLoad.current = false;
    } else {
      // Naya message aaye toh smoothly scroll karo
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clear Chat Undo Timer
  useEffect(() => {
    let timer;
    if (clearedUndoSecs > 0) {
      timer = setInterval(() => {
        setClearedUndoSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [clearedUndoSecs]);

  // Multi-Delete Undo Timer
  useEffect(() => {
    let timer;
    if (multiDeleteUndoSecs > 0) {
      timer = setInterval(() => {
        setMultiDeleteUndoSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [multiDeleteUndoSecs]);

  // Clear Entire Current Chat
  const handleClearCurrentChat = () => {
    if (!messages || messages.length === 0) return;
    if (!window.confirm(`Clear all messages in "${activeChat.displayName}"?`)) return;

    const backup = [...messages];
    setClearedBackup(backup);
    setClearedUndoSecs(8);

    if (socket) {
      socket.emit('clear_chat', { chatId });
    }
    setMessages([]);
  };

  const handleUndoClearChat = () => {
    if (clearedBackup.length > 0 && socket) {
      socket.emit('restore_chat_messages', { chatId, messages: clearedBackup });
      setMessages(clearedBackup);
      setClearedBackup([]);
      setClearedUndoSecs(0);
    }
  };

  // Multi-Select Message Operations
  const handleToggleSelectMsg = (msgId) => {
    setSelectedMsgIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const handleDeleteSelectedMessages = () => {
    if (selectedMsgIds.length === 0) return;

    const idsToDelete = [...selectedMsgIds];
    setMultiDeleteBackupIds(idsToDelete);
    setMultiDeleteUndoSecs(8);

    if (socket) {
      socket.emit('delete_multiple_messages', { messageIds: idsToDelete, chatId });
    }
    setMessages(prev => prev.map(m => idsToDelete.includes(m.id) ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
    setSelectedMsgIds([]);
    setIsMultiSelectMode(false);
  };

  const handleUndoMultiDelete = () => {
    if (multiDeleteBackupIds.length > 0 && socket) {
      socket.emit('restore_multiple_messages', { messageIds: multiDeleteBackupIds, chatId });
      setMultiDeleteBackupIds([]);
      setMultiDeleteUndoSecs(0);
    }
  };

  const handleLoadOlderMessages = async () => {
    if (isLoadingOlder || messages.length === 0 || !token) return;
    const oldestMsg = messages.find(m => m.timestamp && !m.id?.startsWith('temp_'));
    if (!oldestMsg || !oldestMsg.timestamp) return;

    setIsLoadingOlder(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=50&before=${encodeURIComponent(oldestMsg.timestamp)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length < 50) {
          setHasMoreOlderMessages(false);
        } else {
          setHasMoreOlderMessages(true);
        }
        if (data.length > 0) {
          setMessages(prev => {
            const currentIds = new Set(prev.map(m => m.id));
            const newOldMsgs = data.filter(m => !currentIds.has(m.id));
            const merged = [...newOldMsgs, ...prev];
            setCachedMessages(chatId, merged);
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const dispatchMessage = (msgContent) => {
    if (!msgContent) return;

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const isOnlineNow = isDeviceOnline() && socket?.connected;

    const pendingMsg = {
      id: tempId,
      clientTempId: tempId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: msgContent,
      type: 'text',
      status: isOnlineNow ? 'sent' : 'pending',
      timestamp: new Date().toISOString(),
      reactions: {},
      viewedBy: [],
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        type: replyTo.type,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName || replyTo.senderId
      } : null
    };

    // 1. Optimistic UI update: message appears instantly in chat!
    setMessages(prev => [...prev, pendingMsg]);
    appendCachedMessage(chatId, pendingMsg);

    // 2. Update recent chats snippet in localStorage & dispatch event for sidebar
    // Pass activeChat so newly opened contacts (offline) get added to recentChats
    updateRecentChatSnippet(user.id, chatId, pendingMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

    // 3. If offline or socket disconnected, save to outbox
    if (!isOnlineNow) {
      addToOutbox(user.id, pendingMsg);
      setReplyTo(null);
      playSound('sent');
      return;
    }

    // 4. Online: emit over socket
    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: msgContent,
      type: 'text',
      clientTempId: tempId,
      replyTo: pendingMsg.replyTo
    });

    setReplyTo(null); // Reply clear karo bhejne ke baad
    playSound('sent');
  };

  const handleSend3DText = (textContent, styleType) => {
    if (!textContent || !textContent.trim()) return;

    const trimmed = textContent.trim();
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const isOnlineNow = isDeviceOnline() && socket?.connected;

    // Optimistically update trial flag and sparks in user state
    if (!user?.hasUsed3DTrial) {
      if (typeof updateUserProfile === 'function') {
        updateUserProfile({ ...user, hasUsed3DTrial: true });
      }
    } else {
      const currentSparks = user?.pulseSparks ?? 0;
      if (typeof updateUserProfile === 'function') {
        updateUserProfile({ ...user, pulseSparks: Math.max(0, currentSparks - 10) });
      }
    }

    const pendingMsg = {
      id: tempId,
      clientTempId: tempId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: trimmed,
      type: '3d_text',
      textStyle: styleType || 'cyber-neon',
      status: isOnlineNow ? 'sent' : 'pending',
      timestamp: new Date().toISOString(),
      reactions: {},
      viewedBy: [],
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        type: replyTo.type,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName || replyTo.senderId
      } : null
    };

    setMessages(prev => [...prev, pendingMsg]);
    appendCachedMessage(chatId, pendingMsg);

    updateRecentChatSnippet(user.id, chatId, pendingMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

    if (!isOnlineNow) {
      addToOutbox(user.id, pendingMsg);
      setReplyTo(null);
      playSound('sent');
      return;
    }

    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      content: trimmed,
      type: '3d_text',
      textStyle: styleType || 'cyber-neon',
      clientTempId: tempId,
      replyTo: pendingMsg.replyTo
    });

    setReplyTo(null);
    playSound('sent');
  };

  const handleSendText = (e, forceInstant = false) => {
    e?.preventDefault();
    if (!text.trim()) return;

    // Check emotional trigger words for 3s cooldown using sentiment utility
    if (isEmotionalTriggerMessage(text) && !forceInstant) {
      setCooldownMsg(text);
      setCooldownSecs(3);
      setText('');
      socket.emit('typing_stop', { chatId, userId: user.id });
      return;
    }

    dispatchMessage(text);
    setText('');
    socket.emit('typing_stop', { chatId, userId: user.id });
  };

  // Emotional Message Countdown Timer (3s -> auto send)
  useEffect(() => {
    let timer;
    if (cooldownSecs > 0) {
      timer = setInterval(() => {
        setCooldownSecs(prev => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSecs]);

  // When cooldown reaches 0, auto-send message so it doesn't get stuck!
  useEffect(() => {
    if (cooldownSecs === 0 && cooldownMsg) {
      dispatchMessage(cooldownMsg);
      setCooldownMsg(null);
    }
  }, [cooldownSecs, cooldownMsg]);

  const sendCooldownNow = () => {
    if (cooldownMsg) {
      dispatchMessage(cooldownMsg);
      setCooldownMsg(null);
      setCooldownSecs(0);
    }
  };

  const cancelCooldown = () => {
    // Cancel karne par text wapas input box mein daal do taaki edit kar sake
    if (cooldownMsg) {
      setText(cooldownMsg);
    }
    setCooldownSecs(0);
    setCooldownMsg(null);
  };

  const handleSendVoice = (audioUrl) => {
    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      audioUrl,
      type: 'voice'
    });
    playSound('sent');
    setShowRecorder(false);
  };

  const handleCreatePoll = (pollData) => {
    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      type: 'poll',
      pollData
    });
    playSound('sent');
  };

  const handleSendDrawing = (mediaUrl) => {
    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl,
      type: 'image',
      content: '🎨 Whiteboard Drawing',
      fileName: `pulsechat_drawing_${Date.now()}.png`
    });
    playSound('sent');
    setShowWhiteboard(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Dynamic File Limit: 25MB Free vs 500MB Pro
    const isPro = Boolean(user?.isPro);
    const maxLimitBytes = isPro ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxLimitBytes) {
      if (!isPro) {
        setProModalTab('pro');
        setShowProModal(true);
      } else {
        alert('File size exceeds the 500MB Pulse Pro limit.');
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const isDoc = !file.type.startsWith('image/') && !file.type.startsWith('video/');
      setPendingMedia({
        type: isDoc ? 'document' : file.type,
        dataUrl: event.target.result,
        fileName: file.name,
        fileSize: (file.size / 1024 < 1024)
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMedia = ({ mediaUrl, type, isViewOnce, fileName, fileSize }) => {
    const msgType = type === 'document'
      ? 'document'
      : (type?.startsWith('video/') ? 'video' : 'image');

    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl,
      type: msgType,
      isViewOnce: msgType === 'document' ? false : isViewOnce,
      fileName: fileName || null,
      fileSize: fileSize || null,
      replyTo
    });
    playSound('sent');
    setPendingMedia(null);
    setReplyTo(null);
  };

  const handleDeleteLocalMessage = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (socket) {
      socket.emit('typing_start', { chatId, userId: user.id, username: user.username });
      setTimeout(() => {
        socket.emit('typing_stop', { chatId, userId: user.id });
      }, 2000);
    }
  };

  // Calculate Mood Timeline using sentence + word sentiment from utility
  const moodTimeline = calculateConversationMoodTimeline(messages, cooldownMsg);
  const moodInfo = moodTimeline.currentMood;
  const moodSteps = moodTimeline.timelineSteps;

  // AI Smart Suggested Replies
  const smartReplies = ["Sounds great! 👍", "I'll check and reply soon.", "Let's call! 📞", "Thanks! 🔥"];

  // WhatsApp-style message date grouping helpers
  const formatMessageDateHeader = (timestamp) => {
    if (!timestamp) return 'Today';
    const msgDate = new Date(timestamp);
    if (isNaN(msgDate.getTime())) return 'Today';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const isCurrentYear = msgDate.getFullYear() === today.getFullYear();
    return msgDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: isCurrentYear ? undefined : 'numeric'
    });
  };

  const isDifferentDay = (ts1, ts2) => {
    if (!ts1 || !ts2) return true;
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;
    return d1.toDateString() !== d2.toDateString();
  };

  return (
    <div
      className="chat-window-container"
      data-chat-theme={chatTheme !== 'default' ? chatTheme : undefined}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-chat)', overflow: 'hidden', position: 'relative' }}
    >
      <ChatLiveWallpaper wallpaperId={chatWallpaper} customImage={customWallpaper} />

      {/* Header Bar */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: (chatWallpaper && chatWallpaper !== 'none') ? 'rgba(11, 15, 25, 0.78)' : 'var(--bg-sidebar)',
        backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        zIndex: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
            {onBack && (
              <button
                className="chat-back-btn icon-btn-ghost"
                onClick={() => {
                  if (user?.id && activeChat?.id) {
                    clearUnreadCount(user.id, activeChat.id);
                    if (chatId) clearUnreadCount(user.id, chatId);
                    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
                  }
                  if (onBack) onBack();
                }}
                title="Back to Home / Chats"
              >
                <ArrowLeft size={22} />
              </button>
            )}

            <div
              className={!isGroup && chatIsPro ? 'pro-neon-avatar' : ''}
              style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
            >
              <img
                src={chatAvatar || activeChat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.username || 'pulse'}`}
                alt="Avatar"
                onClick={() => isGroup ? setShowGroupProfileModal(true) : (onOpenFullDp && onOpenFullDp(chatAvatar || activeChat.avatar, chatDisplayName || activeChat.displayName, activeChat.username))}
                onError={(e) => {
                  e.target.src = isGroup
                    ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(chatDisplayName || activeChat.name || 'Group')}`
                    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeChat.username || chatDisplayName || 'User')}`;
                }}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: isGroup ? '12px' : '50%',
                  cursor: 'pointer',
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: (!isGroup && chatIsPro) ? 'none' : 'none'
                }}
                title={isGroup ? 'Click for group details & members' : 'Click to view full screen DP'}
              />
            </div>

            <div
              className="chat-header-title-box"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true)}
              style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
              title={isGroup ? 'Click to view group bio, members & edit info' : 'Click to view profile & bio'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {chatDisplayName || activeChat.displayName}
                </h3>
                {!isGroup && chatIsPro && (
                  <PulseVipBadge size={16} showLabel={false} />
                )}
                {isGroup && <span className="group-pill-badge"><Users size={12} /> Group</span>}
                {chatSetting?.disappearingEnabled && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.7rem',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                    title="24h Disappearing Messages are ON"
                  >
                    <Clock size={11} /> 24h
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: isTyping ? 'var(--accent)' : 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isGroup
                  ? `${activeChat.members?.length || 0} members • Click for info`
                  : isTyping
                    ? 'typing...'
                    : isOnline
                      ? 'Online'
                      : 'Offline • Click for Bio'}
              </p>
            </div>
          </div>

          <div className="chat-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {/* Pulse Aura Background Soundscape Selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAuraMenu(!showAuraMenu)}
                className="icon-btn-ghost"
                title="Pulse Aura: Synchronized Ambient Soundscapes"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: activeAura !== 'off' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                  border: activeAura !== 'off' ? '1px solid #f59e0b' : 'none'
                }}
              >
                <Music size={19} color={activeAura !== 'off' ? '#f59e0b' : 'var(--accent)'} />
              </button>

              {showAuraMenu && (
                <div style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  zIndex: 100,
                  width: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                    🎵 Pulse Aura Soundscapes
                  </div>
                  {[
                    { id: 'off', name: '🔇 Mute Aura Sound' },
                    { id: 'rain', name: '🌧️ Cyberpunk Rain' },
                    { id: 'lofi', name: '🎧 Lofi Chill Beats' },
                    { id: 'waves', name: '🌊 Sunset Ocean Waves' },
                    { id: 'nebula', name: '🌌 Space Nebula Synth' }
                  ].map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAura(a.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: activeAura === a.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: activeAura === a.id ? 'var(--accent)' : 'var(--text-main)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: activeAura === a.id ? 700 : 500,
                        textAlign: 'left'
                      }}
                    >
                      <span>{a.name}</span>
                      {activeAura === a.id && <Check size={14} />}
                    </button>
                  ))}

                  {/* Volume Adjustment Control Slider */}
                  <div style={{
                    padding: '8px 10px',
                    borderTop: '1px solid var(--border)',
                    marginTop: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Volume2 size={14} color="var(--accent)" /> Aura Volume
                      </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Math.round(auraVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={auraVolume}
                      onChange={(e) => {
                        const newVol = parseFloat(e.target.value);
                        setAuraVolume(newVol);
                        localStorage.setItem('pulsechat_aura_volume', String(newVol));
                        setPulseAuraVolume(newVol);
                      }}
                      style={{
                        width: '100%',
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                        height: '4px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drawboard (Shared Whiteboard) */}
            <button
              onClick={() => setShowWhiteboard(true)}
              className="icon-btn-ghost"
              title="Shared Whiteboard Drawing Board"
              style={{ width: '38px', height: '38px', borderRadius: '50%' }}
            >
              <Presentation size={19} color="var(--accent)" />
            </button>

            {/* 3-Dots More Options Menu */}
            <div className="chat-header-more-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMoreMenu(prev => !prev)}
                className="icon-btn-ghost"
                title="More Options"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: showMoreMenu ? 'var(--hover-bg)' : 'transparent' }}
              >
                <MoreVertical size={20} />
              </button>

              {showMoreMenu && (
                <div className="chat-header-dropdown-menu">
                  {/* Voice & Video Calls moved inside 3-dots menu */}
                  <button onClick={() => { setShowMoreMenu(false); isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall(false); }}>
                    <Phone size={16} color="var(--accent)" />
                    <span>{isGroup ? 'Group Voice Call' : 'Voice Call'}</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall(true); }}>
                    <Video size={16} color="var(--accent)" />
                    <span>{isGroup ? 'Group Video Call' : 'Video Call'}</span>
                  </button>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                  <button onClick={() => { setShowMoreMenu(false); setShowThemeModal(true); }}>
                    <ImageIcon size={16} color="var(--accent)" />
                    <span>Change Wallpaper</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); setShowSolidThemeModal(true); }}>
                    <Palette size={16} color="var(--accent)" />
                    <span>Change Solid Theme</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); setShowWhiteboard(true); }}>
                    <Presentation size={16} color="var(--accent)" />
                    <span>Whiteboard Drawing Board</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); setIsMultiSelectMode(true); setSelectedMsgIds([]); }}>
                    <CheckSquare size={16} color="var(--accent)" />
                    <span>Select Messages</span>
                  </button>
                  <button onClick={() => {
                    setShowMoreMenu(false);
                    if (isGroup) {
                      setShowGroupProfileModal(true);
                    } else {
                      setShowUserProfileModal(true);
                    }
                  }}>
                    <Clock size={16} color="var(--accent)" />
                    <span>Disappearing Messages {chatSetting?.disappearingEnabled ? '(On)' : '(Off)'}</span>
                  </button>
                  {!isGroup && (
                    <button
                      onClick={async () => {
                        setShowMoreMenu(false);
                        const willBlock = !blockStatus.isBlockedByMe;
                        const confirmMsg = willBlock
                          ? `Are you sure you want to block ${activeChat.displayName}? You will no longer receive their messages or calls.`
                          : `Unblock ${activeChat.displayName}?`;
                        if (window.confirm(confirmMsg)) {
                          if (willBlock) {
                            await blockUser(activeChat.id);
                            setBlockStatus(prev => ({ ...prev, isBlockedByMe: true }));
                          } else {
                            await unblockUser(activeChat.id);
                            setBlockStatus(prev => ({ ...prev, isBlockedByMe: false }));
                          }
                        }
                      }}
                      style={{ color: blockStatus.isBlockedByMe ? 'var(--accent)' : '#ef4444' }}
                    >
                      <Ban size={16} color={blockStatus.isBlockedByMe ? 'var(--accent)' : '#ef4444'} />
                      <span>{blockStatus.isBlockedByMe ? 'Unblock Contact' : 'Block Contact'}</span>
                    </button>
                  )}
                  <button onClick={() => { setShowMoreMenu(false); handleClearCurrentChat(); }} style={{ color: '#ef4444' }}>
                    <Trash2 size={16} color="#ef4444" />
                    <span>Clear Chat</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true); }}>
                    <Info size={16} color="var(--text-muted)" />
                    <span>{isGroup ? 'Group Info' : 'Contact Info'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Mood Timeline Strip — sentence-level progression */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <span style={{ flexShrink: 0 }}>Mood:</span>
          {moodSteps.length > 0 ? (
            <>
              {moodSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <span
                    style={{
                      color: step.color,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      background: step.bg,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      border: `1px solid ${step.border}`,
                      whiteSpace: 'nowrap',
                      fontSize: '0.68rem',
                      opacity: step.isPending ? 0.6 : 1
                    }}
                    title={step.preview}
                  >
                    {step.emoji} {step.mood}
                  </span>
                  {idx < moodSteps.length - 1 && (
                    <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: '0.6rem' }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            <span style={{ color: moodInfo.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {moodInfo.emoji} {moodInfo.mood}
            </span>
          )}
          <div style={{ flex: 1, height: '2px', borderRadius: '2px', background: moodInfo.color, opacity: 0.4 }} />
        </div>
      </div>

      {/* WhatsApp-Style Offline Indicator */}
      {!isNetConnected && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.16)',
          borderBottom: '1px solid rgba(234, 179, 8, 0.35)',
          color: '#eab308',
          padding: '5px 14px',
          fontSize: '0.78rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <WifiOff size={13} style={{ flexShrink: 0 }} />
          <span>Waiting for network · Messages will send automatically when online</span>
        </div>
      )}

        {/* Multi-Select Messages Action Bar */}
        {isMultiSelectMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(99, 102, 241, 0.15)', borderTop: '1px solid var(--accent)', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              Select Messages ({selectedMsgIds.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => { setIsMultiSelectMode(false); setSelectedMsgIds([]); }}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleDeleteSelectedMessages}
                disabled={selectedMsgIds.length === 0}
                style={{ padding: '4px 12px', fontSize: '0.78rem', background: selectedMsgIds.length > 0 ? '#ef4444' : 'var(--bg-card)' }}
              >
                Delete Selected ({selectedMsgIds.length})
              </button>
            </div>
          </div>
        )}

      {/* Message Stream with Live Wallpaper Overlay & WhatsApp-Style Date Dividers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
        {/* Load Earlier Messages Button (Pagination) */}
        {hasMoreOlderMessages && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px 0' }}>
            <button
              onClick={handleLoadOlderMessages}
              disabled={isLoadingOlder}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--accent)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '5px 14px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: isLoadingOlder ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {isLoadingOlder ? '⏳ Loading earlier history...' : '↑ Load older messages'}
            </button>
          </div>
        )}
        {!isGroup && friendshipStatus !== 'friends' && (
          <div className="pulse-sync-card" style={{ margin: 'auto' }}>
            <div className="pulse-orb-icon">
              <Sparkles size={28} />
            </div>
            <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 800 }}>
              ⚡ Pulse Frequency Sync
            </h4>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '340px' }}>
              Before transmitting direct messages, synchronize frequencies with <strong>{activeChat.displayName || activeChat.username}</strong>.
            </p>

            {friendshipStatus === 'none' && (
              <>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pick Your Vibe:
                </div>
                <div className="pulse-vibes-row">
                  {['⚡ Quick Pulse', '🚀 Collab & Code', '🎮 Gaming', '☕ Coffee Chat', '🎵 Music Vibe'].map((vibe) => (
                    <button
                      key={vibe}
                      type="button"
                      className={`pulse-vibe-pill ${selectedVibe === vibe ? 'active' : ''}`}
                      onClick={() => setSelectedVibe(vibe)}
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </>
            )}

            {friendshipStatus === 'pending_sent' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.86rem', fontWeight: 600, padding: '8px 16px', background: 'var(--hover-bg)', borderRadius: '20px', border: '1px solid var(--border)' }}>
                <Clock size={16} /> 📡 Frequency Beaming... (Sync Pending)
              </div>
            ) : friendshipStatus === 'pending_received' ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleAcceptFriendRequest}
                style={{ padding: '9px 24px', borderRadius: '24px', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}
              >
                <Sparkles size={17} /> ⚡ Accept & Sync Pulse
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSendFriendRequest}
                style={{ padding: '9px 24px', borderRadius: '24px', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}
              >
                <Sparkles size={17} /> ⚡ Sync Pulse ({selectedVibe})
              </button>
            )}
          </div>
        )}

        {messages.map((msg, index) => {
          const senderObj = groupMembersMap[msg.senderId];
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateHeader = index === 0 || isDifferentDay(prevMsg?.timestamp, msg.timestamp);
          const dateLabel = formatMessageDateHeader(msg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {showDateHeader && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '10px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {dateLabel}
                  </div>
                </div>
              )}
              <MessageItem
                message={msg}
                isMine={msg.senderId === user.id}
                chatId={chatId}
                senderName={senderObj?.displayName || senderObj?.username}
                senderIsPro={msg.senderId === user.id ? user?.isPro : (isGroup ? senderObj?.isPro : chatIsPro)}
                onDeleteLocal={handleDeleteLocalMessage}
                onDeleteTrigger={handleTriggerUndoToast}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedMsgIds.includes(msg.id)}
                onToggleSelect={handleToggleSelectMsg}
                onJoinGroupCall={(isVideo) => onStartGroupCall && onStartGroupCall(activeChat, isVideo)}
                onReply={(msg) => {
                  // Sender ka naam determine karo
                  const senderInfo = groupMembersMap[msg.senderId];
                  setReplyTo({
                    ...msg,
                    senderName: msg.senderId === user.id
                      ? 'You'
                      : (senderInfo?.displayName || senderInfo?.username || activeChat.displayName)
                  });
                  replyInputRef.current?.focus();
                }}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Clear Chat Undo Banner */}
      {clearedUndoSecs > 0 && (
        <div className="cooldown-banner" style={{ background: 'rgba(239, 68, 68, 0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🧹 Chat cleared for {activeChat.displayName} ({clearedUndoSecs}s)
          </span>
          <button
            onClick={handleUndoClearChat}
            style={{
              background: '#fff',
              color: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Multi-Select Delete Undo Banner */}
      {multiDeleteUndoSecs > 0 && (
        <div className="cooldown-banner" style={{ background: 'rgba(239, 68, 68, 0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🗑️ {multiDeleteBackupIds.length} messages deleted ({multiDeleteUndoSecs}s)
          </span>
          <button
            onClick={handleUndoMultiDelete}
            style={{
              background: '#fff',
              color: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Single Delete Undo Banner */}
      {undoMessageId && (
        <div className="cooldown-banner" style={{ background: 'rgba(99, 102, 241, 0.95)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: '12px', margin: '0 1rem 0.5rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
            🗑️ Message deleted
          </span>
          <button
            onClick={handleUndoDelete}
            style={{
              background: '#fff',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Cooldown Timer — elegant countdown bar (no red alert) */}
      {cooldownSecs > 0 && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: 'var(--text-main)',
          borderRadius: '12px',
          margin: '0 1rem 0.5rem 1rem',
          padding: '8px 14px',
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                ⏳ Sending in <strong style={{ color: 'var(--accent)' }}>{cooldownSecs}s</strong>...
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={sendCooldownNow}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '3px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Send Now
              </button>
              <button
                onClick={cancelCooldown}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '3px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          {/* Smooth animated countdown progress bar */}
          <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'rgba(99, 102, 241, 0.15)', overflow: 'hidden' }}>
            <div style={{
              width: `${(cooldownSecs / 3) * 100}%`,
              height: '100%',
              borderRadius: '2px',
              background: 'var(--accent)',
              transition: 'width 1s linear'
            }} />
          </div>
        </div>
      )}

      {/* AI Smart Suggested Reply Chips */}
      {(isGroup || friendshipStatus === 'friends') && !blockStatus.isBlockedByMe && !blockStatus.isBlockedByThem && (
        <div style={{ padding: '0.4rem 1rem', display: 'flex', gap: '6px', overflowX: 'auto', background: 'transparent', position: 'relative', zIndex: 2 }}>
          {smartReplies.map((replyText, i) => (
            <button
              key={i}
              onClick={() => setText(replyText)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              <Sparkles size={11} color="var(--accent)" style={{ marginRight: '4px' }} />
              {replyText}
            </button>
          ))}
        </div>
      )}

      {/* WhatsApp-Style Reply Preview Strip */}
      {replyTo && (
        <div style={{
          padding: '8px 16px',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'rgba(11, 15, 25, 0.78)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{ color: 'var(--accent)', flexShrink: 0 }}>
            <CornerUpLeft size={16} />
          </div>
          <div style={{
            flex: 1,
            background: 'rgba(0,0,0,0.15)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '8px',
            padding: '6px 10px',
            minWidth: 0
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '2px' }}>
              {replyTo.senderName || 'Someone'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.type === 'text'
                ? (replyTo.content || '')
                : replyTo.type === 'voice'
                  ? '🎤 Voice note'
                  : replyTo.type === 'image'
                    ? '🖼️ Photo'
                    : replyTo.type === 'video'
                      ? '🎥 Video'
                      : replyTo.type || 'Message'}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="icon-btn-ghost"
            title="Cancel reply"
            style={{ flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Block Banner or Input Bar */}
      {blockStatus.isBlockedByMe ? (
        <div style={{
          padding: '1.1rem',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'rgba(11, 15, 25, 0.78)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          position: 'relative',
          zIndex: 2
        }}>
          <Ban size={18} color="#ef4444" />
          <span>You have blocked this contact.</span>
          <button
            onClick={async () => {
              await unblockUser(activeChat.id);
              setBlockStatus(prev => ({ ...prev, isBlockedByMe: false }));
            }}
            className="btn-primary"
            style={{ padding: '5px 16px', fontSize: '0.82rem', borderRadius: '14px' }}
          >
            Unblock
          </button>
        </div>
      ) : blockStatus.isBlockedByThem ? (
        <div style={{
          padding: '1.1rem',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'rgba(11, 15, 25, 0.78)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
          fontSize: '0.88rem',
          position: 'relative',
          zIndex: 2
        }}>
          <ShieldAlert size={18} color="var(--text-muted)" />
          <span>You cannot reply to this conversation.</span>
        </div>
      ) : (!isGroup && friendshipStatus !== 'friends') ? null : (
        <div style={{
          padding: '0.75rem 1rem',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'rgba(11, 15, 25, 0.78)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(12px)' : 'none',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          position: 'relative',
          zIndex: 2
        }}>
          {showEmoji && (
            <EmojiPicker onSelectEmoji={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* 4-Dot Quick Action Drawer */}
          {showActionGrid && (
            <div
              ref={actionGridRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '14px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 25px rgba(99, 102, 241, 0.2)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                zIndex: 1100,
                width: 'min(330px, 92vw)',
                animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* 1. Media & Files */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  fileInputRef.current?.click();
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
                }}>
                  <Paperclip size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Files & Media</span>
              </button>

              {/* 2. 3D Typography (VIP Pro) */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShow3DTextModal(true);
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
                }}>
                  3D
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#06b6d4' }}>3D Text</span>
              </button>

              {/* 3. Virtual Gift */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowGiftPicker(true);
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
                  fontSize: '1.25rem'
                }}>
                  🎁
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Send Gift</span>
              </button>

              {/* 4. Stealth Dust Note (Touch to Reveal Self-Destruct) */}
              <button
                type="button"
                onClick={handleSendStealthDust}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
                }}>
                  <Zap size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b' }}>Dust text</span>
              </button>

              {/* 5. Emoji Particle Burst */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  if (!user?.isPro) {
                    setShowProModal(true);
                    return;
                  }
                  setShowEmojiBurstPicker(prev => !prev);
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                }}>
                  <Flame size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ef4444' }}>Emoji Burst</span>
              </button>

              {/* 4. Create Poll */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowCreatePoll(true);
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
                }}>
                  <BarChart2 size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Create Poll</span>
              </button>

              {/* 5. Emoji & Stickers */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowEmoji(prev => !prev);
                }}
                className="action-grid-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
                }}>
                  <Smile size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>Emojis</span>
              </button>

            </div>
          )}

          {/* 3D Emoji Particle Burst Selector */}
          {showEmojiBurstPicker && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '14px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 25px rgba(239, 68, 68, 0.3)',
                zIndex: 1150,
                width: 'min(320px, 92vw)',
                animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💥 3D Floating Emoji Burst
                </span>
                <button
                  onClick={() => setShowEmojiBurstPicker(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {['🔥', '❤️', '⚡', '🎉', '🚀', '💎', '💩', '🥳', '😂', '🌟', '👑', '🦄'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleTriggerEmojiBurst(emoji)}
                    style={{
                      fontSize: '1.7rem',
                      padding: '10px 4px',
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.12s ease'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4-Dot Button Beside Typing Input Box */}
          {!showRecorder && (
            <button
              type="button"
              onClick={() => {
                setShowActionGrid(prev => !prev);
                setShowEmoji(false);
              }}
              className="icon-btn-ghost"
              title="Features & Attachments (4 Dots)"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: showActionGrid ? 'var(--accent)' : 'var(--bg-card)',
                color: showActionGrid ? '#fff' : 'var(--accent)',
                border: showActionGrid ? '1px solid var(--accent)' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                boxShadow: showActionGrid ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="7" cy="7" r="2.5" />
                <circle cx="17" cy="7" r="2.5" />
                <circle cx="7" cy="17" r="2.5" />
                <circle cx="17" cy="17" r="2.5" />
              </svg>
            </button>
          )}

          {/* Voice Note Button Beside 4-Dot Button */}
          {!showRecorder && (
            <button
              type="button"
              onClick={() => {
                setShowActionGrid(false);
                setShowRecorder(true);
              }}
              className="icon-btn-ghost"
              title="Record Voice Note"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--accent)',
                transition: 'all 0.15s ease'
              }}
            >
              <Mic size={20} />
            </button>
          )}

          {showRecorder ? (
            <VoiceRecorder onSendVoice={handleSendVoice} onCancel={() => setShowRecorder(false)} />
          ) : (
            <form onSubmit={handleSendText} style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder={isGroup ? 'Message group...' : 'Type a message...'}
                className="form-input"
                ref={replyInputRef}
                style={{ flex: 1, minWidth: 0, borderRadius: '24px', padding: '10px 16px', fontSize: '0.94rem' }}
              />
              <button
                type="submit"
                className="btn-primary-round"
                title="Send Message"
                style={{ flexShrink: 0 }}
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </div>
      )}

      {pendingMedia && (
        <MediaUploadModal
          mediaFile={pendingMedia}
          onSend={handleSendMedia}
          onClose={() => setPendingMedia(null)}
        />
      )}

      {showCreatePoll && (
        <CreatePollModal
          onClose={() => setShowCreatePoll(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}

      {showWhiteboard && (
        <WhiteboardModal
          onClose={() => setShowWhiteboard(false)}
          chatTitle={activeChat.displayName}
          chatId={chatId}
          onSendDrawing={handleSendDrawing}
        />
      )}

      {showUserProfileModal && (
        <UserProfileModal
          targetUser={{ ...activeChat, avatar: chatAvatar || activeChat.avatar, isPro: chatIsPro }}
          onClose={() => setShowUserProfileModal(false)}
          onStartCall={onStartCall}
          onOpenFullDp={onOpenFullDp}
        />
      )}

      {showGroupProfileModal && (
        <GroupProfileModal
          group={activeChat}
          onClose={() => setShowGroupProfileModal(false)}
          onGroupUpdated={(updatedGroup) => {
            if (updatedGroup) {
              if (updatedGroup.name) {
                activeChat.displayName = updatedGroup.name;
                activeChat.name = updatedGroup.name;
                setChatDisplayName(updatedGroup.name);
              }
              if (updatedGroup.avatar) {
                activeChat.avatar = updatedGroup.avatar;
                setChatAvatar(updatedGroup.avatar);
              }
              updateGroupInStorage(updatedGroup.id || activeChat.id, updatedGroup, user?.id);
            }
          }}
          onStartCall={onStartCall}
          onOpenFullDp={onOpenFullDp}
        />
      )}

      {showThemeModal && (
        <ChatThemeModal
          chatId={chatId}
          currentTheme={chatTheme}
          onSelectTheme={handleSelectChatTheme}
          currentWallpaper={chatWallpaper}
          onSelectWallpaper={handleSelectChatWallpaper}
          customWallpaper={customWallpaper}
          onSetCustomWallpaper={handleSetCustomWallpaper}
          onClose={() => setShowThemeModal(false)}
        />
      )}

      {showSolidThemeModal && (
        <SolidThemeModal
          onClose={() => setShowSolidThemeModal(false)}
          onSelectTheme={handleSelectChatTheme}
        />
      )}

      {showGiftPicker && (
        <GiftPickerModal
          chatId={chatId}
          receiverId={activeChat?.id}
          receiverName={activeChat?.displayName || activeChat?.username}
          isGroup={isGroup}
          onClose={() => setShowGiftPicker(false)}
          onOpenSparksStore={() => {
            setShowGiftPicker(false);
            setProModalTab('sparks');
            setShowProModal(true);
          }}
        />
      )}

      {showProModal && (
        <PulseProModal
          initialTab={proModalTab}
          onClose={() => setShowProModal(false)}
        />
      )}

      {show3DTextModal && (
        <Animated3DTextModal
          onClose={() => setShow3DTextModal(false)}
          onSend3D={handleSend3DText}
          onOpenProModal={(tab = 'pro') => {
            setShow3DTextModal(false);
            setProModalTab(tab);
            setShowProModal(true);
          }}
        />
      )}
    </div>
  );
}
