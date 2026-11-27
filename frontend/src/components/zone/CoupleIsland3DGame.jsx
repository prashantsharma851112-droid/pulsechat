import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import * as THREE from 'three';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { playSound } from '../../utils/audio';
import GameVoiceChat from '../chat/GameVoiceChat';
import {
  ArrowLeft,
  Heart,
  Volume2,
  VolumeX,
  Compass,
  Sparkles,
  Users,
  Copy,
  Check,
  Smile,
  ShieldCheck,
  Eye,
  Camera,
  Flame,
  Award
} from 'lucide-react';

// =========================================================================
// NATIVE PROCEDURAL ROMANTIC AUDIO SYNTHESIZER
// High fidelity footstep sands, ocean ambient waves, crystal bell chimes,
// dual pad activation fanfare, and heart pop harmonics without external mp3s
// =========================================================================
const createIslandAudio = () => {
  let ctx = null;
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

  const playChime = (freq = 660, type = 'sine', duration = 0.6) => {
    if (isMuted) return;
    init();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + duration * 0.4);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playCrystalCollect = () => {
    playChime(784, 'triangle', 0.5);
    setTimeout(() => playChime(987.77, 'sine', 0.6), 80);
    setTimeout(() => playChime(1174.66, 'sine', 0.8), 160);
  };

  const playPadActive = () => {
    playChime(523.25, 'sine', 0.4);
    setTimeout(() => playChime(659.25, 'sine', 0.5), 100);
    setTimeout(() => playChime(783.99, 'sine', 0.6), 200);
    setTimeout(() => playChime(1046.50, 'sine', 1.0), 300);
  };

  const playHeartPop = () => {
    playChime(880, 'sine', 0.3);
  };

  return {
    init,
    playChime,
    playCrystalCollect,
    playPadActive,
    playHeartPop,
    setMuted: (m) => { isMuted = m; }
  };
};

