import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { ArrowLeft, RotateCcw, Heart, Lightbulb, Calendar, Award, Target, Sparkles, Check, Edit2, X, ChevronRight, Zap } from 'lucide-react';
import { BACKEND_URL, ADMOB_CONFIG } from '../../utils/config';
import { playSound } from '../../utils/audio';

// Web Audio API Sound Synthesizers for 0ms instant Audio Feedback
const playSwooshSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {}
};

const playBumpSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {}
};

// Direction Vectors & Smooth Flying Distances
const DIRS = {
  UP: { dr: -1, dc: 0, deg: 0, flyX: 0, flyY: -550 },
  RIGHT: { dr: 0, dc: 1, deg: 90, flyX: 550, flyY: 0 },
  DOWN: { dr: 1, dc: 0, deg: 180, flyX: 0, flyY: 550 },
  LEFT: { dr: 0, dc: -1, deg: 270, flyX: -550, flyY: 0 }
};

const DIR_KEYS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

// Scaling Grid Size, Density & Gap according to Level
const getGridConfig = (lvl) => {
  if (lvl <= 1) return { rows: 5, cols: 5, countMultiplier: 0.72, gap: '2px' };
  if (lvl <= 2) return { rows: 6, cols: 6, countMultiplier: 0.76, gap: '2px' };
  if (lvl <= 3) return { rows: 7, cols: 7, countMultiplier: 0.78, gap: '2px' };
  if (lvl <= 4) return { rows: 8, cols: 8, countMultiplier: 0.80, gap: '2px' };
  if (lvl <= 5) return { rows: 9, cols: 9, countMultiplier: 0.83, gap: '2px' };
  if (lvl <= 7) return { rows: 10, cols: 10, countMultiplier: 0.85, gap: '2px' };
  return { rows: 12, cols: 12, countMultiplier: 0.88, gap: '2px' };
};

