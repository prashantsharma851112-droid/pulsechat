import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { ArrowLeft, RotateCcw, Heart, Lightbulb, Calendar, Award } from 'lucide-react';
import { playSound } from '../../utils/audio';

// Web Audio API Sound Synthesizers for 0ms instant Audio Feedback
const playSwooshSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
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

// Direction Vectors & Rotations
const DIRS = {
  UP: { dr: -1, dc: 0, deg: 0, flyX: 0, flyY: -450 },
  RIGHT: { dr: 0, dc: 1, deg: 90, flyX: 450, flyY: 0 },
  DOWN: { dr: 1, dc: 0, deg: 180, flyX: 0, flyY: 450 },
  LEFT: { dr: 0, dc: -1, deg: 270, flyX: -450, flyY: 0 }
};

const DIR_KEYS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

// Scaling Grid Size, Density & Gap according to Level
const getGridConfig = (lvl) => {
  if (lvl <= 2) return { rows: 6, cols: 6, countMultiplier: 0.55, gap: '3px' };
  if (lvl <= 5) return { rows: 7, cols: 7, countMultiplier: 0.68, gap: '2.5px' };
  if (lvl <= 12) return { rows: 8, cols: 8, countMultiplier: 0.78, gap: '2px' };
  if (lvl <= 25) return { rows: 9, cols: 9, countMultiplier: 0.84, gap: '1.5px' };
  if (lvl <= 50) return { rows: 10, cols: 10, countMultiplier: 0.88, gap: '1px' };
  return { rows: 11, cols: 11, countMultiplier: 0.92, gap: '1px' };
};

export default function ArrowPuzzleGame({ onBack, onScoreUpdate }) {
  const { user, updateUserProfile } = useContext(AuthContext);

  // Screen view: 'main' | 'playing' | 'win' | 'gameover'
  const [screen, setScreen] = useState('main');
  const [level, setLevel] = useState(() => {
    return parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
  });
  const [hearts, setHearts] = useState(3);
  const [grid, setGrid] = useState([]);
  const [gridConfig, setGridConfig] = useState(() => getGridConfig(1));
  const [clearedCount, setClearedCount] = useState(0);
  const [totalArrows, setTotalArrows] = useState(0);
  const [flyingIds, setFlyingIds] = useState(new Set());
  const [clearedIds, setClearedIds] = useState(new Set());
  const [shakingId, setShakingId] = useState(null);
  const [hintId, setHintId] = useState(null);
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);

  // Generate a 100% guaranteed solvable Arrow Puzzle grid
  const generatePuzzle = (lvl, isDaily = false) => {
    const config = getGridConfig(lvl);
    setGridConfig(config);
    const { rows, cols, countMultiplier } = config;

    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];
    const maxArrows = Math.floor(rows * cols * countMultiplier);

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
      const arrowObj = {
        id,
        r: pick.r,
        c: pick.c,
        dir: pick.dir
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
    generatePuzzle(lvlNum, isDaily);
    setScreen('playing');
    playSound('pop');
  };

  // Check if ray to boundary in arrow's direction is clear of un-cleared arrows
  const isPathClear = (r, c, dirKey, currentBoard, clearedSet) => {
    const { dr, dc } = DIRS[dirKey];
    let currR = r + dr;
    let currC = c + dc;

    while (currR >= 0 && currR < gridConfig.rows && currC >= 0 && currC < gridConfig.cols) {
      const item = currentBoard[currR][currC];
      if (item && !clearedSet.has(item.id)) {
        return false; // Path blocked by another arrow!
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

    if (isPathClear(r, c, arrow.dir, grid, clearedIds)) {
      // CLEAR! Trigger flying escape animation & swoosh sound!
      playSwooshSound();

      setFlyingIds(prev => new Set([...prev, arrow.id]));

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
      }, 320);

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
    try {
      localStorage.setItem('pulsechat_arrow_level', nextLvl.toString());
    } catch (e) {}

    const reward = isDailyChallenge ? 30 : 15;
    const currentSparks = user?.pulseSparks || 100;
    if (updateUserProfile) {
      updateUserProfile({ ...user, pulseSparks: currentSparks + reward });
    }
    if (onScoreUpdate) {
      onScoreUpdate('Arrow Puzzle', nextLvl * 50);
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

            <button
              onClick={() => startLevel(1)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Restart Game (Level 1)
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

            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
              Level {level}
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

          {/* Main Arrow Board Canvas (No Boxes - Pure Crisp Arrows) */}
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
              gap: gridConfig.gap,
              width: '100%',
              maxWidth: '360px',
              aspectRatio: '1',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1.5px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '8px',
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
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: isFlying
                          ? `translate(${flyX}px, ${flyY}px) scale(0.6)`
                          : isShaking
                          ? 'scale(0.85)'
                          : 'scale(1)',
                        opacity: isFlying ? 0 : 1,
                        transition: isFlying
                          ? 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease'
                          : 'transform 0.12s ease',
                        position: 'relative',
                        zIndex: isFlying ? 10 : 1
                      }}
                    >
                      {/* SVG Crisp Vector Arrow (NO SQUARE BOX) */}
                      <svg
                        viewBox="0 0 40 40"
                        style={{
                          width: '85%',
                          height: '85%',
                          transform: `rotate(${deg}deg)`,
                          filter: isHinted
                            ? 'drop-shadow(0 0 8px #f59e0b)'
                            : isShaking
                            ? 'drop-shadow(0 0 8px #ef4444)'
                            : 'drop-shadow(0 0 3px rgba(56, 189, 248, 0.4))'
                        }}
                      >
                        {/* Arrow Line Shaft */}
                        <line
                          x1="20"
                          y1="34"
                          x2="20"
                          y2="10"
                          stroke={isHinted ? '#f59e0b' : isShaking ? '#ef4444' : '#38bdf8'}
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        {/* Arrow Head Triangle */}
                        <polygon
                          points="20,4 10,18 30,18"
                          fill={isHinted ? '#f59e0b' : isShaking ? '#ef4444' : '#38bdf8'}
                        />
                      </svg>
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
            padding: '28px 20px',
            textAlign: 'center',
            maxWidth: '300px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#ef4444', fontWeight: 900 }}>
              💔 Out of Hearts!
            </h2>
            <p style={{ margin: '8px 0 20px 0', fontSize: '0.86rem', color: '#94a3b8' }}>
              Be careful not to tap blocked arrows!
            </p>

            <button
              onClick={() => startLevel(level, isDailyChallenge)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '16px',
                background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Try Again 🔄
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
