import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Check, X, Mail, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { BACKEND_URL, GOOGLE_CLIENT_ID } from '../../utils/config';
import AppLogo from '../common/AppLogo';
import WaterMotionContainer from '../common/WaterMotionContainer';

export default function Register({ switchToLogin }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Email verification state
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otpCode, setOtpCode] = useState('');
  const [registeredData, setRegisteredData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email Regex Check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);

  // Safe response parser that won't throw 'Unexpected token <'
  const parseSafeJson = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Server error (${res.status}). Please ensure your backend is running on port 5000.`);
      }
      throw new Error('Server returned invalid data format.');
    }
  };

  // Cooldown timer for Resend OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Live Username Availability Check
  useEffect(() => {
    if (username.length >= 3) {
      const timer = setTimeout(() => {
        fetch(`${BACKEND_URL}/api/auth/check-username/${username}`)
          .then(res => res.json())
          .then(data => setIsAvailable(data.available))
          .catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  // Google Client ID state & button rendered flag
  const [googleClientId, setGoogleClientId] = useState(GOOGLE_CLIENT_ID);
  const [isGoogleBtnRendered, setIsGoogleBtnRendered] = useState(false);

  useEffect(() => {
    if (!googleClientId || googleClientId.includes('sample')) {
      fetch(`${BACKEND_URL}/api/auth/google-client-id`)
        .then(res => res.json())
        .then(data => {
          if (data.clientId) setGoogleClientId(data.clientId);
        })
        .catch(() => {});
    }
  }, [googleClientId]);

  // Google Sign-In initialization (only when valid client ID is present)
  useEffect(() => {
    if (step === 'form' && googleClientId && !googleClientId.includes('sample') && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback
        });
        const btnEl = document.getElementById('googleRegisterBtn');
        if (btnEl) {
          btnEl.innerHTML = '';
          window.google.accounts.id.renderButton(btnEl, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'signup_with',
            shape: 'pill'
          });
          setIsGoogleBtnRendered(true);
        }
      } catch (e) {
        console.warn('Google Identity initialization error:', e);
      }
    }
  }, [step, googleClientId]);

  const handleGoogleCallback = async (response) => {
    if (!response?.credential) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Sign-In failed.');

      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // Register account — backend sends real OTP to the email address
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, username, password })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      setRegisteredData(data);
      setStep('otp');
      setResendCooldown(60);
      if (data.emailDelivered === false && data.fallbackOtp) {
        setSuccessMsg(`⚠️ Email not delivered (Render blocked SMTP). Test OTP: ${data.fallbackOtp}`);
        setOtpCode(data.fallbackOtp);
      } else {
        setSuccessMsg('A 6-digit verification code has been sent to your email inbox.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          userId: registeredData?.userId
        })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to resend code.');

      setResendCooldown(60);
      if (data.emailDelivered === false && data.fallbackOtp) {
        setSuccessMsg(`⚠️ Email not delivered (Render blocked SMTP). Test OTP: ${data.fallbackOtp}`);
        setOtpCode(data.fallbackOtp);
      } else {
        setSuccessMsg('A fresh verification code has been sent to your email.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: otpCode.trim(),
          userId: registeredData?.userId
        })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Invalid or expired OTP code.');

      // Complete login with verified user data & token
      login({
        token: data.token,
        user: data.user
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WaterMotionContainer maxWidth="440px">
      {step === 'form' ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <AppLogo size={58} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.35rem 0', letterSpacing: '-0.3px' }}>Join PulseChat</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Register with Verified Email or Google</p>
          </div>

            {/* Google Sign-In Section - Single Button */}
            <div style={{ width: '100%', marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
              <div
                id="googleRegisterBtn"
                style={{
                  minHeight: isGoogleBtnRendered ? '44px' : '0',
                  display: isGoogleBtnRendered ? 'flex' : 'none',
                  width: '100%',
                  justifyContent: 'center'
                }}
              ></div>

              {!isGoogleBtnRendered && (
                <button
                  type="button"
                  onClick={() => {
                    if (!googleClientId || googleClientId.includes('sample')) {
                      setError('Google Client ID setup required: Please add your GOOGLE_CLIENT_ID in backend/.env to activate 1-click Google login.');
                    } else if (window.google?.accounts?.id) {
                      window.google.accounts.id.prompt();
                    } else {
                      setError('Google services are initializing. Please try again in a few seconds.');
                    }
                  }}
                  className="btn-secondary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '0.7rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    borderRadius: '24px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Sign up with Google
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0 1.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span style={{ padding: '0 10px', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or with email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>

            {error && (
              <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  placeholder="e.g. Prashant Kumar"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Unique @username</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    placeholder="prashant_dev"
                    style={{ paddingRight: '2.4rem' }}
                  />
                  {isAvailable === true && <Check size={18} color="#10b981" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
                  {isAvailable === false && <X size={18} color="#ef4444" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
                </div>
                {isAvailable === false && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem', margin: 0 }}>Username already taken!</p>}
                {isAvailable === true && <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '0.25rem', margin: 0 }}>Username is available!</p>}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Real Email Address (for verification)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your-name@gmail.com"
                    style={{ paddingRight: '2.4rem' }}
                  />
                  {email.length > 0 && (
                    isEmailValid ? <Check size={18} color="#10b981" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      : <X size={18} color="#ef4444" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading}>
                {loading ? 'Sending Verification Code...' : 'Send Verification OTP'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Already registered? <span onClick={switchToLogin} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign In</span>
              </p>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <button
              type="button"
              className="icon-btn-ghost"
              onClick={() => { setStep('form'); setError(''); setSuccessMsg(''); }}
              style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
                <AppLogo size={54} />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>Verify Your Email</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                Enter the 6-digit code sent to your real inbox:<br />
                <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{email}</strong>
              </p>
            </div>

            {successMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center' }}>
                {successMsg}
              </div>
            )}

            {error && (
              <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 6-Digit OTP</label>
              <input
                type="text"
                className="form-input"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                required
                placeholder="••••••"
                style={{ textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', padding: '0.75rem', fontWeight: 700 }}
                autoFocus
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                Didn't see it? Check your Spam / Promotions folder.
              </p>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading || otpCode.length < 6}>
              {loading ? 'Verifying...' : 'Verify & Enter PulseChat'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              {resendCooldown > 0 ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Resend code in <strong style={{ color: 'var(--text-main)' }}>{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <RefreshCw size={14} /> Resend OTP Code
                </button>
              )}
            </div>
          </form>
        )}
    </WaterMotionContainer>
  );
}
