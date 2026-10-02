import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Upload, Camera, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { compressImage, parseSafeJson } from '../../utils/imageCompressor';
import { useBackHandler } from '../../utils/backNavigation';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=neon',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=cyber',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=prashant',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=glitch',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=luna',
  'https://api.dicebear.com/7.x/big-smile/svg?seed=happy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=blaze'
];

export default function ProfileModal({ onClose, onOpenFullDp }) {
  useBackHandler(onClose, true);
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'

  // Profile Edit States
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username || '');
  const [status, setStatus] = useState(user.status || '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [profileError, setProfileError] = useState('');

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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileError('');
    setCompressing(true);
    try {
      const compressed = await compressImage(file, 360, 360, 0.82);
      setAvatar(compressed);
    } catch (err) {
      console.warn('Image compression failed:', err);
      setProfileError(err.message || 'Failed to process selected image.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setProfileError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: (username || '').trim(),
          displayName: (displayName || '').trim(),
          avatar,
          status: (status || '').trim()
        })
      });
      const data = await parseSafeJson(res);
      if (res.ok && data.user) {
        updateUserProfile(data.user);
        window.dispatchEvent(new CustomEvent('pulsechat_user_profile_updated', {
          detail: {
            targetUserId: data.user.id,
            updates: {
              username: data.user.username,
              avatar: data.user.avatar,
              displayName: data.user.displayName,
              status: data.user.status,
              isPro: data.user.isPro,
              proTier: data.user.proTier,
              customBadge: data.user.customBadge,
              pulseSparks: data.user.pulseSparks
            }
          }
        }));
        onClose();
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 600 }}>
            Account Settings
          </h3>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: '4px 8px 0 8px',
          gap: '6px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'profile' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: activeTab === 'profile' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === 'profile' ? 600 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <UserIcon size={16} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('password')}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'password' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: activeTab === 'password' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === 'password' ? 600 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Lock size={16} />
            <span>Change Password</span>
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div style={{ padding: '1.5rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {profileError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{profileError}</span>
              </div>
            )}

            {/* Current DP Avatar Preview with Upload Trigger */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
              <div
                className={user?.isPro ? 'pro-neon-avatar pro-neon-avatar-lg' : ''}
                style={{ position: 'relative', display: 'inline-block' }}
              >
                {user?.hasKingCrown ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '1.6rem',
                      filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.95))',
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}
                    title="👑 #1 Gold Leaderboard King"
                  >
                    👑
                  </div>
                ) : user?.hasSilverCrown ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '1.6rem',
                      filter: 'drop-shadow(0 2px 6px rgba(203, 213, 225, 0.95))',
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}
                    title="👑 #2 Silver Leaderboard Champion"
                  >
                    👑
                  </div>
                ) : user?.hasStreakCrown ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '1.6rem',
                      filter: 'drop-shadow(0 2px 6px rgba(239, 68, 68, 0.95))',
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}
                    title="👑 7-Day Gaming Streak Crown"
                  >
                    👑
                  </div>
                ) : null}
                <img
                  src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                  alt="Current DP"
                  onClick={() => onOpenFullDp && onOpenFullDp(avatar || user.avatar, displayName || user.displayName || user.username, user.username)}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: user?.hasKingCrown
                      ? '3.5px solid #fbbf24'
                      : user?.hasSilverCrown
                      ? '3.5px solid #cbd5e1'
                      : user?.hasStreakCrown
                      ? '3.5px solid #f97316'
                      : (user?.isPro ? 'none' : '3px solid var(--accent)'),
                    boxShadow: user?.isPro ? 'none' : '0 8px 20px rgba(0,0,0,0.3)',
                    cursor: 'pointer'
                  }}
                  title="Click to view full photo"
                />
                <label
                  htmlFor="dp-file-input"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    background: 'var(--accent)',
                    color: '#fff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                  }}
                  title="Upload Photo (Instant Compressed)"
                >
                  {compressing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </label>
                <input
                  id="dp-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                {compressing ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Optimizing & compressing photo...</span>
                ) : (
                  'Upload any image or pick an avatar preset below!'
                )}
              </p>
            </div>

            {/* Preset Avatars Selection */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '1.25rem', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
              {PRESET_AVATARS.map((avUrl) => (
                <img
                  key={avUrl}
                  src={avUrl}
                  onClick={() => setAvatar(avUrl)}
                  alt="Avatar preset"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: avatar === avUrl ? '2.5px solid var(--accent)' : '2px solid transparent',
                    background: 'var(--bg-card)',
                    padding: '2px',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>

            {/* Instant DP Save Prompt Banner when a new avatar is selected */}
            {avatar !== user?.avatar && (
              <div style={{
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                border: '1.5px solid var(--accent)',
                padding: '12px 16px',
                borderRadius: '16px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
              }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="var(--accent)" /> New Profile Photo Selected!
                </span>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="btn-primary"
                  disabled={loading}
                  style={{
                    padding: '8px 22px',
                    borderRadius: '20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {loading ? 'Saving DP...' : 'Save New DP Now'}
                </button>
              </div>
            )}

            {/* Username Handle */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Username (@handle)</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Your unique handle: <strong style={{ color: 'var(--accent)' }}>@{username || 'username'}</strong>
              </div>
            </div>

            {/* Display Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>

            {/* Status / Bio */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Status / Bio</label>
              <input
                type="text"
                className="form-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
                placeholder="Available"
              />
            </div>

            <button onClick={handleSaveProfile} className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={loading}>
              {loading ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </div>
        ) : (
          /* Password Change Tab */
          <form onSubmit={handleChangePassword} style={{ padding: '1.5rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
        )}
      </div>
    </div>
  );
}
