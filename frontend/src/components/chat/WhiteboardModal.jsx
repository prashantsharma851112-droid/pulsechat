import React, { useRef, useState, useEffect, useContext } from 'react';
import {
  X, Eraser, RotateCcw, RotateCw, Paintbrush, Send, Sparkles,
  Square, Circle, Minus, MoveUpRight, Triangle, Smile, Sliders, Undo2
} from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';

const PALETTE_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#ffffff', '#94a3b8', '#000000'
];

const STICKERS = ['🔥', '❤️', '⭐', '🚀', '🎉', '💡', '🐼', '👑', '🎯', '💯', '👻', '🎨', '⚡', '👍'];

const SHAPES = [
  { id: 'rectangle', name: 'Rectangle', icon: Square },
  { id: 'circle', name: 'Circle', icon: Circle },
  { id: 'line', name: 'Line', icon: Minus },
  { id: 'arrow', name: 'Arrow', icon: MoveUpRight },
  { id: 'triangle', name: 'Triangle', icon: Triangle }
];

export default function WhiteboardModal({ onClose, chatTitle, chatId, onSendDrawing }) {
  const { socket } = useContext(SocketContext);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ xRatio: 0, yRatio: 0 });
  const startPosRef = useRef({ x: 0, y: 0, xRatio: 0, yRatio: 0 });
  const snapshotRef = useRef(null);
  const clearedDataUrlRef = useRef(null);

  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'shape' | 'sticker'
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [selectedSticker, setSelectedSticker] = useState('🔥');
  const [showStickersMenu, setShowStickersMenu] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [canRestore, setCanRestore] = useState(false);

  // Draw shape onto canvas context
  const drawShapeOnContext = (ctx, shapeType, x0, y0, x1, y1, strokeColor, strokeWidth) => {
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shapeType === 'rectangle') {
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (shapeType === 'circle') {
      const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
      ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shapeType === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (shapeType === 'arrow') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Draw Arrow Head
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const headLen = Math.max(12, strokeWidth * 3);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (shapeType === 'triangle') {
      ctx.moveTo(x0, y1);
      ctx.lineTo((x0 + x1) / 2, y0);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.stroke();
    }
  };

  // Draw sticker emoji onto canvas context
  const drawStickerOnContext = (ctx, emoji, x, y) => {
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
  };

  // Initialize Canvas & Socket listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.parentElement.clientWidth || 640;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (socket && chatId) {
      socket.emit('wb_join', { chatId });

      const handleRemoteDraw = (stroke) => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        const w = c.width;
        const h = c.height;

        context.beginPath();
        context.strokeStyle = stroke.tool === 'eraser' ? '#0f172a' : stroke.color;
        context.lineWidth = stroke.tool === 'eraser' ? stroke.lineWidth * 3 : stroke.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        context.moveTo(stroke.x0 * w, stroke.y0 * h);
        context.lineTo(stroke.x1 * w, stroke.y1 * h);
        context.stroke();
      };

      const handleRemoteShape = (shape) => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        const w = c.width;
        const h = c.height;

        drawShapeOnContext(
          context,
          shape.shapeType,
          shape.x0 * w,
          shape.y0 * h,
          shape.x1 * w,
          shape.y1 * h,
          shape.color,
          shape.lineWidth
        );
      };

      const handleRemoteSticker = (sticker) => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        const w = c.width;
        const h = c.height;

        drawStickerOnContext(context, sticker.emoji, sticker.xRatio * w, sticker.yRatio * h);
      };

      const handleRemoteClear = () => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.fillStyle = '#0f172a';
        context.fillRect(0, 0, c.width, c.height);
      };

      const handleRemoteRestore = ({ boardDataUrl }) => {
        if (!boardDataUrl) return;
        const c = canvasRef.current;
        if (!c) return;
        const img = new Image();
        img.onload = () => {
          const context = c.getContext('2d');
          context.drawImage(img, 0, 0, c.width, c.height);
        };
        img.src = boardDataUrl;
      };

      socket.on('wb_draw', handleRemoteDraw);
      socket.on('wb_shape', handleRemoteShape);
      socket.on('wb_sticker', handleRemoteSticker);
      socket.on('wb_clear', handleRemoteClear);
      socket.on('wb_restore', handleRemoteRestore);

      return () => {
        socket.off('wb_draw', handleRemoteDraw);
        socket.off('wb_shape', handleRemoteShape);
        socket.off('wb_sticker', handleRemoteSticker);
        socket.off('wb_clear', handleRemoteClear);
        socket.off('wb_restore', handleRemoteRestore);
      };
    }
  }, [socket, chatId]);

  const drawLineLocallyAndEmit = (x0Ratio, y0Ratio, x1Ratio, y1Ratio, strokeTool, strokeColor, strokeWidth) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.strokeStyle = strokeTool === 'eraser' ? '#0f172a' : strokeColor;
    ctx.lineWidth = strokeTool === 'eraser' ? strokeWidth * 3 : strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(x0Ratio * w, y0Ratio * h);
    ctx.lineTo(x1Ratio * w, y1Ratio * h);
    ctx.stroke();

    if (socket && chatId) {
      socket.emit('wb_draw', {
        chatId,
        stroke: {
          x0: x0Ratio,
          y0: y0Ratio,
          x1: x1Ratio,
          y1: y1Ratio,
          color: strokeColor,
          lineWidth: strokeWidth,
          tool: strokeTool
        }
      });
    }
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, xRatio: 0, yRatio: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return {
      x,
      y,
      xRatio: Math.max(0, Math.min(1, x / canvas.width)),
      yRatio: Math.max(0, Math.min(1, y / canvas.height))
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);

    if (tool === 'sticker') {
      const ctx = canvas.getContext('2d');
      drawStickerOnContext(ctx, selectedSticker, coords.x, coords.y);

      if (socket && chatId) {
        socket.emit('wb_sticker', {
          chatId,
          sticker: {
            xRatio: coords.xRatio,
            yRatio: coords.yRatio,
            emoji: selectedSticker
          }
        });
      }
      return;
    }

    isDrawingRef.current = true;
    lastPosRef.current = coords;
    startPosRef.current = coords;

    if (tool === 'shape') {
      const ctx = canvas.getContext('2d');
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentCoords = getCanvasCoords(e);

    if (tool === 'pen' || tool === 'eraser') {
      const prevCoords = lastPosRef.current;
      drawLineLocallyAndEmit(
        prevCoords.xRatio,
        prevCoords.yRatio,
        currentCoords.xRatio,
        currentCoords.yRatio,
        tool,
        color,
        lineWidth
      );
      lastPosRef.current = currentCoords;
    } else if (tool === 'shape' && snapshotRef.current) {
      // Live preview shape during drag
      ctx.putImageData(snapshotRef.current, 0, 0);
      drawShapeOnContext(
        ctx,
        selectedShape,
        startPosRef.current.x,
        startPosRef.current.y,
        currentCoords.x,
        currentCoords.y,
        color,
        lineWidth
      );
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === 'shape' && e) {
      const currentCoords = getCanvasCoords(e);
      const start = startPosRef.current;
      const ctx = canvas.getContext('2d');

      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }

      drawShapeOnContext(
        ctx,
        selectedShape,
        start.x,
        start.y,
        currentCoords.x,
        currentCoords.y,
        color,
        lineWidth
      );

      if (socket && chatId) {
        socket.emit('wb_shape', {
          chatId,
          shape: {
            shapeType: selectedShape,
            x0: start.xRatio,
            y0: start.yRatio,
            x1: currentCoords.xRatio,
            y1: currentCoords.yRatio,
            color,
            lineWidth
          }
        });
      }
    }
    snapshotRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Save backup snapshot before wiping canvas
      clearedDataUrlRef.current = canvas.toDataURL('image/png');
      setCanRestore(true);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (socket && chatId) {
      socket.emit('wb_clear', { chatId });
    }
  };

  const restoreCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !clearedDataUrlRef.current) return;

    const dataUrl = clearedDataUrlRef.current;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (socket && chatId) {
        socket.emit('wb_restore', { chatId, boardDataUrl: dataUrl });
      }
    };
    img.src = dataUrl;
    setCanRestore(false);
  };

  const handleSendToChat = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onSendDrawing) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSendDrawing(dataUrl);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '760px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paintbrush size={20} color="var(--accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                Pro Whiteboard — {chatTitle || 'Board'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Real-Time Multi-User Drawing, Shapes & Stickers
              </span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Main Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '14px', flexWrap: 'wrap', border: '1px solid var(--border)' }}>
            {/* Tool Selector Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className={`icon-btn-ghost ${tool === 'pen' ? 'active-mic' : ''}`}
                onClick={() => { setTool('pen'); setShowShapesMenu(false); setShowStickersMenu(false); }}
                title="Pen Tool"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Paintbrush size={16} /> Pen
              </button>

              <button
                className={`icon-btn-ghost ${tool === 'eraser' ? 'active-mic' : ''}`}
                onClick={() => { setTool('eraser'); setShowShapesMenu(false); setShowStickersMenu(false); }}
                title="Eraser Tool"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eraser size={16} /> Eraser
              </button>

              {/* Shapes Tool Button */}
              <button
                className={`icon-btn-ghost ${tool === 'shape' ? 'active-mic' : ''}`}
                onClick={() => {
                  setTool('shape');
                  setShowShapesMenu(!showShapesMenu);
                  setShowStickersMenu(false);
                }}
                title="Shapes Tool"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Square size={16} /> Shapes
              </button>

              {/* Stickers Tool Button */}
              <button
                className={`icon-btn-ghost ${tool === 'sticker' ? 'active-mic' : ''}`}
                onClick={() => {
                  setTool('sticker');
                  setShowStickersMenu(!showStickersMenu);
                  setShowShapesMenu(false);
                }}
                title="Sticker Stamp Tool"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Smile size={16} /> Stickers ({selectedSticker})
              </button>
            </div>

            {/* Stroke Width Slider & Clear / Send Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <Sliders size={14} /> Size:
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={lineWidth}
                  onChange={e => setLineWidth(Number(e.target.value))}
                  style={{ width: '60px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '16px' }}>{lineWidth}px</span>
              </div>

              <button className="icon-btn-ghost" onClick={clearCanvas} title="Clear Board (Wipe Canvas)" style={{ color: '#ef4444' }}>
                <RotateCcw size={18} />
              </button>

              {canRestore && (
                <button
                  onClick={restoreCanvas}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '8px',
                    padding: '5px 11px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title="Undo Clear / Restore Accidental Reset"
                >
                  <RotateCw size={14} /> Restore Board
                </button>
              )}

              {onSendDrawing && (
                <button onClick={handleSendToChat} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '10px' }}>
                  <Send size={14} /> Send to Chat
                </button>
              )}
            </div>
          </div>

          {/* Shapes Selection Sub-Bar */}
          {showShapesMenu && (
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-sidebar)', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Choose Shape:</span>
              {SHAPES.map(s => {
                const IconComp = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedShape(s.id); setTool('shape'); }}
                    style={{
                      background: selectedShape === s.id && tool === 'shape' ? 'var(--accent)' : 'var(--bg-card)',
                      color: selectedShape === s.id && tool === 'shape' ? '#fff' : 'var(--text-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <IconComp size={14} /> {s.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stickers Selection Sub-Bar */}
          {showStickersMenu && (
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-sidebar)', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center', overflowX: 'auto' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Pick Sticker to Stamp:</span>
              {STICKERS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { setSelectedSticker(emoji); setTool('sticker'); }}
                  style={{
                    background: selectedSticker === emoji && tool === 'sticker' ? 'var(--accent)' : 'rgba(0,0,0,0.2)',
                    border: selectedSticker === emoji && tool === 'sticker' ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  title={`Stamp ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Expanded Colors Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '4px 0' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Colors:</span>
            {PALETTE_COLORS.map(c => (
              <div
                key={c}
                onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  border: color === c && tool !== 'eraser' ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: color === c && tool !== 'eraser' ? '0 0 8px ' + c : 'none',
                  transition: 'transform 0.15s ease'
                }}
              />
            ))}

            {/* Custom Color Input Picker */}
            <label style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px' }} title="Custom Color Picker">
              <input
                type="color"
                value={color}
                onChange={e => { setColor(e.target.value); if (tool === 'eraser') setTool('pen'); }}
                style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent' }}
              />
            </label>
          </div>

          {/* Accidental Clear Restore Banner */}
          {canRestore && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '10px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#f87171' }}>
              <span>⚠️ Board was cleared. Want to bring back your drawing?</span>
              <button
                onClick={restoreCanvas}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RotateCw size={13} /> Restore Drawing
              </button>
            </div>
          )}

          {/* Canvas Board Container */}
          <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                cursor: tool === 'eraser' ? 'cell' : tool === 'sticker' ? 'pointer' : 'crosshair',
                display: 'block',
                touchAction: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
