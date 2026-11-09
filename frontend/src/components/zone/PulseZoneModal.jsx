import React, { useState, useEffect, useContext, Suspense, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Trophy, Gamepad2, Flame, Clock, Play, RotateCcw, Sparkles, Award, ArrowLeft, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { useBackHandler } from '../../utils/backNavigation';
import PlayerProfileModal from './PlayerProfileModal';
import {
  recordLocalGameScore,
  syncPendingScores,
  removePendingScores,
  cacheLeaderboard,
  getCachedLeaderboard,
  formatCacheAge,
  getGamePersonalBest,
  getLocalGameBests
} from '../../utils/gameStorage';

// Core arcade games imported directly for instant offline gameplay
import ArrowPuzzleGame from './ArrowPuzzleGame';
import TicTacToeAIGame from './TicTacToeAIGame';
import OfflineWhiteboardGame from './OfflineWhiteboardGame';
const TempleRunGame = lazyWithRetry(() => import('./TempleRunGame'));
const CandyCrushGame = lazyWithRetry(() => import('./CandyCrushGame'));
const PulseChessGame = lazyWithRetry(() => import('./PulseChessGame'));
// =========================================================================
// ATOMIC ISOLATED ARCADE & LEADERBOARD COMPONENTS (React.memo + 0ms GPU Tap Feedback)
// =========================================================================

export const ZoneGameLauncherCard = React.memo(function ZoneGameLauncherCard({
  icon,
  iconBg,
  title,
  cardBg,
  cardBorder,
  cardShadow,
  onPlay
}) {
  return (
    <div
      onClick={onPlay}
      className="interactive-tap"
      style={{
        background: cardBg,
        border: cardBorder,
        borderRadius: '16px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transform: 'translateZ(0)',
        willChange: 'transform',
        transition: 'transform 0.12s cubic-bezier(0.2, 0, 0, 1), opacity 0.12s ease',
        boxShadow: cardShadow
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '13px',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <span style={{
          fontWeight: 800,
          fontSize: '0.98rem',
          color: '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        className="interactive-tap"
        style={{
          background: iconBg,
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '8px 18px',
          fontWeight: 900,
          fontSize: '0.82rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          willChange: 'transform',
          transform: 'translateZ(0)',
          flexShrink: 0
        }}
      >
        <Play size={13} fill="#fff" /> PLAY
      </button>
    </div>
  );
});

export const ZoneLeaderboardRow = React.memo(function ZoneLeaderboardRow({
  item,
  idx,
  onSelectPlayer
}) {
  const handleClick = useCallback(() => {
    const targetId = item.userId || item.id;
    if (targetId && onSelectPlayer) {
      onSelectPlayer(targetId);
    }
  }, [item.userId, item.id, onSelectPlayer]);

  const detailText = item.detail || item.gameName || 'Pulse Player';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`View gaming profile for ${item.displayName || 'player'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className="interactive-tap cursor-pointer"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: '16px',
        background: idx === 0
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%)'
          : idx === 1
          ? 'linear-gradient(135deg, rgba(203, 213, 225, 0.2) 0%, rgba(148, 163, 184, 0.1) 100%)'
          : 'var(--hover-bg)',
        contain: 'content',
        transform: 'translateZ(0)',
        willChange: 'transform',
        border: idx === 0
          ? '1.5px solid rgba(245, 158, 11, 0.6)'
          : idx === 1
          ? '1.5px solid rgba(203, 213, 225, 0.6)'
          : '1px solid var(--border)',
        boxShadow: idx === 0
          ? '0 4px 18px rgba(245, 158, 11, 0.25)'
          : idx === 1
          ? '0 4px 18px rgba(203, 213, 225, 0.25)'
          : 'none',
        gap: '10px',
        cursor: 'pointer',
        transition: 'transform 0.12s ease, background 0.12s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: '0.92rem',
          fontWeight: 900,
          color: idx === 0 ? '#f59e0b' : (idx === 1 ? '#cbd5e1' : (idx === 2 ? '#cd7f32' : 'var(--text-muted)')),
          width: '24px',
          flexShrink: 0,
          textAlign: 'center'
        }}>
          #{idx + 1}
        </span>

        {/* Avatar with King Crown (Gold) or Silver Crown Overlay */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {(item.hasKingCrown || idx === 0) ? (
            <div style={{
              position: 'absolute',
              top: -12,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '1.05rem',
              filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.95))',
              zIndex: 5
            }} title="👑 #1 Gold Champion">
              👑
            </div>
          ) : (item.hasSilverCrown || idx === 1) ? (
            <div style={{
              position: 'absolute',
              top: -12,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '1.05rem',
              filter: 'drop-shadow(0 2px 4px rgba(203, 213, 225, 0.95))',
              zIndex: 5
            }} title="👑 #2 Silver Champion">
              👑
            </div>
          ) : null}
          <img
            src={item.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.displayName}`}
            alt={item.displayName}
            loading="lazy"
            decoding="async"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: (item.hasKingCrown || idx === 0)
                ? '2px solid #fbbf24'
                : (item.hasSilverCrown || idx === 1)
                ? '2px solid #cbd5e1'
                : '1px solid rgba(255,255,255,0.2)'
            }}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {item.displayName}
          </div>
          <div style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            <span style={{ color: '#38bdf8', fontWeight: 800, background: 'rgba(56, 189, 248, 0.15)', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>
              Lv {item.level || 1}
            </span>
            <span style={{ color: '#fbbf24', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              • {detailText}
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
        <span style={{ fontSize: '0.94rem', fontWeight: 900, color: '#10b981', display: 'block', whiteSpace: 'nowrap' }}>
          {(item.score || 0).toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399' }}>pts</span>
        </span>
      </div>
    </div>
  );
});

const PulseZoneModal = React.memo(function PulseZoneModal({ onClose }) {
  useBackHandler(onClose, true);
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [activeTab, setActiveTab] = useState('games'); // 'games' | 'leaderboard'
  const [selectedGame, setSelectedGame] = useState(null); // null = games launcher hub, 'racer' | 'arrow' | 'tapper'

  // Speed Tapper Game State
  const [tapperState, setTapperState] = useState('idle'); // 'idle' | 'playing' | 'ended'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [targetPos, setTargetPos] = useState({ top: '40%', left: '40%' });
  const [gameResult, setGameResult] = useState(null);

  // Leaderboard State & Daily Task
  const [leaderboard, setLeaderboard] = useState([]);
  const [dailyTask, setDailyTask] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [leaderboardCategory, setLeaderboardCategory] = useState('all');
  const [cacheInfo, setCacheInfo] = useState({ cachedAt: null, ageMs: 0 });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localBests, setLocalBests] = useState(() => getLocalGameBests());

  const leaderboardCategoryRef = useRef(leaderboardCategory);
  leaderboardCategoryRef.current = leaderboardCategory;

  const fetchDailyTask = async () => {
    const authToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('pulsechat_token')) : null);
    if (!authToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/zone/daily-task`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDailyTask(data);
        if (data.pulseSparks !== undefined && user && updateUserProfile) {
          if (data.pulseSparks !== user.pulseSparks) {
            updateUserProfile({ ...user, pulseSparks: data.pulseSparks });
          }
        }
      }
    } catch (e) {}
  };

  const fetchLeaderboard = useCallback(async (cat = leaderboardCategoryRef.current) => {
    // 1. Instant offline cached display
    const cached = getCachedLeaderboard(cat);
    if (cached && cached.list) {
      setLeaderboard(cached.list);
      setCacheInfo({ cachedAt: cached.cachedAt, ageMs: cached.ageMs });
    }

    // 2. Fresh server fetch if online and authenticated
    const authToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('pulsechat_token')) : null);
    if (authToken && (typeof navigator === 'undefined' || navigator.onLine)) {
      setIsRefreshing(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/leaderboard?game=${cat}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const serverList = await res.json();
          if (Array.isArray(serverList)) {
            setLeaderboard(serverList);
            cacheLeaderboard(cat, serverList);
            setCacheInfo({ cachedAt: Date.now(), ageMs: 0 });
          }
        }
      } catch (e) {
        console.warn('Leaderboard fetch network notice, using cached:', e.message);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [token]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const authToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('pulsechat_token')) : null);
      if (authToken) {
        syncPendingScores(authToken).catch(() => {});
      }
      fetchLeaderboard(leaderboardCategoryRef.current);
    };
    const handleOffline = () => setIsOnline(false);
    const handleScoreUpdated = () => setLocalBests(getLocalGameBests());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pulsechat_local_score_updated', handleScoreUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pulsechat_local_score_updated', handleScoreUpdated);
    };
  }, [token, fetchLeaderboard]);

  useEffect(() => {
    fetchDailyTask();
    fetchLeaderboard(leaderboardCategory);

    if (socket) {
      const handleSocketLbUpdate = (data) => {
        const currentCat = leaderboardCategoryRef.current;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // Structured broadcast: { category, gameCategory, leaderboard, categoryLeaderboard }
          if (currentCat === 'all' && Array.isArray(data.leaderboard)) {
            setLeaderboard(data.leaderboard);
            cacheLeaderboard('all', data.leaderboard);
          } else if (data.gameCategory === currentCat && Array.isArray(data.categoryLeaderboard)) {
            setLeaderboard(data.categoryLeaderboard);
            cacheLeaderboard(currentCat, data.categoryLeaderboard);
          } else {
            // Live update for another or current game: refresh active tab data
            fetchLeaderboard(currentCat);
          }
        } else if (Array.isArray(data)) {
          if (currentCat === 'all') {
            setLeaderboard(data);
            cacheLeaderboard('all', data);
          } else {
            fetchLeaderboard(currentCat);
          }
        }
      };
      socket.on('leaderboard_updated', handleSocketLbUpdate);

      return () => {
        socket.off('leaderboard_updated', handleSocketLbUpdate);
      };
    }
  }, [token, user?.id || user?._id, socket, fetchLeaderboard]);

  // Speed Tapper Game Loop
  useEffect(() => {
    let timer = null;
    if (tapperState === 'playing') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            endTapperGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [tapperState]);

  const startTapperGame = () => {
    setScore(0);
    setTimeLeft(15);
    setGameResult(null);
    setTapperState('playing');
    moveTarget();
    playSound('pop');
  };

  const moveTarget = () => {
    const top = Math.floor(Math.random() * 65 + 15) + '%';
    const left = Math.floor(Math.random() * 65 + 15) + '%';
    setTargetPos({ top, left });
  };

  const handleTargetTap = () => {
    if (tapperState !== 'playing') return;
    setScore(s => s + 10);
    playSound('pop');
    moveTarget();
  };

  const endTapperGame = async () => {
    setTapperState('ended');
    playSound('success');

    const localRes = recordLocalGameScore({
      gameName: 'Pulse Speed Tapper',
      score,
      level: 1,
      stats: { bestScore: score }
    });
    setLocalBests(getLocalGameBests());

    if (token && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/game-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            submissionId: localRes.submissionId,
            gameName: 'Pulse Speed Tapper',
            score,
            level: 1,
            stats: { bestScore: score }
          })
        });
        const data = await res.json();
        if (data.success) {
          removePendingScores([localRes.submissionId]);
          if (data.newSparksBalance !== undefined && updateUserProfile) {
            updateUserProfile({ ...user, pulseSparks: data.newSparksBalance });
          }
          setGameResult({
            rewardSparks: data.rewardSparks,
            score,
            unlockedKingCrown: data.unlockedKingCrown
          });
          fetchDailyTask();
        }
      } catch (e) {}
    }
    fetchLeaderboard(leaderboardCategory);
  };

  const handleGameScoreUpdate = useCallback(async (gameName, pts, lvl = 1, stats = {}) => {
    // 1. Record locally first: personal best + offline sync queue
    const localRes = recordLocalGameScore({
      gameName,
      score: pts,
      level: lvl,
      stats
    });
    setLocalBests(getLocalGameBests());

    // 2. Attempt server sync if online
    if (token && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/game-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            submissionId: localRes.submissionId,
            gameName,
            score: pts,
            level: lvl,
            stats
          })
        });
        const data = await res.json();
        if (data.success) {
          removePendingScores([localRes.submissionId]);
          if (data.newSparksBalance !== undefined && updateUserProfile) {
            updateUserProfile({ ...user, pulseSparks: data.newSparksBalance });
          }
          fetchDailyTask();
        }
      } catch (e) {
        console.warn('Game score queued for background sync:', e.message);
      }
    }
    fetchLeaderboard(leaderboardCategory);
  }, [token, user, updateUserProfile, leaderboardCategory, fetchLeaderboard]);

  const handleBackFromGame = useCallback(() => setSelectedGame(null), []);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: (selectedGame === 'temple' || selectedGame === 'racer' || selectedGame === 'draw' || selectedGame === 'chess') ? '960px' : (selectedGame === 'candy' ? '580px' : (selectedPlayerId ? '580px' : '540px')),
          width: '100%',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(245, 158, 11, 0.18)'
        }}
      >
        {/* Banner Header */}
        <div style={{
          padding: '18px 18px 14px 18px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
          color: '#fff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.5)'
              }}>
                <Gamepad2 size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Pulse Zone <span style={{ color: '#fbbf24' }}>🎮</span>
                </h2>
              </div>
            </div>
            <button className="icon-btn-ghost" onClick={onClose} style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}>
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            background: 'rgba(0,0,0,0.35)',
            padding: '4px',
            borderRadius: '14px'
          }}>
            <button
              onClick={() => { setActiveTab('games'); setSelectedPlayerId(null); }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'games' ? 'linear-gradient(90deg, #2563eb, #3b82f6)' : 'transparent',
                color: activeTab === 'games' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Gamepad2 size={15} /> Mini-Games
            </button>

            <button
              onClick={() => {
                setActiveTab('leaderboard');
                setSelectedPlayerId(null);
                fetchLeaderboard(leaderboardCategoryRef.current);
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'leaderboard' ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'transparent',
                color: activeTab === 'leaderboard' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Trophy size={15} /> Leaderboard
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div style={{
          padding: '14px',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
          transform: 'translateZ(0)'
        }}>
          {/* Daily Task & 7-Day Gaming Streak Card - only when not viewing player profile */}
          {!selectedPlayerId && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(99, 102, 241, 0.12) 100%)',
              borderRadius: '18px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              padding: '14px',
              marginBottom: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={20} color="#f59e0b" />
                <span style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-main)' }}>
                  7-Day Gaming Streak Quest
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.2)', padding: '3px 10px', borderRadius: '12px' }}>
                Day {dailyTask?.streakDays || 0}/7 🔥
              </span>
            </div>

            {/* 7 Streak Day Badges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '2px 0' }}>
              {[1, 2, 3, 4, 5, 6, 7].map(day => {
                const isDone = (dailyTask?.streakDays || 0) >= day;
                const isDay7 = day === 7;
                return (
                  <div key={day} style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isDone
                        ? (isDay7 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'linear-gradient(135deg, #10b981, #059669)')
                        : 'rgba(255,255,255,0.08)',
                      border: isDay7 ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isDay7 ? '1.1rem' : '0.82rem',
                      fontWeight: 900,
                      color: '#fff',
                      boxShadow: isDone ? (isDay7 ? '0 0 12px rgba(251, 191, 36, 0.8)' : '0 0 8px rgba(16, 185, 129, 0.5)') : 'none'
                    }}>
                      {isDay7 ? '👑' : (isDone ? '✓' : day)}
                    </div>
                    <span style={{ fontSize: '0.62rem', color: isDone ? '#10b981' : 'var(--text-muted)', fontWeight: 700 }}>
                      Day {day}
                    </span>
                  </div>
                );
              })}
            </div>

            {dailyTask?.hasKingCrown && (
              <div style={{
                fontSize: '0.78rem',
                color: '#fbbf24',
                fontWeight: 900,
                background: 'rgba(0,0,0,0.3)',
                padding: '6px 12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                👑 King Crown Active!
              </div>
            )}
          </div>
          )}

          {activeTab === 'games' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* When no game is selected: Clean Arcade Launcher Cards */}
              {selectedGame === null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Arrow Puzzle Card */}
                  <ZoneGameLauncherCard
                    icon="🎯"
                    iconBg="linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    title="Arrow Puzzle"
                    cardBg="linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.14))"
                    cardBorder="1.5px solid rgba(59, 130, 246, 0.5)"
                    cardShadow="0 4px 14px rgba(59, 130, 246, 0.2)"
                    onPlay={() => setSelectedGame('arrow')}
                  />

                  {/* Temple Run Card */}
                  <ZoneGameLauncherCard
                    icon="🗿"
                    iconBg="linear-gradient(135deg, #f59e0b, #ea580c)"
                    title="Temple Run"
                    cardBg="linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.14))"
                    cardBorder="1.5px solid rgba(245, 158, 11, 0.5)"
                    cardShadow="0 4px 14px rgba(245, 158, 11, 0.18)"
                    onPlay={() => setSelectedGame('temple')}
                  />

                  {/* Candy Crush Card */}
                  <ZoneGameLauncherCard
                    icon="🍬"
                    iconBg="linear-gradient(135deg, #ec4899, #f43f5e)"
                    title="Candy Crush"
                    cardBg="linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(168, 85, 247, 0.14))"
                    cardBorder="1.5px solid rgba(236, 72, 153, 0.5)"
                    cardShadow="0 4px 14px rgba(236, 72, 153, 0.2)"
                    onPlay={() => setSelectedGame('candy')}
                  />

                  {/* 3D Chess Card */}
                  <ZoneGameLauncherCard
                    icon="♟️"
                    iconBg="linear-gradient(135deg, #f59e0b, #b45309)"
                    title="3D Chess"
                    cardBg="linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(180, 83, 9, 0.14))"
                    cardBorder="1.5px solid rgba(245, 158, 11, 0.5)"
                    cardShadow="0 4px 14px rgba(245, 158, 11, 0.2)"
                    onPlay={() => setSelectedGame('chess')}
                  />

                  {/* Speed Tapper Card */}
                  <ZoneGameLauncherCard
                    icon="⚡"
                    iconBg="linear-gradient(135deg, #f59e0b, #ef4444)"
                    title="Speed Tapper"
                    cardBg="linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.1))"
                    cardBorder="1.5px solid rgba(245, 158, 11, 0.35)"
                    cardShadow="0 4px 14px rgba(245, 158, 11, 0.12)"
                    onPlay={() => setSelectedGame('tapper')}
                  />

                  {/* Tic-Tac-Toe Card */}
                  <ZoneGameLauncherCard
                    icon={(
                      <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                        <line x1="7" y1="9" x2="19" y2="27" stroke="#38bdf8" strokeWidth="4.2" strokeLinecap="round" />
                        <line x1="19" y1="9" x2="7" y2="27" stroke="#38bdf8" strokeWidth="4.2" strokeLinecap="round" />
                        <circle cx="27" cy="18" r="7.2" stroke="#ec4899" strokeWidth="4.2" />
                      </svg>
                    )}
                    iconBg="linear-gradient(135deg, #a855f7, #6366f1)"
                    title="Tic-Tac-Toe"
                    cardBg="linear-gradient(135deg, rgba(168, 85, 247, 0.16), rgba(99, 102, 241, 0.12))"
                    cardBorder="1.5px solid rgba(168, 85, 247, 0.45)"
                    cardShadow="0 4px 14px rgba(168, 85, 247, 0.15)"
                    onPlay={() => setSelectedGame('tictactoe')}
                  />

                  {/* Whiteboard Studio Card */}
                  <ZoneGameLauncherCard
                    icon="🎨"
                    iconBg="linear-gradient(135deg, #38bdf8, #6366f1)"
                    title="Whiteboard"
                    cardBg="linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(99, 102, 241, 0.12))"
                    cardBorder="1.5px solid rgba(56, 189, 248, 0.45)"
                    cardShadow="0 4px 14px rgba(56, 189, 248, 0.16)"
                    onPlay={() => setSelectedGame('draw')}
                  />
                </div>
              ) : (
                /* When a game is selected: Top Back Bar + Active Game */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <button
                      onClick={() => setSelectedGame(null)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        color: '#fff',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ArrowLeft size={15} /> All Games
                    </button>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {selectedGame === 'candy' && <span>🍬 Candy Crush Saga</span>}
                      {selectedGame === 'temple' && <span>🗿 Temple Run 3D</span>}
                      {selectedGame === 'chess' && <span>♟️ 3D Chess</span>}
                      {selectedGame === 'arrow' && <span>🎯 Arrow Puzzle</span>}
                      {selectedGame === 'tapper' && <span>⚡ Speed Tapper</span>}
                      {selectedGame === 'tictactoe' && <span>❌⭕ Tic-Tac-Toe Arena</span>}
                      {selectedGame === 'draw' && <span>🎨 Whiteboard Studio (Offline)</span>}
                    </div>
                  </div>

                  <Suspense fallback={
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#fff', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <Loader2 size={28} className="animate-spin" color="#38bdf8" />
                      <span>Loading Game Engine...</span>
                    </div>
                  }>
                    {selectedGame === 'candy' && (
                      <CandyCrushGame
                        onScoreUpdate={handleGameScoreUpdate}
                        onBack={handleBackFromGame}
                      />
                    )}

                    {selectedGame === 'chess' && (
                      <PulseChessGame
                        onScoreUpdate={handleGameScoreUpdate}
                        onBack={handleBackFromGame}
                      />
                    )}

                    {selectedGame === 'tictactoe' && (
                      <TicTacToeAIGame
                        onScoreUpdate={handleGameScoreUpdate}
                      />
                    )}

                    {selectedGame === 'draw' && (
                      <OfflineWhiteboardGame
                        onScoreUpdate={handleGameScoreUpdate}
                        onBack={handleBackFromGame}
                      />
                    )}

                    {selectedGame === 'arrow' && (
                      <ArrowPuzzleGame
                        onScoreUpdate={handleGameScoreUpdate}
                      />
                    )}

                    {selectedGame === 'temple' && (
                      <TempleRunGame
                        onScoreUpdate={handleGameScoreUpdate}
                        onBack={handleBackFromGame}
                      />
                    )}
                  </Suspense>

                  {selectedGame === 'tapper' && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))',
                  borderRadius: '18px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Flame size={18} color="#f59e0b" />
                      <span>Pulse Speed Tapper</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>
                      Compete for #1 Rank & Crown!
                    </span>
                  </div>

                  {/* Game Canvas Box */}
                  <div style={{
                    position: 'relative',
                    height: '220px',
                    borderRadius: '16px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {tapperState === 'idle' && (
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                          Tap the glowing pulses as fast as you can in 15 seconds!
                        </p>
                        <button
                          onClick={startTapperGame}
                          className="btn-primary"
                          style={{
                            padding: '10px 24px',
                            borderRadius: '14px',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Play size={16} /> Start Game
                        </button>
                      </div>
                    )}

                    {tapperState === 'playing' && (
                      <>
                        <div style={{
                          position: 'absolute',
                          top: 10,
                          left: 12,
                          right: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          color: '#fff',
                          zIndex: 5
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                            <Clock size={14} /> {timeLeft}s
                          </span>
                          <span style={{ color: '#10b981' }}>Score: {score} pts</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleTargetTap}
                          style={{
                            position: 'absolute',
                            top: targetPos.top,
                            left: targetPos.left,
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                            border: '2px solid #fff',
                            boxShadow: '0 0 20px rgba(245, 158, 11, 0.8)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            transform: 'translate(-50%, -50%)',
                            animation: 'pulseGlow 1s infinite alternate'
                          }}
                        >
                          ⚡
                        </button>
                      </>
                    )}

                    {tapperState === 'ended' && (
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#10b981', fontWeight: 900 }}>
                          🎉 Time's Up! Final Score: {score}
                        </h3>
                        {gameResult && (
                          <div style={{ fontSize: '0.84rem', color: '#38bdf8', fontWeight: 800 }}>
                            🏆 Score Submitted to Global Leaderboard!
                          </div>
                        )}
                        <button
                          onClick={startTapperGame}
                          className="btn-primary"
                          style={{
                            marginTop: '6px',
                            padding: '8px 20px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <RotateCcw size={15} /> Play Again
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

          {activeTab === 'leaderboard' && (
            selectedPlayerId ? (
              <PlayerProfileModal
                userId={selectedPlayerId}
                onClose={() => setSelectedPlayerId(null)}
                onBack={() => setSelectedPlayerId(null)}
                token={token}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={16} color="#f59e0b" />
                    <span>Pulse Champions</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.7rem',
                    color: !isOnline ? '#f87171' : '#10b981',
                    background: !isOnline ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                    padding: '3px 9px',
                    borderRadius: '10px',
                    border: !isOnline ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {!isOnline ? (
                      <>
                        <WifiOff size={12} />
                        <span>Offline (Cached)</span>
                      </>
                    ) : (
                      <>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#10b981',
                          boxShadow: '0 0 6px #10b981',
                          display: 'inline-block'
                        }} />
                        <span style={{ fontWeight: 700 }}>Live Rankings</span>
                        <button
                          onClick={() => fetchLeaderboard(leaderboardCategoryRef.current)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '0 0 0 4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Refresh Rankings"
                        >
                          <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Game Filter Pills */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                  {[
                    { id: 'all', label: 'All Games' },
                    { id: 'temple', label: '🗿 Temple Run' },
                    { id: 'chess', label: '♟️ Chess' },
                    { id: 'arrow', label: '🎯 Arrow' },
                    { id: 'candy', label: '🍬 Candy' },
                    { id: 'tapper', label: '⚡ Tapper' },
                    { id: 'tictactoe', label: '❌ Tic-Tac-Toe' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setLeaderboardCategory(tab.id);
                        fetchLeaderboard(tab.id);
                      }}
                      style={{
                        background: leaderboardCategory === tab.id ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : 'rgba(255, 255, 255, 0.06)',
                        border: leaderboardCategory === tab.id ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: leaderboardCategory === tab.id ? '#fff' : 'var(--text-muted)',
                        borderRadius: '16px',
                        padding: '5px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 15px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                    🏆 No scores yet for this category! Play to claim the #1 spot!
                  </div>
                ) : (
                  leaderboard.map((item, idx) => (
                    <ZoneLeaderboardRow
                      key={item.id || item.userId || idx}
                      item={item}
                      idx={idx}
                      onSelectPlayer={(id) => setSelectedPlayerId(id)}
                    />
                  ))
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

export default PulseZoneModal;
