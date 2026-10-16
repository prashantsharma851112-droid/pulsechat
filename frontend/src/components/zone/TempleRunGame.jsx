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

  // Authentic Temple Run Ascending Pentatonic Coin Scale
  const PENTATONIC_SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98];
  let coinStreak = 0;
  let lastCoinTime = 0;

  const playCoinDing = () => {
    init();
    if (isMuted || !ctx) return { streak: 1 };
    try {
      const now = ctx.currentTime;
      if (now - lastCoinTime > 1.8) {
        coinStreak = 0;
      }
      lastCoinTime = now;
      const noteIdx = Math.min(coinStreak, PENTATONIC_SCALE.length - 1);
      const freq = PENTATONIC_SCALE[noteIdx];
      coinStreak++;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.07);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);

      // Harmonious chime if high streak (authentic dopamine hit!)
      if (coinStreak >= 5) {
        const overtone = ctx.createOscillator();
        const overGain = ctx.createGain();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now);
        overGain.gain.setValueAtTime(0.07, now);
        overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        overtone.connect(overGain);
        overGain.connect(ctx.destination);
        overtone.start(now);
        overtone.stop(now + 0.32);
      }

      return { streak: coinStreak };
    } catch (e) {
      return { streak: 1 };
    }
  };

  // Deep pounding heartbeat pulse when Demon Monkey is close
  const playHeartbeat = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      // Lub
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(65, now);
      osc1.frequency.exponentialRampToValueAtTime(32, now + 0.12);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.14);

      // Dub
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(52, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(28, now + 0.26);
      gain2.gain.setValueAtTime(0.17, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.28);
    } catch (e) {}
  };

  // Turn swoosh
  const playTurnWhoosh = () => {
    init();
    if (isMuted || !ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
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
      gain.gain.setValueAtTime(0.09, now);
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
      gain.gain.setValueAtTime(0.1, now);
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
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(55, now + 0.45);
      osc2.frequency.setValueAtTime(250, now);
      osc2.frequency.exponentialRampToValueAtTime(70, now + 0.45);
      gain.gain.setValueAtTime(0.16, now);
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
      gain.gain.setValueAtTime(0.18, now);
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
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.7);
      gain.gain.setValueAtTime(0.2, now);
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
    playHeartbeat,
    playTurnWhoosh,
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
// HIGH-RES PROCEDURAL TEXTURE GENERATOR: AUTHENTIC TEMPLE RUN STONE SLABS
// Carved concentric spirals, golden flagstones, weathered moss & mortar
// =========================================================================
// Soft Ground Shadow Radial Texture
const createShadowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.4)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
};

