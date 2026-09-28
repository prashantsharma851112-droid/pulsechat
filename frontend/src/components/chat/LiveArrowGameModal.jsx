import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { X, RotateCcw, Award, Zap, Users, Swords, ShieldCheck, Sparkles, RefreshCw, Play } from 'lucide-react';
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

// Canvas Fireworks & Pataka Cracker Explosion Component
function FireworksCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const width = (canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth);
    const height = (canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight);

    let particles = [];
    const colors = [
      '#f43f5e', '#ec4899', '#d946ef', '#a855f7',
      '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
      '#10b981', '#eab308', '#f97316', '#fbbf24'
    ];

    const createExplosion = (x, y) => {
      const count = 50 + Math.floor(Math.random() * 40);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3.5 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: Math.random() * 0.014 + 0.008,
          gravity: 0.12
        });
      }
    };

    createExplosion(width / 2, height / 3);
    createExplosion(width / 4, height / 2.5);
    createExplosion((3 * width) / 4, height / 2.5);

    const interval = setInterval(() => {
      const rx = Math.random() * (width - 120) + 60;
      const ry = Math.random() * (height / 2) + 40;
      createExplosion(rx, ry);
    }, 500);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  );
}

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
  const [level, setLevel] = useState(() => parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10));
  const [grid, setGrid] = useState([]);
  const [gridRows, setGridRows] = useState(7);
  const [gridCols, setGridCols] = useState(7);
  const [totalArrows, setTotalArrows] = useState(0);

  const [myScore, setMyScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [coopScore, setCoopScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const [gameStarted, setGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null); // { title, details, isMeWinner }

  const [flyingIds, setFlyingIds] = useState(new Set());
  const [clearedIds, setClearedIds] = useState(new Set());
  const [shakingId, setShakingId] = useState(null);
  const [lastTapInfo, setLastTapInfo] = useState(null);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isGroup = !!activeChat?.isGroup;
  const myId = user?.id || user?._id || 'local';
  const partnerId = activeChat?.id || activeChat?._id || 'partner';

  const chatId = isGroup
    ? activeChat?.id
    : [myId, partnerId].sort().join('_');

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

  // Level configuration helper (Grid size, arrow density, time limit scaling)
  const getGridConfig = (lvl) => {
    if (lvl <= 1) return { rows: 6, cols: 6, density: 0.78, time: 50 };
    if (lvl <= 3) return { rows: 7, cols: 7, density: 0.82, time: 60 };
    if (lvl <= 5) return { rows: 8, cols: 8, density: 0.85, time: 75 };
    return { rows: 9, cols: 9, density: 0.88, time: 90 };
  };

  // Generate a 100% guaranteed solvable Arrow Puzzle board in reverse order
  const generateSolvableBoard = (rows = 7, cols = 7, density = 0.80) => {
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];
    const maxArrows = Math.floor(rows * cols * density);
    const tailTypes = ['curved_s', 'curved_z', 'loop_tail', 'bent_left', 'bent_right', 'wavy_long'];

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
      const tailType = tailTypes[Math.floor(Math.random() * tailTypes.length)];
      const arrowObj = { id, r: pick.r, c: pick.c, dir: pick.dir, tailType };
      board[pick.r][pick.c] = arrowObj;
      placed.push(arrowObj);
    }

    return { board, total: placed.length };
  };

  // Start new game & broadcast to socket (Wait for Start Match button to trigger timer)
  const startNewGame = (gameMode = mode, targetLevel = level) => {
    const { rows, cols, density, time } = getGridConfig(targetLevel);
    setGridRows(rows);
    setGridCols(cols);
    setLevel(targetLevel);
    localStorage.setItem('pulsechat_arrow_level', targetLevel.toString());

    const { board, total } = generateSolvableBoard(rows, cols, density);
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
    setTimeLeft(time);
    setGameStarted(false);
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
        total,
        rows,
        cols,
        level: targetLevel,
        time
      });
    }
  };

  const handleStartMatch = () => {
    setGameStarted(true);
    playSound('pop');
    if (socket && chatId) {
      socket.emit('arrow_game_match_started', { chatId });
    }
  };

  // Socket listeners for real-time multiplayer sync
  useEffect(() => {
    if (!socket || !chatId) return;

    socket.emit('join_chat', chatId);

    const handleGameStart = (data) => {
      if (data.rows && data.cols) {
        setGridRows(data.rows);
        setGridCols(data.cols);
      }
      if (data.level) {
        setLevel(data.level);
        localStorage.setItem('pulsechat_arrow_level', data.level.toString());
      }
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
      setTimeLeft(data.time || 60);
      setGameStarted(false);
      setIsGameOver(false);
      setWinner(null);
      if (data.mode) {
        setMode(data.mode);
        modeRef.current = data.mode;
      }
    };

    const handleMatchStarted = () => {
      setGameStarted(true);
    };

    const handleArrowTap = (data) => {
      setGameStarted(true);
      const { r, c, playerId, playerName, isClear, arrowId } = data;
      const isMe = playerId === myId;

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
    socket.on('arrow_game_match_started', handleMatchStarted);
    socket.on('arrow_tap', handleArrowTap);

    return () => {
      socket.off('arrow_game_start', handleGameStart);
      socket.off('arrow_game_match_started', handleMatchStarted);
      socket.off('arrow_tap', handleArrowTap);
    };
  }, [socket, chatId, myId, totalArrows]);

  // Initial local setup if board is empty
  useEffect(() => {
    if (grid.length === 0) {
      startNewGame('versus', level);
    }
  }, []);

  // Timer countdown (Only ticks when gameStarted is true!)
  useEffect(() => {
    if (!gameStarted || isGameOver || timeLeft <= 0) return;
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
  }, [gameStarted, timeLeft, isGameOver]);

  // Check if path to boundary is clear (flying arrows DO NOT block!)
  const isPathClear = (r, c, dirKey, currentBoard) => {
    const { dr, dc } = DIRS[dirKey];
    let currR = r + dr;
    let currC = c + dc;

    const clearedSet = clearedIdsRef.current;
    const flyingSet = flyingIdsRef.current;
    const rows = (currentBoard && currentBoard.length) || gridRows;
    const cols = (currentBoard && currentBoard[0] && currentBoard[0].length) || gridCols;

    while (currR >= 0 && currR < gridRows && currC >= 0 && currC < gridCols) {
      const item = currentBoard[currR][currC];
      if (item && !clearedSet.has(item.id) && !flyingSet.has(item.id)) {
        return false;
      }
      currR += dr;
      currC += dc;
    }
    return true;
  };

  // Player Taps an Arrow
  const handleTap = (r, c) => {
    if (!gameStarted) {
      handleStartMatch();
      return;
    }
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

    let winnerTitle = '';
    let winDetails = '';
    let isMeWinner = false;

    if (m === 'versus') {
      if (s1 > s2) {
        winnerTitle = `${myName} Won!`;
        winDetails = `🏆 (${s1} vs ${s2} pts)`;
        isMeWinner = true;
        const curSparks = userRef.current?.pulseSparks || 100;
        if (updateUserProfile) updateUserProfile({ ...userRef.current, pulseSparks: curSparks + 50 });
      } else if (s2 > s1) {
        winnerTitle = `${partnerName} Won!`;
        winDetails = `👑 (${s2} vs ${s1} pts)`;
        isMeWinner = false;
      } else {
        winnerTitle = `ITS A TIE!`;
        winDetails = `🤝 (${s1} pts each)`;
        isMeWinner = true;
      }
    } else {
      winnerTitle = clearedAll ? `VICTORY!` : `QUEST FINISHED`;
      winDetails = clearedAll ? `🎉 Board Cleared! Score: ${sTeam} pts` : `⏱️ Team Score: ${sTeam} pts`;
      isMeWinner = true;
      const curSparks = userRef.current?.pulseSparks || 100;
      if (updateUserProfile) updateUserProfile({ ...userRef.current, pulseSparks: curSparks + 50 });
    }

    if (isMeWinner || clearedAll) {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      localStorage.setItem('pulsechat_arrow_level', nextLvl.toString());
    }

    setWinner({ title: winnerTitle, details: winDetails, isMeWinner });

    const token = localStorage.getItem('pulsechat_token');
    const finalScore = m === 'versus' ? s1 : sTeam;
    const curLevel = parseInt(localStorage.getItem('pulsechat_arrow_level') || '1', 10);
    if (token && finalScore > 0) {
      fetch(`${BACKEND_URL}/api/zone/game-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gameName: 'Live Arrow Battle', score: finalScore, level: curLevel })
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

  const renderArrowSvg = (arrow) => {
    const tailType = arrow.tailType || 'curved_s';
    let pathD = "M 22 14 C 6 22, 38 32, 22 44";

    if (tailType === 'curved_z') {
      pathD = "M 22 14 C 38 20, 6 34, 22 44";
    } else if (tailType === 'loop_tail') {
      pathD = "M 22 14 C 38 18, 38 34, 22 30 C 10 26, 10 40, 22 44";
    } else if (tailType === 'bent_left') {
      pathD = "M 22 14 C 2 20, 6 36, 22 44";
    } else if (tailType === 'bent_right') {
      pathD = "M 22 14 C 42 20, 38 36, 22 44";
    } else if (tailType === 'wavy_long') {
      pathD = "M 22 14 C 2 22, 42 30, 22 46";
    }

    const svgSize = isMobile
      ? (gridRows >= 8 ? '24' : '28')
      : (gridRows >= 8 ? '26' : '30');

    return (
      <svg width={svgSize} height={svgSize} viewBox="0 0 44 48" style={{ overflow: 'visible' }}>
        <path d={pathD} stroke="#38bdf8" strokeWidth="3.8" strokeLinecap="round" fill="none" />
        <circle cx="22" cy="44" r="2.5" fill="#ec4899" />
        <polygon points="22,2 10,16 34,16" fill="#38bdf8" />
      </svg>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1350, padding: isMobile ? 0 : '16px' }}>
      <style>{`
        @keyframes popIn3D {
          0% { transform: perspective(600px) rotateX(25deg) scale(0.6); opacity: 0; }
          60% { transform: perspective(600px) rotateX(-8deg) scale(1.08); opacity: 1; }
          100% { transform: perspective(600px) rotateX(0deg) scale(1); opacity: 1; }
        }
        @keyframes winnerPulse3D {
          0%, 100% { transform: perspective(600px) rotateX(6deg) translateY(0px); }
          50% { transform: perspective(600px) rotateX(-4deg) translateY(-8px); }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>

      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: isMobile ? '100vw' : '540px',
          width: '100%',
          height: isMobile ? '100dvh' : 'auto',
          maxHeight: isMobile ? '100dvh' : '96dvh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? '0px' : '24px',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          border: isMobile ? 'none' : '1px solid rgba(99, 102, 241, 0.4)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.25)'
        }}
      >
        {/* Banner Header */}
        <div style={{
          padding: isMobile ? '14px 16px 10px 16px' : '16px 18px 12px 18px',
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
                <h3 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Live Arrow Battle ⚡ <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.18)', padding: '2px 8px', borderRadius: '10px' }}>Level {level}</span>
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.75)' }}>
                  Playing live with <strong>{partnerName}</strong>
                </span>
              </div>
            </div>
            <button className="icon-btn-ghost" onClick={onClose} style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: '6px' }}>
              <X size={20} />
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => startNewGame('versus', level)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'versus' ? 'linear-gradient(90deg, #ec4899, #f43f5e)' : 'transparent',
                color: mode === 'versus' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.8rem',
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
              onClick={() => startNewGame('coop', level)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'coop' ? 'linear-gradient(90deg, #3b82f6, #6366f1)' : 'transparent',
                color: mode === 'coop' ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
                fontSize: '0.8rem',
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
          color: '#fff',
          flexShrink: 0
        }}>
          {mode === 'versus' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.88rem', fontWeight: 800 }}>
              <div style={{ color: '#ec4899' }}>
                {myName}: <strong>{myScore}</strong> pts
              </div>
              <span style={{ opacity: 0.4 }}>VS</span>
              <div style={{ color: '#38bdf8' }}>
                {partnerName}: <strong>{partnerScore}</strong> pts
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Team Score: <strong>{coopScore}</strong> pts
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '3px 8px', borderRadius: '8px' }}>
              🎯 {clearedIds.size}/{totalArrows}
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 900, color: !gameStarted ? '#fbbf24' : (timeLeft <= 10 ? '#ef4444' : '#10b981') }}>
              {!gameStarted ? '⏸️ Ready' : `⏳ ${timeLeft}s`}
            </span>
            <button
              onClick={() => startNewGame(mode, level)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* Game Canvas / Grid Wrapper */}
        <div style={{
          padding: isMobile ? '10px' : '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(circle at center, #0f172a 0%, #050b18 100%)'
        }}>

          {/* Interactive Arrow Grid */}
          <div style={{
            position: 'relative',
            width: isMobile ? 'min(440px, 94vw)' : 'min(430px, 85vw)',
            height: isMobile ? 'min(440px, 94vw)' : 'min(430px, 85vw)',
            background: 'linear-gradient(135deg, #0b1329 0%, #171e38 100%)',
            borderRadius: '24px',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            padding: gridRows >= 8 ? (isMobile ? '6px' : '8px') : (isMobile ? '10px' : '12px'),
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.6)',
            display: 'grid',
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: gridRows >= 8 ? '3px' : (isMobile ? '4px' : '6px')
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
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'radial-gradient(circle, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      border: isShaking
                        ? '2px solid #ef4444'
                        : '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: gridRows >= 8 ? (isMobile ? '10px' : '12px') : (isMobile ? '14px' : '16px'),
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      position: 'relative',
                      zIndex: isFlying ? 100 : 1,
                      animation: isShaking ? 'shake 0.4s ease' : 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      overflow: 'visible',
                      ...flightStyle
                    }}
                  >
                    {renderArrowSvg(arrow)}
                  </button>
                );
              })
            )}

            {/* Ready to Start Match Banner Overlay */}
            {!gameStarted && !isGameOver && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '24px',
                color: '#fff',
                borderRadius: '24px',
                zIndex: 50
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(56, 189, 248, 0.5)'
                }}>
                  <Zap size={34} color="#fff" />
                </div>

                <h2 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: 900, textAlign: 'center' }}>
                  {mode === 'versus' ? `⚔️ 1v1 Arrow Race (Level ${level})` : `🤝 Co-Op Arrow Quest (Level ${level})`}
                </h2>

                <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: '280px' }}>
                  {gridRows}x{gridCols} Grid with {totalArrows} Tangled Curved Arrows!
                </p>

                <button
                  onClick={handleStartMatch}
                  style={{
                    padding: '14px 34px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.5)',
                    cursor: 'pointer',
                    border: 'none',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Play size={20} fill="#fff" /> START MATCH NOW
                </button>
              </div>
            )}
          </div>

          {/* Grand Celebration Winner & Fireworks Overlay */}
          {isGameOver && winner && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.94) 0%, rgba(5, 8, 22, 0.98) 100%)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '24px',
              color: '#fff',
              borderRadius: isMobile ? '0px' : '24px',
              zIndex: 100,
              animation: 'floatUp 0.3s ease-out'
            }}>
              <FireworksCanvas />

              <div style={{
                animation: 'winnerPulse3D 2.5s infinite ease-in-out',
                textAlign: 'center',
                zIndex: 20
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  boxShadow: '0 0 35px rgba(251, 191, 36, 0.8), 0 0 70px rgba(245, 158, 11, 0.4)',
                  marginBottom: '12px'
                }}>
                  <Award size={48} color="#fff" />
                </div>

                {/* 3D Extruded Glowing Winner Name */}
                <h1 style={{
                  margin: 0,
                  fontSize: isMobile ? '2.1rem' : '2.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  background: 'linear-gradient(180deg, #ffffff 0%, #fef08a 40%, #f59e0b 80%, #b45309 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0px 8px 18px rgba(245, 158, 11, 0.7))',
                  textShadow: `
                    0 1px 0 #d97706,
                    0 2px 0 #b45309,
                    0 3px 0 #92400e,
                    0 4px 0 #78350f,
                    0 5px 0 #451a03,
                    0 8px 15px rgba(0,0,0,0.8)
                  `,
                  lineHeight: 1.15
                }}>
                  👑 {winner.title} 👑
                </h1>

                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#38bdf8',
                  marginTop: '12px',
                  textShadow: '0 0 12px rgba(56, 189, 248, 0.7)'
                }}>
                  {winner.details}
                </div>

                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fbbf24',
                  marginTop: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  padding: '6px 18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(251, 191, 36, 0.3)'
                }}>
                  <Sparkles size={18} color="#fbbf24" /> Level {level} Unlocked! (+50 Sparks)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', zIndex: 20, marginTop: '16px' }}>
                <button
                  onClick={() => startNewGame(mode, level)}
                  className="btn-primary"
                  style={{
                    padding: '14px 28px',
                    borderRadius: '18px',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    boxShadow: '0 8px 30px rgba(236, 72, 153, 0.5)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Play Level {level} 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

