import React, { useState, useEffect, useLayoutEffect, useRef, useContext, useCallback, useMemo, useImperativeHandle, useDeferredValue } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Camera, Paperclip, CheckSquare, Trash2, X, Check, MoreVertical, Info, CornerUpLeft, FileText, Ban, ShieldAlert, WifiOff, Palette, UserPlus, Presentation, Music, Flame, Zap, Volume2, VolumeX, Disc, Crown, Gamepad2, Play, Pause, SkipForward, Loader2, Star, Copy, Forward, Pin, PinOff, SlidersHorizontal, Edit3, Ghost, Search, Globe, ChevronUp, ChevronDown, ArrowDown, Lock, Unlock, ChevronLeft, ChevronRight, Bell, BellOff, CloudRain } from 'lucide-react';
import MessageItem from './MessageItem';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import ChatLiveWallpaper from './ChatLiveWallpaper';
import VibeAuraRing, { resolveUserAura, getProAuraRingClass } from '../common/VibeAuraRing';
import PulseVipBadge from '../common/PulseVipBadge';
import { recordRecentReaction } from '../../utils/quickReactions';
import { uploadMediaDirect, compressImageOnDevice } from '../../utils/mediaUpload';
import { playSound, playPulseAuraSound, stopPulseAuraSound, setPulseAuraVolume, registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';
import { executeTranslation } from '../../utils/translator';
import { isEmotionalTriggerMessage, calculateConversationMoodTimeline } from '../../utils/sentiment';
import { useBackHandler } from '../../utils/backNavigation';
import { runWorkerTask } from '../../workers/pulseWorkerBridge';

// Core 4-Dot Drawer Modals imported directly to ensure 100% offline availability with ZERO chunk reload errors
import CreatePollModal from './CreatePollModal';
import MediaUploadModal from './MediaUploadModal';
import Animated3DTextModal from './Animated3DTextModal';
import ScheduleMessageModal from './ScheduleMessageModal';

import { lazyWithRetry } from '../../utils/lazyRetry';

// Code-Splitting: Lazy load heavy modals with automatic retry & reload resilience
const WhiteboardModal = lazyWithRetry(() => import('./WhiteboardModal'));
const UserProfileModal = lazyWithRetry(() => import('./UserProfileModal'));
const GroupProfileModal = lazyWithRetry(() => import('./GroupProfileModal'));
const ChatThemeModal = lazyWithRetry(() => import('./ChatThemeModal'));
const SolidThemeModal = lazyWithRetry(() => import('./SolidThemeModal'));
const PulseProModal = lazyWithRetry(() => import('./PulseProModal'));
const GiftPickerModal = lazyWithRetry(() => import('./GiftPickerModal'));
const LiveArrowGameModal = lazyWithRetry(() => import('./LiveArrowGameModal'));
const TicTacToeModal = lazyWithRetry(() => import('./TicTacToeModal'));
const PulseStreakModal = lazyWithRetry(() => import('./PulseStreakModal'));
const VibeAuraSelectorModal = lazyWithRetry(() => import('./VibeAuraSelectorModal'));
const MusicPickerModal = lazyWithRetry(() => import('../vibes/MusicPickerModal'));
const ForwardModal = lazyWithRetry(() => import('./ForwardModal'));
const MessageInfoModal = lazyWithRetry(() => import('./MessageInfoModal'));
const SetDefaultReactionsModal = lazyWithRetry(() => import('./SetDefaultReactionsModal'));
const VibeViewerModal = lazyWithRetry(() => import('../vibes/VibeViewerModal'));
const SparksWalletModal = lazyWithRetry(() => import('./SparksWalletModal'));
const ChatNicknameModal = lazyWithRetry(() => import('./ChatNicknameModal'));
const ShareableStoryCardModal = lazyWithRetry(() => import('../profile/ShareableStoryCardModal'));
const PinLockModal = lazyWithRetry(() => import('../common/PinLockModal'));
import { isChatLocked, setChatLocked, getSecurityPin, isChatMuted, setChatMuted } from '../../utils/securityLock';
import SparksFeaturePromptModal from '../common/SparksFeaturePromptModal';
import {
  getCachedMessages,
  getCachedMessagesFromLocalDb,
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
  getCachedFriends,
  setCachedFriends,
  isDeviceOnline,
  subscribeToNetworkChanges,
  updateGroupInStorage,
  clearUnreadCount,
  removeCachedMessages,
  markCachedMessagesDeleted,
  clearCachedMessages,
  getDeletedForMeIds,
  addDeletedForMeId
} from '../../utils/offlineStorage';
import { deleteMessagesFromLocalDb, clearChatFromLocalDb } from '../../utils/localDatabase';
import { getSyncCachedAudioUrl, getOrCacheAudioBlobUrl } from '../../utils/mediaCache';

export const GLOBAL_LANGUAGES = [
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' }
];

const sanitizeFogSnapMessage = (m) => {
  if (!m || (!m.isFogSnap && !m.isDustImage)) return m;
  const isBurnedLocally = (() => {
    try {
      return (m.id && localStorage.getItem(`pulse_fog_burned_${m.id}`) === 'true') ||
             (m._id && localStorage.getItem(`pulse_fog_burned_${m._id}`) === 'true');
    } catch {
      return false;
    }
  })();
  if (m.fogSnapStatus === 'burned' || m.content === '🌫️ Fog Snap Evaporated' || m.content === 'Dust Image Evaporated' || (!m.mediaUrl && (m.isFogSnap || m.isDustImage)) || isBurnedLocally) {
    return null;
  }
  return m;
};

// Ultra-optimized, zero-latency Chat Input Capsule
// Isolates keystroke state to eliminate ChatWindow re-renders and input lag completely
const ChatInputCapsule = React.memo(React.forwardRef(function ChatInputCapsule({
  chatId,
  isGroup,
  user,
  activeChat,
  socket,
  token,
  targetLang,
  replyInputRef,
  onSendText,
  onOpenScheduleModal,
  showEmoji,
  setShowEmoji,
  setShowActionGrid,
  setShowRecorder,
  setActionToast
}, ref) {
  const [text, setText] = useState(() => {
    try {
      return (chatId ? localStorage.getItem(`pulsechat_draft_${chatId}`) : '') || '';
    } catch {
      return '';
    }
  });

  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);
  const draftSaveTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const sendBtnHoldTimerRef = useRef(null);

  // Synchronize draft on chatId change
  useEffect(() => {
    if (!chatId) return;
    try {
      const savedDraft = localStorage.getItem(`pulsechat_draft_${chatId}`) || '';
      setText(savedDraft);
    } catch {}
  }, [chatId]);

  useImperativeHandle(ref, () => ({
    setText: (newText) => {
      setText(newText);
    },
    getText: () => text,
    insertEmoji: (emoji) => {
      setText(prev => (prev || '') + emoji);
    },
    clear: () => {
      setText('');
      try {
        if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
      } catch {}
    }
  }), [text, chatId]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      try {
        if (chatId) {
          if (val) {
            localStorage.setItem(`pulsechat_draft_${chatId}`, val);
          } else {
            localStorage.removeItem(`pulsechat_draft_${chatId}`);
          }
        }
      } catch {}
    }, 300);

    if (!socket) return;
    const receiverId = isGroup ? '' : activeChat?.id;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!val.trim()) {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
      lastTypingEmitRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      lastTypingEmitRef.current = now;
      socket.emit('typing_start', {
        chatId,
        userId: user?.id,
        username: user?.displayName || user?.username || 'User',
        receiverId
      });
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
      lastTypingEmitRef.current = 0;
    }, 2500);
  };

  const handleTranslateDraft = async () => {
    if (!text || !text.trim() || isTranslatingDraft) return;
    setIsTranslatingDraft(true);
    try {
      const result = await executeTranslation(text.trim(), targetLang, token);
      if (result && result.translatedText) {
        setText(result.translatedText);
        if (setActionToast) {
          setActionToast(`Draft translated to ${targetLang.toUpperCase()} ✨`);
          setTimeout(() => setActionToast(''), 2500);
        }
      }
    } catch (err) {
      console.error('Draft translation error:', err);
    } finally {
      setIsTranslatingDraft(false);
    }
  };

  const handleSendBtnMouseDown = () => {
    sendBtnHoldTimerRef.current = setTimeout(() => {
      if (onOpenScheduleModal) {
        onOpenScheduleModal(text);
      }
    }, 520);
  };

  const handleSendBtnMouseUp = () => {
    if (sendBtnHoldTimerRef.current) {
      clearTimeout(sendBtnHoldTimerRef.current);
      sendBtnHoldTimerRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (sendBtnHoldTimerRef.current) {
      clearTimeout(sendBtnHoldTimerRef.current);
      sendBtnHoldTimerRef.current = null;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    onSendText(text);
    setText('');

    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    lastTypingEmitRef.current = 0;
    try {
      if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
    } catch {}

    if (replyInputRef?.current) {
      replyInputRef.current.focus({ preventScroll: true });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, minWidth: 0, display: 'flex', gap: '6px', alignItems: 'center' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-card, #202c33)',
          borderRadius: '26px',
          padding: '4px 8px 4px 10px',
          border: '1px solid var(--border)',
          minHeight: '44px',
          gap: '4px',
          boxSizing: 'border-box'
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowEmoji(prev => !prev);
            setShowActionGrid(false);
          }}
          className="icon-btn-ghost interactive-action"
          title="Emoji Picker"
          style={{
            background: 'transparent',
            border: 'none',
            color: showEmoji ? '#f59e0b' : 'var(--text-muted, #8696a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '50%',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease'
          }}
        >
          <Smile size={22} />
        </button>

        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          placeholder={isGroup ? 'Message group...' : 'Type a message'}
          ref={replyInputRef}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main, #ffffff)',
            fontSize: '0.94rem',
            padding: '6px 4px'
          }}
        />

        {text.trim().length > 0 && (
          <button
            type="button"
            onClick={handleTranslateDraft}
            disabled={isTranslatingDraft}
            title={`Translate draft to ${targetLang.toUpperCase()} before sending`}
            style={{
              background: 'rgba(6, 182, 212, 0.16)',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              color: '#06b6d4',
              borderRadius: '16px',
              padding: '4px 6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: isTranslatingDraft ? 'wait' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={11} />
            <span>{isTranslatingDraft ? '...' : `➔ ${targetLang.toUpperCase()}`}</span>
          </button>
        )}
      </div>

      {text.trim().length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setShowActionGrid(false);
            setShowEmoji(false);
            setShowRecorder(true);
          }}
          className="interactive-action"
          title="Record Voice Note"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--bg-card, #202c33)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted, #8696a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Mic size={20} />
        </button>
      ) : (
        <button
          type="submit"
          tabIndex={-1}
          className="interactive-action"
          title="Send Message (Hold to Schedule ⏰)"
          onMouseDown={(e) => {
            e.preventDefault();
            handleSendBtnMouseDown(e);
          }}
          onMouseUp={handleSendBtnMouseUp}
          onTouchStart={handleSendBtnMouseDown}
          onTouchEnd={() => {
            handleSendBtnMouseUp();
            replyInputRef?.current?.focus({ preventScroll: true });
          }}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: '#25d366',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37, 211, 102, 0.45)',
            transition: 'transform 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Send size={18} style={{ marginLeft: '2px' }} />
        </button>
      )}
    </form>
  );
}));

