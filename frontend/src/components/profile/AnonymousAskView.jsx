import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../utils/config';
import { Send, Shuffle, Sparkles, Shield, CheckCircle, ArrowRight, Lock, MessageSquare } from 'lucide-react';
import VibeAuraRing from '../common/VibeAuraRing';

const PROMPT_SUGGESTIONS = [
  "Send me anonymous messages! 🤫",
  "What's a secret you never told me?",
  "Send me a confession 💬",
  "Rate me from 1 to 10 🔥",
  "Who do you have a crush on?",
  "Be honest: what was your first impression of me?",
  "What is one thing I should change about myself?",
  "Song that always reminds you of me? 🎶",
  "Describe me in 3 words 💭",
  "What is the craziest thing we should do together?"
];

export default function AnonymousAskView({ targetUsername }) {
  const cleanUsername = (targetUsername || '').replace(/^@/, '');
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [promptIdx, setPromptIdx] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch target user public profile
  useEffect(() => {
    if (!cleanUsername) return;
    fetch(`${BACKEND_URL}/api/users/public/card/${encodeURIComponent(cleanUsername)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.card) {
          setUserData(data.card);
        }
      })
      .catch(err => console.warn('Could not load user data:', err))
      .finally(() => setLoadingUser(false));
  }, [cleanUsername]);

  const handleShufflePrompt = () => {
    setPromptIdx(prev => (prev + 1) % PROMPT_SUGGESTIONS.length);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/messages/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: cleanUsername,
          content: content.trim(),
          prompt: PROMPT_SUGGESTIONS[promptIdx]
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSentSuccess(true);
        setContent('');
      } else {
        setErrorMsg(data.error || 'Failed to send anonymous message.');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      background: '#07070a',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
      position: 'relative',
      overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute',
        top: '-80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '-50px',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.16) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Main Container */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10
      }}>

        {/* Top Brand Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          padding: '4px 12px',
          marginBottom: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <Sparkles size={13} color="#f59e0b" />
          <span style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.04em', background: 'linear-gradient(90deg, #a5b4fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PULSECHAT • ANONYMOUS
          </span>
        </div>

        {/* Target User Centerpiece */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '18px',
          textAlign: 'center'
        }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <VibeAuraRing
              aura={userData?.vibeAura || 'neon'}
              size={76}
              hasCrown={Boolean(userData?.hasKingCrown || userData?.hasSilverCrown || userData?.hasStreakCrown)}
            >
              {userData?.hasKingCrown ? (
                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.25rem', zIndex: 15 }}>👑</div>
              ) : userData?.hasSilverCrown ? (
                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.25rem', zIndex: 15 }}>🥈</div>
              ) : userData?.hasStreakCrown ? (
                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.25rem', zIndex: 15 }}>🔥</div>
              ) : null}
              <img
                src={userData?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername || 'pulse'}`}
                alt={cleanUsername}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(255, 255, 255, 0.85)'
                }}
              />
            </VibeAuraRing>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              {userData?.displayName || cleanUsername}
            </h2>
            <span style={{ color: '#38bdf8', fontSize: '0.85rem' }}>✓</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600, marginTop: '2px' }}>
            @{cleanUsername}
          </span>
        </div>

        {/* Form Card or Success Screen */}
        {!sentSuccess ? (
          <form
            onSubmit={handleSend}
            style={{
              width: '100%',
              background: 'linear-gradient(170deg, rgba(24, 20, 36, 0.95) 0%, rgba(13, 12, 20, 0.98) 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px',
              padding: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(168, 85, 247, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backdropFilter: 'blur(16px)'
            }}
          >
            {/* Interactive Prompt Bubble with Shuffle Dice */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '16px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span style={{ fontSize: '1.1rem' }}>💬</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
                  {PROMPT_SUGGESTIONS[promptIdx]}
                </span>
              </div>
              <button
                type="button"
                onClick={handleShufflePrompt}
                title="Shuffle Prompt"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '5px 8px',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}
              >
                <Shuffle size={12} /> 🎲
              </button>
            </div>

            {/* Secret Message Input Area */}
            <div style={{ position: 'relative', width: '100%' }}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 300))}
                placeholder="Type your secret message here... (I will never know who sent this 🤫)"
                rows={4}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1.5px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '12px',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  lineHeight: 1.45,
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '12px',
                fontSize: '0.65rem',
                color: content.length >= 280 ? '#f43f5e' : '#64748b',
                fontWeight: 600
              }}>
                {content.length}/300
              </div>
            </div>

            {errorMsg && (
              <div style={{ fontSize: '0.75rem', color: '#f43f5e', textAlign: 'center', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              style={{
                background: content.trim()
                  ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '16px',
                padding: '12px',
                color: content.trim() ? '#ffffff' : '#64748b',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: content.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: content.trim() ? '0 8px 24px rgba(168, 85, 247, 0.45)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {submitting ? 'Sending Secretly...' : (
                <>
                  Send Anonymously 🚀
                </>
              )}
            </button>

            {/* Privacy Assurance Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#94a3b8',
              fontSize: '0.68rem',
              fontWeight: 600,
              marginTop: '4px'
            }}>
              <Lock size={11} color="#34d399" />
              <span>100% Anonymous • Your identity is completely safe</span>
            </div>
          </form>
        ) : (
          /* SUCCESS SCREEN (NGL STYLE VIRAL GROWTH HOOK) */
          <div style={{
            width: '100%',
            background: 'linear-gradient(170deg, rgba(24, 20, 36, 0.95) 0%, rgba(13, 12, 20, 0.98) 100%)',
            border: '1.5px solid rgba(52, 211, 153, 0.4)',
            borderRadius: '24px',
            padding: '24px 18px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(52, 211, 153, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '14px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.18)',
              border: '2px solid #34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle size={30} color="#34d399" />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Message Sent Anonymously! 🤫
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                @{cleanUsername} will read your secret message inside PulseChat.
              </p>
            </div>

            {/* VIRAL ACQUISITION CALL TO ACTION */}
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.2))',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '14px 12px',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                Want to receive anonymous messages too? ⚡
              </span>
              <a
                href="/"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 6px 18px rgba(99, 102, 241, 0.4)'
                }}
              >
                Get Your Own Link on PulseChat <ArrowRight size={14} />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setSentSuccess(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '6px'
              }}
            >
              Send another message ➔
            </button>
          </div>
        )}

        {/* Footer Brand Credit */}
        <div style={{ marginTop: '24px', fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>
          Powered by PulseChat • Pure AMOLED & Encrypted
        </div>
      </div>
    </div>
  );
}
