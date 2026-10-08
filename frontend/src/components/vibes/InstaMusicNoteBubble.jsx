import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useAppMusic } from '../../context/AppMusicContext';
import { Music, Play, Pause, Disc, Edit3, Trash2, X } from 'lucide-react';

export default function InstaMusicNoteBubble({ onOpenPicker, note, isMine = true }) {
  const { user } = useContext(AuthContext);
  const { deleteMusicNote } = useAppMusic();

  const activeNote = isMine ? (note || user?.musicNote) : note;
  const [showOptions, setShowOptions] = useState(false);
  const [isPlayingNote, setIsPlayingNote] = useState(false);
  const noteAudioRef = useRef(null);

  const stopNoteAudio = () => {
    if (noteAudioRef.current) {
      try {
        noteAudioRef.current.pause();
        noteAudioRef.current.currentTime = 0;
        noteAudioRef.current = null;
      } catch (e) {}
    }
    setIsPlayingNote(false);
  };

  // Close audio on unmount
  useEffect(() => {
    return () => {
      stopNoteAudio();
    };
  }, []);

  // Close audio when user taps anywhere outside (Instagram Note style!)
  useEffect(() => {
    if (!isPlayingNote) return;
    const handleOutsideClick = () => {
      stopNoteAudio();
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isPlayingNote]);

  // Listen to cross-note coordinator so only 1 note audio plays at a time
  useEffect(() => {
    const handleStopOtherNotes = (e) => {
      if (e.detail?.source !== noteAudioRef.current) {
        stopNoteAudio();
      }
    };
    window.addEventListener('pulsechat_stop_all_note_audios', handleStopOtherNotes);
    return () => {
      window.removeEventListener('pulsechat_stop_all_note_audios', handleStopOtherNotes);
    };
  }, []);

  const handleTogglePlayNote = (e) => {
    e.stopPropagation();

    if (isPlayingNote) {
      stopNoteAudio();
      return;
    }

    if (!activeNote?.audioUrl) return;

    // Stop any other active note snippet
    window.dispatchEvent(new CustomEvent('pulsechat_stop_all_note_audios'));

    try {
      const audio = new Audio(activeNote.audioUrl);
      audio.volume = 0.85;

      audio.onended = () => {
        setIsPlayingNote(false);
        noteAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlayingNote(false);
        noteAudioRef.current = null;
      };

      audio.play().then(() => {
        setIsPlayingNote(true);
      }).catch((err) => {
        console.warn('Note audio play prevented:', err);
        setIsPlayingNote(false);
      });

      noteAudioRef.current = audio;
    } catch (err) {
      console.warn('Failed to start note audio:', err);
    }
  };

  // If viewing own avatar and no note is set yet -> "+ Note" Instagram prompt
  if (!activeNote || !activeNote.songTitle) {
    if (!isMine) return null;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenPicker && onOpenPicker();
        }}
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 15,
          cursor: 'pointer',
          animation: 'fadeIn 0.2s ease-out'
        }}
        title="Add Music Note"
      >
        <div style={{
          background: 'rgba(24, 24, 32, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '14px',
          padding: '2px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap'
        }}>
          <Music size={11} color="#a855f7" />
          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#e2e8f0' }}>
            + Note
          </span>
        </div>
        {/* Cute Speech Bubble Tail */}
        <div style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '5px solid rgba(24, 24, 32, 0.94)',
          margin: '-1px auto 0 auto'
        }} />
      </div>
    );
  }

  const hasText = Boolean(activeNote.noteText && activeNote.noteText.trim());
  const hasSong = Boolean(activeNote.songTitle && activeNote.songTitle.trim());

  // Active Music Note Bubble (Instagram-style: Tap to hear snippet, tap again / outside to stop!)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 15,
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto'
      }}
      onClick={handleTogglePlayNote}
      onContextMenu={(e) => {
        if (!isMine) return;
        e.preventDefault();
        e.stopPropagation();
        setShowOptions(true);
      }}
      title={`${hasText ? activeNote.noteText + ' · ' : ''}${activeNote.songTitle || ''} (Tap to listen/stop)`}
    >
      <div style={{
        background: isPlayingNote
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.96), rgba(168, 85, 247, 0.96))'
          : 'rgba(20, 20, 28, 0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: isPlayingNote ? '1.5px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px',
        padding: hasText && hasSong ? '4px 8px' : '3px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        boxShadow: isPlayingNote
          ? '0 4px 14px rgba(168, 85, 247, 0.5), 0 0 10px rgba(168, 85, 247, 0.4)'
          : '0 4px 10px rgba(0,0,0,0.5)',
        maxWidth: '145px',
        transition: 'all 0.2s ease'
      }}>
        {/* Top: Thought / Vibe text (if any) */}
        {hasText && (
          <div style={{
            fontSize: '0.64rem',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.15,
            textAlign: 'center',
            maxWidth: '135px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {activeNote.noteText}
          </div>
        )}

        {/* Bottom / Main: Song Title Pill */}
        {hasSong && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            maxWidth: '135px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {isPlayingNote ? (
                <Disc size={12} color="#ffffff" style={{ animation: 'spin 2.5s linear infinite' }} />
              ) : (
                <Music size={10} color="#c084fc" />
              )}
            </div>

            <span style={{
              fontSize: '0.60rem',
              fontWeight: 600,
              color: isPlayingNote ? '#ffffff' : '#cbd5e1',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.1
            }}>
              {activeNote.songTitle}
            </span>

            {/* Mini Edit / Delete Options button for Owner */}
            {isMine && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptions(prev => !prev);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: 'rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  marginLeft: '2px'
                }}
                title="Note Options"
              >
                <Edit3 size={9} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bubble Tail */}
      <div style={{
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: isPlayingNote ? '5px solid rgba(168, 85, 247, 0.95)' : '5px solid rgba(20, 20, 28, 0.94)',
        margin: '-1px auto 0 auto'
      }} />

      {/* Options Dropdown Menu for Owner */}
      {isMine && showOptions && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 15, 22, 0.96)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '120px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setShowOptions(false);
              stopNoteAudio();
              onOpenPicker && onOpenPicker();
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.72rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Edit3 size={12} color="var(--accent)" /> Change Music
          </button>
          <button
            type="button"
            onClick={() => {
              setShowOptions(false);
              stopNoteAudio();
              deleteMusicNote();
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              fontSize: '0.72rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Trash2 size={12} /> Remove Note
          </button>
          <button
            type="button"
            onClick={() => setShowOptions(false)}
            style={{
              padding: '4px 8px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
