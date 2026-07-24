import React from 'react';

const EMOJIS = ['😊', '😂', '😍', '🔥', '👍', '❤️', '🙌', '🎉', '😎', '🙏', '💯', '🚀', '✨', '💡', '😴', '🥳'];

export default function EmojiPicker({ onSelectEmoji, onClose }) {
  return (
    <div style={{ position: 'absolute', bottom: '60px', left: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', zIndex: 100, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
      {EMOJIS.map(emoji => (
        <span key={emoji} onClick={() => { onSelectEmoji(emoji); onClose(); }} style={{ fontSize: '1.5rem', cursor: 'pointer', textAlign: 'center' }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}
