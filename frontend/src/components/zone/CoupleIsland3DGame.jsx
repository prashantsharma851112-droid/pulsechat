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
  Flame,
  Award,
  Share2,
  MessageSquare,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  X,
  Play,
  RotateCw
} from 'lucide-react';

// =========================================================================
// PROCEDURAL AUDIO SYNTHESIZER (0 external mp3 dependencies)
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

  const playChime = (freq = 660, type = 'sine', duration = 0.5) => {
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
    playChime(784, 'triangle', 0.4);
    setTimeout(() => playChime(1046.5, 'sine', 0.5), 100);
  };

  const playPadActive = () => {
    playChime(523.25, 'sine', 0.3);
    setTimeout(() => playChime(659.25, 'sine', 0.4), 80);
    setTimeout(() => playChime(783.99, 'sine', 0.5), 160);
  };

  const playHeartPop = () => {
    playChime(880, 'sine', 0.25);
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
  const minimapCanvasRef = useRef(null);
  const audioRef = useRef(null);

  // Ephemeral Room State (Zero DB Persistence)
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [role, setRole] = useState(initialRole || 'host');
  const [partner, setPartner] = useState(initialPartner || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Landscape check & screen fitting
  const [isPortrait, setIsPortrait] = useState(() => {
    return typeof window !== 'undefined' ? (window.innerHeight > window.innerWidth && window.innerWidth < 900) : false;
  });

  // Clean in-game modal for inviting / room code (replaces the old huge bottom card)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // Quests & interactions
  const [crystalsCount, setCrystalsCount] = useState(0);
  const [isHoldingHands, setIsHoldingHands] = useState(false);
  const [padsActivated, setPadsActivated] = useState(false);
  const [activeEmote, setActiveEmote] = useState(null);
  const [partnerEmote, setPartnerEmote] = useState(null);
  const [showEmotePicker, setShowEmotePicker] = useState(false);

  // Real-time synchronization refs
  const localPosRef = useRef({ x: 0, y: 1.2, z: 0, rot: 0, isMoving: false });
  const remotePosRef = useRef({ x: 2, y: 3.0, z: 0, rot: 0, isMoving: false });
  const partnerAvatarRef = useRef(null);
  const remotePlayersMapRef = useRef(new Map()); // other island explorers: socketId -> { group, leftLeg, rightLeg, targetPos }
  const lastSyncTimeRef = useRef(0);
  const roomCodeRef = useRef(roomCode);
  const partnerNameRef = useRef(partner?.name || '');
  const zoomDistRef = useRef(14); // Camera zoom distance

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    partnerNameRef.current = partner?.name || '';
  }, [partner]);

  // Orientation listener
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
      setIsPortrait(portrait);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Automatic Fullscreen & Landscape on mount
  useEffect(() => {
    const enterLandscape = () => {
      try {
        if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().then(() => {
            setIsFullscreen(true);
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (_) {}
    };
    enterLandscape();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const getShareUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}?coupleRoom=${roomCode}`;
  };

  const handleShareLink = async () => {
    if (!roomCode) return;
    const url = getShareUrl();
    const text = `🎮 Join my Couple Adventure on PulseChat!\nRoom Code: ${roomCode}\n👉 ${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'PulseChat Couple Adventure',
          text,
          url
        });
        showToast('Shared successfully!');
      } catch (e) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          showToast('Direct join link copied to clipboard!');
        }
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Direct join link copied to clipboard!');
    }
  };

  const handleShareInChat = () => {
    if (!roomCode) return;
    const url = getShareUrl();
    const inviteMsg = `🎮 Join my Couple Adventure in PulseChat!\nRoom Code: ${roomCode}\n👉 ${url}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteMsg);
      showToast('Chat invitation copied! Paste in any chat 💬');
    }
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const handleZoomIn = () => {
    zoomDistRef.current = Math.max(6, zoomDistRef.current - 3);
  };
  const handleZoomOut = () => {
    zoomDistRef.current = Math.min(30, zoomDistRef.current + 3);
  };

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

    const myUser = {
      id: user?.id || user?._id || (initialRole === 'host' ? 'host' : 'partner'),
      name: user?.displayName || user?.username || (initialRole === 'host' ? 'Partner 1' : 'Partner 2'),
      avatar: user?.avatar || '',
      color: initialRole === 'host' ? '#38bdf8' : '#ec4899'
    };

    const targetCode = roomCode || initialRoomCode || ('LOVE-' + Math.floor(1000 + Math.random() * 9000));
    setRoomCode(targetCode);

    if (initialRole === 'host') {
      socket.emit('couple_room_create', {
        roomCode: targetCode,
        gameType: 'island3d',
        user: myUser
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('host');
          if (res.roomData?.partner) {
            setPartner(res.roomData.partner);
            if (partnerAvatarRef.current) partnerAvatarRef.current.group.visible = true;
          }
        }
      });
    } else {
      socket.emit('couple_room_join', {
        roomCode: targetCode,
        user: myUser
      }, (res) => {
        if (res && res.success) {
          setRoomCode(res.roomCode);
          setRole('partner');
          if (res.roomData?.host) {
            setPartner(res.roomData.host);
            if (partnerAvatarRef.current) partnerAvatarRef.current.group.visible = true;
          }
          playSound('success');
        }
      });
    }

    const handleRoomReady = (data) => {
      if (data.host && data.partner) {
        const other = role === 'host' ? data.partner : data.host;
        setPartner(other);
        partnerNameRef.current = other?.name || 'Partner';
        if (partnerAvatarRef.current) {
          partnerAvatarRef.current.group.visible = true;
        }
        playSound('success');
        if (audioRef.current) audioRef.current.playChime(880, 'sine', 0.8);
        showToast(`Connected with ${other?.name || 'Partner'}! 💖`);
      }
    };

    const handlePlayerUpdated = ({ senderRole, playerState }) => {
      if (playerState) {
        remotePosRef.current = {
          ...remotePosRef.current,
          ...playerState
        };
        if (partnerAvatarRef.current) {
          partnerAvatarRef.current.group.visible = true;
        }
        setPartner(prev => prev || {
          id: senderRole === 'host' ? 'host' : 'partner',
          name: senderRole === 'host' ? 'Partner 1' : 'Partner 2'
        });
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
      }
    };

    const handlePartnerLeft = () => {
      setPartner(null);
      setIsHoldingHands(false);
      if (partnerAvatarRef.current) {
        partnerAvatarRef.current.group.visible = false;
      }
      showToast('Partner left the room');
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
    };
  }, [socket, initialRole]);

  // Clean unmount-only room leave
  useEffect(() => {
    return () => {
      if (socket && roomCodeRef.current) {
        socket.emit('couple_room_leave', { roomCode: roomCodeRef.current });
      }
    };
  }, [socket]);

  // Join Room by Code from Modal
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
        if (partnerAvatarRef.current) partnerAvatarRef.current.group.visible = true;
        playSound('success');
        showToast('Joined partner successfully! 💖');
        setShowInviteModal(false);
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
    showToast('Room Code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // =========================================================================
  // HIGH-PERFORMANCE 60FPS THREE.JS ENGINE (ZERO LAG & INSTANT SYNC)
  // =========================================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId = null;
    let isDisposed = false;
    let frameCount = 0;

    const isMobile = window.innerWidth < 900;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfdba74);
    scene.fog = new THREE.FogExp2(0xfdba74, 0.015);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.2, 350);
    camera.position.set(0, 10, 18);

    // 2. High-Performance Renderer (pixelRatio: 1.0 on mobile to guarantee smooth 60fps)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
      precision: isMobile ? 'mediump' : 'highp'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = false; // Disabled dynamic shadow map for 3x framerate boost
    container.appendChild(renderer.domElement);

    // 3. Lighting (Clean Sunset Lighting without heavy real-time shadows)
    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x0284c7, 0.95);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.3);
    sunLight.position.set(30, 45, 30);
    scene.add(sunLight);

    const heartGlowLight = new THREE.PointLight(0xf43f5e, 1.6, 25);
    heartGlowLight.position.set(0, 4, -15);
    scene.add(heartGlowLight);

    // 4. Low-Poly Optimized Terrain
    // Ocean Plane (16x16 segments)
    const oceanGeo = new THREE.PlaneGeometry(240, 240, 16, 16);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.5;
    scene.add(ocean);

    // Island Top (18 radial segments)
    const islandGeo = new THREE.CylinderGeometry(38, 43, 3.8, 18);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.85,
      flatShading: true
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = 1;
    scene.add(island);

    // Beach Sand Rim
    const beachGeo = new THREE.RingGeometry(35, 45, 18);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 1.05;
    scene.add(beach);

    // Hill Plateau
    const hillGeo = new THREE.CylinderGeometry(12, 16, 6, 12);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85, flatShading: true });
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(-14, 5, -14);
    scene.add(hill);

    // Lovers' Gazebo
    const gazeboGroup = new THREE.Group();
    gazeboGroup.position.set(-14, 8, -14);
    const roofGeo = new THREE.ConeGeometry(4, 2.5, 6);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3;
    gazeboGroup.add(roof);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 6);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xffedd5 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(Math.cos(angle) * 3, 1.5, Math.sin(angle) * 3);
      gazeboGroup.add(pole);
    }
    scene.add(gazeboGroup);

    // Dual Pressure Pads
    const pad1Geo = new THREE.CylinderGeometry(1.6, 1.7, 0.25, 16);
    const pad1Mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 });
    const pad1 = new THREE.Mesh(pad1Geo, pad1Mat);
    pad1.position.set(-3.5, 3.1, 4);
    scene.add(pad1);

    const pad2Geo = new THREE.CylinderGeometry(1.6, 1.7, 0.25, 16);
    const pad2Mat = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xbe185d, emissiveIntensity: 0.6 });
    const pad2 = new THREE.Mesh(pad2Geo, pad2Mat);
    pad2.position.set(3.5, 3.1, 4);
    scene.add(pad2);

    // 5 Collectible Crystals
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
      emissiveIntensity: 0.8
    });

    crystalPositions.forEach((pos, idx) => {
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.copy(pos);
      crystal.userData = { id: idx, collected: false };
      scene.add(crystal);
      crystalMeshes.push(crystal);
    });

    // 5. Stylized 3D Avatar Creation with Sprite Nametag
    const createNametagSprite = (nameText, isPartner = false) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = isPartner ? 'rgba(190, 24, 93, 0.92)' : 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(6, 6, 244, 52, 14);
      else ctx.rect(6, 6, 244, 52);
      ctx.fill();
      ctx.strokeStyle = isPartner ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameText, 128, 32);
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(2.8, 0.7, 1);
      sprite.position.y = 3.35;
      return sprite;
    };

    const createPlayerAvatar = (colorHex, nameText = 'Player', isPartner = false) => {
      const playerGroup = new THREE.Group();

      // Body
      const bodyGeo = new THREE.CylinderGeometry(0.45, 0.5, 1.1, 10);
      const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.1;
      playerGroup.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.38, 12, 12);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.95;
      playerGroup.add(head);

      // Cap
      const capGeo = new THREE.SphereGeometry(0.4, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: isPartner ? 0xbe185d : 0x1e293b });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.05;
      playerGroup.add(cap);

      // Floating Aura
      const heartGeo = new THREE.OctahedronGeometry(0.32, 0);
      const heartMat = new THREE.MeshStandardMaterial({
        color: isPartner ? 0xff1493 : 0x38bdf8,
        emissive: isPartner ? 0xff69b4 : 0x0284c7,
        emissiveIntensity: 0.8
      });
      const floatingHeart = new THREE.Mesh(heartGeo, heartMat);
      floatingHeart.position.y = 2.75;
      playerGroup.add(floatingHeart);

      // Nametag
      const nametag = createNametagSprite(nameText, isPartner);
      playerGroup.add(nametag);

      // Legs
      const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.2, 0.3, 0);
      playerGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.2, 0.3, 0);
      playerGroup.add(rightLeg);

      scene.add(playerGroup);
      return { group: playerGroup, floatingHeart, leftLeg, rightLeg, nametag };
    };

    // A. Create Local Avatar (Cyan/Host or Rose/Partner)
    const localColor = role === 'host' ? 0x38bdf8 : 0xec4899;
    const localAvatar = createPlayerAvatar(localColor, user?.displayName || user?.username || 'You', false);
    localAvatar.group.position.set(role === 'host' ? -2 : 2, 3.0, 0);

    // B. Create Dedicated Partner Avatar (GUARANTEED VISIBILITY IN 3D WORLD)
    const partnerColor = role === 'host' ? 0xec4899 : 0x38bdf8;
    const partnerAvatar = createPlayerAvatar(partnerColor, `💖 ${partnerNameRef.current || 'Partner'}`, true);
    partnerAvatar.group.position.set(role === 'host' ? 2 : -2, 3.0, 0);
    // Visible if partner data exists or becomes visible on sync/join
    partnerAvatar.group.visible = Boolean(partner);
    partnerAvatarRef.current = partnerAvatar;

    // C. Multiplayer World Explorers Map
    const spawnOtherPlayer = (playerInfo) => {
      const sId = playerInfo.socketId;
      if (!sId || sId === socket?.id || remotePlayersMapRef.current.has(sId)) return;

      // If this player is our room partner, ensure partner avatar is visible
      if (roomCode && playerInfo.roomCode === roomCode) {
        partnerAvatar.group.visible = true;
        return;
      }

      // Other island explorers
      const otherAvatar = createPlayerAvatar(0x8b5cf6, `👤 ${playerInfo.name || 'Explorer'}`, false);
      otherAvatar.group.position.set(playerInfo.x || 0, playerInfo.y || 3.0, playerInfo.z || 0);

      remotePlayersMapRef.current.set(sId, {
        ...otherAvatar,
        targetPos: {
          x: playerInfo.x || 0,
          y: playerInfo.y || 3.0,
          z: playerInfo.z || 0,
          rot: playerInfo.rot || 0,
          isMoving: false
        }
      });
    };

    const handleIslandWorldPlayers = (players) => {
      if (Array.isArray(players)) {
        players.forEach(p => spawnOtherPlayer(p));
      }
    };

    const handleIslandPlayerJoined = (playerInfo) => {
      spawnOtherPlayer(playerInfo);
      if (roomCode && playerInfo.roomCode === roomCode) {
        partnerAvatar.group.visible = true;
      }
    };

    const handleIslandPlayerMoved = ({ socketId, roomCode: senderRoom, playerState }) => {
      // If it's from our partner, update partner position immediately
      if (roomCode && senderRoom === roomCode) {
        remotePosRef.current = {
          ...remotePosRef.current,
          ...playerState
        };
        partnerAvatar.group.visible = true;
        return;
      }

      // Other island explorer
      const remote = remotePlayersMapRef.current.get(socketId);
      if (remote && playerState) {
        remote.targetPos.x = playerState.x;
        remote.targetPos.y = playerState.y;
        remote.targetPos.z = playerState.z;
        remote.targetPos.rot = playerState.rot;
        remote.targetPos.isMoving = Boolean(playerState.isMoving);
      }
    };

    const handleIslandPlayerLeft = ({ socketId }) => {
      const remote = remotePlayersMapRef.current.get(socketId);
      if (remote) {
        scene.remove(remote.group);
        remotePlayersMapRef.current.delete(socketId);
      }
    };

    if (socket) {
      socket.emit('island_world_join', {
        user: {
          id: user?.id || user?._id || 'user',
          name: user?.displayName || user?.username || 'Explorer',
          avatar: user?.avatar || ''
        },
        roomCode,
        role
      });

      socket.on('island_world_players', handleIslandWorldPlayers);
      socket.on('island_player_joined', handleIslandPlayerJoined);
      socket.on('island_player_moved', handleIslandPlayerMoved);
      socket.on('island_player_left', handleIslandPlayerLeft);
    }

    // 6. Keyboard, Mouse Wheel & Touch Controls
    const keys = { w: false, a: false, s: false, d: false, space: false };

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

    // Orbit Drag
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

    // Wheel Zoom
    const handleWheel = (e) => {
      e.preventDefault();
      zoomDistRef.current = Math.max(6, Math.min(30, zoomDistRef.current + e.deltaY * 0.02));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Touch Pinch Zoom (2 fingers)
    let initialPinch = null;
    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialPinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && initialPinch) {
        const curPinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (initialPinch - curPinch) * 0.04;
        zoomDistRef.current = Math.max(6, Math.min(30, zoomDistRef.current + delta));
        initialPinch = curPinch;
      }
    };
    const handleTouchEnd = () => { initialPinch = null; };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Visibility Handling
    let isVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !animId && !isDisposed) {
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Silky Smooth 60FPS Game Loop
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
      frameCount++;

      // Player Movement
      let moveX = 0;
      let moveZ = 0;
      if (keys.w) moveZ -= 1;
      if (keys.s) moveZ += 1;
      if (keys.a) moveX -= 1;
      if (keys.d) moveX += 1;

      if (window.__coupleJoystick) {
        moveX += window.__coupleJoystick.x;
        moveZ += window.__coupleJoystick.y;
      }

      const inputLen = Math.hypot(moveX, moveZ);
      const isMoving = inputLen > 0.05;

      if (isMoving) {
        const speed = 7.5;
        const normX = moveX / inputLen;
        const normZ = moveZ / inputLen;

        const worldX = normX * Math.cos(cameraAngle) - normZ * Math.sin(cameraAngle);
        const worldZ = normX * Math.sin(cameraAngle) + normZ * Math.cos(cameraAngle);

        localAvatar.group.position.x += worldX * speed * dt;
        localAvatar.group.position.z += worldZ * speed * dt;
        localAvatar.group.rotation.y = Math.atan2(worldX, worldZ);

        walkCycle += dt * 14;
        localAvatar.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
        localAvatar.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
      } else {
        localAvatar.leftLeg.rotation.x = 0;
        localAvatar.rightLeg.rotation.x = 0;
      }

      // Jump
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

      // Boundary clamp
      const distFromCenter = Math.hypot(localAvatar.group.position.x, localAvatar.group.position.z);
      if (distFromCenter > 34) {
        const ratio = 34 / distFromCenter;
        localAvatar.group.position.x *= ratio;
        localAvatar.group.position.z *= ratio;
      }

      // Floating Aura Rotation
      const t = currentTime * 0.003;
      localAvatar.floatingHeart.rotation.y = t * 2;
      partnerAvatar.floatingHeart.rotation.y = -t * 2;

      // Crystals
      crystalMeshes.forEach(c => {
        if (!c.userData.collected) {
          c.rotation.y += dt * 2.0;
          const dLocal = localAvatar.group.position.distanceTo(c.position);
          if (dLocal < 2.0) {
            c.userData.collected = true;
            c.visible = false;
            setCrystalsCount(prev => {
              const next = prev + 1;
              if (socket && roomCode) {
                socket.emit('couple_action_sync', {
                  roomCode,
                  actionType: 'crystal_collect',
                  payload: { count: next }
                });
              }
              return next;
            });
            if (audioRef.current) audioRef.current.playCrystalCollect();
          }
        }
      });

      // Smooth Camera Follow with Dynamic Zoom
      const curZoom = zoomDistRef.current;
      const camHeight = (curZoom / 14) * 7.5;
      const targetCamX = localAvatar.group.position.x + Math.sin(cameraAngle) * curZoom;
      const targetCamZ = localAvatar.group.position.z + Math.cos(cameraAngle) * curZoom;
      camera.position.x += (targetCamX - camera.position.x) * 0.15;
      camera.position.y += (localAvatar.group.position.y + camHeight - camera.position.y) * 0.15;
      camera.position.z += (targetCamZ - camera.position.z) * 0.15;
      camera.lookAt(localAvatar.group.position.x, localAvatar.group.position.y + 1.2, localAvatar.group.position.z);

      // Interpolate Partner Avatar smoothly
      if (partnerAvatar.group.visible) {
        partnerAvatar.group.position.x += (remotePosRef.current.x - partnerAvatar.group.position.x) * 0.25;
        partnerAvatar.group.position.y += (remotePosRef.current.y - partnerAvatar.group.position.y) * 0.25;
        partnerAvatar.group.position.z += (remotePosRef.current.z - partnerAvatar.group.position.z) * 0.25;
        partnerAvatar.group.rotation.y += (remotePosRef.current.rot - partnerAvatar.group.rotation.y) * 0.25;

        if (remotePosRef.current.isMoving) {
          partnerAvatar.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
          partnerAvatar.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
        } else {
          partnerAvatar.leftLeg.rotation.x = 0;
          partnerAvatar.rightLeg.rotation.x = 0;
        }
      }

      // Interpolate other explorers on the island
      remotePlayersMapRef.current.forEach((remote) => {
        remote.group.position.x += (remote.targetPos.x - remote.group.position.x) * 0.25;
        remote.group.position.y += (remote.targetPos.y - remote.group.position.y) * 0.25;
        remote.group.position.z += (remote.targetPos.z - remote.group.position.z) * 0.25;
        remote.group.rotation.y += (remote.targetPos.rot - remote.group.rotation.y) * 0.25;

        if (remote.targetPos.isMoving) {
          remote.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
          remote.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
        } else {
          remote.leftLeg.rotation.x = 0;
          remote.rightLeg.rotation.x = 0;
        }
      });

      // Emit Real-time Sync (30Hz) - Dual Channel (Direct Room + Island World)
      if (socket && currentTime - lastSyncTimeRef.current > 33) {
        lastSyncTimeRef.current = currentTime;
        const pState = {
          x: localAvatar.group.position.x,
          y: localAvatar.group.position.y,
          z: localAvatar.group.position.z,
          rot: localAvatar.group.rotation.y,
          isMoving
        };

        if (roomCode) {
          socket.emit('couple_player_sync', {
            roomCode,
            playerState: pState
          });
        }
        socket.emit('island_player_sync', {
          playerState: pState
        });
      }

      // Draw Radar Minimap (Throttled to every 6th frame to eliminate canvas overhead)
      if (frameCount % 6 === 0) {
        const minimap = minimapCanvasRef.current;
        if (minimap) {
          const mCtx = minimap.getContext('2d');
          const mw = minimap.width;
          const mh = minimap.height;
          const center = mw / 2;
          const scale = (mw / 2 - 4) / 38;

          mCtx.clearRect(0, 0, mw, mh);

          // Island base
          mCtx.beginPath();
          mCtx.arc(center, center, 36 * scale, 0, Math.PI * 2);
          mCtx.fillStyle = 'rgba(34, 197, 94, 0.45)';
          mCtx.fill();
          mCtx.lineWidth = 2.5;
          mCtx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
          mCtx.stroke();

          // Gazebo
          mCtx.beginPath();
          mCtx.arc(center + (-14 * scale), center + (-14 * scale), 3.5, 0, Math.PI * 2);
          mCtx.fillStyle = '#f59e0b';
          mCtx.fill();

          // Partner dot (Glowing Pink)
          if (partnerAvatar.group.visible) {
            const prx = center + (partnerAvatar.group.position.x * scale);
            const prz = center + (partnerAvatar.group.position.z * scale);
            mCtx.beginPath();
            mCtx.arc(prx, prz, 5, 0, Math.PI * 2);
            mCtx.fillStyle = '#ec4899';
            mCtx.fill();
            mCtx.lineWidth = 1.5;
            mCtx.strokeStyle = '#ffffff';
            mCtx.stroke();
          }

          // Other explorers (Violet)
          remotePlayersMapRef.current.forEach((remote) => {
            const rx = center + (remote.group.position.x * scale);
            const rz = center + (remote.group.position.z * scale);
            mCtx.beginPath();
            mCtx.arc(rx, rz, 3, 0, Math.PI * 2);
            mCtx.fillStyle = '#8b5cf6';
            mCtx.fill();
          });

          // Local player dot with heading pointer (Cyan)
          const px = center + (localAvatar.group.position.x * scale);
          const pz = center + (localAvatar.group.position.z * scale);
          mCtx.beginPath();
          mCtx.arc(px, pz, 4.5, 0, Math.PI * 2);
          mCtx.fillStyle = '#38bdf8';
          mCtx.fill();
          mCtx.lineWidth = 1.5;
          mCtx.strokeStyle = '#ffffff';
          mCtx.stroke();
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
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
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (socket) {
        socket.emit('island_world_leave');
        socket.off('island_world_players', handleIslandWorldPlayers);
        socket.off('island_player_joined', handleIslandPlayerJoined);
        socket.off('island_player_moved', handleIslandPlayerMoved);
        socket.off('island_player_left', handleIslandPlayerLeft);
      }

      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [roomCode, role, user, socket]);

  // Touch handlers
  const handleJoystickMove = (e) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (touch.clientX - cx) / (rect.width / 2);
    const dy = (touch.clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    window.__coupleJoystick = {
      x: len > 1 ? dx / len : dx,
      y: len > 1 ? dy / len : dy
    };
  };

  const handleJoystickEnd = () => {
    window.__coupleJoystick = null;
  };

  const triggerJump = () => {
    window.__coupleJumpTrigger = true;
  };

  const toggleHoldHands = () => {
    const next = !isHoldingHands;
    setIsHoldingHands(next);
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'hold_hands',
        payload: { active: next }
      });
    }
  };

  const sendEmote = (em) => {
    setActiveEmote(em);
    setShowEmotePicker(false);
    playSound('pop');
    if (socket && roomCode) {
      socket.emit('couple_action_sync', {
        roomCode,
        actionType: 'emote',
        payload: { emote: em }
      });
    }
    setTimeout(() => setActiveEmote(null), 3500);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      position: 'fixed',
      inset: 0,
      background: '#090d16',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: 99999
    }}>
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          position: 'relative',
          cursor: 'grab'
        }}
      />

      {/* TOP MINIMALIST GAMING HUD (CLEAN ICONS, ZERO OVERLAPPING TEXT) */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
        pointerEvents: 'none'
      }}>
        {/* Left Side: Exit, Room Code / Invite Button, Fullscreen, Minimap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          <button
            onClick={onBack}
            title="Exit Game"
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <ArrowLeft size={18} />
          </button>

          {/* Clean Room Pill: Replaces the big bottom card */}
          {roomCode && (
            <button
              onClick={() => setShowInviteModal(true)}
              title="Tap to Invite Partner / Enter Code"
              style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
                border: '1.5px solid rgba(244, 63, 94, 0.7)',
                color: '#fff',
                borderRadius: '20px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 900,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)'
              }}
            >
              <Users size={14} color="#f43f5e" />
              <span>{roomCode}</span>
            </button>
          )}

          {/* Fullscreen / Landscape Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Landscape Fullscreen"
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(prev => !prev)}
            title="Toggle Minimap Radar"
            style={{
              background: showMinimap ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.88)',
              border: showMinimap ? '1.5px solid #38bdf8' : '1.5px solid rgba(255, 255, 255, 0.25)',
              color: showMinimap ? '#38bdf8' : '#fff',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Compass size={17} />
          </button>
        </div>

        {/* Right Side: Free Fire Mic (Icon ONLY - Zero Text) */}
        <div style={{ pointerEvents: 'auto' }}>
          {roomCode ? (
            <GameVoiceChat
              chatId={`couple_${roomCode}`}
              partnerName={partner?.name || (role === 'host' ? 'Partner 2' : 'Partner 1')}
              partnerId={partner?.id || null}
              iconOnly={true}
            />
          ) : null}
        </div>
      </div>

      {/* CIRCULAR RADAR MINIMAP (TOP RIGHT, BELOW MIC) */}
      {showMinimap && (
        <div style={{
          position: 'absolute',
          top: '64px',
          right: '14px',
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid rgba(56, 189, 248, 0.6)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 40,
          pointerEvents: 'none'
        }}>
          <canvas
            ref={minimapCanvasRef}
            width={90}
            height={90}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      )}

      {/* DYNAMIC ZOOM BUTTONS (+ AND - ON RIGHT SIDE) */}
      <div style={{
        position: 'absolute',
        right: '14px',
        top: '168px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 45
      }}>
        <button
          onClick={handleZoomIn}
          title="Zoom In (Close Camera)"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)'
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out (Tactical View)"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)'
          }}
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* MOBILE PORTRAIT ROTATE TO LANDSCAPE REMINDER */}
      {isPortrait && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(245, 158, 11, 0.6)',
          borderRadius: '16px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 60,
          boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          maxWidth: '92%'
        }}>
          <RotateCw size={15} color="#f59e0b" className="animate-spin" />
          <span style={{ fontSize: '0.74rem', color: '#fef08a', fontWeight: 800 }}>
            Rotate sideways for Landscape mode
          </span>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '0.72rem',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            Landscape ⛶
          </button>
        </div>
      )}

      {/* MOBILE TOUCH VIRTUAL JOYSTICK & ACTION BUTTONS (NO OVERLAPPING CARDS) */}
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
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '2px dashed rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            touchAction: 'none'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)'
          }} />
        </div>

        {/* Action Buttons: Hold Hands, Emote, Jump (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
          <button
            onClick={toggleHoldHands}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isHoldingHands
                ? 'linear-gradient(135deg, #f43f5e, #be185d)'
                : 'rgba(15, 23, 42, 0.85)',
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
            <Heart size={18} fill={isHoldingHands ? '#fff' : 'none'} />
            <span style={{ fontSize: '0.52rem', fontWeight: 900 }}>Hold</span>
          </button>

          {/* Emote Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowEmotePicker(prev => !prev)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}
            >
              <Smile size={19} />
            </button>

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
              width: '58px',
              height: '58px',
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

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff',
          padding: '8px 20px',
          borderRadius: '24px',
          fontWeight: 800,
          fontSize: '0.84rem',
          zIndex: 100,
          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.6)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {toastMessage}
        </div>
      )}

      {/* IN-GAME INVITE / ROOM CODE MODAL (CLEAN POPUP) */}
      {showInviteModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 90,
          padding: '16px'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1.5px solid rgba(244, 63, 94, 0.5)',
            borderRadius: '20px',
            padding: '20px',
            maxWidth: '380px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Heart size={16} color="#f43f5e" fill="#f43f5e" /> Invite Your Partner
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#fda4af', fontWeight: 700 }}>ROOM CODE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>{roomCode}</div>
              </div>
              <button
                onClick={copyRoomCode}
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}
              >
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleShareLink}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Share2 size={13} /> Share Link
              </button>
              <button
                onClick={handleShareInChat}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <MessageSquare size={13} /> In Chat
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Join other Room Code..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleJoinByCode}
                disabled={isConnecting || !inputCode.trim()}
                style={{
                  background: 'linear-gradient(135deg, #f43f5e, #be185d)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