export default function ArrowPuzzleGame({ onBack, onScoreUpdate }) {
  const { user, updateUserProfile } = useContext(AuthContext);

  // Screen view: 'main' | 'playing' | 'win' | 'gameover'
  const [screen, setScreen] = useState('main');
  const [theme, setTheme] = useState('light'); // 'light' (Notebook Paper) | 'dark' (Cyber)
  const [level, setLevel] = useState(() => {
    const saved = parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
    const maxSaved = parseInt(localStorage.getItem('pulsechat_arrow_max_level') || '1', 10);
    return Math.max(saved, maxSaved, 1);
  });
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(() => {
    const saved = parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
    const maxSaved = parseInt(localStorage.getItem('pulsechat_arrow_max_level') || '1', 10);
    return Math.max(saved, maxSaved, 1);
  });
  const [restoreNotification, setRestoreNotification] = useState('');
  const [hearts, setHearts] = useState(3);
  const [grid, setGrid] = useState([]);
  const [gridConfig, setGridConfig] = useState(() => getGridConfig(1));
  const [clearedCount, setClearedCount] = useState(0);
  const [totalArrows, setTotalArrows] = useState(0);
  const [flyingIds, setFlyingIds] = useState(new Set());
  const [clearedIds, setClearedIds] = useState(new Set());
  const [hintId, setHintId] = useState(null);
  const [shakingId, setShakingId] = useState(null);
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);

  // Rewarded Video Ad State (Watch Ad to Revive / Continue Level)
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(5);
  const [adRewardReady, setAdRewardReady] = useState(false);

  useEffect(() => {
    if (!adModalOpen) return;
    setAdSecondsLeft(5);
    setAdRewardReady(false);
    const timer = setInterval(() => {
      setAdSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAdRewardReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [adModalOpen]);

  const handleClaimRevive = () => {
    setHearts(3);
    setScreen('playing');
    setAdModalOpen(false);
    setRestoreNotification('🎉 Revived! +3 Hearts Refilled! Back in the game!');
    setTimeout(() => setRestoreNotification(''), 4500);

    const token = localStorage.getItem('pulsechat_token');
    if (token) {
      fetch(`${BACKEND_URL}/api/zone/claim-ad-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rewardType: 'revive_hearts' })
      }).catch(() => {});
    }
  };

  // Sync current saved Arrow Puzzle level on mount & auto-recover from backend if available
  useEffect(() => {
    const savedLevel = parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
    const maxLevel = parseInt(localStorage.getItem('pulsechat_arrow_max_level') || '1', 10);
    let initialBest = Math.max(savedLevel, maxLevel, 1);

    // Auto-fetch best verified score & level from backend MongoDB (authoritative)
    const token = localStorage.getItem('pulsechat_token');
    if (token) {
      fetch(`${BACKEND_URL}/api/zone/my-score`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.success) {
            const backendLvl = parseInt(data.level, 10);
            const backendMax = parseInt(data.maxUnlockedLevel || data.level, 10);
            if (!isNaN(backendMax) && backendMax >= 1) {
              setMaxUnlockedLevel(backendMax);
              try {
                localStorage.setItem('pulsechat_arrow_max_level', backendMax.toString());
              } catch (e) {}
            }
            if (!isNaN(backendLvl) && backendLvl >= 1) {
              setLevel(backendLvl);
              try {
                localStorage.setItem('pulsechat_arrow_level', backendLvl.toString());
              } catch (e) {}
            }
          }
        })
        .catch(() => {});
    }

    setLevel(initialBest);
    setMaxUnlockedLevel(initialBest);
  }, []);

  // Generate a 100% guaranteed solvable Arrow Puzzle grid
  const generatePuzzle = (lvl, isDaily = false) => {
    const config = getGridConfig(lvl);
    setGridConfig(config);
    const { rows, cols, countMultiplier } = config;

    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];
    const maxArrows = Math.floor(rows * cols * countMultiplier);
    const tailTypes = ['snake_z', 'snake_s', 'staircase', 'loop_in', 'hook_bend', 'straight'];

    // Build puzzle in reverse order (guarantees solvability)
    for (let i = 0; i < maxArrows; i++) {
      let candidateCells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c] === null) {
            DIR_KEYS.forEach(dirKey => {
              const { dr, dc } = DIRS[dirKey];
              let currR = r + dr;
              let currC = c + dc;
              let blocked = false;
              while (currR >= 0 && currR < rows && currC >= 0 && currC < cols) {
                if (board[currR][currC] !== null) {
                  blocked = true;
                  break;
                }
                currR += dr;
                currC += dc;
              }
              if (!blocked) {
                candidateCells.push({ r, c, dir: dirKey });
              }
            });
          }
        }
      }

      if (candidateCells.length === 0) break;

      const pick = candidateCells[Math.floor(Math.random() * candidateCells.length)];
      const id = `arrow_${pick.r}_${pick.c}_${Date.now()}_${Math.random()}`;
      const tailType = tailTypes[Math.floor(Math.random() * tailTypes.length)];
      const arrowObj = {
        id,
        r: pick.r,
        c: pick.c,
        dir: pick.dir,
        tailType
      };
      board[pick.r][pick.c] = arrowObj;
      placed.push(arrowObj);
    }

    setGrid(board);
    setTotalArrows(placed.length);
    setClearedCount(0);
    setFlyingIds(new Set());
    setClearedIds(new Set());
    setHearts(3);
    setHintId(null);
    setIsDailyChallenge(isDaily);
  };

  const startLevel = (lvlNum, isDaily = false) => {
    const target = Math.max(1, parseInt(lvlNum, 10) || 1);
    setLevel(target);
    setMaxUnlockedLevel(prev => {
      const newMax = Math.max(prev, target);
      try {
        localStorage.setItem('pulsechat_arrow_max_level', newMax.toString());
      } catch (e) {}
      return newMax;
    });
    try {
      localStorage.setItem('pulsechat_arrow_level', target.toString());
    } catch (e) {}
    generatePuzzle(target, isDaily);
    setScreen('playing');
    playSound('pop');
  };

  // Check if ray to boundary in arrow's direction is clear of un-cleared arrows
  const isPathClear = (r, c, dirKey, currentBoard, clearedSet, flyingSet = flyingIds) => {
    const { dr, dc } = DIRS[dirKey];
    let currR = r + dr;
    let currC = c + dc;

    while (currR >= 0 && currR < gridConfig.rows && currC >= 0 && currC < gridConfig.cols) {
      const item = currentBoard[currR][currC];
      if (item && !clearedSet.has(item.id) && !flyingSet.has(item.id)) {
        return false; // Path blocked by another real arrow!
      }
      currR += dr;
      currC += dc;
    }
    return true; // Path clear to edge!
  };

  // Handle player tapping an arrow
  const handleArrowTap = (r, c) => {
    if (screen !== 'playing') return;
    const arrow = grid[r][c];
    if (!arrow || clearedIds.has(arrow.id) || flyingIds.has(arrow.id)) return;

    if (isPathClear(r, c, arrow.dir, grid, clearedIds, flyingIds)) {
      // CLEAR! Trigger smooth flying escape animation & swoosh sound!
      playSwooshSound();

      setFlyingIds(prev => new Set([...prev, arrow.id]));

      // 800ms Ultra-Smooth Flight Duration with Blend Dissolve Fade
      setTimeout(() => {
        setClearedIds(prev => {
          const nextSet = new Set([...prev, arrow.id]);
          if (nextSet.size >= totalArrows) {
            setTimeout(() => handleWin(), 300);
          }
          return nextSet;
        });
        setFlyingIds(prev => {
          const next = new Set(prev);
          next.delete(arrow.id);
          return next;
        });
      }, 800);

      setClearedCount(prev => prev + 1);
      if (hintId === arrow.id) setHintId(null);
    } else {
      // BLOCKED! Bump thud sound & shake animation
      playBumpSound();
      setShakingId(arrow.id);
      setTimeout(() => setShakingId(null), 450);

      setHearts(prev => {
        const nextH = prev - 1;
        if (nextH <= 0) {
          setTimeout(() => setScreen('gameover'), 400);
        }
        return nextH;
      });
    }
  };

  const handleWin = () => {
    playSound('success');
    const nextLvl = level + 1;
    setLevel(nextLvl);
    setMaxUnlockedLevel(prev => {
      const newMax = Math.max(prev, nextLvl);
      try {
        localStorage.setItem('pulsechat_arrow_max_level', newMax.toString());
      } catch (e) {}
      return newMax;
    });
    try {
      localStorage.setItem('pulsechat_arrow_level', nextLvl.toString());
    } catch (e) {}

    const reward = isDailyChallenge ? 30 : 15;
    const currentSparks = user?.pulseSparks || 100;
    if (updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: currentSparks + reward });
    }
    if (onScoreUpdate) {
      onScoreUpdate('Arrow Puzzle', nextLvl * 50, nextLvl);
    }
    setScreen('win');
  };

  const handleHint = () => {
    for (let r = 0; r < gridConfig.rows; r++) {
      for (let c = 0; c < gridConfig.cols; c++) {
        const item = grid[r][c];
        if (item && !clearedIds.has(item.id) && !flyingIds.has(item.id)) {
          if (isPathClear(r, c, item.dir, grid, clearedIds)) {
            setHintId(item.id);
            playSound('pop');
            return;
          }
        }
      }
    }
  };

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div style={{
      width: '100%',
      minHeight: '440px',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
      borderRadius: '20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none'
    }}>

      {/* 1. MAIN MENU SCREEN */}
      {screen === 'main' && (
        <div style={{
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          textAlign: 'center'
        }}>
          {/* Daily Challenge Card */}
          <div style={{
            width: '100%',
            maxWidth: '320px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            borderRadius: '24px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}>
              <Calendar size={24} color="#1e3a8a" />
            </div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '1px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
              DAILY CHALLENGE
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>
              {todayStr}
            </span>
            <button
              onClick={() => startLevel(level + 5, true)}
              style={{
                marginTop: '4px',
                background: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                padding: '7px 28px',
                borderRadius: '20px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Play (+30⚡)
            </button>
          </div>

          {/* Title */}
          <div style={{ margin: '20px 0' }}>
            <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#fff', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              Arrow Puzzle
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              Tap arrows to watch them shoot off & untangle the grid!
            </p>
          </div>

          {/* Restore Notification */}
          {restoreNotification && (
            <div style={{
              width: '100%',
              maxWidth: '320px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              borderRadius: '16px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}>
              {restoreNotification}
            </div>
          )}

          {/* Buttons */}
          <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => startLevel(level)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '20px',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <span>Continue Game</span>
              <span style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 600 }}>Level {level}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. IN-GAME PLAYING SCREEN */}
      {(screen === 'playing' || screen === 'win' || screen === 'gameover') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>

          {/* Top Header Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button
              onClick={() => setScreen('main')}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                Level {level}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa' }}>
              <Award size={13} /> {level > 50 ? 'Master' : level > 20 ? 'Pro' : 'Novice'}
            </div>
          </div>

          {/* HUD Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
              <span>🚀 Remaining: {totalArrows - clearedCount}</span>
            </div>

            {/* 3 Hearts */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3].map(h => (
                <Heart
                  key={h}
                  size={20}
                  fill={h <= hearts ? '#ef4444' : 'transparent'}
                  color={h <= hearts ? '#ef4444' : 'rgba(255,255,255,0.3)'}
                />
              ))}
            </div>
          </div>

          {/* Main Arrow Board Canvas (No Boxes - Smooth Glide & Blend Dissolve) */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`,
              gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
              gap: '4px',
              width: '100%',
              maxWidth: '380px',
              aspectRatio: '1',
              background: theme === 'light'
                ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
                : 'linear-gradient(135deg, #0b1329 0%, #171e38 100%)',
              border: theme === 'light' ? '2px solid #cbd5e1' : '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '8px',
              boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.1)' : 'inset 0 0 30px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.6)',
              position: 'relative'
            }}>
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  if (!cell || clearedIds.has(cell.id)) {
                    return <div key={`${r}_${c}`} />;
                  }

                  const isFlying = flyingIds.has(cell.id);
                  const isShaking = shakingId === cell.id;
                  const isHinted = hintId === cell.id;
                  const { flyX, flyY, deg } = DIRS[cell.dir];

                  return (
                    <button
                      key={cell.id}
                      onClick={() => handleArrowTap(r, c)}
                      style={{
                        width: '100%',
                        height: '100%',
                        background: isShaking
                          ? 'rgba(239, 68, 68, 0.4)'
                          : isHinted
                          ? 'rgba(245, 158, 11, 0.35)'
                          : (theme === 'light'
                              ? 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)'
                              : 'radial-gradient(circle, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'),
                        border: isShaking
                          ? '2px solid #ef4444'
                          : isHinted
                          ? '2px solid #f59e0b'
                          : (theme === 'light' ? '1.5px solid #cbd5e1' : '1.5px solid rgba(255, 255, 255, 0.18)'),
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        position: 'relative',
                        boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.06)' : '0 4px 10px rgba(0,0,0,0.4)',
                        transform: isFlying
                          ? `translate(${flyX}px, ${flyY}px) scale(0.4)`
                          : isShaking
                          ? 'scale(0.85)'
                          : 'scale(1)',
                        opacity: isFlying ? 0 : 1,
                        filter: isFlying ? 'blur(6px)' : 'none',
                        transition: isFlying
                          ? 'transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.75s cubic-bezier(0.5, 0, 1, 1), filter 0.75s ease'
                          : 'transform 0.12s ease',
                        zIndex: isFlying ? 10 : 1
                      }}
                    >
                      {/* SVG Crisp Vector Arrow */}
                      {(() => {
                        const svgSize = gridConfig.rows >= 10 ? '22' : gridConfig.rows >= 7 ? '26' : '30';

                        const strokeColor = isShaking
                          ? '#ef4444'
                          : isHinted
                          ? '#f59e0b'
                          : (theme === 'light' ? '#1e293b' : '#38bdf8');

                        const headColor = isShaking
                          ? '#ef4444'
                          : isHinted
                          ? '#f59e0b'
                          : (theme === 'light' ? '#0f172a' : '#38bdf8');

                        return (
                          <svg
                            width={svgSize}
                            height={svgSize}
                            viewBox="0 0 40 40"
                            style={{
                              transform: `rotate(${deg}deg)`,
                              overflow: 'visible',
                              display: 'block',
                              filter: isShaking
                                ? 'drop-shadow(0 0 8px #ef4444)'
                                : isHinted
                                ? 'drop-shadow(0 0 8px #f59e0b)'
                                : 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
                            }}
                          >
                            <line x1="20" y1="36" x2="20" y2="12" stroke={strokeColor} strokeWidth="4.5" strokeLinecap="round" />
                            <polygon points="20,2 9,18 31,18" fill={headColor} />
                          </svg>
                        );
                      })()}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Game Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
            <button
              onClick={handleHint}
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1.5px solid #f59e0b',
                color: '#f59e0b',
                padding: '8px 18px',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Lightbulb size={16} /> Hint
            </button>

            <button
              onClick={() => startLevel(level, isDailyChallenge)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '16px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={15} /> Restart
            </button>
          </div>
        </div>
      )}

      {/* 3. VICTORY OVERLAY MODAL */}
      {screen === 'win' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 20
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '2px solid #3b82f6',
            borderRadius: '24px',
            padding: '28px 20px',
            textAlign: 'center',
            maxWidth: '300px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#10b981', fontWeight: 900 }}>
              🎉 Level Cleared!
            </h2>
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.86rem', color: '#94a3b8' }}>
              Awesome job untangling the arrow maze!
            </p>

            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: '14px', padding: '10px', color: '#f59e0b', fontWeight: 800, fontSize: '0.9rem', marginBottom: '20px' }}>
              ⚡ +{isDailyChallenge ? 30 : 15} Sparks Credited!
            </div>

            <button
              onClick={() => startLevel(level, isDailyChallenge)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '16px',
                background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Next Level ({level}) ➔
            </button>
          </div>
        </div>
      )}

      {/* 4. GAME OVER OVERLAY MODAL */}
      {screen === 'gameover' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 20
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '2px solid #ef4444',
            borderRadius: '24px',
            padding: '26px 20px',
            textAlign: 'center',
            maxWidth: '310px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#ef4444', fontWeight: 900 }}>
              💔 Out of Hearts!
            </h2>
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              Lost your 3 lives on this puzzle.
            </p>

            {/* Primary Action: Watch Ad to Revive & Keep Progress */}
            <button
              type="button"
              onClick={() => setAdModalOpen(true)}
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.94rem',
                cursor: 'pointer',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.45)'
              }}
            >
              <span>🎬</span> Watch Ad to Revive (+3 ❤️)
            </button>
            <div style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700, marginBottom: '16px' }}>
              ⚡ Resumes current puzzle + 15 Sparks!
            </div>

            {/* Secondary Action: Restart Level from Beginning */}
            <button
              type="button"
              onClick={() => startLevel(level, isDailyChallenge)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer'
              }}
            >
              Restart Level 🔄
            </button>
          </div>
        </div>
      )}

      {/* REWARDED VIDEO AD OVERLAY */}
      {adModalOpen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 16, 0.96)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 40
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e1e2f, #0d0d17)',
            border: '1.5px solid rgba(16, 185, 129, 0.5)',
            borderRadius: '24px',
            padding: '24px 20px',
            maxWidth: '340px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            position: 'relative'
          }}>
            {/* Ad Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '3px 8px', borderRadius: '8px', fontWeight: 800 }}>
                Pulse Arrow Revive • AdMob Rewarded
              </span>
              <span style={{ fontSize: '0.74rem', color: adRewardReady ? '#10b981' : '#f59e0b', fontWeight: 800 }}>
                {adRewardReady ? '✓ Reward Ready' : `Reward in ${adSecondsLeft}s`}
              </span>
            </div>

            {/* Ad Media Showcase Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(236, 72, 153, 0.25))',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: '22px 16px',
              marginBottom: '18px'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🚀</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#fff', fontWeight: 900 }}>
                Pulse VIP Pro
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                Unlock Unlimited 3D Text, 4K Live Wallpapers, Custom Aura Badges & 100% Ad-Free Chatting!
              </p>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
              <div style={{
                height: '100%',
                width: `${((5 - adSecondsLeft) / 5) * 100}%`,
                background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                transition: 'width 0.9s linear'
              }} />
            </div>

            {/* Claim Button */}
            {adRewardReady ? (
              <button
                type="button"
                onClick={handleClaimRevive}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)'
                }}
              >
                🎁 Claim +3 Hearts & Resume!
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                Please wait {adSecondsLeft}s to claim your reward...
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
