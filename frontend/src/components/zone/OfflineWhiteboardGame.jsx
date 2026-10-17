import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Download, RotateCcw, Trash2, Edit3, Palette, Check, Sparkles } from 'lucide-react';

const COLORS = [
  '#ffffff', // White
  '#a855f7', // Neon Purple
  '#38bdf8', // Neon Cyan
  '#10b981', // Emerald Green
  '#f59e0b', // Amber / Gold
  '#ef4444', // Crimson Red
  '#ec4899', // Hot Pink
  '#6366f1'  // Indigo
];

const STROKE_WIDTHS = [
  { label: 'S', size: 3 },
  { label: 'M', size: 6 },
  { label: 'L', size: 12 },
  { label: 'XL', size: 22 }
];

export default function OfflineWhiteboardGame({ onScoreUpdate, onBack }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef([]);

  const [currentColor, setCurrentColor] = useState('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Initialize canvas size to match container
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width || 380);
    const height = Math.min(Math.floor(rect.height || 460), 520);

    // Save existing drawing if resizing
    let existingData = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        existingData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {}
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set dark background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    if (existingData) {
      try {
        ctx.putImageData(existingData, 0, 0);
      } catch (e) {}
    } else {
      // Save initial clean blank state into history
      saveHistorySnapshot();
    }
  }, []);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [initCanvas]);

  const saveHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(snap);
      if (historyRef.current.length > 20) {
        historyRef.current.shift();
      }
      setCanUndo(historyRef.current.length > 1);
    } catch (e) {}
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (e) => {
    const coords = getCoordinates(e);
    isDrawingRef.current = true;
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? '#090d16' : currentColor;
    ctx.fill();
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCoordinates(e);
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = isEraser ? '#090d16' : currentColor;
    ctx.lineWidth = isEraser ? strokeWidth * 2.5 : strokeWidth;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const handlePointerUp = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveHistorySnapshot();
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    historyRef.current.pop(); // remove current state
    const prevSnapshot = historyRef.current[historyRef.current.length - 1];
    if (prevSnapshot) {
      const ctx = canvas.getContext('2d');
      ctx.putImageData(prevSnapshot, 0, 0);
    }
    setCanUndo(historyRef.current.length > 1);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, rect.width, rect.height);
    saveHistorySnapshot();
  };

  // Direct download to phone gallery or computer Downloads
  const handleSaveToDevice = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `pulsechat-art-${Date.now().toString().slice(-6)}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onScoreUpdate) {
        onScoreUpdate('Creative Artist', 15, 1);
      }
    } catch (e) {
      console.error('Failed to export canvas image:', e);
    }
  };

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      color: '#f8fafc',
      userSelect: 'none'
    }}>
      {/* Top Controls Toolbar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '10px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        {/* Colors Palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setCurrentColor(c); setIsEraser(false); }}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: c,
                border: (!isEraser && currentColor === c) ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                transform: (!isEraser && currentColor === c) ? 'scale(1.2)' : 'scale(1)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
                boxShadow: (!isEraser && currentColor === c) ? `0 0 10px ${c}` : 'none'
              }}
            />
          ))}

          {/* Eraser button */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            style={{
              padding: '4px 10px',
              borderRadius: '10px',
              border: isEraser ? '1.5px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.15)',
              background: isEraser ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              color: isEraser ? '#ec4899' : '#94a3b8',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🧹 Eraser
          </button>
        </div>

        {/* Stroke Sizes & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {STROKE_WIDTHS.map((sw) => (
            <button
              key={sw.label}
              onClick={() => setStrokeWidth(sw.size)}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                border: strokeWidth === sw.size ? '1.5px solid var(--accent, #6366f1)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: strokeWidth === sw.size ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                color: strokeWidth === sw.size ? '#fff' : '#94a3b8',
                fontWeight: 800,
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
            >
              {sw.label}
            </button>
          ))}

          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              padding: '5px 9px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: canUndo ? '#cbd5e1' : '#475569',
              cursor: canUndo ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            <RotateCcw size={12} /> Undo
          </button>

          <button
            onClick={handleClear}
            style={{
              padding: '5px 9px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      {/* Canvas Drawing Surface */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          minHeight: '380px',
          height: '420px',
          background: '#090d16',
          borderRadius: '18px',
          border: '1.5px solid rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.4)',
          touchAction: 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            display: 'block',
            cursor: isEraser ? 'crosshair' : 'default',
            touchAction: 'none'
          }}
        />

        {/* Subtle Watermark hint */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '14px',
          pointerEvents: 'none',
          opacity: 0.28,
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#cbd5e1'
        }}>
          🎨 Pulse Art Studio • 100% Offline
        </div>
      </div>

      {/* Bottom Action Bar: Save to Device */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 4px'
      }}>
        <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
          Draw freely • Tap below to download directly to your device
        </div>

        <button
          onClick={handleSaveToDevice}
          style={{
            background: saveSuccess
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #38bdf8, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            padding: '10px 20px',
            fontWeight: 800,
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: saveSuccess
              ? '0 4px 16px rgba(16, 185, 129, 0.45)'
              : '0 4px 16px rgba(56, 189, 248, 0.35)',
            transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)'
          }}
        >
          {saveSuccess ? (
            <>
              <Check size={16} /> Saved to Device!
            </>
          ) : (
            <>
              <Download size={16} /> Save to Device (PNG)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
