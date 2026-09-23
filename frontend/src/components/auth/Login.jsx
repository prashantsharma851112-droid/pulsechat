import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Lock, AtSign, Mail, ArrowLeft, RefreshCw, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { BACKEND_URL, GOOGLE_CLIENT_ID } from '../../utils/config';
import AppLogo from '../common/AppLogo';

export default function Login({ switchToRegister }) {
  const { login } = useContext(AuthContext);

  // View modes: 'login' | 'unverified_otp' | 'forgot_email' | 'forgot_reset'
  const [viewMode, setViewMode] = useState('login');

  // Credentials for login
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // States for Forgot Password flow
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Common UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Unverified account OTP interception
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [unverifiedUserId, setUnverifiedUserId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Safe response parser that won't throw 'Unexpected token <'
  const parseSafeJson = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Server error (${res.status}). Please ensure your backend is running.`);
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

  // Google Sign-In initialization (with resilient polling for async CDN script)
  useEffect(() => {
    if (viewMode !== 'login' || !googleClientId || googleClientId.includes('sample')) return;

    let attempts = 0;
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCallback
          });
          const btnEl = document.getElementById('googleLoginBtn');
          if (btnEl) {
            btnEl.innerHTML = '';
            window.google.accounts.id.renderButton(btnEl, {
              theme: 'outline',
              size: 'large',
              width: 320,
              text: 'signin_with',
              shape: 'pill'
            });
            setIsGoogleBtnRendered(true);
          }
        } catch (e) {
          console.warn('Google Identity initialization error:', e);
        }
        return true;
      }
      return false;
    };

    if (!initGoogle()) {
      const interval = setInterval(() => {
        attempts++;
        if (initGoogle() || attempts > 20) {
          clearInterval(interval);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [viewMode, googleClientId]);

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

  // Standard Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await parseSafeJson(res);

      // Check if account email is unverified
      if (res.status === 403 && data.requiresVerification) {
        setUnverifiedEmail(data.email || identifier);
        setUnverifiedUserId(data.userId || '');
        setViewMode('unverified_otp');
        setResendCooldown(60);
        if (data.emailDelivered === false && data.fallbackOtp) {
          setSuccessMsg(`⚠️ Email not delivered (Render blocked SMTP). Test OTP: ${data.fallbackOtp}`);
          setOtpCode(data.fallbackOtp);
        } else {
          setSuccessMsg(data.error || 'Verification code sent to your email.');
        }
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Login failed.');

      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify Unverified Account OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: unverifiedEmail,
          otp: otpCode.trim(),
          userId: unverifiedUserId
        })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Invalid or expired OTP code.');

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

  // Resend OTP for Unverified Login
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
          email: unverifiedEmail,
          userId: unverifiedUserId
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

  // Forgot Password: Step 1 - Send Recovery Code
  const handleSendRecoveryCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const clean = forgotEmail.trim();
    if (!clean || !clean.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to send recovery code.');

      setViewMode('forgot_reset');
      setResendCooldown(60);
      if (data.emailDelivered === false && data.fallbackOtp) {
        setSuccessMsg(`⚠️ Email not delivered (Render blocked SMTP). Test OTP: ${data.fallbackOtp}`);
        setResetOtp(data.fallbackOtp);
      } else {
        setSuccessMsg('A 6-digit password reset code has been sent to your email inbox.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 2 - Verify OTP & Set New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: resetOtp.trim(),
          newPassword
        })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');

      // Success! Switch back to login with email prefilled
      setViewMode('login');
      setIdentifier(forgotEmail.trim());
      setPassword('');
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Your password has been reset successfully! Please sign in with your new password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* 1. Normal Sign In View */}
        {viewMode === 'login' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
                <AppLogo size={56} />
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                Welcome to PulseChat
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Sign in with Google or Email
              </p>
            </div>

            {/* Google Sign-In Section */}
            <div style={{ width: '100%', marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
              <div
                id="googleLoginBtn"
                style={{
                  minHeight: isGoogleBtnRendered ? '44px' : '0',
                  display: isGoogleBtnRendered ? 'flex' : 'none',
                  width: '100%',
                  justifyContent: 'center'
                }}
              />

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
                  Sign in with Google
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0 1.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ padding: '0 10px', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                or with credentials
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {successMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '0.65rem 0.85rem', borderRadius: '12px', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderRadius: '12px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Email or @Username</label>
                <div style={{ position: 'relative' }}>
                  <AtSign size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    placeholder="alex_dev or alex@gmail.com"
                    style={{ paddingLeft: '2.6rem' }}
                  />
                </div>
              </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ paddingLeft: '2.6rem' }}
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.4rem' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgot_email');
                  setForgotEmail(identifier.includes('@') ? identifier : '');
                  setError('');
                  setSuccessMsg('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 0',
                  transition: 'opacity 0.2s'
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <span onClick={switchToRegister} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                Create Account
              </span>
            </p>
          </form>
        </div>
      )}

      {/* 2. Forgot Password - Step 1: Request Email OTP */}
      {viewMode === 'forgot_email' && (
        <form onSubmit={handleSendRecoveryCode}>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={() => { setViewMode('login'); setError(''); setSuccessMsg(''); }}
            style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <AppLogo size={56} />
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>
              Reset Password
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
              Enter your registered email address and we will send you a 6-digit recovery OTP code.
            </p>
          </div>

          {error && (
            <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderRadius: '12px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Your Registered Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-input"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                placeholder="your-email@gmail.com"
                style={{ paddingLeft: '2.6rem' }}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading || !forgotEmail}>
            {loading ? 'Sending Recovery Code...' : 'Send Recovery Code'}
          </button>
        </form>
      )}

      {/* 3. Forgot Password - Step 2: Verify OTP & Enter New Password */}
      {viewMode === 'forgot_reset' && (
        <form onSubmit={handleResetPasswordSubmit}>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={() => { setViewMode('forgot_email'); setError(''); setSuccessMsg(''); }}
            style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <AppLogo size={56} />
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>
              Set New Password
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
              Enter the 6-digit code sent to:<br />
              <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{forgotEmail}</strong>
            </p>
          </div>

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '0.65rem 0.85rem', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          {error && (
            <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderRadius: '12px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* 6-Digit OTP */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 6-Digit Code</label>
            <input
              type="text"
              className="form-input"
              value={resetOtp}
              onChange={e => setResetOtp(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={6}
              required
              placeholder="••••••"
              style={{ textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', padding: '0.75rem', fontWeight: 700 }}
              autoFocus
            />
          </div>

          {/* New Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                style={{ paddingLeft: '2.6rem' }}
              />
            </div>
          </div>

          {/* Confirm New Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat new password"
                style={{ paddingLeft: '2.6rem' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading || resetOtp.length < 6 || !newPassword}>
            {loading ? 'Updating Password...' : 'Reset & Save Password'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            {resendCooldown > 0 ? (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Resend code in <strong style={{ color: 'var(--text-main)' }}>{resendCooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSendRecoveryCode}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={14} /> Resend Reset Code
              </button>
            )}
          </div>
        </form>
      )}

      {/* 4. Unverified Login OTP View */}
      {viewMode === 'unverified_otp' && (
        <form onSubmit={handleVerifyOtp}>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={() => { setViewMode('login'); setError(''); setSuccessMsg(''); }}
            style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <AppLogo size={56} />
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>
              Email Verification Required
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Your account is unverified. We sent a 6-digit verification code to:<br />
              <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{unverifiedEmail}</strong>
            </p>
          </div>

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '0.65rem 0.85rem', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          {error && (
            <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderRadius: '12px' }}>
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
              Check your inbox and spam folder for the code.
            </p>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading || otpCode.length < 6}>
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
      </div>
    </div>
  );
}
