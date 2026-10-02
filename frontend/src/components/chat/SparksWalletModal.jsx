import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Zap, ArrowDownLeft, ArrowUpRight, Sparkles, Clock, RefreshCw, Gift, Flame, CheckCircle2, ShoppingBag } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { useBackHandler } from '../../utils/backNavigation';
import PulseProModal from './PulseProModal';

export default function SparksWalletModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState({
    balance: user?.pulseSparks || 50,
    totalEarned: 0,
    totalSpent: 0,
    transactions: [],
    canClaimDaily: false,
    dailyRewardAmount: 15,
    nextClaimInMs: 0
  });
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'credit' | 'debit'
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimToast, setClaimToast] = useState('');
  const [showBuySparksModal, setShowBuySparksModal] = useState(false);

  // Hardware Back button closes modal safely
  useBackHandler(() => setShowBuySparksModal(false), showBuySparksModal);
  useBackHandler(onClose, !showBuySparksModal);

  const fetchWallet = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/sparks/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWalletData({
            balance: typeof data.balance === 'number' ? data.balance : (user?.pulseSparks || 50),
            totalEarned: data.totalEarned || 0,
            totalSpent: data.totalSpent || 0,
            transactions: data.transactions || [],
            canClaimDaily: Boolean(data.canClaimDaily),
            dailyRewardAmount: data.dailyRewardAmount || 15,
            nextClaimInMs: data.nextClaimInMs || 0
          });
          if (updateUserProfile && typeof data.balance === 'number') {
            updateUserProfile({ ...user, pulseSparks: data.balance });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch sparks wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [token, user, updateUserProfile]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Real-time socket listener for incoming sparks
  useEffect(() => {
    if (!socket) return;
    const handleSparksUpdated = (data) => {
      if (data && typeof data.pulseSparks === 'number') {
        playSound('pop');
        setWalletData(prev => ({
          ...prev,
          balance: data.pulseSparks
        }));
        if (updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.pulseSparks });
        }
        // Refresh wallet history in background
        fetchWallet();
      }
    };

    socket.on('sparks_updated', handleSparksUpdated);
    return () => socket.off('sparks_updated', handleSparksUpdated);
  }, [socket, fetchWallet, updateUserProfile, user]);

  const handleClaimDaily = async () => {
    if (!walletData.canClaimDaily || claimingDaily || !token) return;
    try {
      setClaimingDaily(true);
      playSound('pop');
      const res = await fetch(`${BACKEND_URL}/api/sparks/claim-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        playSound('sparkle');
        setClaimToast(`🎉 +${data.addedAmount || 15} Free Sparks Claimed!`);
        setWalletData(prev => ({
          ...prev,
          balance: data.balance,
          canClaimDaily: false,
          totalEarned: prev.totalEarned + (data.addedAmount || 15),
          transactions: data.transaction ? [data.transaction, ...prev.transactions] : prev.transactions
        }));
        if (updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.balance });
        }
        setTimeout(() => setClaimToast(''), 3500);
      } else {
        setClaimToast(data.error || 'Failed to claim daily reward');
        setTimeout(() => setClaimToast(''), 3000);
      }
    } catch (e) {
      setClaimToast('Error claiming daily sparks');
      setTimeout(() => setClaimToast(''), 3000);
    } finally {
      setClaimingDaily(false);
    }
  };

  const filteredTransactions = walletData.transactions.filter(tx => {
    if (filterTab === 'credit') return tx.type === 'credit';
    if (filterTab === 'debit') return tx.type === 'debit';
    return true;
  });

  const formatTxDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-secondary, #12141a)',
          borderRadius: '24px',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'pulseModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
            }}>
              <Zap size={20} color="#fff" fill="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #fff)', letterSpacing: '-0.02em' }}>
                Sparks Wallet
              </h2>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                Your pulse currency & transaction ledger
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchWallet}
              title="Refresh Balance"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {claimToast && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: '0.86rem',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '12px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              animation: 'pulseModalPop 0.2s ease'
            }}>
              {claimToast}
            </div>
          )}

          {/* Glowing Balance Card */}
          <div style={{
            position: 'relative',
            borderRadius: '20px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.85) 0%, rgba(49, 16, 66, 0.85) 50%, rgba(20, 15, 40, 0.85) 100%)',
            border: '1.5px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            marginBottom: '18px'
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#f59e0b' }}>
                Total Sparks Balance
              </span>
              <span style={{
                fontSize: '0.72rem',
                padding: '3px 9px',
                borderRadius: '20px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                fontWeight: 700,
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                Pulse Currency ⚡
              </span>
            </div>

            {/* Big Amount */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <span style={{
                fontSize: '2.6rem',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                textShadow: '0 4px 16px rgba(245, 158, 11, 0.5)'
              }}>
                {walletData.balance.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                Sparks ⚡
              </span>
            </div>

            {/* Earnings and Spent Summary Badges */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ArrowDownLeft size={16} color="#10b981" />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Total Earned</div>
                  <div style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 800 }}>+{walletData.totalEarned} ⚡</div>
                </div>
              </div>

              <div style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ArrowUpRight size={16} color="#ef4444" />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Total Spent</div>
                  <div style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 800 }}>-{walletData.totalSpent} ⚡</div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Top Up / Buy & Daily Free Claim */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowBuySparksModal(true)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                }}
              >
                <ShoppingBag size={15} />
                <span>Get Sparks</span>
              </button>

              <button
                type="button"
                onClick={handleClaimDaily}
                disabled={!walletData.canClaimDaily || claimingDaily}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: walletData.canClaimDaily
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  border: walletData.canClaimDaily ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: walletData.canClaimDaily ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: walletData.canClaimDaily ? 'pointer' : 'default',
                  boxShadow: walletData.canClaimDaily ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none'
                }}
              >
                {walletData.canClaimDaily ? (
                  <>
                    <Gift size={15} />
                    <span>Free +15 Daily ⚡</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} color="#10b981" />
                    <span>Daily Claimed</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* History Header & Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Sparks History ({filteredTransactions.length})
            </h3>

            {/* Filter Pills */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '20px',
              padding: '3px',
              gap: '2px'
            }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'credit', label: 'Earned' },
                { id: 'debit', label: 'Spent' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: 'none',
                    background: filterTab === tab.id ? 'var(--accent, #6366f1)' : 'transparent',
                    color: filterTab === tab.id ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Ledger List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading Sparks transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}>
                <Sparkles size={22} color="#f59e0b" />
              </div>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                No Sparks transactions yet
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tip vibes on stories, claim daily bonuses, or send gifts to start your ledger!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTransactions.map((tx, idx) => {
                const isCredit = tx.type === 'credit';
                return (
                  <div
                    key={tx._id || tx.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Left: Direction Icon & Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${isCredit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isCredit ? (
                          <ArrowDownLeft size={18} color="#10b981" />
                        ) : (
                          <ArrowUpRight size={18} color="#ef4444" />
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {tx.title || (isCredit ? 'Received Sparks' : 'Sent Sparks')}
                        </div>
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px'
                        }}>
                          {tx.description || formatTxDate(tx.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Balance after */}
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{
                        fontSize: '0.96rem',
                        fontWeight: 800,
                        color: isCredit ? '#10b981' : '#f59e0b'
                      }}>
                        {isCredit ? `+${tx.amount}` : `-${tx.amount}`} ⚡
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatTxDate(tx.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sparks Purchase / Top-Up Modal */}
      {showBuySparksModal && (
        <PulseProModal
          initialTab="sparks"
          onClose={() => {
            setShowBuySparksModal(false);
            fetchWallet();
          }}
        />
      )}
    </div>
  );
}
