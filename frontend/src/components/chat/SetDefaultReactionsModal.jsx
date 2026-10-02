import React, { useState } from 'react';
import { X, RotateCcw, Check, Sparkles } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import { DEFAULT_QUICK_REACTIONS, getSavedQuickReactions, saveDefaultQuickReactions } from '../../utils/quickReactions';

export default function SetDefaultReactionsModal({ onClose, onSaved }) {
  const [reactions, setReactions] = useState(() => getSavedQuickReactions());
  const [activeSlot, setActiveSlot] = useState(0);

  const handleSelectEmoji = (emoji) => {
    setReactions(prev => {
      const next = [...prev];
      next[activeSlot] = emoji;
      return next;
    });
    // Move to next slot automatically
    setActiveSlot(prev => (prev + 1) % 7);
  };

  const handleReset = () => {
    setReactions([...DEFAULT_QUICK_REACTIONS]);
    setActiveSlot(0);
  };

  const handleSave = () => {
    saveDefaultQuickReactions(reactions);
    if (onSaved) onSaved(reactions);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        style={{
          maxWidth: '420px',
          width: '92vw',
          maxHeight: '85vh',
          padding: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={17} color="var(--accent)" />
              <span>Customize Reaction Emojis</span>
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Select a slot, then choose your default emoji below
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn-ghost"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* 7 Slots Row */}
        <div style={{ padding: '14px 18px', background: 'rgba(99, 102, 241, 0.08)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            {reactions.slice(0, 7).map((emoji, idx) => {
              const isActive = activeSlot === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlot(idx)}
                  style={{
                    flex: 1,
                    aspectRatio: '1/1',
                    maxHeight: '46px',
                    borderRadius: '12px',
                    border: isActive ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                    background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)',
                    fontSize: '1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none'
                  }}
                  title={`Slot ${idx + 1}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--accent)', marginTop: '8px', fontWeight: 600 }}>
            Editing Slot {activeSlot + 1} of 7
          </div>
        </div>

        {/* Emoji Grid Container */}
        <div style={{ flex: 1, minHeight: '300px', maxHeight: '360px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
          <EmojiPicker
            onSelectEmoji={handleSelectEmoji}
            inline={true}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              style={{ padding: '6px 18px', fontSize: '0.8rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={14} />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
