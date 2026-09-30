import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  X, Camera, SwitchCamera, Image as ImageIcon, Music, Palette, Sparkles, 
  Send, Loader2, Type, Trash2, Smile, Disc, Check, FlipHorizontal, Sliders,
  SlidersHorizontal, ZoomIn, Eye, Sparkle, RotateCcw, Volume2, Clock, Play, Pause, Scissors
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { registerGlobalMusicAudio, stopGlobalMusicAudio } from '../../utils/audio';
import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';
import MusicPickerModal from './MusicPickerModal';
import { EMOJI_CATEGORIES, ALL_EMOJIS } from '../chat/EmojiPicker';

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
  { id: 'text-3d-neon', label: '⚡ Cyber Neon', class: 'text-3d-neon' },
  { id: 'text-3d-gold', label: '👑 Gold Deluxe', class: 'text-3d-gold' },
  { id: 'text-3d-flame', label: '🔥 Inferno Flame', class: 'text-3d-flame' },
  { id: 'text-3d-cosmic', label: '🔮 Cosmic Nebula', class: 'text-3d-cosmic' },
  { id: 'text-3d-diamond', label: '💎 Diamond Ice', class: 'text-3d-diamond' },
  { id: 'text-3d-candy', label: '🍭 Bubble Candy', class: 'text-3d-candy' },
  { id: 'text-3d-emerald', label: '❇️ Emerald Matrix', class: 'text-3d-emerald' },
  { id: 'text-3d-crimson', label: '🩸 Blood Crimson', class: 'text-3d-crimson' },
  { id: 'text-3d-tokyo', label: '🌌 Tokyo Synth', class: 'text-3d-tokyo' },
  { id: 'text-3d-platinum', label: '🏆 Royal Platinum', class: 'text-3d-platinum' }
];

const ANIMATED_BGS = [
  { id: 'none', label: '✨ Clean Static' },
  { id: 'matrix_code_live', label: '❇️ Matrix Rain' },
  { id: 'starry_galaxy_live', label: '🌌 Starry Galaxy' },
  { id: 'cyber_grid_live', label: '⚡ Cyber Grid' },
  { id: 'firefly_night_live', label: '💡 Firefly Glow' },
  { id: 'love_hearts_live', label: '💖 Floating Hearts' }
];

