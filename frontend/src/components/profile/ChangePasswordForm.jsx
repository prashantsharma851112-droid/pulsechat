import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function ChangePasswordForm({ onSuccess, isCardView = false }) {
  const { user, token } = useContext(AuthContext);

  // Password Change & OTP Reset States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // OTP Reset without Logout States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');

  const handleSendResetOtp = async () => {
    if (!user?.email) {
      setPassError('No email registered on this account.');
      return;
    }
    setSendingOtp(true);
    setPassError('');
    setPassSuccess('');
    setOtpNotice('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsForgotMode(true);
        if (data.fallbackOtp) {
          setOtpNotice(`OTP Code: ${data.fallbackOtp} (Sent to ${user.email})`);
        } else {
          setOtpNotice(`A 6-digit reset code was sent to ${user.email}`);
        }
      } else {
        setPassError(data.error || 'Failed to send OTP code.');
      }
    } catch (err) {
      setPassError('Network error. Failed to send OTP code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (isForgotMode) {
      if (!resetOtp.trim()) {
        setPassError('Please enter the 6-digit OTP code sent to your email.');
        return;
      }
      if (!newPassword || !confirmPassword) {
        setPassError('Please enter your new password.');
        return;
      }
      if (newPassword.length < 6) {
        setPassError('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPassError('New passwords do not match.');
        return;
      }

      setPassLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            otp: resetOtp.trim(),
            newPassword
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setPassSuccess('Password updated successfully via Email OTP! 🎉');
          setResetOtp('');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setIsForgotMode(false);
          setOtpNotice('');
          if (onSuccess) onSuccess();
        } else {
          setPassError(data.error || 'Failed to reset password via OTP.');
        }
      } catch (err) {
        setPassError('Network error. Failed to reset password.');
      } finally {
        setPassLoading(false);
      }
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPassSuccess('Password updated successfully! 🎉');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
      } else {
        setPassError(data.error || 'Failed to change password.');
      }
    } catch (err) {
      setPassError('Network error. Failed to change password.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleChangePassword}
      style={{
        padding: isCardView ? '0' : '1.5rem',
        flex: isCardView ? 'none' : 1,
        minHeight: 0,
        overflowY: isCardView ? 'visible' : 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {passError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{passError}</span>
        </div>
      )}

      {passSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{passSuccess}</span>
        </div>
      )}

      {otpNotice && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid var(--accent)',
          color: 'var(--text-main)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span>{otpNotice}</span>
        </div>
      )}

      {isForgotMode ? (
        /* OTP Reset Mode */
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="form-label" style={{ margin: 0 }}>6-Digit Email Code</label>
            <button
              type="button"
              onClick={() => { setIsForgotMode(false); setPassError(''); setOtpNotice(''); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
            >
              ↩ Use Old Password
            </button>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Enter 6-digit code sent to email"
            value={resetOtp}
            onChange={e => setResetOtp(e.target.value)}
            maxLength={6}
          />
        </div>
      ) : (
        /* Normal Current Password Mode */
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="form-label" style={{ margin: 0 }}>Current Password</label>
            {user?.email && (
              <button
                type="button"
                onClick={handleSendResetOtp}
                disabled={sendingOtp}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
              >
                {sendingOtp ? 'Sending Code...' : '🔑 Forgot Old Password? Reset via Email OTP'}
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showCurrentPass ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={{ width: '100%', paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPass(!showCurrentPass)}
              className="icon-btn-ghost"
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
              title={showCurrentPass ? 'Hide password' : 'Show password'}
            >
              {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* New Password */}
      <div style={{ marginBottom: '1rem' }}>
        <label className="form-label">New Password (min 6 characters)</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showNewPass ? 'text' : 'password'}
            className="form-input"
            placeholder="Enter new password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowNewPass(!showNewPass)}
            className="icon-btn-ghost"
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
            title={showNewPass ? 'Hide password' : 'Show password'}
          >
            {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Confirm New Password */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label className="form-label">Confirm New Password</label>
        <input
          type={showNewPass ? 'text' : 'password'}
          className="form-input"
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%', padding: '0.8rem' }}
        disabled={passLoading}
      >
        {passLoading ? 'Updating Password...' : (isForgotMode ? 'Reset & Save Password' : 'Change Password')}
      </button>
    </form>
  );
}
