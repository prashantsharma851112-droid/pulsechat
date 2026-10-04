import React, { useState, useEffect, useContext } from 'react';
import { X, Zap, Battery, Sparkles, Check, Trash2 } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';

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
  const { user } = useContext(AuthContext);
  const effectiveUserId = currentUserId || user?.id || user?._id;
  const [selectedMood, setSelectedMood] = useState(currentAura?.mood || '');
  const [selectedEmoji, setSelectedEmoji] = useState(currentAura?.emoji || '⚡');
  const [selectedColor, setSelectedColor] = useState(currentAura?.auraColor || '#10b981');
  const [isLowBattery, setIsLowBattery] = useState(Boolean(currentAura?.isLowBattery));
  const [detectedBattery, setDetectedBattery] = useState(null);

  // Auto-detect Battery Level if API is available
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        const levelPct = Math.round(battery.level * 100);
        setDetectedBattery(levelPct);
        if (levelPct <= 15 && !currentAura?.isLowBattery) {
          // Suggest low battery mode
          setIsLowBattery(true);
        }
      }).catch(() => {});
    }
  }, [currentAura]);

  const handleSelectPreset = (preset) => {
    setSelectedMood(preset.mood);
    setSelectedEmoji(preset.emoji);
    setSelectedColor(preset.auraColor);
    setIsLowBattery(false);
  };

  const handleSave = () => {
    if (!effectiveUserId) return;
    const auraData = {
      userId: effectiveUserId,
      mood: selectedMood,
      emoji: selectedEmoji,
      auraColor: selectedColor,
      auraType: 'neon_pulse',
      isLowBattery,
      batteryLevel: isLowBattery ? (detectedBattery || 12) : null,
      inGame: selectedMood.includes('Temple Run') ? 'Temple Run 3D' : ''
    };

    if (socket) {
      socket.emit('update_vibe_aura', auraData);
    }
    if (onAuraUpdated) onAuraUpdated(auraData);
    onClose();
  };

  const handleClear = () => {
    if (!effectiveUserId) return;
    const clearData = {
      userId: effectiveUserId,
      mood: '',
      emoji: '',
      auraColor: '#10b981',
      auraType: 'none',
      isLowBattery: false,
      batteryLevel: null,
      inGame: ''
    };
    if (socket) {
      socket.emit('update_vibe_aura', clearData);
    }
    if (onAuraUpdated) onAuraUpdated(clearData);
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
          background: isLowBattery ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
          border: isLowBattery ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }} onClick={() => setIsLowBattery(!isLowBattery)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🪫</span>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: isLowBattery ? '#fbbf24' : '#fff' }}>
                Low Battery Alert Aura
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                {detectedBattery ? `Current battery: ${detectedBattery}%` : 'Pulses amber aura when phone is dying'}
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
            title="Clear Aura"
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
    </div>
  );
}
