import React, { useState, useEffect, useContext } from 'react';
import { X, Zap, Battery, Sparkles, Check, Trash2, Music, Play, Pause, Disc } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { useAppMusic } from '../../context/AppMusicContext';
import MusicPickerModal from '../vibes/MusicPickerModal';
import { updateUserProfileInStorage } from '../../utils/offlineStorage';

const PRESET_AURAS = [
  { id: 'lofi', mood: 'Listening to Lofi', emoji: '🎧', auraColor: '#a855f7', auraType: 'violet_wave' },
  { id: 'gaming', mood: 'Temple Run 3D', emoji: '🎮', auraColor: '#06b6d4', auraType: 'cyan_neon', inGame: 'Temple Run 3D' },
  { id: 'chai', mood: 'Chai Break', emoji: '☕', auraColor: '#f59e0b', auraType: 'amber_glow' },
  { id: 'nightowl', mood: 'Night Owl Club', emoji: '🌙', auraColor: '#6366f1', auraType: 'moonlight' },
  { id: 'gym', mood: 'Gym Beast', emoji: '💪', auraColor: '#ef4444', auraType: 'fire_red' },
  { id: 'focus', mood: 'In Deep Focus', emoji: '⚡', auraColor: '#10b981', auraType: 'emerald_pulse' },
  { id: 'dnd', mood: 'Do Not Disturb', emoji: '🤫', auraColor: '#64748b', auraType: 'slate_stealth' }
];

