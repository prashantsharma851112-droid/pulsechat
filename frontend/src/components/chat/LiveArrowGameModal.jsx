import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, RotateCcw, Award, Zap, Users, Swords, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { playSound } from '../../utils/audio';
import { BACKEND_URL } from '../../utils/config';

// Web Audio API Sound Synthesizers for 0ms Instant Audio Feedback
const playSwooshSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.65);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch (e) {}
};

const playBumpSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
};

// Direction Vectors & Smooth Flying Offsets
const DIRS = {
  UP: { dr: -1, dc: 0, deg: 0, flyX: 0, flyY: -480 },
  RIGHT: { dr: 0, dc: 1, deg: 90, flyX: 480, flyY: 0 },
  DOWN: { dr: 1, dc: 0, deg: 180, flyX: 0, flyY: 480 },
  LEFT: { dr: 0, dc: -1, deg: 270, flyX: -480, flyY: 0 }
};

const DIR_KEYS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

export default function LiveArrowGameModal({ activeChat, onClose }) {
  const { user, updateUserProfile } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [mode, setMode] = useState('versus'); // 'versus' | 'coop'
  const [grid, setGrid] = useState([]);
  const [gridRows, setGridRows] = useState(7);
  const [gridCols, setGridCols] = useState(7);
  const [totalArrows, setTotalArrows] = useState(0);

  const [myScore, setMyScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [coopScore, setCoopScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const [flyingIds, setFlyingIds] = useState(new Set());
  const [clearedIds, setClearedIds] = useState(new Set());
  const [shakingId, setShakingId] = useState(null);
  const [lastTapInfo, setLastTapInfo] = useState(null);

  const chatId = activeChat?.id;
  const myId = user?.id || user?._id || 'local';
  const myName = user?.displayName || user?.username || 'You';
  const partnerName = activeChat?.displayName || activeChat?.username || 'Partner';

  const myScoreRef = useRef(0);
  const partnerScoreRef = useRef(0);
  const coopScoreRef = useRef(0);
  const modeRef = useRef('versus');
  const userRef = useRef(user);
  const clearedIdsRef = useRef(new Set());
  const flyingIdsRef = useRef(new Set());
  const gridRef = useRef([]);

  useEffect(() => { myScoreRef.current = myScore; }, [myScore]);
  useEffect(() => { partnerScoreRef.current = partnerScore; }, [partnerScore]);
  useEffect(() => { coopScoreRef.current = coopScore; }, [coopScore]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { clearedIdsRef.current = clearedIds; }, [clearedIds]);
  useEffect(() => { flyingIdsRef.current = flyingIds; }, [flyingIds]);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  // Generate a 100% guaranteed solvable Arrow Puzzle board in reverse order
  const generateSolvableBoard = (rows = 7, cols = 7, density = 0.72) => {
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];
    const maxArrows = Math.floor(rows * cols * density);

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
      const id = `arr_${pick.r}_${pick.c}_${i}`;
      const arrowObj = { id, r: pick.r, c: pick.c, dir: pick.dir };
      board[pick.r][pick.c] = arrowObj;
      placed.push(arrowObj);
    }

    return { board, total: placed.length };
  };

  // Start new game & broadcast to socket
  const startNewGame = (gameMode = mode) => {
    const { board, total } = generateSolvableBoard(7, 7, 0.72);
    setGrid(board);
    gridRef.current = board;
    setTotalArrows(total);
    setClearedIds(new Set());
    clearedIdsRef.current = new Set();
    setFlyingIds(new Set());
    flyingIdsRef.current = new Set();
    setMyScore(0);
    myScoreRef.current = 0;
    setPartnerScore(0);
    partnerScoreRef.current = 0;
    setCoopScore(0);
    coopScoreRef.current = 0;
    setTimeLeft(45);
    setIsGameOver(false);
    setWinner(null);
    setMode(gameMode);
    modeRef.current = gameMode;

    if (socket && chatId) {
      socket.emit('arrow_game_start', {
        chatId,
        hostId: myId,
        mode: gameMode,
        board,
        total
      });
    }
  };

  // Socket listeners for real-time multiplayer sync
  useEffect(() => {
    if (!socket || !chatId) return;

    socket.emit('join_chat', chatId);

    const handleGameStart = (data) => {
      setGrid(data.board);
      gridRef.current = data.board;
      setTotalArrows(data.total);
      setClearedIds(new Set());
      clearedIdsRef.current = new Set();
      setFlyingIds(new Set());
      flyingIdsRef.current = new Set();
      setMyScore(0);
      myScoreRef.current = 0;
      setPartnerScore(0);
      partnerScoreRef.current = 0;
      setCoopScore(0);
      coopScoreRef.current = 0;
      setTimeLeft(45);
      setIsGameOver(false);
      setWinner(null);
      if (data.mode) {
        setMode(data.mode);
        modeRef.current = data.mode;
      }
    };

    const handleArrowTap = (data) => {
      const { r, c, playerId, playerName, isClear, arrowId } = data;
      const isMe = playerId === myId;

      // Ignore if already cleared or flying
      if (clearedIdsRef.current.has(arrowId) || flyingIdsRef.current.has(arrowId)) return;

      if (isClear) {
        playSwooshSound();
        setFlyingIds(prev => {
          const next = new Set([...prev, arrowId]);
          flyingIdsRef.current = next;
          return next;
        });
        setLastTapInfo({ name: playerName, isMe, x: c, y: r });

        if (isMe) {
          setMyScore(prev => {
            const val = prev + 10;
            myScoreRef.current = val;
            return val;
          });
        } else {
          setPartnerScore(prev => {
            const val = prev + 10;
            partnerScoreRef.current = val;
            return val;
          });
        }
        setCoopScore(prev => {
          const val = prev + 10;
          coopScoreRef.current = val;
          return val;
        });

        setTimeout(() => {
          setClearedIds(prev => {
            const next = new Set([...prev, arrowId]);
            clearedIdsRef.current = next;
            if (next.size >= totalArrows) {
              setTimeout(() => handleFinishGame(true), 300);
            }
            return next;
          });
          setFlyingIds(prev => {
            const next = new Set(prev);
            next.delete(arrowId);
            flyingIdsRef.current = next;
            return next;
          });
        }, 800);
      } else {
        playBumpSound();
        setShakingId(arrowId);
        setTimeout(() => setShakingId(null), 450);
      }
    };

    socket.on('arrow_game_start', handleGameStart);
    socket.on('arrow_tap', handleArrowTap);

    return () => {
      socket.off('arrow_game_start', handleGameStart);
      socket.off('arrow_tap', handleArrowTap);
    };
  }, [socket, chatId, myId, totalArrows]);

  // Initial local setup if board is empty
  useEffect(() => {
    if (grid.length === 0) {
      startNewGame('versus');
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isGameOver || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleFinishGame(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isGameOver]);

  // Check if path to boundary is clear (flying arrows DO NOT block!)
  const isPathClear = (r, c, dirKey, currentBoard) => {
    const { dr, dc } = DIRS[dirKey];
    let currR = r + dr;
    let currC = c + dc;

    const clearedSet = clearedIdsRef.current;
    const flyingSet = flyingIdsRef.current;

    while (currR >= 0 && currR < gridRows && currC >= 0 && currC < gridCols) {
      const item = currentBoard[currR][currC];
      if (item && !clearedSet.has(item.id) && !flyingSet.has(item.id)) {
        return false; // Real un-cleared obstacle found!
      }
      currR += dr;
      currC += dc;
    }
    return true; // Path clear to edge!
  };

  // Player Taps an Arrow
  const handleTap = (r, c) => {
    if (isGameOver) return;
    const arrow = grid[r][c];
    if (!arrow || clearedIdsRef.current.has(arrow.id) || flyingIdsRef.current.has(arrow.id)) return;

    const clear = isPathClear(r, c, arrow.dir, grid);

    if (socket && chatId) {
      socket.emit('arrow_tap', {
        chatId,
        r,
        c,
        playerId: myId,
        playerName: myName,
        isClear: clear,
        arrowId: arrow.id
      });
    } else {
      // Local fallback
      if (clear) {
        playSwooshSound();
        setFlyingIds(prev => {
          const next = new Set([...prev, arrow.id]);
          flyingIdsRef.current = next;
          return next;
        });
        setMyScore(prev => {
          const val = prev + 10;
          myScoreRef.current = val;
          return val;
        });
        setCoopScore(prev => {
          const val = prev + 10;
          coopScoreRef.current = val;
          return val;
        });
        setTimeout(() => {
          setClearedIds(prev => {
            const next = new Set([...prev, arrow.id]);
            clearedIdsRef.current = next;
            return next;
          });
          setFlyingIds(prev => {
            const next = new Set(prev);
            next.delete(arrow.id);
            flyingIdsRef.current = next;
            return next;
          });
        }, 800);
      } else {
        playBumpSound();
        setShakingId(arrow.id);
        setTimeout(() => setShakingId(null), 450);
      }
    }
  };

  const handleFinishGame = (clearedAll = false) => {
    setIsGameOver(true);
    playSound('success');

    const m = modeRef.current;
    const s1 = myScoreRef.current;
    const s2 = partnerScoreRef.current;
    const sTeam = coopScoreRef.current;

    let winText = '';
    if (m === 'versus') {
      if (s1 > s2) {
        winText = `🎉 You Won! (${s1} vs ${s2} pts)`;
        const curSparks = userRef.current?.pulseSparks || 100;
        if (updateUserProfile) updateUserProfile({ ...userRef.current, pulseSparks: curSparks + 50 });
      } else if (s2 > s1) {
        winText = `👑 ${partnerName} Won! (${s2} vs ${s1} pts)`;
      } else {
        winText = `🤝 It's a Tie! (${s1} pts)`;
      }
    } else {
      winText = clearedAll ? `🎉 Victory! Board Cleared!` : `⏱️ Time's Up! Team Score: ${sTeam} pts`;
      const curSparks = userRef.current?.pulseSparks || 100;
      if (updateUserProfile) updateUserProfile({ ...userRef.current, pulseSparks: curSparks + 50 });
    }

    setWinner(winText);

    const token = localStorage.getItem('pulsechat_token');
    const finalScore = m === 'versus' ? s1 : sTeam;
    if (token && finalScore > 0) {
      fetch(`${BACKEND_URL}/api/zone/game-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gameName: 'Live Arrow Battle', score: finalScore })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.newSparksBalance !== undefined && updateUserProfile) {
            updateUserProfile({ ...userRef.current, pulseSparks: data.newSparksBalance });
          }
        })
        .catch(() => {});
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1350 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.25)'
        }}
      >
        {/* Banner Header */}
        <div style={{
          padding: '16px 18px 12px 18px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
              }}>
                <Zap size={22} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Live Arrow Battle ⚡ <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.18)', padding: '2px 8px', borderRadius: '10px' }}>2-Player</span>
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.75)' }}>
                  Playing live with <strong>{partnerName}</strong>
                </span>
              </div>
            </div>
            <button className="icon-btn-ghost" onClick={onClose} style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}>
              <X size={18} />
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => startNewGame('versus')}
              style={{
                flex: 1,
                padding: '7px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'versus' ? 'linear-gradient(90deg, #ec4899, #f43f5e)' : 'transparent',
                color: mode === 'versus' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Swords size={14} /> 1v1 Versus Race
            </button>
            <button
              onClick={() => startNewGame('coop')}
              style={{
                flex: 1,
                padding: '7px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'coop' ? 'linear-gradient(90deg, #3b82f6, #6366f1)' : 'transparent',
                color: mode === 'coop' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Users size={14} /> Co-Op Quest (+50⚡)
            </button>
          </div>
        </div>

        {/* Scoreboard & Timer Bar */}
        <div style={{
          padding: '10px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fff'
        }}>
          {mode === 'versus' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.86rem', fontWeight: 800 }}>
              <div style={{ color: '#ec4899' }}>
                {myName}: <strong>{myScore}</strong> pts
              </div>
              <span style={{ opacity: 0.4 }}>VS</span>
              <div style={{ color: '#38bdf8' }}>
                {partnerName}: <strong>{partnerScore}</strong> pts
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Team Score: <strong>{coopScore}</strong> pts
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: timeLeft <= 10 ? '#ef4444' : '#10b981' }}>
              ⏳ {timeLeft}s
            </span>
            <button
              onClick={() => startNewGame(mode)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* Game Canvas / Grid Wrapper */}
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

          {/* Interactive Arrow Grid */}
          <div style={{
            position: 'relative',
            width: 'min(360px, 86vw)',
            height: 'min(360px, 86vw)',
            background: 'linear-gradient(135deg, #0b1329 0%, #171e38 100%)',
            borderRadius: '20px',
            border: '2px solid rgba(255, 255, 255, 0.12)',
            padding: '8px',
            boxShadow: 'inset 0 0 25px rgba(0,0,0,0.6)',
            display: 'grid',
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: '4px'
          }}>
            {!isGameOver && grid.map((rowArr, r) =>
              rowArr.map((arrow, c) => {
                if (!arrow) {
                  return <div key={`empty_${r}_${c}`} />;
                }

                const isCleared = clearedIds.has(arrow.id);
                const isFlying = flyingIds.has(arrow.id);
                const isShaking = shakingId === arrow.id;
                const dirInfo = DIRS[arrow.dir];

                if (isCleared && !isFlying) {
                  return <div key={arrow.id} />;
                }

                // Flight vector calculation with smooth blend-dissolve
                const flightStyle = isFlying ? {
                  transform: `translate(${dirInfo.flyX}px, ${dirInfo.flyY}px) rotate(${dirInfo.deg}deg) scale(0.6)`,
                  opacity: 0,
                  filter: 'blur(6px)',
                  transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.8s ease-out, filter 0.8s ease-out'
                } : {
                  transform: `rotate(${dirInfo.deg}deg) scale(1)`,
                  opacity: 1,
                  filter: 'blur(0px)',
                  transition: 'transform 0.2s ease, opacity 0.2s ease'
                };

                return (
                  <button
                    key={arrow.id}
                    onClick={() => handleTap(r, c)}
                    disabled={isFlying || isCleared}
                    style={{
                      width: '100%',
                      height: '100%',
                      background: isShaking
                        ? 'rgba(239, 68, 68, 0.35)'
                        : 'radial-gradient(circle, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      border: isShaking
                        ? '2px solid #ef4444'
                        : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      position: 'relative',
                      zIndex: isFlying ? 100 : 1,
                      animation: isShaking ? 'shake 0.4s ease' : 'none',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                      ...flightStyle
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 40 40">
                      <line x1="20" y1="36" x2="20" y2="12" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" />
                      <polygon points="20,2 9,18 31,18" fill="#38bdf8" />
                    </svg>
                  </button>
                );
              })
            )}
          </div>

          {/* Winner / Finish Overlay */}
          {isGameOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '20px',
              color: '#fff',
              borderRadius: '24px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <Award size={46} color="#fbbf24" />
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#10b981', fontWeight: 900, textAlign: 'center' }}>
                {winner}
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#fbbf24', fontWeight: 700 }}>
                ⚡ +50 Sparks Credited!
              </p>
              <button
                onClick={() => startNewGame(mode)}
                className="btn-primary"
                style={{ marginTop: '10px', padding: '10px 24px', borderRadius: '14px', fontWeight: 800, fontSize: '0.92rem' }}
              >
                Play Next Round 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
