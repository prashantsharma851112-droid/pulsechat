import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { SocketContext } from './SocketContext';
import { BACKEND_URL } from '../utils/config';
import { getOrCacheAudioBlobUrl, getSyncCachedAudioUrl } from '../utils/mediaCache';
import SparksFeaturePromptModal from '../components/common/SparksFeaturePromptModal';
import PulseProModal from '../components/chat/PulseProModal';

export const AppMusicContext = createContext(null);

export function AppMusicProvider({ children }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

  // Daily music listening seconds (Free tier limit = 30 mins = 1800s)
  const [dailyListenedSec, setDailyListenedSec] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return Number(localStorage.getItem(`pulsechat_music_listened_sec_${today}`)) || 0;
    } catch {
      return 0;
    }
  });

  const [bonusListeningSec, setBonusListeningSec] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return Number(localStorage.getItem(`pulsechat_music_bonus_sec_${today}`)) || 0;
    } catch {
      return 0;
    }
  });

  const [showMusicLimitModal, setShowMusicLimitModal] = useState(false);
  const [showPulseProModal, setShowPulseProModal] = useState(false);

  // Active App Music Track
  const [currentTrack, setCurrentTrack] = useState(() => {
    try {
      const saved = localStorage.getItem('pulsechat_app_music');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // User's Instagram-style Note text
  const [musicNoteText, setMusicNoteText] = useState(() => {
    return localStorage.getItem('pulsechat_app_music_note_text') || '';
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isDucked, setIsDucked] = useState(false); // Paused temporarily because chat music is active
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pulsechat_app_music_muted') === 'true');
  const [volume, setVolumeState] = useState(() => {
    const v = localStorage.getItem('pulsechat_app_music_volume');
    return v !== null ? parseFloat(v) : 0.85;
  });

  // Modal selector trigger
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Live audio element reference
  const audioRef = useRef(null);
  const wasPlayingBeforeInterruptionRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync user's Instagram-style music note text when profile updates
  useEffect(() => {
    if (user?.musicNote?.noteText !== undefined) {
      setMusicNoteText(user.musicNote.noteText);
      localStorage.setItem('pulsechat_app_music_note_text', user.musicNote.noteText);
    }
  }, [user?.musicNote?.noteText]);

  // Audio element setup and tracking
  useEffect(() => {
    if (!currentTrack?.audioUrl) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
        } catch (e) {}
        audioRef.current = null;
      }
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      return;
    }

    // Spotify-style Audio Disk Cache: Check if already cached in memory or device storage (0ms, 0 byte network)
    const cachedImmediate = getSyncCachedAudioUrl(currentTrack.audioUrl);
    const audio = new Audio(cachedImmediate || currentTrack.audioUrl);
    audio.preload = 'metadata';
    audio.volume = isMuted ? 0 : volume;
    audio.loop = true; // App-wide background music loops cleanly

    // Async cache check: if not in sync cache, check CacheStorage or cache in background
    if (!cachedImmediate) {
      getOrCacheAudioBlobUrl(currentTrack.audioUrl).then(blobUrl => {
        if (blobUrl && blobUrl !== currentTrack.audioUrl && audioRef.current === audio && audio.paused) {
          audio.src = blobUrl;
        }
      }).catch(() => {});
    }

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    let lastSecondStamp = -1;
    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }

      // Check daily listening limit for Free tier users (30 mins = 1800s)
      const curSec = Math.floor(audio.currentTime);
      if (curSec !== lastSecondStamp && !audio.paused) {
        lastSecondStamp = curSec;

        const isUserPro = Boolean(userRef.current?.isPro && (!userRef.current?.proExpiresAt || new Date(userRef.current.proExpiresAt) > new Date()));
        if (!isUserPro) {
          const today = new Date().toISOString().slice(0, 10);
          const bonus = Number(localStorage.getItem(`pulsechat_music_bonus_sec_${today}`)) || 0;
          const currentListened = (Number(localStorage.getItem(`pulsechat_music_listened_sec_${today}`)) || 0) + 1;
          localStorage.setItem(`pulsechat_music_listened_sec_${today}`, currentListened);
          setDailyListenedSec(currentListened);

          const maxAllowed = 1800 + bonus;
          if (currentListened >= maxAllowed) {
            audio.pause();
            setIsPlaying(false);
            setShowMusicLimitModal(true);
          }
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    audio.addEventListener('play', () => {
      setIsPlaying(true);
      setIsDucked(false);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      } catch (e) {}
    };
  }, [currentTrack?.audioUrl]);

  // Check if daily listening limit is reached
  const checkDailyLimit = useCallback(() => {
    const isUserPro = Boolean(userRef.current?.isPro && (!userRef.current?.proExpiresAt || new Date(userRef.current.proExpiresAt) > new Date()));
    if (isUserPro) return true;
    const today = new Date().toISOString().slice(0, 10);
    const bonus = Number(localStorage.getItem(`pulsechat_music_bonus_sec_${today}`)) || 0;
    const currentListened = Number(localStorage.getItem(`pulsechat_music_listened_sec_${today}`)) || 0;
    const maxAllowed = 1800 + bonus;
    if (currentListened >= maxAllowed) {
      setShowMusicLimitModal(true);
      return false;
    }
    return true;
  }, []);

  const handleExtendMusicListening = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const prevBonus = Number(localStorage.getItem(`pulsechat_music_bonus_sec_${today}`)) || 0;
    const newBonus = prevBonus + 1800; // +30 minutes
    localStorage.setItem(`pulsechat_music_bonus_sec_${today}`, newBonus);
    setBonusListeningSec(newBonus);
    setShowMusicLimitModal(false);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }, 150);
  }, []);

  // Sync volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Play track
  const playTrack = useCallback((track, noteText = '') => {
    if (!track) return;
    if (!checkDailyLimit()) return;

    setCurrentTrack(track);
    setMusicNoteText(noteText);
    localStorage.setItem('pulsechat_app_music', JSON.stringify(track));
    localStorage.setItem('pulsechat_app_music_note_text', noteText);

    // If audio already exists with this url, play immediately
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(e => {
          console.warn('App music autoplay prevented:', e);
        });
      }
    }, 50);
  }, [checkDailyLimit]);

  const pauseTrack = useCallback(() => {
    wasPlayingBeforeInterruptionRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resumeTrack = useCallback(() => {
    if (!checkDailyLimit()) return;
    if (audioRef.current) {
      audioRef.current.play().catch(e => {
        console.warn('App music resume failed:', e);
      });
    }
  }, [checkDailyLimit]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  }, [isPlaying, pauseTrack, resumeTrack]);

  const seek = useCallback((timeInSeconds) => {
    if (audioRef.current && !isNaN(timeInSeconds)) {
      audioRef.current.currentTime = timeInSeconds;
      setProgress(timeInSeconds);
    }
  }, []);

  const setVolume = useCallback((newVol) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    localStorage.setItem('pulsechat_app_music_volume', clamped.toString());
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('pulsechat_app_music_muted', String(next));
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  const clearTrack = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current = null;
      } catch (e) {}
    }
    setCurrentTrack(null);
    setMusicNoteText('');
    setIsPlaying(false);
    setIsDucked(false);
    wasPlayingBeforeInterruptionRef.current = false;
    localStorage.removeItem('pulsechat_app_music');
    localStorage.removeItem('pulsechat_app_music_note_text');
  }, []);

  // Save as User's Instagram-style Music Note (Sync to backend profile, NO background autoplay)
  const saveMusicNote = useCallback(async (song, noteText = '') => {
    const trimmedText = (noteText || '').trim();
    setMusicNoteText(trimmedText);
    localStorage.setItem('pulsechat_app_music_note_text', trimmedText);

    // Optimistically update local profile and trigger immediate UI sync
    const optimisticNote = (song || trimmedText) ? {
      songTitle: song?.songTitle || '',
      artistName: song?.artistName || '',
      audioUrl: song?.audioUrl || '',
      artworkUrl: song?.artworkUrl || song?.albumArt || '',
      duration: Number(song?.duration) || 0,
      startTime: Number(song?.startTime) || 0,
      snippetDuration: Number(song?.snippetDuration) || 30,
      noteText: trimmedText,
      likes: [], // Reset likes to empty array so users can like the new vibe note freshly
      updatedAt: new Date().toISOString()
    } : null;

    if (updateUserProfile) {
      updateUserProfile(current => ({ ...current, musicNote: optimisticNote }));
    }
    const myTargetId = user?.id || user?._id;
    window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: optimisticNote } }));
    window.dispatchEvent(new CustomEvent('pulsechat_music_note_liked', { detail: { targetUserId: myTargetId, likes: [] } }));
    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/music-note`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ song, noteText: trimmedText })
        });
        const data = await res.json();
        if (data.success) {
          const finalNote = data.musicNote !== undefined ? data.musicNote : optimisticNote;
          if (updateUserProfile) {
            updateUserProfile(current => ({ ...current, musicNote: finalNote }));
          }
          window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: finalNote } }));
          window.dispatchEvent(new CustomEvent('pulsechat_music_note_liked', { detail: { targetUserId: myTargetId, likes: [] } }));
          window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
        }
      } catch (e) {
        console.warn('Failed to sync music note to server:', e);
      }
    }
  }, [token, updateUserProfile, user?.id, user?._id]);

  const deleteMusicNote = useCallback(async () => {
    setMusicNoteText('');
    localStorage.removeItem('pulsechat_app_music_note_text');

    // Optimistically clear local profile and trigger immediate UI sync
    if (updateUserProfile) {
      updateUserProfile(current => ({ ...current, musicNote: null }));
    }
    const myTargetId = user?.id || user?._id;
    window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: null } }));
    window.dispatchEvent(new CustomEvent('pulsechat_music_note_liked', { detail: { targetUserId: myTargetId, likes: [] } }));
    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/users/music-note`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ song: null, noteText: '' })
        });
      } catch (e) {
        console.warn('Failed to delete music note on server:', e);
      }
    }
  }, [token, updateUserProfile, user?.id, user?._id]);

  // Audio Priority & Coordination:
  // Auto-pause App music when chat music plays, and auto-resume right when chat music stops!
  useEffect(() => {
    const handleChatMusicEvent = (e) => {
      const isChatPlaying = Boolean(e?.detail?.isPlaying);

      if (isChatPlaying) {
        // Chat music started playing
        if (audioRef.current && !audioRef.current.paused) {
          wasPlayingBeforeInterruptionRef.current = true;
          audioRef.current.pause();
          setIsDucked(true);
        }
      } else {
        // Chat music stopped or finished
        if (wasPlayingBeforeInterruptionRef.current) {
          wasPlayingBeforeInterruptionRef.current = false;
          setIsDucked(false);
          if (audioRef.current) {
            audioRef.current.play().catch(err => {
              console.warn('Auto-resuming app music after chat:', err);
            });
          }
        } else {
          setIsDucked(false);
        }
      }
    };

    window.addEventListener('pulsechat_chat_music_playing', handleChatMusicEvent);
    return () => {
      window.removeEventListener('pulsechat_chat_music_playing', handleChatMusicEvent);
    };
  }, []);

  // Listen to live socket update if someone changes their music note
  useEffect(() => {
    if (!socket) return;
    const handleSocketNote = (data) => {
      const isMe = data?.userId === user?.id ||
        (user?._id && String(data?.userId) === String(user._id)) ||
        (data?.username && data?.username === user?.username);

      if (isMe) {
        const updatedNote = data.musicNote || null;
        if (updateUserProfile) {
          updateUserProfile(current => ({ ...current, musicNote: updatedNote }));
        }
        setMusicNoteText(updatedNote?.noteText || '');
        window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: updatedNote } }));
        window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
      }
    };
    socket.on('user_music_note_updated', handleSocketNote);
    return () => {
      socket.off('user_music_note_updated', handleSocketNote);
    };
  }, [socket, user?.id, user?._id, user?.username, updateUserProfile]);

  const value = {
    currentTrack,
    musicNoteText,
    isPlaying,
    isDucked,
    progress,
    duration,
    isMuted,
    volume,
    dailyListenedSec,
    bonusListeningSec,
    dailyLimitSec: 1800 + bonusListeningSec,
    isDailyLimitReached: !user?.isPro && dailyListenedSec >= (1800 + bonusListeningSec),
    isPickerOpen,
    openMusicPicker: () => setIsPickerOpen(true),
    closeMusicPicker: () => setIsPickerOpen(false),
    playTrack,
    pauseTrack,
    resumeTrack,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    clearTrack,
    saveMusicNote,
    deleteMusicNote,
    openMusicLimitModal: () => setShowMusicLimitModal(true)
  };

  return (
    <AppMusicContext.Provider value={value}>
      {children}
      {showMusicLimitModal && (
        <SparksFeaturePromptModal
          isOpen={showMusicLimitModal}
          onClose={() => setShowMusicLimitModal(false)}
          featureKey="music_boost_30m"
          featureName="30-Min Music Listening Boost"
          sparksCost={10}
          icon="🎵"
          description="Free users get 30 minutes of music daily. Unlock 30 more minutes with 10 Sparks, or upgrade to Pulse Pro for unlimited listening!"
          onSuccess={handleExtendMusicListening}
          onOpenProModal={() => {
            setShowMusicLimitModal(false);
            setShowPulseProModal(true);
          }}
        />
      )}
      {showPulseProModal && (
        <PulseProModal
          onClose={() => setShowPulseProModal(false)}
          initialTab="pro"
        />
      )}
    </AppMusicContext.Provider>
  );
}

export function useAppMusic() {
  const context = useContext(AppMusicContext);
  if (!context) {
    throw new Error('useAppMusic must be used within an AppMusicProvider');
  }
  return context;
}
