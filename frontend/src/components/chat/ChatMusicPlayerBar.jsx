import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { getOrCacheAudioBlobUrl, getSyncCachedAudioUrl } from '../../utils/mediaCache';
import { registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';

function formatSongTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const isMatchingChatId = (c1, c2) => {
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.includes('_') && c2.includes('_')) {
    if (c1.split('_').sort().join('_') === c2.split('_').sort().join('_')) return true;
  }
  return false;
};

/**
 * ChatMusicPlayerBar - Isolated 0ms Latency Audio Player Component
 * Isolates all timeupdate ticks (4x/sec) and seekbar state to this component.
 * Prevents ChatWindow and MessageItem re-renders completely during music playback.
 */
const ChatMusicPlayerBar = React.memo(function ChatMusicPlayerBar({
  chatMusicSong,
  chatId,
  socket,
  user,
  auraVolume = 0.7,
  onUpdateChatMusic
}) {
  const [isChatMusicMuted, setIsChatMusicMuted] = useState(false);
  const [songProgress, setSongProgress] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [isSongPlaying, setIsSongPlaying] = useState(true);
  const [isAutoNextLoading, setIsAutoNextLoading] = useState(false);

  const chatAudioRef = useRef(null);
  const similarSongsQueueRef = useRef([]);

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
    if (nextTrack && onUpdateChatMusic) {
      onUpdateChatMusic(nextTrack);
    }
  }, [chatMusicSong, onUpdateChatMusic]);

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

  // Audio element setup and tracking
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

  // Sync volume
  useEffect(() => {
    if (chatAudioRef.current) {
      chatAudioRef.current.volume = isChatMusicMuted ? 0 : auraVolume;
    }
  }, [auraVolume, isChatMusicMuted]);

  // Handle remote socket actions (play / pause / seek from partner)
  useEffect(() => {
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

    window.addEventListener('pulsechat_music_action', handleChatMusicAction);
    return () => {
      window.removeEventListener('pulsechat_music_action', handleChatMusicAction);
    };
  }, [chatId, user?.id]);

  if (!chatMusicSong || isChatMusicMuted) {
    return null;
  }

  return (
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
            onClick={() => onUpdateChatMusic && onUpdateChatMusic(null)}
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
  );
});

export default ChatMusicPlayerBar;
