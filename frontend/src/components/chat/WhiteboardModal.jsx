import React, { useRef, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  X, Eraser, RotateCcw, RotateCw, Paintbrush, Send, Sparkles,
  Square, Circle, Minus, MoveUpRight, Triangle, Smile, Sliders, Undo2, Redo2, Download, Presentation,
  Type, Trash2, Edit3, Search, Plus, Palette, Layers, Check, RefreshCw
} from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';
import { useBackHandler } from '../../utils/backNavigation';
import { EMOJI_CATEGORIES, ALL_EMOJIS } from './EmojiPicker';

const PALETTE_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#ffffff', '#94a3b8', '#000000'
];

const BOARD_BG_PRESETS = [
  { id: 'slate', name: 'Dark Slate', color: '#0f172a' },
  { id: 'black', name: 'Pitch Black', color: '#000000' },
  { id: 'chalkboard', name: 'Chalkboard', color: '#13382c' },
  { id: 'white', name: 'Whiteboard', color: '#ffffff' },
  { id: 'blueprint', name: 'Blueprint Navy', color: '#1e293b' },
  { id: 'cream', name: 'Parchment', color: '#fef3c7' }
];

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
  const strokePointsRef = useRef([]);
  const snapshotRef = useRef(null);
  const clearedDataUrlRef = useRef(null);

  const containerRef = useRef(null);
  const dragStateRef = useRef(null);
  const textElementsRef = useRef([]);
  const stickerElementsRef = useRef([]);
  const boardColorRef = useRef('#0f172a');
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  // Board Background Color State
  const [boardColor, setBoardColor] = useState('#0f172a');
  const [showBoardColorMenu, setShowBoardColorMenu] = useState(false);

  // Drawing Tools State
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'shape' | 'sticker' | 'text'
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [selectedSticker, setSelectedSticker] = useState('🔥');
  const [showStickersMenu, setShowStickersMenu] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [canRestoreClear, setCanRestoreClear] = useState(false);
  const [savedToDevice, setSavedToDevice] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Text Tool State
  const [textElements, setTextElements] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(24);
  const [isTextBold, setIsTextBold] = useState(true);

  // Stickers / Emojis State
  const [stickerElements, setStickerElements] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [stickerSize, setStickerSize] = useState(40);
  const [emojiCategory, setEmojiCategory] = useState('all');
  const [emojiSearch, setEmojiSearch] = useState('');

  // Accidental Close / Backup Recovery State
  const [savedDraftExists, setSavedDraftExists] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);
  const [restoredToast, setRestoredToast] = useState(false);

  // Update refs to latest values
  useEffect(() => {
    textElementsRef.current = textElements;
  }, [textElements]);

  useEffect(() => {
    stickerElementsRef.current = stickerElements;
  }, [stickerElements]);

  useEffect(() => {
    boardColorRef.current = boardColor;
  }, [boardColor]);

  // Auto-Save Draft to LocalStorage
  const saveDraft = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chatId) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const draft = {
        boardColor: boardColorRef.current,
        dataUrl,
        textElements: textElementsRef.current,
        stickerElements: stickerElementsRef.current,
        timestamp: Date.now()
      };
      localStorage.setItem(`pulse_wb_draft_${chatId}`, JSON.stringify(draft));
    } catch (e) {
      console.warn('Could not auto-save whiteboard draft:', e);
    }
  }, [chatId]);

  // Hardware Back Handler: Safely close and auto-save draft
  useBackHandler(() => {
    saveDraft();
    onClose();
  }, true);

  // Check for previous saved draft on mount
  useEffect(() => {
    if (!chatId) return;
    try {
      const raw = localStorage.getItem(`pulse_wb_draft_${chatId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.dataUrl || parsed.textElements?.length || parsed.stickerElements?.length)) {
          setSavedDraftExists(true);
          setDraftInfo(parsed);
        }
      }
    } catch (e) {}
  }, [chatId]);

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

  // Restore Draft Function
  const handleRestoreDraft = () => {
    if (!draftInfo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draftInfo.boardColor) {
      setBoardColor(draftInfo.boardColor);
      if (socket && chatId) {
        socket.emit('wb_board_color', { chatId, boardColor: draftInfo.boardColor });
      }
    }

    if (Array.isArray(draftInfo.textElements)) {
      setTextElements(draftInfo.textElements);
      if (socket && chatId) {
        socket.emit('wb_text_update', { chatId, textItems: draftInfo.textElements });
      }
    }

    if (Array.isArray(draftInfo.stickerElements)) {
      setStickerElements(draftInfo.stickerElements);
      if (socket && chatId) {
        socket.emit('wb_sticker_update', { chatId, stickerItems: draftInfo.stickerElements });
      }
    }

    if (draftInfo.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        pushUndoSnapshot();
        if (socket && chatId) {
          socket.emit('wb_restore', { chatId, boardDataUrl: draftInfo.dataUrl });
        }
      };
      img.src = draftInfo.dataUrl;
    }

    setSavedDraftExists(false);
    setRestoredToast(true);
    setTimeout(() => setRestoredToast(false), 2500);
  };

  const handleDiscardDraft = () => {
    if (chatId) {
      localStorage.removeItem(`pulse_wb_draft_${chatId}`);
    }
    setSavedDraftExists(false);
    setDraftInfo(null);
  };

  // Undo / Redo for Canvas Drawing & Shapes
  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const snap = canvas.toDataURL('image/png');
      undoStackRef.current.push(snap);
      if (undoStackRef.current.length > 25) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
      saveDraft();
    } catch (e) {}
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const currentSnap = canvas.toDataURL('image/png');
    redoStackRef.current.push(currentSnap);

    const prevSnap = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (prevSnap) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (socket && chatId) {
          socket.emit('wb_undo', { chatId, boardDataUrl: prevSnap });
        }
        saveDraft();
      };
      img.src = prevSnap;
    } else {
      if (socket && chatId) {
        socket.emit('wb_clear', { chatId });
      }
      saveDraft();
    }
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;
    const nextSnap = redoStackRef.current.pop();
    undoStackRef.current.push(canvas.toDataURL('image/png'));
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (nextSnap) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (socket && chatId) {
          socket.emit('wb_restore', { chatId, boardDataUrl: nextSnap });
        }
        saveDraft();
      };
      img.src = nextSnap;
    }
  };

  // Keyboard shortcut Ctrl+Z / Cmd+Z for undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Board Background Color Changer
  const handleSelectBoardColor = (newColor) => {
    setBoardColor(newColor);
    setShowBoardColorMenu(false);
    if (socket && chatId) {
      socket.emit('wb_board_color', { chatId, boardColor: newColor });
    }
    saveDraft();
  };

  // Composite Export Function
  const getExportDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');

      // 1. Fill background with chosen board color
      ctx.fillStyle = boardColor;
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // 2. Draw existing transparent canvas strokes and shapes
      ctx.drawImage(canvas, 0, 0);

      // 3. Draw all interactive sticker emojis
      stickerElements.forEach(item => {
        const x = item.xRatio * canvas.width;
        const y = item.yRatio * canvas.height;
        const size = item.size || 40;
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, x, y);
      });

      // 4. Draw all draggable text elements
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
      a.download = `pulsechat_drawboard_${Date.now()}.png`;
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
    ctx.save();
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
    ctx.restore();
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
        ? Math.max(260, Math.min(360, Math.floor(window.innerHeight * 0.42)))
        : 440;

      if (c.width > 0 && c.height > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = c.width;
        tempCanvas.height = c.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(c, 0, 0);

        c.width = parentWidth;
        c.height = targetHeight;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(tempCanvas, 0, 0, c.width, c.height);
      } else {
        c.width = parentWidth;
        c.height = targetHeight;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
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

        context.save();
        if (stroke.tool === 'eraser') {
          context.globalCompositeOperation = 'destination-out';
          context.lineWidth = stroke.lineWidth * 3;
        } else {
          context.globalCompositeOperation = 'source-over';
          context.strokeStyle = stroke.color;
          context.lineWidth = stroke.lineWidth;
        }
        context.lineCap = 'round';
        context.lineJoin = 'round';

        context.beginPath();
        context.moveTo(stroke.x0 * w, stroke.y0 * h);
        context.lineTo(stroke.x1 * w, stroke.y1 * h);
        context.stroke();
        context.restore();
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

      const handleRemoteBoardColor = ({ boardColor: incomingColor }) => {
        if (incomingColor) {
          setBoardColor(incomingColor);
        }
      };

      const handleRemoteStickerUpdate = (stickerItems) => {
        if (Array.isArray(stickerItems)) {
          setStickerElements(stickerItems);
        }
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
        context.clearRect(0, 0, c.width, c.height);
        setTextElements([]);
        setStickerElements([]);
      };

      const handleRemoteRestore = ({ boardDataUrl }) => {
        if (!boardDataUrl) return;
        const c = canvasRef.current;
        if (!c) return;
        const img = new Image();
        img.onload = () => {
          const context = c.getContext('2d');
          context.clearRect(0, 0, c.width, c.height);
          context.drawImage(img, 0, 0, c.width, c.height);
        };
        img.src = boardDataUrl;
      };

      const handleRemoteUndo = ({ boardDataUrl }) => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.clearRect(0, 0, c.width, c.height);
        if (boardDataUrl) {
          const img = new Image();
          img.onload = () => {
            context.drawImage(img, 0, 0, c.width, c.height);
          };
          img.src = boardDataUrl;
        }
      };

      socket.on('wb_draw', handleRemoteDraw);
      socket.on('wb_shape', handleRemoteShape);
      socket.on('wb_board_color', handleRemoteBoardColor);
      socket.on('wb_sticker_update', handleRemoteStickerUpdate);
      socket.on('wb_text_update', handleRemoteTextUpdate);
      socket.on('wb_clear', handleRemoteClear);
      socket.on('wb_restore', handleRemoteRestore);
      socket.on('wb_undo', handleRemoteUndo);

      return () => {
        window.removeEventListener('resize', updateCanvasDimensions);
        socket.off('wb_draw', handleRemoteDraw);
        socket.off('wb_shape', handleRemoteShape);
        socket.off('wb_board_color', handleRemoteBoardColor);
        socket.off('wb_sticker_update', handleRemoteStickerUpdate);
        socket.off('wb_text_update', handleRemoteTextUpdate);
        socket.off('wb_clear', handleRemoteClear);
        socket.off('wb_restore', handleRemoteRestore);
        socket.off('wb_undo', handleRemoteUndo);
      };
    }

    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [socket, chatId]);

  const drawLineLocallyAndEmit = (x0Ratio, y0Ratio, x1Ratio, y1Ratio, strokeTool, strokeColor, strokeWidth) => {
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

  // Add Interactive Draggable Sticker (Emoji)
  const handleAddStickerAt = (xRatio, yRatio, emoji) => {
    const newId = 'wb_stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newSticker = {
      id: newId,
      emoji: emoji || selectedSticker,
      xRatio: Math.max(0.04, Math.min(0.92, xRatio)),
      yRatio: Math.max(0.04, Math.min(0.92, yRatio)),
      size: stickerSize || 40
    };

    setStickerElements(prev => {
      const updated = [...prev, newSticker];
      if (socket && chatId) {
        socket.emit('wb_sticker_update', { chatId, stickerItems: updated });
      }
      return updated;
    });

    setSelectedStickerId(newId);
    setSelectedTextId(null);
    saveDraft();
  };

  const handleDeleteSticker = (id, e) => {
    if (e) e.stopPropagation();
    setStickerElements(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (socket && chatId) {
        socket.emit('wb_sticker_update', { chatId, stickerItems: updated });
      }
      return updated;
    });
    if (selectedStickerId === id) setSelectedStickerId(null);
    saveDraft();
  };

  const handleUpdateStickerSize = (id, delta, e) => {
    if (e) e.stopPropagation();
    setStickerElements(prev => {
      const updated = prev.map(s => {
        if (s.id === id) {
          const newSize = Math.max(20, Math.min(90, (s.size || 40) + delta));
          return { ...s, size: newSize };
        }
        return s;
      });
      if (socket && chatId) {
        socket.emit('wb_sticker_update', { chatId, stickerItems: updated });
      }
      return updated;
    });
    saveDraft();
  };

  // Add Interactive Draggable Text
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
        socket.emit('wb_text_update', { chatId, textItems: updated });
      }
      return updated;
    });

    setSelectedTextId(newId);
    setSelectedStickerId(null);
    setTextInput('');
    saveDraft();
  };

  const handleUpdateText = (id, newProps) => {
    setTextElements(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...newProps } : t);
      if (socket && chatId) {
        socket.emit('wb_text_update', { chatId, textItems: updated });
      }
      return updated;
    });
    saveDraft();
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
    saveDraft();
  };

  // Dragging handlers for Text and Stickers
  const handleItemPointerDown = (e, item, type) => {
    e.stopPropagation();
    if (type === 'text') {
      setSelectedTextId(item.id);
      setSelectedStickerId(null);
    } else {
      setSelectedStickerId(item.id);
      setSelectedTextId(null);
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStateRef.current = {
      type,
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
    const { type, id, startX, startY, initialXRatio, initialYRatio } = dragStateRef.current;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaXRatio = (clientX - startX) / rect.width;
    const deltaYRatio = (clientY - startY) / rect.height;

    if (Math.abs(clientX - startX) > 3 || Math.abs(clientY - startY) > 3) {
      dragStateRef.current.hasMoved = true;
    }

    const newXRatio = Math.max(0.01, Math.min(0.92, initialXRatio + deltaXRatio));
    const newYRatio = Math.max(0.01, Math.min(0.92, initialYRatio + deltaYRatio));

    if (type === 'text') {
      setTextElements(prev => prev.map(t => t.id === id ? { ...t, xRatio: newXRatio, yRatio: newYRatio } : t));
    } else if (type === 'sticker') {
      setStickerElements(prev => prev.map(s => s.id === id ? { ...s, xRatio: newXRatio, yRatio: newYRatio } : s));
    }
  };

  const handleContainerPointerUp = () => {
    if (dragStateRef.current) {
      if (dragStateRef.current.hasMoved && socket && chatId) {
        if (dragStateRef.current.type === 'text') {
          socket.emit('wb_text_update', { chatId, textItems: textElementsRef.current });
        } else if (dragStateRef.current.type === 'sticker') {
          socket.emit('wb_sticker_update', { chatId, stickerItems: stickerElementsRef.current });
        }
      }
      dragStateRef.current = null;
      saveDraft();
    }
  };

  // Silky Smooth Canvas Drawing (Bezier Curves & Round Caps)
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);

    if (tool === 'text') {
      handleAddTextAt(coords.xRatio, coords.yRatio);
      return;
    }

    if (tool === 'sticker') {
      handleAddStickerAt(coords.xRatio, coords.yRatio, selectedSticker);
      return;
    }

    setSelectedTextId(null);
    setSelectedStickerId(null);

    isDrawingRef.current = true;
    lastPosRef.current = coords;
    startPosRef.current = coords;
    strokePointsRef.current = [coords];

    const ctx = canvas.getContext('2d');
    if (tool === 'shape') {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      // Draw smooth start cap/dot
      ctx.save();
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, Math.max(2, (lineWidth * 3) / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentCoords = getCanvasCoords(e);

    if (tool === 'pen' || tool === 'eraser') {
      strokePointsRef.current.push(currentCoords);
      const pts = strokePointsRef.current;

      if (pts.length >= 2) {
        const p1 = pts[pts.length - 2];
        const p2 = pts[pts.length - 1];
        const midPoint = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
          xRatio: (p1.xRatio + p2.xRatio) / 2,
          yRatio: (p1.yRatio + p2.yRatio) / 2
        };

        ctx.save();
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = lineWidth * 3;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
        ctx.stroke();
        ctx.restore();

        drawLineLocallyAndEmit(
          p1.xRatio,
          p1.yRatio,
          midPoint.xRatio,
          midPoint.yRatio,
          tool,
          color,
          lineWidth
        );
      }
      lastPosRef.current = currentCoords;
    } else if (tool === 'shape' && snapshotRef.current) {
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
    strokePointsRef.current = [];
    pushUndoSnapshot();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      clearedDataUrlRef.current = canvas.toDataURL('image/png');
      setCanRestoreClear(true);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTextElements([]);
      setStickerElements([]);
      pushUndoSnapshot();
    }
    if (socket && chatId) {
      socket.emit('wb_clear', { chatId });
      socket.emit('wb_text_update', { chatId, textItems: [] });
      socket.emit('wb_sticker_update', { chatId, stickerItems: [] });
    }
  };

  const restoreClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !clearedDataUrlRef.current) return;

    const dataUrl = clearedDataUrlRef.current;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      pushUndoSnapshot();

      if (socket && chatId) {
        socket.emit('wb_restore', { chatId, boardDataUrl: dataUrl });
      }
    };
    img.src = dataUrl;
    setCanRestoreClear(false);
  };

  const handleSendToChat = () => {
    if (!onSendDrawing) return;
    const dataUrl = getExportDataUrl();
    if (!dataUrl) return;
    onSendDrawing(dataUrl);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '780px', width: '96vw', maxHeight: '95dvh', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Presentation size={20} color="var(--accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Live Drawboard — {chatTitle || 'Board'}
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Smooth Drawing, Custom Boards, Shapes & Stickers
              </span>
            </div>
          </div>
          <button
            className="icon-btn-ghost"
            onClick={() => {
              saveDraft();
              onClose();
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          {/* Previous Drawing Recovery Banner */}
          {savedDraftExists && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              animation: 'pulseModalPop 0.2s ease',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--accent)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  Found previous drawing saved from this chat!
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  style={{
                    background: 'var(--accent, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <RotateCw size={13} /> Restore Drawing
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '5px 9px',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                  title="Discard saved draft"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Restored Toast */}
          {restoredToast && (
            <div style={{
              background: '#10b981',
              color: '#fff',
              borderRadius: '8px',
              padding: '6px 12px',
              textAlign: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              animation: 'pulseModalPop 0.15s ease'
            }}>
              ✨ Drawing and elements restored successfully!
            </div>
          )}

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
            {/* Row 1: Tools (Pen, Eraser, Shapes, Text, Stickers, Board Color) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              width: '100%'
            }}>
              <button
                type="button"
                className={`icon-btn-ghost ${tool === 'pen' ? 'active-mic' : ''}`}
                onClick={() => { setTool('pen'); setShowShapesMenu(false); setShowStickersMenu(false); setShowBoardColorMenu(false); }}
                title="Pen Tool (Smooth Drawing)"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center' }}
              >
                <Paintbrush size={15} /> <span>Pen</span>
              </button>

              <button
                type="button"
                className={`icon-btn-ghost ${tool === 'eraser' ? 'active-mic' : ''}`}
                onClick={() => { setTool('eraser'); setShowShapesMenu(false); setShowStickersMenu(false); setShowBoardColorMenu(false); }}
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
                  setShowBoardColorMenu(false);
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
                  setShowBoardColorMenu(false);
                }}
                title="Text Tool — Type, Drag & Delete"
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
                  setShowBoardColorMenu(false);
                }}
                title="Stickers & Unlimited Emojis"
                style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', justifyContent: 'center', whiteSpace: 'nowrap' }}
              >
                <Smile size={15} /> <span>Stickers</span> <span style={{ fontSize: '1rem', lineHeight: 1 }}>{selectedSticker}</span>
              </button>

              {/* Board Theme / Color Button */}
              <button
                type="button"
                className={`icon-btn-ghost ${showBoardColorMenu ? 'active-mic' : ''}`}
                onClick={() => {
                  setShowBoardColorMenu(!showBoardColorMenu);
                  setShowShapesMenu(false);
                  setShowStickersMenu(false);
                }}
                title="Change Board Background Color"
                style={{
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flex: '1 1 auto',
                  justifyContent: 'center',
                  background: showBoardColorMenu ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                  color: showBoardColorMenu ? '#fff' : 'var(--text-main)'
                }}
              >
                <Palette size={15} />
                <span>Board Color</span>
                <span style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: boardColor,
                  border: '1px solid #fff',
                  display: 'inline-block'
                }} />
              </button>
            </div>

            {/* Row 2: Undo, Redo, Size Slider, Clear, Save, Send */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              {/* Left Group: Undo / Redo & Stroke Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="icon-btn-ghost"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo last stroke or shape (Ctrl+Z)"
                  style={{
                    padding: '5px 8px',
                    borderRadius: '8px',
                    opacity: canUndo ? 1 : 0.4,
                    cursor: canUndo ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.74rem'
                  }}
                >
                  <Undo2 size={15} />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  className="icon-btn-ghost"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  style={{
                    padding: '5px 8px',
                    borderRadius: '8px',
                    opacity: canRedo ? 1 : 0.4,
                    cursor: canRedo ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.74rem'
                  }}
                >
                  <Redo2 size={15} />
                  <span>Redo</span>
                </button>

                {/* Size Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  <Sliders size={13} />
                  <span>Size:</span>
                  <input
                    type="range"
                    min="1"
                    max="22"
                    value={lineWidth}
                    onChange={e => setLineWidth(Number(e.target.value))}
                    style={{ width: '48px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '14px', fontSize: '0.75rem' }}>{lineWidth}px</span>
                </div>

                {/* Selected Item Delete Button (if any text or sticker is selected) */}
                {(selectedTextId || selectedStickerId) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (selectedTextId) handleDeleteText(selectedTextId, e);
                      if (selectedStickerId) handleDeleteSticker(selectedStickerId, e);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="Delete selected item"
                  >
                    <Trash2 size={13} /> Delete Selected
                  </button>
                )}

                {/* Clear Board & Undo Clear */}
                <button
                  type="button"
                  className="icon-btn-ghost"
                  onClick={clearCanvas}
                  title="Clear entire board"
                  style={{ color: '#ef4444', padding: '5px' }}
                >
                  <RotateCcw size={16} />
                </button>

                {canRestoreClear && (
                  <button
                    type="button"
                    onClick={restoreClearCanvas}
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
                    <RotateCw size={12} /> Undo Clear
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

          {/* Board Background Color Sub-Bar */}
          {showBoardColorMenu && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-sidebar)',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              flexWrap: 'wrap',
              animation: 'pulseModalPop 0.15s ease'
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Board Color:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {BOARD_BG_PRESETS.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBoardColor(b.color)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: boardColor === b.color ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)',
                      color: boardColor === b.color ? '#fff' : 'var(--text-main)',
                      border: boardColor === b.color ? '1px solid #fff' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: b.color,
                      border: '1px solid rgba(255,255,255,0.4)',
                      display: 'inline-block'
                    }} />
                    {b.name}
                  </button>
                ))}

                {/* Custom Color Input for Board Background */}
                <label
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)'
                  }}
                  title="Pick Custom Board Color"
                >
                  <input
                    type="color"
                    value={boardColor}
                    onChange={e => handleSelectBoardColor(e.target.value)}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent' }}
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>
          )}

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
                  💡 Click board to place • Drag to move • Double-tap to edit • Tap ✕ to delete
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Type your message, note, or label..."
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      handleAddTextAt(0.2, 0.3, textInput.trim());
                    }
                  }}
                  style={{
                    flex: '1 1 200px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Size:</span>
                  <input
                    type="range"
                    min="14"
                    max="48"
                    value={textFontSize}
                    onChange={e => setTextFontSize(Number(e.target.value))}
                    style={{ width: '45px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '16px' }}>{textFontSize}px</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTextBold(!isTextBold)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: isTextBold ? 'var(--accent)' : 'var(--bg-card)',
                    color: isTextBold ? '#fff' : 'var(--text-main)',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                  title="Toggle Bold"
                >
                  B
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTextAt(0.25, 0.35, textInput.trim() || 'New Text')}
                  className="btn-primary"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Add Text
                </button>
              </div>
            </div>
          )}

          {/* Stickers / Unlimited Emojis Picker Sub-Bar */}
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
              {/* Header and Size Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smile size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Unlimited Emojis & Stickers
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    (Drag, resize & delete anywhere!)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sticker Size:</span>
                  {[
                    { label: 'S', val: 28 },
                    { label: 'M', val: 40 },
                    { label: 'L', val: 56 }
                  ].map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStickerSize(s.val)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: stickerSize === s.val ? 'var(--accent)' : 'var(--bg-card)',
                        color: stickerSize === s.val ? '#fff' : 'var(--text-main)',
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

              {/* Scrollable Emojis Grid */}
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
                      handleAddStickerAt(0.5, 0.45, emoji);
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
                    title={`Add ${emoji} to board`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stroke Colors Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '2px 0' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Draw Color:</span>
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

            <label style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px' }} title="Custom Drawing Color">
              <input
                type="color"
                value={color}
                onChange={e => { setColor(e.target.value); if (tool === 'eraser') setTool('pen'); }}
                style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent' }}
              />
            </label>
          </div>

          {/* Canvas Board Container with Dynamic Background Color */}
          <div
            ref={containerRef}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={handleContainerPointerUp}
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: '14px',
              overflow: 'hidden',
              backgroundColor: boardColor,
              border: '1.5px solid var(--border)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              userSelect: 'none',
              transition: 'background-color 0.25s ease'
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
                width: '100%',
                background: 'transparent'
              }}
            />

            {/* Draggable & Deletable Interactive Stickers (Emojis) */}
            {stickerElements.map(item => {
              const isSelected = selectedStickerId === item.id;
              const size = item.size || 40;

              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => handleItemPointerDown(e, item, 'sticker')}
                  style={{
                    position: 'absolute',
                    left: `${item.xRatio * 100}%`,
                    top: `${item.yRatio * 100}%`,
                    cursor: 'move',
                    userSelect: 'none',
                    touchAction: 'none',
                    zIndex: isSelected ? 30 : 16,
                    transform: 'translate(-50%, -50%)',
                    padding: '4px',
                    borderRadius: '12px',
                    border: isSelected ? '2px dashed #f59e0b' : '2px solid transparent',
                    background: isSelected ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: dragStateRef.current?.id === item.id ? 'none' : 'box-shadow 0.15s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStickerId(item.id);
                    setSelectedTextId(null);
                  }}
                >
                  <span style={{ fontSize: `${size}px`, lineHeight: 1, pointerEvents: 'none' }}>
                    {item.emoji}
                  </span>

                  {/* Selected Sticker Floating Controls (Resize & Delete) */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(0, 0, 0, 0.9)',
                      borderRadius: '8px',
                      padding: '2px 6px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                      zIndex: 35
                    }}>
                      <button
                        type="button"
                        onClick={(e) => handleUpdateStickerSize(item.id, -6, e)}
                        title="Smaller"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          width: '18px',
                          height: '18px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleUpdateStickerSize(item.id, 6, e)}
                        title="Larger"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          width: '18px',
                          height: '18px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSticker(item.id, e)}
                        title="Delete Emoji Sticker"
                        style={{
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Draggable & Editable Interactive Text Items */}
            {textElements.map(item => {
              const isSelected = selectedTextId === item.id;
              const isEditing = editingTextId === item.id;

              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => handleItemPointerDown(e, item, 'text')}
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
                    setSelectedStickerId(null);
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

                  {/* Selected Text Floating Controls (Edit & Delete) */}
                  {isSelected && !isEditing && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '6px',
                      background: 'rgba(0,0,0,0.85)',
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
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex'
                        }}
                      >
                        <Trash2 size={12} />
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
