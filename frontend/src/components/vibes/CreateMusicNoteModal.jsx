import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useAppMusic } from '../../context/AppMusicContext';
import { X, Music, Disc, Sparkles, Play, Pause, Trash2, SlidersHorizontal, FastForward, Rewind } from 'lucide-react';
import MusicPickerModal from './MusicPickerModal';

export default function CreateMusicNoteModal({ isOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const { currentTrack, musicNoteText, saveMusicNote, deleteMusicNote } = useAppMusic();

  const [noteText, setNoteText] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
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

  // Synchronize existing music note and text whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const existingText = user?.musicNote?.noteText ?? musicNoteText ?? '';
      setNoteText(existingText);

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
      } else if (currentTrack) {
        setSelectedSong(currentTrack);
        setStartTime(0);
        setSnippetDuration(30);
        if (currentTrack.duration) {
          setTrackTotalDuration(Number(currentTrack.duration));
        }
      } else {
        setSelectedSong(null);
        setStartTime(0);
        setSnippetDuration(30);
      }
    }
  }, [isOpen, user?.musicNote, musicNoteText, currentTrack]);

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
      snippetDuration: snippetDuration
    } : null;
    saveMusicNote(cleanSong, noteText);
    handleCleanClose();
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
          maxWidth: '390px',
          padding: '20px',
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Music Note ✨
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Insta-style music note across your app
              </span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={handleCleanClose}>
            <X size={18} />
          </button>
        </div>

        {/* Note Thought Bubble Input */}
        <div>
          <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
            💭 Share a thought / vibe
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Chai Break ☕, Vibing 🎧, Late Night 🌙"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={60}
            style={{ fontSize: '0.85rem' }}
          />

          {/* Quick Vibe Chips */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '8px'
          }}>
            {['☕ Chai Break', '🎧 Vibing', '⚡ Energy', '🌙 Night Owl', '🔥 On Fire', '💪 Gym Beast', '💖 In Love'].map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => setNoteText(chip)}
                style={{
                  background: noteText === chip ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: noteText === chip ? '1px solid #a855f7' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '3px 8px',
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  color: noteText === chip ? '#c084fc' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Song Box / Attach Button */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', margin: 0 }}>
              🎵 Attach Music (Optional)
            </label>
            {selectedSong && (
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
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.70rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Remove Song
              </button>
            )}
          </div>

          {selectedSong ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Song Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#181824',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {selectedSong.artworkUrl ? (
                      <img
                        src={selectedSong.artworkUrl}
                        alt={selectedSong.songTitle}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Disc size={20} color="#a855f7" />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {selectedSong.songTitle}
                    </div>
                    <div style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {selectedSong.artistName}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Preview Play/Pause button */}
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isPlayingPreview ? 'var(--accent)' : 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid var(--accent)',
                      color: isPlayingPreview ? '#ffffff' : 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title={isPlayingPreview ? "Pause Snippet" : "Preview Snippet"}
                  >
                    {isPlayingPreview ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '1px' }} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'var(--hover-bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Instagram-style Music Snippet & Duration Adjuster */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <SlidersHorizontal size={13} color="var(--accent)" />
                    <span>Adjust Segment & Duration</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#38bdf8' }}>
                    {formatTimeStr(startTime)} – {formatTimeStr(startTime + snippetDuration)}
                  </span>
                </div>

                {/* Timeline Range Scrubber */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, trackTotalDuration - snippetDuration)}
                    step="1"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(Number(e.target.value))}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                      accentColor: 'var(--accent)',
                      height: '6px'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                    <span>Start: {formatTimeStr(startTime)}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartTimeChange(startTime - 5)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        title="Rewind 5s"
                      >
                        <Rewind size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartTimeChange(startTime + 5)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        title="Forward 5s"
                      >
                        <FastForward size={11} />
                      </button>
                    </div>
                    <span>Total: {formatTimeStr(trackTotalDuration)}</span>
                  </div>
                </div>

                {/* Duration Selector Chips: 15s, 30s, 45s, 60s */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Snippet Length:</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[15, 30, 45, 60].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleDurationChange(sec)}
                        style={{
                          background: snippetDuration === sec ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                          border: snippetDuration === sec ? '1px solid var(--accent)' : '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: snippetDuration === sec ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
                border: '1.5px dashed rgba(99, 102, 241, 0.4)',
                color: 'var(--accent)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Music size={16} /> Choose Music Track (Bollywood / Trending)
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {(currentTrack || musicNoteText || user?.musicNote) && (
            <button
              type="button"
              onClick={handleDelete}
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
            className="btn-primary"
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
    </div>
  );
}
