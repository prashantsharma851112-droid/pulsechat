/**
 * ChessBoard3D.jsx
 * Full 3D WebGL Chessboard built with Three.js.
 * Features Staunton-style 3D pieces, smooth parabolic move animations,
 * dynamic move/capture highlights, check warning glow, camera orbit & flip,
 * and graceful fallback to 2D vector board on unsupported devices.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import ChessBoard2D from './ChessBoard2D';

// Board dimension constants (in 3D units)
const TILE_SIZE = 1.0;
const BOARD_OFFSET = 3.5 * TILE_SIZE; // Centers board at (0, 0, 0)
const PIECE_SCALE = 0.52;

/**
 * Creates reusable Staunton-style piece geometries using LatheGeometry & compound meshes.
 */
function createPieceGeometries() {
  const v2 = (x, y) => new THREE.Vector2(x, y);

  // 1. Pawn Profile
  const pawnPts = [
    v2(0, 0), v2(0.38, 0), v2(0.38, 0.08), v2(0.32, 0.14),
    v2(0.24, 0.2), v2(0.18, 0.5), v2(0.24, 0.65), v2(0.24, 0.72),
    v2(0.12, 0.74), v2(0.2, 0.95), v2(0, 1.1)
  ];
  const pawnGeo = new THREE.LatheGeometry(pawnPts, 24);

  // 2. Rook Profile
  const rookPts = [
    v2(0, 0), v2(0.42, 0), v2(0.42, 0.1), v2(0.35, 0.16),
    v2(0.28, 0.22), v2(0.25, 0.7), v2(0.36, 0.8), v2(0.36, 1.1),
    v2(0.24, 1.1), v2(0.24, 0.95), v2(0, 0.95)
  ];
  const rookGeo = new THREE.LatheGeometry(rookPts, 24);

  // 3. Knight Profile (Lathed base + stylized swept horse head)
  const knightBasePts = [
    v2(0, 0), v2(0.42, 0), v2(0.42, 0.1), v2(0.34, 0.18),
    v2(0.28, 0.26), v2(0.24, 0.45), v2(0, 0.45)
  ];
  const knightBaseGeo = new THREE.LatheGeometry(knightBasePts, 20);

  // 4. Bishop Profile
  const bishopPts = [
    v2(0, 0), v2(0.42, 0), v2(0.42, 0.1), v2(0.34, 0.16),
    v2(0.22, 0.25), v2(0.18, 0.7), v2(0.26, 0.82), v2(0.26, 0.88),
    v2(0.16, 0.92), v2(0.22, 1.15), v2(0.12, 1.35), v2(0.06, 1.42),
    v2(0, 1.48)
  ];
  const bishopGeo = new THREE.LatheGeometry(bishopPts, 24);

  // 5. Queen Profile
  const queenPts = [
    v2(0, 0), v2(0.45, 0), v2(0.45, 0.12), v2(0.36, 0.2),
    v2(0.24, 0.3), v2(0.19, 0.9), v2(0.28, 1.1), v2(0.32, 1.35),
    v2(0.22, 1.42), v2(0.08, 1.48), v2(0, 1.6)
  ];
  const queenGeo = new THREE.LatheGeometry(queenPts, 28);

  // 6. King Profile
  const kingPts = [
    v2(0, 0), v2(0.46, 0), v2(0.46, 0.12), v2(0.38, 0.2),
    v2(0.26, 0.32), v2(0.22, 1.0), v2(0.32, 1.2), v2(0.34, 1.42),
    v2(0.24, 1.5), v2(0.1, 1.55), v2(0, 1.62)
  ];
  const kingGeo = new THREE.LatheGeometry(kingPts, 28);

  return { pawnGeo, rookGeo, knightBaseGeo, bishopGeo, queenGeo, kingGeo };
}

/**
 * Creates 3D compound piece group.
 */
