import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Trophy, Sparkles, Star, ArrowLeft, Zap, Award, Flame } from 'lucide-react';

// Web Audio API Synthesizers (100% Offline Sound Engine)
class CandyAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playPop(combo = 1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const freqs = [330, 392, 494, 587, 659, 784, 880, 1046];
      const baseFreq = freqs[Math.min(combo - 1, freqs.length - 1)] || 440;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  playSwap() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  }

  playReject() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  playSpecialCreate() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const notes = [587, 740, 880, 1174];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.2);
      });
    } catch (e) {}
  }

  playSpecialBlast() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      // White noise blast
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.25);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  }

  playComboFanfare(level = 1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const chords = [
        [523.25, 659.25, 783.99],          // C major
        [587.33, 739.99, 880.00],          // D major
        [659.25, 830.61, 987.77],          // E major
        [783.99, 987.77, 1174.66, 1567.98] // G majestic
      ];
      const selected = chords[Math.min(level - 1, chords.length - 1)] || chords[0];
      selected.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      });
    } catch (e) {}
  }

  playWinFanfare() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } catch (e) {}
  }
}

const soundEngine = new CandyAudio();

const GRID_SIZE = 8;

// 6 Candy Types with vibrant gradients & distinct shapes
const CANDY_TYPES = [
  { id: 'red', name: 'Jelly Bean', color: '#ef4444', gradient: 'linear-gradient(135deg, #f87171, #dc2626)', shadow: 'rgba(239, 68, 68, 0.6)' },
  { id: 'orange', name: 'Orange Fizz', color: '#f97316', gradient: 'linear-gradient(135deg, #fb923c, #ea580c)', shadow: 'rgba(249, 115, 22, 0.6)' },
  { id: 'yellow', name: 'Lemon Drop', color: '#eab308', gradient: 'linear-gradient(135deg, #fde047, #ca8a04)', shadow: 'rgba(234, 179, 8, 0.6)' },
  { id: 'green', name: 'Green Apple', color: '#10b981', gradient: 'linear-gradient(135deg, #34d399, #059669)', shadow: 'rgba(16, 185, 129, 0.6)' },
  { id: 'blue', name: 'Blue Lollipop', color: '#3b82f6', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)', shadow: 'rgba(59, 130, 246, 0.6)' },
  { id: 'purple', name: 'Grape Cluster', color: '#a855f7', gradient: 'linear-gradient(135deg, #c084fc, #9333ea)', shadow: 'rgba(168, 85, 247, 0.6)' }
];

// Target Score & Moves calculation for each Level
const getLevelConfig = (lvl) => {
  const target = Math.round(1500 * Math.pow(1.5, lvl - 1));
  const moves = Math.max(16, 26 - (lvl - 1));
  return { level: lvl, targetScore: target, moves };
};

// Generates a random candy
let candyCounter = 0;
const createRandomCandy = (excludedTypes = []) => {
  const available = CANDY_TYPES.filter(t => !excludedTypes.includes(t.id));
  const pick = available[Math.floor(Math.random() * available.length)] || CANDY_TYPES[0];
  candyCounter += 1;
  return {
    id: candyCounter,
    type: pick.id,
    special: null // null | 'striped_h' | 'striped_v' | 'wrapped' | 'color_bomb'
  };
};

// Create a full board with no initial 3-in-a-row matches
const createInitialBoard = () => {
  const board = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const excluded = [];
      if (c >= 2 && row[c - 1]?.type === row[c - 2]?.type) {
        excluded.push(row[c - 1].type);
      }
      if (r >= 2 && board[r - 1][c]?.type === board[r - 2][c]?.type) {
        excluded.push(board[r - 1][c].type);
      }
      row.push(createRandomCandy(excluded));
    }
    board.push(row);
  }
  return board;
};

