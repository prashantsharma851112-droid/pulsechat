import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  X, Camera, SwitchCamera, Image as ImageIcon, Music, Palette, Sparkles, 
  Send, Loader2, Type, Trash2, Smile, Disc, Check, FlipHorizontal,
  RotateCcw, Volume2, VolumeX, Clock, Play, Pause, ChevronRight
} from 'lucide-react';
import { BACKEND_URL } from '../../utils/config';
import { registerGlobalMusicAudio, stopGlobalMusicAudio, playSound } from '../../utils/audio';
import { uploadMediaDirect } from '../../utils/mediaUpload';
import ChatLiveWallpaper from '../chat/ChatLiveWallpaper';
import MusicPickerModal from './MusicPickerModal';
import { EMOJI_CATEGORIES, ALL_EMOJIS } from '../chat/EmojiPicker';
import { useBackHandler } from '../../utils/backNavigation';

const GRADIENTS = [
  { id: 'g0', name: 'Dark Void', value: '#000000' },
  { id: 'g1', name: 'Pulse Purple', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
  { id: 'g2', name: 'Cyber Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'g3', name: 'Mint Emerald', value: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'g4', name: 'Neon Rose', value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { id: 'g5', name: 'Sunset Crimson', value: 'linear-gradient(135deg, #ff4e50 0%, #f9d423 100%)' },
  { id: 'g6', name: 'Midnight Blue', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { id: 'g7', name: 'Cosmic Obsidian', value: 'linear-gradient(135deg, #0f0c29 0%, #24243e 100%)' }
];

const TEXT_STYLES_3D = [
  { id: 'none', label: 'Classic' },
  { id: 'text-3d-neon', label: '⚡ Neon' },
  { id: 'text-3d-gold', label: '👑 Gold' },
  { id: 'text-3d-flame', label: '🔥 Flame' },
  { id: 'text-3d-cosmic', label: '🔮 Cosmic' },
  { id: 'text-3d-candy', label: '🍭 Candy' }
];

const IMAGE_FILTERS = [
  { id: 'none', label: 'Normal', css: 'none' },
  { id: 'cyber', label: '⚡ Cyber', css: 'contrast(1.2) saturate(1.4) hue-rotate(15deg)' },
  { id: 'diamond', label: '💎 Bright', css: 'contrast(1.1) brightness(1.15) saturate(1.2)' },
  { id: 'warm', label: '🔥 Warm', css: 'sepia(0.35) contrast(1.1) brightness(1.05)' },
  { id: 'bw', label: '🖤 B&W', css: 'grayscale(1) contrast(1.3)' },
  { id: 'vivid', label: '🌈 Vivid', css: 'saturate(1.9) contrast(1.15)' }
];

export default function CreateVibeModal({ onClose, onCreated }) {
  const { user, token } = useContext(AuthContext);

  // View Mode: 'camera' | 'media' | 'canvas'
  const [viewMode, setViewMode] = useState('camera');
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [cameraActive, setCameraActive] = useState(false);

  // Active floating drawer: null | 'text' | 'bg_color' | 'stickers' | 'filters'
  const [activePanel, setActivePanel] = useState(null);

  // Text & Typography
  const [caption, setCaption] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [textStyle3D, setTextStyle3D] = useState('none');
  const [textBgStyle, setTextBgStyle] = useState('box'); // 'none' | 'box' | 'neon'
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(1.4);
  const [textAlign, setTextAlign] = useState('center');

  // Media
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [imageFilter, setImageFilter] = useState('none');
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imagePos, setImagePos] = useState({ x: 50, y: 50 });

  // Canvas styling
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].value);
  const [animatedBg, setAnimatedBg] = useState('none');

  // Music & Sound
  const [selectedSong, setSelectedSong] = useState(null);
  const [songStartTime, setSongStartTime] = useState(0);
  const [storyDuration, setStoryDuration] = useState(15);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [musicScale, setMusicScale] = useState(1.0);
  const [musicStyle, setMusicStyle] = useState('pill');

  // Interactive Hand Gestures & Draggable Elements
  const [stickersList, setStickersList] = useState([]); // [{ id, emoji, x, y, scale }]
  const [textPos, setTextPos] = useState({ x: 50, y: 48 });
  const [musicPos, setMusicPos] = useState({ x: 50, y: 22 });
  const [draggingElement, setDraggingElement] = useState(null); // 'text' | 'music' | 'image' | stickerId
  const [selectedElement, setSelectedElement] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Touch gesture tracking for pinch-to-scale
  const touchStartDistRef = useRef(null);
  const initialPinchScaleRef = useRef(1.0);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Video Sound & Autoplay Management
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  const toggleVideoMute = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsVideoMuted(prev => {
      const next = !prev;
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = next;
        previewVideoRef.current.volume = 1.0;
        if (!next) previewVideoRef.current.play().catch(() => {});
      }
      return next;
    });
    setShowUnmuteHint(false);
  }, []);

  // Hardware Back Handler
  useBackHandler(() => setShowMusicPicker(false), showMusicPicker);
  useBackHandler(() => setActivePanel(null), !showMusicPicker && Boolean(activePanel));
  useBackHandler(() => setIsEditingText(false), !showMusicPicker && !activePanel && isEditingText);
  useBackHandler(onClose, !showMusicPicker && !activePanel && !isEditingText);

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

  // Camera Launch
  const startCamera = useCallback(async (facing = facingMode) => {
    stopCameraStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setViewMode('canvas');
      return;
    }
    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false
        });
      } catch (err1) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false
        });
      }

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) {}
      }
      setCameraActive(true);
      setViewMode('camera');
    } catch (err) {
      console.warn('Camera failed:', err);
      setViewMode('canvas');
    }
  }, [facingMode, stopCameraStream]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera('user');
    return () => {
      stopCameraStream();
      stopGlobalMusicAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip Camera
  const handleToggleCameraFacing = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  };

  // Capture Photo from Camera
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setMediaType('image');
    setSelectedMediaFile(null);
    setMediaUrl(dataUrl);
    stopCameraStream();
    setViewMode('media');
    playSound('pop');
  };

  // Select Photo / Video from Device Gallery
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 80 * 1024 * 1024) {
      setError('File size exceeds 80MB limit.');
      return;
    }

    stopCameraStream();
    setError('');
    setIsVideoMuted(false);
    setShowUnmuteHint(false);

    // Reliable video detection across Android WebView and browsers
    const isVidMime = Boolean(file.type && (
      file.type.startsWith('video/') ||
      file.type.includes('video') ||
      file.type.includes('mp4') ||
      file.type.includes('quicktime') ||
      file.type.includes('webm')
    ));
    const isVidExt = Boolean(file.name && file.name.match(/\.(mp4|webm|mov|ogg|m4v|3gp|mkv)($|\?)/i));
    const isVid = isVidMime || isVidExt;

    setMediaType(isVid ? 'video' : 'image');
    setSelectedMediaFile(file);

    try {
      const objectUrl = URL.createObjectURL(file);
      setMediaUrl(objectUrl);
      setViewMode('media');

      // Ambiguity probe: if file has no extension or generic application/octet-stream
      if (!isVidMime && !isVidExt && (!file.type || !file.type.startsWith('image/'))) {
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.src = objectUrl;
        probe.onloadedmetadata = () => {
          setMediaType('video');
        };
        probe.onerror = () => {
          setMediaType('image');
        };
      }

      playSound('pop');
    } catch (err) {
      setError('Could not load media preview.');
    }
  };

  // Add Emoji Sticker
  const handleAddEmojiSticker = (emoji) => {
    const newSticker = {
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      emoji,
      x: 50 + (Math.random() * 12 - 6),
      y: 40 + (Math.random() * 12 - 6),
      scale: 1.3
    };
    setStickersList(prev => [...prev, newSticker]);
    setSelectedElement(newSticker.id);
    setActivePanel(null);
    playSound('pop');
  };

  // Direct Hand Drag & Touch Gesture Handlers
  const handleElementTouchStart = (elementId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedElement(elementId);

    // Multi-touch pinch check
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      if (elementId === 'music') initialPinchScaleRef.current = musicScale;
      else if (elementId === 'text') initialPinchScaleRef.current = textSize;
      else if (elementId === 'image') initialPinchScaleRef.current = imageZoom;
      else if (typeof elementId === 'string' && elementId.startsWith('st_')) {
        const st = stickersList.find(s => s.id === elementId);
        initialPinchScaleRef.current = st ? (st.scale || 1.0) : 1.0;
      }
      setDraggingElement(null);
      return;
    }

    setDraggingElement(elementId);
  };

  const handlePointerMove = (e) => {
    if (!stageRef.current) return;

    // 1. Multi-touch pinch-to-scale
    if (e.touches && e.touches.length === 2 && touchStartDistRef.current) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistRef.current;

      if (selectedElement === 'music') {
        const nextScale = Number((initialPinchScaleRef.current * ratio).toFixed(2));
        setMusicScale(Math.min(2.4, Math.max(0.6, nextScale)));
      } else if (selectedElement === 'text') {
        const nextScale = Number((initialPinchScaleRef.current * ratio).toFixed(2));
        setTextSize(Math.min(2.8, Math.max(0.8, nextScale)));
      } else if (selectedElement && typeof selectedElement === 'string' && selectedElement.startsWith('st_')) {
        const nextScale = Number((initialPinchScaleRef.current * ratio).toFixed(2));
        setStickersList(prev => prev.map(s => s.id === selectedElement ? { ...s, scale: Math.min(3.0, Math.max(0.5, nextScale)) } : s));
      } else {
        const nextZoom = Number((initialPinchScaleRef.current * ratio).toFixed(2));
        setImageZoom(Math.min(3.0, Math.max(0.4, nextZoom)));
      }
      return;
    }

    // 2. Single-finger drag
    if (!draggingElement) return;
    const rect = stageRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.max(5, Math.min(95, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(5, Math.min(95, Math.round(((clientY - rect.top) / rect.height) * 100)));

    // Trash can detection (bottom center: y > 76, x between 30 and 70)
    if (y > 76 && x >= 30 && x <= 70) {
      setIsOverTrash(true);
    } else {
      setIsOverTrash(false);
    }

    if (draggingElement === 'text') {
      setTextPos({ x, y });
    } else if (draggingElement === 'music') {
      setMusicPos({ x, y });
    } else if (draggingElement === 'image') {
      setImagePos({ x, y });
    } else if (typeof draggingElement === 'string' && draggingElement.startsWith('st_')) {
      setStickersList(prev => prev.map(s => s.id === draggingElement ? { ...s, x, y } : s));
    }
  };

  const handlePointerUp = () => {
    if (isOverTrash && draggingElement) {
      if (draggingElement === 'text') {
        setCaption('');
      } else if (draggingElement === 'music') {
        setSelectedSong(null);
      } else if (typeof draggingElement === 'string' && draggingElement.startsWith('st_')) {
        setStickersList(prev => prev.filter(s => s.id !== draggingElement));
      } else if (draggingElement === 'image') {
        setMediaUrl('');
        setSelectedMediaFile(null);
        startCamera(facingMode);
      }
      playSound('pop');
    }

    setDraggingElement(null);
    setIsOverTrash(false);
    touchStartDistRef.current = null;
  };

  // Submit & Publish Vibe Story
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;

    if (!caption.trim() && !mediaUrl && !selectedSong && stickersList.length === 0) {
      setError('Please add a photo, video, text or music to publish!');
      return;
    }

    setSubmitting(true);
    setError('');

    let finalMediaUrl = mediaUrl;
    const isVideo = (mediaType === 'video') ||
      Boolean(selectedMediaFile && (selectedMediaFile.type?.startsWith('video/') || selectedMediaFile.type?.includes('video') || selectedMediaFile.name?.match(/\.(mp4|webm|mov|ogg|m4v|3gp|mkv)($|\?)/i))) ||
      Boolean(mediaUrl && (mediaUrl.includes('/video/') || mediaUrl.match(/\.(mp4|webm|mov|ogg|m4v|3gp|mkv)($|\?)/i) || mediaUrl.startsWith('data:video')));

    // Direct Cloudinary Edge Upload (zero load on Render backend!)
    if (selectedMediaFile) {
      try {
        const cdnUrl = await uploadMediaDirect(selectedMediaFile, 'pulsechat_vibes', token, isVideo);
        if (cdnUrl) finalMediaUrl = cdnUrl;
      } catch (err) {
        console.warn('Direct media upload fallback:', err);
      }
    } else if (mediaUrl && (mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:'))) {
      try {
        const cdnUrl = await uploadMediaDirect(mediaUrl, 'pulsechat_vibes', token, isVideo);
        if (cdnUrl) finalMediaUrl = cdnUrl;
      } catch (err) {
        console.warn('Direct media upload fallback:', err);
      }
    }

    const calculatedMediaType = isVideo ? 'video' : 'image';
    const vibeId = 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const createdVibe = {
      id: vibeId,
      userId: user?.id || user?._id || 'local_user',
      username: user?.username || 'you',
      displayName: user?.displayName || user?.username || 'You',
      avatar: user?.avatar,
      caption: caption.trim(),
      mediaUrl: finalMediaUrl || null,
      mediaType: calculatedMediaType,
      textBgStyle,
      textColor,
      soundtrack: selectedSong ? 'music_track' : (isVideo ? 'original' : 'none'),
      songTitle: selectedSong ? selectedSong.songTitle : '',
      artistName: selectedSong ? selectedSong.artistName : '',
      albumArt: selectedSong ? selectedSong.albumArt : '',
      audioUrl: selectedSong ? selectedSong.audioUrl : '',
      youtubeId: selectedSong ? selectedSong.youtubeId : '',
      songStartTime: selectedSong ? (songStartTime || 0) : 0,
      storyDuration: isVideo ? 15 : Number(storyDuration) || 15,
      bgGradient: selectedGradient,
      textStyle3D,
      animatedBg,
      textPos,
      musicPos,
      musicScale: Number(musicScale) || 1.0,
      musicStyle: musicStyle || 'pill',
      imagePos: { x: imagePos.x, y: imagePos.y },
      imageFit: 'cover',
      imageZoom,
      imageFilter,
      textSize,
      textAlign,
      selectedStickers: stickersList.map(s => s.emoji),
      stickersData: stickersList,
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
          body: JSON.stringify(createdVibe)
        });
      } catch (err) {
        console.warn('Server vibe post error:', err);
      }
    }

    // Save to local cache
    try {
      const rawLocal = localStorage.getItem('pulsechat_local_vibes');
      const localList = rawLocal ? JSON.parse(rawLocal) : [];
      localList.unshift(createdVibe);
      localStorage.setItem('pulsechat_local_vibes', JSON.stringify(localList));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('pulsechat_vibes_updated'));
    setSubmitting(false);
    if (onCreated) onCreated();
    stopCameraStream();
    onClose();
  };

  const hasContent = Boolean(caption.trim() || mediaUrl || selectedSong || stickersList.length > 0);

  return (
    <div
      ref={stageRef}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1400,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onClick={(e) => { e.target.value = null; }}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* =========================================================================
          BACKGROUND / MEDIA / CAMERA SURFACE (Full Screen Edge-to-Edge)
      ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: selectedGradient,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => {
          if (!caption.trim() && !isEditingText) {
            setIsEditingText(true);
            setTimeout(() => textInputRef.current?.focus(), 50);
          }
        }}
      >
        {/* Live Camera View */}
        {viewMode === 'camera' && (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                el.srcObject = cameraStreamRef.current;
                el.play().catch(() => {});
              }
            }}
            playsInline
            muted
            autoPlay
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
            }}
          />
        )}

        {/* Uploaded Media View (Photo or Video with sound) */}
        {viewMode === 'media' && mediaUrl && (
          mediaType === 'video' ? (
            <video
              ref={previewVideoRef}
              key={`preview_vid_${mediaUrl}`}
              src={mediaUrl}
              autoPlay
              loop
              playsInline
              webkit-playsinline="true"
              preload="auto"
              muted={isVideoMuted}
              onLoadedData={() => {
                const vid = previewVideoRef.current;
                if (!vid) return;
                vid.volume = 1.0;
                vid.muted = isVideoMuted;
                const p = vid.play();
                if (p !== undefined) {
                  p.catch(() => {
                    vid.muted = true;
                    setIsVideoMuted(true);
                    setShowUnmuteHint(true);
                    vid.play().catch(() => {});
                  });
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: IMAGE_FILTERS.find(f => f.id === imageFilter)?.css || 'none',
                transform: `scale(${imageZoom})`
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: IMAGE_FILTERS.find(f => f.id === imageFilter)?.css || 'none',
                transform: `scale(${imageZoom})`
              }}
            />
          )
        )}

        {/* Animated Wallpaper if selected */}
        {animatedBg !== 'none' && <ChatLiveWallpaper wallpaperId={animatedBg} />}
      </div>

      {/* =========================================================================
          TOP ROW (Exact Layout Matching Screenshot 1)
          - Left: [X] Close/Discard, Camera Switch
          - Right: [Aa] Text, [🎵] Music, [🎨] Palette, [✨] Filters, [😊] Stickers
      ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          left: '16px',
          right: '16px',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: isEditingText ? 'none' : 'auto',
          opacity: isEditingText ? 0 : 1,
          transition: 'opacity 0.2s ease'
        }}
      >
        {/* Left Side: Close and Flip Camera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>

          {viewMode === 'camera' && (
            <button
              type="button"
              onClick={handleToggleCameraFacing}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <SwitchCamera size={19} />
            </button>
          )}
        </div>

        {/* Right Side: Circular Tools Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Sound / Volume Mute Toggle (Shown when a video is loaded, identical to Instagram Stories) */}
          {viewMode === 'media' && mediaType === 'video' && (
            <button
              type="button"
              onClick={toggleVideoMute}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: isVideoMuted ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)',
                backdropFilter: 'blur(12px)',
                border: isVideoMuted ? '1.5px solid #f87171' : '1.5px solid #34d399',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isVideoMuted ? 'none' : '0 0 12px rgba(16, 185, 129, 0.5)'
              }}
              title={isVideoMuted ? 'Unmute Story Video' : 'Mute Story Video'}
            >
              {isVideoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}

          {/* Aa (Text) */}
          <button
            type="button"
            onClick={() => {
              setIsEditingText(true);
              setTimeout(() => textInputRef.current?.focus(), 50);
            }}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: caption ? 'rgba(99, 102, 241, 0.45)' : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: caption ? '1.5px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '1rem'
            }}
            title="Add Text"
          >
            Aa
          </button>

          {/* 🎵 (Music) */}
          <button
            type="button"
            onClick={() => setShowMusicPicker(true)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: selectedSong ? 'rgba(16, 185, 129, 0.45)' : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: selectedSong ? '1.5px solid #34d399' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Add Music"
          >
            <Music size={18} />
          </button>

          {/* 🎨 (Palette / Gradients) */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'bg_color' ? null : 'bg_color')}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: activePanel === 'bg_color' ? 'rgba(249, 115, 22, 0.45)' : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: activePanel === 'bg_color' ? '1.5px solid #fb923c' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Colors & Gradients"
          >
            <Palette size={18} />
          </button>

          {/* ✨ (Filters / Effects - Glowing Violet Pill like Image 1) */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'filters' ? null : 'filters')}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: imageFilter !== 'none' || activePanel === 'filters'
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: imageFilter !== 'none' || activePanel === 'filters'
                ? '2px solid #c084fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: imageFilter !== 'none' || activePanel === 'filters'
                ? '0 0 16px rgba(139, 92, 246, 0.65)'
                : 'none'
            }}
            title="Filters & Effects"
          >
            <Sparkles size={18} />
          </button>

          {/* 😊 (Stickers / Emojis) */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'stickers' ? null : 'stickers')}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: activePanel === 'stickers' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              border: activePanel === 'stickers' ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Add Stickers"
          >
            <Smile size={18} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE ON-SCREEN ELEMENTS (Hand Dragged & Pinched)
      ========================================================================= */}

      {/* 1. Main Text (Draggable formatted text - rendered ONLY when caption has text, zero placeholder) */}
      {!isEditingText && caption.trim() && (
        <div
          onMouseDown={(e) => handleElementTouchStart('text', e)}
          onTouchStart={(e) => handleElementTouchStart('text', e)}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingText(true);
            setTimeout(() => textInputRef.current?.focus(), 50);
          }}
          style={{
            position: 'absolute',
            left: `${textPos.x}%`,
            top: `${textPos.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 45,
            cursor: 'grab',
            touchAction: 'none',
            maxWidth: '85vw',
            textAlign
          }}
        >
          <div
            className={textStyle3D !== 'none' ? textStyle3D : ''}
            style={{
              fontSize: `${textSize}rem`,
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.35,
              background: textBgStyle === 'box' ? 'rgba(0, 0, 0, 0.65)' : 'transparent',
              backdropFilter: textBgStyle === 'box' ? 'blur(10px)' : 'none',
              padding: textBgStyle === 'box' ? '10px 18px' : '4px 8px',
              borderRadius: '16px',
              textShadow: textStyle3D === 'none' ? '0 2px 14px rgba(0,0,0,0.85)' : 'none',
              wordBreak: 'break-word',
              border: textBgStyle === 'box' ? '1px solid rgba(255,255,255,0.18)' : 'none'
            }}
          >
            {caption}
          </div>
        </div>
      )}

      {/* Floating Unmute Hint if autoplay blocked audio */}
      {viewMode === 'media' && mediaType === 'video' && isVideoMuted && showUnmuteHint && (
        <div
          onClick={toggleVideoMute}
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 65,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
          }}
        >
          <VolumeX size={15} color="#f87171" />
          <span>Tap for sound 🔊</span>
        </div>
      )}

      {/* 2. Draggable Music Badge */}
      {selectedSong && !isEditingText && (
        <div
          onMouseDown={(e) => handleElementTouchStart('music', e)}
          onTouchStart={(e) => handleElementTouchStart('music', e)}
          onClick={(e) => {
            e.stopPropagation();
            const styles = ['pill', 'card', 'minimal'];
            const nextIdx = (styles.indexOf(musicStyle) + 1) % styles.length;
            setMusicStyle(styles[nextIdx]);
          }}
          style={{
            position: 'absolute',
            left: `${musicPos.x}%`,
            top: `${musicPos.y}%`,
            transform: `translate(-50%, -50%) scale(${musicScale})`,
            zIndex: 45,
            cursor: 'grab',
            touchAction: 'none'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
              color: '#ffffff'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Music size={13} color="#fff" />
            </div>
            <div style={{ textAlign: 'left', maxWidth: '180px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedSong.songTitle}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedSong.artistName || 'Pulse Music'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Draggable Emojis / Stickers */}
      {!isEditingText && stickersList.map((st) => (
        <div
          key={st.id}
          onMouseDown={(e) => handleElementTouchStart(st.id, e)}
          onTouchStart={(e) => handleElementTouchStart(st.id, e)}
          style={{
            position: 'absolute',
            left: `${st.x}%`,
            top: `${st.y}%`,
            transform: `translate(-50%, -50%) scale(${st.scale || 1.3})`,
            fontSize: '2.8rem',
            zIndex: 45,
            cursor: 'grab',
            touchAction: 'none',
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6))'
          }}
        >
          {st.emoji}
        </div>
      ))}

      {/* =========================================================================
          FULL-SCREEN TEXT EDITING OVERLAY (Direct On-Screen Keyboard Mode)
      ========================================================================= */}
      {isEditingText && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 20px'
          }}
          onClick={() => setIsEditingText(false)}
        >
          {/* Top Options Bar */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Box highlight toggle */}
            <button
              type="button"
              onClick={() => setTextBgStyle(textBgStyle === 'box' ? 'none' : 'box')}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                background: textBgStyle === 'box' ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                color: textBgStyle === 'box' ? '#000000' : '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Highlight
            </button>

            {/* Done button */}
            <button
              type="button"
              onClick={() => setIsEditingText(false)}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                fontWeight: 900,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>

          {/* Center Text Area */}
          <textarea
            ref={textInputRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Type your vibe..."
            rows={4}
            style={{
              width: '90%',
              maxWidth: '380px',
              background: textBgStyle === 'box' ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
              border: 'none',
              outline: 'none',
              color: textColor,
              fontSize: '1.6rem',
              fontWeight: 800,
              textAlign,
              lineHeight: 1.35,
              resize: 'none',
              padding: textBgStyle === 'box' ? '12px 18px' : '4px',
              borderRadius: '18px'
            }}
          />

          {/* Bottom 3D Typography & Colors Selector */}
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 3D Typography styles */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 0' }}>
              {TEXT_STYLES_3D.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTextStyle3D(t.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    background: textStyle3D === t.id ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: textStyle3D === t.id ? '1.5px solid #ffffff' : '1px solid transparent',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Color circles */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {['#ffffff', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#ef4444', '#a855f7'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColor(c)}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: c,
                    border: textColor === c ? '2.5px solid #ffffff' : '1px solid rgba(0, 0, 0, 0.4)',
                    boxShadow: textColor === c ? '0 0 10px rgba(255, 255, 255, 0.8)' : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TRASH BIN (Instagram Drop to Delete)
      ========================================================================= */}
      {draggingElement && (
        <div
          style={{
            position: 'absolute',
            bottom: '90px',
            left: '50%',
            transform: `translateX(-50%) scale(${isOverTrash ? 1.25 : 1})`,
            zIndex: 70,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            transition: 'transform 0.15s ease',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: isOverTrash ? '#ef4444' : 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(12px)',
              border: isOverTrash ? '2px solid #fecaca' : '1.5px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isOverTrash ? '0 0 24px rgba(239, 68, 68, 0.8)' : '0 4px 16px rgba(0, 0, 0, 0.5)'
            }}
          >
            <Trash2 size={22} />
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ffffff', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
            Drag here to delete
          </span>
        </div>
      )}

      {/* =========================================================================
          FLOATING TOOL DRAWERS (Filters, Palette, Stickers)
      ========================================================================= */}
      {activePanel === 'filters' && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '16px',
            right: '16px',
            zIndex: 65,
            background: 'rgba(10, 10, 15, 0.88)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '12px 16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          {IMAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setImageFilter(f.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '16px',
                background: imageFilter === f.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255, 255, 255, 0.1)',
                border: imageFilter === f.id ? '1.5px solid #c084fc' : 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activePanel === 'bg_color' && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '16px',
            right: '16px',
            zIndex: 65,
            background: 'rgba(10, 10, 15, 0.88)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '12px 16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          {GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setSelectedGradient(g.value);
                if (viewMode === 'camera') {
                  stopCameraStream();
                  setViewMode('canvas');
                }
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: g.value,
                border: selectedGradient === g.value ? '2.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: selectedGradient === g.value ? '0 0 12px rgba(255, 255, 255, 0.8)' : 'none',
                cursor: 'pointer',
                flexShrink: 0
              }}
            />
          ))}
        </div>
      )}

      {activePanel === 'stickers' && (
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '16px',
            right: '16px',
            maxHeight: '260px',
            zIndex: 65,
            background: 'rgba(10, 10, 15, 0.92)',
            backdropFilter: 'blur(24px)',
            borderRadius: '22px',
            padding: '14px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>✨ Tap emoji to stick</span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: '190px'
            }}
          >
            {ALL_EMOJIS.slice(0, 42).map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddEmojiSticker(emoji)}
                style={{
                  fontSize: '1.6rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          BOTTOM BAR (Exact Match to Screenshot 1)
          - Left: Cancel Pill Button
          - Right: Glowing Instagram "Your Vibe ⚡ ▷" Pill Button with Avatar
      ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          bottom: 'max(24px, env(safe-area-inset-bottom))',
          left: '20px',
          right: '20px',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: isEditingText ? 'none' : 'auto',
          opacity: isEditingText ? 0 : 1,
          transition: 'opacity 0.2s ease'
        }}
      >
        {/* If Camera is active and no media captured yet, show camera shutter in center */}
        {viewMode === 'camera' && !mediaUrl ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            {/* Gallery icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Gallery"
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Take Photo"
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#ffffff'
                }}
              />
            </button>

            {/* Flip Camera */}
            <button
              type="button"
              onClick={handleToggleCameraFacing}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Flip Camera"
            >
              <SwitchCamera size={22} />
            </button>
          </div>
        ) : (
          /* Normal State (Matching Screenshot 1): Cancel on left, Your Vibe ⚡ on right */
          <>
            {/* Left: Cancel Pill Button */}
            <button
              type="button"
              onClick={() => {
                if (mediaUrl || caption) {
                  setMediaUrl('');
                  setSelectedMediaFile(null);
                  setCaption('');
                  setStickersList([]);
                  setSelectedSong(null);
                  startCamera(facingMode);
                } else {
                  onClose();
                }
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.16)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.94rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            {/* Right: Instagram Story Pill ("Your Vibe ⚡ ▷") */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 18px 7px 7px',
                borderRadius: '30px',
                background: 'linear-gradient(90deg, #ec4899 0%, #f43f5e 50%, #f59e0b 100%)',
                boxShadow: '0 6px 24px rgba(236, 72, 153, 0.55)',
                border: 'none',
                color: '#ffffff',
                cursor: submitting ? 'wait' : 'pointer',
                transform: submitting ? 'scale(0.96)' : 'scale(1)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* User Avatar Circle */}
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #ffffff'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#ec4899',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.9rem'
                  }}
                >
                  {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
                </div>
              )}

              {/* Text & Icon */}
              <span style={{ fontSize: '0.96rem', fontWeight: 800, letterSpacing: '0.2px' }}>
                {submitting ? 'Sharing...' : 'Your Vibe ⚡'}
              </span>

              {/* Send Arrow / Paper plane icon */}
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} fill="#ffffff" style={{ transform: 'rotate(15deg)' }} />
              )}
            </button>
          </>
        )}
      </div>

      {/* Music Picker Modal */}
      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelectSong={(song) => {
          setSelectedSong(song);
          setShowMusicPicker(false);
          playSound('pop');
        }}
        selectedSong={selectedSong}
      />
    </div>
  );
}
