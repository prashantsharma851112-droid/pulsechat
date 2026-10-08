import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { SocketContext } from './SocketContext';
import { BACKEND_URL } from '../utils/config';

export const AppMusicContext = createContext(null);

export function AppMusicProvider({ children }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

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

    // Create new audio instance
    const audio = new Audio(currentTrack.audioUrl);
    audio.preload = 'metadata';
    audio.volume = isMuted ? 0 : volume;
    audio.loop = true; // App-wide background music loops cleanly

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener('timeupdate', () => {
      setProgress(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    });

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

  // Sync volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Play track
  const playTrack = useCallback((track, noteText = '') => {
    if (!track) return;
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
  }, []);

  const pauseTrack = useCallback(() => {
    wasPlayingBeforeInterruptionRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resumeTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => {
        console.warn('App music resume failed:', e);
      });
    }
  }, []);

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
    setMusicNoteText(noteText);
    localStorage.setItem('pulsechat_app_music_note_text', noteText);

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/music-note`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ song, noteText })
        });
        const data = await res.json();
        if (data.success && data.musicNote) {
          if (updateUserProfile && user) {
            updateUserProfile({ ...user, musicNote: data.musicNote });
          }
          window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: data.musicNote } }));
        }
      } catch (e) {
        console.warn('Failed to sync music note to server:', e);
      }
    }
  }, [token, updateUserProfile, user]);

  const deleteMusicNote = useCallback(async () => {
    setMusicNoteText('');
    localStorage.removeItem('pulsechat_app_music_note_text');

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/users/music-note`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ song: null, noteText: '' })
        });
        if (updateUserProfile && user) {
          updateUserProfile({ ...user, musicNote: null });
        }
        window.dispatchEvent(new CustomEvent('pulsechat_music_note_updated', { detail: { musicNote: null } }));
      } catch (e) {}
    }
  }, [token, updateUserProfile, user]);

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
      if (data?.userId === user?.id) {
        if (updateUserProfile && user) {
          updateUserProfile({ ...user, musicNote: data.musicNote || null });
        }
        if (data.musicNote?.noteText !== undefined) {
          setMusicNoteText(data.musicNote.noteText);
        }
      }
    };
    socket.on('user_music_note_updated', handleSocketNote);
    return () => {
      socket.off('user_music_note_updated', handleSocketNote);
    };
  }, [socket, user?.id, updateUserProfile, user]);

  const value = {
    currentTrack,
    musicNoteText,
    isPlaying,
    isDucked,
    progress,
    duration,
    isMuted,
    volume,
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
    deleteMusicNote
  };

  return (
    <AppMusicContext.Provider value={value}>
      {children}
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
