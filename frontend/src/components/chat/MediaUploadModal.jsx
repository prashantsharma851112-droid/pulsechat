import React, { useState } from 'react';
import { X, Send, Eye, Shield, Sparkles } from 'lucide-react';

export default function MediaUploadModal({ mediaFile, onSend, onClose }) {
  const isVideo = mediaFile?.type?.startsWith('video/');

  // Initial mode can be 'dust', 'twice', 'once', or 'normal'
  const [viewMode, setViewMode] = useState(() => {
    if (mediaFile?.initialMode) {
      if (mediaFile.initialMode === 'dust' && isVideo) return 'once';
      return mediaFile.initialMode;
    }
    return 'normal';
  });

  if (!mediaFile) return null;

  const handleConfirmSend = () => {
    const isDust = viewMode === 'dust' && !isVideo;
    const isTwice = viewMode === 'twice';
    const isOnce = viewMode === 'once';

    onSend({
      mediaUrl: mediaFile.dataUrl,
      rawFile: mediaFile.file,
      type: isVideo ? 'video' : 'image',
      isViewOnce: isOnce || isTwice || isDust,
      isViewTwice: isTwice,
      viewLimit: isTwice ? 2 : 1,
      isFogSnap: isDust,
      isDustImage: isDust,
      fogSnapDuration: 10,
      fileName: mediaFile.fileName,
      fileSize: mediaFile.fileSize,
      rawSizeBytes: mediaFile.rawSizeBytes
    });
  };

  return (
    <div className="incoming-call-overlay" style={{ zIndex: 10000 }}>
      <div className="incoming-call-card" style={{ maxWidth: '440px', width: '92%', padding: '1.25rem', background: 'var(--bg-sidebar)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {viewMode === 'dust' ? '🌫️' : (viewMode === 'twice' ? '2️⃣' : (viewMode === 'once' ? '1️⃣' : '📷'))}
            </span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isVideo ? 'Send Video' : 'Send Photo'}
            </h3>
          </div>
          <button onClick={onClose} className="icon-btn-ghost" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Media Preview Container */}
        <div style={{ width: '100%', maxHeight: '250px', borderRadius: '16px', overflow: 'hidden', background: '#0a0a0f', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
          {isVideo ? (
            <video src={mediaFile.dataUrl} controls style={{ maxWidth: '100%', maxHeight: '250px' }} />
          ) : (
            <img src={mediaFile.dataUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }} />
          )}

          {viewMode === 'dust' && (
            <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={12} /> SCRATCH DUST LAYER ACTIVE
            </div>
          )}
          {viewMode === 'twice' && (
            <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={12} /> 2X TWICE VIEW ACTIVE
            </div>
          )}
          {viewMode === 'once' && (
            <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', color: '#a855f7', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Eye size={12} /> 1X VIEW ONCE ACTIVE
            </div>
          )}
        </div>

        {/* Mode Selector Pill Buttons */}
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Privacy & View Mode
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isVideo ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '6px' }}>
            {/* 1. Normal */}
            <button
              type="button"
              onClick={() => setViewMode('normal')}
              style={{
                padding: '7px 4px',
                borderRadius: '12px',
                border: viewMode === 'normal' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: viewMode === 'normal' ? 'var(--accent)' : 'var(--bg-card)',
                color: viewMode === 'normal' ? '#fff' : 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>⚪</span>
              <span>Normal</span>
            </button>

            {/* 2. View Once */}
            <button
              type="button"
              onClick={() => setViewMode('once')}
              style={{
                padding: '7px 4px',
                borderRadius: '12px',
                border: viewMode === 'once' ? '1.5px solid #a855f7' : '1px solid var(--border)',
                background: viewMode === 'once' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'var(--bg-card)',
                color: viewMode === 'once' ? '#fff' : 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>1️⃣</span>
              <span>Once</span>
            </button>

            {/* 3. Twice View */}
            <button
              type="button"
              onClick={() => setViewMode('twice')}
              style={{
                padding: '7px 4px',
                borderRadius: '12px',
                border: viewMode === 'twice' ? '1.5px solid #0ea5e9' : '1px solid var(--border)',
                background: viewMode === 'twice' ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : 'var(--bg-card)',
                color: viewMode === 'twice' ? '#fff' : 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>2️⃣</span>
              <span>Twice</span>
            </button>

            {/* 4. Dust Image (Photos only) */}
            {!isVideo && (
              <button
                type="button"
                onClick={() => setViewMode('dust')}
                style={{
                  padding: '7px 4px',
                  borderRadius: '12px',
                  border: viewMode === 'dust' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                  background: viewMode === 'dust' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--bg-card)',
                  color: viewMode === 'dust' ? '#fff' : 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <span>🌫️</span>
                <span>Dust Img</span>
              </button>
            )}
          </div>

          {/* Mode Description Banner */}
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            fontSize: '0.73rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            {viewMode === 'normal' && (
              <span>⚪ <b>Standard Message</b>: Stored in chat history for normal viewing.</span>
            )}
            {viewMode === 'once' && (
              <span style={{ color: '#c084fc' }}>1️⃣ <b>WhatsApp View Once</b>: Recipient can open only 1 time. Disappears immediately after viewing with anti-screenshot lock.</span>
            )}
            {viewMode === 'twice' && (
              <span style={{ color: '#38bdf8' }}>2️⃣ <b>WhatsApp Twice View</b>: Recipient can open 2 times before it locks permanently. Anti-screenshot protected.</span>
            )}
            {viewMode === 'dust' && (
              <span style={{ color: '#fbbf24' }}>🌫️ <b>Scratch Dust Image</b>: Covered with frosted dust! Recipient gently scratches the mist with finger/mouse to reveal photo.</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={onClose} style={{ borderRadius: '14px', padding: '8px 16px', fontSize: '0.84rem' }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{
              borderRadius: '14px',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: viewMode === 'dust'
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : (viewMode === 'twice'
                    ? 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                    : (viewMode === 'once'
                        ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                        : undefined))
            }}
            onClick={handleConfirmSend}
          >
            <Send size={15} />
            <span>
              {viewMode === 'dust'
                ? 'Send Dust Image 🌫️'
                : (viewMode === 'twice'
                    ? 'Send Twice View 2️⃣'
                    : (viewMode === 'once'
                        ? 'Send View Once 1️⃣'
                        : 'Send Media'))}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
