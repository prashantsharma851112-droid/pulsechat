import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Share2, MessageSquare, Flame, Zap, Crown, Sparkles, QrCode, Download, ExternalLink, Globe } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { useBackHandler } from '../../utils/backNavigation';
import VibeAuraRing from '../common/VibeAuraRing';

export default function PulseHandleCardModal({ targetUser, currentUser, onClose, onOpenChat, standalone = false }) {
  useBackHandler(onClose, !standalone);

  const [userData, setUserData] = useState(() => {
    if (typeof targetUser === 'object' && targetUser !== null) {
      return targetUser;
    }
    return null;
  });
  const [loading, setLoading] = useState(!userData);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'qr' | 'story'
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef(null);

  const username = userData?.username || (typeof targetUser === 'string' ? targetUser.replace(/^@/, '') : '');

  // Fetch full live card data (streak, crowns, sparks, top vibe)
  useEffect(() => {
    if (!username) return;
    let isMounted = true;
    fetch(`${BACKEND_URL}/api/users/public/card/${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && data.card) {
          setUserData(prev => ({ ...(prev || {}), ...data.card }));
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [username]);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${encodeURIComponent(username)}`
    : `https://pulsechat.me/@${username}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profileUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${userData?.displayName || username}'s PulseChat Card`,
          text: `Connect with @${username} on PulseChat! 🔥 Live Streaks & Aesthetic Vibes`,
          url: profileUrl
        });
      } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  const isMe = currentUser && (currentUser.id === userData?.id || currentUser.username === userData?.username);

  const crownTitle = userData?.hasKingCrown
    ? '👑 #1 Gold King Leaderboard'
    : userData?.hasSilverCrown
    ? '🥈 #2 Silver Champion'
    : userData?.hasStreakCrown
    ? '👑 7-Day Gaming Streak Crown'
    : null;

  return (
    <div
      style={{
        position: standalone ? 'relative' : 'fixed',
        inset: 0,
        zIndex: 1300,
        background: standalone ? 'transparent' : 'rgba(0, 0, 0, 0.82)',
        backdropFilter: standalone ? 'none' : 'blur(16px)',
        WebkitBackdropFilter: standalone ? 'none' : 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 10px calc(10px + env(safe-area-inset-bottom, 0px)) 10px',
        minHeight: standalone ? '100dvh' : 'auto',
        maxHeight: '100dvh',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (!standalone && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          margin: 'auto',
          animation: 'modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top Control Bar */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '14px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>
              pulsechat.me/@{username}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '2px', border: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  background: activeTab === 'card' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  background: activeTab === 'qr' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <QrCode size={12} /> QR
              </button>
            </div>

            {!standalone && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Close"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* THE AESTHETIC DIGITAL PROFILE CARD */}
        {activeTab === 'card' ? (
          <div
            ref={cardRef}
            style={{
              width: '100%',
              borderRadius: '20px',
              background: 'linear-gradient(165deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(49, 16, 66, 0.95) 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 16px 40px -10px rgba(99, 102, 241, 0.45), 0 0 25px rgba(168, 85, 247, 0.18)',
              padding: '12px 14px 10px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
              backdropFilter: 'blur(20px)'
            }}
          >
            {/* Background Glow Orbs */}
            <div style={{ position: 'absolute', top: '-40px', left: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-30px', right: '-30px', width: '130px', height: '130px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Top Brand Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900, color: '#fff' }}>⚡</div>
                <span style={{ fontSize: '0.76rem', fontWeight: 900, letterSpacing: '0.03em', background: 'linear-gradient(90deg, #a5b4fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  PULSECHAT CARD
                </span>
              </div>
              {userData?.isPro && (
                <div style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)', color: '#fff', fontSize: '0.6rem', fontWeight: 900, padding: '2px 6px', borderRadius: '10px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  VIP {userData.proTier || 'PRO'}
                </div>
              )}
            </div>

            {/* Avatar Centerpiece with Aura Ring & Crown */}
            <div style={{ position: 'relative', margin: '4px 0 6px 0' }}>
              <VibeAuraRing
                aura={userData?.vibeAura || 'neon'}
                size={70}
                hasCrown={Boolean(crownTitle)}
              >
                {crownTitle && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '1.2rem',
                      filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))',
                      zIndex: 15,
                      pointerEvents: 'none'
                    }}
                    title={crownTitle}
                  >
                    👑
                  </div>
                )}
                <img
                  src={userData?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username || 'user'}`}
                  alt={userData?.displayName || username}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.9)'
                  }}
                />
              </VibeAuraRing>
            </div>

            {/* User Names & Status */}
            <div style={{ textAlign: 'center', width: '100%', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                  {userData?.displayName || username || 'Pulse User'}
                </h3>
                <span title="Verified Pulse Member" style={{ color: '#38bdf8', fontSize: '0.85rem' }}>✓</span>
              </div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginTop: '1px' }}>
                @{username}
              </div>

              {/* Bio / Status */}
              <div style={{
                marginTop: '4px',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'inline-block',
                maxWidth: '96%',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {userData?.status || 'Chilling on PulseChat ⚡'}
              </div>
            </div>

            {/* LIVE STATS GRID (Streak, Sparks, Crowns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              width: '100%',
              marginBottom: '8px'
            }}>
              {/* Streak Stat */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.15))',
                border: '1px solid rgba(249, 115, 22, 0.5)',
                borderRadius: '12px',
                padding: '6px 4px',
                textAlign: 'center',
                boxShadow: '0 3px 10px rgba(249, 115, 22, 0.15)'
              }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <Flame size={11} color="#f97316" /> Streak
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#fff', marginTop: '1px' }}>
                  🔥 {userData?.streakCount || 0}
                </div>
                {(userData?.streakShields || 0) > 0 && (
                  <div style={{ fontSize: '0.58rem', color: '#38bdf8', fontWeight: 700 }}>
                    ❄️{userData.streakShields} Shield
                  </div>
                )}
              </div>

              {/* Sparks Stat */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '12px',
                padding: '6px 4px',
                textAlign: 'center',
                boxShadow: '0 3px 10px rgba(245, 158, 11, 0.15)'
              }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <Zap size={11} fill="#f59e0b" color="#f59e0b" /> Sparks
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#fff', marginTop: '1px' }}>
                  ⚡ {userData?.pulseSparks || 100}
                </div>
                <div style={{ fontSize: '0.58rem', color: '#fbbf24', fontWeight: 700 }}>
                  Wallet
                </div>
              </div>

              {/* Rank / Crown Stat */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.15))',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                borderRadius: '12px',
                padding: '6px 4px',
                textAlign: 'center',
                boxShadow: '0 3px 10px rgba(168, 85, 247, 0.15)'
              }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <Crown size={11} color="#c084fc" /> Rank
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#fff', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userData?.hasKingCrown ? '👑 #1 Gold' : userData?.hasSilverCrown ? '🥈 #2 Silver' : userData?.isPro ? '⭐ VIP' : '🌟 Explorer'}
                </div>
                <div style={{ fontSize: '0.58rem', color: '#c084fc', fontWeight: 700 }}>
                  Aura Active
                </div>
              </div>
            </div>

            {/* Top Vibe Preview if active */}
            {userData?.topVibe && (
              <div style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '5px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.95rem' }}>✨</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff' }}>Active 24h Vibe</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                      {userData.topVibe.caption ? userData.topVibe.caption.slice(0, 20) + '...' : 'Live on PulseChat'}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.66rem', color: '#a855f7', fontWeight: 800 }}>Watch ➔</span>
              </div>
            )}

            {/* Bottom Card Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
              <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>
                PulseChat Ecosystem • Global
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', color: '#38bdf8', fontWeight: 700 }}>
                <Globe size={10} /> 100% Encrypted
              </div>
            </div>
          </div>
        ) : (
          /* QR CODE TAB */
          <div
            style={{
              width: '100%',
              borderRadius: '20px',
              background: 'linear-gradient(165deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 20px 50px -10px rgba(99, 102, 241, 0.4)',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <h4 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#fff', margin: '0 0 4px 0' }}>
              Scan to Connect with @{username}
            </h4>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
              Point phone camera to open profile directly on PulseChat
            </p>

            <div style={{
              background: '#ffffff',
              padding: '8px',
              borderRadius: '16px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
              marginBottom: '10px',
              position: 'relative'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileUrl)}&color=09090b&bgcolor=ffffff&qzone=1`}
                alt={`QR code for ${username}`}
                style={{ width: '140px', height: '140px', display: 'block', borderRadius: '6px' }}
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: '#6366f1',
                border: '2.5px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem'
              }}>
                ⚡
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#a5b4fc', fontWeight: 700, wordBreak: 'break-all' }}>
              {profileUrl}
            </div>
          </div>
        )}

        {/* PRIMARY ACTION BUTTONS */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Direct Message Button (if viewing someone else) */}
          {!isMe && (
            <button
              type="button"
              onClick={() => {
                if (onOpenChat && userData) {
                  onOpenChat(userData);
                  if (onClose) onClose();
                } else {
                  window.dispatchEvent(new CustomEvent('pulsechat_open_chat', { detail: { user: userData } }));
                  if (onClose) onClose();
                }
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.15s ease'
              }}
            >
              <MessageSquare size={16} />
              <span>Direct Message on PulseChat</span>
            </button>
          )}

          {/* Share & Copy Link Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                padding: '8px 10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'background 0.15s ease'
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copied ? 'Copied Link!' : 'Copy Bio Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              style={{
                padding: '8px 10px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(236, 72, 153, 0.5)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
            >
              <Share2 size={14} color="#f472b6" />
              <span>Share to Bio / Status</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
