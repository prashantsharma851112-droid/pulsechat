import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  Trophy, RotateCcw, Zap, Volume2, VolumeX, Shield, 
  Flame, Play, ChevronLeft, ChevronRight, Award, Sparkles, X
} from 'lucide-react';
import { BACKEND_URL, ADMOB_CONFIG } from '../../utils/config';

// Web Audio API Synthesizers for 0ms Zero-Latency Arcade Sounds
const createAudioEngine = () => {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;

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

  const startEngine = () => {
    init();
    if (!ctx) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.setValueAtTime(65, ctx.currentTime);
        engineGain.gain.setValueAtTime(0.04, ctx.currentTime);
        engineOsc.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
      }
    } catch (e) {}
  };

  const updateEngineSpeed = (speedRatio) => {
    if (engineOsc && ctx) {
      try {
        const targetFreq = 55 + speedRatio * 135;
        engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
      } catch (e) {}
    }
  };

  const stopEngine = () => {
    if (engineOsc) {
      try {
        engineOsc.stop();
        engineOsc.disconnect();
      } catch (e) {}
      engineOsc = null;
      engineGain = null;
    }
  };

  const playCoinDing = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  const playNitroSound = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  const playNearMissSound = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  };

  const playCrashSound = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  return {
    init,
    startEngine,
    updateEngineSpeed,
    stopEngine,
    playCoinDing,
    playNitroSound,
    playNearMissSound,
    playCrashSound
  };
};

