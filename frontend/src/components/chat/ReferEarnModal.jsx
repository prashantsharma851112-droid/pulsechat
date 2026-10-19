import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Copy, Check, Share2, Users, Gift } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { useBackHandler } from '../../utils/backNavigation';

// =========================================================================
// ATOMIC ISOLATED REFER & EARN COMPONENTS (React.memo + 0ms GPU Feedback)
// =========================================================================

export const ReferralCodeBox = React.memo(function ReferralCodeBox({
  referralCode,
  copiedCode,
  onCopyCode
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
        YOUR UNIQUE REFERRAL CODE
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '8px 12px',
          gap: '8px'
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#fbbf24',
            letterSpacing: '1.5px',
            flex: 1
          }}
        >
          {referralCode || '...'}
        </span>
        <button
          onClick={onCopyCode}
          className="interactive-tap action-btn"
          style={{
            background: copiedCode ? '#059669' : 'rgba(245, 158, 11, 0.18)',
            color: copiedCode ? '#ffffff' : '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
        >
          {copiedCode ? <Check size={14} /> : <Copy size={14} />}
          {copiedCode ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
    </div>
  );
});

export const ReferralLinkBox = React.memo(function ReferralLinkBox({
  referralLink,
  copiedLink,
  onCopyLink
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>
        DIRECT SHAREABLE LINK
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '6px 10px',
          gap: '8px'
        }}
      >
        <input
          readOnly
          value={referralLink || ''}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#d1d5db',
            fontSize: '0.76rem',
            flex: 1,
            outline: 'none',
            textOverflow: 'ellipsis'
          }}
        />
        <button
          onClick={onCopyLink}
          className="interactive-tap action-btn"
          style={{
            background: copiedLink ? '#059669' : 'rgba(255, 255, 255, 0.08)',
            color: copiedLink ? '#ffffff' : '#e5e7eb',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
        >
          {copiedLink ? <Check size={13} /> : <Copy size={13} />}
          {copiedLink ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
});

export const ReferralShareButton = React.memo(function ReferralShareButton({
  onShare
}) {
  return (
    <button
      onClick={onShare}
      className="interactive-tap action-btn"
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#000000',
        border: 'none',
        borderRadius: '14px',
        padding: '13px',
        fontSize: '0.92rem',
        fontWeight: 800,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 18px rgba(245, 158, 11, 0.35)',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <Share2 size={18} />
      Share Invite Link Now
    </button>
  );
});

export default function ReferEarnModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [referralData, setReferralData] = useState(() => {
    try {
      const cached = localStorage.getItem('pulse_cached_referral_info');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    const defaultCode = user?.referralCode || (user?.username ? user.username.toUpperCase() : '');
    const defaultLink = defaultCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${defaultCode}` : '';
    return {
      referralCode: defaultCode,
      referralLink: defaultLink,
      referralCount: user?.referralCount || 0,
      referralEarnings: user?.referralEarnings || 0,
      hasClaimedReferral: false,
      referredBy: null,
      history: []
    };
  });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useBackHandler(onClose, true);

  // Fetch Referral Stats & Unique Code
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    fetch(`${BACKEND_URL}/api/sparks/referral-info`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success) {
          setReferralData(data);
          try {
            localStorage.setItem('pulse_cached_referral_info', JSON.stringify(data));
          } catch (_) {}
        }
      })
      .catch(err => console.warn('Referral info fetch warning (offline mode):', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [token]);

  // Copy Referral Code
  const handleCopyCode = () => {
    if (!referralData.referralCode) return;
    navigator.clipboard.writeText(referralData.referralCode);
    setCopiedCode(true);
    playSound('pop');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Full Invite Link
  const handleCopyLink = () => {
    if (!referralData.referralLink) return;
    navigator.clipboard.writeText(referralData.referralLink);
    setCopiedLink(true);
    playSound('pop');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Native Web Share or WhatsApp Share
  const handleShare = async () => {
    const shareTitle = 'Join me on PulseChat!';
    const shareText = `Hey! Join me on PulseChat, the private chat & gaming app! Use my invite link to get 50 Free Sparks: ${referralData.referralLink}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: referralData.referralLink
        });
      } catch (err) {
        // Fallback to WhatsApp
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
      }
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '92vh',
          background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
              }}
            >
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                Refer & Earn
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#fbbf24', fontWeight: 600 }}>
                Earn 200 Sparks for Every Friend!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#9ca3af',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Hero Banner Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '18px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fef3c7', marginBottom: '4px' }}>
                How it works:
              </div>
              <div style={{ fontSize: '0.78rem', color: '#d1d5db', lineHeight: 1.45 }}>
                • Friend joins & logs in → <strong style={{ color: '#fbbf24' }}>You get 200 Sparks</strong><br />
                • Your friend receives → <strong style={{ color: '#34d399' }}>50 Sparks Welcome Bonus</strong>
              </div>
            </div>
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.25)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '14px',
                padding: '8px 12px',
                textAlign: 'center',
                flexShrink: 0
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fbbf24' }}>+200</div>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#fef3c7' }}>SPARKS</div>
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  {referralData.referralCount || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Friends Joined</div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Gift size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fbbf24' }}>
                  {referralData.referralEarnings || (referralData.referralCount * 200) || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Sparks Earned</div>
              </div>
            </div>
          </div>

          {/* Referral Code Box (Atomic Isolated) */}
          <ReferralCodeBox
            referralCode={referralData.referralCode}
            copiedCode={copiedCode}
            onCopyCode={handleCopyCode}
          />

          {/* Referral Link Box (Atomic Isolated) */}
          <ReferralLinkBox
            referralLink={referralData.referralLink}
            copiedLink={copiedLink}
            onCopyLink={handleCopyLink}
          />

          {/* Direct Share Button (Atomic Isolated) */}
          <ReferralShareButton onShare={handleShare} />

          {/* How Refer & Earn Works (Automated on account creation) */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '14px 16px'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fbbf24', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#f59e0b" />
              HOW REFER & EARN WORKS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', color: '#d1d5db' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, flexShrink: 0 }}>1</span>
                <span>Share your invite link or code with friends.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, flexShrink: 0 }}>2</span>
                <span>Friend opens your link & the code is <b>auto-filled</b> on their Create Account screen.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, flexShrink: 0 }}>3</span>
                <span>Once they register, you receive <b>+200 Sparks</b> and they receive <b>+50 Sparks</b> in their wallet history!</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
