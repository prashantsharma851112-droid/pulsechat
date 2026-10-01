import React from 'react';
import LegalView from './LegalView';
import { X } from 'lucide-react';

export default function LegalModal({ initialTab = 'privacy', onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        height: '90vh',
        backgroundColor: '#0a0d14',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0f172a'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <X size={16} /> Close
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <LegalView initialTab={initialTab} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
