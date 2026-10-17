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
      const freqs = [440, 523, 587, 659, 784, 880, 1046, 1175];
      const baseFreq = freqs[Math.min(combo - 1, freqs.length - 1)] || 523;

      // 1. Resonant juicy bubble "bloop" oscillator (frequency sweep up and drop)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 0.75, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.32, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);

      // 2. High-frequency bubble pop click
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(baseFreq * 3.0, ctx.currentTime);
      popOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);

      popGain.gain.setValueAtTime(0.2, ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start();
      popOsc.stop(ctx.currentTime + 0.04);
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

// Global Shared SVG Defs - Defined once for the entire game board to eliminate DOM thrashing & achieve 60fps
const CandyGlobalSvgDefs = React.memo(function CandyGlobalSvgDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        {/* Color Bomb Choco Grad */}
        <radialGradient id="candy-choco-grad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#5c3826" />
          <stop offset="45%" stopColor="#3d2314" />
          <stop offset="90%" stopColor="#221207" />
          <stop offset="100%" stopColor="#0f0703" />
        </radialGradient>

        {/* Red Jelly Bean */}
        <radialGradient id="candy-red-grad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff5a5a" />
          <stop offset="30%" stopColor="#e50914" />
          <stop offset="75%" stopColor="#b30006" />
          <stop offset="100%" stopColor="#660000" />
        </radialGradient>
        <linearGradient id="candy-red-gloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="candy-clip-red">
          <path d="M 17 20 C 21 10, 36 8, 45 16 C 54 24, 52 38, 44 46 C 35 53, 23 49, 21 38 C 19 28, 12 26, 17 20 Z" />
        </clipPath>

        {/* Orange Lozenge */}
        <radialGradient id="candy-orange-grad" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="35%" stopColor="#ff7b00" />
          <stop offset="80%" stopColor="#d35400" />
          <stop offset="100%" stopColor="#7a2e00" />
        </radialGradient>
        <clipPath id="candy-clip-orange">
          <ellipse cx="30" cy="30" rx="16" ry="23" />
        </clipPath>

        {/* Yellow Lemon Drop */}
        <radialGradient id="candy-yellow-grad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fffab3" />
          <stop offset="35%" stopColor="#ffd000" />
          <stop offset="80%" stopColor="#e69100" />
          <stop offset="100%" stopColor="#8a4f00" />
        </radialGradient>
        <clipPath id="candy-clip-yellow">
          <path d="M 30 7 C 30 7, 48 26, 48 37 C 48 47, 40 52, 30 52 C 20 52, 12 47, 12 37 C 12 26, 30 7, 30 7 Z" />
        </clipPath>

        {/* Green Apple Chiclet */}
        <radialGradient id="candy-green-grad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#8aff73" />
          <stop offset="35%" stopColor="#22c50e" />
          <stop offset="80%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#052e16" />
        </radialGradient>
        <clipPath id="candy-clip-green">
          <rect x="9" y="9" width="42" height="42" rx="12" ry="12" />
        </clipPath>

        {/* Blue Sphere Lollipop */}
        <radialGradient id="candy-blue-grad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#82ebff" />
          <stop offset="30%" stopColor="#0284c7" />
          <stop offset="80%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#082f49" />
        </radialGradient>
        <clipPath id="candy-clip-blue">
          <circle cx="30" cy="30" r="22" />
        </clipPath>

        {/* Purple Scalloped Flower */}
        <radialGradient id="candy-purple-grad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f594ff" />
          <stop offset="35%" stopColor="#c026d3" />
          <stop offset="80%" stopColor="#86198f" />
          <stop offset="100%" stopColor="#4a044e" />
        </radialGradient>
        <clipPath id="candy-clip-purple">
          <path
            d="M 30 7 C 34 7, 36 11, 40 12 C 44 13, 47 11, 50 14 C 53 17, 51 20, 52 24 C 53 28, 57 30, 57 34 C 57 38, 53 40, 52 44 C 51 48, 53 51, 50 54 C 47 57, 44 55, 40 56 C 36 57, 34 61, 30 61 C 26 61, 24 57, 20 56 C 16 55, 13 57, 10 54 C 7 51, 9 48, 8 44 C 7 40, 3 38, 3 34 C 3 30, 7 28, 8 24 C 9 20, 7 17, 10 14 C 13 11, 16 13, 20 12 C 24 11, 26 7, 30 7 Z"
            transform="scale(0.85) translate(5, 5)"
          />
        </clipPath>
      </defs>
    </svg>
  );
});