// =========================================================================
// HIGH-RES PROCEDURAL TEXTURE GENERATOR: AUTHENTIC REALISTIC TEMPLE STONE SLABS
// Carved concentric spirals, golden flagstones, weathered moss, chisel highlights
// =========================================================================
const createStonePathwayTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Multi-tone golden sandstone base with natural color gradation
  const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
  baseGrad.addColorStop(0, '#f59e0b');
  baseGrad.addColorStop(0.25, '#d97706');
  baseGrad.addColorStop(0.55, '#b45309');
  baseGrad.addColorStop(0.85, '#92400e');
  baseGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Weathered Stone Grain Noise (Fast lightweight flecks)
  for (let i = 0; i < 400; i++) {
    const nx = Math.random() * 512;
    const ny = Math.random() * 512;
    const size = Math.random() * 2.5 + 1;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(254, 240, 138, 0.16)' : 'rgba(69, 26, 3, 0.2)';
    ctx.fillRect(nx, ny, size, size);
  }

  // Weathered Flagstone Grid Mortar with 3D Chiseled Bevels
  ctx.strokeStyle = '#3b1704';
  ctx.lineWidth = 5;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    // Top edge highlight for 3D bevel depth
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + 2);
    ctx.lineTo(512, y + 2);
    ctx.stroke();

    ctx.strokeStyle = '#3b1704';
    ctx.lineWidth = 5;

    for (let x = (y % 128 === 0 ? 0 : 32); x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();

      // Stone vertical bevel highlight
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 2, y + 64);
      ctx.stroke();

      ctx.strokeStyle = '#3b1704';
      ctx.lineWidth = 5;
    }
  }

  // Ancient Concentric Stone Spirals with Sacred Golden Inlay
  const drawCarvedSpiral = (cx, cy, maxR) => {
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.15) {
      const r = (a / (Math.PI * 6)) * maxR;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Golden Rune Inner Chisel Highlight
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner glowing core
    ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCarvedSpiral(256, 128, 55);
  drawCarvedSpiral(256, 384, 55);
  drawCarvedSpiral(100, 256, 42);
  drawCarvedSpiral(412, 256, 42);

  // Wild Creeping Moss on Outer Edges
  for (let i = 0; i < 512; i += 12) {
    const mossW1 = Math.random() * 35 + 12;
    const mossW2 = Math.random() * 35 + 12;
    ctx.fillStyle = i % 24 === 0 ? '#166534' : (i % 36 === 0 ? '#22c55e' : '#15803d');
    ctx.fillRect(0, i, mossW1, 12);
    ctx.fillRect(512 - mossW2, i, mossW2, 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
};

// Ancient Tropical Misty Jungle Canopy & Aztec Pyramid Backdrop Texture (Image 1 Exact Match)
const createSkyTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep mysterious jungle swamp mist gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#064e3b');    // Deep rainforest emerald canopy
  grad.addColorStop(0.35, '#0d5a49'); // Tropical mist
  grad.addColorStop(0.65, '#115e59'); // Ancient swamp lagoon horizon
  grad.addColorStop(0.85, '#134e4a'); // Water mist line
  grad.addColorStop(1, '#042f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft jungle atmospheric light shafts / god rays
  ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
  for (let r = 0; r < 5; r++) {
    ctx.beginPath();
    ctx.moveTo(80 + r * 90, 0);
    ctx.lineTo(130 + r * 90, 0);
    ctx.lineTo(210 + r * 90, 512);
    ctx.lineTo(120 + r * 90, 512);
    ctx.closePath();
    ctx.fill();
  }

  // Distant Ancient Aztec Pyramid Silhouettes
  ctx.fillStyle = 'rgba(4, 47, 46, 0.45)';
  // Left Temple Pyramid
  ctx.beginPath();
  ctx.moveTo(40, 360);
  ctx.lineTo(85, 290);
  ctx.lineTo(105, 290);
  ctx.lineTo(150, 360);
  ctx.closePath();
  ctx.fill();
  // Temple top shrine
  ctx.fillRect(88, 276, 14, 14);

  // Center-Right Grand Mayan Pyramid
  ctx.beginPath();
  ctx.moveTo(330, 380);
  ctx.lineTo(390, 275);
  ctx.lineTo(418, 275);
  ctx.lineTo(478, 380);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(396, 258, 16, 17);

  // Sprawling ancient giant jungle kapok trees
  ctx.fillStyle = 'rgba(6, 78, 59, 0.65)';
  for (let t = 0; t < 12; t++) {
    const tx = t * 45 + 10;
    const ty = 340 + Math.sin(t * 1.5) * 20;
    const rad = 25 + (t % 3) * 10;
    ctx.beginPath();
    ctx.arc(tx, ty, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
};

// =========================================================================
// AUTHENTIC TEMPLE RUN GOLDEN DIAMOND COIN GENERATOR (IMAGE 1 EXACT MATCH)
// Diamond outer bevel, raised inner gold rim, etched Aztec center
// =========================================================================
const createDiamondCoinMesh = () => {
  const coinGroup = new THREE.Group();

  // Outer Diamond Body (Rotated 45 degrees around Z)
  const outerGeo = new THREE.BoxGeometry(0.48, 0.48, 0.08);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Radiant Temple Run golden yellow
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
    metalness: 0.9,
    roughness: 0.18
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.rotation.z = Math.PI / 4;
  coinGroup.add(outerMesh);

  // Raised Inner Aztec Stepped Gold Rim
  const rimGeo = new THREE.BoxGeometry(0.32, 0.32, 0.095);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a, // Brilliant highlight gold
    metalness: 0.95,
    roughness: 0.12
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.z = Math.PI / 4;
  coinGroup.add(rimMesh);

  // Inner Dark Aztec Center Square
  const holeGeo = new THREE.BoxGeometry(0.14, 0.14, 0.11);
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // Deep dark gold etched recess
    metalness: 0.5,
    roughness: 0.7
  });
  const holeMesh = new THREE.Mesh(holeGeo, holeMat);
  holeMesh.rotation.z = Math.PI / 4;
  coinGroup.add(holeMesh);

  return coinGroup;
};

// =========================================================================
// =========================================================================
// AUTHENTIC TEMPLE RUN RUNNER (GUY DANGEROUS - EXACT MATCH TO IMAGE 1)
// Safari explorer shirt, muscular arms, fingerless gloves, cargo pants, tall boots, spiked hair
// =========================================================================
const buildGuyDangerous = () => {
  const root = new THREE.Group();

  // High-fidelity explorer materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xdf9b7e, // Natural sun-tanned explorer skin tone
    roughness: 0.6,
    metalness: 0.05
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c, // Reddish-ginger spiked explorer hair
    roughness: 0.85
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f5, // Off-white / light cream safari explorer shirt
    roughness: 0.8
  });

  const shirtFoldMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7, // Collar & pocket tab shading
    roughness: 0.85
  });

  const beltMat = new THREE.MeshStandardMaterial({
    color: 0x451a03, // Dark brown rugged explorer leather belt
    roughness: 0.55
  });

  const buckleMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Golden brass buckle
    roughness: 0.3,
    metalness: 0.8
  });

  const pouchMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // Brown leather utility pouch / canteen
    roughness: 0.7
  });

  const trousersMat = new THREE.MeshStandardMaterial({
    color: 0x2e4318, // Dark olive / forest green explorer cargo pants
    roughness: 0.8
  });

  const kneePatchMat = new THREE.MeshStandardMaterial({
    color: 0x223312, // Reinforced knee patches
    roughness: 0.85
  });

  const bootLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x5c2b0c, // Tall rich brown adventurer leather boots
    roughness: 0.6
  });

  const bootCuffMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // Folded boot top collar / cuffs
    roughness: 0.65
  });

  const bootSoleMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917, // Sturdy dark lugged rubber soles
    roughness: 0.9
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x602e12, // Fingerless brown explorer leather gloves
    roughness: 0.65
  });

  // 1. Torso: Athletic explorer chest with safari shirt & utility belt
  const torso = new THREE.Group();
  torso.position.y = 1.35;

  // Chest & ribcage (safari shirt with broad athletic shoulders)
  const chestGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.55, 20);
  chestGeo.computeVertexNormals();
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.y = 0.22;
  torso.add(chest);

  // Folded safari shirt collar
  const collarGeo = new THREE.CylinderGeometry(0.19, 0.23, 0.1, 16);
  const collar = new THREE.Mesh(collarGeo, shirtFoldMat);
  collar.position.set(0, 0.48, 0.02);
  torso.add(collar);

  // Twin Safari Chest Pockets with button flaps
  const pocketGeo = new THREE.PlaneGeometry(0.12, 0.14);
  const pocketL = new THREE.Mesh(pocketGeo, shirtFoldMat);
  pocketL.position.set(-0.14, 0.26, 0.33);
  const pocketR = new THREE.Mesh(pocketGeo, shirtFoldMat);
  pocketR.position.set(0.14, 0.26, 0.33);
  torso.add(pocketL);
  torso.add(pocketR);

  // Explorer button placket down shirt front
  const placketGeo = new THREE.PlaneGeometry(0.05, 0.48);
  const placket = new THREE.Mesh(placketGeo, shirtFoldMat);
  placket.position.set(0, 0.22, 0.335);
  torso.add(placket);

  // Tapered waist & lower shirt tucked into pants
  const waistGeo = new THREE.CylinderGeometry(0.32, 0.29, 0.4, 20);
  waistGeo.computeVertexNormals();
  const waist = new THREE.Mesh(waistGeo, shirtMat);
  waist.position.y = -0.2;
  torso.add(waist);

  // Explorer Leather Belt with Golden Brass Buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 20), beltMat);
  belt.position.y = -0.38;
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.05), buckleMat);
  buckle.position.set(0, -0.38, 0.32);
  torso.add(buckle);

  // Explorer side utility pouch on right hip
  const pouchGeo = new THREE.BoxGeometry(0.12, 0.18, 0.14);
  const pouch = new THREE.Mesh(pouchGeo, pouchMat);
  pouch.position.set(0.32, -0.4, 0.05);
  pouch.rotation.z = -0.15;
  torso.add(pouch);

  root.add(torso);

  // 2. Realistic Athletic Head, Neck & Spiked Explorer Hair
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.08;

  // Athletic muscular neck
  const neckGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.24, 16);
  neckGeo.computeVertexNormals();
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = -0.16;
  headGroup.add(neck);

  // Head skull with facial contour
  const skullGeo = new THREE.SphereGeometry(0.25, 20, 20);
  skullGeo.scale(1.0, 1.15, 1.05);
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, skinMat);
  headGroup.add(skull);

  // Athletic Jaw / Chin definition
  const chinGeo = new THREE.ConeGeometry(0.14, 0.18, 16);
  chinGeo.rotateX(Math.PI);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.position.set(0, -0.16, 0.12);
  headGroup.add(chin);

  // Nose bridge
  const noseGeo = new THREE.ConeGeometry(0.045, 0.12, 8);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.02, 0.28);
  headGroup.add(nose);

  // Ears on left and right
  const earGeo = new THREE.SphereGeometry(0.06, 10, 10);
  earGeo.scale(0.4, 1.2, 0.8);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.26, 0.02, 0);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.26, 0.02, 0);
  headGroup.add(earL);
  headGroup.add(earR);

  // Runner Eyes (dark irises)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });
  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.09, 0.07, 0.245);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.09, 0.07, 0.245);
  headGroup.add(leftEye);
  headGroup.add(rightEye);

  // Iconic Reddish-Ginger Spiked Explorer Hair (swept-up adventurer peaks matching Image 1!)
  const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16), hairMat);
  hairBase.scale.set(1.02, 0.95, 1.15);
  hairBase.position.set(0, 0.15, -0.05);
  headGroup.add(hairBase);

  // 5 Spiked hair tufts swept backwards and up
  const spikeGeo = new THREE.ConeGeometry(0.08, 0.24, 8);
  const spikesPos = [
    { x: 0, y: 0.35, z: 0.08, rx: -0.4, rz: 0 },
    { x: -0.1, y: 0.34, z: -0.02, rx: -0.5, rz: 0.25 },
    { x: 0.1, y: 0.34, z: -0.02, rx: -0.5, rz: -0.25 },
    { x: -0.06, y: 0.32, z: -0.14, rx: -0.8, rz: 0.15 },
    { x: 0.06, y: 0.32, z: -0.14, rx: -0.8, rz: -0.15 }
  ];
  spikesPos.forEach(sp => {
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(sp.x, sp.y, sp.z);
    spike.rotation.set(sp.rx, 0, sp.rz);
    headGroup.add(spike);
  });

  root.add(headGroup);

  // 3. Articulated Legs: Olive Cargo Pants & Tall Brown Leather Explorer Boots
  const createLeg = (isLeft) => {
    const hip = new THREE.Group();
    hip.position.set(isLeft ? -0.22 : 0.22, 0.85, 0);

    // Thigh with olive green cargo trousers
    const thighGeo = new THREE.CylinderGeometry(0.16, 0.125, 0.52, 16);
    thighGeo.computeVertexNormals();
    const thigh = new THREE.Mesh(thighGeo, trousersMat);
    thigh.position.y = -0.26;
    hip.add(thigh);

    // Side cargo flap pocket
    const cargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.14), kneePatchMat);
    cargoPocket.position.set(isLeft ? -0.16 : 0.16, -0.24, 0);
    thigh.add(cargoPocket);

    // Knee Pivot
    const knee = new THREE.Group();
    knee.position.y = -0.52;
    hip.add(knee);

    // Sculpted knee with protective explorer patch
    const kneecap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), kneePatchMat);
    kneecap.position.set(0, 0, 0.08);
    knee.add(kneecap);

    // Shin/Calf encased in high leather explorer boot
    const calfGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.48, 16);
    calfGeo.computeVertexNormals();
    const calf = new THREE.Mesh(calfGeo, bootLeatherMat);
    calf.position.y = -0.24;
    knee.add(calf);

    // Folded Leather Boot Cuff / Collar at top of boot
    const cuffGeo = new THREE.CylinderGeometry(0.145, 0.135, 0.1, 16);
    const cuff = new THREE.Mesh(cuffGeo, bootCuffMat);
    cuff.position.y = -0.06;
    knee.add(cuff);

    // Rugged Explorer Boot Foot & Sole
    const foot = new THREE.Group();
    foot.position.set(0, -0.52, 0.08);

    // Rugged lugged rubber outsole
    const soleGeo = new THREE.BoxGeometry(0.21, 0.08, 0.42);
    const sole = new THREE.Mesh(soleGeo, bootSoleMat);
    sole.position.y = -0.04;
    foot.add(sole);

    // Leather boot upper
    const upperGeo = new THREE.BoxGeometry(0.2, 0.13, 0.38);
    const upper = new THREE.Mesh(upperGeo, bootLeatherMat);
    upper.position.set(0, 0.06, 0.01);
    foot.add(upper);

    // Boot toe cap with reinforced leather
    const toeGeo = new THREE.SphereGeometry(0.1, 10, 10);
    toeGeo.scale(1, 0.7, 1.2);
    const toe = new THREE.Mesh(toeGeo, bootCuffMat);
    toe.position.set(0, 0.04, 0.16);
    foot.add(toe);

    knee.add(foot);

    root.add(hip);
    return { hip, knee };
  };

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 4. Articulated Muscular Arms (Folded shirt sleeve, muscular arm, fingerless leather glove)
  const createArm = (isLeft) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(isLeft ? -0.46 : 0.46, 1.7, 0);

    // Folded short shirt sleeve at shoulder
    const sleeveGeo = new THREE.CylinderGeometry(0.17, 0.16, 0.22, 16);
    const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    sleeve.position.y = -0.08;
    shoulder.add(sleeve);

    // Muscular sun-tanned bicep & tricep
    const bicepGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.38, 16);
    bicepGeo.computeVertexNormals();
    const bicep = new THREE.Mesh(bicepGeo, skinMat);
    bicep.position.y = -0.26;
    shoulder.add(bicep);

    // Elbow Pivot
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    shoulder.add(elbow);

    // Muscular Forearm
    const forearmGeo = new THREE.CylinderGeometry(0.105, 0.085, 0.38, 16);
    forearmGeo.computeVertexNormals();
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.19;
    elbow.add(forearm);

    // Leather wrist wrap
    const wristWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.08, 16), gloveMat);
    wristWrap.position.y = -0.32;
    elbow.add(wristWrap);

    // Fingerless Adventurer Glove & Running Fist
    const fistGeo = new THREE.SphereGeometry(0.085, 12, 12);
    fistGeo.scale(1, 1.2, 0.85);
    const fist = new THREE.Mesh(fistGeo, gloveMat);
    fist.position.y = -0.42;
    elbow.add(fist);

    // Bare knuckles exposed
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
    knuckle.position.set(0, -0.47, 0.04);
    elbow.add(knuckle);

    root.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = createArm(true);
  const rightArm = createArm(false);

  // 5. Dynamic Ground Contact Shadow (Soft oval planar shadow)
  const shadowGeo = new THREE.PlaneGeometry(1.6, 2.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    opacity: 0.65,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.04;
  root.add(shadow);

  return {
    group: root,
    torso,
    head: headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    shadow
  };
};

