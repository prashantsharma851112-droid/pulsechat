import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  X, Camera, SwitchCamera, Image as ImageIcon, Music, Palette, Sparkles, 
  Send, Loader2, Type, Trash2, Smile, Disc, Check, FlipHorizontal, Sliders
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';
import MusicPickerModal from './MusicPickerModal';

const GRADIENTS = [
  { id: 'g1', name: 'Pulse Purple', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
  { id: 'g2', name: 'Cyber Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'g3', name: 'Mint Emerald', value: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'g4', name: 'Neon Rose', value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { id: 'g5', name: 'Midnight AMOLED', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' },
  { id: 'g6', name: 'Sunset Crimson', value: 'linear-gradient(135deg, #ff4e50 0%, #f9d423 100%)' },
  { id: 'g7', name: 'Royal Sapphire', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { id: 'g8', name: 'Cosmic Obsidian', value: 'linear-gradient(135deg, #0f0c29 0%, #24243e 100%)' }
];

const TEXT_STYLES_3D = [
  { id: 'none', label: 'Classic', class: '' },
  { id: 'text-3d-neon', label: '⚡ Neon', class: 'text-3d-neon' },
  { id: 'text-3d-gold', label: '👑 Gold', class: 'text-3d-gold' },
  { id: 'text-3d-flame', label: '🔥 Flame', class: 'text-3d-flame' },
  { id: 'text-3d-cosmic', label: '🔮 Cosmic', class: 'text-3d-cosmic' },
  { id: 'text-3d-diamond', label: '💎 Ice', class: 'text-3d-diamond' },
  { id: 'text-3d-candy', label: '🍭 Candy', class: 'text-3d-candy' },
  { id: 'text-3d-emerald', label: '❇️ Matrix', class: 'text-3d-emerald' },
  { id: 'text-3d-crimson', label: '🩸 Crimson', class: 'text-3d-crimson' }
];

const ANIMATED_BGS = [
  { id: 'none', label: 'Clean' },
  { id: 'matrix_code_live', label: '❇️ Matrix' },
  { id: 'starry_galaxy_live', label: '🌌 Stars' },
  { id: 'cyber_grid_live', label: '⚡ Grid' },
  { id: 'firefly_night_live', label: '💡 Firefly' },
  { id: 'love_hearts_live', label: '💖 Hearts' }
];

const STICKERS = ['🔥', '💖', '⚡', '👑', '🎵', '🌟', '🏆', '💎', '🎉', '🚀', '😍', '✨', '💯', '🌸', '😎'];

const compressImageToBase64 = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(event.target.result);
    };
    reader.onerror = () => resolve('');
  });
};

