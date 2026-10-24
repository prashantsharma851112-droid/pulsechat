import React, { useState, useContext, useEffect, useCallback, useMemo, useRef, useDeferredValue, startTransition } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { Search, Settings, User, LogOut, Users, CheckCircle2, Plus, EyeOff, ShieldAlert, Bell, WifiOff, RotateCw, UserPlus, Clock, Check, CheckCheck, Sparkles, Crown, Zap, MoreVertical, ArrowRightLeft, Trash2, Compass, Edit3, Pin, Music, Disc, Play, Pause, Headphones, ArrowLeft, Archive, ArchiveRestore, BellOff, Lock, Info } from 'lucide-react';
import FriendsTab from './FriendsTab';
import { useBackHandler } from '../../utils/backNavigation';
import PulseVipBadge from '../common/PulseVipBadge';
import PulseVibesBar from '../vibes/PulseVibesBar';
import VibeAuraRing, { resolveUserAura, getProAuraRingClass } from '../common/VibeAuraRing';
import { Gamepad2 } from 'lucide-react';
import { useAppMusic } from '../../context/AppMusicContext';
import { playSound } from '../../utils/audio';

import { lazyWithRetry, scheduleIdlePreload } from '../../utils/lazyRetry';

// Core Sidebar Modals imported directly for 100% offline availability
import ReferEarnModal from './ReferEarnModal';
import SparksWalletModal from './SparksWalletModal';
import PulseZoneModal from '../zone/PulseZoneModal';

// Code-Splitting: Lazy load remaining heavy modals with automatic retry & reload resilience
const CreateGroupModal = lazyWithRetry(() => import('./CreateGroupModal'));
const SettingsModal = lazyWithRetry(() => import('../profile/SettingsModal'));
const AdminDashboardModal = lazyWithRetry(() => import('../admin/AdminDashboardModal'));
const PulseProModal = lazyWithRetry(() => import('./PulseProModal'));
const AppFeatureTourModal = lazyWithRetry(() => import('../common/AppFeatureTourModal'));
const CreateVibeModal = lazyWithRetry(() => import('../vibes/CreateVibeModal'));
const VibeViewerModal = lazyWithRetry(() => import('../vibes/VibeViewerModal'));
const VibeAuraSelectorModal = lazyWithRetry(() => import('./VibeAuraSelectorModal'));
const MusicPickerModal = lazyWithRetry(() => import('../vibes/MusicPickerModal'));
const PinLockModal = lazyWithRetry(() => import('../common/PinLockModal'));
const UserProfileModal = lazyWithRetry(() => import('./UserProfileModal'));
const GroupProfileModal = lazyWithRetry(() => import('./GroupProfileModal'));
import { isChatLocked, isChatMuted, getLockedChats, getMutedChats, isChatHidden, getHiddenLockedChats, isChatArchived, setChatArchived, getArchivedChats, setChatMuted, setChatLocked, getSecurityPin } from '../../utils/securityLock';
import { clearChatFromLocalDb } from '../../utils/localDatabase';
import { BACKEND_URL } from '../../utils/config';
import { getOrInitDeviceIdentity, decryptMessageIfNeeded } from '../../utils/e2eeCrypto';
import { runWorkerTask } from '../../workers/pulseWorkerBridge';
import { preloadMediaUrls } from '../../utils/mediaCache';
import { requestNotificationPermission, showPushNotification, dismissNotificationBanner, subscribeUserToPush } from '../../utils/notifications';
import {
  getCachedUser,
  getCachedRecentChats,
  setCachedRecentChats,
  getCachedGroups,
  setCachedGroups,
  getCachedAllUsers,
  setCachedAllUsers,
  getCachedFriends,
  setCachedFriends,
  mergeIntoAllUsersCache,
  isDeviceOnline,
  subscribeToNetworkChanges,
  clearUnreadCount,
  getDeletedChatIds,
  addDeletedChatId,
  restoreDeletedChatId,
  clearCachedMessages,
  updateRecentChatSnippet,
  getLatestCachedMessageForContact,
  appendCachedMessage,
  updateCachedMessageStatus,
  markAllCachedMessagesRead,
  markAllCachedMessagesDelivered
} from '../../utils/offlineStorage';
import { parseSafeJson } from '../../utils/imageCompressor';
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ModalErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(this.state.error?.message || '') ||
        /error loading dynamically imported module/i.test(this.state.error?.message || '') ||
        /Importing a module script failed/i.test(this.state.error?.message || '');

      return (
        <div className="modal-overlay" style={{ zIndex: 1400 }} onClick={this.props.onReset}>
          <div className="modal-card modal-responsive" style={{ maxWidth: '400px', padding: '20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: isChunkError ? 'rgba(99, 102, 241, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.4rem' }}>{isChunkError ? '🔄' : '⚠️'}</span>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isChunkError ? 'App Update Available' : 'Vibe Feature Error'}
            </h3>
            <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.4 }}>
              {isChunkError
                ? 'A new PulseChat update was deployed. Tap below to reload and access all fresh features!'
                : (this.state.error?.message || 'Unable to display story modal.')}
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                if (isChunkError) {
                  window.location.reload();
                } else {
                  this.setState({ hasError: false, error: null });
                  if (typeof this.props.onReset === 'function') this.props.onReset();
                }
              }}
              style={{ padding: '8px 20px', borderRadius: '12px', fontSize: '0.88rem' }}
            >
              {isChunkError ? 'Reload & Update 🔄' : 'Close & Retry'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatChatListTime(timeInput) {
  if (!timeInput) return '';
  try {
    const d = new Date(timeInput);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// =========================================================================
// ATOMIC ISOLATED TOPBAR 3-DOT MENU ITEMS (React.memo + 0ms GPU Tap Feedback)
// =========================================================================

export const SidebarMenuSparksCard = React.memo(function SidebarMenuSparksCard({
  sparksBalance,
  onClick
}) {
  return (
    <div
      onClick={onClick}
      className="interactive-tap sidebar-menu-btn"
      style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(236, 72, 153, 0.12))',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '12px',
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
        }}>
          <Zap size={16} fill="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>Pulse Sparks</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>
            {sparksBalance ?? 50} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sparks</span>
          </div>
        </div>
      </div>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.15)',
        padding: '4px 8px',
        borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      }}>
        Wallet ⚡
      </span>
    </div>
  );
});

export const SidebarMenuVipButton = React.memo(function SidebarMenuVipButton({
  isPro,
  onClick
}) {
  return (
    <button
      onClick={onClick}
      className="dropdown-menu-item interactive-tap sidebar-menu-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: 'none',
        background: isPro ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.12), transparent)' : 'transparent',
        color: 'var(--text-main)',
        fontSize: '0.88rem',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Crown size={17} color="#f59e0b" />
        <span>{isPro ? 'Pulse VIP (Manage / Upgrade)' : 'Get Pulse VIP'}</span>
      </div>
      {isPro ? (
        <PulseVipBadge size={14} showLabel={false} />
      ) : (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '4px' }}>
          VIP
        </span>
      )}
    </button>
  );
});

export const SidebarMenuItem = React.memo(function SidebarMenuItem({
  icon: Icon,
  iconColor,
  label,
  onClick
}) {
  return (
    <button
      onClick={onClick}
      className="dropdown-menu-item interactive-tap sidebar-menu-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-main)',
        fontSize: '0.88rem',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <Icon size={17} color={iconColor} />
      <span>{label}</span>
    </button>
  );
});

