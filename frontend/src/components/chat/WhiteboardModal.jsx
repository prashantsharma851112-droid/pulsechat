import React, { useRef, useState, useEffect, useContext, useMemo } from 'react';
import {
  X, Eraser, RotateCcw, RotateCw, Paintbrush, Send, Sparkles,
  Square, Circle, Minus, MoveUpRight, Triangle, Smile, Sliders, Undo2, Download, Presentation,
  Type, Trash2, Edit3, Search, Plus
} from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { EMOJI_CATEGORIES, ALL_EMOJIS } from './EmojiPicker';

const PALETTE_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#ffffff', '#94a3b8', '#000000'
];

const STICKERS = ['🔥', '😘', '🤗', '😌', '🫠', '🧐', '🥹', '😃', '😂', '🥰', '😍', '🤔', '🤨' ,'❤️', '⭐', '🚀', '🎉', '💡', '🐼', '👑', '🎯', '💯', '👻', '🎨', '⚡', '👍'];

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

  const containerRef = useRef(null);
  const dragStateRef = useRef(null);
  const textElementsRef = useRef([]);

  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'shape' | 'sticker' | 'text'
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [selectedSticker, setSelectedSticker] = useState('🔥');
  const [showStickersMenu, setShowStickersMenu] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [canRestore, setCanRestore] = useState(false);
  const [savedToDevice, setSavedToDevice] = useState(false);

  // Text Tool State
  const [textElements, setTextElements] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(24);
  const [isTextBold, setIsTextBold] = useState(true);

  // Unlimited Emojis State
  const [stickerSize, setStickerSize] = useState(36);
  const [emojiCategory, setEmojiCategory] = useState('all');
  const [emojiSearch, setEmojiSearch] = useState('');

  useEffect(() => {
    textElementsRef.current = textElements;
  }, [textElements]);

  // Filtered unlimited emojis for sticker picker
  const displayedEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      const q = emojiSearch.trim().toLowerCase();
      return ALL_EMOJIS.filter(e => e.includes(q));
    }
    if (emojiCategory === 'all') {
      return ALL_EMOJIS;
    }
    const cat = EMOJI_CATEGORIES.find(c => c.id === emojiCategory);
    return cat ? cat.emojis : ALL_EMOJIS;
  }, [emojiCategory, emojiSearch]);

  const getExportDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');

      // 1. Draw existing canvas background and strokes
      ctx.drawImage(canvas, 0, 0);

      // 2. Draw all draggable text elements onto the export image
      textElements.forEach(item => {
        const x = item.xRatio * canvas.width;
        const y = item.yRatio * canvas.height;
        const fontSize = item.fontSize || 24;

        ctx.font = `${item.isBold !== false ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
        ctx.fillStyle = item.color || '#ffffff';
        ctx.textBaseline = 'top';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        ctx.fillText(item.text, x, y);
      });

      return tempCanvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error generating export canvas:', err);
      return canvas.toDataURL('image/png');
    }
  };

  const handleSaveToDevice = () => {
    try {
      const dataUrl = getExportDataUrl();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `pulsechat_whiteboard_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSavedToDevice(true);
      setTimeout(() => setSavedToDevice(false), 2000);
    } catch (err) {
      console.error('Error saving whiteboard drawing to device:', err);
    }
  };

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
  const drawStickerOnContext = (ctx, emoji, x, y, size = 36) => {
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
  };

  // Initialize Canvas & Socket listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasDimensions = () => {
      const c = canvasRef.current;
      if (!c || !c.parentElement) return;
      const parentWidth = c.parentElement.clientWidth || 640;
      const isMobile = window.innerWidth < 640;
      const targetHeight = isMobile
        ? Math.max(250, Math.min(340, Math.floor(window.innerHeight * 0.40)))
        : 420;

      // If canvas already has drawings, preserve them during resize
      if (c.width > 0 && c.height > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = c.width;
        tempCanvas.height = c.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(c, 0, 0);

        c.width = parentWidth;
        c.height = targetHeight;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(tempCanvas, 0, 0, c.width, c.height);
      } else {
        c.width = parentWidth;
        c.height = targetHeight;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, c.width, c.height);
      }
    };

    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);

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

        drawStickerOnContext(context, sticker.emoji, sticker.xRatio * w, sticker.yRatio * h, sticker.size || 36);
      };

      const handleRemoteText = (textItem) => {
        if (!textItem) return;
        setTextElements(prev => [...prev.filter(t => t.id !== textItem.id), textItem]);
      };

      const handleRemoteTextUpdate = (textItems) => {
        if (Array.isArray(textItems)) {
          setTextElements(textItems);
        }
      };

      const handleRemoteClear = () => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.fillStyle = '#0f172a';
        context.fillRect(0, 0, c.width, c.height);
        setTextElements([]);
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
      socket.on('wb_text', handleRemoteText);
      socket.on('wb_text_update', handleRemoteTextUpdate);
      socket.on('wb_clear', handleRemoteClear);
      socket.on('wb_restore', handleRemoteRestore);

      return () => {
        window.removeEventListener('resize', updateCanvasDimensions);
        socket.off('wb_draw', handleRemoteDraw);
        socket.off('wb_shape', handleRemoteShape);
        socket.off('wb_sticker', handleRemoteSticker);
        socket.off('wb_text', handleRemoteText);
        socket.off('wb_text_update', handleRemoteTextUpdate);
        socket.off('wb_clear', handleRemoteClear);
        socket.off('wb_restore', handleRemoteRestore);
      };
    }

    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
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
    const touch = (e.touches && e.touches.length > 0)
      ? e.touches[0]
      : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : null);
    const clientX = touch ? touch.clientX : (e.clientX ?? 0);
    const clientY = touch ? touch.clientY : (e.clientY ?? 0);

    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x,
      y,
      xRatio: rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0,
      yRatio: rect.height > 0 ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) : 0
    };
  };

  const handleAddTextAt = (xRatio, yRatio, customText = '') => {
    const textToAdd = customText || textInput.trim() || 'Double-tap to edit';
    const newId = 'wb_txt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTextItem = {
      id: newId,
      text: textToAdd,
      xRatio: Math.max(0.02, Math.min(0.85, xRatio)),
      yRatio: Math.max(0.02, Math.min(0.85, yRatio)),
      color: color || '#ffffff',
      fontSize: textFontSize || 24,
      isBold: isTextBold
    };

    setTextElements(prev => {
      const updated = [...prev, newTextItem];
      if (socket && chatId) {
        socket.emit('wb_text', { chatId, textItem: newTextItem });
      }
      return updated;
    });

    setSelectedTextId(newId);
    setTextInput('');
  };

  const handleUpdateText = (id, newProps) => {
    setTextElements(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...newProps } : t);
      if (socket && chatId) {
        socket.emit('wb_text_update', { chatId, textItems: updated });
      }
      return updated;
    });
  };

  const handleDeleteText = (id, e) => {
    if (e) e.stopPropagation();
    setTextElements(prev => {
      const updated = prev.filter(t => t.id !== id);
      if (socket && chatId) {
        socket.emit('wb_text_update', { chatId, textItems: updated });
      }
      return updated;
    });
    if (selectedTextId === id) setSelectedTextId(null);
    if (editingTextId === id) setEditingTextId(null);
  };

  const handleTextPointerDown = (e, item) => {
    e.stopPropagation();
    setSelectedTextId(item.id);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStateRef.current = {
      id: item.id,
      startX: clientX,
      startY: clientY,
      initialXRatio: item.xRatio,
      initialYRatio: item.yRatio,
      hasMoved: false
    };
  };

  const handleContainerPointerMove = (e) => {
    if (!dragStateRef.current || !containerRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const { id, startX, startY, initialXRatio, initialYRatio } = dragStateRef.current;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaXRatio = (clientX - startX) / rect.width;
    const deltaYRatio = (clientY - startY) / rect.height;

    if (Math.abs(clientX - startX) > 3 || Math.abs(clientY - startY) > 3) {
      dragStateRef.current.hasMoved = true;
    }

    const newXRatio = Math.max(0.01, Math.min(0.92, initialXRatio + deltaXRatio));
    const newYRatio = Math.max(0.01, Math.min(0.92, initialYRatio + deltaYRatio));

    setTextElements(prev => prev.map(t => t.id === id ? { ...t, xRatio: newXRatio, yRatio: newYRatio } : t));
  };

  const handleContainerPointerUp = () => {
    if (dragStateRef.current) {
      if (dragStateRef.current.hasMoved && socket && chatId) {
        socket.emit('wb_text_update', { chatId, textItems: textElementsRef.current });
      }
      dragStateRef.current = null;
    }
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);

    if (tool === 'text') {
      handleAddTextAt(coords.xRatio, coords.yRatio);
      return;
    }

    if (tool === 'sticker') {
      const ctx = canvas.getContext('2d');
      drawStickerOnContext(ctx, selectedSticker, coords.x, coords.y, stickerSize);

      if (socket && chatId) {
        socket.emit('wb_sticker', {
          chatId,
          sticker: {
            xRatio: coords.xRatio,
            yRatio: coords.yRatio,
            emoji: selectedSticker,
            size: stickerSize
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
      clearedDataUrlRef.current = getExportDataUrl();
      setCanRestore(true);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setTextElements([]);
    }
    if (socket && chatId) {
      socket.emit('wb_clear', { chatId });
      socket.emit('wb_text_update', { chatId, textItems: [] });
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
    if (!onSendDrawing) return;
    const dataUrl = getExportDataUrl();
    if (!dataUrl) return;
    onSendDrawing(dataUrl);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '760px', width: '96vw', maxHeight: '94dvh', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Presentation size={20} color="var(--accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Live Drawboard — {chatTitle || 'Board'}
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Real-Time Multi-User Drawing, Shapes & Stickers
              </span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          {/* Main Toolbar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '8px 10px',
            borderRadius: '12px',
            border: '1px solid var(--border)'
          }}>
            {/* Row 1: Tools (Pen, Eraser, Shapes, Stickers) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', width: '100%' }}>
                <button
                  type="button"
                  className={`icon-btn-ghost ${tool === 'pen' ? 'active-mic' : ''}`}
                  onClick={() => { setTool('pen'); setShowShapesMenu(false); setShowStickersMenu(false); }}
                  title="Pen Tool"
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center' }}
                >
                  <Paintbrush size={15} /> <span>Pen</span>
                </button>

                <button
                  type="button"
                  className={`icon-btn-ghost ${tool === 'eraser' ? 'active-mic' : ''}`}
                  onClick={() => { setTool('eraser'); setShowShapesMenu(false); setShowStickersMenu(false); }}
                  title="Eraser Tool"
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center' }}
                >
                  <Eraser size={15} /> <span>Eraser</span>
                </button>

                <button
                  type="button"
                  className={`icon-btn-ghost ${tool === 'shape' ? 'active-mic' : ''}`}
                  onClick={() => {
                    setTool('shape');
                    setShowShapesMenu(!showShapesMenu);
                    setShowStickersMenu(false);
                  }}
                  title="Shapes Tool"
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center' }}
                >
                  <Square size={15} /> <span>Shapes</span>
                </button>

                <button
                  type="button"
                  className={`icon-btn-ghost ${tool === 'text' ? 'active-mic' : ''}`}
                  onClick={() => {
                    setTool('text');
                    setShowShapesMenu(false);
                    setShowStickersMenu(false);
                  }}
                  title="Text Tool — Type & Drag Text"
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center' }}
                >
                  <Type size={15} /> <span>Text</span>
                </button>

                <button
                  type="button"
                  className={`icon-btn-ghost ${tool === 'sticker' ? 'active-mic' : ''}`}
                  onClick={() => {
                    setTool('sticker');
                    setShowStickersMenu(!showStickersMenu);
                    setShowShapesMenu(false);
                  }}
                  title="Unlimited Emojis & Stickers"
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center', whiteSpace: 'nowrap' }}
                >
                  <Smile size={15} /> <span>Stickers</span> <span style={{ fontSize: '1rem', lineHeight: 1 }}>{selectedSticker}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Stroke Width Slider, Clear, Save, Send */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              {/* Left Group: Size Slider & Clear / Restore */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <Sliders size={13} />
                  <span>Size:</span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={lineWidth}
                    onChange={e => setLineWidth(Number(e.target.value))}
                    style={{ width: '48px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '14px', fontSize: '0.75rem' }}>{lineWidth}px</span>
                </div>

                <button
                  type="button"
                  className="icon-btn-ghost"
                  onClick={clearCanvas}
                  title="Clear Board"
                  style={{ color: '#ef4444', padding: '5px' }}
                >
                  <RotateCcw size={16} />
                </button>

                {canRestore && (
                  <button
                    type="button"
                    onClick={restoreCanvas}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="Undo Clear"
                  >
                    <RotateCw size={12} /> Undo
                  </button>
                )}
              </div>

              {/* Right Group: Save to Device & Send to Chat */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleSaveToDevice}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: savedToDevice ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: savedToDevice ? '#10b981' : 'var(--text-main)',
                    border: savedToDevice ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '5px 9px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="Save drawing directly to device"
                >
                  <Download size={13} />
                  <span>{savedToDevice ? 'Saved!' : 'Save'}</span>
                </button>

                {onSendDrawing && (
                  <button
                    type="button"
                    onClick={handleSendToChat}
                    className="btn-primary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Send size={13} /> Send to Chat
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Shapes Selection Sub-Bar */}
          {showShapesMenu && (
            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-sidebar)', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Choose Shape:</span>
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

          {/* Text Tool Sub-Bar */}
          {tool === 'text' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'var(--bg-sidebar)',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              animation: 'pulseModalPop 0.18s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Type size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Add Draggable Text
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  💡 Click on board to place, or drag any text to move!
                </span>
              </div>

              {/* Text Input Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1,
                  minWidth: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '4px 10px'
                }}>
                  <input
                    type="text"
                    placeholder="Type your text here..."
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && textInput.trim()) {
                        handleAddTextAt(0.35, 0.35, textInput.trim());
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: color || '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {textInput && (
                    <button
                      type="button"
                      onClick={() => setTextInput('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Font Size Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Size:</span>
                  {[16, 22, 28, 36, 48].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTextFontSize(s)}
                      style={{
                        padding: '3px 7px',
                        borderRadius: '6px',
                        background: textFontSize === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        color: textFontSize === s ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Add Text Button */}
                <button
                  type="button"
                  onClick={() => handleAddTextAt(0.35, 0.35, textInput.trim() || 'Text')}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={14} /> <span>Place Text</span>
                </button>
              </div>
            </div>
          )}

          {/* Stickers & Unlimited Emojis Sub-Bar */}
          {showStickersMenu && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'var(--bg-sidebar)',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              animation: 'pulseModalPop 0.18s ease'
            }}>
              {/* Header & Size */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smile size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Unlimited Emojis & Stickers
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    Stamp: <span style={{ fontSize: '1rem', lineHeight: 1 }}>{selectedSticker}</span>
                  </span>
                </div>

                {/* Stamp Size Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  <span>Size:</span>
                  {[
                    { label: 'S', size: 28 },
                    { label: 'M', size: 38 },
                    { label: 'L', size: 52 }
                  ].map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStickerSize(s.size)}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: stickerSize === s.size ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                        color: stickerSize === s.size ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.74rem'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search & Categories Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '3px 8px',
                  flex: '1 1 140px'
                }}>
                  <Search size={13} color="var(--text-muted)" style={{ marginRight: '6px' }} />
                  <input
                    type="text"
                    placeholder="Search emojis..."
                    value={emojiSearch}
                    onChange={e => setEmojiSearch(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {emojiSearch && (
                    <button
                      type="button"
                      onClick={() => setEmojiSearch('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px', flex: '2 1 auto' }}>
                  {[
                    { id: 'all', label: 'All 🌟' },
                    { id: 'smileys', label: 'Smileys 😄' },
                    { id: 'hype', label: 'Hype 🔥' },
                    { id: 'love', label: 'Hearts ❤️' },
                    { id: 'gestures', label: 'Gestures 👍' },
                    { id: 'food', label: 'Food 🍕' },
                    { id: 'animals', label: 'Animals 🐶' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setEmojiCategory(cat.id);
                        setEmojiSearch('');
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: emojiCategory === cat.id && !emojiSearch ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        color: emojiCategory === cat.id && !emojiSearch ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Emojis Grid (Unlimited Emojis!) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                gap: '6px',
                maxHeight: '130px',
                overflowY: 'auto',
                padding: '6px 4px',
                background: 'rgba(0, 0, 0, 0.15)',
                borderRadius: '8px'
              }}>
                {displayedEmojis.map((emoji, idx) => (
                  <button
                    key={`${emoji}_${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedSticker(emoji);
                      setTool('sticker');
                    }}
                    style={{
                      background: selectedSticker === emoji && tool === 'sticker' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                      border: selectedSticker === emoji && tool === 'sticker' ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      height: '34px',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.12s ease'
                    }}
                    title={`Stamp ${emoji} on board`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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

          {/* Canvas Board Container with Draggable Text Overlay */}
          <div
            ref={containerRef}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={handleContainerPointerUp}
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              userSelect: 'none'
            }}
          >
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
                cursor: tool === 'eraser' ? 'cell' : tool === 'sticker' ? 'pointer' : tool === 'text' ? 'text' : 'crosshair',
                display: 'block',
                touchAction: 'none',
                width: '100%'
              }}
            />

            {/* Draggable Text Items Layer */}
            {textElements.map(item => {
              const isSelected = selectedTextId === item.id;
              const isEditing = editingTextId === item.id;

              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => handleTextPointerDown(e, item)}
                  style={{
                    position: 'absolute',
                    left: `${item.xRatio * 100}%`,
                    top: `${item.yRatio * 100}%`,
                    cursor: 'move',
                    userSelect: 'none',
                    touchAction: 'none',
                    zIndex: isSelected ? 30 : 15,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(15, 23, 42, 0.85)' : 'transparent',
                    border: isSelected ? '1.5px dashed #f59e0b' : '1.5px solid transparent',
                    boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.6)' : 'none',
                    transform: 'translate(0, 0)',
                    transition: dragStateRef.current?.id === item.id ? 'none' : 'box-shadow 0.15s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTextId(item.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTextId(item.id);
                  }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={item.text}
                      onChange={(e) => handleUpdateText(item.id, { text: e.target.value })}
                      onBlur={() => setEditingTextId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingTextId(null);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.95)',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        color: item.color || '#fff',
                        fontSize: `${item.fontSize || 22}px`,
                        fontWeight: item.isBold !== false ? 'bold' : 'normal',
                        padding: '2px 8px',
                        outline: 'none',
                        minWidth: '120px'
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        color: item.color || '#fff',
                        fontSize: `${item.fontSize || 22}px`,
                        fontWeight: item.isBold !== false ? 'bold' : 'normal',
                        lineHeight: 1.2,
                        textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                        whiteSpace: 'pre'
                      }}
                    >
                      {item.text}
                    </span>
                  )}

                  {/* Selected Item Floating Controls */}
                  {isSelected && !isEditing && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      marginLeft: '6px',
                      background: 'rgba(0,0,0,0.8)',
                      borderRadius: '6px',
                      padding: '2px 4px',
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTextId(item.id);
                        }}
                        title="Edit text"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex'
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteText(item.id, e)}
                        title="Delete text"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
