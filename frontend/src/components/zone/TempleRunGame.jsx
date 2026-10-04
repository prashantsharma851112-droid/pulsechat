import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import * as THREE from 'three';
import { AuthContext } from '../../context/AuthContext';
import { 
  Trophy, RotateCcw, Volume2, VolumeX, Shield, 
  Flame, Play, ChevronLeft, ChevronRight, ArrowLeft, ArrowUp, ArrowDown, 
  Maximize2, Minimize2, Pause, FastForward
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';

// =========================================================================
// NATIVE WEB AUDIO ENGINE: TRIBAL DRUMS & TEMPLE RUN SFX
// Zero external audio files required, 100% native synthesized Web Audio
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

  const playDrumStep = (freq = 85, decay = 0.14, gainVal = 0.09) => {
    if (isMuted || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + decay);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + decay);
    } catch (e) {}
  };

  const playShaker = (decay = 0.05, gainVal = 0.025) => {
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
      filter.frequency.value = 3500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  };

  const startTribalMusic = (tempo = 145) => {
    init();
    stopTribalMusic();
    let step = 0;
    const interval = (60 / tempo) * 1000 / 2;
    drumTimer = setInterval(() => {
      if (step % 4 === 0) playDrumStep(95, 0.15, 0.11);
      else if (step % 4 === 2) playDrumStep(75, 0.12, 0.08);
      if (step % 2 === 1) playShaker(0.045, 0.03);
      step = (step + 1) % 16;
    }, interval);
  };

  const stopTribalMusic = () => {
    if (drumTimer) {
      clearInterval(drumTimer);
      drumTimer = null;
    }
  };

  const playCoinDing = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.setValueAtTime(1980, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {}
  };

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
      osc1.frequency.setValueAtTime(150, now);
      osc1.frequency.exponentialRampToValueAtTime(60, now + 0.45);
      osc2.frequency.setValueAtTime(240, now);
      osc2.frequency.exponentialRampToValueAtTime(75, now + 0.45);
      gain.gain.setValueAtTime(0.14, now);
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

  const playStumble = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.24);
    } catch (e) {}
  };

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

  const playGameOver = () => {
    init();
    stopTribalMusic();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.7);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.75);
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
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  // React HUD States
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
  const [activePowerUp, setActivePowerUp] = useState(null);
  const [powerUpTimeLeft, setPowerUpTimeLeft] = useState(0);
  const [monkeyDistance, setMonkeyDistance] = useState(100);

  // Swipe gesture tracking
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Core mutable game loop references
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    playerGroup: null,
    monkeyGroup: null,
    shieldMesh: null,

    // Limb references for character running animations
    playerParts: {
      leftLeg: null,
      rightLeg: null,
      leftArm: null,
      rightArm: null,
      torso: null,
      head: null
    },

    // Demon Monkey parts
    monkeyParts: {
      leftArm: null,
      rightArm: null,
      body: null,
      eyes: null
    },

    // Track chunks & dynamic meshes
    trackChunks: [],
    obstacles: [],
    coinsList: [],
    particleSystems: [],

    // Torch point lights
    torchLights: [],

    // Game variables
    speed: 38, // Units per second
    distance: 0,
    coins: 0,
    score: 0,

    playerLane: 1, // 0: Left (-1.8), 1: Center (0), 2: Right (1.8)
    targetX: 0,
    currentX: 0,

    isJumping: false,
    jumpY: 0,
    jumpVelocity: 0,

    isSliding: false,
    slideTimer: 0,

    stumbleTimer: 0,
    monkeyDist: 100, // 100 = far, 30 = right behind, 0 = caught
    monkeyRoarTimer: 0,

    powerUp: {
      type: null,
      timeLeft: 0
    },

    runAnimTime: 0,
    lastTime: 0,
    running: false
  });

  // Initialize Web Audio Engine
  useEffect(() => {
    audioRef.current = createTempleAudio();
    return () => {
      if (audioRef.current) audioRef.current.stopTribalMusic();
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
  // LANE CONTROLS & PLAYER ACTIONS
  // =========================================================================
  const moveLeft = useCallback(() => {
    const g = gameRef.current;
    if (g.playerLane > 0) {
      g.playerLane -= 1;
      g.targetX = (g.playerLane - 1) * 1.8;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const moveRight = useCallback(() => {
    const g = gameRef.current;
    if (g.playerLane < 2) {
      g.playerLane += 1;
      g.targetX = (g.playerLane - 1) * 1.8;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.isJumping && !g.isSliding) {
      g.isJumping = true;
      g.jumpVelocity = 15.5;
      if (audioRef.current) audioRef.current.playJumpWhoosh();
    }
  }, []);

  const slide = useCallback(() => {
    const g = gameRef.current;
    if (!g.isSliding) {
      if (g.isJumping) {
        g.jumpY = 0;
        g.jumpVelocity = 0;
        g.isJumping = false;
      }
      g.isSliding = true;
      g.slideTimer = 0.8;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') {
        if (e.code === 'Space' || e.code === 'Enter') startGame();
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

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dt = Date.now() - touchStartRef.current.time;

    if (dt > 600) return;

    if (Math.max(absX, absY) > 25) {
      if (absX > absY) {
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        if (dy > 0) slide();
        else jump();
      }
    }
  };

  // =========================================================================
  // THREE.JS SCENE SETUP & PROCEDURAL 3D ASSETS
  // =========================================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Ancient Jungle Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1c14); // Deep ancient rainforest mist
    scene.fog = new THREE.FogExp2(0x0a1c14, 0.012);

    // 2. Perspective Camera (Over-the-shoulder third-person camera)
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 300);
    camera.position.set(0, 3.8, 6.5);
    camera.lookAt(0, 1.8, -12);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup (Sunlight + Ambient Jungle Light)
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfbbf24, 1.2);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 5. Materials (Ancient Mossy Stones, Gold, Foliage)
    const stoneFloorMat = new THREE.MeshStandardMaterial({
      color: 0x4a4031,
      roughness: 0.85,
      metalness: 0.1
    });

    const stoneWallMat = new THREE.MeshStandardMaterial({
      color: 0x2b251b,
      roughness: 0.9,
      metalness: 0.05
    });

    const mossTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a1f,
      roughness: 0.95
    });

    const goldCoinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.95,
      roughness: 0.2
    });

    const logBarkMat = new THREE.MeshStandardMaterial({
      color: 0x45230e,
      roughness: 0.8
    });

    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.7,
      roughness: 0.3
    });

    // 6. BUILD PROCEDURAL 3D RUNNER (Guy Dangerous Explorer)
    const playerGroup = new THREE.Group();

    // Torso (Explorer Jacket)
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.45);
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
    torsoMesh.position.y = 1.3;
    torsoMesh.castShadow = true;
    playerGroup.add(torsoMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa });
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 1.95, 0);
    playerGroup.add(headMesh);

    // Fedora Explorer Hat
    const hatBrimGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.05, 16);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
    hatBrim.position.set(0, 2.15, 0);
    playerGroup.add(hatBrim);

    const hatTopGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.25, 16);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.set(0, 2.28, 0);
    playerGroup.add(hatTop);

    // Legs (Thighs + Shins)
    const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }); // Denim explorer pants

    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.24, 0.45, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.24, 0.45, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.52, 1.3, 0);
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.52, 1.3, 0);
    playerGroup.add(rightArm);

    // Golden Idol Satchel on chest
    const satchelGeo = new THREE.BoxGeometry(0.35, 0.35, 0.2);
    const satchelMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 });
    const satchel = new THREE.Mesh(satchelGeo, satchelMat);
    satchel.position.set(0.2, 1.15, 0.25);
    playerGroup.add(satchel);

    // Shield Bubble (Hidden by default)
    const shieldGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      metalness: 0.8,
      roughness: 0.1
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 1.2;
    shieldMesh.visible = false;
    playerGroup.add(shieldMesh);

    scene.add(playerGroup);

    // 7. BUILD PROCEDURAL 3D DEMON MONKEY (Evil Demon Ape)
    const monkeyGroup = new THREE.Group();

    // Massive Gorilla Torso
    const monTorsoGeo = new THREE.BoxGeometry(1.6, 1.8, 1.1);
    const monFurMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
    const monTorso = new THREE.Mesh(monTorsoGeo, monFurMat);
    monTorso.position.y = 1.6;
    monkeyGroup.add(monTorso);

    // Demon Head with Horns
    const monHeadGeo = new THREE.BoxGeometry(0.9, 0.9, 0.8);
    const monHead = new THREE.Mesh(monHeadGeo, monFurMat);
    monHead.position.set(0, 2.7, 0.2);
    monkeyGroup.add(monHead);

    // Glowing Demonic Red Eyes
    const eyeGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 2.75, 0.65);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 2.75, 0.65);
    monkeyGroup.add(leftEye);
    monkeyGroup.add(rightEye);

    // Curved Horns
    const hornGeo = new THREE.ConeGeometry(0.14, 0.7, 12);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.5, 3.2, 0.1);
    leftHorn.rotation.z = -0.5;
    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.5, 3.2, 0.1);
    rightHorn.rotation.z = 0.5;
    monkeyGroup.add(leftHorn);
    monkeyGroup.add(rightHorn);

    // Heavy Pounding Gorilla Arms
    const monArmGeo = new THREE.BoxGeometry(0.45, 1.5, 0.45);
    const monLeftArm = new THREE.Mesh(monArmGeo, monFurMat);
    monLeftArm.position.set(-1.05, 1.2, 0.3);
    const monRightArm = new THREE.Mesh(monArmGeo, monFurMat);
    monRightArm.position.set(1.05, 1.2, 0.3);
    monkeyGroup.add(monLeftArm);
    monkeyGroup.add(monRightArm);

    monkeyGroup.position.set(0, 0, 4.2); // Positioned closely behind the runner
    scene.add(monkeyGroup);

    // Store references in gameRef
    gameRef.current.scene = scene;
    gameRef.current.camera = camera;
    gameRef.current.renderer = renderer;
    gameRef.current.playerGroup = playerGroup;
    gameRef.current.monkeyGroup = monkeyGroup;
    gameRef.current.shieldMesh = shieldMesh;

    gameRef.current.playerParts = {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      torso: torsoMesh,
      head: headMesh
    };

    gameRef.current.monkeyParts = {
      leftArm: monLeftArm,
      rightArm: monRightArm,
      body: monTorso
    };

    // 8. GENERATE INITIAL 3D ENDLESS TRACK CORRIDOR
    const CHUNK_LENGTH = 20;
    const CHUNK_COUNT = 15;
    const trackChunks = [];

    const createTrackChunk = (zPos) => {
      const chunk = new THREE.Group();
      chunk.position.z = zPos;

      // Stone Bridge Pathway (Width 6.4 units, 3 lanes)
      const floorGeo = new THREE.BoxGeometry(6.4, 0.8, CHUNK_LENGTH);
      const floor = new THREE.Mesh(floorGeo, stoneFloorMat);
      floor.position.y = -0.4;
      floor.receiveShadow = true;
      chunk.add(floor);

      // Left & Right Stone Walls
      const wallGeo = new THREE.BoxGeometry(0.8, 2.2, CHUNK_LENGTH);
      const leftWall = new THREE.Mesh(wallGeo, stoneWallMat);
      leftWall.position.set(-3.4, 0.7, 0);
      const rightWall = new THREE.Mesh(wallGeo, stoneWallMat);
      rightWall.position.set(3.4, 0.7, 0);
      chunk.add(leftWall);
      chunk.add(rightWall);

      // Mossy Wall Trim
      const trimGeo = new THREE.BoxGeometry(0.9, 0.3, CHUNK_LENGTH);
      const leftTrim = new THREE.Mesh(trimGeo, mossTrimMat);
      leftTrim.position.set(-3.4, 1.85, 0);
      const rightTrim = new THREE.Mesh(trimGeo, mossTrimMat);
      rightTrim.position.set(3.4, 1.85, 0);
      chunk.add(leftTrim);
      chunk.add(rightTrim);

      // Stone Pillars & Flaming Torch Light
      const pillarGeo = new THREE.BoxGeometry(0.6, 3.2, 0.6);
      const pL = new THREE.Mesh(pillarGeo, stoneWallMat);
      pL.position.set(-3.2, 1.2, 0);
      const pR = new THREE.Mesh(pillarGeo, stoneWallMat);
      pR.position.set(3.2, 1.2, 0);
      chunk.add(pL);
      chunk.add(pR);

      // Ancient Overhead Archway spanning the path
      const archGeo = new THREE.BoxGeometry(7.2, 0.5, 0.8);
      const arch = new THREE.Mesh(archGeo, stoneWallMat);
      arch.position.set(0, 3.8, 0);
      chunk.add(arch);

      // Warm Torch Light
      const torchLight = new THREE.PointLight(0xf59e0b, 1.8, 16);
      torchLight.position.set(0, 2.6, 0);
      chunk.add(torchLight);

      scene.add(chunk);
      return chunk;
    };

    for (let i = 0; i < CHUNK_COUNT; i++) {
      trackChunks.push(createTrackChunk(-i * CHUNK_LENGTH));
    }
    gameRef.current.trackChunks = trackChunks;

    // Handle Window Resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container) container.innerHTML = '';
    };
  }, []);

  // =========================================================================
  // GAME START / RESET
  // =========================================================================
  const startGame = () => {
    const g = gameRef.current;
    g.distance = 0;
    g.speed = 42;
    g.coins = 0;
    g.score = 0;
    g.playerLane = 1;
    g.targetX = 0;
    g.currentX = 0;
    g.isJumping = false;
    g.jumpY = 0;
    g.jumpVelocity = 0;
    g.isSliding = false;
    g.slideTimer = 0;
    g.stumbleTimer = 0;
    g.monkeyDist = 100;
    g.powerUp.type = null;
    g.powerUp.timeLeft = 0;

    // Clear active obstacles & coins in scene
    g.obstacles.forEach(o => g.scene.remove(o.mesh));
    g.obstacles = [];
    g.coinsList.forEach(c => g.scene.remove(c.mesh));
    g.coinsList = [];

    if (g.shieldMesh) g.shieldMesh.visible = false;

    setDistance(0);
    setCoins(0);
    setScore(0);
    setActivePowerUp(null);
    setPowerUpTimeLeft(0);
    setMonkeyDistance(100);
    setGameState('playing');

    if (audioRef.current) {
      audioRef.current.init();
      audioRef.current.startTribalMusic(145);
    }
  };

  // =========================================================================
  // MAIN ANIMATION LOOP (60 FPS WEBGL)
  // =========================================================================
  useEffect(() => {
    let animId = null;

    const animate = (timestamp) => {
      const g = gameRef.current;
      if (!g.lastTime) g.lastTime = timestamp;
      const dt = Math.min((timestamp - g.lastTime) / 1000, 0.1);
      g.lastTime = timestamp;

      if (gameState === 'playing') {
        updateGame(dt);
      }

      if (g.renderer && g.scene && g.camera) {
        g.renderer.render(g.scene, g.camera);
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  // =========================================================================
  // REAL-TIME PHYSICS, ANIMATION & COLLISION ENGINE
  // =========================================================================
  const updateGame = (dt) => {
    const g = gameRef.current;
    if (!g.playerGroup) return;

    // 1. Distance & Progression
    const speedMult = g.powerUp.type === 'boost' ? 1.7 : 1.0;
    const currentSpeed = g.speed * speedMult;
    g.distance += currentSpeed * dt;
    g.speed = Math.min(85, 42 + g.distance * 0.04); // Speed increases with distance

    setDistance(Math.floor(g.distance));
    const computedScore = Math.floor(g.distance * 2 + g.coins * 15);
    g.score = computedScore;
    setScore(computedScore);

    // 2. Smooth Lateral Lane Movement
    g.currentX += (g.targetX - g.currentX) * (dt * 14);
    g.playerGroup.position.x = g.currentX;
    // Dynamic body tilt during lane changing
    g.playerGroup.rotation.z = (g.targetX - g.currentX) * -0.3;

    // 3. Jump Physics (Parabolic arc)
    if (g.isJumping) {
      g.jumpY += g.jumpVelocity * dt;
      g.jumpVelocity -= 36 * dt; // Gravity
      if (g.jumpY <= 0) {
        g.jumpY = 0;
        g.jumpVelocity = 0;
        g.isJumping = false;
      }
    }
    g.playerGroup.position.y = g.jumpY;

    // 4. Slide Physics & Rotation
    if (g.isSliding) {
      g.slideTimer -= dt;
      g.playerGroup.rotation.x = -1.25; // Lean backwards flat to slide
      g.playerGroup.position.y = -0.35;
      if (g.slideTimer <= 0) {
        g.isSliding = false;
        g.playerGroup.rotation.x = 0;
        g.playerGroup.position.y = 0;
      }
    } else {
      g.playerGroup.rotation.x = 0;
    }

    // 5. Rigged Character Run Cycle Animation
    g.runAnimTime += dt * (currentSpeed * 0.35);
    if (!g.isJumping && !g.isSliding && g.playerParts.leftLeg) {
      const legAngle = Math.sin(g.runAnimTime) * 0.85;
      g.playerParts.leftLeg.rotation.x = legAngle;
      g.playerParts.rightLeg.rotation.x = -legAngle;
      g.playerParts.leftArm.rotation.x = -legAngle * 0.8;
      g.playerParts.rightArm.rotation.x = legAngle * 0.8;
    } else if (g.isJumping) {
      // Tucked jump knees & raised arms
      if (g.playerParts.leftLeg) {
        g.playerParts.leftLeg.rotation.x = -0.7;
        g.playerParts.rightLeg.rotation.x = -0.7;
        g.playerParts.leftArm.rotation.x = -2.2;
        g.playerParts.rightArm.rotation.x = -2.2;
      }
    }

    // 6. Demon Monkey Chase Dynamics
    if (g.stumbleTimer > 0) {
      g.stumbleTimer -= dt;
      g.monkeyDist = 28; // Roaring right behind runner!
    } else {
      g.monkeyDist += (100 - g.monkeyDist) * (dt * 0.8); // Slowly recedes
    }
    setMonkeyDistance(Math.round(g.monkeyDist));

    if (g.monkeyGroup) {
      // Monkey position relative to player
      const targetMonkeyZ = 2.2 + (g.monkeyDist * 0.055);
      g.monkeyGroup.position.z += (targetMonkeyZ - g.monkeyGroup.position.z) * (dt * 5);
      g.monkeyGroup.position.x = g.currentX * 0.8;

      // Pounding gorilla arms animation
      if (g.monkeyParts.leftArm) {
        const monCycle = Math.sin(g.runAnimTime * 1.4) * 0.9;
        g.monkeyParts.leftArm.rotation.x = monCycle;
        g.monkeyParts.rightArm.rotation.x = -monCycle;
      }

      // Monkey roar sound when dangerously close
      g.monkeyRoarTimer -= dt;
      if (g.monkeyDist < 35 && g.monkeyRoarTimer <= 0) {
        if (audioRef.current) audioRef.current.playDemonRoar();
        g.monkeyRoarTimer = 4.5;
      }
    }

    // 7. Power-up Timer
    if (g.powerUp.type) {
      g.powerUp.timeLeft -= dt;
      setPowerUpTimeLeft(Math.ceil(g.powerUp.timeLeft));
      if (g.shieldMesh) g.shieldMesh.visible = (g.powerUp.type === 'shield' || g.powerUp.type === 'boost');

      if (g.powerUp.timeLeft <= 0) {
        g.powerUp.type = null;
        setActivePowerUp(null);
        if (g.shieldMesh) g.shieldMesh.visible = false;
      }
    }

    // 8. Track Recycling & Advancing (Endless 3D Runway)
    const CHUNK_LENGTH = 20;
    g.trackChunks.forEach(chunk => {
      chunk.position.z += currentSpeed * dt;
    });

    // Recycle track chunk passing behind camera
    if (g.trackChunks[0].position.z > 14) {
      const first = g.trackChunks.shift();
      const lastZ = g.trackChunks[g.trackChunks.length - 1].position.z;
      first.position.z = lastZ - CHUNK_LENGTH;
      g.trackChunks.push(first);

      // Spawn Obstacles & Coins on fresh chunk
      spawnChunkElements(first.position.z);
    }

    // 9. Move & Collide Obstacles
    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const obs = g.obstacles[i];
      obs.mesh.position.z += currentSpeed * dt;

      // Collision window: player is at z = 0
      if (obs.mesh.position.z > -1.2 && obs.mesh.position.z < 1.2 && !obs.hit) {
        const laneMatches = obs.lane === 'all' || Math.abs(obs.laneX - g.currentX) < 1.1;

        if (laneMatches) {
          let dodged = false;

          // JUMP Obstacles: Log, Spikes
          if (obs.type === 'log' || obs.type === 'spikes') {
            if (g.isJumping && g.jumpY > 1.2) {
              dodged = true;
            }
          }
          // SLIDE Obstacles: Fire Ring, Archway
          else if (obs.type === 'fire_ring') {
            if (g.isSliding) {
              dodged = true;
            }
          }

          if (!dodged) {
            obs.hit = true;

            // Shield or Mega Boost absorbs collision!
            if (g.powerUp.type === 'shield' || g.powerUp.type === 'boost') {
              if (g.powerUp.type === 'shield') {
                g.powerUp.type = null;
                setActivePowerUp(null);
                if (g.shieldMesh) g.shieldMesh.visible = false;
              }
              if (audioRef.current) audioRef.current.playStumble();
            } else {
              // Stumble or Caught!
              if (g.monkeyDist < 35) {
                // Monkey tackles runner -> Game Over!
                triggerGameOver();
                return;
              } else {
                // First stumble: monkey rushes right behind!
                g.stumbleTimer = 4.0;
                g.monkeyDist = 28;
                if (audioRef.current) {
                  audioRef.current.playStumble();
                  audioRef.current.playDemonRoar();
                }
              }
            }
          }
        }
      }

      // Remove obstacles behind camera
      if (obs.mesh.position.z > 14) {
        g.scene.remove(obs.mesh);
        g.obstacles.splice(i, 1);
      }
    }

    // 10. Move & Collect 3D Coins & Power-ups
    for (let i = g.coinsList.length - 1; i >= 0; i--) {
      const c = g.coinsList[i];
      c.mesh.position.z += currentSpeed * dt;
      c.mesh.rotation.y += dt * 4; // 3D Coin Spin

      // Coin Magnet: pull toward player
      if (g.powerUp.type === 'magnet' && c.type === 'coin') {
        c.mesh.position.x += (g.currentX - c.mesh.position.x) * (dt * 10);
        c.mesh.position.y += ((g.jumpY + 0.8) - c.mesh.position.y) * (dt * 10);
      }

      // Collect detection
      const inZ = Math.abs(c.mesh.position.z) < 1.4;
      const inX = Math.abs(c.mesh.position.x - g.currentX) < 1.0;
      const inY = Math.abs(c.mesh.position.y - (g.jumpY + 0.8)) < 1.5;

      if (inZ && inX && inY) {
        if (c.type === 'coin') {
          g.coins += c.value;
          setCoins(g.coins);
          if (audioRef.current) audioRef.current.playCoinDing();
        } else if (c.type === 'powerup') {
          g.powerUp.type = c.subType;
          g.powerUp.timeLeft = 10;
          setActivePowerUp(c.subType);
          setPowerUpTimeLeft(10);
          if (audioRef.current) audioRef.current.playPowerUp();
        }

        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
        continue;
      }

      // Remove past camera
      if (c.mesh.position.z > 14) {
        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
      }
    }
  };

  // =========================================================================
  // SPAWN 3D OBSTACLES, COINS & POWER-UPS ON FRESH CHUNKS
  // =========================================================================
  const spawnChunkElements = (zPos) => {
    const g = gameRef.current;
    if (!g.scene) return;

    // 1. Spawn Obstacles (35% chance)
    if (Math.random() < 0.38) {
      const types = ['log', 'fire_ring', 'spikes'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const lane = chosenType === 'fire_ring' ? 'all' : Math.floor(Math.random() * 3);
      const laneX = lane === 'all' ? 0 : (lane - 1) * 1.8;

      let mesh = null;

      if (chosenType === 'log') {
        // Ancient Fallen Wooden Log across the lane
        const logGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 16);
        const logMat = new THREE.MeshStandardMaterial({ color: 0x542c11, roughness: 0.85 });
        mesh = new THREE.Mesh(logGeo, logMat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(laneX, 0.35, zPos);
        mesh.castShadow = true;
      } else if (chosenType === 'spikes') {
        // Ancient Low Stone Hurdle with Sharp Spikes
        mesh = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(2.0, 0.45, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.22;
        mesh.add(base);

        // 4 Steel Spikes
        const spikeGeo = new THREE.ConeGeometry(0.14, 0.6, 10);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.8 });
        for (let s = -3; s <= 3; s += 2) {
          const sp = new THREE.Mesh(spikeGeo, spikeMat);
          sp.position.set(s * 0.25, 0.65, 0);
          mesh.add(sp);
        }
        mesh.position.set(laneX, 0, zPos);
      } else if (chosenType === 'fire_ring') {
        // Low Flaming Fire Ring Arch (Slide Underneath!)
        mesh = new THREE.Group();
        const archMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
        const archTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.6, 0.6), archMat);
        archTop.position.set(0, 1.45, 0); // Low enough to hit unless sliding!
        mesh.add(archTop);

        // Fire Torus Ring
        const fireTorus = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.2, 12, 24),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        fireTorus.position.set(0, 1.6, 0);
        mesh.add(fireTorus);

        mesh.position.set(0, 0, zPos);
      }

      if (mesh) {
        g.scene.add(mesh);
        g.obstacles.push({
          mesh,
          type: chosenType,
          lane,
          laneX,
          hit: false
        });
        return; // Don't place coins inside obstacle
      }
    }

    // 2. Spawn Power-ups (5% chance)
    if (Math.random() < 0.05) {
      const powerTypes = ['magnet', 'shield', 'boost'];
      const subType = powerTypes[Math.floor(Math.random() * powerTypes.length)];
      const lane = Math.floor(Math.random() * 3);
      const laneX = (lane - 1) * 1.8;

      const pOrbGeo = new THREE.SphereGeometry(0.45, 16, 16);
      const pColor = subType === 'magnet' ? 0xef4444 : subType === 'shield' ? 0x38bdf8 : 0xf59e0b;
      const pOrbMat = new THREE.MeshBasicMaterial({ color: pColor, wireframe: true });
      const pMesh = new THREE.Mesh(pOrbGeo, pOrbMat);
      pMesh.position.set(laneX, 0.9, zPos);

      g.scene.add(pMesh);
      g.coinsList.push({
        mesh: pMesh,
        type: 'powerup',
        subType,
        value: 0
      });
      return;
    }

    // 3. Spawn 3D Golden Coin Lines (45% chance)
    if (Math.random() < 0.45) {
      const lane = Math.floor(Math.random() * 3);
      const laneX = (lane - 1) * 1.8;
      const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.95,
        roughness: 0.15
      });

      for (let c = 0; c < 4; c++) {
        const cMesh = new THREE.Mesh(coinGeo, coinMat);
        cMesh.rotation.x = Math.PI / 2;
        cMesh.position.set(laneX, 0.75, zPos + (c * 2.5));
        g.scene.add(cMesh);
        g.coinsList.push({
          mesh: cMesh,
          type: 'coin',
          value: 1
        });
      }
    }
  };

  // =========================================================================
  // GAME OVER HANDLER
  // =========================================================================
  const triggerGameOver = () => {
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

    if (onScoreUpdate) {
      const levelEarned = Math.max(1, Math.floor(g.distance / 120));
      onScoreUpdate('Temple Run 3D', finalScore, levelEarned);
    }
  };

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        width: '100%',
        height: isFullscreen ? '100dvh' : '520px',
        maxWidth: isFullscreen ? '100%' : '960px',
        margin: '0 auto',
        borderRadius: isFullscreen ? 0 : '22px',
        overflow: 'hidden',
        background: '#0a1c14',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(245, 158, 11, 0.3)',
        border: '1.5px solid rgba(245, 158, 11, 0.45)',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Authentic Temple Run HUD */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 20,
        color: '#fff'
      }}>
        {/* Distance Run */}
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
            <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>
              {distance}m
            </span>
          </div>
        </div>

        {/* Demon Monkey Danger Alert */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 14px',
          borderRadius: '16px',
          border: monkeyDistance < 40 ? '1.5px solid #ef4444' : '1px solid rgba(245, 158, 11, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: monkeyDistance < 40 ? '#ef4444' : '#fbbf24', fontWeight: 900 }}>
            <span>👹 Demon Monkey</span>
            <span>{monkeyDistance < 40 ? '⚠️ DANGER!' : 'CHASING'}</span>
          </div>
          <div style={{ width: '85px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${100 - monkeyDistance}%`,
              height: '100%',
              background: monkeyDistance < 40 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : '#10b981',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>

        {/* Coins & Audio/Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.22)', padding: '5px 12px', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.5)' }}>
            <span style={{ fontSize: '1.1rem' }}>🪙</span>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fbbf24', fontFamily: 'monospace' }}>
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
                width: '36px',
                height: '36px',
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
                width: '36px',
                height: '36px',
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

      {/* Active Power-up Gauge */}
      {activePowerUp && (
        <div style={{
          position: 'absolute',
          top: '68px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(234, 88, 12, 0.95))',
          padding: '6px 18px',
          borderRadius: '20px',
          color: '#fff',
          fontWeight: 900,
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 18px rgba(245, 158, 11, 0.55)'
        }}>
          <span>{activePowerUp === 'magnet' ? '🧲 COIN MAGNET' : activePowerUp === 'shield' ? '🛡️ TEMPLE SHIELD' : '⚡ SPRINT BOOST'}</span>
          <span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
            {powerUpTimeLeft}s
          </span>
        </div>
      )}

      {/* WebGL 3D Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />

      {/* Mobile Touch D-Pad / Move Controls */}
      {gameState === 'playing' && (
        <div style={{
          position: 'absolute',
          bottom: 18,
          left: 18,
          right: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          zIndex: 30
        }}>
          {/* Left / Right Lane Shifts */}
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={moveLeft}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '2px solid rgba(251, 191, 36, 0.7)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={32} color="#fbbf24" />
            </button>
            <button
              type="button"
              onClick={moveRight}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '2px solid rgba(251, 191, 36, 0.7)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={32} color="#fbbf24" />
            </button>
          </div>

          {/* Jump / Slide Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={slide}
              style={{
                width: '66px',
                height: '66px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.9), rgba(194, 65, 12, 0.9))',
                border: '2px solid #fff',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.72rem',
                boxShadow: '0 6px 20px rgba(234, 88, 12, 0.55)',
                cursor: 'pointer'
              }}
            >
              <ArrowDown size={24} color="#fff" />
              SLIDE
            </button>

            <button
              type="button"
              onClick={jump}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: '2.5px solid #fff',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.76rem',
                boxShadow: '0 6px 24px rgba(245, 158, 11, 0.7)',
                cursor: 'pointer'
              }}
            >
              <ArrowUp size={28} color="#fff" />
              JUMP
            </button>
          </div>
        </div>
      )}

      {/* Start Game Overlay */}
      {gameState === 'menu' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(10, 28, 20, 0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 40,
          textAlign: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            fontSize: '3.6rem',
            marginBottom: '8px',
            filter: 'drop-shadow(0 6px 15px rgba(245, 158, 11, 0.8))'
          }}>
            🗿
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 900,
            margin: '0 0 6px 0',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1.5px'
          }}>
            TEMPLE RUN 3D
          </h1>
          <p style={{ color: '#d1d5db', fontSize: '0.92rem', margin: '0 0 20px 0', maxWidth: '380px' }}>
            Steal the Golden Idol from the ancient temple & sprint through 3D mossy corridors to escape the Demon Monkey!
          </p>

          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            background: 'rgba(0,0,0,0.5)',
            padding: '12px 22px',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.15)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700 }}>HIGH SCORE</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24' }}>{highScore}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700 }}>CONTROLS</span>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38bdf8' }}>Swipe or ⬅️ ⬆️ ⬇️ ➡️</div>
            </div>
          </div>

          <button
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              border: '2.5px solid #fff',
              color: '#fff',
              fontSize: '1.15rem',
              fontWeight: 900,
              padding: '14px 48px',
              borderRadius: '26px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 32px rgba(234, 88, 12, 0.7)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Play size={22} fill="#fff" /> START ESCAPE
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(69, 10, 10, 0.96) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 40,
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '3.2rem', marginBottom: '8px' }}>
            👹💥
          </div>

          <h2 style={{
            fontSize: '2.1rem',
            fontWeight: 900,
            margin: '0 0 6px 0',
            color: '#ef4444',
            letterSpacing: '1px'
          }}>
            CAUGHT BY DEMON MONKEY!
          </h2>

          <div style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '20px',
            padding: '18px 28px',
            display: 'flex',
            gap: '26px',
            margin: '18px 0 24px 0'
          }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 800 }}>DISTANCE</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>{distance}m</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 800 }}>COINS</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fbbf24' }}>{coins} 🪙</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 800 }}>FINAL SCORE</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38bdf8' }}>{score}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              onClick={startGame}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                border: '2px solid #fff',
                color: '#fff',
                fontSize: '1.05rem',
                fontWeight: 900,
                padding: '13px 36px',
                borderRadius: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 28px rgba(234, 88, 12, 0.65)'
              }}
            >
              <RotateCcw size={18} /> PLAY AGAIN
            </button>

            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  padding: '13px 24px',
                  borderRadius: '22px',
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
