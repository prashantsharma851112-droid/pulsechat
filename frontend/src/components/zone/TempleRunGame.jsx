import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  Trophy, RotateCcw, Zap, Volume2, VolumeX, Shield, 
  Flame, Play, ChevronLeft, ChevronRight, Award, Sparkles, X, 
  ArrowLeft, ArrowUp, ArrowDown, Magnet, Maximize2, Minimize2
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

// =========================================================================
// HIGH-FIDELITY WEB AUDIO SYNTHESIZER: TEMPLE RUN JUNGLE & SFX ENGINE
// Dynamic Tribal Drum Grooves, Demon Monkey Roars, Coin Bells, Jump/Slide Whooshes
// Zero External Audio Assets Required (100% Native Web Audio API)
// =========================================================================
const createTempleAudio = () => {
  let ctx = null;
  let drumTimer = null;
  let isMuted = false;

  const init = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  // Play tribal jungle kick/drum beat
  const playDrumStep = (freq = 80, decay = 0.12, gainVal = 0.08) => {
    if (isMuted || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + decay);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + decay);
    } catch (e) {}
  };

  // Play shaker / rattle
  const playShaker = (decay = 0.05, gainVal = 0.02) => {
    if (isMuted || !ctx) return;
    try {
      const bufferSize = ctx.sampleRate * decay;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 4000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  };

  // Continuous tribal rhythm loop that speeds up with player speed
  const startTribalMusic = (tempo = 140) => {
    init();
    stopTribalMusic();
    let step = 0;
    const interval = (60 / tempo) * 1000 / 2; // 8th notes
    drumTimer = setInterval(() => {
      if (step % 4 === 0) playDrumStep(95, 0.14, 0.1);
      else if (step % 4 === 2) playDrumStep(75, 0.12, 0.07);
      if (step % 2 === 1) playShaker(0.04, 0.025);
      step = (step + 1) % 16;
    }, interval);
  };

  const stopTribalMusic = () => {
    if (drumTimer) {
      clearInterval(drumTimer);
      drumTimer = null;
    }
  };

  // Golden Coin Ding
  const playCoinDing = (isBonus = false) => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isBonus ? 1760 : 1320, now);
      osc.frequency.setValueAtTime(isBonus ? 2640 : 1980, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {}
  };

  // Jump Whoosh
  const playJumpWhoosh = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {}
  };

  // Slide Swoosh
  const playSlideSwoosh = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.28);
    } catch (e) {}
  };

  // Demon Monkey Roar & Screech
  const playDemonRoar = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.exponentialRampToValueAtTime(65, now + 0.45);
      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.45);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {}
  };

  // Stumble Thud
  const playStumble = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {}
  };

  // Power Up Chime
  const playPowerUp = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      });
    } catch (e) {}
  };

  // Game Over Sound
  const playGameOver = () => {
    init();
    stopTribalMusic();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.6);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.7);
    } catch (e) {}
  };

  return {
    init,
    startTribalMusic,
    stopTribalMusic,
    playCoinDing,
    playJumpWhoosh,
    playSlideSwoosh,
    playDemonRoar,
    playStumble,
    playPowerUp,
    playGameOver,
    setMuted: (val) => {
      isMuted = val;
      if (val) stopTribalMusic();
    }
  };
};

