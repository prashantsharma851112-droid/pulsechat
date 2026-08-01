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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isViewOnce ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isViewOnce ? 'var(--accent)' : 'var(--text-muted)' }}>
              1️⃣
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                View Once Media
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isViewOnce ? 'Recipient can only view this once' : 'Normal media message'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsViewOnce(!isViewOnce)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: isViewOnce ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: isViewOnce ? 'var(--accent)' : 'transparent',
              color: isViewOnce ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isViewOnce ? <Eye size={14} /> : <EyeOff size={14} />}
            {isViewOnce ? '1️⃣ ON' : 'OFF'}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSend({ mediaUrl: mediaFile.dataUrl, type: isVideo ? 'video' : 'image', isViewOnce })}
          >
            <Send size={16} /> Send {isViewOnce ? 'View Once' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
