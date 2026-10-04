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
const createStonePathwayTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Golden Sandstone Flagstones Base
  const baseGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
  baseGrad.addColorStop(0, '#eab308');
  baseGrad.addColorStop(0.3, '#d97706');
  baseGrad.addColorStop(0.7, '#ca8a04');
  baseGrad.addColorStop(1, '#92400e');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Weathered Flagstone Grid Mortar
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 6;
  for (let y = 0; y < 1024; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
    for (let x = (y % 256 === 0 ? 0 : 64); x < 1024; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 128);
      ctx.stroke();
    }
  }

  // Ancient Concentric Stone Spirals (Exact match to User Screenshot 2)
  const drawCarvedSpiral = (cx, cy, maxR) => {
    ctx.strokeStyle = '#5c2406';
    ctx.lineWidth = 14;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.08) {
      const r = (a / (Math.PI * 6)) * maxR;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Golden Rune Inner Chisel Highlight
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
    ctx.lineWidth = 4;
    ctx.stroke();
  };

  drawCarvedSpiral(512, 256, 110);
  drawCarvedSpiral(512, 768, 110);
  drawCarvedSpiral(200, 512, 80);
  drawCarvedSpiral(824, 512, 80);

  // Wild Moss & Mountain Lichen on Outer Edges
  ctx.fillStyle = '#15803d';
  for (let i = 0; i < 1024; i += 12) {
    const mossW1 = Math.random() * 60 + 20;
    const mossW2 = Math.random() * 60 + 20;
    ctx.fillRect(0, i, mossW1, 12);
    ctx.fillRect(1024 - mossW2, i, mossW2, 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
};

// Procedural Sunset Sky Canvas Texture (Golden-Orange Sunset matching Image 1)
const createSkyTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#ea580c');   // Deep fiery sunset orange
  grad.addColorStop(0.35, '#f97316');
  grad.addColorStop(0.65, '#fed7aa'); // Golden Horizon
  grad.addColorStop(0.85, '#ffffff'); // Cloud Deck
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft Cloud Strata
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, 300 + i * 25, 180 + Math.random() * 80, 20 + Math.random() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
};

// =========================================================================
// ORGANIC HUMAN & CREATURE MODEL SCULPTORS (ZERO MINECRAFT BOXES)
// =========================================================================

// Build Guy Dangerous (Realistic humanoid explorer with natural anatomy & articulation)
const buildGuyDangerous = () => {
  const root = new THREE.Group();

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 }); // Cream safari shirt
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 }); // Olive pants
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 }); // Leather belt/boots
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 }); // Red-auburn hair

  // 1. Torso: Tapered anatomical chest to waist (smooth cylinder)
  const torsoGeo = new THREE.CylinderGeometry(0.38, 0.28, 0.95, 24);
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  root.add(torso);

  // Leather Holster & Belt with Brass Buckle
  const beltGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24);
  const belt = new THREE.Mesh(beltGeo, leatherMat);
  belt.position.y = 0.9;
  root.add(belt);

  // 2. Neck & Head
  const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 1.9;
  root.add(neck);

  const headGeo = new THREE.SphereGeometry(0.26, 20, 20);
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 2.08;
  root.add(head);

  // Red/Auburn Hair with organic volume
  const hairGeo = new THREE.SphereGeometry(0.28, 20, 20);
  hairGeo.scale(1, 0.85, 1.1);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 2.18, -0.04);
  root.add(hair);

  // 3. Articulated Legs (Two-segment thighs + shins + realistic boots)
  const createLeg = (isLeft) => {
    const hip = new THREE.Group();
    hip.position.set(isLeft ? -0.22 : 0.22, 0.85, 0);

    // Thigh (tapered organic cylinder)
    const thighGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.55, 16);
    thighGeo.computeVertexNormals();
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.position.y = -0.27;
    thigh.castShadow = true;
    hip.add(thigh);

    // Knee Pivot
    const knee = new THREE.Group();
    knee.position.y = -0.55;
    hip.add(knee);

    // Shin/Calf (tapered organic cylinder)
    const calfGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.5, 16);
    calfGeo.computeVertexNormals();
    const calf = new THREE.Mesh(calfGeo, pantsMat);
    calf.position.y = -0.25;
    calf.castShadow = true;
    knee.add(calf);

    // Explorer Boot
    const bootGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.25, 16);
    const boot = new THREE.Mesh(bootGeo, leatherMat);
    boot.position.y = -0.48;
    const footGeo = new THREE.BoxGeometry(0.18, 0.12, 0.32);
    const foot = new THREE.Mesh(footGeo, leatherMat);
    foot.position.set(0, -0.55, 0.08);
    knee.add(boot);
    knee.add(foot);

    root.add(hip);
    return { hip, knee };
  };

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 4. Articulated Arms (Shoulder deltoid + bicep + elbow + forearm + hand)
  const createArm = (isLeft) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(isLeft ? -0.46 : 0.46, 1.7, 0);

    // Deltoid muscle
    const deltoidGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const deltoid = new THREE.Mesh(deltoidGeo, shirtMat);
    shoulder.add(deltoid);

    // Bicep (rolled-up sleeve)
    const bicepGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.42, 16);
    bicepGeo.computeVertexNormals();
    const bicep = new THREE.Mesh(bicepGeo, shirtMat);
    bicep.position.y = -0.22;
    shoulder.add(bicep);

    // Elbow Pivot
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    shoulder.add(elbow);

    // Forearm (skin tone)
    const forearmGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.42, 16);
    forearmGeo.computeVertexNormals();
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.21;
    elbow.add(forearm);

    // Hand Fist
    const handGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.44;
    elbow.add(hand);

    root.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = createArm(true);
  const rightArm = createArm(false);

  return {
    group: root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm
  };
};