export default function CyberRacerGame({ onScoreUpdate, onBack }) {
  const { user, token, updateUserProfile } = useContext(AuthContext);

  // Game Lifecycle: 'menu' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('menu');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live HUD States
  const [distance, setDistance] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [score, setScore] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [nitroLevel, setNitroLevel] = useState(100); // 0 to 100
  const [hasShield, setHasShield] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('pulsechat_racer_highscore') || '0', 10);
  });

  // Floating notifications ("NEAR MISS!", "+25 SPARKS", "NITRO BOOST")
  const [popups, setPopups] = useState([]); // [{ id, text, color, x, y }]

  // AdMob Revive / Continue
  const [canRevive, setCanRevive] = useState(true);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  // Canvas & Game Loop Refs
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioRef = useRef(null);

  // Audio Engine Lifecycle
  useEffect(() => {
    audioRef.current = createAudioEngine();
    return () => {
      if (audioRef.current) audioRef.current.stopEngine();
    };
  }, []);

  // Internal Game State Refs (High-frequency updates without React re-render lag)
  const stateRef = useRef({
    lane: 1, // 0 = Left, 1 = Center, 2 = Right
    targetLane: 1,
    playerX: 0, // Interpolated X coordinate (-1 to 1)
    playerY: 0,
    speed: 0,
    baseSpeed: 180,
    maxSpeed: 290,
    nitroSpeed: 380,
    isNitroActive: false,
    isBraking: false,
    nitroReserve: 100,
    shieldTimer: 0,
    magnetTimer: 0,
    distanceMeters: 0,
    currentScore: 0,
    coinsCollected: 0,
    roadOffset: 0,
    traffic: [], // [{ id, lane, y, speed, color, type, passed }]
    collectibles: [], // [{ id, lane, y, type: 'coin'|'nitro'|'shield'|'magnet', collected }]
    particles: [], // [{ x, y, vx, vy, color, size, life }]
    lastSpawnDistance: 0,
    lastCoinSpawnDistance: 0,
    invincibleTimer: 0
  });

  // Controls Handlers
  const steerLeft = useCallback(() => {
    stateRef.current.targetLane = Math.max(0, stateRef.current.targetLane - 1);
  }, []);

  const steerRight = useCallback(() => {
    stateRef.current.targetLane = Math.min(2, stateRef.current.targetLane + 1);
  }, []);

  const startNitro = useCallback(() => {
    if (stateRef.current.nitroReserve > 10) {
      stateRef.current.isNitroActive = true;
      if (soundEnabled && audioRef.current) audioRef.current.playNitroSound();
    }
  }, [soundEnabled]);

  const stopNitro = useCallback(() => {
    stateRef.current.isNitroActive = false;
  }, []);

  const startBrake = useCallback(() => {
    stateRef.current.isBraking = true;
  }, []);

  const stopBrake = useCallback(() => {
    stateRef.current.isBraking = false;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        steerLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        steerRight();
      } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        startNitro();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        startBrake();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        stopNitro();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        stopBrake();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, steerLeft, steerRight, startNitro, stopNitro, startBrake, stopBrake]);

  // Push Floating Notification
  const triggerPopup = (text, color = '#38bdf8') => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev.slice(-4), { id, text, color }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1200);
  };

  // Start / Restart Game
  const startGame = () => {
    stateRef.current = {
      lane: 1,
      targetLane: 1,
      playerX: 0,
      playerY: 0,
      speed: 150,
      baseSpeed: 180,
      maxSpeed: 280,
      nitroSpeed: 380,
      isNitroActive: false,
      isBraking: false,
      nitroReserve: 100,
      shieldTimer: 0,
      magnetTimer: 0,
      distanceMeters: 0,
      currentScore: 0,
      coinsCollected: 0,
      roadOffset: 0,
      traffic: [],
      collectibles: [],
      particles: [],
      lastSpawnDistance: 0,
      lastCoinSpawnDistance: 0,
      invincibleTimer: 60 // 1 sec spawn grace
    };

    setDistance(0);
    setScore(0);
    setCoinsCollected(0);
    setNitroLevel(100);
    setHasShield(false);
    setCanRevive(true);
    setPopups([]);
    setGameState('playing');

    if (soundEnabled && audioRef.current) {
      audioRef.current.startEngine();
    }
  };

  // Revive via Ad
  const handleReviveWithAd = () => {
    setAdModalOpen(true);
    setAdCountdown(5);
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          completeRevive();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeRevive = () => {
    setAdModalOpen(false);
    setCanRevive(false);
    stateRef.current.shieldTimer = 300; // 5 seconds of protective shield
    stateRef.current.invincibleTimer = 180;
    stateRef.current.speed = 180;
    // Clear immediate obstacles in front
    stateRef.current.traffic = stateRef.current.traffic.filter(t => t.y < 350);
    setGameState('playing');
    triggerPopup('🛡️ SHIELDED REVIVE!', '#34d399');
    if (soundEnabled && audioRef.current) audioRef.current.startEngine();
  };

  // End Game & Submit Score to Pulse Zone
  const handleGameOver = () => {
    setGameState('gameover');
    if (audioRef.current) {
      audioRef.current.stopEngine();
      if (soundEnabled) audioRef.current.playCrashSound();
    }

    const finalDistance = Math.floor(stateRef.current.distanceMeters);
    const finalScore = stateRef.current.currentScore;
    const finalCoins = stateRef.current.coinsCollected;
    setCoinsCollected(finalCoins);

    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('pulsechat_racer_highscore', finalScore.toString());
    }

    // Submit to server leaderboard
    if (onScoreUpdate && finalScore > 0) {
      const calculatedLevel = Math.max(1, Math.floor(finalDistance / 300));
      onScoreUpdate('Pulse Cyber Racer', finalScore, calculatedLevel);
    }
  };

  // Main 60FPS High-Performance Game Loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const s = stateRef.current;

      // 1. SPEED & ACCELERATION PHYSICS
      if (s.isNitroActive && s.nitroReserve > 0) {
        s.speed = Math.min(s.nitroSpeed, s.speed + 320 * dt);
        s.nitroReserve = Math.max(0, s.nitroReserve - 28 * dt);
        if (s.nitroReserve <= 0) s.isNitroActive = false;

        // Nitro trail flame particles
        for (let i = 0; i < 3; i++) {
          s.particles.push({
            x: s.playerX + (Math.random() - 0.5) * 0.15,
            y: 0.88,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 2.5 + Math.random() * 2,
            color: Math.random() > 0.4 ? '#38bdf8' : '#f59e0b',
            size: Math.random() * 8 + 6,
            life: 1.0
          });
        }
      } else if (s.isBraking) {
        s.speed = Math.max(80, s.speed - 350 * dt);
        // Brake smoke
        s.particles.push({
          x: s.playerX + (Math.random() - 0.5) * 0.18,
          y: 0.88,
          vx: (Math.random() - 0.5) * 0.2,
          vy: 1.2,
          color: 'rgba(239, 68, 68, 0.7)',
          size: Math.random() * 6 + 4,
          life: 0.6
        });
      } else {
        // Natural gradual acceleration up to baseSpeed, slowly scaling up as distance grows
        const dynamicMax = Math.min(s.maxSpeed, s.baseSpeed + (s.distanceMeters / 150) * 12);
        if (s.speed < dynamicMax) {
          s.speed = Math.min(dynamicMax, s.speed + 75 * dt);
        } else if (s.speed > dynamicMax) {
          s.speed = Math.max(dynamicMax, s.speed - 120 * dt);
        }
        // Slowly regenerate nitro when cruising
        if (!s.isNitroActive && s.nitroReserve < 100) {
          s.nitroReserve = Math.min(100, s.nitroReserve + 6 * dt);
        }
      }

      // Update distance and score
      const traveled = (s.speed * 0.2778) * dt; // km/h to m/s
      s.distanceMeters += traveled;
      s.currentScore += Math.round(traveled * (s.isNitroActive ? 2.5 : 1.2));
      s.roadOffset = (s.roadOffset + s.speed * 2.2 * dt) % 100;

      // Decrement timers
      if (s.shieldTimer > 0) s.shieldTimer -= dt * 60;
      if (s.magnetTimer > 0) s.magnetTimer -= dt * 60;
      if (s.invincibleTimer > 0) s.invincibleTimer -= dt * 60;

      // Update HUD in React (throttled)
      setDistance(Math.floor(s.distanceMeters));
      setSpeedKmh(Math.round(s.speed));
      setScore(s.currentScore);
      setNitroLevel(Math.round(s.nitroReserve));
      setHasShield(s.shieldTimer > 0);

      // Audio engine update
      if (soundEnabled && audioRef.current) {
        audioRef.current.updateEngineSpeed(s.speed / s.nitroSpeed);
      }

      // 2. STEERING INTERPOLATION
      // Target lanes: 0 -> -0.65, 1 -> 0, 2 -> 0.65
      const laneTargetX = (s.targetLane - 1) * 0.65;
      s.playerX += (laneTargetX - s.playerX) * 16 * dt;

      // 3. TRAFFIC SPAWN & LOGIC
      if (s.distanceMeters - s.lastSpawnDistance > (35 - Math.min(18, s.distanceMeters / 250))) {
        s.lastSpawnDistance = s.distanceMeters;
        const availableLanes = [0, 1, 2];
        const randomLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const types = ['car', 'car', 'fast', 'truck'];
        const chosenType = types[Math.floor(Math.random() * types.length)];
        const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const chosenColor = colors[Math.floor(Math.random() * colors.length)];

        s.traffic.push({
          id: Date.now() + Math.random(),
          lane: randomLane,
          y: -80, // Spawns near top horizon
          speed: chosenType === 'truck' ? 70 : chosenType === 'fast' ? 140 : 100,
          color: chosenColor,
          type: chosenType,
          passed: false
        });
      }

      // 4. COLLECTIBLES SPAWN (Coins, Nitro, Shield, Magnet)
      if (s.distanceMeters - s.lastCoinSpawnDistance > 22) {
        s.lastCoinSpawnDistance = s.distanceMeters;
        const randomLane = Math.floor(Math.random() * 3);
        const roll = Math.random();
        let itemType = 'coin';
        if (roll > 0.90) itemType = 'shield';
        else if (roll > 0.80) itemType = 'magnet';
        else if (roll > 0.65) itemType = 'nitro';

        s.collectibles.push({
          id: Date.now() + Math.random(),
          lane: randomLane,
          y: -70,
          type: itemType,
          collected: false
        });
      }

      // 5. UPDATE TRAFFIC POSITIONS & COLLISION
      const playerLaneNorm = s.playerX / 0.65 + 1; // 0 to 2
      const playerBox = {
        x: s.playerX,
        y: 0.76,
        w: 0.28,
        h: 0.16
      };

      for (let i = s.traffic.length - 1; i >= 0; i--) {
        const tr = s.traffic[i];
        // Relative speed of obstacle approaching player
        const relSpeed = (s.speed - tr.speed) * 2.2;
        tr.y += relSpeed * dt;

        const trafficX = (tr.lane - 1) * 0.65;
        const trafficBox = {
          x: trafficX,
          y: tr.y / 500, // Normalized
          w: tr.type === 'truck' ? 0.32 : 0.28,
          h: tr.type === 'truck' ? 0.24 : 0.16
        };

        // Near Miss check: player overtook car closely
        if (!tr.passed && tr.y > 380 && tr.y < 430) {
          const laneDiff = Math.abs(trafficX - s.playerX);
          if (laneDiff > 0.26 && laneDiff < 0.6) {
            tr.passed = true;
            s.currentScore += 100;
            triggerPopup('🔥 NEAR MISS! +100', '#fbbf24');
            if (soundEnabled && audioRef.current) audioRef.current.playNearMissSound();
          }
        }

        // Collision check
        const overlapX = Math.abs(playerBox.x - trafficBox.x) < (playerBox.w + trafficBox.w) * 0.42;
        const overlapY = Math.abs(playerBox.y - trafficBox.y) < (playerBox.h + trafficBox.h) * 0.45;

        if (overlapX && overlapY && s.invincibleTimer <= 0) {
          if (s.shieldTimer > 0) {
            // Smash through with shield
            s.shieldTimer = 0;
            s.traffic.splice(i, 1);
            s.currentScore += 150;
            triggerPopup('💥 SHIELD SMASH! +150', '#38bdf8');
            if (soundEnabled && audioRef.current) audioRef.current.playCrashSound();
            continue;
          } else {
            // Crash Game Over
            handleGameOver();
            return;
          }
        }

        // Cleanup off-screen traffic
        if (tr.y > 650) {
          s.traffic.splice(i, 1);
        }
      }

      // 6. UPDATE COLLECTIBLES & MAGNET ATTRACTION
      for (let i = s.collectibles.length - 1; i >= 0; i--) {
        const item = s.collectibles[i];
        item.y += s.speed * 2.2 * dt;

        let itemX = (item.lane - 1) * 0.65;

        // Magnet attraction pulling items towards player
        if (s.magnetTimer > 0 && item.type === 'coin') {
          itemX += (s.playerX - itemX) * 8 * dt;
        }

        const itemBox = {
          x: itemX,
          y: item.y / 500,
          w: 0.22,
          h: 0.14
        };

        const overlapX = Math.abs(playerBox.x - itemBox.x) < (playerBox.w + itemBox.w) * 0.45;
        const overlapY = Math.abs(playerBox.y - itemBox.y) < (playerBox.h + itemBox.h) * 0.45;

        if (overlapX && overlapY && !item.collected) {
          item.collected = true;
          s.collectibles.splice(i, 1);

          if (item.type === 'coin') {
            s.coinsCollected += 1;
            s.currentScore += 50;
            triggerPopup('🪙 +50 (SPARK COIN)', '#fbbf24');
            if (soundEnabled && audioRef.current) audioRef.current.playCoinDing();
          } else if (item.type === 'nitro') {
            s.nitroReserve = Math.min(100, s.nitroReserve + 45);
            triggerPopup('⚡ NITRO REFILL!', '#38bdf8');
            if (soundEnabled && audioRef.current) audioRef.current.playNitroSound();
          } else if (item.type === 'shield') {
            s.shieldTimer = 360; // 6 seconds
            triggerPopup('🛡️ PLASMA SHIELD!', '#34d399');
            if (soundEnabled && audioRef.current) audioRef.current.playCoinDing();
          } else if (item.type === 'magnet') {
            s.magnetTimer = 420; // 7 seconds
            triggerPopup('🧲 COIN MAGNET!', '#a855f7');
            if (soundEnabled && audioRef.current) audioRef.current.playCoinDing();
          }
          continue;
        }

        if (item.y > 650) {
          s.collectibles.splice(i, 1);
        }
      }

      // 7. PARTICLES UPDATE
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2.2;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      // =========================================================================
      // 8. HIGH-END 60FPS CANVAS RENDERING
      // =========================================================================
      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // Sky: Dark Synthwave Cyberpunk Horizon
      const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.42);
      skyGradient.addColorStop(0, '#090514');
      skyGradient.addColorStop(0.6, '#180d32');
      skyGradient.addColorStop(1, '#3b124d');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, w, h * 0.42);

      // Distant Cyber Sun
      const sunY = h * 0.38;
      const sunGrad = ctx.createRadialGradient(w / 2, sunY, 10, w / 2, sunY, 70);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.4, '#f59e0b');
      sunGrad.addColorStop(0.8, '#ec4899');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w / 2, sunY, 70, 0, Math.PI * 2);
      ctx.fill();

      // Cyber Grid Horizon Line
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(0, h * 0.42 - 1, w, 2);

      // Perspective Road Geometry
      const horizonY = h * 0.42;
      const horizonRoadW = w * 0.18;
      const bottomRoadW = w * 0.88;
      const roadH = h - horizonY;

      // Road Asphalt
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo((w - horizonRoadW) / 2, horizonY);
      ctx.lineTo((w + horizonRoadW) / 2, horizonY);
      ctx.lineTo((w + bottomRoadW) / 2, h);
      ctx.lineTo((w - bottomRoadW) / 2, h);
      ctx.closePath();
      ctx.fill();

      // Neon Curbs (Alternating red and white curb stripes scrolling with speed)
      const curbStripeCount = 14;
      for (let i = 0; i < curbStripeCount; i++) {
        const segTop = (i / curbStripeCount + s.roadOffset * 0.01) % 1;
        const segBottom = ((i + 0.5) / curbStripeCount + s.roadOffset * 0.01) % 1;

        const y1 = horizonY + segTop * segTop * roadH;
        const y2 = horizonY + segBottom * segBottom * roadH;

        const curW1 = horizonRoadW + (bottomRoadW - horizonRoadW) * segTop;
        const curW2 = horizonRoadW + (bottomRoadW - horizonRoadW) * segBottom;

        const isEven = i % 2 === 0;
        ctx.fillStyle = isEven ? '#ef4444' : '#ffffff';

        // Left curb
        ctx.beginPath();
        ctx.moveTo((w - curW1) / 2 - 8, y1);
        ctx.lineTo((w - curW1) / 2, y1);
        ctx.lineTo((w - curW2) / 2, y2);
        ctx.lineTo((w - curW2) / 2 - 8, y2);
        ctx.fill();

        // Right curb
        ctx.beginPath();
        ctx.moveTo((w + curW1) / 2, y1);
        ctx.lineTo((w + curW1) / 2 + 8, y1);
        ctx.lineTo((w + curW2) / 2 + 8, y2);
        ctx.lineTo((w + curW2) / 2, y2);
        ctx.fill();
      }

      // Neon Lane Dividers (2 divider lines for 3 lanes)
      const dividerCount = 12;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;

      for (let i = 0; i < dividerCount; i++) {
        const seg = (i / dividerCount + s.roadOffset * 0.01) % 1;
        const nextSeg = seg + 0.04;
        if (seg > 0.95) continue;

        const y1 = horizonY + seg * seg * roadH;
        const y2 = horizonY + nextSeg * nextSeg * roadH;
        const curW1 = horizonRoadW + (bottomRoadW - horizonRoadW) * seg;
        const curW2 = horizonRoadW + (bottomRoadW - horizonRoadW) * nextSeg;

        // Divider 1 (between Lane 0 and Lane 1)
        const d1_x1 = w / 2 - curW1 / 6;
        const d1_x2 = w / 2 - curW2 / 6;
        ctx.beginPath();
        ctx.moveTo(d1_x1 - 2, y1);
        ctx.lineTo(d1_x1 + 2, y1);
        ctx.lineTo(d1_x2 + 2, y2);
        ctx.lineTo(d1_x2 - 2, y2);
        ctx.fill();

        // Divider 2 (between Lane 1 and Lane 2)
        const d2_x1 = w / 2 + curW1 / 6;
        const d2_x2 = w / 2 + curW2 / 6;
        ctx.beginPath();
        ctx.moveTo(d2_x1 - 2, y1);
        ctx.lineTo(d2_x1 + 2, y1);
        ctx.lineTo(d2_x2 + 2, y2);
        ctx.lineTo(d2_x2 - 2, y2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 9. DRAW COLLECTIBLES
      for (const item of s.collectibles) {
        const normY = Math.max(0, Math.min(1, item.y / 500));
        const itemY = horizonY + normY * normY * roadH;
        const roadWAtY = horizonRoadW + (bottomRoadW - horizonRoadW) * normY;
        const laneW = roadWAtY / 3;
        const itemX = (w / 2) + (item.lane - 1) * laneW;
        const scale = 0.5 + normY * 0.7;

        ctx.save();
        ctx.translate(itemX, itemY);
        ctx.scale(scale, scale);

        if (item.type === 'coin') {
          // Spinning gold sparks coin
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', 0, 1);
        } else if (item.type === 'nitro') {
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(-8, -14, 16, 28);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('N₂', 0, 0);
        } else if (item.type === 'shield') {
          ctx.shadowColor = '#34d399';
          ctx.shadowBlur = 14;
          ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡️', 0, 0);
        } else if (item.type === 'magnet') {
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🧲', 0, 0);
        }
        ctx.restore();
      }

      // 10. DRAW TRAFFIC CARS
      for (const tr of s.traffic) {
        const normY = Math.max(0, Math.min(1.2, tr.y / 500));
        const carY = horizonY + normY * normY * roadH;
        const roadWAtY = horizonRoadW + (bottomRoadW - horizonRoadW) * normY;
        const laneW = roadWAtY / 3;
        const carX = (w / 2) + (tr.lane - 1) * laneW;
        const scale = 0.4 + normY * 0.75;

        ctx.save();
        ctx.translate(carX, carY);
        ctx.scale(scale, scale);

        // Car Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 22, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Car Chassis
        ctx.fillStyle = tr.color;
        ctx.beginPath();
        ctx.roundRect(-22, -26, 44, 48, 8);
        ctx.fill();

        // Cockpit / Windshield
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-16, -18, 32, 22, 4);
        ctx.fill();

        // Red Tail Lights
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fillRect(-18, 18, 10, 4);
        ctx.fillRect(8, 18, 10, 4);
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      // 11. DRAW PARTICLES
      for (const p of s.particles) {
        const px = (w / 2) + p.x * (bottomRoadW / 2);
        const py = h * p.y;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 12. DRAW PLAYER RACER CAR
      const pNormX = s.playerX;
      const playerScreenX = (w / 2) + pNormX * (bottomRoadW * 0.44);
      const playerScreenY = h * 0.82;

      ctx.save();
      ctx.translate(playerScreenX, playerScreenY);

      // Steering tilt effect
      const tilt = (s.targetLane - 1 - pNormX) * 0.18;
      ctx.rotate(tilt);

      // Car Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 26, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main Aerodynamic Cyber Chassis
      const carGrad = ctx.createLinearGradient(-30, 0, 30, 0);
      carGrad.addColorStop(0, '#06b6d4');
      carGrad.addColorStop(0.5, '#3b82f6');
      carGrad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = carGrad;
      ctx.shadowColor = s.isNitroActive ? '#38bdf8' : '#2563eb';
      ctx.shadowBlur = s.isNitroActive ? 22 : 12;

      ctx.beginPath();
      ctx.roundRect(-28, -32, 56, 60, 10);
      ctx.fill();

      // Cockpit / Windshield Tinted Glass
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.roundRect(-20, -20, 40, 26, 6);
      ctx.fill();

      // Neon Roof Racing Stripe
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3, -32, 6, 60);

      // Dual Tail Lights (Braking intensifies red glow)
      ctx.fillStyle = s.isBraking ? '#ff0000' : '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = s.isBraking ? 18 : 8;
      ctx.fillRect(-24, 24, 12, 5);
      ctx.fillRect(12, 24, 12, 5);

      // Nitro Thruster Jets (Blazing fire animation on Nitro boost)
      if (s.isNitroActive) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        const flameLen = Math.random() * 20 + 20;
        ctx.beginPath();
        ctx.moveTo(-22, 28);
        ctx.lineTo(-14, 28);
        ctx.lineTo(-18, 28 + flameLen);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(14, 28);
        ctx.lineTo(22, 28);
        ctx.lineTo(18, 28 + flameLen);
        ctx.closePath();
        ctx.fill();
      }

      // Plasma Energy Shield Aura if active
      if (s.shieldTimer > 0) {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Continue Game Loop
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, soundEnabled]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      width: '100%',
      position: 'relative'
    }}>
      {/* Game Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🏎️</span>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Pulse Cyber Racer
              <span style={{ fontSize: '0.62rem', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', padding: '1px 6px', borderRadius: '6px' }}>
                60 FPS
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              Dodge traffic • Collect Coins • Hit Nitro
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: soundEnabled ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: soundEnabled ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
              color: soundEnabled ? '#38bdf8' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <div style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: '#fbbf24',
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            padding: '4px 10px',
            borderRadius: '12px'
          }}>
            🏆 {highScore}
          </div>
        </div>
      </div>

      {/* Main Canvas & Overlay Area */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '460px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#090514',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.2)'
      }}>
        {/* HTML5 Canvas */}
        <canvas
          ref={canvasRef}
          width={380}
          height={460}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none'
          }}
        />

        {/* In-Game Live HUD */}
        {gameState === 'playing' && (
          <>
            {/* Top Stats Strip */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              {/* Speedometer */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '4px 10px',
                color: '#fff'
              }}>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Speed</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: speedKmh > 260 ? '#f59e0b' : '#38bdf8' }}>
                  {speedKmh} <span style={{ fontSize: '0.65rem' }}>KM/H</span>
                </div>
              </div>

              {/* Distance & Score */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '4px 12px',
                textAlign: 'center',
                color: '#fff'
              }}>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Distance</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24' }}>
                  {distance} <span style={{ fontSize: '0.65rem' }}>M</span>
                </div>
              </div>

              {/* Sparks Coins Counter */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '4px 10px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ fontSize: '1.1rem' }}>🪙</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24' }}>
                  {score}
                </span>
              </div>
            </div>

            {/* Nitro Boost Gauge Bar */}
            <div style={{
              position: 'absolute',
              top: '64px',
              left: '12px',
              right: '12px',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '3px'
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Flame size={12} color="#38bdf8" /> NITRO TANK
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>{nitroLevel}%</span>
              </div>
              <div style={{
                height: '5px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}>
                <div style={{
                  height: '100%',
                  width: `${nitroLevel}%`,
                  background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #f59e0b)',
                  transition: 'width 0.1s linear'
                }} />
              </div>
            </div>

            {/* Floating Popups Notification Stack */}
            <div style={{
              position: 'absolute',
              top: '95px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'none',
              zIndex: 20
            }}>
              {popups.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(8px)',
                    border: `1.5px solid ${p.color}`,
                    borderRadius: '20px',
                    padding: '4px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 900,
                    color: p.color,
                    boxShadow: `0 4px 14px ${p.color}40`,
                    animation: 'pulseModalPop 0.25s ease'
                  }}
                >
                  {p.text}
                </div>
              ))}
            </div>

            {/* Direct Screen Tap Steer Zones (Left / Right halves) */}
            <div
              onClick={steerLeft}
              style={{
                position: 'absolute',
                top: '120px',
                left: 0,
                width: '35%',
                bottom: '100px',
                zIndex: 5,
                cursor: 'pointer'
              }}
            />
            <div
              onClick={steerRight}
              style={{
                position: 'absolute',
                top: '120px',
                right: 0,
                width: '35%',
                bottom: '100px',
                zIndex: 5,
                cursor: 'pointer'
              }}
            />

            {/* Bottom In-Game Touch Controls */}
            <div style={{
              position: 'absolute',
              bottom: '14px',
              left: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 25
            }}>
              {/* Steering Arrows */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={steerLeft}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <ChevronLeft size={28} />
                </button>

                <button
                  type="button"
                  onClick={steerRight}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <ChevronRight size={28} />
                </button>
              </div>

              {/* Action Buttons: Brake & NITRO */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onMouseDown={startBrake}
                  onMouseUp={stopBrake}
                  onTouchStart={startBrake}
                  onTouchEnd={stopBrake}
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.25)',
                    border: '1.5px solid #ef4444',
                    color: '#f87171',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  BRAKE
                </button>

                <button
                  type="button"
                  onMouseDown={startNitro}
                  onMouseUp={stopNitro}
                  onTouchStart={startNitro}
                  onTouchEnd={stopNitro}
                  style={{
                    padding: '0 20px',
                    height: '56px',
                    borderRadius: '28px',
                    background: nitroLevel > 10 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(255, 255, 255, 0.35)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: nitroLevel > 10 ? '0 0 20px rgba(245, 158, 11, 0.65)' : 'none',
                    transition: 'transform 0.1s ease'
                  }}
                >
                  <Flame size={20} fill="#fff" />
                  <span>NITRO</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Start Menu Overlay */}
        {gameState === 'menu' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(9, 5, 20, 0.94), rgba(24, 13, 50, 0.96))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            zIndex: 30
          }}>
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              boxShadow: '0 10px 30px rgba(6, 182, 212, 0.5)',
              marginBottom: '16px'
            }}>
              🏎️
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', margin: '0 0 6px 0' }}>
              Cyber Racer Turbo
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '300px', lineHeight: 1.4, margin: '0 0 20px 0' }}>
              Dodge highway traffic at 300+ KM/H, grab Gold Coins, and ignite Nitro thrusters!
            </p>

            <button
              type="button"
              onClick={startGame}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 36px',
                fontSize: '1rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 6px 22px rgba(6, 182, 212, 0.6)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Play size={20} fill="#fff" /> Start Race
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'gameover' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(9, 5, 20, 0.98))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            zIndex: 30
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              marginBottom: '12px',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
            }}>
              💥
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: '0 0 4px 0' }}>
              Wipeout!
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
              Great race! You pushed the limits.
            </div>

            {/* Scorecard Box */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '12px 20px',
              width: '85%',
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: '18px'
            }}>
              <div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 800 }}>DISTANCE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8' }}>{distance} m</div>
              </div>
              <div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 800 }}>SCORE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fbbf24' }}>{score}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 800 }}>COINS</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b' }}>🪙 {coinsCollected}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '85%' }}>
              {canRevive && (
                <button
                  type="button"
                  onClick={handleReviveWithAd}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '11px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <Shield size={16} /> Revive Shield
                </button>
              )}

              <button
                type="button"
                onClick={startGame}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '11px',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                }}
              >
                <RotateCcw size={16} /> Race Again
              </button>
            </div>
          </div>
        )}

        {/* AdMob Quick Revive Modal */}
        {adModalOpen && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
            <h4 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '1.1rem' }}>
              Pulse AdMob Story Network
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 16px 0' }}>
              Reviving racer in {adCountdown}s...
            </p>
            <div style={{
              width: '180px',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${((5 - adCountdown) / 5) * 100}%`,
                background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                transition: 'width 1s linear'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Instructions / Tips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        fontSize: '0.72rem',
        color: 'var(--text-muted)'
      }}>
        <span>💡 Tap Left/Right to Steer • Hold NITRO for Turbo Speed!</span>
        <span>Keyboard: A/D or Arrows</span>
      </div>
    </div>
  );
}
