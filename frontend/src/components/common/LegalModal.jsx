import React from 'react';
import LegalView from './LegalView';

export default function LegalModal({ initialTab = 'privacy', onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0a0d14',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <LegalView initialTab={initialTab} onClose={onClose} />
    </div>
  );
}