// Build Demon Ape (Organic massive gorilla beast matching Screenshot 1)
const buildDemonApe = () => {
  const root = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 }); // Pitch charcoal fur
  const crestMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.7 }); // Silver crest
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Crimson glowing eyes
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.5 }); // Dark red horns

  // 1. Massive Hunched Gorilla Back / Scapula
  const backGeo = new THREE.SphereGeometry(1.2, 24, 24);
  backGeo.scale(1.2, 1.1, 0.95);
  backGeo.computeVertexNormals();
  const back = new THREE.Mesh(backGeo, furMat);
  back.position.set(0, 1.6, -0.2);
  root.add(back);

  // 2. Heavy Ape Head with Silver Crest
  const headGeo = new THREE.SphereGeometry(0.7, 20, 20);
  headGeo.scale(1, 0.9, 1.15);
  const head = new THREE.Mesh(headGeo, furMat);
  head.position.set(0, 2.45, 0.55);
  root.add(head);

  // Silver fur mane / crest running down head & neck (Exact match to Screenshot 1!)
  const crestGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.2, 16);
  crestGeo.scale(0.8, 1, 1.3);
  const crest = new THREE.Mesh(crestGeo, crestMat);
  crest.rotation.x = Math.PI / 4;
  crest.position.set(0, 2.75, 0.45);
  root.add(crest);

  // Glowing Crimson Eyes
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
  leftEye.position.set(-0.25, 2.5, 1.15);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
  rightEye.position.set(0.25, 2.5, 1.15);
  root.add(leftEye);
  root.add(rightEye);

  // Curved Demonic Horns
  const hornGeo = new THREE.ConeGeometry(0.14, 0.75, 16);
  const leftHorn = new THREE.Mesh(hornGeo, hornMat);
  leftHorn.position.set(-0.55, 3.0, 0.4);
  leftHorn.rotation.z = -0.6;
  const rightHorn = new THREE.Mesh(hornGeo, hornMat);
  rightHorn.position.set(0.55, 3.0, 0.4);
  rightHorn.rotation.z = 0.6;
  root.add(leftHorn);
  root.add(rightHorn);

  // 3. Huge Muscular Pounding Gorilla Arms
  const createApeArm = (isLeft) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(isLeft ? -1.25 : 1.25, 1.8, 0.2);

    // Massive Deltoid Boulder
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), furMat);
    shoulder.add(deltoid);

    // Thick Upper Arm
    const bicepGeo = new THREE.CylinderGeometry(0.36, 0.28, 0.9, 16);
    bicepGeo.computeVertexNormals();
    const bicep = new THREE.Mesh(bicepGeo, furMat);
    bicep.position.y = -0.45;
    shoulder.add(bicep);

    // Forearm & Heavy Fist
    const forearmGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.95, 16);
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
    scene.fog = new THREE.FogExp2(0xfed7aa, 0.009);

    // 2. Perspective Camera (Over-the-shoulder third-person camera matching screenshots)
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 400);
    camera.position.set(0, 4.3, 7.6);
    camera.lookAt(0, 2.1, -14);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
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

    // 8. FLOATING MOUNTAIN CLOUDS DECK (Beneath Floating Stone Bridge)
    const cloudsList = [];
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      roughness: 1.0
    });

    for (let c = 0; c < 28; c++) {
      const cloudGeo = new THREE.SphereGeometry(Math.random() * 8 + 6, 8, 8);
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 65,
        -12 - Math.random() * 8,
        -Math.random() * 220
      );
      scene.add(cloud);
      cloudsList.push(cloud);
    }

    // 9. PROCEDURAL 3D ENDLESS TRACK GENERATOR (Smooth rounded curbs, carved spiral slabs)
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

      // Rounded Weathered Stone Balustrades / Curbs
      const railGeo = new THREE.CylinderGeometry(0.4, 0.45, CHUNK_LENGTH, 16);
      railGeo.rotateX(Math.PI / 2);
      const leftRail = new THREE.Mesh(railGeo, carvedWallMat);
      leftRail.position.set(-3.5, 0.4, 0);
      const rightRail = new THREE.Mesh(railGeo, carvedWallMat);
      rightRail.position.set(3.5, 0.4, 0);
      chunk.add(leftRail);
      chunk.add(rightRail);

      // Ancient Stone Pillars with Emerald Gems at intervals (Exact match to Screenshot 1 & 2)
      const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, 4.2, 16);
      pillarGeo.computeVertexNormals();
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

      // 3D Pine Tree on Mountain (Exact match to Screenshot 1)
      const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 12);
      const treeTrunk = new THREE.Mesh(treeTrunkGeo, new THREE.MeshStandardMaterial({ color: 0x45230e }));
      treeTrunk.position.set(rockSide * 0.7, 0, 0);
      const treeLeavesGeo = new THREE.ConeGeometry(1.6, 4.5, 12);
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
      g.playerObj.group.rotation.x = -1.25; // Lean backwards flat
      g.playerObj.group.position.y = -0.35;
      if (g.slideTimer <= 0) {
        g.isSliding = false;
        g.playerObj.group.rotation.x = 0;
        g.playerObj.group.position.y = 0;
      }
    } else {
      g.playerObj.group.rotation.x = 0;
    }

    // 5. Articulated Runner Kinematics (Natural human running gait)
    g.runAnimTime += dt * (currentSpeed * 0.35);
    const { leftLeg, rightLeg, leftArm, rightArm } = g.playerObj;

    if (!g.isJumping && !g.isSliding) {
      const legAngle = Math.sin(g.runAnimTime) * 0.85;
      // Hip rotation
      leftLeg.hip.rotation.x = legAngle;
      rightLeg.hip.rotation.x = -legAngle;
      // Knee natural bending: bend backwards when leg kicks back!
      leftLeg.knee.rotation.x = Math.max(0, -legAngle * 1.1);
      rightLeg.knee.rotation.x = Math.max(0, legAngle * 1.1);

      // Arm swing with bent elbows
      leftArm.shoulder.rotation.x = -legAngle * 0.8;
      rightArm.shoulder.rotation.x = legAngle * 0.8;
      leftArm.elbow.rotation.x = -0.4;
      rightArm.elbow.rotation.x = -0.4;
    } else if (g.isJumping) {
      // Tucked knees & raised arms
      leftLeg.hip.rotation.x = -0.8;
      rightLeg.hip.rotation.x = -0.8;
      leftLeg.knee.rotation.x = 1.2;
      rightLeg.knee.rotation.x = 1.2;
      leftArm.shoulder.rotation.x = -2.2;
      rightArm.shoulder.rotation.x = -2.2;
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
      const targetCamY = (g.isSliding ? 2.15 : (4.3 + g.jumpY * 0.45)) + headBob;

      // Depth tracking with high-speed pushback
      const targetCamZ = 7.6 + (currentSpeed > 65 ? 0.7 : 0);

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

    // 2. 3D Golden Coins (45% chance)
    if (Math.random() < 0.45) {
      const lane = Math.floor(Math.random() * 3);
      const laneX = (lane - 1) * 1.85;
      const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20);
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

      {/* BOTTOM RIGHT: Carved Stone Pause Button (Exact match to Screenshots) */}
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
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '5px', height: '18px', background: '#fbbf24', borderRadius: '2px' }} />
            <div style={{ width: '5px', height: '18px', background: '#fbbf24', borderRadius: '2px' }} />
          </div>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
        </button>
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