// =========================================================================
// MONSTER PURSUER: DEMON APE WITH WHITE SKULL BONE MASK (IMAGE 2 EXACT MATCH)
// =========================================================================
const buildDemonApe = () => {
  const root = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 }); // Pitch charcoal fur
  const crestMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.8 }); // Silver spine crest
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 }); // White skull bone mask!
  const socketMat = new THREE.MeshBasicMaterial({ color: 0x09090b }); // Dark eye sockets
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Glowing emerald eyes inside mask!
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 }); // Sharp fangs

  // 1. Massive Hunched Gorilla Back & Torso
  const backGeo = new THREE.SphereGeometry(1.2, 20, 20);
  backGeo.scale(1.2, 1.1, 0.95);
  backGeo.computeVertexNormals();
  const back = new THREE.Mesh(backGeo, furMat);
  back.position.set(0, 1.6, -0.2);
  root.add(back);

  // Silver fur spine crest
  const crestGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.2, 14);
  crestGeo.scale(0.8, 1, 1.3);
  const crest = new THREE.Mesh(crestGeo, crestMat);
  crest.rotation.x = Math.PI / 4;
  crest.position.set(0, 2.75, 0.45);
  root.add(crest);

  // 2. Heavy Ape Head with Skull Bone Mask
  const headGeo = new THREE.SphereGeometry(0.7, 18, 18);
  headGeo.scale(1, 0.9, 1.15);
  const head = new THREE.Mesh(headGeo, furMat);
  head.position.set(0, 2.45, 0.55);
  root.add(head);

  // 3. ICONIC WHITE SKULL BONE MASK (Exact match to Image 2!)
  const skullMaskGroup = new THREE.Group();
  skullMaskGroup.position.set(0, 2.45, 1.05);

  // Bone forehead & cranium
  const bonePlateGeo = new THREE.SphereGeometry(0.55, 16, 16);
  bonePlateGeo.scale(0.95, 1.1, 0.5);
  const bonePlate = new THREE.Mesh(bonePlateGeo, boneMat);
  skullMaskGroup.add(bonePlate);

  // Bone Snout & Upper Jaw
  const snoutGeo = new THREE.BoxGeometry(0.42, 0.35, 0.4);
  const snout = new THREE.Mesh(snoutGeo, boneMat);
  snout.position.set(0, -0.22, 0.16);
  skullMaskGroup.add(snout);

  // Deep hollow eye sockets with glowing emerald eyes
  const socketL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.1, 12), socketMat);
  socketL.rotation.x = Math.PI / 2;
  socketL.position.set(-0.2, 0.08, 0.22);
  const socketR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.1, 12), socketMat);
  socketR.rotation.x = Math.PI / 2;
  socketR.position.set(0.2, 0.08, 0.22);
  skullMaskGroup.add(socketL);
  skullMaskGroup.add(socketR);

  // Glowing Emerald Green Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
  eyeL.position.set(-0.2, 0.08, 0.26);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
  eyeR.position.set(0.2, 0.08, 0.26);
  skullMaskGroup.add(eyeL);
  skullMaskGroup.add(eyeR);

  // Sharp beast skull fangs
  const fangGeo = new THREE.ConeGeometry(0.05, 0.22, 8);
  const fangL = new THREE.Mesh(fangGeo, toothMat);
  fangL.position.set(-0.16, -0.4, 0.28);
  fangL.rotation.x = Math.PI;
  const fangR = new THREE.Mesh(fangGeo, toothMat);
  fangR.position.set(0.16, -0.4, 0.28);
  fangR.rotation.x = Math.PI;
  skullMaskGroup.add(fangL);
  skullMaskGroup.add(fangR);

  root.add(skullMaskGroup);

  // 4. Huge Muscular Pounding Gorilla Arms
  const createApeArm = (isLeft) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(isLeft ? -1.25 : 1.25, 1.8, 0.2);

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 14), furMat);
    shoulder.add(deltoid);

    const bicepGeo = new THREE.CylinderGeometry(0.36, 0.28, 0.9, 14);
    bicepGeo.computeVertexNormals();
    const bicep = new THREE.Mesh(bicepGeo, furMat);
    bicep.position.y = -0.45;
    shoulder.add(bicep);

    const forearmGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.95, 14);
    forearmGeo.computeVertexNormals();
    const forearm = new THREE.Mesh(forearmGeo, furMat);
    forearm.position.set(0, -0.9, 0.2);
    forearm.rotation.x = 0.3;
    shoulder.add(forearm);

    root.add(shoulder);
    return shoulder;
  };

  const leftArm = createApeArm(true);
  const rightArm = createApeArm(false);

  return {
    group: root,
    leftArm,
    rightArm
  };
};

// =========================================================================
// 90-DEGREE TEMPLE CORNER TURN INTERSECTION (AUTHENTIC AZTEC ARROW & WALL)
// =========================================================================
const buildCornerTurnChunk = (direction = 'right') => {
  const group = new THREE.Group();

  // 1. Ancient Stone Temple Wall Blocking Forward Runway
  const wallGeo = new THREE.BoxGeometry(7.4, 5.8, 1.2);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x44403c,
    roughness: 0.9,
    metalness: 0.1
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 2.3, 0.6);
  wall.castShadow = true;
  group.add(wall);

  // 2. Giant Glowing Emerald Aztec Turn Chevron Arrow
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 1.5,
    roughness: 0.15
  });

  const arrowGroup = new THREE.Group();
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.44, 0.3), arrowMat);
  b1.rotation.z = direction === 'right' ? Math.PI / 4 : -Math.PI / 4;
  b1.position.y = 0.5;

  const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.44, 0.3), arrowMat);
  b2.rotation.z = direction === 'right' ? -Math.PI / 4 : Math.PI / 4;
  b2.position.y = -0.5;

  arrowGroup.add(b1);
  arrowGroup.add(b2);
  arrowGroup.position.set(0, 2.5, -0.05);
  group.add(arrowGroup);

  // 3. Side Runway Branch Extending 90 degrees
  const branchGeo = new THREE.BoxGeometry(14, 1.2, 6.6);
  const branchMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
  const branch = new THREE.Mesh(branchGeo, branchMat);
  const branchOffsetX = direction === 'right' ? 7.0 : -7.0;
  branch.position.set(branchOffsetX, -0.6, 0);
  group.add(branch);

  return group;
};