export default function ChatWindow({ activeChat, onBack, onStartCall, onStartGroupCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser, updateUserProfile } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap, lastNotification, vibeAuras } = useContext(SocketContext);

  const isGroup = !!activeChat.isGroup;
  const currentUserId = user?.id || user?._id || '';
  const activeChatId = activeChat?.id || activeChat?._id || '';
  const isAnonymousBot = activeChatId === 'anonymous_pulse_bot' || activeChat?.username === 'anonymous_pulse_bot' || !!activeChat?.isAnonymousBot;
  const chatId = isGroup ? activeChatId : [currentUserId, activeChatId].filter(Boolean).sort().join('_');
  const partnerId = activeChat?.id || activeChat?._id || activeChat?.userId || '';
  const [showStoryCardModal, setShowStoryCardModal] = useState(false);
  const isOnline = !isGroup && (
    (partnerId && onlineUsers.some(uId => String(uId) === String(partnerId))) ||
    (activeChat?.username && onlineUsers.some(uId => String(uId) === String(activeChat.username)))
  );
  const typingUser = typingMap[chatId];
  const isTyping = Boolean(typingUser && typingUser !== user?.username && typingUser !== user?.id && typingUser !== user?.displayName);
  const typingTimeoutRef = useRef(null);
  const draftSaveTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  const partnerAura = useMemo(() => {
    if (isGroup) return null;
    return resolveUserAura(activeChat, vibeAuras);
  }, [isGroup, activeChat, vibeAuras]);

  const myAura = useMemo(() => {
    return resolveUserAura(user, vibeAuras);
  }, [vibeAuras, user]);
  const [showVibeSelector, setShowVibeSelector] = useState(false);
  const [showTicTacToeModal, setShowTicTacToeModal] = useState(false);
  const [tictactoeHostId, setTictactoeHostId] = useState(null);
  const [sparksPromptConfig, setSparksPromptConfig] = useState(null);

  // Scheduled Messages (Send Later) State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledList, setScheduledList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pulsechat_scheduled_messages') || '[]');
    } catch (e) {
      return [];
    }
  });
  const sendBtnHoldTimerRef = useRef(null);

  const chatScheduledMessages = useMemo(() => {
    return scheduledList.filter(s => s.chatId === chatId);
  }, [scheduledList, chatId]);

  const handleScheduleMessage = ({ text: schedText, scheduledTimestamp }) => {
    const newEntry = {
      id: 'sched_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      chatId,
      text: schedText,
      scheduledTimestamp,
      isGroup,
      senderId: user?.id,
      receiverId: isGroup ? '' : activeChat?.id,
      createdAt: Date.now()
    };
    const nextList = [...scheduledList, newEntry];
    setScheduledList(nextList);
    localStorage.setItem('pulsechat_scheduled_messages', JSON.stringify(nextList));
    setShowScheduleModal(false);
    inputCapsuleRef.current?.clear();
    try {
      if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
    } catch {}
    setActionToast(`Message scheduled for ${new Date(scheduledTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ⏰`);
    setTimeout(() => setActionToast(''), 3000);
  };

  const handleCancelScheduledMessage = (id) => {
    const nextList = scheduledList.filter(s => s.id !== id);
    setScheduledList(nextList);
    localStorage.setItem('pulsechat_scheduled_messages', JSON.stringify(nextList));
    setActionToast('Scheduled message cancelled ❌');
    setTimeout(() => setActionToast(''), 2500);
  };

  const handleSendBtnMouseDown = () => {
    sendBtnHoldTimerRef.current = setTimeout(() => {
      setShowScheduleModal(true);
    }, 520);
  };

  const handleSendBtnMouseUp = () => {
    if (sendBtnHoldTimerRef.current) {
      clearTimeout(sendBtnHoldTimerRef.current);
      sendBtnHoldTimerRef.current = null;
    }
  };
  const checkGhostModeActive = () => {
    try {
      if (user?.hideReadReceipts || localStorage.getItem('pulsechat_ghost_global') === 'true') {
        return true;
      }
      const userGhostChats = Array.isArray(user?.ghostChats) ? user.ghostChats : [];
      let localGhostChats = [];
      const ghostChatsJson = localStorage.getItem('pulsechat_ghost_chats');
      if (ghostChatsJson) {
        try {
          const list = JSON.parse(ghostChatsJson);
          if (Array.isArray(list)) localGhostChats = list;
        } catch (_) {}
      }
      const allGhostList = Array.from(new Set([...userGhostChats, ...localGhostChats])).filter(Boolean).map(String);

      const targetIds = [
        chatId,
        activeChat?.id,
        activeChat?._id,
        activeChat?.username,
        activeChat?.userId
      ].filter(Boolean).map(String);

      if (allGhostList.some(gId => targetIds.includes(String(gId)))) {
        return true;
      }

      for (const tId of targetIds) {
        if (localStorage.getItem(`pulsechat_ghost_${tId}`) === 'true') {
          return true;
        }
      }

      if (chatId) {
        for (const gId of allGhostList) {
          if (!gId) continue;
          const gStr = String(gId);
          if (chatId === gStr || chatId.startsWith(gStr + '_') || chatId.endsWith('_' + gStr) || chatId.includes('_' + gStr + '_')) {
            return true;
          }
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  };

  const [isGhostMode, setIsGhostMode] = useState(() => checkGhostModeActive());
  const isGhostModeRef = useRef(isGhostMode);

  useEffect(() => {
    const active = checkGhostModeActive();
    setIsGhostMode(active);
    isGhostModeRef.current = active;
  }, [chatId, user?.hideReadReceipts, user?.ghostChats, activeChat?.id, activeChat?.username]);

  useEffect(() => {
    const handleGhostUpdated = () => {
      const active = checkGhostModeActive();
      setIsGhostMode(active);
      isGhostModeRef.current = active;
    };
    window.addEventListener('pulsechat_ghost_mode_updated', handleGhostUpdated);
    return () => window.removeEventListener('pulsechat_ghost_mode_updated', handleGhostUpdated);
  }, [chatId, user?.hideReadReceipts, user?.ghostChats, activeChat?.id, activeChat?.username]);

  // Instagram-style Vanish Mode State
  const [isVanishMode, setIsVanishMode] = useState(false);
  const isVanishModeRef = useRef(false);

  const getSenderPayload = () => ({
    senderName: user?.displayName || user?.username || 'User',
    senderUsername: user?.username || '',
    senderAvatar: user?.avatar || null,
    senderIsPro: Boolean(user?.isPro),
    senderProTier: user?.proTier || 'none',
    senderCustomBadge: user?.customBadge || '',
    isVanish: Boolean(isVanishModeRef.current)
  });

  // In-Chat Search Feature States
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const deferredInChatSearchQuery = useDeferredValue(inChatSearchQuery);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const inChatSearchInputRef = useRef(null);

  // Floating Scroll-to-Bottom Button States
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const showScrollBottomRef = useRef(false);
  const isPinnedToBottomRef = useRef(true);
  const inputCapsuleRef = useRef(null);
  const [scheduleInitialText, setScheduleInitialText] = useState('');
  const [newScrolledMessagesCount, setNewScrolledMessagesCount] = useState(0);
  const newScrolledMessagesCountRef = useRef(0);
  const scrollRafRef = useRef(null);

  // Pure container scroll helper — never shifts document body or moves input bar
  const scrollToBottom = useCallback((behavior = 'instant') => {
    if (chatContainerRef.current) {
      if (behavior === 'smooth') {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  }, []);

  // WhatsApp-style ResizeObserver: pins chat strictly to the bottom when opening or loading media
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (isPinnedToBottomRef.current && !scrollPositionRef.current?.isPrepending) {
        container.scrollTop = container.scrollHeight;
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [chatId]);


  // Instagram-style Story preview modal state
  const [selectedStoryVibeGroup, setSelectedStoryVibeGroup] = useState(null);
  const [selectedStoryVibeId, setSelectedStoryVibeId] = useState(null);

  const handleOpenStory = useCallback(async (storyPayload) => {
    if (!storyPayload) return;
    const authorId = storyPayload.authorId || (activeChat.isGroup ? null : activeChat.id);
    const targetVibeId = storyPayload.storyId || storyPayload.id;
    setSelectedStoryVibeId(targetVibeId);

    if (authorId && token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/user/${authorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.vibes) && data.vibes.length > 0) {
            setSelectedStoryVibeGroup(data);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch active vibes for story preview, using fallback:', err);
      }
    }

    // Fallback: build snapshot vibeGroup from storyPayload so user can ALWAYS view story card even if expired
    const fallbackVibe = {
      id: targetVibeId || 'story_snapshot_' + Date.now(),
      _id: targetVibeId || 'story_snapshot_' + Date.now(),
      userId: authorId || user?.id,
      caption: storyPayload.caption || '',
      mediaUrl: storyPayload.mediaUrl || null,
      mediaType: storyPayload.mediaType || (storyPayload.mediaUrl?.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'),
      bgGradient: storyPayload.bgGradient || 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
      audioUrl: storyPayload.audioUrl || null,
      songTitle: storyPayload.songTitle || null,
      artistName: storyPayload.artistName || null,
      createdAt: storyPayload.createdAt || new Date().toISOString(),
      views: []
    };

    const fallbackGroup = {
      userId: authorId || user?.id,
      displayName: storyPayload.authorName || activeChat?.displayName || 'User',
      username: storyPayload.authorUsername || activeChat?.username || '',
      avatar: storyPayload.authorAvatar || activeChat?.avatar || '',
      vibes: [fallbackVibe]
    };

    setSelectedStoryVibeGroup(fallbackGroup);
  }, [token, activeChat, user]);

  useEffect(() => {
    const onOpenStoryEvent = (e) => {
      if (e.detail) {
        handleOpenStory(e.detail);
      }
    };
    window.addEventListener('pulsechat_open_story', onOpenStoryEvent);
    return () => window.removeEventListener('pulsechat_open_story', onOpenStoryEvent);
  }, [handleOpenStory]);

  // Sparks Wallet Modal state
  const [showSparksWallet, setShowSparksWallet] = useState(false);

  useEffect(() => {
    const handleOpenWallet = () => setShowSparksWallet(true);
    window.addEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
    return () => window.removeEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
  }, []);

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSolidThemeModal, setShowSolidThemeModal] = useState(false);
  const [showAppsFolderModal, setShowAppsFolderModal] = useState(false);
  const [appsFolderView, setAppsFolderView] = useState('main'); // 'main' | 'games'
  const [showChatMusicPicker, setShowChatMusicPicker] = useState(false);
  const [chatMusicSong, setChatMusicSong] = useState(() => {
    try {
      const saved = localStorage.getItem(`pulsechat_music_${chatId}`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pulsechat_music_${chatId}`);
      setChatMusicSong(saved ? JSON.parse(saved) : null);
    } catch (e) {
      setChatMusicSong(null);
    }
  }, [chatId]);

  const [isChatMusicMuted, setIsChatMusicMuted] = useState(false);
  const chatAudioRef = useRef(null);

  const [auraVolume, setAuraVolume] = useState(() => {
    const saved = localStorage.getItem('pulsechat_aura_volume');
    return saved !== null ? Number(saved) : 0.7;
  });

  const handleUpdateChatMusic = useCallback((song) => {
    setChatMusicSong(song);
    try {
      if (song) {
        localStorage.setItem(`pulsechat_music_${chatId}`, JSON.stringify(song));
      } else {
        localStorage.removeItem(`pulsechat_music_${chatId}`);
      }
    } catch (e) {}

    if (socket && chatId) {
      socket.emit('chat_music_changed', { chatId, song: song || null, senderId: user?.id });
    }
  }, [chatId, socket, user?.id]);

  const similarSongsQueueRef = useRef([]);
  const [songProgress, setSongProgress] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(true);
  const [isAutoNextLoading, setIsAutoNextLoading] = useState(false);

  const formatSongTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const fetchSimilarSongs = useCallback(async (currentSong) => {
    if (!currentSong) return;
    try {
      const q = currentSong.artistName || currentSong.songTitle || 'Bollywood trending';
      const res = await fetch(`https://jiosaavn-api-tan.vercel.app/api/search/songs?query=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      const saavnData = data.data?.results || data.results || [];
      if (Array.isArray(saavnData)) {
        const fullTracks = saavnData.map(song => {
          const audioObj = Array.isArray(song.downloadUrl)
            ? (song.downloadUrl.find(d => d.quality === '320kbps') || song.downloadUrl.find(d => d.quality === '160kbps') || song.downloadUrl[song.downloadUrl.length - 1])
            : null;
          const audioUrl = audioObj?.url || (typeof song.downloadUrl === 'string' ? song.downloadUrl : null);
          const imgObj = Array.isArray(song.image)
            ? (song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1])
            : null;
          const albumArt = imgObj?.url || (typeof song.image === 'string' ? song.image : null);
          const artist = Array.isArray(song.artists?.primary) && song.artists.primary.length > 0
            ? song.artists.primary.map(a => a.name).join(', ')
            : (song.primaryArtists || 'PulseChat Music');
          const title = (song.name || song.title || 'Full Song')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#039;/g, "'");

          if (!audioUrl) return null;
          return {
            trackId: `full_${song.id || Math.random().toString(36).substr(2, 6)}`,
            songTitle: title,
            artistName: artist,
            albumArt: albumArt || '',
            audioUrl: audioUrl,
            duration: song.duration ? Number(song.duration) : 240,
            isFullSong: true
          };
        }).filter(Boolean);

        const currentTitleLower = (currentSong.songTitle || '').toLowerCase();
        const filtered = fullTracks.filter(t => 
          (t.songTitle || '').toLowerCase() !== currentTitleLower &&
          t.audioUrl !== currentSong.audioUrl
        );

        similarSongsQueueRef.current = filtered;
      }
    } catch (err) {
      console.warn('Failed to fetch similar songs queue:', err);
    }
  }, []);

  const handlePlayNextSong = useCallback(async () => {
    setIsAutoNextLoading(true);
    let nextTrack = null;

    if (similarSongsQueueRef.current && similarSongsQueueRef.current.length > 0) {
      nextTrack = similarSongsQueueRef.current.shift();
    } else if (chatMusicSong) {
      try {
        const q = chatMusicSong.artistName || chatMusicSong.songTitle || 'Bollywood trending';
        const res = await fetch(`https://jiosaavn-api-tan.vercel.app/api/search/songs?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        const saavnData = data.data?.results || data.results || [];
        if (Array.isArray(saavnData)) {
          const list = saavnData.map(song => {
            const audioObj = Array.isArray(song.downloadUrl)
              ? (song.downloadUrl.find(d => d.quality === '320kbps') || song.downloadUrl.find(d => d.quality === '160kbps') || song.downloadUrl[song.downloadUrl.length - 1])
              : null;
            const audioUrl = audioObj?.url || (typeof song.downloadUrl === 'string' ? song.downloadUrl : null);
            const imgObj = Array.isArray(song.image)
              ? (song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1])
              : null;
            const albumArt = imgObj?.url || (typeof song.image === 'string' ? song.image : null);
            const artist = Array.isArray(song.artists?.primary) && song.artists.primary.length > 0
              ? song.artists.primary.map(a => a.name).join(', ')
              : (song.primaryArtists || 'PulseChat Music');
            const title = (song.name || song.title || 'Full Song')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#039;/g, "'");

            if (!audioUrl) return null;
            return {
              trackId: `full_${song.id || Math.random().toString(36).substr(2, 6)}`,
              songTitle: title,
              artistName: artist,
              albumArt: albumArt || '',
              audioUrl: audioUrl,
              duration: song.duration ? Number(song.duration) : 240,
              isFullSong: true
            };
          }).filter(Boolean);

          const currentTitleLower = (chatMusicSong?.songTitle || '').toLowerCase();
          const filtered = list.filter(t => 
            (t.songTitle || '').toLowerCase() !== currentTitleLower &&
            t.audioUrl !== chatMusicSong?.audioUrl
          );
          if (filtered.length > 0) {
            nextTrack = filtered[0];
            similarSongsQueueRef.current = filtered.slice(1);
          }
        }
      } catch (e) {}
    }

    setIsAutoNextLoading(false);
    if (nextTrack) {
      handleUpdateChatMusic(nextTrack);
    }
  }, [chatMusicSong, handleUpdateChatMusic]);

  const handleSeekSong = (e) => {
    const newTime = Number(e.target.value);
    setSongProgress(newTime);
    if (chatAudioRef.current) {
      chatAudioRef.current.currentTime = newTime;
    }
    if (socket && chatId) {
      socket.emit('chat_music_action', {
        chatId,
        action: 'seek',
        currentTime: newTime,
        senderId: user?.id
      });
    }
  };

  const handleSkipTime = (seconds) => {
    if (!chatAudioRef.current) return;
    const current = chatAudioRef.current.currentTime || 0;
    const dur = chatAudioRef.current.duration || songDuration || 240;
    const newTime = Math.max(0, Math.min(dur, current + seconds));
    chatAudioRef.current.currentTime = newTime;
    setSongProgress(newTime);
    if (socket && chatId) {
      socket.emit('chat_music_action', {
        chatId,
        action: 'seek',
        currentTime: newTime,
        senderId: user?.id
      });
    }
  };

  const handleTogglePlayPause = () => {
    if (!chatAudioRef.current) return;
    if (chatAudioRef.current.paused) {
      const cur = chatAudioRef.current.currentTime || 0;
      chatAudioRef.current.play().then(() => {
        setIsSongPlaying(true);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: true } }));
        if (socket && chatId) {
          socket.emit('chat_music_action', {
            chatId,
            action: 'play',
            currentTime: cur,
            senderId: user?.id
          });
        }
      }).catch(() => {});
    } else {
      const cur = chatAudioRef.current.currentTime || 0;
      chatAudioRef.current.pause();
      setIsSongPlaying(false);
      window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));
      if (socket && chatId) {
        socket.emit('chat_music_action', {
          chatId,
          action: 'pause',
          currentTime: cur,
          senderId: user?.id
        });
      }
    }
  };

  // Real Chat Background Music Player with Auto-Next & Seek Tracking
  useEffect(() => {
    stopGlobalMusicAudio();
    if (chatAudioRef.current) {
      try {
        chatAudioRef.current.pause();
        chatAudioRef.current.currentTime = 0;
        chatAudioRef.current.src = '';
        chatAudioRef.current = null;
      } catch (e) {}
    }

    setSongProgress(0);
    setSongDuration(chatMusicSong?.duration || 0);

    if (chatMusicSong?.audioUrl && !chatMusicSong.audioUrl.includes('youtube')) {
      const cachedImmediate = getSyncCachedAudioUrl(chatMusicSong.audioUrl);
      const audio = new Audio(cachedImmediate || chatMusicSong.audioUrl);
      audio.volume = isChatMusicMuted ? 0 : auraVolume;

      if (!cachedImmediate) {
        getOrCacheAudioBlobUrl(chatMusicSong.audioUrl).then(blobUrl => {
          if (blobUrl && blobUrl !== chatMusicSong.audioUrl && chatAudioRef.current === audio && audio.paused) {
            audio.src = blobUrl;
          }
        }).catch(() => {});
      }

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setSongDuration(audio.duration);
        }
      });

      audio.addEventListener('timeupdate', () => {
        setSongProgress(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setSongDuration(audio.duration);
        }
      });

      audio.addEventListener('play', () => {
        setIsSongPlaying(true);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: true } }));
      });
      audio.addEventListener('pause', () => {
        setIsSongPlaying(false);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));
      });

      audio.addEventListener('ended', () => {
        setIsSongPlaying(false);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));
        // Automatic next song when song finishes!
        handlePlayNextSong();
      });

      registerGlobalMusicAudio(audio);
      audio.play().then(() => {
        setIsSongPlaying(true);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: true } }));
      }).catch(e => {
        console.warn('Chat music playback prevented by browser autoplay policy:', e);
        setIsSongPlaying(false);
        window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));

        // Auto-unlock music on partner's first interaction with document (typing, tapping screen)
        const autoUnlockPlayback = () => {
          if (chatAudioRef.current && chatAudioRef.current.paused) {
            chatAudioRef.current.play().then(() => {
              setIsSongPlaying(true);
              window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: true } }));
            }).catch(() => {});
          }
          window.removeEventListener('click', autoUnlockPlayback);
          window.removeEventListener('touchstart', autoUnlockPlayback);
          window.removeEventListener('pointerdown', autoUnlockPlayback);
        };
        window.addEventListener('click', autoUnlockPlayback, { once: true });
        window.addEventListener('touchstart', autoUnlockPlayback, { once: true, passive: true });
        window.addEventListener('pointerdown', autoUnlockPlayback, { once: true, passive: true });
      });
      chatAudioRef.current = audio;

      // Pre-fetch similar songs for instant next song transition
      fetchSimilarSongs(chatMusicSong);
    }

    return () => {
      window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));
      if (chatAudioRef.current) {
        try {
          chatAudioRef.current.pause();
          chatAudioRef.current.currentTime = 0;
          chatAudioRef.current.src = '';
          chatAudioRef.current = null;
        } catch (e) {}
      }
      stopGlobalMusicAudio();
    };
  }, [chatMusicSong?.audioUrl, chatId]);

  useEffect(() => {
    if (chatAudioRef.current) {
      chatAudioRef.current.volume = isChatMusicMuted ? 0 : auraVolume;
    }
  }, [auraVolume, isChatMusicMuted]);

  // Auto-upgrade chat background music to full YouTube audio ONLY if no direct audioUrl exists
  useEffect(() => {
    if (chatMusicSong && !chatMusicSong.audioUrl && !chatMusicSong.youtubeId && chatMusicSong.songTitle) {
      const q = `${chatMusicSong.songTitle} ${chatMusicSong.artistName || ''}`;
      const rawToken = localStorage.getItem('pulsechat_token');
      const authHeader = rawToken ? { Authorization: `Bearer ${rawToken}` } : {};
      fetch(`${BACKEND_URL}/api/messages/youtube-search?q=${encodeURIComponent(q)}`, { headers: authHeader })
        .then(r => r.json())
        .then(ytData => {
          if (Array.isArray(ytData) && ytData.length > 0 && ytData[0].youtubeId) {
            const updated = { ...chatMusicSong, youtubeId: ytData[0].youtubeId, isFullSong: true };
            setChatMusicSong(updated);
            try {
              localStorage.setItem(`pulsechat_music_${chatId}`, JSON.stringify(updated));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, [chatMusicSong, chatId]);

  const [chatTheme, setChatTheme] = useState(() => {
    return localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || 'default';
  });
  const [selectedVibe, setSelectedVibe] = useState('⚡ Quick Pulse');

  const [chatAvatar, setChatAvatar] = useState(() => activeChat?.avatar || '');
  const [chatDisplayName, setChatDisplayName] = useState(() => activeChat?.displayName || activeChat?.name || '');
  const [chatHasKingCrown, setChatHasKingCrown] = useState(() => Boolean(activeChat?.hasKingCrown));
  const [chatHasSilverCrown, setChatHasSilverCrown] = useState(() => Boolean(activeChat?.hasSilverCrown));
  const [chatHasStreakCrown, setChatHasStreakCrown] = useState(() => Boolean(activeChat?.hasStreakCrown));
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
    setChatHasKingCrown(Boolean(activeChat?.hasKingCrown));
    setChatHasSilverCrown(Boolean(activeChat?.hasSilverCrown));
    setChatHasStreakCrown(Boolean(activeChat?.hasStreakCrown));
    let isProVal = activeChat?.isPro;
    if (isProVal === undefined && user?.id) {
      const cached = getCachedAllUsers(user.id)?.find(u =>
        u.id === activeChat?.id || u.id === activeChat?._id || (activeChat?.username && u.username === activeChat.username)
      );
      if (cached) {
        if (cached.isPro !== undefined) isProVal = cached.isPro;
        if (cached.hasKingCrown !== undefined) setChatHasKingCrown(Boolean(cached.hasKingCrown));
        if (cached.hasSilverCrown !== undefined) setChatHasSilverCrown(Boolean(cached.hasSilverCrown));
        if (cached.hasStreakCrown !== undefined) setChatHasStreakCrown(Boolean(cached.hasStreakCrown));
      }
    }
    setChatIsPro(Boolean(isProVal));
  }, [activeChat?.id, activeChat?.avatar, activeChat?.displayName, activeChat?.name, activeChat?.isPro, activeChat?.hasKingCrown, activeChat?.hasSilverCrown, activeChat?.hasStreakCrown, user?.id]);

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
            if (userData.hasKingCrown !== undefined) {
              setChatHasKingCrown(Boolean(userData.hasKingCrown));
              if (activeChat) activeChat.hasKingCrown = Boolean(userData.hasKingCrown);
            }
            if (userData.hasSilverCrown !== undefined) {
              setChatHasSilverCrown(Boolean(userData.hasSilverCrown));
              if (activeChat) activeChat.hasSilverCrown = Boolean(userData.hasSilverCrown);
            }
            if (userData.hasStreakCrown !== undefined) {
              setChatHasStreakCrown(Boolean(userData.hasStreakCrown));
              if (activeChat) activeChat.hasStreakCrown = Boolean(userData.hasStreakCrown);
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
                  pulseSparks: userData.pulseSparks,
                  hasKingCrown: Boolean(userData.hasKingCrown),
                  hasSilverCrown: Boolean(userData.hasSilverCrown),
                  hasStreakCrown: Boolean(userData.hasStreakCrown)
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
        if (data.hasKingCrown !== undefined) {
          setChatHasKingCrown(Boolean(data.hasKingCrown));
          if (activeChat) activeChat.hasKingCrown = Boolean(data.hasKingCrown);
        }
        if (data.hasSilverCrown !== undefined) {
          setChatHasSilverCrown(Boolean(data.hasSilverCrown));
          if (activeChat) activeChat.hasSilverCrown = Boolean(data.hasSilverCrown);
        }
        if (data.hasStreakCrown !== undefined) {
          setChatHasStreakCrown(Boolean(data.hasStreakCrown));
          if (activeChat) activeChat.hasStreakCrown = Boolean(data.hasStreakCrown);
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

  const isDirectFriend = isGroup || isAnonymousBot || isCachedFriend(user?.id, activeChat?.id);

  const [friendshipStatus, setFriendshipStatus] = useState(() => isDirectFriend ? 'friends' : 'checking');
  const [friendRequestId, setFriendRequestId] = useState(null);
  const lastWallpaperUpdateTimestamp = useRef(0);

  const [chatWallpaper, setChatWallpaper] = useState(() => {
    return localStorage.getItem(`pulsechat_chat_wallpaper_${chatId}`) || 'none';
  });
  const [customWallpaper, setCustomWallpaper] = useState(() => {
    return localStorage.getItem(`pulsechat_custom_wallpaper_${chatId}`) || null;
  });

  const isMatchingChatId = (c1, c2) => {
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.includes('_') && c2.includes('_')) {
      if (c1.split('_').sort().join('_') === c2.split('_').sort().join('_')) return true;
    }
    if (!isGroup && activeChat && user) {
      const myIds = [user.id, user._id, user.username].filter(Boolean).map(String);
      const otherIds = [activeChat.id, activeChat._id, activeChat.userId, activeChat.username].filter(Boolean).map(String);

      const checkMatches = (target) => {
        if (!target || !target.includes('_')) return false;
        const parts = target.split('_');
        if (parts.length === 2) {
          const hasMe = myIds.includes(parts[0]) || myIds.includes(parts[1]);
          const hasOther = otherIds.includes(parts[0]) || otherIds.includes(parts[1]);
          return hasMe && hasOther;
        }
        return false;
      };

      if (checkMatches(c1) || checkMatches(c2)) return true;
    }
    return false;
  };

  useEffect(() => {
    // Check if previous trial expired
    let effectiveTheme = localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || localStorage.getItem('pulsechat_chat_default_theme') || 'midnight_amoled';
    try {
      const themeTrialStr = localStorage.getItem(`pulsechat_theme_trial_${chatId}`);
      if (themeTrialStr) {
        const trial = JSON.parse(themeTrialStr);
        if (trial && trial.expiresAt && Date.now() >= Number(trial.expiresAt)) {
          localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
          localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
          localStorage.removeItem('pulsechat_chat_default_theme');
          effectiveTheme = 'midnight_amoled';
          if (socket) {
            socket.emit('set_chat_theme', { chatId, themeId: 'midnight_amoled', isTrial: false });
          }
        }
      }
    } catch (e) {}
    setChatTheme(effectiveTheme);

    let effectiveWall = localStorage.getItem(`pulsechat_chat_wallpaper_${chatId}`) || 'none';
    try {
      const wallTrialStr = localStorage.getItem(`pulsechat_wallpaper_trial_${chatId}`);
      if (wallTrialStr) {
        const trial = JSON.parse(wallTrialStr);
        if (trial && trial.expiresAt && Date.now() >= Number(trial.expiresAt)) {
          localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
          localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
          effectiveWall = 'none';
          if (socket) {
            socket.emit('set_chat_wallpaper', { chatId, wallpaperId: 'none', isTrial: false });
          }
        }
      }
    } catch (e) {}
    setChatWallpaper(effectiveWall);

    const savedCustom = localStorage.getItem(`pulsechat_custom_wallpaper_${chatId}`);
    setCustomWallpaper(savedCustom || null);

    const handleWallpaperUpdated = (e) => {
      const incomingChatId = e.detail?.chatId;
      const originalChatId = e.detail?.originalChatId;
      if (isMatchingChatId(incomingChatId, chatId) || isMatchingChatId(originalChatId, chatId)) {
        lastWallpaperUpdateTimestamp.current = Date.now();
        const newWall = e.detail.wallpaperId || 'none';
        const incomingCustomUrl = e.detail.customWallpaperUrl || e.detail.customImage;
        const fallbackCustomUrl = localStorage.getItem(`pulsechat_custom_wallpaper_${chatId}`);
        const customUrl = incomingCustomUrl || fallbackCustomUrl || null;

        if (e.detail?.trialExpired) {
          localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
          localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
          setChatWallpaper('none');
          setCustomWallpaper(null);
          setActionToast('⏰ 5-Minute VIP Live Wallpaper Trial Expired! Reverted to default.');
          setTimeout(() => setActionToast(''), 3500);
          return;
        }

        setChatWallpaper(newWall);
        if (newWall === 'custom_image' && customUrl) {
          setCustomWallpaper(customUrl);
          localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, customUrl);
          localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, 'custom_image');
        } else if (newWall === 'none') {
          setCustomWallpaper(null);
          localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
          localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
        } else {
          setChatWallpaper(newWall);
          setCustomWallpaper(null);
          localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
          if (e.detail.isTrial && e.detail.trialExpiresAt) {
            localStorage.setItem(`pulsechat_wallpaper_trial_${chatId}`, JSON.stringify({
              wallpaperId: newWall,
              expiresAt: new Date(e.detail.trialExpiresAt).getTime()
            }));
          }
        }
      }
    };

    const handleThemeUpdated = (e) => {
      const incomingChatId = e.detail?.chatId;
      const originalChatId = e.detail?.originalChatId;
      if (isMatchingChatId(incomingChatId, chatId) || isMatchingChatId(originalChatId, chatId)) {
        if (e.detail?.trialExpired) {
          localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
          localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
          localStorage.removeItem('pulsechat_chat_default_theme');
          setChatTheme('midnight_amoled');
          setActionToast('⏰ 5-Minute VIP Theme Trial Expired! Reverted to default.');
          setTimeout(() => setActionToast(''), 3500);
          return;
        }

        const newTheme = e.detail.themeId || 'default';
        setChatTheme(newTheme);
        if (newTheme === 'default' || newTheme === 'midnight_amoled') {
          localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
          localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
          localStorage.removeItem('pulsechat_chat_default_theme');
        } else {
          localStorage.setItem(`pulsechat_chat_theme_${chatId}`, newTheme);
          localStorage.setItem('pulsechat_chat_default_theme', newTheme);
          if (e.detail.isTrial && e.detail.trialExpiresAt) {
            localStorage.setItem(`pulsechat_theme_trial_${chatId}`, JSON.stringify({
              themeId: newTheme,
              expiresAt: new Date(e.detail.trialExpiresAt).getTime()
            }));
          }
        }
      }
    };

    window.addEventListener('pulsechat_wallpaper_updated', handleWallpaperUpdated);
    window.addEventListener('pulsechat_theme_updated', handleThemeUpdated);

    return () => {
      window.removeEventListener('pulsechat_wallpaper_updated', handleWallpaperUpdated);
      window.removeEventListener('pulsechat_theme_updated', handleThemeUpdated);
    };
  }, [chatId, activeChat, isGroup, user]);

  // Persistent 5-Minute Theme & Wallpaper Trial Watchdog (runs every 3 seconds)
  useEffect(() => {
    if (!chatId) return;

    const checkTrials = () => {
      const now = Date.now();

      // 1. Check Theme Trial
      try {
        const themeTrialStr = localStorage.getItem(`pulsechat_theme_trial_${chatId}`);
        if (themeTrialStr) {
          const trial = JSON.parse(themeTrialStr);
          if (trial && trial.expiresAt && now >= Number(trial.expiresAt)) {
            localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
            localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
            localStorage.removeItem('pulsechat_chat_default_theme');
            handleSelectChatTheme('midnight_amoled', false, null);
            setActionToast('⏰ 5-Minute VIP Theme Trial Expired! Reverted to default.');
            setTimeout(() => setActionToast(''), 3500);
          }
        }
      } catch (e) {}

      // 2. Check Wallpaper Trial
      try {
        const wallTrialStr = localStorage.getItem(`pulsechat_wallpaper_trial_${chatId}`);
        if (wallTrialStr) {
          const trial = JSON.parse(wallTrialStr);
          if (trial && trial.expiresAt && now >= Number(trial.expiresAt)) {
            localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
            localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
            localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
            handleSelectChatWallpaper('none', null, false, null);
            setActionToast('⏰ 5-Minute VIP Live Wallpaper Trial Expired! Reverted to default.');
            setTimeout(() => setActionToast(''), 3500);
          }
        }
      } catch (e) {}
    };

    checkTrials();
    const interval = setInterval(checkTrials, 3000);
    return () => clearInterval(interval);
  }, [chatId]);

  const handleSelectChatTheme = (newTheme, isTrial = false, trialExpiresAt = null) => {
    setChatTheme(newTheme);
    if (newTheme === 'default' || newTheme === 'midnight_amoled') {
      localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
      localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
      localStorage.removeItem('pulsechat_chat_default_theme');
    } else {
      localStorage.setItem(`pulsechat_chat_theme_${chatId}`, newTheme);
      if (isTrial) {
        localStorage.setItem(`pulsechat_theme_trial_${chatId}`, JSON.stringify({
          themeId: newTheme,
          expiresAt: trialExpiresAt || (Date.now() + 5 * 60 * 1000)
        }));
      } else {
        localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
        localStorage.setItem('pulsechat_chat_default_theme', newTheme);
      }
    }
    const computedExpiry = isTrial ? (trialExpiresAt || (Date.now() + 5 * 60 * 1000)) : null;
    if (socket) {
      socket.emit('set_chat_theme', {
        chatId,
        themeId: newTheme,
        userId: user?.id,
        setBy: user?.id,
        isTrial,
        trialExpiresAt: computedExpiry
      });
    }
    if (token) {
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          themeId: newTheme,
          isTrial,
          trialExpiresAt: computedExpiry
        })
      }).catch(() => {});
    }
  };

  const handleSelectChatWallpaper = (newWall, customUrl = null, isTrial = false, trialExpiresAt = null) => {
    lastWallpaperUpdateTimestamp.current = Date.now();
    const finalCustom = newWall === 'custom_image' ? (customUrl || customWallpaper) : null;
    setChatWallpaper(newWall);
    setCustomWallpaper(finalCustom);

    if (newWall === 'none') {
      localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
      localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
      localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
    } else {
      localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
      if (isTrial) {
        localStorage.setItem(`pulsechat_wallpaper_trial_${chatId}`, JSON.stringify({
          wallpaperId: newWall,
          expiresAt: trialExpiresAt || (Date.now() + 5 * 60 * 1000)
        }));
      } else {
        localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
      }
      if (newWall === 'custom_image' && finalCustom) {
        localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, finalCustom);
      } else {
        localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
      }
    }

    const computedExpiry = isTrial ? (trialExpiresAt || (Date.now() + 5 * 60 * 1000)) : null;
    if (socket) {
      socket.emit('set_chat_wallpaper', {
        chatId,
        wallpaperId: newWall,
        customWallpaperUrl: finalCustom,
        customImage: finalCustom,
        userId: user?.id,
        setBy: user?.id,
        isTrial,
        trialExpiresAt: computedExpiry
      });
    }

    if (token) {
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}/wallpaper`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          wallpaperId: newWall,
          customWallpaperUrl: finalCustom,
          isTrial,
          trialExpiresAt: computedExpiry
        })
      }).catch(() => {});
    }
  };

  const handleSetCustomWallpaper = async (dataUrl) => {
    if (!dataUrl) {
      setCustomWallpaper(null);
      localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
      handleSelectChatWallpaper('none', null);
      return;
    }

    // 1. Instant local preview on client
    setCustomWallpaper(dataUrl);
    setChatWallpaper('custom_image');
    localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, dataUrl);
    localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, 'custom_image');

    // 2. Upload to server/Cloudinary so both sides receive a high quality permanent URL
    let finalUrl = dataUrl;
    if (token && dataUrl.startsWith('data:')) {
      try {
        const uploadRes = await fetch(`${BACKEND_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            file: dataUrl,
            folder: 'pulsechat_wallpapers',
            resourceType: 'image'
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData?.url) {
            finalUrl = uploadData.url;
            setCustomWallpaper(finalUrl);
            localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, finalUrl);
          }
        }
      } catch (err) {
        console.warn('Direct wallpaper upload failed, using optimized base64 payload:', err);
      }
    }

    // 3. Save to MongoDB & broadcast via Socket.IO
    handleSelectChatWallpaper('custom_image', finalUrl);
  };

  const [messages, setMessages] = useState(() => {
    const cached = getCachedMessages(chatId);
    const outbox = getOutbox(user?.id);
    const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
    const cachedIds = new Set(cached.map(m => m.id));
    return [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))];
  });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [isNetConnected, setIsNetConnected] = useState(() => isDeviceOnline());

  // Forwarding helper for inputCapsuleRef (isolated typing state avoids ChatWindow re-renders)
  const setText = useCallback((val) => {
    inputCapsuleRef.current?.setText(val);
  }, []);
  const text = inputCapsuleRef.current?.getText() || '';

  // Instagram-style Vanish Mode Swipe Up Gesture State
  const [swipeUpDist, setSwipeUpDist] = useState(0);
  const vanishTouchStartYRef = useRef(null);
  const vanishTouchLastYRef = useRef(null);
  const isVanishSwipeActiveRef = useRef(false);

  const [showRecorder, setShowRecorder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardInitialImage, setWhiteboardInitialImage] = useState(null);
  const [whiteboardInitialData, setWhiteboardInitialData] = useState(null);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showGroupProfileModal, setShowGroupProfileModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [show3DTextModal, setShow3DTextModal] = useState(false);
  const [showArrowGameModal, setShowArrowGameModal] = useState(false);
  const [showActionGrid, setShowActionGrid] = useState(false);
  const [showEmojiBurstPicker, setShowEmojiBurstPicker] = useState(false);
  const [customBurstEmoji, setCustomBurstEmoji] = useState('');
  const actionGridRef = useRef(null);
  const actionGridBtnRef = useRef(null);
  const [proModalTab, setProModalTab] = useState('pro');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreSubMenuOpen, setMoreSubMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const [isChatLockedState, setIsChatLockedState] = useState(() => isChatLocked(chatId));
  const [isChatMutedState, setIsChatMutedState] = useState(() => isChatMuted(chatId));
  const [showChatLockPinModal, setShowChatLockPinModal] = useState(false);
  const [chatLockPinMode, setChatLockPinMode] = useState('verify');
  const [pendingMedia, setPendingMedia] = useState(null);

  useEffect(() => {
    setIsChatLockedState(isChatLocked(chatId));
    setIsChatMutedState(isChatMuted(chatId));
    setMoreSubMenuOpen(false);
  }, [chatId]);

  useEffect(() => {
    const handleLockUpdated = (e) => {
      if (e.detail?.chatId === chatId) {
        setIsChatLockedState(Boolean(e.detail.locked));
      }
    };
    const handleMuteUpdated = (e) => {
      if (e.detail?.chatId === chatId) {
        setIsChatMutedState(Boolean(e.detail.muted));
      }
    };
    window.addEventListener('pulsechat_chat_lock_updated', handleLockUpdated);
    window.addEventListener('pulsechat_chat_mute_updated', handleMuteUpdated);
    return () => {
      window.removeEventListener('pulsechat_chat_lock_updated', handleLockUpdated);
      window.removeEventListener('pulsechat_chat_mute_updated', handleMuteUpdated);
    };
  }, [chatId]);

  const handleToggleChatLockFromMenu = () => {
    setShowMoreMenu(false);
    setMoreSubMenuOpen(false);
    if (!chatId) return;
    if (isChatLockedState) {
      setChatLockPinMode('verify');
      setShowChatLockPinModal(true);
    } else {
      const pin = getSecurityPin();
      setChatLockPinMode(pin ? 'verify' : 'setup');
      setShowChatLockPinModal(true);
    }
  };

  const handleChatLockPinSuccess = () => {
    if (!chatId) return;
    if (chatLockPinMode === 'verify') {
      setChatLocked(chatId, false);
      setIsChatLockedState(false);
      window.dispatchEvent(new CustomEvent('pulsechat_chat_lock_updated', { detail: { chatId, locked: false } }));
      setActionToast('Chat unlocked 🔓');
    } else {
      setChatLocked(chatId, true);
      setIsChatLockedState(true);
      window.dispatchEvent(new CustomEvent('pulsechat_chat_lock_updated', { detail: { chatId, locked: true } }));
      setActionToast('Chat locked with PIN 🔒');
    }
    setShowChatLockPinModal(false);
    setTimeout(() => setActionToast(''), 2500);
  };

  const handleToggleChatMuteFromMenu = () => {
    setShowMoreMenu(false);
    setMoreSubMenuOpen(false);
    if (!chatId) return;
    const next = !isChatMutedState;
    setChatMuted(chatId, next);
    setIsChatMutedState(next);
    window.dispatchEvent(new CustomEvent('pulsechat_chat_mute_updated', { detail: { chatId, muted: next } }));
    setActionToast(next ? 'Notifications muted 🔕' : 'Notifications unmuted 🔔');
    setTimeout(() => setActionToast(''), 2500);
  };

  // Universal Back Button registration for all submodals/pickers inside ChatWindow
  useBackHandler(() => setShowActionGrid(false), showActionGrid);
  useBackHandler(() => setShowEmoji(false), showEmoji);
  useBackHandler(() => setShowRecorder(false), showRecorder);
  useBackHandler(() => setPendingMedia(null), Boolean(pendingMedia));
  useBackHandler(() => setShowCreatePoll(false), showCreatePoll);
  useBackHandler(() => setShowWhiteboard(false), showWhiteboard);
  useBackHandler(() => setShowMoreMenu(false), showMoreMenu);
  useBackHandler(() => setShowUserProfileModal(false), showUserProfileModal);
  useBackHandler(() => setShowGroupProfileModal(false), showGroupProfileModal);
  useBackHandler(() => setShowGiftPicker(false), showGiftPicker);
  useBackHandler(() => setShow3DTextModal(false), show3DTextModal);
  useBackHandler(() => setShowArrowGameModal(false), showArrowGameModal);
  useBackHandler(() => setShowEmojiBurstPicker(false), showEmojiBurstPicker);
  useBackHandler(() => setShowProModal(false), showProModal);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dustImageInputRef = useRef(null);
  const lastMediaSentRef = useRef({ time: 0, key: '' });

  // Live Chat Translation State
  const [targetLang, setTargetLang] = useState(() => {
    try {
      return localStorage.getItem('pulsechat_target_lang') || 'hi';
    } catch {
      return 'hi';
    }
  });
  const [isAutoTranslateActive, setIsAutoTranslateActive] = useState(() => {
    try {
      return localStorage.getItem(`pulsechat_auto_translate_${chatId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [showTranslateBar, setShowTranslateBar] = useState(false);
  const [translationsByMsgId, setTranslationsByMsgId] = useState({});
  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);

  useEffect(() => {
    try {
      setIsAutoTranslateActive(localStorage.getItem(`pulsechat_auto_translate_${chatId}`) === 'true');
    } catch {
      setIsAutoTranslateActive(false);
    }
  }, [chatId]);

  const handleTranslateMessage = useCallback(async (target, maybeContent, customTargetLang) => {
    let msgId, textToTranslate;
    if (target && typeof target === 'object') {
      msgId = target.id;
      textToTranslate = target.content;
    } else if (typeof target === 'string') {
      msgId = target;
      textToTranslate = maybeContent || messages.find(m => m.id === msgId)?.content;
    }
    if (!msgId || !textToTranslate || typeof textToTranslate !== 'string') return;
    const tLang = customTargetLang || (typeof maybeContent === 'string' && maybeContent.length === 2 ? maybeContent : targetLang);

    setTranslationsByMsgId(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] || {}),
        isLoading: true,
        showTranslated: true,
        targetLang: tLang
      }
    }));

    try {
      const result = await executeTranslation(textToTranslate, tLang, token);
      if (result && result.translatedText) {
        setTranslationsByMsgId(prev => ({
          ...prev,
          [msgId]: {
            translatedText: result.translatedText,
            sourceLang: result.sourceLang || 'auto',
            targetLang: tLang,
            showTranslated: true,
            isLoading: false
          }
        }));
      } else {
        setTranslationsByMsgId(prev => ({
          ...prev,
          [msgId]: {
            ...(prev[msgId] || {}),
            isLoading: false
          }
        }));
      }
    } catch (err) {
      console.error('Translation error:', err);
      setTranslationsByMsgId(prev => ({
        ...prev,
        [msgId]: {
          ...(prev[msgId] || {}),
          isLoading: false
        }
      }));
    }
  }, [targetLang, token, messages]);

  const handleToggleTranslation = useCallback((msgId) => {
    setTranslationsByMsgId(prev => {
      if (!prev[msgId]) return prev;
      return {
        ...prev,
        [msgId]: {
          ...prev[msgId],
          showTranslated: prev[msgId].showTranslated === false ? true : false
        }
      };
    });
  }, []);

  const handleTranslateDraft = useCallback(async () => {
    if (!text || !text.trim() || isTranslatingDraft) return;
    setIsTranslatingDraft(true);
    try {
      const result = await executeTranslation(text.trim(), targetLang, token);
      if (result && result.translatedText) {
        setText(result.translatedText);
        setActionToast(`Draft translated to ${targetLang.toUpperCase()} ✨`);
        setTimeout(() => setActionToast(''), 2500);
      }
    } catch (err) {
      console.error('Draft translation error:', err);
    } finally {
      setIsTranslatingDraft(false);
    }
  }, [text, isTranslatingDraft, targetLang, token]);

  useEffect(() => {
    if (!isAutoTranslateActive || !messages || messages.length === 0) return;
    const latestIncoming = messages.slice(-5).filter(m => 
      m && 
      m.id && 
      m.senderId !== user?.id && 
      m.content && 
      typeof m.content === 'string' &&
      m.type !== 'deleted' &&
      !translationsByMsgId[m.id]?.translatedText &&
      !translationsByMsgId[m.id]?.isLoading
    );
    latestIncoming.forEach(msg => {
      handleTranslateMessage(msg);
    });
  }, [messages, isAutoTranslateActive, user?.id, handleTranslateMessage, translationsByMsgId]);

  const deduplicatedMessages = useMemo(() => {
    const seen = new Set();
    const deduped = [];
    for (const m of messages) {
      const pKey = m.id ? String(m.id) : (m._id ? String(m._id) : (m.clientTempId ? String(m.clientTempId) : null));
      const tKey = m.clientTempId ? String(m.clientTempId) : null;
      if (pKey && seen.has(pKey)) continue;
      if (tKey && seen.has(tKey)) continue;
      if (pKey) seen.add(pKey);
      if (tKey) seen.add(tKey);
      deduped.push(m);
    }
    return deduped;
  }, [messages]);

  // Reply state (WhatsApp style)
  const [replyTo, setReplyTo] = useState(null);
  const replyInputRef = useRef(null);

  // Track if this is the initial load (to use instant scroll vs smooth scroll)
  const isInitialLoad = useRef(true);
  const loadedChatIdRef = useRef(null);
  const lastRenderedLastMsgIdRef = useRef(null);
  const scrollPositionRef = useRef({ prevScrollHeight: 0, prevScrollTop: 0, isPrepending: false });

  // Multi-Select & Clear Chat states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState([]);
  const [clearedBackup, setClearedBackup] = useState([]);
  const [clearedUndoSecs, setClearedUndoSecs] = useState(0);
  const [multiDeleteBackupIds, setMultiDeleteBackupIds] = useState([]);
  const [multiDeleteUndoSecs, setMultiDeleteUndoSecs] = useState(0);
  // WhatsApp-Style Message Selection, Context Bar & Reactions states
  const [selectedActionMessages, setSelectedActionMessages] = useState([]);
  const selectedActionMessage = selectedActionMessages.length === 1 ? selectedActionMessages[0] : null;
  const isActionSelectionMode = selectedActionMessages.length > 0;
  const [starredMsgIds, setStarredMsgIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`pulsechat_starred_${chatId}`) || '[]');
    } catch (e) {
      return [];
    }
  });
  const [pinnedMessage, setPinnedMessage] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`pulsechat_pinned_${chatId}`) || 'null');
    } catch (e) {
      return null;
    }
  });
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showMessageInfoModal, setShowMessageInfoModal] = useState(false);
  const [showUnlimitedEmojiPicker, setShowUnlimitedEmojiPicker] = useState(false);
  const [actionMessageForEmoji, setActionMessageForEmoji] = useState(null);
  const [showActionMoreMenu, setShowActionMoreMenu] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [deleteModalMessages, setDeleteModalMessages] = useState(null);
  const [showCustomizeReactionsModal, setShowCustomizeReactionsModal] = useState(false);

  // Sync starred & pinned when chatId changes
  useEffect(() => {
    try {
      setStarredMsgIds(JSON.parse(localStorage.getItem(`pulsechat_starred_${chatId}`) || '[]'));
    } catch (e) {
      setStarredMsgIds([]);
    }
    try {
      setPinnedMessage(JSON.parse(localStorage.getItem(`pulsechat_pinned_${chatId}`) || 'null'));
    } catch (e) {
      setPinnedMessage(null);
    }
    setSelectedActionMessages([]);
    setShowActionMoreMenu(false);
    setShowUnlimitedEmojiPicker(false);
    setDeleteModalMessages(null);
  }, [chatId]);

  // Listener to dismiss selected message action via backdrop, back button or Esc
  useEffect(() => {
    const handleDismissAction = () => {
      setSelectedActionMessages([]);
      setShowActionMoreMenu(false);
      setShowUnlimitedEmojiPicker(false);
      setDeleteModalMessages(null);
    };
    window.addEventListener('pulsechat_dismiss_message_action', handleDismissAction);
    return () => window.removeEventListener('pulsechat_dismiss_message_action', handleDismissAction);
  }, []);

  // Cooldown timer state (10s delayed send option)
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [cooldownMsg, setCooldownMsg] = useState(null);

  // Chat settings & block status
  const [chatSetting, setChatSetting] = useState({ disappearingEnabled: false, nicknames: {}, vanishMode: false });
  const [blockStatus, setBlockStatus] = useState({ isBlockedByMe: false, isBlockedByThem: false });

  // Sync vanishMode state from chatSetting
  useEffect(() => {
    if (chatSetting?.vanishMode !== undefined) {
      const mode = Boolean(chatSetting.vanishMode);
      setIsVanishMode(mode);
      isVanishModeRef.current = mode;
    }
  }, [chatSetting?.vanishMode]);

  const handleToggleVanishMode = async () => {
    const nextVal = !isVanishMode;
    setIsVanishMode(nextVal);
    isVanishModeRef.current = nextVal;
    setChatSetting(prev => ({ ...prev, vanishMode: nextVal }));

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 60, 40]); } catch {}
    }
    setActionToast(nextVal ? '👻 Vanish Mode turned ON' : '✨ Vanish Mode turned OFF');
    setTimeout(() => setActionToast(''), 2500);

    try {
      const curToken = localStorage.getItem('pulsechat_token');
      await fetch(`${BACKEND_URL}/api/messages/settings/${encodeURIComponent(chatId)}/vanish`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${curToken}`
        },
        body: JSON.stringify({ enabled: nextVal })
      });
      if (socket) {
        socket.emit('toggle_vanish_mode', { chatId, enabled: nextVal, userId: user?.id });
      }
    } catch (err) {
      console.error('Failed to toggle vanish mode:', err);
    }
  };

  // Instagram-style swipe up to toggle Vanish Mode (Deliberate deep swipe only)
  const handleVanishTouchStart = (e) => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Strictly at the very bottom (<= 5px) to prevent triggering during normal message browsing
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 5;
    if (isAtBottom && e.touches && e.touches[0]) {
      vanishTouchStartYRef.current = e.touches[0].clientY;
      vanishTouchLastYRef.current = e.touches[0].clientY;
      isVanishSwipeActiveRef.current = true;
    } else {
      isVanishSwipeActiveRef.current = false;
      vanishTouchStartYRef.current = null;
    }
  };

  const handleVanishTouchMove = (e) => {
    if (!isVanishSwipeActiveRef.current || !vanishTouchStartYRef.current || !e.touches || !e.touches[0]) return;
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If user is actually scrolling upwards through messages history, cancel vanish swipe immediately!
    if (scrollHeight - scrollTop - clientHeight > 15) {
      isVanishSwipeActiveRef.current = false;
      vanishTouchStartYRef.current = null;
      setSwipeUpDist(0);
      return;
    }

    const curY = e.touches[0].clientY;
    vanishTouchLastYRef.current = curY;
    const deltaY = vanishTouchStartYRef.current - curY; // positive = dragging UP
    if (deltaY > 35) {
      setSwipeUpDist(Math.min(deltaY, 160));
    } else {
      setSwipeUpDist(0);
    }
  };

  const handleVanishTouchEnd = () => {
    if (isVanishSwipeActiveRef.current && vanishTouchStartYRef.current && vanishTouchLastYRef.current) {
      const deltaY = vanishTouchStartYRef.current - vanishTouchLastYRef.current;
      // High deliberate swipe threshold (140px) matching Instagram Vanish mode
      if (deltaY >= 140) {
        handleToggleVanishMode();
      }
    }
    isVanishSwipeActiveRef.current = false;
    vanishTouchStartYRef.current = null;
    vanishTouchLastYRef.current = null;
    setSwipeUpDist(0);
  };

  const socketRef = useRef(socket);
  socketRef.current = socket;
  const activeChatIdRef = useRef(chatId);
  activeChatIdRef.current = chatId;

  const triggerEvaporateVanishMessages = useCallback((targetChatId) => {
    const cid = targetChatId || activeChatIdRef.current;
    if (!cid) return;

    // 0ms Synchronous local purge: Immediately purge isVanish messages from memory and localStorage cache
    setMessages(prev => {
      const nonVanish = prev.filter(m => !m?.isVanish);
      return nonVanish;
    });

    const relatedKeys = [
      cid,
      cid.includes('_') ? cid.split('_').reverse().join('_') : null,
      cid.includes('_') ? cid.split('_').sort().join('_') : null
    ].filter(Boolean);

    relatedKeys.forEach(key => {
      try {
        const cached = getCachedMessages(key);
        if (Array.isArray(cached) && cached.some(m => m?.isVanish)) {
          const cleaned = cached.filter(m => !m?.isVanish);
          setCachedMessages(key, cleaned);
        }
      } catch (err) {}
    });

    try {
      const curToken = localStorage.getItem('pulsechat_token');
      if (curToken) {
        fetch(`${BACKEND_URL}/api/messages/vanish/${encodeURIComponent(cid)}/evaporate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${curToken}` },
          keepalive: true
        }).catch(() => {});
      }
      if (socketRef.current) {
        socketRef.current.emit('evaporate_vanish_messages', { chatId: cid });
      }
    } catch (e) {}
  }, []);

  // Permanent Auto-evaporate vanish messages ONLY on chat exit / close / switch
  useEffect(() => {
    const activeChatOnMount = chatId;

    const handleWindowExit = () => {
      const hasVanishMessages = (messagesRef.current || []).some(m => m?.isVanish);
      if (isVanishModeRef.current || hasVanishMessages) {
        triggerEvaporateVanishMessages(activeChatOnMount);
      }
    };

    window.addEventListener('beforeunload', handleWindowExit);
    window.addEventListener('pagehide', handleWindowExit);

    return () => {
      window.removeEventListener('beforeunload', handleWindowExit);
      window.removeEventListener('pagehide', handleWindowExit);

      // This cleanup runs ONLY when this ChatWindow unmounts or activeChatOnMount changes (chat switch/exit)
      const hasVanishMessages = (messagesRef.current || []).some(m => m?.isVanish);
      if (isVanishModeRef.current || hasVanishMessages) {
        triggerEvaporateVanishMessages(activeChatOnMount);
      }
    };
  }, [chatId, triggerEvaporateVanishMessages]);

  // Sync draft text on chatId change
  useEffect(() => {
    if (!chatId) return;
    try {
      const savedDraft = localStorage.getItem(`pulsechat_draft_${chatId}`) || '';
      setText(savedDraft);
    } catch {}
  }, [chatId]);

  // In-Chat Mutual Nicknames
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const partnerNickname = useMemo(() => {
    if (!isGroup && chatSetting?.nicknames && typeof chatSetting.nicknames === 'object') {
      const keys = [activeChat?.id, activeChat?._id, activeChat?.userId, activeChat?.username, partnerId].filter(Boolean).map(String);
      for (const k of keys) {
        const val = chatSetting.nicknames[k];
        if (typeof val === 'string' && val.trim()) return val.trim();
      }
    }
    return null;
  }, [isGroup, partnerId, activeChat?.id, activeChat?._id, activeChat?.userId, activeChat?.username, chatSetting?.nicknames]);

  const myNicknameInChat = useMemo(() => {
    if (!isGroup && chatSetting?.nicknames && typeof chatSetting.nicknames === 'object') {
      const keys = [user?.id, user?._id, user?.username].filter(Boolean).map(String);
      for (const k of keys) {
        const val = chatSetting.nicknames[k];
        if (typeof val === 'string' && val.trim()) return val.trim();
      }
    }
    return null;
  }, [isGroup, user?.id, user?._id, user?.username, chatSetting?.nicknames]);

  // Pulse Streaks, Sparks Reward & Freeze Shield
  const [streakData, setStreakData] = useState({ streakCount: 0, streakShields: 0, lastStreakDate: null });
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [screenshotAlert, setScreenshotAlert] = useState(null);

  useEffect(() => {
    if (!chatId || isGroup) return;
    let isMounted = true;
    const fetchStreak = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages/settings/${encodeURIComponent(chatId)}/streak`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && (data?.success || data?.streakCount !== undefined)) {
            setStreakData({
              streakCount: data.streakCount || 0,
              streakShields: data.shields !== undefined ? data.shields : (data.streakShields || 0),
              lastStreakDate: data.lastStreakDate || null
            });
          }
        }
      } catch (e) {}
    };
    fetchStreak();
    return () => { isMounted = false; };
  }, [chatId, isGroup, token]);

  useEffect(() => {
    const handleOpenNicknameModal = () => {
      if (!isGroup) {
        setShowNicknameModal(true);
      }
    };
    window.addEventListener('pulsechat_open_nickname_modal', handleOpenNicknameModal);
    return () => window.removeEventListener('pulsechat_open_nickname_modal', handleOpenNicknameModal);
  }, [isGroup]);

  useEffect(() => {
    if (!socket) return;
    const handleStreakUpdate = (data) => {
      const isMatch = !data.chatId || data.chatId === chatId || 
        (chatId && data.chatId.includes('_') && chatId.includes('_') &&
         data.chatId.split('_').sort().join('_') === chatId.split('_').sort().join('_'));
      if (isMatch) {
        setStreakData(prev => ({
          ...prev,
          streakCount: data.streakCount !== undefined ? data.streakCount : prev.streakCount,
          streakShields: data.shields !== undefined ? data.shields : (data.streakShields !== undefined ? data.streakShields : prev.streakShields),
          lastStreakDate: data.lastStreakDate || prev.lastStreakDate
        }));
      }
    };

    const handleStreakReward = (data) => {
      if (data.chatId === chatId && (data.userId === currentUserId || data.userId === user?.id)) {
        setActionToast(`🔥 Streak Milestone! +${data.rewardSparks} Sparks reward added!`);
        setTimeout(() => setActionToast(''), 4500);
        try { playSound('notification'); } catch (e) {}
      }
    };

    const handleScreenshotAlert = (data) => {
      if (data.chatId === chatId) {
        setScreenshotAlert({
          takerName: data.takerName || 'Someone',
          timestamp: data.timestamp || Date.now()
        });
        try { playSound('notification'); } catch (e) {}
        setTimeout(() => setScreenshotAlert(null), 8000);
      }
    };

    socket.on('streak_updated', handleStreakUpdate);
    socket.on('streak_sparks_reward', handleStreakReward);
    socket.on('snap_screenshot_alert', handleScreenshotAlert);

    return () => {
      socket.off('streak_updated', handleStreakUpdate);
      socket.off('streak_sparks_reward', handleStreakReward);
      socket.off('snap_screenshot_alert', handleScreenshotAlert);
    };
  }, [socket, chatId, currentUserId, user?.id]);

  // Pagination for infinite fast scroll
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const isLoadingOlderRef = useRef(false);

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
      const detail = e.detail || {};
      const targetChatId = detail.chatId;
      const isMatchChat = !targetChatId || targetChatId === chatId || (typeof targetChatId === 'string' && (targetChatId.includes(chatId) || chatId.includes(targetChatId)));
      const idsToFilter = new Set([detail.messageId, detail.messageMongoId, detail.clientTempId].filter(Boolean).map(String));

      if (isMatchChat && idsToFilter.size > 0) {
        setMessages(prev => {
          const updated = prev.filter(m =>
            !idsToFilter.has(String(m.id)) &&
            !idsToFilter.has(String(m._id)) &&
            (!m.clientTempId || !idsToFilter.has(String(m.clientTempId)))
          );
          try {
            setCachedMessages(chatId, updated);
            localStorage.setItem(`pulsechat_msgs_${chatId}`, JSON.stringify(updated));
            if (chatId.includes('_')) {
              const parts = chatId.split('_');
              localStorage.setItem(`pulsechat_msgs_${parts[1]}_${parts[0]}`, JSON.stringify(updated));
            }
            if (updated.length > 0 && user?.id) {
              const lastMsg = updated[updated.length - 1];
              updateRecentChatSnippet(user.id, chatId, lastMsg, activeChat);
            }
          } catch (err) {}
          return updated;
        });
      }
    };

    const handleChatMusicUpdated = (e) => {
      if (isMatchingChatId(e.detail?.chatId, chatId)) {
        const song = e.detail.song || null;
        setChatMusicSong(song);
        try {
          if (song) {
            localStorage.setItem(`pulsechat_music_${chatId}`, JSON.stringify(song));
          } else {
            localStorage.removeItem(`pulsechat_music_${chatId}`);
          }
        } catch (err) {}
      }
    };

    const handleChatMusicAction = (e) => {
      const data = e.detail;
      if (!data || !isMatchingChatId(data.chatId, chatId)) return;
      if (String(data.senderId) === String(user?.id)) return;

      if (data.action === 'play') {
        if (chatAudioRef.current) {
          if (typeof data.currentTime === 'number' && Math.abs(chatAudioRef.current.currentTime - data.currentTime) > 1.5) {
            chatAudioRef.current.currentTime = data.currentTime;
            setSongProgress(data.currentTime);
          }
          chatAudioRef.current.play().then(() => {
            setIsSongPlaying(true);
            window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: true } }));
          }).catch(() => {});
        }
      } else if (data.action === 'pause') {
        if (chatAudioRef.current) {
          chatAudioRef.current.pause();
          if (typeof data.currentTime === 'number') {
            chatAudioRef.current.currentTime = data.currentTime;
            setSongProgress(data.currentTime);
          }
          setIsSongPlaying(false);
          window.dispatchEvent(new CustomEvent('pulsechat_chat_music_playing', { detail: { isPlaying: false } }));
        }
      } else if (data.action === 'seek') {
        if (chatAudioRef.current && typeof data.currentTime === 'number') {
          chatAudioRef.current.currentTime = data.currentTime;
          setSongProgress(data.currentTime);
        }
      }
    };

    window.addEventListener('pulsechat_aura_changed', handleAuraChange);
    window.addEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);
    window.addEventListener('pulsechat_music_updated', handleChatMusicUpdated);
    window.addEventListener('pulsechat_music_action', handleChatMusicAction);

    return () => {
      window.removeEventListener('pulsechat_aura_changed', handleAuraChange);
      window.removeEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);
      window.removeEventListener('pulsechat_music_updated', handleChatMusicUpdated);
      window.removeEventListener('pulsechat_music_action', handleChatMusicAction);
      stopPulseAuraSound();
    };
  }, [chatId, auraVolume, user?.id]);

  useEffect(() => {
    const handleOpenWallet = () => setShowSparksWallet(true);
    window.addEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
    return () => window.removeEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
  }, []);

  const handleSelectAura = (auraId) => {
    if (auraId !== 'off' && auraId !== 'waves' && !user?.isPro) {
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
    const isPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
    const sparksBalance = user?.pulseSparks ?? 0;

    if (!isPro && sparksBalance < 5) {
      alert(`⚡ Insufficient Sparks\nDust Text requires 5 Sparks.\nYour balance: ${sparksBalance} Sparks.\n\nEarn Sparks via Daily Bonus or Sparks Wallet.`);
      return;
    }

    const dustText = prompt(`⚡ Enter your Dust Text Secret Note:\n(It will render blurred until recipient holds down, then shatters into digital dust)\n\n${isPro ? "👑 VIP Member: FREE (0 Sparks)" : "⚡ Cost: 5 Sparks (Balance: " + sparksBalance + ")"}`);
    if (!dustText || !dustText.trim()) return;

    if (!isPro && updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: Math.max(0, sparksBalance - 5) });
    }

    const isOnlineNow = isDeviceOnline() && Boolean(socket?.connected);
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
      status: isOnlineNow ? 'sent' : 'pending',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, msgData]);
    appendCachedMessage(chatId, msgData);
    updateRecentChatSnippet(user.id, chatId, msgData, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    playSound('sent');

    if (!isOnlineNow) {
      addToOutbox(user.id, msgData);
      return;
    }

    if (socket) {
      socket.emit('send_message', msgData);
    }
  };

  const handleTriggerEmojiBurst = (emoji = '🔥') => {
    if (!emoji || !emoji.trim()) return;
    const cleanEmoji = emoji.trim();
    setShowActionGrid(false);
    setShowEmojiBurstPicker(false);

    const isPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
    const sparksBalance = user?.pulseSparks ?? 0;

    if (!isPro && sparksBalance < 5) {
      alert(`⚡ Insufficient Sparks\nEmoji Rain requires 5 Sparks.\nYour balance: ${sparksBalance} Sparks.\n\nEarn free Sparks by watching Ads in Sparks Wallet, or upgrade to Pulse Pro!`);
      setShowSparksWallet(true);
      return;
    }

    if (!isPro && updateUserProfile && sparksBalance >= 5) {
      updateUserProfile({ ...user, pulseSparks: Math.max(0, sparksBalance - 5) });
    }

    if (socket) {
      socket.emit('trigger_emoji_burst', { chatId, emoji: cleanEmoji, userId: user?.id });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', { detail: { emoji: cleanEmoji, mode: 'burst', duration: 7, chatId } }));
    }
  };

  // Close 4-dot action grid on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        actionGridRef.current &&
        !actionGridRef.current.contains(e.target) &&
        actionGridBtnRef.current &&
        !actionGridBtnRef.current.contains(e.target)
      ) {
        setShowActionGrid(false);
      }
    };
    if (showActionGrid) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [showActionGrid]);

  // Automatic Outbox Sync when network or socket reconnects
  const isSyncingOutboxRef = useRef(false);
  const activeSyncIdsRef = useRef(new Set());

  const syncOutbox = useCallback(() => {
    if (isSyncingOutboxRef.current) return;
    if (!user?.id || !socket || !socket.connected) return;
    const outbox = getOutbox(user.id);
    if (!outbox || outbox.length === 0) return;

    isSyncingOutboxRef.current = true;
    try {
      outbox.forEach((pendingMsg) => {
        const msgKey = pendingMsg.id || pendingMsg.clientTempId || pendingMsg.tempId;
        if (!msgKey || activeSyncIdsRef.current.has(msgKey)) return;
        activeSyncIdsRef.current.add(msgKey);

        // Smart Offline Queue: If pending voice note needs upload
        if (pendingMsg.type === 'voice') {
          (async () => {
            try {
              let finalAudio = pendingMsg.audioDataUrl || pendingMsg.audioUrl;
              if (finalAudio && finalAudio.startsWith('data:')) {
                try {
                  finalAudio = await uploadMediaDirect(finalAudio, 'pulsechat_voice', token);
                } catch (e) {
                  console.warn('Voice outbox upload error:', e);
                }
              }
              socket.emit('send_message', {
                ...getSenderPayload(),
                chatId: pendingMsg.chatId,
                senderId: pendingMsg.senderId || user.id,
                receiverId: pendingMsg.receiverId,
                isGroup: pendingMsg.isGroup,
                audioUrl: finalAudio,
                type: 'voice',
                voiceFilter: pendingMsg.voiceFilter || null,
                clientTempId: msgKey,
                replyTo: pendingMsg.replyTo
              });
              if (pendingMsg.chatId && msgKey) {
                updateCachedMessageStatus(pendingMsg.chatId, msgKey, { status: 'sent', audioUrl: finalAudio });
              }
              removeFromOutbox(user.id, msgKey);
              if (pendingMsg.id) removeFromOutbox(user.id, pendingMsg.id);
              if (pendingMsg.clientTempId) removeFromOutbox(user.id, pendingMsg.clientTempId);
              setMessages(prev => prev.map(m =>
                (m.id === msgKey || m.clientTempId === msgKey) ? { ...m, status: 'sent', audioUrl: finalAudio } : m
              ));
            } finally {
              activeSyncIdsRef.current.delete(msgKey);
            }
          })();
          return;
        }

        // Smart Offline Queue: If pending photo / video / document needs upload
        if (pendingMsg.needsUpload && (pendingMsg.mediaDataUrl || pendingMsg.mediaUrl)) {
          (async () => {
            try {
              let finalMedia = pendingMsg.mediaDataUrl || pendingMsg.mediaUrl;
              if (finalMedia && finalMedia.startsWith('data:')) {
                try {
                  const curToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('pulsechat_token') || '') : '');
                  finalMedia = await uploadMediaDirect(finalMedia, 'pulsechat_media', curToken, pendingMsg.type === 'video');
                } catch (e) {
                  console.warn('Media outbox upload error:', e);
                }
              }
              socket.emit('send_message', {
                ...getSenderPayload(),
                chatId: pendingMsg.chatId,
                senderId: pendingMsg.senderId || user.id,
                receiverId: pendingMsg.receiverId,
                isGroup: pendingMsg.isGroup,
                mediaUrl: finalMedia,
                type: pendingMsg.type || 'image',
                fileName: pendingMsg.fileName,
                fileSize: pendingMsg.fileSize,
                clientTempId: msgKey,
                replyTo: pendingMsg.replyTo,
                isFogSnap: pendingMsg.isFogSnap,
                isDustImage: pendingMsg.isDustImage,
                fogSnapDuration: pendingMsg.fogSnapDuration,
                fogSnapStatus: pendingMsg.fogSnapStatus,
                isViewOnce: pendingMsg.isViewOnce,
                isViewTwice: pendingMsg.isViewTwice,
                viewLimit: pendingMsg.viewLimit,
                content: pendingMsg.content
              });
              if (pendingMsg.chatId && msgKey) {
                updateCachedMessageStatus(pendingMsg.chatId, msgKey, { status: 'sent', mediaUrl: finalMedia });
              }
              removeFromOutbox(user.id, msgKey);
              if (pendingMsg.id) removeFromOutbox(user.id, pendingMsg.id);
              if (pendingMsg.clientTempId) removeFromOutbox(user.id, pendingMsg.clientTempId);
              setMessages(prev => prev.map(m =>
                (m.id === msgKey || m.clientTempId === msgKey) ? { ...m, status: 'sent', mediaUrl: finalMedia } : m
              ));
            } finally {
              activeSyncIdsRef.current.delete(msgKey);
            }
          })();
          return;
        }

        // Standard text message queue
        removeFromOutbox(user.id, msgKey);
        if (pendingMsg.id) removeFromOutbox(user.id, pendingMsg.id);
        if (pendingMsg.clientTempId) removeFromOutbox(user.id, pendingMsg.clientTempId);
        if (pendingMsg.tempId) removeFromOutbox(user.id, pendingMsg.tempId);
        activeSyncIdsRef.current.delete(msgKey);

        socket.emit('send_message', {
          ...getSenderPayload(),
          chatId: pendingMsg.chatId,
          senderId: pendingMsg.senderId || user.id,
          receiverId: pendingMsg.receiverId,
          isGroup: pendingMsg.isGroup,
          isForwarded: pendingMsg.isForwarded || false,
          content: pendingMsg.content,
          type: pendingMsg.type || 'text',
          textStyle: pendingMsg.textStyle,
          audioUrl: pendingMsg.audioUrl,
          mediaUrl: pendingMsg.mediaUrl,
          fileName: pendingMsg.fileName,
          fileSize: pendingMsg.fileSize,
          pollData: pendingMsg.pollData,
          replyTo: pendingMsg.replyTo,
          isFogSnap: pendingMsg.isFogSnap,
          isDustImage: pendingMsg.isDustImage,
          fogSnapDuration: pendingMsg.fogSnapDuration,
          fogSnapStatus: pendingMsg.fogSnapStatus,
          isViewOnce: pendingMsg.isViewOnce,
          isViewTwice: pendingMsg.isViewTwice,
          viewLimit: pendingMsg.viewLimit,
          clientTempId: pendingMsg.clientTempId || pendingMsg.tempId || pendingMsg.id
        });

        // Optimistically update message status to 'sent'
        if (pendingMsg.chatId && msgKey) {
          updateCachedMessageStatus(pendingMsg.chatId, msgKey, 'sent');
        }
        setMessages(prev => prev.map(m =>
          (m.id === msgKey || m.clientTempId === msgKey || m.tempId === msgKey || (pendingMsg.id && m.id === pendingMsg.id))
            ? { ...m, status: 'sent' }
            : m
        ));
      });
    } finally {
      isSyncingOutboxRef.current = false;
    }
  }, [user?.id, socket, token, getSenderPayload]);

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

  // Background Runner for Scheduled Messages (checks every 5s)
  useEffect(() => {
    const checkScheduled = () => {
      try {
        const raw = localStorage.getItem('pulsechat_scheduled_messages');
        if (!raw) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return;

        const now = Date.now();
        const due = list.filter(item => item.scheduledTimestamp <= now);
        if (due.length === 0) return;

        const remaining = list.filter(item => item.scheduledTimestamp > now);
        localStorage.setItem('pulsechat_scheduled_messages', JSON.stringify(remaining));
        setScheduledList(remaining);

        due.forEach(item => {
          const clientTempId = 'sched_sent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const isOnlineNow = isDeviceOnline() && Boolean(socket?.connected);
          const newMsg = {
            id: clientTempId,
            clientTempId,
            chatId: item.chatId,
            senderId: item.senderId,
            receiverId: item.receiverId,
            isGroup: item.isGroup,
            content: item.text,
            type: 'text',
            status: isOnlineNow ? 'sent' : 'pending',
            timestamp: new Date().toISOString(),
            reactions: {}
          };

          if (item.chatId === chatId) {
            setMessages(prev => [...prev, newMsg]);
            appendCachedMessage(chatId, newMsg);
            scrollToBottom('smooth');
          } else {
            appendCachedMessage(item.chatId, newMsg);
          }

          if (!isOnlineNow) {
            addToOutbox(user?.id || item.senderId, newMsg);
            playSound('sent');
            setActionToast(`⏰ Scheduled message ready in Outbox (Offline): "${item.text.slice(0, 22)}..."`);
            setTimeout(() => setActionToast(''), 3500);
            return;
          }

          if (socket) {
            socket.emit('send_message', {
              ...getSenderPayload(),
              clientTempId,
              chatId: item.chatId,
              senderId: item.senderId,
              receiverId: item.receiverId,
              isGroup: item.isGroup,
              content: item.text,
              type: 'text'
            });
          }

          playSound('sent');
          setActionToast(`⏰ Scheduled message sent: "${item.text.slice(0, 22)}..."`);
          setTimeout(() => setActionToast(''), 3500);
        });
      } catch (e) {
        console.warn('Scheduled messages runner error:', e);
      }
    };

    const interval = setInterval(checkScheduled, 5000);
    checkScheduled();
    return () => clearInterval(interval);
  }, [chatId, socket]);

  // Close 3-dots more menu ONLY on genuine outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e) => {
      // 1. Check if click was inside container via ref
      if (moreMenuRef.current && moreMenuRef.current.contains(e.target)) {
        return;
      }
      // 2. Check composedPath in case child element unmounted during state change
      if (e.composedPath) {
        const path = e.composedPath();
        if (moreMenuRef.current && path.includes(moreMenuRef.current)) {
          return;
        }
        if (path.some(el => el.classList && el.classList.contains('chat-header-more-container'))) {
          return;
        }
      }
      // 3. Fallback closest check
      if (e.target && e.target.closest && e.target.closest('.chat-header-more-container')) {
        return;
      }

      // Truly outside click: close menu and reset submenu
      setShowMoreMenu(false);
      setMoreSubMenuOpen(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showMoreMenu]);

  // Load message history & group details
  useEffect(() => {
    const isDifferentChat = loadedChatIdRef.current !== chatId;
    loadedChatIdRef.current = chatId;

    if (isDifferentChat) {
      // Chat badle toh reply aur initial scroll flag reset karo
      isInitialLoad.current = true;
      isPinnedToBottomRef.current = true;
      setShowScrollBottom(false);
      showScrollBottomRef.current = false;
      lastRenderedLastMsgIdRef.current = null;
      scrollPositionRef.current = { prevScrollHeight: 0, prevScrollTop: 0, isPrepending: false };
      setReplyTo(null);
      setChatSetting({ disappearingEnabled: false });
      setBlockStatus({ isBlockedByMe: false, isBlockedByThem: false });
    }

    if (activeChat) {
      if (isDifferentChat) {
        // 1. Instantly display cached messages from local storage (0ms sync)
        const cached = getCachedMessages(chatId, user?.id);
        const outbox = getOutbox(user?.id);
        const pendingForThisChat = outbox.filter(m => m.chatId === chatId);
        const cachedIds = new Set(cached.map(m => m.id));
        const combinedInitial = [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))].map(sanitizeFogSnapMessage).filter(Boolean);
        setMessages(combinedInitial);

        // 2. If memory/localStorage cache was empty on cold start, check IndexedDB once
        if (cached.length === 0) {
          getCachedMessagesFromLocalDb(chatId, 50).then((dbMsgs) => {
            if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
              const deletedIds = getDeletedForMeIds(user?.id);
              const validMsgs = dbMsgs.filter(m => !deletedIds.has(String(m.id)) && !deletedIds.has(String(m._id)));
              if (validMsgs.length > 0) {
                setMessages(validMsgs.map(sanitizeFogSnapMessage).filter(Boolean));
              }
            }
          }).catch(() => {});
        }
      }

      // Cache this contact/group into allUsers for future offline searches
      if (user?.id && !activeChat.isGroup) {
        mergeIntoAllUsersCache(user.id, [{ ...activeChat, avatar: chatAvatar || activeChat.avatar }]);
      }

      // 2. Fetch fresh messages: WhatsApp-style Local-First Delta Sync!
      const cached = getCachedMessages(chatId, user?.id);
      let latestCachedTime = null;
      if (cached && cached.length > 0) {
        const lastMsg = cached[cached.length - 1];
        latestCachedTime = lastMsg?.timestamp || lastMsg?.createdAt || null;
      }

      // If local cache already exists, only query messages sent AFTER latestCachedTime!
      const queryParam = latestCachedTime 
        ? `since=${encodeURIComponent(latestCachedTime)}` 
        : 'limit=50';
      const isCurrentGhost = checkGhostModeActive();

      fetch(`${BACKEND_URL}/api/messages/${chatId}?${queryParam}${isCurrentGhost ? '&ghost=true' : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isCurrentGhost ? { 'x-ghost-mode': 'true' } : {})
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Delta Sync Optimization: If cache had latest messages and server returns 0,
            // we are 100% up-to-date locally (0ms, 0 re-render, 0 database load)!
            if (latestCachedTime && data.length === 0) {
              return;
            }

            // Filter out any locally deleted messages
            const deletedForMe = getDeletedForMeIds(user?.id);
            const serverMsgs = data.filter(m => !deletedForMe.has(String(m.id)) && !deletedForMe.has(String(m._id)));

            // If delta new messages arrived, append and merge into local IndexedDB cache
            if (latestCachedTime && serverMsgs.length > 0) {
              const baseNow = getCachedMessages(chatId, user?.id);
              const deltaMap = new Map();
              baseNow.forEach(m => deltaMap.set(m.clientTempId || m.id, m));
              serverMsgs.forEach(m => {
                if (m.clientTempId) deltaMap.delete(m.clientTempId);
                if (m.tempId) deltaMap.delete(m.tempId);
                deltaMap.set(m.id, m);
              });
              const deltaMerged = Array.from(deltaMap.values())
                .sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0))
                .map(sanitizeFogSnapMessage)
                .filter(Boolean);
              setMessages(deltaMerged);
              setCachedMessages(chatId, deltaMerged);
              return;
            }

            const noMore = localStorage.getItem(`pulsechat_nomore_${chatId}`) === 'true';
            setHasMoreOlderMessages(!noMore && data.length >= 50);
            const currentOutbox = getOutbox(user?.id);
            const pendingForChat = currentOutbox.filter(m => m.chatId === chatId);
            const serverIds = new Set(serverMsgs.map(m => m.id));

            // Retain any pending messages from outbox
            const pendingMap = new Map();
            pendingForChat.forEach(p => {
              const k = p.clientTempId || p.id;
              if (!serverIds.has(p.id) && !serverIds.has(p.clientTempId)) {
                pendingMap.set(k, p);
              }
            });

            // Retain older scrolled messages, but DO NOT resurrect deleted messages from cache that server omitted!
            const cachedNow = getCachedMessages(chatId, user?.id);
            const messageMap = new Map();

            // If server returned messages, only retain cached messages that are older than the server window
            if (serverMsgs.length > 0) {
              const oldestServerTime = new Date(serverMsgs[0].timestamp || serverMsgs[0].createdAt || 0).getTime();
              cachedNow.forEach(c => {
                const k = c.clientTempId || c.id;
                const cTime = new Date(c.timestamp || c.createdAt || 0).getTime();
                if (k && cTime < oldestServerTime) {
                  messageMap.set(k, c);
                }
              });
            }

            // Populate fresh server messages
            serverMsgs.forEach(m => {
              if (m && m.id) {
                if (m.clientTempId && messageMap.has(m.clientTempId)) {
                  messageMap.delete(m.clientTempId);
                }
                if (m.tempId && messageMap.has(m.tempId)) {
                  messageMap.delete(m.tempId);
                }
                messageMap.set(m.id, m);
              }
            });

            // Add pending outbox messages
            pendingMap.forEach((p, k) => {
              messageMap.set(k, p);
            });

            // Sort chronologically
            const merged = Array.from(messageMap.values())
              .sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0))
              .map(sanitizeFogSnapMessage)
              .filter(Boolean);

            // WhatsApp pattern: Retain any in-flight pending/uploading messages from state so they NEVER disappear!
            setMessages(prev => {
              const pendingInState = prev.filter(pm => pm && (pm.status === 'pending' || pm.status === 'uploading' || pm.isUploading));
              let finalMerged = merged;
              if (pendingInState.length > 0) {
                const finalMap = new Map();
                merged.forEach(m => finalMap.set(m.clientTempId || m.id, m));
                pendingInState.forEach(pm => {
                  const pk = pm.clientTempId || pm.tempId || pm.id;
                  if (!finalMap.has(pm.id) && !finalMap.has(pm.clientTempId)) {
                    finalMap.set(pk, pm);
                  }
                });
                finalMerged = Array.from(finalMap.values())
                  .sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0))
                  .map(sanitizeFogSnapMessage)
                  .filter(Boolean);
              }

              if (prev.length === finalMerged.length) {
                const isIdentical = prev.every((m, idx) => {
                  const o = finalMerged[idx];
                  return m.id === o?.id && m.status === o?.status && m.content === o?.content;
                });
                if (isIdentical) return prev;
              }
              return merged;
            });
            // If user was pinned to bottom before server sync or on initial load, ensure bottom anchor
            if (isPinnedToBottomRef.current || isInitialLoad.current) {
              scrollToBottom('instant');
              requestAnimationFrame(() => scrollToBottom('instant'));
            }
            setCachedMessages(chatId, merged);
          }
        })
        .catch(() => {
          // Offline: messages already loaded from cache!
        });

      // Fetch disappearing messages and chat wallpaper & theme settings
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.disappearingEnabled !== undefined || data.vanishMode !== undefined) {
              setChatSetting(data);
              if (data.vanishMode !== undefined) {
                const mode = Boolean(data.vanishMode);
                setIsVanishMode(mode);
                isVanishModeRef.current = mode;
              }
            }
            const isRecentUpdate = (Date.now() - (lastWallpaperUpdateTimestamp.current || 0)) < 4000;
            if (data.wallpaperId !== undefined) {
              const wallTrialExpired = data.wallpaperTrialExpiresAt && Date.now() >= new Date(data.wallpaperTrialExpiresAt).getTime();
              if (wallTrialExpired) {
                setChatWallpaper('none');
                setCustomWallpaper(null);
                localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
                localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
                localStorage.removeItem(`pulsechat_wallpaper_trial_${chatId}`);
              } else if (!isRecentUpdate || data.wallpaperId !== 'none') {
                setChatWallpaper(data.wallpaperId);
                localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, data.wallpaperId);
                if (data.customWallpaperUrl !== undefined) {
                  setCustomWallpaper(data.customWallpaperUrl);
                  if (data.customWallpaperUrl) {
                    localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, data.customWallpaperUrl);
                  } else {
                    localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
                  }
                }
                if (data.wallpaperTrialExpiresAt) {
                  localStorage.setItem(`pulsechat_wallpaper_trial_${chatId}`, JSON.stringify({
                    wallpaperId: data.wallpaperId,
                    expiresAt: new Date(data.wallpaperTrialExpiresAt).getTime()
                  }));
                }
              }
            }
            if (data.chatTheme) {
              const themeTrialExpired = data.themeTrialExpiresAt && Date.now() >= new Date(data.themeTrialExpiresAt).getTime();
              if (themeTrialExpired) {
                setChatTheme('midnight_amoled');
                localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
                localStorage.removeItem(`pulsechat_theme_trial_${chatId}`);
                localStorage.removeItem('pulsechat_chat_default_theme');
              } else {
                setChatTheme(data.chatTheme);
                localStorage.setItem(`pulsechat_chat_theme_${chatId}`, data.chatTheme);
                if (data.themeTrialExpiresAt) {
                  localStorage.setItem(`pulsechat_theme_trial_${chatId}`, JSON.stringify({
                    themeId: data.chatTheme,
                    expiresAt: new Date(data.themeTrialExpiresAt).getTime()
                  }));
                }
              }
            }
          }
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
      if (user?.id) {
        if (activeChat?.id) clearUnreadCount(user.id, activeChat.id);
        if (activeChat?._id) clearUnreadCount(user.id, activeChat._id);
        if (activeChat?.username) clearUnreadCount(user.id, activeChat.username);
        if (chatId) clearUnreadCount(user.id, chatId);
        if (isDifferentChat) {
          window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
        }
      }

      // Explicitly mark read / delivered via REST endpoint
      const isCurGhost = checkGhostModeActive();
      if (token && chatId) {
        fetch(`${BACKEND_URL}/api/messages/${chatId}/read${isCurGhost ? '?ghost=true' : ''}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            ...(isCurGhost ? { 'x-ghost-mode': 'true' } : {})
          }
        }).catch(() => {});
      }

      if (socket) {
        socket.emit('join_chat', chatId);
        socket.emit('mark_chat_read', { chatId, userId: user?.id, isGhost: isCurGhost });
      }
    }
  }, [chatId, activeChat?.id, isGroup, token, socket, user?.id, isGhostMode]);

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

  // Auto-Open Real-Time Features (Arrow Game, Tic-Tac-Toe, Live Drawboard, Music) Socket Listener
  useEffect(() => {
    if (!socket) return;
    const isMatchingChat = (data) => {
      if (!data || !data.chatId) return false;
      const c1 = String(chatId).replace(/_/g, '');
      const c2 = String(data.chatId).replace(/_/g, '');
      return (
        data.chatId === chatId ||
        c1 === c2 ||
        (data.chatId && data.chatId.includes(chatId)) ||
        (chatId && chatId.includes(data.chatId))
      );
    };

    const handleAutoOpenGame = (data) => {
      if (isMatchingChat(data) && data.senderId !== user?.id) {
        setShowArrowGameModal(true);
        const inviter = data.senderName || activeChat?.displayName || 'Friend';
        setActionToast(`🏹 ${inviter} ne Arrow Battle Game shuru kiya!`);
        setTimeout(() => setActionToast(''), 4000);
      }
    };
    const handleAutoOpenWhiteboard = (data) => {
      if (isMatchingChat(data) && data.senderId !== user?.id) {
        setShowWhiteboard(true);
        const inviter = data.senderName || activeChat?.displayName || 'Friend';
        setActionToast(`🎨 ${inviter} ne Live Drawboard shuru kiya!`);
        setTimeout(() => setActionToast(''), 4000);
      }
    };
    const handleAutoOpenTicTacToe = (data) => {
      if (isMatchingChat(data) && data.senderId !== user?.id) {
        setTictactoeHostId(data.senderId);
        setShowTicTacToeModal(true);
        const inviter = data.senderName || activeChat?.displayName || 'Friend';
        setActionToast(`🎮 ${inviter} ne Tic-Tac-Toe Game shuru kiya!`);
        setTimeout(() => setActionToast(''), 4000);
      }
    };
    const handleAutoOpenMusic = (data) => {
      // Do not open music popup on partner's screen; only the user who clicked gets the picker
    };

    socket.on('auto_open_arrow_game', handleAutoOpenGame);
    socket.on('auto_open_whiteboard', handleAutoOpenWhiteboard);
    socket.on('auto_open_tictactoe', handleAutoOpenTicTacToe);
    socket.on('auto_open_music', handleAutoOpenMusic);

    return () => {
      socket.off('auto_open_arrow_game', handleAutoOpenGame);
      socket.off('auto_open_whiteboard', handleAutoOpenWhiteboard);
      socket.off('auto_open_tictactoe', handleAutoOpenTicTacToe);
      socket.off('auto_open_music', handleAutoOpenMusic);
    };
  }, [socket, chatId, user?.id, activeChat?.displayName]);

  // File Transfer Limit Error Socket Listener
  useEffect(() => {
    if (!socket) return;
    const handleFileLimitError = (data) => {
      if (data && data.error) {
        alert(`⚠️ File Sharing Limit:\n\n${data.error}`);
      }
    };
    socket.on('file_limit_error', handleFileLimitError);
    return () => {
      socket.off('file_limit_error', handleFileLimitError);
    };
  }, [socket]);

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
        if (!isGhostModeRef.current) {
          socket?.emit('mark_read', { messageId: lastNotification.id, chatId });
        } else {
          socket?.emit('message_delivered', { messageId: lastNotification.id, chatId, senderId: lastNotification.senderId });
        }
      }
    }
  }, [lastNotification, chatId, user.id, socket]);

  // Fetch Friendship status for 1-to-1 chats (strictly require friendship)
  useEffect(() => {
    if (isGroup || isAnonymousBot) {
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
  }, [activeChat?.id, isGroup, token]);

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
      const otherId = data?.userId === user?.id ? data?.targetId : (data?.userId || data?.targetId);
      if (otherId === activeChat?.id || otherId === activeChat?.username) {
        setFriendshipStatus('none');
        if (user?.id) {
          const cur = getCachedFriends(user.id);
          setCachedFriends(user.id, cur.filter(f => f.id !== otherId && f._id !== otherId));
        }
      }
    };

    const handleLocalFriendRemoved = (e) => {
      const targetId = e.detail?.targetId;
      if (targetId && (targetId === activeChat?.id || targetId === activeChat?.username)) {
        setFriendshipStatus('none');
        if (user?.id) {
          const cur = getCachedFriends(user.id);
          setCachedFriends(user.id, cur.filter(f => f.id !== targetId && f._id !== targetId));
        }
      }
    };

    socket.on('friend_request_accepted', handleReqAccepted);
    socket.on('friend_request_received', handleReqReceived);
    socket.on('friend_request_cancelled', handleReqCancelled);
    socket.on('friend_request_rejected', handleReqRejected);
    socket.on('friend_removed', handleFriendRemoved);
    window.addEventListener('pulsechat_friend_removed', handleLocalFriendRemoved);

    return () => {
      socket.off('friend_request_accepted', handleReqAccepted);
      socket.off('friend_request_received', handleReqReceived);
      socket.off('friend_request_cancelled', handleReqCancelled);
      socket.off('friend_request_rejected', handleReqRejected);
      socket.off('friend_removed', handleFriendRemoved);
      window.removeEventListener('pulsechat_friend_removed', handleLocalFriendRemoved);
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

  const handleCancelFriendRequest = async () => {
    if (!token || !activeChat?.id) return;
    const targetReqId = friendRequestId || activeChat.id;
    setFriendshipStatus('none');
    try {
      await fetch(`${BACKEND_URL}/api/friends/cancel/${targetReqId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriendRequestId(null);
      setActionToast('Sync request cancelled');
      setTimeout(() => setActionToast(''), 3000);
      window.dispatchEvent(new CustomEvent('pulsechat_friend_cancelled', { detail: { targetId: activeChat.id } }));
    } catch (err) {
      console.error('Failed to cancel friend request:', err);
    }
  };

  // Listen to incoming messages & poll/deletion updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isThisChat = Boolean(
        msg && (
          msg.chatId === chatId ||
          (msg.chatId && chatId && typeof msg.chatId === 'string' && typeof chatId === 'string' && msg.chatId.includes('_') && chatId.includes('_') && msg.chatId.split('_').sort().join('_') === chatId.split('_').sort().join('_')) ||
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
        const sanitizedMsg = sanitizeFogSnapMessage(msg);
        if (!sanitizedMsg) {
          const targetId = msg.id || msg._id || msg.clientTempId;
          if (targetId) {
            setMessages(prev => {
              const updated = prev.filter(m => m.id !== targetId && m._id !== targetId && m.clientTempId !== targetId);
              setCachedMessages(chatId, updated);
              return updated;
            });
            removeCachedMessages(chatId, [targetId], user?.id);
            deleteMessagesFromLocalDb([targetId]);
          }
          return;
        }
        setMessages(prev => {
          const matchIdx = prev.findIndex(m =>
            (sanitizedMsg.clientTempId && (String(m.id) === String(sanitizedMsg.clientTempId) || String(m.clientTempId) === String(sanitizedMsg.clientTempId))) ||
            String(m.id) === String(sanitizedMsg.id) ||
            (m._id && sanitizedMsg._id && String(m._id) === String(sanitizedMsg._id))
          );
          let updated;
          if (matchIdx !== -1) {
            updated = [...prev];
            updated[matchIdx] = sanitizedMsg;
          } else {
            updated = [...prev, sanitizedMsg];
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
          if (showScrollBottomRef.current) {
            newScrolledMessagesCountRef.current += 1;
            setNewScrolledMessagesCount(newScrolledMessagesCountRef.current);
          }
          if (!isGhostModeRef.current) {
            socket.emit('mark_read', { messageId: msg.id, chatId });
          } else {
            socket.emit('message_delivered', { messageId: msg.id, chatId, senderId: msg.senderId });
          }
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
      setMessages(prev => {
        const next = prev.map(m => (m.id === messageId || m._id === messageId || m.clientTempId === messageId) ? { ...m, type: 'deleted', content: 'This message was deleted', mediaUrl: null, audioUrl: null, pollData: null } : m);
        setCachedMessages(chatId, next);
        return next;
      });
      markCachedMessagesDeleted(chatId, [messageId]);
    };

    const handleReadUpdate = ({ messageId, status }) => {
      setMessages(prev => {
        const next = prev.map(m =>
          (m.id === messageId || m._id === messageId || m.clientTempId === messageId)
            ? { ...m, status: 'read' }
            : m
        );
        setCachedMessages(chatId, next);
        return next;
      });
      updateCachedMessageStatus(chatId, messageId, { status: 'read' });
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => {
        const next = prev.map(m => (m.id === messageId || m._id === messageId || m.clientTempId === messageId) ? { ...m, reactions } : m);
        setCachedMessages(chatId, next);
        return next;
      });
    };

    const handleOptimisticReaction = (e) => {
      const { messageId, reactions } = e.detail || {};
      if (!messageId) return;
      setMessages(prev => {
        const next = prev.map(m => (m.id === messageId || m._id === messageId || m.clientTempId === messageId) ? { ...m, reactions } : m);
        setCachedMessages(chatId, next);
        return next;
      });
    };
    window.addEventListener('pulsechat_optimistic_reaction', handleOptimisticReaction);

    const handleMessageRestored = ({ restoredMsg }) => {
      setMessages(prev => prev.map(m => m.id === restoredMsg.id ? restoredMsg : m));
    };

    const handleChatCleared = ({ chatId: targetChatId }) => {
      const currentCanonical = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      const targetCanonical = (targetChatId && targetChatId.includes('_')) ? targetChatId.split('_').sort().join('_') : targetChatId;
      if (targetChatId === chatId || (currentCanonical && currentCanonical === targetCanonical)) {
        setMessages([]);
        clearCachedMessages(chatId);
        updateRecentChatSnippet(user?.id, chatId, null, activeChat);
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      }
    };

    const handleViewOnceUpdated = ({ messageId, messageMongoId, viewedBy, viewCounts, status }) => {
      setMessages(prev => {
        const next = prev.map(m => {
          const isMatch = (
            m.id === messageId ||
            (messageMongoId && (m._id === messageMongoId || m.id === messageMongoId)) ||
            m._id === messageId ||
            m.clientTempId === messageId
          );
          if (isMatch) {
            return {
              ...m,
              viewedBy: viewedBy || m.viewedBy,
              viewCounts: viewCounts || m.viewCounts,
              status: status || m.status || 'read'
            };
          }
          return m;
        });
        setCachedMessages(chatId, next);
        return next;
      });
    };

    const handleChatRestored = ({ chatId: targetChatId, messages: restoredMsgs }) => {
      if (targetChatId === chatId && Array.isArray(restoredMsgs)) {
        setMessages(restoredMsgs);
      }
    };

    const handleMultipleDeleted = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId && Array.isArray(targetIds)) {
        const idSet = new Set(targetIds.map(String));
        setMessages(prev => {
          const next = prev.map(m => (idSet.has(String(m.id)) || idSet.has(String(m._id)) || idSet.has(String(m.clientTempId))) ? { ...m, type: 'deleted', content: 'This message was deleted', mediaUrl: null, audioUrl: null, pollData: null } : m);
          setCachedMessages(chatId, next);
          return next;
        });
        markCachedMessagesDeleted(chatId, targetIds);
      }
    };

    const handleMultipleRestored = ({ messageIds: targetIds, chatId: targetChatId }) => {
      if (targetChatId === chatId) {
        const isCurGhost = isGhostModeRef.current;
        fetch(`${BACKEND_URL}/api/messages/${chatId}${isCurGhost ? '?ghost=true' : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(isCurGhost ? { 'x-ghost-mode': 'true' } : {})
          }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setMessages(data);
          });
      }
    };

    const handleChatReadUpdate = ({ chatId: targetChatId, canonicalChatId, userId }) => {
      if (userId && (userId === user?.id || userId === user?._id)) return;

      const currentCanonical = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      const targetCanonical = canonicalChatId || ((targetChatId && targetChatId.includes('_')) ? targetChatId.split('_').sort().join('_') : targetChatId);

      const isMatch = Boolean(
        targetChatId === chatId ||
        (targetCanonical && targetCanonical === currentCanonical) ||
        (targetChatId && (targetChatId === activeChat?.id || targetChatId === activeChat?._id || targetChatId === activeChat?.username)) ||
        (activeChat?.id && targetChatId && targetChatId.includes(activeChat.id)) ||
        (activeChat?._id && targetChatId && targetChatId.includes(String(activeChat._id))) ||
        (chatId && targetChatId && (String(chatId).replace(/_/g, '') === String(targetChatId).replace(/_/g, '')))
      );

      if (isMatch) {
        setMessages(prev => {
          const next = prev.map(m =>
            (m.senderId === user?.id || m.senderId === user?._id)
              ? { ...m, status: 'read' }
              : m
          );
          setCachedMessages(chatId, next);
          return next;
        });
      }
    };

    const handleMessageDeliveredUpdate = ({ messageId, status }) => {
      setMessages(prev => {
        const next = prev.map(m =>
          (m.id === messageId || m._id === messageId || m.clientTempId === messageId)
            ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) }
            : m
        );
        setCachedMessages(chatId, next);
        return next;
      });
      updateCachedMessageStatus(chatId, messageId, { status: 'delivered' });
    };

    const handleMessagesDelivered = ({ messageIds, status }) => {
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const idSet = new Set(messageIds.map(String));
        setMessages(prev => {
          const next = prev.map(m =>
            (idSet.has(String(m.id)) || (m._id && idSet.has(String(m._id))) || (m.clientTempId && idSet.has(String(m.clientTempId))))
              ? { ...m, status: (m.status === 'read' ? 'read' : (status || 'delivered')) }
              : m
          );
          setCachedMessages(chatId, next);
          return next;
        });
      } else {
        setMessages(prev => {
          const next = prev.map(m => m.status === 'sent' ? { ...m, status: status || 'delivered' } : m);
          setCachedMessages(chatId, next);
          return next;
        });
      }
    };

    const handleChatSettingUpdated = (setting) => {
      if (setting && (setting.chatId === chatId || (chatId && setting.chatId === chatId.split('_').sort().join('_')))) {
        setChatSetting(prev => ({ ...prev, ...setting }));
      }
    };

    const handleChatNicknameUpdated = (payload) => {
      if (!payload) return;
      const targetChat = payload.chatId;
      const currentCanonical = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      if (targetChat === chatId || targetChat === currentCanonical || payload.originalChatId === chatId) {
        setChatSetting(prev => ({
          ...prev,
          nicknames: (payload.nicknames && typeof payload.nicknames === 'object') ? payload.nicknames : {}
        }));
      }
    };

    const handleChatVanishModeUpdated = (payload) => {
      if (!payload) return;
      const targetChat = payload.chatId;
      const currentCanonical = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      if (targetChat === chatId || targetChat === currentCanonical || payload.originalChatId === chatId) {
        const mode = Boolean(payload.vanishMode);
        setIsVanishMode(mode);
        isVanishModeRef.current = mode;
        setChatSetting(prev => ({ ...prev, vanishMode: mode }));
      }
    };

    const handleVanishMessagesEvaporated = (payload) => {
      if (!payload) return;
      const targetChat = payload.chatId;
      const currentCanonical = (chatId && chatId.includes('_')) ? chatId.split('_').sort().join('_') : chatId;
      if (targetChat === chatId || targetChat === currentCanonical) {
        const deletedIds = payload.deletedMessageIds || [];
        setMessages(prev => {
          const filtered = prev.filter(m => !deletedIds.includes(m.id) && !deletedIds.includes(m._id) && !m.isVanish);
          setCachedMessages(chatId, filtered);
          if (currentCanonical && currentCanonical !== chatId) {
            setCachedMessages(currentCanonical, filtered);
          }
          return filtered;
        });
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
    socket.on('view_once_updated', handleViewOnceUpdated);
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
    socket.on('chat_nickname_updated', handleChatNicknameUpdated);
    socket.on('chat_vanish_mode_updated', handleChatVanishModeUpdated);
    socket.on('vanish_messages_evaporated', handleVanishMessagesEvaporated);
    socket.on('message_blocked', handleMessageBlocked);
    socket.on('group_updated', handleGroupUpdated);

    const handleFogBurned = ({ messageId }) => {
      if (!messageId) return;
      try {
        localStorage.setItem(`pulse_fog_burned_${messageId}`, 'true');
      } catch (e) {}
      setMessages(prev => {
        const next = prev.filter(m => m.id !== messageId && m._id !== messageId && m.clientTempId !== messageId);
        setCachedMessages(chatId, next);
        return next;
      });
      removeCachedMessages(chatId, [messageId], user?.id);
      deleteMessagesFromLocalDb([messageId]);
    };
    const handleFogRevealed = ({ messageId }) => {
      if (!messageId) return;
      setMessages(prev => {
        const updated = prev.map(m => {
          if (m.id === messageId || m._id === messageId || m.clientTempId === messageId) {
            return { ...m, fogSnapStatus: 'revealed', status: 'read' };
          }
          return m;
        });
        setCachedMessages(chatId, updated);
        return updated;
      });
      updateCachedMessageStatus(chatId, messageId, { fogSnapStatus: 'revealed', status: 'read' });
    };
    socket.on('fog_snap_burned', handleFogBurned);
    socket.on('fog_snap_revealed', handleFogRevealed);

    const handleWindowFogBurned = (e) => {
      if (e.detail?.messageId) {
        handleFogBurned({ messageId: e.detail.messageId });
      }
    };
    window.addEventListener('pulsechat_fog_snap_burned', handleWindowFogBurned);

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
    const handleLocalNewMessage = (e) => {
      if (e.detail) {
        handleNewMessage(e.detail);
      }
    };
    window.addEventListener('pulsechat_new_message', handleLocalNewMessage);

    return () => {
      window.removeEventListener('pulsechat_new_message', handleLocalNewMessage);
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
      socket.off('view_once_updated', handleViewOnceUpdated);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_restored', handleChatRestored);
      socket.off('multiple_messages_deleted', handleMultipleDeleted);
      socket.off('multiple_messages_restored', handleMultipleRestored);
      socket.off('chat_setting_updated', handleChatSettingUpdated);
      socket.off('chat_nickname_updated', handleChatNicknameUpdated);
      socket.off('chat_vanish_mode_updated', handleChatVanishModeUpdated);
      socket.off('vanish_messages_evaporated', handleVanishMessagesEvaporated);
      socket.off('message_blocked', handleMessageBlocked);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('fog_snap_burned', handleFogBurned);
      socket.off('fog_snap_revealed', handleFogRevealed);
      socket.off('vanish_messages_evaporated', handleVanishMessagesEvaporated);
      socket.off('message_blocked', handleMessageBlocked);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('fog_snap_burned', handleFogBurned);
      window.removeEventListener('pulsechat_fog_snap_burned', handleWindowFogBurned);
      window.removeEventListener('pulsechat_group_updated', handleGroupWindowEvent);
      window.removeEventListener('pulsechat_optimistic_reaction', handleOptimisticReaction);
    };
  }, [socket, chatId, user.id, token, isGroup, activeChat]);

  const [undoMessageId, setUndoMessageId] = useState(null);

  const handleUndoDelete = () => {
    if (undoMessageId && socket) {
      socket.emit('restore_message', { messageId: undoMessageId, chatId });
      setUndoMessageId(null);
    }
  };

  const handleTriggerUndoToast = useCallback((msgId) => {
    setUndoMessageId(msgId);
    setTimeout(() => {
      setUndoMessageId(prev => (prev === msgId ? null : prev));
    }, 6000);
  }, []);

  // Seamless scroll anchoring when older messages are loaded at top
  useLayoutEffect(() => {
    if (scrollPositionRef.current.isPrepending && chatContainerRef.current) {
      const { prevScrollHeight, prevScrollTop } = scrollPositionRef.current;
      const currentScrollHeight = chatContainerRef.current.scrollHeight;
      const diff = currentScrollHeight - prevScrollHeight;
      if (diff > 0) {
        chatContainerRef.current.scrollTop = prevScrollTop + diff;
      }
      scrollPositionRef.current.isPrepending = false;
    }
  }, [messages]);

  // Scroll to bottom handler — opens chat at the latest message (WhatsApp style)
  useEffect(() => {
    if (messages.length === 0) return;

    // Older messages were prepended at top -> do NOT scroll to bottom!
    if (scrollPositionRef.current.isPrepending) return;

    const lastMsg = messages[messages.length - 1];
    const lastMsgId = lastMsg?.id || lastMsg?._id || lastMsg?.clientTempId;
    const prevLastId = lastRenderedLastMsgIdRef.current;

    // Initial load or user pinned to bottom: keep bottom anchor cleanly
    if (isInitialLoad.current || isPinnedToBottomRef.current) {
      scrollToBottom('instant');
      requestAnimationFrame(() => scrollToBottom('instant'));
      setTimeout(() => scrollToBottom('instant'), 50);
      setTimeout(() => scrollToBottom('instant'), 150);
      setTimeout(() => scrollToBottom('instant'), 350);
      if (isInitialLoad.current) {
        setTimeout(() => { isInitialLoad.current = false; }, 400);
      }
      lastRenderedLastMsgIdRef.current = lastMsgId;
      return;
    }

    // Check if the last message actually changed (a brand new message arrived at bottom)
    const isTempResolution = (
      lastMsg?.clientTempId && (lastMsg.clientTempId === prevLastId || lastMsg.id === prevLastId)
    );
    const isNewMessageAtBottom = lastMsgId && lastMsgId !== prevLastId && !isTempResolution;
    lastRenderedLastMsgIdRef.current = lastMsgId;

    if (!isNewMessageAtBottom) {
      // Existing messages updated (reaction, edit, status, avatar, temp resolution) -> DO NOT SCROLL!
      return;
    }

    // A brand new message arrived at the bottom
    const isSentByMe = (lastMsg.senderId === user?.id || lastMsg.senderId === user?._id) || (typeof lastMsg.id === 'string' && (lastMsg.id.startsWith('temp_') || lastMsg.id.startsWith('sched_')));

    if (isSentByMe) {
      // User sent a message -> scroll to bottom smoothly
      scrollToBottom('smooth');
      setShowScrollBottom(false);
      showScrollBottomRef.current = false;
      isPinnedToBottomRef.current = true;
    } else {
      // Someone else sent a message -> auto scroll if user is pinned near bottom
      if (isPinnedToBottomRef.current) {
        scrollToBottom('smooth');
        setShowScrollBottom(false);
        showScrollBottomRef.current = false;
      }
    }
  }, [messages, user?.id, scrollToBottom]);

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
  const handleClearCurrentChat = async () => {
    if (!messages || messages.length === 0) return;
    const chatTitle = activeChat?.displayName || activeChat?.name || 'this chat';
    if (!window.confirm(`Clear all messages in "${chatTitle}"?`)) return;

    const backup = [...messages];
    setClearedBackup(backup);
    setClearedUndoSecs(8);

    setMessages([]);
    clearCachedMessages(chatId);
    updateRecentChatSnippet(user?.id, chatId, null, activeChat);
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

    if (socket) {
      socket.emit('clear_chat', { chatId });
    }

    try {
      fetch(`${BACKEND_URL}/api/messages/clear/${chatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    } catch (e) {}
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
  const handleToggleSelectMsg = useCallback((msgId) => {
    setSelectedMsgIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  }, []);

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
    if (isLoadingOlderRef.current || messages.length === 0) return;
    const oldestMsg = messages.find(m => m.timestamp && !m.id?.startsWith('temp_'));
    if (!oldestMsg || !oldestMsg.timestamp) return;

    isLoadingOlderRef.current = true;
    if (chatContainerRef.current) {
      scrollPositionRef.current = {
        prevScrollHeight: chatContainerRef.current.scrollHeight,
        prevScrollTop: chatContainerRef.current.scrollTop,
        isPrepending: true
      };
    }

    try {
      // 1. WhatsApp Local-First check: Try IndexedDB first on device SSD (0ms, 0 bytes network!)
      const localOlder = await getCachedMessagesFromLocalDb(chatId, 50, oldestMsg.timestamp);
      if (Array.isArray(localOlder) && localOlder.length > 0) {
        let hasNew = false;
        setMessages(prev => {
          const currentIds = new Set(prev.map(m => m.id));
          const newOldMsgs = localOlder.filter(m => !currentIds.has(m.id));
          if (newOldMsgs.length === 0) {
            scrollPositionRef.current.isPrepending = false;
            return prev;
          }
          hasNew = true;
          return [...newOldMsgs, ...prev];
        });
        if (hasNew) {
          isLoadingOlderRef.current = false;
          return;
        }
      }

      // 2. If not found locally in IndexedDB, fetch from server
      if (!token) {
        isLoadingOlderRef.current = false;
        return;
      }
      const isCurGhost = isGhostModeRef.current;
      const res = await fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=50&before=${encodeURIComponent(oldestMsg.timestamp)}${isCurGhost ? '&ghost=true' : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isCurGhost ? { 'x-ghost-mode': 'true' } : {})
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length < 50) {
          setHasMoreOlderMessages(false);
          try { localStorage.setItem(`pulsechat_nomore_${chatId}`, 'true'); } catch {}
        } else {
          setHasMoreOlderMessages(true);
        }
        if (data.length > 0) {
          setMessages(prev => {
            const currentIds = new Set(prev.map(m => m.id));
            const newOldMsgs = data.filter(m => !currentIds.has(m.id));
            if (newOldMsgs.length === 0) {
              scrollPositionRef.current.isPrepending = false;
              setHasMoreOlderMessages(false);
              try { localStorage.setItem(`pulsechat_nomore_${chatId}`, 'true'); } catch {}
              return prev;
            }
            const merged = [...newOldMsgs, ...prev];
            setCachedMessages(chatId, merged);
            return merged;
          });
        } else {
          scrollPositionRef.current.isPrepending = false;
          setHasMoreOlderMessages(false);
          try { localStorage.setItem(`pulsechat_nomore_${chatId}`, 'true'); } catch {}
        }
      } else {
        scrollPositionRef.current.isPrepending = false;
      }
    } catch (err) {
      console.warn('Failed to load older messages:', err);
      scrollPositionRef.current.isPrepending = false;
    } finally {
      isLoadingOlderRef.current = false;
    }
  };

  const handleChatContainerScroll = (e) => {
    const target = e.currentTarget;
    const scrollHeight = target.scrollHeight;
    const scrollTop = target.scrollTop;
    const clientHeight = target.clientHeight;

    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      // Smart Prefetching: Only trigger when there is genuine scrollable history and user scrolls near top
      if (scrollHeight > clientHeight + 200 && scrollTop <= 150 && hasMoreOlderMessages && !isLoadingOlderRef.current) {
        handleLoadOlderMessages();
      }

      // Track if user has scrolled away from the latest messages (> 120px)
      const distFromBottom = scrollHeight - scrollTop - clientHeight;
      const isScrolledUp = distFromBottom > 120;
      isPinnedToBottomRef.current = !isScrolledUp;
      if (showScrollBottomRef.current !== isScrolledUp) {
        setShowScrollBottom(isScrolledUp);
        showScrollBottomRef.current = isScrolledUp;
      }
      if (!isScrolledUp && newScrolledMessagesCountRef.current > 0) {
        newScrolledMessagesCountRef.current = 0;
        setNewScrolledMessagesCount(0);
      }
    });
  };

  const dispatchMessage = (msgContent) => {
    if (!msgContent) return;

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const isOnlineNow = isDeviceOnline() && socket?.connected;

    const pendingMsg = {
      ...getSenderPayload(),
      id: tempId,
      tempId,
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
      ...getSenderPayload(),
      id: tempId,
      tempId,
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

  const handleSendText = (incomingText, forceInstant = false) => {
    const textToSend = typeof incomingText === 'string' ? incomingText : (inputCapsuleRef.current?.getText() || '');
    if (!textToSend || !textToSend.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && user?.id) {
      socket.emit('typing_stop', { chatId, userId: user.id, receiverId: isGroup ? '' : activeChat?.id });
    }

    // Check emotional trigger words for 3s cooldown using sentiment utility
    if (isEmotionalTriggerMessage(textToSend) && !forceInstant) {
      setCooldownMsg(textToSend);
      setCooldownSecs(3);
      inputCapsuleRef.current?.clear();
      if (replyInputRef.current) {
        replyInputRef.current.focus({ preventScroll: true });
      }
      return;
    }

    dispatchMessage(textToSend);
    inputCapsuleRef.current?.clear();
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    lastTypingEmitRef.current = 0;
    try {
      if (chatId) localStorage.removeItem(`pulsechat_draft_${chatId}`);
    } catch {}

    // Clean container scroll to bottom without jumping or moving window
    isPinnedToBottomRef.current = true;
    setShowScrollBottom(false);
    showScrollBottomRef.current = false;
    scrollToBottom('smooth');
    requestAnimationFrame(() => scrollToBottom('smooth'));

    // Keep mobile virtual keyboard open continuously
    if (replyInputRef.current) {
      replyInputRef.current.focus({ preventScroll: true });
    }
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
      inputCapsuleRef.current?.setText(cooldownMsg);
    }
    setCooldownSecs(0);
    setCooldownMsg(null);
  };

  const handleSendVoice = async (audioUrl, voiceFilter = 'normal') => {
    setShowRecorder(false);
    const tempId = 'temp_voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const isOnlineNow = isDeviceOnline() && Boolean(socket?.connected);

    const pendingVoiceMsg = {
      ...getSenderPayload(),
      id: tempId,
      tempId,
      clientTempId: tempId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      audioUrl,
      type: 'voice',
      voiceFilter: voiceFilter !== 'normal' ? voiceFilter : null,
      status: isOnlineNow ? 'sent' : 'pending',
      timestamp: new Date().toISOString(),
      reactions: {},
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        type: replyTo.type,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName || replyTo.senderId
      } : null
    };

    setMessages(prev => [...prev, pendingVoiceMsg]);
    appendCachedMessage(chatId, pendingVoiceMsg);
    updateRecentChatSnippet(user.id, chatId, pendingVoiceMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    isPinnedToBottomRef.current = true;
    setShowScrollBottom(false);
    showScrollBottomRef.current = false;
    scrollToBottom('smooth');
    playSound('sent');

    if (!isOnlineNow) {
      addToOutbox(user.id, { ...pendingVoiceMsg, needsUpload: true, audioDataUrl: audioUrl });
      return;
    }

    let finalAudioUrl = audioUrl;
    if (audioUrl && audioUrl.startsWith('data:')) {
      try {
        finalAudioUrl = await uploadMediaDirect(audioUrl, 'pulsechat_voice', token);
      } catch (e) {
        console.warn('Voice upload direct error:', e);
      }
    }

    socket.emit('send_message', {
      ...getSenderPayload(),
      clientTempId: tempId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      audioUrl: finalAudioUrl,
      type: 'voice',
      voiceFilter: voiceFilter !== 'normal' ? voiceFilter : null,
      replyTo: pendingVoiceMsg.replyTo
    });
  };

  const handleCreatePoll = (pollData) => {
    const isPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
    const sparksBalance = user?.pulseSparks ?? 0;

    if (!isPro && sparksBalance < 5) {
      alert(`⚡ Insufficient Sparks\nCreating a poll requires 5 Sparks.\nYour balance: ${sparksBalance} Sparks.\n\nEarn Sparks via Daily Bonus or Sparks Wallet.`);
      return;
    }

    if (!isPro && updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: Math.max(0, sparksBalance - 5) });
    }

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

  // Real-time actual presence verification for live interactive features (Game, Whiteboard, Music)
  // Allows friends to play/draw/sync music together even if the partner has stealth indicator on
  const verifyRealPresenceAndProceed = (activityName, onProceed) => {
    if (isGroup) {
      onProceed?.();
      return;
    }

    // 1. If public indicator already confirms online, proceed immediately with 0ms delay!
    if (isOnline) {
      onProceed?.();
      return;
    }

    // 2. If partner hid their indicator (Stealth mode) or socket connected, check real socket presence on server!
    if (socket && socket.connected) {
      socket.emit('check_real_presence', {
        targetUserId: partnerId,
        targetUsername: activeChat?.username,
        targetMongoId: activeChat?._id || activeChat?.id
      }, (res) => {
        if (res && res.isOnline) {
          // User is ACTUALLY online in app (just indicator is hidden) -> START ACTIVITY!
          onProceed?.();
        } else {
          // Genuinely not in app / offline
          const name = activeChat?.displayName || activeChat?.username || 'User';
          const msg = `${name} is currently offline`;
          setActionToast(msg);
          setTimeout(() => setActionToast(''), 3000);
        }
      });
      return;
    }

    // 3. Fallback if disconnected
    const name = activeChat?.displayName || activeChat?.username || 'User';
    const msg = `${name} is currently offline`;
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 3000);
  };

  const checkCanOpenActivity = (activityName) => {
    const isDeviceConn = isDeviceOnline() && socket?.connected;
    if (!isDeviceConn) {
      alert("⚠️ Live match requires an active internet connection! To play games offline, open the Games Zone from the sidebar.");
      return false;
    }
    if (!isGroup && !isOnline) {
      alert(`⚠️ ${activeChat?.displayName || 'Partner'} is currently offline! Live chat games require both players to be online together. To play offline vs AI or Pass & Play, open the Games Zone.`);
      return false;
    }
    return true;
  };

  const launchArrowGame = () => {
    if (!checkCanOpenActivity('Arrow Battle')) return;
    setShowAppsFolderModal(false);
    setShowArrowGameModal(true);
    if (socket && chatId) {
      socket.emit('request_open_arrow_game', {
        chatId,
        senderId: user?.id,
        senderName: user?.displayName || user?.username,
        receiverId: isGroup ? '' : (activeChat?.id || activeChat?._id)
      });
    }
  };

  const handleOpenArrowGame = () => {
    if (!checkCanOpenActivity('Arrow Battle')) return;
    verifyRealPresenceAndProceed('Game (Arrow Battle)', () => {
      const isUserPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));

      if (isUserPro) {
        launchArrowGame();
        return;
      }

      setShowAppsFolderModal(false);
      setSparksPromptConfig({
        featureKey: 'chat_game',
        featureName: 'Arrow Battle Arena',
        sparksCost: 5,
        icon: '🎯',
        description: '👑 VIP Chat Game: Free with Pulse Pro, or unlock this session for 5 Sparks ⚡!',
        onSuccess: () => launchArrowGame()
      });
    });
  };

  const launchTicTacToe = () => {
    if (!checkCanOpenActivity('Tic-Tac-Toe')) return;
    setShowAppsFolderModal(false);
    setTictactoeHostId(user?.id);
    setShowTicTacToeModal(true);
    if (socket && chatId) {
      socket.emit('request_open_tictactoe', {
        chatId,
        senderId: user?.id,
        senderName: user?.displayName || user?.username,
        receiverId: isGroup ? '' : (activeChat?.id || activeChat?._id)
      });
    }
  };

  const handleOpenTicTacToe = () => {
    if (!checkCanOpenActivity('Tic-Tac-Toe')) return;
    verifyRealPresenceAndProceed('Game (Tic-Tac-Toe)', () => {
      const isUserPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));

      if (isUserPro) {
        launchTicTacToe();
        return;
      }

      setShowAppsFolderModal(false);
      setSparksPromptConfig({
        featureKey: 'chat_game',
        featureName: 'Tic-Tac-Toe Arena',
        sparksCost: 5,
        icon: '❌⭕',
        description: '👑 VIP Chat Game: Free with Pulse Pro, or unlock this session for 5 Sparks ⚡!',
        onSuccess: () => launchTicTacToe()
      });
    });
  };

  const handleOpenWhiteboard = () => {
    verifyRealPresenceAndProceed('Live Drawboard', () => {
      setShowAppsFolderModal(false);
      setShowMoreMenu(false);
      setWhiteboardInitialImage(null);
      setWhiteboardInitialData(null);
      setShowWhiteboard(true);
      if (socket && chatId) {
        socket.emit('request_open_whiteboard', {
          chatId,
          senderId: user?.id,
          senderName: user?.displayName || user?.username,
          receiverId: isGroup ? '' : (activeChat?.id || activeChat?._id)
        });
      }
    });
  };

  const handleOpenMusic = () => {
    verifyRealPresenceAndProceed('Music', () => {
      setShowAppsFolderModal(false);
      if (!user?.isPro) {
        setProModalTab('pro');
        setShowProModal(true);
        return;
      }
      // Open music picker only on sender's own screen; partner will not get popup
      setShowChatMusicPicker(true);
    });
  };

  const handleOpenWhiteboardForEdit = useCallback((drawingUrl, whiteboardData) => {
    setWhiteboardInitialImage(drawingUrl);
    setWhiteboardInitialData(whiteboardData || null);
    setShowWhiteboard(true);
  }, []);

  const handleSendDrawing = async (mediaUrl) => {
    setShowWhiteboard(false);
    let finalMediaUrl = mediaUrl;
    if (mediaUrl && mediaUrl.startsWith('data:')) {
      try {
        finalMediaUrl = await uploadMediaDirect(mediaUrl, 'pulsechat_drawings', token);
      } catch (e) {
        console.warn('Drawing direct upload error:', e);
      }
    }

    socket.emit('send_message', {
      ...getSenderPayload(),
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl: finalMediaUrl,
      type: 'image',
      content: '🎨 Whiteboard Drawing',
      fileName: `pulsechat_drawing_${Date.now()}.png`,
      isDrawing: true
    });
    playSound('sent');
    setWhiteboardInitialImage(null);
    setWhiteboardInitialData(null);
  };

  const handleSendMultiPhotos = async (files) => {
    if (!files || files.length === 0) return;

    // Enforce 5MB limit per file
    const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024;
    for (const f of files) {
      if (f.size > MAX_SINGLE_FILE_BYTES) {
        alert(`⚠️ File "${f.name}" exceeds 5MB limit (${(f.size / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size is 5MB per photo.`);
        return;
      }
    }

    // Daily quota check
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `pulsechat_daily_file_bytes_${user?.id || 'guest'}_${todayStr}`;
    const todayUsed = parseInt(localStorage.getItem(storageKey) || '0', 10);
    const MAX_DAILY_FILE_BYTES = 10 * 1024 * 1024;

    if (todayUsed + totalBytes > MAX_DAILY_FILE_BYTES) {
      const usedMB = (todayUsed / (1024 * 1024)).toFixed(1);
      alert(`⚠️ Daily file sharing limit of 10MB reached! (Used: ${usedMB}MB / 10MB). Cannot send ${files.length} photos (${(totalBytes / (1024 * 1024)).toFixed(2)}MB).`);
      return;
    }
    localStorage.setItem(storageKey, String(todayUsed + totalBytes));

    const currentReplyTo = replyTo;
    setReplyTo(null);

    const localBlobUrls = files.map(f => URL.createObjectURL(f));
    const tempMediaId = 'temp_media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const optimisticMsg = {
      ...getSenderPayload(),
      id: tempMediaId,
      clientTempId: tempMediaId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrls: localBlobUrls,
      mediaUrl: localBlobUrls[0],
      type: 'image_group',
      status: 'uploading',
      isUploading: true,
      timestamp: new Date().toISOString(),
      reactions: {},
      replyTo: currentReplyTo
    };

    const isOnlineNow = isDeviceOnline() && Boolean(socket?.connected);
    if (!isOnlineNow) {
      let persistentUrls = localBlobUrls;
      try {
        persistentUrls = await Promise.all(files.map(async f => {
          try {
            if (f.type?.startsWith('image/')) {
              return await compressImageOnDevice(f, 1280, 0.75);
            }
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(URL.createObjectURL(f));
              reader.readAsDataURL(f);
            });
          } catch {
            return URL.createObjectURL(f);
          }
        }));
      } catch (e) {
        persistentUrls = localBlobUrls;
      }

      const offlineMsg = {
        ...optimisticMsg,
        mediaUrls: persistentUrls,
        mediaUrl: persistentUrls[0],
        status: 'pending',
        isUploading: false
      };
      setMessages(prev => [...prev, offlineMsg]);
      appendCachedMessage(chatId, offlineMsg);
      addToOutbox(user.id, {
        ...offlineMsg,
        needsUpload: true,
        mediaUrls: persistentUrls
      });
      updateRecentChatSnippet(user.id, chatId, offlineMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      isPinnedToBottomRef.current = true;
      setShowScrollBottom(false);
      showScrollBottomRef.current = false;
      scrollToBottom('smooth');
      playSound('sent');
      return;
    }

    setMessages(prev => [...prev, optimisticMsg]);
    appendCachedMessage(chatId, optimisticMsg);
    updateRecentChatSnippet(user.id, chatId, optimisticMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    isPinnedToBottomRef.current = true;
    setShowScrollBottom(false);
    showScrollBottomRef.current = false;
    scrollToBottom('smooth');
    playSound('sent');

    // Background upload all photos concurrently
    (async () => {
      try {
        const uploadPromises = files.map(file => uploadMediaDirect(file, 'pulsechat_media', token, false));
        const uploadedUrls = await Promise.all(uploadPromises);

        setMessages(prev => prev.map(m => m.id === tempMediaId ? { ...m, mediaUrls: uploadedUrls, mediaUrl: uploadedUrls[0], status: 'sent', isUploading: false } : m));

        socket.emit('send_message', {
          ...getSenderPayload(),
          clientTempId: tempMediaId,
          chatId,
          senderId: user.id,
          receiverId: isGroup ? '' : activeChat.id,
          isGroup,
          mediaUrls: uploadedUrls,
          mediaUrl: uploadedUrls[0],
          type: 'image_group',
          replyTo: currentReplyTo
        });
      } catch (err) {
        console.error('Multi-photo upload error:', err);
        setMessages(prev => prev.map(m => m.id === tempMediaId ? { ...m, status: 'error', isUploading: false } : m));
      }
    })();
  };

  const handleFileSelect = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles || rawFiles.length === 0) return;

    // Check if user selected multiple images (Max 6)
    if (rawFiles.length > 1) {
      if (rawFiles.length > 6) {
        alert('⚠️ You can send a maximum of 6 photos at a time. The first 6 photos will be sent.');
      }
      const chosenFiles = rawFiles.slice(0, 6);
      const allImages = chosenFiles.every(f => f.type.startsWith('image/'));
      if (allImages) {
        handleSendMultiPhotos(chosenFiles);
        e.target.value = '';
        return;
      }
    }

    const file = rawFiles[0];
    if (!file) return;

    // Enforce 5MB single file limit
    const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SINGLE_FILE_BYTES) {
      alert(`⚠️ File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). You cannot send files larger than 5MB.`);
      e.target.value = '';
      return;
    }

    // Enforce 10MB 24-hour daily quota limit
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `pulsechat_daily_file_bytes_${user?.id || 'guest'}_${todayStr}`;
    const todayUsed = parseInt(localStorage.getItem(storageKey) || '0', 10);
    const MAX_DAILY_FILE_BYTES = 10 * 1024 * 1024; // 10MB

    if (todayUsed + file.size > MAX_DAILY_FILE_BYTES) {
      const usedMB = (todayUsed / (1024 * 1024)).toFixed(1);
      alert(`⚠️ Daily file sharing limit of 10MB reached! (Used: ${usedMB}MB / 10MB). You cannot send more than 10MB total per day. Try again tomorrow!`);
      e.target.value = '';
      return;
    }

    // Telegram-Style 0ms Instant Optimistic Upload
    const localBlobUrl = URL.createObjectURL(file);
    const isDoc = !file.type.startsWith('image/') && !file.type.startsWith('video/');
    const formattedSize = (file.size / 1024 < 1024)
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    handleSendMedia({
      mediaUrl: localBlobUrl,
      rawFile: file,
      type: isDoc ? 'document' : file.type,
      fileName: file.name,
      fileSize: formattedSize,
      rawSizeBytes: file.size
    });

    e.target.value = '';
  };

  const handleSpecificMediaSelect = (e, initialMode) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SINGLE_FILE_BYTES) {
      alert(`⚠️ File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). You cannot send files larger than 5MB.`);
      e.target.value = '';
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `pulsechat_daily_file_bytes_${user?.id || 'guest'}_${todayStr}`;
    const todayUsed = parseInt(localStorage.getItem(storageKey) || '0', 10);
    const MAX_DAILY_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    if (todayUsed + file.size > MAX_DAILY_FILE_BYTES) {
      const usedMB = (todayUsed / (1024 * 1024)).toFixed(1);
      alert(`⚠️ Daily file sharing limit of 10MB reached! (Used: ${usedMB}MB / 10MB). You cannot send more than 10MB total per day. Try again tomorrow!`);
      e.target.value = '';
      return;
    }

    const localBlobUrl = URL.createObjectURL(file);
    const formattedSize = (file.size / 1024 < 1024)
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    setPendingMedia({
      dataUrl: localBlobUrl,
      file,
      fileName: file.name,
      fileSize: formattedSize,
      rawSizeBytes: file.size,
      type: file.type,
      initialMode
    });

    e.target.value = '';
  };

  const handleSendMedia = async ({
    mediaUrl,
    rawFile,
    type,
    isViewOnce,
    isViewTwice,
    viewLimit,
    isFogSnap,
    isDustImage,
    fogSnapDuration,
    fileName,
    fileSize,
    rawSizeBytes
  }) => {
    const msgType = type === 'document'
      ? 'document'
      : (type?.startsWith('video/') ? 'video' : 'image');

    const bytesUsed = rawSizeBytes || rawFile?.size || pendingMedia?.rawSizeBytes || 0;
    if (bytesUsed) {
      const todayStr = new Date().toISOString().split('T')[0];
      const storageKey = `pulsechat_daily_file_bytes_${user?.id || 'guest'}_${todayStr}`;
      const todayUsed = parseInt(localStorage.getItem(storageKey) || '0', 10);
      localStorage.setItem(storageKey, String(todayUsed + bytesUsed));
    }

    const currentReplyTo = replyTo;
    setPendingMedia(null);
    setReplyTo(null);

    const isDust = Boolean(isFogSnap || isDustImage);
    const isTwice = Boolean(isViewTwice);
    const isOnce = Boolean(isViewOnce);
    const isEphemeralPhoto = Boolean(isOnce || isTwice || isDust);
    const calculatedLimit = isTwice ? 2 : (isOnce ? 1 : null);

    // Deduplication Lock: drop rapid duplicate triggers within 1200ms
    const mediaDedupeKey = `${fileName || rawFile?.name || ''}_${fileSize || rawFile?.size || ''}_${msgType}_${isDust ? 'dust' : (isTwice ? 'twice' : (isOnce ? 'once' : 'normal'))}`;
    const now = Date.now();
    if (now - lastMediaSentRef.current.time < 1200 && lastMediaSentRef.current.key === mediaDedupeKey) {
      console.warn('Blocked duplicate media send invocation:', mediaDedupeKey);
      return;
    }
    lastMediaSentRef.current = { time: now, key: mediaDedupeKey };

    // 0ms Optimistic Media Bubble (Telegram Magic):
    // Instantly renders in chat with circular progress ring while uploading in background!
    const tempMediaId = 'temp_media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const optimisticMediaMsg = {
      ...getSenderPayload(),
      id: tempMediaId,
      clientTempId: tempMediaId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl, // local preview instantly visible
      type: msgType,
      isViewOnce: msgType === 'document' ? false : isEphemeralPhoto,
      isViewTwice: isTwice,
      viewLimit: isEphemeralPhoto ? calculatedLimit : undefined,
      viewCounts: {},
      isFogSnap: isDust,
      isDustImage: Boolean(isDustImage || isDust),
      fogSnapDuration: fogSnapDuration || 10,
      fogSnapStatus: isDust ? 'unrevealed' : undefined,
      fileName: fileName || null,
      fileSize: fileSize || null,
      status: 'uploading',
      isUploading: true,
      timestamp: new Date().toISOString(),
      reactions: {},
      replyTo: currentReplyTo
    };

    // Smart Offline Queue: If offline, queue photo/media in grayed out state
    const isOnlineNow = isDeviceOnline() && Boolean(socket?.connected);
    if (!isOnlineNow) {
      let persistentDataUrl = mediaUrl;
      try {
        if (rawFile && rawFile.type?.startsWith('image/')) {
          persistentDataUrl = await compressImageOnDevice(rawFile, 1280, 0.78);
        } else if (rawFile) {
          persistentDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(mediaUrl);
            reader.readAsDataURL(rawFile);
          });
        } else if (mediaUrl && mediaUrl.startsWith('data:image/')) {
          persistentDataUrl = await compressImageOnDevice(mediaUrl, 1280, 0.78);
        }
      } catch (e) {
        persistentDataUrl = mediaUrl;
      }

      const offlineMediaMsg = {
        ...optimisticMediaMsg,
        mediaUrl: persistentDataUrl,
        mediaDataUrl: persistentDataUrl,
        status: 'pending',
        isUploading: false
      };
      setMessages(prev => [...prev, offlineMediaMsg]);
      appendCachedMessage(chatId, offlineMediaMsg);
      addToOutbox(user.id, {
        ...offlineMediaMsg,
        needsUpload: true,
        mediaDataUrl: persistentDataUrl,
        mediaUrl: persistentDataUrl
      });
      updateRecentChatSnippet(user.id, chatId, offlineMediaMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      isPinnedToBottomRef.current = true;
      setShowScrollBottom(false);
      showScrollBottomRef.current = false;
      scrollToBottom('smooth');
      playSound('sent');
      return;
    }

    setMessages(prev => [...prev, optimisticMediaMsg]);
    appendCachedMessage(chatId, optimisticMediaMsg);
    updateRecentChatSnippet(user.id, chatId, optimisticMediaMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    isPinnedToBottomRef.current = true;
    setShowScrollBottom(false);
    showScrollBottomRef.current = false;
    scrollToBottom('smooth');
    playSound('sent');

    // Direct background upload to Cloudinary Edge CDN (bypasses Render Node.js bandwidth!)
    (async () => {
      let finalMediaUrl = mediaUrl;
      try {
        const payloadToUpload = rawFile || mediaUrl;
        finalMediaUrl = await uploadMediaDirect(payloadToUpload, 'pulsechat_media', token, msgType === 'video');
      } catch (e) {
        console.warn('Direct media upload error:', e);
      }

      // Update local optimistic message with finalized CDN URL
      setMessages(prev => prev.map(m => m.id === tempMediaId ? { ...m, mediaUrl: finalMediaUrl, status: 'sent', isUploading: false } : m));

      socket.emit('send_message', {
        ...getSenderPayload(),
        clientTempId: tempMediaId,
        chatId,
        senderId: user.id,
        receiverId: isGroup ? '' : activeChat.id,
        isGroup,
        mediaUrl: finalMediaUrl,
        type: msgType,
        isViewOnce: msgType === 'document' ? false : isEphemeralPhoto,
        isViewTwice: isTwice,
        viewLimit: isEphemeralPhoto ? calculatedLimit : undefined,
        isFogSnap: isDust,
        isDustImage: Boolean(isDustImage || isDust),
        fogSnapDuration: fogSnapDuration || 10,
        fogSnapStatus: isDust ? 'unrevealed' : undefined,
        fileName: fileName || null,
        fileSize: fileSize || null,
        replyTo: currentReplyTo
      });
    })();
  };

  const handleDeleteLocalMessage = useCallback((msgId) => {
    if (!msgId) return;
    setMessages(prev => {
      const next = prev.filter(m => m.id !== msgId && m._id !== msgId && m.clientTempId !== msgId);
      setCachedMessages(chatId, next);
      return next;
    });
    removeCachedMessages(chatId, [msgId], user?.id);
    deleteMessagesFromLocalDb([msgId]);
    if (socket && user?.id) {
      socket.emit('delete_message_for_me', { messageId: msgId, chatId, userId: user.id });
    }
  }, [chatId, socket, user?.id]);

  const lastActionSelectTimeRef = useRef(0);

  const handleSelectForAction = useCallback((msg) => {
    if (!msg) return;
    const msgId = msg.id || msg._id || msg.clientTempId;
    if (!msgId) return;
    lastActionSelectTimeRef.current = Date.now();
    setSelectedActionMessages(prev => {
      const exists = prev.some(m => (m.id || m._id || m.clientTempId) === msgId);
      if (exists) {
        return prev;
      } else {
        return [...prev, msg];
      }
    });
    setShowActionMoreMenu(false);
  }, []);

  const handleToggleActionSelect = useCallback((msg) => {
    if (!msg) return;
    const msgId = msg.id || msg._id || msg.clientTempId;
    if (!msgId) return;
    if (Date.now() - lastActionSelectTimeRef.current < 450) {
      return;
    }
    setSelectedActionMessages(prev => {
      const exists = prev.some(m => (m.id || m._id || m.clientTempId) === msgId);
      if (exists) {
        return prev.filter(m => (m.id || m._id || m.clientTempId) !== msgId);
      } else {
        return [...prev, msg];
      }
    });
  }, []);

  const handleDismissActionMessage = useCallback(() => {
    if (Date.now() - lastActionSelectTimeRef.current < 450) {
      return;
    }
    setSelectedActionMessages([]);
    setShowActionMoreMenu(false);
    setDeleteModalMessages(null);
  }, []);

  const handleToggleStarMessages = useCallback((msgs) => {
    const targetMsgs = Array.isArray(msgs) ? msgs : (msgs ? [msgs] : selectedActionMessages);
    if (!targetMsgs || targetMsgs.length === 0) return;
    const targetIds = targetMsgs.map(m => m.id);
    setStarredMsgIds(prev => {
      const allStarred = targetIds.every(id => prev.includes(id));
      let next;
      if (allStarred) {
        next = prev.filter(id => !targetIds.includes(id));
        setActionToast('Messages unstarred');
      } else {
        next = Array.from(new Set([...prev, ...targetIds]));
        setActionToast('Messages starred ⭐');
      }
      try {
        localStorage.setItem(`pulsechat_starred_${chatId}`, JSON.stringify(next));
      } catch (e) {}
      setTimeout(() => setActionToast(''), 2200);
      return next;
    });
    handleDismissActionMessage();
  }, [chatId, selectedActionMessages, handleDismissActionMessage]);

  const handleCopyMessages = useCallback((msgs) => {
    const targetMsgs = Array.isArray(msgs) ? msgs : (msgs ? [msgs] : selectedActionMessages);
    if (!targetMsgs || targetMsgs.length === 0) return;
    const textToCopy = targetMsgs
      .map(m => m.content || m.fileName || (m.mediaUrl ? 'Media: ' + m.mediaUrl : ''))
      .filter(Boolean)
      .join('\n\n');
    if (textToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setActionToast(targetMsgs.length > 1 ? `${targetMsgs.length} messages copied 📋` : 'Message copied to clipboard 📋');
      setTimeout(() => setActionToast(''), 2200);
    }
    handleDismissActionMessage();
  }, [selectedActionMessages, handleDismissActionMessage]);

  const handlePinMessage = useCallback((msg) => {
    if (!msg) return;
    setPinnedMessage(msg);
    try {
      localStorage.setItem(`pulsechat_pinned_${chatId}`, JSON.stringify(msg));
    } catch (e) {}
    setActionToast('Message pinned to chat 📌');
    setTimeout(() => setActionToast(''), 2200);
    handleDismissActionMessage();
  }, [chatId, handleDismissActionMessage]);

  const handleUnpinMessage = useCallback(() => {
    setPinnedMessage(null);
    try {
      localStorage.removeItem(`pulsechat_pinned_${chatId}`);
    } catch (e) {}
    setActionToast('Message unpinned');
    setTimeout(() => setActionToast(''), 2000);
  }, [chatId]);

  const handleJumpToMessage = useCallback((msgId) => {
    if (!msgId) return;
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'all 0.3s ease';
      el.style.filter = 'drop-shadow(0 0 16px var(--accent))';
      setTimeout(() => {
        el.style.filter = 'none';
      }, 1000);
    }
  }, []);

  // Compute matched message IDs for In-Chat Search on dedicated Web Worker thread
  const [matchedMessageIds, setMatchedMessageIds] = useState([]);

  useEffect(() => {
    if (!deferredInChatSearchQuery.trim()) {
      setMatchedMessageIds([]);
      return;
    }
    let isCancelled = false;
    runWorkerTask('SEARCH_MESSAGES', {
      messages: messages.map(m => ({
        id: m.id || m._id || m.clientTempId,
        text: m.content || '',
        mediaName: m.fileName || ''
      })),
      query: deferredInChatSearchQuery
    }).then((ids) => {
      if (!isCancelled && Array.isArray(ids)) {
        setMatchedMessageIds(ids);
      }
    }).catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [messages, deferredInChatSearchQuery]);

  useEffect(() => {
    setSearchMatchIndex(0);
    if (matchedMessageIds.length > 0) {
      handleJumpToMessage(matchedMessageIds[0]);
    }
  }, [deferredInChatSearchQuery, matchedMessageIds.length, handleJumpToMessage]);

  const handleNextSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % matchedMessageIds.length;
    setSearchMatchIndex(nextIdx);
    handleJumpToMessage(matchedMessageIds[nextIdx]);
  };

  const handlePrevSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const prevIdx = (searchMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    setSearchMatchIndex(prevIdx);
    handleJumpToMessage(matchedMessageIds[prevIdx]);
  };

  const handleForwardMessage = useCallback(async (selectedTargets, msg) => {
    if (!selectedTargets || !msg) return;
    const isOnlineNow = isDeviceOnline() && socket?.connected;

    for (const target of selectedTargets) {
      const targetIsGroup = !!target.isGroup;
      const targetChatId = targetIsGroup ? target.id : [user.id, target.id].sort().join('_');
      const receiverId = targetIsGroup ? '' : target.id;
      const fwdTempId = 'fwd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

      const fwdPayload = {
        ...getSenderPayload(),
        chatId: targetChatId,
        senderId: user.id,
        receiverId,
        isGroup: targetIsGroup,
        isForwarded: true,
        content: msg.content || '',
        type: msg.type || 'text',
        textStyle: msg.textStyle || null,
        mediaUrl: msg.mediaUrl || null,
        audioUrl: msg.audioUrl || null,
        fileName: msg.fileName || null,
        fileSize: msg.fileSize || null,
        clientTempId: fwdTempId,
        timestamp: new Date().toISOString()
      };

      const tempFwdMsg = {
        ...fwdPayload,
        id: fwdTempId,
        tempId: fwdTempId,
        clientTempId: fwdTempId,
        status: isOnlineNow ? 'sent' : 'pending',
        reactions: {},
        viewedBy: []
      };

      appendCachedMessage(targetChatId, tempFwdMsg);

      if (targetChatId === chatId) {
        setMessages(prev => [...prev, tempFwdMsg]);
      }

      updateRecentChatSnippet(user.id, targetChatId, tempFwdMsg, target);
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));

      if (!isOnlineNow) {
        addToOutbox(user.id, tempFwdMsg);
      } else if (socket) {
        socket.emit('send_message', fwdPayload);
      }
    }

    try { playSound('sent'); } catch {}
    setActionToast(`Forwarded to ${selectedTargets.length} chat${selectedTargets.length > 1 ? 's' : ''} ➡️`);
    setTimeout(() => setActionToast(''), 2500);
    handleDismissActionMessage();
  }, [user, socket, chatId, handleDismissActionMessage]);

  const handleDeleteActionMessage = useCallback((msgOrMsgs) => {
    if (!msgOrMsgs) return;
    if (Array.isArray(msgOrMsgs)) {
      if (msgOrMsgs.length > 0) setDeleteModalMessages(msgOrMsgs);
    } else {
      setDeleteModalMessages([msgOrMsgs]);
    }
  }, []);

  const handleTextChange = useCallback((e) => {
    const val = typeof e === 'string' ? e : e?.target?.value;
    inputCapsuleRef.current?.setText(val);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
      if (socket && user?.id && chatId) {
        socket.emit('typing_stop', { chatId, userId: user.id, receiverId: isGroup ? '' : activeChat?.id });
      }
    };
  }, [chatId]);

  // Calculate Mood Timeline using sentence + word sentiment from utility (Memoized to prevent work on keystrokes)
  const moodTimeline = useMemo(() => calculateConversationMoodTimeline(messages, cooldownMsg), [messages, cooldownMsg]);
  const moodInfo = moodTimeline.currentMood;
  const moodSteps = moodTimeline.timelineSteps;

  const moodTimelineRef = useRef(null);
  useEffect(() => {
    if (moodTimelineRef.current) {
      moodTimelineRef.current.scrollLeft = moodTimelineRef.current.scrollWidth;
    }
  }, [chatId, moodSteps]);

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

  // Memoized MessageItem callbacks to prevent list re-rendering lag
  const handleOpenUnlimitedEmojiCallback = useCallback((targetMsg) => {
    setActionMessageForEmoji(targetMsg);
    setShowUnlimitedEmojiPicker(true);
  }, []);

  const handleOpenCustomizeReactionsCallback = useCallback(() => {
    setShowCustomizeReactionsModal(true);
  }, []);

  const handleReplyCallback = useCallback((msg) => {
    const senderInfo = groupMembersMap[msg.senderId];
    setReplyTo({
      ...msg,
      senderName: msg.senderId === user?.id
        ? (myNicknameInChat || 'You')
        : (isGroup ? (senderInfo?.displayName || senderInfo?.username || activeChat?.displayName) : (partnerNickname || senderInfo?.displayName || activeChat?.displayName))
    });
    replyInputRef.current?.focus();
  }, [groupMembersMap, user?.id, myNicknameInChat, isGroup, partnerNickname, activeChat?.displayName]);

  const handleOpenSparksWalletCallback = useCallback(() => {
    setShowSparksWallet(true);
  }, []);

  const handleJoinGroupCallCallback = useCallback((isVideo = false) => {
    if (onStartGroupCall && activeChat) {
      onStartGroupCall(activeChat, Boolean(isVideo));
    }
  }, [onStartGroupCall, activeChat]);

  // Memoized Messages List: Prevents entire message history and DOM nodes from re-evaluating when typing in the input box
  const renderedMessagesList = useMemo(() => {
    return deduplicatedMessages.map((msg, index) => {
      const senderObj = groupMembersMap[msg.senderId];
      const prevMsg = index > 0 ? deduplicatedMessages[index - 1] : null;
      const showDateHeader = index === 0 || isDifferentDay(prevMsg?.timestamp, msg.timestamp);
      const dateLabel = formatMessageDateHeader(msg.timestamp);

      return (
        <React.Fragment key={msg.clientTempId || msg.id || index}>
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
            isMine={String(msg.senderId) === String(user?.id || user?._id || '')}
            chatId={chatId}
            socket={socket}
            currentUser={user}
            senderName={
              msg.senderId === user.id
                ? (myNicknameInChat || user?.displayName || user?.username)
                : (isGroup ? (senderObj?.displayName || senderObj?.username) : (partnerNickname || senderObj?.displayName || activeChat?.displayName || senderObj?.username))
            }
            senderIsPro={msg.senderId === user.id ? user?.isPro : (isGroup ? senderObj?.isPro : chatIsPro)}
            onDeleteLocal={handleDeleteLocalMessage}
            onDeleteTrigger={handleTriggerUndoToast}
            isMultiSelectMode={isMultiSelectMode}
            isSelected={selectedMsgIds.includes(msg.id || msg._id || msg.clientTempId)}
            onToggleSelect={handleToggleSelectMsg}
            onJoinGroupCall={handleJoinGroupCallCallback}
            isSelectedForAction={selectedActionMessages.some(m => (m.id || m._id || m.clientTempId) === (msg.id || msg._id || msg.clientTempId))}
            isInActionSelectionMode={selectedActionMessages.length > 0}
            actionSelectedCount={selectedActionMessages.length}
            onToggleActionSelect={handleToggleActionSelect}
            onSelectForAction={handleSelectForAction}
            isStarred={starredMsgIds.includes(msg.id || msg._id || msg.clientTempId)}
            onOpenUnlimitedEmoji={handleOpenUnlimitedEmojiCallback}
            onOpenCustomizeReactions={handleOpenCustomizeReactionsCallback}
            onDismissAction={handleDismissActionMessage}
            onReply={handleReplyCallback}
            onOpenStory={handleOpenStory}
            onOpenSparksWallet={handleOpenSparksWalletCallback}
            onEditDrawing={handleOpenWhiteboardForEdit}
            highlightSearchTerm={showInChatSearch ? inChatSearchQuery : ''}
            translationData={translationsByMsgId[msg.id]}
            onTranslateMessage={handleTranslateMessage}
            onToggleTranslation={handleToggleTranslation}
            targetLang={targetLang}
          />
        </React.Fragment>
      );
    });
  }, [
    deduplicatedMessages,
    groupMembersMap,
    user,
    chatId,
    socket,
    myNicknameInChat,
    partnerNickname,
    activeChat?.displayName,
    isGroup,
    chatIsPro,
    handleDeleteLocalMessage,
    handleTriggerUndoToast,
    isMultiSelectMode,
    selectedMsgIds,
    handleToggleSelectMsg,
    handleJoinGroupCallCallback,
    selectedActionMessages,
    handleToggleActionSelect,
    handleSelectForAction,
    starredMsgIds,
    handleOpenUnlimitedEmojiCallback,
    handleOpenCustomizeReactionsCallback,
    handleDismissActionMessage,
    handleReplyCallback,
    handleOpenStory,
    handleOpenSparksWalletCallback,
    handleOpenWhiteboardForEdit,
    showInChatSearch,
    inChatSearchQuery,
    translationsByMsgId,
    handleTranslateMessage,
    handleToggleTranslation,
    targetLang
  ]);

  return (
    <div
      className={`chat-window-container ${isVanishMode ? 'vanish-mode-active-container' : ''}`}
      data-chat-theme={chatTheme !== 'default' ? chatTheme : undefined}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--bg-chat)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isVanishMode ? 'inset 0 0 40px rgba(168, 85, 247, 0.28), inset 0 0 80px rgba(147, 51, 234, 0.16)' : undefined,
        transition: 'box-shadow 0.4s ease'
      }}
    >
      <ChatLiveWallpaper wallpaperId={chatWallpaper} customImage={customWallpaper} />

      {/* Full Song Background Audio Banner for Chat with Seek Adjust & Next Song Controls */}
      {chatMusicSong && !isChatMusicMuted && (
        <div style={{
          position: 'relative',
          zIndex: 10,
          background: 'linear-gradient(135deg, rgba(15, 15, 22, 0.96), rgba(26, 22, 60, 0.96))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
          padding: '6px 14px 8px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          animation: 'pulseFadeIn 0.25s ease'
        }}>
          {/* Main Top Row: Info & Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            {/* Song Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <img
                src={chatMusicSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${chatMusicSong.songTitle}`}
                alt="Track"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  animation: isSongPlaying ? 'spin 4s linear infinite' : 'none',
                  flexShrink: 0,
                  border: '1.5px solid #f59e0b'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🎵 {chatMusicSong.songTitle}
                  </span>
                  <span style={{ fontSize: '0.62rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 5px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.4)', whiteSpace: 'nowrap' }}>
                    Auto-Next ⚡
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chatMusicSong.artistName || 'PulseChat Full Music'}
                </span>
              </div>
            </div>

            {/* Action Buttons: Play/Pause, -10s, +10s, Next, Mute, Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* -10s Quick Jump */}
              <button
                type="button"
                onClick={() => handleSkipTime(-10)}
                title="Rewind 10 seconds"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '3px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                -10s
              </button>

              {/* Play / Pause Toggle Button */}
              <button
                type="button"
                onClick={handleTogglePlayPause}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                }}
                title={isSongPlaying ? 'Pause' : 'Play'}
              >
                {isSongPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '2px' }} />}
              </button>

              {/* +10s Quick Jump */}
              <button
                type="button"
                onClick={() => handleSkipTime(10)}
                title="Forward 10 seconds"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '3px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                +10s
              </button>

              {/* Next Song Button */}
              <button
                type="button"
                onClick={handlePlayNextSong}
                disabled={isAutoNextLoading}
                style={{
                  background: 'rgba(99, 102, 241, 0.22)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  color: '#a5b4fc',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: isAutoNextLoading ? 'wait' : 'pointer'
                }}
                title="Play Next Similar Song"
              >
                {isAutoNextLoading ? <Loader2 size={14} className="spin" /> : <SkipForward size={14} />}
                <span>Next</span>
              </button>

              {/* Mute Button */}
              <button
                type="button"
                onClick={() => setIsChatMusicMuted(m => !m)}
                style={{
                  background: isChatMusicMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  border: isChatMusicMuted ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: isChatMusicMuted ? '#ef4444' : '#e2e8f0',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title={isChatMusicMuted ? 'Unmute' : 'Mute'}
              >
                {isChatMusicMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => handleUpdateChatMusic(null)}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Close Music"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Seek Bar & Duration Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '2px',
            userSelect: 'none'
          }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', minWidth: '30px' }}>
              {formatSongTime(songProgress)}
            </span>
            <input
              type="range"
              min="0"
              max={songDuration || 100}
              step="1"
              value={songProgress}
              onChange={handleSeekSong}
              style={{
                flex: 1,
                accentColor: '#f59e0b',
                height: '4px',
                cursor: 'pointer',
                borderRadius: '2px'
              }}
            />
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', minWidth: '30px', textAlign: 'right' }}>
              {formatSongTime(songDuration)}
            </span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      {!isActionSelectionMode ? (
        <div style={{
        padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0.75rem 6px 0.75rem',
        borderBottom: '1px solid var(--border)',
        background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
        backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        position: 'relative',
        zIndex: 150,
        overflow: 'visible'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
            {onBack && (
              <button
                className="chat-back-btn icon-btn-ghost"
                onClick={() => {
                  if (user?.id && activeChat?.id) {
                    clearUnreadCount(user.id, activeChat.id);
                    if (chatId) clearUnreadCount(user.id, chatId);
                    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
                  }
                  if (isVanishModeRef.current || (messagesRef.current || []).some(m => m?.isVanish)) {
                    triggerEvaporateVanishMessages(chatId);
                  }
                  if (onBack) onBack();
                }}
                title="Back to Home / Chats"
                style={{ width: '32px', height: '32px' }}
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <VibeAuraRing aura={partnerAura} size={38} isGroup={isGroup} hasCrown={Boolean(!isGroup && (chatHasKingCrown || chatHasSilverCrown || chatHasStreakCrown))}>
              <div
                className={!isGroup ? getProAuraRingClass(partnerAura, chatIsPro) : ''}
                style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
              >
                {!isGroup && chatHasKingCrown ? (
                  <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                ) : !isGroup && chatHasSilverCrown ? (
                  <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                ) : !isGroup && chatHasStreakCrown ? (
                  <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                ) : null}
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
                    width: '38px',
                    height: '38px',
                    borderRadius: isGroup ? '10px' : '50%',
                    cursor: 'pointer',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: !isGroup && chatHasKingCrown
                      ? '2px solid #fbbf24'
                      : !isGroup && chatHasSilverCrown
                      ? '2px solid #cbd5e1'
                      : !isGroup && chatHasStreakCrown
                      ? '2px solid #f97316'
                      : (!isGroup && chatIsPro ? 'none' : 'none')
                  }}
                  title={isGroup ? 'Click for group details & members' : 'Click to view full screen DP'}
                />
              </div>
            </VibeAuraRing>

            <div
              className="chat-header-title-box"
              onClick={() => isAnonymousBot ? setShowStoryCardModal(true) : (isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true))}
              style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
              title={isGroup ? 'Click to view group bio, members & edit info' : (partnerNickname ? `Nickname: ${partnerNickname} (Real: ${chatDisplayName || activeChat.displayName}) · Click for profile` : 'Click to view profile & bio')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {partnerNickname || chatDisplayName || activeChat.displayName}
                </h3>
                {!isGroup && chatIsPro && (
                  <PulseVipBadge size={15} showLabel={false} />
                )}
                {isGroup && <span className="group-pill-badge"><Users size={11} /> Group</span>}
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
                {isGhostMode && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: 'rgba(168, 85, 247, 0.22)',
                      color: '#c084fc',
                      fontWeight: 700,
                      border: '1px solid rgba(168, 85, 247, 0.45)',
                      flexShrink: 0
                    }}
                    title="Ghost Mode is Active: Your contact cannot see blue double ticks or when you read messages!"
                  >
                    👻 Ghost Mode
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.74rem', color: isTyping ? '#22c55e' : 'var(--text-muted)', fontWeight: isTyping ? 600 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isGroup
                  ? (isTyping ? `✍️ ${typingUser} is typing...` : `${activeChat.members?.length || 0} members`)
                  : isAnonymousBot
                    ? '🤫 Public Q&A Link Active'
                    : isTyping
                      ? '✍️ typing...'
                      : isOnline
                        ? 'Online'
                        : 'Offline'}
              </p>
            </div>
          </div>

          <div className="chat-header-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {/* Position 2: Mobile App Folder Button (Animated Cyber-Neon Glassmorphic Folder) */}
            <button
              onClick={() => {
                setAppsFolderView('main');
                setShowAppsFolderModal(true);
              }}
              className="chat-apps-folder-btn chat-neon-app-folder"
              title="Apps & Games (Arrow Battle, Drawboard, Music)"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.16))',
                border: '1.5px solid rgba(168, 85, 247, 0.6)',
                backdropFilter: 'blur(12px)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '2.5px',
                padding: '3.5px',
                cursor: 'pointer',
                flexShrink: 0,
                alignItems: 'center',
                justifyItems: 'center'
              }}
            >
              {/* Mini App 1: Game */}
              <div style={{
                width: '11px',
                height: '11px',
                borderRadius: '3px',
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 5px rgba(236, 72, 153, 0.6)'
              }}>
                <Gamepad2 size={7} color="#fff" />
              </div>
              {/* Mini App 2: Drawboard */}
              <div style={{
                width: '11px',
                height: '11px',
                borderRadius: '3px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 5px rgba(16, 185, 129, 0.6)'
              }}>
                <Presentation size={7} color="#fff" />
              </div>
              {/* Mini App 3: Music */}
              <div style={{
                width: '11px',
                height: '11px',
                borderRadius: '3px',
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 5px rgba(245, 158, 11, 0.6)'
              }}>
                <Music size={7} color="#fff" />
              </div>
              {/* Mini App 4: Sparks / Live */}
              <div style={{
                width: '11px',
                height: '11px',
                borderRadius: '3px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 5px rgba(139, 92, 246, 0.6)'
              }}>
                <Sparkles size={7} color="#fff" />
              </div>
            </button>

            {/* 3-Dots More Options Menu */}
            <div
              ref={moreMenuRef}
              className="chat-header-more-container"
              style={{ position: 'relative', zIndex: 500 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(prev => {
                    if (!prev) setMoreSubMenuOpen(false);
                    return !prev;
                  });
                }}
                className="icon-btn-ghost"
                title="More Options"
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: showMoreMenu ? 'var(--hover-bg)' : 'transparent' }}
              >
                <MoreVertical size={18} />
              </button>

              {showMoreMenu && (
                <div
                  className="chat-header-dropdown-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!moreSubMenuOpen ? (
                    <>
                      {/* Voice & Video Calls */}
                      <button onClick={() => { setShowMoreMenu(false); isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall(false); }}>
                        <Phone size={16} color="var(--accent)" />
                        <span>{isGroup ? 'Group Voice Call' : 'Voice Call'}</span>
                      </button>
                      <button onClick={() => { setShowMoreMenu(false); isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall(true); }}>
                        <Video size={16} color="var(--accent)" />
                        <span>{isGroup ? 'Group Video Call' : 'Video Call'}</span>
                      </button>

                      {/* Search in chat */}
                      <button onClick={() => {
                        setShowMoreMenu(false);
                        setShowInChatSearch(true);
                        setTimeout(() => inChatSearchInputRef.current?.focus(), 120);
                      }}>
                        <Search size={16} color="var(--accent)" />
                        <span>Search in chat</span>
                      </button>

                      <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                      <button onClick={() => { setShowMoreMenu(false); setShowThemeModal(true); }}>
                        <ImageIcon size={16} color="var(--accent)" />
                        <span>Chat background</span>
                      </button>
                      <button onClick={() => { setShowMoreMenu(false); setShowSolidThemeModal(true); }}>
                        <Palette size={16} color="var(--accent)" />
                        <span>Change Solid Theme</span>
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
                      <button onClick={() => { setShowMoreMenu(false); handleToggleVanishMode(); }}>
                        <Ghost size={16} color={isVanishMode ? '#c084fc' : 'var(--accent)'} />
                        <span>Vanish Mode {isVanishMode ? '(On)' : '(Off)'}</span>
                      </button>

                      <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreSubMenuOpen(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MoreVertical size={16} color="var(--accent)" />
                          <span>More</span>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreSubMenuOpen(false);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px', width: '100%' }}
                      >
                        <ChevronLeft size={16} color="var(--accent)" />
                        <span>More</span>
                      </button>

                      {/* 1. Chat Lock */}
                      <button onClick={handleToggleChatLockFromMenu}>
                        {isChatLockedState ? <Unlock size={16} color="#10b981" /> : <Lock size={16} color="var(--accent)" />}
                        <span>{isChatLockedState ? 'Unlock Chat' : 'Chat Lock 🔒'}</span>
                      </button>

                      {/* 2. Mute / Unmute Notifications */}
                      <button onClick={handleToggleChatMuteFromMenu}>
                        {isChatMutedState ? <Bell size={16} color="var(--accent)" /> : <BellOff size={16} color="#f59e0b" />}
                        <span>{isChatMutedState ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                      </button>

                      {/* 3. Clear Chat */}
                      <button onClick={() => { setShowMoreMenu(false); setMoreSubMenuOpen(false); handleClearCurrentChat(); }} style={{ color: '#ef4444' }}>
                        <Trash2 size={16} color="#ef4444" />
                        <span>Clear Chat</span>
                      </button>

                      {/* 4. Block Contact (if direct chat) */}
                      {!isGroup && (
                        <button
                          onClick={async () => {
                            setShowMoreMenu(false);
                            setMoreSubMenuOpen(false);
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

                      {/* 5. Contact Info / Group Info (Placed LAST in the list!) */}
                      <button onClick={() => { setShowMoreMenu(false); setMoreSubMenuOpen(false); isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true); }}>
                        <Info size={16} color="var(--accent)" />
                        <span>{isGroup ? 'Group Info' : 'Contact Info'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Pulse Aura Background Soundscape Dropdown Selector Card */}
              {showAuraMenu && (
                <div style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                  width: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>🎵 Background Music</span>
                    <button onClick={() => setShowAuraMenu(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Search Music Button (VIP Exclusive) */}
                  <button
                    onClick={() => {
                      setShowAuraMenu(false);
                      handleOpenMusic();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      margin: '4px 0'
                    }}
                  >
                    <Music size={16} />
                    <span>{chatMusicSong ? '🎵 Change Song' : '🎵 Search & Play Music'}</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.55)',
                      padding: '2px 5px',
                      borderRadius: '5px'
                    }}>
                      <Crown size={12} color="#fbbf24" strokeWidth={2.4} fill="rgba(245, 158, 11, 0.3)" />
                    </span>
                  </button>

                  {/* Active Selected Song Badge if any */}
                  {chatMusicSong && (
                    <div style={{
                      padding: '8px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <img
                          src={chatMusicSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${chatMusicSong.songTitle}`}
                          alt="Track"
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', animation: 'spin 4s linear infinite' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chatMusicSong.songTitle}
                          </span>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chatMusicSong.artistName}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpdateChatMusic(null)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        title="Remove Music"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Mute Music / Sound Option */}
                  <button
                    onClick={() => {
                      if (chatMusicSong) handleUpdateChatMusic(null);
                      handleSelectAura('off');
                      setShowAuraMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'left'
                    }}
                  >
                    <VolumeX size={14} color="#ef4444" />
                    <span>Mute Music / Sound</span>
                  </button>

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
                        <Volume2 size={14} color="var(--accent)" /> Music Volume
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
          </div>
        </div>
      </div>
      ) : (
        <div style={{
          padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0.75rem 6px 0.75rem',
          borderBottom: '2px solid var(--accent)',
          background: (chatWallpaper && chatWallpaper !== 'none')
            ? 'color-mix(in srgb, var(--bg-card) 92%, transparent)'
            : 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 50
        }}>
          {/* Left: Close Button + Dynamic Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDismissActionMessage}
              className="icon-btn-ghost"
              style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
              title="Unselect messages"
            >
              <ArrowLeft size={18} />
            </button>
            <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              {selectedActionMessages.length}
            </span>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {/* Reply - only visible when exactly 1 message is selected */}
            {selectedActionMessages.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  const targetMsg = selectedActionMessages[0];
                  const senderInfo = groupMembersMap[targetMsg.senderId];
                  setReplyTo({
                    ...targetMsg,
                    senderName: targetMsg.senderId === user.id
                      ? 'You'
                      : (senderInfo?.displayName || senderInfo?.username || activeChat.displayName)
                  });
                  handleDismissActionMessage();
                  replyInputRef.current?.focus();
                }}
                className="icon-btn-ghost"
                title="Reply"
                style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
              >
                <CornerUpLeft size={17} />
              </button>
            )}

            {/* Select All Button */}
            <button
              type="button"
              onClick={() => {
                const selectableMessages = messages.filter(m => m.type !== 'deleted' && m.type !== 'system');
                const isAllSelected = selectableMessages.length > 0 && selectableMessages.every(m => selectedActionMessages.some(sm => sm.id === m.id));
                if (isAllSelected) {
                  handleDismissActionMessage();
                } else {
                  setSelectedActionMessages(selectableMessages.length > 0 ? selectableMessages : [...messages]);
                }
              }}
              className="icon-btn-ghost"
              title={
                messages.filter(m => m.type !== 'deleted' && m.type !== 'system').every(m => selectedActionMessages.some(sm => sm.id === m.id))
                  ? "Deselect all"
                  : "Select all"
              }
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                color: (messages.filter(m => m.type !== 'deleted' && m.type !== 'system').length > 0 && messages.filter(m => m.type !== 'deleted' && m.type !== 'system').every(m => selectedActionMessages.some(sm => sm.id === m.id)))
                  ? 'var(--accent)'
                  : 'var(--text-main)'
              }}
            >
              <CheckSquare size={17} />
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={() => handleCopyMessages(selectedActionMessages)}
              className="icon-btn-ghost"
              title="Copy message(s)"
              style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
            >
              <Copy size={17} />
            </button>

            {/* Forward */}
            <button
              type="button"
              onClick={() => setShowForwardModal(true)}
              className="icon-btn-ghost"
              title="Forward message(s)"
              style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
            >
              <Forward size={17} />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => handleDeleteActionMessage(selectedActionMessages)}
              className="icon-btn-ghost"
              title="Delete message(s)"
              style={{ width: '34px', height: '34px', borderRadius: '50%', color: '#ef4444' }}
            >
              <Trash2 size={17} />
            </button>

            {/* 3-Dots More Options Menu */}
            {selectedActionMessages.length >= 1 && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowActionMoreMenu(prev => !prev)}
                  className="icon-btn-ghost"
                  title="More options"
                  style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
                >
                  <MoreVertical size={17} />
                </button>

                {showActionMoreMenu && (
                  <div className="chat-header-dropdown-menu" style={{ right: 0, minWidth: '190px', zIndex: 2000 }}>
                    {/* Star / Unstar in 3-dots */}
                    <button
                      onClick={() => {
                        setShowActionMoreMenu(false);
                        handleToggleStarMessages(selectedActionMessages);
                      }}
                    >
                      <Star
                        size={16}
                        color="#f59e0b"
                        fill={(selectedActionMessages.length > 0 && selectedActionMessages.every(m => starredMsgIds.includes(m.id))) ? "#f59e0b" : "none"}
                      />
                      <span>{(selectedActionMessages.length > 0 && selectedActionMessages.every(m => starredMsgIds.includes(m.id))) ? 'Unstar message' : 'Star message'}</span>
                    </button>

                    {selectedActionMessages.length === 1 && (
                      <button
                        onClick={() => {
                          setShowActionMoreMenu(false);
                          const targetMsg = selectedActionMessages[0];
                          if (pinnedMessage?.id === targetMsg?.id) {
                            handleUnpinMessage();
                          } else {
                            handlePinMessage(targetMsg);
                          }
                        }}
                      >
                        <Pin size={16} color="var(--accent)" />
                        <span>{pinnedMessage?.id === selectedActionMessages[0]?.id ? 'Unpin message' : 'Pin message'}</span>
                      </button>
                    )}

                    {selectedActionMessages.length === 1 && (
                      <button
                        onClick={() => {
                          setShowActionMoreMenu(false);
                          setShowMessageInfoModal(true);
                        }}
                      >
                        <Info size={16} color="var(--accent)" />
                        <span>Message info</span>
                      </button>
                    )}

                    {selectedActionMessages[0]?.senderId !== user.id && !isGroup && (
                      <button
                        onClick={async () => {
                          setShowActionMoreMenu(false);
                          if (window.confirm(`Report message and block ${activeChat.displayName}?`)) {
                            await blockUser(activeChat.id);
                            setBlockStatus(prev => ({ ...prev, isBlockedByMe: true }));
                            setActionToast('User reported and blocked 🚨');
                            setTimeout(() => setActionToast(''), 2500);
                            handleDismissActionMessage();
                          }
                        }}
                        style={{ color: '#ef4444' }}
                      >
                        <Ban size={16} color="#ef4444" />
                        <span>Report & Block</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot Alert Floating Banner */}
      {screenshotAlert && (
        <div style={{
          position: 'sticky',
          top: '8px',
          zIndex: 9999,
          margin: '6px 16px',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: '#fff',
          padding: '9px 16px',
          borderRadius: '16px',
          boxShadow: '0 6px 20px rgba(239, 68, 68, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          fontSize: '0.85rem',
          fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.3)',
          animation: 'pulse 1.2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} />
            <span>🚨 {screenshotAlert.takerName} took a screenshot of a Fog Snap!</span>
          </div>
          <button onClick={() => setScreenshotAlert(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div
          className="pinned-message-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 14px',
            background: (chatWallpaper && chatWallpaper !== 'none')
              ? 'color-mix(in srgb, var(--bg-card) 92%, transparent)'
              : 'var(--bg-card)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontSize: '0.82rem',
            color: 'var(--text-main)',
            zIndex: 15,
            position: 'relative',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
        >
          <div
            onClick={() => handleJumpToMessage(pinnedMessage.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, minWidth: 0 }}
            title="Click to jump to pinned message"
          >
            <Pin size={15} color="#f59e0b" style={{ flexShrink: 0, transform: 'rotate(45deg)' }} />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, marginRight: '6px' }}>Pinned:</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {pinnedMessage.type === 'image' ? '📷 Photo' :
                 pinnedMessage.type === 'audio' ? '🎵 Voice Note' :
                 pinnedMessage.type === 'gift' ? '🎁 Sticker' :
                 pinnedMessage.type === 'poll' ? '📊 Poll' :
                 (pinnedMessage.content || 'Message')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnpinMessage}
            className="icon-btn-ghost"
            style={{ width: '26px', height: '26px', borderRadius: '50%', padding: 0 }}
            title="Unpin message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tap-outside Backdrop to dismiss Message Action */}
      {selectedActionMessages.length > 0 && (
        <div
          className="message-action-backdrop"
          onClick={handleDismissActionMessage}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 40,
            touchAction: 'none'
          }}
        />
      )}

      {/* WhatsApp-Style Offline Indicator */}
      {!isNetConnected && (
        <div style={{
          background: '#18181b',
          borderBottom: '1px solid rgba(234, 179, 8, 0.45)',
          color: '#facc15',
          padding: '8px 16px',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          zIndex: 120,
          position: 'relative'
        }}>
          <WifiOff size={15} color="#facc15" style={{ flexShrink: 0 }} />
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

        {/* In-Chat Search Bar Overlay (Message Finder) */}
        {showInChatSearch && (
          <div
            style={{
              padding: '8px 14px',
              background: (chatWallpaper && chatWallpaper !== 'none')
                ? 'color-mix(in srgb, var(--bg-card) 92%, transparent)'
                : 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              zIndex: 30,
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              animation: 'pulseFadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, background: 'var(--hover-bg)', borderRadius: '20px', padding: '5px 12px', border: '1px solid var(--border)' }}>
              <Search size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
              <input
                ref={inChatSearchInputRef}
                type="text"
                value={inChatSearchQuery}
                onChange={(e) => setInChatSearchQuery(e.target.value)}
                placeholder="Search words in conversation..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.86rem',
                  outline: 'none'
                }}
              />
              {inChatSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInChatSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Match Counter & Jump Arrows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.76rem', color: matchedMessageIds.length > 0 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600, minWidth: '42px', textAlign: 'center' }}>
                {inChatSearchQuery.trim() ? (matchedMessageIds.length > 0 ? `${searchMatchIndex + 1}/${matchedMessageIds.length}` : '0 found') : ''}
              </span>
              <button
                type="button"
                onClick={handlePrevSearchMatch}
                disabled={matchedMessageIds.length === 0}
                className="icon-btn-ghost"
                style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, opacity: matchedMessageIds.length > 0 ? 1 : 0.35, cursor: matchedMessageIds.length > 0 ? 'pointer' : 'default' }}
                title="Previous match"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextSearchMatch}
                disabled={matchedMessageIds.length === 0}
                className="icon-btn-ghost"
                style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, opacity: matchedMessageIds.length > 0 ? 1 : 0.35, cursor: matchedMessageIds.length > 0 ? 'pointer' : 'default' }}
                title="Next match"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInChatSearch(false);
                  setInChatSearchQuery('');
                }}
                className="icon-btn-ghost"
                style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, color: 'var(--text-muted)' }}
                title="Close search"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Live In-Line Translation Control Bar */}
        {showTranslateBar && (
          <div
            style={{
              padding: '7px 14px',
              background: (chatWallpaper && chatWallpaper !== 'none')
                ? 'color-mix(in srgb, var(--bg-card) 94%, transparent)'
                : 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              zIndex: 28,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              animation: 'pulseFadeIn 0.2s ease',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={15} color="#06b6d4" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#06b6d4' }}>
                  Live Translation:
                </span>
              </div>

              {/* Target Language Dropdown */}
              <select
                value={targetLang}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setTargetLang(newLang);
                  try {
                    localStorage.setItem('pulsechat_target_lang', newLang);
                  } catch (_) {}
                  if (isAutoTranslateActive) {
                    messages.slice(-15).forEach(m => {
                      if (m.content && m.senderId !== user?.id && m.type !== 'deleted') {
                        handleTranslateMessage(m, newLang);
                      }
                    });
                  }
                }}
                style={{
                  background: 'var(--hover-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {GLOBAL_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.code.toUpperCase()})
                  </option>
                ))}
              </select>

              {/* Auto Translate Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !isAutoTranslateActive;
                  setIsAutoTranslateActive(nextVal);
                  try {
                    localStorage.setItem(`pulsechat_auto_translate_${chatId}`, String(nextVal));
                  } catch (_) {}
                  if (nextVal) {
                    setActionToast(`Auto-translate to ${targetLang.toUpperCase()} turned ON 🌐`);
                    messages.slice(-15).forEach(m => {
                      if (m.content && m.senderId !== user?.id && m.type !== 'deleted') {
                        handleTranslateMessage(m);
                      }
                    });
                  } else {
                    setActionToast('Auto-translate turned OFF');
                  }
                  setTimeout(() => setActionToast(''), 2500);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isAutoTranslateActive ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'var(--hover-bg)',
                  color: isAutoTranslateActive ? '#fff' : 'var(--text-muted)',
                  border: isAutoTranslateActive ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {isAutoTranslateActive ? '⚡ Auto-Translate ON' : 'Auto-Translate OFF'}
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowTranslateBar(false)}
              className="icon-btn-ghost"
              style={{ width: '26px', height: '26px', borderRadius: '50%', padding: 0, color: 'var(--text-muted)' }}
              title="Close translation bar"
            >
              <X size={15} />
            </button>
          </div>
        )}

      {/* Top Mood Timeline: Ultra-Slim Pencil Line with Micro Typography */}
      {!blockStatus.isBlockedByMe && !blockStatus.isBlockedByThem && (
        <div
          ref={moodTimelineRef}
          style={{
            padding: '2px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            position: 'relative',
            zIndex: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            lineHeight: 1
          }}
        >
          {/* Left Pencil Line */}
          <div style={{
            width: '20px',
            flexShrink: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.45))'
          }} />

          {/* Micro Mood Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              background: 'rgba(168, 85, 247, 0.08)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Conversation Mood Sentiment"
          >
            <span style={{ fontSize: '0.74rem', lineHeight: 1 }}>{moodInfo?.emoji || '💬'}</span>
            <span style={{
              color: '#c084fc',
              fontWeight: 700,
              fontSize: '0.67rem',
              letterSpacing: '0.01em'
            }}>
              Mood: {moodInfo?.mood || 'Casual'}
            </span>

            {moodSteps.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '3px' }}>
                <span style={{ color: 'var(--text-muted)', opacity: 0.35, fontSize: '0.55rem' }}>|</span>
                {moodSteps.map((step, idx) => (
                  <React.Fragment key={step.id || idx}>
                    <span
                      style={{
                        color: step.color,
                        fontWeight: 600,
                        fontSize: '0.62rem',
                        background: step.bg,
                        padding: '1px 5px',
                        borderRadius: '6px',
                        border: `0.5px solid ${step.border}`,
                        whiteSpace: 'nowrap',
                        opacity: step.isPending ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      title={step.preview}
                    >
                      <span>{step.emoji}</span>
                      <span>{step.mood}</span>
                    </span>
                    {idx < moodSteps.length - 1 && (
                      <span style={{ color: 'var(--text-muted)', opacity: 0.35, fontSize: '0.55rem' }}>→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Right Pencil Line stretching across */}
          <div style={{
            flex: 1,
            height: '1px',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.45), transparent)'
          }} />
        </div>
      )}

      {/* Instagram-style Vanish Mode Alert Banner - Directly Below Mood Timeline */}
      {isVanishMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '7px 16px',
          background: 'linear-gradient(90deg, rgba(88, 28, 135, 0.5) 0%, rgba(126, 34, 206, 0.6) 50%, rgba(88, 28, 135, 0.5) 100%)',
          borderBottom: '1px solid rgba(192, 132, 252, 0.35)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#f3e8ff',
          fontSize: '0.78rem',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease-out',
          position: 'relative',
          zIndex: 8
        }}>
          <Ghost size={15} color="#c084fc" />
          <span>
            <strong>Vanish Mode Active</strong> · Messages will vanish permanently when the chat is closed
          </span>
          <button
            type="button"
            onClick={handleToggleVanishMode}
            style={{
              marginLeft: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '8px',
              padding: '2px 8px',
              color: '#ffffff',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Message Stream with Live Wallpaper Overlay & WhatsApp-Style Date Dividers */}
      <div
        ref={chatContainerRef}
        className="chat-messages-scroll-area chat-scroll-stream"
        onScroll={handleChatContainerScroll}
        onTouchStart={handleVanishTouchStart}
        onTouchMove={handleVanishTouchMove}
        onTouchEnd={handleVanishTouchEnd}
        onClick={() => {
          if (selectedActionMessages.length > 0) handleDismissActionMessage();
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowAnchor: 'none',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          position: 'relative',
          zIndex: selectedActionMessages.length > 0 ? 45 : 1,
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain'
        }}
      >
        {/* Instagram-style Vanish Mode Swipe-Up Gesture Indicator */}
        {swipeUpDist > 35 && (
          <div
            className="vanish-swipe-indicator"
            style={{
              position: 'fixed',
              bottom: '90px',
              left: '50%',
              transform: `translateX(-50%) translateY(-${Math.min(swipeUpDist * 0.3, 35)}px)`,
              background: swipeUpDist >= 140
                ? 'linear-gradient(135deg, #a855f7, #c084fc)'
                : 'rgba(15, 23, 42, 0.92)',
              border: `1.5px solid ${swipeUpDist >= 140 ? '#e9d5ff' : 'rgba(168, 85, 247, 0.6)'}`,
              borderRadius: '24px',
              padding: '8px 18px',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: swipeUpDist >= 140
                ? '0 0 24px rgba(168, 85, 247, 0.8), 0 4px 16px rgba(0,0,0,0.5)'
                : '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            <Ghost size={16} color={swipeUpDist >= 140 ? '#ffffff' : '#c084fc'} />
            <span>
              {swipeUpDist >= 140
                ? (isVanishMode ? 'Release to turn off Vanish Mode' : 'Release to turn on Vanish Mode')
                : (isVanishMode ? 'Swipe up to turn off Vanish Mode' : 'Swipe up to turn on Vanish Mode')}
            </span>
          </div>
        )}
        {!isGroup && !isAnonymousBot && friendshipStatus !== 'friends' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '8px 16px',
            margin: '8px auto 12px auto',
            maxWidth: '540px',
            width: 'calc(100% - 24px)',
            borderRadius: '20px',
            background: 'rgba(24, 24, 27, 0.78)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            zIndex: 10
          }}>
            {friendshipStatus === 'pending_sent' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <Clock size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Sync request sent to <strong style={{ color: 'var(--text-main)' }}>{activeChat.displayName || activeChat.username}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelFriendRequest}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '16px',
                    padding: '4px 13px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                  title="Cancel sync request"
                >
                  Cancel Request
                </button>
              </>
            ) : friendshipStatus === 'pending_received' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <Sparkles size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{activeChat.displayName || activeChat.username}</strong> wants to connect
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAcceptFriendRequest}
                  style={{
                    background: 'var(--accent, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '5px 16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                    flexShrink: 0
                  }}
                >
                  Accept
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <Sparkles size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Sync with <strong style={{ color: 'var(--text-main)' }}>{activeChat.displayName || activeChat.username}</strong> to chat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSendFriendRequest}
                  style={{
                    background: 'var(--accent, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '5px 16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={12} /> Sync
                </button>
              </>
            )}
          </div>
        )}

        {renderedMessagesList}
        <div ref={messagesEndRef} style={{ overflowAnchor: 'none', height: '1px' }} />
      </div>

      {/* Floating "Scroll to Bottom" Button with New Messages Counter */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom('smooth');
            setShowScrollBottom(false);
            showScrollBottomRef.current = false;
            isPinnedToBottomRef.current = true;
            setNewScrolledMessagesCount(0);
          }}
          style={{
            position: 'absolute',
            bottom: replyTo ? '140px' : '78px',
            right: '18px',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            color: 'var(--accent)',
            border: '1.5px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 12px rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 35,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'pulseModalPop 0.18s ease-out'
          }}
          title="Jump to latest message"
        >
          <ChevronDown size={22} strokeWidth={2.5} />
          {newScrolledMessagesCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-4px',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 800,
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                border: '1.5px solid var(--bg-card)'
              }}
            >
              {newScrolledMessagesCount}
            </span>
          )}
        </button>
      )}

      {/* Clear Chat Undo Banner */}
      {clearedUndoSecs > 0 && (
        <div style={{
          position: 'relative',
          zIndex: 80,
          background: '#18181b',
          border: '1.5px solid rgba(239, 68, 68, 0.7)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: '14px',
          margin: '0 1rem 0.6rem 1rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.85)'
        }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🧹</span> Chat cleared for {activeChat.displayName} ({clearedUndoSecs}s)
          </span>
          <button
            type="button"
            onClick={handleUndoClearChat}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Multi-Select Delete Undo Banner */}
      {multiDeleteUndoSecs > 0 && (
        <div style={{
          position: 'relative',
          zIndex: 80,
          background: '#18181b',
          border: '1.5px solid rgba(239, 68, 68, 0.7)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: '14px',
          margin: '0 1rem 0.6rem 1rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.85)'
        }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗑️</span> {multiDeleteBackupIds.length} messages deleted ({multiDeleteUndoSecs}s)
          </span>
          <button
            type="button"
            onClick={handleUndoMultiDelete}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)'
            }}
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Single Delete Undo Banner */}
      {undoMessageId && (
        <div style={{
          position: 'relative',
          zIndex: 80,
          background: '#18181b',
          border: '1.5px solid rgba(139, 92, 246, 0.7)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: '14px',
          margin: '0 1rem 0.6rem 1rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.85)'
        }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗑️</span> Message deleted
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.5)'
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

      {/* Bottom Pulse Streaks Badge (in place of Set Vibe) */}
      {!isGroup && !blockStatus.isBlockedByMe && !blockStatus.isBlockedByThem && (
        <div style={{ padding: '0.15rem 1rem 0.15rem 1rem', display: 'flex', alignItems: 'center', background: 'transparent', position: 'relative', zIndex: 2 }}>
          <button
            type="button"
            onClick={() => setShowStreakModal(true)}
            className="chat-neon-streak-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.22), rgba(239, 68, 68, 0.15))',
              border: '1px solid rgba(249, 115, 22, 0.65)',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#ff8a3d',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0 10px rgba(249, 115, 22, 0.25)'
            }}
            title="Pulse Streaks with Sparks Reward & Streak Freeze"
          >
            <span className="chat-neon-streak-flame" style={{ fontSize: '0.82rem', lineHeight: 1 }}>🔥</span>
            <span style={{
              background: 'linear-gradient(135deg, #ffb347, #ff4500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
              fontSize: '0.76rem',
              lineHeight: 1
            }}>
              {streakData?.streakCount || 0}
            </span>
            {(streakData?.streakShields || 0) > 0 && (
              <span style={{ fontSize: '0.68rem', marginLeft: '1px', filter: 'drop-shadow(0 0 4px #38bdf8)' }} title={`${streakData.streakShields} Freeze Shield Active`}>
                ❄️{streakData.streakShields}
              </span>
            )}
          </button>
        </div>
      )}

      {/* WhatsApp-Style Reply Preview Strip */}
      {replyTo && (
        <div style={{
          padding: '8px 16px',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
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
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
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
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
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
      ) : (!isGroup && !isAnonymousBot && friendshipStatus !== 'friends') ? null : isAnonymousBot ? (
        <div style={{
          padding: '1rem 1.2rem',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 88%, transparent)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          borderTop: '1px solid rgba(168, 85, 247, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          position: 'relative',
          zIndex: 2,
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.15rem' }}>🤫</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Anonymous Pulse Inbox
            </span>
            <span style={{
              fontSize: '0.64rem',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(168, 85, 247, 0.22)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              color: '#c084fc',
              fontWeight: 800
            }}>
              NGL Q&A
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '460px', lineHeight: 1.45 }}>
            Secret questions & messages from your Instagram Bio link arrive here! Tap <strong style={{ color: 'var(--text-main)' }}>"📸 Share to Instagram Story"</strong> on any message card above to post your answer.
          </p>
          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '420px', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => {
                const shareUrl = typeof window !== 'undefined'
                  ? `${window.location.origin}/ask/@${user?.username || 'user'}`
                  : `https://pulsechat.me/ask/@${user?.username || 'user'}`;
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(shareUrl);
                }
                setActionToast('Bio link copied to clipboard! 🔗');
                setTimeout(() => setActionToast(''), 2500);
              }}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Copy size={15} />
              <span>Copy Bio Link</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStoryCardModal(true)}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                border: 'none',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={15} />
              <span>Story Card 📸</span>
            </button>
          </div>
        </div>
      ) : (
        <>
        {/* Scheduled Messages Banner for active chat */}
        {chatScheduledMessages.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            borderTop: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-main)',
            position: 'relative',
            zIndex: 5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, overflow: 'hidden' }}>
              <Clock size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                {chatScheduledMessages.length} Scheduled
              </span>
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                • Next at {new Date(chatScheduledMessages[0].scheduledTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: "{chatScheduledMessages[0].text.slice(0, 24)}"
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCancelScheduledMessage(chatScheduledMessages[0].id)}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '8px',
                flexShrink: 0
              }}
              title="Cancel this scheduled message"
            >
              Cancel ✕
            </button>
          </div>
        )}

        <div style={{
          padding: '0.35rem 0.5rem',
          paddingBottom: 'calc(0.45rem + env(safe-area-inset-bottom, 0px))',
          background: 'transparent',
          borderTop: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          position: 'relative',
          zIndex: 2,
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {showEmoji && (
            <EmojiPicker onSelectEmoji={(emoji) => inputCapsuleRef.current?.insertEmoji(emoji)} onClose={() => setShowEmoji(false)} />
          )}

          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={dustImageInputRef}
            accept="image/*,video/*"
            onChange={(e) => handleSpecificMediaSelect(e, 'dust')}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            onChange={(e) => handleSpecificMediaSelect(e, 'normal')}
            style={{ display: 'none' }}
          />

          {/* 4-Dot Quick Action Drawer (Transparent Glass Background + Theme Adaptive Neon Light Outline) */}
          {showActionGrid && (
            <div
              ref={actionGridRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '12px',
                background: 'color-mix(in srgb, var(--accent) 26%, transparent)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid var(--accent)',
                borderRadius: '20px',
                padding: '14px',
                boxShadow: '0 0 22px color-mix(in srgb, var(--accent) 55%, transparent), 0 4px 14px rgba(0,0,0,0.3)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                zIndex: 1100,
                width: 'min(330px, 92vw)',
                maxHeight: 'min(440px, 80vh)',
                overflowY: 'auto',
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
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>3D Text</span>
                  <Crown size={12} color="#06b6d4" />
                </span>
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
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ec4899' }}>
                  Send Gift
                </span>
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
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>Dust text</span>
                  <Crown size={12} color="#f59e0b" />
                </span>
              </button>

              {/* 5. Smooth Scratch Dust Image */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  dustImageInputRef.current?.click();
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
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                  fontSize: '1.25rem'
                }}>
                  🌫️
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>Dust Image</span>
                </span>
              </button>

              {/* 6. Emoji Rain */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowEmojiBurstPicker(true);
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
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}>
                  <CloudRain size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>Emoji Rain</span>
                  <Crown size={12} color="#38bdf8" />
                </span>
              </button>

              {/* 7. Create Poll */}
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

              {/* 8. Schedule Message (Send Later / Birthday Wish) */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowScheduleModal(true);
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
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
                }}>
                  <Clock size={20} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b' }}>Schedule ⏰</span>
              </button>

              {/* 9. Live Translation 🌐 */}
              <button
                type="button"
                onClick={() => {
                  setShowActionGrid(false);
                  setShowTranslateBar(prev => !prev);
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
                  background: isAutoTranslateActive
                    ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                    : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
                  position: 'relative'
                }}>
                  <Globe size={20} />
                  {isAutoTranslateActive && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 6px #22c55e'
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0ea5e9' }}>
                  Translate 🌐
                </span>
              </button>
            </div>
          )}

          {/* 3D Emoji Particle Rain Selector */}
          {showEmojiBurstPicker && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '12px',
                background: 'color-mix(in srgb, var(--accent) 26%, transparent)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid var(--accent)',
                borderRadius: '20px',
                padding: '14px',
                boxShadow: '0 0 22px color-mix(in srgb, var(--accent) 55%, transparent), 0 4px 14px rgba(0,0,0,0.3)',
                zIndex: 1150,
                width: 'min(330px, 92vw)',
                maxHeight: '380px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🌧️ 3D Floating Emoji Rain
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmojiBurstPicker(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sparks Cost / VIP Perks Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginBottom: '10px',
                padding: '5px 10px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <span style={{ color: user?.isPro ? '#10b981' : '#38bdf8', fontWeight: 700 }}>
                  {user?.isPro ? '👑 VIP: FREE (0 Sparks)' : '⚡ Cost: 5 Sparks / rain'}
                </span>
                <span>Balance: <strong>{user?.pulseSparks ?? 0} ⚡</strong></span>
              </div>

              {/* Custom Any Emoji Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customBurstEmoji.trim()) {
                    handleTriggerEmojiBurst(customBurstEmoji.trim());
                    setCustomBurstEmoji('');
                  }
                }}
                style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}
              >
                <input
                  type="text"
                  value={customBurstEmoji}
                  onChange={(e) => setCustomBurstEmoji(e.target.value)}
                  placeholder="Type or paste ANY emoji to rain..."
                  maxLength={10}
                  style={{
                    flex: 1,
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    fontSize: '0.86rem',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!customBurstEmoji.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: customBurstEmoji.trim() ? 'pointer' : 'default',
                    opacity: customBurstEmoji.trim() ? 1 : 0.6,
                    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)'
                  }}
                >
                  Rain 🌧️
                </button>
              </form>

              {/* Popular Emojis Grid (Scrollable) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                overflowY: 'auto',
                maxHeight: '190px',
                paddingRight: '2px'
              }}>
                {[
                  '🔥', '❤️', '⚡', '🎉',
                  '🚀', '💎', '💩', '🥳',
                  '😂', '🌟', '👑', '🦄',
                  '💀', '👻', '💯', '🌸',
                  '🍕', '🎯', '🏆', '🎸',
                  '👾', '🍔', '🌹', '💋',
                  '😈', '🥶', '🤯', '✨'
                ].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleTriggerEmojiBurst(emoji)}
                    style={{
                      fontSize: '1.6rem',
                      padding: '8px 2px',
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.12s ease'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4-Dot Feature Button Beside Typing Input Box */}
          {!showRecorder && (
            <button
              ref={actionGridBtnRef}
              type="button"
              onClick={() => {
                setShowActionGrid(prev => !prev);
                setShowEmoji(false);
              }}
              className="icon-btn-ghost interactive-action"
              title="Features & Attachments (4 Dots)"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: showActionGrid ? 'var(--accent, #6366f1)' : 'var(--bg-card, #202c33)',
                color: showActionGrid ? '#fff' : 'var(--accent, #6366f1)',
                border: showActionGrid ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border)',
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

          {/* Camera Button Right Beside 4-Dot Menu */}
          {!showRecorder && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="icon-btn-ghost interactive-action"
              title="Camera - Click & Send Photo"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'var(--bg-card, #202c33)',
                color: 'var(--text-muted, #8696a0)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
            >
              <Camera size={20} />
            </button>
          )}

          {showRecorder ? (
            <VoiceRecorder onSendVoice={handleSendVoice} onCancel={() => setShowRecorder(false)} />
          ) : (
            <ChatInputCapsule
              ref={inputCapsuleRef}
              chatId={chatId}
              isGroup={isGroup}
              user={user}
              activeChat={activeChat}
              socket={socket}
              token={token}
              targetLang={targetLang}
              replyInputRef={replyInputRef}
              onSendText={handleSendText}
              onOpenScheduleModal={(schedText) => {
                setScheduleInitialText(schedText);
                setShowScheduleModal(true);
              }}
              showEmoji={showEmoji}
              setShowEmoji={setShowEmoji}
              setShowActionGrid={setShowActionGrid}
              setShowRecorder={setShowRecorder}
              setActionToast={setActionToast}
            />
          )}
        </div>
        </>
      )}

      <React.Suspense fallback={null}>
      {pendingMedia && (
        <MediaUploadModal
          mediaFile={pendingMedia}
          onSend={handleSendMedia}
          onClose={() => setPendingMedia(null)}
        />
      )}

      {showCreatePoll && (
        <CreatePollModal
          user={user}
          onClose={() => setShowCreatePoll(false)}
          onCreatePoll={handleCreatePoll}
          onOpenProModal={(tab = 'pro') => {
            setShowCreatePoll(false);
            setProModalTab(tab);
            setShowProModal(true);
          }}
        />
      )}

      {showWhiteboard && (
        <WhiteboardModal
          onClose={() => {
            setShowWhiteboard(false);
            setWhiteboardInitialImage(null);
            setWhiteboardInitialData(null);
          }}
          chatTitle={activeChat.displayName}
          chatId={chatId}
          onSendDrawing={handleSendDrawing}
          initialImage={whiteboardInitialImage}
          initialData={whiteboardInitialData}
        />
      )}

      {showUserProfileModal && (
        <UserProfileModal
          targetUser={{ ...activeChat, avatar: chatAvatar || activeChat.avatar, isPro: chatIsPro }}
          onClose={() => setShowUserProfileModal(false)}
          onStartCall={onStartCall}
          onOpenFullDp={onOpenFullDp}
          messages={messages}
          onDeleteMessages={(ids) => {
            if (socket && chatId) {
              socket.emit('delete_multiple_messages', { messageIds: ids, chatId });
            }
            setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, type: 'deleted', content: 'This message was deleted' } : m));
          }}
          onForwardMessages={(msgs) => {
            setSelectedActionMessages(msgs);
            setShowForwardModal(true);
          }}
        />
      )}

      {showChatLockPinModal && (
        <PinLockModal
          isOpen={true}
          mode={chatLockPinMode}
          title={isChatLockedState ? 'Unlock Chat' : (chatLockPinMode === 'setup' ? 'Set Chat Lock PIN' : 'Confirm PIN to Lock')}
          description={isChatLockedState ? 'Enter your 4-digit security PIN to unlock this chat' : (chatLockPinMode === 'setup' ? 'Create a 4-digit PIN to protect locked chats' : 'Enter your 4-digit PIN to lock this chat')}
          onSuccess={handleChatLockPinSuccess}
          onClose={() => setShowChatLockPinModal(false)}
          onCancel={() => setShowChatLockPinModal(false)}
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
          currentTheme={chatTheme}
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
            setShowSparksWallet(true);
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

      {/* Mobile-OS App Folder Expanded Modal */}
      {showAppsFolderModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAppsFolderModal(false)}
          style={{
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '310px',
              background: 'var(--bg-card)',
              borderRadius: '26px',
              border: '1px solid var(--border)',
              padding: '1.25rem 1.1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
              animation: 'folderPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Folder Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              paddingBottom: '0.65rem',
              borderBottom: '1px solid var(--border)'
            }}>
              {appsFolderView === 'games' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAppsFolderView('main')}
                    className="icon-btn-ghost"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-main)',
                      padding: 0
                    }}
                    title="Back to Apps"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Games
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Choose a game to play
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '9px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)'
                  }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Chat Apps
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Instant live features
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowAppsFolderModal(false)}
                className="icon-btn-ghost"
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'transparent' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Folder App Grid (Mobile App Icon Style) */}
            {appsFolderView === 'main' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px 10px',
                textAlign: 'center'
              }}>
                {/* App 1: Unified Games Button */}
                <button
                  type="button"
                  onClick={() => setAppsFolderView('games')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    transition: 'transform 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '17px',
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(236, 72, 153, 0.42)',
                    marginBottom: '7px',
                    position: 'relative'
                  }}>
                    <Gamepad2 size={27} />
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#10b981',
                      color: '#fff',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                    }}>
                      2
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Games
                  </span>
                </button>

                {/* App 2: Live Drawboard */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAppsFolderModal(false);
                    handleOpenWhiteboard();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    transition: 'transform 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '17px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.42)',
                    marginBottom: '7px'
                  }}>
                    <Presentation size={26} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Drawboard
                  </span>
                </button>

                {/* App 3: Background Music */}
                <button
                  type="button"
                  onClick={handleOpenMusic}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    transition: 'transform 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '17px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(245, 158, 11, 0.42)',
                    marginBottom: '7px',
                    position: 'relative'
                  }}>
                    <Music size={26} />
                    {!user?.isPro && (
                      <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.8rem' }}>👑</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Music {!user?.isPro ? '👑' : ''}
                  </span>
                </button>
              </div>
            ) : (
              /* Games Sub-View */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px 16px',
                textAlign: 'center',
                padding: '4px 6px'
              }}>
                {/* Game 1: Live Arrow Battle */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAppsFolderModal(false);
                    handleOpenArrowGame();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    transition: 'transform 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '17px',
                    background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(236, 72, 153, 0.42)',
                    marginBottom: '7px'
                  }}>
                    <Gamepad2 size={28} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Arrow Battle
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 800, marginTop: '2px' }}>
                    👑 PRO / ⚡ 5
                  </span>
                </button>

                {/* Game 2: Tic-Tac-Toe Arena */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAppsFolderModal(false);
                    handleOpenTicTacToe();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                    borderRadius: '16px',
                    transition: 'transform 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '17px',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(236, 72, 153, 0.22))',
                    border: '1.5px solid rgba(56, 189, 248, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 16px rgba(56, 189, 248, 0.35)',
                    marginBottom: '7px'
                  }}>
                    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
                      <line x1="7" y1="9" x2="19" y2="27" stroke="#38bdf8" strokeWidth="4.2" strokeLinecap="round" />
                      <line x1="19" y1="9" x2="7" y2="27" stroke="#38bdf8" strokeWidth="4.2" strokeLinecap="round" />
                      <circle cx="27" cy="18" r="7.2" stroke="#ec4899" strokeWidth="4.2" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Tic-Tac-Toe
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 800, marginTop: '2px' }}>
                    👑 PRO / ⚡ 5
                  </span>
                </button>
              </div>
            )}
            <style>{`
              @keyframes folderPopIn {
                0% { transform: scale(0.88); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}

      {showTicTacToeModal && (
        <TicTacToeModal
          chatId={chatId}
          partnerName={chatDisplayName || activeChat?.displayName}
          hostId={tictactoeHostId}
          onClose={() => {
            setShowTicTacToeModal(false);
            setTictactoeHostId(null);
          }}
          onOpenSparksWallet={() => setShowSparksWallet(true)}
        />
      )}

      {showArrowGameModal && (
        <LiveArrowGameModal
          activeChat={activeChat}
          onClose={() => setShowArrowGameModal(false)}
        />
      )}

      {sparksPromptConfig && (
        <SparksFeaturePromptModal
          isOpen={Boolean(sparksPromptConfig)}
          onClose={() => setSparksPromptConfig(null)}
          featureKey={sparksPromptConfig.featureKey}
          featureName={sparksPromptConfig.featureName}
          sparksCost={sparksPromptConfig.sparksCost}
          icon={sparksPromptConfig.icon}
          description={sparksPromptConfig.description}
          onSuccess={sparksPromptConfig.onSuccess}
          onOpenProModal={() => {
            setSparksPromptConfig(null);
            setShowPulseProModal(true);
          }}
        />
      )}

      {showChatMusicPicker && (
        <MusicPickerModal
          isOpen={showChatMusicPicker}
          onClose={() => setShowChatMusicPicker(false)}
          selectedSong={chatMusicSong}
          onSelectSong={(song) => {
            handleUpdateChatMusic(song);
            setShowChatMusicPicker(false);
          }}
        />
      )}

      {/* Forward Modal */}
      {showForwardModal && selectedActionMessages.length > 0 && (
        <ForwardModal
          messages={selectedActionMessages}
          message={selectedActionMessages[0]}
          currentUserId={user?.id}
          onClose={() => setShowForwardModal(false)}
          onForward={handleForwardMessage}
        />
      )}

      {/* Message Info Modal */}
      {showMessageInfoModal && selectedActionMessage && (
        <MessageInfoModal
          message={selectedActionMessage}
          isMine={selectedActionMessage.senderId === user?.id}
          onClose={() => setShowMessageInfoModal(false)}
        />
      )}

      {/* Unlimited Emoji Picker Modal */}
      {showUnlimitedEmojiPicker && actionMessageForEmoji && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => { setShowUnlimitedEmojiPicker(false); setActionMessageForEmoji(null); }}
        >
          <div
            className="modal-card"
            style={{
              maxWidth: '380px',
              width: '92vw',
              padding: '12px',
              borderRadius: '20px',
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px 8px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                React with Emoji
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomizeReactionsModal(true)}
                  className="icon-btn-ghost"
                  style={{
                    padding: '4px 10px',
                    height: '28px',
                    borderRadius: '14px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(255,255,255,0.06)'
                  }}
                  title="Customize default reaction emojis"
                >
                  <SlidersHorizontal size={13} />
                  <span>Set Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUnlimitedEmojiPicker(false); setActionMessageForEmoji(null); }}
                  className="icon-btn-ghost"
                  style={{ width: '30px', height: '30px', borderRadius: '50%' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div style={{ height: '360px', marginTop: '6px' }}>
              <EmojiPicker
                inline={true}
                onSelectEmoji={(em) => {
                  recordRecentReaction(em);
                  if (socket && user?.id && actionMessageForEmoji) {
                    socket.emit('add_reaction', {
                      messageId: actionMessageForEmoji.id,
                      chatId,
                      emoji: em,
                      userId: user.id
                    });
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', {
                        detail: { emoji: em || '❤️', mode: 'reaction', duration: 3 }
                      }));
                    }
                  }
                  setShowUnlimitedEmojiPicker(false);
                  setActionMessageForEmoji(null);
                  handleDismissActionMessage();
                }}
                onClose={() => {
                  setShowUnlimitedEmojiPicker(false);
                  setActionMessageForEmoji(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification */}
      {actionToast && (
        <div style={{
          position: 'fixed',
          bottom: '85px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.96)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '30px',
          padding: '8px 20px',
          fontSize: '0.84rem',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          backdropFilter: 'blur(12px)',
          animation: 'fadeInUp 0.2s ease'
        }}>
          <span>{actionToast}</span>
        </div>
      )}

      {/* Delete Message Confirmation Modal with Cancel Option */}
      {deleteModalMessages && deleteModalMessages.length > 0 && (() => {
        const canDeleteForEveryone = deleteModalMessages.every(m => m.senderId === user.id);
        const count = deleteModalMessages.length;
        return (
          <div
            className="modal-overlay"
            style={{ zIndex: 99999 }}
            onClick={() => setDeleteModalMessages(null)}
          >
            <div
              className="modal-card"
              style={{
                maxWidth: '360px',
                width: '90vw',
                padding: '20px',
                borderRadius: '20px',
                background: 'var(--bg-card)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {count > 1 ? `Delete ${count} Messages?` : 'Delete Message?'}
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {canDeleteForEveryone
                      ? (count > 1 ? `Delete ${count} selected messages.` : 'Choose an option to delete this message.')
                      : 'Delete for everyone is only available for messages sent by you.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {canDeleteForEveryone && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = deleteModalMessages.map(m => m.id);
                      setMessages(prev => {
                        const idSet = new Set(ids.map(String));
                        const next = prev.map(m => (idSet.has(String(m.id)) || idSet.has(String(m._id)) || idSet.has(String(m.clientTempId))) ? { ...m, type: 'deleted', content: 'This message was deleted', mediaUrl: null, audioUrl: null, pollData: null } : m);
                        setCachedMessages(chatId, next);
                        return next;
                      });
                      markCachedMessagesDeleted(chatId, ids);
                      deleteModalMessages.forEach(m => {
                        if (socket) socket.emit('delete_message', { messageId: m.id, chatId });
                        handleTriggerUndoToast(m.id);
                      });
                      setDeleteModalMessages(null);
                      handleDismissActionMessage();
                      try { playSound('sent'); } catch {}
                    }}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Delete for Everyone</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    deleteModalMessages.forEach(m => {
                      handleDeleteLocalMessage(m.id);
                      handleTriggerUndoToast(m.id);
                    });
                    setDeleteModalMessages(null);
                    handleDismissActionMessage();
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>Delete for Me</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteModalMessages(null)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    marginTop: '2px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Set Default Reaction Emojis Modal */}
      {showCustomizeReactionsModal && (
        <SetDefaultReactionsModal
          onClose={() => setShowCustomizeReactionsModal(false)}
          onSaved={() => {
            setActionToast('Default reaction emojis saved! ✨');
            setTimeout(() => setActionToast(''), 2200);
          }}
        />
      )}

      {/* Story / Vibe Viewer Modal */}
      {selectedStoryVibeGroup && (
        <VibeViewerModal
          vibeGroup={selectedStoryVibeGroup}
          initialVibeId={selectedStoryVibeId}
          onClose={() => {
            setSelectedStoryVibeGroup(null);
            setSelectedStoryVibeId(null);
          }}
        />
      )}

      {/* Sparks Wallet Modal */}
      {showSparksWallet && (
        <SparksWalletModal onClose={() => setShowSparksWallet(false)} />
      )}

      {/* Pulse Streaks & Freeze Shield Modal */}
      {showStreakModal && (
        <PulseStreakModal
          chatId={chatId}
          partnerName={chatDisplayName || activeChat?.displayName || activeChat?.name || 'Friend'}
          currentUserId={currentUserId}
          streakCount={streakData?.streakCount || 0}
          streakShields={streakData?.streakShields || 0}
          shieldsCount={streakData?.streakShields || 0}
          userSparks={user?.pulseSparks || 0}
          lastStreakDate={streakData?.lastStreakDate}
          onClose={() => setShowStreakModal(false)}
          onFreezeBought={(newShields, newSparks) => {
            setStreakData(prev => ({ ...prev, streakShields: newShields }));
            if (typeof updateUserProfile === 'function' && newSparks !== undefined) {
              updateUserProfile({ ...user, pulseSparks: newSparks });
            }
          }}
          onStreakUpdated={(updated) => setStreakData(prev => ({ ...prev, ...updated }))}
        />
      )}

      {/* Pulse Vibe & Live Aura Modal */}
      {showVibeSelector && (
        <VibeAuraSelectorModal
          onClose={() => setShowVibeSelector(false)}
          currentAura={myAura}
        />
      )}

      {/* Schedule Message Modal (Send Later / Birthday Wish) */}
      {showScheduleModal && (
        <ScheduleMessageModal
          initialText={scheduleInitialText || text || ''}
          onSchedule={handleScheduleMessage}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* Mutual In-Chat Nicknames Modal */}
      {showNicknameModal && (
        <ChatNicknameModal
          isOpen={showNicknameModal}
          onClose={() => setShowNicknameModal(false)}
          chatId={chatId}
          partner={activeChat}
          currentUser={user}
          nicknames={chatSetting?.nicknames || {}}
          onNicknameUpdated={(targetUserId, newNick, newNicknames) => {
            setChatSetting(prev => ({
              ...prev,
              nicknames: newNicknames
            }));
            window.dispatchEvent(new CustomEvent('pulsechat_nickname_updated', {
              detail: { chatId, targetUserId, nickname: newNick, nicknames: newNicknames }
            }));
          }}
        />
      )}

      {/* One-Click Insta Story Card Modal */}
      {showStoryCardModal && (
        <ShareableStoryCardModal
          user={user}
          onClose={() => setShowStoryCardModal(false)}
        />
      )}
      </React.Suspense>
    </div>
  );
}
