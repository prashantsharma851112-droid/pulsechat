import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useAppMusic } from '../../context/AppMusicContext';
import { X, Music, Disc, Sparkles, Play, Pause, Trash2, Crown, Check, Palette } from 'lucide-react';
import MusicPickerModal from './MusicPickerModal';
import PulseProModal from '../chat/PulseProModal';

const NOTE_THEMES = [
  { id: 'default', name: 'Classic Dark', icon: '🌙', isLive: false, isPro: false, bgPreview: 'linear-gradient(135deg, #232336, #14141c)' },
  { id: 'neon-violet', name: 'Neon Violet', icon: '💜', isLive: false, isPro: false, bgPreview: 'linear-gradient(135deg, #4c1d95, #7c3aed)' },
  { id: 'cyber-cyan', name: 'Cyber Cyan', icon: '💎', isLive: false, isPro: false, bgPreview: 'linear-gradient(135deg, #0e7490, #06b6d4)' },
  { id: 'sunset-rose', name: 'Sunset Rose', icon: '🌅', isLive: false, isPro: false, bgPreview: 'linear-gradient(135deg, #be185d, #f43f5e)' },
  { id: 'emerald-matrix', name: 'Emerald Mint', icon: '🍀', isLive: false, isPro: false, bgPreview: 'linear-gradient(135deg, #047857, #10b981)' },
  { id: 'live-cyberpunk', name: 'Cyber Glow', icon: '⚡', isLive: true, isPro: false, bgPreview: 'linear-gradient(135deg, #06b6d4, #ec4899)' },
  { id: 'live-aurora', name: 'Aurora Waves', icon: '🌌', isLive: true, isPro: true, bgPreview: 'linear-gradient(135deg, #0ea5e9, #a855f7, #ec4899)' },
  { id: 'live-dragon-flame', name: 'Dragon Fury', icon: '🐉', isLive: true, isPro: true, bgPreview: 'linear-gradient(135deg, #b91c1c, #f59e0b)' },
  { id: 'live-golden-royalty', name: 'Golden Royale', icon: '👑', isLive: true, isPro: true, bgPreview: 'linear-gradient(135deg, #78350f, #fbbf24)' },
  { id: 'live-cosmic-galaxy', name: 'Cosmic Nebula', icon: '✨', isLive: true, isPro: true, bgPreview: 'linear-gradient(135deg, #1e1b4b, #701a75)' }
];

// =========================================================================
// ATOMIC ISOLATED MUSIC NOTE COMPONENTS (React.memo + 0ms GPU Feedback)
// =========================================================================

export const MusicNoteThemeOption = React.memo(function MusicNoteThemeOption({
  themeItem,
  isSelected,
  onSelect
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(themeItem)}
      className="interactive-tap vibe-action-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        borderRadius: '12px',
        background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
        border: isSelected ? '1.8px solid #a855f7' : '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: themeItem.bgPreview,
        boxShadow: themeItem.isLive ? '0 0 8px rgba(168, 85, 247, 0.6)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.74rem',
        flexShrink: 0
      }}>
        {themeItem.icon}
      </div>

      <div style={{
        flex: 1,
        minWidth: 0,
        fontSize: '0.78rem',
        fontWeight: 700,
        color: isSelected ? '#ffffff' : 'var(--text-main)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {themeItem.name}
      </div>

      {themeItem.isPro && (
        <Crown size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
      )}

      {isSelected && (
        <Check size={14} color="#a855f7" strokeWidth={3} style={{ flexShrink: 0 }} />
      )}
    </button>
  );
});

