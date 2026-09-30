import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Play, Pause, Music, Sparkles, Check, Flame, Disc, Radio } from 'lucide-react';

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
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPreviewYtId(null);
    };
  }, []);

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
        audioRef.current.pause();
      }
      setPlayingTrackId(null);
      setPreviewYtId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (song.audioUrl && !song.audioUrl.includes('youtube')) {
        setPreviewYtId(null);
        const newAudio = new Audio(song.audioUrl);
        newAudio.volume = 0.85;
        newAudio.play().catch(e => console.warn('Preview audio failed:', e));
        newAudio.onended = () => setPlayingTrackId(null);
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
      audioRef.current.pause();
    }
    setPlayingTrackId(null);
    setPreviewYtId(null);

    onSelectSong(song);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'pulseFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={() => {
        if (audioRef.current) audioRef.current.pause();
        setPreviewYtId(null);
        onClose();
      }}
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
            <Disc size={16} className="spin-slow" /> Playing Full Song:
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
          maxWidth: '460px',
          height: '82vh',
          maxHeight: '680px',
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'pulseModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.5)'
            }}>
              <Disc size={18} className="spin-slow" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                PulseChat Music 🎵
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Search & attach any full song to your Chat & Vibe Story
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              onClose();
            }}
            className="icon-btn-ghost"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-sidebar)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist, song name, album..."
              className="form-input"
              style={{
                paddingLeft: '2.5rem',
                borderRadius: '24px',
                fontSize: '0.92rem',
                paddingBlock: '0.65rem',
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)'
              }}
              autoFocus
            />
          </div>

          {/* Quick Preset Categories Chips */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            marginTop: '0.75rem',
            paddingBottom: '4px',
            scrollbarWidth: 'none'
          }}>
            {PRESET_CATEGORIES.map(cat => (
              <button
                key={cat.label}
                onClick={() => {
                  setQuery(cat.query);
                  searchSongs(cat.query);
                }}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: query === cat.query ? 'var(--accent)' : 'var(--bg-card)',
                  color: query === cat.query ? '#fff' : 'var(--text-main)',
                  border: '1px solid var(--border)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Songs List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.85rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Disc size={36} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.88rem', margin: 0 }}>Searching music library...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#ef4444', fontSize: '0.88rem' }}>
              {error}
            </div>
          ) : songs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              <Music size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0 }}>No songs found for "{query}"</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {songs.map(song => {
                const isSelected = selectedSong?.audioUrl === song.audioUrl || selectedSong?.songTitle === song.songTitle;
                const isPreviewing = playingTrackId === song.trackId;

                return (
                  <div
                    key={song.trackId || song.audioUrl}
                    onClick={() => handleSelect(song)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.14)' : 'var(--bg-card)',
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                  >
                    {/* Album Art & Titles */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
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
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: isPreviewing ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.3)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                          title={isPreviewing ? "Pause" : "Play Full Song"}
                        >
                          {isPreviewing ? <Pause size={18} color="#ec4899" /> : <Play size={18} fill="#ffffff" />}
                        </button>
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {song.songTitle}
                        </div>
                        <div style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>{song.artistName}</span>
                          {song.duration && (
                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                              {Math.floor(song.duration / 60)}:{(song.duration % 60) < 10 ? '0' : ''}{song.duration % 60} Full Song
                            </span>
                          )}
                          {isPreviewing && (
                            <span style={{ color: '#ec4899', fontWeight: 700, fontSize: '0.7rem' }}>
                              · 🎵 Playing Full Song...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      {isSelected ? (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--accent)',
                          background: 'rgba(99, 102, 241, 0.18)',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Check size={12} /> Selected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelect(song)}
                          className="btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            borderRadius: '8px',
                            fontWeight: 600
                          }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