const CandyVisual = React.memo(function CandyVisual({ candy }) {
  if (!candy) return null;
  const { type, special } = candy;

  if (type === 'color_bomb') {
    return (
      <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.65))' }}>
        <circle cx="30" cy="30" r="23" fill="url(#candy-choco-grad)" />
        {/* Colorful Rainbow Sprinkles */}
        <circle cx="22" cy="18" r="3" fill="#ef4444" />
        <circle cx="36" cy="17" r="2.8" fill="#eab308" />
        <circle cx="28" cy="24" r="3.2" fill="#3b82f6" />
        <circle cx="16" cy="28" r="2.7" fill="#10b981" />
        <circle cx="38" cy="29" r="3" fill="#f97316" />
        <circle cx="24" cy="35" r="2.8" fill="#a855f7" />
        <circle cx="35" cy="39" r="3.1" fill="#ec4899" />
        <circle cx="18" cy="39" r="2.5" fill="#eab308" />
        <circle cx="29" cy="43" r="2.6" fill="#3b82f6" />
        <ellipse cx="23" cy="15" rx="6" ry="3" transform="rotate(-25 23 15)" fill="#ffffff" opacity="0.65" />
      </svg>
    );
  }

  // Striped overlays (white candy stripes)
  const renderStripes = () => {
    if (special === 'striped_h') {
      return (
        <g opacity="0.95">
          <line x1="6" y1="18" x2="54" y2="18" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
          <line x1="6" y1="30" x2="54" y2="30" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
          <line x1="6" y1="42" x2="54" y2="42" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
        </g>
      );
    }
    if (special === 'striped_v') {
      return (
        <g opacity="0.95">
          <line x1="18" y1="6" x2="18" y2="54" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
          <line x1="30" y1="6" x2="30" y2="54" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
          <line x1="42" y1="6" x2="42" y2="54" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
        </g>
      );
    }
    return null;
  };

  const renderWrappedBadge = () => {
    if (special !== 'wrapped') return null;
    return (
      <g>
        <rect x="8" y="8" width="44" height="44" rx="8" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.9" />
        <circle cx="30" cy="30" r="14" fill="rgba(255,255,255,0.25)" />
      </g>
    );
  };

  switch (type) {
    case 'red': // Curved Red Jelly Bean (iconic kidney bean)
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-red)">
            <path
              d="M 17 20 C 21 10, 36 8, 45 16 C 54 24, 52 38, 44 46 C 35 53, 23 49, 21 38 C 19 28, 12 26, 17 20 Z"
              fill="url(#candy-red-grad)"
            />
            {renderStripes()}
          </g>
          <path
            d="M 17 20 C 21 10, 36 8, 45 16 C 54 24, 52 38, 44 46 C 35 53, 23 49, 21 38 C 19 28, 12 26, 17 20 Z"
            fill="none"
            stroke="#ff8080"
            strokeWidth="1.2"
            opacity="0.55"
          />
          {/* Top Curved Specular Highlight */}
          <path
            d="M 23 15 C 29 11, 39 12, 43 18 C 38 15, 27 15, 23 19 Z"
            fill="url(#candy-red-gloss)"
          />
          <ellipse cx="25" cy="22" rx="4" ry="2.2" transform="rotate(-30 25 22)" fill="#ffffff" opacity="0.75" />
          {renderWrappedBadge()}
        </svg>
      );

    case 'orange': // Vertical Oval Lozenge
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-orange)">
            <ellipse cx="30" cy="30" rx="16" ry="23" fill="url(#candy-orange-grad)" />
            {renderStripes()}
          </g>
          <ellipse cx="30" cy="30" rx="16" ry="23" fill="none" stroke="#ffa34d" strokeWidth="1.2" opacity="0.55" />
          {/* Longitudinal Gloss Shine */}
          <path
            d="M 24 12 C 27 10, 31 10, 34 12 C 35 18, 33 34, 27 40 C 25 34, 24 22, 24 12 Z"
            fill="#ffffff"
            opacity="0.4"
          />
          <ellipse cx="27" cy="18" rx="4.5" ry="3" transform="rotate(-15 27 18)" fill="#ffffff" opacity="0.82" />
          {renderWrappedBadge()}
        </svg>
      );

    case 'yellow': // Teardrop / Lemon Drop
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-yellow)">
            <path
              d="M 30 7 C 30 7, 48 26, 48 37 C 48 47, 40 52, 30 52 C 20 52, 12 47, 12 37 C 12 26, 30 7, 30 7 Z"
              fill="url(#candy-yellow-grad)"
            />
            {/* Inner Pear Accent */}
            <path
              d="M 30 13 C 30 13, 43 28, 43 37 C 43 44, 37 48, 30 48 C 23 48, 17 44, 17 37 C 17 28, 30 13, 30 13 Z"
              fill="#ffe833"
              opacity="0.45"
            />
            {renderStripes()}
          </g>
          <path
            d="M 30 7 C 30 7, 48 26, 48 37 C 48 47, 40 52, 30 52 C 20 52, 12 47, 12 37 C 12 26, 30 7, 30 7 Z"
            fill="none"
            stroke="#ffea75"
            strokeWidth="1.2"
            opacity="0.65"
          />
          {/* Gloss */}
          <ellipse cx="25" cy="24" rx="4" ry="7" transform="rotate(-25 25 24)" fill="#ffffff" opacity="0.85" />
          <ellipse cx="23" cy="38" rx="3.5" ry="2" fill="#ffffff" opacity="0.5" />
          {renderWrappedBadge()}
        </svg>
      );

    case 'green': // Rounded Square / Pillow Chiclet
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-green)">
            <rect x="9" y="9" width="42" height="42" rx="12" ry="12" fill="url(#candy-green-grad)" />
            {renderStripes()}
          </g>
          {/* Inner Highlight Border */}
          <rect x="12" y="12" width="36" height="36" rx="9" ry="9" fill="none" stroke="#7aff66" strokeWidth="1.5" opacity="0.65" />
          {/* Top Curved Gloss */}
          <path
            d="M 14 18 C 14 13, 19 12, 26 12 C 38 12, 44 14, 44 18 C 38 22, 22 22, 14 18 Z"
            fill="#ffffff"
            opacity="0.8"
          />
          {renderWrappedBadge()}
        </svg>
      );

    case 'blue': // Blue Sphere Lollipop with Ring
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-blue)">
            <circle cx="30" cy="30" r="22" fill="url(#candy-blue-grad)" />
            {renderStripes()}
          </g>
          {/* Equatorial Disc Ring */}
          <ellipse cx="30" cy="32" rx="23" ry="8" fill="none" stroke="#38bdf8" strokeWidth="2.5" opacity="0.88" />
          <ellipse cx="30" cy="31" rx="22" ry="7" fill="none" stroke="#0284c7" strokeWidth="1.5" />
          {/* Top Gloss */}
          <ellipse cx="24" cy="18" rx="6.5" ry="3.8" transform="rotate(-15 24 18)" fill="#ffffff" opacity="0.85" />
          <circle cx="21" cy="24" r="1.8" fill="#ffffff" opacity="0.6" />
          {renderWrappedBadge()}
        </svg>
      );

    case 'purple': // Scalloped 8-Petal Flower Cluster
      return (
        <svg viewBox="0 0 60 60" width="88%" height="88%" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
          <g clipPath="url(#candy-clip-purple)">
            <path
              d="M 30 7 C 34 7, 36 11, 40 12 C 44 13, 47 11, 50 14 C 53 17, 51 20, 52 24 C 53 28, 57 30, 57 34 C 57 38, 53 40, 52 44 C 51 48, 53 51, 50 54 C 47 57, 44 55, 40 56 C 36 57, 34 61, 30 61 C 26 61, 24 57, 20 56 C 16 55, 13 57, 10 54 C 7 51, 9 48, 8 44 C 7 40, 3 38, 3 34 C 3 30, 7 28, 8 24 C 9 20, 7 17, 10 14 C 13 11, 16 13, 20 12 C 24 11, 26 7, 30 7 Z"
              transform="scale(0.85) translate(5, 5)"
              fill="url(#candy-purple-grad)"
            />
            {renderStripes()}
          </g>
          {/* Sugar Crystals & Dimples */}
          <circle cx="27" cy="24" r="1.6" fill="#ffffff" opacity="0.8" />
          <circle cx="34" cy="25" r="1.3" fill="#ffffff" opacity="0.75" />
          <circle cx="25" cy="32" r="1.4" fill="#ffffff" opacity="0.8" />
          <circle cx="34" cy="33" r="1.6" fill="#ffffff" opacity="0.85" />
          <circle cx="30" cy="29" r="1.8" fill="#ffffff" opacity="0.9" />
          <ellipse cx="25" cy="18" rx="4" ry="2" transform="rotate(-15 25 18)" fill="#ffffff" opacity="0.75" />
          {renderWrappedBadge()}
        </svg>
      );

    default:
      return null;
  }
});

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
  const [burstingCells, setBurstingCells] = useState(null); // Map of `${r},${c}` -> { candy, color }
  const [hintCells, setHintCells] = useState(null);
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

  // Trigger burst sound & effects on matches
  const triggerParticles = (r, c, color) => {
    // Pure sound and visual feedback without state thrashing
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

    // 1. Juicy Bubble Burst Pop Phase! (Authentic bubble burst and popping droplets)
    const burstMap = {};
    finalDestroyCoords.forEach(coord => {
      const [r, c] = coord.split(',').map(Number);
      const candy = workingBoard[r][c];
      if (candy) {
        const candyConf = CANDY_TYPES.find(t => t.id === candy.type);
        burstMap[coord] = {
          candy,
          color: candyConf?.color || '#fbbf24'
        };
      }
    });

    setBurstingCells(burstMap);
    soundEngine.playPop(comboMultiplier);

    // Wait for the juicy bubble burst and pop particles to animate completely!
    await new Promise(res => setTimeout(res, 320));
    setBurstingCells(null);

    // 2. Clear matched cells
    finalDestroyCoords.forEach(coord => {
      const [r, c] = coord.split(',').map(Number);
      workingBoard[r][c] = null;
    });

    // Insert created special candies into board
    specialsToCreate.forEach(({ r, c, candy }) => {
      workingBoard[r][c] = candy;
    });

    setBoard([...workingBoard.map(row => [...row])]);

    // 3. Drop down candies visibly with spring bounce
    const droppedBoard = await dropCandiesWithBounce(workingBoard);

    // Chain reaction cascade
    return processBoardMatches(droppedBoard, comboMultiplier + 1, null);
  }, [checkReshuffle]);

  // Visibly drop candies from above with spring bounce (Solves candy drop visibility & eliminates lag)
  const dropCandiesWithBounce = async (workingBoard) => {
    let hasFalling = false;
    const nextBoard = workingBoard.map(row => [...row]);

    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyRow = GRID_SIZE - 1;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (nextBoard[r][c] !== null) {
          if (emptyRow !== r) {
            const dropRows = Math.min(emptyRow - r, 3.5);
            nextBoard[emptyRow][c] = {
              ...nextBoard[r][c],
              dropRows,
              dropKey: `${emptyRow}-${c}-${Date.now()}-${Math.random()}`
            };
            nextBoard[r][c] = null;
            hasFalling = true;
          }
          emptyRow -= 1;
        }
      }
      // Fill from top with newly spawned candies dropping into view
      let spawnIndex = 0;
      for (let r = emptyRow; r >= 0; r--) {
        const dropRows = Math.min((emptyRow + 1) + spawnIndex, 3.5);
        nextBoard[r][c] = {
          ...createRandomCandy(),
          dropRows,
          dropKey: `spawn-${r}-${c}-${Date.now()}-${Math.random()}`
        };
        hasFalling = true;
        spawnIndex += 1;
      }
    }

    setBoard([...nextBoard.map(row => [...row])]);

    if (hasFalling) {
      // Let the player clearly see and enjoy the candies dropping and bouncing!
      await new Promise(res => setTimeout(res, 400));
      // Settle board so candies have zero transform offset
      const settledBoard = nextBoard.map(row => row.map(cell => cell ? { ...cell, dropRows: 0 } : null));
      setBoard(settledBoard);
      return settledBoard;
    }

    return nextBoard;
  };

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

      const blastList = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (isBoth || newBoard[r][c]?.type === targetColor) {
            const candy = newBoard[r][c];
            if (candy) {
              const candyConf = CANDY_TYPES.find(t => t.id === candy.type);
              blastList.push({ r, c, candy, color: candyConf?.color || '#fbbf24' });
            }
          }
        }
      }

      // Juicy bubble burst on blasted cells
      const burstMap = {};
      blastList.forEach(({ r, c, candy, color }) => {
        burstMap[`${r},${c}`] = { candy, color };
      });
      setBurstingCells(burstMap);
      soundEngine.playPop(2);
      await new Promise(res => setTimeout(res, 240));
      setBurstingCells(null);

      blastList.forEach(({ r, c }) => {
        newBoard[r][c] = null;
      });

      setScore(prev => prev + (blastList.length + 2) * 80);
      setBoard([...newBoard.map(row => [...row])]);

      const droppedBoard = await dropCandiesWithBounce(newBoard);
      await processBoardMatches(droppedBoard, 2);
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
    if (e.cancelable) e.preventDefault();
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 15;

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
    if (gameState !== 'playing' || isProcessing) return;

    if (score >= levelConfig.targetScore && score > 0) {
      setGameState('won');
      soundEngine.playWinFanfare();
      if (onScoreUpdate) {
        onScoreUpdate('Candy Crush Saga', score, level);
      }
    } else if (movesLeft <= 0) {
      setGameState('gameover');
      if (onScoreUpdate) {
        onScoreUpdate('Candy Crush Saga', score, level);
      }
    }
  }, [score, movesLeft, isProcessing, gameState, level, levelConfig.targetScore, onScoreUpdate]);

  // Next Level or Restart
  const startNextLevel = () => {
    const nextLvl = level + 1;
    try {
      localStorage.setItem('pulsechat_candy_crush_level', String(nextLvl));
    } catch (e) {}
    setScore(0);
    setLevel(nextLvl);
    const nextCfg = getLevelConfig(nextLvl);
    setMovesLeft(nextCfg.moves);
    setBoard(createInitialBoard());
    setGameState('playing');
    setSelectedCell(null);
  };

  const restartLevel = () => {
    setScore(0);
    setMovesLeft(levelConfig.moves);
    setBoard(createInitialBoard());
    setGameState('playing');
    setSelectedCell(null);
  };

  const resetToLevelOne = () => {
    try {
      localStorage.setItem('pulsechat_candy_crush_level', '1');
    } catch (e) {}
    setScore(0);
    setLevel(1);
    const firstCfg = getLevelConfig(1);
    setMovesLeft(firstCfg.moves);
    setBoard(createInitialBoard());
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
      {/* Shared Global SVG Defs for 60fps Rendering */}
      <CandyGlobalSvgDefs />

      {/* 60 FPS GPU Keyframes for Bubble Burst & Candy Drops */}
      <style>{`
        @keyframes candyDropBounceAnim {
          0% {
            transform: translateY(calc(-100% * var(--drop-rows))) scale(0.92);
            opacity: 0.85;
          }
          65% {
            transform: translateY(9px) scale(1.14, 0.86);
            opacity: 1;
          }
          82% {
            transform: translateY(-4px) scale(0.96, 1.04);
          }
          100% {
            transform: translateY(0) scale(1, 1);
            opacity: 1;
          }
        }

        .candy-dropping {
          animation: candyDropBounceAnim 0.40s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
          will-change: transform;
        }

        @keyframes candyBubbleExpand {
          0% {
            transform: scale(0.45);
            opacity: 0.95;
            border-width: 3.5px;
          }
          55% {
            transform: scale(1.35);
            opacity: 1;
            border-width: 2.5px;
          }
          85% {
            transform: scale(1.6);
            opacity: 0.85;
            border-width: 1.5px;
          }
          100% {
            transform: scale(1.85);
            opacity: 0;
            border-width: 1px;
          }
        }

        @keyframes candyPopVanishAnim {
          0% {
            transform: scale(1);
            filter: brightness(1.1);
          }
          40% {
            transform: scale(1.22) rotate(-6deg);
            filter: brightness(1.6);
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }

        @keyframes candyDropletBurst {
          0% {
            transform: translate(0, 0) scale(1.2);
            opacity: 1;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0);
            opacity: 0;
          }
        }

        .candy-bubble-pop-cell {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 25;
        }

        .candy-bubble-sphere {
          position: absolute;
          width: 92%;
          height: 92%;
          border-radius: 50%;
          border: 2.5px solid rgba(255, 255, 255, 0.95);
          background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 30%, rgba(255, 255, 255, 0.15) 55%, rgba(255, 255, 255, 0) 75%);
          box-shadow: 0 0 16px var(--bubble-color, #fbbf24), inset 0 0 12px rgba(255, 255, 255, 0.9);
          animation: candyBubbleExpand 0.32s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
          will-change: transform, opacity;
          z-index: 10;
        }

        .candy-bubble-gleam {
          position: absolute;
          top: 14%;
          left: 20%;
          width: 26%;
          height: 18%;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.95);
          transform: rotate(-30deg);
          filter: blur(0.5px);
        }

        .candy-pop-mesh {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: candyPopVanishAnim 0.30s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: transform, opacity;
          z-index: 2;
        }

        .candy-bubble-droplets {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 15;
        }

        .candy-droplet-dot {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.8);
          animation: candyDropletBurst 0.32s cubic-bezier(0.15, 0.9, 0.3, 1) forwards;
          will-change: transform, opacity;
        }
      `}</style>

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
          {level > 1 && (
            <button
              onClick={resetToLevelOne}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: '12px',
                padding: '4px 8px',
                color: '#fbcfe8',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer'
              }}
              title="Reset progress to Level 1"
            >
              Lvl 1
            </button>
          )}
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
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '3px solid #334155',
          borderRadius: '20px',
          padding: '6px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          gap: '2px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), inset 0 2px 10px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          touchAction: 'none'
        }}
      >
        {/* Render Grid Cells */}
        {board.map((row, r) =>
          row.map((candy, c) => {
            const isSelected = selectedCell?.r === r && selectedCell?.c === c;
            const isHint = hintCells?.some(h => h.r === r && h.c === c);
            const isEven = (r + c) % 2 === 0;
            const coordKey = `${r},${c}`;
            const isBursting = burstingCells && burstingCells[coordKey];

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                onTouchStart={(e) => handleTouchStart(r, c, e)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => handleTouchStart(r, c, e)}
                onMouseUp={handleTouchEnd}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '6px',
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.35)'
                    : (isEven ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.22)'),
                  border: isSelected
                    ? '2.5px solid #fbbf24'
                    : (isHint ? '2px dashed #f43f5e' : '1px solid rgba(255, 255, 255, 0.04)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  willChange: 'transform',
                  transform: isSelected ? 'scale(1.12) translateZ(0)' : (isHint ? 'scale(1.06) translateZ(0)' : 'scale(1) translateZ(0)'),
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(251, 191, 36, 0.9)' : 'none',
                  padding: '2px',
                  overflow: 'visible'
                }}
              >
                {isBursting ? (
                  <div key={`burst-${coordKey}`} className="candy-bubble-pop-cell">
                    {/* 1. Squashing & popping vanishing candy visual */}
                    <div className="candy-pop-mesh">
                      <CandyVisual candy={isBursting.candy} />
                    </div>
                    {/* 2. Expanding iridescent soap bubble wrapping the candy and bursting! */}
                    <div
                      className="candy-bubble-sphere"
                      style={{
                        '--bubble-color': isBursting.color
                      }}
                    >
                      <div className="candy-bubble-gleam" />
                    </div>
                    {/* 3. 8 Radiant sparkling droplet particles bursting outwards */}
                    <div className="candy-bubble-droplets">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
                        const rad = (deg * Math.PI) / 180;
                        const dx = Math.round(Math.cos(rad) * 26);
                        const dy = Math.round(Math.sin(rad) * 26);
                        return (
                          <span
                            key={i}
                            className="candy-droplet-dot"
                            style={{
                              '--dx': `${dx}px`,
                              '--dy': `${dy}px`,
                              background: isBursting.color,
                              boxShadow: `0 0 8px ${isBursting.color}`
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    key={candy?.dropKey || `cell-${r}-${c}-${candy?.id}`}
                    className={`candy-cell-content ${candy?.dropRows ? 'candy-dropping' : ''}`}
                    style={{
                      '--drop-rows': candy?.dropRows || 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      willChange: 'transform'
                    }}
                  >
                    <CandyVisual candy={candy} />
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