const IMAGE_FILTERS = [
  { id: 'none', label: 'Normal' },
  { id: 'contrast(1.2) saturate(1.4) hue-rotate(15deg)', label: '⚡ Cyberpunk' },
  { id: 'contrast(1.1) brightness(1.15) saturate(1.2)', label: '💎 Diamond' },
  { id: 'sepia(0.35) contrast(1.1) brightness(1.05)', label: '🔥 Warm Film' },
  { id: 'grayscale(1) contrast(1.3)', label: '🖤 B&W Noir' },
  { id: 'saturate(1.9) contrast(1.15)', label: '🌈 Vivid Pop' }
];

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

  // View Mode: 'camera' | 'canvas' (defaults directly to live camera)
  const [viewMode, setViewMode] = useState('camera');
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [cameraActive, setCameraActive] = useState(false);

  // Active Tool Panel: null | 'text' | 'bg_color' | 'animated_bg' | 'stickers' | 'image_adjust'
  const [activePanel, setActivePanel] = useState(null);

  // Story Content
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [animatedBg, setAnimatedBg] = useState('none');
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [textSize, setTextSize] = useState(1.4);
  const [textAlign, setTextAlign] = useState('center');

  // Music & Duration State
  const [selectedSong, setSelectedSong] = useState(null);
  const [songStartTime, setSongStartTime] = useState(0);
  const [storyDuration, setStoryDuration] = useState(15); // 15 | 30 | 60 seconds
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  // Image FX State & Gestures
  const [imageFit, setImageFit] = useState('cover'); // 'cover' | 'contain' | 'padded'
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imageFilter, setImageFilter] = useState('none');
  const [imageOpacity, setImageOpacity] = useState(1.0);
  const [imagePos, setImagePos] = useState({ x: 50, y: 50 });

  // Emojis / Stickers
  const [selectedStickers, setSelectedStickers] = useState([]);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');

  // Interactive Drag & Drop Positions
  const [textPos, setTextPos] = useState({ x: 50, y: 45 });
  const [musicPos, setMusicPos] = useState({ x: 50, y: 18 });
  const [draggingElement, setDraggingElement] = useState(null);

  // Touch Gesture tracking for image pinch-to-zoom
  const touchStartDistRef = useRef(null);
  const initialZoomRef = useRef(1.0);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Camera Teardown
  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Camera Launch with fallback constraints and robust video attachment
  const startCamera = useCallback(async (facing = facingMode) => {
    stopCameraStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported on this device.');
      setViewMode('canvas');
      return;
    }
    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1080 },
            height: { ideal: 1920 }
          },
          audio: false
        });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false
          });
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          if (videoRef.current) {
            videoRef.current.muted = true;
            try { await videoRef.current.play(); } catch (err) {}
          }
        }
      }
      setCameraActive(true);
      setViewMode('camera');
      setError('');
      setActivePanel(null);
    } catch (err) {
      console.warn('Camera failed to start:', err);
      setError('Camera access denied or device busy.');
      setViewMode('canvas');
    }
  }, [facingMode, stopCameraStream]);

  // Auto-start camera on modal open
  useEffect(() => {
    startCamera('user');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip Camera
  const handleToggleCameraFacing = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture Photo
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setMediaUrl(dataUrl);
    stopCameraStream();
    setViewMode('canvas');
    setActivePanel('image_adjust');
  };

  // File Upload from Gallery
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25MB limit.');
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
      setViewMode('canvas');
      setActivePanel('image_adjust');
    }
  };

  // Unmount & Exit Audio / Camera Cleanup
  useEffect(() => {
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
  }, [stopCameraStream]);

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
    setIsPlayingPreview(false);
    onClose();
  };

  // Preview Music
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
        audio.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
        audio.onended = () => setIsPlayingPreview(false);
        audio.onpause = () => setIsPlayingPreview(false);
        previewAudioRef.current = audio;
      }
    } catch (e) {}
  };

  const togglePreviewAudio = () => {
    if (!selectedSong) return;
    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewSongPart(selectedSong, songStartTime);
    }
  };

  // Dragging Handlers & Pinch-to-Zoom Gestures
  const handlePointerDown = (elementName, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDraggingElement(elementName);
  };

  const handlePointerMove = (e) => {
    if (!cardRef.current) return;

    // Multi-touch pinch-to-zoom for image
    if (e.touches && e.touches.length === 2 && touchStartDistRef.current) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleRatio = currentDist / touchStartDistRef.current;
      const newZoom = Math.min(3.5, Math.max(0.3, Number((initialZoomRef.current * scaleRatio).toFixed(2))));
      setImageZoom(newZoom);
      return;
    }

    if (!draggingElement) return;
    const rect = cardRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.max(5, Math.min(95, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(5, Math.min(95, Math.round(((clientY - rect.top) / rect.height) * 100)));

    if (draggingElement === 'text') setTextPos({ x, y });
    else if (draggingElement === 'music') setMusicPos({ x, y });
    else if (draggingElement === 'image') setImagePos({ x, y });
  };

  const handlePointerUp = () => {
    setDraggingElement(null);
    touchStartDistRef.current = null;
  };

  const handleWheel = (e) => {
    if (mediaUrl) {
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      setImageZoom(prev => Math.min(3.5, Math.max(0.3, Number((prev + zoomDelta).toFixed(2)))));
    }
  };

  const handleToggleSticker = (st) => {
    setSelectedStickers(prev => 
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  // Submit Vibe
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return; // Prevent double/triple click duplicate submission

    if (!caption.trim() && !mediaUrl && !selectedSong) {
      setError('Please add text, photo, or music to post your Vibe!');
      return;
    }

    setSubmitting(true);
    setError('');

    const vibeId = 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    let createdVibe = {
      id: vibeId,
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
      storyDuration: Number(storyDuration) || 15,
      bgGradient: selectedGradient,
      textStyle3D,
      animatedBg,
      textPos,
      musicPos,
      imagePos: { x: imagePos.x, y: imagePos.y },
      imageFit,
      imageZoom,
      imageFilter,
      imageOpacity,
      textSize,
      textAlign,
      selectedStickers,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      views: [],
      sparksEarned: 0
    };

    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vibes/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: vibeId,
            caption: caption.trim(),
            mediaUrl: mediaUrl || null,
            soundtrack: selectedSong ? 'music_track' : 'lofi',
            songTitle: selectedSong ? selectedSong.songTitle : '',
            artistName: selectedSong ? selectedSong.artistName : '',
            albumArt: selectedSong ? selectedSong.albumArt : '',
            audioUrl: selectedSong ? selectedSong.audioUrl : '',
            youtubeId: selectedSong ? selectedSong.youtubeId : '',
            songStartTime: selectedSong ? (songStartTime || 0) : 0,
            storyDuration: Number(storyDuration) || 15,
            bgGradient: selectedGradient,
            textStyle3D,
            animatedBg,
            textPos,
            musicPos,
            imagePos: { x: imagePos.x, y: imagePos.y },
            imageFit,
            imageZoom,
            imageFilter,
            imageOpacity,
            textSize,
            textAlign,
            selectedStickers
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.vibe) {
            createdVibe = data.vibe;
          }
        }
      } catch (err) {
        console.warn('Network story sync offline, cached locally.');
      }
    }

    try {
      const raw = localStorage.getItem('pulsechat_local_vibes');
      const existing = raw ? JSON.parse(raw) : [];
      // Deduplicate: filter out any vibe with the same ID or identical content within 25 seconds
      const filtered = existing.filter(v => 
        v.id !== createdVibe.id && 
        !(v.userId === createdVibe.userId && v.caption === createdVibe.caption && v.mediaUrl === createdVibe.mediaUrl && Math.abs(new Date(v.createdAt).getTime() - new Date(createdVibe.createdAt).getTime()) < 25000)
      );
      filtered.unshift(createdVibe);
      // Ensure newest first (jo new lagaya vo aage, jo pehle lagaya tha vo last)
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem('pulsechat_local_vibes', JSON.stringify(filtered));
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
        background: 'rgba(5, 5, 8, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Main Studio Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '100dvh',
          maxHeight: '900px',
          borderRadius: window.innerWidth > 500 ? '24px' : '0px',
          overflow: 'hidden',
          background: '#0a0a0f',
          boxShadow: '0 25px 70px rgba(0,0,0,0.85), 0 0 35px rgba(99, 102, 241, 0.25)',
          border: window.innerWidth > 500 ? '1px solid rgba(255,255,255,0.15)' : 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* =========================================================================
            TOP PULSE STUDIO HUB (Branded Header + Live Switcher)
        ========================================================================= */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(14, 14, 22, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            zIndex: 40,
            backdropFilter: 'blur(12px)'
          }}
        >
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Pulse Vibe Studio <span style={{ fontSize: '0.62rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 6px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>24h</span>
              </span>
            </div>
          </div>

          {/* Mode Switcher Pills: Canvas vs Camera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '2px',
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setViewMode('canvas');
                }}
                style={{
                  background: viewMode === 'canvas' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'canvas' ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Palette size={12} /> Canvas
              </button>

              <button
                type="button"
                onClick={() => startCamera('user')}
                style={{
                  background: viewMode === 'camera' ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'camera' ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Camera size={12} /> Camera
              </button>
            </div>

            {/* Exit Studio Button */}
            <button
              type="button"
              onClick={handleCloseModal}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            PULSE STUDIO TOOL DOCK (Interactive Feature Selector)
        ========================================================================= */}
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(10, 10, 16, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            zIndex: 35
          }}
        >
          {/* 1. 3D Text Tool Button */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'text' ? null : 'text')}
            style={{
              background: activePanel === 'text' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.06)',
              border: activePanel === 'text' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.12)',
              color: activePanel === 'text' ? '#a5b4fc' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Type size={14} color="#6366f1" /> 3D Text
          </button>

          {/* 2. BG Color / Gradient Palette Button */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'bg_color' ? null : 'bg_color')}
            style={{
              background: activePanel === 'bg_color' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.06)',
              border: activePanel === 'bg_color' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)',
              color: activePanel === 'bg_color' ? '#fcd34d' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Palette size={14} color="#f59e0b" /> BG Color
          </button>

          {/* 3. Live Animated Canvas Button */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'animated_bg' ? null : 'animated_bg')}
            style={{
              background: activePanel === 'animated_bg' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255,255,255,0.06)',
              border: activePanel === 'animated_bg' ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.12)',
              color: activePanel === 'animated_bg' ? '#f472b6' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Sparkles size={14} color="#ec4899" /> Live Canvas
          </button>

          {/* 4. Full Song Music Button */}
          <button
            type="button"
            onClick={() => {
              if (selectedSong) {
                setActivePanel(activePanel === 'music_trim' ? null : 'music_trim');
              } else {
                setShowMusicPicker(true);
              }
            }}
            style={{
              background: activePanel === 'music_trim' ? 'rgba(16, 185, 129, 0.4)' : (selectedSong ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.06)'),
              border: activePanel === 'music_trim' ? '1.5px solid #6ee7b7' : (selectedSong ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)'),
              color: selectedSong ? '#6ee7b7' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Music size={14} color="#10b981" /> {selectedSong ? '🎵 ' + selectedSong.songTitle.substring(0, 10) + '...' : 'Add Music'}
          </button>

          {/* 5. Vibe Duration Selector Quick Button (15s / 30s / 60s) */}
          <button
            type="button"
            onClick={() => {
              const nextDur = storyDuration === 15 ? 30 : (storyDuration === 30 ? 60 : 15);
              setStoryDuration(nextDur);
            }}
            style={{
              background: storyDuration > 15 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.06)',
              border: storyDuration > 15 ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)',
              color: storyDuration > 15 ? '#fbbf24' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="Toggle story duration (15s, 30s, 60s)"
          >
            <Clock size={14} color={storyDuration > 15 ? '#f59e0b' : '#94a3b8'} /> ⏱️ {storyDuration}s
          </button>

          {/* 5. Gallery Pick Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: mediaUrl ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
              border: mediaUrl ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
              color: mediaUrl ? '#7dd3fc' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <ImageIcon size={14} color="#38bdf8" /> {mediaUrl ? 'Change Photo' : 'Gallery'}
          </button>

          {/* 6. Image FX Controls Button (Prominently shown when photo is present) */}
          {mediaUrl && (
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'image_adjust' ? null : 'image_adjust')}
              style={{
                background: activePanel === 'image_adjust' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.45), rgba(236, 72, 153, 0.35))' : 'rgba(168, 85, 247, 0.22)',
                border: activePanel === 'image_adjust' ? '1.5px solid #d8b4fe' : '1.5px solid #a855f7',
                color: '#fff',
                borderRadius: '12px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: activePanel === 'image_adjust' ? '0 0 16px rgba(168, 85, 247, 0.6)' : '0 0 10px rgba(168, 85, 247, 0.35)'
              }}
            >
              <SlidersHorizontal size={14} color="#d8b4fe" /> Image FX ✨
            </button>
          )}

          {/* 7. Emojis Button (Clean "Emojis" without 250+) */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'stickers' ? null : 'stickers')}
            style={{
              background: activePanel === 'stickers' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.06)',
              border: activePanel === 'stickers' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.12)',
              color: activePanel === 'stickers' ? '#fef08a' : '#fff',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Smile size={14} color="#eab308" /> Emojis{selectedStickers.length > 0 ? ` (${selectedStickers.length})` : ''}
          </button>
        </div>

        {/* =========================================================================
            MAIN CANVAS / VIEWFINDER STAGE
        ========================================================================= */}
        <div
          ref={cardRef}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
          onWheel={handleWheel}
          style={{
            flex: 1,
            position: 'relative',
            background: mediaUrl ? '#050508' : selectedGradient,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: draggingElement ? 'grabbing' : 'default',
            touchAction: 'none'
          }}
        >
          {error && (
            <div style={{
              position: 'absolute',
              top: '12px',
              zIndex: 50,
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            }}>
              {error}
            </div>
          )}

          {/* VIEW MODE 1: LIVE CAMERA VIEW */}
          {viewMode === 'camera' && (
            <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                    el.srcObject = cameraStreamRef.current;
                    el.play().catch(() => {
                      el.muted = true;
                      el.play().catch(() => {});
                    });
                  }
                }}
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

              {/* Camera Shutter Bar */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                padding: '0 30px',
                zIndex: 20
              }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Gallery"
                >
                  <ImageIcon size={20} />
                </button>

                {/* Shutter */}
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '4px solid #ffffff',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 25px rgba(255,255,255,0.5)'
                  }}
                  title="Click Photo"
                >
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff' }} />
                </button>

                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Flip Camera"
                >
                  <SwitchCamera size={20} />
                </button>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: CANVAS / ARTWORK / PHOTO STAGE */}
          {viewMode === 'canvas' && (
            <>
              {/* Live Canvas Animated Wallpaper */}
              {animatedBg !== 'none' && (
                <ChatLiveWallpaper wallpaperId={animatedBg} />
              )}

              {/* Photo Image Layer - Draggable anywhere & pinch-to-zoomable */}
              {mediaUrl && (
                <div
                  onMouseDown={(e) => handlePointerDown('image', e)}
                  onTouchStart={(e) => {
                    if (e.touches && e.touches.length === 2) {
                      const dist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                      );
                      touchStartDistRef.current = dist;
                      initialZoomRef.current = imageZoom;
                      setDraggingElement(null);
                    } else {
                      handlePointerDown('image', e);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: `${imagePos.x}%`,
                    top: `${imagePos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: imageFit === 'contain' ? '92%' : imageFit === 'padded' ? '82%' : '100%',
                    height: imageFit === 'contain' ? '92%' : imageFit === 'padded' ? '82%' : '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: draggingElement === 'image' ? 'grabbing' : 'grab',
                    zIndex: 5,
                    touchAction: 'none'
                  }}
                >
                  <img
                    src={mediaUrl}
                    alt="Media"
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: imageFit === 'padded' ? 'contain' : imageFit,
                      transform: `scale(${imageZoom})`,
                      filter: imageFilter !== 'none' ? imageFilter : 'none',
                      opacity: imageOpacity,
                      borderRadius: imageFit === 'padded' ? '18px' : '0px',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      WebkitUserDrag: 'none'
                    }}
                  />
                </div>
              )}

              {/* Draggable 3D Text / Caption - Only displayed if user entered caption or is actively editing in text panel */}
              {(Boolean(caption?.trim()) || activePanel === 'text') && (
                <div
                  onMouseDown={(e) => handlePointerDown('text', e)}
                  onTouchStart={(e) => handlePointerDown('text', e)}
                  onClick={() => setActivePanel('text')}
                  style={{
                    position: 'absolute',
                    left: `${textPos.x}%`,
                    top: `${textPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 25,
                    cursor: draggingElement === 'text' ? 'grabbing' : 'grab',
                    maxWidth: '88%',
                    padding: '6px 12px',
                    textAlign: textAlign,
                    userSelect: 'none'
                  }}
                >
                  {textStyle3D && textStyle3D !== 'none' ? (
                    <div className={`animated-3d-stage ${textStyle3D}`} style={{ position: 'relative', zIndex: 4, maxWidth: '100%', width: '100%' }}>
                      <div className="animated-3d-card" style={{ padding: '8px 14px', background: 'transparent', boxShadow: 'none', border: 'none', width: '100%' }}>
                        <div
                          className="text-3d-content"
                          style={{
                            fontSize: `${textSize}rem`,
                            textAlign: textAlign,
                            wordBreak: 'break-word',
                            lineHeight: 1.2
                          }}
                        >
                          {caption || (activePanel === 'text' ? '✨ Type 3D Text...' : '')}
                        </div>
                        <div className="text-3d-shadow" />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: `${textSize}rem`,
                        fontWeight: 800,
                        color: '#ffffff',
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        textAlign: textAlign,
                        textShadow: '0 3px 14px rgba(0,0,0,0.85)',
                        opacity: caption ? 1 : 0.6
                      }}
                    >
                      {caption || (activePanel === 'text' ? 'Type text...' : '')}
                    </div>
                  )}
                </div>
              )}

              {/* Draggable Pulse Music Card Sticker */}
              {selectedSong && (
                <div
                  onMouseDown={(e) => handlePointerDown('music', e)}
                  onTouchStart={(e) => handlePointerDown('music', e)}
                  onClick={() => setActivePanel('music_trim')}
                  style={{
                    position: 'absolute',
                    left: `${musicPos.x}%`,
                    top: `${musicPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 26,
                    background: 'rgba(15, 15, 24, 0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1.5px solid rgba(245, 158, 11, 0.7)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
                    borderRadius: '20px',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    maxWidth: '85%',
                    cursor: 'grab'
                  }}
                >
                  <img
                    src={selectedSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedSong.songTitle}`}
                    alt="Album"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      animation: 'spin 4s linear infinite',
                      border: '1px solid #f59e0b',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🎵 {selectedSong.songTitle}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: '#f59e0b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSong.artistName || 'Full Song Stream'}
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
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', marginLeft: '4px' }}
                    title="Remove Song"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Floating Stickers / Emojis on Stage */}
              {selectedStickers.length > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '80px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '6px 14px',
                  borderRadius: '24px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                }}>
                  {selectedStickers.map((s, idx) => (
                    <span
                      key={idx}
                      onClick={() => handleToggleSticker(s)}
                      style={{ fontSize: '1.45rem', cursor: 'pointer' }}
                      title="Tap to remove"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* =========================================================================
              SLIDE-UP INTERACTIVE CONTROL DRAWERS
          ========================================================================= */}

          {/* DRAWER 1: 3D TEXT & CAPTION CONTROLS */}
          {activePanel === 'text' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Type size={16} /> 3D Text Studio
                </span>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  style={{ background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              {/* Text Input */}
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Type your vibe text..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '0.94rem',
                  outline: 'none'
                }}
              />

              {/* 3D Styles Horizontal Scroll */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Choose 3D Style:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                  {TEXT_STYLES_3D.map(st => {
                    const isSelected = textStyle3D === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setTextStyle3D(st.id)}
                        style={{
                          background: isSelected ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.08)',
                          border: isSelected ? '1.5px solid #c084fc' : '1px solid rgba(255,255,255,0.12)',
                          color: isSelected ? '#ffffff' : '#cbd5e1',
                          borderRadius: '16px',
                          padding: '6px 14px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: isSelected ? '0 0 16px rgba(168, 85, 247, 0.6)' : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size Slider & Alignment */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Size:</span>
                  <input
                    type="range"
                    min="0.9"
                    max="2.5"
                    step="0.1"
                    value={textSize}
                    onChange={(e) => setTextSize(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#6366f1', height: '4px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {['left', 'center', 'right'].map(align => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setTextAlign(align)}
                      style={{
                        background: textAlign === align ? '#6366f1' : 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DRAWER 2: BG COLOR / GRADIENT SELECTOR */}
          {activePanel === 'bg_color' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={16} /> Select Background Gradient
                </span>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              {/* Swatches Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {GRADIENTS.map(g => {
                  const isSelected = selectedGradient === g.value;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGradient(g.value);
                        setMediaUrl('');
                      }}
                      style={{
                        background: g.value,
                        height: '52px',
                        borderRadius: '14px',
                        border: isSelected ? '3px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: isSelected ? '0 0 15px rgba(255,255,255,0.6)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                    >
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'center' }}>
                        {g.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DRAWER 3: LIVE CANVAS ANIMATED WALLPAPER SELECTOR */}
          {activePanel === 'animated_bg' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(236, 72, 153, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> Live Canvas Animations
                </span>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  style={{ background: 'rgba(236, 72, 153, 0.25)', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {ANIMATED_BGS.map(a => {
                  const isSelected = animatedBg === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAnimatedBg(a.id)}
                      style={{
                        background: isSelected ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.35), rgba(99, 102, 241, 0.35))' : 'rgba(255,255,255,0.06)',
                        border: isSelected ? '1.5px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px',
                        padding: '10px 14px',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{a.label}</span>
                      {isSelected && <Check size={16} color="#ec4899" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DRAWER 4: 250+ CATEGORIZED EMOJIS & STICKERS */}
          {activePanel === 'stickers' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '320px',
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(234, 179, 8, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smile size={16} /> Tap Emojis to Add to Story
                </span>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  style={{ background: 'rgba(234, 179, 8, 0.25)', border: '1px solid rgba(234, 179, 8, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              {/* Emoji Category Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                {EMOJI_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isAct = activeEmojiCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveEmojiCategory(cat.id)}
                      style={{
                        background: isAct ? 'rgba(234, 179, 8, 0.3)' : 'transparent',
                        border: isAct ? '1px solid #facc15' : '1px solid transparent',
                        color: isAct ? '#facc15' : '#94a3b8',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Icon size={14} /> {cat.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>

              {/* Emoji Grid */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px',
                alignContent: 'start',
                scrollbarWidth: 'thin'
              }}>
                {(EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.emojis || ALL_EMOJIS).map((st, i) => (
                  <button
                    key={`${st}_${i}`}
                    type="button"
                    onClick={() => handleToggleSticker(st)}
                    style={{
                      background: selectedStickers.includes(st) ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.06)',
                      border: selectedStickers.includes(st) ? '1px solid #facc15' : '1px solid transparent',
                      borderRadius: '10px',
                      fontSize: '1.4rem',
                      padding: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DRAWER 5: IMAGE FX & FIT ADJUST CONTROLS */}
          {activePanel === 'image_adjust' && mediaUrl && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlidersHorizontal size={16} /> Image Adjustment & Filters
                </span>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              {/* Fit Modes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fit:</span>
                {['cover', 'contain', 'padded'].map(fit => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setImageFit(fit)}
                    style={{
                      background: imageFit === fit ? '#a855f7' : 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {fit}
                  </button>
                ))}
              </div>

              {/* Filters Scroll */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                {IMAGE_FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setImageFilter(f.id)}
                    style={{
                      background: imageFilter === f.id ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.06)',
                      border: imageFilter === f.id ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.1)',
                      color: imageFilter === f.id ? '#ffffff' : '#cbd5e1',
                      borderRadius: '12px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Zoom & Opacity Sliders */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Zoom:</span>
                  <input
                    type="range"
                    min="0.8"
                    max="2.2"
                    step="0.1"
                    value={imageZoom}
                    onChange={(e) => setImageZoom(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#a855f7', height: '4px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Opacity:</span>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={imageOpacity}
                    onChange={(e) => setImageOpacity(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#a855f7', height: '4px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* DRAWER 6: MUSIC PREVIEW, CROP (START TIME) & DURATION CONTROLS */}
          {activePanel === 'music_trim' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'rgba(15, 15, 24, 0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '24px 24px 0 0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
              animation: 'pulseFadeIn 0.2s ease'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Music size={16} /> Music & Vibe Duration Studio
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (previewAudioRef.current) previewAudioRef.current.pause();
                    setIsPlayingPreview(false);
                    setActivePanel(null);
                  }}
                  style={{ background: 'rgba(16, 185, 129, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#fff', borderRadius: '12px', padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done ✓
                </button>
              </div>

              {selectedSong ? (
                <>
                  {/* Song Info & Preview Player */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '10px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <img
                        src={selectedSong.albumArt || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedSong.songTitle}`}
                        alt="Album"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          objectFit: 'cover',
                          border: '1px solid #10b981',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedSong.songTitle}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedSong.artistName || 'Full Track'}
                        </div>
                      </div>
                    </div>

                    {/* Preview Play/Pause & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={togglePreviewAudio}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: isPlayingPreview ? '#ef4444' : '#10b981',
                          border: 'none',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: isPlayingPreview ? '0 0 14px rgba(239, 68, 68, 0.6)' : '0 0 14px rgba(16, 185, 129, 0.6)'
                        }}
                        title={isPlayingPreview ? "Pause Preview" : "Play Preview"}
                      >
                        {isPlayingPreview ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMusicPicker(true)}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          borderRadius: '10px',
                          padding: '6px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* Audio Trimmer / Start Point Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                      <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Scissors size={13} color="#10b981" /> Crop Song Start Time:
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '8px' }}>
                        Starts at {Math.floor(songStartTime / 60)}:{(songStartTime % 60) < 10 ? '0' : ''}{songStartTime % 60}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={Math.max(10, (selectedSong.duration || 240) - storyDuration)}
                      step="1"
                      value={songStartTime}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setSongStartTime(val);
                        previewSongPart(selectedSong, val);
                      }}
                      style={{
                        width: '100%',
                        accentColor: '#10b981',
                        cursor: 'pointer',
                        height: '6px'
                      }}
                    />

                    {/* Quick Jump Markers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Quick Jump:</span>
                      {[
                        { label: '0:00 Intro', sec: 0 },
                        { label: '0:30 Chorus', sec: 30 },
                        { label: '0:60 Hook', sec: 60 },
                        { label: '1:30 Drop', sec: 90 }
                      ].map(mk => (
                        <button
                          key={mk.sec}
                          type="button"
                          onClick={() => {
                            setSongStartTime(mk.sec);
                            previewSongPart(selectedSong, mk.sec);
                          }}
                          style={{
                            background: songStartTime === mk.sec ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)',
                            border: songStartTime === mk.sec ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                            color: songStartTime === mk.sec ? '#6ee7b7' : '#94a3b8',
                            borderRadius: '8px',
                            padding: '2px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {mk.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '10px' }}>
                    No music added yet. Choose a song from Bollywood, Punjabi, Lofi or Hollywood hits!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMusicPicker(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '14px',
                      padding: '8px 18px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    <Music size={15} /> Select Song from Library
                  </button>
                </div>
              )}

              {/* Vibe Story Duration Selector (15s, 30s, 60s) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={14} color="#f59e0b" /> Story Duration (Play Length):
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 800 }}>
                    {storyDuration} Seconds
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { sec: 15, label: '⚡ 15 sec', desc: 'Standard Story' },
                    { sec: 30, label: '🔥 30 sec', desc: 'Extended Vibe' },
                    { sec: 60, label: '🌟 60 sec', desc: 'Full Music Clip' }
                  ].map(dur => (
                    <button
                      key={dur.sec}
                      type="button"
                      onClick={() => setStoryDuration(dur.sec)}
                      style={{
                        background: storyDuration === dur.sec
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(239, 68, 68, 0.25))'
                          : 'rgba(255,255,255,0.05)',
                        border: storyDuration === dur.sec
                          ? '1.5px solid #f59e0b'
                          : '1px solid rgba(255,255,255,0.1)',
                        color: storyDuration === dur.sec ? '#fff' : '#94a3b8',
                        borderRadius: '14px',
                        padding: '8px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        boxShadow: storyDuration === dur.sec ? '0 0 14px rgba(245, 158, 11, 0.35)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: storyDuration === dur.sec ? '#fbbf24' : '#e2e8f0' }}>
                        {dur.label}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: storyDuration === dur.sec ? '#fef08a' : '#64748b' }}>
                        {dur.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            BOTTOM PULSE STUDIO ACTION BAR (Publish / Cancel)
        ========================================================================= */}
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(12, 12, 18, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 40,
            backdropFilter: 'blur(12px)'
          }}
        >
          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleCloseModal}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          {/* Glowing Publish Vibe Button */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #f59e0b 100%)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '24px',
              padding: '9px 24px',
              fontSize: '0.9rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5), 0 0 12px rgba(245, 158, 11, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            {submitting ? <Loader2 size={16} className="spin" /> : <Send size={15} />}
            <span>{submitting ? 'Posting...' : 'Publish Vibe ⚡'}</span>
          </button>
        </div>
      </div>

      {/* JioSaavn Full Song Music Picker Modal */}
      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        selectedSong={selectedSong}
        onSelectSong={(song) => {
          setSelectedSong(song);
          setShowMusicPicker(false);
          setSongStartTime(0);
          setActivePanel('music_trim');
          previewSongPart(song, 0);
        }}
      />
    </div>
  );
}
