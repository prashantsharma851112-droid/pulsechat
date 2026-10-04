import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Music, Trash2, Zap, Eye, Send, Users, Volume2, VolumeX, Disc, Lock, MessageSquare, Smile } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound, registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
import { updateRecentChatSnippet, getCachedAllUsers } from '../../utils/offlineStorage';
import { useBackHandler } from '../../utils/backNavigation';

import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';
import SparksWalletModal from '../chat/SparksWalletModal';
import PulseProModal from '../chat/PulseProModal';
import { EMOJI_CATEGORIES } from '../chat/EmojiPicker';

export default function VibeViewerModal({ vibeGroup, onClose, onRefresh, initialVibeId }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  
  // Strictly deduplicate and sort vibes: newest first (jo new lagaya vo aage), oldest last (jo pehle lagaya tha vo last)
  const vibes = React.useMemo(() => {
    const raw = vibeGroup?.vibes || [];
    const seen = new Set();
    const clean = [];
    raw.forEach(v => {
      const contentKey = `${v.caption || ''}_${v.mediaUrl || ''}_${Math.floor(new Date(v.createdAt).getTime() / 25000)}`;
      if (!seen.has(v.id) && !seen.has(contentKey)) {
        seen.add(v.id);
        seen.add(contentKey);
        clean.push(v);
      }
    });
    clean.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return clean;
  }, [vibeGroup?.vibes]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialVibeId && vibes.length > 0) {
      const idx = vibes.findIndex(v => String(v.id) === String(initialVibeId) || String(v._id) === String(initialVibeId));
      if (idx !== -1) return idx;
    }
    return 0;
  });

  const hasInitializedIndexRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedIndexRef.current && initialVibeId && vibes.length > 0) {
      const idx = vibes.findIndex(v => String(v.id) === String(initialVibeId) || String(v._id) === String(initialVibeId));
      if (idx !== -1) {
        setCurrentIndex(idx);
        setProgress(0);
      }
      hasInitializedIndexRef.current = true;
    }
  }, [initialVibeId, vibes]);

  const [progress, setProgress] = useState(0);
  const [sparksMsg, setSparksMsg] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Sparks Tipping & Wallet Modal States
  const [showSparksTipModal, setShowSparksTipModal] = useState(false);
  const [tipSparksAmount, setTipSparksAmount] = useState(25);
  const [customSparksInput, setCustomSparksInput] = useState('');
  const [showSparksWallet, setShowSparksWallet] = useState(false);
  const [showGetSparksModal, setShowGetSparksModal] = useState(false);

  // Sleek Bottom Bar Modal States (Reply Sheet & Unlimited Emoji Reaction Sheet)
  const [showReplySheet, setShowReplySheet] = useState(false);
  const [showUnlimitedEmojiModal, setShowUnlimitedEmojiModal] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');

  // Hardware/Swipe Back button closes submodals first, otherwise closes story viewer safely
  useBackHandler(() => setShowUnlimitedEmojiModal(false), showUnlimitedEmojiModal);
  useBackHandler(() => setShowReplySheet(false), showReplySheet && !showUnlimitedEmojiModal);
  useBackHandler(() => setShowGetSparksModal(false), showGetSparksModal && !showReplySheet && !showUnlimitedEmojiModal);
  useBackHandler(() => setShowSparksWallet(false), showSparksWallet && !showGetSparksModal && !showReplySheet && !showUnlimitedEmojiModal);
  useBackHandler(() => setShowSparksTipModal(false), showSparksTipModal && !showSparksWallet && !showGetSparksModal && !showReplySheet && !showUnlimitedEmojiModal);
  useBackHandler(() => setShowViewersSheet(false), showViewersSheet && !showSparksTipModal && !showSparksWallet && !showGetSparksModal && !showReplySheet && !showUnlimitedEmojiModal);
  useBackHandler(onClose, !showViewersSheet && !showSparksTipModal && !showSparksWallet && !showGetSparksModal && !showReplySheet && !showUnlimitedEmojiModal);

  // Per-story live views dictionary keyed by vibe ID
  const [viewsByVibeId, setViewsByVibeId] = useState(() => {
    const initial = {};
    (vibeGroup?.vibes || []).forEach(v => {
      if (v && v.id) {
        initial[v.id] = Array.isArray(v.views) ? v.views : [];
      }
    });
    return initial;
  });

  const currentVibe = vibes[currentIndex] || vibes[0];
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const touchStartTimeRef = useRef(0);

  // Current story's specific viewers list & count
  const currentStoryViews = viewsByVibeId[currentVibe?.id] ?? (Array.isArray(currentVibe?.views) ? currentVibe.views : []);
  const viewCount = currentStoryViews.length;

  // Sponsored Story Ad State (for non-VIP users between stories)
  const [showingSponsoredAd, setShowingSponsoredAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  useEffect(() => {
    if (!showingSponsoredAd) return;
    setAdCountdown(5);
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showingSponsoredAd]);

  const storyAuthorId = currentVibe?.userId || vibeGroup?.userId;
  const currentUserId = user?.id || user?._id || 'local_user';
  const isMine = Boolean(
    storyAuthorId && (
      storyAuthorId === currentUserId ||
      (user?.id && (storyAuthorId === user.id || currentVibe?.userId === user.id || vibeGroup?.userId === user.id)) ||
      (user?._id && (storyAuthorId === user._id || currentVibe?.userId === user._id || vibeGroup?.userId === user._id)) ||
      (user?.username && (storyAuthorId === user.username || currentVibe?.username === user.username || vibeGroup?.username === user.username))
    )
  );

  const [authorFriendStatus, setAuthorFriendStatus] = useState(() => isMine ? 'friends' : 'checking');
  const [authorRequestId, setAuthorRequestId] = useState(null);
  const [authorActionLoading, setAuthorActionLoading] = useState(false);

  // Fetch friendship status for the story author
  useEffect(() => {
    if (isMine) {
      setAuthorFriendStatus('friends');
      return;
    }
    if (!storyAuthorId || !token) {
      setAuthorFriendStatus('none');
      return;
    }

    let isMounted = true;
    setAuthorFriendStatus('checking');

    fetch(`${BACKEND_URL}/api/friends/status/${storyAuthorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data) {
          setAuthorFriendStatus(data.status || 'none');
          setAuthorRequestId(data.requestId || null);
        }
      })
      .catch(() => {
        if (isMounted) setAuthorFriendStatus('none');
      });

    return () => { isMounted = false; };
  }, [storyAuthorId, isMine, token]);

  // Real-time synchronization of friendship status (lock/unlock immediately)
  useEffect(() => {
    const handleFriendRemoved = (e) => {
      const targetId = e?.detail?.targetId || e?.userId || e?.targetId;
      if (targetId && (targetId === storyAuthorId || targetId === vibeGroup?.username || (currentVibe && targetId === currentVibe.userId))) {
        setAuthorFriendStatus('none');
      }
    };
    const handleReqAccepted = (data) => {
      const otherId = data?.friend?.id || data?.senderId;
      if (otherId && (otherId === storyAuthorId || otherId === vibeGroup?.username || (currentVibe && otherId === currentVibe.userId))) {
        setAuthorFriendStatus('friends');
      }
    };
    const handleReqCancelled = (data) => {
      if (data?.requestId === authorRequestId || data?.targetId === storyAuthorId) {
        setAuthorFriendStatus('none');
        setAuthorRequestId(null);
      }
    };

    if (socket) {
      socket.on('friend_removed', handleFriendRemoved);
      socket.on('friend_request_accepted', handleReqAccepted);
      socket.on('friend_request_cancelled', handleReqCancelled);
      socket.on('friend_request_rejected', handleReqCancelled);
    }
    window.addEventListener('pulsechat_friend_removed', handleFriendRemoved);

    return () => {
      if (socket) {
        socket.off('friend_removed', handleFriendRemoved);
        socket.off('friend_request_accepted', handleReqAccepted);
        socket.off('friend_request_cancelled', handleReqCancelled);
        socket.off('friend_request_rejected', handleReqCancelled);
      }
      window.removeEventListener('pulsechat_friend_removed', handleFriendRemoved);
    };
  }, [socket, storyAuthorId, vibeGroup?.username, currentVibe?.userId, authorRequestId]);

  const handleSendSyncRequest = async () => {
    if (!token || !storyAuthorId || authorActionLoading) return;
    try {
      setAuthorActionLoading(true);
      setAuthorFriendStatus('pending_sent');
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${storyAuthorId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'accepted') {
        setAuthorFriendStatus('friends');
      } else if (data?.request?.id) {
        setAuthorRequestId(data.request.id);
      }
    } catch (err) {
      console.error('Failed to send sync request from vibe viewer:', err);
    } finally {
      setAuthorActionLoading(false);
    }
  };

  const handleAcceptSyncRequest = async () => {
    if (!token || !authorRequestId || authorActionLoading) return;
    try {
      setAuthorActionLoading(true);
      setAuthorFriendStatus('friends');
      const res = await fetch(`${BACKEND_URL}/api/friends/accept/${authorRequestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setAuthorFriendStatus('pending_received');
      }
    } catch (err) {
      console.error('Failed to accept sync request from vibe viewer:', err);
      setAuthorFriendStatus('pending_received');
    } finally {
      setAuthorActionLoading(false);
    }
  };

  const isKing = vibeGroup?.hasKingCrown || (isMine && user?.hasKingCrown);
  const isSilver = vibeGroup?.hasSilverCrown || (isMine && user?.hasSilverCrown);
  const isStreak = vibeGroup?.hasStreakCrown || (isMine && user?.hasStreakCrown);

  let hasKing = Boolean(isKing);
  let hasSilver = Boolean(isSilver);
  let hasStreak = Boolean(isStreak);

  if (!hasKing && !hasSilver && !hasStreak && user?.id) {
    try {
      const cachedUsers = getCachedAllUsers(user.id || user._id);
      if (Array.isArray(cachedUsers)) {
        const targetKey = vibeGroup?.userId || currentVibe?.userId;
        const targetUsername = vibeGroup?.username || currentVibe?.username;
        const matched = cachedUsers.find(u =>
          (targetKey && (u.id === targetKey || u._id === targetKey)) ||
          (u.username && targetUsername && String(u.username).toLowerCase() === String(targetUsername).toLowerCase())
        );
        if (matched) {
          hasKing = Boolean(matched.hasKingCrown);
          hasSilver = Boolean(matched.hasSilverCrown);
          hasStreak = Boolean(matched.hasStreakCrown);
        }
      }
    } catch (e) {}
  }

  // Real-time socket listener for live view updates for all vibes
  useEffect(() => {
    if (!socket) return;
    const handleViewUpdate = (data) => {
      if (data && data.vibeId) {
        setViewsByVibeId(prev => ({
          ...prev,
          [data.vibeId]: Array.isArray(data.views) ? data.views : []
        }));
      }
    };
    socket.on('vibe_view_updated', handleViewUpdate);
    return () => {
      socket.off('vibe_view_updated', handleViewUpdate);
    };
  }, [socket]);

  // Mark current story as viewed in LocalStorage and send view ping to Backend
  useEffect(() => {
    if (currentVibe && currentVibe.id) {
      const vId = currentVibe.id;

      // Always fetch fresh live views specifically for THIS vibe ID
      if (token) {
        fetch(`${BACKEND_URL}/api/vibes/views/${vId}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.success && Array.isArray(data.views)) {
              setViewsByVibeId(prev => ({
                ...prev,
                [vId]: data.views
              }));
            }
          })
          .catch(() => {});
      }

      try {
        const rawViewed = localStorage.getItem('pulsechat_viewed_vibes');
        const viewedSet = new Set(rawViewed ? JSON.parse(rawViewed) : []);
        if (!viewedSet.has(vId)) {
          viewedSet.add(vId);
          localStorage.setItem('pulsechat_viewed_vibes', JSON.stringify(Array.from(viewedSet)));
          window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
        }
      } catch (e) {}

      if (token && !isMine) {
        fetch(`${BACKEND_URL}/api/vibes/view/${vId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.views)) {
              setViewsByVibeId(prev => ({
                ...prev,
                [vId]: data.views
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [currentVibe?.id, token, isMine]);

  // Auto-play Instagram Music Track / Story Background Audio
  useEffect(() => {
    stopGlobalMusicAudio();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current = null;
      } catch (e) {}
    }

    if (currentVibe?.audioUrl && !currentVibe.audioUrl.includes('youtube')) {
      const audio = new Audio(currentVibe.audioUrl);
      audio.loop = true;
      const validTime = Number(currentVibe?.songStartTime || 0);
      if (!isNaN(validTime) && isFinite(validTime) && validTime > 0) {
        audio.addEventListener('loadedmetadata', () => {
          try {
            if (validTime < audio.duration) audio.currentTime = validTime;
          } catch (e) {}
        });
      }
      audio.volume = isAudioMuted ? 0 : 0.85;
      registerGlobalMusicAudio(audio);
      audio.play().catch(e => console.warn('Autoplay prevented:', e));
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {}
      }
      stopGlobalMusicAudio();
    };
  }, [currentVibe?.audioUrl, currentVibe?.id, currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isAudioMuted ? 0 : 0.85;
    }
  }, [isAudioMuted]);

  // Auto-upgrade Vibe Story music to full YouTube audio stream ONLY if no direct audioUrl exists
  const [upgradedYtId, setUpgradedYtId] = useState(null);
  useEffect(() => {
    setUpgradedYtId(null);
    if (currentVibe && !currentVibe.audioUrl && !currentVibe.youtubeId && currentVibe.songTitle) {
      const q = `${currentVibe.songTitle} ${currentVibe.artistName || ''}`;
      const rawToken = localStorage.getItem('pulsechat_token');
      const authHeader = rawToken ? { Authorization: `Bearer ${rawToken}` } : {};
      fetch(`${BACKEND_URL}/api/messages/youtube-search?q=${encodeURIComponent(q)}`, { headers: authHeader })
        .then(r => r.json())
        .then(ytData => {
          if (Array.isArray(ytData) && ytData.length > 0 && ytData[0].youtubeId) {
            currentVibe.youtubeId = ytData[0].youtubeId;
            currentVibe.isFullSong = true;
            setUpgradedYtId(ytData[0].youtubeId);
          }
        })
        .catch(() => {});
    }
  }, [currentVibe?.id, currentVibe?.songTitle, currentVibe?.audioUrl]);

  // Fetch live views for owner when modal opens or viewers button tapped
  const fetchLiveViews = async () => {
    if (token && currentVibe?.id) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/views/${currentVibe.id}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.views)) {
          setViewsByVibeId(prev => ({
            ...prev,
            [currentVibe.id]: data.views
          }));
        }
      } catch (e) {}
    }
  };

  const handleCloseModal = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current = null;
      } catch (e) {}
    }
    stopGlobalMusicAudio();
    onClose();
  };

  const isCurrentStoryVideo = currentVibe?.mediaType === 'video' ||
    Boolean(currentVibe?.mediaUrl && (
      currentVibe.mediaUrl.includes('/video/') ||
      currentVibe.mediaUrl.startsWith('data:video') ||
      currentVibe.mediaUrl.startsWith('blob:') ||
      currentVibe.mediaUrl.match(/\.(mp4|webm|mov|ogg|m4v|3gp|mkv)($|\?)/i)
    ));

  const lastPlayedVibeIdRef = useRef(null);

  // Sync video player lifecycle (only resets currentTime when changing to a DIFFERENT story)
  useEffect(() => {
    if (videoPlayerRef.current) {
      try {
        if (lastPlayedVibeIdRef.current !== currentVibe?.id) {
          lastPlayedVibeIdRef.current = currentVibe?.id;
          videoPlayerRef.current.currentTime = 0;
        }
        videoPlayerRef.current.volume = 1.0;
        videoPlayerRef.current.muted = isAudioMuted;
        const playPromise = videoPlayerRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // If browser autoplay policy blocked audio, fall back to muted
            if (videoPlayerRef.current && !videoPlayerRef.current.muted) {
              videoPlayerRef.current.muted = true;
              videoPlayerRef.current.play().catch(() => {});
            }
          });
        }
      } catch (e) {}
    }
  }, [currentIndex, currentVibe?.id, isAudioMuted]);

  const isAnySubmodalOpen = showViewersSheet || showSparksTipModal || showSparksWallet || showGetSparksModal || showReplySheet || showUnlimitedEmojiModal;

  useEffect(() => {
    if (videoPlayerRef.current) {
      if (isPaused || isHolding || isAnySubmodalOpen) {
        try { videoPlayerRef.current.pause(); } catch (e) {}
      } else {
        try { videoPlayerRef.current.play().catch(() => {}); } catch (e) {}
      }
    }
  }, [isPaused, isHolding, isAnySubmodalOpen]);

  // Story Auto-Advance Progress Bar Timer (for photo/text stories; videos manage progress via onTimeUpdate)
  useEffect(() => {
    if (isCurrentStoryVideo) return;
    if (isPaused || isHolding || isAnySubmodalOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const durSeconds = Math.max(5, Number(currentVibe?.storyDuration || currentVibe?.duration || 15));
    const step = 100 / (durSeconds * 10);

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentIndex < vibes.length - 1) {
            setCurrentIndex(c => c + 1);
            return 0;
          } else {
            clearInterval(timerRef.current);
            if (!user?.isPro && !showingSponsoredAd) {
              setShowingSponsoredAd(true);
              return 100;
            } else {
              handleCloseModal();
              return 100;
            }
          }
        }
        return prev + step;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, vibes.length, onClose, isPaused, isHolding, showViewersSheet, currentVibe?.id, currentVibe?.storyDuration, user?.isPro, showingSponsoredAd, isCurrentStoryVideo]);

  // Instagram-style Hold to Pause & Tap Navigation Gestures
  const handleStagePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.interactive-action') || e.target.closest('form')) return;
    touchStartTimeRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      setIsPaused(true);
      if (videoPlayerRef.current) {
        try { videoPlayerRef.current.pause(); } catch (err) {}
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (err) {}
      }
    }, 160);
  };

  const handleStagePointerUp = (e) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const pressDuration = Date.now() - touchStartTimeRef.current;
    if (isHolding) {
      setIsHolding(false);
      setIsPaused(false);
      if (videoPlayerRef.current) {
        try { videoPlayerRef.current.play().catch(() => {}); } catch (err) {}
      }
      if (audioRef.current && !isAudioMuted) {
        try { audioRef.current.play().catch(() => {}); } catch (err) {}
      }
      return;
    }

    if (pressDuration < 200 && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('.interactive-action') && !e.target.closest('form')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : rect.width / 2);
      const relativeX = clientX - rect.left;
      if (relativeX < rect.width * 0.35) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < vibes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      if (!user?.isPro && !showingSponsoredAd) {
        setShowingSponsoredAd(true);
      } else {
        handleCloseModal();
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReact = async (emoji, tipSparks = 0, textMsg = '') => {
    if (!currentVibe) return;
    if (!isMine && authorFriendStatus !== 'friends') {
      setSparksMsg('🔒 Sync first to reply, react or tip sparks');
      setTimeout(() => setSparksMsg(''), 3000);
      return;
    }
    playSound('pop');

    const storyAuthorId = currentVibe.userId || vibeGroup?.userId;
    const authorName = vibeGroup?.displayName || vibeGroup?.username || 'User';

    let msgText = '';
    if (textMsg && textMsg.trim()) {
      msgText = textMsg.trim();
    } else if (tipSparks > 0) {
      msgText = `Tipped ⚡ ${tipSparks} Sparks on story`;
    } else if (emoji) {
      msgText = `Reacted ${emoji} to story`;
    }

    const storyReplyData = {
      storyId: currentVibe.id,
      mediaUrl: currentVibe.mediaUrl || null,
      mediaType: currentVibe.mediaUrl ? (currentVibe.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') : 'text',
      caption: currentVibe.caption || '',
      bgGradient: currentVibe.bgGradient || null,
      audioUrl: currentVibe.audioUrl || null,
      songTitle: currentVibe.songTitle || '',
      artistName: currentVibe.artistName || '',
      authorId: storyAuthorId,
      authorName: authorName,
      authorAvatar: vibeGroup?.avatar || currentVibe.avatar || '',
      reactionEmoji: emoji || null,
      replyText: textMsg ? textMsg.trim() : null,
      tipSparks: tipSparks > 0 ? tipSparks : 0,
      createdAt: currentVibe.createdAt || new Date().toISOString()
    };

    // 1. INSTANT LOCAL RECENT CHATS UPDATE (0ms latency, zero chat disappearance!)
    if (user?.id && storyAuthorId && msgText) {
      const chatId = [user.id, storyAuthorId].sort().join('_');
      const tempMsg = {
        id: 'msg_vibe_temp_' + Date.now(),
        chatId,
        senderId: user.id,
        receiverId: storyAuthorId,
        isGroup: false,
        content: msgText,
        type: 'story_reply',
        storyReply: storyReplyData,
        status: 'sent',
        timestamp: new Date().toISOString()
      };
      const targetChatObj = {
        id: storyAuthorId,
        displayName: authorName,
        avatar: vibeGroup?.avatar || '',
        isGroup: false
      };
      updateRecentChatSnippet(user.id, chatId, tempMsg, targetChatObj);
      window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    }

    if (tipSparks > 0) {
      setSparksMsg(`⚡ Tipped ${tipSparks} Sparks to ${authorName}!`);
      const currentSparks = user?.pulseSparks || 100;
      const newBalance = Math.max(0, currentSparks - tipSparks);
      if (updateUserProfile) {
        updateUserProfile({ ...user, pulseSparks: newBalance });
      }
      setTimeout(() => setSparksMsg(''), 3000);
    } else if (emoji || textMsg) {
      const toastText = textMsg ? `Sent reply to ${authorName} in Chat! 💬` : `Reacted ${emoji} in Chat! 💬`;
      setSparksMsg(toastText);
      setTimeout(() => setSparksMsg(''), 3000);
    }

    if (textMsg) {
      setReplyText('');
    }

    // 2. BACKGROUND PERSISTENCE & SOCKET EMISSION
    if (token && currentVibe.id) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/react/${currentVibe.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ emoji, tipSparks, replyText: textMsg })
        });
        const data = await res.json();
        if (data.success && data.createdMessage && user?.id) {
          updateRecentChatSnippet(user.id, data.createdMessage.chatId, data.createdMessage, {
            id: storyAuthorId,
            displayName: authorName,
            avatar: vibeGroup?.avatar || ''
          });
          window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
        }
        if (data.success && data.remainingSparks !== undefined && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.remainingSparks });
        }
      } catch (e) {}
    }
  };

  const handleDelete = async () => {
    if (!currentVibe) return;

    // Delete from LocalStorage if present
    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      if (raw) {
        const items = JSON.parse(raw);
        const filtered = items.filter(v => v.id !== currentVibe.id);
        localStorage.setItem('pulsechat_local_vibes', JSON.stringify(filtered));
      }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    if (token && currentVibe.id) {
      try {
        await fetch(`${BACKEND_URL}/api/vibes/${currentVibe.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    }

    if (onRefresh) onRefresh();
    handleCloseModal();
  };

  if (!currentVibe) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1400,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100vw' : '440px',
          height: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100dvh' : 'min(880px, 98dvh)',
          borderRadius: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0px' : '24px',
          overflow: 'hidden',
          background: currentVibe.bgGradient || 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          border: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'none' : '1px solid rgba(255,255,255,0.15)'
        }}
      >
        {/* Top Progress Bars */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: '4px',
          zIndex: 10,
          opacity: isHolding ? 0 : 1,
          pointerEvents: isHolding ? 'none' : 'auto',
          transition: 'opacity 0.22s ease'
        }}>
          {vibes.map((v, i) => (
            <div
              key={v.id || i}
              style={{
                flex: 1,
                height: '3px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.3)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#fff',
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header info (Creator avatar & Close) */}
        <div style={{
          position: 'absolute',
          top: 24,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          color: '#fff',
          opacity: isHolding ? 0 : 1,
          pointerEvents: isHolding ? 'none' : 'auto',
          transition: 'opacity 0.22s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
              {hasKing ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
              ) : hasSilver ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
              ) : hasStreak ? (
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
              ) : null}
              <img
                src={vibeGroup?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${vibeGroup?.username || 'user'}`}
                alt={vibeGroup?.displayName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fff' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {vibeGroup?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.68rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
                <Music size={11} /> {currentVibe.songTitle ? `🎵 ${currentVibe.songTitle} · ${currentVibe.artistName}` : currentVibe.soundtrack !== 'none' ? currentVibe.soundtrack : 'Vibe Story'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user?.isPro && (
              <span style={{ fontSize: '0.66rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.25)', border: '1px solid rgba(245, 158, 11, 0.45)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                👑 VIP Ad-Free
              </span>
            )}
            {Boolean(currentVibe?.audioUrl || isCurrentStoryVideo) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioMuted(prev => {
                    const next = !prev;
                    if (videoPlayerRef.current) {
                      videoPlayerRef.current.muted = next;
                      videoPlayerRef.current.volume = 1.0;
                      if (!next) videoPlayerRef.current.play().catch(() => {});
                    }
                    if (audioRef.current) {
                      audioRef.current.volume = next ? 0 : 0.85;
                      if (!next) audioRef.current.play().catch(() => {});
                    }
                    return next;
                  });
                }}
                className="icon-btn-ghost"
                style={{ color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px' }}
                title={isAudioMuted ? "Unmute Story Audio" : "Mute Story Audio"}
              >
                {isAudioMuted ? <VolumeX size={17} color="#ef4444" /> : <Volume2 size={17} color="#38bdf8" />}
              </button>
            )}
            {isMine && (
              <button
                onClick={handleDelete}
                className="icon-btn-ghost"
                title="Delete Story"
                style={{ color: '#ef4444', background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={handleCloseModal}
              className="icon-btn-ghost"
              style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FULLSCREEN SPONSORED STORY AD OVERLAY (Shown between stories for non-VIP users) */}
        {showingSponsoredAd && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: 'linear-gradient(135deg, #09090b 0%, #1e1b4b 50%, #311042 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 20px',
            color: '#fff'
          }}>
            {/* Top Header */}
            <div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ height: '100%', width: `${((5 - adCountdown) / 5) * 100}%`, background: 'linear-gradient(90deg, #10b981, #f59e0b)', transition: 'width 1s linear' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚡</div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Pulse Story Transition <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: '4px' }}>AdMob Interstitial</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sponsored Partner Story</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    background: adCountdown <= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {adCountdown <= 0 ? 'Skip Ad ✕' : `Skip in ${adCountdown}s`}
                </button>
              </div>
            </div>

            {/* Middle Showcase Content */}
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '14px', filter: 'drop-shadow(0 0 25px rgba(245, 158, 11, 0.6))' }}>✨</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 10px 0', background: 'linear-gradient(90deg, #fbbf24, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Upgrade to Pulse VIP
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                Enjoy 100% Ad-Free Stories, Unlimited 3D Text Typography, 4K Live Animated Wallpapers, and Royal Leaderboard Crowns!
              </p>

              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  padding: '14px 28px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 0 25px rgba(245, 158, 11, 0.5)'
                }}
              >
                Learn More & Go Pro ➔
              </button>
            </div>

            {/* Bottom Footer */}
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b' }}>
              Google AdMob Story Network • Tap Skip to close
            </div>
          </div>
        )}

        {/* Live Canvas Background if selected (ALWAYS rendered even with media) */}
        {currentVibe.animatedBg && currentVibe.animatedBg !== 'none' && (
          <ChatLiveWallpaper wallpaperId={currentVibe.animatedBg} />
        )}

        {/* Media or Text Content Body with Instagram Hold-to-Pause and Tap navigation */}
        <div
          onMouseDown={handleStagePointerDown}
          onMouseUp={handleStagePointerUp}
          onTouchStart={handleStagePointerDown}
          onTouchEnd={handleStagePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: currentVibe.imageFit === 'padded' ? '50px 30px' : '0px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none'
          }}
        >
          {/* Full Song YouTube Background Audio Engine (Fallback ONLY when no direct audioUrl) */}
          {!currentVibe?.audioUrl && (currentVibe?.youtubeId || upgradedYtId) && !isAudioMuted && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                zIndex: 15,
                width: '140px',
                height: '40px',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                border: '1.5px solid rgba(245, 158, 11, 0.7)',
                background: '#000000'
              }}
            >
              <iframe
                key={`yt_player_${currentVibe.id}_${currentVibe.youtubeId || upgradedYtId}_${currentVibe.songStartTime || 0}`}
                src={`https://www.youtube-nocookie.com/embed/${currentVibe.youtubeId || upgradedYtId}?autoplay=1&enablejsapi=1&loop=1&playlist=${currentVibe.youtubeId || upgradedYtId}&start=${Math.floor(currentVibe.songStartTime || 0)}`}
                allow="autoplay; encrypted-media; fullscreen"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          )}

          {/* Uploaded Image or Video Layer */}
          {currentVibe.mediaUrl ? (
            <div style={{
              position: 'absolute',
              left: `${currentVibe.imagePos?.x ?? 50}%`,
              top: `${currentVibe.imagePos?.y ?? 50}%`,
              transform: `translate(-50%, -50%) scale(${currentVibe.imageZoom || 1.0})`,
              width: currentVibe.imageFit === 'contain' ? '92%' : '100%',
              height: currentVibe.imageFit === 'contain' ? '92%' : '100%',
              borderRadius: currentVibe.imageFit === 'padded' ? '16px' : '0px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2
            }}>
              {isCurrentStoryVideo ? (
                <video
                  ref={videoPlayerRef}
                  key={`video_${currentVibe.id}`}
                  src={currentVibe.mediaUrl}
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  autoPlay
                  loop={false}
                  muted={isAudioMuted}
                  onLoadedData={(e) => {
                    const vid = e.currentTarget;
                    vid.muted = isAudioMuted;
                    vid.volume = 1.0;
                    const p = vid.play();
                    if (p !== undefined) {
                      p.catch(() => {
                        vid.muted = true;
                        vid.play().catch(() => {});
                      });
                    }
                  }}
                  onWaiting={() => {
                    if (!isPaused && !isHolding && !isAnySubmodalOpen) {
                      videoPlayerRef.current?.play().catch(() => {});
                    }
                  }}
                  onCanPlay={() => {
                    if (!isPaused && !isHolding && !isAnySubmodalOpen) {
                      videoPlayerRef.current?.play().catch(() => {});
                    }
                  }}
                  onStalled={() => {
                    if (!isPaused && !isHolding && !isAnySubmodalOpen) {
                      videoPlayerRef.current?.play().catch(() => {});
                    }
                  }}
                  onPause={() => {
                    if (!isPaused && !isHolding && !isAnySubmodalOpen) {
                      setTimeout(() => {
                        videoPlayerRef.current?.play().catch(() => {});
                      }, 150);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration && !isNaN(v.duration) && v.duration > 0) {
                      setProgress((v.currentTime / v.duration) * 100);
                    }
                  }}
                  onEnded={handleNext}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: currentVibe.imageFit === 'padded' ? 'contain' : (currentVibe.imageFit || 'cover'),
                    filter: currentVibe.imageFilter === 'warm' ? 'saturate(1.4) contrast(1.15)' :
                            currentVibe.imageFilter === 'cyber' ? 'hue-rotate(180deg) saturate(1.5)' :
                            currentVibe.imageFilter === 'vintage' ? 'sepia(0.4) contrast(1.1)' :
                            currentVibe.imageFilter === 'bw' ? 'grayscale(0.85) contrast(1.2)' : 'none',
                    opacity: currentVibe.imageOpacity || 1.0,
                    pointerEvents: 'none'
                  }}
                />
              ) : (
                <img
                  src={currentVibe.mediaUrl}
                  alt="Vibe Content"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: currentVibe.imageFit === 'padded' ? 'contain' : (currentVibe.imageFit || 'cover'),
                    filter: currentVibe.imageFilter === 'warm' ? 'saturate(1.4) contrast(1.15)' :
                            currentVibe.imageFilter === 'cyber' ? 'hue-rotate(180deg) saturate(1.5)' :
                            currentVibe.imageFilter === 'vintage' ? 'sepia(0.4) contrast(1.1)' :
                            currentVibe.imageFilter === 'bw' ? 'grayscale(0.85) contrast(1.2)' : 'none',
                    opacity: currentVibe.imageOpacity || 1.0,
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>
          ) : null}

          {/* 3D Text Card or Text Overlay positioned at user's textPos */}
          <div style={{
            position: 'absolute',
            left: `${currentVibe.textPos?.x ?? 50}%`,
            top: `${currentVibe.textPos?.y ?? 50}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 5,
            width: '88%',
            display: 'flex',
            justifyContent: 'center'
          }}>
            {currentVibe.textStyle3D && currentVibe.textStyle3D !== 'none' ? (
              <div className={`animated-3d-stage ${currentVibe.textStyle3D}`} style={{ position: 'relative', zIndex: 4, maxWidth: '100%', width: '100%' }}>
                <div className="animated-3d-card" style={{ padding: '12px 20px', background: 'transparent', boxShadow: 'none', border: 'none', width: '100%' }}>
                  <div className="text-3d-content" style={{ fontSize: `${(currentVibe.textSize || 1.3) * 1.1}rem`, textAlign: currentVibe.textAlign || 'center' }}>
                    {currentVibe.caption}
                  </div>
                  <div className="text-3d-shadow" />
                </div>
              </div>
            ) : currentVibe.caption ? (
              <div style={{
                color: currentVibe.textColor || '#ffffff',
                fontSize: `${(currentVibe.textSize || 1.3) * 1.15}rem`,
                fontWeight: 800,
                textAlign: currentVibe.textAlign || 'center',
                lineHeight: 1.4,
                background: currentVibe.textBgStyle === 'box'
                  ? 'rgba(0, 0, 0, 0.75)'
                  : currentVibe.textBgStyle === 'neon'
                  ? 'rgba(99, 102, 241, 0.88)'
                  : currentVibe.textBgStyle === 'gradient'
                  ? 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)'
                  : 'transparent',
                padding: currentVibe.textBgStyle && currentVibe.textBgStyle !== 'none' ? '8px 18px' : '0px',
                borderRadius: currentVibe.textBgStyle && currentVibe.textBgStyle !== 'none' ? '14px' : '0px',
                backdropFilter: currentVibe.textBgStyle === 'box' ? 'blur(8px)' : 'none',
                boxShadow: currentVibe.textBgStyle === 'neon'
                  ? '0 0 20px rgba(99, 102, 241, 0.7)'
                  : currentVibe.textBgStyle === 'gradient'
                  ? '0 4px 18px rgba(220, 39, 67, 0.5)'
                  : currentVibe.textBgStyle === 'box'
                  ? '0 4px 16px rgba(0,0,0,0.6)'
                  : 'none',
                textShadow: (!currentVibe.textBgStyle || currentVibe.textBgStyle === 'none') ? '0 2px 10px rgba(0,0,0,0.85)' : 'none',
                margin: 0
              }}>
                {currentVibe.caption}
              </div>
            ) : null}
          </div>

          {/* Interactive Floating Stickers positioned at exact coordinates */}
          {Array.isArray(currentVibe.stickersData) && currentVibe.stickersData.length > 0 ? (
            currentVibe.stickersData.map((s, idx) => (
              <div
                key={s.id || idx}
                onClick={(e) => {
                  if (s.isTipBadge || s.emoji === '⚡ Tip Sparks') {
                    e.stopPropagation();
                    if (!isMine && authorFriendStatus !== 'friends') {
                      setSparksMsg('🔒 Sync first to tip sparks');
                      setTimeout(() => setSparksMsg(''), 3000);
                      return;
                    }
                    setShowSparksTipModal(true);
                  }
                }}
                className={s.isTipBadge || s.emoji === '⚡ Tip Sparks' ? 'interactive-action' : ''}
                style={{
                  position: 'absolute',
                  left: `${s.x ?? 50}%`,
                  top: `${s.y ?? 50}%`,
                  transform: `translate(-50%, -50%) scale(${s.scale || 1.0})`,
                  zIndex: 8,
                  userSelect: 'none',
                  cursor: (s.isTipBadge || s.emoji === '⚡ Tip Sparks') ? 'pointer' : 'default',
                  filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.6))',
                  animation: 'pulseFadeIn 0.25s ease'
                }}
              >
                {s.isTipBadge || s.emoji === '⚡ Tip Sparks' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: '24px',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    border: '1.5px solid rgba(255,255,255,0.4)',
                    animation: 'pulseGlow 2s infinite alternate'
                  }}>
                    <Zap size={16} fill="#fbbf24" color="#fbbf24" />
                    <span>Tip Sparks</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '2.4rem' }}>{s.emoji}</span>
                )}
              </div>
            ))
          ) : (
            Array.isArray(currentVibe.selectedStickers) && currentVibe.selectedStickers.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: '90px',
                right: '20px',
                display: 'flex',
                gap: '6px',
                zIndex: 7,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '20px'
              }}>
                {currentVibe.selectedStickers.map((s, idx) => (
                  <span key={idx} style={{ fontSize: '1.3rem', animation: 'bounce 2s infinite' }}>{s}</span>
                ))}
              </div>
            )
          )}

          {/* Instagram Music Sticker with customized scale, position and style */}
          {currentVibe?.songTitle && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${currentVibe.musicPos?.x ?? 50}%`,
                top: `${currentVibe.musicPos?.y ?? 20}%`,
                transform: `translate(-50%, -50%) scale(${currentVibe.musicScale || 1.0})`,
                transformOrigin: 'center center',
                background: currentVibe.musicStyle === 'card' 
                  ? 'rgba(15, 15, 24, 0.95)'
                  : currentVibe.musicStyle === 'glass'
                  ? 'rgba(99, 102, 241, 0.25)'
                  : 'rgba(0, 0, 0, 0.84)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: currentVibe.musicStyle === 'card' ? '12px' : '6px 14px 6px 8px',
                borderRadius: currentVibe.musicStyle === 'card' ? '18px' : '26px',
                border: currentVibe.musicStyle === 'glass' 
                  ? '1.5px solid rgba(168, 85, 247, 0.7)' 
                  : '1px solid rgba(245, 158, 11, 0.65)',
                display: 'flex',
                flexDirection: currentVibe.musicStyle === 'card' ? 'column' : 'row',
                alignItems: 'center',
                gap: currentVibe.musicStyle === 'card' ? '8px' : '8px',
                zIndex: 6,
                boxShadow: currentVibe.musicStyle === 'glass'
                  ? '0 8px 30px rgba(168, 85, 247, 0.45)'
                  : '0 8px 24px rgba(0,0,0,0.65)',
                maxWidth: currentVibe.musicStyle === 'card' ? '160px' : '260px',
                animation: 'pulseFadeIn 0.22s ease'
              }}
            >
              <div style={{
                position: 'relative',
                width: currentVibe.musicStyle === 'card' ? '100px' : '30px',
                height: currentVibe.musicStyle === 'card' ? '100px' : '30px',
                flexShrink: 0
              }}>
                <img
                  src={currentVibe.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentVibe.songTitle)}`}
                  alt="Track"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: currentVibe.musicStyle === 'card' ? '12px' : '50%',
                    objectFit: 'cover',
                    animation: isAudioMuted || currentVibe.musicStyle === 'card' ? 'none' : 'spin 3.5s linear infinite',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                  }}
                />
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                flex: 1,
                textAlign: currentVibe.musicStyle === 'card' ? 'center' : 'left',
                width: '100%'
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎵 {currentVibe.songTitle}
                </span>
                <span style={{ fontSize: '0.66rem', color: '#f59e0b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentVibe.artistName || 'Original Audio'}
                </span>
              </div>
              {!isAudioMuted && currentVibe.musicStyle !== 'card' && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '12px', flexShrink: 0 }}>
                  <span style={{ width: '2px', height: '100%', background: '#ec4899', borderRadius: '1px', animation: 'pulseGlow 0.4s infinite alternate' }} />
                  <span style={{ width: '2px', height: '60%', background: '#f59e0b', borderRadius: '1px', animation: 'pulseGlow 0.7s infinite alternate' }} />
                  <span style={{ width: '2px', height: '80%', background: '#6366f1', borderRadius: '1px', animation: 'pulseGlow 0.5s infinite alternate' }} />
                </div>
              )}
            </div>
          )}

          {/* Toast Msg for Sparks Tip */}
          {sparksMsg && (
            <div style={{
              position: 'absolute',
              top: '80px',
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.5)',
              animation: 'pulseModalPop 0.2s'
            }}>
              {sparksMsg}
            </div>
          )}
        </div>

        {/* Bottom Floating Action Buttons (Transparent Floating Circular Buttons, Zero Bottom Border/Bar) */}
        <div style={{
          position: 'absolute',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          left: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMine ? 'space-between' : 'flex-end',
          zIndex: 35,
          pointerEvents: isHolding ? 'none' : 'auto',
          opacity: isHolding ? 0 : 1,
          transition: 'opacity 0.22s ease'
        }}>
          {isMine ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  fetchLiveViews();
                  setShowViewersSheet(prev => !prev);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ffffff',
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '24px',
                  padding: '7px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
                }}
              >
                <Eye size={16} color="#38bdf8" />
                <span>{viewCount}</span>
              </button>

              {currentVibe.sparksEarned > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  color: '#f59e0b',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Zap size={14} fill="#f59e0b" />
                  <span>{currentVibe.sparksEarned}</span>
                </div>
              )}
            </div>
          ) : !isMine && authorFriendStatus !== 'friends' ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '8px 14px',
              width: '100%',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Lock size={15} color="#f87171" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Sync with {vibeGroup?.displayName || vibeGroup?.username || 'user'} to reply
                </span>
              </div>
              <button
                type="button"
                onClick={handleSendSyncRequest}
                disabled={authorActionLoading || authorFriendStatus === 'checking'}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                ⚡ Sync
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', justifyContent: 'flex-end' }}>
              {/* 💬 Reply Circular Button (Transparent, matching mute button style) */}
              <button
                type="button"
                onClick={() => setShowReplySheet(true)}
                title="Reply"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <MessageSquare size={18} />
              </button>

              {/* ⚡ Tip Sparks Circular Button (Matching top buttons style with warm glow) */}
              <button
                type="button"
                onClick={() => {
                  if (isMine) {
                    setSparksMsg('You cannot tip your own story');
                    setTimeout(() => setSparksMsg(''), 2500);
                    return;
                  }
                  setShowSparksTipModal(true);
                }}
                title="Tip Sparks"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.5)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <Zap size={18} fill="#fff" />
              </button>

              {/* 😊 React Circular Button (Transparent, matching mute button style) */}
              <button
                type="button"
                onClick={() => setShowUnlimitedEmojiModal(true)}
                title="React with Emoji"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <Smile size={19} />
              </button>
            </div>
          )}
        </div>

        {/* Reply Sliding Sheet (Clean & Non-intrusive) */}
        {showReplySheet && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setShowReplySheet(false); }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 110,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end'
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.98)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '16px',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                  💬 Reply to {vibeGroup?.displayName || vibeGroup?.username || 'User'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowReplySheet(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyText.trim()) {
                    handleReact('', 0, replyText.trim());
                    setReplyText('');
                    setShowReplySheet(false);
                  }
                }}
                style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}
              >
                <input
                  type="text"
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${vibeGroup?.displayName || 'User'}...`}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '24px',
                    padding: '10px 16px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  style={{
                    background: replyText.trim() ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: replyText.trim() ? 'pointer' : 'default',
                    flexShrink: 0,
                    boxShadow: replyText.trim() ? '0 4px 12px rgba(99, 102, 241, 0.5)' : 'none'
                  }}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Unlimited Emojis Reaction Sheet */}
        {showUnlimitedEmojiModal && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setShowUnlimitedEmojiModal(false); }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 110,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end'
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.98)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '16px',
                maxHeight: '62%',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  😊 React with Any Emoji
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnlimitedEmojiModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                {EMOJI_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveEmojiCategory(cat.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      background: activeEmojiCategory === cat.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255, 255, 255, 0.1)',
                      border: activeEmojiCategory === cat.id ? '1px solid #a5b4fc' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Unlimited Emojis Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px',
                  overflowY: 'auto',
                  maxHeight: '260px',
                  padding: '6px 2px'
                }}
              >
                {(EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.emojis || EMOJI_CATEGORIES[0].emojis).map((em, idx) => (
                  <button
                    key={`${em}_${idx}`}
                    type="button"
                    onClick={() => {
                      handleReact(em);
                      setShowUnlimitedEmojiModal(false);
                    }}
                    style={{
                      fontSize: '1.75rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px 0',
                      borderRadius: '12px',
                      transition: 'transform 0.12s ease'
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Viewers Sliding Sheet (Instagram / WhatsApp style) */}
        {showViewersSheet && isMine && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              top: 'auto',
              maxHeight: '65%',
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              zIndex: 100,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.8)',
              animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 800, fontSize: '0.98rem' }}>
                <Eye size={18} color="#818cf8" />
                <span>Story Viewers ({viewCount})</span>
              </div>
              <button
                onClick={() => setShowViewersSheet(false)}
                className="icon-btn-ghost"
                style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentStoryViews.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '2rem 1rem', fontSize: '0.88rem' }}>
                  <Users size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No views yet for this story.</p>
                  <p style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '4px' }}>Share your story with friends!</p>
                </div>
              ) : (
                currentStoryViews.map((viewer, idx) => {
                  let vKing = Boolean(viewer.hasKingCrown);
                  let vSilver = Boolean(viewer.hasSilverCrown);
                  let vStreak = Boolean(viewer.hasStreakCrown);

                  if (!vKing && !vSilver && !vStreak && user?.id) {
                    try {
                      const cached = getCachedAllUsers(user.id || user._id);
                      if (Array.isArray(cached)) {
                        const m = cached.find(u =>
                          (viewer.userId && (u.id === viewer.userId || u._id === viewer.userId)) ||
                          (u.username && viewer.username && String(u.username).toLowerCase() === String(viewer.username).toLowerCase())
                        );
                        if (m) {
                          vKing = Boolean(m.hasKingCrown);
                          vSilver = Boolean(m.hasSilverCrown);
                          vStreak = Boolean(m.hasStreakCrown);
                        }
                      }
                    } catch (e) {}
                  }

                  return (
                    <div
                      key={viewer.userId || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                          {vKing ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                          ) : vSilver ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                          ) : vStreak ? (
                            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                          ) : null}
                          <img
                            src={viewer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.username || viewer.displayName || 'user'}`}
                            alt={viewer.displayName}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1px solid #818cf8' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                            {viewer.displayName || viewer.username || 'User'}
                          </div>
                          {viewer.username && (
                            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>
                              @{viewer.username}
                            </div>
                          )}
                        </div>
                      </div>

                    <span style={{ fontSize: '0.72rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>
                      Viewed
                    </span>
                  </div>
                );
              })
            )}
            </div>
          </div>
        )}

        {/* Send Sparks Bottom Sheet / Dialog */}
        {showSparksTipModal && !isMine && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              animation: 'fadeIn 0.15s ease'
            }}
            onClick={() => setShowSparksTipModal(false)}
          >
            <div
              style={{
                background: 'linear-gradient(180deg, #1e1b4b 0%, #111827 100%)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                border: '1.5px solid rgba(245, 158, 11, 0.35)',
                borderBottom: 'none',
                padding: '20px',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.6), 0 0 30px rgba(245, 158, 11, 0.15)',
                animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle & Header */}
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px auto' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)'
                  }}>
                    <Zap size={18} color="#fff" fill="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#fff' }}>
                      Tip Sparks
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                      To {vibeGroup?.displayName || vibeGroup?.username || 'User'}
                    </p>
                  </div>
                </div>

                {/* User Current Balance & Wallet Link */}
                <button
                  type="button"
                  onClick={() => setShowSparksWallet(true)}
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    padding: '5px 10px',
                    borderRadius: '16px',
                    color: '#f59e0b',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title="View your Sparks Wallet"
                >
                  <Zap size={13} fill="#f59e0b" />
                  <span>{user?.pulseSparks || 50} ⚡</span>
                </button>
              </div>

              {/* Quick Amount Options */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                {[10, 25, 50, 100, 250, 500].map(amt => {
                  const isSelected = !customSparksInput && tipSparksAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setTipSparksAmount(amt);
                        setCustomSparksInput('');
                      }}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '14px',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.2))'
                          : 'rgba(255, 255, 255, 0.06)',
                        border: isSelected ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: isSelected ? '#f59e0b' : '#fff',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Zap size={14} fill={isSelected ? '#f59e0b' : 'transparent'} />
                      <span>{amt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '4px 12px'
                }}>
                  <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.9rem', marginRight: '6px' }}>⚡</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    placeholder="Enter custom Sparks amount..."
                    value={customSparksInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomSparksInput(val);
                      if (val && !isNaN(val)) {
                        setTipSparksAmount(Math.max(1, parseInt(val, 10)));
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      outline: 'none',
                      padding: '8px 0'
                    }}
                  />
                  {customSparksInput && (
                    <button
                      type="button"
                      onClick={() => setCustomSparksInput('')}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Validation / Action Button */}
              {(() => {
                const currentBalance = typeof user?.pulseSparks === 'number' ? user.pulseSparks : 50;
                const activeAmount = customSparksInput ? Math.max(1, parseInt(customSparksInput, 10) || 1) : tipSparksAmount;
                const hasEnough = currentBalance >= activeAmount;

                if (!hasEnough) {
                  const needed = activeAmount - currentBalance;
                  return (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '14px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        Need {needed} more Sparks
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSparksTipModal(false);
                          setShowGetSparksModal(true);
                        }}
                        style={{
                          padding: '12px 18px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Zap size={16} fill="#fff" />
                        <span>Get Sparks</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSparksTipModal(false);
                      handleReact('', activeAmount, '');
                    }}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 18px rgba(245, 158, 11, 0.45)'
                    }}
                  >
                    <Zap size={18} fill="#fff" />
                    <span>Send ⚡ {activeAmount} Sparks</span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* Sparks Wallet Full History Modal */}
        {showSparksWallet && (
          <SparksWalletModal onClose={() => setShowSparksWallet(false)} />
        )}

        {/* Get / Top-Up Sparks Modal */}
        {showGetSparksModal && (
          <PulseProModal initialTab="sparks" onClose={() => setShowGetSparksModal(false)} />
        )}
      </div>
    </div>
  );
}
