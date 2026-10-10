import React, { useState } from 'react';
import { X, Share2, Download, Copy, Check, Sparkles } from 'lucide-react';

export default function AnonymousStoryReplyModal({ message, currentUser, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const username = currentUser?.username || 'user';
  const text = message?.content || 'Secret Message';
  const prompt = message?.pollData?.prompt || 'Ask me anything anonymously 🤫';

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/ask/@${username}`
    : `https://pulsechat.me/ask/@${username}`;

  const generateCanvasImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // 1. AMOLED Black Background
    ctx.fillStyle = '#060609';
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Neon Ambient Glows
    const glow1 = ctx.createRadialGradient(540, 500, 50, 540, 500, 600);
    glow1.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1100);

    const glow2 = ctx.createRadialGradient(540, 1500, 50, 540, 1500, 600);
    glow2.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 1100, 1080, 820);

    // 3. Floating Question Sticker (Iconic NGL Style)
    const cardX = 100;
    const cardY = 380;
    const cardW = 880;
    const cardH = 800;
    const radius = 54;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.restore();

    // Top Prompt Bar in the Sticker
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 140, [radius, radius, 0, 0]);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤫 ANONYMOUS MESSAGE', 540, cardY + 88);
    ctx.restore();

    // Anonymous Message Text
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    // Word wrap message
    const words = text.split(' ');
    let line = '';
    let curY = cardY + 280;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 740 && n > 0) {
        ctx.fillText(line, 540, curY);
        line = words[n] + ' ';
        curY += 75;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 540, curY);

    // Subtitle inside sticker
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`sent via pulsechat.me/ask/@${username}`, 540, cardY + cardH - 60);

    // 4. Instructions for viewers below sticker
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Send me more secret messages 🤫', 540, 1340);

    // 5. Link Sticker Placeholder
    ctx.save();
    const linkW = 660;
    const linkH = 90;
    const linkX = 540 - linkW / 2;
    const linkY = 1420;
    ctx.beginPath();
    ctx.roundRect(linkX, linkY, linkW, linkH, 45);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`🔗 pulsechat.me/ask/@${username}`, 540, linkY + 58);
    ctx.restore();

    return canvas;
  };

  const handleShareStory = async () => {
    setDownloading(true);
    try {
      const canvas = await generateCanvasImage();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setDownloading(false);
          return;
        }

        const file = new File([blob], `pulse-reply-${Date.now()}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Anonymous Question on PulseChat`,
              text: `Send me more secret messages on PulseChat 🤫 ${shareUrl}`
            });
            setShared(true);
            setTimeout(() => setShared(false), 3000);
            setDownloading(false);
            return;
          } catch (e) {}
        }

        // Fallback: Download image and copy link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulse-reply-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).catch(() => {});
        }
        setShared(true);
        setTimeout(() => setShared(false), 3500);
        setDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.warn('Canvas error:', err);
      setDownloading(false);
    }
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
        padding: '16px',
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
          gap: '12px',
          margin: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#ec4899" />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff' }}>
              Share Reply to Instagram Story
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
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

        {/* NGL Style Question Sticker Preview */}
        <div style={{
          width: '100%',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(244, 63, 94, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
            padding: '10px 14px',
            textAlign: 'center',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 800,
            letterSpacing: '0.04em'
          }}>
            🤫 ANONYMOUS MESSAGE
          </div>
          <div style={{
            padding: '18px 16px',
            textAlign: 'center',
            color: '#0f172a',
            fontSize: '1rem',
            fontWeight: 800,
            lineHeight: 1.4
          }}>
            "{text}"
          </div>
          <div style={{
            padding: '8px 14px',
            background: '#f8fafc',
            textAlign: 'center',
            fontSize: '0.66rem',
            color: '#64748b',
            fontWeight: 700,
            borderTop: '1px solid #e2e8f0'
          }}>
            sent via pulsechat.me/ask/@{username}
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShareStory}
          disabled={downloading}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
            border: 'none',
            borderRadius: '14px',
            padding: '11px',
            color: '#ffffff',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(253, 29, 29, 0.45)'
          }}
        >
          <Share2 size={16} />
          {downloading ? 'Preparing Story Image...' : (shared ? 'Story Image Saved! 📸' : 'Post to Instagram Story 📸')}
        </button>

        <p style={{ margin: 0, fontSize: '0.70rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.3 }}>
          Post this card on your Instagram Story and write your answer above or below it!
        </p>
      </div>
    </div>
  );
}
