import React, { useEffect, useState } from 'react';

// A small popup that appears top-right and fades out on its own.
// This is how you find out someone messaged you even if you never
// searched for them - it fires off the global socket notification,
// not from anything tied to a specific open chat.
export default function Toast({ title, body, avatar, onClick, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => setVisible(false), 4500);
    const removeTimer = setTimeout(() => onDismiss(), 4800);
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
        padding: '10px 14px',
        borderRadius: '14px',
        maxWidth: '320px',
        minWidth: '240px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Sender Avatar */}
      <div style={{ flexShrink: 0, position: 'relative' }}>
        {avatar ? (
          <img
            src={avatar}
            alt={title}
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
            }}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent)' }}
          />
        ) : null}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: '#fff',
            display: avatar ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1rem',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
          }}
        >
          {title ? title.replace(/^[^\w\d]+/, '').charAt(0).toUpperCase() || '⚡' : '⚡'}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {body}
        </div>
      </div>
    </div>
  );
}
