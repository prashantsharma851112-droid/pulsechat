import React, { useState } from 'react';
import { X, Flame, Shield, Sparkles, Check, AlertCircle } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function PulseStreakModal({
  chatId,
  partnerName,
  streakCount = 0,
  lastStreakDate = '',
  shieldsCount = 0,
  streakShields,
  userSparks = 0,
  onFreezeBought,
  onClose
}) {
  const activeShields = streakShields !== undefined ? streakShields : shieldsCount;
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const token = localStorage.getItem('pulsechat_token');
  const FREEZE_COST = 20;

  const handleBuyFreeze = async () => {
    if (userSparks < FREEZE_COST) {
      setErrorMsg(`Sparks kam hain! Streak Freeze ke liye ${FREEZE_COST} Sparks chahiye.`);
      return;
    }
    setBuyingFreeze(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages/settings/${encodeURIComponent(chatId)}/streak/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`❄️ Streak Freeze Shield active ho gaya! (Shields: ${data.shields})`);
        if (onFreezeBought) {
          onFreezeBought(data.shields, data.pulseSparks);
        }
      } else {
        setErrorMsg(data.error || 'Failed to buy freeze shield');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to buy freeze shield');
    } finally {
      setBuyingFreeze(false);
    }
  };

  // Determine Streak Stage
  const isSupercharged = streakCount >= 7;
  const isCosmic = streakCount >= 30;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(245, 158, 11, 0.25)',
        color: '#fff',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#9ca3af',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {/* Top Flame Animation & Count */}
        <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '18px' }}>
          <div style={{
            fontSize: '3.8rem',
            lineHeight: 1,
            marginBottom: '6px',
            filter: 'drop-shadow(0 0 18px rgba(245, 158, 11, 0.85))',
            animation: 'pulseStreak 1.2s infinite alternate'
          }}>
            🔥
          </div>
          <h2 style={{
            fontSize: '2.2rem',
            fontWeight: 900,
            margin: '0',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px'
          }}>
            {streakCount} DAY STREAK
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
            Chatting with <span style={{ color: '#fbbf24', fontWeight: 700 }}>{partnerName}</span>
          </p>
        </div>

        {/* Milestones & Spark Multiplier */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '14px 16px',
          marginBottom: '18px'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> STREAK REWARDS & MULTIPLIERS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* 3 Days Milestone */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '10px',
              background: streakCount >= 3 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
              border: streakCount >= 3 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🥉 3-Day Spark Booster</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: streakCount >= 3 ? '#10b981' : '#9ca3af' }}>
                {streakCount >= 3 ? '✓ +5 Sparks Unlocked' : '+5 Sparks'}
              </span>
            </div>

            {/* 7 Days Milestone */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '10px',
              background: streakCount >= 7 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255,255,255,0.02)',
              border: streakCount >= 7 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🥈 7-Day Supercharge Flame</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: streakCount >= 7 ? '#10b981' : '#9ca3af' }}>
                {streakCount >= 7 ? '✓ +15 Sparks & Fire Glow' : '+15 Sparks'}
              </span>
            </div>

            {/* 30 Days Milestone */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '10px',
              background: streakCount >= 30 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255,255,255,0.02)',
              border: streakCount >= 30 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🥇 30-Day Cosmic Dragon</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: streakCount >= 30 ? '#10b981' : '#9ca3af' }}>
                {streakCount >= 30 ? '✓ +50 Sparks & Dragon' : '+50 Sparks'}
              </span>
            </div>
          </div>
        </div>

        {/* Streak Freeze (Ice Shield ❄️) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.2) 0%, rgba(3, 105, 161, 0.12) 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '18px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>❄️</span>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>Streak Freeze Shield</div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {activeShields > 0 ? `${activeShields} Shield(s) active! Streak won't break if you miss 1 day.` : 'Protect your streak when traveling or offline!'}
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ color: '#10b981', fontSize: '0.78rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> {successMsg}
            </div>
          )}

          <button
            onClick={handleBuyFreeze}
            disabled={buyingFreeze}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: buyingFreeze ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
            }}
          >
            {buyingFreeze ? 'Activating...' : `Buy Freeze Shield ❄️ (Cost: ${FREEZE_COST} Sparks)`}
          </button>
        </div>

        {/* Streak Tip */}
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.74rem', fontWeight: 600 }}>
          💡 Rule: Send at least 1 message or Fog Snap every day before midnight to keep your flame burning!
        </div>

        <style>{`
          @keyframes pulseStreak {
            0% { transform: scale(1.0); filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.6)); }
            100% { transform: scale(1.12); filter: drop-shadow(0 0 24px rgba(234, 88, 12, 0.95)); }
          }
        `}</style>
      </div>
    </div>
  );
}
