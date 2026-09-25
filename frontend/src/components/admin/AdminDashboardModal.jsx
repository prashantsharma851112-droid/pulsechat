import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Shield, Users, Wifi, MessageSquare, PlusCircle, RefreshCw, Crown, Lock, CheckCircle2, AlertCircle, Search, Sparkles } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function AdminDashboardModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);

  const [secretCode, setSecretCode] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');
  const [claimError, setClaimError] = useState('');

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const isAdminActive = Boolean(user?.isAdmin);

  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pulsechat_token') : null);

  const fetchStats = async () => {
    if (!activeToken || !isAdminActive) return;
    try {
      setError('');
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data);
      } else {
        setError(data.error || 'Failed to load admin metrics.');
      }
    } catch (err) {
      setError('Network error loading admin stats. Please verify server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminActive) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isAdminActive, activeToken]);

  const handleClaimAdmin = async (e) => {
    e.preventDefault();
    if (!secretCode.trim()) return;

    setClaimLoading(true);
    setClaimError('');
    setClaimMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/claim-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ secretCode: secretCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimMsg(data.message || '👑 Master Admin status activated!');
        if (data.user) {
          updateUserProfile(data.user);
        }
      } else {
        setClaimError(data.error || 'Invalid passcode.');
      }
    } catch (err) {
      setClaimError('Network error activating admin status.');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleTogglePro = async (targetUserId, currentPro) => {
    if (!activeToken) return;
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/toggle-user-pro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ targetUserId, isPro: !currentPro })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically update local stats
        setStats(prev => {
          if (!prev || !prev.users) return prev;
          return {
            ...prev,
            users: prev.users.map(u => u.id === targetUserId || u.mongoId === targetUserId ? { ...u, isPro: !currentPro } : u)
          };
        });
        fetchStats();
      } else {
        alert(data.error || 'Failed to update user VIP status.');
      }
    } catch (err) {
      alert('Network error updating user status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = stats?.users?.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive modal-card-animated"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '24px'
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(99, 102, 241, 0.15))',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Crown size={22} color="#f59e0b" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 800 }}>
                PulseChat Master Admin Dashboard
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={12} /> Master Admin Mode (Full Access Control)
              </div>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isAdminActive ? (
            /* Passcode Activation Mode */
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#f59e0b' }}>
                <Lock size={28} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 800 }}>
                Enter Secret Admin Passcode
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Activate Master Admin privileges to view live user analytics, real-time active users, and manage accounts.
              </p>

              {claimError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>
                  ⚠️ {claimError}
                </div>
              )}
              {claimMsg && (
                <div style={{ color: '#10b981', fontSize: '0.84rem', marginBottom: '1rem', fontWeight: 700 }}>
                  🎉 {claimMsg}
                </div>
              )}

              <form onSubmit={handleClaimAdmin} style={{ display: 'flex', gap: '8px', maxWidth: '380px', margin: '0 auto' }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter Passcode (e.g. pulse_master_admin_851112)"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" disabled={claimLoading} style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>
                  {claimLoading ? 'Verifying...' : 'Activate'}
                </button>
              </form>
            </div>
          ) : (
            /* Live Dashboard Stats & Controls */
            <>
              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontSize: '0.82rem' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* 4 Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {/* 1. Total Registered Users */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span>Total Registered</span>
                    <Users size={16} color="var(--accent)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.totalUsers || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    User Accounts in MongoDB
                  </div>
                </div>

                {/* 2. Live Active Users Right Now */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', fontSize: '0.78rem', fontWeight: 700 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Live Online Now
                    </span>
                    <Wifi size={16} color="#10b981" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.liveOnlineCount || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', opacity: 0.9, marginTop: '2px' }}>
                    Active Live Sockets Right Now
                  </div>
                </div>

                {/* 3. Total Messages Transmitted */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span>Messages Transmitted</span>
                    <MessageSquare size={16} color="#ec4899" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.totalMessages || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Stored Messages
                  </div>
                </div>

                {/* 4. Total Groups */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span>Groups Created</span>
                    <PlusCircle size={16} color="#a855f7" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.totalGroups || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Active Group Rooms
                  </div>
                </div>
              </div>

              {/* User Management Section */}
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Registered Users Management ({filteredUsers.length})
                  </h4>
                  <button
                    onClick={fetchStats}
                    className="icon-btn-ghost"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--accent)' }}
                    title="Refresh live metrics"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by name, @username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '36px', width: '100%', fontSize: '0.84rem' }}
                  />
                </div>

                {/* Users List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredUsers.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No registered users found.
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img
                              src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                              alt={u.displayName}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: u.isLiveOnline ? '#10b981' : '#6b7280',
                                border: '2px solid var(--bg-card)'
                              }}
                              title={u.isLiveOnline ? 'Online Now' : 'Offline'}
                            />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>{u.displayName || u.username}</span>
                              {u.isPro && <Crown size={13} color="#f59e0b" title="VIP Pro Member" />}
                              {u.isAdmin && <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent)', fontWeight: 800 }}>ADMIN</span>}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              @{u.username} {u.email ? `• ${u.email}` : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePro(u.id || u.mongoId, u.isPro)}
                          disabled={actionLoadingId === u.id || actionLoadingId === u.mongoId}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '10px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: u.isPro ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--accent)',
                            background: u.isPro ? 'rgba(245, 158, 11, 0.18)' : 'rgba(99, 102, 241, 0.15)',
                            color: u.isPro ? '#f59e0b' : 'var(--accent)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {(actionLoadingId === u.id || actionLoadingId === u.mongoId)
                            ? 'Updating...'
                            : (u.isPro ? '👑 Revoke VIP' : '⭐ Grant VIP Pro')}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
