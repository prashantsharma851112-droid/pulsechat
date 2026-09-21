import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { UserPlus, UserCheck, Users, UserX, Check, X, Search, MessageSquare, Clock, CheckCircle2, Sparkles, Zap, Radio, RotateCw } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { parseSafeJson } from '../../utils/imageCompressor';

export default function FriendsTab({ setActiveChat, onRequestsCountChange, initialSubTab = 'friends', onOpenFullDp }) {
  const { user, token } = useContext(AuthContext);
  const { socket, onlineUsers } = useContext(SocketContext);

  // Sub-view: 'friends' | 'requests' | 'add'
  const [subTab, setSubTab] = useState(initialSubTab || 'friends');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Data states
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // { [id]: boolean }

  // Search in Add Friend
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestStatusMap, setRequestStatusMap] = useState({}); // { [userId]: { status: 'none'|'friends'|'pending_sent'|'pending_received', requestId } }

  // 1. Fetch Friends
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseSafeJson(res);
      if (data && data.friends) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  }, [token]);

  // 2. Fetch Requests
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseSafeJson(res);
      if (data) {
        const inc = data.incoming || [];
        const out = data.outgoing || [];
        setIncomingRequests(inc);
        setOutgoingRequests(out);
        if (onRequestsCountChange) {
          onRequestsCountChange(inc.length);
        }
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  }, [token, onRequestsCountChange]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFriends(), fetchRequests()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchRequests]);

  // Immediately re-fetch whenever user switches subtabs
  useEffect(() => {
    if (subTab === 'requests') {
      fetchRequests();
    } else if (subTab === 'friends') {
      fetchFriends();
    }
  }, [subTab, fetchRequests, fetchFriends]);

  // Periodic safety polling every 4s while on the requests subtab to guarantee zero missed requests
  useEffect(() => {
    if (subTab !== 'requests') return;
    const interval = setInterval(() => {
      fetchRequests();
    }, 4000);
    return () => clearInterval(interval);
  }, [subTab, fetchRequests]);

  // Socket real-time 0ms instant event listeners
  useEffect(() => {
    if (!socket) return;

    const handleReqReceived = (data) => {
      const newReq = data?.request || (data?.requestId && {
        id: data.requestId,
        senderId: data.senderId,
        receiverId: data.receiverId || user?.id,
        status: 'pending',
        vibe: data.vibe || '⚡ Quick Pulse',
        sender: data.sender,
        createdAt: data.createdAt || new Date()
      });

      if (newReq && newReq.id) {
        setIncomingRequests(prev => {
          if (prev.some(r => r.id === newReq.id)) return prev;
          const next = [newReq, ...prev];
          if (onRequestsCountChange) onRequestsCountChange(next.length);
          return next;
        });
      }
      fetchRequests();
    };

    const handleReqAccepted = (data) => {
      const friendObj = data?.friend;
      const reqId = data?.requestId;

      if (friendObj && friendObj.id) {
        setFriends(prev => {
          if (prev.some(f => f.id === friendObj.id)) return prev;
          return [friendObj, ...prev];
        });
        setIncomingRequests(prev => {
          const next = prev.filter(r => r.id !== reqId && r.senderId !== friendObj.id);
          if (onRequestsCountChange) onRequestsCountChange(next.length);
          return next;
        });
        setOutgoingRequests(prev => prev.filter(r => r.id !== reqId && r.receiverId !== friendObj.id));
      }
      fetchFriends();
      fetchRequests();
    };

    const handleReqRejected = (data) => {
      const reqId = data?.requestId;
      const targetId = data?.userId;
      setOutgoingRequests(prev => prev.filter(r => r.id !== reqId && (!targetId || r.receiverId !== targetId)));
      fetchRequests();
    };

    const handleReqCancelled = (data) => {
      const reqId = data?.requestId;
      const senderId = data?.userId;
      setIncomingRequests(prev => {
        const next = prev.filter(r => r.id !== reqId && (!senderId || r.senderId !== senderId));
        if (onRequestsCountChange) onRequestsCountChange(next.length);
        return next;
      });
      fetchRequests();
    };

    const handleFriendRemoved = (data) => {
      const removedId = data?.targetId || data?.userId;
      if (removedId) {
        setFriends(prev => prev.filter(f => f.id !== removedId));
      }
      fetchFriends();
    };

    socket.on('friend_request_received', handleReqReceived);
    socket.on('friend_request_accepted', handleReqAccepted);
    socket.on('friend_request_rejected', handleReqRejected);
    socket.on('friend_request_cancelled', handleReqCancelled);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('friend_request_received', handleReqReceived);
      socket.off('friend_request_accepted', handleReqAccepted);
      socket.off('friend_request_rejected', handleReqRejected);
      socket.off('friend_request_cancelled', handleReqCancelled);
      socket.off('friend_removed', handleFriendRemoved);
    };
  }, [socket, fetchFriends, fetchRequests, onRequestsCountChange, user?.id]);

  // Accept Friend Request (0ms instant optimistic update)
  const handleAccept = async (requestId) => {
    const targetReq = incomingRequests.find(r => r.id === requestId);
    if (targetReq) {
      setIncomingRequests(prev => {
        const next = prev.filter(r => r.id !== requestId);
        if (onRequestsCountChange) onRequestsCountChange(next.length);
        return next;
      });
      if (targetReq.sender) {
        setFriends(prev => [targetReq.sender, ...prev]);
      }
    }

    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await parseSafeJson(res);
      if (!res.ok) {
        fetchFriends();
        fetchRequests();
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
      fetchFriends();
      fetchRequests();
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Reject Friend Request (0ms instant optimistic update)
  const handleReject = async (requestId) => {
    setIncomingRequests(prev => {
      const next = prev.filter(r => r.id !== requestId);
      if (onRequestsCountChange) onRequestsCountChange(next.length);
      return next;
    });

    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/reject/${requestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      fetchRequests();
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Cancel Outgoing Request (0ms instant optimistic update)
  const handleCancel = async (requestId) => {
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));

    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/cancel/${requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Error cancelling friend request:', err);
      fetchRequests();
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Unfriend / Unsync (0ms instant optimistic update)
  const handleUnfriend = async (friendId, friendName) => {
    if (!window.confirm(`Are you sure you want to unsync pulse with ${friendName}?`)) return;
    setFriends(prev => prev.filter(f => f.id !== friendId));

    setActionLoading(prev => ({ ...prev, [friendId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        fetchFriends();
      }
    } catch (err) {
      console.error('Error unfriending user:', err);
      fetchFriends();
    } finally {
      setActionLoading(prev => ({ ...prev, [friendId]: false }));
    }
  };

  // Send Friend Request (0ms instant optimistic update)
  const handleSendRequest = async (targetId, vibe = '⚡ Quick Pulse') => {
    setRequestStatusMap(prev => ({
      ...prev,
      [targetId]: { status: 'pending_sent' }
    }));

    setActionLoading(prev => ({ ...prev, [targetId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${targetId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ vibe })
      });
      const data = await parseSafeJson(res);
      if (data?.success) {
        if (data.status === 'accepted') {
          setRequestStatusMap(prev => ({
            ...prev,
            [targetId]: { status: 'friends' }
          }));
          if (data.friend) setFriends(prev => [data.friend, ...prev]);
        } else if (data.request) {
          setRequestStatusMap(prev => ({
            ...prev,
            [targetId]: { status: 'pending_sent', requestId: data.request.id }
          }));
          setOutgoingRequests(prev => [data.request, ...prev]);
        }
      } else {
        setRequestStatusMap(prev => ({
          ...prev,
          [targetId]: { status: 'none' }
        }));
        alert(data?.error || 'Could not send request');
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
      setRequestStatusMap(prev => ({ ...prev, [targetId]: { status: 'none' } }));
    } finally {
      setActionLoading(prev => ({ ...prev, [targetId]: false }));
    }
  };

  // Search users in Add Friend tab
  useEffect(() => {
    if (!addSearchQuery.trim()) {
      setAddSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(addSearchQuery.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const text = await res.text();
        let usersList = [];
        try {
          usersList = JSON.parse(text);
        } catch (e) {
          return;
        }

        if (Array.isArray(usersList)) {
          setAddSearchResults(usersList);
          // Instant local status mapping from existing friends & requests (0ms, no network spam)
          const friendIds = new Set(friends.map(f => f.id));
          const outgoingMap = new Map(outgoingRequests.map(r => [r.receiverId || r.receiver?.id, r.id]));
          const incomingMap = new Map(incomingRequests.map(r => [r.senderId || r.sender?.id, r.id]));

          const newStatusMap = {};
          usersList.forEach(u => {
            if (friendIds.has(u.id)) {
              newStatusMap[u.id] = { status: 'friends' };
            } else if (outgoingMap.has(u.id)) {
              newStatusMap[u.id] = { status: 'pending_sent', requestId: outgoingMap.get(u.id) };
            } else if (incomingMap.has(u.id)) {
              newStatusMap[u.id] = { status: 'pending_received', requestId: incomingMap.get(u.id) };
            } else {
              newStatusMap[u.id] = { status: 'none' };
            }
          });
          setRequestStatusMap(prev => ({ ...prev, ...newStatusMap }));
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [addSearchQuery, token]);

  const totalRequestsCount = incomingRequests.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-Tabs: Synced | Radar | Sync Pulse */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
        padding: '0.4rem 0.6rem',
        gap: '6px'
      }}>
        <button
          onClick={() => setSubTab('friends')}
          style={{
            flex: 1,
            padding: '0.45rem 0.5rem',
            borderRadius: '10px',
            border: 'none',
            background: subTab === 'friends' ? 'var(--accent)' : 'var(--bg-card)',
            color: subTab === 'friends' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            transition: 'all 0.2s ease'
          }}
        >
          <Sparkles size={14} />
          <span>Synced ({friends.length})</span>
        </button>

        <button
          onClick={() => setSubTab('requests')}
          style={{
            flex: 1,
            padding: '0.45rem 0.5rem',
            borderRadius: '10px',
            border: 'none',
            background: subTab === 'requests' ? 'var(--accent)' : 'var(--bg-card)',
            color: subTab === 'requests' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
        >
          <Radio size={14} />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              lineHeight: 1.2
            }}>
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('add')}
          style={{
            flex: 1,
            padding: '0.45rem 0.5rem',
            borderRadius: '10px',
            border: 'none',
            background: subTab === 'add' ? 'var(--accent)' : 'var(--bg-card)',
            color: subTab === 'add' ? '#ffffff' : 'var(--text-muted)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            transition: 'all 0.2s ease'
          }}
        >
          <Zap size={14} />
          <span>Sync Pulse</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {/* 1. SYNCD PULSES LIST */}
        {subTab === 'friends' && (
          <div>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  color: 'var(--accent)'
                }}>
                  <Sparkles size={26} />
                </div>
                <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 600 }}>No Synced Pulses Yet</h4>
                <p style={{ fontSize: '0.84rem', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                  Tune into member frequencies and sync up to chat and vibe together!
                </p>
                <button
                  onClick={() => setSubTab('add')}
                  className="btn-primary"
                  style={{ fontSize: '0.84rem', padding: '0.55rem 1.1rem', borderRadius: '18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Zap size={15} /> Discover & Sync
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {friends.map(friend => {
                  const isFriendOnline = onlineUsers.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        borderRadius: '14px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => setActiveChat(friend)}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img
                            src={friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                            alt={friend.displayName}
                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                            onClick={(e) => {
                              if (onOpenFullDp) {
                                e.stopPropagation();
                                onOpenFullDp(friend.avatar, friend.displayName, friend.username);
                              }
                            }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 1,
                              right: 1,
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: isFriendOnline ? '#10b981' : '#9ca3af',
                              border: '2px solid var(--bg-card)'
                            }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {friend.displayName || friend.username}
                            </span>
                            {friend.isEmailVerified && (
                              <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0 }} />
                            )}
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            @{friend.username}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => setActiveChat(friend)}
                          className="icon-btn-ghost"
                          title="Open Chat"
                          style={{ color: 'var(--accent)', padding: '6px' }}
                        >
                          <MessageSquare size={17} />
                        </button>
                        <button
                          onClick={() => handleUnfriend(friend.id, friend.displayName || friend.username)}
                          disabled={actionLoading[friend.id]}
                          className="icon-btn-ghost"
                          title="Unsync Pulse"
                          style={{ color: 'var(--text-muted)', padding: '6px' }}
                        >
                          <UserX size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. REQUESTS SECTION (INCOMING & OUTGOING) */}
        {subTab === 'requests' && (
          <div>
            {/* Incoming Requests */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Incoming Frequencies ({incomingRequests.length})
                </h4>
                <button
                  onClick={() => {
                    setLoading(true);
                    Promise.all([fetchFriends(), fetchRequests()]).finally(() => setLoading(false));
                  }}
                  className="icon-btn-ghost"
                  title="Refresh Frequencies"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', cursor: 'pointer', padding: '4px 8px', fontWeight: 600 }}
                >
                  <RotateCw size={12} className={loading ? 'spin' : ''} /> Refresh
                </button>
              </div>

              {incomingRequests.length === 0 ? (
                <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No pending incoming frequency requests.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {incomingRequests.map(req => {
                    const sender = req.sender || {};
                    return (
                      <div
                        key={req.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          borderRadius: '14px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <img
                            src={sender.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender.username}`}
                            alt={sender.displayName}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sender.displayName || sender.username}
                              </span>
                              {sender.isEmailVerified && <CheckCircle2 size={12} color="#10b981" />}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{sender.username}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={actionLoading[req.id]}
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Zap size={13} /> Sync Back
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionLoading[req.id]}
                            style={{
                              background: 'var(--hover-bg)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              padding: '5px 8px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Decline"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.65rem 0' }}>
                Outgoing Frequency Beams ({outgoingRequests.length})
              </h4>

              {outgoingRequests.length === 0 ? (
                <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No active frequency beams.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outgoingRequests.map(req => {
                    const receiver = req.receiver || {};
                    return (
                      <div
                        key={req.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          borderRadius: '14px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <img
                            src={receiver.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.username}`}
                            alt={receiver.displayName}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {receiver.displayName || receiver.username}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{receiver.username}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--hover-bg)', padding: '3px 8px', borderRadius: '8px', fontWeight: 600 }}>
                            📡 Beaming...
                          </span>
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={actionLoading[req.id]}
                            style={{
                              background: 'transparent',
                              color: '#ef4444',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '4px 6px'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. SYNC PULSE / DISCOVER */}
        {subTab === 'add' && (
          <div>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={addSearchQuery}
                onChange={e => setAddSearchQuery(e.target.value)}
                placeholder="Tune into @username or name..."
                className="form-input"
                style={{ paddingLeft: '2.4rem', borderRadius: '20px', fontSize: '0.88rem' }}
                autoFocus
              />
            </div>

            {isSearching ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Scanning frequencies...
              </div>
            ) : addSearchQuery.trim() === '' ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Zap size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--accent)', display: 'block' }} />
                Type a username or display name above to tune into member frequencies!
              </div>
            ) : addSearchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No pulse signals found matching "{addSearchQuery}".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {addSearchResults.map(target => {
                  const statusInfo = requestStatusMap[target.id] || { status: 'none' };
                  const isTargetOnline = onlineUsers.includes(target.id);

                  return (
                    <div
                      key={target.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        borderRadius: '14px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img
                            src={target.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${target.username}`}
                            alt={target.displayName}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          {isTargetOnline && (
                            <span style={{
                              position: 'absolute',
                              bottom: 1,
                              right: 1,
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              border: '2px solid var(--bg-card)'
                            }} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {target.displayName || target.username}
                            </span>
                            {target.isEmailVerified && <CheckCircle2 size={12} color="#10b981" />}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{target.username}</span>
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {statusInfo.status === 'friends' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Sparkles size={14} /> Synced
                            </span>
                            <button
                              onClick={() => setActiveChat(target)}
                              className="btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                              Chat
                            </button>
                          </div>
                        ) : statusInfo.status === 'pending_sent' ? (
                          <button
                            onClick={() => {
                              const cancelId = statusInfo.requestId || outgoingRequests.find(r => r.receiverId === target.id || r.receiver?.id === target.id)?.id;
                              if (cancelId) handleCancel(cancelId);
                            }}
                            disabled={actionLoading[statusInfo.requestId]}
                            style={{
                              background: 'var(--hover-bg)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel Beam
                          </button>
                        ) : statusInfo.status === 'pending_received' ? (
                          <button
                            onClick={() => {
                              const acceptId = statusInfo.requestId || incomingRequests.find(r => r.senderId === target.id || r.sender?.id === target.id)?.id;
                              if (acceptId) handleAccept(acceptId);
                            }}
                            disabled={actionLoading[statusInfo.requestId]}
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Zap size={13} /> Sync Back
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(target.id)}
                            disabled={actionLoading[target.id]}
                            className="btn-primary"
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.78rem',
                              borderRadius: '8px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Zap size={13} /> Sync Frequency
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
