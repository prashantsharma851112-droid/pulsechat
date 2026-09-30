import React, { useState, useMemo } from 'react';
import { Search, X, Flame, Heart, Smile, ThumbsUp, Coffee, Cat } from 'lucide-react';

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
      '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
      '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
      '💀', '☠️', '💩', '🤡', '👻', '👽', '👾', '🤖'
    ]
  },
  {
    id: 'hype',
    name: 'Hype & Vibes',
    icon: Flame,
    emojis: [
      '🔥', '⚡', '✨', '💥', '💯', '🌟', '💫', '🌠', '🌌', '🚀', '🛸', '🏆', '👑',
      '💎', '🎉', '🎊', '🎈', '🍾', '🥂', '🍻', '🍺', '🍸', '🍹', '🍷', '🎯', '🎲',
      '🎰', '🎮', '🕹️', '🎧', '🎤', '🎬', '🎨', '🎪', '🎭', '🥊', '⚽', '🏀', '🏈',
      '⚾', '🎾', '🥇', '🥈', '🥉', '🔔', '📣', '📢', '💰', '💵', '💸', '💳'
    ]
  },
  {
    id: 'love',
    name: 'Hearts & Love',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '💌', '🫀', '💏', '👩‍❤️‍👨', '👩‍❤️‍👩', '👨‍❤️‍👨',
      '👩‍❤️‍💋‍👨', '👩‍❤️‍💋‍👩', '👨‍❤️‍💋‍👨', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '💐', '🌷'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
      '👂', '👃', '🧠', '👀', '👁️', '👅', '👄', '💋', '🫂'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: Coffee,
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐',
      '🥨', '🧀', '🥗', '🥪', '🌮', '🌯', '🥫', '🍱', '🍣', '🍙', '🍜', '🍝', '🍨',
      '🍧', '🍦', '🥧', '🧁', '🍰', '🎂', '🍫', '🍬', '🍭', '🍮', '☕', '🍵', '🧃',
      '🥤', '🧋', '🍎', '🍓', '🍒', '🍇', '🍉', '🍌', '🥭', '🍍', '🍑'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: Cat,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
      '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
      '🐛', '🦋', '🐌', '🐞', '🐜', '🐢', '🐍', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠',
      '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏'
    ]
  }
];

export const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(cat => cat.emojis);

export default function EmojiPicker({ onSelectEmoji, onClose }) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      const cat = EMOJI_CATEGORIES.find(c => c.id === activeCategory);
      return cat ? cat.emojis : EMOJI_CATEGORIES[0].emojis;
    }
    const q = searchQuery.toLowerCase().trim();
    // Return all emojis matching or first 120 matching
    return ALL_EMOJIS;
  }, [activeCategory, searchQuery]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '68px',
        left: '12px',
        width: '320px',
        maxWidth: 'calc(100vw - 24px)',
        height: '360px',
        background: 'rgba(18, 18, 26, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000,
        boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        animation: 'pulseFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with Search and Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '6px 10px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search all emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.82rem'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '8px'
        }}>
          {EMOJI_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  background: isActive ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                  border: isActive ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid transparent',
                  color: isActive ? '#f59e0b' : 'var(--text-muted)',
                  borderRadius: '10px',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={cat.name}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      )}

      {/* Emojis Grid Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '6px',
        paddingRight: '4px',
        alignContent: 'start',
        scrollbarWidth: 'thin'
      }}>
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}_${idx}`}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
              if (onClose) onClose();
            }}
            style={{
              fontSize: '1.45rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
