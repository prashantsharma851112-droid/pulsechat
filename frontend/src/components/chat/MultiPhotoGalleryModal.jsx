import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn } from 'lucide-react';
import { useBackHandler } from '../../utils/backNavigation';

export default function MultiPhotoGalleryModal({ photos = [], onClose }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useBackHandler(() => {
    if (selectedPhoto) {
      setSelectedPhoto(null);
    } else {
      onClose();
    }
  }, true);

  if (!photos || photos.length === 0) return null;

  const handleDownload = async (e, url, index) => {
    e.stopPropagation();
    try {
      const targetUrl = url;
      const fileName = `pulsechat_photo_${index + 1}_${Date.now()}.jpg`;
      if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const res = await fetch(targetUrl, { mode: 'cors' });
        const blob = await res.blob();
        const objUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(objUrl), 2000);
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.94)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      {/* Top Header Bar (Instagram Style) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close"
        >
          <X size={26} />
        </button>

        <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>
          {photos.length} Photos
        </span>

        <button
          type="button"
          onClick={(e) => {
            photos.forEach((p, idx) => handleDownload(e, p, idx));
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Download All Photos"
        >
          <Download size={24} />
        </button>
      </div>

      {/* 2-Column Photo Grid (Matching Reference Image 3) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 16px 30px',
          maxWidth: '540px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(2, 1fr)',
            gap: '12px',
            width: '100%'
          }}
        >
          {photos.map((photoUrl, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedPhoto(photoUrl)}
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: '#18181b',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                aspectRatio: '3/4',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <img
                src={photoUrl}
                alt={`Photo ${idx + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
              {/* Individual Download Pill */}
              <button
                type="button"
                onClick={(e) => handleDownload(e, photoUrl, idx)}
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer'
                }}
                title="Download this photo"
              >
                <Download size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Full-Screen Single Photo Lightbox Overlay */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.98)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.15s ease'
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              padding: '8px',
              cursor: 'pointer',
              zIndex: 20
            }}
          >
            <X size={26} />
          </button>
          <img
            src={selectedPhoto}
            alt="Full Preview"
            style={{
              maxWidth: '96vw',
              maxHeight: '92vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
