import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { ArrowLeft, RotateCcw, Sparkles, Heart, Lightbulb, Play, Calendar, Award, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { playSound } from '../../utils/audio';

// Direction vectors: [row_delta, col_delta, rotation_deg, arrow_unicode]
const DIRS = {
  UP: { dr: -1, dc: 0, deg: 0, icon: '↑' },
  RIGHT: { dr: 0, dc: 1, deg: 90, icon: '→' },
  DOWN: { dr: 1, dc: 0, deg: 180, icon: '↓' },
  LEFT: { dr: 0, dc: -1, deg: 270, icon: '←' }
};

const DIR_KEYS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

export default function ArrowPuzzleGame({ onBack, onScoreUpdate }) {
  const { user, updateUserProfile } = useContext(AuthContext);

  // Screen view: 'main' | 'playing' | 'win' | 'gameover'
  const [screen, setScreen] = useState('main');
  const [level, setLevel] = useState(() => {
    return parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
  });
  const [hearts, setHearts] = useState(3);
  const [grid, setGrid] = useState([]);
  const [gridRows, setGridRows] = useState(6);
  const [gridCols, setGridCols] = useState(6);
  const [clearedCount, setClearedCount] = useState(0);
  const [totalArrows, setTotalArrows] = useState(0);
  const [shakingId, setShakingId] = useState(null);
  const [hintId, setHintId] = useState(null);
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);

  // Generate a 100% guaranteed solvable Arrow Puzzle grid
  const generatePuzzle = (lvl, isDaily = false) => {
    const rows = 6 + Math.min(Math.floor(lvl / 10), 2); // 6x6 up to 8x8
    const cols = 6 + Math.min(Math.floor(lvl / 10), 2);
    setGridRows(rows);
    setGridCols(cols);

    // Initialize empty grid
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placedArrows = [];

    // Number of arrows to place
    const arrowCount = Math.min(16 + Math.floor(lvl * 1.5), rows * cols - 4);

    // Build puzzle in reverse order (guarantees solvability)
    for (let i = 0; i < arrowCount; i++) {
      let candidateCells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c] === null) {
            // Check available directions where exit ray is clear of CURRENT board items
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

      // Pick a random valid placement
      const pick = candidateCells[Math.floor(Math.random() * candidateCells.length)];
      const id = `arrow_${pick.r}_${pick.c}_${Date.now()}_${Math.random()}`;
      const arrowObj = {
        id,
        r: pick.r,
        c: pick.c,
        dir: pick.dir,
        cleared: false,
        flying: false
      };
      board[pick.r][pick.c] = arrowObj;
      placedArrows.push(arrowObj);
    }

    setGrid(board);
    setTotalArrows(placedArrows.length);
    setClearedCount(0);
    setHearts(3);
    setHintId(null);
    setIsDailyChallenge(isDaily);
  };

  const startLevel = (lvlNum, isDaily = false) => {
    generatePuzzle(lvlNum, isDaily);
    setScreen('playing');
    playSound('pop');
  };

  // Check if ray to boundary in arrow's direction is clear
  const isPathClear = (r, c, dirKey, currentBoard) => {
    const { dr, dc } = DIRS[dirKey];
    let currR = r + dr;
    let currC = c + dc;

    while (currR >= 0 && currR < gridRows && currC >= 0 && currC < gridCols) {
      const item = currentBoard[currR][currC];
      if (item && !item.cleared) {
        return false; // Path blocked!
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
    if (!arrow || arrow.cleared) return;

    if (isPathClear(r, c, arrow.dir, grid)) {
      // CLEAR! Animate fly-off
      playSound('pop');
      const newGrid = grid.map(row => [...row]);
      newGrid[r][c] = { ...arrow, flying: true, cleared: true };
      setGrid(newGrid);
      setClearedCount(prev => {
        const updated = prev + 1;
        if (updated >= totalArrows) {
          // Level Complete!
          setTimeout(() => handleWin(), 300);
        }
        return updated;
      });
      if (hintId === arrow.id) setHintId(null);
    } else {
      // BLOCKED! Shake tile and reduce heart
      playSound('error');
      setShakingId(arrow.id);
      setTimeout(() => setShakingId(null), 500);

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

    // Reward Sparks
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
    // Find first arrow that has a clear exit path
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const item = grid[r][c];
        if (item && !item.cleared && isPathClear(r, c, item.dir, grid)) {
          setHintId(item.id);
          playSound('pop');
          return;
        }
      }
    }
  };

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div style={{
      width: '100%',
      minHeight: '440px',
      background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
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
          <div style={{ margin: '24px 0' }}>
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#fff', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              Arrow Puzzle
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              Tap arrows to untangle & clear the maze!
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
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

          {/* HUD Bar (Target count & Hearts) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
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

          {/* Main Arrow Board Canvas */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: '6px',
              width: '100%',
              maxWidth: '340px',
              aspectRatio: '1',
              background: 'rgba(255,255,255,0.04)',
              border: '2px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '10px',
              position: 'relative'
            }}>
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  if (!cell || cell.cleared) {
                    return <div key={`${r}_${c}`} />;
                  }

                  const isShaking = shakingId === cell.id;
                  const isHinted = hintId === cell.id;

                  return (
                    <button
                      key={cell.id}
                      onClick={() => handleArrowTap(r, c)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '12px',
                        background: isHinted
                          ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                          : isShaking
                          ? '#ef4444'
                          : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        border: isHinted ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                        color: '#fff',
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isHinted ? '0 0 15px #f59e0b' : '0 4px 10px rgba(0,0,0,0.3)',
                        transform: `rotate(${DIRS[cell.dir].deg}deg) ${isShaking ? 'scale(0.9)' : 'scale(1)'}`,
                        transition: 'transform 0.15s ease, background 0.15s ease'
                      }}
                    >
                      <span style={{ transform: 'translateY(-2px)' }}>↑</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Game Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
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
          background: 'rgba(15, 23, 42, 0.92)',
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
          background: 'rgba(15, 23, 42, 0.92)',
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
