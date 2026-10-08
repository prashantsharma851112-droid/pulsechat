import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Music, Trash2, Zap, Eye, Send, Users, Volume2, VolumeX, Disc, Lock, MessageSquare, Smile, Heart, Search, Clock, BarChart3, ChevronUp, MessageCircle, Sparkles } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound, registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
import { updateRecentChatSnippet, getCachedAllUsers } from '../../utils/offlineStorage';
import { useBackHandler } from '../../utils/backNavigation';

import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';
import SparksWalletModal from '../chat/SparksWalletModal';
import PulseProModal from '../chat/PulseProModal';
import { EMOJI_CATEGORIES } from '../chat/EmojiPicker';
import InstagramMusicSticker from './InstagramMusicSticker';


export default function VibeViewerModal({ vibeGroup, allGroups, onSwitchVibeGroup, onClose, onRefresh, initialVibeId }) {
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

  const [viewerMusicStyle, setViewerMusicStyle] = useState(null);


  // Next story info (within same user or next user group)
  const nextStoryInfo = React.useMemo(() => {
    if (currentIndex < vibes.length - 1) {
      return {
        vibe: vibes[currentIndex + 1],
        group: vibeGroup,
        isNewGroup: false,
        vibesList: vibes,
        index: currentIndex + 1
      };
    }
    if (allGroups && Array.isArray(allGroups) && allGroups.length > 0) {
      const currentGroupIdx = allGroups.findIndex(g => g?.userId === vibeGroup?.userId || g?.username === vibeGroup?.username);
      if (currentGroupIdx !== -1 && currentGroupIdx < allGroups.length - 1) {
        const nextGroup = allGroups[currentGroupIdx + 1];
        if (nextGroup && Array.isArray(nextGroup.vibes) && nextGroup.vibes.length > 0) {
          return {
            vibe: nextGroup.vibes[0],
            group: nextGroup,
            isNewGroup: true,
            vibesList: nextGroup.vibes,
            index: 0
          };
        }
      }
    }
    return null;
  }, [currentIndex, vibes, vibeGroup, allGroups]);

  // Prev story info (within same user or prev user group)
  const prevStoryInfo = React.useMemo(() => {
    if (currentIndex > 0) {
      return {
        vibe: vibes[currentIndex - 1],
        group: vibeGroup,
        isNewGroup: false,
        vibesList: vibes,
        index: currentIndex - 1
      };
    }
    if (allGroups && Array.isArray(allGroups) && allGroups.length > 0) {
      const currentGroupIdx = allGroups.findIndex(g => g?.userId === vibeGroup?.userId || g?.username === vibeGroup?.username);
      if (currentGroupIdx > 0) {
        const prevGroup = allGroups[currentGroupIdx - 1];
        if (prevGroup && Array.isArray(prevGroup.vibes) && prevGroup.vibes.length > 0) {
          return {
            vibe: prevGroup.vibes[prevGroup.vibes.length - 1],
            group: prevGroup,
            isNewGroup: true,
            vibesList: prevGroup.vibes,
            index: prevGroup.vibes.length - 1
          };
        }
      }
    }
    return null;
  }, [currentIndex, vibes, vibeGroup, allGroups]);

  // 3D Cube Transition State
  const [cubeOffset, setCubeOffset] = useState(0); // px dragged horizontally
  const [isCubeDragging, setIsCubeDragging] = useState(false);
  const [cubeAnimating, setCubeAnimating] = useState(null); // 'next' | 'prev' | 'reset' | null
  const [cubeAnimOffset, setCubeAnimOffset] = useState(0);

  const cubeStageRef = useRef(null);
  const isCubeSwipingRef = useRef(false);
  const cubeDragOffsetRef = useRef(0);

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

  // Per-story live likes dictionary keyed by vibe ID (Instagram Style)
  const [likesByVibeId, setLikesByVibeId] = useState(() => {
    const initial = {};
    (vibeGroup?.vibes || []).forEach(v => {
      if (v && v.id) {
        initial[v.id] = Array.isArray(v.likes) ? v.likes : [];
      }
    });
    return initial;
  });

  // Per-story live replies dictionary keyed by vibe ID
  const [repliesByVibeId, setRepliesByVibeId] = useState(() => {
    const initial = {};
    (vibeGroup?.vibes || []).forEach(v => {
      if (v && v.id) {
        initial[v.id] = Array.isArray(v.replies) ? v.replies : [];
      }
    });
    return initial;
  });

  // Instagram Story Viewers & Insights Sheet Tab & Search State
  const [activeViewersTab, setActiveViewersTab] = useState('viewers'); // 'viewers' | 'likes' | 'replies' | 'insights'
  const [viewersSearchQuery, setViewersSearchQuery] = useState('');
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  const currentVibe = vibes[currentIndex] || vibes[0];
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const singleTapTimerRef = useRef(null);
  const isTouchDeviceRef = useRef(false);
  const lastTouchTimeRef = useRef(0);

  // Current story's specific viewers, likes & replies list & counts
  const currentStoryViews = viewsByVibeId[currentVibe?.id] ?? (Array.isArray(currentVibe?.views) ? currentVibe.views : []);
  const viewCount = currentStoryViews.length;
  const currentStoryLikes = likesByVibeId[currentVibe?.id] ?? (Array.isArray(currentVibe?.likes) ? currentVibe.likes : []);
  const currentStoryReplies = repliesByVibeId[currentVibe?.id] ?? (Array.isArray(currentVibe?.replies) ? currentVibe.replies : []);

  const myUserId = user?.id || user?._id;
  const isCurrentStoryLiked = currentStoryLikes.some(
    l => (l.userId && (l.userId === myUserId || l.userId === user?.id || l.userId === user?._id)) ||
         (user?.username && l.username && String(l.username).toLowerCase() === String(user.username).toLowerCase())
  );

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

  // Real-time socket listener for live view & like updates for all vibes
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
    const handleLikeUpdate = (data) => {
      if (data && data.vibeId) {
        setLikesByVibeId(prev => ({
          ...prev,
          [data.vibeId]: Array.isArray(data.likes) ? data.likes : []
        }));
      }
    };
    socket.on('vibe_view_updated', handleViewUpdate);
    socket.on('vibe_like_updated', handleLikeUpdate);
    return () => {
      socket.off('vibe_view_updated', handleViewUpdate);
      socket.off('vibe_like_updated', handleLikeUpdate);
    };
  }, [socket]);

  // Mark current story as viewed in LocalStorage and send view ping to Backend
  useEffect(() => {
    if (currentVibe && currentVibe.id) {
      const vId = currentVibe.id;

      // Always fetch fresh live views, likes and replies specifically for THIS vibe ID
      if (token) {
        fetch(`${BACKEND_URL}/api/vibes/views/${vId}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.success) {
              if (Array.isArray(data.views)) {
                setViewsByVibeId(prev => ({ ...prev, [vId]: data.views }));
              }
              if (Array.isArray(data.likes)) {
                setLikesByVibeId(prev => ({ ...prev, [vId]: data.likes }));
              }
              if (Array.isArray(data.replies)) {
                setRepliesByVibeId(prev => ({ ...prev, [vId]: data.replies }));
              }
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

  // Fetch live views, likes and replies for owner when modal opens or viewers button tapped
  const fetchLiveViews = async () => {
    if (token && currentVibe?.id) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/views/${currentVibe.id}?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.views)) {
            setViewsByVibeId(prev => ({ ...prev, [currentVibe.id]: data.views }));
          }
          if (Array.isArray(data.likes)) {
            setLikesByVibeId(prev => ({ ...prev, [currentVibe.id]: data.likes }));
          }
          if (Array.isArray(data.replies)) {
            setRepliesByVibeId(prev => ({ ...prev, [currentVibe.id]: data.replies }));
          }
        }
      } catch (e) {}
    }
  };

  // Format relative time (e.g., "Just now", "2m ago", "1h ago")
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Instagram-style Story Like / Unlike Toggle
  const handleToggleLike = async (forceLike = false) => {
    if (!currentVibe || !token) return;
    const vId = currentVibe.id;
    const currentLikes = likesByVibeId[vId] ?? (Array.isArray(currentVibe.likes) ? currentVibe.likes : []);
    const myId = user?.id || user?._id;
    const isCurrentlyLiked = currentLikes.some(
      l => (l.userId && (l.userId === myId || l.userId === user?.id || l.userId === user?._id)) ||
           (user?.username && l.username && String(l.username).toLowerCase() === String(user.username).toLowerCase())
    );

    if (forceLike && isCurrentlyLiked) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 850);
      return;
    }

    const nextLiked = !isCurrentlyLiked;
    // Optimistic UI update
    setLikesByVibeId(prev => {
      const list = prev[vId] ? [...prev[vId]] : [...(currentVibe.likes || [])];
      if (nextLiked) {
        list.push({
          userId: myId,
          displayName: user?.displayName || user?.name || user?.username || 'You',
          username: user?.username || '',
          avatar: user?.avatar || '',
          likedAt: new Date().toISOString()
        });
      } else {
        const idx = list.findIndex(
          l => (l.userId && (l.userId === myId || l.userId === user?.id || l.userId === user?._id)) ||
               (user?.username && l.username && String(l.username).toLowerCase() === String(user.username).toLowerCase())
        );
        if (idx > -1) list.splice(idx, 1);
      }
      return { ...prev, [vId]: list };
    });

    if (nextLiked) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 850);
      try { playSound('pop'); } catch (e) {}
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 35, 25]);
      }
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/vibes/like/${vId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.likes)) {
        setLikesByVibeId(prev => ({
          ...prev,
          [vId]: data.likes
        }));
      }
    } catch (err) {
      console.error('Failed to toggle like on vibe:', err);
    }
  };

  // Direct Chat Navigation from Viewers Sheet
  const handleOpenViewerChat = (targetViewer) => {
    if (!targetViewer) return;
    const targetUserId = targetViewer.userId || targetViewer.id;
    if (!targetUserId) return;
    const chatUser = {
      id: targetUserId,
      displayName: targetViewer.displayName || targetViewer.username || 'User',
      username: targetViewer.username || '',
      avatar: targetViewer.avatar || '',
      isGroup: false
    };
    window.dispatchEvent(new CustomEvent('pulsechat_open_chat', { detail: { user: chatUser } }));
    handleCloseModal();
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
    if (isPaused || isHolding || isAnySubmodalOpen || cubeAnimating || isCubeDragging) {
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
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, vibes.length, onClose, isPaused, isHolding, showViewersSheet, currentVibe?.id, currentVibe?.storyDuration, user?.isPro, showingSponsoredAd, isCurrentStoryVideo, cubeAnimating, isCubeDragging]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Instagram 3D Cube Transition Controller
  const triggerCubeTransition = (direction) => {
    if (cubeAnimating) return;
    const stageW = cubeStageRef.current ? cubeStageRef.current.offsetWidth : (typeof window !== 'undefined' ? Math.min(440, window.innerWidth) : 380);

    if (direction === 'next') {
      if (!nextStoryInfo) {
        if (!user?.isPro && !showingSponsoredAd) {
          setShowingSponsoredAd(true);
        } else {
          handleCloseModal();
        }
        return;
      }
      setCubeOffset(-1);
      setCubeAnimating('next');
      setCubeAnimOffset(-stageW);
      setTimeout(() => {
        if (nextStoryInfo.isNewGroup && onSwitchVibeGroup) {
          onSwitchVibeGroup(nextStoryInfo.group);
        }
        setCurrentIndex(nextStoryInfo.index);
        setProgress(0);
        setCubeOffset(0);
        setCubeAnimOffset(0);
        setCubeAnimating(null);
      }, 280);
    } else if (direction === 'prev') {
      if (!prevStoryInfo) return;
      setCubeOffset(1);
      setCubeAnimating('prev');
      setCubeAnimOffset(stageW);
      setTimeout(() => {
        if (prevStoryInfo.isNewGroup && onSwitchVibeGroup) {
          onSwitchVibeGroup(prevStoryInfo.group);
        }
        setCurrentIndex(prevStoryInfo.index);
        setProgress(0);
        setCubeOffset(0);
        setCubeAnimOffset(0);
        setCubeAnimating(null);
      }, 280);
    }
  };

  const handleNext = () => {
    triggerCubeTransition('next');
  };

  const handlePrev = () => {
    triggerCubeTransition('prev');
  };

  // Instagram-style Hold to Pause, 3D Cube Swipe & Tap / Double-Tap Navigation
  const handleStagePointerDown = (e) => {
    if (isAnySubmodalOpen || cubeAnimating) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.interactive-action') || e.target.closest('form')) return;

    const isTouch = Boolean(e.type && e.type.startsWith('touch'));
    if (isTouch) {
      isTouchDeviceRef.current = true;
      lastTouchTimeRef.current = Date.now();
    } else if (isTouchDeviceRef.current && Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }

    touchStartTimeRef.current = Date.now();
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    touchStartYRef.current = clientY;
    touchStartXRef.current = clientX;
    isCubeSwipingRef.current = false;
    cubeDragOffsetRef.current = 0;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    // Instagram Hold to Pause: only pause after 320ms stationary hold
    holdTimerRef.current = setTimeout(() => {
      if (!isCubeSwipingRef.current) {
        setIsHolding(true);
        setIsPaused(true);
        if (videoPlayerRef.current) {
          try { videoPlayerRef.current.pause(); } catch (err) {}
        }
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch (err) {}
        }
      }
    }, 320);
  };

  const handleStagePointerMove = (e) => {
    if (isAnySubmodalOpen || cubeAnimating) return;
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : touchStartYRef.current);
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : touchStartXRef.current);
    const deltaY = clientY - touchStartYRef.current;
    const deltaX = clientX - touchStartXRef.current;

    // If moved more than 8px, cancel stationary hold
    if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }

    // Instagram Horizontal 3D Cube Drag Tracking
    if (Math.abs(deltaX) > 8 && Math.abs(deltaY) < 55) {
      isCubeSwipingRef.current = true;
      setIsCubeDragging(true);
      cubeDragOffsetRef.current = deltaX;
      setCubeOffset(deltaX);
    }
  };

  const handleStagePointerUp = (e) => {
    const isTouch = Boolean(e.type && e.type.startsWith('touch'));
    if (!isTouch && isTouchDeviceRef.current && Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const wasHolding = isHolding;
    if (isHolding) {
      setIsHolding(false);
      setIsPaused(false);
      if (videoPlayerRef.current) {
        try { videoPlayerRef.current.play().catch(() => {}); } catch (err) {}
      }
      if (audioRef.current && !isAudioMuted) {
        try { audioRef.current.play().catch(() => {}); } catch (err) {}
      }
    }

    const clientY = e.clientY ?? (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartYRef.current);
    const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : touchStartXRef.current);
    const deltaY = clientY - touchStartYRef.current;
    const deltaX = clientX - touchStartXRef.current;
    const pressDuration = Date.now() - touchStartTimeRef.current;

    const stageW = cubeStageRef.current ? cubeStageRef.current.offsetWidth : (typeof window !== 'undefined' ? Math.min(440, window.innerWidth) : 380);

    // 1. Instagram Horizontal 3D Cube Swipe Release
    if (isCubeSwipingRef.current) {
      isCubeSwipingRef.current = false;
      setIsCubeDragging(false);
      const finalDrag = cubeDragOffsetRef.current || deltaX;

      if (finalDrag < -40 && nextStoryInfo) {
        // Swiped Left -> Complete 3D turn to Next Story
        setCubeAnimating('next');
        setCubeAnimOffset(-stageW);
        setTimeout(() => {
          if (nextStoryInfo.isNewGroup && onSwitchVibeGroup) {
            onSwitchVibeGroup(nextStoryInfo.group);
          }
          setCurrentIndex(nextStoryInfo.index);
          setProgress(0);
          setCubeOffset(0);
          setCubeAnimOffset(0);
          setCubeAnimating(null);
        }, 280);
        return;
      } else if (finalDrag > 40 && prevStoryInfo) {
        // Swiped Right -> Complete 3D turn to Previous Story
        setCubeAnimating('prev');
        setCubeAnimOffset(stageW);
        setTimeout(() => {
          if (prevStoryInfo.isNewGroup && onSwitchVibeGroup) {
            onSwitchVibeGroup(prevStoryInfo.group);
          }
          setCurrentIndex(prevStoryInfo.index);
          setProgress(0);
          setCubeOffset(0);
          setCubeAnimOffset(0);
          setCubeAnimating(null);
        }, 280);
        return;
      } else {
        // Did not reach swipe threshold -> Snap back to 0
        setCubeAnimating('reset');
        setCubeAnimOffset(0);
        setTimeout(() => {
          setCubeOffset(0);
          setCubeAnimOffset(0);
          setCubeAnimating(null);
        }, 220);
        return;
      }
    }

    // 2. Instagram Swipe Up Gesture: opens activity/viewers sheet
    if (deltaY < -32 && Math.abs(deltaX) < 80) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (isMine) {
        fetchLiveViews();
        setShowViewersSheet(true);
        return;
      } else {
        setShowReplySheet(true);
        return;
      }
    }

    // 3. Instagram Swipe Down Gesture: closes sheet if open, or closes story
    if (deltaY > 50 && Math.abs(deltaX) < 80) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (showViewersSheet) {
        setShowViewersSheet(false);
        return;
      } else if (showReplySheet) {
        setShowReplySheet(false);
        return;
      } else {
        handleCloseModal();
        return;
      }
    }

    // If it was a genuine stationary hold (> 320ms), do not trigger tap navigation or like
    if (wasHolding || pressDuration >= 320) {
      return;
    }

    // 4. Instagram Tap & Double-Tap Navigation
    if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('.interactive-action') && !e.target.closest('form')) {
      const now = Date.now();

      // Check if a single-tap timer is already pending (meaning this is the SECOND tap!)
      if (singleTapTimerRef.current || (now - lastTapTimeRef.current < 300)) {
        // DOUBLE TAP DETECTED!
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapTimeRef.current = 0;

        // Trigger Like (forces like state on) & Heart Burst
        handleToggleLike(true);
        setShowHeartBurst(true);
        setTimeout(() => setShowHeartBurst(false), 900);
        return;
      }

      // First Tap: Queue single-tap navigation with 280ms window for double tap
      lastTapTimeRef.current = now;
      const stageElement = cubeStageRef.current || e.currentTarget;
      const rect = stageElement.getBoundingClientRect();
      const relativeX = clientX - rect.left;

      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        if (relativeX < rect.width * 0.35) {
          handlePrev();
        } else {
          handleNext();
        }
      }, 280);
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

  const handleDeleteVibe = handleDelete;

  const effectiveOffset = cubeAnimating ? cubeAnimOffset : cubeOffset;
  const isTransitioning = effectiveOffset !== 0 || cubeAnimating !== null;
  const stageW = typeof window !== 'undefined' ? Math.min(440, window.innerWidth) : 380;

  // Rubber-band resistance at boundaries
  let clampedOffset = effectiveOffset;
  if (effectiveOffset < 0 && !nextStoryInfo) {
    clampedOffset = effectiveOffset * 0.22;
  } else if (effectiveOffset > 0 && !prevStoryInfo) {
    clampedOffset = effectiveOffset * 0.22;
  }

  const progressRatio = Math.min(1, Math.abs(clampedOffset) / stageW);
  const angle = progressRatio * 90;
  const isSlidingNext = clampedOffset < 0;
  const adjacentInfo = isSlidingNext ? nextStoryInfo : prevStoryInfo;

  const face1Style = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0px' : '24px',
    overflow: 'hidden',
    background: currentVibe?.bgGradient || 'linear-gradient(135deg, #6366f1, #a855f7)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
    border: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'none' : '1px solid rgba(255,255,255,0.15)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
    zIndex: 2,
    transformOrigin: isSlidingNext ? '100% 50%' : '0% 50%',
    transform: isTransitioning
      ? `perspective(1200px) rotateY(${isSlidingNext ? -angle : angle}deg)`
      : 'none',
    filter: isTransitioning
      ? `brightness(${Math.max(0.45, 1 - progressRatio * 0.45)})`
      : 'none',
    transition: isCubeDragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), filter 0.28s ease',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none'
  };

  const face2Style = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0px' : '24px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: adjacentInfo?.vibe?.bgGradient || 'linear-gradient(135deg, #6366f1, #a855f7)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
    border: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'none' : '1px solid rgba(255,255,255,0.15)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
    zIndex: 1,
    pointerEvents: 'none',
    transformOrigin: isSlidingNext ? '0% 50%' : '100% 50%',
    transform: `perspective(1200px) translateX(${isSlidingNext ? stageW * (1 - progressRatio) : -stageW * (1 - progressRatio)}px) rotateY(${isSlidingNext ? (90 - angle) : (-90 + angle)}deg)`,
    filter: `brightness(${Math.min(1, 0.55 + progressRatio * 0.45)})`,
    transition: isCubeDragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), filter 0.28s ease'
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
      {/* 3D Cube Perspective Viewport */}
      <div
        ref={cubeStageRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100vw' : '440px',
          height: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100dvh' : 'min(880px, 98dvh)',
          borderRadius: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0px' : '24px',
          perspective: '1200px',
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d',
          overflow: 'hidden'
        }}
      >
        {/* Face 1: Current Active Story Card */}
        <div
          onMouseDown={handleStagePointerDown}
          onMouseMove={handleStagePointerMove}
          onMouseUp={handleStagePointerUp}
          onTouchStart={handleStagePointerDown}
          onTouchMove={handleStagePointerMove}
          onTouchEnd={handleStagePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={face1Style}
        >
        {/* CSS Keyframe for Instagram Floating Heart Burst */}
        <style>{`
          @keyframes instaHeartBurst {
            0% { transform: translate(-50%, -50%) scale(0) rotate(-15deg); opacity: 0; }
            35% { transform: translate(-50%, -50%) scale(1.3) rotate(0deg); opacity: 1; }
            65% { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(0.85) translateY(-45px); opacity: 0; }
          }
        `}</style>

        {/* Instagram Double-Tap Floating Heart Burst Overlay */}
        {showHeartBurst && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 90,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'instaHeartBurst 0.82s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
            }}
          >
            <Heart size={105} fill="#f43f5e" color="#ffffff" style={{ filter: 'drop-shadow(0 10px 30px rgba(244, 63, 94, 0.9))' }} />
          </div>
        )}

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
                <Music size={11} /> {currentVibe.songTitle ? `🎵 ${currentVibe.songTitle}` : currentVibe.soundtrack !== 'none' ? currentVibe.soundtrack : 'Vibe Story'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Media or Text Content Body */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: currentVibe.imageFit === 'padded' ? '50px 30px' : '0px',
            userSelect: 'none',
            WebkitUserSelect: 'none'
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
              onClick={(e) => {
                e.stopPropagation();
                setViewerMusicStyle(prev => {
                  const styles = ['card', 'pill', 'vinyl', 'square', 'banner'];
                  const cur = prev || currentVibe.musicStyle || 'card';
                  const nextIdx = (styles.indexOf(cur) + 1) % styles.length;
                  return styles[nextIdx];
                });
                try { playSound('pop'); } catch (_) {}
              }}
              style={{
                position: 'absolute',
                left: `${currentVibe.musicPos?.x ?? 50}%`,
                top: `${currentVibe.musicPos?.y ?? 20}%`,
                transform: `translate(-50%, -50%) scale(${currentVibe.musicScale || 1.0})`,
                transformOrigin: 'center center',
                zIndex: 6,
                cursor: 'pointer'
              }}
            >
              <InstagramMusicSticker
                songTitle={currentVibe.songTitle}
                artistName={currentVibe.artistName}
                albumArt={currentVibe.albumArt}
                styleType={viewerMusicStyle || currentVibe.musicStyle || 'card'}
                isPlaying={!isAudioMuted}
                isEditable={false}
              />
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', paddingLeft: '4px' }}>
                  <ChevronUp size={12} /> Swipe up for activity
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fetchLiveViews();
                    setShowViewersSheet(true);
                  }}
                  className="interactive-action"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#ffffff',
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    borderRadius: '24px',
                    padding: '7px 16px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={16} color="#38bdf8" />
                    <span>{viewCount}</span>
                  </div>
                  {currentStoryLikes.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '8px', color: '#f43f5e' }}>
                      <Heart size={14} fill="#f43f5e" color="#f43f5e" />
                      <span>{currentStoryLikes.length}</span>
                    </div>
                  )}
                  {currentStoryReplies.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '8px', color: '#a855f7' }}>
                      <MessageCircle size={14} />
                      <span>{currentStoryReplies.length}</span>
                    </div>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Delete Story"
                  className="interactive-action"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
              {/* 💬 Reply Circular Button */}
              <button
                type="button"
                onClick={() => setShowReplySheet(true)}
                title="Reply"
                className="interactive-action"
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

              {/* ⚡ Tip Sparks Circular Button */}
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
                className="interactive-action"
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

              {/* 😊 React Circular Button */}
              <button
                type="button"
                onClick={() => setShowUnlimitedEmojiModal(true)}
                title="React with Emoji"
                className="interactive-action"
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

              {/* ❤️ Instagram Story Like Button */}
              <button
                type="button"
                onClick={() => handleToggleLike()}
                title={isCurrentStoryLiked ? 'Unlike' : 'Like'}
                className="interactive-action"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: isCurrentStoryLiked
                    ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
                    : 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: isCurrentStoryLiked ? '1px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isCurrentStoryLiked ? '0 0 18px rgba(244, 63, 94, 0.65)' : '0 4px 16px rgba(0, 0, 0, 0.35)',
                  transform: isCurrentStoryLiked ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                <Heart size={19} fill={isCurrentStoryLiked ? '#ffffff' : 'none'} color="#ffffff" />
              </button>
            </div>
          )}
        </div>
        </div>

        {/* Face 2: Adjacent Story Cube Face */}
        {isTransitioning && adjacentInfo && (
          <div style={face2Style}>
            {/* Live Canvas Background if selected */}
            {adjacentInfo.vibe?.animatedBg && adjacentInfo.vibe?.animatedBg !== 'none' && (
              <ChatLiveWallpaper wallpaperId={adjacentInfo.vibe.animatedBg} />
            )}

            {/* Top Progress Bars */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                display: 'flex',
                gap: '4px',
                zIndex: 10
              }}
            >
              {(adjacentInfo.vibesList || []).map((v, i) => (
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
                      width: i < adjacentInfo.index ? '100%' : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Top Header */}
            <div
              style={{
                position: 'absolute',
                top: 24,
                left: 14,
                right: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10,
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={adjacentInfo.group?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${adjacentInfo.group?.username || 'user'}`}
                  alt=""
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fff' }}
                />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {adjacentInfo.group?.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
                    <Music size={11} /> {adjacentInfo.vibe?.songTitle ? `🎵 ${adjacentInfo.vibe.songTitle}` : 'Vibe Story'}
                  </div>
                </div>
              </div>
            </div>

            {/* Media / Content Preview */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {adjacentInfo.vibe?.mediaUrl ? (
                adjacentInfo.vibe?.mediaType === 'video' || adjacentInfo.vibe?.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video
                    src={adjacentInfo.vibe.mediaUrl}
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: adjacentInfo.vibe.imageFit || 'cover'
                    }}
                  />
                ) : (
                  <img
                    src={adjacentInfo.vibe.mediaUrl}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: adjacentInfo.vibe.imageFit || 'cover'
                    }}
                  />
                )
              ) : null}

              {/* Text Caption Preview */}
              {adjacentInfo.vibe?.caption && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${adjacentInfo.vibe.textPos?.x ?? 50}%`,
                    top: `${adjacentInfo.vibe.textPos?.y ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 5,
                    width: '88%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      color: adjacentInfo.vibe.textColor || '#ffffff',
                      fontSize: `${(adjacentInfo.vibe.textSize || 1.3) * 1.15}rem`,
                      fontWeight: 800,
                      textAlign: adjacentInfo.vibe.textAlign || 'center',
                      lineHeight: 1.4,
                      textShadow: '0 2px 10px rgba(0,0,0,0.85)'
                    }}
                  >
                    {adjacentInfo.vibe.caption}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar Preview */}
            <div
              style={{
                position: 'absolute',
                bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
                left: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                zIndex: 10
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <MessageSquare size={18} />
              </div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Heart size={19} color="#ffffff" />
              </div>
            </div>
          </div>
        )}

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

        {/* Instagram Story Viewers & Insights Bottom Sheet */}
        {showViewersSheet && isMine && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowViewersSheet(false);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              top: 'auto',
              maxHeight: '78%',
              background: 'rgba(15, 23, 42, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              borderTop: '1px solid rgba(255, 255, 255, 0.22)',
              zIndex: 100,
              padding: '12px 16px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -15px 45px rgba(0,0,0,0.85)',
              animation: 'modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Top Drag Handle Pill */}
            <div
              style={{
                width: '42px',
                height: '4px',
                borderRadius: '3px',
                background: 'rgba(255, 255, 255, 0.35)',
                margin: '0 auto 10px auto',
                cursor: 'pointer'
              }}
              onClick={() => setShowViewersSheet(false)}
            />

            {/* Header: Story Thumbnail Preview + Title + Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: currentVibe.bgGradient || '#312e81',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {currentVibe.mediaUrl ? (
                    currentVibe.mediaType === 'video' ? (
                      <video src={currentVibe.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={currentVibe.mediaUrl} alt="Story" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )
                  ) : (
                    <span style={{ fontSize: '1rem' }}>✨</span>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#ffffff' }}>
                    Story Activity
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {formatTimeAgo(currentVibe.createdAt)} • {viewCount} views
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Delete Story"
                  className="icon-btn-ghost"
                  style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '50%', padding: '7px', border: 'none', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewersSheet(false)}
                  className="icon-btn-ghost"
                  style={{ color: '#ffffff', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '50%', padding: '7px', border: 'none', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Instagram-Style Navigation Tabs Bar (Clean Icons Only) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <button
                type="button"
                onClick={() => setActiveViewersTab('viewers')}
                title={`Viewers (${viewCount})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeViewersTab === 'viewers' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                  border: activeViewersTab === 'viewers' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeViewersTab === 'viewers' ? '#38bdf8' : 'rgba(255, 255, 255, 0.75)',
                  padding: '9px 8px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Eye size={18} />
                {viewCount > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{viewCount}</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveViewersTab('likes')}
                title={`Likes (${currentStoryLikes.length})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeViewersTab === 'likes' ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                  border: activeViewersTab === 'likes' ? '1.5px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeViewersTab === 'likes' ? '#f43f5e' : 'rgba(255, 255, 255, 0.75)',
                  padding: '9px 8px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Heart size={18} fill={activeViewersTab === 'likes' ? '#f43f5e' : 'none'} />
                {currentStoryLikes.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{currentStoryLikes.length}</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveViewersTab('replies')}
                title={`Replies (${currentStoryReplies.length})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeViewersTab === 'replies' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                  border: activeViewersTab === 'replies' ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeViewersTab === 'replies' ? '#a855f7' : 'rgba(255, 255, 255, 0.75)',
                  padding: '9px 8px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <MessageSquare size={18} />
                {currentStoryReplies.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{currentStoryReplies.length}</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveViewersTab('insights')}
                title="Insights"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeViewersTab === 'insights' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                  border: activeViewersTab === 'insights' ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeViewersTab === 'insights' ? '#f59e0b' : 'rgba(255, 255, 255, 0.75)',
                  padding: '9px 8px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <BarChart3 size={18} />
              </button>
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
              {activeViewersTab === 'viewers' && (
                <>
                  {/* Search Bar for Viewers */}
                  {currentStoryViews.length > 3 && (
                    <div style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '8px 12px',
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <Search size={15} color="#94a3b8" />
                      <input
                        type="text"
                        value={viewersSearchQuery}
                        onChange={(e) => setViewersSearchQuery(e.target.value)}
                        placeholder="Search viewers..."
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#fff',
                          fontSize: '0.82rem',
                          width: '100%'
                        }}
                      />
                      {viewersSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setViewersSearchQuery('')}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {currentStoryViews.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '2.5rem 1rem', fontSize: '0.88rem' }}>
                      <Users size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#f8fafc' }}>No views yet</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>Friends who view your story will appear here with exact time and likes!</p>
                    </div>
                  ) : (
                    (() => {
                      // Filter by search query
                      const filtered = currentStoryViews.filter(v => {
                        if (!viewersSearchQuery.trim()) return true;
                        const q = viewersSearchQuery.toLowerCase();
                        return (
                          (v.displayName && v.displayName.toLowerCase().includes(q)) ||
                          (v.username && v.username.toLowerCase().includes(q))
                        );
                      });

                      // Sort: Users who liked the story come first, then sorted by viewedAt newest
                      const sorted = [...filtered].sort((a, b) => {
                        const aLiked = currentStoryLikes.some(l => l.userId === a.userId || (l.username && l.username === a.username));
                        const bLiked = currentStoryLikes.some(l => l.userId === b.userId || (l.username && l.username === b.username));
                        if (aLiked && !bLiked) return -1;
                        if (!aLiked && bLiked) return 1;
                        return new Date(b.viewedAt || 0) - new Date(a.viewedAt || 0);
                      });

                      if (sorted.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem 1rem', fontSize: '0.84rem' }}>
                            No viewers matching "{viewersSearchQuery}"
                          </div>
                        );
                      }

                      return sorted.map((viewer, idx) => {
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

                        const hasLikedStory = currentStoryLikes.some(
                          l => (l.userId && l.userId === viewer.userId) ||
                               (viewer.username && l.username && String(l.username).toLowerCase() === String(viewer.username).toLowerCase())
                        );

                        const userReaction = (currentVibe.reactions || []).find(r => r.userId === viewer.userId);

                        return (
                          <div
                            key={viewer.userId || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '14px',
                              background: hasLikedStory ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                              border: hasLikedStory ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0 }}>
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
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: hasLikedStory ? '2px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.2)'
                                  }}
                                />
                                {hasLikedStory && (
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '-2px',
                                    background: '#f43f5e',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1.5px solid #0f172a'
                                  }}>
                                    <Heart size={9} fill="#fff" color="#fff" />
                                  </div>
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {viewer.displayName || viewer.username || 'User'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                                  {viewer.username && <span>@{viewer.username}</span>}
                                  <span>•</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Clock size={11} />
                                    {formatTimeAgo(viewer.viewedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right side indicators & action button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {userReaction?.emoji && (
                                <span style={{ fontSize: '1.15rem' }} title={`Reacted with ${userReaction.emoji}`}>
                                  {userReaction.emoji}
                                </span>
                              )}

                              {hasLikedStory && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(244, 63, 94, 0.15)',
                                  border: '1px solid rgba(244, 63, 94, 0.35)',
                                  borderRadius: '14px',
                                  padding: '3px 8px',
                                  color: '#f43f5e',
                                  fontSize: '0.74rem',
                                  fontWeight: 800
                                }}>
                                  <Heart size={12} fill="#f43f5e" />
                                  <span>Liked</span>
                                </div>
                              )}

                              {viewer.userId && viewer.userId !== user?.id && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewerChat(viewer)}
                                  title={`Message ${viewer.displayName || 'user'}`}
                                  className="interactive-action"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Send size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </>
              )}

              {/* LIKES TAB */}
              {activeViewersTab === 'likes' && (
                <>
                  {currentStoryLikes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '2.5rem 1rem', fontSize: '0.88rem' }}>
                      <Heart size={36} color="#f43f5e" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#f8fafc' }}>No likes yet</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>Friends who press the heart ❤️ on your story will appear here!</p>
                    </div>
                  ) : (
                    currentStoryLikes.map((likeUser, idx) => (
                      <div
                        key={likeUser.userId || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '14px',
                          background: 'rgba(244, 63, 94, 0.08)',
                          border: '1px solid rgba(244, 63, 94, 0.25)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={likeUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${likeUser.username || likeUser.displayName || 'user'}`}
                            alt={likeUser.displayName}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f43f5e' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                              {likeUser.displayName || likeUser.username || 'User'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#f43f5e' }}>
                              <Heart size={11} fill="#f43f5e" />
                              <span>Liked {formatTimeAgo(likeUser.likedAt)}</span>
                            </div>
                          </div>
                        </div>

                        {likeUser.userId && likeUser.userId !== user?.id && (
                          <button
                            type="button"
                            onClick={() => handleOpenViewerChat(likeUser)}
                            title="Reply in chat"
                            className="interactive-action"
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}

              {/* REPLIES & COMMENTS TAB */}
              {activeViewersTab === 'replies' && (
                <>
                  {currentStoryReplies.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '2.5rem 1rem', fontSize: '0.88rem' }}>
                      <MessageSquare size={36} color="#a855f7" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#f8fafc' }}>No replies yet</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>When friends reply to your story, their comments will appear here and in your direct chat!</p>
                    </div>
                  ) : (
                    currentStoryReplies.map((reply, idx) => (
                      <div
                        key={reply.id || idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '10px 12px',
                          borderRadius: '14px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                              src={reply.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.username || reply.displayName || 'user'}`}
                              alt={reply.displayName}
                              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                {reply.displayName || reply.username || 'User'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '6px' }}>
                                {formatTimeAgo(reply.createdAt)}
                              </span>
                            </div>
                          </div>

                          {reply.userId && reply.userId !== user?.id && (
                            <button
                              type="button"
                              onClick={() => handleOpenViewerChat(reply)}
                              style={{
                                background: 'rgba(168, 85, 247, 0.18)',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                borderRadius: '12px',
                                padding: '3px 8px',
                                color: '#c084fc',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Send size={11} /> Reply back
                            </button>
                          )}
                        </div>

                        {reply.text && (
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.07)',
                            padding: '6px 10px',
                            borderRadius: '10px',
                            color: '#f8fafc',
                            fontSize: '0.82rem',
                            borderLeft: '3px solid #a855f7'
                          }}>
                            "{reply.text}"
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {reply.emoji && (
                            <span style={{ fontSize: '1.1rem' }}>Reacted: {reply.emoji}</span>
                          )}
                          {reply.tipSparks > 0 && (
                            <span style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px'
                            }}>
                              ⚡ Tipped {reply.tipSparks} Sparks
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* INSIGHTS TAB */}
              {activeViewersTab === 'insights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px'
                  }}>
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '16px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>
                        <Eye size={15} /> Total Views
                      </div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
                        {viewCount}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      borderRadius: '16px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontSize: '0.78rem', fontWeight: 700 }}>
                        <Heart size={15} fill="#f43f5e" /> Likes Received
                      </div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
                        {currentStoryLikes.length}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                      borderRadius: '16px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '0.78rem', fontWeight: 700 }}>
                        <MessageSquare size={15} /> Story Replies
                      </div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
                        {currentStoryReplies.length}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '16px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700 }}>
                        <Zap size={15} fill="#f59e0b" /> Sparks Earned
                      </div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
                        {currentVibe.sparksEarned || 0}
                      </span>
                    </div>
                  </div>

                  {/* Story Details Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>Story Information</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e2e8f0' }}>
                      <span style={{ color: '#94a3b8' }}>Posted</span>
                      <span>{new Date(currentVibe.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(currentVibe.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e2e8f0' }}>
                      <span style={{ color: '#94a3b8' }}>Expires In</span>
                      <span>{Math.max(0, 24 - Math.floor((Date.now() - new Date(currentVibe.createdAt).getTime()) / (1000 * 60 * 60)))} hours</span>
                    </div>
                    {currentVibe.songTitle && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e2e8f0' }}>
                        <span style={{ color: '#94a3b8' }}>Audio</span>
                        <span>🎵 {currentVibe.songTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
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