export const MusicNoteDurationPill = React.memo(function MusicNoteDurationPill({
  sec,
  isSelected,
  onSelect
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(sec)}
      className="interactive-tap vibe-action-btn"
      style={{
        background: isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: '6px',
        padding: '1px 5px',
        fontSize: '0.64rem',
        fontWeight: 700,
        color: isSelected ? '#fff' : 'var(--text-muted)',
        cursor: 'pointer',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      {sec}s
    </button>
  );
});

export default function CreateMusicNoteModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const { musicNoteText, saveMusicNote, deleteMusicNote } = useAppMusic();

  const [noteText, setNoteText] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [showThemes, setShowThemes] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Audio Snippet Trimmer / Adjuster State
  const [startTime, setStartTime] = useState(0);
  const [snippetDuration, setSnippetDuration] = useState(30);
  const [trackTotalDuration, setTrackTotalDuration] = useState(240);

  const formatTimeStr = (s) => {
    const sec = Math.floor(s || 0);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  // Synchronize existing music note, theme and text whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const existingText = user?.musicNote?.noteText ?? musicNoteText ?? '';
      setNoteText(existingText);
      const existingTheme = user?.musicNote?.theme || 'default';
      setSelectedTheme(existingTheme);

      if (user?.musicNote?.songTitle) {
        setSelectedSong({
          songTitle: user.musicNote.songTitle,
          artistName: user.musicNote.artistName,
          audioUrl: user.musicNote.audioUrl,
          artworkUrl: user.musicNote.artworkUrl || user.musicNote.albumArt || '',
          duration: user.musicNote.duration || 0
        });
        setStartTime(Number(user.musicNote.startTime) || 0);
        setSnippetDuration(Number(user.musicNote.snippetDuration) || 30);
        if (user.musicNote.duration) {
          setTrackTotalDuration(Number(user.musicNote.duration));
        }
      } else {
        setSelectedSong(null);
        setStartTime(0);
        setSnippetDuration(30);
      }
    }
  }, [isOpen, user?.musicNote, musicNoteText]);

  // Clean audio on unmount or close
  useEffect(() => {
    return () => {
      if (previewAudio) {
        try {
          previewAudio.pause();
          previewAudio.currentTime = 0;
          previewAudio.src = '';
        } catch (e) {}
      }
    };
  }, [previewAudio]);

  if (!isOpen) return null;

  const handleTogglePreview = () => {
    if (!selectedSong?.audioUrl) return;

    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      if (previewAudio) {
        previewAudio.currentTime = startTime;
        previewAudio.play().then(() => setIsPlayingPreview(true)).catch(() => {});
      } else {
        const a = new Audio(selectedSong.audioUrl);
        a.currentTime = startTime;
        a.ontimeupdate = () => {
          if (a.currentTime >= startTime + snippetDuration) {
            a.pause();
            a.currentTime = startTime;
            setIsPlayingPreview(false);
          }
        };
        a.onloadedmetadata = () => {
          if (a.duration && !isNaN(a.duration) && a.duration > 0) {
            setTrackTotalDuration(Math.floor(a.duration));
          }
        };
        a.onended = () => {
          setIsPlayingPreview(false);
          a.currentTime = startTime;
        };
        a.play().then(() => setIsPlayingPreview(true)).catch(() => {});
        setPreviewAudio(a);
      }
    }
  };

  const handleStartTimeChange = (newStart) => {
    const maxStart = Math.max(0, trackTotalDuration - snippetDuration);
    const clamped = Math.max(0, Math.min(maxStart, newStart));
    setStartTime(clamped);

    if (previewAudio) {
      previewAudio.currentTime = clamped;
      if (!isPlayingPreview) {
        previewAudio.play().then(() => setIsPlayingPreview(true)).catch(() => {});
      }
    }
  };

  const handleDurationChange = (newDur) => {
    setSnippetDuration(newDur);
    if (startTime + newDur > trackTotalDuration) {
      const adjustedStart = Math.max(0, trackTotalDuration - newDur);
      setStartTime(adjustedStart);
      if (previewAudio) previewAudio.currentTime = adjustedStart;
    }
  };

  const handleCleanClose = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio.src = '';
      } catch (e) {}
    }
    setIsPlayingPreview(false);
    onClose();
  };

  const handleSave = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio.src = '';
      } catch (e) {}
    }
    const cleanSong = selectedSong ? {
      songTitle: selectedSong.songTitle,
      artistName: selectedSong.artistName || 'PulseChat Audio',
      audioUrl: selectedSong.audioUrl,
      artworkUrl: selectedSong.artworkUrl || selectedSong.albumArt || '',
      duration: trackTotalDuration || selectedSong.duration || 0,
      startTime: startTime,
      snippetDuration: snippetDuration,
      theme: selectedTheme
    } : null;
    saveMusicNote(cleanSong, noteText, selectedTheme);
    handleCleanClose();
  };

  const handleSelectTheme = (th) => {
    if (th.isPro && !user?.isPro) {
      setShowProModal(true);
      return;
    }
    setSelectedTheme(th.id);
  };

  const getPreviewTailColor = () => {
    if (selectedTheme === 'live-aurora') return 'rgba(168, 85, 247, 0.95)';
    if (selectedTheme === 'live-dragon-flame') return 'rgba(217, 119, 6, 0.95)';
    if (selectedTheme === 'live-cyberpunk') return 'rgba(236, 72, 153, 0.95)';
    if (selectedTheme === 'live-golden-royalty') return 'rgba(217, 119, 6, 0.95)';
    if (selectedTheme === 'live-cosmic-galaxy') return 'rgba(112, 26, 117, 0.95)';
    if (selectedTheme === 'neon-violet') return 'rgba(124, 58, 237, 0.95)';
    if (selectedTheme === 'cyber-cyan') return 'rgba(6, 182, 212, 0.95)';
    if (selectedTheme === 'sunset-rose') return 'rgba(244, 63, 94, 0.95)';
    if (selectedTheme === 'emerald-matrix') return 'rgba(16, 185, 129, 0.95)';
    return 'rgba(20, 20, 28, 0.94)';
  };

  const handleDelete = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio.src = '';
      } catch (e) {}
    }
    deleteMusicNote();
    handleCleanClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1350 }}
      onClick={handleCleanClose}
    >
      <div
        className="modal-card modal-responsive"
        style={{
          maxWidth: '380px',
          padding: '18px 20px',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header (No description) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Music size={17} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Music Note ✨
            </h3>
          </div>
          <button className="icon-btn-ghost" onClick={handleCleanClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Live DP Bubble Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '14px 12px',
          background: 'rgba(0, 0, 0, 0.28)',
          borderRadius: '18px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          gap: '8px'
        }}>
          <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Live DP Bubble Preview
          </span>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              className={selectedTheme !== 'default' ? `note-bubble-${selectedTheme}` : ''}
              style={{
                background: selectedTheme === 'default' ? 'rgba(20, 20, 28, 0.94)' : undefined,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: selectedTheme === 'default' ? '1px solid rgba(255, 255, 255, 0.2)' : undefined,
                borderRadius: '16px',
                padding: (noteText.trim() && selectedSong) ? '4px 6px' : '4px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                width: '76px',
                minWidth: '76px',
                maxWidth: '76px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: '#ffffff',
                textAlign: 'center',
                wordBreak: 'break-word',
                lineHeight: 1.25,
                width: '100%'
              }}>
                {noteText.trim() || (selectedSong ? 'Vibe Song 🎧' : 'Share vibe ✨')}
              </div>
              {selectedSong && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  width: '100%',
                  overflow: 'hidden',
                  marginTop: '2px',
                  background: noteText.trim() ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  borderRadius: '6px',
                  padding: '1px 3px'
                }}>
                  <Music size={10} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span
                    className="music-playing-shimmer"
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1
                    }}
                  >
                    {selectedSong.songTitle}
                  </span>
                </div>
              )}
            </div>
            {/* Bubble Tail */}
            <div style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `5px solid ${getPreviewTailColor()}`,
              margin: '-1px auto 0 auto'
            }} />
          </div>
        </div>

        {/* Typing Box + Music Button + Theme Button (Clean UI Row) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Share a thought / vibe..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={60}
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              padding: '10px 14px',
              borderRadius: '14px',
              fontSize: '0.86rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)'
            }}
          />
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="interactive-tap vibe-action-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: '14px',
              background: selectedSong ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.06)',
              border: selectedSong ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              color: selectedSong ? 'var(--accent)' : 'var(--text-main)',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title={selectedSong ? selectedSong.songTitle : "Attach Music"}
          >
            <Music size={15} />
            <span>Music</span>
          </button>
          <button
            type="button"
            onClick={() => setShowThemes(prev => !prev)}
            className="interactive-tap vibe-action-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: '14px',
              background: showThemes ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.06)',
              border: showThemes ? '1.5px solid #a855f7' : '1px solid var(--border)',
              color: showThemes ? '#c084fc' : 'var(--text-main)',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Choose Theme"
          >
            <Palette size={15} />
            <span>Theme</span>
          </button>
        </div>

        {/* Theme Options (Shown when Theme button is clicked: Only Name, No Description, Clean UI) */}
        {showThemes && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Select Theme
              </span>
              <button
                type="button"
                onClick={() => setShowThemes(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              maxHeight: '170px',
              overflowY: 'auto',
              padding: '2px'
            }}>
              {NOTE_THEMES.map(th => (
                <MusicNoteThemeOption
                  key={th.id}
                  themeItem={th}
                  isSelected={selectedTheme === th.id}
                  onSelect={handleSelectTheme}
                />
              ))}
            </div>
          </div>
        )}

        {/* Attached Music Card (Sleek and compact, shown only when song is attached) */}
        {selectedSong && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: '14px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#181824',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedSong.artworkUrl ? (
                    <img src={selectedSong.artworkUrl} alt={selectedSong.songTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Disc size={18} color="#a855f7" />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSong.songTitle}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSong.artistName}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  className="interactive-tap vibe-action-btn"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isPlayingPreview ? 'var(--accent)' : 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid var(--accent)',
                    color: isPlayingPreview ? '#ffffff' : 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={isPlayingPreview ? "Pause" : "Play"}
                >
                  {isPlayingPreview ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: '1px' }} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="interactive-tap vibe-action-btn"
                  style={{
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    fontSize: '0.70rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (previewAudio) {
                      try {
                        previewAudio.pause();
                        previewAudio.currentTime = 0;
                      } catch (e) {}
                    }
                    setIsPlayingPreview(false);
                    setSelectedSong(null);
                  }}
                  className="interactive-tap vibe-action-btn"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Remove song"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Compact Snippet Scrubber & Duration */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
              padding: '6px 8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Segment: {formatTimeStr(startTime)} – {formatTimeStr(startTime + snippetDuration)}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[15, 30, 60].map(sec => (
                    <MusicNoteDurationPill
                      key={sec}
                      sec={sec}
                      isSelected={snippetDuration === sec}
                      onSelect={handleDurationChange}
                    />
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(1, trackTotalDuration - snippetDuration)}
                step="1"
                value={startTime}
                onChange={(e) => handleStartTimeChange(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)', height: '4px' }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          {Boolean(musicNoteText || user?.musicNote) && (
            <button
              type="button"
              onClick={handleDelete}
              className="interactive-tap vibe-action-btn"
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Remove current note"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedSong && !noteText.trim()}
            className="btn-primary interactive-tap vibe-action-btn"
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={16} /> Share Note on DP
          </button>
        </div>
      </div>

      {/* Music Picker Modal */}
      {showPicker && (
        <MusicPickerModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          selectedSong={selectedSong}
          onSelectSong={(song) => {
            setSelectedSong({
              songTitle: song.songTitle,
              artistName: song.artistName,
              audioUrl: song.audioUrl,
              artworkUrl: song.artworkUrl || song.albumArt || '',
              duration: song.duration || 0
            });
            setStartTime(0);
            if (song.duration) setTrackTotalDuration(Number(song.duration));
            setShowPicker(false);
          }}
        />
      )}

      {/* Pulse Pro VIP Modal */}
      {showProModal && (
        <PulseProModal onClose={() => setShowProModal(false)} />
      )}
    </div>
  );
}
