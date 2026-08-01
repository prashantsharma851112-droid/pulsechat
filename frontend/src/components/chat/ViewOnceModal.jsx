import React, { useEffect } from 'react';
import { X, Lock } from 'lucide-react';

export default function ViewOnceModal({ message, onMarkViewed, onClose }) {
  useEffect(() => {
    // Mark as viewed as soon as modal opens
    if (onMarkViewed) {
      onMarkViewed();
    }
  }, []);

  if (!message || !message.mediaUrl) return null;

  const isVideo = message.type === 'video';

  return (
    <div className="incoming-call-overlay" style={{ zIndex: 100000, background: 'rgba(0, 0, 0, 0.95)' }}>
      {/* Top Bar */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '20px' }}>
          <Lock size={16} color="var(--accent)" /> View Once {isVideo ? 'Video' : 'Photo'}
        </div>
        <button onClick={onClose} className="icon-btn-ghost" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '10px' }} title="Close">
          <X size={24} />
        </button>
      </div>

      {/* Content display */}
      <div style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isVideo ? (
          <video
            src={message.mediaUrl}
            autoPlay
            controls
            playsInline
            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px' }}
          />
        ) : (
          <img
            src={message.mediaUrl}
            alt="View Once Media"
            style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px' }}
          />
        )}
      </div>
    </div>
  );
}
