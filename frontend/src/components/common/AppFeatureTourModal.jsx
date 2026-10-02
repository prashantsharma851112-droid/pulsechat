import React, { useState } from 'react';
import { X, Music, Gamepad2, Sparkles, Lock, Paintbrush, Forward, Smile, Phone, Video, Crown, ArrowRight, MapPin, CheckCircle2, SlidersHorizontal, Flame, Radio, Zap } from 'lucide-react';
import PulseVipBadge from './PulseVipBadge';

const TOUR_FEATURES = [
  {
    id: 'music',
    title: '🎵 Live Full Song Background Music',
    badge: 'VIP Pro',
    badgeColor: '#f59e0b',
    location: 'Chat Top Header (Next to 3-Dots)',
    locationArrow: 'Top Right 🎵 Crown Icon',
    description: 'Play and listen to full trending Bollywood & international songs together in real-time while chatting.',
    howToUse: 'Open any chat 👉 Tap the 🎵 Crown button at top-right 👉 Search any song & tap Play.'
  },
  {
    id: 'game',
    title: '🎮 Live 2-Player Arrow Duel',
    badge: 'Everyone',
    badgeColor: '#ec4899',
    location: 'Chat Top Header',
    locationArrow: 'Top Right 🎮 Gamepad Icon',
    description: 'Instant real-time multiplayer archery battle against your chat partner without downloading anything.',
    howToUse: 'Open any chat 👉 Tap the 🎮 pink gamepad at top-right 👉 Aim & release arrow to score!'
  },
  {
    id: '3d_text',
    title: '⚡ 3D Animated Text & Stickers',
    badge: 'VIP Pro',
    badgeColor: '#6366f1',
    location: "Chat Input '+' Attachment Menu",
    locationArrow: "Bottom Left '+' ➔ 3D Typography",
    description: 'Send vibrant 3D holographic animated messages that burst with sound & particle effects on screen.',
    howToUse: "Tap '+' near message box 👉 Tap '3D Text' 👉 Type message & choose style 👉 Send."
  },
  {
    id: 'stealth_dust',
    title: '🔒 Stealth Dust (Self-Destruct Notes)',
    badge: 'Everyone',
    badgeColor: '#ef4444',
    location: "Chat Input '+' Attachment Menu",
    locationArrow: "Bottom Left '+' ➔ Stealth Dust Note",
    description: 'Private encrypted secret messages. Once the recipient taps to reveal, it permanently dissolves in 5 seconds.',
    howToUse: "Tap '+' 👉 Choose 'Stealth Dust' 👉 Write secret note 👉 Recipient taps to read with 5s countdown."
  },
  {
    id: 'whiteboard',
    title: '🎨 Collaborative Live Whiteboard',
    badge: 'Everyone',
    badgeColor: '#10b981',
    location: "Chat Input '+' Attachment Menu",
    locationArrow: "Bottom Left '+' ➔ Live Whiteboard",
    description: 'Draw sketches, write hand-written notes, and doodle on a canvas and send as an instant drawing.',
    howToUse: "Tap '+' 👉 Tap 'Whiteboard' 👉 Draw with colorful brush tools 👉 Tap Send Drawing."
  },
  {
    id: 'reactions',
    title: '💬 Custom Reaction Bar & Emojis',
    badge: 'Everyone',
    badgeColor: '#fbbf24',
    location: 'On Any Chat Message Bubble',
    locationArrow: 'Long-press message ➔ Reaction Bar',
    description: 'React instantly with emojis. Recent emojis jump to front. Tap the ⚙️ Adjust button to set your 7 default reaction emojis.',
    howToUse: 'Long-press any message 👉 Tap any emoji, or tap ⚙️ Sliders icon to customize your 7 favorites.'
  },
  {
    id: 'forward',
    title: '↪️ Forward Messages & Quoted Replies',
    badge: 'Everyone',
    badgeColor: '#38bdf8',
    location: 'Message Action Menu / Swipe Right',
    locationArrow: 'Long-press message ➔ ↪️ Forward',
    description: 'Forward text, photos, or voice notes to multiple friends with WhatsApp-style Forwarded badge & unread indicators.',
    howToUse: 'Long-press message 👉 Tap Forward (↪️) 👉 Select contacts & send. Or swipe message right to reply.'
  },
  {
    id: 'vibes',
    title: '⚡ 24-Hour Pulse Vibes (Stories)',
    badge: 'Everyone',
    badgeColor: '#a855f7',
    location: 'Sidebar Top Header Bar',
    locationArrow: 'Sidebar Top ➔ + Post Vibe',
    description: 'Post 24-hour photo, video, and text stories with custom background music, spark tips & direct replies.',
    howToUse: "Look at the top of the chat list 👉 Tap '+ Post Vibe' or tap any friend's avatar circle to view."
  },
  {
    id: 'vip_crowns',
    title: '👑 Pulse VIP Aura & Leaderboard Crowns',
    badge: 'VIP Pro',
    badgeColor: '#f59e0b',
    location: 'Top-Left 3-Dots Menu ➔ Pulse VIP',
    locationArrow: 'Top-Left 3-Dots ➔ Pulse VIP',
    description: 'Exclusive rainbow neon animated profile aura, 24K gold badges, and #1 King & #2 Silver crowns on gaming leaderboards.',
    howToUse: 'Tap top-left 3-dots 👉 Tap Pulse VIP 👉 Unlock 7-Day Free Trial or Pro Membership.'
  },
  {
    id: 'calls',
    title: '📞 HD Voice & Video Calling',
    badge: 'Everyone',
    badgeColor: '#10b981',
    location: 'Chat Top Header (Next to Username)',
    locationArrow: 'Top Header ➔ 📞 Phone & 🎥 Video',
    description: 'Crystal-clear end-to-end encrypted 1-on-1 audio and video calls with group call invitations.',
    howToUse: 'Open any friend chat 👉 Tap the 📞 Phone or 🎥 Video icon at top header to ring instantly.'
  },
  {
    id: 'disappearing',
    title: '⏱️ 24h Auto-Disappearing & View Once',
    badge: 'Everyone',
    badgeColor: '#64748b',
    location: 'Chat Profile Bio / Media Upload',
    locationArrow: 'Profile ➔ 24h Disappearing Messages',
    description: 'Set messages to automatically vanish after 24 hours, or send photos that disappear immediately after 1 view.',
    howToUse: 'Tap user name in chat header 👉 Toggle Disappearing Messages ON. Or tap 1️⃣ when sending photos.'
  }
];

