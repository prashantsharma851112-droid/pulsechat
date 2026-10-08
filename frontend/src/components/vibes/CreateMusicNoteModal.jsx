import React, { useState } from 'react';
import { useAppMusic } from '../../context/AppMusicContext';
import { X, Music, Disc, Sparkles, Check, Play, Pause, Trash2 } from 'lucide-react';
import MusicPickerModal from './MusicPickerModal';

export default function CreateMusicNoteModal({ isOpen, onClose }) {
  const { currentTrack, musicNoteText, saveMusicNote, deleteMusicNote } = useAppMusic();

  const [noteText, setNoteText] = useState(musicNoteText || '');
  const [selectedSong, setSelectedSong] = useState(currentTrack || null);
  const [showPicker, setShowPicker] = useState(false);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  if (!isOpen) return null;

  const handleTogglePreview = () => {
    if (!selectedSong?.audioUrl) return;

    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      if (previewAudio) {
        previewAudio.play().then(() => setIsPlayingPreview(true)).catch(() => {});
      } else {
        const a = new Audio(selectedSong.audioUrl);
        a.onended = () => setIsPlayingPreview(false);
        a.play().then(() => setIsPlayingPreview(true)).catch(() => {});
        setPreviewAudio(a);
      }
    }
  };

  const handleCleanClose = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
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
      } catch (e) {}
    }
    if (selectedSong) {
      saveMusicNote(selectedSong, noteText);
    }
    handleCleanClose();
  };

  const handleDelete = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
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
          padding: '20px',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
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
            💭 Share a thought (optional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Chai Break ☕, Late Night Coding 🎧"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={60}
            style={{ fontSize: '0.85rem' }}
          />
        </div>

        {/* Selected Song Box / Attach Button */}
        <div>
          <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
            🎵 Selected Track
          </label>
          {selectedSong ? (
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
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={isPlayingPreview ? "Pause Preview" : "Play Preview"}
                >
                  {isPlayingPreview ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '1px' }} />}
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
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {currentTrack && (
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
            disabled={!selectedSong}
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
            <Sparkles size={16} /> Share Note & Play Music
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
            setSelectedSong(song);
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}