// Find all matches on board
const findMatches = (board) => {
  const matchedCoords = new Set();
  const matchGroups = [];

  // Horizontal match check
  for (let r = 0; r < GRID_SIZE; r++) {
    let matchLen = 1;
    for (let c = 0; c < GRID_SIZE; c++) {
      const current = board[r][c];
      const next = c + 1 < GRID_SIZE ? board[r][c + 1] : null;

      if (current && next && current.type === next.type && current.type !== 'color_bomb') {
        matchLen += 1;
      } else {
        if (matchLen >= 3) {
          const group = [];
          for (let i = 0; i < matchLen; i++) {
            const col = c - i;
            matchedCoords.add(`${r},${col}`);
            group.push({ r, c: col, candy: board[r][col] });
          }
          matchGroups.push({ type: 'h', length: matchLen, group, candyType: board[r][c].type });
        }
        matchLen = 1;
      }
    }
  }

  // Vertical match check
  for (let c = 0; c < GRID_SIZE; c++) {
    let matchLen = 1;
    for (let r = 0; r < GRID_SIZE; r++) {
      const current = board[r][c];
      const next = r + 1 < GRID_SIZE ? board[r + 1][c] : null;

      if (current && next && current.type === next.type && current.type !== 'color_bomb') {
        matchLen += 1;
      } else {
        if (matchLen >= 3) {
          const group = [];
          for (let i = 0; i < matchLen; i++) {
            const row = r - i;
            matchedCoords.add(`${row},${c}`);
            group.push({ r: row, c, candy: board[row][c] });
          }
          matchGroups.push({ type: 'v', length: matchLen, group, candyType: board[r][c].type });
        }
        matchLen = 1;
      }
    }
  }

  return { matchedCoords, matchGroups };
};

// Check if any valid move exists on the current board
const hasValidMoves = (board) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const directions = [[0, 1], [1, 0]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < GRID_SIZE && nc < GRID_SIZE) {
          // If either candy is color bomb, it's always valid!
          if (board[r][c]?.type === 'color_bomb' || board[nr][nc]?.type === 'color_bomb') return true;

          // Swap and test
          const copy = board.map(row => [...row]);
          const temp = copy[r][c];
          copy[r][c] = copy[nr][nc];
          copy[nr][nc] = temp;

          const { matchedCoords } = findMatches(copy);
          if (matchedCoords.size > 0) return true;
        }
      }
    }
  }
  return false;
};

// Find one valid move for hint
const findHintMove = (board) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const directions = [[0, 1], [1, 0]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < GRID_SIZE && nc < GRID_SIZE) {
          if (board[r][c]?.type === 'color_bomb' || board[nr][nc]?.type === 'color_bomb') {
            return [{ r, c }, { r: nr, c: nc }];
          }
          const copy = board.map(row => [...row]);
          const temp = copy[r][c];
          copy[r][c] = copy[nr][nc];
          copy[nr][nc] = temp;
          const { matchedCoords } = findMatches(copy);
          if (matchedCoords.size > 0) {
            return [{ r, c }, { r: nr, c: nc }];
          }
        }
      }
    }
  }
  return null;
};

