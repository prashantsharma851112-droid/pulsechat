import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import * as THREE from 'three';
import { AuthContext } from '../../context/AuthContext';
import { BACKEND_URL } from '../../utils/config';

// =========================================================================
// NATIVE WEB AUDIO ENGINE: TEMPLE RUN JUNGLE & TRIBAL DRUMS SYNTHESIZER
// High-fidelity synthesized drums, shakers, coin bells, jump & slide swooshes
// Zero external mp3/wav files required
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
    playGameOver,
    setMuted: (val) => {
      isMuted = val;
      if (val) stopTribalMusic();
    }
  };
};

// =========================================================================
// PROCEDURAL CANVAS TEXTURE GENERATOR: AUTHENTIC TEMPLE RUN STONE & SPIRALS
// Creates golden-yellow stone flagstones with ancient carved stone spirals & moss
// =========================================================================
const createStonePathwayTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Warm Golden Sandstone Flagstones Base
  const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
  baseGrad.addColorStop(0, '#eab308');
  baseGrad.addColorStop(0.5, '#ca8a04');
  baseGrad.addColorStop(1, '#a16207');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Stone Tile Texture Noise & Mortar Lines
  ctx.fillStyle = 'rgba(113, 63, 18, 0.4)';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(0, y, 512, 4);
    for (let x = (y % 128 === 0 ? 0 : 32); x < 512; x += 64) {
      ctx.fillRect(x, y, 4, 64);
    }
  }

  // 3. Ancient Carved Stone Spirals (Exact match to Temple Run 2 Screenshots)
  const drawSpiral = (cx, cy, maxR) => {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) {
      const r = (a / (Math.PI * 6)) * maxR;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Inner highlight ring
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  // Draw concentric spiral stone runes along center and side paths
  drawSpiral(256, 128, 55);
  drawSpiral(256, 384, 55);
  drawSpiral(100, 256, 40);
  drawSpiral(412, 256, 40);

  // 4. Wild Moss & Vegetation on Outer Edges
  ctx.fillStyle = '#166534';
  for (let i = 0; i < 512; i += 8) {
    const mossW1 = Math.random() * 32 + 10;
    const mossW2 = Math.random() * 32 + 10;
    ctx.fillRect(0, i, mossW1, 8);
    ctx.fillRect(512 - mossW2, i, mossW2, 8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
};

// Procedural Sunset Sky Canvas Texture (Golden-Orange clouds to blue)
const createSkyTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f97316');   // Vibrant Orange Sunset
  grad.addColorStop(0.35, '#fb923c');
  grad.addColorStop(0.65, '#fed7aa'); // Golden Horizon
  grad.addColorStop(0.85, '#ffffff'); // Cloud Deck
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Wispy cloud layers
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, 300 + i * 25, 180 + Math.random() * 80, 20 + Math.random() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
};

export default function TempleRunGame({ onScoreUpdate, onBack }) {
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  // HUD & Game States
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
  const [powerMeter, setPowerMeter] = useState(0); // 0 to 100%

  // Touch Swipe tracking (NO BUTTONS ON SCREEN, 100% FINGER GESTURES)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef(false);

  // Core gameplay state references (mutable for high-performance 60fps)
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    playerGroup: null,
    monkeyGroup: null,

    // Rigged Character Limbs
    playerParts: {
      leftLeg: null,
      rightLeg: null,
      leftArm: null,
      rightArm: null,
      torso: null,
      head: null
    },

    // Demon Ape Parts
    monkeyParts: {
      leftArm: null,
      rightArm: null,
      body: null
    },

    // 3D Procedural Chunks & Elements
    trackChunks: [],
    obstacles: [],
    coinsList: [],
    cloudsList: [],

    // Game Variables
    speed: 40,
    distance: 0,
    coins: 0,
    score: 0,
    powerMeter: 0,

    playerLane: 1, // 0 = Left (-1.8), 1 = Center (0), 2 = Right (1.8)
    targetX: 0,
    currentX: 0,

    isJumping: false,
    jumpY: 0,
    jumpVelocity: 0,

    isSliding: false,
    slideTimer: 0,

    stumbleTimer: 0,
    monkeyDist: 90, // 90 = standard behind, 28 = right at runner's heels

    runAnimTime: 0,
    lastTime: 0,
    running: false
  });

  // Initialize Web Audio
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
  // FINGER SWIPE CONTROLS & ACTIONS (ZERO BUTTONS ON SCREEN)
  // =========================================================================
  const moveLeft = useCallback(() => {
    const g = gameRef.current;
    if (g.playerLane > 0) {
      g.playerLane -= 1;
      g.targetX = (g.playerLane - 1) * 1.85;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const moveRight = useCallback(() => {
    const g = gameRef.current;
    if (g.playerLane < 2) {
      g.playerLane += 1;
      g.targetX = (g.playerLane - 1) * 1.85;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.isJumping && !g.isSliding) {
      g.isJumping = true;
      g.jumpVelocity = 15.8;
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
      g.slideTimer = 0.85;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, []);

  // Keyboard navigation fallback
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

  // Touch Swipe Handlers (Full screen natural touch interaction)
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current || !e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    // Detect immediate swipe gesture
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        if (dy > 0) slide();
        else jump();
      }
      // Reset start to avoid repeated triggers
      touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
      isDraggingRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // =========================================================================
  // THREE.JS SCENE SETUP & PROCEDURAL ASSETS
  // =========================================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene & Sunset Sky Background
    const scene = new THREE.Scene();
    const skyTex = createSkyTexture();
    scene.background = skyTex;
    // Volumetric warm mountain fog
    scene.fog = new THREE.FogExp2(0xfed7aa, 0.009);

    // 2. Perspective Camera (Over-the-shoulder third-person camera)
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 400);
    camera.position.set(0, 4.2, 7.8);
    camera.lookAt(0, 2.0, -14);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Dramatic Golden Sunset Lighting
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xf59e0b, 1.4);
    sunLight.position.set(25, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 5. Materials
    const pathwayTex = createStonePathwayTexture();
    const stonePathwayMat = new THREE.MeshStandardMaterial({
      map: pathwayTex,
      roughness: 0.75,
      metalness: 0.15
    });

    const carvedWallMat = new THREE.MeshStandardMaterial({
      color: 0x57534e, // Ancient grey stone
      roughness: 0.9,
      metalness: 0.05
    });

    const emeraldGemMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Glowing green emerald
      emissive: 0x059669,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.9
    });

    const goldCoinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.95,
      roughness: 0.15
    });

    // 6. BUILD PROCEDURAL 3D RUNNER (Guy Dangerous - Real Temple Run Outfit)
    // Red Hair, White Safari Shirt, Olive Trousers, Brown Boots (Exact match to Image 2)
    const playerGroup = new THREE.Group();

    // Torso (White Safari Explorer Shirt)
    const torsoGeo = new THREE.BoxGeometry(0.85, 1.05, 0.45);
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 });
    const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    torsoMesh.position.y = 1.35;
    torsoMesh.castShadow = true;
    playerGroup.add(torsoMesh);

    // Head (Skin Tone)
    const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa });
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 2.05, 0);
    playerGroup.add(headMesh);

    // Red/Auburn Hair
    const hairGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 });
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 2.15, -0.05);
    playerGroup.add(hairMesh);

    // Legs (Olive Green Explorer Pants - Exact match to Image 2)
    const legGeo = new THREE.BoxGeometry(0.26, 0.75, 0.26);
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 });

    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.25, 0.48, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.25, 0.48, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.55, 1.35, 0);
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.55, 1.35, 0);
    playerGroup.add(rightArm);

    scene.add(playerGroup);

    // 7. BUILD PROCEDURAL 3D DEMON APE (Massive Black Gorilla - Exact match to Image 1)
    const monkeyGroup = new THREE.Group();

    // Massive Gorilla Back & Torso
    const apeTorsoGeo = new THREE.BoxGeometry(2.2, 2.1, 1.5);
    const apeFurMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 }); // Pitch black fur
    const apeTorso = new THREE.Mesh(apeTorsoGeo, apeFurMat);
    apeTorso.position.y = 1.6;
    monkeyGroup.add(apeTorso);

    // Silver Crest on Head
    const apeHeadGeo = new THREE.BoxGeometry(1.2, 1.1, 1.1);
    const apeHead = new THREE.Mesh(apeHeadGeo, apeFurMat);
    apeHead.position.set(0, 2.7, 0.4);
    monkeyGroup.add(apeHead);

    const crestGeo = new THREE.BoxGeometry(0.6, 0.35, 1.0);
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.6 });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.position.set(0, 3.25, 0.35);
    monkeyGroup.add(crest);

    // Heavy Pounding Gorilla Arms
    const apeArmGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const apeLeftArm = new THREE.Mesh(apeArmGeo, apeFurMat);
    apeLeftArm.position.set(-1.4, 1.1, 0.4);
    const apeRightArm = new THREE.Mesh(apeArmGeo, apeFurMat);
    apeRightArm.position.set(1.4, 1.1, 0.4);
    monkeyGroup.add(apeLeftArm);
    monkeyGroup.add(apeRightArm);

    monkeyGroup.position.set(0, 0, 4.6); // Chasing right behind runner
    scene.add(monkeyGroup);

    // 8. VOLUMETRIC CLOUDS DECK (Beneath Floating Stone Bridge)
    const cloudsList = [];
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      roughness: 1.0
    });

    for (let c = 0; c < 25; c++) {
      const cloudGeo = new THREE.SphereGeometry(Math.random() * 8 + 6, 8, 8);
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 60,
        -12 - Math.random() * 8,
        -Math.random() * 200
      );
      scene.add(cloud);
      cloudsList.push(cloud);
    }

    // 9. PROCEDURAL 3D ENDLESS TRACK GENERATOR
    const CHUNK_LENGTH = 24;
    const CHUNK_COUNT = 14;
    const trackChunks = [];

    const createTrackChunk = (zPos) => {
      const chunk = new THREE.Group();
      chunk.position.z = zPos;

      // Stone Bridge Runway (Width 6.6 units)
      const floorGeo = new THREE.BoxGeometry(6.6, 1.2, CHUNK_LENGTH);
      const floor = new THREE.Mesh(floorGeo, stonePathwayMat);
      floor.position.y = -0.6;
      floor.receiveShadow = true;
      chunk.add(floor);

      // Carved Stone Side Railings with Spiral Relief
      const railGeo = new THREE.BoxGeometry(0.8, 1.6, CHUNK_LENGTH);
      const leftRail = new THREE.Mesh(railGeo, carvedWallMat);
      leftRail.position.set(-3.5, 0.5, 0);
      const rightRail = new THREE.Mesh(railGeo, carvedWallMat);
      rightRail.position.set(3.5, 0.5, 0);
      chunk.add(leftRail);
      chunk.add(rightRail);

      // Ancient Stone Pillars with Emerald Gems at intervals (Exact match to Image 1 & 2)
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, 4.2, 12);
      const pL = new THREE.Mesh(pillarGeo, carvedWallMat);
      pL.position.set(-3.4, 1.8, 0);
      const pR = new THREE.Mesh(pillarGeo, carvedWallMat);
      pR.position.set(3.4, 1.8, 0);
      chunk.add(pL);
      chunk.add(pR);

      // Glowing Green Emerald Gems on Top of Pillars
      const gemGeo = new THREE.OctahedronGeometry(0.38, 0);
      const gemL = new THREE.Mesh(gemGeo, emeraldGemMat);
      gemL.position.set(-3.4, 4.1, 0);
      const gemR = new THREE.Mesh(gemGeo, emeraldGemMat);
      gemR.position.set(3.4, 4.1, 0);
      chunk.add(gemL);
      chunk.add(gemR);

      // Floating Mountain Rocks & Pine Trees in Distance
      const rockGeo = new THREE.DodecahedronGeometry(5 + Math.random() * 4, 1);
      const rock = new THREE.Mesh(rockGeo, carvedWallMat);
      const rockSide = Math.random() < 0.5 ? -18 : 18;
      rock.position.set(rockSide, -4, 0);
      chunk.add(rock);

      // Pine Tree on Cliff (Exact match to Image 1)
      const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5);
      const treeTrunk = new THREE.Mesh(treeTrunkGeo, new THREE.MeshStandardMaterial({ color: 0x45230e }));
      treeTrunk.position.set(rockSide * 0.7, 0, 0);
      const treeLeavesGeo = new THREE.ConeGeometry(1.6, 4.5, 8);
      const treeLeaves = new THREE.Mesh(treeLeavesGeo, new THREE.MeshStandardMaterial({ color: 0x166534 }));
      treeLeaves.position.set(rockSide * 0.7, 2.8, 0);
      chunk.add(treeTrunk);
      chunk.add(treeLeaves);

      scene.add(chunk);
      return chunk;
    };

    for (let i = 0; i < CHUNK_COUNT; i++) {
      trackChunks.push(createTrackChunk(-i * CHUNK_LENGTH));
    }

    // Save references to gameRef
    gameRef.current.scene = scene;
    gameRef.current.camera = camera;
    gameRef.current.renderer = renderer;
    gameRef.current.playerGroup = playerGroup;
    gameRef.current.monkeyGroup = monkeyGroup;
    gameRef.current.trackChunks = trackChunks;
    gameRef.current.cloudsList = cloudsList;

    gameRef.current.playerParts = {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      torso: torsoMesh,
      head: headMesh
    };

    gameRef.current.monkeyParts = {
      leftArm: apeLeftArm,
      rightArm: apeRightArm,
      body: apeTorso
    };

    // Resize handler
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
    g.powerMeter = 0;
    g.playerLane = 1;
    g.targetX = 0;
    g.currentX = 0;
    g.isJumping = false;
    g.jumpY = 0;
    g.jumpVelocity = 0;
    g.isSliding = false;
    g.slideTimer = 0;
    g.stumbleTimer = 0;
    g.monkeyDist = 90;

    // Clear active obstacles & coins
    g.obstacles.forEach(o => g.scene.remove(o.mesh));
    g.obstacles = [];
    g.coinsList.forEach(c => g.scene.remove(c.mesh));
    g.coinsList = [];

    setDistance(0);
    setCoins(0);
    setScore(0);
    setPowerMeter(0);
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
    const currentSpeed = g.speed;
    g.distance += currentSpeed * dt;
    g.speed = Math.min(85, 42 + g.distance * 0.035);

    setDistance(Math.floor(g.distance));
    const computedScore = Math.floor(g.distance * 2 + g.coins * 15);
    g.score = computedScore;
    setScore(computedScore);

    // 2. Smooth Lateral Lane Movement
    g.currentX += (g.targetX - g.currentX) * (dt * 14);
    g.playerGroup.position.x = g.currentX;
    // Dynamic runner tilt
    g.playerGroup.rotation.z = (g.targetX - g.currentX) * -0.28;

    // 3. Jump Physics (Parabolic Arc)
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
      g.playerGroup.rotation.x = -1.25; // Lean backwards flat
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
      if (g.playerParts.leftLeg) {
        g.playerParts.leftLeg.rotation.x = -0.7;
        g.playerParts.rightLeg.rotation.x = -0.7;
        g.playerParts.leftArm.rotation.x = -2.2;
        g.playerParts.rightArm.rotation.x = -2.2;
      }
    }

    // 6. Demon Ape Pursuit Dynamics
    if (g.stumbleTimer > 0) {
      g.stumbleTimer -= dt;
      g.monkeyDist = 28; // Roaring right behind runner!
    } else {
      g.monkeyDist += (90 - g.monkeyDist) * (dt * 0.8);
    }

    if (g.monkeyGroup) {
      const targetMonkeyZ = 2.4 + (g.monkeyDist * 0.05);
      g.monkeyGroup.position.z += (targetMonkeyZ - g.monkeyGroup.position.z) * (dt * 5);
      g.monkeyGroup.position.x = g.currentX * 0.85;

      if (g.monkeyParts.leftArm) {
        const apeCycle = Math.sin(g.runAnimTime * 1.4) * 0.95;
        g.monkeyParts.leftArm.rotation.x = apeCycle;
        g.monkeyParts.rightArm.rotation.x = -apeCycle;
      }
    }

    // 7. Track Recycling & Advancing (Endless 3D Sky Runway)
    const CHUNK_LENGTH = 24;
    g.trackChunks.forEach(chunk => {
      chunk.position.z += currentSpeed * dt;
    });

    if (g.trackChunks[0].position.z > 16) {
      const first = g.trackChunks.shift();
      const lastZ = g.trackChunks[g.trackChunks.length - 1].position.z;
      first.position.z = lastZ - CHUNK_LENGTH;
      g.trackChunks.push(first);

      spawnChunkElements(first.position.z);
    }

    // 8. Move Clouds
    g.cloudsList.forEach(cloud => {
      cloud.position.z += currentSpeed * dt * 0.4;
      if (cloud.position.z > 20) {
        cloud.position.z = -180 - Math.random() * 40;
      }
    });

    // 9. Move & Collide Obstacles
    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const obs = g.obstacles[i];
      obs.mesh.position.z += currentSpeed * dt;

      // Collision window
      if (obs.mesh.position.z > -1.2 && obs.mesh.position.z < 1.2 && !obs.hit) {
        const laneMatches = obs.lane === 'all' || Math.abs(obs.laneX - g.currentX) < 1.1;

        if (laneMatches) {
          let dodged = false;
          if (obs.type === 'log' || obs.type === 'spikes') {
            if (g.isJumping && g.jumpY > 1.2) dodged = true;
          } else if (obs.type === 'fire_ring') {
            if (g.isSliding) dodged = true;
          }

          if (!dodged) {
            obs.hit = true;
            if (g.monkeyDist < 35) {
              triggerGameOver();
              return;
            } else {
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

      if (obs.mesh.position.z > 16) {
        g.scene.remove(obs.mesh);
        g.obstacles.splice(i, 1);
      }
    }

    // 10. Move & Collect 3D Coins
    for (let i = g.coinsList.length - 1; i >= 0; i--) {
      const c = g.coinsList[i];
      c.mesh.position.z += currentSpeed * dt;
      c.mesh.rotation.y += dt * 4;

      const inZ = Math.abs(c.mesh.position.z) < 1.4;
      const inX = Math.abs(c.mesh.position.x - g.currentX) < 1.0;
      const inY = Math.abs(c.mesh.position.y - (g.jumpY + 0.8)) < 1.5;

      if (inZ && inX && inY) {
        g.coins += 1;
        setCoins(g.coins);
        g.powerMeter = Math.min(100, g.powerMeter + 2.5);
        setPowerMeter(g.powerMeter);
        if (audioRef.current) audioRef.current.playCoinDing();

        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
        continue;
      }

      if (c.mesh.position.z > 16) {
        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
      }
    }
  };

  // =========================================================================
  // SPAWN 3D OBSTACLES & COINS
  // =========================================================================
  const spawnChunkElements = (zPos) => {
    const g = gameRef.current;
    if (!g.scene) return;

    // 1. Obstacles (35% chance)
    if (Math.random() < 0.36) {
      const types = ['log', 'spikes', 'fire_ring'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const lane = chosenType === 'fire_ring' ? 'all' : Math.floor(Math.random() * 3);
      const laneX = lane === 'all' ? 0 : (lane - 1) * 1.85;

      let mesh = null;

      if (chosenType === 'log') {
        const logGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 16);
        const logMat = new THREE.MeshStandardMaterial({ color: 0x542c11, roughness: 0.85 });
        mesh = new THREE.Mesh(logGeo, logMat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(laneX, 0.35, zPos);
        mesh.castShadow = true;
      } else if (chosenType === 'spikes') {
        mesh = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(2.0, 0.45, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.22;
        mesh.add(base);

        const spikeGeo = new THREE.ConeGeometry(0.14, 0.6, 10);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.8 });
        for (let s = -3; s <= 3; s += 2) {
          const sp = new THREE.Mesh(spikeGeo, spikeMat);
          sp.position.set(s * 0.25, 0.65, 0);
          mesh.add(sp);
        }
        mesh.position.set(laneX, 0, zPos);
      } else if (chosenType === 'fire_ring') {
        mesh = new THREE.Group();
        const archMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
        const archTop = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.6, 0.6), archMat);
        archTop.position.set(0, 1.45, 0);
        mesh.add(archTop);

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
        g.obstacles.push({ mesh, type: chosenType, lane, laneX, hit: false });
        return;
      }
    }

    // 2. 3D Golden Coins (45% chance)
    if (Math.random() < 0.45) {
      const lane = Math.floor(Math.random() * 3);
      const laneX = (lane - 1) * 1.85;
      const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
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
        g.coinsList.push({ mesh: cMesh, value: 1 });
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
        position: 'relative',
        width: '100%',
        height: '560px',
        maxWidth: '960px',
        margin: '0 auto',
        borderRadius: '24px',
        overflow: 'hidden',
        background: '#040d0a',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(245, 158, 11, 0.35)',
        border: '2px solid rgba(245, 158, 11, 0.5)',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* =========================================================================
          AUTHENTIC TEMPLE RUN HUD (EXACT REPLICA OF USER SCREENSHOTS)
          ========================================================================= */}

      {/* TOP LEFT: Carved Stone Totem Power Meter with Green Running Man */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {/* Ancient Stone Totem Medallion */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #44403c 0%, #292524 100%)',
          border: '3px solid #78716c',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 4px 15px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {/* Glowing Green Running Icon */}
          <div style={{
            fontSize: '1.6rem',
            filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.9))'
          }}>
            🏃
          </div>

          {/* Circular Progress Gauge */}
          <svg style={{ position: 'absolute', inset: -3, width: '62px', height: '62px', transform: 'rotate(-90deg)' }}>
            <circle
              cx="31"
              cy="31"
              r="26"
              fill="transparent"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeDasharray="163"
              strokeDashoffset={163 - (163 * powerMeter) / 100}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* TOP RIGHT: Carved Ancient Stone Tablets (Score & Coins with Emerald Gems) */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        {/* Score Stone Tablet */}
        <div style={{
          background: 'linear-gradient(180deg, #44403c 0%, #292524 100%)',
          border: '2.5px solid #78716c',
          borderRadius: '16px',
          padding: '4px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <span style={{
            fontFamily: 'serif, monospace',
            fontSize: '1.25rem',
            fontWeight: 900,
            color: '#fbbf24',
            letterSpacing: '1px'
          }}>
            {score}
          </span>
        </div>

        {/* Coins Stone Tablet with Gold Diamond Icon */}
        <div style={{
          background: 'linear-gradient(180deg, #44403c 0%, #292524 100%)',
          border: '2.5px solid #78716c',
          borderRadius: '16px',
          padding: '3px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
        }}>
          <span style={{ color: '#fbbf24', fontSize: '1rem' }}>◆</span>
          <span style={{
            fontFamily: 'serif, monospace',
            fontSize: '1.15rem',
            fontWeight: 900,
            color: '#fef08a'
          }}>
            {coins}
          </span>
        </div>
      </div>

      {/* BOTTOM RIGHT: Carved Stone Pause Button (Exact match to Image 1 & 2) */}
      {gameState === 'playing' && (
        <button
          onClick={() => setGameState('paused')}
          style={{
            position: 'absolute',
            bottom: 18,
            right: 18,
            zIndex: 25,
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, #44403c 0%, #292524 100%)',
            border: '2.5px solid #78716c',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {/* Gold Pause Bars */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '5px', height: '18px', background: '#fbbf24', borderRadius: '2px' }} />
            <div style={{ width: '5px', height: '18px', background: '#fbbf24', borderRadius: '2px' }} />
          </div>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
        </button>
      )}

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />

      {/* Start Game Menu Overlay */}
      {gameState === 'menu' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(26, 16, 5, 0.94) 100%)',
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
            fontSize: '3.8rem',
            marginBottom: '8px',
            filter: 'drop-shadow(0 6px 15px rgba(245, 158, 11, 0.8))'
          }}>
            🗿
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 900,
            margin: '0 0 6px 0',
            fontFamily: 'serif, sans-serif',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '2px'
          }}>
            TEMPLE RUN
          </h1>
          <p style={{ color: '#fed7aa', fontSize: '0.92rem', margin: '0 0 20px 0', maxWidth: '380px', fontWeight: 600 }}>
            Swipe with your finger to Jump, Slide & Turn across the floating sky temple!
          </p>

          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            background: 'rgba(0,0,0,0.5)',
            padding: '12px 24px',
            borderRadius: '18px',
            border: '1.5px solid rgba(245, 158, 11, 0.4)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700 }}>HIGH SCORE</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fbbf24' }}>{highScore}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700 }}>CONTROLS</span>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38bdf8' }}>Swipe Up / Down / Left / Right</div>
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
              boxShadow: '0 8px 32px rgba(234, 88, 12, 0.7)'
            }}
          >
            RUN NOW
          </button>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === 'paused' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          backdropFilter: 'blur(8px)'
        }}>
          <h2 style={{ color: '#fbbf24', fontSize: '2rem', fontWeight: 900, marginBottom: '20px' }}>GAME PAUSED</h2>
          <button
            onClick={() => setGameState('playing')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              border: '2px solid #fff',
              color: '#fff',
              fontSize: '1.05rem',
              fontWeight: 900,
              padding: '12px 36px',
              borderRadius: '22px',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            RESUME RUN
          </button>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 800,
                padding: '10px 24px',
                borderRadius: '20px',
                cursor: 'pointer'
              }}
            >
              Exit to Menu
            </button>
          )}
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
          <div style={{ fontSize: '3.4rem', marginBottom: '8px' }}>
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
              RUN AGAIN
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
