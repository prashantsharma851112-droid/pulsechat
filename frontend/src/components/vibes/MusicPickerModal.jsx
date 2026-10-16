import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Play, Pause, Music, Sparkles, Check, Flame, Disc, Radio, Volume2, Plus, CheckCircle2, Headphones } from 'lucide-react';
import { registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';

const PRESET_CATEGORIES = [
  { label: '🔥 Trending', query: 'Bollywood trending 2026' },
  { label: '💃 Bollywood Hits', query: 'Arijit Singh Pritam' },
  { label: '⚡ Punjabi Beats', query: 'Punjabi hits AP Dhillon' },
  { label: '🎧 Lofi & Chill', query: 'Lofi chill beats' },
  { label: '💖 Romantic Vibes', query: 'Romantic love songs' },
  { label: '🌟 Hollywood Pop', query: 'Taylor Swift The Weeknd' }
];

import { BACKEND_URL } from '../../utils/config';

export default function MusicPickerModal({ isOpen, onClose, onSelectSong, selectedSong }) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [previewYtId, setPreviewYtId] = useState(null);
  const audioRef = useRef(null);

  // Stop audio on unmount or close
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {}
      }
      setPlayingTrackId(null);
      setPreviewYtId(null);
      stopGlobalMusicAudio();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {}
      }
      setPlayingTrackId(null);
      setPreviewYtId(null);
      stopGlobalMusicAudio();
    }
  }, [isOpen]);

  const handleCloseModal = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current = null;
      } catch (e) {}
    }
    setPlayingTrackId(null);
    setPreviewYtId(null);
    stopGlobalMusicAudio();
    onClose();
  };

  const searchSongs = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const rawToken = localStorage.getItem('pulsechat_token');
      const authHeader = rawToken ? { Authorization: `Bearer ${rawToken}` } : {};

      // 1. Direct JioSaavn 100% Full Song Streaming API (320kbps / 160kbps complete tracks)
      // 2. PulseChat Backend Fallback
      const [saavnRes, backendRes] = await Promise.allSettled([
        fetch(`https://jiosaavn-api-tan.vercel.app/api/search/songs?query=${encodeURIComponent(searchTerm)}`).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/messages/youtube-search?q=${encodeURIComponent(searchTerm)}`, { headers: authHeader }).then(r => r.json())
      ]);

      let fullTracks = [];

      if (saavnRes.status === 'fulfilled' && saavnRes.value) {
        const saavnData = saavnRes.value.data?.results || saavnRes.value.results || [];
        if (Array.isArray(saavnData)) {
          fullTracks = saavnData.map(song => {
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
        }
      }

      if (fullTracks.length === 0 && backendRes.status === 'fulfilled' && Array.isArray(backendRes.value)) {
        fullTracks = backendRes.value;
      }

      setSongs(fullTracks);
    } catch (err) {
      console.error('Failed to search songs:', err);
      setError('Could not load songs. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load with default trending query
  useEffect(() => {
    if (isOpen) {
      searchSongs('Bollywood trending');
    }
  }, [isOpen]);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      searchSongs(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const togglePreview = (e, song) => {
    e.stopPropagation();
    if (playingTrackId === song.trackId) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {}
      }
      stopGlobalMusicAudio();
      setPlayingTrackId(null);
      setPreviewYtId(null);
    } else {
      stopGlobalMusicAudio();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {}
      }
      if (song.audioUrl && !song.audioUrl.includes('youtube')) {
        setPreviewYtId(null);
        const newAudio = new Audio(song.audioUrl);
        newAudio.volume = 0.85;
        registerGlobalMusicAudio(newAudio);
        newAudio.play().catch(e => console.warn('Preview audio failed:', e));
        newAudio.onended = () => {
          setPlayingTrackId(null);
          stopGlobalMusicAudio();
        };
        audioRef.current = newAudio;
        setPlayingTrackId(song.trackId);
      } else if (song.youtubeId) {
        setPreviewYtId(song.youtubeId);
        setPlayingTrackId(song.trackId);
      }
    }
  };

  const handleSelect = async (song) => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current = null;
      } catch (e) {}
    }
    stopGlobalMusicAudio();
    setPlayingTrackId(null);
    setPreviewYtId(null);

    onSelectSong(song);
    onClose();
  };

  const activeSong = songs.find(s => s.trackId === playingTrackId) || null;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'pulseFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={handleCloseModal}
    >
      {previewYtId && (
        <div style={{
          position: 'absolute',
          top: '20px',
          zIndex: 1300,
          background: 'rgba(18, 18, 24, 0.95)',
          border: '1.5px solid #f59e0b',
          borderRadius: '16px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Disc size={16} className="vinyl-spin" /> Playing Full Song:
          </span>
          <div style={{ width: '130px', height: '36px', borderRadius: '8px', overflow: 'hidden' }}>
            <iframe
              key={`modal_yt_preview_${previewYtId}`}
              src={`https://www.youtube-nocookie.com/embed/${previewYtId}?autoplay=1&enablejsapi=1`}
              allow="autoplay; encrypted-media; fullscreen"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
          <button
            onClick={() => setPreviewYtId(null)}
            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '84vh',
          maxHeight: '700px',
          background: 'linear-gradient(180deg, #181428 0%, #0d0b16 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '26px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          animation: 'pulseModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.1rem 1.3rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(12px)',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Spinning Neon Vinyl Badge */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'conic-gradient(#111827 0deg, #374151 45deg, #111827 90deg, #374151 135deg, #111827 180deg, #374151 225deg, #111827 270deg, #374151 315deg, #111827 360deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: playingTrackId ? '0 0 16px rgba(236, 72, 153, 0.6)' : '0 0 12px rgba(168, 85, 247, 0.35)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              position: 'relative',
              flexShrink: 0
            }}>
              <div className={playingTrackId ? 'vinyl-spin' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Disc size={22} color={playingTrackId ? "#ec4899" : "#a855f7"} />
              </div>
              <div style={{ position: 'absolute', width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>
                  PulseChat Music
                </h3>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                  HQ FULL SONGS
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                Search & attach any full song to your Chat & Vibe Story
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="icon-btn-ghost"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Quick Categories */}
        <div style={{ padding: '0.85rem 1.25rem 0.5rem 1.25rem', background: 'rgba(255, 255, 255, 0.015)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.45)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist, song name, album..."
              className="form-input input-with-icon"
              style={{
                borderRadius: '24px',
                fontSize: '0.92rem',
                paddingBlock: '0.65rem',
                paddingRight: query ? '36px' : '14px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                width: '100%',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Preset Categories Chips */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            marginTop: '0.75rem',
            paddingBottom: '4px',
            scrollbarWidth: 'none'
          }}>
            {PRESET_CATEGORIES.map(cat => {
              const isCatActive = query === cat.query;
              return (
                <button
                  key={cat.label}
                  onClick={() => {
                    setQuery(cat.query);
                    searchSongs(cat.query);
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: isCatActive
                      ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isCatActive ? '#fff' : 'rgba(255, 255, 255, 0.75)',
                    border: isCatActive ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.78rem',
                    fontWeight: isCatActive ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: isCatActive ? '0 2px 10px rgba(236, 72, 153, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Songs List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.8rem' }}>
                <Disc size={42} className="vinyl-spin" style={{ color: '#ec4899' }} />
                <div style={{ position: 'absolute', inset: 0, filter: 'blur(12px)', opacity: 0.6 }}>
                  <Disc size={42} style={{ color: '#8b5cf6' }} />
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', margin: 0, fontWeight: 700, color: '#fff' }}>Searching full music library...</p>
              <p style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.5)', margin: '4px 0 0 0' }}>Streaming in 320kbps Studio Master</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#ef4444', fontSize: '0.88rem' }}>
              {error}
            </div>
          ) : songs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.88rem' }}>
              <Music size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No songs found for "{query}"</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.map(song => {
                const isSelected = selectedSong?.audioUrl === song.audioUrl || selectedSong?.songTitle === song.songTitle;
                const isPreviewing = playingTrackId === song.trackId;

                return (
                  <div
                    key={song.trackId || song.audioUrl}
                    onClick={() => handleSelect(song)}
                    className={isPreviewing ? 'music-card-playing' : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '16px',
                      background: isPreviewing
                        ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.16) 0%, rgba(139, 92, 246, 0.16) 100%)'
                        : isSelected
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isPreviewing
                        ? '1.5px solid rgba(236, 72, 153, 0.65)'
                        : isSelected
                        ? '1.5px solid #10b981'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: isPreviewing
                        ? '0 4px 18px rgba(236, 72, 153, 0.25)'
                        : '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isPreviewing && !isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPreviewing && !isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {/* Album Art & Titles */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '46px',
                          height: '46px',
                          borderRadius: isPreviewing ? '50%' : '12px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: isPreviewing ? '1.5px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.15)',
                          boxShadow: isPreviewing ? '0 0 12px rgba(236, 72, 153, 0.5)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                        className={isPreviewing ? 'vinyl-spin' : ''}
                      >
                        <img
                          src={song.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(song.songTitle)}`}
                          alt={song.songTitle}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Play/Pause Overlay Button */}
                        <button
                          type="button"
                          onClick={(e) => togglePreview(e, song)}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: isPreviewing ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={isPreviewing ? "Pause" : "Play Full Song"}
                        >
                          {isPreviewing ? (
                            <Pause size={18} color="#fff" />
                          ) : (
                            <Play size={18} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
                          )}
                        </button>
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} className={isPreviewing ? 'music-playing-shimmer' : ''}>
                            {song.songTitle}
                          </span>
                          {/* Live Equalizer Bars dancing when previewing */}
                          {isPreviewing && (
                            <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '14px', flexShrink: 0 }}>
                              <span className="music-eq-bar" />
                              <span className="music-eq-bar" />
                              <span className="music-eq-bar" />
                              <span className="music-eq-bar" />
                            </div>
                          )}
                        </div>

                        <div style={{
                          fontSize: '0.74rem',
                          color: 'rgba(255, 255, 255, 0.65)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '2px'
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName}</span>
                          {song.duration && (
                            <span style={{
                              color: '#10b981',
                              fontWeight: 800,
                              fontSize: '0.66rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              flexShrink: 0
                            }}>
                              ⚡ {Math.floor(song.duration / 60)}:{(song.duration % 60) < 10 ? '0' : ''}{song.duration % 60}
                            </span>
                          )}
                          {isPreviewing && (
                            <span style={{ color: '#ec4899', fontWeight: 800, fontSize: '0.68rem', flexShrink: 0 }}>
                              · Live Previewing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px', flexShrink: 0 }}>
                      {isSelected ? (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Check size={13} /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelect(song)}
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.76rem',
                            borderRadius: '20px',
                            border: 'none',
                            fontWeight: 800,
                            background: isPreviewing
                              ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: isPreviewing ? '0 4px 14px rgba(236, 72, 153, 0.4)' : '0 2px 8px rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Plus size={13} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Floating Mini-Player Bar (When song is previewing) */}
        {activeSong && (
          <div style={{
            padding: '10px 14px',
            margin: '0 12px 12px 12px',
            background: 'linear-gradient(135deg, rgba(24, 21, 40, 0.96) 0%, rgba(13, 11, 24, 0.98) 100%)',
            border: '1.5px solid rgba(236, 72, 153, 0.55)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(236, 72, 153, 0.25)',
            backdropFilter: 'blur(16px)',
            animation: 'pulseModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Left: Mini spinning vinyl + song info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1.5px solid #ec4899',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)'
                }}
                className="vinyl-spin"
              >
                <img src={activeSong.albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeSong.songTitle}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{activeSong.artistName}</span>
                  <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '10px', marginLeft: '4px' }}>
                    <span className="music-eq-bar" />
                    <span className="music-eq-bar" />
                    <span className="music-eq-bar" />
                    <span className="music-eq-bar" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Pause toggle + Use Song button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => togglePreview(e, activeSong)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Pause Preview"
              >
                <Pause size={16} color="#ec4899" />
              </button>
              <button
                type="button"
                onClick={() => handleSelect(activeSong)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Use Song</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
