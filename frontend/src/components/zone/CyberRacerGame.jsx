import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  Trophy, RotateCcw, Zap, Volume2, VolumeX, Shield, 
  Flame, Play, ChevronLeft, ChevronRight, Award, Sparkles, X, ArrowLeft
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

// =========================================================================
// HIGH-FIDELITY WEB AUDIO RACING SOUND SYNTHESIZER
// 6-Speed Automatic Transmission Engine Simulation + Turbo + Screech + FX
// =========================================================================
const createAudioEngine = () => {
  let ctx = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let tireNoise = null;
  let tireGain = null;

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
      if (!engineOsc1) {
        engineOsc1 = ctx.createOscillator();
        engineOsc2 = ctx.createOscillator();
        engineGain = ctx.createGain();

        engineOsc1.type = 'sawtooth';
        engineOsc2.type = 'triangle';

        engineOsc1.frequency.setValueAtTime(55, ctx.currentTime);
        engineOsc2.frequency.setValueAtTime(110, ctx.currentTime);

        engineGain.gain.setValueAtTime(0.045, ctx.currentTime);

        engineOsc1.connect(engineGain);
        engineOsc2.connect(engineGain);
        engineGain.connect(ctx.destination);

        engineOsc1.start();
        engineOsc2.start();
      }
    } catch (e) {}
  };

  const updateEngineSpeed = (speed, isNitro, isBraking) => {
    if (!ctx || !engineOsc1) return;
    try {
      // 6-Speed Transmission Gear Calculation
      let gear = 1;
      let minS = 0, maxS = 65;
      if (speed < 65) { gear = 1; minS = 0; maxS = 65; }
      else if (speed < 120) { gear = 2; minS = 65; maxS = 120; }
      else if (speed < 180) { gear = 3; minS = 120; maxS = 180; }
      else if (speed < 240) { gear = 4; minS = 120; maxS = 240; }
      else if (speed < 300) { gear = 5; minS = 240; maxS = 300; }
      else { gear = 6; minS = 300; maxS = 400; }

      const progress = Math.min(1, Math.max(0, (speed - minS) / (maxS - minS)));
      const baseFreq = 50 + progress * 105 + (isNitro ? 30 : 0);

      engineOsc1.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.05);
      engineOsc2.frequency.setTargetAtTime(baseFreq * 1.85, ctx.currentTime, 0.05);

      const targetVol = isNitro ? 0.08 : isBraking ? 0.03 : 0.05;
      engineGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.05);
    } catch (e) {}
  };

  const stopEngine = () => {
    if (engineOsc1) {
      try {
        engineOsc1.stop();
        engineOsc2.stop();
        engineOsc1.disconnect();
        engineOsc2.disconnect();
      } catch (e) {}
      engineOsc1 = null;
      engineOsc2 = null;
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
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.07); // E6
      osc.frequency.setValueAtTime(1567.9, ctx.currentTime + 0.14); // G6
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
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  const playNearMissSound = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const playCrashSound = () => {
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
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

// =========================================================================
// MAIN CYBER RACER 3D COMPONENT (LANDSCAPE ORIENTED)
// =========================================================================
export default function CyberRacerGame({ onScoreUpdate, onExit }) {
  const { user, token } = useContext(AuthContext);

  // Game Lifecycle: 'menu' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState('menu');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live HUD States
  const [distance, setDistance] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [currentGear, setCurrentGear] = useState(1);
  const [score, setScore] = useState(0);
  const [comboCount, setComboCount] = useState(1);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [nitroLevel, setNitroLevel] = useState(100); // 0 to 100
  const [hasShield, setHasShield] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('pulsechat_racer_highscore') || '0', 10);
  });

  // Floating notifications ("⚡ NEAR MISS! +150", "NITRO TURBO!", etc.)
  const [popups, setPopups] = useState([]);

  // AdMob Revive
  const [canRevive, setCanRevive] = useState(true);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  // Touch Controls Visual State
  const [activeTouchControls, setActiveTouchControls] = useState({
    steerLeft: false,
    steerRight: false,
    gas: false,
    brake: false,
    nitro: false
  });

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

  // Internal Game State Refs (High frequency 60fps data without re-render overhead)
  const stateRef = useRef({
    // Player position: -1.0 (far left) to 1.0 (far right)
    playerX: 0,
    targetPlayerX: 0,
    playerSteerVel: 0,
    steerAngle: 0, // for body roll tilt
    speed: 0,
    baseSpeed: 170,
    maxSpeed: 290,
    nitroSpeed: 385,
    isGasPressed: false,
    isNitroActive: false,
    isBraking: false,
    isSteeringLeft: false,
    isSteeringRight: false,
    nitroReserve: 100,
    shieldTimer: 0,
    magnetTimer: 0,
    invincibleTimer: 0,
    distanceMeters: 0,
    currentScore: 0,
    comboMultiplier: 1,
    comboResetTimer: 0,
    coinsCollected: 0,
    roadOffset: 0,

    // 3D Road Curvature System
    roadCurve: 0, // Current curvature (-1.5 sharp left to +1.5 sharp right)
    targetCurve: 0,
    curveChangeTimer: 0,
    horizonShift: 0,

    // Highway Traffic: 4 Lanes (0, 1, 2, 3)
    traffic: [], // [{ id, lane, y, speed, color, type: 'coupe'|'supercar'|'truck'|'police', passed, blinkerTimer }]
    collectibles: [], // [{ id, lane, y, type: 'coin'|'nitro'|'shield'|'magnet', collected }]
    particles: [], // [{ x, y, vx, vy, color, size, life }]
    skidmarks: [], // [{ x1, y1, x2, y2, alpha }]
    lastSpawnDistance: 0,
    lastCoinSpawnDistance: 0
  });

  // Push Floating Notification
  const triggerPopup = (text, color = '#38bdf8') => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev.slice(-3), { id, text, color }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1200);
  };

  // Keyboard Controls Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') return;
      const s = stateRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        s.isSteeringLeft = true;
        setActiveTouchControls(prev => ({ ...prev, steerLeft: true }));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        s.isSteeringRight = true;
        setActiveTouchControls(prev => ({ ...prev, steerRight: true }));
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        s.isGasPressed = true;
        setActiveTouchControls(prev => ({ ...prev, gas: true }));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        s.isBraking = true;
        setActiveTouchControls(prev => ({ ...prev, brake: true }));
      } else if (e.key === ' ' || e.key === 'Shift') {
        if (s.nitroReserve > 10) {
          s.isNitroActive = true;
          setActiveTouchControls(prev => ({ ...prev, nitro: true }));
          if (soundEnabled && audioRef.current) audioRef.current.playNitroSound();
        }
      }
    };

    const handleKeyUp = (e) => {
      const s = stateRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        s.isSteeringLeft = false;
        setActiveTouchControls(prev => ({ ...prev, steerLeft: false }));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        s.isSteeringRight = false;
        setActiveTouchControls(prev => ({ ...prev, steerRight: false }));
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        s.isGasPressed = false;
        setActiveTouchControls(prev => ({ ...prev, gas: false }));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        s.isBraking = false;
        setActiveTouchControls(prev => ({ ...prev, brake: false }));
      } else if (e.key === ' ' || e.key === 'Shift') {
        s.isNitroActive = false;
        setActiveTouchControls(prev => ({ ...prev, nitro: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, soundEnabled]);

  // Touch Handlers
  const handleTouchSteerLeftStart = () => {
    stateRef.current.isSteeringLeft = true;
    setActiveTouchControls(prev => ({ ...prev, steerLeft: true }));
  };
  const handleTouchSteerLeftEnd = () => {
    stateRef.current.isSteeringLeft = false;
    setActiveTouchControls(prev => ({ ...prev, steerLeft: false }));
  };

  const handleTouchSteerRightStart = () => {
    stateRef.current.isSteeringRight = true;
    setActiveTouchControls(prev => ({ ...prev, steerRight: true }));
  };
  const handleTouchSteerRightEnd = () => {
    stateRef.current.isSteeringRight = false;
    setActiveTouchControls(prev => ({ ...prev, steerRight: false }));
  };

  const handleTouchGasStart = () => {
    stateRef.current.isGasPressed = true;
    setActiveTouchControls(prev => ({ ...prev, gas: true }));
  };
  const handleTouchGasEnd = () => {
    stateRef.current.isGasPressed = false;
    setActiveTouchControls(prev => ({ ...prev, gas: false }));
  };

  const handleTouchBrakeStart = () => {
    stateRef.current.isBraking = true;
    setActiveTouchControls(prev => ({ ...prev, brake: true }));
  };
  const handleTouchBrakeEnd = () => {
    stateRef.current.isBraking = false;
    setActiveTouchControls(prev => ({ ...prev, brake: false }));
  };

  const handleTouchNitroStart = () => {
    if (stateRef.current.nitroReserve > 10) {
      stateRef.current.isNitroActive = true;
      setActiveTouchControls(prev => ({ ...prev, nitro: true }));
      if (soundEnabled && audioRef.current) audioRef.current.playNitroSound();
    }
  };
  const handleTouchNitroEnd = () => {
    stateRef.current.isNitroActive = false;
    setActiveTouchControls(prev => ({ ...prev, nitro: false }));
  };

  // Start / Restart Race
  const startGame = () => {
    stateRef.current = {
      playerX: 0,
      targetPlayerX: 0,
      playerSteerVel: 0,
      steerAngle: 0,
      speed: 120,
      baseSpeed: 170,
      maxSpeed: 290,
      nitroSpeed: 385,
      isGasPressed: true, // Auto-gas engaged on start for arcade flow
      isNitroActive: false,
      isBraking: false,
      isSteeringLeft: false,
      isSteeringRight: false,
      nitroReserve: 100,
      shieldTimer: 0,
      magnetTimer: 0,
      invincibleTimer: 75, // 1.25 sec grace
      distanceMeters: 0,
      currentScore: 0,
      comboMultiplier: 1,
      comboResetTimer: 0,
      coinsCollected: 0,
      roadOffset: 0,
      roadCurve: 0,
      targetCurve: 0,
      curveChangeTimer: 0,
      horizonShift: 0,
      traffic: [],
      collectibles: [],
      particles: [],
      skidmarks: [],
      lastSpawnDistance: 0,
      lastCoinSpawnDistance: 0
    };

    setDistance(0);
    setScore(0);
    setComboCount(1);
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
    stateRef.current.shieldTimer = 360; // 6 seconds shield
    stateRef.current.invincibleTimer = 180;
    stateRef.current.speed = 180;
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
      const calculatedLevel = Math.max(1, Math.floor(finalDistance / 350));
      onScoreUpdate('Pulse Cyber Racer', finalScore, calculatedLevel);
    }
  };

  // =========================================================================
  // MAIN 60FPS GAME LOOP (PHYSICS + 3D ROAD PROJECTION + VECTOR GRAPHICS)
  // =========================================================================
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

      // 1. SPEED & DRIVING ACCELERATION PHYSICS
      if (s.isNitroActive && s.nitroReserve > 0) {
        s.speed = Math.min(s.nitroSpeed, s.speed + 350 * dt);
        s.nitroReserve = Math.max(0, s.nitroReserve - 30 * dt);
        if (s.nitroReserve <= 0) s.isNitroActive = false;

        // Nitro Flame Trail Particles
        for (let i = 0; i < 4; i++) {
          s.particles.push({
            x: s.playerX + (Math.random() - 0.5) * 0.12,
            y: 0.84,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 2.8 + Math.random() * 3,
            color: Math.random() > 0.4 ? '#38bdf8' : '#f59e0b',
            size: Math.random() * 8 + 6,
            life: 0.9
          });
        }
      } else if (s.isBraking) {
        s.speed = Math.max(65, s.speed - 360 * dt);
        // Brake smoke puffs
        s.particles.push({
          x: s.playerX + (Math.random() - 0.5) * 0.18,
          y: 0.84,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 1.0,
          color: 'rgba(239, 68, 68, 0.75)',
          size: Math.random() * 6 + 4,
          life: 0.5
        });
      } else if (s.isGasPressed) {
        // Accelerating up to dynamic top speed
        const dynamicMax = Math.min(s.maxSpeed, s.baseSpeed + (s.distanceMeters / 180) * 12);
        if (s.speed < dynamicMax) {
          s.speed = Math.min(dynamicMax, s.speed + 95 * dt);
        } else if (s.speed > dynamicMax) {
          s.speed = Math.max(dynamicMax, s.speed - 80 * dt);
        }
      } else {
        // Natural coasting deceleration
        s.speed = Math.max(90, s.speed - 85 * dt);
      }

      // Cruising regenerates nitro reserve
      if (!s.isNitroActive && s.nitroReserve < 100) {
        s.nitroReserve = Math.min(100, s.nitroReserve + 8 * dt);
      }

      // Distance & score accumulation
      const traveled = (s.speed * 0.2778) * dt;
      s.distanceMeters += traveled;
      const scoreGain = Math.round(traveled * (s.isNitroActive ? 3.0 : 1.4) * s.comboMultiplier);
      s.currentScore += scoreGain;
      s.roadOffset = (s.roadOffset + s.speed * 2.8 * dt) % 100;

      // Combo Reset Timer
      if (s.comboResetTimer > 0) {
        s.comboResetTimer -= dt;
        if (s.comboResetTimer <= 0) {
          s.comboMultiplier = 1;
          setComboCount(1);
        }
      }

      // Decrement Power-up Timers
      if (s.shieldTimer > 0) s.shieldTimer -= dt * 60;
      if (s.magnetTimer > 0) s.magnetTimer -= dt * 60;
      if (s.invincibleTimer > 0) s.invincibleTimer -= dt * 60;

      // 2. ROAD CURVATURE DYNAMICS (The secret to realistic OutRun curves)
      s.curveChangeTimer += dt;
      if (s.curveChangeTimer > 4.5) {
        s.curveChangeTimer = 0;
        // Pick new random curvature: left turn (-1.2), straight (0), right turn (+1.2), sweeping curve
        const curvePresets = [-1.4, -0.9, 0, 0, 0.9, 1.4];
        s.targetCurve = curvePresets[Math.floor(Math.random() * curvePresets.length)];
      }
      s.roadCurve += (s.targetCurve - s.roadCurve) * 1.4 * dt;
      s.horizonShift += s.roadCurve * (s.speed / 200) * 80 * dt;

      // Centrifugal drift: curve pushes player car sideways unless countered
      const centrifugalPull = s.roadCurve * (s.speed / 280) * 0.55 * dt;
      s.playerX -= centrifugalPull;

      // 3. STEERING & LATERAL ACCELERATION
      if (s.isSteeringLeft) {
        s.playerSteerVel = -2.8;
        s.steerAngle = Math.max(-0.25, s.steerAngle - 2.5 * dt);
      } else if (s.isSteeringRight) {
        s.playerSteerVel = 2.8;
        s.steerAngle = Math.min(0.25, s.steerAngle + 2.5 * dt);
      } else {
        s.playerSteerVel *= 0.85; // Damping
        s.steerAngle *= 0.82;
      }
      s.playerX += s.playerSteerVel * dt;
      // Clamp player within road margins (-0.95 to +0.95)
      s.playerX = Math.max(-0.95, Math.min(0.95, s.playerX));

      // Calculate Gear for HUD and Audio
      let calculatedGear = 1;
      if (s.speed < 65) calculatedGear = 1;
      else if (s.speed < 120) calculatedGear = 2;
      else if (s.speed < 180) calculatedGear = 3;
      else if (s.speed < 240) calculatedGear = 4;
      else if (s.speed < 300) calculatedGear = 5;
      else calculatedGear = 6;
      setCurrentGear(calculatedGear);

      // Throttled React HUD Updates
      setDistance(Math.floor(s.distanceMeters));
      setSpeedKmh(Math.round(s.speed));
      setScore(s.currentScore);
      setNitroLevel(Math.round(s.nitroReserve));
      setHasShield(s.shieldTimer > 0);

      // Engine Audio
      if (soundEnabled && audioRef.current) {
        audioRef.current.updateEngineSpeed(s.speed, s.isNitroActive, s.isBraking);
      }

      // 4. TRAFFIC SPAWNER (4 LANES: 0, 1, 2, 3)
      if (s.distanceMeters - s.lastSpawnDistance > (30 - Math.min(16, s.distanceMeters / 300))) {
        s.lastSpawnDistance = s.distanceMeters;
        const chosenLane = Math.floor(Math.random() * 4); // 0, 1, 2, 3
        const vehicleClasses = ['coupe', 'coupe', 'supercar', 'truck', 'police'];
        const chosenType = vehicleClasses[Math.floor(Math.random() * vehicleClasses.length)];
        const trafficColors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#e11d48'];
        const chosenColor = trafficColors[Math.floor(Math.random() * trafficColors.length)];

        s.traffic.push({
          id: Date.now() + Math.random(),
          lane: chosenLane,
          y: -90, // Spawns in distance near horizon
          speed: chosenType === 'truck' ? 75 : chosenType === 'police' ? 210 : chosenType === 'supercar' ? 170 : 120,
          color: chosenColor,
          type: chosenType,
          passed: false,
          blinkerTimer: 0
        });
      }

      // 5. COLLECTIBLES SPAWNER (Coins, Nitro, Shield, Magnet)
      if (s.distanceMeters - s.lastCoinSpawnDistance > 24) {
        s.lastCoinSpawnDistance = s.distanceMeters;
        const chosenLane = Math.floor(Math.random() * 4);
        const roll = Math.random();
        let itemType = 'coin';
        if (roll > 0.90) itemType = 'shield';
        else if (roll > 0.80) itemType = 'magnet';
        else if (roll > 0.65) itemType = 'nitro';

        s.collectibles.push({
          id: Date.now() + Math.random(),
          lane: chosenLane,
          y: -75,
          type: itemType,
          collected: false
        });
      }

      // 6. UPDATE TRAFFIC POSITIONS & COLLISION
      // 4 Lanes normalized X: 0 -> -0.72, 1 -> -0.24, 2 -> +0.24, 3 -> +0.72
      const laneToNormX = (lane) => (lane - 1.5) * 0.48;

      const playerBox = {
        x: s.playerX,
        y: 0.78,
        w: 0.22,
        h: 0.15
      };

      for (let i = s.traffic.length - 1; i >= 0; i--) {
        const tr = s.traffic[i];
        const relSpeed = (s.speed - tr.speed) * 2.3;
        tr.y += relSpeed * dt;

        const trafficX = laneToNormX(tr.lane);
        const trafficBox = {
          x: trafficX,
          y: tr.y / 500,
          w: tr.type === 'truck' ? 0.26 : 0.22,
          h: tr.type === 'truck' ? 0.22 : 0.15
        };

        // Near Miss Check (Passing within whiskers awards combo + points)
        if (!tr.passed && tr.y > 360 && tr.y < 430) {
          const lateralDist = Math.abs(trafficX - s.playerX);
          if (lateralDist > 0.18 && lateralDist < 0.45) {
            tr.passed = true;
            s.comboMultiplier = Math.min(5, s.comboMultiplier + 1);
            s.comboResetTimer = 4.0; // 4 seconds to maintain combo
            setComboCount(s.comboMultiplier);
            const bonus = 150 * s.comboMultiplier;
            s.currentScore += bonus;
            triggerPopup(`🔥 NEAR MISS x${s.comboMultiplier}! +${bonus}`, '#fbbf24');
            if (soundEnabled && audioRef.current) audioRef.current.playNearMissSound();
          }
        }

        // Collision Check
        const overlapX = Math.abs(playerBox.x - trafficBox.x) < (playerBox.w + trafficBox.w) * 0.42;
        const overlapY = Math.abs(playerBox.y - trafficBox.y) < (playerBox.h + trafficBox.h) * 0.42;

        if (overlapX && overlapY && s.invincibleTimer <= 0) {
          if (s.shieldTimer > 0) {
            // Smash through obstacle with plasma shield
            s.shieldTimer = 0;
            s.traffic.splice(i, 1);
            s.currentScore += 200;
            triggerPopup('💥 PLASMA SHIELD SMASH! +200', '#38bdf8');
            if (soundEnabled && audioRef.current) audioRef.current.playCrashSound();
            continue;
          } else {
            // Crash wipeout
            handleGameOver();
            return;
          }
        }

        // Despawn off-screen traffic
        if (tr.y > 600) {
          s.traffic.splice(i, 1);
        }
      }

      // 7. UPDATE COLLECTIBLES & MAGNET ATTRACTION
      for (let i = s.collectibles.length - 1; i >= 0; i--) {
        const item = s.collectibles[i];
        item.y += s.speed * 2.3 * dt;

        let itemX = laneToNormX(item.lane);
        // Magnetic vortex pulls coins towards player
        if (s.magnetTimer > 0 && item.type === 'coin') {
          itemX += (s.playerX - itemX) * 9 * dt;
        }

        const itemBox = {
          x: itemX,
          y: item.y / 500,
          w: 0.18,
          h: 0.14
        };

        const overlapX = Math.abs(playerBox.x - itemBox.x) < (playerBox.w + itemBox.w) * 0.45;
        const overlapY = Math.abs(playerBox.y - itemBox.y) < (playerBox.h + itemBox.h) * 0.45;

        if (overlapX && overlapY && !item.collected) {
          item.collected = true;
          s.collectibles.splice(i, 1);

          if (item.type === 'coin') {
            s.coinsCollected += 1;
            const coinPts = 50 * s.comboMultiplier;
            s.currentScore += coinPts;
            triggerPopup(`🪙 +${coinPts} (GOLD COIN)`, '#fbbf24');
            if (soundEnabled && audioRef.current) audioRef.current.playCoinDing();
          } else if (item.type === 'nitro') {
            s.nitroReserve = Math.min(100, s.nitroReserve + 50);
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

        if (item.y > 600) {
          s.collectibles.splice(i, 1);
        }
      }

      // 8. UPDATE PARTICLES
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2.2;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      // =========================================================================
      // 9. HIGH-RESOLUTION WIDESCREEN 16:9 CANVAS RENDERING (880 x 495)
      // =========================================================================
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // A. TWILIGHT SYNTHWAVE SKY GRADIENT
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.44);
      skyGrad.addColorStop(0, '#060314');
      skyGrad.addColorStop(0.5, '#190a3a');
      skyGrad.addColorStop(0.85, '#3b1054');
      skyGrad.addColorStop(1, '#671869');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.44);

      // B. PARALLAX DISTANT CITY SKYLINE
      const cityParallax = (s.horizonShift * 0.3) % 400;
      ctx.fillStyle = '#0d0722';
      for (let bx = -400; bx < w + 400; bx += 48) {
        const screenBx = bx - cityParallax;
        const bHeight = 45 + ((bx * 17) % 65);
        ctx.fillRect(screenBx, h * 0.44 - bHeight, 40, bHeight);

        // Cyber window dots
        ctx.fillStyle = ((bx / 48) % 3 === 0) ? 'rgba(56, 189, 248, 0.6)' : 'rgba(251, 191, 36, 0.5)';
        for (let wy = h * 0.44 - bHeight + 6; wy < h * 0.44 - 6; wy += 12) {
          ctx.fillRect(screenBx + 8, wy, 4, 4);
          ctx.fillRect(screenBx + 24, wy, 4, 4);
        }
        ctx.fillStyle = '#0d0722';
      }

      // C. SYNTHWAVE SUN WITH RASTER HORIZONTAL BARS
      const sunCenterX = (w / 2) - (s.roadCurve * 60);
      const sunCenterY = h * 0.38;
      const sunRadius = 64;
      const sunGrad = ctx.createRadialGradient(sunCenterX, sunCenterY, 8, sunCenterX, sunCenterY, sunRadius);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.4, '#f59e0b');
      sunGrad.addColorStop(0.8, '#ec4899');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunCenterX, sunCenterY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal raster blind slices on sun
      ctx.fillStyle = '#190a3a';
      for (let gy = sunCenterY; gy < sunCenterY + sunRadius; gy += 9) {
        ctx.fillRect(sunCenterX - sunRadius, gy, sunRadius * 2, 3);
      }

      // D. HORIZON LINE
      const horizonY = h * 0.44;
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.fillRect(0, horizonY - 1, w, 2);
      ctx.shadowBlur = 0;

      // E. 3D PSEUDO-CURVED HIGHWAY ENGINE (OutRun Style Slice Geometry)
      const roadH = h - horizonY;
      const horizonRoadW = w * 0.16;
      const bottomRoadW = w * 0.88;

      // Draw road slices from horizon to bottom
      const sliceCount = 38;
      for (let i = 0; i < sliceCount; i++) {
        const t1 = i / sliceCount;
        const t2 = (i + 1) / sliceCount;

        const y1 = horizonY + t1 * t1 * roadH;
        const y2 = horizonY + t2 * t2 * roadH;

        // Curve offsets: Quadratic bend
        const curveOffset1 = (1 - t1) * (1 - t1) * s.roadCurve * 110;
        const curveOffset2 = (1 - t2) * (1 - t2) * s.roadCurve * 110;

        const centerX1 = (w / 2) + curveOffset1;
        const centerX2 = (w / 2) + curveOffset2;

        const width1 = horizonRoadW + (bottomRoadW - horizonRoadW) * t1;
        const width2 = horizonRoadW + (bottomRoadW - horizonRoadW) * t2;

        // Road Asphalt Segment
        const isStripAlt = Math.floor((i + s.roadOffset * 0.35) % 2) === 0;
        ctx.fillStyle = isStripAlt ? '#0f172a' : '#111c34';

        ctx.beginPath();
        ctx.moveTo(centerX1 - width1 / 2, y1);
        ctx.lineTo(centerX1 + width1 / 2, y1);
        ctx.lineTo(centerX2 + width2 / 2, y2);
        ctx.lineTo(centerX2 - width2 / 2, y2);
        ctx.closePath();
        ctx.fill();

        // Alternating Neon Rumble Strips / Kerbs (Red & White)
        const curbW1 = width1 * 0.05;
        const curbW2 = width2 * 0.05;
        ctx.fillStyle = isStripAlt ? '#ef4444' : '#ffffff';

        // Left curb
        ctx.beginPath();
        ctx.moveTo(centerX1 - width1 / 2 - curbW1, y1);
        ctx.lineTo(centerX1 - width1 / 2, y1);
        ctx.lineTo(centerX2 - width2 / 2, y2);
        ctx.lineTo(centerX2 - width2 / 2 - curbW2, y2);
        ctx.closePath();
        ctx.fill();

        // Right curb
        ctx.beginPath();
        ctx.moveTo(centerX1 + width1 / 2, y1);
        ctx.lineTo(centerX1 + width1 / 2 + curbW1, y1);
        ctx.lineTo(centerX2 + width2 / 2 + curbW2, y2);
        ctx.lineTo(centerX2 + width2 / 2, y2);
        ctx.closePath();
        ctx.fill();

        // 4-Lane Dashed White Dividers (3 divider lines separating the 4 lanes)
        if (isStripAlt) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
          const laneW1 = width1 / 4;
          const laneW2 = width2 / 4;

          for (let d = 1; d <= 3; d++) {
            const dx1 = centerX1 - width1 / 2 + d * laneW1;
            const dx2 = centerX2 - width2 / 2 + d * laneW2;
            ctx.beginPath();
            ctx.moveTo(dx1 - 1.5, y1);
            ctx.lineTo(dx1 + 1.5, y1);
            ctx.lineTo(dx2 + 1.5, y2);
            ctx.lineTo(dx2 - 1.5, y2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // F. DRAW COLLECTIBLES
      for (const item of s.collectibles) {
        const normY = Math.max(0, Math.min(1.1, item.y / 500));
        const itemY = horizonY + normY * normY * roadH;
        const curveAtY = (1 - normY) * (1 - normY) * s.roadCurve * 110;
        const roadWAtY = horizonRoadW + (bottomRoadW - horizonRoadW) * normY;
        const laneW = roadWAtY / 4;
        const itemX = (w / 2) + curveAtY - roadWAtY / 2 + (item.lane + 0.5) * laneW;
        const scale = 0.5 + normY * 0.75;

        ctx.save();
        ctx.translate(itemX, itemY);
        ctx.scale(scale, scale);

        if (item.type === 'coin') {
          // Sparkling Golden Coin
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#92400e';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', 0, 1);
        } else if (item.type === 'nitro') {
          // Nitro Canister
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.roundRect(-10, -15, 20, 30, 6);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('N₂O', 0, 0);
        } else if (item.type === 'shield') {
          // Shield Orb
          ctx.shadowColor = '#34d399';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡️', 0, 0);
        } else if (item.type === 'magnet') {
          // Magnet Vortex
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🧲', 0, 0);
        }
        ctx.restore();
      }

      // G. DRAW TRAFFIC CARS (4 Classes: Coupe, Supercar, Truck, Police)
      for (const tr of s.traffic) {
        const normY = Math.max(0, Math.min(1.2, tr.y / 500));
        const carY = horizonY + normY * normY * roadH;
        const curveAtY = (1 - normY) * (1 - normY) * s.roadCurve * 110;
        const roadWAtY = horizonRoadW + (bottomRoadW - horizonRoadW) * normY;
        const laneW = roadWAtY / 4;
        const carX = (w / 2) + curveAtY - roadWAtY / 2 + (tr.lane + 0.5) * laneW;
        const scale = 0.45 + normY * 0.8;

        ctx.save();
        ctx.translate(carX, carY);
        ctx.scale(scale, scale);

        // Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(0, 24, tr.type === 'truck' ? 36 : 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if (tr.type === 'truck') {
          // Heavy 18-Wheeler Cargo Trailer
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.roundRect(-30, -42, 60, 68, 6);
          ctx.fill();

          // Container Corrugations
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          for (let cy = -34; cy < 16; cy += 8) {
            ctx.beginPath();
            ctx.moveTo(-26, cy);
            ctx.lineTo(26, cy);
            ctx.stroke();
          }

          // Red Hazard Tail-lights
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.fillRect(-26, 20, 10, 4);
          ctx.fillRect(16, 20, 10, 4);
          ctx.shadowBlur = 0;
        } else if (tr.type === 'police') {
          // Police Interceptor Cruiser
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(-24, -26, 48, 52, 8);
          ctx.fill();

          // Windshield
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(-16, -18, 32, 18, 4);
          ctx.fill();

          // Flashing Police Strobe Bar (Red & Blue alternating)
          const strobe = Math.floor(Date.now() / 120) % 2 === 0;
          ctx.fillStyle = strobe ? '#ef4444' : '#3b82f6';
          ctx.shadowColor = strobe ? '#ef4444' : '#3b82f6';
          ctx.shadowBlur = 14;
          ctx.fillRect(-12, -28, 10, 5);
          ctx.fillStyle = strobe ? '#3b82f6' : '#ef4444';
          ctx.shadowColor = strobe ? '#3b82f6' : '#ef4444';
          ctx.fillRect(2, -28, 10, 5);
          ctx.shadowBlur = 0;

          // Tail lights
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-20, 20, 8, 4);
          ctx.fillRect(12, 20, 8, 4);
        } else {
          // Coupe or Supercar
          ctx.fillStyle = tr.color;
          ctx.beginPath();
          ctx.roundRect(-22, -24, 44, 48, 8);
          ctx.fill();

          // Cockpit Tinted Window
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(-16, -16, 32, 20, 4);
          ctx.fill();

          // Tail Lights
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.fillRect(-18, 18, 9, 4);
          ctx.fillRect(9, 18, 9, 4);
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      // H. DRAW PARTICLES (Exhaust flames, smoke, sparks)
      for (const p of s.particles) {
        const px = (w / 2) + p.x * (bottomRoadW * 0.44);
        const py = h * p.y;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // I. DRAW PLAYER HYPERCAR (Detailed Supercar Rear View)
      const playerScreenX = (w / 2) + s.playerX * (bottomRoadW * 0.44);
      const playerScreenY = h * 0.81;

      ctx.save();
      ctx.translate(playerScreenX, playerScreenY);

      // Dynamic Body Roll on Steering
      ctx.rotate(s.steerAngle);

      // 1. Neon Underglow on Asphalt
      ctx.fillStyle = s.isNitroActive ? 'rgba(56, 189, 248, 0.45)' : 'rgba(168, 85, 247, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 54, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Wide Racing Tires (Left & Right)
      ctx.fillStyle = '#1e293b';
      // Left tire
      ctx.beginPath();
      ctx.roundRect(-46, 0, 16, 30, 4);
      ctx.fill();
      // Right tire
      ctx.beginPath();
      ctx.roundRect(30, 0, 16, 30, 4);
      ctx.fill();

      // Chrome wheel rims
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-44, 8, 12, 14);
      ctx.fillRect(32, 8, 12, 14);

      // 3. Aerodynamic Hypercar Chassis
      const carGrad = ctx.createLinearGradient(-38, 0, 38, 0);
      carGrad.addColorStop(0, '#06b6d4');
      carGrad.addColorStop(0.5, '#3b82f6');
      carGrad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = carGrad;
      ctx.shadowColor = s.isNitroActive ? '#38bdf8' : '#2563eb';
      ctx.shadowBlur = s.isNitroActive ? 25 : 12;

      ctx.beginPath();
      ctx.roundRect(-36, -34, 72, 60, 10);
      ctx.fill();

      // Carbon Fiber Rear Diffuser
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-28, 20, 56, 10);

      // F1 Center Strobe Light
      ctx.fillStyle = Math.floor(Date.now() / 80) % 2 === 0 ? '#ef4444' : '#7f1d1d';
      ctx.fillRect(-3, 22, 6, 6);

      // 4. Cockpit Windshield (Tinted glass with neon roof stripe)
      ctx.fillStyle = '#060a12';
      ctx.beginPath();
      ctx.roundRect(-24, -22, 48, 26, 6);
      ctx.fill();

      // Golden Center Racing Stripe
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3, -34, 6, 56);

      // 5. Active Aero Rear Spoiler Wing
      const spoilerLift = s.speed > 180 ? 4 : 0;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-40, -38 - spoilerLift, 80, 6);
      // Spoiler Struts
      ctx.fillStyle = '#334155';
      ctx.fillRect(-22, -32 - spoilerLift, 4, 8);
      ctx.fillRect(18, -32 - spoilerLift, 4, 8);

      // 6. Continuous Edge-to-Edge LED Tail-light Bar
      const isBrakingGlow = s.isBraking;
      ctx.fillStyle = isBrakingGlow ? '#ff0000' : '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = isBrakingGlow ? 22 : 10;
      ctx.fillRect(-32, 14, 64, 5);

      // Brake light ground reflection
      if (isBrakingGlow) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 36, 45, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Dual Nitro Thruster Flames
      if (s.isNitroActive) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 20;

        const flameLen = Math.random() * 26 + 25;
        // Left thruster flame
        ctx.beginPath();
        ctx.moveTo(-20, 24);
        ctx.lineTo(-12, 24);
        ctx.lineTo(-16, 24 + flameLen);
        ctx.closePath();
        ctx.fill();

        // Right thruster flame
        ctx.beginPath();
        ctx.moveTo(12, 24);
        ctx.lineTo(20, 24);
        ctx.lineTo(16, 24 + flameLen);
        ctx.closePath();
        ctx.fill();
      }

      // 8. Plasma Energy Shield Aura
      if (s.shieldTimer > 0) {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 26;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 55, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, 55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Loop continues
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, soundEnabled]);

  // Clean Sound Toggle
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (!next && audioRef.current) {
        audioRef.current.stopEngine();
      } else if (next && audioRef.current && gameState === 'playing') {
        audioRef.current.startEngine();
      }
      return next;
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      color: 'var(--text-main)',
      userSelect: 'none'
    }}>
      {/* Top Header Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            fontSize: '1.2rem',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.4)'
          }}>
            🏎️
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Cyber Racer 3D</span>
              <span style={{ fontSize: '0.65rem', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>LANDSCAPE</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              OutRun Curved Highway • 380+ KM/H • Multi-Lane Racing
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleSound}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: soundEnabled ? '#38bdf8' : '#94a3b8',
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

      {/* Main 16:9 Landscape Canvas Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '75vh',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#060314',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 24px rgba(6, 182, 212, 0.25)'
      }}>
        {/* HTML5 Canvas: Native 880 x 495 Widescreen */}
        <canvas
          ref={canvasRef}
          width={880}
          height={495}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none'
          }}
        />

        {/* In-Game Live HUD: Supercar Cockpit Dashboard */}
        {gameState === 'playing' && (
          <>
            {/* Top Dashboard Strip */}
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
              {/* Left HUD: Speedometer & Gear Indicator */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '14px',
                padding: '4px 12px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>SPEED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: speedKmh > 280 ? '#f59e0b' : '#38bdf8', lineHeight: 1.1 }}>
                    {speedKmh} <span style={{ fontSize: '0.65rem' }}>KM/H</span>
                  </div>
                </div>
                <div style={{
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                  paddingLeft: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800 }}>GEAR</div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>G{currentGear}</div>
                </div>
              </div>

              {/* Center HUD: Distance & Multiplier */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '14px',
                padding: '4px 16px',
                textAlign: 'center',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>DISTANCE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fbbf24' }}>
                    {distance} <span style={{ fontSize: '0.65rem' }}>M</span>
                  </div>
                </div>
                {comboCount > 1 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    color: '#fff'
                  }}>
                    {comboCount}x COMBO
                  </div>
                )}
              </div>

              {/* Right HUD: Gold Coins & Score */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '14px',
                padding: '4px 12px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🪙</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fbbf24' }}>{coinsCollected}</span>
                </div>
                <div style={{
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                  paddingLeft: '8px'
                }}>
                  <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800 }}>SCORE</div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8' }}>{score}</div>
                </div>
              </div>
            </div>

            {/* Nitro Fluid Pressure Bar */}
            <div style={{
              position: 'absolute',
              top: '56px',
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
                  <Flame size={12} color="#38bdf8" /> NITRO FLUID
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>{nitroLevel}%</span>
              </div>
              <div style={{
                height: '5px',
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.18)'
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
              top: '80px',
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
                    padding: '4px 16px',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    color: p.color,
                    boxShadow: `0 4px 16px ${p.color}45`,
                    animation: 'pulseModalPop 0.25s ease'
                  }}
                >
                  {p.text}
                </div>
              ))}
            </div>

            {/* Landscape Two-Thumb Ergonomic Controls Strip */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 25,
              pointerEvents: 'auto'
            }}>
              {/* Left Side: Steering Paddles */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onMouseDown={handleTouchSteerLeftStart}
                  onMouseUp={handleTouchSteerLeftEnd}
                  onTouchStart={handleTouchSteerLeftStart}
                  onTouchEnd={handleTouchSteerLeftEnd}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '18px',
                    background: activeTouchControls.steerLeft ? 'rgba(6, 182, 212, 0.4)' : 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: activeTouchControls.steerLeft ? '2px solid #06b6d4' : '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <ChevronLeft size={28} />
                  <span style={{ fontSize: '0.58rem', fontWeight: 900, marginTop: '-4px' }}>STEER</span>
                </button>

                <button
                  type="button"
                  onMouseDown={handleTouchSteerRightStart}
                  onMouseUp={handleTouchSteerRightEnd}
                  onTouchStart={handleTouchSteerRightStart}
                  onTouchEnd={handleTouchSteerRightEnd}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '18px',
                    background: activeTouchControls.steerRight ? 'rgba(6, 182, 212, 0.4)' : 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: activeTouchControls.steerRight ? '2px solid #06b6d4' : '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <ChevronRight size={28} />
                  <span style={{ fontSize: '0.58rem', fontWeight: 900, marginTop: '-4px' }}>STEER</span>
                </button>
              </div>

              {/* Right Side: Brake, Gas, & Nitro Pedals */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Brake Pedal */}
                <button
                  type="button"
                  onMouseDown={handleTouchBrakeStart}
                  onMouseUp={handleTouchBrakeEnd}
                  onTouchStart={handleTouchBrakeStart}
                  onTouchEnd={handleTouchBrakeEnd}
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    background: activeTouchControls.brake ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.2)',
                    border: '1.5px solid #ef4444',
                    color: '#f87171',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)'
                  }}
                >
                  <span>🛑</span>
                  <span>BRAKE</span>
                </button>

                {/* Gas Pedal */}
                <button
                  type="button"
                  onMouseDown={handleTouchGasStart}
                  onMouseUp={handleTouchGasEnd}
                  onTouchStart={handleTouchGasStart}
                  onTouchEnd={handleTouchGasEnd}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '18px',
                    background: activeTouchControls.gas ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(16, 185, 129, 0.25)',
                    border: '1.5px solid #10b981',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🏎️</span>
                  <span>GAS</span>
                </button>

                {/* NITRO Turbo Boost Button */}
                <button
                  type="button"
                  onMouseDown={handleTouchNitroStart}
                  onMouseUp={handleTouchNitroEnd}
                  onTouchStart={handleTouchNitroStart}
                  onTouchEnd={handleTouchNitroEnd}
                  style={{
                    padding: '0 20px',
                    height: '60px',
                    borderRadius: '20px',
                    background: nitroLevel > 10 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: nitroLevel > 10 ? '0 0 24px rgba(245, 158, 11, 0.7)' : 'none'
                  }}
                >
                  <Flame size={20} fill="#fff" />
                  <span>NITRO</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Start Menu Overlay (Landscape Cockpit Style) */}
        {gameState === 'menu' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(6, 3, 20, 0.94), rgba(25, 10, 50, 0.96))',
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
              marginBottom: '14px'
            }}>
              🏎️
            </div>

            <h2 style={{ fontSize: '1.7rem', fontWeight: 900, color: '#fff', margin: '0 0 6px 0' }}>
              Cyber Racer 3D Turbo
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#cbd5e1', maxWidth: '420px', lineHeight: 1.4, margin: '0 0 22px 0' }}>
              Landscape 3D Highway Racing! Curve through 4-lane traffic, pull Near Misses, and ignite Nitro thrusters at 380+ KM/H!
            </p>

            <button
              type="button"
              onClick={startGame}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 42px',
                fontSize: '1.05rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(6, 182, 212, 0.6)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Play size={20} fill="#fff" /> Start Race
            </button>
          </div>
        )}

        {/* Wipeout / Game Over Screen */}
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
              marginBottom: '10px',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
            }}>
              💥
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: '0 0 4px 0' }}>
              Wipeout!
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
              Great race! You pushed the limits on the highway.
            </div>

            {/* Scorecard Box */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '12px 24px',
              width: '80%',
              maxWidth: '400px',
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

            <div style={{ display: 'flex', gap: '10px', width: '80%', maxWidth: '400px' }}>
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
              Pulse Ad Network
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

      {/* Landscape Controls Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        fontSize: '0.72rem',
        color: 'var(--text-muted)'
      }}>
        <span>💡 Left Thumb: Steer ◀ / ▶ • Right Thumb: Gas, Brake & NITRO!</span>
        <span>Keyboard: A/D or Left/Right (Steer), W/S (Gas/Brake), Space (Nitro)</span>
      </div>
    </div>
  );
}
