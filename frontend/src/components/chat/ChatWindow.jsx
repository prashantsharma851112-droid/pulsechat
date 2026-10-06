import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Send, Mic, Phone, Video, Smile, BarChart2, ArrowLeft, Users, Paintbrush, Clock, Sparkles, Image as ImageIcon, Paperclip, CheckSquare, Trash2, X, Check, MoreVertical, Info, CornerUpLeft, FileText, Ban, ShieldAlert, WifiOff, Palette, UserPlus, Presentation, Music, Flame, Zap, Volume2, VolumeX, Disc, Crown, Gamepad2, Play, Pause, SkipForward, Loader2, Star, Copy, Forward, Pin, PinOff, SlidersHorizontal, Edit3, Ghost, Search, ChevronUp, ChevronDown, ArrowDown } from 'lucide-react';
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
import LiveArrowGameModal from './LiveArrowGameModal';
import TicTacToeModal from './TicTacToeModal';
import PulseStreakModal from './PulseStreakModal';
import VibeAuraRing, { resolveUserAura } from '../common/VibeAuraRing';
import VibeAuraSelectorModal from './VibeAuraSelectorModal';
import PulseVipBadge from '../common/PulseVipBadge';
import MusicPickerModal from '../vibes/MusicPickerModal';
import ForwardModal from './ForwardModal';
import MessageInfoModal from './MessageInfoModal';
import SetDefaultReactionsModal from './SetDefaultReactionsModal';
import VibeViewerModal from '../vibes/VibeViewerModal';
import SparksWalletModal from './SparksWalletModal';
import ScheduleMessageModal from './ScheduleMessageModal';
import { recordRecentReaction } from '../../utils/quickReactions';
import { uploadMediaDirect } from '../../utils/mediaUpload';
import { playSound, playPulseAuraSound, stopPulseAuraSound, setPulseAuraVolume, registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
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
  getCachedFriends,
  setCachedFriends,
  isDeviceOnline,
  subscribeToNetworkChanges,
  updateGroupInStorage,
  clearUnreadCount
} from '../../utils/offlineStorage';

const sanitizeFogSnapMessage = (m) => {
  if (!m || !m.isFogSnap) return m;
  const isBurnedLocally = (() => {
    try {
      return (m.id && localStorage.getItem(`pulse_fog_burned_${m.id}`) === 'true') ||
             (m._id && localStorage.getItem(`pulse_fog_burned_${m._id}`) === 'true');
    } catch {
      return false;
    }
  })();
  if (m.fogSnapStatus === 'burned' || m.content === '🌫️ Fog Snap Evaporated' || (!m.mediaUrl && m.isFogSnap) || isBurnedLocally) {
    return { ...m, fogSnapStatus: 'burned', content: '🌫️ Fog Snap Evaporated', mediaUrl: null };
  }
  return m;
};