// =========================================================================
// BROKEN BRIDGE ABYSS GAP (CRUMBLED ROADWAY OVER MISTY MOUNTAINS)
// =========================================================================
const buildBrokenGapMesh = () => {
  const group = new THREE.Group();

  // Dark bottomless chasm void
  const voidGeo = new THREE.BoxGeometry(6.6, 0.5, 4.8);
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const abyssVoid = new THREE.Mesh(voidGeo, voidMat);
  abyssVoid.position.y = -0.55;
  group.add(abyssVoid);

  // Jagged stone edge teeth
  const edgeGeo = new THREE.ConeGeometry(0.35, 1.1, 5);
  edgeGeo.rotateX(Math.PI / 2);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 });
  for (let x = -2.6; x <= 2.6; x += 1.3) {
    const t1 = new THREE.Mesh(edgeGeo, stoneMat);
    t1.position.set(x + (Math.random() - 0.5) * 0.2, -0.35, -2.2);
    group.add(t1);

    const t2 = new THREE.Mesh(edgeGeo, stoneMat);
    t2.position.set(x + (Math.random() - 0.5) * 0.2, -0.35, 2.2);
    group.add(t2);
  }

  // Dangling broken frayed rope bridge remnants
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const ropeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
  const rL = new THREE.Mesh(ropeGeo, ropeMat);
  rL.position.set(-3.1, -0.7, 0);
  rL.rotation.z = 0.3;
  group.add(rL);

  const rR = new THREE.Mesh(ropeGeo, ropeMat);
  rR.position.set(3.1, -0.7, 0);
  rR.rotation.z = -0.3;
  group.add(rR);

  return group;
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
  const [dangerOpacity, setDangerOpacity] = useState(0); // 0 to 1 for red danger vignette pulse
  const [turnWarning, setTurnWarning] = useState(null); // 'left' | 'right' | null
  const [popups, setPopups] = useState([]); // Floating score & combo popups

  // Helper for floating score popups
  const addPopup = useCallback((text, color = '#fbbf24') => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev.slice(-3), { id, text, color }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 900);
  }, []);

  // 100% Natural Touch Swipe Gestures (ZERO BUTTONS)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef(false);

  // Core mutable game loop references
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    playerObj: null,
    monkeyObj: null,

    // 3D Procedural Chunks & Elements
    trackChunks: [],
    obstacles: [],
    coinsList: [],
    cloudsList: [],
    speedLines: [],
    sparkParticles: [],

    // Corner Turns & Dynamic Events
    upcomingCorner: null, // { mesh, direction: 'left' | 'right', handled: false }
    lastCornerDist: 0,
    trauma: 0, // Camera trauma screen shake
    heartbeatTimer: 0,
    turnAnimProgress: 0,
    lastTurnDir: null,

    // Game Variables
    speed: 42,
    distance: 0,
    coins: 0,
    score: 0,
    powerMeter: 0,

    playerLane: 1, // 0 = Left (-1.85), 1 = Center (0), 2 = Right (1.85)
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

  // Spark burst helper
  const triggerSparkBurst = (x, y, z) => {
    const sparks = gameRef.current.sparkParticles;
    if (!sparks) return;
    let spawned = 0;
    for (let i = 0; i < sparks.length && spawned < 12; i++) {
      const sp = sparks[i];
      if (!sp.visible) {
        sp.visible = true;
        sp.position.set(x, y, z);
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;
        const s = 4.5 + Math.random() * 5;
        sp.userData = {
          vx: Math.cos(theta) * Math.cos(phi) * s,
          vy: Math.sin(phi) * s + 2.5,
          vz: Math.sin(theta) * Math.cos(phi) * s,
          life: 0.38
        };
        spawned++;
      }
    }
  };

  // =========================================================================
  // FINGER SWIPE CONTROLS & ACTIONS (ZERO BUTTONS ON SCREEN)
  // Handles both natural Lane Changes AND Authentic 90-Degree Corner Turns!
  // =========================================================================
  const moveLeft = useCallback(() => {
    const g = gameRef.current;
    // Check if player is approaching a Left Corner Turn
    if (g.upcomingCorner && !g.upcomingCorner.handled && g.upcomingCorner.direction === 'left') {
      const zDist = g.upcomingCorner.mesh.position.z;
      if (zDist > -8.5 && zDist < 5.0) {
        // Successful 90° Turn!
        g.upcomingCorner.handled = true;
        g.turnAnimProgress = 1.0;
        g.lastTurnDir = 'left';
        g.playerLane = 1;
        g.targetX = 0;
        g.currentX = 0;
        g.score += 50;
        setScore(g.score);
        setTurnWarning(null);
        addPopup('PERFECT TURN! +50', '#10b981');
        if (audioRef.current) audioRef.current.playTurnWhoosh();
        return;
      }
    }

    if (g.playerLane > 0) {
      g.playerLane -= 1;
      g.targetX = (g.playerLane - 1) * 1.85;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, [addPopup]);

  const moveRight = useCallback(() => {
    const g = gameRef.current;
    // Check if player is approaching a Right Corner Turn
    if (g.upcomingCorner && !g.upcomingCorner.handled && g.upcomingCorner.direction === 'right') {
      const zDist = g.upcomingCorner.mesh.position.z;
      if (zDist > -8.5 && zDist < 5.0) {
        // Successful 90° Turn!
        g.upcomingCorner.handled = true;
        g.turnAnimProgress = 1.0;
        g.lastTurnDir = 'right';
        g.playerLane = 1;
        g.targetX = 0;
        g.currentX = 0;
        g.score += 50;
        setScore(g.score);
        setTurnWarning(null);
        addPopup('PERFECT TURN! +50', '#10b981');
        if (audioRef.current) audioRef.current.playTurnWhoosh();
        return;
      }
    }

    if (g.playerLane < 2) {
      g.playerLane += 1;
      g.targetX = (g.playerLane - 1) * 1.85;
      if (audioRef.current) audioRef.current.playSlideSwoosh();
    }
  }, [addPopup]);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.isJumping && !g.isSliding) {
      g.isJumping = true;
      g.jumpVelocity = 16.0;
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
    if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        if (dy > 0) slide();
        else jump();
      }
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
    scene.fog = new THREE.FogExp2(0x064e3b, 0.0075);

    // 2. Perspective Camera (Over-the-shoulder third-person camera matching screenshots)
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 400);
    camera.position.set(0, 4.3, 7.6);
    camera.lookAt(0, 2.1, -14);

    // 3. WebGL Renderer (Optimized for silky 60 FPS)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Dramatic Tropical Jungle Sunlight (God Rays & Sunken River Reflection)
    const ambientLight = new THREE.AmbientLight(0xd1fae5, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfef08a, 1.3);
    sunLight.position.set(22, 42, 18);
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
      emissiveIntensity: 0.7,
      roughness: 0.1,
      metalness: 0.9
    });

    // 6. BUILD ORGANIC RUNNER (GUY DANGEROUS)
    const playerObj = buildGuyDangerous();
    scene.add(playerObj.group);

    // 7. BUILD ORGANIC DEMON APE (MONSTER PURSUER)
    const monkeyObj = buildDemonApe();
    monkeyObj.group.position.set(0, 0, 4.5);
    scene.add(monkeyObj.group);

    // 8. TROPICAL SWAMP LAGOON WATER & MIST (Beneath Ancient Stone Bridge - 1:1 Image 1)
    const swampWaterGeo = new THREE.PlaneGeometry(160, 480, 1, 1);
    swampWaterGeo.rotateX(-Math.PI / 2);
    const swampWaterMat = new THREE.MeshStandardMaterial({
      color: 0x042f2e,
      roughness: 0.18,
      metalness: 0.82,
      transparent: true,
      opacity: 0.94
    });
    const swampWater = new THREE.Mesh(swampWaterGeo, swampWaterMat);
    swampWater.position.set(0, -4.8, -120);
    scene.add(swampWater);
    gameRef.current.swampWater = swampWater;

    // Atmospheric Canopy Mist Spheres
    const cloudsList = [];
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      transparent: true,
      opacity: 0.35,
      roughness: 1.0
    });

    for (let c = 0; c < 18; c++) {
      const mistGeo = new THREE.SphereGeometry(Math.random() * 8 + 8, 8, 8);
      const mist = new THREE.Mesh(mistGeo, mistMat);
      mist.position.set(
        (Math.random() - 0.5) * 80,
        -4.2 - Math.random() * 3,
        -Math.random() * 220
      );
      scene.add(mist);
      cloudsList.push(mist);
    }

    // 9. PROCEDURAL 3D ENDLESS TRACK GENERATOR (Smooth rounded curbs, carved spiral slabs)
    const CHUNK_LENGTH = 24;
    const CHUNK_COUNT = 14;
    const trackChunks = [];

    // Realistic Torch Materials
    const torchBrazierMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6, metalness: 0.8 });
    const torchFlameOuterMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.88 });
    const torchFlameInnerMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    // Realistic Jungle Palm & Vine Materials
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });

    const createTrackChunk = (zPos) => {
      const chunk = new THREE.Group();
      chunk.position.z = zPos;
      const chunkIndex = Math.abs(Math.round(zPos / CHUNK_LENGTH));

      // Stone Bridge Runway (Width 6.6 units)
      const floorGeo = new THREE.BoxGeometry(6.6, 1.2, CHUNK_LENGTH);
      const floor = new THREE.Mesh(floorGeo, stonePathwayMat);
      floor.position.y = -0.6;
      floor.receiveShadow = true;
      chunk.add(floor);

      // Massive Stone Foundation Pier extending down into murky swamp water (1:1 with Image 1)
      const pierGeo = new THREE.BoxGeometry(5.8, 8.5, CHUNK_LENGTH * 0.95);
      const pier = new THREE.Mesh(pierGeo, carvedWallMat);
      pier.position.y = -5.4;
      chunk.add(pier);

      // Submerged Mangrove Tree Roots branching into swamp lagoon
      const rootMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.9 });
      for (let r = 0; r < 3; r++) {
        const rootL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.8, 8), rootMat);
        rootL.position.set(-3.2 - Math.random() * 0.8, -3.2, (r - 1) * 7);
        rootL.rotation.z = 0.45;
        chunk.add(rootL);

        const rootR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.8, 8), rootMat);
        rootR.position.set(3.2 + Math.random() * 0.8, -3.2, (r - 1) * 7);
        rootR.rotation.z = -0.45;
        chunk.add(rootR);
      }

      // Rounded Weathered Stone Balustrades / Curbs
      const railGeo = new THREE.CylinderGeometry(0.4, 0.45, CHUNK_LENGTH, 16);
      railGeo.rotateX(Math.PI / 2);
      const leftRail = new THREE.Mesh(railGeo, carvedWallMat);
      leftRail.position.set(-3.5, 0.4, 0);
      const rightRail = new THREE.Mesh(railGeo, carvedWallMat);
      rightRail.position.set(3.5, 0.4, 0);
      chunk.add(leftRail);
      chunk.add(rightRail);

      // Ancient Stone Pillars with Emerald Gems & 3D Real Flickering Fire Torches
      const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, 4.2, 16);
      pillarGeo.computeVertexNormals();
      const pL = new THREE.Mesh(pillarGeo, carvedWallMat);
      pL.position.set(-3.4, 1.8, 0);
      const pR = new THREE.Mesh(pillarGeo, carvedWallMat);
      pR.position.set(3.4, 1.8, 0);
      chunk.add(pL);
      chunk.add(pR);

      // Mayan Carved Totem Heads on Top of Pillars (1:1 with Temple Run)
      const totemHeadGeo = new THREE.BoxGeometry(0.65, 0.75, 0.65);
      const totemL = new THREE.Mesh(totemHeadGeo, carvedWallMat);
      totemL.position.set(-3.4, 4.25, 0);
      const eyeGeo = new THREE.BoxGeometry(0.7, 0.16, 0.7);
      const eyeL = new THREE.Mesh(eyeGeo, emeraldGemMat);
      totemL.add(eyeL);
      chunk.add(totemL);

      const totemR = new THREE.Mesh(totemHeadGeo, carvedWallMat);
      totemR.position.set(3.4, 4.25, 0);
      const eyeR = new THREE.Mesh(eyeGeo, emeraldGemMat);
      totemR.add(eyeR);
      chunk.add(totemR);

      // 3D Ancient Stone Fire Torches on Left & Right
      const addTorchToPillar = (xPos) => {
        const torchGroup = new THREE.Group();
        torchGroup.position.set(xPos > 0 ? xPos - 0.35 : xPos + 0.35, 2.3, 0);

        // Bronze Brazier Bowl
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.12, 0.22, 12), torchBrazierMat);
        torchGroup.add(bowl);

        // Outer Flame Cone
        const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 10), torchFlameOuterMat);
        flameOuter.position.y = 0.32;
        torchGroup.add(flameOuter);

        // Inner Bright Core
        const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 8), torchFlameInnerMat);
        flameInner.position.y = 0.24;
        torchGroup.add(flameInner);

        chunk.add(torchGroup);
      };

      addTorchToPillar(-3.4);
      addTorchToPillar(3.4);

      // Hanging Jungle Vines / Lianas draped from bridge balustrades
      const vineL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 3.5, 8), vineMat);
      vineL.position.set(-3.6, -1.6, 2.5);
      vineL.rotation.z = 0.15;
      chunk.add(vineL);

      const vineR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 3.5, 8), vineMat);
      vineR.position.set(3.6, -1.6, -2.5);
      vineR.rotation.z = -0.15;
      chunk.add(vineR);

      // Floating Mountain Rocks & Lush Tropical Palm Trees in Distance
      const rockGeo = new THREE.DodecahedronGeometry(5 + Math.random() * 4, 1);
      const rock = new THREE.Mesh(rockGeo, carvedWallMat);
      const rockSide = Math.random() < 0.5 ? -18 : 18;
      rock.position.set(rockSide, -4, 0);
      chunk.add(rock);

      // 3D Tropical Palm Tree (Realistic curved trunk & radiating palm fronds)
      const palmGroup = new THREE.Group();
      palmGroup.position.set(rockSide * 0.72, -1, 0);

      const palmTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 4.2, 12), palmTrunkMat);
      palmTrunk.position.y = 2.1;
      palmTrunk.rotation.z = rockSide > 0 ? -0.18 : 0.18;
      palmGroup.add(palmTrunk);

      // 7 Radiating Lush Palm Fronds
      for (let f = 0; f < 7; f++) {
        const frondAngle = (f / 7) * Math.PI * 2;
        const frondGeo = new THREE.ConeGeometry(0.7, 2.8, 6);
        frondGeo.scale(1, 0.2, 1);
        const frond = new THREE.Mesh(frondGeo, palmLeafMat);
        frond.position.set(
          Math.cos(frondAngle) * 0.9,
          4.1,
          Math.sin(frondAngle) * 0.9
        );
        frond.rotation.set(0.6 * Math.sin(frondAngle), frondAngle, 0.6 * Math.cos(frondAngle));
        palmGroup.add(frond);
      }
      chunk.add(palmGroup);

      // Ancient Carved Temple Stone Archway Portal (Spans overhead every 4th chunk)
      if (chunkIndex % 4 === 0) {
        const archPortal = new THREE.Group();
        archPortal.position.set(0, 0, 0);

        // Massive Ancient Carved Stone Header Beam
        const archBeam = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.2, 1.4), carvedWallMat);
        archBeam.position.y = 5.2;
        archBeam.castShadow = true;
        archPortal.add(archBeam);

        // Glowing Ancient Aztec/Indian Golden Emblem on Archway
        const archEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.15, 16), emeraldGemMat);
        archEmblem.rotation.x = Math.PI / 2;
        archEmblem.position.set(0, 5.2, 0.78);
        archPortal.add(archEmblem);

        chunk.add(archPortal);
      }

      scene.add(chunk);
      return chunk;
    };

    for (let i = 0; i < CHUNK_COUNT; i++) {
      trackChunks.push(createTrackChunk(-i * CHUNK_LENGTH));
    }

    // 10. SPEED LINES SYSTEM (High velocity speed rush streaks)
    const speedLines = [];
    const speedMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.65
    });
    const speedLineGeo = new THREE.CylinderGeometry(0.018, 0.018, 5.5, 4);
    speedLineGeo.rotateX(Math.PI / 2);

    for (let s = 0; s < 22; s++) {
      const lineMesh = new THREE.Mesh(speedLineGeo, speedMat);
      const angle = (s / 22) * Math.PI * 2;
      const radius = 3.6 + Math.random() * 2.8;
      lineMesh.position.set(
        Math.cos(angle) * radius,
        2.5 + Math.sin(angle) * (radius * 0.7),
        -Math.random() * 30
      );
      lineMesh.visible = false;
      scene.add(lineMesh);
      speedLines.push(lineMesh);
    }
    gameRef.current.speedLines = speedLines;

    // 11. GOLDEN COIN SPARKLE PARTICLES
    const sparkParticles = [];
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.95
    });
    const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
    for (let p = 0; p < 36; p++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.visible = false;
      spark.userData = { vx: 0, vy: 0, vz: 0, life: 0 };
      scene.add(spark);
      sparkParticles.push(spark);
    }
    gameRef.current.sparkParticles = sparkParticles;

    // Save references to gameRef
    gameRef.current.scene = scene;
    gameRef.current.camera = camera;
    gameRef.current.renderer = renderer;
    gameRef.current.playerObj = playerObj;
    gameRef.current.monkeyObj = monkeyObj;
    gameRef.current.trackChunks = trackChunks;
    gameRef.current.cloudsList = cloudsList;

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
    g.trauma = 0;
    g.heartbeatTimer = 0;
    g.turnAnimProgress = 0;
    g.lastTurnDir = null;
    g.lastCornerDist = 0;

    // Clear active obstacles & coins & upcoming corner
    if (g.upcomingCorner && g.upcomingCorner.mesh) {
      g.scene.remove(g.upcomingCorner.mesh);
      g.upcomingCorner = null;
    }
    g.obstacles.forEach(o => g.scene.remove(o.mesh));
    g.obstacles = [];
    g.coinsList.forEach(c => g.scene.remove(c.mesh));
    g.coinsList = [];

    setDistance(0);
    setCoins(0);
    setScore(0);
    setPowerMeter(0);
    setDangerOpacity(0);
    setTurnWarning(null);
    setPopups([]);
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
  // REAL-TIME PHYSICS, ANIMATION & COLLISION ENGINE (AAA WORLD-CLASS FEEL)
  // =========================================================================
  const updateGame = (dt) => {
    const g = gameRef.current;
    if (!g.playerObj) return;

    // 1. Distance & Speed Progression
    const currentSpeed = g.speed;
    g.distance += currentSpeed * dt;
    g.speed = Math.min(88, 42 + g.distance * 0.035);

    setDistance(Math.floor(g.distance));
    const computedScore = Math.floor(g.distance * 2 + g.coins * 15);
    g.score = computedScore;
    setScore(computedScore);

    // 2. Smooth Lateral Lane Movement & Natural Runner Banking
    g.currentX += (g.targetX - g.currentX) * (dt * 14);
    g.playerObj.group.position.x = g.currentX;
    // Dynamic runner tilt into turns
    const laneBank = (g.targetX - g.currentX) * -0.28;
    const cornerBank = g.turnAnimProgress > 0 ? (g.lastTurnDir === 'left' ? -0.45 : 0.45) * Math.sin(g.turnAnimProgress * Math.PI) : 0;
    g.playerObj.group.rotation.z = laneBank + cornerBank;

    // 3. Jump Physics (Authentic Parabolic Arc with Air Gravity)
    if (g.isJumping) {
      g.jumpY += g.jumpVelocity * dt;
      g.jumpVelocity -= 36 * dt; // Gravity
      if (g.jumpY <= 0) {
        g.jumpY = 0;
        g.jumpVelocity = 0;
        g.isJumping = false;
      }
    }
    g.playerObj.group.position.y = g.jumpY;

    // 4. Slide Physics & Rotation
    if (g.isSliding) {
      g.slideTimer -= dt;
      g.playerObj.group.rotation.x = 0.22; // Low forward duck/slide (never blocks camera!)
      g.playerObj.group.position.y = -0.62; // Drop low to smoothly glide under obstacles
      if (g.slideTimer <= 0) {
        g.isSliding = false;
        g.playerObj.group.rotation.x = 0;
        g.playerObj.group.position.y = 0;
      }
    } else {
      g.playerObj.group.rotation.x = 0;
    }

    // 5. Articulated Runner Kinematics (Natural human running gait & torso dynamics)
    g.runAnimTime += dt * (currentSpeed * 0.35);
    const { leftLeg, rightLeg, leftArm, rightArm, torso, head, shadow } = g.playerObj;

    if (!g.isJumping && !g.isSliding) {
      const legAngle = Math.sin(g.runAnimTime) * 0.85;
      // Hip rotation
      leftLeg.hip.rotation.x = legAngle;
      rightLeg.hip.rotation.x = -legAngle;
      // Knee natural bending: bend backwards when leg kicks back!
      leftLeg.knee.rotation.x = Math.max(0, -legAngle * 1.15);
      rightLeg.knee.rotation.x = Math.max(0, legAngle * 1.15);

      // Arm swing with bent elbows
      leftArm.shoulder.rotation.x = -legAngle * 0.85;
      rightArm.shoulder.rotation.x = legAngle * 0.85;
      leftArm.elbow.rotation.x = -0.45;
      rightArm.elbow.rotation.x = -0.45;

      // Realistic running bounce & torso twist
      if (torso) {
        torso.position.y = 1.35 + Math.abs(Math.sin(g.runAnimTime)) * 0.08;
        torso.rotation.y = Math.sin(g.runAnimTime) * 0.08;
      }
      if (head) {
        head.rotation.y = -Math.sin(g.runAnimTime) * 0.06;
      }
      if (shadow) {
        shadow.scale.set(1, 1, 1);
        shadow.material.opacity = 0.65;
      }
    } else if (g.isJumping) {
      // Tucked knees & raised arms
      leftLeg.hip.rotation.x = -0.8;
      rightLeg.hip.rotation.x = -0.8;
      leftLeg.knee.rotation.x = 1.2;
      rightLeg.knee.rotation.x = 1.2;
      leftArm.shoulder.rotation.x = -2.2;
      rightArm.shoulder.rotation.x = -2.2;

      // Dynamic ground shadow shrink and fade when leaping in air
      if (shadow) {
        const shadowScale = Math.max(0.4, 1 - g.jumpY * 0.16);
        shadow.scale.set(shadowScale, shadowScale, 1);
        shadow.material.opacity = Math.max(0.12, 0.65 - g.jumpY * 0.18);
      }
    } else if (g.isSliding) {
      // Streamlined slide crouch
      leftLeg.hip.rotation.x = -1.1;
      rightLeg.hip.rotation.x = 0.4;
      leftLeg.knee.rotation.x = 1.3;
      rightLeg.knee.rotation.x = 0.3;
      leftArm.shoulder.rotation.x = 0.3;
      rightArm.shoulder.rotation.x = -0.5;

      if (shadow) {
        shadow.scale.set(1.2, 0.9, 1);
        shadow.material.opacity = 0.75;
      }
    }

    // 6. Demon Ape Pursuit Dynamics & Visceral Threat
    if (g.stumbleTimer > 0) {
      g.stumbleTimer -= dt;
      g.monkeyDist = 28; // Roaring right behind runner!
    } else {
      g.monkeyDist += (90 - g.monkeyDist) * (dt * 0.75);
    }

    // Threat danger level (0 = far away, 1 = right behind runner)
    const danger = Math.max(0, Math.min(1, (52 - g.monkeyDist) / 42));
    setDangerOpacity(danger);

    // Deep pounding heartbeat pulse when Demon Monkey is close
    if (g.monkeyDist < 52) {
      g.heartbeatTimer = (g.heartbeatTimer || 0) - dt;
      const hbInterval = Math.max(0.35, (g.monkeyDist / 52) * 0.85);
      if (g.heartbeatTimer <= 0) {
        g.heartbeatTimer = hbInterval;
        if (audioRef.current) audioRef.current.playHeartbeat();
      }
    }

    if (g.monkeyObj) {
      const targetMonkeyZ = 2.4 + (g.monkeyDist * 0.05);
      g.monkeyObj.group.position.z += (targetMonkeyZ - g.monkeyObj.group.position.z) * (dt * 5);
      g.monkeyObj.group.position.x = g.currentX * 0.85;

      const apeCycle = Math.sin(g.runAnimTime * 1.4) * 0.95;
      g.monkeyObj.leftArm.rotation.x = apeCycle;
      g.monkeyObj.rightArm.rotation.x = -apeCycle;
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

    // 8. 90-Degree Corner Turn Dynamics
    if (g.upcomingCorner) {
      g.upcomingCorner.mesh.position.z += currentSpeed * dt;
      const cz = g.upcomingCorner.mesh.position.z;

      // Display warning banner when approaching intersection
      if (cz > -24 && cz < 5.0 && !g.upcomingCorner.handled) {
        setTurnWarning(g.upcomingCorner.direction);
      } else {
        setTurnWarning(null);
      }

      // Check if runner failed to turn in time (crashed into Mayan wall!)
      if (cz >= 5.0 && !g.upcomingCorner.handled) {
        g.trauma = 1.0;
        triggerGameOver();
        return;
      }

      // Cleanup past corner
      if (cz > 16) {
        g.scene.remove(g.upcomingCorner.mesh);
        g.upcomingCorner = null;
      }
    }

    // Decay corner turn animation progress
    if (g.turnAnimProgress > 0) {
      g.turnAnimProgress = Math.max(0, g.turnAnimProgress - dt * 2.8);
    }

    // 9. Move Clouds
    g.cloudsList.forEach(cloud => {
      cloud.position.z += currentSpeed * dt * 0.4;
      if (cloud.position.z > 20) {
        cloud.position.z = -180 - Math.random() * 40;
      }
    });

    // 10. Speed Lines / Warp Rush Animation
    if (g.speedLines && g.speedLines.length > 0) {
      const isHighSpeed = currentSpeed > 55;
      g.speedLines.forEach(line => {
        line.visible = isHighSpeed;
        if (isHighSpeed) {
          line.position.z += currentSpeed * dt * 1.8;
          if (line.position.z > 8) {
            line.position.z = -35 - Math.random() * 25;
          }
        }
      });
    }

    // 11. Golden Coin Sparkle Particles Update
    if (g.sparkParticles && g.sparkParticles.length > 0) {
      g.sparkParticles.forEach(sp => {
        if (sp.visible) {
          sp.position.x += sp.userData.vx * dt;
          sp.position.y += sp.userData.vy * dt;
          sp.position.z += sp.userData.vz * dt;
          sp.userData.vy -= 18 * dt; // gravity on sparks
          sp.userData.life -= dt;
          if (sp.userData.life <= 0) {
            sp.visible = false;
          }
        }
      });
    }

    // 12. Move & Collide Obstacles (Logs, Spikes, Fire Rings & Broken Gaps)
    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const obs = g.obstacles[i];
      obs.mesh.position.z += currentSpeed * dt;

      // Collision window
      if (obs.mesh.position.z > -1.2 && obs.mesh.position.z < 1.2 && !obs.hit) {
        const laneMatches = obs.lane === 'all' || Math.abs(obs.laneX - g.currentX) < 1.1;

        if (laneMatches) {
          let dodged = false;
          if (obs.type === 'log' || obs.type === 'spikes') {
            if (g.isJumping && g.jumpY > 1.1) dodged = true;
          } else if (obs.type === 'fire_ring') {
            if (g.isSliding) dodged = true;
          } else if (obs.type === 'broken_gap') {
            if (g.isJumping && g.jumpY > 0.85) dodged = true;
          }

          if (!dodged) {
            obs.hit = true;
            g.trauma = 0.85; // Violent camera shake

            // Broken abyss gap means instant plunge!
            if (obs.type === 'broken_gap' || g.monkeyDist < 35) {
              triggerGameOver();
              return;
            } else {
              g.stumbleTimer = 4.0;
              g.monkeyDist = 28;
              if (audioRef.current) {
                audioRef.current.playStumble();
                audioRef.current.playDemonRoar();
              }
              addPopup('STUMBLE!', '#ef4444');
            }
          }
        }
      }

      if (obs.mesh.position.z > 16) {
        g.scene.remove(obs.mesh);
        g.obstacles.splice(i, 1);
      }
    }

    // 13. Move & Collect 3D Coins (Ascending Pentatonic Scale & Spark Bursts)
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

        // Play Ascending Pentatonic Dopamine Bell
        let streak = 1;
        if (audioRef.current) {
          const res = audioRef.current.playCoinDing();
          if (res) streak = res.streak;
        }

        // Trigger Golden Sparkle Particle Burst
        triggerSparkBurst(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z);

        // Floating combo text
        if (streak >= 5) {
          addPopup(`STREAK x${streak}! +${streak * 5}`, '#f59e0b');
          g.score += streak * 5;
        } else {
          addPopup('+10', '#fbbf24');
        }

        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
        continue;
      }

      if (c.mesh.position.z > 16) {
        g.scene.remove(c.mesh);
        g.coinsList.splice(i, 1);
      }
    }

    // 14. WORLD-CLASS DYNAMIC CAMERA KINEMATICS (The AAA "Secret Sauce")
    if (g.camera) {
      // Lateral tracking: follows player lane smoothly with spring inertia
      const targetCamX = g.currentX * 0.72;

      // Height tracking:
      // - Drops low when sliding (intense low-angle stone rush)
      // - Rises when jumping (tracking airborne apex)
      // - Subtle natural human head-bob while grounded
      const headBob = (!g.isJumping && !g.isSliding) ? Math.sin(g.runAnimTime * 2) * 0.08 : 0;
      const targetCamY = (g.isSliding ? 3.85 : (4.3 + g.jumpY * 0.45)) + headBob;

      // Depth tracking with high-speed pushback (slightly pulled back during slide for crystal clear visibility)
      const targetCamZ = (g.isSliding ? 8.2 : 7.6) + (currentSpeed > 65 ? 0.7 : 0);

      // Screen trauma / stumble impact jitter shake
      let shakeX = 0;
      let shakeY = 0;
      if (g.trauma > 0) {
        g.trauma = Math.max(0, g.trauma - dt * 2.2);
        shakeX = (Math.random() - 0.5) * g.trauma * 0.9;
        shakeY = (Math.random() - 0.5) * g.trauma * 0.9;
      }

      // Smooth camera interpolation
      g.camera.position.x += (targetCamX + shakeX - g.camera.position.x) * (dt * 12);
      g.camera.position.y += (targetCamY + shakeY - g.camera.position.y) * (dt * 12);
      g.camera.position.z += (targetCamZ - g.camera.position.z) * (dt * 8);

      // Dynamic FOV based on speed and slide rush (wider lens at speed!)
      const targetFov = 62 + ((currentSpeed - 42) / 46) * 12 + (g.isSliding ? 10 : 0);
      g.camera.fov += (targetFov - g.camera.fov) * (dt * 6);

      // Camera roll / bank during lane changes and turns
      const turnCameraRoll = g.turnAnimProgress > 0 ? (g.lastTurnDir === 'left' ? -0.15 : 0.15) * Math.sin(g.turnAnimProgress * Math.PI) : 0;
      g.camera.rotation.z = (g.targetX - g.currentX) * -0.04 + turnCameraRoll;
      g.camera.updateProjectionMatrix();

      // Camera dynamically tracks ahead down the runway
      g.camera.lookAt(g.currentX * 0.35, 2.1 + g.jumpY * 0.3, -16);
    }
  };

  // =========================================================================
  // SPAWN 3D OBSTACLES, COINS & CORNER TURNS
  // =========================================================================
  const spawnChunkElements = (zPos) => {
    const g = gameRef.current;
    if (!g.scene) return;

    // 0. Procedural 90-Degree Aztec Corner Turns (Every ~220m)
    if (g.distance > 80 && (g.distance - g.lastCornerDist > 220) && !g.upcomingCorner) {
      const dir = Math.random() < 0.5 ? 'left' : 'right';
      const cornerMesh = buildCornerTurnChunk(dir);
      cornerMesh.position.set(0, 0, zPos);
      g.scene.add(cornerMesh);
      g.upcomingCorner = { mesh: cornerMesh, direction: dir, handled: false };
      g.lastCornerDist = g.distance;
      return; // Do not spawn obstacles right on top of corner intersection
    }

    // 1. Obstacles (36% chance)
    if (Math.random() < 0.36) {
      const types = ['log', 'spikes', 'fire_ring', 'broken_gap'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const lane = (chosenType === 'fire_ring' || chosenType === 'broken_gap') ? 'all' : Math.floor(Math.random() * 3);
      const laneX = lane === 'all' ? 0 : (lane - 1) * 1.85;

      let mesh = null;

      if (chosenType === 'log') {
        // Gnarly Organic Fallen Tree Trunk with Bark & Branch Stubs
        mesh = new THREE.Group();
        const logGeo = new THREE.CylinderGeometry(0.36, 0.42, 2.3, 20);
        logGeo.computeVertexNormals();
        const logMat = new THREE.MeshStandardMaterial({ color: 0x542c11, roughness: 0.85 });
        const logBody = new THREE.Mesh(logGeo, logMat);
        logBody.rotation.z = Math.PI / 2;
        mesh.add(logBody);

        // Branch stub
        const branchGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.4, 12);
        const branch = new THREE.Mesh(branchGeo, logMat);
        branch.position.set(0.3, 0.28, 0);
        branch.rotation.z = 0.4;
        mesh.add(branch);

        mesh.position.set(laneX, 0.35, zPos);
        mesh.castShadow = true;
      } else if (chosenType === 'spikes') {
        // Ancient Stone Base with Sharp Bone/Steel Spikes
        mesh = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(2.1, 0.45, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.22;
        mesh.add(base);

        const spikeGeo = new THREE.ConeGeometry(0.14, 0.65, 12);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.8 });
        for (let s = -3; s <= 3; s += 2) {
          const sp = new THREE.Mesh(spikeGeo, spikeMat);
          sp.position.set(s * 0.25, 0.68, 0);
          mesh.add(sp);
        }
        mesh.position.set(laneX, 0, zPos);
      } else if (chosenType === 'fire_ring') {
        // Low Flaming Fire Ring Arch (Slide Underneath!)
        mesh = new THREE.Group();
        const archMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
        const archTop = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.6, 0.6), archMat);
        archTop.position.set(0, 1.45, 0);
        mesh.add(archTop);

        const fireTorus = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.22, 16, 32),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        fireTorus.position.set(0, 1.6, 0);
        mesh.add(fireTorus);

        mesh.position.set(0, 0, zPos);
      } else if (chosenType === 'broken_gap') {
        // Broken Bridge Abyss Gap (Jump Over It!)
        mesh = buildBrokenGapMesh();
        mesh.position.set(0, 0, zPos);
      }

      if (mesh) {
        g.scene.add(mesh);
        g.obstacles.push({ mesh, type: chosenType, lane, laneX, hit: false });
        return;
      }
    }

    // 2. 3D Golden Diamond Aztec Coins (1:1 with Temple Run Image 1)
    if (Math.random() < 0.52) {
      const lane = Math.floor(Math.random() * 3);
      const laneX = (lane - 1) * 1.85;
      const isArch = Math.random() < 0.4; // 40% chance of arched jump trail

      for (let c = 0; c < 5; c++) {
        const cMesh = createDiamondCoinMesh();
        const archY = isArch ? (0.75 + Math.sin((c / 4) * Math.PI) * 1.7) : 0.75;
        cMesh.position.set(laneX, archY, zPos + (c * 2.4));
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
          <div style={{
            fontSize: '1.6rem',
            filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.9))'
          }}>
            🏃
          </div>

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

      {/* LEFT SIDE: Vertical Golden Idol Multiplier Bar (1:1 with Images 1 & 2) */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 20,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none'
      }}>
        {/* Golden Mask Idol Head */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #fde047 0%, #d97706 70%, #78350f 100%)',
          border: '2px solid #fef08a',
          boxShadow: '0 0 12px rgba(245, 158, 11, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.05rem'
        }}>
          🗿
        </div>
        {/* Vertical Vine Filling Tube */}
        <div style={{
          width: '14px',
          height: '140px',
          borderRadius: '8px',
          background: 'rgba(20, 20, 20, 0.75)',
          border: '1.5px solid #78716c',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%',
            height: `${Math.min(100, powerMeter)}%`,
            background: 'linear-gradient(180deg, #34d399 0%, #059669 50%, #047857 100%)',
            boxShadow: '0 0 8px #10b981',
            borderRadius: '6px',
            transition: 'height 0.15s ease'
          }} />
        </div>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 900,
          color: '#fbbf24',
          fontFamily: 'monospace',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)'
        }}>
          {powerMeter >= 80 ? '4X' : powerMeter >= 50 ? '3X' : powerMeter >= 25 ? '2X' : '1X'}
        </span>
      </div>

      {/* TOP CENTER: Carved Stone Pause Button */}
      {gameState === 'playing' && (
        <button
          onClick={(e) => { e.stopPropagation(); setGameState('paused'); }}
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #44403c 0%, #292524 100%)',
            border: '2px solid #78716c',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px'
          }}
          aria-label="Pause"
        >
          <div style={{ width: '4px', height: '14px', background: '#fbbf24', borderRadius: '2px' }} />
          <div style={{ width: '4px', height: '14px', background: '#fbbf24', borderRadius: '2px' }} />
        </button>
      )}

      {/* ON-SCREEN ACTION CONTROLS (TACTILE TOUCH & CLICK BUTTONS) */}
      {gameState === 'playing' && (
        <>
          {/* Bottom Left: Steer ◀ and ▶ */}
          <div style={{
            position: 'absolute',
            bottom: 18,
            left: 18,
            zIndex: 30,
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveLeft(); }}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #292524 0%, #1c1917 100%)',
                border: '2.5px solid #78716c',
                color: '#10b981',
                fontSize: '1.35rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.1)',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none'
              }}
              aria-label="Steer Left"
            >
              ◀
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveRight(); }}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #292524 0%, #1c1917 100%)',
                border: '2.5px solid #78716c',
                color: '#10b981',
                fontSize: '1.35rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.1)',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none'
              }}
              aria-label="Steer Right"
            >
              ▶
            </button>
          </div>

          {/* Bottom Right: Tactile JUMP & SLIDE Action Buttons (Exact User Match) */}
          <div style={{
            position: 'absolute',
            bottom: 18,
            right: 18,
            zIndex: 30,
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            {/* SLIDE BUTTON */}
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); slide(); }}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #065f46 0%, #064e3b 100%)',
                border: '2.5px solid #34d399',
                color: '#ecfdf5',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(6, 95, 70, 0.7), 0 0 14px rgba(52, 211, 153, 0.4)',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none'
              }}
              aria-label="Slide"
            >
              <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>▼</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.5px' }}>SLIDE</span>
            </button>

            {/* JUMP BUTTON */}
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); jump(); }}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #ea580c 0%, #c2410c 100%)',
                border: '3px solid #fde047',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(234, 88, 12, 0.8), 0 0 18px rgba(253, 224, 71, 0.5)',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none'
              }}
              aria-label="Jump"
            >
              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>▲</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.5px' }}>JUMP</span>
            </button>
          </div>
        </>
      )}

      {/* DEMON MONKEY DANGER RED VIGNETTE PULSE OVERLAY */}
      {dangerOpacity > 0 && gameState === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: `inset 0 0 ${Math.floor(dangerOpacity * 110)}px rgba(220, 38, 38, ${dangerOpacity * 0.9})`,
            border: `${Math.floor(dangerOpacity * 6)}px solid rgba(239, 68, 68, ${dangerOpacity * 0.75})`,
            borderRadius: '24px',
            transition: 'box-shadow 0.12s ease'
          }}
        />
      )}

      {/* 90-DEGREE CORNER TURN WARNING BANNER */}
      {turnWarning && gameState === 'playing' && (
        <div
          style={{
            position: 'absolute',
            top: 75,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.94) 0%, rgba(4, 47, 46, 0.98) 100%)',
            border: '2px solid #10b981',
            borderRadius: '24px',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.9), 0 4px 15px rgba(0,0,0,0.8)',
            animation: 'templeTurnPulse 0.4s infinite alternate',
            color: '#fff',
            fontWeight: 900,
            fontSize: '1.05rem',
            letterSpacing: '1px'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{turnWarning === 'left' ? '⬅️' : '➡️'}</span>
          <span>{turnWarning === 'left' ? 'SWIPE LEFT TO TURN!' : 'SWIPE RIGHT TO TURN!'}</span>
        </div>
      )}

      {/* FLOATING ACTION HINT FOR NEW RUN (Disappears as runner gets moving) */}
      {gameState === 'playing' && distance < 25 && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.7)',
            border: '1.5px solid rgba(251, 191, 36, 0.5)',
            borderRadius: '20px',
            padding: '6px 20px',
            color: '#fef08a',
            fontSize: '0.82rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            animation: 'templeTurnPulse 0.8s infinite alternate'
          }}
        >
          SWIPE OR TAP BUTTONS • JUMP, SLIDE & TURN
        </div>
      )}

      {/* FLOATING COMBO & SCORE POPUPS */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 35,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {popups.map(p => (
          <div
            key={p.id}
            style={{
              fontFamily: 'serif, monospace',
              fontSize: '1.5rem',
              fontWeight: 900,
              color: p.color,
              textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 16px currentColor',
              animation: 'templeFloatUp 0.85s ease-out forwards'
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes templeFloatUp {
          0% { opacity: 0; transform: translateY(14px) scale(0.8); }
          25% { opacity: 1; transform: translateY(0px) scale(1.15); }
          75% { opacity: 1; transform: translateY(-20px) scale(1.0); }
          100% { opacity: 0; transform: translateY(-38px) scale(0.85); }
        }
        @keyframes templeTurnPulse {
          0% { transform: translateX(-50%) scale(1.0); }
          100% { transform: translateX(-50%) scale(1.06); }
        }
      `}</style>

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
