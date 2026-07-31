import React, { useRef, useState, useEffect, useContext } from 'react';
import { X, Eraser, RotateCcw, Paintbrush, Send, Sparkles } from 'lucide-react';
import { SocketContext } from '../../context/SocketContext';

export default function WhiteboardModal({ onClose, chatTitle, chatId, onSendDrawing }) {
  const { socket } = useContext(SocketContext);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [syncedUsers, setSyncedUsers] = useState(true);

  // Initialize canvas & join whiteboard socket room
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.parentElement.clientWidth || 600;
    canvas.height = 380;
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

      const handleRemoteClear = () => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.fillStyle = '#0f172a';
        context.fillRect(0, 0, c.width, c.height);
      };

      socket.on('wb_draw', handleRemoteDraw);
      socket.on('wb_clear', handleRemoteClear);

      return () => {
        socket.off('wb_draw', handleRemoteDraw);
        socket.off('wb_clear', handleRemoteClear);
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
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return {
      xRatio: Math.max(0, Math.min(1, x / canvas.width)),
      yRatio: Math.max(0, Math.min(1, y / canvas.height))
    };
  };

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPosRef.current = coords;
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const currentCoords = getCanvasCoords(e);
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
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (socket && chatId) {
      socket.emit('wb_clear', { chatId });
    }
  };

  const handleSendToChat = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onSendDrawing) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSendDrawing(dataUrl);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paintbrush size={20} color="var(--accent)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                Real-Time Whiteboard — {chatTitle || 'Board'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> Live Real-Time Multi-User Sync
              </span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`icon-btn-ghost ${tool === 'pen' ? 'active-mic' : ''}`}
                onClick={() => setTool('pen')}
                title="Pen"
              >
                <Paintbrush size={18} />
              </button>

              <button
                className={`icon-btn-ghost ${tool === 'eraser' ? 'active-mic' : ''}`}
                onClick={() => setTool('eraser')}
                title="Eraser"
              >
                <Eraser size={18} />
              </button>

              {/* Color Palette */}
              {['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ffffff'].map(c => (
                <div
                  key={c}
                  onClick={() => { setColor(c); setTool('pen'); }}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border: color === c && tool === 'pen' ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="icon-btn-ghost" onClick={clearCanvas} title="Clear Board" style={{ color: '#ef4444' }}>
                <RotateCcw size={18} />
              </button>

              {onSendDrawing && (
                <button onClick={handleSendToChat} className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
                  <Send size={14} /> Send to Chat
                </button>
              )}
            </div>
          </div>

          {/* Canvas Area */}
          <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block', touchAction: 'none', width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