export default function TempleRunGame({ onScoreUpdate, onBack }) {
  const { user } = useContext(AuthContext);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  // High-score and game settings
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'playing' | 'paused' | 'gameover'
  const [distance, setDistance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pulsechat_temple_highscore') || '0', 10);
    } catch (e) {
      return 0;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState(null); // 'magnet' | 'shield' | 'boost'
  const [powerUpTimeLeft, setPowerUpTimeLeft] = useState(0);
  const [monkeyDistance, setMonkeyDistance] = useState(100); // 100 = far, 0 = caught!

  // Touch Swipe tracking
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Core gameplay state references (mutable for 60fps performance)
  const gameRef = useRef({
    distance: 0,
    speed: 380, // Track progression speed
    coins: 0,
    score: 0,
    multiplier: 1,

    // Runner Character State
    player: {
      lane: 1, // 0 = Left, 1 = Middle, 2 = Right
      targetLane: 1,
      x: 0, // -1 to +1 normalized
      y: 0, // Jump height (0 to 1)
      yVelocity: 0,
      isJumping: false,
      isSliding: false,
      slideTimer: 0,
      stumbleTimer: 0,
      runAnimFrame: 0,
      isInvincible: false
    },

    // Demon Monkey State
    monkey: {
      distance: 100, // 100 = far, 25 = right behind runner, 0 = tackled!
      targetDistance: 100,
      lungeTimer: 0,
      roarCooldown: 0
    },

    // Power-up States
    powerUp: {
      type: null,
      duration: 0,
      maxDuration: 0
    },

    // 3D Track Segments
    segments: [],
    segmentLength: 60,
    maxSegments: 60,

    // Active Spawns (Obstacles, Coins, Power-ups)
    obstacles: [],
    coinsList: [],
    particles: [],

    // Corner / Turn System
    upcomingTurn: null, // { z: number, direction: 'left' | 'right', completed: false }

    lastTimestamp: 0,
    running: false
  });

  // Initialize Web Audio Engine
  useEffect(() => {
    audioRef.current = createTempleAudio();
    return () => {
      if (audioRef.current) {
        audioRef.current.stopTribalMusic();
      }
    };
  }, []);

  const toggleSound = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.setMuted(next);
      return next;
    });
  };

  // =========================================================================
  // LANE & MOVE ACTIONS
  // =========================================================================
  const moveLeft = useCallback(() => {
    const g = gameRef.current;
    if (g.upcomingTurn && Math.abs(g.upcomingTurn.z - 280) < 160 && g.upcomingTurn.direction === 'left') {
      // Execute 90 Degree Temple Left Turn!
      g.upcomingTurn.completed = true;
      if (audioRef.current) audioRef.current.playJumpWhoosh();
      spawnTurnConfetti();
      g.upcomingTurn = null;
      return;
    }
    if (g.player.targetLane > 0) {
      g.player.targetLane -= 1;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const moveRight = useCallback(() => {
    const g = gameRef.current;
    if (g.upcomingTurn && Math.abs(g.upcomingTurn.z - 280) < 160 && g.upcomingTurn.direction === 'right') {
      // Execute 90 Degree Temple Right Turn!
      g.upcomingTurn.completed = true;
      if (audioRef.current) audioRef.current.playJumpWhoosh();
      spawnTurnConfetti();
      g.upcomingTurn = null;
      return;
    }
    if (g.player.targetLane < 2) {
      g.player.targetLane += 1;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.player.isJumping && !g.player.isSliding) {
      g.player.isJumping = true;
      g.player.yVelocity = 1.05;
      if (audioRef.current) audioRef.current.playJumpWhoosh();
    }
  }, []);

  const slide = useCallback(() => {
    const g = gameRef.current;
    if (!g.player.isSliding) {
      // If jumping, dive downward immediately
      if (g.player.isJumping) {
        g.player.y = 0;
        g.player.yVelocity = 0;
        g.player.isJumping = false;
      }
      g.player.isSliding = true;
      g.player.slideTimer = 0.75; // slide duration in seconds
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const spawnTurnConfetti = () => {
    const g = gameRef.current;
    for (let i = 0; i < 20; i++) {
      g.particles.push({
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 1.5,
        z: 280,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        color: ['#fbbf24', '#f59e0b', '#10b981', '#38bdf8'][Math.floor(Math.random() * 4)],
        life: 0.6
      });
    }
  };

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') {
        if (e.code === 'Space' || e.code === 'Enter') {
          startGame();
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        moveLeft();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        moveRight();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slide();
      } else if (e.code === 'KeyP') {
        setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, moveLeft, moveRight, jump, slide]);

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dt = Date.now() - touchStartRef.current.time;

    if (dt > 600) return; // Too slow for swipe

    if (Math.max(absX, absY) > 25) {
      if (absX > absY) {
        // Horizontal swipe
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        // Vertical swipe
        if (dy > 0) slide();
        else jump();
      }
    }
  };

  // =========================================================================
  // GAME INITIALIZATION & SPAWN LOGIC
  // =========================================================================
  const startGame = () => {
    const g = gameRef.current;
    g.distance = 0;
    g.speed = 420;
    g.coins = 0;
    g.score = 0;
    g.multiplier = 1;

    g.player.lane = 1;
    g.player.targetLane = 1;
    g.player.x = 0;
    g.player.y = 0;
    g.player.yVelocity = 0;
    g.player.isJumping = false;
    g.player.isSliding = false;
    g.player.slideTimer = 0;
    g.player.stumbleTimer = 0;
    g.player.isInvincible = false;

    g.monkey.distance = 100;
    g.monkey.targetDistance = 100;
    g.monkey.lungeTimer = 0;
    g.monkey.roarCooldown = 0;

    g.powerUp.type = null;
    g.powerUp.duration = 0;

    g.obstacles = [];
    g.coinsList = [];
    g.particles = [];
    g.upcomingTurn = null;

    // Build initial track segments
    g.segments = [];
    for (let i = 0; i < g.maxSegments; i++) {
      g.segments.push({
        z: i * g.segmentLength,
        hasTorches: i % 4 === 0,
        curve: 0
      });
    }

    setDistance(0);
    setCoins(0);
    setScore(0);
    setActivePowerUp(null);
    setPowerUpTimeLeft(0);
    setMonkeyDistance(100);
    setGameState('playing');

    if (audioRef.current) {
      audioRef.current.init();
      audioRef.current.startTribalMusic(140);
    }
  };

  // =========================================================================
  // MAIN ANIMATION & SIMULATION LOOP
  // =========================================================================
  useEffect(() => {
    let animId = null;

    const gameLoop = (timestamp) => {
      const g = gameRef.current;
      if (!g.lastTimestamp) g.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - g.lastTimestamp) / 1000, 0.1);
      g.lastTimestamp = timestamp;

      if (gameState === 'playing') {
        updateGame(dt);
      }
      renderGame();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  // =========================================================================
  // GAMEPLAY PHYSICS & LOGIC UPDATE
  // =========================================================================
  const updateGame = (dt) => {
    const g = gameRef.current;

    // 1. Advance Distance & Speed Progression
    const currentSpeed = g.powerUp.type === 'boost' ? g.speed * 1.6 : g.speed;
    g.distance += (currentSpeed * dt) / 10;
    // Gradually increase base speed up to 750
    g.speed = Math.min(750, 420 + g.distance * 0.08);

    setDistance(Math.floor(g.distance));
    const computedScore = Math.floor(g.distance * 1.5 + g.coins * 10) * g.multiplier;
    g.score = computedScore;
    setScore(computedScore);

    // 2. Smooth Lane Interpolation (-1 for Left, 0 for Middle, 1 for Right)
    const targetX = (g.player.targetLane - 1) * 0.85;
    g.player.x += (targetX - g.player.x) * (dt * 14);

    // 3. Jump Physics
    if (g.player.isJumping) {
      g.player.y += g.player.yVelocity * dt * 2.8;
      g.player.yVelocity -= 3.8 * dt; // Gravity
      if (g.player.y <= 0) {
        g.player.y = 0;
        g.player.yVelocity = 0;
        g.player.isJumping = false;
        // Landing dust particles
        for (let i = 0; i < 6; i++) {
          g.particles.push({
            x: g.player.x + (Math.random() - 0.5) * 0.4,
            y: 0,
            z: 220,
            vx: (Math.random() - 0.5) * 1.5,
            vy: Math.random() * 0.8 + 0.2,
            color: 'rgba(217, 119, 6, 0.5)',
            life: 0.3
          });
        }
      }
    }

    // 4. Slide Timer
    if (g.player.isSliding) {
      g.player.slideTimer -= dt;
      // Sliding ground dust
      g.particles.push({
        x: g.player.x + (Math.random() - 0.5) * 0.3,
        y: 0,
        z: 220,
        vx: (Math.random() - 0.5) * 1,
        vy: Math.random() * 0.5,
        color: 'rgba(245, 158, 11, 0.4)',
        life: 0.25
      });
      if (g.player.slideTimer <= 0) {
        g.player.isSliding = false;
      }
    }

    // 5. Run Animation Cycles
    g.player.runAnimFrame += dt * (currentSpeed / 45);

    // 6. Stumble Recovery & Demon Monkey Distance Simulation
    if (g.player.stumbleTimer > 0) {
      g.player.stumbleTimer -= dt;
    }

    // Monkey chases runner:
    if (g.player.stumbleTimer > 0) {
      g.monkey.targetDistance = 25; // Close behind!
    } else {
      g.monkey.targetDistance = 100; // Far behind
    }
    g.monkey.distance += (g.monkey.targetDistance - g.monkey.distance) * (dt * 1.5);
    setMonkeyDistance(Math.round(g.monkey.distance));

    // Demon Monkey roar when close
    g.monkey.roarCooldown -= dt;
    if (g.monkey.distance < 45 && g.monkey.roarCooldown <= 0) {
      if (audioRef.current) audioRef.current.playDemonRoar();
      g.monkey.roarCooldown = 5.0; // roar every 5s if close
    }

    // 7. Power-up Expiration
    if (g.powerUp.type) {
      g.powerUp.duration -= dt;
      setPowerUpTimeLeft(Math.ceil(g.powerUp.duration));
      if (g.powerUp.duration <= 0) {
        g.powerUp.type = null;
        setActivePowerUp(null);
      }
    }

    // 8. Track Segment Advancement
    const forwardMovement = currentSpeed * dt;
    g.segments.forEach(seg => {
      seg.z -= forwardMovement;
    });

    // Recycle segments that pass camera
    if (g.segments[0].z < 0) {
      const removed = g.segments.shift();
      const lastZ = g.segments[g.segments.length - 1].z;
      removed.z = lastZ + g.segmentLength;
      g.segments.push(removed);

      // Randomly spawn upcoming 90° Turn every ~350m
      if (!g.upcomingTurn && g.distance > 80 && Math.random() < 0.08) {
        g.upcomingTurn = {
          z: removed.z,
          direction: Math.random() < 0.5 ? 'left' : 'right',
          completed: false
        };
      }

      // Spawn Obstacles & Coins on fresh segments
      spawnTrackElements(removed.z);
    }

    // Check Turn Deadline: If player missed turning at corner!
    if (g.upcomingTurn) {
      g.upcomingTurn.z -= forwardMovement;
      if (g.upcomingTurn.z < 210 && !g.upcomingTurn.completed) {
        // Crashed into temple wall / fell off cliff corner!
        triggerGameOver('Fell off ancient temple corner!');
        return;
      }
    }

    // 9. Update & Collide Obstacles
    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const obs = g.obstacles[i];
      obs.z -= forwardMovement;

      // Check Collision with Player at z ~ 220
      if (obs.z > 200 && obs.z < 250 && !obs.hit) {
        const laneMatches = obs.lane === 'all' || obs.lane === g.player.targetLane;
        if (laneMatches) {
          let avoidsObstacle = false;

          // JUMP Obstacles: Fallen Log, Spike Trap, Low Stone Hurdle, Cliff Gap
          if (obs.type === 'log' || obs.type === 'spikes' || obs.type === 'gap') {
            if (g.player.isJumping && g.player.y > 0.42) {
              avoidsObstacle = true;
            }
          }
          // SLIDE Obstacles: Low Fire Ring, Temple Gate Arch
          else if (obs.type === 'fire_ring' || obs.type === 'gate') {
            if (g.player.isSliding) {
              avoidsObstacle = true;
            }
          }

          if (!avoidsObstacle) {
            obs.hit = true;

            // Shield or Mega Boost absorbs obstacle hit!
            if (g.powerUp.type === 'shield' || g.powerUp.type === 'boost') {
              if (g.powerUp.type === 'shield') {
                g.powerUp.type = null;
                setActivePowerUp(null);
              }
              // Spawn smash explosion particles
              for (let p = 0; p < 15; p++) {
                g.particles.push({
                  x: g.player.x + (Math.random() - 0.5) * 0.8,
                  y: 0.5 + Math.random() * 0.8,
                  z: obs.z,
                  vx: (Math.random() - 0.5) * 4,
                  vy: Math.random() * 3 + 1,
                  color: '#fbbf24',
                  life: 0.45
                });
              }
              if (audioRef.current) audioRef.current.playStumble();
            } else {
              // Direct Hit or Stumble
              if (obs.type === 'gap') {
                // Falling down abyss is instant game over!
                triggerGameOver('Fell into ancient temple abyss!');
                return;
              }

              // Stumble penalty: if monkey is already right behind, monkey catches runner!
              if (g.monkey.distance < 40) {
                triggerGameOver('Demon Monkey captured the adventurer!');
                return;
              } else {
                // First stumble: monkey rushes forward!
                g.player.stumbleTimer = 3.5;
                g.monkey.distance = 25;
                if (audioRef.current) {
                  audioRef.current.playStumble();
                  audioRef.current.playDemonRoar();
                }
              }
            }
          }
        }
      }

      // Remove behind camera
      if (obs.z < 10) {
        g.obstacles.splice(i, 1);
      }
    }

    // 10. Update & Collect Coins & Power-ups
    for (let i = g.coinsList.length - 1; i >= 0; i--) {
      const c = g.coinsList[i];
      c.z -= forwardMovement;
      c.rot = (c.rot || 0) + dt * 6;

      // Coin Magnet Effect: pull toward player
      if (g.powerUp.type === 'magnet' && c.type === 'coin') {
        const targetX = (g.player.targetLane - 1) * 0.85;
        c.x += (targetX - c.x) * (dt * 12);
        if (c.z > 220) c.z -= 180 * dt;
      }

      // Collect Check
      const laneMatches = Math.abs(c.lane - g.player.targetLane) < 0.6;
      if (c.z > 190 && c.z < 250 && laneMatches) {
        if (c.type === 'coin') {
          g.coins += c.value || 1;
          setCoins(g.coins);
          if (audioRef.current) audioRef.current.playCoinDing(c.value > 1);

          // Collect sparkles
          for (let p = 0; p < 4; p++) {
            g.particles.push({
              x: c.x,
              y: 0.6 + Math.random() * 0.4,
              z: c.z,
              vx: (Math.random() - 0.5) * 2,
              vy: Math.random() * 2 + 0.5,
              color: c.color || '#fbbf24',
              life: 0.35
            });
          }
        } else if (c.type === 'powerup') {
          // Collect Power-up (Magnet, Shield, Boost)
          g.powerUp.type = c.subType;
          g.powerUp.duration = 10;
          g.powerUp.maxDuration = 10;
          setActivePowerUp(c.subType);
          setPowerUpTimeLeft(10);
          if (audioRef.current) audioRef.current.playPowerUp();
        }

        g.coinsList.splice(i, 1);
        continue;
      }

      // Remove behind camera
      if (c.z < 10) {
        g.coinsList.splice(i, 1);
      }
    }

    // 11. Update Visual Particles
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        g.particles.splice(i, 1);
      }
    }
  };

  // =========================================================================
  // PROCEDURAL TRACK ELEMENT GENERATION
  // =========================================================================
  const spawnTrackElements = (zPos) => {
    const g = gameRef.current;
    if (zPos < 600) return; // Don't spawn too close to start

    // 1. Spawn Obstacles (~35% chance)
    if (Math.random() < 0.35) {
      const types = ['log', 'fire_ring', 'spikes', 'gate', 'gap'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const lane = chosenType === 'gap' || chosenType === 'fire_ring'
        ? 'all' // Full width obstacle requiring jump or slide
        : Math.floor(Math.random() * 3); // 0, 1, or 2

      g.obstacles.push({
        z: zPos,
        lane,
        type: chosenType,
        hit: false
      });
      return; // Don't overlap with coins
    }

    // 2. Spawn Power-ups (~4% chance)
    if (Math.random() < 0.04) {
      const powerTypes = ['magnet', 'shield', 'boost'];
      const subType = powerTypes[Math.floor(Math.random() * powerTypes.length)];
      const lane = Math.floor(Math.random() * 3);
      g.coinsList.push({
        z: zPos,
        lane,
        x: (lane - 1) * 0.85,
        type: 'powerup',
        subType,
        color: subType === 'magnet' ? '#ef4444' : subType === 'shield' ? '#3b82f6' : '#f59e0b'
      });
      return;
    }

    // 3. Spawn Coin Runs (~40% chance)
    if (Math.random() < 0.40) {
      const coinLane = Math.floor(Math.random() * 3);
      const isSpecial = Math.random() < 0.15;
      const coinVal = isSpecial ? (Math.random() < 0.5 ? 2 : 5) : 1;
      const coinColor = coinVal === 5 ? '#38bdf8' : coinVal === 2 ? '#ef4444' : '#fbbf24';

      // Line of 4 coins along the lane
      for (let c = 0; c < 4; c++) {
        g.coinsList.push({
          z: zPos + c * 35,
          lane: coinLane,
          x: (coinLane - 1) * 0.85,
          type: 'coin',
          value: coinVal,
          color: coinColor,
          rot: c * 0.5
        });
      }
    }
  };

  // =========================================================================
  // GAME OVER HANDLER & LEADERBOARD SUBMISSION
  // =========================================================================
  const triggerGameOver = (reason = '') => {
    const g = gameRef.current;
    setGameState('gameover');

    if (audioRef.current) {
      audioRef.current.playGameOver();
    }

    const finalScore = g.score;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      try {
        localStorage.setItem('pulsechat_temple_highscore', String(finalScore));
      } catch (e) {}
    }

    // Submit to server leaderboard & streak quest
    if (onScoreUpdate) {
      const levelEarned = Math.max(1, Math.floor(g.distance / 250));
      onScoreUpdate('Temple Run 3D', finalScore, levelEarned);
    }
  };

  // =========================================================================
  // 3D PERSPECTIVE RENDERING ENGINE (HTML5 CANVAS)
  // Vanishing point horizon, stone bridge textures, character & demon monkey
  // =========================================================================
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const g = gameRef.current;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Dynamic Ancient Jungle Horizon & Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.5);
    skyGrad.addColorStop(0, '#091e14'); // Deep ancient rainforest canopy
    skyGrad.addColorStop(0.5, '#1e3a2f');
    skyGrad.addColorStop(1, '#d97706'); // Setting Aztec golden sun horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.5);

    // Parallax Ancient Mayan Pyramid Peaks in Distance
    ctx.fillStyle = '#0f241a';
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * 0.5);
    ctx.lineTo(width * 0.32, height * 0.28);
    ctx.lineTo(width * 0.48, height * 0.5);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.55, height * 0.5);
    ctx.lineTo(width * 0.72, height * 0.24);
    ctx.lineTo(width * 0.88, height * 0.5);
    ctx.fill();

    // Jungle Abyss / Mist under the stone bridge
    const abyssGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    abyssGrad.addColorStop(0, '#06130e');
    abyssGrad.addColorStop(0.6, '#040d0a');
    abyssGrad.addColorStop(1, '#020705');
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    // 3D Camera Projection Helper
    const vanishingX = width * 0.5;
    const vanishingY = height * 0.44;
    const fov = 400;

    const project = (x3d, y3d, z3d) => {
      if (z3d <= 0) z3d = 0.1;
      const scale = fov / z3d;
      const screenX = vanishingX + x3d * scale * 260;
      const screenY = vanishingY + y3d * scale * 260 + (height * 0.32);
      return { x: screenX, y: screenY, scale };
    };

    // 2. Render 3D Stone Pathway Segments (Back to Front)
    for (let i = g.segments.length - 2; i >= 0; i--) {
      const seg1 = g.segments[i + 1];
      const seg2 = g.segments[i];

      const p1Left = project(-1.3, 0.45, seg1.z);
      const p1Right = project(1.3, 0.45, seg1.z);
      const p2Left = project(-1.3, 0.45, seg2.z);
      const p2Right = project(1.3, 0.45, seg2.z);

      // Check if this segment is a broken cliff gap!
      const hasGap = g.obstacles.some(o => o.type === 'gap' && Math.abs(o.z - seg2.z) < 40);

      if (!hasGap) {
        // Ancient Stone Pathway Deck
        const isAlt = (Math.floor(seg2.z / g.segmentLength) % 2) === 0;
        ctx.fillStyle = isAlt ? '#453a29' : '#3d3222'; // Ancient mossy stone brick colors
        ctx.beginPath();
        ctx.moveTo(p1Left.x, p1Left.y);
        ctx.lineTo(p1Right.x, p1Right.y);
        ctx.lineTo(p2Right.x, p2Right.y);
        ctx.lineTo(p2Left.x, p2Left.y);
        ctx.closePath();
        ctx.fill();

        // Stone Brick Mortar Dividers
        ctx.strokeStyle = 'rgba(20, 16, 10, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 3-Lane Track Markings (Ancient Carved Runes)
        for (let lane = 0; lane < 3; lane++) {
          const laneCenterX = (lane - 1) * 0.85;
          const p1Rune = project(laneCenterX, 0.44, seg1.z);
          const p2Rune = project(laneCenterX, 0.44, seg2.z);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.12)';
          ctx.lineWidth = Math.max(1, 2 * p2Rune.scale);
          ctx.beginPath();
          ctx.moveTo(p1Rune.x, p1Rune.y);
          ctx.lineTo(p2Rune.x, p2Rune.y);
          ctx.stroke();
        }

        // Left & Right Stone Curbs / Moss Balustrades
        const curbDepth = 18 * p2Left.scale;
        ctx.fillStyle = '#2d2417';
        // Left curb
        ctx.fillRect(p2Left.x - curbDepth, p2Left.y - curbDepth, curbDepth, curbDepth * 1.5);
        // Right curb
        ctx.fillRect(p2Right.x, p2Right.y - curbDepth, curbDepth, curbDepth * 1.5);

        // Moss Highlights on stone edge
        ctx.fillStyle = '#166534';
        ctx.fillRect(p2Left.x - curbDepth, p2Left.y - curbDepth, curbDepth * 0.35, curbDepth * 0.5);
        ctx.fillRect(p2Right.x + curbDepth * 0.65, p2Right.y - curbDepth, curbDepth * 0.35, curbDepth * 0.5);
      } else {
        // Abyss Gap Glow (Mist / Waterfall Depth)
        ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
        ctx.beginPath();
        ctx.moveTo(p1Left.x, p1Left.y);
        ctx.lineTo(p1Right.x, p1Right.y);
        ctx.lineTo(p2Right.x, p2Right.y);
        ctx.lineTo(p2Left.x, p2Left.y);
        ctx.closePath();
        ctx.fill();
      }

      // Flaming Torch Pillars along path
      if (seg2.hasTorches && !hasGap) {
        const torchL = project(-1.55, 0.05, seg2.z);
        const torchR = project(1.55, 0.05, seg2.z);
        const torchScale = 22 * torchL.scale;

        [torchL, torchR].forEach(tPos => {
          // Stone Pillar
          ctx.fillStyle = '#221910';
          ctx.fillRect(tPos.x - torchScale * 0.3, tPos.y, torchScale * 0.6, torchScale * 2.5);

          // Torch Flame
          const flameFlicker = Math.sin(Date.now() * 0.02 + seg2.z) * 4;
          const flameGrad = ctx.createRadialGradient(
            tPos.x, tPos.y - torchScale * 0.4, 1,
            tPos.x, tPos.y - torchScale * 0.4, torchScale * 1.2
          );
          flameGrad.addColorStop(0, '#fff');
          flameGrad.addColorStop(0.3, '#fbbf24');
          flameGrad.addColorStop(0.7, '#ea580c');
          flameGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.arc(tPos.x + flameFlicker * 0.3, tPos.y - torchScale * 0.4, torchScale, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // 3. Render Upcoming 90° Turn Sign
    if (g.upcomingTurn) {
      const turnPos = project(0, -0.6, g.upcomingTurn.z);
      if (turnPos.scale > 0.05) {
        const signW = 120 * turnPos.scale;
        const signH = 45 * turnPos.scale;
        ctx.fillStyle = 'rgba(234, 88, 12, 0.9)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(turnPos.x - signW / 2, turnPos.y - signH / 2, signW, signH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, 16 * turnPos.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const arrow = g.upcomingTurn.direction === 'left' ? '⬅️ TURN LEFT' : 'TURN RIGHT ➡️';
        ctx.fillText(arrow, turnPos.x, turnPos.y);
      }
    }

    // 4. Render 3D Obstacles
    g.obstacles.forEach(obs => {
      const laneX = obs.lane === 'all' ? 0 : (obs.lane - 1) * 0.85;
      const obsPos = project(laneX, 0.38, obs.z);
      const scale = obsPos.scale;
      if (scale <= 0.03 || obs.type === 'gap') return;

      if (obs.type === 'log') {
        // Ancient Fallen Tree Trunk with moss
        const logW = (obs.lane === 'all' ? 220 : 85) * scale;
        const logH = 26 * scale;
        ctx.fillStyle = '#5c3a21'; // Brown Bark
        ctx.beginPath();
        ctx.roundRect(obsPos.x - logW / 2, obsPos.y - logH, logW, logH, 6);
        ctx.fill();

        // Moss patches on log
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(obsPos.x - logW * 0.3, obsPos.y - logH, logW * 0.4, logH * 0.3);
      } else if (obs.type === 'spikes') {
        // Low Stone Barrier with Sharp Spikes
        const barW = 80 * scale;
        const barH = 32 * scale;
        ctx.fillStyle = '#374151';
        ctx.fillRect(obsPos.x - barW / 2, obsPos.y - barH * 0.5, barW, barH * 0.5);

        // Metal / Bone Spikes
        ctx.fillStyle = '#e5e7eb';
        const spikeCount = 5;
        const step = barW / spikeCount;
        for (let s = 0; s < spikeCount; s++) {
          const sx = obsPos.x - barW / 2 + s * step;
          ctx.beginPath();
          ctx.moveTo(sx, obsPos.y - barH * 0.5);
          ctx.lineTo(sx + step / 2, obsPos.y - barH);
          ctx.lineTo(sx + step, obsPos.y - barH * 0.5);
          ctx.fill();
        }
      } else if (obs.type === 'fire_ring') {
        // Low Flaming Stone Arch (Must Slide!)
        const archW = 190 * scale;
        const archH = 95 * scale;
        ctx.fillStyle = '#1f2937';
        // Left pillar
        ctx.fillRect(obsPos.x - archW / 2, obsPos.y - archH, 20 * scale, archH);
        // Right pillar
        ctx.fillRect(obsPos.x + archW / 2 - 20 * scale, obsPos.y - archH, 20 * scale, archH);
        // Top lintel
        ctx.fillRect(obsPos.x - archW / 2, obsPos.y - archH, archW, 22 * scale);

        // Blazing Ring of Fire across the middle (Clearance underneath for slide!)
        const fireGrad = ctx.createRadialGradient(
          obsPos.x, obsPos.y - archH * 0.55, 10 * scale,
          obsPos.x, obsPos.y - archH * 0.55, 55 * scale
        );
        fireGrad.addColorStop(0, '#fff');
        fireGrad.addColorStop(0.3, '#fbbf24');
        fireGrad.addColorStop(0.8, '#ef4444');
        fireGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(obsPos.x, obsPos.y - archH * 0.55, 45 * scale, 0, Math.PI * 2);
        ctx.fill();

        // "SLIDE" warning icon
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(9, 13 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⬇️ SLIDE', obsPos.x, obsPos.y - archH * 0.55);
      } else if (obs.type === 'gate') {
        // Crumbling ancient portcullis (Slide underneath)
        const gateW = 90 * scale;
        const gateH = 80 * scale;
        ctx.fillStyle = '#451a03';
        ctx.fillRect(obsPos.x - gateW / 2, obsPos.y - gateH, gateW, 40 * scale);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(obsPos.x - gateW / 2, obsPos.y - gateH, gateW, 10 * scale);
      }
    });

    // 5. Render 3D Spinning Golden Coins & Power-ups
    g.coinsList.forEach(c => {
      const cPos = project(c.x, 0.15, c.z);
      const scale = cPos.scale;
      if (scale <= 0.03) return;

      if (c.type === 'coin') {
        // Rotating 3D Coin (Width compressed by cosine of rotation)
        const coinW = Math.max(2, Math.abs(Math.cos(c.rot)) * 24 * scale);
        const coinH = 24 * scale;

        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(cPos.x, cPos.y, coinW, coinH, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner Golden Sparkle Ring
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Central Temple Emblem Dot
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(cPos.x, cPos.y, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.type === 'powerup') {
        // Glowing Floating Power-up Orb
        const orbR = 24 * scale;
        const orbGrad = ctx.createRadialGradient(cPos.x, cPos.y, 2, cPos.x, cPos.y, orbR);
        orbGrad.addColorStop(0, '#fff');
        orbGrad.addColorStop(0.5, c.color);
        orbGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(cPos.x, cPos.y, orbR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.max(12, 18 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = c.subType === 'magnet' ? '🧲' : c.subType === 'shield' ? '🛡️' : '⚡';
        ctx.fillText(icon, cPos.x, cPos.y);
      }
    });

    // 6. Render Adventurer Runner Character (Player at z ~ 220)
    const pPos = project(g.player.x, 0.44 - g.player.y * 0.9, 220);
    const pScale = pPos.scale;

    // Player Shadow on track
    const shadowPos = project(g.player.x, 0.44, 220);
    const shadowW = (g.player.isSliding ? 45 : 30) * shadowPos.scale * (1 - g.player.y * 0.4);
    const shadowH = 12 * shadowPos.scale * (1 - g.player.y * 0.4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(shadowPos.x, shadowPos.y, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invincible / Shield Aura
    if (g.powerUp.type === 'shield' || g.powerUp.type === 'boost') {
      const auraColor = g.powerUp.type === 'shield' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(245, 158, 11, 0.55)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(pPos.x, pPos.y - 35 * pScale, 55 * pScale, 0, Math.PI * 2);
      ctx.fill();
    }

    // DRAW RUNNER BODY & LIMBS
    const charW = 28 * pScale;
    const charH = 65 * pScale;
    const legPhase = Math.sin(g.player.runAnimFrame * 2);
    const armPhase = Math.cos(g.player.runAnimFrame * 2);

    if (g.player.isSliding) {
      // SLIDING LOW POSE
      ctx.fillStyle = '#b45309'; // Explorer Khaki / Leather
      ctx.beginPath();
      ctx.roundRect(pPos.x - charW * 1.2, pPos.y - charH * 0.4, charW * 2.4, charH * 0.35, 6);
      ctx.fill();

      // Explorer Hat sliding
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(pPos.x + charW * 0.8, pPos.y - charH * 0.42, 14 * pScale, 7 * pScale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // NORMAL RUNNING / JUMPING POSE

      // Legs (Swinging animated)
      const legL = legPhase * 16 * pScale;
      const legR = -legPhase * 16 * pScale;
      ctx.strokeStyle = '#3b82f6'; // Denim shorts / trousers
      ctx.lineWidth = 6 * pScale;
      ctx.lineCap = 'round';

      // Left leg
      ctx.beginPath();
      ctx.moveTo(pPos.x - charW * 0.25, pPos.y - charH * 0.35);
      ctx.lineTo(pPos.x - charW * 0.25 + (g.player.isJumping ? -8 * pScale : legL * 0.5), pPos.y);
      ctx.stroke();

      // Right leg
      ctx.beginPath();
      ctx.moveTo(pPos.x + charW * 0.25, pPos.y - charH * 0.35);
      ctx.lineTo(pPos.x + charW * 0.25 + (g.player.isJumping ? 8 * pScale : legR * 0.5), pPos.y);
      ctx.stroke();

      // Explorer Boots
      ctx.fillStyle = '#451a03';
      ctx.fillRect(pPos.x - charW * 0.35 + (g.player.isJumping ? -8 * pScale : legL * 0.5), pPos.y - 4 * pScale, 8 * pScale, 6 * pScale);
      ctx.fillRect(pPos.x + charW * 0.15 + (g.player.isJumping ? 8 * pScale : legR * 0.5), pPos.y - 4 * pScale, 8 * pScale, 6 * pScale);

      // Torso (Brown Explorer Jacket)
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.roundRect(pPos.x - charW * 0.45, pPos.y - charH * 0.72, charW * 0.9, charH * 0.4, 4);
      ctx.fill();

      // Satchel Bag (Carrying the Golden Idol!)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(pPos.x + charW * 0.25, pPos.y - charH * 0.48, 6 * pScale, 0, Math.PI * 2);
      ctx.fill();

      // Arms (Pumping)
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 5 * pScale;
      // Left arm
      ctx.beginPath();
      ctx.moveTo(pPos.x - charW * 0.45, pPos.y - charH * 0.65);
      ctx.lineTo(pPos.x - charW * 0.75, pPos.y - charH * 0.5 + armPhase * 10 * pScale);
      ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.moveTo(pPos.x + charW * 0.45, pPos.y - charH * 0.65);
      ctx.lineTo(pPos.x + charW * 0.75, pPos.y - charH * 0.5 - armPhase * 10 * pScale);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#fed7aa'; // Skin tone
      ctx.beginPath();
      ctx.arc(pPos.x, pPos.y - charH * 0.85, 11 * pScale, 0, Math.PI * 2);
      ctx.fill();

      // Iconic Explorer Fedora Hat
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(pPos.x, pPos.y - charH * 0.94, 18 * pScale, 6 * pScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(pPos.x - 9 * pScale, pPos.y - charH * 1.05, 18 * pScale, 12 * pScale);
    }

    // 7. Render Demon Monkey Pursuer Behind Runner
    // Position determined by g.monkey.distance:
    // When distance = 100, monkey is far (z ~ 160). When distance = 25, monkey is close (z ~ 205)!
    const monkeyZ = 220 - (g.monkey.distance * 0.65);
    const mPos = project(g.player.x * 0.7, 0.46, monkeyZ);
    const mScale = mPos.scale;

    if (mPos.scale > 0.05) {
      const monW = 55 * mScale;
      const monH = 65 * mScale;

      // Demon Monkey Fur Body
      ctx.fillStyle = '#1c1917'; // Midnight Black Gorilla Fur
      ctx.beginPath();
      ctx.roundRect(mPos.x - monW * 0.5, mPos.y - monH * 0.8, monW, monH * 0.8, 8);
      ctx.fill();

      // Pounding Gorilla Arms (Alternating sprint crawl)
      const monkeyArmL = Math.sin(g.player.runAnimFrame * 2.4) * 20 * mScale;
      const monkeyArmR = -Math.sin(g.player.runAnimFrame * 2.4) * 20 * mScale;
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 14 * mScale;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(mPos.x - monW * 0.5, mPos.y - monH * 0.5);
      ctx.lineTo(mPos.x - monW * 0.8, mPos.y + monkeyArmL);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mPos.x + monW * 0.5, mPos.y - monH * 0.5);
      ctx.lineTo(mPos.x + monW * 0.8, mPos.y + monkeyArmR);
      ctx.stroke();

      // Demonic Glowing Red Eyes
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12 * mScale;
      ctx.beginPath();
      ctx.arc(mPos.x - 10 * mScale, mPos.y - monH * 0.65, 4 * mScale, 0, Math.PI * 2);
      ctx.arc(mPos.x + 10 * mScale, mPos.y - monH * 0.65, 4 * mScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Demon Curved Horns
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 5 * mScale;
      ctx.beginPath();
      ctx.moveTo(mPos.x - 14 * mScale, mPos.y - monH * 0.8);
      ctx.quadraticCurveTo(mPos.x - 26 * mScale, mPos.y - monH * 1.05, mPos.x - 18 * mScale, mPos.y - monH * 1.15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mPos.x + 14 * mScale, mPos.y - monH * 0.8);
      ctx.quadraticCurveTo(mPos.x + 26 * mScale, mPos.y - monH * 1.05, mPos.x + 18 * mScale, mPos.y - monH * 1.15);
      ctx.stroke();
    }

    // 8. Render Visual Particles (Dust, Sparkles, Embers)
    g.particles.forEach(p => {
      const partPos = project(p.x, p.y, p.z);
      if (partPos.scale <= 0.02) return;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(partPos.x, partPos.y, Math.max(1.5, 4 * partPos.scale), 0, Math.PI * 2);
      ctx.fill();
    });
  };

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        width: '100%',
        height: isFullscreen ? '100dvh' : '520px',
        maxWidth: isFullscreen ? '100%' : '900px',
        margin: '0 auto',
        borderRadius: isFullscreen ? 0 : '20px',
        overflow: 'hidden',
        background: '#040d0a',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(245, 158, 11, 0.25)',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top HUD Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 20,
        color: '#fff'
      }}>
        {/* Left: Back & Distance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🏃 Distance Run
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>
              {distance}m
            </span>
          </div>
        </div>

        {/* Center: Demon Monkey Danger Meter */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 12px',
          borderRadius: '14px',
          border: '1px solid rgba(239, 68, 68, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: monkeyDistance < 40 ? '#ef4444' : '#f59e0b', fontWeight: 900 }}>
            <span>👹 Demon Monkey</span>
            <span>{monkeyDistance < 40 ? '⚠️ DANGER!' : 'BEHIND'}</span>
          </div>
          <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${100 - monkeyDistance}%`,
              height: '100%',
              background: monkeyDistance < 40 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : '#10b981',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>

        {/* Right: Golden Coins, Score & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
            <span style={{ fontSize: '1rem' }}>🪙</span>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#fbbf24', fontFamily: 'monospace' }}>
              {coins}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={toggleSound}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Active Power-up Banner */}
      {activePowerUp && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(234, 88, 12, 0.9))',
          padding: '6px 16px',
          borderRadius: '20px',
          color: '#fff',
          fontWeight: 900,
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.5)'
        }}>
          <span>{activePowerUp === 'magnet' ? '🧲 COIN MAGNET ACTIVE' : activePowerUp === 'shield' ? '🛡️ TEMPLE SHIELD' : '⚡ MEGA SPRINT BOOST'}</span>
          <span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
            {powerUpTimeLeft}s
          </span>
        </div>
      )}

      {/* 3D Canvas Viewport */}
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover'
        }}
      />

      {/* Mobile On-Screen D-Pad / Move Controls */}
      {gameState === 'playing' && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          zIndex: 30
        }}>
          {/* Left / Right Movement Buttons */}
          <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={moveLeft}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '2px solid rgba(251, 191, 36, 0.6)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={30} color="#fbbf24" />
            </button>
            <button
              type="button"
              onClick={moveRight}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '2px solid rgba(251, 191, 36, 0.6)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={30} color="#fbbf24" />
            </button>
          </div>

          {/* Jump / Slide Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={slide}
              style={{
                width: '62px',
                height: '62px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.85), rgba(194, 65, 12, 0.85))',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.68rem',
                boxShadow: '0 4px 18px rgba(234, 88, 12, 0.5)',
                cursor: 'pointer'
              }}
            >
              <ArrowDown size={22} color="#fff" />
              SLIDE
            </button>

            <button
              type="button"
              onClick={jump}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: '2px solid #fff',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.72rem',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.6)',
                cursor: 'pointer'
              }}
            >
              <ArrowUp size={26} color="#fff" />
              JUMP
            </button>
          </div>
        </div>
      )}

      {/* Start Game Menu Overlay */}
      {gameState === 'menu' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(9, 30, 20, 0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 40,
          textAlign: 'center',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            fontSize: '3.2rem',
            marginBottom: '6px',
            filter: 'drop-shadow(0 6px 12px rgba(245, 158, 11, 0.7))',
            animation: 'bounce 1.5s infinite'
          }}>
            🗿
          </div>

          <h1 style={{
            fontSize: '2.2rem',
            fontWeight: 900,
            margin: '0 0 4px 0',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}>
            TEMPLE RUN 3D
          </h1>
          <p style={{ color: '#d1d5db', fontSize: '0.88rem', margin: '0 0 18px 0', maxWidth: '360px' }}>
            Steal the Golden Idol & escape the enraged Demon Monkey across ancient temple bridges!
          </p>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            background: 'rgba(0,0,0,0.4)',
            padding: '10px 18px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700 }}>HIGH SCORE</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>{highScore}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700 }}>CONTROLS</span>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>Swipe or ⬅️ ⬆️ ⬇️ ➡️</div>
            </div>
          </div>

          <button
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              border: '2px solid #fff',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 900,
              padding: '14px 42px',
              borderRadius: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 30px rgba(234, 88, 12, 0.6)',
              transform: 'scale(1)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Play size={20} fill="#fff" /> START ESCAPE
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(69, 10, 10, 0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 40,
          textAlign: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>
            👹💥
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: 900,
            margin: '0 0 6px 0',
            color: '#ef4444',
            letterSpacing: '1px'
          }}>
            CAUGHT BY DEMON MONKEY!
          </h2>

          <div style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '18px',
            padding: '16px 24px',
            display: 'flex',
            gap: '24px',
            margin: '16px 0 20px 0'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 800 }}>DISTANCE</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>{distance}m</div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 800 }}>COINS</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24' }}>{coins} 🪙</div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 800 }}>FINAL SCORE</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8' }}>{score}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={startGame}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                border: '2px solid #fff',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 900,
                padding: '12px 32px',
                borderRadius: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 25px rgba(234, 88, 12, 0.6)'
              }}
            >
              <RotateCcw size={18} /> PLAY AGAIN
            </button>

            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  padding: '12px 22px',
                  borderRadius: '20px',
                  cursor: 'pointer'
                }}
              >
                All Games
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
