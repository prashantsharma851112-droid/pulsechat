import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { BACKEND_URL } from '../../utils/config';
import { X, Copy, Check, QrCode, Smartphone, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

const OFFICIAL_UPI_ID = '7488519761@ybl';
const OFFICIAL_UPI_NAME = 'PulseChat';

export default function UpiCheckoutModal({ plan, onClose, onSuccess }) {
  const { token, updateUserProfile } = useContext(AuthContext);
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState('');
  const [senderUpi, setSenderUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!plan) return null;

  // Build standard NPCI UPI Intent URI
  const upiIntentUrl = `upi://pay?pa=${OFFICIAL_UPI_ID}&pn=${encodeURIComponent(OFFICIAL_UPI_NAME)}&am=${plan.amount}&cu=INR&tn=${encodeURIComponent(`PulseChat ${plan.name}`)}`;

  // Dynamic High-Resolution QR Code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(upiIntentUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(OFFICIAL_UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenUpiApp = () => {
    window.location.href = upiIntentUrl;
  };

  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUtr = utr.trim().replace(/\s+/g, '');
    if (!cleanUtr) {
      setErrorMsg('Kripya payment receipt se 12-digit UPI UTR / Reference number enter karein.');
      return;
    }

    if (cleanUtr.length < 8) {
      setErrorMsg('UTR number bohot chota hai. Kripya pura 12-digit transaction number dalein.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/submit-upi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: plan.id,
          utr: cleanUtr,
          senderUpi: senderUpi.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Payment verification failed');
      }

      setSuccessMsg(data.message || 'Payment successfully verified!');
      if (data.user) {
        updateUserProfile(data.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: data.user.id,
            updates: {
              isPro: data.user.isPro,
              proTier: data.user.proTier,
              customBadge: data.user.customBadge,
              pulseSparks: data.user.pulseSparks,
              claimedFreeSparks: data.user.claimedFreeSparks
            }
          }
        }));
      }

      if (onSuccess) onSuccess(data);

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Payment verification failed. Kripya check karke dobara koshish karein.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 10001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
        color: '#f8fafc',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15))'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                Instant UPI Checkout
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
              {plan.name} • <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>₹{plan.amount}</strong>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#cbd5e1',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', maxHeight: '82vh' }}>
          
          {/* Step 1: Scan & Pay or 1-Click Pay */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <QrCode size={16} /> Step 1: Scan QR or Open UPI App
            </div>

            {/* QR Code Container */}
            <div style={{
              background: '#ffffff',
              padding: '12px',
              borderRadius: '16px',
              display: 'inline-block',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              marginBottom: '12px'
            }}>
              <img
                src={qrCodeUrl}
                alt="PulseChat UPI QR Code"
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
              Scan using <strong>Google Pay, PhonePe, Paytm</strong> ya koi bhi UPI App
            </div>

            {/* Direct 1-Click Button for Mobile */}
            <button
              onClick={handleOpenUpiApp}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                marginBottom: '14px'
              }}
            >
              <Smartphone size={18} /> Pay ₹{plan.amount} in UPI App (GPay / PhonePe)
            </button>

            {/* Copy UPI ID bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '8px 12px'
            }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>UPI ID:</span>
              <strong style={{ fontSize: '0.88rem', color: '#fff', fontFamily: 'monospace' }}>{OFFICIAL_UPI_ID}</strong>
              <button
                type="button"
                onClick={handleCopyUpi}
                style={{
                  background: copied ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Step 2: Enter 12-Digit UTR */}
          <form onSubmit={handleSubmitUtr} style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Step 2: Enter Payment UTR / Ref No.
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Payment complete hone ke baad UPI app receipt se <strong>12-digit UTR / Ref Number</strong> enter karein:
            </div>

            <div>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                placeholder="e.g. 428172918291"
                maxLength={22}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#090d16',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  outline: 'none'
                }}
              />
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textAlign: 'center'
              }}>
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !utr.trim()}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: utr.trim() ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.94rem',
                cursor: utr.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                transition: 'all 0.2s',
                boxShadow: utr.trim() ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none'
              }}
            >
              {loading ? (
                'Verifying Transaction...'
              ) : (
                <>
                  <Sparkles size={18} /> Verify & Activate {plan.type === 'pro' ? 'VIP' : 'Sparks'} Instantly
                </>
              )}
            </button>
          </form>

          {/* Guarantee / Security Note */}
          <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#64748b' }}>
            🔒 Instant 100% Secure UPI Payment • Direct Settlement • 48-Hour Refund Guarantee
          </div>
        </div>
      </div>
    </div>
  );
}
