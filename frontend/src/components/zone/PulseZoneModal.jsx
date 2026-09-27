import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, Trophy, Gamepad2, Flame, Clock, Play, RotateCcw, Sparkles, Award } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';
import ArrowPuzzleGame from './ArrowPuzzleGame';

export default function PulseZoneModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [activeTab, setActiveTab] = useState('games'); // 'games' | 'leaderboard'
  const [selectedGame, setSelectedGame] = useState('arrow'); // 'arrow' | 'tapper'

  // Speed Tapper Game State
  const [tapperState, setTapperState] = useState('idle'); // 'idle' | 'playing' | 'ended'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [targetPos, setTargetPos] = useState({ top: '40%', left: '40%' });
  const [gameResult, setGameResult] = useState(null);

  // Leaderboard State & Daily Task
  const [leaderboard, setLeaderboard] = useState([]);
  const [dailyTask, setDailyTask] = useState(null);

  const fetchDailyTask = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/zone/daily-task`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const fetchLeaderboard = async () => {
    try {
      localStorage.removeItem('pulsechat_local_leaderboard');
    } catch (e) {}

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const serverList = await res.json();
          if (Array.isArray(serverList)) {
            setLeaderboard(serverList);
          }
        }
      } catch (e) {
        console.error('Error fetching leaderboard:', e);
      }
    }
  };

  useEffect(() => {
    fetchDailyTask();
    fetchLeaderboard();

    if (socket) {
      const handleSocketLbUpdate = (data) => {
        if (Array.isArray(data)) {
          setLeaderboard(data);
        }
      };
      socket.on('leaderboard_updated', handleSocketLbUpdate);

      return () => {
        socket.off('leaderboard_updated', handleSocketLbUpdate);
      };
    }
  }, [token, user, socket]);

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

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/game-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ gameName: 'Pulse Speed Tapper', score, level: 1 })
        });
        const data = await res.json();
        if (data.success) {
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
    fetchLeaderboard();
  };

  const handleGameScoreUpdate = async (gameName, pts, lvl = 1) => {
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/game-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ gameName, score: pts, level: lvl })
        });
        const data = await res.json();
        if (data.success) {
          if (data.newSparksBalance !== undefined && updateUserProfile) {
            updateUserProfile({ ...user, pulseSparks: data.newSparksBalance });
          }
          fetchDailyTask();
        }
      } catch (e) {}
    }
    fetchLeaderboard();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
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
                <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.78)' }}>
                  Arrow Puzzle, Mini-Games & Live Leaderboard
                </span>
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
              onClick={() => setActiveTab('games')}
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
              onClick={() => setActiveTab('leaderboard')}
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
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Daily Task & 7-Day Gaming Streak Card */}
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

            <div style={{
              fontSize: '0.78rem',
              color: dailyTask?.taskCompletedToday ? '#10b981' : '#fbbf24',
              fontWeight: 800,
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 12px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>
                {dailyTask?.taskCompletedToday
                  ? '✅ Daily Task Complete (+30⚡ Sparks Earned!)'
                  : '⚡ Play 1 game today to earn +30 Sparks & level up 7-Day Streak!'}
              </span>
              {dailyTask?.hasKingCrown && (
                <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 900 }}>
                  👑 King Crown Active!
                </span>
              )}
            </div>
          </div>

          {activeTab === 'games' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Game Selector Chips */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button
                  onClick={() => setSelectedGame('arrow')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: selectedGame === 'arrow' ? '1.5px solid #3b82f6' : '1px solid var(--border)',
                    background: selectedGame === 'arrow' ? 'rgba(37, 99, 235, 0.2)' : 'var(--bg-card)',
                    color: selectedGame === 'arrow' ? '#38bdf8' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎯 Arrow Puzzle <span style={{ fontSize: '0.65rem', background: '#3b82f6', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>HOT</span>
                </button>

                <button
                  onClick={() => setSelectedGame('tapper')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: selectedGame === 'tapper' ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    background: selectedGame === 'tapper' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
                    color: selectedGame === 'tapper' ? '#f59e0b' : 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ⚡ Speed Tapper
                </button>
              </div>

              {/* Selected Game Screen */}
              {selectedGame === 'arrow' ? (
                <ArrowPuzzleGame
                  onScoreUpdate={(gName, pts, lvl) => handleGameScoreUpdate(gName, pts, lvl)}
                />
              ) : (
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
                    <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700 }}>
                      Earn Sparks per game!
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
                        {gameResult?.rewardSparks > 0 && (
                          <div style={{ fontSize: '0.84rem', color: '#f59e0b', fontWeight: 800 }}>
                            ⚡ +{gameResult.rewardSparks} Sparks Credited!
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

          {activeTab === 'leaderboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Trophy size={16} color="#f59e0b" />
                <span>Top Pulse Champions</span>
              </div>

              {leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 15px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  🏆 No leaderboard scores submitted yet! Play mini-games to claim the #1 spot!
                </div>
              ) : (
                leaderboard.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      background: idx === 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%)' : 'var(--hover-bg)',
                      border: idx === 0 ? '1.5px solid rgba(245, 158, 11, 0.6)' : '1px solid var(--border)',
                      boxShadow: idx === 0 ? '0 4px 18px rgba(245, 158, 11, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: idx === 0 ? '#f59e0b' : (idx === 1 ? '#94a3b8' : (idx === 2 ? '#b45309' : 'var(--text-muted)')), width: '22px' }}>
                        #{idx + 1}
                      </span>

                      {/* Avatar with King Crown Overlay */}
                      <div style={{ position: 'relative' }}>
                        {item.hasKingCrown && (
                          <div style={{
                            position: 'absolute',
                            top: -12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '1.1rem',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                            zIndex: 5
                          }}>
                            👑
                          </div>
                        )}
                        <img
                          src={item.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.displayName}`}
                          alt={item.displayName}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: item.hasKingCrown ? '2px solid #fbbf24' : (idx === 0 ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)')
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.displayName}</span>
                          {idx === 0 && (
                            <span style={{ fontSize: '0.66rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.2)', padding: '1px 6px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
                              👑 #1 Champion (+100⚡)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 800, background: 'rgba(56, 189, 248, 0.15)', padding: '1px 6px', borderRadius: '6px' }}>
                            Level {item.level || 1}
                          </span>
                          <span>• {item.gamesPlayed || 1} Played</span>
                          <span>• {item.gameName}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.96rem', fontWeight: 900, color: '#10b981', display: 'block' }}>
                        {item.score} pts
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