function buildPieceMesh(type, color, geometries, materials) {
  const group = new THREE.Group();
  const mat = color === 'w' ? materials.whitePiece : materials.blackPiece;
  const goldTrim = materials.goldTrim;

  if (type === 'p') {
    const mesh = new THREE.Mesh(geometries.pawnGeo, mat);
    group.add(mesh);
  } else if (type === 'r') {
    const mesh = new THREE.Mesh(geometries.rookGeo, mat);
    group.add(mesh);
    // Crenellations (4 corner castle blocks on top)
    const blockGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12);
    const radius = 0.28;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const bMesh = new THREE.Mesh(blockGeo, mat);
      bMesh.position.set(Math.cos(angle) * radius, 1.12, Math.sin(angle) * radius);
      group.add(bMesh);
    }
  } else if (type === 'n') {
    const baseMesh = new THREE.Mesh(geometries.knightBaseGeo, mat);
    group.add(baseMesh);

    // Horse Head & Neck
    const neckGeo = new THREE.BoxGeometry(0.28, 0.52, 0.36);
    const neckMesh = new THREE.Mesh(neckGeo, mat);
    neckMesh.position.set(0, 0.65, -0.04);
    neckMesh.rotation.x = -0.22;
    group.add(neckMesh);

    // Muzzle / Snout
    const muzzleGeo = new THREE.BoxGeometry(0.24, 0.26, 0.38);
    const muzzleMesh = new THREE.Mesh(muzzleGeo, mat);
    muzzleMesh.position.set(0, 0.74, 0.16);
    muzzleMesh.rotation.x = 0.26;
    group.add(muzzleMesh);

    // Mane / Ears
    const earGeo = new THREE.ConeGeometry(0.06, 0.18, 4);
    const leftEar = new THREE.Mesh(earGeo, mat);
    leftEar.position.set(-0.08, 0.98, -0.12);
    leftEar.rotation.x = -0.15;
    const rightEar = new THREE.Mesh(earGeo, mat);
    rightEar.position.set(0.08, 0.98, -0.12);
    rightEar.rotation.x = -0.15;
    group.add(leftEar, rightEar);

    // Turn black knight forward (face south)
    if (color === 'b') {
      group.rotation.y = Math.PI;
    }
  } else if (type === 'b') {
    const mesh = new THREE.Mesh(geometries.bishopGeo, mat);
    group.add(mesh);
    // Gold cross-cut collar
    const ringGeo = new THREE.TorusGeometry(0.14, 0.024, 8, 20);
    const ringMesh = new THREE.Mesh(ringGeo, goldTrim);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.88;
    group.add(ringMesh);
  } else if (type === 'q') {
    const mesh = new THREE.Mesh(geometries.queenGeo, mat);
    group.add(mesh);
    // Queen's coronet finial ball
    const ballGeo = new THREE.SphereGeometry(0.075, 14, 14);
    const ballMesh = new THREE.Mesh(ballGeo, goldTrim);
    ballMesh.position.y = 1.64;
    group.add(ballMesh);
  } else if (type === 'k') {
    const mesh = new THREE.Mesh(geometries.kingGeo, mat);
    group.add(mesh);
    // King's Cross on top
    const vertGeo = new THREE.BoxGeometry(0.06, 0.26, 0.06);
    const horizGeo = new THREE.BoxGeometry(0.2, 0.06, 0.06);
    const vCross = new THREE.Mesh(vertGeo, goldTrim);
    vCross.position.y = 1.76;
    const hCross = new THREE.Mesh(horizGeo, goldTrim);
    hCross.position.y = 1.8;
    group.add(vCross, hCross);
  }

  group.scale.set(PIECE_SCALE, PIECE_SCALE, PIECE_SCALE);
  group.castShadow = true;
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

