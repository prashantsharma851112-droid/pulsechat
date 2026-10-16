import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Copy, Check, Share2, Users, Gift, ArrowRight } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { useBackHandler } from '../../utils/backNavigation';

export default function ReferEarnModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState({
    referralCode: '',
    referralLink: '',
    referralCount: 0,
    referralEarnings: 0,
    hasClaimedReferral: false,
    referredBy: null,
    history: []
  });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState(null);

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
        }
      })
      .catch(err => console.warn('Referral info fetch warning:', err))
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

  // Claim a friend's referral code
  const handleClaimCode = async (e) => {
    e.preventDefault();
    if (!inputCode.trim() || claiming) return;

    setClaiming(true);
    setClaimMsg(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/sparks/claim-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ referralCode: inputCode.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playSound('success');
        setClaimMsg({ type: 'success', text: `🎉 ${data.message}` });
        setReferralData(prev => ({
          ...prev,
          hasClaimedReferral: true,
          referredBy: data.referredBy
        }));
        if (data.newBalance !== undefined && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.newBalance, hasClaimedReferral: true });
        }
      } else {
        playSound('error');
        setClaimMsg({ type: 'error', text: data.error || 'Failed to claim referral code.' });
      }
    } catch (err) {
      playSound('error');
      setClaimMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setClaiming(false);
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

          {/* Referral Code Box */}
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
                {referralData.referralCode || '...'}
              </span>
              <button
                onClick={handleCopyCode}
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
                  transition: 'all 0.15s ease'
                }}
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Referral Link Box */}
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
                value={referralData.referralLink || ''}
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
                onClick={handleCopyLink}
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
                  gap: '4px'
                }}
              >
                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Direct Share Button (WhatsApp / Web Share) */}
          <button
            onClick={handleShare}
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
              transition: 'transform 0.12s ease'
            }}
          >
            <Share2 size={18} />
            Share Invite Link Now
          </button>

          {/* Have a referral code? (Claim Bonus) */}
          {!referralData.hasClaimedReferral && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.14)',
                borderRadius: '14px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '8px' }}>
                Invited by a friend? Claim 50 Sparks:
              </div>
              <form onSubmit={handleClaimCode} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter Friend's Code"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    flex: 1,
                    outline: 'none',
                    textTransform: 'uppercase'
                  }}
                />
                <button
                  type="submit"
                  disabled={claiming || !inputCode.trim()}
                  style={{
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: claiming || !inputCode.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {claiming ? '...' : 'Claim'}
                  <ArrowRight size={14} />
                </button>
              </form>
              {claimMsg && (
                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    marginTop: '8px',
                    color: claimMsg.type === 'success' ? '#34d399' : '#f87171'
                  }}
                >
                  {claimMsg.text}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
