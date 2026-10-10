import React, { useState, useRef, useEffect } from 'react';
import { X, Share2, Download, Copy, Check, Sparkles, Music, Flame, Zap, Crown, QrCode } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import VibeAuraRing from '../common/VibeAuraRing';

export default function ShareableStoryCardModal({ user, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const cardElementRef = useRef(null);

  const username = user?.username || 'user';
  const displayName = user?.displayName || username;
  const status = user?.status || 'Chilling on PulseChat ⚡';
  const musicNote = user?.musicNote || null;
  const aura = user?.vibeAura || 'neon';

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/ask/@${username}`
    : `https://pulsechat.me/ask/@${username}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  // Helper to draw the high-resolution 1080x1920 Canvas image
  const generateCanvasImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // 1. AMOLED Black Background
    ctx.fillStyle = '#060609';
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Ambient Gradient Glows (Violet, Cyan, Pink Mesh)
    const topGlow = ctx.createRadialGradient(540, 400, 50, 540, 400, 600);
    topGlow.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
    topGlow.addColorStop(0.5, 'rgba(99, 102, 241, 0.15)');
    topGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, 1080, 1000);

    const bottomGlow = ctx.createRadialGradient(800, 1600, 50, 800, 1600, 650);
    bottomGlow.addColorStop(0, 'rgba(236, 72, 153, 0.3)');
    bottomGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, 1000, 1080, 920);

    // 3. Card Frame (9:16 floating card inside story)
    const cardX = 90;
    const cardY = 160;
    const cardW = 900;
    const cardH = 1600;
    const radius = 64;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = 'rgba(18, 16, 28, 0.94)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();
    ctx.restore();

    // 4. Header: Brand Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ PULSECHAT • INSTA STORY CARD', 540, cardY + 90);

    // 5. User Avatar
    const avatarSize = 220;
    const avatarX = 540;
    const avatarY = cardY + 260;

    const avatarImg = new Image();
    avatarImg.crossOrigin = 'anonymous';
    const avatarUrl = user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    await new Promise((resolve) => {
      avatarImg.onload = resolve;
      avatarImg.onerror = resolve;
      avatarImg.src = avatarUrl;
    });

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try {
      ctx.drawImage(avatarImg, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    } catch (e) {}
    ctx.restore();

    // Avatar Ring Border
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#c084fc';
    ctx.stroke();
    ctx.restore();

    // 6. User Names
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, 540, cardY + 440);

    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`@${username}`, 540, cardY + 505);

    // 7. Aura Mood Pill
    ctx.save();
    const auraPillW = 360;
    const auraPillH = 68;
    const auraPillX = 540 - auraPillW / 2;
    const auraPillY = cardY + 550;
    ctx.beginPath();
    ctx.roundRect(auraPillX, auraPillY, auraPillW, auraPillH, 34);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`✨ Aura: ${typeof aura === 'string' ? aura.toUpperCase() : 'NEON ELECTRIC'} ⚡`, 540, auraPillY + 45);
    ctx.restore();

    // 8. Vibe Song Note Box (Spotify Style)
    if (musicNote?.songTitle || user?.musicNote?.songTitle) {
      const noteObj = musicNote || user.musicNote;
      const songW = 740;
      const songH = 110;
      const songX = 540 - songW / 2;
      const songY = cardY + 655;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(songX, songY, songW, songH, 28);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();

      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🎵 VIBE TRACK', songX + 35, songY + 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const songText = `${noteObj.songTitle}${noteObj.artistName ? ' • ' + noteObj.artistName : ''}`;
      ctx.fillText(songText.slice(0, 32), songX + 35, songY + 90);
      ctx.restore();
    }

    // 9. QR Code Image
    const qrSize = 380;
    const qrX = 540 - qrSize / 2;
    const qrY = cardY + 800;

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(shareUrl)}&color=09090b&bgcolor=ffffff&qzone=1`;

    await new Promise((resolve) => {
      qrImg.onload = resolve;
      qrImg.onerror = resolve;
      qrImg.src = qrUrl;
    });

    // White padding box for QR
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    try {
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {}
    ctx.restore();

    // 10. Call To Action Tagline
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan or Tap link in Story 🤫', 540, cardY + 1300);

    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Send anonymous messages & connect on PulseChat', 540, cardY + 1360);

    // 11. Bottom Link URL Pill
    ctx.save();
    const linkPillW = 600;
    const linkPillH = 74;
    const linkPillX = 540 - linkPillW / 2;
    const linkPillY = cardY + 1420;
    ctx.beginPath();
    ctx.roundRect(linkPillX, linkPillY, linkPillW, linkPillH, 37);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`pulsechat.me/ask/@${username}`, 540, linkPillY + 48);
    ctx.restore();

    return canvas;
  };

  // One-Click Native Share (Instagram Story / WhatsApp / Gallery)
  const handleShareToStory = async () => {
    setDownloading(true);
    try {
      const canvas = await generateCanvasImage();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setDownloading(false);
          return;
        }

        const file = new File([blob], `pulsechat-story-${username}.png`, { type: 'image/png' });

        // Try Web Share API (native Instagram Story sheet on iOS & Android)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${displayName}'s PulseChat Story Card`,
              text: `Send me anonymous messages on PulseChat 🤫 ${shareUrl}`
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 3000);
            setDownloading(false);
            return;
          } catch (e) {}
        }

        // Fallback: Download file directly and copy link to clipboard
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulsechat-story-${username}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        handleCopyLink();
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3500);
        setDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.warn('Canvas export error:', err);
      setDownloading(false);
    }
  };

  // Direct WhatsApp Status / Chat Share
  const handleShareWhatsApp = () => {
    const text = `🤫 Send me anonymous messages on PulseChat! Click here: ${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 14px',
        overflowY: 'auto',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '340px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          margin: 'auto'
        }}
      >
        {/* Top Control Bar */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff' }}>
              One-Click Invite Card
            </span>
          </div>

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
          >
            <X size={15} />
          </button>
        </div>

        {/* AMOLED STORY CARD PREVIEW */}
        <div
          ref={cardElementRef}
          style={{
            width: '100%',
            background: 'linear-gradient(170deg, #09090e 0%, #110f1c 50%, #150d1e 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 35px rgba(168, 85, 247, 0.28)',
            padding: '16px 14px 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Ambient Lighting Orbs */}
          <div style={{ position: 'absolute', top: '-40px', left: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Top Brand Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900, color: '#fff' }}>⚡</div>
              <span style={{ fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.04em', background: 'linear-gradient(90deg, #a5b4fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PULSECHAT
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', color: '#a5b4fc', fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
              INSTA STORY
            </div>
          </div>

          {/* Avatar with Vibe Aura */}
          <div style={{ position: 'relative', margin: '4px 0 6px 0' }}>
            <VibeAuraRing aura={aura} size={76} hasCrown={Boolean(user?.hasKingCrown || user?.hasSilverCrown || user?.hasStreakCrown)}>
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`}
                alt={displayName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.9)' }}
              />
            </VibeAuraRing>
          </div>

          {/* User Names */}
          <div style={{ textAlign: 'center', width: '100%', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                {displayName}
              </h3>
              <span style={{ color: '#38bdf8', fontSize: '0.82rem' }}>✓</span>
            </div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginTop: '1px' }}>
              @{username}
            </div>
          </div>

          {/* Aura & Song Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginBottom: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '10px',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#fde047'
            }}>
              <Zap size={11} fill="#fde047" color="#fde047" /> Aura: {typeof aura === 'string' ? aura.toUpperCase() : 'NEON ELECTRIC'}
            </div>

            {musicNote?.songTitle && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '3px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontSize: '0.66rem',
                fontWeight: 700,
                color: '#ffffff',
                overflow: 'hidden'
              }}>
                <Music size={11} color="#ec4899" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {musicNote.songTitle} {musicNote.artistName ? `• ${musicNote.artistName}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Big QR Code Centerpiece */}
          <div style={{
            background: '#ffffff',
            padding: '8px',
            borderRadius: '18px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            marginBottom: '8px'
          }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}&color=09090b&bgcolor=ffffff&qzone=1`}
              alt="QR Code"
              style={{ width: '130px', height: '130px', display: 'block', borderRadius: '6px' }}
            />
          </div>

          {/* Call To Action */}
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff' }}>
              Scan or Tap Link in Story 🤫
            </div>
            <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '1px' }}>
              Send me anonymous messages on PulseChat
            </div>
          </div>
        </div>

        {/* ONE-CLICK ACTION BUTTONS */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Instagram Story Share Button */}
          <button
            type="button"
            onClick={handleShareToStory}
            disabled={downloading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
              border: 'none',
              borderRadius: '14px',
              padding: '10px',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 6px 20px rgba(253, 29, 29, 0.4)'
            }}
          >
            <Share2 size={15} />
            {downloading ? 'Preparing Story Card...' : (shareSuccess ? 'Card Ready / Shared! 📸' : 'Share to Instagram Story 📸')}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' }}>
            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                background: '#25d366',
                border: 'none',
                borderRadius: '12px',
                padding: '9px',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              WhatsApp Status 💬
            </button>

            {/* Copy Ask Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '9px',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
              {copied ? 'Link Copied!' : 'Copy Bio Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