export default function ChatWindow({ activeChat, onBack, onStartCall, onStartGroupCall, onOpenFullDp }) {
  const { user, token, blockUser, unblockUser, updateUserProfile } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap, lastNotification, vibeAuras } = useContext(SocketContext);

  const isGroup = !!activeChat.isGroup;
  const currentUserId = user?.id || user?._id || '';
  const activeChatId = activeChat?.id || activeChat?._id || '';
  const chatId = isGroup ? activeChatId : [currentUserId, activeChatId].filter(Boolean).sort().join('_');
  const partnerId = activeChat?.id || activeChat?._id || activeChat?.userId || '';
  const isOnline = !isGroup && (
    (partnerId && onlineUsers.some(uId => String(uId) === String(partnerId))) ||
    (activeChat?.username && onlineUsers.some(uId => String(uId) === String(activeChat.username)))
  );
  const typingUser = typingMap[chatId];
  const isTyping = Boolean(typingUser && typingUser !== user?.username && typingUser !== user?.id && typingUser !== user?.displayName);
  const typingTimeoutRef = useRef(null);

  const partnerAura = useMemo(() => {
    if (isGroup) return null;
    return resolveUserAura(activeChat, vibeAuras);
  }, [isGroup, activeChat, vibeAuras]);

  const myAura = useMemo(() => {
    return resolveUserAura(user, vibeAuras);
  }, [vibeAuras, user]);
  const [showVibeSelector, setShowVibeSelector] = useState(false);
  const [showTicTacToeModal, setShowTicTacToeModal] = useState(false);

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
    setText('');
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

  const getSenderPayload = () => ({
    senderName: user?.displayName || user?.username || 'User',
    senderUsername: user?.username || '',
    senderAvatar: user?.avatar || null,
    senderIsPro: Boolean(user?.isPro),
    senderProTier: user?.proTier || 'none',
    senderCustomBadge: user?.customBadge || ''
  });

  // In-Chat Search Feature States
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const inChatSearchInputRef = useRef(null);

  // Floating Scroll-to-Bottom Button States
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const showScrollBottomRef = useRef(false);
  const [newScrolledMessagesCount, setNewScrolledMessagesCount] = useState(0);

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
  };

  const handleSkipTime = (seconds) => {
    if (!chatAudioRef.current) return;
    const current = chatAudioRef.current.currentTime || 0;
    const dur = chatAudioRef.current.duration || songDuration || 240;
    const newTime = Math.max(0, Math.min(dur, current + seconds));
    chatAudioRef.current.currentTime = newTime;
    setSongProgress(newTime);
  };

  const handleTogglePlayPause = () => {
    if (!chatAudioRef.current) return;
    if (chatAudioRef.current.paused) {
      chatAudioRef.current.play().then(() => setIsSongPlaying(true)).catch(() => {});
    } else {
      chatAudioRef.current.pause();
      setIsSongPlaying(false);
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
      const audio = new Audio(chatMusicSong.audioUrl);
      audio.volume = isChatMusicMuted ? 0 : auraVolume;

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

      audio.addEventListener('play', () => setIsSongPlaying(true));
      audio.addEventListener('pause', () => setIsSongPlaying(false));

      audio.addEventListener('ended', () => {
        setIsSongPlaying(false);
        // Automatic next song when song finishes!
        handlePlayNextSong();
      });

      registerGlobalMusicAudio(audio);
      audio.play().then(() => {
        setIsSongPlaying(true);
      }).catch(e => {
        console.warn('Chat music playback prevented:', e);
        setIsSongPlaying(false);
      });
      chatAudioRef.current = audio;

      // Pre-fetch similar songs for instant next song transition
      fetchSimilarSongs(chatMusicSong);
    }

    return () => {
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
    return localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || localStorage.getItem('pulsechat_chat_default_theme') || 'default';
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

  const isDirectFriend = isGroup || isCachedFriend(user?.id, activeChat?.id);

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
    const savedTheme = localStorage.getItem(`pulsechat_chat_theme_${chatId}`) || localStorage.getItem('pulsechat_chat_default_theme') || 'midnight_amoled';
    setChatTheme(savedTheme);
    const savedWall = localStorage.getItem(`pulsechat_chat_wallpaper_${chatId}`) || 'none';
    setChatWallpaper(savedWall);
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

        setChatWallpaper(newWall);
        if (newWall === 'custom_image' && customUrl) {
          setCustomWallpaper(customUrl);
          localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, customUrl);
          localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, 'custom_image');
        } else if (newWall === 'none') {
          setCustomWallpaper(null);
          localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
        } else {
          setChatWallpaper(newWall);
          setCustomWallpaper(null);
          localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
          localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
        }
      }
    };

    const handleThemeUpdated = (e) => {
      const incomingChatId = e.detail?.chatId;
      const originalChatId = e.detail?.originalChatId;
      if (isMatchingChatId(incomingChatId, chatId) || isMatchingChatId(originalChatId, chatId)) {
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
  }, [chatId, activeChat, isGroup, user]);

  const handleSelectChatTheme = (newTheme) => {
    setChatTheme(newTheme);
    if (newTheme === 'default' || newTheme === 'midnight_amoled') {
      localStorage.removeItem(`pulsechat_chat_theme_${chatId}`);
    } else {
      localStorage.setItem(`pulsechat_chat_theme_${chatId}`, newTheme);
      localStorage.setItem('pulsechat_chat_default_theme', newTheme);
    }
    if (socket) {
      socket.emit('set_chat_theme', { chatId, themeId: newTheme, userId: user?.id, setBy: user?.id });
    }
    if (token) {
      fetch(`${BACKEND_URL}/api/messages/settings/${chatId}/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ themeId: newTheme })
      }).catch(() => {});
    }
  };

  const handleSelectChatWallpaper = (newWall, customUrl = null) => {
    lastWallpaperUpdateTimestamp.current = Date.now();
    const finalCustom = newWall === 'custom_image' ? (customUrl || customWallpaper) : null;
    setChatWallpaper(newWall);
    setCustomWallpaper(finalCustom);

    if (newWall === 'none') {
      localStorage.removeItem(`pulsechat_chat_wallpaper_${chatId}`);
      localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
    } else {
      localStorage.setItem(`pulsechat_chat_wallpaper_${chatId}`, newWall);
      if (newWall === 'custom_image' && finalCustom) {
        localStorage.setItem(`pulsechat_custom_wallpaper_${chatId}`, finalCustom);
      } else {
        localStorage.removeItem(`pulsechat_custom_wallpaper_${chatId}`);
      }
    }

    if (socket) {
      socket.emit('set_chat_wallpaper', {
        chatId,
        wallpaperId: newWall,
        customWallpaperUrl: finalCustom,
        customImage: finalCustom,
        userId: user?.id,
        setBy: user?.id
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
          customWallpaperUrl: finalCustom
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
  const [isNetConnected, setIsNetConnected] = useState(() => isDeviceOnline());

  const [text, setText] = useState('');
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
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupMembersMap, setGroupMembersMap] = useState({});
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const dustImageInputRef = useRef(null);

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
  const [chatSetting, setChatSetting] = useState({ disappearingEnabled: false });
  const [blockStatus, setBlockStatus] = useState({ isBlockedByMe: false, isBlockedByThem: false });

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
      if (e.detail?.chatId === chatId) {
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

    window.addEventListener('pulsechat_aura_changed', handleAuraChange);
    window.addEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);
    window.addEventListener('pulsechat_music_updated', handleChatMusicUpdated);

    return () => {
      window.removeEventListener('pulsechat_aura_changed', handleAuraChange);
      window.removeEventListener('pulsechat_stealth_dust_dissolved', handleStealthDissolved);
      window.removeEventListener('pulsechat_music_updated', handleChatMusicUpdated);
      stopPulseAuraSound();
    };
  }, [chatId, auraVolume]);

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
      alert(`⚡ Sparks kam hain!\nDust text secret note bhejne ke liye 5 Sparks lagte hain.\nAapke paas sirf ${sparksBalance} Sparks hain.\n\nSparks Wallet se free video ad dekh kar ya Daily bonus se free Sparks lein.`);
      return;
    }

    const dustText = prompt(`⚡ Enter your Dust Text Secret Note:\n(It will render blurred until recipient holds down, then shatters into digital dust)\n\n${isPro ? "👑 VIP Member: FREE (0 Sparks)" : "⚡ Cost: 5 Sparks (Balance: " + sparksBalance + ")"}`);
    if (!dustText || !dustText.trim()) return;

    if (!isPro && updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: Math.max(0, sparksBalance - 5) });
    }

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
    if (!emoji || !emoji.trim()) return;
    const cleanEmoji = emoji.trim();
    setShowActionGrid(false);
    setShowEmojiBurstPicker(false);

    const isPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
    const sparksBalance = user?.pulseSparks ?? 0;

    if (!isPro && sparksBalance < 5) {
      alert(`⚡ Sparks kam hain!\nEmoji particle burst ke liye 5 Sparks lagte hain.\nAapke paas sirf ${sparksBalance} Sparks hain.\n\nSparks Wallet se free video ad dekh kar free Sparks lein.`);
      return;
    }

    if (!isPro && updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: Math.max(0, sparksBalance - 5) });
    }

    if (socket) {
      socket.emit('trigger_emoji_burst', { chatId, emoji: cleanEmoji, userId: user?.id });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_trigger_emoji_burst', { detail: { emoji: cleanEmoji, mode: 'burst', duration: 5 } }));
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
          const newMsg = {
            id: clientTempId,
            clientTempId,
            chatId: item.chatId,
            senderId: item.senderId,
            receiverId: item.receiverId,
            isGroup: item.isGroup,
            content: item.text,
            type: 'text',
            status: 'sent',
            timestamp: new Date().toISOString(),
            reactions: {}
          };

          if (item.chatId === chatId) {
            setMessages(prev => [...prev, newMsg]);
            appendCachedMessage(chatId, newMsg);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const combinedInitial = [...cached, ...pendingForThisChat.filter(p => !cachedIds.has(p.id))].map(sanitizeFogSnapMessage);
      setMessages(combinedInitial);

      // Cache this contact/group into allUsers for future offline searches
      if (user?.id && !activeChat.isGroup) {
        mergeIntoAllUsersCache(user.id, [{ ...activeChat, avatar: chatAvatar || activeChat.avatar }]);
      }

      // 2. Fetch fresh messages if online (fast 50 latest limit)
      const isCurrentGhost = checkGhostModeActive();
      fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=50${isCurrentGhost ? '&ghost=true' : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isCurrentGhost ? { 'x-ghost-mode': 'true' } : {})
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setHasMoreOlderMessages(data.length >= 50);
            const currentOutbox = getOutbox(user?.id);
            const pendingForChat = currentOutbox.filter(m => m.chatId === chatId);
            const serverIds = new Set(data.map(m => m.id));
            const activePending = pendingForChat.filter(p => !serverIds.has(p.id) && !serverIds.has(p.clientTempId));
            const merged = [...data, ...activePending].map(sanitizeFogSnapMessage);
            setMessages(merged);
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
            if (data.disappearingEnabled !== undefined) setChatSetting(data);
            const isRecentUpdate = (Date.now() - (lastWallpaperUpdateTimestamp.current || 0)) < 4000;
            if (data.wallpaperId !== undefined) {
              if (!isRecentUpdate || data.wallpaperId !== 'none') {
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
              }
            }
            if (data.chatTheme) {
              setChatTheme(data.chatTheme);
              localStorage.setItem(`pulsechat_chat_theme_${chatId}`, data.chatTheme);
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
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
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
        socket.emit('mark_chat_read', { chatId, userId: user.id, isGhost: isCurGhost });
      }
    }
  }, [activeChat, chatId, isGroup, token, socket, user.id, isGhostMode]);

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
        setShowTicTacToeModal(true);
        const inviter = data.senderName || activeChat?.displayName || 'Friend';
        setActionToast(`🎮 ${inviter} ne Tic-Tac-Toe Game shuru kiya!`);
        setTimeout(() => setActionToast(''), 4000);
      }
    };
    const handleAutoOpenMusic = (data) => {
      if (isMatchingChat(data) && data.senderId !== user?.id) {
        setShowChatMusicPicker(true);
        const inviter = data.senderName || activeChat?.displayName || 'Friend';
        setActionToast(`🎵 ${inviter} ne Music Jam shuru kiya!`);
        setTimeout(() => setActionToast(''), 4000);
      }
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
    if (isGroup) {
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
        const sanitizedMsg = sanitizeFogSnapMessage(msg);
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
            setNewScrolledMessagesCount(prev => prev + 1);
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
      } else {
        setMessages(prev => {
          const next = prev.map(m => m.status === 'sent' ? { ...m, status: status || 'delivered' } : m);
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

    const handleFogBurned = ({ messageId }) => {
      if (!messageId) return;
      try {
        localStorage.setItem(`pulse_fog_burned_${messageId}`, 'true');
      } catch (e) {}
      setMessages(prev => {
        const updated = prev.map(m => {
          if (m.id === messageId || m._id === messageId) {
            return { ...m, fogSnapStatus: 'burned', content: '🌫️ Fog Snap Evaporated', mediaUrl: null };
          }
          return m;
        });
        setCachedMessages(chatId, updated);
        return updated;
      });
      updateCachedMessageStatus(chatId, messageId, {
        fogSnapStatus: 'burned',
        content: '🌫️ Fog Snap Evaporated',
        mediaUrl: null
      });
    };
    socket.on('fog_snap_burned', handleFogBurned);

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
      socket.off('fog_snap_burned', handleFogBurned);
      window.removeEventListener('pulsechat_fog_snap_burned', handleWindowFogBurned);
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
      // Naya message aaye toh agar user bottom ke paas hai toh smoothly scroll karo
      if (!showScrollBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
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

  const handleChatContainerScroll = (e) => {
    const target = e.currentTarget;
    if (target.scrollTop <= 75 && hasMoreOlderMessages && !isLoadingOlder) {
      const prevScrollHeight = target.scrollHeight;
      const prevScrollTop = target.scrollTop;
      handleLoadOlderMessages().then(() => {
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            const diff = chatContainerRef.current.scrollHeight - prevScrollHeight;
            chatContainerRef.current.scrollTop = prevScrollTop + diff;
          }
        });
      });
    }

    // Track if user has scrolled away from the latest messages (> 220px)
    const distFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const isScrolledUp = distFromBottom > 220;
    setShowScrollBottom(isScrolledUp);
    showScrollBottomRef.current = isScrolledUp;
    if (!isScrolledUp) {
      setNewScrolledMessagesCount(0);
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

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socket && user?.id) {
      socket.emit('typing_stop', { chatId, userId: user.id, receiverId: isGroup ? '' : activeChat?.id });
    }

    // Check emotional trigger words for 3s cooldown using sentiment utility
    if (isEmotionalTriggerMessage(text) && !forceInstant) {
      setCooldownMsg(text);
      setCooldownSecs(3);
      setText('');
      return;
    }

    dispatchMessage(text);
    setText('');
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

  const handleSendVoice = async (audioUrl) => {
    setShowRecorder(false);
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
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      audioUrl: finalAudioUrl,
      type: 'voice'
    });
    playSound('sent');
  };

  const handleCreatePoll = (pollData) => {
    const isPro = Boolean(user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt) > new Date()));
    const sparksBalance = user?.pulseSparks ?? 0;

    if (!isPro && sparksBalance < 5) {
      alert(`⚡ Sparks kam hain!\nPoll create karne ke liye 5 Sparks lagte hain.\nAapke paas sirf ${sparksBalance} Sparks hain.\n\nSparks Wallet se video ad dekh kar ya daily bonus se free Sparks claim karein.`);
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

  const checkCanOpenActivity = (activityName) => {
    if (isGroup) return true;
    if (!isOnline) {
      const name = activeChat?.displayName || activeChat?.username || 'User';
      const msg = `⚠️ ${name} abhi offline hai! Dono online honge tabhi ${activityName} open hoga.`;
      setActionToast(msg);
      alert(msg);
      setTimeout(() => setActionToast(''), 4500);
      return false;
    }
    return true;
  };

  const handleOpenArrowGame = () => {
    if (!checkCanOpenActivity('Game (Arrow Battle)')) return;
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

  const handleOpenTicTacToe = () => {
    if (!checkCanOpenActivity('Game (Tic-Tac-Toe)')) return;
    setShowAppsFolderModal(false);
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

  const handleOpenWhiteboard = () => {
    if (!checkCanOpenActivity('Live Drawboard')) return;
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
  };

  const handleOpenMusic = () => {
    if (!checkCanOpenActivity('Music')) return;
    setShowAppsFolderModal(false);
    if (!user?.isPro) {
      setProModalTab('pro');
      setShowProModal(true);
      return;
    }
    setShowChatMusicPicker(true);
    if (socket && chatId) {
      socket.emit('request_open_music', {
        chatId,
        senderId: user?.id,
        senderName: user?.displayName || user?.username,
        receiverId: isGroup ? '' : (activeChat?.id || activeChat?._id)
      });
    }
  };

  const handleOpenWhiteboardForEdit = (drawingUrl, whiteboardData) => {
    setWhiteboardInitialImage(drawingUrl);
    setWhiteboardInitialData(whiteboardData || null);
    setShowWhiteboard(true);
  };

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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
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
    const calculatedLimit = isTwice ? 2 : (viewLimit || (isViewOnce ? 1 : 1));

    // 0ms Optimistic Media Bubble (Telegram Magic):
    // Instantly renders in chat with circular progress ring while uploading in background!
    const tempMediaId = 'temp_media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const optimisticMediaMsg = {
      id: tempMediaId,
      clientTempId: tempMediaId,
      chatId,
      senderId: user.id,
      receiverId: isGroup ? '' : activeChat.id,
      isGroup,
      mediaUrl, // local preview instantly visible
      type: msgType,
      isViewOnce: msgType === 'document' ? false : Boolean(isViewOnce || isTwice || isDust),
      isViewTwice: isTwice,
      viewLimit: calculatedLimit,
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

    setMessages(prev => [...prev, optimisticMediaMsg]);
    appendCachedMessage(chatId, optimisticMediaMsg);
    updateRecentChatSnippet(user.id, chatId, optimisticMediaMsg, { ...activeChat, avatar: chatAvatar || activeChat.avatar });
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        isViewOnce: msgType === 'document' ? false : Boolean(isViewOnce || isTwice || isDust),
        isViewTwice: isTwice,
        viewLimit: calculatedLimit,
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

  const handleDeleteLocalMessage = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const lastActionSelectTimeRef = useRef(0);

  const handleSelectForAction = useCallback((msg) => {
    if (!msg?.id) return;
    lastActionSelectTimeRef.current = Date.now();
    setSelectedActionMessages(prev => {
      const exists = prev.some(m => m.id === msg.id);
      if (exists) {
        return prev;
      } else {
        return [...prev, msg];
      }
    });
    setShowActionMoreMenu(false);
  }, []);

  const handleToggleActionSelect = useCallback((msg) => {
    if (!msg?.id) return;
    if (Date.now() - lastActionSelectTimeRef.current < 450) {
      return;
    }
    setSelectedActionMessages(prev => {
      const exists = prev.some(m => m.id === msg.id);
      if (exists) {
        return prev.filter(m => m.id !== msg.id);
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

  // Compute matched message IDs for In-Chat Search
  const matchedMessageIds = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.trim().toLowerCase();
    return messages
      .filter(m => {
        if (!m || m.type === 'deleted') return false;
        const c = (m.content || '').toLowerCase();
        const fn = (m.fileName || '').toLowerCase();
        return c.includes(q) || fn.includes(q);
      })
      .map(m => m.id);
  }, [messages, inChatSearchQuery]);

  useEffect(() => {
    setSearchMatchIndex(0);
    if (matchedMessageIds.length > 0) {
      handleJumpToMessage(matchedMessageIds[0]);
    }
  }, [inChatSearchQuery, matchedMessageIds.length, handleJumpToMessage]);

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
    for (const target of selectedTargets) {
      const targetIsGroup = !!target.isGroup;
      const targetChatId = targetIsGroup ? target.id : [user.id, target.id].sort().join('_');
      const receiverId = targetIsGroup ? '' : target.id;

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
        timestamp: new Date().toISOString()
      };

      if (socket) {
        socket.emit('send_message', fwdPayload);
      }

      const tempFwdMsg = {
        ...fwdPayload,
        id: 'fwd_' + Date.now() + Math.random().toString(36).substr(2, 5),
        status: 'sent'
      };

      appendCachedMessage(targetChatId, tempFwdMsg);

      if (targetChatId === chatId) {
        setMessages(prev => [...prev, tempFwdMsg]);
      }

      updateRecentChatSnippet(targetChatId, {
        lastMessage: fwdPayload.content || (fwdPayload.mediaUrl ? '🖼️ Photo' : '➡️ Forwarded message'),
        timestamp: fwdPayload.timestamp
      });
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

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (!socket) return;
    const receiverId = isGroup ? '' : activeChat?.id;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!val.trim()) {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
      return;
    }

    socket.emit('typing_start', {
      chatId,
      userId: user?.id,
      username: user?.displayName || user?.username || 'User',
      receiverId
    });

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatId, userId: user?.id, receiverId });
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (socket && user?.id && chatId) {
        socket.emit('typing_stop', { chatId, userId: user.id, receiverId: isGroup ? '' : activeChat?.id });
      }
    };
  }, [chatId]);

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
        padding: 'calc(24px + env(safe-area-inset-top, 0px)) 1rem 0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
        backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        zIndex: 2,
        overflow: 'visible'
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

            <VibeAuraRing aura={partnerAura} size={42} isGroup={isGroup} hasCrown={Boolean(!isGroup && (chatHasKingCrown || chatHasSilverCrown || chatHasStreakCrown))}>
              <div
                className={!isGroup && chatIsPro ? 'pro-neon-avatar' : ''}
                style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}
              >
                {!isGroup && chatHasKingCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                ) : !isGroup && chatHasSilverCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                ) : !isGroup && chatHasStreakCrown ? (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
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
                    width: '42px',
                    height: '42px',
                    borderRadius: isGroup ? '12px' : '50%',
                    cursor: 'pointer',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: !isGroup && chatHasKingCrown
                      ? '2.5px solid #fbbf24'
                      : !isGroup && chatHasSilverCrown
                      ? '2.5px solid #cbd5e1'
                      : !isGroup && chatHasStreakCrown
                      ? '2.5px solid #f97316'
                      : (!isGroup && chatIsPro ? 'none' : 'none')
                  }}
                  title={isGroup ? 'Click for group details & members' : 'Click to view full screen DP'}
                />
              </div>
            </VibeAuraRing>

            <div
              className="chat-header-title-box"
              onClick={() => isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true)}
              style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
              title={isGroup ? 'Click to view group bio, members & edit info' : 'Click to view profile & bio'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                <h3 style={{ fontSize: '1.06rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
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
              <p style={{ fontSize: '0.8rem', color: isTyping ? '#22c55e' : 'var(--text-muted)', fontWeight: isTyping ? 600 : 400, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isGroup
                  ? (isTyping ? `✍️ ${typingUser} is typing...` : `${activeChat.members?.length || 0} members`)
                  : isTyping
                    ? '✍️ typing...'
                    : isOnline
                      ? 'Online'
                      : 'Offline'}
              </p>
            </div>
          </div>

          <div className="chat-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {/* Position 3: In-Chat Search Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setShowInChatSearch(prev => !prev);
                if (!showInChatSearch) {
                  setTimeout(() => inChatSearchInputRef.current?.focus(), 120);
                } else {
                  setInChatSearchQuery('');
                }
              }}
              className="icon-btn-ghost"
              title="Search in chat (Message Finder)"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                color: showInChatSearch ? 'var(--accent)' : 'var(--text-main)',
                background: showInChatSearch ? 'var(--hover-bg)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Search size={19} />
            </button>

            {/* Position 2: Mobile App Folder Button (Animated Cyber-Neon Glassmorphic Folder) */}
            <button
              onClick={() => setShowAppsFolderModal(true)}
              className="chat-apps-folder-btn chat-neon-app-folder"
              title="Apps & Games (Arrow Battle, Drawboard, Music)"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.16))',
                border: '1.5px solid rgba(168, 85, 247, 0.6)',
                backdropFilter: 'blur(12px)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '3px',
                padding: '4.5px',
                cursor: 'pointer',
                flexShrink: 0,
                alignItems: 'center',
                justifyItems: 'center'
              }}
            >
              {/* Mini App 1: Game */}
              <div style={{
                width: '12.5px',
                height: '12.5px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(236, 72, 153, 0.6)'
              }}>
                <Gamepad2 size={8} color="#fff" />
              </div>
              {/* Mini App 2: Drawboard */}
              <div style={{
                width: '12.5px',
                height: '12.5px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
              }}>
                <Presentation size={8} color="#fff" />
              </div>
              {/* Mini App 3: Music */}
              <div style={{
                width: '12.5px',
                height: '12.5px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)'
              }}>
                <Music size={8} color="#fff" />
              </div>
              {/* Mini App 4: Sparks / Live */}
              <div style={{
                width: '12.5px',
                height: '12.5px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(139, 92, 246, 0.6)'
              }}>
                <Sparkles size={8} color="#fff" />
              </div>
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
                  {/* Voice & Video Calls */}
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
                    <span>Chat background</span>
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); setShowSolidThemeModal(true); }}>
                    <Palette size={16} color="var(--accent)" />
                    <span>Change Solid Theme</span>
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
          padding: 'calc(24px + env(safe-area-inset-top, 0px)) 1rem 0.75rem 1rem',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={handleDismissActionMessage}
              className="icon-btn-ghost"
              style={{ width: '38px', height: '38px', borderRadius: '50%', color: 'var(--text-main)' }}
              title="Unselect messages"
            >
              <ArrowLeft size={20} />
            </button>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              {selectedActionMessages.length}
            </span>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                style={{ width: '38px', height: '38px', borderRadius: '50%', color: 'var(--text-main)' }}
              >
                <CornerUpLeft size={19} />
              </button>
            )}

            {/* Star / Bookmark */}
            <button
              type="button"
              onClick={() => handleToggleStarMessages(selectedActionMessages)}
              className="icon-btn-ghost"
              title="Star / Unstar"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                color: (selectedActionMessages.length > 0 && selectedActionMessages.every(m => starredMsgIds.includes(m.id))) ? '#f59e0b' : 'var(--text-main)'
              }}
            >
              <Star
                size={19}
                fill={(selectedActionMessages.length > 0 && selectedActionMessages.every(m => starredMsgIds.includes(m.id))) ? "#f59e0b" : "none"}
              />
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={() => handleCopyMessages(selectedActionMessages)}
              className="icon-btn-ghost"
              title="Copy message(s)"
              style={{ width: '38px', height: '38px', borderRadius: '50%', color: 'var(--text-main)' }}
            >
              <Copy size={19} />
            </button>

            {/* Forward */}
            <button
              type="button"
              onClick={() => setShowForwardModal(true)}
              className="icon-btn-ghost"
              title="Forward message(s)"
              style={{ width: '38px', height: '38px', borderRadius: '50%', color: 'var(--text-main)' }}
            >
              <Forward size={19} />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => handleDeleteActionMessage(selectedActionMessages)}
              className="icon-btn-ghost"
              title="Delete message(s)"
              style={{ width: '38px', height: '38px', borderRadius: '50%', color: '#ef4444' }}
            >
              <Trash2 size={19} />
            </button>

            {/* 3-Dots More Options Menu (when exactly 1 message selected) */}
            {selectedActionMessages.length === 1 && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowActionMoreMenu(prev => !prev)}
                  className="icon-btn-ghost"
                  title="More options"
                  style={{ width: '38px', height: '38px', borderRadius: '50%', color: 'var(--text-main)' }}
                >
                  <MoreVertical size={19} />
                </button>

                {showActionMoreMenu && (
                  <div className="chat-header-dropdown-menu" style={{ right: 0, minWidth: '190px', zIndex: 100 }}>
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

                    <button
                      onClick={() => {
                        setShowActionMoreMenu(false);
                        setShowMessageInfoModal(true);
                      }}
                    >
                      <Info size={16} color="var(--accent)" />
                      <span>Message info</span>
                    </button>

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

      {/* Message Stream with Live Wallpaper Overlay & WhatsApp-Style Date Dividers */}
      <div
        ref={chatContainerRef}
        onScroll={handleChatContainerScroll}
        onClick={() => {
          if (selectedActionMessages.length > 0) handleDismissActionMessage();
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          position: 'relative',
          zIndex: selectedActionMessages.length > 0 ? 45 : 1
        }}
      >
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

        {deduplicatedMessages.map((msg, index) => {
          const senderObj = groupMembersMap[msg.senderId];
          const prevMsg = index > 0 ? deduplicatedMessages[index - 1] : null;
          const showDateHeader = index === 0 || isDifferentDay(prevMsg?.timestamp, msg.timestamp);
          const dateLabel = formatMessageDateHeader(msg.timestamp);

          return (
            <React.Fragment key={msg.id || msg.clientTempId || index}>
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
                isSelectedForAction={selectedActionMessages.some(m => m.id === msg.id)}
                isInActionSelectionMode={selectedActionMessages.length > 0}
                actionSelectedCount={selectedActionMessages.length}
                onToggleActionSelect={handleToggleActionSelect}
                onSelectForAction={handleSelectForAction}
                isStarred={starredMsgIds.includes(msg.id)}
                onOpenUnlimitedEmoji={(targetMsg) => {
                  setActionMessageForEmoji(targetMsg);
                  setShowUnlimitedEmojiPicker(true);
                }}
                onOpenCustomizeReactions={() => setShowCustomizeReactionsModal(true)}
                onDismissAction={handleDismissActionMessage}
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
                onOpenStory={handleOpenStory}
                onOpenSparksWallet={() => setShowSparksWallet(true)}
                onEditDrawing={handleOpenWhiteboardForEdit}
                highlightSearchTerm={showInChatSearch ? inChatSearchQuery : ''}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating "Scroll to Bottom" Button with New Messages Counter */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowScrollBottom(false);
            showScrollBottomRef.current = false;
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

      {/* Bottom Pulse Streaks Badge (in place of Set Vibe) */}
      {!isGroup && !blockStatus.isBlockedByMe && !blockStatus.isBlockedByThem && (
        <div style={{ padding: '0.35rem 1rem 0.2rem 1rem', display: 'flex', alignItems: 'center', background: 'transparent', position: 'relative', zIndex: 2 }}>
          <button
            type="button"
            onClick={() => setShowStreakModal(true)}
            className="chat-neon-streak-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.22), rgba(239, 68, 68, 0.15))',
              border: '1.5px solid rgba(249, 115, 22, 0.7)',
              borderRadius: '16px',
              padding: '4px 12px',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#ff8a3d',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0 12px rgba(249, 115, 22, 0.3)'
            }}
            title="Pulse Streaks with Sparks Reward & Streak Freeze"
          >
            <span className="chat-neon-streak-flame" style={{ fontSize: '1rem' }}>🔥</span>
            <span style={{
              background: 'linear-gradient(135deg, #ffb347, #ff4500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
              fontSize: '0.88rem'
            }}>
              Streak: {streakData?.streakCount || 0}
            </span>
            {(streakData?.streakShields || 0) > 0 && (
              <span style={{ fontSize: '0.74rem', marginLeft: '2px', filter: 'drop-shadow(0 0 4px #38bdf8)' }} title={`${streakData.streakShields} Freeze Shield Active`}>
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
      ) : (!isGroup && friendshipStatus !== 'friends') ? null : (
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
          padding: '0.75rem 1rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          background: (chatWallpaper && chatWallpaper !== 'none') ? 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)' : 'var(--bg-sidebar)',
          backdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: (chatWallpaper && chatWallpaper !== 'none') ? 'blur(16px)' : 'none',
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
          <input
            type="file"
            ref={dustImageInputRef}
            accept="image/*,video/*"
            onChange={(e) => handleSpecificMediaSelect(e, 'dust')}
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
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>Emoji Burst</span>
                  <Crown size={12} color="#ef4444" />
                </span>
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
                width: 'min(330px, 92vw)',
                maxHeight: '380px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💥 3D Floating Emoji Burst
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
                <span style={{ color: user?.isPro ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                  {user?.isPro ? '👑 VIP: FREE (0 Sparks)' : '⚡ Cost: 5 Sparks / burst'}
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
                  placeholder="Type or paste ANY emoji..."
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
                    background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: customBurstEmoji.trim() ? 'pointer' : 'default',
                    opacity: customBurstEmoji.trim() ? 1 : 0.6,
                    boxShadow: '0 2px 8px rgba(244, 63, 94, 0.4)'
                  }}
                >
                  Burst 💥
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

          {/* 4-Dot Button Beside Typing Input Box */}
          {!showRecorder && (
            <button
              ref={actionGridBtnRef}
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

          {/* Emoji Button Beside 4-Dot Button */}
          {!showRecorder && (
            <button
              type="button"
              onClick={() => {
                setShowEmoji(prev => !prev);
                setShowActionGrid(false);
              }}
              className="icon-btn-ghost"
              title="Emoji Picker"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: showEmoji ? 'rgba(245, 158, 11, 0.22)' : 'var(--bg-card)',
                color: showEmoji ? '#f59e0b' : 'var(--text-muted)',
                border: showEmoji ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                boxShadow: showEmoji ? '0 0 10px rgba(245, 158, 11, 0.35)' : 'none'
              }}
            >
              <Smile size={20} />
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
                title="Send Message (Hold to Schedule ⏰)"
                onMouseDown={handleSendBtnMouseDown}
                onMouseUp={handleSendBtnMouseUp}
                onTouchStart={handleSendBtnMouseDown}
                onTouchEnd={handleSendBtnMouseUp}
                style={{ flexShrink: 0 }}
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </div>
        </>
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
              <button
                onClick={() => setShowAppsFolderModal(false)}
                className="icon-btn-ghost"
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'transparent' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Folder App Grid (Mobile App Icon Style) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px 10px',
              textAlign: 'center'
            }}>
              {/* App 1: Live Arrow Battle */}
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
                  width: '54px',
                  height: '54px',
                  borderRadius: '17px',
                  background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 6px 16px rgba(236, 72, 153, 0.42)',
                  marginBottom: '7px'
                }}>
                  <Gamepad2 size={27} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  Arrow Battle
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

              {/* App 4: Tic-Tac-Toe Arena */}
              <button
                type="button"
                onClick={handleOpenTicTacToe}
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
                  background: 'linear-gradient(135deg, #38bdf8, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 6px 16px rgba(56, 189, 248, 0.4)',
                  marginBottom: '7px',
                  position: 'relative',
                  fontSize: '1.6rem'
                }}>
                  🎮
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  Tic-Tac-Toe
                </span>
              </button>
            </div>
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
          onClose={() => setShowTicTacToeModal(false)}
          onOpenSparksWallet={() => setShowSparksWallet(true)}
        />
      )}

      {showArrowGameModal && (
        <LiveArrowGameModal
          activeChat={activeChat}
          onClose={() => setShowArrowGameModal(false)}
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
          initialText={text}
          onSchedule={handleScheduleMessage}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}
