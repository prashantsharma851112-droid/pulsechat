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
        this.size = Math.random() * 24 + 20;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = -Math.random() * 14 - 6;
        this.gravity = 0.35;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.15;
        this.opacity = 1;
        this.fade = Math.random() * 0.015 + 0.01;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.rotation += this.vRot;
        this.opacity -= this.fade;
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.font = `${this.size}px sans-serif`;
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
      const count = e.detail?.count || 35;
      const startX = e.detail?.x || window.innerWidth / 2;
      const startY = e.detail?.y || window.innerHeight * 0.75;

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
