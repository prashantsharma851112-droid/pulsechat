import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

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

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!mediaFile) return null;

  const handleConfirmSend = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
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

  const getModeLabel = () => {
    switch (viewMode) {
      case 'once': return 'View Once (1x)';
      case 'twice': return 'Twice View (2x)';
      case 'dust': return 'Dust Image (10s Auto-Burn)';
      default: return 'Standard Media';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#0b141a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none'
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 10
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Cancel"
        >
          <X size={22} />
        </button>

        {/* Selected Mode Pill Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: viewMode === 'dust'
              ? 'rgba(245, 158, 11, 0.22)'
              : (viewMode === 'twice'
                ? 'rgba(14, 165, 233, 0.22)'
                : (viewMode === 'once'
                  ? 'rgba(168, 85, 247, 0.22)'
                  : 'rgba(255, 255, 255, 0.12)')),
            border: `1px solid ${
              viewMode === 'dust'
                ? '#f59e0b'
                : (viewMode === 'twice'
                  ? '#0ea5e9'
                  : (viewMode === 'once'
                    ? '#a855f7'
                    : 'rgba(255, 255, 255, 0.2)'))
            }`,
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 700
          }}
        >
          <span>
            {viewMode === 'dust' ? '🌫️' : (viewMode === 'twice' ? '②' : (viewMode === 'once' ? '①' : '⚪'))}
          </span>
          <span>{getModeLabel()}</span>
        </div>
      </div>

      {/* Main Preview Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {isVideo ? (
          <video
            src={mediaFile.dataUrl}
            controls
            playsInline
            style={{
              maxWidth: '100%',
              maxHeight: '74vh',
              objectFit: 'contain',
              borderRadius: '12px'
            }}
          />
        ) : (
          <img
            src={mediaFile.dataUrl}
            alt="Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '74vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
          />
        )}
      </div>

      {/* WhatsApp-Style Bottom Control Bar */}
      <div
        style={{
          padding: '16px 20px 24px 20px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 10
        }}
      >
        {/* Mode Selector Icons (Normal, Once, Twice, Dust) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '6px 10px',
            borderRadius: '28px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }}
        >
          {/* 1. Normal Mode Button */}
          <button
            type="button"
            onClick={() => setViewMode('normal')}
            title="Standard photo"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: viewMode === 'normal' ? '2px solid #ffffff' : '1.5px solid transparent',
              background: viewMode === 'normal' ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
          >
            ⚪
          </button>

          {/* 2. Once View (① WhatsApp style) */}
          <button
            type="button"
            onClick={() => setViewMode('once')}
            title="WhatsApp View Once (1x)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: viewMode === 'once' ? '2.5px solid #a855f7' : '1.5px solid rgba(255, 255, 255, 0.3)',
              background: viewMode === 'once' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
              color: '#ffffff',
              fontSize: '1.05rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              boxShadow: viewMode === 'once' ? '0 0 14px rgba(168, 85, 247, 0.6)' : 'none'
            }}
          >
            ①
          </button>

          {/* 3. Twice View (② WhatsApp style) */}
          <button
            type="button"
            onClick={() => setViewMode('twice')}
            title="WhatsApp Twice View (2x)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: viewMode === 'twice' ? '2.5px solid #0ea5e9' : '1.5px solid rgba(255, 255, 255, 0.3)',
              background: viewMode === 'twice' ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : 'transparent',
              color: '#ffffff',
              fontSize: '1.05rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              boxShadow: viewMode === 'twice' ? '0 0 14px rgba(14, 165, 233, 0.6)' : 'none'
            }}
          >
            ②
          </button>

          {/* 4. Dust Image (🌫️ - Photos only) */}
          {!isVideo && (
            <button
              type="button"
              onClick={() => setViewMode('dust')}
              title="Dust Image (10s auto-burn on both sides)"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: viewMode === 'dust' ? '2.5px solid #f59e0b' : '1.5px solid rgba(255, 255, 255, 0.3)',
                background: viewMode === 'dust' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                color: '#ffffff',
                fontSize: '1.05rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: viewMode === 'dust' ? '0 0 14px rgba(245, 158, 11, 0.6)' : 'none'
              }}
            >
              🌫️
            </button>
          )}
        </div>

        {/* WhatsApp-Style Circular Send Button */}
        <button
          type="button"
          onClick={handleConfirmSend}
          disabled={isSubmitting}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            border: 'none',
            background: '#25D366',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            boxShadow: '0 4px 16px rgba(37, 211, 102, 0.45)',
            transition: 'transform 0.15s ease'
          }}
          title="Send"
        >
          <Send size={22} style={{ marginLeft: '2px' }} />
        </button>
      </div>
    </div>
  );
}
