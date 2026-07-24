import React, { useEffect, useState } from 'react';

// A small popup that appears top-right and fades out on its own.
// This is how you find out someone messaged you even if you never
// searched for them - it fires off the global socket notification,
// not from anything tied to a specific open chat.
export default function Toast({ title, body, onClick, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => setVisible(false), 4000);
    const removeTimer = setTimeout(() => onDismiss(), 4300);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [onDismiss]);

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--accent)',
        padding: '12px 16px',
        borderRadius: '10px',
        maxWidth: '280px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 0.25s ease'
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '3px' }}>{title}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{body}</div>
    </div>
  );
}
