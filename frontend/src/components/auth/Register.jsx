import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Check, X, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

export default function Register({ switchToLogin }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState('');

  // Email verification state
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [registeredData, setRegisteredData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Email Regex Check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);

  // Live Username Check
  useEffect(() => {
    if (username.length >= 3) {
      const timer = setTimeout(() => {
        fetch(`${BACKEND_URL}/api/auth/check-username/${username}`)
          .then(res => res.json())
          .then(data => setIsAvailable(data.available));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Register account
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      setRegisteredData(data);

      // Step 2: Request OTP for email verification
      const otpRes = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const otpData = await otpRes.json();
      if (otpData.otp) {
        setDemoOtp(otpData.otp);
      }

      setStep('otp');
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
          otp: otpCode,
          userId: registeredData?.user?.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP code.');

      // Complete login with updated verified user data
      login({
        token: registeredData.token,
        user: data.user
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div className="auth-card">
        {step === 'form' ? (
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.4rem 0' }}>Join PulseChat ⚡</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Register with Email, Unique @username & Password</p>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                placeholder="Alex Rivers"
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
                  placeholder="alex_dev"
                  style={{ paddingRight: '2.4rem' }}
                />
                {isAvailable === true && <Check size={18} color="#10b981" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
                {isAvailable === false && <X size={18} color="#ef4444" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />}
              </div>
              {isAvailable === false && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem', margin: 0 }}>Username already taken!</p>}
              {isAvailable === true && <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '0.2rem', margin: 0 }}>Username is available!</p>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="alex@example.com"
                  style={{ paddingRight: '2.4rem' }}
                />
                {email.length > 0 && (
                  isEmailValid ? <Check size={18} color="#10b981" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    : <X size={18} color="#ef4444" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
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
              {loading ? 'Creating Account...' : 'Continue to Verification'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Already registered? <span onClick={switchToLogin} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign In</span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <button
              type="button"
              className="icon-btn-ghost"
              onClick={() => setStep('form')}
              style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <Mail size={24} color="var(--accent)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>Verify Your Email</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                We sent a 6-digit OTP verification code to <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
              </p>
            </div>

            {demoOtp && (
              <div className="demo-otp-banner">
                <ShieldCheck size={18} color="#10b981" />
                <span>Demo Test OTP Code: <strong>{demoOtp}</strong></span>
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Enter 6-Digit OTP</label>
              <input
                type="text"
                className="form-input"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                required
                placeholder="123456"
                style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px', padding: '0.75rem' }}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Enter PulseChat'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