export default function CreateVibeModal({ onClose, onCreated }) {
  const { user, token } = useContext(AuthContext);

  // Mode: 'camera' | 'editor'
  const [viewMode, setViewMode] = useState('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const [hasCameraSupport, setHasCameraSupport] = useState(true);

  // Story Elements
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedGradientIndex, setSelectedGradientIndex] = useState(0);
  const [animatedBgIndex, setAnimatedBgIndex] = useState(0);
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [selectedSong, setSelectedSong] = useState(null);
  const [songStartTime, setSongStartTime] = useState(0);
  const [selectedStickers, setSelectedStickers] = useState([]);

  // Modals & Panels
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);

  // Drag Positions
  const [textPos, setTextPos] = useState({ x: 50, y: 48 });
  const [musicPos, setMusicPos] = useState({ x: 50, y: 22 });
  const [draggingElement, setDraggingElement] = useState(null);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cardRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewAudioRef = useRef(null);

  const selectedGradient = GRADIENTS[selectedGradientIndex % GRADIENTS.length].value;
  const animatedBg = ANIMATED_BGS[animatedBgIndex % ANIMATED_BGS.length].id;

  // Stop camera helper
  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start live camera
  const startCamera = useCallback(async (facing = facingMode) => {
    stopCameraStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraSupport(false);
      setViewMode('editor');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {}
      }
      setCameraActive(true);
      setHasCameraSupport(true);
    } catch (err) {
      console.warn('Camera stream could not start:', err);
      setHasCameraSupport(false);
      setCameraActive(false);
      // Fallback directly to story canvas
      setViewMode('editor');
    }
  }, [facingMode, stopCameraStream]);

  // Initial Camera Launch
  useEffect(() => {
    startCamera('user');
    return () => {
      stopCameraStream();
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
          previewAudioRef.current.currentTime = 0;
          previewAudioRef.current.src = '';
          previewAudioRef.current = null;
        } catch (e) {}
      }
      stopGlobalMusicAudio();
    };
  }, []);

  // Handle Close Modal
  const handleCloseModal = () => {
    stopCameraStream();
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
        previewAudioRef.current.src = '';
        previewAudioRef.current = null;
      } catch (e) {}
    }
    stopGlobalMusicAudio();
    onClose();
  };

  // Switch Camera Front / Back
  const handleToggleCameraFacing = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture Photo From Camera
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');

    // Mirror image for front selfie camera like Instagram
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setMediaUrl(dataUrl);
    stopCameraStream();
    setViewMode('editor');
  };

  // Handle Photo Pick from Gallery
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds limit.');
      return;
    }

    stopCameraStream();
    setError('');

    let uploadedUrl = null;
    if (token) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${BACKEND_URL}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrl = data.url;
        }
      } catch (err) {}
    }

    if (!uploadedUrl) {
      try {
        uploadedUrl = await compressImageToBase64(file);
      } catch (err) {}
    }

    if (uploadedUrl) {
      setMediaUrl(uploadedUrl);
      setViewMode('editor');
    }
  };

  // Preview Song Snippet
  const previewSongPart = (song, startTimeSec) => {
    if (!song) return;
    try {
      stopGlobalMusicAudio();
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
          previewAudioRef.current.currentTime = 0;
          previewAudioRef.current.src = '';
          previewAudioRef.current = null;
        } catch (e) {}
      }
      if (song.audioUrl && !song.audioUrl.includes('youtube')) {
        const audio = new Audio(song.audioUrl);
        const validTime = Number(startTimeSec);
        if (!isNaN(validTime) && isFinite(validTime) && validTime >= 0) {
          try { audio.currentTime = validTime; } catch (e) {}
        }
        audio.volume = 0.85;
        registerGlobalMusicAudio(audio);
        audio.play().catch(() => {});
        previewAudioRef.current = audio;
      }
    } catch (e) {}
  };

  // Dragging on the Canvas (Touch & Mouse)
  const handlePointerDown = (elementName, e) => {
    e.stopPropagation();
    setDraggingElement(elementName);
  };

  const handlePointerMove = (e) => {
    if (!draggingElement || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.max(10, Math.min(90, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(10, Math.min(90, Math.round(((clientY - rect.top) / rect.height) * 100)));

    if (draggingElement === 'text') setTextPos({ x, y });
    else if (draggingElement === 'music') setMusicPos({ x, y });
  };

  const handlePointerUp = () => {
    setDraggingElement(null);
  };

  // Toggle Sticker
  const handleToggleSticker = (st) => {
    setSelectedStickers(prev => 
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  // Retake or Clear Photo
  const handleRetake = () => {
    setMediaUrl('');
    setViewMode('camera');
    startCamera(facingMode);
  };

  // Submit Story to Backend & LocalStorage
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!caption.trim() && !mediaUrl && !selectedSong) {
      setError('Please add a photo, music, or text for your 24h Vibe.');
      return;
    }

    setSubmitting(true);
    setError('');

    const newVibe = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: user?.id || user?._id || 'local_user',
      username: user?.username || 'you',
      displayName: user?.displayName || user?.username || 'You',
      avatar: user?.avatar,
      caption: caption.trim(),
      mediaUrl: mediaUrl || null,
      soundtrack: selectedSong ? 'music_track' : 'lofi',
      songTitle: selectedSong ? selectedSong.songTitle : '',
      artistName: selectedSong ? selectedSong.artistName : '',
      albumArt: selectedSong ? selectedSong.albumArt : '',
      audioUrl: selectedSong ? selectedSong.audioUrl : '',
      youtubeId: selectedSong ? selectedSong.youtubeId : '',
      songStartTime: selectedSong ? (songStartTime || 0) : 0,
      bgGradient: selectedGradient,
      textStyle3D,
      animatedBg,
      textPos,
      musicPos,
      imagePos: { x: 50, y: 50 },
      imageFit: 'cover',
      imageZoom: 1.0,
      imageFilter: 'none',
      imageOpacity: 1.0,
      textSize: 1.3,
      textAlign: 'center',
      selectedStickers,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      views: [],
      sparksEarned: 0
    };

    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/vibes/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            caption: caption.trim(),
            mediaUrl: mediaUrl || null,
            soundtrack: selectedSong ? 'music_track' : 'lofi',
            songTitle: selectedSong ? selectedSong.songTitle : '',
            artistName: selectedSong ? selectedSong.artistName : '',
            albumArt: selectedSong ? selectedSong.albumArt : '',
            audioUrl: selectedSong ? selectedSong.audioUrl : '',
            youtubeId: selectedSong ? selectedSong.youtubeId : '',
            songStartTime: selectedSong ? (songStartTime || 0) : 0,
            bgGradient: selectedGradient,
            textStyle3D,
            animatedBg,
            textPos,
            musicPos,
            imagePos: { x: 50, y: 50 },
            imageFit: 'cover',
            imageZoom: 1.0,
            imageFilter: 'none',
            imageOpacity: 1.0,
            textSize: 1.3,
            textAlign: 'center',
            selectedStickers
          })
        });
      } catch (err) {
        console.warn('Network story sync offline, cached locally.');
      }
    }

    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      const existing = raw ? JSON.parse(raw) : [];
      existing.unshift(newVibe);
      localStorage.setItem('pulsechat_local_vibes', JSON.stringify(existing));
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));

    setSubmitting(false);
    if (onCreated) onCreated();
    handleCloseModal();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1350,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Hidden File Picker for Gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Main Container - Fullscreen on mobile, Instagram frame on desktop */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '100dvh',
          maxHeight: '920px',
          borderRadius: window.innerWidth > 500 ? '28px' : '0px',
          overflow: 'hidden',
          background: '#09090b',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          border: window.innerWidth > 500 ? '1px solid rgba(255,255,255,0.12)' : 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* =========================================================================
            SCREEN 1: INSTAGRAM LIVE CAMERA
        ========================================================================= */}
        {viewMode === 'camera' && (
          <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            {/* Live Camera Viewfinder Video */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />

            {/* Top Instagram Camera Toolbar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 20,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)'
              }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  border: 'none',
                  color: '#fff',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <X size={22} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Switch to Text/Canvas Mode */}
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setViewMode('editor');
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <Type size={16} color="#f59e0b" /> Text Story
                </button>

                {/* Flip Front / Back Camera Button */}
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    border: 'none',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                  title="Flip Camera"
                >
                  <SwitchCamera size={20} />
                </button>
              </div>
            </div>

            {/* Bottom Instagram Camera Controls */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px 24px 34px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '18px',
                zIndex: 20,
                background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)'
              }}
            >
              {/* Controls Row: Gallery - Shutter - Palette */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around'
                }}
              >
                {/* Gallery Picker Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    color: '#fff',
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'transform 0.15s ease'
                  }}
                  title="Choose from Gallery"
                >
                  <ImageIcon size={22} />
                </button>

                {/* Instagram Shutter Button */}
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '4px solid #ffffff',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(255,255,255,0.4)',
                    outline: 'none'
                  }}
                  title="Take Photo"
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#ffffff',
                      transition: 'transform 0.1s ease'
                    }}
                  />
                </button>

                {/* Flip Camera or Palette */}
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    color: '#fff',
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                  title="Flip Camera"
                >
                  <SwitchCamera size={22} />
                </button>
              </div>

              {/* Bottom Mode Indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <span
                  onClick={() => {
                    stopCameraStream();
                    setViewMode('editor');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    letterSpacing: '0.05em'
                  }}
                >
                  CREATE
                </span>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 900,
                    color: '#f59e0b',
                    letterSpacing: '0.05em',
                    textShadow: '0 0 10px rgba(245, 158, 11, 0.6)'
                  }}
                >
                  CAMERA
                </span>
                <span
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    letterSpacing: '0.05em'
                  }}
                >
                  GALLERY
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2: INSTAGRAM STORY CANVAS EDITOR
        ========================================================================= */}
        {viewMode === 'editor' && (
          <div
            ref={cardRef}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchEnd={handlePointerUp}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: mediaUrl ? '#000000' : selectedGradient,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              cursor: draggingElement ? 'grabbing' : 'default'
            }}
          >
            {/* Live Canvas Background effect if no mediaUrl */}
            {!mediaUrl && animatedBg !== 'none' && (
              <ChatLiveWallpaper wallpaperId={animatedBg} />
            )}

            {/* Media Image Layer */}
            {mediaUrl && (
              <img
                src={mediaUrl}
                alt="Story Media"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Subtle Vignette for top & bottom tool readability */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 75%, rgba(0,0,0,0.75) 100%)',
                pointerEvents: 'none'
              }}
            />

            {/* Floating Top Instagram Tools */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '16px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 30
              }}
            >
              {/* Back / Retake / Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: 'none',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                  title="Close"
                >
                  <X size={20} />
                </button>

                {mediaUrl && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: 'none',
                      color: '#fff',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(8px)'
                    }}
                    title="Retake Photo"
                  >
                    <Camera size={19} />
                  </button>
                )}
              </div>

              {/* Floating Instagram Action Pills: Aa, 🎵, 🎨, ✨, 😊 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 1. Text Tool (Aa) */}
                <button
                  type="button"
                  onClick={() => setShowTextEditor(true)}
                  style={{
                    background: caption ? '#f59e0b' : 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: caption ? '#000' : '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    fontWeight: 900,
                    fontSize: '1rem'
                  }}
                  title="Add or Edit Text (Aa)"
                >
                  Aa
                </button>

                {/* 2. Music Picker Tool (🎵) */}
                <button
                  type="button"
                  onClick={() => setShowMusicPicker(true)}
                  style={{
                    background: selectedSong ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    boxShadow: selectedSong ? '0 0 12px rgba(245, 158, 11, 0.6)' : 'none'
                  }}
                  title="Add Music Track"
                >
                  <Music size={18} />
                </button>

                {/* 3. Cycle Colors / Gradient (🎨) */}
                <button
                  type="button"
                  onClick={() => setSelectedGradientIndex(i => i + 1)}
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                  title="Cycle Background Color"
                >
                  <Palette size={18} />
                </button>

                {/* 4. Cycle Live Aura Effects (✨) */}
                <button
                  type="button"
                  onClick={() => setAnimatedBgIndex(i => i + 1)}
                  style={{
                    background: animatedBg !== 'none' ? 'rgba(99, 102, 241, 0.8)' : 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                  title="Cycle Live Aura Wallpaper"
                >
                  <Sparkles size={18} />
                </button>

                {/* 5. Stickers Tool (😊) */}
                <button
                  type="button"
                  onClick={() => setShowStickerDrawer(s => !s)}
                  style={{
                    background: selectedStickers.length > 0 ? 'rgba(236, 72, 153, 0.8)' : 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)'
                  }}
                  title="Add Stickers"
                >
                  <Smile size={18} />
                </button>
              </div>
            </div>

            {/* Draggable Music Sticker on Canvas (Instagram Style) */}
            {selectedSong && (
              <div
                onMouseDown={(e) => handlePointerDown('music', e)}
                onTouchStart={(e) => handlePointerDown('music', e)}
                style={{
                  position: 'absolute',
                  left: `${musicPos.x}%`,
                  top: `${musicPos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(18, 18, 24, 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  padding: '6px 14px 6px 8px',
                  borderRadius: '24px',
                  border: '1.5px solid rgba(245, 158, 11, 0.65)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  cursor: 'grab',
                  maxWidth: '82%'
                }}
              >
                <img
                  src={selectedSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedSong.songTitle}`}
                  alt="Track"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    animation: 'spin 4s linear infinite',
                    flexShrink: 0
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🎵 {selectedSong.songTitle}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSong.artistName || 'Full Song'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSong(null);
                    if (previewAudioRef.current) previewAudioRef.current.pause();
                    stopGlobalMusicAudio();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    padding: '2px',
                    cursor: 'pointer',
                    marginLeft: '4px'
                  }}
                  title="Remove Music"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Draggable Text / Caption on Canvas (Tap to edit) */}
            <div
              onMouseDown={(e) => handlePointerDown('text', e)}
              onTouchStart={(e) => handlePointerDown('text', e)}
              onClick={() => setShowTextEditor(true)}
              style={{
                position: 'absolute',
                left: `${textPos.x}%`,
                top: `${textPos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 24,
                cursor: 'grab',
                padding: '10px 16px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '88%',
                lineHeight: 1.35
              }}
            >
              <div
                className={textStyle3D !== 'none' ? textStyle3D : ''}
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  textShadow: '0 2px 14px rgba(0,0,0,0.85)',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {caption || "Tap to type your vibe..."}
              </div>
            </div>

            {/* Draggable Stickers */}
            {selectedStickers.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '90px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {selectedStickers.map((s, i) => (
                  <span
                    key={i}
                    onClick={() => handleToggleSticker(s)}
                    style={{ fontSize: '1.5rem', cursor: 'pointer' }}
                    title="Click to remove"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Sticker Drawer Sheet */}
            {showStickerDrawer && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '75px',
                  left: '12px',
                  right: '12px',
                  zIndex: 40,
                  background: 'rgba(18, 18, 24, 0.94)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '20px',
                  padding: '12px 16px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
                  animation: 'pulseFadeIn 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>Tap to Add Stickers</span>
                  <button
                    type="button"
                    onClick={() => setShowStickerDrawer(false)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                  {STICKERS.map((st, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleToggleSticker(st)}
                      style={{
                        background: selectedStickers.includes(st) ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.08)',
                        border: selectedStickers.includes(st) ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '1.5rem',
                        padding: '6px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Instagram Action Bar ("Your Story ⚡") */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '16px 20px 24px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 30,
                background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)'
              }}
            >
              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#e2e8f0',
                  padding: '10px 18px',
                  borderRadius: '24px',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)'
                }}
              >
                Cancel
              </button>

              {/* Instagram Style "Your Story ⚡" Share Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 22px',
                  borderRadius: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.94rem',
                  fontWeight: 800,
                  cursor: submitting ? 'wait' : 'pointer',
                  boxShadow: '0 4px 20px rgba(236, 72, 153, 0.55)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* User Avatar Circle */}
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '1.5px solid #fff',
                    flexShrink: 0
                  }}
                >
                  <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || 'user'}`}
                    alt="Me"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <span>{submitting ? 'Sharing...' : 'Your Vibe ⚡'}</span>
                {submitting ? <Loader2 size={16} className="spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3: INSTAGRAM DIRECT TEXT TYPING OVERLAY (Aa)
        ========================================================================= */}
        {showTextEditor && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              background: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '20px 20px 28px 20px',
              animation: 'pulseFadeIn 0.2s ease'
            }}
          >
            {/* Top Bar with Done */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowTextEditor(false)}
                style={{
                  background: '#f59e0b',
                  border: 'none',
                  color: '#000',
                  padding: '7px 20px',
                  borderRadius: '20px',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>

            {/* Centered Large Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <textarea
                autoFocus
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Type your vibe..."
                rows={4}
                className={textStyle3D !== 'none' ? textStyle3D : ''}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  resize: 'none',
                  lineHeight: 1.35
                }}
              />
            </div>

            {/* Bottom 3D Text Styles Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                Select Text Style
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  scrollbarWidth: 'none'
                }}
              >
                {TEXT_STYLES_3D.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTextStyle3D(st.id)}
                    style={{
                      background: textStyle3D === st.id ? '#ffffff' : 'rgba(255,255,255,0.1)',
                      color: textStyle3D === st.id ? '#000000' : '#ffffff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '18px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JioSaavn Full Song Music Picker Modal */}
      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        selectedSong={selectedSong}
        onSelectSong={(song) => {
          setSelectedSong(song);
          setShowMusicPicker(false);
          previewSongPart(song, 0);
        }}
      />
    </div>
  );
}
