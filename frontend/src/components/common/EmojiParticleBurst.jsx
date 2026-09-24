import React, { useEffect, useRef } from 'react';

export default function EmojiParticleBurst() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    class Particle {
      constructor(x, y, emoji) {
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.size = Math.random() * 28 + 24; // 24px - 52px 3D sizes
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 16 + 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 6; // upward bias burst
        this.gravity = 0.28;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.2;
        this.scale = Math.random() * 0.5 + 0.7; // 3D depth scale
        this.vScale = Math.random() * 0.01 + 0.005;
        this.opacity = 1;
        this.fade = Math.random() * 0.012 + 0.008;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.98; // atmospheric drag
        this.rotation += this.vRot;
        this.scale += this.vScale;
        this.opacity -= this.fade;
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 12;
        ctx.font = `${this.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter(p => p.opacity > 0);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });
      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const handleTriggerBurst = (e) => {
      const emoji = e.detail?.emoji || '🔥';
      const count = e.detail?.count || 50;
      const startX = e.detail?.x || window.innerWidth / 2;
      const startY = e.detail?.y || window.innerHeight * 0.6;

      for (let i = 0; i < count; i++) {
        particles.push(new Particle(startX, startY, emoji));
      }
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pulsechat_trigger_emoji_burst', handleTriggerBurst);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99999
      }}
    />
  );
}