export default function CoupleIsland3DGame({
  roomCode: initialRoomCode = null,
  role: initialRole = 'host',
  partnerData: initialPartner = null,
  onBack
}) {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const containerRef = useRef(null);
  const audioRef = useRef(null);

  // Ephemeral Room State (Zero DB Persistence)
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [role, setRole] = useState(initialRole || 'host'); // 'host' (Cyan/Blue) | 'partner' (Rose/Pink)
  const [partner, setPartner] = useState(initialPartner || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // Adventure Quests & In-Game State
  const [crystalsCount, setCrystalsCount] = useState(0);
  const [isHoldingHands, setIsHoldingHands] = useState(false);
  const [padsActivated, setPadsActivated] = useState(false);
  const [sunsetPeakUnlocked, setSunsetPeakUnlocked] = useState(false);
  const [activeEmote, setActiveEmote] = useState(null);
  const [partnerEmote, setPartnerEmote] = useState(null);
  const [isSitting, setIsSitting] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);

  // Real-time synchronization refs
  const localPosRef = useRef({ x: 0, y: 1.2, z: 0, rot: 0, isMoving: false, isJumping: false });
  const remotePosRef = useRef({ x: 2, y: 1.2, z: 2, rot: 0, isMoving: false, isJumping: false });
  const lastSyncTimeRef = useRef(0);

  // Initialize native audio synthesizer
  useEffect(() => {
    audioRef.current = createIslandAudio();
    return () => {
      audioRef.current = null;
    };
  }, []);

  // Room Creation / Joining Lifecycle
  useEffect(() => {
    if (!socket) return;

    if (!roomCode && initialRole === 'host') {
      const generatedCode = 'LOVE-' + Math.floor(1000 + Math.random() * 9000);
      socket.emit('couple_room_create', {
        roomCode: generatedCode,
        gameType: 'island3d',
        user: {
          id: user?.id || user?._id || 'host',
          name: user?.displayName || user?.username || 'Partner 1',
          avatar: user?.avatar || '',
          color: '#38bdf8'
        }
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('host');
        }
      });
    }

    const handleRoomReady = (data) => {
      if (data.host && data.partner) {
        if (role === 'host') {
          setPartner(data.partner);
        } else {
          setPartner(data.host);
        }
        playSound('success');
        if (audioRef.current) audioRef.current.playChime(880, 'sine', 0.8);
      }
    };

    const handlePlayerUpdated = ({ senderRole, playerState }) => {
      if (playerState) {
        remotePosRef.current = {
          ...remotePosRef.current,
          ...playerState
        };
      }
    };

    const handleActionReceived = ({ senderRole, actionType, payload }) => {
      if (actionType === 'crystal_collect') {
        setCrystalsCount(payload.count);
        if (audioRef.current) audioRef.current.playCrystalCollect();
      } else if (actionType === 'dual_pads') {
        setPadsActivated(payload.active);
        if (payload.active && audioRef.current) audioRef.current.playPadActive();
      } else if (actionType === 'hold_hands') {
        setIsHoldingHands(payload.active);
        if (payload.active && audioRef.current) audioRef.current.playHeartPop();
      } else if (actionType === 'emote') {
        setPartnerEmote(payload.emote);
        setTimeout(() => setPartnerEmote(null), 3500);
      } else if (actionType === 'sunset_sit') {
        setSunsetPeakUnlocked(true);
      }
    };

    const handlePartnerLeft = () => {
      setPartner(null);
      setIsHoldingHands(false);
    };

    socket.on('couple_room_ready', handleRoomReady);
    socket.on('couple_player_updated', handlePlayerUpdated);
    socket.on('couple_action_received', handleActionReceived);
    socket.on('couple_partner_left', handlePartnerLeft);

    return () => {
      socket.off('couple_room_ready', handleRoomReady);
      socket.off('couple_player_updated', handlePlayerUpdated);
      socket.off('couple_action_received', handleActionReceived);
      socket.off('couple_partner_left', handlePartnerLeft);
      if (roomCode) {
        socket.emit('couple_room_leave', { roomCode });
      }
    };
  }, [socket, user, roomCode, role, initialRole]);

  // Join Room by Code
  const handleJoinByCode = () => {
    if (!socket || !inputCode.trim()) return;
    setIsConnecting(true);
    setConnectionError('');

    socket.emit('couple_room_join', {
      roomCode: inputCode.trim(),
      user: {
        id: user?.id || user?._id || 'partner',
        name: user?.displayName || user?.username || 'Partner 2',
        avatar: user?.avatar || '',
        color: '#ec4899'
      }
    }, (res) => {
      setIsConnecting(false);
      if (res && res.success) {
        setRoomCode(res.roomCode);
        setRole('partner');
        setPartner(res.roomData?.host || null);
        playSound('success');
      } else {
        setConnectionError(res?.message || 'Failed to join room. Verify code.');
        playSound('error');
      }
    });
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    playSound('pop');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Three.js 3D Interactive World Engine
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId = null;
    let isDisposed = false;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfdba74); // Sunset orange-gold
    scene.fog = new THREE.FogExp2(0xfdba74, 0.015);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
    camera.position.set(0, 10, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Lighting (Golden Sunset Paradise Lighting)
    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x0284c7, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    sunLight.position.set(30, 45, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 40;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Ambient romantic point lights
    const heartGlowLight = new THREE.PointLight(0xf43f5e, 1.5, 25);
    heartGlowLight.position.set(0, 4, -15);
    scene.add(heartGlowLight);

    // 3. Terrain & Ocean
    // Ocean Plane
    const oceanGeo = new THREE.PlaneGeometry(300, 300, 32, 32);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.5;
    scene.add(ocean);

    // Island Ground (Layered Stylized Landscape)
    const islandGeo = new THREE.CylinderGeometry(38, 44, 4, 32);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, // Emerald grassy top
      roughness: 0.85,
      flatShading: true
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = 1;
    island.receiveShadow = true;
    scene.add(island);

    // Beach Sand Rim
    const beachGeo = new THREE.RingGeometry(35, 46, 32);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 1.05;
    beach.receiveShadow = true;
    scene.add(beach);

    // Hill Plateau / Sunset Peak
    const hillGeo = new THREE.CylinderGeometry(12, 16, 6, 16);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85, flatShading: true });
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(-14, 5, -14);
    hill.receiveShadow = true;
    scene.add(hill);

    // Lovers' Gazebo on Sunset Peak
    const gazeboGroup = new THREE.Group();
    gazeboGroup.position.set(-14, 8, -14);
    const roofGeo = new THREE.ConeGeometry(4, 2.5, 6);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3;
    gazeboGroup.add(roof);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xffedd5 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(Math.cos(angle) * 3, 1.5, Math.sin(angle) * 3);
      gazeboGroup.add(pole);
    }

    // Romantic Bench inside Gazebo
    const benchGeo = new THREE.BoxGeometry(2, 0.4, 0.8);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 0.4, 0);
    gazeboGroup.add(bench);
    scene.add(gazeboGroup);

    // Dual Pressure Pads on Island Center
    const pad1Geo = new THREE.CylinderGeometry(1.6, 1.7, 0.25, 24);
    const pad1Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    const pad1 = new THREE.Mesh(pad1Geo, pad1Mat);
    pad1.position.set(-3.5, 3.1, 4);
    scene.add(pad1);

    const pad2Geo = new THREE.CylinderGeometry(1.6, 1.7, 0.25, 24);
    const pad2Mat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xbe185d,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    const pad2 = new THREE.Mesh(pad2Geo, pad2Mat);
    pad2.position.set(3.5, 3.1, 4);
    scene.add(pad2);

    // 5 Collectible Love Crystals
    const crystalPositions = [
      new THREE.Vector3(12, 3.5, -8),
      new THREE.Vector3(-18, 3.5, 12),
      new THREE.Vector3(18, 3.5, 14),
      new THREE.Vector3(-22, 3.5, -6),
      new THREE.Vector3(0, 4.0, -20)
    ];
    const crystalMeshes = [];
    const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff1493,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.5
    });

    crystalPositions.forEach((pos, idx) => {
      const crystal = new THREE.Mesh(crystalGeo, crystalMat.clone());
      crystal.position.copy(pos);
      crystal.castShadow = true;
      crystal.userData = { id: idx, collected: false };
      scene.add(crystal);
      crystalMeshes.push(crystal);
    });

    // 4. Palm Trees Decoration
    const createPalmTree = (x, z, scale = 1) => {
      const tree = new THREE.Group();
      tree.position.set(x, 3, z);
      tree.scale.set(scale, scale, scale);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 4.5, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.25;
      trunk.rotation.z = (Math.random() - 0.5) * 0.2;
      trunk.castShadow = true;
      tree.add(trunk);

      // Leaves
      const leafGeo = new THREE.ConeGeometry(2.4, 1.2, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(0, 4.3, 0);
        leaf.rotation.x = Math.PI / 3;
        leaf.rotation.y = (i / 5) * Math.PI * 2;
        tree.add(leaf);
      }
      scene.add(tree);
    };

    createPalmTree(8, 12, 1.2);
    createPalmTree(14, 8, 0.9);
    createPalmTree(-10, 16, 1.1);
    createPalmTree(-20, -12, 1.3);
    createPalmTree(22, -10, 1.0);

    // 5. Stylized 3D Avatar Creation
    const createPlayerAvatar = (colorHex, isLocal = true) => {
      const playerGroup = new THREE.Group();

      // Body (Hoodie / explorer jacket)
      const bodyGeo = new THREE.CylinderGeometry(0.45, 0.5, 1.1, 12);
      const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.1;
      body.castShadow = true;
      playerGroup.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.95;
      head.castShadow = true;
      playerGroup.add(head);

      // Hair / Cap
      const capGeo = new THREE.SphereGeometry(0.4, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: isLocal ? 0x1e293b : 0xbe185d, roughness: 0.4 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.05;
      playerGroup.add(cap);

      // Backpack
      const packGeo = new THREE.BoxGeometry(0.45, 0.6, 0.3);
      const packMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const pack = new THREE.Mesh(packGeo, packMat);
      pack.position.set(0, 1.15, -0.35);
      pack.castShadow = true;
      playerGroup.add(pack);

      // Floating Heart Aura above head
      const heartShape = new THREE.Shape();
      const x = 0, y = 0;
      heartShape.moveTo(x + 0.25, y + 0.25);
      heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
      heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
      heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 1.0);
      heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
      heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
      heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

      const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };
      const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
      heartGeo.center();
      const heartMat = new THREE.MeshStandardMaterial({
        color: 0xff1493,
        emissive: 0xff69b4,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const floatingHeart = new THREE.Mesh(heartGeo, heartMat);
      floatingHeart.scale.set(0.45, 0.45, 0.45);
      floatingHeart.position.y = 2.75;
      floatingHeart.rotation.z = Math.PI;
      playerGroup.add(floatingHeart);

      // Left & Right Legs for walk animation
      const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.2, 0.3, 0);
      playerGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.2, 0.3, 0);
      playerGroup.add(rightLeg);

      scene.add(playerGroup);
      return { group: playerGroup, floatingHeart, leftLeg, rightLeg };
    };

    const localColor = role === 'host' ? 0x38bdf8 : 0xec4899;
    const remoteColor = role === 'host' ? 0xec4899 : 0x38bdf8;

    const localAvatar = createPlayerAvatar(localColor, true);
    const remoteAvatar = createPlayerAvatar(remoteColor, false);

    // Initial Positions
    localAvatar.group.position.set(role === 'host' ? -2 : 2, 3.0, 0);
    remoteAvatar.group.position.set(role === 'host' ? 2 : -2, 3.0, 0);

    // 6. Keyboard & Touch Movement Controls
    const keys = { w: false, a: false, s: false, d: false, space: false };
    const joystick = { x: 0, y: 0, active: false };

    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.w = true;
      if (k === 's' || k === 'arrowdown') keys.s = true;
      if (k === 'a' || k === 'arrowleft') keys.a = true;
      if (k === 'd' || k === 'arrowright') keys.d = true;
      if (e.code === 'Space') keys.space = true;
    };

    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.w = false;
      if (k === 's' || k === 'arrowdown') keys.s = false;
      if (k === 'a' || k === 'arrowleft') keys.a = false;
      if (k === 'd' || k === 'arrowright') keys.d = false;
      if (e.code === 'Space') keys.space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Orbit Camera Drag
    let isDragging = false;
    let prevMouseX = 0;
    let cameraAngle = 0;

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      cameraAngle += deltaX * 0.005;
      prevMouseX = e.clientX;
    };
    const handleMouseUp = () => { isDragging = false; };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Tab visibility handling (Zero background CPU & prevents death loop)
    let isVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !animId && !isDisposed) {
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Physics & Game Loop
    let lastTime = performance.now();
    let walkCycle = 0;
    let velocityY = 0;
    const gravity = -24;
    const groundY = 3.0;

    const animate = (currentTime) => {
      if (isDisposed) return;
      if (!isVisible) {
        animId = null;
        return;
      }

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Local player input calculation
      let moveX = 0;
      let moveZ = 0;

      if (keys.w) moveZ -= 1;
      if (keys.s) moveZ += 1;
      if (keys.a) moveX -= 1;
      if (keys.d) moveX += 1;

      // Add touch joystick input
      if (window.__coupleJoystick) {
        moveX += window.__coupleJoystick.x;
        moveZ += window.__coupleJoystick.y;
      }

      const inputLength = Math.hypot(moveX, moveZ);
      const isMoving = inputLength > 0.05;

      if (isMoving) {
        const speed = 7.5;
        const normX = moveX / inputLength;
        const normZ = moveZ / inputLength;

        // Move relative to camera orbit angle
        const worldX = normX * Math.cos(cameraAngle) - normZ * Math.sin(cameraAngle);
        const worldZ = normX * Math.sin(cameraAngle) + normZ * Math.cos(cameraAngle);

        localAvatar.group.position.x += worldX * speed * dt;
        localAvatar.group.position.z += worldZ * speed * dt;

        // Smoothly rotate player towards movement
        const targetRot = Math.atan2(worldX, worldZ);
        localAvatar.group.rotation.y = targetRot;

        // Leg swing walking animation
        walkCycle += dt * 14;
        localAvatar.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
        localAvatar.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
      } else {
        localAvatar.leftLeg.rotation.x = 0;
        localAvatar.rightLeg.rotation.x = 0;
      }

      // Jump Physics
      if ((keys.space || window.__coupleJumpTrigger) && localAvatar.group.position.y <= groundY + 0.05) {
        velocityY = 9.0;
        window.__coupleJumpTrigger = false;
        if (audioRef.current) audioRef.current.playChime(440, 'triangle', 0.2);
      }

      velocityY += gravity * dt;
      localAvatar.group.position.y += velocityY * dt;
      if (localAvatar.group.position.y <= groundY) {
        localAvatar.group.position.y = groundY;
        velocityY = 0;
      }

      // Island Boundary Clamp
      const distFromCenter = Math.hypot(localAvatar.group.position.x, localAvatar.group.position.z);
      if (distFromCenter > 34) {
        const ratio = 34 / distFromCenter;
        localAvatar.group.position.x *= ratio;
        localAvatar.group.position.z *= ratio;
      }

      // Float aura hearts
      const t = currentTime * 0.003;
      localAvatar.floatingHeart.rotation.y = t * 2;
      localAvatar.floatingHeart.position.y = 2.75 + Math.sin(t * 3) * 0.15;
      remoteAvatar.floatingHeart.rotation.y = -t * 2;
      remoteAvatar.floatingHeart.position.y = 2.75 + Math.cos(t * 3) * 0.15;

      // Animate ocean ripples
      ocean.position.y = -0.5 + Math.sin(t * 1.5) * 0.15;

      // Rotate crystals
      crystalMeshes.forEach(c => {
        if (!c.userData.collected) {
          c.rotation.y += dt * 2.0;
          c.position.y += Math.sin(currentTime * 0.004 + c.userData.id) * 0.003;

          // Check player pickup distance
          const dLocal = localAvatar.group.position.distanceTo(c.position);
          const dRemote = remoteAvatar.group.position.distanceTo(c.position);
          if (dLocal < 2.0 || dRemote < 2.0) {
            c.userData.collected = true;
            c.visible = false;
            setCrystalsCount(prev => {
              const next = prev + 1;
              if (socket && roomCode) {
                socket.emit('couple_action_sync', {
                  roomCode,
                  actionType: 'crystal_collect',
                  payload: { count: next, updateState: { crystalsCollected: next } }
                });
              }
              return next;
            });
            if (audioRef.current) audioRef.current.playCrystalCollect();
          }
        }
      });

      // Check Dual Pressure Pads Collision
      const dPad1 = localAvatar.group.position.distanceTo(pad1.position);
      const dPad2 = remoteAvatar.group.position.distanceTo(pad2.position);
      const bothOnPads = (dPad1 < 2.2 && dPad2 < 2.2) || (localAvatar.group.position.distanceTo(pad2.position) < 2.2 && remoteAvatar.group.position.distanceTo(pad1.position) < 2.2);

      if (bothOnPads && !padsActivated) {
        setPadsActivated(true);
        if (socket && roomCode) {
          socket.emit('couple_action_sync', {
            roomCode,
            actionType: 'dual_pads',
            payload: { active: true, updateState: { dualPadsActive: true } }
          });
        }
        if (audioRef.current) audioRef.current.playPadActive();
      }

      // Holding Hands Distance check
      const dBetweenPlayers = localAvatar.group.position.distanceTo(remoteAvatar.group.position);
      if (isHoldingHands && dBetweenPlayers > 6.0) {
        setIsHoldingHands(false);
      }

      // Smooth Camera Follow
      const camDist = 14;
      const camHeight = 7.5;
      const targetCamX = localAvatar.group.position.x + Math.sin(cameraAngle) * camDist;
      const targetCamZ = localAvatar.group.position.z + Math.cos(cameraAngle) * camDist;
      camera.position.x += (targetCamX - camera.position.x) * 0.1;
      camera.position.y += (localAvatar.group.position.y + camHeight - camera.position.y) * 0.1;
      camera.position.z += (targetCamZ - camera.position.z) * 0.1;
      camera.lookAt(localAvatar.group.position.x, localAvatar.group.position.y + 1.2, localAvatar.group.position.z);

      // Smooth Remote Player Interpolation (Zero Jitter)
      remoteAvatar.group.position.x += (remotePosRef.current.x - remoteAvatar.group.position.x) * 0.25;
      remoteAvatar.group.position.y += (remotePosRef.current.y - remoteAvatar.group.position.y) * 0.25;
      remoteAvatar.group.position.z += (remotePosRef.current.z - remoteAvatar.group.position.z) * 0.25;
      remoteAvatar.group.rotation.y += (remotePosRef.current.rot - remoteAvatar.group.rotation.y) * 0.25;

      if (remotePosRef.current.isMoving) {
        remoteAvatar.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
        remoteAvatar.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
      } else {
        remoteAvatar.leftLeg.rotation.x = 0;
        remoteAvatar.rightLeg.rotation.x = 0;
      }

      // Emit Local Movement Sync (Throttled 30Hz)
      if (socket && roomCode && currentTime - lastSyncTimeRef.current > 33) {
        lastSyncTimeRef.current = currentTime;
        socket.emit('couple_player_sync', {
          roomCode,
          playerState: {
            x: localAvatar.group.position.x,
            y: localAvatar.group.position.y,
            z: localAvatar.group.position.z,
            rot: localAvatar.group.rotation.y,
            isMoving
          }
        });
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      isDisposed = true;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);

      // Clean Dispose WebGL Resources
      renderer.dispose();
      scene.clear();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [role, roomCode, socket]);

  // Touch Virtual Joystick Controls for Mobile
  const handleJoystickMove = (e) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const normX = (Math.cos(angle) * clampedDist) / maxRadius;
    const normY = (Math.sin(angle) * clampedDist) / maxRadius;

    window.__coupleJoystick = { x: normX, y: normY };
  };

  const handleJoystickEnd = () => {
    window.__coupleJoystick = { x: 0, y: 0 };
  };

  const triggerJump = () => {
    window.__coupleJumpTrigger = true;
  };

  // Hold Hands Action
  const toggleHoldHands = () => {
    const next = !isHoldingHands;
    setIsHoldingHands(next);
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'hold_hands',
        payload: { active: next, updateState: { isHoldingHands: next } }
      });
    }
    if (audioRef.current) audioRef.current.playHeartPop();
  };

  // Send Emote
  const sendEmote = (emoji) => {
    setActiveEmote(emoji);
    setShowEmotePicker(false);
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'emote',
        payload: { emote: emoji }
      });
    }
    if (audioRef.current) audioRef.current.playHeartPop();
    setTimeout(() => setActiveEmote(null), 3500);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '520px',
      position: 'relative',
      background: '#0f172a',
      borderRadius: '20px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          flex: 1,
          position: 'relative',
          cursor: 'grab'
        }}
      />

      {/* TOP FLOATING TACTICAL BAR: Room Code, Voice HUD & Quests */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        zIndex: 50,
        pointerEvents: 'none'
      }}>
        {/* Left: Back button + Room Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <ArrowLeft size={16} /> Exit
          </button>

          {roomCode && (
            <button
              onClick={copyRoomCode}
              title="Tap to copy Couple Room Code"
              style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)',
                border: '1.5px solid rgba(244, 63, 94, 0.6)',
                color: '#fff',
                borderRadius: '12px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 900,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)'
              }}
            >
              <Heart size={14} color="#f43f5e" fill="#f43f5e" />
              <span>{roomCode}</span>
              {copiedCode ? <Check size={14} color="#34d399" /> : <Copy size={13} color="#fbcfe8" />}
            </button>
          )}
        </div>

        {/* Center/Right: Free Fire Style Live WebRTC Voice Chat HUD */}
        <div style={{ pointerEvents: 'auto' }}>
          {roomCode ? (
            <GameVoiceChat
              chatId={`couple_${roomCode}`}
              partnerName={partner?.name || (role === 'host' ? 'Partner 2' : 'Partner 1')}
              partnerId={partner?.id || null}
              compact={false}
            />
          ) : null}
        </div>
      </div>

      {/* FLOATING QUEST & DISCOVERY STATUS BADGE */}
      <div style={{
        position: 'absolute',
        top: '64px',
        left: '12px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '14px',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 40,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#f59e0b" />
          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fef08a' }}>
            Couples Island Exploration
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 700 }}>
          <span>💎 Love Crystals: <b style={{ color: '#ec4899' }}>{crystalsCount}/5</b></span>
          <span>✨ Heart Pads: <b style={{ color: padsActivated ? '#10b981' : '#f59e0b' }}>{padsActivated ? 'Activated! 💖' : 'Step Together'}</b></span>
        </div>
        <div style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={11} color="#10b981" /> 100% Ephemeral & Private (Zero DB Storage)
        </div>
      </div>

      {/* FLOATING ACTIVE EMOTES OVER AVATARS */}
      {activeEmote && (
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '3.2rem',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
          animation: 'bounce 0.6s infinite alternate',
          pointerEvents: 'none',
          zIndex: 60
        }}>
          {activeEmote}
        </div>
      )}

      {partnerEmote && (
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '55%',
          transform: 'translate(-50%, -50%)',
          fontSize: '3.2rem',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
          animation: 'bounce 0.6s infinite alternate',
          pointerEvents: 'none',
          zIndex: 60
        }}>
          {partnerEmote}
        </div>
      )}

      {/* MOBILE TOUCH VIRTUAL JOYSTICK & ACTION BUTTONS */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 50
      }}>
        {/* Virtual Joystick (Left) */}
        <div
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px dashed rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            touchAction: 'none'
          }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)'
          }} />
        </div>

        {/* Action Buttons: Hold Hands, Jump, Emotes (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
          {/* Hold Hands Button */}
          <button
            onClick={toggleHoldHands}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: isHoldingHands
                ? 'linear-gradient(135deg, #f43f5e, #be185d)'
                : 'rgba(15, 23, 42, 0.8)',
              border: isHoldingHands ? '2px solid #fda4af' : '1.5px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isHoldingHands ? '0 0 16px rgba(244, 63, 94, 0.8)' : '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease'
            }}
            title="Hold Hands & Walk Together"
          >
            <Heart size={20} fill={isHoldingHands ? '#fff' : 'none'} />
            <span style={{ fontSize: '0.55rem', fontWeight: 900 }}>Hold</span>
          </button>

          {/* Emote Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowEmotePicker(prev => !prev)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}
            >
              <Smile size={20} />
            </button>

            {/* Quick Emote Palette */}
            {showEmotePicker && (
              <div style={{
                position: 'absolute',
                bottom: '56px',
                right: '0',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1.5px solid rgba(244, 63, 94, 0.5)',
                borderRadius: '16px',
                padding: '8px',
                display: 'flex',
                gap: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                zIndex: 80
              }}>
                {['💖', '👋', '💃', '🥰', '🌹', '✨'].map(em => (
                  <button
                    key={em}
                    onClick={() => sendEmote(em)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.4rem',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '8px',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Jump Button */}
          <button
            onClick={triggerJump}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: '2px solid #6ee7b7',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)',
              letterSpacing: '0.5px'
            }}
          >
            JUMP
          </button>
        </div>
      </div>

      {/* ROOM PAIRING OVERLAY (When Partner is not connected yet) */}
      {!partner && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1.5px solid rgba(244, 63, 94, 0.4)',
          borderRadius: '16px',
          padding: '12px 18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 45,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          maxWidth: '360px',
          width: '90%'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbcfe8', textAlign: 'center' }}>
            💌 Share code with your partner to explore together!
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <input
              type="text"
              placeholder="Or enter Partner's Code..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                outline: 'none'
              }}
            />
            <button
              onClick={handleJoinByCode}
              disabled={isConnecting}
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #be185d)',
                border: 'none',
                color: '#fff',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              {isConnecting ? 'Joining...' : 'Join'}
            </button>
          </div>
          {connectionError && (
            <div style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: 700 }}>
              {connectionError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