export default function Sidebar({ activeChat, setActiveChat, openProfileModal, openSettingsModal, onOpenFullDp }) {
  const { user, logout, token, savedAccounts, switchAccount, addAccount, removeSavedAccount, blockUser } = useContext(AuthContext);
  const { socket, onlineUsers, typingMap, lastNotification, vibeAuras } = useContext(SocketContext);
  const { currentTrack: appMusicTrack, isPlaying: isAppMusicPlaying, togglePlayPause: toggleAppMusic, playTrack: playAppMusicTrack } = useAppMusic();
  const currentUid = user?.id || getCachedUser()?.id;

  const myAura = useMemo(() => {
    return resolveUserAura(user, vibeAuras);
  }, [vibeAuras, user]);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState(() => getCachedRecentChats(currentUid));
  const [groups, setGroups] = useState(() => getCachedGroups(currentUid));
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`pulsechat_pinned_chats_${currentUid || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showLockPinModal, setShowLockPinModal] = useState(false);
  const [pendingLockedChat, setPendingLockedChat] = useState(null);
  const [lockedChatIdsState, setLockedChatIdsState] = useState(() => getLockedChats());
  const [mutedChatIdsState, setMutedChatIdsState] = useState(() => getMutedChats());
  const [hiddenChatIdsState, setHiddenChatIdsState] = useState(() => getHiddenLockedChats());

  // Multi-Select and Chat Archive (WhatsApp Style) States
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [showSelectionMoreMenu, setShowSelectionMoreMenu] = useState(false);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [archivedChatIdsState, setArchivedChatIdsState] = useState(() => getArchivedChats(currentUid));
  const [selectedUserForInfo, setSelectedUserForInfo] = useState(null);
  const [selectedGroupForInfo, setSelectedGroupForInfo] = useState(null);

  const [allUsers, setAllUsers] = useState(() => getCachedAllUsers(currentUid));
  const [isOnline, setIsOnline] = useState(() => isDeviceOnline());
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'groups' | 'friends'
  const [friendsSubTab, setFriendsSubTab] = useState('friends');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [friendIdsSet, setFriendIdsSet] = useState(() => {
    const cached = getCachedFriends(currentUid);
    return new Set(cached.map(f => f.id));
  });
  const [outgoingPendingIds, setOutgoingPendingIds] = useState(new Set());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proModalTab, setProModalTab] = useState('pro');
  const [showFeatureTourModal, setShowFeatureTourModal] = useState(false);
  const [showCreateVibe, setShowCreateVibe] = useState(false);
  const [selectedVibeGroup, setSelectedVibeGroup] = useState(null);
  const [allVibeGroups, setAllVibeGroups] = useState([]);
  const [showPulseZone, setShowPulseZone] = useState(false);
  const [showSparksWallet, setShowSparksWallet] = useState(false);
  const [showVibeSelector, setShowVibeSelector] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showSwitchAccountMenu, setShowSwitchAccountMenu] = useState(false);
  const [showMusicPickerModal, setShowMusicPickerModal] = useState(false);
  const [showReferEarnModal, setShowReferEarnModal] = useState(false);

  const selectionMoreMenuRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);
  const isLongPressActiveRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const lastTouchTimeRef = useRef(0);
  const isScrollingRef = useRef(false);
  const scrollEndTimerRef = useRef(null);

  useEffect(() => {
    const handleLockUpdated = () => {
      setLockedChatIdsState(getLockedChats());
      setHiddenChatIdsState(getHiddenLockedChats());
    };
    const handleMuteUpdated = () => {
      setMutedChatIdsState(getMutedChats());
    };
    const handleArchivedUpdated = () => {
      setArchivedChatIdsState(getArchivedChats(currentUid));
    };
    window.addEventListener('pulsechat_chat_lock_updated', handleLockUpdated);
    window.addEventListener('pulsechat_chat_mute_updated', handleMuteUpdated);
    window.addEventListener('pulsechat_archived_chats_updated', handleArchivedUpdated);
    return () => {
      window.removeEventListener('pulsechat_chat_lock_updated', handleLockUpdated);
      window.removeEventListener('pulsechat_chat_mute_updated', handleMuteUpdated);
      window.removeEventListener('pulsechat_archived_chats_updated', handleArchivedUpdated);
    };
  }, [currentUid]);

  useEffect(() => {
    if (currentUid) {
      setArchivedChatIdsState(getArchivedChats(currentUid));
    }
  }, [currentUid]);

  // Click outside to close 3-dot selection menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectionMoreMenuRef.current && !selectionMoreMenuRef.current.contains(e.target)) {
        setShowSelectionMoreMenu(false);
      }
    };
    if (showSelectionMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSelectionMoreMenu]);

  // Back button handling: exits selection mode first, or exits archived view
  useBackHandler(() => {
    if (selectedChatIds.length > 0) {
      setSelectedChatIds([]);
      setShowSelectionMoreMenu(false);
      return true;
    }
    if (isArchivedView) {
      setIsArchivedView(false);
      return true;
    }
    return false;
  }, selectedChatIds.length > 0 || isArchivedView);

  useBackHandler(() => setSelectedUserForInfo(null), Boolean(selectedUserForInfo));
  useBackHandler(() => setSelectedGroupForInfo(null), Boolean(selectedGroupForInfo));

  // Preload remaining lazy modal bundles during idle time for 0ms instantaneous tap open
  useEffect(() => {
    scheduleIdlePreload([
      SettingsModal,
      PulseProModal,
      CreateGroupModal,
      CreateVibeModal,
      VibeViewerModal,
      VibeAuraSelectorModal,
      MusicPickerModal,
      PinLockModal,
      UserProfileModal,
      GroupProfileModal
    ]);
  }, []);

  const togglePinChat = useCallback((e, targetId) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!targetId) return;
    setPinnedChatIds(prev => {
      let next;
      if (prev.includes(targetId)) {
        next = prev.filter(id => id !== targetId);
      } else {
        if (prev.length >= 5) {
          alert('📌 You can pin up to 5 chats/groups at the top!');
          return prev;
        }
        next = [targetId, ...prev];
      }
      try {
        localStorage.setItem(`pulsechat_pinned_chats_${currentUid || 'default'}`, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  }, [currentUid]);

  const sortedRecentChats = useMemo(() => {
    const hiddenSet = new Set(hiddenChatIdsState);
    const visibleRecent = recentChats.filter(c => {
      const cid = c.isGroup ? (c.id || c._id) : (user?.id ? [user.id, c.id || c._id].sort().join('_') : (c.id || c._id));
      const rawId = c.id || c._id;
      if (hiddenSet.has(cid) || isChatHidden(cid)) return false;
      const isArchived = isChatArchived(currentUid, rawId) || isChatArchived(currentUid, cid);
      if (isArchivedView) {
        return isArchived;
      } else {
        return !isArchived;
      }
    });

    if (!pinnedChatIds.length) return visibleRecent;
    const pinnedSet = new Set(pinnedChatIds);
    const pinned = [];
    const unpinned = [];
    visibleRecent.forEach(c => {
      const cid = c.id || c._id;
      if (pinnedSet.has(cid)) {
        pinned.push(c);
      } else {
        unpinned.push(c);
      }
    });
    pinned.sort((a, b) => pinnedChatIds.indexOf(a.id || a._id) - pinnedChatIds.indexOf(b.id || b._id));
    return [...pinned, ...unpinned];
  }, [recentChats, pinnedChatIds, hiddenChatIdsState, user?.id, isArchivedView, archivedChatIdsState, currentUid]);

  const sortedGroups = useMemo(() => {
    const visibleGroups = groups.filter(g => {
      const gid = g.id || g._id;
      const isArchived = isChatArchived(currentUid, gid);
      if (isArchivedView) {
        return isArchived;
      } else {
        return !isArchived;
      }
    });

    if (!pinnedChatIds.length) return visibleGroups;
    const pinnedSet = new Set(pinnedChatIds);
    const pinned = [];
    const unpinned = [];
    visibleGroups.forEach(g => {
      const gid = g.id || g._id;
      if (pinnedSet.has(gid)) {
        pinned.push(g);
      } else {
        unpinned.push(g);
      }
    });
    pinned.sort((a, b) => pinnedChatIds.indexOf(a.id || a._id) - pinnedChatIds.indexOf(b.id || b._id));
    return [...pinned, ...unpinned];
  }, [groups, pinnedChatIds, isArchivedView, archivedChatIdsState, currentUid]);

  const handleListScroll = useCallback(() => {
    isScrollingRef.current = true;
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);

    // Atomic Gesture Isolation: Scrolling MUST cancel any pending hold timer immediately!
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  // Touch and Long-Press Handlers for Chat Selection (WhatsApp style)
  const handleChatTouchStart = (chatItem, e) => {
    lastTouchTimeRef.current = Date.now();
    // Atomic Gesture Isolation: Never start long-press if list is currently scrolling
    if (isScrollingRef.current) return;
    if (selectedChatIds.length > 0) return; // In multi-select mode, normal tap toggles selection
    const touch = e.touches ? e.touches[0] : e;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;
    isLongPressActiveRef.current = false;

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      if (isScrollingRef.current) return;
      isLongPressActiveRef.current = true;
      isLongPressTriggeredRef.current = true;
      suppressClickUntilRef.current = Date.now() + 2000;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(45); } catch (_) {}
      }
      const cid = chatItem.id || chatItem._id;
      // Ensure it is added into selected list, NEVER removed while holding
      setSelectedChatIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
    }, 440);
  };

  const handleChatTouchMove = (e) => {
    lastTouchTimeRef.current = Date.now();
    // If selection already activated, user is simply resting or shifting their finger while holding
    if (isLongPressActiveRef.current) return;
    if (!longPressTimeoutRef.current) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Atomic Gesture Isolation: Standard mobile touch slop is 8px.
    // Any finger movement > 8px means user is scrolling the list, NOT holding!
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleChatTouchEnd = () => {
    lastTouchTimeRef.current = Date.now();
    if (isLongPressActiveRef.current) {
      // Finger lifted after holding — shield click from THIS exact release timestamp!
      suppressClickUntilRef.current = Date.now() + 1000;
      isLongPressTriggeredRef.current = true;
      isLongPressActiveRef.current = false;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleChatTouchCancel = () => {
    lastTouchTimeRef.current = Date.now();
    if (isLongPressActiveRef.current) {
      suppressClickUntilRef.current = Date.now() + 1000;
      isLongPressTriggeredRef.current = true;
      isLongPressActiveRef.current = false;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleChatMouseDown = (chatItem, e) => {
    // If touched recently, ignore synthesized mouse event
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (e.button !== 0) return; // Only left-click
    if (selectedChatIds.length > 0) return;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    isLongPressTriggeredRef.current = false;
    isLongPressActiveRef.current = false;

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      isLongPressActiveRef.current = true;
      isLongPressTriggeredRef.current = true;
      suppressClickUntilRef.current = Date.now() + 2000;
      const cid = chatItem.id || chatItem._id;
      setSelectedChatIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
    }, 440);
  };

  const handleChatMouseMove = (e) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (isLongPressActiveRef.current) return;
    if (!longPressTimeoutRef.current) return;
    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleChatMouseUp = () => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (isLongPressActiveRef.current) {
      suppressClickUntilRef.current = Date.now() + 1000;
      isLongPressTriggeredRef.current = true;
      isLongPressActiveRef.current = false;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleChatItemClick = (chatItem, isGroupChat, e) => {
    if (e) {
      e.stopPropagation();
    }
    // If long press triggered, still active, or within release shield, suppress click
    if (isLongPressTriggeredRef.current || isLongPressActiveRef.current || Date.now() < suppressClickUntilRef.current) {
      isLongPressTriggeredRef.current = false;
      if (e) e.preventDefault();
      return;
    }
    const cid = chatItem.id || chatItem._id;
    if (selectedChatIds.length > 0) {
      setSelectedChatIds(prev => prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]);
      return;
    }
    if (isGroupChat) {
      handleSelectGroup(chatItem);
    } else {
      handleSelectUser(chatItem);
    }
  };

  // Dedicated Memo for All Archived Conversations (1-on-1 Chats + Groups)
  const unsearchedArchivedConversations = useMemo(() => {
    const archivedSet = new Set(archivedChatIdsState);
    const combined = [];
    const addedIds = new Set();

    recentChats.forEach(c => {
      const rawId = c.id || c._id;
      const compId = c.isGroup ? rawId : (user?.id ? [user.id, rawId].sort().join('_') : rawId);
      if (archivedSet.has(rawId) || archivedSet.has(compId) || isChatArchived(currentUid, rawId) || isChatArchived(currentUid, compId)) {
        if (!addedIds.has(rawId)) {
          addedIds.add(rawId);
          combined.push(c);
        }
      }
    });

    groups.forEach(g => {
      const gid = g.id || g._id;
      if (archivedSet.has(gid) || isChatArchived(currentUid, gid)) {
        if (!addedIds.has(gid)) {
          addedIds.add(gid);
          combined.push(g);
        }
      }
    });

    allUsers.forEach(u => {
      const uid = u.id || u._id;
      const compId = user?.id ? [user.id, uid].sort().join('_') : uid;
      if (archivedSet.has(uid) || archivedSet.has(compId) || isChatArchived(currentUid, uid) || isChatArchived(currentUid, compId)) {
        if (!addedIds.has(uid)) {
          addedIds.add(uid);
          combined.push(u);
        }
      }
    });

    return combined;
  }, [archivedChatIdsState, recentChats, groups, allUsers, currentUid, user?.id]);

  const allArchivedConversations = useMemo(() => {
    if (deferredSearchQuery && deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.trim().toLowerCase();
      return unsearchedArchivedConversations.filter(item => {
        const name = (item.name || item.displayName || item.username || '').toLowerCase();
        return name.includes(q);
      });
    }
    return unsearchedArchivedConversations;
  }, [unsearchedArchivedConversations, deferredSearchQuery]);

  const totalArchivedCount = unsearchedArchivedConversations.length;

  // Selected chat objects resolved from state
  const selectedChatObjects = useMemo(() => {
    if (!selectedChatIds.length) return [];
    const map = new Map();
    recentChats.forEach(c => map.set(c.id || c._id, c));
    groups.forEach(g => map.set(g.id || g._id, g));
    allUsers.forEach(u => {
      if (!map.has(u.id || u._id)) map.set(u.id || u._id, u);
    });
    return selectedChatIds.map(id => {
      let found = map.get(id);
      if (!found) {
        found = recentChats.find(c => (c.id || c._id) === id) ||
                groups.find(g => (g.id || g._id) === id) ||
                allUsers.find(u => (u.id || u._id) === id);
      }
      return found;
    }).filter(Boolean);
  }, [selectedChatIds, recentChats, groups, allUsers]);

  // Selection Action Bar Handlers
  const handlePinSelected = () => {
    if (!selectedChatIds.length) return;
    const allArePinned = selectedChatIds.every(id => pinnedChatIds.includes(id));
    setPinnedChatIds(prev => {
      let next;
      if (allArePinned) {
        next = prev.filter(id => !selectedChatIds.includes(id));
      } else {
        const toAdd = selectedChatIds.filter(id => !prev.includes(id));
        if (prev.length + toAdd.length > 5) {
          alert('📌 You can pin up to 5 chats/groups at the top!');
          return prev;
        }
        next = [...toAdd, ...prev];
      }
      try {
        localStorage.setItem(`pulsechat_pinned_chats_${currentUid || 'default'}`, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
    setSelectedChatIds([]);
  };

  const handleDeleteSelected = () => {
    if (!selectedChatIds.length) return;
    if (!window.confirm(`Delete ${selectedChatIds.length} conversation(s)?`)) return;
    selectedChatIds.forEach(cid => {
      if (currentUid) {
        addDeletedChatId(currentUid, cid);
      }
    });
    setRecentChats(prev => prev.filter(c => !selectedChatIds.includes(c.id) && !selectedChatIds.includes(c._id)));
    if (activeChat && (selectedChatIds.includes(activeChat.id) || selectedChatIds.includes(activeChat._id))) {
      setActiveChat(null);
    }
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    setSelectedChatIds([]);
  };

  const handleMuteSelected = () => {
    if (!selectedChatObjects.length) return;
    const allAreMuted = selectedChatObjects.every(c => {
      const cid = c.isGroup ? (c.id || c._id) : (user?.id ? [user.id, c.id || c._id].sort().join('_') : (c.id || c._id));
      return isChatMuted(cid);
    });
    selectedChatObjects.forEach(c => {
      const cid = c.isGroup ? (c.id || c._id) : (user?.id ? [user.id, c.id || c._id].sort().join('_') : (c.id || c._id));
      setChatMuted(cid, !allAreMuted);
    });
    setMutedChatIdsState(getMutedChats());
    setSelectedChatIds([]);
  };

  const handleArchiveSelected = () => {
    if (!selectedChatIds.length) return;
    const shouldArchive = !isArchivedView;

    selectedChatIds.forEach(id => {
      const chatObj = selectedChatObjects.find(c => (c.id || c._id) === id);
      const isGroup = chatObj ? chatObj.isGroup : false;
      const compositeId = (!isGroup && user?.id) ? [user.id, id].sort().join('_') : id;

      setChatArchived(currentUid, id, shouldArchive);
      setChatArchived(currentUid, compositeId, shouldArchive);
    });

    const updated = getArchivedChats(currentUid);
    setArchivedChatIdsState(updated);
    setSelectedChatIds([]);

    if (isArchivedView && updated.length === 0) {
      setIsArchivedView(false);
    }
  };

  const handleSelectAllChats = () => {
    setShowSelectionMoreMenu(false);
    if (isArchivedView) {
      const ids = allArchivedConversations.map(c => c.id || c._id);
      setSelectedChatIds(ids);
    } else if (activeTab === 'groups') {
      const ids = sortedGroups.map(g => g.id || g._id);
      setSelectedChatIds(ids);
    } else {
      const ids = sortedRecentChats.map(c => c.id || c._id);
      setSelectedChatIds(ids);
    }
  };

  const handleLockSelectedChats = () => {
    setShowSelectionMoreMenu(false);
    const pin = getSecurityPin();
    if (!pin) {
      setShowLockPinModal(true);
      return;
    }
    selectedChatObjects.forEach(c => {
      const cid = c.isGroup ? (c.id || c._id) : (user?.id ? [user.id, c.id || c._id].sort().join('_') : (c.id || c._id));
      setChatLocked(cid, true);
    });
    setLockedChatIdsState(getLockedChats());
    setSelectedChatIds([]);
  };

  const handleClearSelectedChats = async () => {
    setShowSelectionMoreMenu(false);
    if (!selectedChatObjects.length) return;
    const curToken = token || localStorage.getItem('pulsechat_token');

    for (const c of selectedChatObjects) {
      const cId = c.id || c._id;
      const targetIds = new Set();
      if (c.isGroup) {
        if (c.id) targetIds.add(c.id);
        if (c._id) targetIds.add(c._id);
      } else if (user?.id) {
        if (cId) targetIds.add([user.id, cId].sort().join('_'));
        if (c.username) targetIds.add([user.id, c.username].sort().join('_'));
        if (c.id) targetIds.add(c.id);
        if (c._id) targetIds.add(c._id);
      }

      for (const targetChatId of targetIds) {
        // 1. Wipe local memory/localStorage & IndexedDB
        clearCachedMessages(targetChatId);
        await clearChatFromLocalDb(targetChatId);

        // 2. Clear server database
        if (curToken) {
          fetch(`${BACKEND_URL}/api/messages/clear/${encodeURIComponent(targetChatId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${curToken}` }
          }).catch(() => {});
        }

        // 3. Emit socket event
        if (socket) {
          socket.emit('clear_chat', { chatId: targetChatId });
        }

        // 4. Update recent snippet & notify listeners
        if (user?.id) {
          updateRecentChatSnippet(user.id, targetChatId, null, c);
        }
        window.dispatchEvent(new CustomEvent('pulsechat_chat_cleared', { detail: { chatId: targetChatId } }));
      }
    }

    setRecentChats(prev => prev.map(c => {
      const isSelected = selectedChatIds.includes(c.id) || selectedChatIds.includes(c._id);
      if (isSelected) {
        return { ...c, lastMessage: '', lastMessageTimestamp: null, lastMessageTime: null, unreadCount: 0 };
      }
      return c;
    }));

    window.dispatchEvent(new CustomEvent('pulsechat_messages_cleared'));
    window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
    setSelectedChatIds([]);
  };

  const handleBlockSelectedUsers = async () => {
    setShowSelectionMoreMenu(false);
    const targets = selectedChatObjects.filter(c => !c.isGroup);
    if (!targets.length) {
      alert('Block user is only available for individual contacts, not groups.');
      return;
    }
    if (!window.confirm(`Block ${targets.length} user(s)? They won't be able to send you messages.`)) return;
    for (const t of targets) {
      const uid = t.id || t._id;
      if (uid && blockUser) {
        await blockUser(uid);
      }
    }
    setSelectedChatIds([]);
  };

  const handleViewUserInfo = () => {
    setShowSelectionMoreMenu(false);
    if (selectedChatObjects.length !== 1) {
      alert('Please select exactly 1 chat to view info.');
      return;
    }
    const item = selectedChatObjects[0];
    if (item.isGroup) {
      setSelectedGroupForInfo(item);
    } else {
      setSelectedUserForInfo(item);
    }
    setSelectedChatIds([]);
  };

  useEffect(() => {
    const handleOpenReferral = () => setShowReferEarnModal(true);
    window.addEventListener('pulsechat_open_referral', handleOpenReferral);
    return () => window.removeEventListener('pulsechat_open_referral', handleOpenReferral);
  }, []);

  useEffect(() => {
    const handleOpenWallet = () => setShowSparksWallet(true);
    window.addEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
    return () => window.removeEventListener('pulsechat_open_sparks_wallet', handleOpenWallet);
  }, []);

  // Listen to open story requests from chat cards (makes shared story cards accessible and playable!)
  useEffect(() => {
    const handleOpenStoryFromChat = (e) => {
      const payload = e.detail;
      if (!payload) return;
      const group = {
        userId: payload.authorId || 'author',
        username: payload.authorName || 'User',
        displayName: payload.authorName || 'User',
        avatar: payload.authorAvatar || '',
        vibes: [{
          id: payload.storyId || payload.vibeId || ('vibe_' + Date.now()),
          userId: payload.authorId || 'author',
          username: payload.authorName || 'User',
          displayName: payload.authorName || 'User',
          avatar: payload.authorAvatar || '',
          mediaUrl: payload.mediaUrl || null,
          caption: payload.caption || '',
          bgGradient: payload.bgGradient || 'linear-gradient(135deg, #6366f1, #a855f7)',
          animatedBg: payload.animatedBg || 'none',
          soundtrack: payload.soundtrack || 'lofi',
          songTitle: payload.songTitle || '',
          artistName: payload.artistName || '',
          albumArt: payload.albumArt || '',
          audioUrl: payload.audioUrl || '',
          textStyle3D: payload.textStyle3D || 'none',
          textBgStyle: payload.textBgStyle || 'none',
          stickersData: payload.stickersData || [],
          createdAt: payload.createdAt || new Date().toISOString()
        }]
      };
      setSelectedVibeGroup(group);
    };
    window.addEventListener('pulsechat_open_story', handleOpenStoryFromChat);
    return () => window.removeEventListener('pulsechat_open_story', handleOpenStoryFromChat);
  }, []);

  // Hardware/Swipe Back button closes popup modals, views, or search bar safely
  useBackHandler(() => setSelectedVibeGroup(null), Boolean(selectedVibeGroup));
  useBackHandler(() => setShowCreateVibe(false), showCreateVibe);
  useBackHandler(() => setShowCreateGroupModal(false), showCreateGroupModal);
  useBackHandler(() => setShowPulseZone(false), showPulseZone);
  useBackHandler(() => setShowSparksWallet(false), showSparksWallet);
  useBackHandler(() => setShowProModal(false), showProModal);
  useBackHandler(() => setShowVibeSelector(false), showVibeSelector);
  useBackHandler(() => setShowFeatureTourModal(false), showFeatureTourModal);
  useBackHandler(() => setShowReferEarnModal(false), showReferEarnModal);
  useBackHandler(() => setShowMusicPickerModal(false), showMusicPickerModal);
  useBackHandler(() => setShowTopMenu(false), showTopMenu);
  useBackHandler(() => setShowSwitchAccountMenu(false), showSwitchAccountMenu);
  useBackHandler(() => setSearchQuery(''), Boolean(searchQuery));
  const topMenuRef = useRef(null);
  const switchAccountMenuRef = useRef(null);
  const activeChatRef = React.useRef(activeChat);
  const lastRevalidateRef = useRef(0);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  const allUsersRef = useRef(allUsers);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);
  const processedMsgIdsRef = useRef(new Map());
  const myIdentityRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      getOrInitDeviceIdentity(user.id).then(ident => {
        myIdentityRef.current = ident;
      }).catch(() => {});
    }
  }, [user?.id]);

  // Listen to cross-component tab switch requests (e.g. clicking on sync notification toast)
  useEffect(() => {
    const handleOpenTab = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        if (e.detail.subTab) {
          setFriendsSubTab(e.detail.subTab);
        }
      }
    };
    window.addEventListener('pulsechat_open_tab', handleOpenTab);
    return () => window.removeEventListener('pulsechat_open_tab', handleOpenTab);
  }, []);

  useEffect(() => {
    const handleNavHome = () => {
      setActiveChat(null);
      setActiveTab('chats');
      setShowCreateVibe(false);
    };
    window.addEventListener('pulsechat_navigate_home', handleNavHome);
    return () => window.removeEventListener('pulsechat_navigate_home', handleNavHome);
  }, [setActiveChat]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target)) {
        setShowTopMenu(false);
      }
      if (switchAccountMenuRef.current && !switchAccountMenuRef.current.contains(e.target)) {
        setShowSwitchAccountMenu(false);
      }
    };
    if (showTopMenu || showSwitchAccountMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showTopMenu, showSwitchAccountMenu]);

  // Load friendship status and pending friend requests count
  const loadFriendshipInfo = useCallback(async (externalSignal) => {
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const activeSignal = externalSignal || controller.signal;
    try {
      const [reqRes, friendsRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/friends/requests?t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${curToken}` }, signal: activeSignal }),
        fetch(`${BACKEND_URL}/api/friends?t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${curToken}` }, signal: activeSignal })
      ]);

      if (reqRes.status === 'fulfilled' && reqRes.value?.ok) {
        const data = await parseSafeJson(reqRes.value);
        if (data?.incoming) setPendingRequestsCount(data.incoming.length);
        if (data?.outgoing) {
          setOutgoingPendingIds(new Set(data.outgoing.map(r => r.receiverId)));
        }
      }

      if (friendsRes.status === 'fulfilled' && friendsRes.value?.ok) {
        const fData = await parseSafeJson(friendsRes.value);
        if (fData?.friends) {
          setFriendIdsSet(new Set(fData.friends.map(f => f.id)));
          if (user?.id) {
            setCachedFriends(user.id, fData.friends);
          }
        }
      }
    } catch {} finally {
      clearTimeout(timeoutId);
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadFriendshipInfo();
  }, [loadFriendshipInfo]);

  // Real-time zero-millisecond socket sync for friend requests
  useEffect(() => {
    if (!socket) return;

    const handleReqReceived = (data) => {
      // Instant 0ms badge increment
      setPendingRequestsCount(prev => prev + 1);
      loadFriendshipInfo();
    };

    const handleReqAccepted = (data) => {
      if (data?.friend?.id) {
        setFriendIdsSet(prev => new Set([...prev, data.friend.id]));
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(data.friend.id);
          return next;
        });
      }
      setPendingRequestsCount(prev => Math.max(0, prev - 1));
      loadFriendshipInfo();
    };

    const handleReqRejected = (data) => {
      if (data?.userId) {
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
      loadFriendshipInfo();
    };

    const handleReqCancelled = () => {
      setPendingRequestsCount(prev => Math.max(0, prev - 1));
      loadFriendshipInfo();
    };

    const handleFriendRemoved = (data) => {
      const removedId = data?.targetId || data?.userId;
      if (removedId) {
        setFriendIdsSet(prev => {
          const next = new Set(prev);
          next.delete(removedId);
          return next;
        });
      }
      loadFriendshipInfo();
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
  }, [socket, loadFriendshipInfo]);

  const handleSendFriendRequest = async (e, targetUserId) => {
    e.stopPropagation();
    if (!token || !targetUserId) return;
    try {
      setOutgoingPendingIds(prev => new Set([...prev, targetUserId]));
      const res = await fetch(`${BACKEND_URL}/api/friends/request/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'accepted') {
        setFriendIdsSet(prev => new Set([...prev, targetUserId]));
        setOutgoingPendingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
  };

  const handleCancelFriendRequest = async (e, targetUserId) => {
    e.stopPropagation();
    if (!token || !targetUserId) return;
    try {
      setOutgoingPendingIds(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
      await fetch(`${BACKEND_URL}/api/friends/cancel/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadFriendshipInfo();
    } catch (err) {
      console.error('Failed to cancel friend request:', err);
    }
  };

  const handleDeleteChat = (e, chatItem) => {
    e.stopPropagation();
    if (!chatItem || !chatItem.id) return;
    if (window.confirm(`Delete conversation with ${chatItem.displayName || chatItem.username || 'this contact'}?`)) {
      if (currentUid) {
        addDeletedChatId(currentUid, chatItem.id);
        if (chatItem._id) addDeletedChatId(currentUid, chatItem._id);
        setRecentChats(prev => prev.filter(c => c.id !== chatItem.id && c._id !== chatItem.id));
        if (activeChat?.id === chatItem.id) {
          setActiveChat(null);
        }
        window.dispatchEvent(new CustomEvent('pulsechat_recent_updated'));
      }
    }
  };

  // When user becomes available (after login / token restore), load data from cache immediately
  useEffect(() => {
    if (user?.id) {
      const deletedSet = getDeletedChatIds(user.id);
      const cached = getCachedRecentChats(user.id).filter(c => !deletedSet.has(c.id) && (!c._id || !deletedSet.has(c._id)));
      if (cached.length > 0) setRecentChats(cached);
      const cachedGroups = getCachedGroups(user.id);
      if (cachedGroups.length > 0) setGroups(cachedGroups);
      const cachedUsers = getCachedAllUsers(user.id);
      if (cachedUsers.length > 0) setAllUsers(cachedUsers);
    }
  }, [user?.id]);

  // Monitor network online/offline state
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setIsOnline(online);
      if (online) {
        loadRecentChats();
        loadGroups();
        loadAllUsers();
      }
    });
    return unsubscribe;
  }, [user?.id]);

  // Listen for local chat updates (e.g. offline message sent in ChatWindow)
  useEffect(() => {
    const handleRecentUpdate = () => {
      if (user?.id) {
        const deletedSet = getDeletedChatIds(user.id);
        const cached = getCachedRecentChats(user.id).filter(c => !deletedSet.has(c.id) && (!c._id || !deletedSet.has(c._id)));
        setRecentChats(cached);
      }
    };
    window.addEventListener('pulsechat_recent_updated', handleRecentUpdate);
    return () => window.removeEventListener('pulsechat_recent_updated', handleRecentUpdate);
  }, [user?.id]);

  // Notification Permission State — respect localStorage dismiss flag
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (localStorage.getItem('pulsechat_notif_dismissed') === 'true') return 'dismissed';
      return Notification.permission;
    }
    return 'granted';
  });

  const handleAvatarStoryClick = async (e, targetUser) => {
    e.stopPropagation();
    const targetId = targetUser.id || targetUser._id || targetUser.username;

    let userVibeGroup = null;
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (curToken && targetId) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/user/${targetId}`, {
          headers: { Authorization: `Bearer ${curToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.vibes && data.vibes.length > 0) {
            userVibeGroup = data;
          }
        }
      } catch (err) {}
    }

    if (userVibeGroup) {
      setSelectedVibeGroup(userVibeGroup);
    } else {
      if (onOpenFullDp) onOpenFullDp(targetUser.avatar, targetUser.displayName || targetUser.name, targetUser.username);
    }
  };

  // Next-Gen Feature States
  const [silentMode, setSilentMode] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Instagram-Style Pull-to-Refresh & Swipe Tabs State
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isTop: false });
  const listContainerRef = useRef(null);

  useEffect(() => {
    if (isRefreshing) {
      setPullDistance(52);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const isAtTop = listContainerRef.current ? listContainerRef.current.scrollTop <= 2 : true;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isTop: isAtTop
    };
  };

  const handleTouchMove = (e) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Pull-to-Refresh: downward drag when scrolled to top
    if (touchStartRef.current.isTop && deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      setIsPulling(true);
      const pull = Math.min(75, deltaY * 0.42);
      setPullDistance(pull);
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;

    // Trigger Pull-to-Refresh if pulled past threshold
    if (pullDistance >= 45 && !isRefreshing) {
      handleManualRefresh();
    } else if (!isRefreshing) {
      setPullDistance(0);
    }
    setIsPulling(false);

    // Horizontal Swipe for Tabs (CHATS <-> GROUPS <-> SYNC)
    if (Math.abs(deltaX) > 38 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15 && elapsed < 900) {
      if (deltaX < -38) {
        // Swipe Left -> next tab
        if (activeTab === 'chats') {
          setActiveTab('groups');
        } else if (activeTab === 'groups') {
          setActiveTab('friends');
        }
      } else if (deltaX > 38) {
        // Swipe Right -> previous tab (only if not starting from ultra-left edge < 55px which opens story modal)
        if (touchStartRef.current.x >= 55) {
          if (activeTab === 'friends') {
            setActiveTab('groups');
          } else if (activeTab === 'groups') {
            setActiveTab('chats');
          }
        }
      }
    }
  };

  const resolveMergedRecentChats = useCallback((serverData, freshUsersList = []) => {
    if (!Array.isArray(serverData)) return [];
    const localUsers = (Array.isArray(freshUsersList) && freshUsersList.length > 0) ? freshUsersList : (getCachedAllUsers(user?.id) || []);
    const uMap = new Map();
    localUsers.forEach(u => {
      if (u.id) uMap.set(u.id, u);
      if (u._id) uMap.set(u._id, u);
      if (u.username) uMap.set(u.username, u);
    });

    const cachedList = (user?.id ? getCachedRecentChats(user.id) : []) || [];
    const deletedSet = getDeletedChatIds(user?.id);

    const serverMapped = serverData.map(item => {
      const fresh = uMap.get(item.id) || (item.username ? uMap.get(item.username) : null);
      let res = { ...item };
      if (fresh) {
        if (fresh.avatar) res.avatar = fresh.avatar;
        if (fresh.displayName) res.displayName = fresh.displayName;
        if (fresh.isPro !== undefined) res.isPro = Boolean(fresh.isPro);
        if (fresh.proTier) res.proTier = fresh.proTier;
        if (fresh.customBadge !== undefined) res.customBadge = fresh.customBadge;
        if (fresh.hasKingCrown !== undefined) res.hasKingCrown = Boolean(fresh.hasKingCrown);
        if (fresh.hasSilverCrown !== undefined) res.hasSilverCrown = Boolean(fresh.hasSilverCrown);
        if (fresh.hasStreakCrown !== undefined) res.hasStreakCrown = Boolean(fresh.hasStreakCrown);
      }

      const cachedMatch = cachedList.find(c => {
        if (!c) return false;
        if (res.id && (c.id === res.id || c._id === res.id)) return true;
        if (res._id && (c.id === String(res._id) || c._id === String(res._id))) return true;
        if (res.username && c.username && String(c.username).toLowerCase() === String(res.username).toLowerCase()) return true;
        if (res.displayName && c.displayName && String(c.displayName).toLowerCase() === String(res.displayName).toLowerCase()) return true;
        return false;
      });

      // WhatsApp Local-First: Inspect device's local message storage for this conversation across all keys
      const localLastMsg = getLatestCachedMessageForContact(user, res);

      if (cachedMatch || localLastMsg) {
        if (cachedMatch) {
          if (res.nickname === undefined && cachedMatch.nickname) {
            res.nickname = cachedMatch.nickname;
          }
          if (res.nicknames === undefined && cachedMatch.nicknames) {
            res.nicknames = cachedMatch.nicknames;
          }
        }

        const cachedTime = new Date(cachedMatch?.lastMessageTimestamp || cachedMatch?.lastMessageTime || 0).getTime();
        const localMsgTime = new Date(localLastMsg?.timestamp || localLastMsg?.createdAt || 0).getTime();
        const serverTime = new Date(res.lastMessageTimestamp || res.lastMessageTime || 0).getTime();
        const bestLocalTime = Math.max(cachedTime, localMsgTime);

        // WhatsApp Pure Post Office Architecture:
        // Server deletes delivered messages, so local device storage is master.
        const preferLocal = (bestLocalTime > 0) && (
          !res.lastMessage ||
          bestLocalTime >= serverTime ||
          (serverTime > 0 && Math.abs(bestLocalTime - serverTime) > 60000 && bestLocalTime > serverTime) ||
          localMsgTime > 0
        );

        if (preferLocal) {
          if (localMsgTime >= cachedTime && localLastMsg) {
            const myVars = new Set([user?.id, user?._id, user?.username].filter(Boolean).map(String));
            const isFromMe = myVars.has(String(localLastMsg.senderId));
            let snippet = (localLastMsg.type === 'stealth_dust' || localLastMsg.isDustText)
              ? '⚡ Stealth Dust Text'
              : localLastMsg.type === 'text' ? (localLastMsg.content || '')
              : localLastMsg.type === '3d_text' ? `✨ 3D: ${localLastMsg.content}`
              : localLastMsg.type === 'image' ? '📷 Photo'
              : localLastMsg.type === 'video' ? '🎥 Video'
              : localLastMsg.type === 'voice' || localLastMsg.type === 'audio' ? '🎤 Voice message'
              : localLastMsg.type === 'gift' ? '🎁 Gift'
              : localLastMsg.type === 'poll' ? '📊 Poll'
              : 'File attachment';
            res.lastMessage = snippet;
            res.lastMessageTime = localLastMsg.timestamp || localLastMsg.createdAt;
            res.lastMessageTimestamp = localLastMsg.timestamp || localLastMsg.createdAt;
            res.lastMessageFromMe = isFromMe;
            res.lastMessageStatus = localLastMsg.status || 'sent';
            res.lastMessageType = localLastMsg.type || 'text';
          } else if (cachedMatch?.lastMessage) {
            res.lastMessage = cachedMatch.lastMessage;
            res.lastMessageTime = cachedMatch.lastMessageTime;
            res.lastMessageTimestamp = cachedMatch.lastMessageTimestamp;
            res.lastMessageFromMe = cachedMatch.lastMessageFromMe;
            res.lastMessageStatus = cachedMatch.lastMessageStatus;
            res.lastMessageType = cachedMatch.lastMessageType || res.lastMessageType;
          }
        }
      }

      const isCurrentlyActive = Boolean(
        activeChatRef.current && (
          res.id === activeChatRef.current.id ||
          res._id === activeChatRef.current.id ||
          res.id === activeChatRef.current._id ||
          res._id === activeChatRef.current._id ||
          (res.username && activeChatRef.current.username && String(res.username).toLowerCase() === String(activeChatRef.current.username).toLowerCase())
        )
      );
      if (isCurrentlyActive) {
        res.unreadCount = 0;
      } else {
        res.unreadCount = Math.max(Number(res.unreadCount) || 0, Number(cachedMatch?.unreadCount) || 0);
      }
      return res;
    });

    // Preserve local chats not present in server data yet
    const serverKeys = new Set(serverMapped.flatMap(s => [s.id, s._id, s.username && String(s.username).toLowerCase()].filter(Boolean)));
    const extraLocal = cachedList.filter(c =>
      !serverKeys.has(c.id) &&
      (!c._id || !serverKeys.has(c._id)) &&
      (!c.username || !serverKeys.has(String(c.username).toLowerCase()))
    );

    const combined = [...serverMapped, ...extraLocal];
    const seenKeys = new Set();
    const finalSorted = combined
      .filter(c => {
        if (!c || !c.id || c.id === 'user' || c.id === 'undefined') return false;
        if (deletedSet.has(c.id) || (c._id && deletedSet.has(c._id))) return false;
        const key = c.id || c._id;
        if (seenKeys.has(key)) return false;
        if (c.username && seenKeys.has(c.username)) return false;
        seenKeys.add(key);
        if (c.username) seenKeys.add(c.username);
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(a.lastMessageTimestamp || a.lastMessageTime || 0).getTime();
        const tB = new Date(b.lastMessageTimestamp || b.lastMessageTime || 0).getTime();
        return tB - tA;
      });

    return finalSorted;
  }, [user]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // Hard safety guarantee: refresh spinner NEVER spins longer than 1.2 seconds!
    const hardSafetyTimer = setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);

    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) {
      clearTimeout(hardSafetyTimer);
      setIsRefreshing(false);
      return;
    }

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 3500);

    try {
      // 1. Fetch fresh users, recent conversations, groups, and friendship info in parallel
      const [usersRes, recentRes, groupsRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/users?t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${curToken}` }, signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/users/recent?t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${curToken}` }, signal: controller.signal }),
        fetch(`${BACKEND_URL}/api/groups?t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: `Bearer ${curToken}` }, signal: controller.signal }),
        loadFriendshipInfo(controller.signal)
      ]);

      let freshUsers = [];
      if (usersRes.status === 'fulfilled' && usersRes.value?.ok) {
        freshUsers = await parseSafeJson(usersRes.value);
        if (Array.isArray(freshUsers)) {
          setAllUsers(freshUsers);
          if (user?.id) setCachedAllUsers(user.id, freshUsers);
          try {
            const avatars = freshUsers.map(u => u.avatar).filter(Boolean);
            if (avatars.length > 0) preloadMediaUrls(avatars);
          } catch (_) {}
        }
      }

      if (groupsRes.status === 'fulfilled' && groupsRes.value?.ok) {
        const groupsData = await parseSafeJson(groupsRes.value);
        if (Array.isArray(groupsData)) {
          setGroups(groupsData);
          if (user?.id) setCachedGroups(user.id, groupsData);
        }
      }

      if (recentRes.status === 'fulfilled' && recentRes.value?.ok) {
        const recentData = await parseSafeJson(recentRes.value);
        if (Array.isArray(recentData)) {
          const finalSorted = resolveMergedRecentChats(recentData, freshUsers);
          setRecentChats(finalSorted);
          if (user?.id) setCachedRecentChats(user.id, finalSorted);
        }
      }

      // 2. Re-establish socket connection & setup if needed
      if (socket) {
        if (!socket.connected) socket.connect();
        if (user?.id) socket.emit('setup', user.id);
      }
    } catch (e) {
      console.warn('Manual refresh error:', e);
    } finally {
      clearTimeout(fetchTimeout);
      clearTimeout(hardSafetyTimer);
      setIsRefreshing(false);
    }
  };

  const loadRecentChats = useCallback(() => {
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) return;
    fetch(`${BACKEND_URL}/api/users/recent?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${curToken}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          const finalSorted = resolveMergedRecentChats(data);
          if (finalSorted.length > 0 || (user?.id ? getCachedRecentChats(user.id) : []).length === 0) {
            setRecentChats(finalSorted);
            if (user?.id) {
              setCachedRecentChats(user.id, finalSorted);
            }
          }
        }
      })
      .catch(() => {
        // Offline: restore from cache
        if (user?.id) {
          const deletedSet = getDeletedChatIds(user.id);
          const cached = getCachedRecentChats(user.id).filter(c => !deletedSet.has(c.id) && (!c._id || !deletedSet.has(c._id)));
          if (cached.length > 0) setRecentChats(cached);
        }
      });
  }, [token, user, resolveMergedRecentChats]);

  const loadGroups = useCallback(() => {
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) return;
    fetch(`${BACKEND_URL}/api/groups?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${curToken}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          setGroups(data);
          if (user?.id) {
            setCachedGroups(user.id, data);
          }
        }
      })
      .catch(() => {
        // Offline: restore from cache
        if (user?.id) {
          const cached = getCachedGroups(user.id);
          if (cached.length > 0) setGroups(cached);
        }
      });
  }, [token, user?.id]);

  const loadAllUsers = useCallback(() => {
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) return;
    fetch(`${BACKEND_URL}/api/users?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${curToken}` }
    })
      .then(res => parseSafeJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          setAllUsers(data);
          if (user?.id) {
            setCachedAllUsers(user.id, data);
          }
        }
      })
      .catch(() => {
        // Offline: already loaded from cache in state
      });
  }, [token, user?.id]);

  // Background silent revalidation on window focus and socket reconnect (throttled to 60s)
  useEffect(() => {
    const handleRevalidate = () => {
      const now = Date.now();
      if (now - lastRevalidateRef.current < 60000) {
        return;
      }
      lastRevalidateRef.current = now;
      loadRecentChats();
      loadAllUsers();
      loadFriendshipInfo();
    };

    window.addEventListener('focus', handleRevalidate);
    if (socket) {
      socket.on('connect', handleRevalidate);
    }

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      if (socket) {
        socket.off('connect', handleRevalidate);
      }
    };
  }, [socket, loadRecentChats, loadAllUsers, loadFriendshipInfo]);

  // Auto-sync fresh avatars, VIP/Pro neon status, and badges from allUsers into recentChats
  useEffect(() => {
    if (allUsers.length > 0 && recentChats.length > 0) {
      const uMap = new Map();
      allUsers.forEach(u => {
        if (u.id) uMap.set(u.id, u);
        if (u._id) uMap.set(u._id, u);
        if (u.username) uMap.set(u.username, u);
      });
      let changed = false;
      const synced = recentChats.map(item => {
        const fresh = uMap.get(item.id) || (item.username ? uMap.get(item.username) : null);
        if (!fresh) return item;
        let itemChanged = false;
        let updated = { ...item };
        if (fresh.avatar && fresh.avatar !== item.avatar) {
          updated.avatar = fresh.avatar;
          itemChanged = true;
        }
        if (fresh.isPro !== undefined && Boolean(fresh.isPro) !== Boolean(item.isPro)) {
          updated.isPro = Boolean(fresh.isPro);
          itemChanged = true;
        }
        if (fresh.proTier && fresh.proTier !== item.proTier) {
          updated.proTier = fresh.proTier;
          itemChanged = true;
        }
        if (fresh.customBadge !== undefined && fresh.customBadge !== item.customBadge) {
          updated.customBadge = fresh.customBadge;
          itemChanged = true;
        }
        if (fresh.displayName && fresh.displayName !== item.displayName) {
          updated.displayName = fresh.displayName;
          itemChanged = true;
        }
        if (fresh.hasKingCrown !== undefined && Boolean(fresh.hasKingCrown) !== Boolean(item.hasKingCrown)) {
          updated.hasKingCrown = Boolean(fresh.hasKingCrown);
          itemChanged = true;
        }
        if (fresh.hasSilverCrown !== undefined && Boolean(fresh.hasSilverCrown) !== Boolean(item.hasSilverCrown)) {
          updated.hasSilverCrown = Boolean(fresh.hasSilverCrown);
          itemChanged = true;
        }
        if (fresh.hasStreakCrown !== undefined && Boolean(fresh.hasStreakCrown) !== Boolean(item.hasStreakCrown)) {
          updated.hasStreakCrown = Boolean(fresh.hasStreakCrown);
          itemChanged = true;
        }
        if (itemChanged) changed = true;
        return itemChanged ? updated : item;
      });
      if (changed) {
        setRecentChats(synced);
        if (user?.id) setCachedRecentChats(user.id, synced);
      }
    }
  }, [allUsers]);

  useEffect(() => {
    loadRecentChats();
    loadGroups();
    loadAllUsers();
  }, [loadRecentChats, loadGroups, loadAllUsers]);



  useEffect(() => {
    if (activeChat && user?.id) {
      clearUnreadCount(user.id, activeChat.id);
      setRecentChats(prev => prev.map(u => (
        u.id === activeChat.id ||
        (u.username && activeChat.username && u.username === activeChat.username) ||
        (activeChat.chatId && activeChat.chatId.includes(u.id))
      ) ? { ...u, unreadCount: 0 } : u));
    }
  }, [activeChat, user?.id]);

  useEffect(() => {
    if (!socket) return;

    // Instant zero-latency chat list reordering on message send or receive (0ms)
    const handleSidebarNewMessage = async (msg) => {
      if (!msg) return;

      const isMyMsg = Boolean(
        user?.id && (
          msg.senderId === user.id ||
          (user._id && msg.senderId === user._id) ||
          (user.username && msg.senderId === user.username)
        )
      );

      // Decrypt message if incoming encrypted message and not yet decrypted
      let effectiveMsg = msg;
      if (!isMyMsg && effectiveMsg.isEncrypted && !effectiveMsg._decrypted) {
        let privKey = myIdentityRef.current?.keyPair?.privateKey;
        if (!privKey && user?.id) {
          try {
            const ident = await getOrInitDeviceIdentity(user.id);
            myIdentityRef.current = ident;
            privKey = ident?.keyPair?.privateKey;
          } catch {}
        }
        if (privKey) {
          try {
            effectiveMsg = await decryptMessageIfNeeded(effectiveMsg, privKey);
          } catch (e) {
            console.warn('Sidebar decrypt error:', e);
          }
        }
      }

      const msgKey = effectiveMsg.id || effectiveMsg.clientTempId || effectiveMsg._id || (effectiveMsg.chatId + '_' + (effectiveMsg.timestamp || ''));
      const isAlreadyProcessed = msgKey ? processedMsgIdsRef.current.get(msgKey) : null;
      if (isAlreadyProcessed === 'decrypted') return;
      if (isAlreadyProcessed === 'raw' && !effectiveMsg._decrypted) return;

      const isPromotionFromRaw = (isAlreadyProcessed === 'raw' && effectiveMsg._decrypted);
      if (msgKey) {
        processedMsgIdsRef.current.set(msgKey, effectiveMsg._decrypted ? 'decrypted' : 'raw');
        if (processedMsgIdsRef.current.size > 200) {
          const keys = Array.from(processedMsgIdsRef.current.keys());
          for (let i = 0; i < 100; i++) {
            processedMsgIdsRef.current.delete(keys[i]);
          }
        }
      }

      const targetId = isMyMsg ? effectiveMsg.receiverId : (effectiveMsg.isGroup ? effectiveMsg.chatId : effectiveMsg.senderId);
      if (!targetId && !effectiveMsg.chatId) return;

      // WhatsApp Local-First: SAVE incoming message immediately to device local message storage!
      if (effectiveMsg.chatId) {
        appendCachedMessage(effectiveMsg.chatId, effectiveMsg);
        const canonical = effectiveMsg.chatId.includes('_') ? effectiveMsg.chatId.split('_').sort().join('_') : effectiveMsg.chatId;
        if (canonical && canonical !== effectiveMsg.chatId) {
          appendCachedMessage(canonical, effectiveMsg);
        }
      }

      const isCurrentlyViewing = Boolean(
        activeChatRef.current && (
          (effectiveMsg.isGroup && (activeChatRef.current.id === effectiveMsg.chatId || activeChatRef.current.id === targetId)) ||
          (!effectiveMsg.isGroup && (
            activeChatRef.current.id === targetId ||
            activeChatRef.current._id === targetId ||
            (targetId && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(targetId).toLowerCase()) ||
            (effectiveMsg.senderUsername && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(effectiveMsg.senderUsername).toLowerCase()) ||
            (effectiveMsg.senderName && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(effectiveMsg.senderName).toLowerCase()) ||
            (effectiveMsg.senderName && activeChatRef.current.displayName && String(activeChatRef.current.displayName).toLowerCase() === String(effectiveMsg.senderName).toLowerCase())
          ))
        )
      );

      // WhatsApp Post Office: Emit read receipt back to sender if user is actively viewing (0ms)
      if (!isMyMsg && isCurrentlyViewing) {
        const isCurGhost = (typeof window !== 'undefined' && localStorage.getItem('pulsechat_ghost_global') === 'true') || Boolean(user?.hideReadReceipts);
        const msgIdToAck = effectiveMsg.id || effectiveMsg.clientTempId;
        if (msgIdToAck && !isCurGhost) {
          socket.emit('mark_read', { messageId: msgIdToAck, chatId: effectiveMsg.chatId, senderId: effectiveMsg.senderId });
          socket.emit('mark_chat_read', { chatId: effectiveMsg.chatId, userId: user?.id, isGhost: false });
        }
      }

      let contentSnippet = (effectiveMsg.type === 'stealth_dust' || effectiveMsg.isDustText)
        ? '⚡ Stealth Dust Text'
        : (effectiveMsg.type === 'story_reply' || effectiveMsg.storyReply)
        ? (() => {
            const sr = effectiveMsg.storyReply;
            const isShared = (effectiveMsg.content && effectiveMsg.content.startsWith('Shared ')) || (!sr?.reactionEmoji && !sr?.tipSparks && !sr?.replyText);
            if (isShared) return isMyMsg ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
            if (sr?.reactionEmoji) return isMyMsg ? `You reacted ${sr.reactionEmoji} to story` : `Reacted ${sr.reactionEmoji} to your story`;
            if (sr?.tipSparks) return isMyMsg ? `You tipped ⚡ ${sr.tipSparks} Sparks on story` : `Tipped ⚡ ${sr.tipSparks} Sparks on your story!`;
            if (sr?.replyText) return isMyMsg ? `You replied: "${sr.replyText}"` : `Replied to your story: "${sr.replyText}"`;
            return isMyMsg ? 'You shared a vibe ⚡' : 'Shared a vibe ⚡';
          })()
        : (effectiveMsg.type === 'text'
        ? (effectiveMsg.content || (effectiveMsg.isEncrypted && !effectiveMsg._decrypted ? '🔒 Encrypted message' : ''))
        : (effectiveMsg.type === '3d_text' ? `✨ 3D: ${effectiveMsg.content || ''}`
        : effectiveMsg.type === 'image' ? '📷 Photo'
        : effectiveMsg.type === 'video' ? '🎥 Video'
        : effectiveMsg.type === 'audio' || effectiveMsg.type === 'voice' ? '🎤 Voice message'
        : effectiveMsg.type === 'gift' ? '🎁 Gift'
        : effectiveMsg.type === 'poll' ? '📊 Poll'
        : effectiveMsg.type === 'call' ? '📞 Call'
        : (effectiveMsg.content || (effectiveMsg.fileName ? `📁 ${effectiveMsg.fileName}` : (effectiveMsg.type === 'document' ? '📁 Document' : '')))));

      if (effectiveMsg.type === 'text' && contentSnippet) {
        if (contentSnippet.startsWith('Replied to your story:')) {
          contentSnippet = isMyMsg
            ? contentSnippet.replace(/^Replied to your story:\s*/, 'You replied: ')
            : contentSnippet;
        } else if (contentSnippet.startsWith('Reacted ') && contentSnippet.includes(' to your story')) {
          contentSnippet = isMyMsg
            ? contentSnippet.replace(/\s*to your story$/, ' to story')
            : contentSnippet;
        } else if (contentSnippet.startsWith('Tipped ') && contentSnippet.includes(' on your story!')) {
          contentSnippet = isMyMsg
            ? contentSnippet.replace(/\s*on your story!$/, ' on story!')
            : contentSnippet;
        }
      }

      if (effectiveMsg.isForwarded && contentSnippet) {
        contentSnippet = `➡️ Forwarded: ${contentSnippet}`;
      }

      setRecentChats(prevChats => {
        const existingIdx = prevChats.findIndex(c => {
          if (!c) return false;
          if (effectiveMsg.isGroup) {
            return c.id === effectiveMsg.chatId || c._id === effectiveMsg.chatId || c.id === targetId;
          }
          return Boolean(
            (targetId && (c.id === targetId || c._id === targetId)) ||
            (effectiveMsg.chatId && (c.id === effectiveMsg.chatId || c.chatId === effectiveMsg.chatId || (typeof effectiveMsg.chatId === 'string' && (effectiveMsg.chatId.includes(c.id) || (c._id && effectiveMsg.chatId.includes(c._id)))))) ||
            (effectiveMsg.senderUsername && c.username && String(c.username).toLowerCase() === String(effectiveMsg.senderUsername).toLowerCase()) ||
            (targetId && c.username && String(c.username).toLowerCase() === String(targetId).toLowerCase()) ||
            (effectiveMsg.senderName && c.username && String(c.username).toLowerCase() === String(effectiveMsg.senderName).toLowerCase()) ||
            (effectiveMsg.senderName && c.displayName && String(c.displayName).toLowerCase() === String(effectiveMsg.senderName).toLowerCase())
          );
        });

        let targetChat;
        if (existingIdx !== -1) {
          targetChat = { ...prevChats[existingIdx] };
          if (!isMyMsg) {
            if (effectiveMsg.senderAvatar) targetChat.avatar = effectiveMsg.senderAvatar;
            if (effectiveMsg.senderName) targetChat.displayName = effectiveMsg.senderName;
            if (effectiveMsg.senderIsPro !== undefined) targetChat.isPro = Boolean(effectiveMsg.senderIsPro);
            if (effectiveMsg.senderProTier) targetChat.proTier = effectiveMsg.senderProTier;
            if (effectiveMsg.senderCustomBadge !== undefined) targetChat.customBadge = effectiveMsg.senderCustomBadge;
          }
        } else {
          if (effectiveMsg.isGroup) {
            const foundGroup = (groupsRef.current || []).find(g => g.id === effectiveMsg.chatId || g.id === targetId);
            targetChat = foundGroup ? { ...foundGroup, isGroup: true } : {
              id: effectiveMsg.chatId || targetId,
              name: effectiveMsg.groupName || 'Group',
              avatar: foundGroup?.avatar || effectiveMsg.senderAvatar || null,
              isGroup: true
            };
          } else {
            const foundUser = (allUsersRef.current || []).find(u =>
              u.id === targetId ||
              u._id === targetId ||
              (targetId && u.username && String(u.username).toLowerCase() === String(targetId).toLowerCase()) ||
              (effectiveMsg.senderUsername && u.username && String(u.username).toLowerCase() === String(effectiveMsg.senderUsername).toLowerCase()) ||
              (effectiveMsg.senderName && u.displayName && String(u.displayName).toLowerCase() === String(effectiveMsg.senderName).toLowerCase()) ||
              (effectiveMsg.senderName && u.username && String(u.username).toLowerCase() === String(effectiveMsg.senderName).toLowerCase())
            );
            targetChat = foundUser ? {
              ...foundUser,
              avatar: (!isMyMsg && effectiveMsg.senderAvatar) ? effectiveMsg.senderAvatar : foundUser.avatar,
              displayName: (!isMyMsg && (effectiveMsg.senderName || effectiveMsg.senderUsername)) ? (effectiveMsg.senderName || effectiveMsg.senderUsername) : foundUser.displayName,
              isPro: (!isMyMsg && effectiveMsg.senderIsPro !== undefined) ? Boolean(effectiveMsg.senderIsPro) : Boolean(foundUser.isPro),
              proTier: (!isMyMsg && effectiveMsg.senderProTier) ? effectiveMsg.senderProTier : (foundUser.proTier || 'none'),
              customBadge: (!isMyMsg && effectiveMsg.senderCustomBadge !== undefined) ? effectiveMsg.senderCustomBadge : (foundUser.customBadge || ''),
              isGroup: false
            } : {
              id: targetId,
              displayName: (!isMyMsg && (effectiveMsg.senderName || effectiveMsg.senderUsername)) ? (effectiveMsg.senderName || effectiveMsg.senderUsername) : 'PulseChat User',
              username: (!isMyMsg && effectiveMsg.senderUsername) ? effectiveMsg.senderUsername : targetId,
              avatar: (!isMyMsg && effectiveMsg.senderAvatar) ? effectiveMsg.senderAvatar : null,
              isPro: (!isMyMsg && effectiveMsg.senderIsPro !== undefined) ? Boolean(effectiveMsg.senderIsPro) : false,
              proTier: (!isMyMsg && effectiveMsg.senderProTier) ? effectiveMsg.senderProTier : 'none',
              customBadge: (!isMyMsg && effectiveMsg.senderCustomBadge) ? effectiveMsg.senderCustomBadge : '',
              isGroup: false
            };
          }
        }

        const isCurrentlyViewing = Boolean(
          activeChatRef.current && (
            (effectiveMsg.isGroup && (activeChatRef.current.id === effectiveMsg.chatId || activeChatRef.current.id === targetId)) ||
            (!effectiveMsg.isGroup && (
              activeChatRef.current.id === targetId ||
              activeChatRef.current._id === targetId ||
              (targetId && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(targetId).toLowerCase()) ||
              (effectiveMsg.senderUsername && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(effectiveMsg.senderUsername).toLowerCase()) ||
              (effectiveMsg.senderName && activeChatRef.current.username && String(activeChatRef.current.username).toLowerCase() === String(effectiveMsg.senderName).toLowerCase()) ||
              (effectiveMsg.senderName && activeChatRef.current.displayName && String(activeChatRef.current.displayName).toLowerCase() === String(effectiveMsg.senderName).toLowerCase())
            ))
          )
        );

        const currentUnread = targetChat.unreadCount || 0;
        const newUnread = isPromotionFromRaw ? currentUnread : ((isMyMsg || isCurrentlyViewing) ? 0 : currentUnread + 1);

        if (!isMyMsg && !isCurrentlyViewing && !isPromotionFromRaw) {
          try { playSound('received'); } catch {}
        }

        const updatedChat = {
          ...targetChat,
          lastMessage: contentSnippet,
          lastMessageTime: effectiveMsg.timestamp || new Date().toISOString(),
          lastMessageTimestamp: effectiveMsg.timestamp || new Date().toISOString(),
          lastMessageFromMe: isMyMsg,
          lastMessageStatus: effectiveMsg.status || 'sent',
          lastMessageType: effectiveMsg.type || 'text',
          unreadCount: newUnread
        };

        const remaining = prevChats.filter((_, idx) => idx !== existingIdx);
        const reordered = [updatedChat, ...remaining].sort((a, b) => {
          const tA = new Date(a.lastMessageTimestamp || a.lastMessageTime || 0).getTime();
          const tB = new Date(b.lastMessageTimestamp || b.lastMessageTime || 0).getTime();
          return tB - tA;
        });

        if (user?.id) {
          setCachedRecentChats(user.id, reordered);
        }
        return reordered;
      });

      // Also update groups list if group message
      if (effectiveMsg.isGroup) {
        const isCurrentlyViewingGroup = Boolean(
          activeChatRef.current && (activeChatRef.current.id === effectiveMsg.chatId || activeChatRef.current.id === targetId)
        );
        setGroups(prevGroups => prevGroups.map(g => {
          if (g.id === (effectiveMsg.chatId || targetId)) {
            const currentUnread = g.unreadCount || 0;
            const newUnread = isPromotionFromRaw ? currentUnread : ((isMyMsg || isCurrentlyViewingGroup) ? 0 : currentUnread + 1);
            return {
              ...g,
              lastMessage: contentSnippet,
              lastMessageTime: effectiveMsg.timestamp || new Date().toISOString(),
              unreadCount: newUnread
            };
          }
          return g;
        }));
      }
    };

    socket.on('new_message', handleSidebarNewMessage);

    const handleWindowMessage = (e) => {
      if (e.detail) {
        handleSidebarNewMessage(e.detail);
      }
    };
    window.addEventListener('pulsechat_new_message', handleWindowMessage);
    window.addEventListener('pulsechat_message_received', handleWindowMessage);

    // Emoji Reaction update in chat list
    const handleReactionUpdated = (data) => {
      if (!data || !data.emoji) return;
      const { chatId: cId, emoji, userId: reactorId, isAdded } = data;
      const isMe = Boolean(
        user?.id && (reactorId === user.id || (user._id && reactorId === user._id) || (user.username && reactorId === user.username))
      );
      if (isMe || !isAdded) return;

      setRecentChats(prev => {
        let found = false;
        const updated = prev.map(c => {
          const isMatch = Boolean(
            c.id === cId ||
            c.id === reactorId ||
            c._id === reactorId ||
            (c.username && c.username === reactorId) ||
            (cId && typeof cId === 'string' && cId.includes('_') && (
              (c.id && cId.split('_').includes(c.id)) ||
              (c._id && cId.split('_').includes(String(c._id))) ||
              (c.username && cId.split('_').includes(c.username))
            ))
          );
          if (isMatch) {
            found = true;
            return {
              ...c,
              lastMessageStatus: 'read'
            };
          }
          return c;
        });

        if (found) {
          if (user?.id) setCachedRecentChats(user.id, updated);
          return updated;
        }
        return prev;
      });

      if (cId) {
        markAllCachedMessagesRead(cId, user?.id);
      }
    };
    socket.on('reaction_updated', handleReactionUpdated);

    // Instant delivery tick update in chat list
    const handleDeliveryUpdate = ({ messageId, chatId: cId, canonicalChatId, status }) => {
      setRecentChats(prev => {
        let updatedAny = false;
        const next = prev.map(c => {
          const isMatch = Boolean(
            c.id === cId ||
            c._id === cId ||
            c.id === canonicalChatId ||
            c._id === canonicalChatId ||
            (c.username && (c.username === cId || c.username === canonicalChatId)) ||
            (c.chatId && (c.chatId === cId || c.chatId === canonicalChatId)) ||
            (typeof cId === 'string' && (
              (c.id && cId.includes(c.id)) ||
              (c._id && cId.includes(String(c._id))) ||
              (c.username && cId.toLowerCase().includes(c.username.toLowerCase()))
            )) ||
            (typeof canonicalChatId === 'string' && (
              (c.id && canonicalChatId.includes(c.id)) ||
              (c._id && canonicalChatId.includes(String(c._id))) ||
              (c.username && canonicalChatId.toLowerCase().includes(c.username.toLowerCase()))
            ))
          );
          if (isMatch) {
            updatedAny = true;
            return { ...c, lastMessageStatus: (c.lastMessageStatus === 'read' ? 'read' : (status || 'delivered')) };
          }
          return c;
        });
        if (updatedAny && user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
      if (cId) {
        if (messageId) {
          updateCachedMessageStatus(cId, messageId, { status: 'delivered' });
        } else {
          markAllCachedMessagesDelivered(cId, user?.id);
        }
      }
      if (canonicalChatId && canonicalChatId !== cId) {
        if (messageId) {
          updateCachedMessageStatus(canonicalChatId, messageId, { status: 'delivered' });
        } else {
          markAllCachedMessagesDelivered(canonicalChatId, user?.id);
        }
      }
    };
    socket.on('message_delivered_update', handleDeliveryUpdate);
    socket.on('messages_delivered', ({ chatId: cId, canonicalChatId, status }) => {
      handleDeliveryUpdate({ chatId: cId, canonicalChatId, status: status || 'delivered' });
    });

    const handleReadUpdate = ({ messageId, chatId: cId, canonicalChatId, status }) => {
      setRecentChats(prev => {
        let updatedAny = false;
        const next = prev.map(c => {
          const isMatch = Boolean(
            c.id === cId ||
            c._id === cId ||
            c.id === canonicalChatId ||
            c._id === canonicalChatId ||
            (c.username && (c.username === cId || c.username === canonicalChatId)) ||
            (c.chatId && (c.chatId === cId || c.chatId === canonicalChatId)) ||
            (typeof cId === 'string' && (
              (c.id && cId.includes(c.id)) ||
              (c._id && cId.includes(String(c._id))) ||
              (c.username && cId.toLowerCase().includes(c.username.toLowerCase()))
            )) ||
            (typeof canonicalChatId === 'string' && (
              (c.id && canonicalChatId.includes(c.id)) ||
              (c._id && canonicalChatId.includes(String(c._id))) ||
              (c.username && canonicalChatId.toLowerCase().includes(c.username.toLowerCase()))
            ))
          );
          if (isMatch) {
            updatedAny = true;
            return { ...c, lastMessageStatus: status || 'read' };
          }
          return c;
        });
        if (updatedAny && user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
      if (cId) {
        if (messageId) {
          updateCachedMessageStatus(cId, messageId, { status: status || 'read' });
        } else {
          markAllCachedMessagesRead(cId, user?.id);
        }
      }
      if (canonicalChatId && canonicalChatId !== cId) {
        if (messageId) {
          updateCachedMessageStatus(canonicalChatId, messageId, { status: status || 'read' });
        } else {
          markAllCachedMessagesRead(canonicalChatId, user?.id);
        }
      }
    };
    socket.on('message_read_update', handleReadUpdate);

    // Instant local read update (0ms, no network roundtrip needed)
    const handleChatRead = ({ chatId: cId, canonicalChatId, userId }) => {
      const readerStr = String(userId || '');
      const myIdStr = String(user?.id || '');
      const myMongoStr = String(user?._id || '');
      const myUserStr = String(user?.username || '');
      const isMe = !userId || readerStr === myIdStr || readerStr === myMongoStr || readerStr === myUserStr;

      const isMatchingChat = (c) => {
        if (!c) return false;
        return Boolean(
          c.id === cId ||
          c._id === cId ||
          c.id === canonicalChatId ||
          c._id === canonicalChatId ||
          (c.username && (c.username === cId || c.username === canonicalChatId)) ||
          (c.chatId && (c.chatId === cId || c.chatId === canonicalChatId)) ||
          (typeof cId === 'string' && (
            (c.id && cId.includes(c.id)) ||
            (c._id && cId.includes(String(c._id))) ||
            (c.username && cId.toLowerCase().includes(c.username.toLowerCase()))
          )) ||
          (typeof canonicalChatId === 'string' && (
            (c.id && canonicalChatId.includes(c.id)) ||
            (c._id && canonicalChatId.includes(String(c._id))) ||
            (c.username && canonicalChatId.toLowerCase().includes(c.username.toLowerCase()))
          ))
        );
      };

      if (isMe && user?.id) {
        clearUnreadCount(user.id, cId);
        setRecentChats(prev => {
          const next = prev.map(c => isMatchingChat(c) ? { ...c, unreadCount: 0 } : c);
          if (user?.id) setCachedRecentChats(user.id, next);
          return next;
        });
        setGroups(prev => prev.map(g => (g.id === cId || g.id === canonicalChatId) ? { ...g, unreadCount: 0 } : g));
      } else if (!isMe) {
        // Other user read my messages -> mark lastMessageStatus as read in recentChats AND local message storage
        setRecentChats(prev => {
          const next = prev.map(c => isMatchingChat(c) ? { ...c, lastMessageStatus: 'read' } : c);
          if (user?.id) setCachedRecentChats(user.id, next);
          return next;
        });

        if (cId) {
          markAllCachedMessagesRead(cId, user?.id);
        }
        if (canonicalChatId && canonicalChatId !== cId) {
          markAllCachedMessagesRead(canonicalChatId, user?.id);
        }
      }
    };
    socket.on('chat_read_update', handleChatRead);

    const handleNewUser = (newUser) => {
      if (!newUser) return;
      if (user && (newUser.id === user.id || (user.username && newUser.username === user.username))) return;
      setAllUsers(prev => {
        if (prev.some(u => u.id === newUser.id || (u.username && newUser.username && u.username === newUser.username))) return prev;
        const next = [newUser, ...prev];
        if (user?.id) setCachedAllUsers(user.id, next);
        return next;
      });
    };

    const handleProfileUpdate = (data) => {
      if (!data) return;
      const { userId, userMongoId, username, displayName, avatar, status, isPro, proTier, customBadge, pulseSparks } = data;

      const isMatch = (u) => {
        if (!u) return false;
        if (u.id && (u.id === userId || (userMongoId && u.id === userMongoId))) return true;
        if (u._id && (u._id === userId || (userMongoId && u._id === userMongoId))) return true;
        if (username && u.username === username) return true;
        return false;
      };

      setAllUsers(prev => {
        const next = prev.map(u => isMatch(u) ? {
          ...u,
          ...(displayName !== undefined && displayName !== '' && { displayName }),
          ...(avatar !== undefined && avatar !== '' && { avatar }),
          ...(status !== undefined && { status }),
          ...(isPro !== undefined && { isPro: Boolean(isPro) }),
          ...(proTier !== undefined && { proTier }),
          ...(customBadge !== undefined && { customBadge }),
          ...(pulseSparks !== undefined && { pulseSparks })
        } : u);
        if (user?.id) setCachedAllUsers(user.id, next);
        return next;
      });

      setRecentChats(prev => {
        const next = prev.map(u => isMatch(u) ? {
          ...u,
          ...(displayName !== undefined && displayName !== '' && { displayName }),
          ...(avatar !== undefined && avatar !== '' && { avatar }),
          ...(status !== undefined && { status }),
          ...(isPro !== undefined && { isPro: Boolean(isPro) }),
          ...(proTier !== undefined && { proTier }),
          ...(customBadge !== undefined && { customBadge })
        } : u);
        if (user?.id) setCachedRecentChats(user.id, next);
        return next;
      });

      setSearchResults(prev => prev.map(u => isMatch(u) ? {
        ...u,
        ...(displayName !== undefined && displayName !== '' && { displayName }),
        ...(avatar !== undefined && avatar !== '' && { avatar }),
        ...(status !== undefined && { status }),
        ...(isPro !== undefined && { isPro: Boolean(isPro) }),
        ...(proTier !== undefined && { proTier }),
        ...(customBadge !== undefined && { customBadge })
      } : u));
    };

    socket.on('new_user_registered', handleNewUser);
    socket.on('user_profile_updated', handleProfileUpdate);

    const handleWindowEvent = (e) => {
      if (e.detail?.updates) {
        handleProfileUpdate({ userId: e.detail.targetUserId, ...e.detail.updates });
      }
    };
    window.addEventListener('pulsechat_user_profile_updated', handleWindowEvent);

    // Instant Group Updates Sync
    const handleGroupUpdated = (data) => {
      if (!data) return;
      const targetId = data.groupId || data.id || data._id;
      const updates = data.updates || data;
      setGroups(prev => {
        const next = prev.map(g => {
          if (g.id === targetId || g._id === targetId) {
            return {
              ...g,
              name: updates.name || g.name,
              avatar: updates.avatar || g.avatar,
              description: updates.description !== undefined ? updates.description : g.description
            };
          }
          return g;
        });
        if (user?.id) setCachedGroups(user.id, next);
        return next;
      });

      setRecentChats(prev => {
        const next = prev.map(c => {
          if (c.isGroup && (c.id === targetId || c._id === targetId)) {
            return {
              ...c,
              displayName: updates.name || c.displayName || c.name,
              name: updates.name || c.name,
              avatar: updates.avatar || c.avatar,
              description: updates.description !== undefined ? updates.description : c.description
            };
          }
          return c;
        });
        if (user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
    };

    socket.on('group_updated', handleGroupUpdated);

    const handleWindowGroupEvent = (e) => {
      if (e.detail) {
        handleGroupUpdated(e.detail);
      }
    };
    window.addEventListener('pulsechat_group_updated', handleWindowGroupEvent);

    // Instant In-Chat Nicknames Sync
    const handleNicknameUpdated = (data) => {
      if (!data) return;
      const targetChat = data.chatId;
      const targetUserId = data.targetUserId ? String(data.targetUserId) : '';
      const nickname = (typeof data.nickname === 'string' && data.nickname.trim()) ? data.nickname.trim() : null;
      const nicks = (data.nicknames && typeof data.nicknames === 'object') ? data.nicknames : {};

      setRecentChats(prev => {
        const next = prev.map(c => {
          const cKeys = [c.id ? String(c.id) : null, c._id ? String(c._id) : null, c.username ? String(c.username) : null].filter(Boolean);
          const canonical = (c.id && user?.id) ? [user.id, c.id].sort().join('_') : '';
          const isTargetUser = cKeys.includes(targetUserId) || (targetUserId && targetUserId.includes(c.id));
          const isThisChat = targetChat && (
            targetChat === canonical ||
            targetChat === c.id ||
            data.originalChatId === canonical ||
            data.originalChatId === c.id ||
            targetChat.includes(c.id) ||
            (c.id && targetChat.includes(c.id.replace('user_', '')))
          );

          if (isTargetUser || isThisChat) {
            let resolvedNick = null;
            for (const k of cKeys) {
              if (nicks[k] && typeof nicks[k] === 'string' && nicks[k].trim()) {
                resolvedNick = nicks[k].trim();
                break;
              }
            }
            if (!resolvedNick && isTargetUser && nickname) {
              resolvedNick = nickname;
            }
            return {
              ...c,
              nickname: resolvedNick,
              nicknames: nicks
            };
          }
          return c;
        });
        if (user?.id) setCachedRecentChats(user.id, next);
        return next;
      });
    };

    socket.on('chat_nickname_updated', handleNicknameUpdated);

    const handleWindowNicknameEvent = (e) => {
      if (e.detail) {
        handleNicknameUpdated(e.detail);
      }
    };
    window.addEventListener('pulsechat_nickname_updated', handleWindowNicknameEvent);

    return () => {
      socket.off('new_message', handleSidebarNewMessage);
      window.removeEventListener('pulsechat_new_message', handleWindowMessage);
      window.removeEventListener('pulsechat_message_received', handleWindowMessage);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_delivered_update', handleDeliveryUpdate);
      socket.off('messages_delivered');
      socket.off('message_read_update', handleReadUpdate);
      socket.off('chat_read_update', handleChatRead);
      socket.off('new_user_registered', handleNewUser);
      socket.off('user_profile_updated', handleProfileUpdate);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('chat_nickname_updated', handleNicknameUpdated);
      window.removeEventListener('pulsechat_user_profile_updated', handleWindowEvent);
      window.removeEventListener('pulsechat_group_updated', handleWindowGroupEvent);
      window.removeEventListener('pulsechat_nickname_updated', handleWindowNicknameEvent);
    };
  }, [socket, user?.id, user?.username]);

  // Search Users — instant 0ms local in-memory display + 120ms debounced server search with React 18 Time-Slicing
  useEffect(() => {
    const q = deferredSearchQuery.trim().toLowerCase().replace(/^@/, '');
    if (q.length === 0) {
      setSearchResults([]);
      return;
    }

    // 1. Immediately search across all in-memory users & chats + offline cache (0ms instant response)
    const localUsers = getCachedAllUsers(user?.id) || [];
    const localRecent = getCachedRecentChats(user?.id) || [];

    const seenKeys = new Set();
    const candidatePool = [];
    for (const u of [...allUsers, ...recentChats, ...localUsers, ...localRecent]) {
      if (!u) continue;
      const key = u.id || u._id || u.username;
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Exclude current user from search results
      if (u.id === user?.id || (user?.username && u.username === user.username)) continue;
      candidatePool.push(u);
    }

    const candidateWithNicknames = candidatePool.map(u => {
      // Find private nickname set by current user for this contact
      const recentMatch = recentChats.find(r =>
        (r.id && u.id && r.id === u.id) ||
        (r._id && u._id && r._id === u._id) ||
        (r.username && u.username && r.username === u.username)
      ) || localRecent.find(r =>
        (r.id && u.id && r.id === u.id) ||
        (r._id && u._id && r._id === u._id) ||
        (r.username && u.username && r.username === u.username)
      );

      const privateNickname = (typeof u.nickname === 'string' && u.nickname.trim())
        ? u.nickname.trim()
        : (recentMatch && typeof recentMatch.nickname === 'string' && recentMatch.nickname.trim() ? recentMatch.nickname.trim() : '');

      return privateNickname ? { ...u, nickname: privateNickname } : u;
    });

    let isSubscribed = true;
    let localMatches = [];

    // Multithreaded Web Worker search off the UI thread (0ms Main-Thread Latency)
    runWorkerTask('SEARCH_CONTACTS', { contacts: candidateWithNicknames, query: q })
      .then(matches => {
        if (!isSubscribed) return;
        localMatches = Array.isArray(matches) ? matches : [];
        setSearchResults(localMatches);
      })
      .catch(() => {
        if (!isSubscribed) return;
        localMatches = candidateWithNicknames.filter(u => {
          const nameMatch = (u.displayName || '').toLowerCase().includes(q);
          const usernameMatch = (u.username || '').toLowerCase().includes(q);
          const emailMatch = (u.email || '').toLowerCase().includes(q);
          const nicknameMatch = (u.nickname || '').toLowerCase().includes(q);
          return nameMatch || usernameMatch || emailMatch || nicknameMatch;
        });
        setSearchResults(localMatches);
      });

    // 2. Fast server search with AbortController to fetch any newly created users without race conditions
    const curToken = token || localStorage.getItem('pulsechat_token');
    if (!curToken) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(q)}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${curToken}` },
        signal: controller.signal
      })
        .then(async (res) => {
          if (!res.ok || !isSubscribed) return;
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              if (user?.id && data.length > 0) mergeIntoAllUsersCache(user.id, data);
              const serverKeys = new Set(data.map(u => u.id || u.username));
              const merged = [
                ...data.map(u => {
                  const recentMatch = recentChats.find(r =>
                    (r.id && u.id && r.id === u.id) ||
                    (r.username && u.username && r.username === u.username)
                  ) || localRecent.find(r =>
                    (r.id && u.id && r.id === u.id) ||
                    (r.username && u.username && r.username === u.username)
                  );
                  if (recentMatch && recentMatch.nickname) {
                    return { ...u, nickname: recentMatch.nickname };
                  }
                  return u;
                }),
                ...localMatches.filter(u => !serverKeys.has(u.id || u.username))
              ];
              if (isSubscribed) setSearchResults(merged);
            }
          } catch (e) {}
        })
        .catch(() => {});
    }, 120);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [deferredSearchQuery, token, user?.id]);

  const proceedSelectUser = (selectedUser) => {
    if (selectedUser?.id && user?.id) {
      clearUnreadCount(user.id, selectedUser.id);
      setRecentChats(prev => prev.map(c => (
        c.id === selectedUser.id ||
        (c.username && selectedUser.username && c.username === selectedUser.username)
      ) ? { ...c, unreadCount: 0 } : c));
    }
    if (socket && user?.id && (selectedUser?.id || selectedUser?._id)) {
      const partnerId = selectedUser.id || selectedUser._id;
      const cid = [user.id, partnerId].sort().join('_');
      const isCurGhost = (typeof window !== 'undefined' && localStorage.getItem('pulsechat_ghost_global') === 'true') || Boolean(user?.hideReadReceipts);
      socket.emit('mark_chat_read', { chatId: cid, userId: user.id, isGhost: isCurGhost });
    }
    startTransition(() => {
      setActiveChat(selectedUser);
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectUser = (selectedUser) => {
    const cid = selectedUser?.id && user?.id ? [user.id, selectedUser.id].sort().join('_') : selectedUser?.id;
    if (isChatLocked(cid)) {
      setPendingLockedChat({ type: 'user', data: selectedUser });
      setShowLockPinModal(true);
      return;
    }
    proceedSelectUser(selectedUser);
  };

  const proceedSelectGroup = (group) => {
    if (group?.id && user?.id) {
      clearUnreadCount(user.id, group.id);
      setRecentChats(prev => prev.map(c => c.id === group.id ? { ...c, unreadCount: 0 } : c));
    }
    startTransition(() => {
      setActiveChat({
        ...group,
        isGroup: true,
        displayName: group.name,
        id: group.id
      });
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectGroup = (group) => {
    if (isChatLocked(group?.id)) {
      setPendingLockedChat({ type: 'group', data: group });
      setShowLockPinModal(true);
      return;
    }
    proceedSelectGroup(group);
  };

  const handlePanicWipe = () => {
    if (socket && user) {
      socket.emit('panic_wipe', { userId: user.id });
      setRecentChats([]);
      setActiveChat(null);
    }
    setShowPanicModal(false);
  };

  // Contacts to show when no search query: all registered users not yet in recent chats
  const contactsNotInRecent = useMemo(() => {
    if (!Array.isArray(allUsers)) return [];
    const hiddenSet = new Set(hiddenChatIdsState);
    return allUsers.filter(u => {
      if (!u) return false;
      // Exclude logged in user themselves
      if (u.id === user?.id || (user?.username && u.username === user.username)) return false;
      // Exclude if hidden
      const cid = user?.id ? [user.id, u.id || u._id].sort().join('_') : (u.id || u._id);
      if (hiddenSet.has(cid) || isChatHidden(cid)) return false;
      // Exclude if already present in recent chats
      return !recentChats.some(r =>
        r.id === u.id ||
        (r._id && u._id && r._id === u._id) ||
        (r.username && u.username && r.username === u.username)
      );
    });
  }, [allUsers, recentChats, user?.id, user?.username, hiddenChatIdsState]);

  // Instagram-style swipe right from left edge to open Story camera
  const swipeStartXRef = useRef(0);
  const swipeStartYRef = useRef(0);

  const handleSidebarTouchStart = (e) => {
    if (activeChat || !e.touches || e.touches.length === 0) return;
    swipeStartXRef.current = e.touches[0].clientX;
    swipeStartYRef.current = e.touches[0].clientY;
  };

  const handleSidebarTouchEnd = (e) => {
    if (activeChat || !e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - swipeStartYRef.current);
    // If started from left edge (< 70px) and swiped right (> 65px) horizontally
    if (swipeStartXRef.current < 70 && deltaX > 65 && deltaY < 80) {
      setShowCreateVibe(true);
    }
  };

  return (
    <div
      className={`sidebar-container ${activeChat ? 'mobile-hidden' : ''}`}
      onTouchStart={handleSidebarTouchStart}
      onTouchEnd={handleSidebarTouchEnd}
    >
      {/* Top Header: Selection Action Bar OR Archived Header OR WhatsApp Standard Header */}
      {selectedChatIds.length > 0 ? (
        <div
          className="sidebar-header"
          style={{
            padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0.75rem 6px 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sidebar)',
            color: 'var(--text-main)',
            minHeight: '52px'
          }}
        >
          {/* Left: Back button + Selected count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setSelectedChatIds([]);
                setShowSelectionMoreMenu(false);
              }}
              className="icon-btn-ghost interactive-tap"
              title="Close Selection"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={22} />
            </button>
            <span style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {selectedChatIds.length}
            </span>
          </div>

          {/* Right: Pin, Delete, Mute, Archive, 3-dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {/* Pin Chat */}
            <button
              onClick={handlePinSelected}
              className="icon-btn-ghost interactive-tap"
              title="Pin / Unpin Chat"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Pin size={19} />
            </button>

            {/* Delete Chat */}
            <button
              onClick={handleDeleteSelected}
              className="icon-btn-ghost interactive-tap"
              title="Delete Chat"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={19} />
            </button>

            {/* Mute Chat */}
            <button
              onClick={handleMuteSelected}
              className="icon-btn-ghost interactive-tap"
              title="Mute / Unmute Notifications"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <BellOff size={19} />
            </button>

            {/* Archive Chat */}
            <button
              onClick={handleArchiveSelected}
              className="icon-btn-ghost interactive-tap"
              title={isArchivedView ? "Unarchive Chat" : "Archive Chat"}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isArchivedView ? <ArchiveRestore size={19} /> : <Archive size={19} />}
            </button>

            {/* 3-Dot More Menu */}
            <div style={{ position: 'relative' }} ref={selectionMoreMenuRef}>
              <button
                onClick={() => setShowSelectionMoreMenu(prev => !prev)}
                className="icon-btn-ghost interactive-tap"
                title="More options"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  background: showSelectionMoreMenu ? 'var(--hover-bg)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <MoreVertical size={19} />
              </button>

              {showSelectionMoreMenu && (
                <div
                  className="topbar-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '180px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    zIndex: 1200,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    animation: 'pulseModalPop 0.16s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* 1. Select all */}
                  <button
                    onClick={handleSelectAllChats}
                    className="dropdown-menu-item interactive-tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <CheckCheck size={16} color="var(--accent)" />
                    <span>Select all</span>
                  </button>

                  {/* 2. Chat lock */}
                  <button
                    onClick={handleLockSelectedChats}
                    className="dropdown-menu-item interactive-tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Lock size={16} color="var(--accent)" />
                    <span>Chat lock</span>
                  </button>

                  {/* 3. Clear chat */}
                  <button
                    onClick={handleClearSelectedChats}
                    className="dropdown-menu-item interactive-tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <RotateCw size={16} color="var(--accent)" />
                    <span>Clear chat</span>
                  </button>

                  {/* 4. Block user */}
                  <button
                    onClick={handleBlockSelectedUsers}
                    className="dropdown-menu-item interactive-tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <ShieldAlert size={16} color="#ef4444" />
                    <span>Block user</span>
                  </button>

                  {/* 5. User info */}
                  <button
                    onClick={handleViewUserInfo}
                    className="dropdown-menu-item interactive-tap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Info size={16} color="var(--accent)" />
                    <span>User info</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isArchivedView ? (
        <div
          className="sidebar-header"
          style={{
            padding: 'calc(8px + env(safe-area-inset-top, 0px)) 0.85rem 8px 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sidebar)',
            color: 'var(--text-main)',
            minHeight: '52px'
          }}
        >
          <button
            onClick={() => setIsArchivedView(false)}
            className="icon-btn-ghost interactive-tap"
            title="Back to chats"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Archived
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {totalArchivedCount} {totalArchivedCount === 1 ? 'chat' : 'chats'}
            </span>
          </div>
        </div>
      ) : (
        /* WhatsApp-Style Top App Header */
        <div className="sidebar-header" style={{ padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0.75rem 6px 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', overflow: 'visible' }}>
        {/* Brand & User Chip */}
        <div
          className="user-profile-badge"
          onClick={openProfileModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0, cursor: 'pointer', overflow: 'visible' }}
          title="Click to view & edit your profile"
        >
          <div style={{ position: 'relative', flexShrink: 0, padding: '2px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
            <VibeAuraRing aura={myAura} size={40} hasCrown={Boolean(user?.hasKingCrown || user?.hasSilverCrown || user?.hasStreakCrown)}>
              <div
                className={getProAuraRingClass(myAura, user?.isPro)}
                style={{ position: 'relative', flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullDp && onOpenFullDp(user?.avatar, user?.displayName || user?.username, user?.username);
              }}
              title="Click to view full photo"
            >
              {user?.hasKingCrown ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '1.05rem',
                    filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))',
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
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '1.05rem',
                    filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))',
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
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '1.05rem',
                    filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}
                  title="👑 7-Day Gaming Streak Crown"
                >
                  👑
                </div>
              ) : null}
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || 'Pulse')}`}
                alt="Profile"
                className="user-avatar"
                onError={(e) => {
                  e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || 'Pulse')}`;
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: user?.hasKingCrown
                    ? '2.5px solid #fbbf24'
                    : user?.hasSilverCrown
                    ? '2.5px solid #cbd5e1'
                    : user?.hasStreakCrown
                    ? '2.5px solid #f97316'
                    : (user?.isPro ? 'none' : '2px solid var(--accent)'),
                  cursor: 'pointer'
                }}
              />
              {user?.isEmailVerified && (
                <CheckCircle2
                  size={13}
                  color="#10b981"
                  style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%', zIndex: 4 }}
                />
              )}
            </div>
          </VibeAuraRing>
        </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                {user?.displayName || user?.username || 'PulseChat'}
              </h3>
              {user?.isPro && (
                <PulseVipBadge size={15} showLabel={false} />
              )}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap' }}>
              @{user?.username}
            </p>
          </div>
        </div>

        {/* Topbar Actions: Switch Account + Hub (Mini-Games) + 3-Dot More Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Quick Switch Account Button */}
          <div style={{ position: 'relative' }} ref={switchAccountMenuRef}>
            <button
              onClick={() => {
                setShowSwitchAccountMenu(prev => !prev);
                setShowTopMenu(false);
              }}
              title="Switch Account"
              className="icon-btn-ghost"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: showSwitchAccountMenu ? 'var(--hover-bg)' : 'var(--bg-card)',
                color: showSwitchAccountMenu ? 'var(--accent)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <ArrowRightLeft size={16} />
              {savedAccounts && savedAccounts.length > 1 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {savedAccounts.length}
                </span>
              )}
            </button>

            {/* Quick Switch Account Dropdown */}
            {showSwitchAccountMenu && (
              <div
                className="topbar-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: '-60px',
                  width: '290px',
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
                  zIndex: 1100,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowRightLeft size={15} color="var(--accent)" />
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>Switch Account</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {savedAccounts?.length || 1} saved
                  </span>
                </div>

                {/* Account List */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(savedAccounts && savedAccounts.length > 0 ? savedAccounts : [{
                    id: user?.id,
                    username: user?.username,
                    displayName: user?.displayName || user?.username,
                    avatar: user?.avatar || '',
                    isPro: user?.isPro
                  }]).map(acc => {
                    const isActive = acc.id === user?.id || acc.username === user?.username;
                    return (
                      <div
                        key={acc.id || acc.username}
                        onClick={() => {
                          if (!isActive) {
                            switchAccount(acc.id);
                            setShowSwitchAccountMenu(false);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '10px',
                          background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                          border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          cursor: isActive ? 'default' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img
                              src={acc.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${acc.username}`}
                              alt={acc.displayName}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: acc.isPro ? '2px solid #f59e0b' : (isActive ? '2px solid var(--accent)' : '1px solid var(--border)')
                              }}
                            />
                            {acc.isPro && (
                              <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '0.6rem' }}>👑</span>
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {acc.displayName || acc.username}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{acc.username}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isActive ? (
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={11} /> Active
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  switchAccount(acc.id);
                                  setShowSwitchAccountMenu(false);
                                }}
                                className="btn-primary"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px' }}
                              >
                                Switch
                              </button>
                              {savedAccounts?.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSavedAccount(acc.id);
                                  }}
                                  title="Remove account"
                                  className="icon-btn-ghost"
                                  style={{ padding: '3px', color: 'var(--text-muted)', borderRadius: '6px' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />

                {/* Add Another Account */}
                <button
                  onClick={() => {
                    setShowSwitchAccountMenu(false);
                    addAccount();
                  }}
                  className="dropdown-menu-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--bg-card)',
                    color: 'var(--accent)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={15} />
                  <span>+ Add Another Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Topbar Mini-Games (Pulse Zone) Button right next to Switch Account */}
          <button
            onClick={() => setShowPulseZone(true)}
            title="Pulse Zone (Mini-Games & Leaderboard)"
            className="icon-btn-ghost"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(239, 68, 68, 0.18))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              flexShrink: 0
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Gamepad2 size={16} />
          </button>

          {/* Topbar Single 3-Dot More Menu */}
          <div style={{ position: 'relative' }} ref={topMenuRef}>
          <button
            onClick={() => setShowTopMenu(prev => !prev)}
            title="Menu & Pulse Sparks"
            className="icon-btn-ghost"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: showTopMenu ? 'var(--hover-bg)' : 'var(--bg-card)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              transition: 'all 0.2s ease'
            }}
          >
            <MoreVertical size={18} />
          </button>

          {showTopMenu && (
            <div
              className="topbar-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '270px',
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
                zIndex: 1100,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                animation: 'pulseModalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Sparks Wallet Balance Card */}
              <SidebarMenuSparksCard
                sparksBalance={user?.pulseSparks}
                onClick={() => {
                  setShowSparksWallet(true);
                  setShowTopMenu(false);
                }}
              />

              {/* Pulse VIP / Upgrade Button */}
              <SidebarMenuVipButton
                isPro={Boolean(user?.isPro)}
                onClick={() => {
                  setProModalTab('pro');
                  setShowProModal(true);
                  setShowTopMenu(false);
                }}
              />

              {/* Feature Tour Guide */}
              <SidebarMenuItem
                icon={Compass}
                iconColor="#38bdf8"
                label="Feature Tour Guide"
                onClick={() => {
                  setShowTopMenu(false);
                  setShowFeatureTourModal(true);
                }}
              />

              {/* Refer & Earn (Directly below Feature Tour Guide, heading name only, no description) */}
              <SidebarMenuItem
                icon={Sparkles}
                iconColor="#f59e0b"
                label="Refer & Earn"
                onClick={() => {
                  setShowTopMenu(false);
                  setShowReferEarnModal(true);
                }}
              />

              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

              {/* Settings & Profile */}
              <SidebarMenuItem
                icon={Settings}
                iconColor="var(--text-muted)"
                label="Settings & Profile"
                onClick={() => {
                  setShowTopMenu(false);
                  openSettingsModal && openSettingsModal();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    )}

      {/* Pulse Vibes ⚡ 24-Hour Stories Bar */}
      {!isArchivedView && (
        <PulseVibesBar
          onOpenCreateVibe={() => setShowCreateVibe(true)}
          onOpenVibeViewer={(group, allGroups) => {
            setSelectedVibeGroup(group);
            if (allGroups) setAllVibeGroups(allGroups);
          }}
          onOpenVibeSelector={() => setShowVibeSelector(true)}
          myAura={myAura}
          recentChats={recentChats}
        />
      )}

      {/* WhatsApp-Style Navigation Tabs: Chats vs Groups (Hidden in Archived View) */}
      {!isArchivedView && (
      <div
        className="sidebar-tabs"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--bg-sidebar)', touchAction: 'pan-y' }}
      >
        <button
          className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
          style={{
            flex: 1,
            padding: '0.85rem',
            background: 'transparent',
            color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.95rem',
            fontWeight: 700,
            borderBottom: activeTab === 'chats' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>CHATS</span>
          {recentChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
            <span className="unread-badge" style={{ fontSize: '0.72rem', padding: '1px 6px', height: '18px' }}>
              {recentChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
          style={{
            flex: 1,
            padding: '0.85rem 0.5rem',
            background: 'transparent',
            color: activeTab === 'groups' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderBottom: activeTab === 'groups' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>GROUPS</span>
          {groups.reduce((acc, g) => acc + (g.unreadCount || 0), 0) > 0 ? (
            <span className="unread-badge" style={{ fontSize: '0.72rem', padding: '1px 6px', height: '18px' }}>
              {groups.reduce((acc, g) => acc + (g.unreadCount || 0), 0)}
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'var(--hover-bg)', padding: '2px 7px', borderRadius: '10px', color: 'var(--text-muted)' }}>
              {groups.length}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
          style={{
            flex: 1,
            padding: '0.85rem 0.5rem',
            background: 'transparent',
            color: activeTab === 'friends' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.92rem',
            fontWeight: 700,
            borderBottom: activeTab === 'friends' ? '3px solid var(--accent)' : '3px solid transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>SYNC</span>
          {pendingRequestsCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              lineHeight: 1.2
            }}>
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>
      )}

      {/* Offline Indicator Banner — only shows "Offline mode · Waiting for network" */}
      {!isOnline && (
        <div style={{
          background: '#18181b',
          borderBottom: '1px solid rgba(234, 179, 8, 0.4)',
          color: '#facc15',
          padding: '7px 16px',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          zIndex: 50,
          position: 'relative'
        }}>
          <WifiOff size={14} color="#facc15" style={{ flexShrink: 0 }} />
          <span>Offline mode · Waiting for network</span>
        </div>
      )}

      {/* WhatsApp-Style Search Input (Hidden on Friends tab as it has its own search) */}
      {activeTab !== 'friends' && (
        <div style={{ padding: '0.65rem 1rem', background: 'var(--bg-sidebar)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isArchivedView ? "Search archived chats..." : "Search or start new chat..."}
              className="form-input input-with-icon"
              style={{ borderRadius: '24px', fontSize: '0.92rem', paddingBlock: '0.65rem' }}
            />
          </div>
        </div>
      )}

      {/* WhatsApp-Style Archived Row — positioned right below Search Input */}
      {!isArchivedView && totalArchivedCount > 0 && activeTab !== 'friends' && (
        <div
          onClick={() => {
            setSelectedChatIds([]);
            setIsArchivedView(true);
          }}
          className="interactive-tap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 16px',
            margin: '0.2rem 0.75rem 0.45rem 0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            cursor: 'pointer',
            transform: 'translateZ(0)',
            willChange: 'transform',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Archive size={19} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Archived</span>
          </div>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--accent)',
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {totalArchivedCount}
          </span>
        </div>
      )}

      {/* Enable Notification Banner — only show if not dismissed & not already granted/denied */}
      {notifPermission === 'default' && (
        <div style={{
          margin: '0.4rem 0.75rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Bell size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.25 }}>
              Enable notifications for background messages
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission(true, token);
                setNotifPermission(granted ? 'granted' : 'denied');
                if (granted) {
                  showPushNotification('PulseChat Notifications Active! 🔔', 'You will now receive message notifications outside the app.');
                }
              }}
              className="btn-primary"
              style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Allow
            </button>
            <button
              onClick={() => {
                dismissNotificationBanner();
                setNotifPermission('dismissed');
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Dismiss — won't ask again"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Chat / Group List Area with Instagram Pull-to-Refresh & Swipe Tabs */}
      <div
        ref={listContainerRef}
        onScroll={handleListScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.4rem',
          position: 'relative',
          touchAction: 'pan-y'
        }}
      >
        {/* Instagram-Style Pull-to-Refresh Spinner */}
        <div
          style={{
            height: isRefreshing ? '48px' : `${pullDistance}px`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isPulling ? 'none' : 'height 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
            pointerEvents: 'none',
            margin: (pullDistance > 8 || isRefreshing) ? '4px 0' : '0'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              transform: isRefreshing ? 'none' : `scale(${Math.min(1, Math.max(0.4, pullDistance / 40))}) rotate(${pullDistance * 5}deg)`,
              color: 'var(--accent)'
            }}
          >
            <RotateCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </div>
        </div>

        {/* SEARCH RESULTS — shown when user types in search box (works offline too) */}
        {searchQuery.trim().length > 0 ? (
          <div>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.03em' }}>
              SEARCH RESULTS
            </p>
            {searchResults.length > 0 ? (
              searchResults.map(u => {
                const searchAura = !u.isGroup ? resolveUserAura(u, vibeAuras) : null;
                return (
                <div
                  key={u.id}
                  onClick={() => u.isGroup ? handleSelectGroup(u) : handleSelectUser(u)}
                  className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                  style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                >
                  <VibeAuraRing aura={searchAura} size={48} hasCrown={Boolean(u.hasKingCrown || u.hasSilverCrown || u.hasStreakCrown)} isGroup={u.isGroup}>
                    <div
                      className={!u.isGroup ? getProAuraRingClass(searchAura, u.isPro) : ''}
                      style={{ position: 'relative', flexShrink: 0 }}
                    >
                      {!u.isGroup && u.hasKingCrown ? (
                        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                      ) : !u.isGroup && u.hasSilverCrown ? (
                        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                      ) : !u.isGroup && u.hasStreakCrown ? (
                        <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                      ) : null}
                      <img
                        src={u.avatar || (u.isGroup
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.name || 'Group')}`
                          : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`)}
                        alt="Avatar"
                        onError={(e) => {
                          e.target.src = u.isGroup
                            ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.name || 'Group')}`
                            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                        }}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: u.isGroup ? '14px' : '50%',
                          objectFit: 'cover',
                          border: !u.isGroup && u.hasKingCrown
                            ? '2.5px solid #fbbf24'
                            : !u.isGroup && u.hasSilverCrown
                            ? '2.5px solid #cbd5e1'
                            : !u.isGroup && u.hasStreakCrown
                            ? '2.5px solid #f97316'
                            : 'none'
                        }}
                      />
                      {!u.isGroup && !silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                    </div>
                  </VibeAuraRing>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>
                          {(typeof u.nickname === 'string' && u.nickname.trim()) ? (
                            <>
                              <span>{u.nickname}</span>
                              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '6px' }}>({u.displayName || u.name})</span>
                            </>
                          ) : (
                            u.displayName || u.name
                          )}
                        </span>
                        {isChatLocked(u.isGroup ? u.id : (user?.id ? [user.id, u.id].sort().join('_') : u.id)) && (
                          <span title="Locked Chat" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}>
                            🔒
                          </span>
                        )}
                        {!u.isGroup && u.isPro && (
                          <PulseVipBadge size={14} showLabel={false} />
                        )}
                      </h4>
                      {!u.isGroup && (
                        friendIdsSet.has(u.id) ? (
                          <span className="pulse-sync-btn synced" title="Pulse Frequency Synced">
                            <Sparkles size={12} /> Synced
                          </span>
                        ) : outgoingPendingIds.has(u.id) ? (
                          <button
                            type="button"
                            className="pulse-sync-btn pending"
                            onClick={(e) => handleCancelFriendRequest(e, u.id)}
                            title="Click to cancel sync request"
                            style={{ cursor: 'pointer' }}
                          >
                            <Clock size={12} /> Beaming...
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="pulse-sync-btn sync"
                            onClick={(e) => handleSendFriendRequest(e, u.id)}
                            title="Sync Pulse Frequency to connect"
                          >
                            <Sparkles size={12} /> Sync
                          </button>
                        )
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.isGroup ? (u.description || `${u.members?.length || 0} members`) : `@${u.username}`}
                    </p>
                  </div>
                </div>
              );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <Search size={36} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0 }}>No contacts found for "{searchQuery}"</p>
                {!isOnline && <p style={{ fontSize: '0.78rem', marginTop: '0.4rem', color: '#eab308' }}>You are offline — only cached contacts shown</p>}
              </div>
            )}
          </div>

        ) : isArchivedView ? (
          /* DEDICATED ARCHIVED VIEW (Shows ALL Archived Chats & Groups) */
          <div>
            {allArchivedConversations.length > 0 ? (
              allArchivedConversations.map(c => {
                const cid = c.id || c._id;
                const isSelected = selectedChatIds.includes(cid);
                const isPinned = pinnedChatIds.includes(cid);
                const isLocked = isChatLocked(c.isGroup ? cid : (user?.id ? [user.id, cid].sort().join('_') : cid));
                const isMuted = isChatMuted(c.isGroup ? cid : (user?.id ? [user.id, cid].sort().join('_') : cid));

                return (
                  <div
                    key={cid}
                    onClick={(e) => handleChatItemClick(c, c.isGroup, e)}
                    onTouchStart={(e) => handleChatTouchStart(c, e)}
                    onTouchMove={handleChatTouchMove}
                    onTouchEnd={handleChatTouchEnd}
                    onTouchCancel={handleChatTouchCancel}
                    onMouseDown={(e) => handleChatMouseDown(c, e)}
                    onMouseMove={handleChatMouseMove}
                    onMouseUp={handleChatMouseUp}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedChatIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
                    }}
                    className={`chat-item-row ${isSelected ? 'selected' : (activeChat?.id === c.id ? 'active' : '')}`}
                    style={{
                      padding: '0.85rem 0.75rem',
                      gap: '0.85rem',
                      background: isSelected ? 'rgba(99, 102, 241, 0.16)' : undefined,
                      boxShadow: isSelected ? 'inset 3px 0 0 var(--accent)' : undefined,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      touchAction: 'pan-y',
                      willChange: 'transform',
                      transform: 'translateZ(0)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.username || c.name || 'User')}`}
                        alt="Avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedChatIds.length > 0) {
                            handleChatItemClick(c, c.isGroup, e);
                            return;
                          }
                          if (!c.isGroup) handleAvatarStoryClick(e, c);
                        }}
                        onError={(e) => {
                          e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.username || c.name || 'User')}`;
                        }}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: c.isGroup ? '14px' : '50%',
                          cursor: 'pointer',
                          objectFit: 'cover'
                        }}
                      />
                      {!silentMode && onlineUsers.includes(c.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            zIndex: 15
                          }}
                        >
                          <Check size={12} strokeWidth={3.2} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: c.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{c.name || c.displayName || c.username || 'Chat'}</span>
                          {isPinned && <span title="Pinned Chat" style={{ fontSize: '0.8rem' }}>📌</span>}
                          {isLocked && <span title="Locked Chat" style={{ fontSize: '0.8rem' }}>🔒</span>}
                          {isMuted && <span title="Notifications Muted" style={{ fontSize: '0.8rem', opacity: 0.7 }}>🔕</span>}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {(c.lastMessageTimestamp || c.lastMessageTime) && (
                            <span style={{ fontSize: '0.72rem', color: c.unreadCount > 0 ? '#38bdf8' : 'var(--text-muted)', fontWeight: c.unreadCount > 0 ? 600 : 400, flexShrink: 0 }}>
                              {formatChatListTime(c.lastMessageTimestamp || c.lastMessageTime)}
                            </span>
                          )}
                          {c.unreadCount > 0 && (
                            <span className="unread-badge">{c.unreadCount}</span>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.content) || c.description || (c.isGroup ? `${c.members?.length || 0} members` : `@${c.username}`)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                <Archive size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-main)' }}>No archived chats</h4>
                <p style={{ margin: 0, fontSize: '0.84rem' }}>Hold any chat in your chat list to select and archive it.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'friends' ? (
          /* FRIENDS TAB */
          <FriendsTab
            setActiveChat={handleSelectUser}
            onRequestsCountChange={setPendingRequestsCount}
            initialSubTab={friendsSubTab}
            onOpenFullDp={onOpenFullDp}
          />

        ) : activeTab === 'groups' ? (
          /* GROUPS TAB */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.03em' }}>GROUPS ({groups.length})</p>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
              >
                + New Group
              </button>
            </div>

            {sortedGroups.length > 0 ? (
              sortedGroups.map(g => {
                const gid = g.id || g._id;
                const isPinned = pinnedChatIds.includes(gid);
                const isSelected = selectedChatIds.includes(gid);
                return (
                <div
                  key={gid}
                  onClick={(e) => handleChatItemClick(g, true, e)}
                  onTouchStart={(e) => handleChatTouchStart(g, e)}
                  onTouchMove={handleChatTouchMove}
                  onTouchEnd={handleChatTouchEnd}
                  onTouchCancel={handleChatTouchCancel}
                  onMouseDown={(e) => handleChatMouseDown(g, e)}
                  onMouseMove={handleChatMouseMove}
                  onMouseUp={handleChatMouseUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedChatIds(prev => prev.includes(gid) ? prev : [...prev, gid]);
                  }}
                  className={`chat-item-row ${isSelected ? 'selected' : (activeChat?.id === g.id ? 'active' : '')}`}
                  style={{
                    padding: '0.85rem 0.75rem',
                    gap: '0.85rem',
                    background: isSelected ? 'rgba(99, 102, 241, 0.16)' : undefined,
                    boxShadow: isSelected ? 'inset 3px 0 0 var(--accent)' : undefined,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: 'pan-y',
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={g.avatar}
                      alt="Group Avatar"
                      onError={(e) => {
                        e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(g.name || 'Group')}`;
                      }}
                      style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover' }}
                    />
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          zIndex: 5
                        }}
                      >
                        <Check size={12} strokeWidth={3.2} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: g.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>{g.name}</span>
                        {isPinned && (
                          <span title="Pinned Group" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}>
                            📌
                          </span>
                        )}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {g.unreadCount > 0 && (
                          <span className="unread-badge">
                            {g.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(typeof g.lastMessage === 'string' ? g.lastMessage : g.lastMessage?.content) || g.description || `${g.members?.length || 0} members`}
                    </p>
                  </div>
                </div>
              ); })
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <Users size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ margin: 0 }}>No groups yet.</p>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="btn-primary"
                  style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', fontSize: '0.88rem' }}
                >
                  + Create First Group
                </button>
              </div>
            )}
          </div>

        ) : (
          /* CHATS TAB */
          <div>
            {/* Recent Conversations */}
            {sortedRecentChats.length > 0 && (
              <>
                {sortedRecentChats.map(u => {
                  const friendAura = resolveUserAura(u, vibeAuras);
                  const cid = u.id || u._id;
                  const isPinned = pinnedChatIds.includes(cid);
                  const isSelected = selectedChatIds.includes(cid);
                  return (
                  <div
                    key={u.id}
                    onClick={(e) => handleChatItemClick(u, u.isGroup, e)}
                    onTouchStart={(e) => handleChatTouchStart(u, e)}
                    onTouchMove={handleChatTouchMove}
                    onTouchEnd={handleChatTouchEnd}
                    onTouchCancel={handleChatTouchCancel}
                    onMouseDown={(e) => handleChatMouseDown(u, e)}
                    onMouseMove={handleChatMouseMove}
                    onMouseUp={handleChatMouseUp}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedChatIds(prev => prev.includes(cid) ? prev : [...prev, cid]);
                    }}
                    className={`chat-item-row ${isSelected ? 'selected' : (activeChat?.id === u.id ? 'active' : '')}`}
                    style={{
                      padding: '0.85rem 0.75rem',
                      gap: '0.85rem',
                      background: isSelected ? 'rgba(99, 102, 241, 0.16)' : undefined,
                      boxShadow: isSelected ? 'inset 3px 0 0 var(--accent)' : undefined,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      touchAction: 'pan-y',
                      willChange: 'transform',
                      transform: 'translateZ(0)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <VibeAuraRing aura={friendAura} size={48} isGroup={u.isGroup} hasCrown={Boolean(u.hasKingCrown || u.hasSilverCrown || u.hasStreakCrown)}>
                      <div
                        className={!u.isGroup ? getProAuraRingClass(friendAura, u.isPro) : ''}
                        style={{ position: 'relative', flexShrink: 0 }}
                      >
                        {u.hasKingCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                        ) : u.hasSilverCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                        ) : u.hasStreakCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                        ) : null}
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`}
                          alt="Avatar"
                          onClick={(e) => {
                            if (selectedChatIds.length > 0) {
                              e.stopPropagation();
                              handleChatItemClick(u, u.isGroup);
                              return;
                            }
                            handleAvatarStoryClick(e, u);
                          }}
                          onError={(e) => {
                            e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                          }}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            objectFit: 'cover',
                            border: u.hasKingCrown
                              ? '2.5px solid #fbbf24'
                              : u.hasSilverCrown
                              ? '2.5px solid #cbd5e1'
                              : u.hasStreakCrown
                              ? '2.5px solid #f97316'
                              : 'none'
                          }}
                          title="Click to view full screen DP"
                        />
                        {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                              zIndex: 15
                            }}
                          >
                            <Check size={12} strokeWidth={3.2} />
                          </div>
                        )}
                      </div>
                    </VibeAuraRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: '1.02rem', fontWeight: u.unreadCount > 0 ? 700 : 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{(typeof u.nickname === 'string' && u.nickname.trim()) ? u.nickname : (u.displayName || u.username || 'User')}</span>
                          {isPinned && (
                            <span title="Pinned Chat" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}>
                              📌
                            </span>
                          )}
                          {u.isPro && (
                            <PulseVipBadge size={14} showLabel={false} />
                          )}
                          {u.streakCount > 0 && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.16)',
                                color: '#ff7a29',
                                border: '1px solid rgba(249, 115, 22, 0.5)',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                flexShrink: 0
                              }}
                              title={`🔥 ${u.streakCount}-day Pulse Streak!`}
                            >
                              🔥 {u.streakCount}
                            </span>
                          )}
                          {/* Locked Chat Indicator */}
                          {isChatLocked(u.isGroup ? u.id : (user?.id ? [user.id, u.id].sort().join('_') : u.id)) && (
                            <span title="Locked Chat" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}>
                              🔒
                            </span>
                          )}
                          {/* Muted Chat Indicator */}
                          {isChatMuted(u.isGroup ? u.id : (user?.id ? [user.id, u.id].sort().join('_') : u.id)) && (
                            <span title="Notifications Muted" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', opacity: 0.7 }}>
                              🔕
                            </span>
                          )}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {(u.lastMessageTimestamp || u.lastMessageTime) && (
                            <span style={{
                              fontSize: '0.72rem',
                              color: u.unreadCount > 0 ? '#38bdf8' : 'var(--text-muted)',
                              fontWeight: u.unreadCount > 0 ? 600 : 400,
                              flexShrink: 0
                            }}>
                              {formatChatListTime(u.lastMessageTimestamp || u.lastMessageTime)}
                            </span>
                          )}
                          {u.unreadCount > 0 && (
                            <span className="unread-badge">
                              {u.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{
                        fontSize: '0.84rem',
                        color: u.unreadCount > 0 ? 'var(--text-color)' : 'var(--text-muted)',
                        fontWeight: u.unreadCount > 0 ? 500 : 400,
                        margin: '2px 0 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {(() => {
                          const contactChatId = u.isGroup ? u.id : (user?.id ? [user.id, u.id].sort().join('_') : u.id);
                          const typingUser = typingMap ? typingMap[contactChatId] : null;
                          const isContactTyping = Boolean(typingUser && typingUser !== user?.username && typingUser !== user?.id);
                          if (isContactTyping) {
                            return <span style={{ color: '#22c55e', fontWeight: 600 }}>✍️ typing...</span>;
                          }

                          const isFromMe = Boolean(u.lastMessageFromMe);
                          const isContactOnline = !u.isGroup && Array.isArray(onlineUsers) && (
                            (u.id && onlineUsers.some(uid => String(uid) === String(u.id))) ||
                            (u._id && onlineUsers.some(uid => String(uid) === String(u._id))) ||
                            (u.username && onlineUsers.some(uid => String(uid).toLowerCase() === String(u.username).toLowerCase()))
                          );
                          const status = (u.lastMessageStatus === 'sent' && isContactOnline) ? 'delivered' : (u.lastMessageStatus || 'sent');

                          let statusIcon = null;
                          if (isFromMe && u.lastMessage) {
                            if (status === 'read' || status === 'seen') {
                              statusIcon = (
                                <CheckCheck
                                  size={14}
                                  style={{
                                    color: '#38bdf8',
                                    flexShrink: 0,
                                    filter: 'drop-shadow(0 0 2px rgba(56,189,248,0.5))'
                                  }}
                                />
                              );
                            } else if (status === 'delivered') {
                              statusIcon = (
                                <CheckCheck
                                  size={14}
                                  style={{
                                    color: 'var(--text-muted, #94a3b8)',
                                    flexShrink: 0
                                  }}
                                />
                              );
                            } else {
                              statusIcon = (
                                <Check
                                  size={14}
                                  style={{
                                    color: 'var(--text-muted, #94a3b8)',
                                    flexShrink: 0
                                  }}
                                />
                              );
                            }
                          }

                          let textSnippet = `@${u.username}`;
                          if (u.lastMessage) {
                            textSnippet = typeof u.lastMessage === 'string' ? u.lastMessage : (u.lastMessage.content || `@${u.username}`);
                          }

                          return (
                            <>
                              {statusIcon}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {textSnippet}
                              </span>
                            </>
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                ); })}
              </>
            )}

            {/* Contacts Section — shown when there are cached users to start a new chat */}
            {contactsNotInRecent.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: recentChats.length > 0 ? '0.75rem 0.75rem 0.5rem' : '0.5rem 0.75rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', margin: 0 }}>
                    {recentChats.length > 0 ? 'DISCOVER PULSES' : 'PULSES'}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ⚡ Sync to connect
                  </span>
                </div>
                {contactsNotInRecent.map(u => {
                  const contactAura = resolveUserAura(u, vibeAuras);
                  return (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`chat-item-row ${activeChat?.id === u.id ? 'active' : ''}`}
                    style={{ padding: '0.85rem 0.75rem', gap: '0.85rem' }}
                  >
                    <VibeAuraRing aura={contactAura} size={48} hasCrown={Boolean(u.hasKingCrown || u.hasSilverCrown || u.hasStreakCrown)}>
                      <div
                        className={getProAuraRingClass(contactAura, u.isPro)}
                        style={{ position: 'relative', flexShrink: 0 }}
                      >
                        {u.hasKingCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(245, 158, 11, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #1 Gold Leaderboard King">👑</div>
                        ) : u.hasSilverCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(203, 213, 225, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 #2 Silver Leaderboard Champion">👑</div>
                        ) : u.hasStreakCrown ? (
                          <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.1rem', filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.95))', zIndex: 10, pointerEvents: 'none' }} title="👑 7-Day Gaming Streak Crown">👑</div>
                        ) : null}
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`}
                          alt="Avatar"
                          onClick={(e) => handleAvatarStoryClick(e, u)}
                          onError={(e) => {
                            e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.displayName || 'User')}`;
                          }}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            objectFit: 'cover',
                            border: u.hasKingCrown
                              ? '2.5px solid #fbbf24'
                              : u.hasSilverCrown
                              ? '2.5px solid #cbd5e1'
                              : u.hasStreakCrown
                              ? '2.5px solid #f97316'
                              : 'none'
                          }}
                          title="Click to view full screen DP"
                        />
                        {!silentMode && onlineUsers.includes(u.id) && <div className="online-indicator-dot" style={{ width: '12px', height: '12px' }} />}
                      </div>
                    </VibeAuraRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '1.02rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{u.displayName}</span>
                          {u.isPro && (
                            <PulseVipBadge size={14} showLabel={false} />
                          )}
                        </h4>
                        {friendIdsSet.has(u.id) ? (
                          <span className="pulse-sync-btn synced" title="Pulse Frequency Synced">
                            <Sparkles size={12} /> Synced
                          </span>
                        ) : outgoingPendingIds.has(u.id) ? (
                          <button
                            type="button"
                            className="pulse-sync-btn pending"
                            onClick={(e) => handleCancelFriendRequest(e, u.id)}
                            title="Click to cancel sync request"
                            style={{ cursor: 'pointer' }}
                          >
                            <Clock size={12} /> Beaming...
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="pulse-sync-btn sync"
                            onClick={(e) => handleSendFriendRequest(e, u.id)}
                            title="Sync Pulse Frequency to connect"
                          >
                            <Sparkles size={12} /> Sync
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{u.username}
                      </p>
                    </div>
                  </div>
                );
                })}
              </>
            )}

            {/* Empty state — only if truly no data at all */}
            {recentChats.length === 0 && contactsNotInRecent.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                <p style={{ margin: 0 }}>No conversations yet.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>Type @username above to start messaging!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attractive Round Floating Neon Vibe & Aura Button (Fixed in place, never scrolls) */}
      <div className="bottom-floating-actions">
        {activeTab === 'groups' && (
          <button
            onClick={() => setShowCreateGroupModal(true)}
            title="Create New Group"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Users size={20} />
          </button>
        )}

        <button
          className="bottom-round-vibe-btn"
          onClick={() => setShowMusicPickerModal(true)}
          title={appMusicTrack ? `Background Music: ${appMusicTrack.songTitle} (${isAppMusicPlaying ? 'Playing' : 'Paused'})` : 'Background Music (Spotify-style)'}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#0d0b14',
            border: `2px solid ${isAppMusicPlaying ? '#c084fc' : 'rgba(168, 85, 247, 0.75)'}`,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
            boxShadow: isAppMusicPlaying ? '0 0 22px rgba(168, 85, 247, 0.75)' : '0 6px 18px rgba(0,0,0,0.5)'
          }}
        >
          {/* Entire circular button continuous liquid color fill & unfill animation */}
          <div className="pulse-circle-liquid-layer">
            <div className="pulse-circle-liquid-body" />
          </div>

          {/* Centered Headphones icon with crisp contrast and shadow */}
          <div style={{
            position: 'relative',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.85))'
          }}>
            <Headphones size={26} color="#ffffff" strokeWidth={2.4} />
          </div>

          {appMusicTrack && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleAppMusic();
              }}
              title={isAppMusicPlaying ? "Pause music" : "Play music"}
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                zIndex: 4,
                background: '#09090b',
                border: '1.5px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
                cursor: 'pointer'
              }}
            >
              {isAppMusicPlaying ? <Pause size={10} fill="#fff" color="#fff" /> : <Play size={10} fill="#fff" color="#fff" />}
            </div>
          )}
        </button>
      </div>

      <ModalErrorBoundary key="all_sidebar_modals_boundary" onReset={() => {
        setShowCreateGroupModal(false);
        setShowSettingsModal(false);
        setShowProModal(false);
        setShowPulseZone(false);
        setShowSparksWallet(false);
        setShowReferEarnModal(false);
        setShowVibeSelector(false);
        setShowMusicPickerModal(false);
        setShowLockPinModal(false);
      }}>
      <React.Suspense fallback={null}>
      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          preloadedUsers={allUsers}
          onGroupCreated={(newGroup) => {
            loadGroups();
            handleSelectGroup(newGroup);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          openProfileModal={openProfileModal}
          openCreateGroupModal={() => setShowCreateGroupModal(true)}
          silentMode={silentMode}
          setSilentMode={setSilentMode}
          openPanicModal={() => setShowPanicModal(true)}
          openAdminModal={() => setShowAdminModal(true)}
        />
      )}

      {showAdminModal && (
        <AdminDashboardModal onClose={() => setShowAdminModal(false)} />
      )}

      {/* Panic Wipe Modal */}
      {showPanicModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-responsive" style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ padding: '1.5rem' }}>
              <ShieldAlert size={44} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                Encrypted Panic Wipe
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Are you sure you want to trigger a local Panic Wipe? This will immediately clear all active conversations.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPanicModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={handlePanicWipe}>Wipe All</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProModal && (
        <PulseProModal
          initialTab={proModalTab}
          onClose={() => setShowProModal(false)}
        />
      )}

      {showCreateVibe && (
        <ModalErrorBoundary key="create_vibe_boundary" onReset={() => setShowCreateVibe(false)}>
          <CreateVibeModal
            onClose={() => setShowCreateVibe(false)}
            onCreated={() => {
              setShowCreateVibe(false);
              setActiveChat(null);
              setActiveTab('chats');
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
              }
            }}
          />
        </ModalErrorBoundary>
      )}

      {selectedVibeGroup && (
        <ModalErrorBoundary key="viewer_vibe_boundary" onReset={() => setSelectedVibeGroup(null)}>
          <VibeViewerModal
            vibeGroup={selectedVibeGroup}
            allGroups={allVibeGroups}
            onSwitchVibeGroup={(newGroup) => setSelectedVibeGroup(newGroup)}
            onClose={() => setSelectedVibeGroup(null)}
          />
        </ModalErrorBoundary>
      )}

      {showPulseZone && (
        <PulseZoneModal
          onClose={() => setShowPulseZone(false)}
        />
      )}

      {showFeatureTourModal && (
        <AppFeatureTourModal
          onClose={() => setShowFeatureTourModal(false)}
          onOpenPro={() => {
            setShowFeatureTourModal(false);
            setProModalTab('pro');
            setShowProModal(true);
          }}
        />
      )}

      {showSparksWallet && (
        <SparksWalletModal
          onClose={() => setShowSparksWallet(false)}
        />
      )}

      {showReferEarnModal && (
        <ReferEarnModal
          onClose={() => setShowReferEarnModal(false)}
        />
      )}

      {showVibeSelector && (
        <VibeAuraSelectorModal
          onClose={() => setShowVibeSelector(false)}
          currentAura={myAura}
        />
      )}

      {showMusicPickerModal && (
        <MusicPickerModal
          isOpen={showMusicPickerModal}
          onClose={() => setShowMusicPickerModal(false)}
          selectedSong={appMusicTrack}
          onSelectSong={(song) => {
            playAppMusicTrack(song);
            setShowMusicPickerModal(false);
          }}
        />
      )}

      {showLockPinModal && (
        <PinLockModal
          isOpen={true}
          mode="verify"
          title="Locked Chat"
          description="Enter your 4-digit PIN to open this chat"
          onSuccess={() => {
            if (pendingLockedChat) {
              if (pendingLockedChat.type === 'user') {
                proceedSelectUser(pendingLockedChat.data);
              } else {
                proceedSelectGroup(pendingLockedChat.data);
              }
              setPendingLockedChat(null);
            }
            setShowLockPinModal(false);
          }}
          onClose={() => {
            setPendingLockedChat(null);
            setShowLockPinModal(false);
          }}
          onCancel={() => {
            setPendingLockedChat(null);
            setShowLockPinModal(false);
          }}
        />
      )}

      {selectedUserForInfo && (
        <UserProfileModal
          targetUser={selectedUserForInfo}
          onClose={() => setSelectedUserForInfo(null)}
        />
      )}

      {selectedGroupForInfo && (
        <GroupProfileModal
          group={selectedGroupForInfo}
          onClose={() => setSelectedGroupForInfo(null)}
        />
      )}
      </React.Suspense>
      </ModalErrorBoundary>
    </div>
  );
}