export default function CandyCrushGame({ onScoreUpdate, onBack }) {
  const [level, setLevel] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pulsechat_candy_crush_level') || '1', 10);
    } catch {
      return 1;
    }
  });

  const levelConfig = getLevelConfig(level);
  const [board, setBoard] = useState(() => createInitialBoard());
  const [selectedCell, setSelectedCell] = useState(null); // { r, c }
  const [movesLeft, setMovesLeft] = useState(levelConfig.moves);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pulsechat_candy_crush_high_score') || '0', 10);
    } catch {
      return 0;
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [comboBanner, setComboBanner] = useState(null); // e.g. "Tasty! x2"
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'won' | 'gameover'
  const [hintCells, setHintCells] = useState(null);
  const [particles, setParticles] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  const idleTimerRef = useRef(null);
  const touchStartRef = useRef(null);

  // Sound Mute Toggle
  const toggleMute = () => {
    soundEngine.muted = !soundEngine.muted;
    setIsMuted(soundEngine.muted);
  };

  // Reset idle timer for automatic hints
  const resetIdleTimer = useCallback(() => {
    setHintCells(null);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (gameState === 'playing' && !isProcessing) {
        const hint = findHintMove(board);
        if (hint) setHintCells(hint);
      }
    }, 4500);
  }, [board, gameState, isProcessing]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Save High Score & Level
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem('pulsechat_candy_crush_high_score', String(score));
      } catch (e) {}
    }
  }, [score, highScore]);

  // Check board reshuffle if stuck
  const checkReshuffle = useCallback((currentBoard) => {
    if (!hasValidMoves(currentBoard)) {
      setComboBanner('Shuffling Candies...');
      setTimeout(() => {
        let newBoard;
        let attempts = 0;
        do {
          newBoard = createInitialBoard();
          attempts += 1;
        } while (!hasValidMoves(newBoard) && attempts < 10);
        setBoard(newBoard);
        setComboBanner(null);
      }, 900);
    }
  }, []);

  // Trigger burst particles on matches
  const triggerParticles = (r, c, color) => {
    const newParticles = Array.from({ length: 6 }).map((_, i) => ({
      id: Math.random(),
      r,
      c,
      color,
      angle: (i / 6) * Math.PI * 2,
      dist: Math.random() * 24 + 16
    }));
    setParticles(prev => [...prev.slice(-18), ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 400);
  };

  // Process Cascades and Matches
  const processBoardMatches = useCallback(async (currentBoard, comboMultiplier = 1, moveOrigin = null) => {
    setIsProcessing(true);
    let workingBoard = currentBoard.map(row => [...row]);
    let earnedThisStep = 0;

    const { matchedCoords, matchGroups } = findMatches(workingBoard);

    if (matchedCoords.size === 0) {
      setIsProcessing(false);
      checkReshuffle(workingBoard);
      return workingBoard;
    }

    // Play Pop Sound
    soundEngine.playPop(comboMultiplier);

    // Show Combo Banner
    if (comboMultiplier >= 2) {
      const phrases = ['Sweet! 🍬', 'Tasty! 😋', 'Delicious! ✨', 'Divine! 👑', 'SUGAR CRUSH! 🔥'];
      const phrase = phrases[Math.min(comboMultiplier - 2, phrases.length - 1)];
      setComboBanner(`${phrase} x${comboMultiplier}`);
      soundEngine.playComboFanfare(comboMultiplier);
      setTimeout(() => setComboBanner(null), 1200);
    }

    // Check special candy creation
    const specialsToCreate = [];
    matchGroups.forEach(mg => {
      if (mg.length === 4) {
        // Striped Candy
        const target = moveOrigin && mg.group.some(g => g.r === moveOrigin.r && g.c === moveOrigin.c)
          ? moveOrigin
          : mg.group[Math.floor(mg.group.length / 2)];
        specialsToCreate.push({
          r: target.r,
          c: target.c,
          candy: {
            id: ++candyCounter,
            type: mg.candyType,
            special: mg.type === 'h' ? 'striped_v' : 'striped_h'
          }
        });
        soundEngine.playSpecialCreate();
      } else if (mg.length >= 5) {
        // Color Bomb!
        const target = moveOrigin && mg.group.some(g => g.r === moveOrigin.r && g.c === moveOrigin.c)
          ? moveOrigin
          : mg.group[Math.floor(mg.group.length / 2)];
        specialsToCreate.push({
          r: target.r,
          c: target.c,
          candy: {
            id: ++candyCounter,
            type: 'color_bomb',
            special: 'color_bomb'
          }
        });
        soundEngine.playSpecialCreate();
      }
    });

    // Expand matches if any special candies are triggered
    const finalDestroyCoords = new Set(matchedCoords);
    matchedCoords.forEach(coord => {
      const [r, c] = coord.split(',').map(Number);
      const candy = workingBoard[r][c];
      if (!candy) return;

      const candyConf = CANDY_TYPES.find(t => t.id === candy.type);
      triggerParticles(r, c, candyConf?.color || '#fbbf24');

      if (candy.special === 'striped_h') {
        for (let col = 0; col < GRID_SIZE; col++) finalDestroyCoords.add(`${r},${col}`);
        soundEngine.playSpecialBlast();
      } else if (candy.special === 'striped_v') {
        for (let row = 0; row < GRID_SIZE; row++) finalDestroyCoords.add(`${row},${c}`);
        soundEngine.playSpecialBlast();
      } else if (candy.special === 'wrapped') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
              finalDestroyCoords.add(`${nr},${nc}`);
            }
          }
        }
        soundEngine.playSpecialBlast();
      }
    });

    // Calculate score
    earnedThisStep = finalDestroyCoords.size * 50 * comboMultiplier;
    setScore(prev => prev + earnedThisStep);

    // Clear matched cells
    finalDestroyCoords.forEach(coord => {
      const [r, c] = coord.split(',').map(Number);
      workingBoard[r][c] = null;
    });

    // Insert created special candies into board
    specialsToCreate.forEach(({ r, c, candy }) => {
      workingBoard[r][c] = candy;
    });

    setBoard([...workingBoard.map(row => [...row])]);

    // Animate falling candies (gravity)
    await new Promise(res => setTimeout(res, 220));

    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyRow = GRID_SIZE - 1;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (workingBoard[r][c] !== null) {
          if (emptyRow !== r) {
            workingBoard[emptyRow][c] = workingBoard[r][c];
            workingBoard[r][c] = null;
          }
          emptyRow -= 1;
        }
      }
      // Fill from top
      for (let r = emptyRow; r >= 0; r--) {
        workingBoard[r][c] = createRandomCandy();
      }
    }

    setBoard([...workingBoard.map(row => [...row])]);

    await new Promise(res => setTimeout(res, 180));

    // Chain reaction cascade
    return processBoardMatches(workingBoard, comboMultiplier + 1, null);
  }, [checkReshuffle]);

  // Execute Swap between two cells
  const executeSwap = async (cellA, cellB) => {
    if (isProcessing) return;
    resetIdleTimer();

    const candyA = board[cellA.r][cellA.c];
    const candyB = board[cellB.r][cellB.c];
    if (!candyA || !candyB) return;

    soundEngine.playSwap();

    // 1. Color Bomb Combo!
    if (candyA.type === 'color_bomb' || candyB.type === 'color_bomb') {
      setIsProcessing(true);
      const isBoth = candyA.type === 'color_bomb' && candyB.type === 'color_bomb';
      const targetColor = candyA.type === 'color_bomb' ? candyB.type : candyA.type;

      setMovesLeft(prev => Math.max(0, prev - 1));
      soundEngine.playSpecialBlast();

      const newBoard = board.map(row => [...row]);
      newBoard[cellA.r][cellA.c] = null;
      newBoard[cellB.r][cellB.c] = null;

      let blastCount = 2;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (isBoth || newBoard[r][c]?.type === targetColor) {
            triggerParticles(r, c, '#f59e0b');
            newBoard[r][c] = null;
            blastCount += 1;
          }
        }
      }

      setScore(prev => prev + blastCount * 80);
      setBoard(newBoard);

      // Drop down candies
      await new Promise(res => setTimeout(res, 220));
      for (let c = 0; c < GRID_SIZE; c++) {
        let emptyRow = GRID_SIZE - 1;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
          if (newBoard[r][c] !== null) {
            if (emptyRow !== r) {
              newBoard[emptyRow][c] = newBoard[r][c];
              newBoard[r][c] = null;
            }
            emptyRow -= 1;
          }
        }
        for (let r = emptyRow; r >= 0; r--) {
          newBoard[r][c] = createRandomCandy();
        }
      }
      setBoard([...newBoard]);
      await new Promise(res => setTimeout(res, 180));
      await processBoardMatches(newBoard, 2);
      return;
    }

    // 2. Standard Swap
    const newBoard = board.map(row => [...row]);
    newBoard[cellA.r][cellA.c] = candyB;
    newBoard[cellB.r][cellB.c] = candyA;

    const { matchedCoords } = findMatches(newBoard);

    if (matchedCoords.size === 0) {
      // Invalid move -> quick bounce back
      soundEngine.playReject();
      setBoard(newBoard);
      await new Promise(res => setTimeout(res, 180));
      setBoard(board);
      return;
    }

    // Valid move -> decrement moves & cascade
    setMovesLeft(prev => Math.max(0, prev - 1));
    setBoard(newBoard);
    await new Promise(res => setTimeout(res, 120));
    await processBoardMatches(newBoard, 1, cellB);
  };

  // Click on a candy
  const handleCellClick = (r, c) => {
    if (isProcessing || gameState !== 'playing') return;

    if (!selectedCell) {
      soundEngine.init();
      setSelectedCell({ r, c });
      return;
    }

    // Check if clicked cell is adjacent
    const dr = Math.abs(selectedCell.r - r);
    const dc = Math.abs(selectedCell.c - c);
    const isAdjacent = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);

    if (isAdjacent) {
      const prev = selectedCell;
      setSelectedCell(null);
      executeSwap(prev, { r, c });
    } else {
      setSelectedCell({ r, c });
    }
  };

  // Swipe / Drag Touch handlers
  const handleTouchStart = (r, c, e) => {
    if (isProcessing || gameState !== 'playing') return;
    const touch = e.touches ? e.touches[0] : e;
    touchStartRef.current = { r, c, x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || isProcessing) return;
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 24;

    const { r, c } = touchStartRef.current;
    touchStartRef.current = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > minSwipe && c + 1 < GRID_SIZE) {
        executeSwap({ r, c }, { r, c: c + 1 });
      } else if (dx < -minSwipe && c - 1 >= 0) {
        executeSwap({ r, c }, { r, c: c - 1 });
      }
    } else {
      if (dy > minSwipe && r + 1 < GRID_SIZE) {
        executeSwap({ r, c }, { r: r + 1, c });
      } else if (dy < -minSwipe && r - 1 >= 0) {
        executeSwap({ r, c }, { r: r - 1, c });
      }
    }
    setSelectedCell(null);
  };

  // Check Win / Game Over conditions
  useEffect(() => {
    if (isProcessing) return;

    if (score >= levelConfig.targetScore) {
      setGameState('won');
      soundEngine.playWinFanfare();
      if (onScoreUpdate) {
        onScoreUpdate('Candy Crush Saga', score, level);
      }
      try {
        const nextLevel = level + 1;
        localStorage.setItem('pulsechat_candy_crush_level', String(nextLevel));
      } catch (e) {}
    } else if (movesLeft <= 0) {
      setGameState('gameover');
      if (onScoreUpdate) {
        onScoreUpdate('Candy Crush Saga', score, level);
      }
    }
  }, [score, movesLeft, isProcessing, level, levelConfig.targetScore, onScoreUpdate]);

  // Next Level or Restart
  const startNextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    const nextCfg = getLevelConfig(nextLvl);
    setMovesLeft(nextCfg.moves);
    setBoard(createInitialBoard());
    setScore(0);
    setGameState('playing');
    setSelectedCell(null);
  };

  const restartLevel = () => {
    setMovesLeft(levelConfig.moves);
    setBoard(createInitialBoard());
    setScore(0);
    setGameState('playing');
    setSelectedCell(null);
  };

  // Star Progress calculations
  const starPercentage = Math.min(100, Math.round((score / levelConfig.targetScore) * 100));
  const starsCount = score >= levelConfig.targetScore ? 3 : (score >= levelConfig.targetScore * 0.7 ? 2 : (score >= levelConfig.targetScore * 0.35 ? 1 : 0));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        padding: '8px 12px 16px 12px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative'
      }}
    >
      {/* Game Header Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.2))',
          border: '1.5px solid rgba(236, 72, 153, 0.45)',
          borderRadius: '20px',
          padding: '10px 16px',
          marginBottom: '10px',
          boxShadow: '0 8px 24px rgba(236, 72, 153, 0.18)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.5)'
            }}
          >
            🍬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>Candy Crush</span>
              <span style={{ fontSize: '0.65rem', background: '#ec4899', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                LVL {level}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#fbcfe8', fontWeight: 600 }}>
              Target: {levelConfig.targetScore.toLocaleString()} pts
            </div>
          </div>
        </div>

        {/* Controls & Sound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleMute}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            onClick={restartLevel}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Restart Level"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>

      {/* Target Progress Bar & Moves Info */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '10px'
        }}
      >
        {/* Moves Left Badge */}
        <div
          style={{
            background: movesLeft <= 5 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            border: movesLeft <= 5 ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>MOVES</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: movesLeft <= 5 ? '#ef4444' : '#38bdf8' }}>
            {movesLeft}
          </span>
        </div>

        {/* Score & Stars */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>SCORE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fbbf24' }}>
              {score.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: '1px' }}>
              {[1, 2, 3].map(i => (
                <Star
                  key={i}
                  size={12}
                  fill={i <= starsCount ? '#fbbf24' : 'none'}
                  color={i <= starsCount ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Target Progress Fill Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}
      >
        <div
          style={{
            width: `${starPercentage}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #ec4899, #f59e0b)',
            transition: 'width 0.3s ease',
            borderRadius: '10px',
            boxShadow: '0 0 8px rgba(236, 72, 153, 0.8)'
          }}
        />
      </div>

      {/* Main Board Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid rgba(236, 72, 153, 0.35)',
          borderRadius: '22px',
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          gap: '5px',
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), inset 0 2px 10px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          touchAction: 'none'
        }}
      >
        {/* Render Grid Cells */}
        {board.map((row, r) =>
          row.map((candy, c) => {
            const isSelected = selectedCell?.r === r && selectedCell?.c === c;
            const isHint = hintCells?.some(h => h.r === r && h.c === c);
            const candyConfig = CANDY_TYPES.find(t => t.id === candy?.type);

            return (
              <div
                key={`${r}-${c}-${candy?.id || 'empty'}`}
                onClick={() => handleCellClick(r, c)}
                onTouchStart={(e) => handleTouchStart(r, c, e)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => handleTouchStart(r, c, e)}
                onMouseUp={handleTouchEnd}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '12px',
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.25)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected
                    ? '2.5px solid #fbbf24'
                    : (isHint ? '2px dashed #f43f5e' : '1px solid rgba(255, 255, 255, 0.06)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.08)' : (isHint ? 'scale(1.04)' : 'scale(1)'),
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(251, 191, 36, 0.8)' : 'none'
                }}
              >
                {candy && (
                  <div
                    style={{
                      width: '84%',
                      height: '84%',
                      borderRadius: candy.special === 'wrapped' ? '10px' : (candy.special === 'color_bomb' ? '50%' : '14px'),
                      background: candy.type === 'color_bomb'
                        ? 'radial-gradient(circle, #f43f5e, #8b5cf6, #3b82f6, #10b981, #eab308)'
                        : (candyConfig?.gradient || '#ec4899'),
                      boxShadow: candy.type === 'color_bomb'
                        ? '0 0 14px rgba(236, 72, 153, 0.9)'
                        : `0 4px 10px ${candyConfig?.shadow || 'rgba(0,0,0,0.4)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Gloss Highlight on Candy */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '12%',
                        left: '16%',
                        width: '32%',
                        height: '24%',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.65)',
                        filter: 'blur(1px)'
                      }}
                    />

                    {/* Striped Candy Patterns */}
                    {candy.special === 'striped_h' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 8px)'
                        }}
                      />
                    )}
                    {candy.special === 'striped_v' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 8px)'
                        }}
                      />
                    )}

                    {/* Wrapped Candy Badge */}
                    {candy.special === 'wrapped' && (
                      <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 900 }}>
                        🍬
                      </div>
                    )}

                    {/* Color Bomb Sprinkle Ball Icon */}
                    {candy.type === 'color_bomb' && (
                      <div style={{ fontSize: '0.9rem', color: '#fff', animation: 'spin 4s linear infinite' }}>
                        ✨
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Combo Banner Popup */}
        {comboBanner && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'linear-gradient(135deg, #ec4899, #f59e0b)',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: '24px',
              fontWeight: 900,
              fontSize: '1.25rem',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(236, 72, 153, 0.7)',
              zIndex: 30,
              pointerEvents: 'none',
              animation: 'pulseModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {comboBanner}
          </div>
        )}

        {/* Win Overlay Modal */}
        {gameState === 'won' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 18, 30, 0.94)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              zIndex: 40,
              borderRadius: '22px',
              padding: '20px'
            }}
          >
            <div style={{ fontSize: '3rem', animation: 'bounce 0.8s infinite' }}>🎉</div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>
              Level {level} Complete!
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem' }}>
              Sugar Crush! You crushed {score.toLocaleString()} points!
            </p>
            <div style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
              {[1, 2, 3].map(i => (
                <Star
                  key={i}
                  size={24}
                  fill={i <= starsCount ? '#fbbf24' : 'none'}
                  color={i <= starsCount ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
                />
              ))}
            </div>
            <button
              onClick={startNextLevel}
              style={{
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                padding: '12px 28px',
                fontWeight: 900,
                fontSize: '0.98rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(236, 72, 153, 0.5)'
              }}
            >
              <Play size={18} fill="#fff" /> Play Level {level + 1}
            </button>
          </div>
        )}

        {/* Game Over Overlay Modal */}
        {gameState === 'gameover' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 18, 30, 0.94)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              zIndex: 40,
              borderRadius: '22px',
              padding: '20px'
            }}
          >
            <div style={{ fontSize: '3rem' }}>🥺</div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>
              Out of Moves!
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.86rem', textAlign: 'center' }}>
              Needed: {levelConfig.targetScore.toLocaleString()} pts<br />
              Crushed: {score.toLocaleString()} pts
            </p>
            <button
              onClick={restartLevel}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                padding: '12px 28px',
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5)'
              }}
            >
              <RotateCcw size={17} /> Try Again
            </button>
          </div>
        )}
      </div>

      {/* Footer Info & Instructions */}
      <div
        style={{
          width: '100%',
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: 'var(--text-muted, #94a3b8)',
          fontWeight: 600
        }}
      >
        <span>💡 Swipe or tap 2 adjacent candies to match 3+</span>
        <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Trophy size={13} /> High: {highScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