export default function VibeAuraSelectorModal({
  currentUserId,
  currentAura,
  onAuraUpdated,
  onClose
}) {
  const { socket } = useContext(SocketContext);
  const { user, updateUserProfile } = useContext(AuthContext);
  const { currentTrack, saveMusicNote, deleteMusicNote } = useAppMusic();

  const effectiveUserId = currentUserId || user?.id || user?._id;
  const [selectedMood, setSelectedMood] = useState(currentAura?.mood || '');
  const [selectedEmoji, setSelectedEmoji] = useState(currentAura?.emoji || '⚡');
  const [selectedColor, setSelectedColor] = useState(currentAura?.auraColor || '#a855f7');
  const [isLowBattery, setIsLowBattery] = useState(Boolean(currentAura?.isLowBattery));
  const [detectedBattery, setDetectedBattery] = useState(null);

  // App Background Music State
  const [attachedSong, setAttachedSong] = useState(currentTrack || null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const stopPreview = () => {
    if (previewAudio) {
      try {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      } catch (e) {}
    }
    setIsPlayingPreview(false);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [previewAudio]);

  const handleTogglePreview = (e) => {
    if (e) e.stopPropagation();
    if (!attachedSong?.audioUrl) return;

    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      if (previewAudio) {
        previewAudio.play().then(() => setIsPlayingPreview(true)).catch(() => {});
      } else {
        const a = new Audio(attachedSong.audioUrl);
        a.onended = () => setIsPlayingPreview(false);
        a.play().then(() => setIsPlayingPreview(true)).catch(() => {});
        setPreviewAudio(a);
      }
    }
  };

  // Auto-detect Battery Level if API is available (only for display, do not force enable)
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        const levelPct = Math.round(battery.level * 100);
        setDetectedBattery(levelPct);
      }).catch(() => {});
    }
  }, []);

  const handleSelectPreset = (preset) => {
    setSelectedMood(preset.mood);
    setSelectedEmoji(preset.emoji);
    setSelectedColor(preset.auraColor);
  };

  const handleSave = () => {
    if (!effectiveUserId) return;
    stopPreview();

    const hasBattery = Boolean(isLowBattery);
    const trimmedMood = (selectedMood || '').trim();
    const hasMood = Boolean(trimmedMood);

    // If both mood, battery, and attached song are off, treat as clear!
    if (!hasBattery && !hasMood && !attachedSong) {
      handleClear();
      return;
    }

    const isActuallyLow = hasBattery && detectedBattery && detectedBattery <= 20;
    const auraData = {
      userId: effectiveUserId,
      mood: trimmedMood,
      emoji: selectedEmoji || '⚡',
      auraColor: isActuallyLow ? '#ef4444' : selectedColor,
      auraType: isActuallyLow ? 'low_battery' : 'neon_pulse',
      isLowBattery: hasBattery,
      batteryLevel: hasBattery ? (detectedBattery !== null ? detectedBattery : 20) : null,
      inGame: trimmedMood.includes('Temple Run') ? 'Temple Run 3D' : '',
      music: attachedSong || null
    };

    if (socket) {
      socket.emit('update_vibe_aura', auraData);
    }
    if (typeof updateUserProfile === 'function') {
      updateUserProfile({ ...user, vibeAura: auraData });
    }
    try {
      updateUserProfileInStorage(effectiveUserId, { vibeAura: auraData }, effectiveUserId);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
        detail: { targetUserId: effectiveUserId, updates: { vibeAura: auraData } }
      }));
    }

    // Save and Play App-Wide Background Music!
    if (attachedSong) {
      saveMusicNote(attachedSong, trimmedMood);
    } else if (currentTrack) {
      deleteMusicNote();
    }

    if (onAuraUpdated) onAuraUpdated(auraData);
    onClose();
  };

  const handleClear = () => {
    if (!effectiveUserId) return;
    stopPreview();

    const clearData = {
      userId: effectiveUserId,
      mood: '',
      emoji: '',
      auraColor: null,
      auraType: 'none',
      isLowBattery: false,
      batteryLevel: null,
      inGame: '',
      cleared: true,
      music: null
    };
    if (socket) {
      socket.emit('update_vibe_aura', clearData);
    }
    if (typeof updateUserProfile === 'function') {
      updateUserProfile({ ...user, vibeAura: null });
    }
    try {
      updateUserProfileInStorage(effectiveUserId, { vibeAura: null }, effectiveUserId);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
        detail: { targetUserId: effectiveUserId, updates: { vibeAura: null } }
      }));
    }

    deleteMusicNote();
    if (onAuraUpdated) onAuraUpdated(null);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(16, 185, 129, 0.25)',
        color: '#fff',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1.5px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>
                Pulse Vibe & Live Aura
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#9ca3af' }}>
                Show your friends your mood & battery vibe!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#9ca3af',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Battery Alert Toggle */}
        <div style={{
          background: isLowBattery ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.04)',
          border: isLowBattery ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }} onClick={() => setIsLowBattery(!isLowBattery)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>{isLowBattery ? '⚡' : '🪫'}</span>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: isLowBattery ? '#fbbf24' : '#fff' }}>
                Share Battery on DP: <span style={{ color: isLowBattery ? '#10b981' : '#ef4444' }}>{isLowBattery ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                {detectedBattery ? `Current: ${detectedBattery}%. ${isLowBattery ? 'Shows battery pill on your avatar.' : 'Hidden from everyone.'}` : 'Shows battery percentage badge on your avatar.'}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isLowBattery}
            onChange={() => {}}
            style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </div>

        {/* Preset Aura Cards */}
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 800, marginBottom: '10px' }}>
          CHOOSE YOUR CURRENT VIBE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
          {PRESET_AURAS.map(preset => {
            const isSelected = selectedMood === preset.mood && !isLowBattery;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? `2px solid ${preset.auraColor}` : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{preset.emoji}</span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {preset.mood}
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: preset.auraColor, marginTop: '3px' }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Mood Input */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 800, display: 'block', marginBottom: '6px' }}>
            OR TYPE CUSTOM MOOD
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. Cooking Maggie, Coding..."
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '0.86rem'
              }}
            />
            <input
              type="text"
              value={selectedEmoji}
              onChange={(e) => setSelectedEmoji(e.target.value)}
              style={{
                width: '46px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '10px',
                color: '#fff',
                textAlign: 'center',
                fontSize: '1.1rem'
              }}
            />
          </div>
        </div>

        {/* Instagram Music Note Attachment */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Music size={13} color="#a855f7" />
              <span>MUSIC NOTE (TAP TO PLAY)</span>
            </label>
            {attachedSong && (
              <span style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 700 }}>
                ● Plays on tap (Instagram style)
              </span>
            )}
          </div>

          {!attachedSong ? (
            <button
              type="button"
              onClick={() => setShowMusicPicker(true)}
              style={{
                width: '100%',
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1.5px dashed rgba(168, 85, 247, 0.4)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#c084fc',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Music size={16} />
              <span>+ Attach Music to Note</span>
            </button>
          ) : (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: '14px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                  <img
                    src={attachedSong.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}
                    alt="Album"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title={isPlayingPreview ? "Pause Preview" : "Preview Track"}
                  >
                    {isPlayingPreview ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
                  </button>
                </div>

                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {attachedSong.songTitle}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {attachedSong.artistName || 'Pulse Music'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowMusicPicker(true)}
                  style={{
                    background: 'rgba(168, 85, 247, 0.18)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    color: '#c084fc',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    setAttachedSong(null);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '4px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Remove Music"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleClear}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '14px',
              padding: '12px',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Clear Aura & Music"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={handleSave}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '14px',
              padding: '12px',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
            }}
          >
            <Check size={18} />
            <span>Broadcast My Aura</span>
          </button>
        </div>
      </div>

      {showMusicPicker && (
        <MusicPickerModal
          isOpen={showMusicPicker}
          onClose={() => setShowMusicPicker(false)}
          selectedSong={attachedSong}
          onSelectSong={(song) => {
            stopPreview();
            setAttachedSong(song);
            setShowMusicPicker(false);
          }}
        />
      )}
    </div>
  );
}