export default function ChessBoard3D({
  boardGrid,
  selectedSquare,
  legalMoves = [],
  lastMove = null,
  inCheckSquare = null,
  isFlipped = false,
  onSquareClick,
  disabled = false
}) {
  const containerRef = useRef(null);
  const [webglSupported, setWebglSupported] = useState(true);

  // Scene & Three.js instance refs
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const pieceMeshMapRef = useRef(new Map()); // square -> MeshGroup
  const tileMeshesRef = useRef([]);
  const highlightGroupRef = useRef(null);
  const animatingMovesRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const cameraRotationRef = useRef({ theta: 0, phi: 0.82 }); // Polar angles for orbit

  // Square coordinates to 3D position
  const squareToPosition = useCallback((square, flipped) => {
    if (!square || square.length < 2) return new THREE.Vector3(0, 0, 0);
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0..7
    const rank = parseInt(square[1], 10) - 1; // 0..7

    const x = flipped ? (7 - file) * TILE_SIZE - BOARD_OFFSET : file * TILE_SIZE - BOARD_OFFSET;
    const z = flipped ? rank * TILE_SIZE - BOARD_OFFSET : (7 - rank) * TILE_SIZE - BOARD_OFFSET;

    return new THREE.Vector3(x, 0.12, z);
  }, []);

  // 3D position to square coordinates
  const positionToSquare = useCallback((pos, flipped) => {
    const rawX = pos.x + BOARD_OFFSET + TILE_SIZE / 2;
    const rawZ = pos.z + BOARD_OFFSET + TILE_SIZE / 2;

    let fileIdx = Math.floor(rawX / TILE_SIZE);
    let rankIdx = 7 - Math.floor(rawZ / TILE_SIZE);

    if (flipped) {
      fileIdx = 7 - fileIdx;
      rankIdx = 7 - rankIdx;
    }

    if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;

    const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
    const rank = rankIdx + 1;
    return `${file}${rank}`;
  }, []);

  // --- INITIALIZE THREE.JS SCENE ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL capability safely
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 480;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn('WebGL initialization failed, falling back to 2D:', e);
      setWebglSupported(false);
      return;
    }

    // 4. Lighting (Soft Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7e6, 1.8);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xb0d6ff, 0.8);
    fillLight.position.set(-6, 8, -6);
    scene.add(fillLight);

    // 5. Board Base & Frame
    const baseGeo = new THREE.BoxGeometry(8.9, 0.35, 8.9);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 0.65, metalness: 0.2 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.18;
    baseMesh.receiveShadow = true;
    scene.add(baseMesh);

    // Bevel Rim Frame
    const frameGeo = new THREE.BoxGeometry(8.4, 0.22, 8.4);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d2116, roughness: 0.5, metalness: 0.3 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = -0.08;
    frameMesh.receiveShadow = true;
    scene.add(frameMesh);

    // 6. Board Tiles (64 Squares)
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.99, 0.12, TILE_SIZE * 0.99);
    const lightTileMat = new THREE.MeshStandardMaterial({ color: 0xebecd0, roughness: 0.32, metalness: 0.08 });
    const darkTileMat = new THREE.MeshStandardMaterial({ color: 0x739552, roughness: 0.38, metalness: 0.08 });

    const tiles = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 !== 0;
        const mesh = new THREE.Mesh(tileGeo, isLight ? lightTileMat : darkTileMat);
        mesh.position.set(c * TILE_SIZE - BOARD_OFFSET, 0, (7 - r) * TILE_SIZE - BOARD_OFFSET);
        mesh.receiveShadow = true;
        scene.add(mesh);
        tiles.push(mesh);
      }
    }
    tileMeshesRef.current = tiles;

    // 7. Dynamic Highlight Markers Group
    const highlightGroup = new THREE.Group();
    scene.add(highlightGroup);
    highlightGroupRef.current = highlightGroup;

    // 8. Shared Piece Geometries & Materials
    const pieceGeometries = createPieceGeometries();
    const pieceMaterials = {
      whitePiece: new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.2, metalness: 0.14 }),
      blackPiece: new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.28, metalness: 0.22 }),
      goldTrim: new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 })
    };
    scene.pieceGeometries = pieceGeometries;
    scene.pieceMaterials = pieceMaterials;

    // 9. Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation & Render Loop
    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Process any active move transitions
      const anims = animatingMovesRef.current;
      if (anims.length > 0) {
        const now = performance.now();
        for (let i = anims.length - 1; i >= 0; i--) {
          const a = anims[i];
          const progress = Math.min(1, (now - a.startTime) / a.duration);
          // Parabolic lift arc
          const currentPos = new THREE.Vector3().lerpVectors(a.fromPos, a.toPos, progress);
          const arcHeight = Math.sin(progress * Math.PI) * 0.85;
          currentPos.y += arcHeight;
          a.mesh.position.copy(currentPos);

          if (progress >= 1) {
            a.mesh.position.copy(a.toPos);
            anims.splice(i, 1);
            if (a.onComplete) a.onComplete();
          }
        }
      }

      // Update camera position based on orbit polar angles
      const radius = 12.8;
      const theta = cameraRotationRef.current.theta;
      const phi = cameraRotationRef.current.phi;

      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0.4, 0);

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);

      // Dispose Geometries & Materials cleanly
      try {
        Object.values(pieceGeometries).forEach(g => g.dispose && g.dispose());
        Object.values(pieceMaterials).forEach(m => m.dispose && m.dispose());
        tileGeo.dispose();
        baseGeo.dispose();
        frameGeo.dispose();
        lightTileMat.dispose();
        darkTileMat.dispose();
        baseMat.dispose();
        frameMat.dispose();
        renderer.dispose();
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      } catch (_) {}
    };
  }, []);

  // --- CAMERA ORIENTATION UPDATE WHEN FLIPPED ---
  useEffect(() => {
    // When orientation flips, rotate camera angle smoothly to opposite side
    const targetTheta = isFlipped ? Math.PI : 0;
    cameraRotationRef.current.theta = targetTheta;
  }, [isFlipped]);

  // --- RECONCILE BOARD PIECES ON GRID CHANGE ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.pieceGeometries || !boardGrid) return;

    const currentMap = pieceMeshMapRef.current;
    const newPositions = new Map();

    // Map current grid to square keys
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardGrid[r][c];
        if (piece) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          const square = `${file}${rank}`;
          newPositions.set(square, piece);
        }
      }
    }

    // 1. Remove pieces that no longer exist
    currentMap.forEach((mesh, sq) => {
      const newPiece = newPositions.get(sq);
      if (!newPiece || newPiece.type !== mesh.pieceType || newPiece.color !== mesh.pieceColor) {
        scene.remove(mesh);
        currentMap.delete(sq);
      }
    });

    // 2. Add or update pieces
    newPositions.forEach((piece, sq) => {
      const targetPos = squareToPosition(sq, isFlipped);
      let mesh = currentMap.get(sq);

      if (!mesh || mesh.pieceType !== piece.type || mesh.pieceColor !== piece.color) {
        if (mesh) scene.remove(mesh);
        mesh = buildPieceMesh(piece.type, piece.color, scene.pieceGeometries, scene.pieceMaterials);
        mesh.pieceType = piece.type;
        mesh.pieceColor = piece.color;
        mesh.currentSquare = sq;
        mesh.position.copy(targetPos);
        scene.add(mesh);
        currentMap.set(sq, mesh);
      } else {
        mesh.position.copy(targetPos);
      }
    });
  }, [boardGrid, isFlipped, squareToPosition]);

  // --- RENDER DYNAMIC 3D HIGHLIGHTS (Selection, Moves, Captures, Check) ---
  useEffect(() => {
    const highlightGroup = highlightGroupRef.current;
    if (!highlightGroup) return;

    // Clear previous highlight markers
    while (highlightGroup.children.length > 0) {
      const obj = highlightGroup.children[0];
      highlightGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    // 1. Selected Piece Glow Halo
    if (selectedSquare) {
      const pos = squareToPosition(selectedSquare, isFlipped);
      const ringGeo = new THREE.RingGeometry(0.32, 0.46, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(pos.x, 0.08, pos.z);
      highlightGroup.add(ringMesh);
    }

    // 2. Legal Move Indicators
    legalMoves.forEach(m => {
      const pos = squareToPosition(m.to, isFlipped);
      const isCapture = Boolean(m.captured);

      if (isCapture) {
        // Red target capture ring
        const capGeo = new THREE.RingGeometry(0.38, 0.46, 24);
        const capMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const capMesh = new THREE.Mesh(capGeo, capMat);
        capMesh.rotation.x = -Math.PI / 2;
        capMesh.position.set(pos.x, 0.085, pos.z);
        highlightGroup.add(capMesh);
      } else {
        // Soft dot on empty square
        const dotGeo = new THREE.CircleGeometry(0.16, 20);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
        const dotMesh = new THREE.Mesh(dotGeo, dotMat);
        dotMesh.rotation.x = -Math.PI / 2;
        dotMesh.position.set(pos.x, 0.085, pos.z);
        highlightGroup.add(dotMesh);
      }
    });

    // 3. Last Move Highlights
    if (lastMove) {
      const fromPos = squareToPosition(lastMove.from, isFlipped);
      const toPos = squareToPosition(lastMove.to, isFlipped);
      const planeGeo = new THREE.PlaneGeometry(0.96, 0.96);
      const lastMoveMat = new THREE.MeshBasicMaterial({ color: 0xf5f682, transparent: true, opacity: 0.32, side: THREE.DoubleSide });

      const fromMesh = new THREE.Mesh(planeGeo, lastMoveMat);
      fromMesh.rotation.x = -Math.PI / 2;
      fromMesh.position.set(fromPos.x, 0.07, fromPos.z);

      const toMesh = new THREE.Mesh(planeGeo, lastMoveMat);
      toMesh.rotation.x = -Math.PI / 2;
      toMesh.position.set(toPos.x, 0.07, toPos.z);

      highlightGroup.add(fromMesh, toMesh);
    }

    // 4. King Check Warning Red Aura
    if (inCheckSquare) {
      const kPos = squareToPosition(inCheckSquare, isFlipped);
      const checkGeo = new THREE.RingGeometry(0.2, 0.48, 32);
      const checkMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
      const checkMesh = new THREE.Mesh(checkGeo, checkMat);
      checkMesh.rotation.x = -Math.PI / 2;
      checkMesh.position.set(kPos.x, 0.09, kPos.z);
      highlightGroup.add(checkMesh);
    }
  }, [selectedSquare, legalMoves, lastMove, inCheckSquare, isFlipped, squareToPosition]);

  // --- POINTER / CLICK / RAYCAST INTERACTION ---
  const handlePointerDown = (e) => {
    isDraggingRef.current = false;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    prevPointerRef.current = { x: clientX, y: clientY, startX: clientX, startY: clientY };
  };

  const handlePointerMove = (e) => {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

    const dist = Math.hypot(clientX - prevPointerRef.current.startX, clientY - prevPointerRef.current.startY);
    if (dist > 8) {
      isDraggingRef.current = true;
      // Gentle orbit camera rotation
      const dx = clientX - prevPointerRef.current.x;
      const dy = clientY - prevPointerRef.current.y;

      cameraRotationRef.current.theta -= dx * 0.008;
      cameraRotationRef.current.phi = Math.max(0.4, Math.min(1.4, cameraRotationRef.current.phi - dy * 0.008));
    }

    prevPointerRef.current.x = clientX;
    prevPointerRef.current.y = clientY;
  };

  const handlePointerUp = (e) => {
    if (disabled || isDraggingRef.current) return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0;
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY) || 0;

    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Raycast against the 64 board tile meshes
    const intersects = raycaster.intersectObjects(tileMeshesRef.current);
    if (intersects.length > 0) {
      const hitTile = intersects[0].object;
      const hitSquare = positionToSquare(hitTile.position, isFlipped);
      if (hitSquare && onSquareClick) {
        onSquareClick(hitSquare);
      }
    }
  };

  // Graceful fallback to 2D board if WebGL is unsupported
  if (!webglSupported) {
    return (
      <ChessBoard2D
        boardGrid={boardGrid}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        inCheckSquare={inCheckSquare}
        isFlipped={isFlipped}
        onSquareClick={onSquareClick}
        disabled={disabled}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        width: '100%',
        maxWidth: '520px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'radial-gradient(circle, #1e2430 0%, #0d1117 100%)',
        boxShadow: '0 14px 38px rgba(0, 0, 0, 0.55)',
        border: '1.5px solid rgba(255, 255, 255, 0.1)',
        touchAction: 'none',
        cursor: 'grab'
      }}
    />
  );
}
