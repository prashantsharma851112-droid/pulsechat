import React, { useState } from 'react';
import { X, Send, Eye, EyeOff } from 'lucide-react';

export default function MediaUploadModal({ mediaFile, onSend, onClose }) {
  const [isViewOnce, setIsViewOnce] = useState(false);
  const isVideo = mediaFile?.type?.startsWith('video/');

  if (!mediaFile) return null;

  return (
    <div className="incoming-call-overlay" style={{ zIndex: 10000 }}>
      <div className="incoming-call-card" style={{ maxWidth: '440px', width: '92%', padding: '1.5rem', background: 'var(--bg-sidebar)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {isVideo ? 'Send Video' : 'Send Photo'}
          </h3>
          <button onClick={onClose} className="icon-btn-ghost" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Media Preview Container */}
        <div style={{ width: '100%', maxHeight: '280px', borderRadius: '14px', overflow: 'hidden', background: '#000', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo ? (
            <video src={mediaFile.dataUrl} controls style={{ maxWidth: '100%', maxHeight: '280px' }} />
          ) : (
            <img src={mediaFile.dataUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} />
          )}
        </div>

        {/* View Once Option Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isViewOnce && !isFogSnap ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isViewOnce && !isFogSnap ? 'var(--accent)' : 'var(--text-muted)' }}>
              1️⃣
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                View Once Media
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isViewOnce && !isFogSnap ? 'Recipient can only view this once' : 'Normal media message'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsViewOnce(!isViewOnce);
              if (isFogSnap) setIsFogSnap(false);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: isViewOnce && !isFogSnap ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: isViewOnce && !isFogSnap ? 'var(--accent)' : 'transparent',
              color: isViewOnce && !isFogSnap ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isViewOnce && !isFogSnap ? <Eye size={14} /> : <EyeOff size={14} />}
            {isViewOnce && !isFogSnap ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Option 2: Secret Fog Snap (Scratch-to-Reveal) Toggle */}
        {!isVideo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isFogSnap ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card)', borderRadius: '12px', marginBottom: '1.25rem', border: isFogSnap ? '1.5px solid #f59e0b' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFogSnap ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                🌫️
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isFogSnap ? '#fbbf24' : 'var(--text-main)' }}>
                  Secret Fog Snap
                </div>
                <div style={{ fontSize: '0.74rem', color: isFogSnap ? '#fed7aa' : 'var(--text-muted)' }}>
                  {isFogSnap ? 'Scratch-to-reveal + 7s auto-evaporate + screenshot alert!' : 'Cover with scratchable frosted mist'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !isFogSnap;
                setIsFogSnap(next);
                if (next) setIsViewOnce(true);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: isFogSnap ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                background: isFogSnap ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : 'transparent',
                color: isFogSnap ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isFogSnap ? '🌫️ ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{
              background: isFogSnap ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : undefined
            }}
            onClick={() => onSend({
              mediaUrl: mediaFile.dataUrl,
              type: isVideo ? 'video' : 'image',
              isViewOnce: isViewOnce || isFogSnap,
              isFogSnap,
              fogSnapDuration: 7,
              fileName: mediaFile.fileName,
              fileSize: mediaFile.fileSize
            })}
          >
            <Send size={16} /> Send {isFogSnap ? 'Fog Snap 🌫️' : (isViewOnce ? 'View Once' : '')}
          </button>
        </div>
      </div>
    </div>
  );
}
