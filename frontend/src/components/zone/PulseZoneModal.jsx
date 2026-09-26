import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { X, Sparkles, Trophy, Gamepad2, Flame, Clock, Play, RotateCcw } from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { playSound } from '../../utils/audio';

const DEFAULT_TRIVIA = {
  id: 'daily_trivia_1',
  question: 'Which PulseChat feature helps you stay connected with friends instantly?',
  options: [
    { id: 'opt1', text: '⚡ 24h Vibe Stories', percentage: 45 },
    { id: 'opt2', text: '🎮 Pulse Zone Mini-Games', percentage: 30 },
    { id: 'opt3', text: '🔒 Quantum 256-bit Encryption', percentage: 15 },
    { id: 'opt4', text: '💎 Pulse Pro VIP Badge', percentage: 10 }
  ],
  hasVoted: false,
  votedOptionId: null
};

export default function PulseZoneModal({ onClose }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('games'); // 'games' | 'trivia' | 'leaderboard'

  // Game 1 State: Speed Tapper
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'ended'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [targetPos, setTargetPos] = useState({ top: '40%', left: '40%' });
  const [gameResult, setGameResult] = useState(null);

  // Daily Trivia State
  const [trivia, setTrivia] = useState(null);
  const [triviaMsg, setTriviaMsg] = useState('');

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchTrivia();
    fetchLeaderboard();
  }, []);

  const fetchTrivia = async () => {
    let triviaData = null;
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/daily-trivia`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) triviaData = data;
        }
      } catch (e) {}
    }

    if (!triviaData) {
      triviaData = { ...DEFAULT_TRIVIA };
      try {
        const localVote = localStorage.getItem('pulsechat_local_trivia_vote');
        if (localVote) {
          const parsed = JSON.parse(localVote);
          triviaData.hasVoted = true;
          triviaData.votedOptionId = parsed.optionId;
        }
      } catch (e) {}
    }
    setTrivia(triviaData);
  };

  const fetchLeaderboard = async () => {
    let list = [];
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) list = data;
        }
      } catch (e) {}
    }

    if (list.length === 0) {
      let localScore = 0;
      try {
        localScore = parseInt(localStorage.getItem('pulsechat_local_high_score') || '0', 10);
      } catch (e) {}

      list = [
        { id: '1', displayName: user?.displayName || user?.username || 'You', gameName: 'Pulse Speed Tapper', score: Math.max(localScore, 180), avatar: user?.avatar },
        { id: '2', displayName: 'Aarav Sharma', gameName: 'Pulse Speed Tapper', score: 160, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Aarav' },
        { id: '3', displayName: 'Priya Verma', gameName: 'Pulse Speed Tapper', score: 140, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Priya' }
      ];
    }
    setLeaderboard(list);
  };

  // Speed Tapper Game Loop
  useEffect(() => {
    let timer = null;
    if (gameState === 'playing') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(15);
    setGameResult(null);
    setGameState('playing');
    moveTarget();
    playSound('pop');
  };

  const moveTarget = () => {
    const top = Math.floor(Math.random() * 65 + 15) + '%';
    const left = Math.floor(Math.random() * 65 + 15) + '%';
    setTargetPos({ top, left });
  };

  const handleTargetTap = () => {
    if (gameState !== 'playing') return;
    setScore(s => s + 10);
    playSound('pop');
    moveTarget();
  };

  const endGame = async () => {
    setGameState('ended');
    playSound('success');

    const rewardSparks = Math.floor(score / 10);
    if (rewardSparks > 0) {
      const currentSparks = user?.pulseSparks || 100;
      if (updateUserProfile) {
        updateUserProfile({ ...user, pulseSparks: currentSparks + rewardSparks });
      }
      setGameResult({ rewardSparks, score });
    } else {
      setGameResult({ rewardSparks: 0, score });
    }

    try {
      const oldHigh = parseInt(localStorage.getItem('pulsechat_local_high_score') || '0', 10);
      if (score > oldHigh) {
        localStorage.setItem('pulsechat_local_high_score', score.toString());
      }
    } catch (e) {}

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/game-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ gameName: 'Pulse Speed Tapper', score })
        });
        const data = await res.json();
        if (data.success && data.newSparksBalance !== undefined && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.newSparksBalance });
        }
      } catch (e) {}
    }
    fetchLeaderboard();
  };

  const handleVoteTrivia = async (optionId) => {
    if (!trivia || trivia.hasVoted) return;
    playSound('pop');
    setTriviaMsg(`🎉 +20 Sparks Credited for participating!`);

    try {
      localStorage.setItem('pulsechat_local_trivia_vote', JSON.stringify({ optionId, time: Date.now() }));
    } catch (e) {}

    const currentSparks = user?.pulseSparks || 100;
    if (updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: currentSparks + 20 });
    }

    setTrivia(prev => prev ? { ...prev, hasVoted: true, votedOptionId: optionId } : prev);

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/zone/daily-trivia/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ optionId })
        });
        const data = await res.json();
        if (data.success && data.newSparksBalance !== undefined && updateUserProfile) {
          updateUserProfile({ ...user, pulseSparks: data.newSparksBalance });
        }
      } catch (e) {}
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(245, 158, 11, 0.15)'
        }}
      >
        {/* Banner Header */}
        <div style={{
          padding: '20px 20px 16px 20px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #451a03 100%)',
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
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.5)'
              }}>
                <Gamepad2 size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Pulse Zone <span style={{ color: '#fbbf24' }}>🎮</span>
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.78)' }}>
                  Solo Mini-Games, Daily Trivia & Leaderboards
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
                padding: '7px 8px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'games' ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'transparent',
                color: activeTab === 'games' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Gamepad2 size={14} /> Mini-Games
            </button>

            <button
              onClick={() => setActiveTab('trivia')}
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'trivia' ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'transparent',
                color: activeTab === 'trivia' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={14} /> Daily Trivia (+20⚡)
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'leaderboard' ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'transparent',
                color: activeTab === 'leaderboard' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Trophy size={14} /> Leaderboard
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div style={{
          padding: '18px',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {activeTab === 'games' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  height: '200px',
                  borderRadius: '16px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {gameState === 'idle' && (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                        Tap the glowing pulses as fast as you can in 15 seconds!
                      </p>
                      <button
                        onClick={startGame}
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

                  {gameState === 'playing' && (
                    <>
                      {/* Timer & Score HUD */}
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

                      {/* Tap Target */}
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

                  {gameState === 'ended' && (
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
                        onClick={startGame}
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
            </div>
          )}

          {activeTab === 'trivia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {triviaMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  textAlign: 'center'
                }}>
                  {triviaMsg}
                </div>
              )}

              {trivia && (
                <div style={{
                  background: 'var(--hover-bg)',
                  borderRadius: '18px',
                  border: '1px solid var(--border)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4 }}>
                    {trivia.question}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {trivia.options?.map(opt => {
                      const isVoted = trivia.votedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={trivia.hasVoted}
                          onClick={() => handleVoteTrivia(opt.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: isVoted ? '2px solid #10b981' : '1px solid var(--border)',
                            background: isVoted ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                            cursor: trivia.hasVoted ? 'default' : 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: isVoted ? 700 : 500, color: 'var(--text-main)' }}>
                              {opt.text}
                            </span>
                            {trivia.hasVoted && (
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>
                                {opt.percentage}%
                              </span>
                            )}
                          </div>

                          {trivia.hasVoted && (
                            <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: '4px' }}>
                              <div style={{ height: '100%', background: isVoted ? '#10b981' : 'var(--accent)', width: `${opt.percentage}%`, transition: 'width 0.4s ease' }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Trophy size={16} color="#f59e0b" />
                <span>Today's Top Pulse Champions</span>
              </div>

              {leaderboard.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    background: idx === 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--hover-bg)',
                    border: idx === 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: idx === 0 ? '#f59e0b' : 'var(--text-muted)', width: '20px' }}>
                      #{idx + 1}
                    </span>
                    <img
                      src={item.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.displayName}`}
                      alt={item.displayName}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {item.displayName}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {item.gameName}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#10b981' }}>
                    {item.score} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
