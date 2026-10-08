import React, { useState, useEffect } from 'react';
import { X, Check, Edit3, Trash2, ShieldCheck, Sparkles, User, RefreshCw } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function ChatNicknameModal({
  isOpen,
  onClose,
  chatId,
  partner,
  currentUser,
  nicknames = {},
  onNicknameUpdated
}) {
  const partnerId = partner?.id || partner?._id || partner?.userId || '';
  const myId = currentUser?.id || currentUser?._id || '';

  const initialPartnerNick = (partnerId && nicknames?.[partnerId]) ? nicknames[partnerId] : '';
  const initialMyNick = (myId && nicknames?.[myId]) ? nicknames[myId] : '';

  const [partnerNick, setPartnerNick] = useState(initialPartnerNick);
  const [myNick, setMyNick] = useState(initialMyNick);

  const [savingTarget, setSavingTarget] = useState(null); // 'partner' | 'me' | null
  const [successTarget, setSuccessTarget] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPartnerNick((partnerId && nicknames?.[partnerId]) ? nicknames[partnerId] : '');
      setMyNick((myId && nicknames?.[myId]) ? nicknames[myId] : '');
      setErrorMsg('');
      setSuccessTarget(null);
    }
  }, [isOpen, nicknames, partnerId, myId]);

  if (!isOpen) return null;

  const handleSaveNickname = async (target, targetUserId, newNickValue) => {
    if (!chatId || !targetUserId) return;
    setSavingTarget(target);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('pulsechat_token');
      const res = await fetch(`${BACKEND_URL}/api/messages/settings/${encodeURIComponent(chatId)}/nickname`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId,
          nickname: newNickValue
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save nickname');
      }

      setSuccessTarget(target);
      setTimeout(() => setSuccessTarget(null), 2500);

      if (onNicknameUpdated) {
        onNicknameUpdated(targetUserId, newNickValue, data.nicknames || {});
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating nickname');
    } finally {
      setSavingTarget(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        backgroundColor: 'rgba(5, 5, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--bg-card, #12121a)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUpMiniPlayer 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.2rem 1.4rem',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
            }}>
              <Edit3 size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main, #fff)' }}>
                Chat Nicknames
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)' }}>
                Mutual nicknames for this conversation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="icon-btn-ghost"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Privacy Notice Banner */}
        <div style={{
          padding: '0.75rem 1.2rem',
          background: 'rgba(99, 102, 241, 0.08)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '9px',
          fontSize: '0.76rem',
          color: 'var(--text-muted, #cbd5e1)',
          lineHeight: '1.35'
        }}>
          <ShieldCheck size={16} color="var(--accent, #6366f1)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Nicknames are <strong>only visible to the two of you</strong> in this chat. Global usernames and profile names will never change.
          </span>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.78rem'
            }}>
              {errorMsg}
            </div>
          )}

          {/* Section 1: Partner's Nickname */}
          {partner && (
            <div style={{
              padding: '1rem',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {/* Partner Info Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(partner.username || partner.displayName || 'User')}`}
                  alt={partner.displayName}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {partner.displayName}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)' }}>
                    @{partner.username}
                  </div>
                </div>
                {nicknames?.[partnerId] && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    fontWeight: 600
                  }}>
                    Active Nickname
                  </span>
                )}
              </div>

              {/* Input for Partner Nickname */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
                  Nickname for {partner.displayName}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={32}
                    value={partnerNick}
                    onChange={(e) => setPartnerNick(e.target.value)}
                    placeholder={`e.g. Bestie, ${partner.displayName?.split(' ')[0] || 'Friend'}...`}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                      color: 'var(--text-main, #fff)',
                      fontSize: '0.86rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveNickname('partner', partnerId, partnerNick);
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => handleSaveNickname('partner', partnerId, partnerNick)}
                    disabled={savingTarget === 'partner'}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '12px',
                      background: successTarget === 'partner'
                        ? '#10b981'
                        : 'linear-gradient(135deg, #6366f1, #a855f7)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: savingTarget === 'partner' ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      flexShrink: 0,
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {savingTarget === 'partner' ? (
                      <RefreshCw size={14} className="spin" />
                    ) : successTarget === 'partner' ? (
                      <>
                        <Check size={14} /> Saved
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>

                  {nicknames?.[partnerId] && (
                    <button
                      type="button"
                      title="Clear nickname and reset to original name"
                      onClick={() => {
                        setPartnerNick('');
                        handleSaveNickname('partner', partnerId, '');
                      }}
                      disabled={savingTarget === 'partner'}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Current User's Own Nickname in this chat */}
          {currentUser && (
            <div style={{
              padding: '1rem',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {/* My Info Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.username || currentUser.displayName || 'Me')}`}
                  alt={currentUser.displayName}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.displayName} (You)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)' }}>
                    @{currentUser.username}
                  </div>
                </div>
                {nicknames?.[myId] && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    fontWeight: 600
                  }}>
                    Active Nickname
                  </span>
                )}
              </div>

              {/* Input for My Nickname */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
                  Your Nickname in this chat
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={32}
                    value={myNick}
                    onChange={(e) => setMyNick(e.target.value)}
                    placeholder="e.g. Captain, Star, Ace..."
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                      color: 'var(--text-main, #fff)',
                      fontSize: '0.86rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveNickname('me', myId, myNick);
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => handleSaveNickname('me', myId, myNick)}
                    disabled={savingTarget === 'me'}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '12px',
                      background: successTarget === 'me'
                        ? '#10b981'
                        : 'linear-gradient(135deg, #6366f1, #a855f7)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: savingTarget === 'me' ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      flexShrink: 0,
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {savingTarget === 'me' ? (
                      <RefreshCw size={14} className="spin" />
                    ) : successTarget === 'me' ? (
                      <>
                        <Check size={14} /> Saved
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>

                  {nicknames?.[myId] && (
                    <button
                      type="button"
                      title="Clear nickname and reset to original name"
                      onClick={() => {
                        setMyNick('');
                        handleSaveNickname('me', myId, '');
                      }}
                      disabled={savingTarget === 'me'}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.4rem',
          borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.6rem 1.3rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-main, #fff)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