export default function AppFeatureTourModal({ onClose, onOpenPro }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'chat' | 'vip'

  const filtered = TOUR_FEATURES.filter(f => {
    if (filter === 'all') return true;
    if (filter === 'chat') return f.badge === 'Everyone';
    if (filter === 'vip') return f.badge === 'VIP Pro';
    return true;
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        style={{
          maxWidth: '540px',
          width: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(245, 158, 11, 0.15))',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--accent), #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
            }}>
              <Zap size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>App Feature Tour</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                  Visual Guide
                </span>
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Learn where every feature is located in PulseChat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="icon-btn-ghost"
            style={{ width: '34px', height: '34px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '8px',
          background: 'rgba(0,0,0,0.15)'
        }}>
          {[
            { id: 'all', label: '✨ All Features' },
            { id: 'chat', label: '💬 Chat Tools' },
            { id: 'vip', label: '👑 VIP / Pro' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: filter === tab.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: filter === tab.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: filter === tab.id ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Features Scrollable List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {filtered.map((item, index) => (
            <div
              key={item.id}
              style={{
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {item.title}
                </span>
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: item.badge === 'VIP Pro' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: item.badgeColor,
                  border: `1px solid ${item.badgeColor}40`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flexShrink: 0
                }}>
                  {item.badge}
                </span>
              </div>

              {/* Location Tag with Arrow */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.28)',
                width: 'fit-content',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#818cf8'
              }}>
                <MapPin size={12} color="#818cf8" style={{ flexShrink: 0 }} />
                <span>Where:</span>
                <span style={{ color: '#fff' }}>{item.locationArrow}</span>
                <ArrowRight size={12} color="#818cf8" style={{ flexShrink: 0 }} />
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {item.description}
              </p>

              {/* How to use */}
              <div style={{
                fontSize: '0.74rem',
                color: 'var(--text-main)',
                background: 'rgba(0,0,0,0.22)',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Quick Guide:</span>
                <span>{item.howToUse}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenPro) onOpenPro();
            }}
            className="btn-secondary"
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#f59e0b',
              borderColor: 'rgba(245, 158, 11, 0.4)'
            }}
          >
            <Crown size={15} color="#f59e0b" />
            <span>View VIP Benefits</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{
              padding: '8px 20px',
              borderRadius: '12px',
              fontSize: '0.84rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}
          >
            Got It! Start Chatting
          </button>
        </div>
      </div>
    </div>
  );
}
