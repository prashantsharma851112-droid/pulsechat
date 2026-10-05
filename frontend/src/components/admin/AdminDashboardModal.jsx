import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { 
  X, Shield, Users, Wifi, MessageSquare, PlusCircle, RefreshCw, Crown, 
  Lock, CheckCircle2, AlertCircle, Search, Sparkles, Trash2, Mail, Send, 
  Clock, Check, HelpCircle, Loader2 
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

export default function AdminDashboardModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [secretCode, setSecretCode] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');
  const [claimError, setClaimError] = useState('');

  // Active Tab: 'overview' | 'support'
  const [activeTab, setActiveTab] = useState('overview');

  const [stats, setStats] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem('pulsechat_admin_stats') : null;
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !stats);
  const [error, setError] = useState('');
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'online' | 'stealth'
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Support Tickets States
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState('');
  const [ticketFilter, setTicketFilter] = useState('all'); // 'all' | 'pending' | 'replied'
  const [replyTexts, setReplyTexts] = useState({});
  const [sendingReplyId, setSendingReplyId] = useState(null);

  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pulsechat_token') : null);

  const fetchStats = async (showSpinner = false) => {
    if (!activeToken) return;
    if (showSpinner && !stats) setLoading(true);
    try {
      setError('');
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (res.status === 403 || res.status === 401) {
        setRequiresPasscode(true);
        setClaimError(data.error || 'Passcode verification required for this account.');
        return;
      }
      if (res.ok && data.success) {
        setStats(data);
        setRequiresPasscode(false);
        try {
          sessionStorage.setItem('pulsechat_admin_stats', JSON.stringify(data));
        } catch (e) {}
      } else {
        if (!stats) setError(data.error || 'Failed to load admin metrics.');
      }
    } catch (err) {
      if (!stats) setError('Network error loading admin stats. Please verify server connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async (showSpinner = false) => {
    if (!activeToken) return;
    if (showSpinner) setLoadingTickets(true);
    try {
      setTicketsError('');
      const res = await fetch(`${BACKEND_URL}/api/admin/support/tickets`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(data.tickets || []);
      } else {
        setTicketsError(data.error || 'Failed to load support tickets.');
      }
    } catch (err) {
      setTicketsError('Network error loading support tickets.');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleReplyTicket = async (ticketId) => {
    const text = (replyTexts[ticketId] || '').trim();
    if (!text) {
      alert('Please enter a reply message before sending.');
      return;
    }
    setSendingReplyId(ticketId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/support/reply/${ticketId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ replyMessage: text })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(prev => prev.map(t => t.id === ticketId ? {
          ...t,
          status: 'replied',
          adminReply: text,
          repliedAt: new Date()
        } : t));
        setReplyTexts(prev => ({ ...prev, [ticketId]: '' }));
        alert(`✅ Reply delivered successfully to user's registered email (${data.ticket?.email || 'user'})!`);
      } else {
        alert(data.error || 'Failed to send reply: ' + (data.error || ''));
      }
    } catch (err) {
      alert('Network error sending reply to user email.');
    } finally {
      setSendingReplyId(null);
    }
  };

  useEffect(() => {
    fetchStats(!stats);
    fetchTickets(false);
    const interval = setInterval(() => {
      fetchStats(false);
      fetchTickets(false);
    }, 8000);

    if (socket) {
      let debounceTimer;
      const handleRealtimeTrigger = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchStats(false), 2000);
      };

      socket.on('receive_message', handleRealtimeTrigger);
      socket.on('message_sent', handleRealtimeTrigger);
      socket.on('user_status', handleRealtimeTrigger);
      socket.on('online_users_list', handleRealtimeTrigger);
      socket.on('group_created', handleRealtimeTrigger);
      socket.on('user_profile_updated', handleRealtimeTrigger);

      return () => {
        clearInterval(interval);
        clearTimeout(debounceTimer);
        socket.off('receive_message', handleRealtimeTrigger);
        socket.off('message_sent', handleRealtimeTrigger);
        socket.off('user_status', handleRealtimeTrigger);
        socket.off('online_users_list', handleRealtimeTrigger);
        socket.off('group_created', handleRealtimeTrigger);
        socket.off('user_profile_updated', handleRealtimeTrigger);
      };
    }

    return () => clearInterval(interval);
  }, [activeToken, socket]);

  const handleClaimAdmin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const passcode = secretCode.trim();
    if (!passcode) {
      setClaimError('Please enter the Master Admin secret passcode.');
      return;
    }

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
        body: JSON.stringify({ secretCode: passcode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimMsg(data.message || '👑 Master Admin status activated!');
        if (data.user) {
          updateUserProfile(data.user);
        }
        setRequiresPasscode(false);
        setTimeout(() => fetchStats(), 300);
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
        setStats(prev => {
          if (!prev || !prev.users) return prev;
          return {
            ...prev,
            users: prev.users.map(u => (u.id === targetUserId || u.mongoId === targetUserId) ? { ...u, isPro: !currentPro } : u)
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

  const handleDeleteUser = async (targetUserId, targetUsername) => {
    if (!activeToken) return;
    const confirmMsg = `⚠️ PERMANENT DELETE WARNING ⚠️\n\nAre you sure you want to PERMANENTLY delete user "@${targetUsername || 'this user'}"?\n\nThis will erase their account and message history from database. This action CANNOT be undone!`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(targetUserId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/delete-user/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(prev => {
          if (!prev || !prev.users) return prev;
          return {
            ...prev,
            totalUsers: Math.max(0, (prev.totalUsers || 1) - 1),
            users: prev.users.filter(u => u.id !== targetUserId && u.mongoId !== targetUserId)
          };
        });
        fetchStats();
      } else {
        alert(data.error || 'Failed to delete user account.');
      }
    } catch (err) {
      alert('Network error deleting user account.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = stats?.users?.filter(u => {
    if (userStatusFilter === 'online' && !u.isLiveOnline) return false;
    if (userStatusFilter === 'stealth' && !(u.isLiveOnline && u.hideOnlineStatus)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 25000 }}>
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
          {requiresPasscode ? (
            /* Passcode Activation Mode */
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#f59e0b' }}>
                <Lock size={28} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 800 }}>
                Enter Secret Admin Passcode
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Passcode verification is required to activate Master Admin privileges for this account.
              </p>

              {claimError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.12)', padding: '8px 12px', borderRadius: '8px' }}>
                  ⚠️ {claimError}
                </div>
              )}
              {claimMsg && (
                <div style={{ color: '#10b981', fontSize: '0.84rem', marginBottom: '1rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '8px 12px', borderRadius: '8px' }}>
                  🎉 {claimMsg}
                </div>
              )}

              <form onSubmit={handleClaimAdmin} style={{ display: 'flex', gap: '8px', maxWidth: '420px', margin: '0 auto', flexDirection: 'column' }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter Secret Master Admin Passcode"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  style={{ width: '100%', textAlign: 'center', fontSize: '0.92rem', fontWeight: 600, letterSpacing: '1px' }}
                />
                <button type="submit" className="btn-primary" disabled={claimLoading} style={{ width: '100%', background: '#f59e0b', color: '#000', fontWeight: 800, padding: '10px' }}>
                  {claimLoading ? 'Verifying Admin Status...' : '👑 Activate Master Admin Status'}
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

              {/* Navigation Tabs */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: activeTab === 'overview' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: activeTab === 'overview' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                    color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users size={15} /> Overview & Users
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('support'); fetchTickets(true); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: activeTab === 'support' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    background: activeTab === 'support' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                    color: activeTab === 'support' ? '#f59e0b' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Mail size={15} /> User Queries & Support
                  {tickets.filter(t => t.status === 'pending').length > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {tickets.filter(t => t.status === 'pending').length}
                    </span>
                  )}
                </button>
              </div>

              {activeTab === 'overview' && (
                <>
                  {/* 4 Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {/* 1. Total Registered Users */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span>Total Registered</span>
                    <Users size={16} color="var(--accent)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.totalUsers ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Total Registered Accounts
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                      {loading ? '...' : (stats?.liveOnlineCount ?? 0)}
                    </div>
                    {stats?.stealthOnlineCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#c084fc',
                          fontWeight: 700,
                          background: 'rgba(168, 85, 247, 0.2)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          border: '1px solid rgba(168, 85, 247, 0.35)'
                        }}
                        title={`${stats.stealthOnlineCount} live users have hidden their online indicator`}
                      >
                        🕵️ {stats.stealthOnlineCount} Stealth
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', opacity: 0.9, marginTop: '2px' }}>
                    Total Connected Users (Includes Hidden Mode)
                  </div>
                </div>

                {/* 3. Total Messages Transmitted */}
                <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span>Messages Transmitted</span>
                    <MessageSquare size={16} color="#ec4899" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                    {loading ? '...' : (stats?.totalMessages ?? 0)}
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
                    {loading ? '...' : (stats?.totalGroups ?? 0)}
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
                    Registered Users Management ({filteredUsers.length}{searchQuery || userStatusFilter !== 'all' ? ` of ${stats?.totalUsers || 0}` : ''})
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

                {/* Search Bar & Status Filter Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {[
                      { id: 'all', label: `All (${stats?.totalUsers || 0})` },
                      { id: 'online', label: `🟢 Live Online (${stats?.liveOnlineCount || 0})` },
                      { id: 'stealth', label: `🕵️ Hidden/Stealth (${stats?.stealthOnlineCount || 0})` }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setUserStatusFilter(f.id)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          border: userStatusFilter === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: userStatusFilter === f.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-card)',
                          color: userStatusFilter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Users List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredUsers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      {searchQuery || userStatusFilter !== 'all' ? (
                        <>
                          <div>No users matching current filters.</div>
                          <button
                            type="button"
                            onClick={() => { setSearchQuery(''); setUserStatusFilter('all'); }}
                            style={{ marginTop: '8px', border: 'none', background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reset Filters (View All {stats?.totalUsers || 0})
                          </button>
                        </>
                      ) : (
                        <div>No registered users found in database.</div>
                      )}
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id || u.mongoId}
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
                                border: '2px solid var(--bg-card)',
                                boxShadow: u.isLiveOnline ? '0 0 6px rgba(16, 185, 129, 0.8)' : 'none'
                              }}
                              title={u.isLiveOnline ? (u.hideOnlineStatus ? 'Online Now (Stealth / Hidden Indicator)' : 'Online Now') : 'Offline'}
                            />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                              <span>{u.displayName || u.username}</span>
                              {u.isPro && <Crown size={13} color="#f59e0b" title="VIP Pro Member" />}
                              {u.isAdmin && <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent)', fontWeight: 800 }}>ADMIN</span>}
                              {u.isLiveOnline && u.hideOnlineStatus && (
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(168, 85, 247, 0.22)',
                                    color: '#c084fc',
                                    border: '1px solid rgba(168, 85, 247, 0.45)',
                                    fontWeight: 800,
                                    letterSpacing: '0.02em'
                                  }}
                                  title="This user has hidden their online status from other users, but is live right now"
                                >
                                  🕵️ HIDDEN (ONLINE)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              @{u.username} {u.email ? `• ${u.email}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                          {!u.isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id || u.mongoId, u.username)}
                              disabled={actionLoadingId === u.id || actionLoadingId === u.mongoId}
                              title="Permanently Delete Account from DB"
                              style={{
                                padding: '5px 10px',
                                borderRadius: '10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'support' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Support Subheader & Filters */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'all', label: `All (${tickets.length})` },
                    { id: 'pending', label: `Pending (${tickets.filter(t => t.status === 'pending').length})` },
                    { id: 'replied', label: `Replied (${tickets.filter(t => t.status === 'replied').length})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTicketFilter(f.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: ticketFilter === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: ticketFilter === f.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-card)',
                        color: ticketFilter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => fetchTickets(true)}
                  className="icon-btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--accent)' }}
                  title="Refresh support tickets"
                >
                  <RefreshCw size={14} className={loadingTickets ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {ticketsError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontSize: '0.82rem' }}>
                  ⚠️ {ticketsError}
                </div>
              )}

              {/* Tickets List */}
              {loadingTickets && tickets.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--accent)' }} />
                  Loading user queries...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tickets
                    .filter(t => {
                      if (ticketFilter === 'pending') return t.status === 'pending';
                      if (ticketFilter === 'replied') return t.status === 'replied';
                      return true;
                    })
                    .length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '0.84rem' }}>
                      No queries found in this category.
                    </div>
                  ) : (
                    tickets
                      .filter(t => {
                        if (ticketFilter === 'pending') return t.status === 'pending';
                        if (ticketFilter === 'replied') return t.status === 'replied';
                        return true;
                      })
                      .map(t => (
                        <div
                          key={t.id}
                          style={{
                            background: 'var(--bg-card)',
                            border: t.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)',
                            borderRadius: '16px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
                          }}
                        >
                          {/* Ticket Header */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>
                                {(t.displayName || t.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{t.displayName || t.username}</span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{t.username}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                    ✉ {t.email}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: t.status === 'replied' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                                color: t.status === 'replied' ? '#10b981' : '#f59e0b',
                                border: t.status === 'replied' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                              }}>
                                {t.status === 'replied' ? '✅ REPLIED' : '⏳ PENDING'}
                              </span>
                            </div>
                          </div>

                          {/* Query Subject & Date */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                              Topic: {t.subject}
                            </span>
                            <span>
                              {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* User's Original Message */}
                          <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', padding: '10px 12px', borderLeft: '3px solid var(--accent)', fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                              User Query Message:
                            </div>
                            {t.message}
                          </div>

                          {/* Previous Admin Reply if any */}
                          {t.adminReply && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', padding: '10px 12px', borderLeft: '3px solid #10b981', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <CheckCircle2 size={13} /> Admin Reply Sent to {t.email} {t.repliedAt && `(${new Date(t.repliedAt).toLocaleDateString()} ${new Date(t.repliedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                {t.adminReply}
                              </div>
                            </div>
                          )}

                          {/* Reply Input Box */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                            <textarea
                              value={replyTexts[t.id] !== undefined ? replyTexts[t.id] : ''}
                              onChange={(e) => setReplyTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder={t.status === 'replied' ? `Send an updated reply to ${t.email}...` : `Type response to send directly to ${t.email}...`}
                              rows={2}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                outline: 'none',
                                resize: 'vertical',
                                boxSizing: 'border-box'
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ✉ Reply will be emailed to: <strong style={{ color: '#38bdf8' }}>{t.email}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleReplyTicket(t.id)}
                                disabled={sendingReplyId === t.id || !(replyTexts[t.id]?.trim())}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: (sendingReplyId === t.id || !(replyTexts[t.id]?.trim())) ? 'not-allowed' : 'pointer',
                                  opacity: (sendingReplyId === t.id || !(replyTexts[t.id]?.trim())) ? 0.5 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                {sendingReplyId === t.id ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" /> Sending to Email...
                                  </>
                                ) : (
                                  <>
                                    <Send size={13} /> {t.status === 'replied' ? 'Update & Email' : 'Reply & Send Email'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
