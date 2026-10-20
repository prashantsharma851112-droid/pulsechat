import React, { useState, useRef } from 'react';
import { Database, Upload, CheckCircle2, ArrowRight, X, ShieldCheck, Zap, HardDrive, Loader2, KeyRound } from 'lucide-react';
import { restoreFullDeviceBackup } from '../../utils/localDatabase';
import { useBackHandler } from '../../utils/backNavigation';

/**
 * WhatsApp-Style Post-Login Chat Restore Modal
 * Shown on new device login or fresh app install if local IndexedDB has no messages.
 * 100% on-device restore with 0 server bandwidth and AES-256-GCM decryption.
 */
export default function ChatRestorePromptModal({ user, onClose, onRestoreComplete }) {
  const [restoring, setRestoring] = useState(false);
  const [restoredStats, setRestoredStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pendingText, setPendingText] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const fileInputRef = useRef(null);

  useBackHandler(() => {
    if (!restoring) onClose();
  }, true);

  const processRestore = async (text, pwd) => {
    setRestoring(true);
    setErrorMsg(null);

    try {
      const res = await restoreFullDeviceBackup(text, user, pwd);

      if (res?.success) {
        setRestoredStats({
          messages: res.restoredMessages,
          chats: res.restoredChats
        });
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
        onRestoreComplete?.(res);
      } else {
        setErrorMsg('Could not restore backup. Please ensure the file is a valid .pulse backup.');
      }
    } catch (err) {
      console.warn('ChatRestorePromptModal restore error:', err?.message || 'Restore error');
      setErrorMsg(err?.message || 'Failed to restore backup.');
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    try {
      const text = await file.text();
      let isEncrypted = false;
      try {
        const parsed = JSON.parse(text);
        if (parsed.version === 2 || parsed.format === 'pulse_encrypted_backup' || parsed.ciphertext) {
          isEncrypted = true;
        }
      } catch (_) {}

      if (isEncrypted) {
        setPendingText(text);
        setNeedsPassword(true);
      } else {
        await processRestore(text, '');
      }
    } catch (err) {
      setErrorMsg('Failed to read file: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDecryptSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Please enter your backup password.');
      return;
    }
    if (pendingText) {
      await processRestore(pendingText, password);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 10000,
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={() => {
        if (!restoring && !restoredStats) onClose();
      }}
    >
      <div
        className="modal-card interactive-tap"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'linear-gradient(145deg, #18181b 0%, #09090b 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '24px',
          padding: '24px',
          color: '#fff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Background Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {!restoredStats ? (
          <>
            {/* Header / Icon */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
                }}
              >
                <Database size={30} color="#10b981" />
              </div>

              <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Restore Chat History?
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.45 }}>
                Did you switch phones or reinstall PulseChat? Restore your chats & messages from your device or Google Drive backup file.
              </p>
            </div>

            {/* Architecture Highlights (WhatsApp-style Zero Cloud) */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '12px 14px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <Zap size={16} color="#10b981" />
                <span><strong>Instant Restore:</strong> Takes &lt; 1 second locally</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <HardDrive size={16} color="#38bdf8" />
                <span><strong>0 Cloud Bandwidth:</strong> Restores directly to phone memory</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <ShieldCheck size={16} color="#a855f7" />
                <span><strong>Private & Secure:</strong> No chats sent to any server</span>
              </div>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '0.8rem',
                  marginBottom: '14px',
                  textAlign: 'center',
                  fontWeight: 600
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {needsPassword ? (
                <form onSubmit={handleDecryptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <KeyRound size={16} color="#10b981" />
                    Enter Backup Password to Decrypt
                  </div>
                  <input
                    type="password"
                    placeholder="Enter your backup password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={restoring}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNeedsPassword(false);
                        setPassword('');
                        setPendingText(null);
                        setErrorMsg(null);
                      }}
                      disabled={restoring}
                      style={{
                        flex: 1,
                        padding: '11px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        cursor: 'pointer'
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={restoring || !password}
                      style={{
                        flex: 2,
                        padding: '11px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: restoring ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {restoring ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      <span>{restoring ? 'Decrypting...' : 'Unlock & Restore'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={restoring}
                    className="interactive-tap"
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      cursor: restoring ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                      willChange: 'transform',
                      transform: 'translateZ(0)'
                    }}
                  >
                    {restoring ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Restoring Messages...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        <span>Select Backup File (.pulse)</span>
                      </>
                    )}
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pulse,.json,application/json,text/plain"
                    style={{ display: 'none' }}
                    onChange={handleFilePicked}
                  />

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={restoring}
                    className="interactive-tap"
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: 'transparent',
                      color: '#94a3b8',
                      border: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Skip (Start Fresh)</span>
                  </button>
                </>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.72rem', color: '#64748b' }}>
              You can also restore later anytime in <strong>Settings ➔ Storage & Data</strong>
            </div>
          </>
        ) : (
          /* Success Screen */
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle2 size={36} color="#10b981" />
            </div>

            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
              Restore Complete! 🎉
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#94a3b8' }}>
              Successfully restored <strong>{restoredStats.messages.toLocaleString()}</strong> messages & <strong>{restoredStats.chats}</strong> conversations to this device.
            </p>

            <button
              type="button"
              onClick={handleFinish}
              className="interactive-tap"
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '0.94rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                willChange: 'transform',
                transform: 'translateZ(0)'
              }}
            >
              <span>Continue to Chats</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
