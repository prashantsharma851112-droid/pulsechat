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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    class FloatingParticle {
      constructor(emoji, durationSecs = 3) {
        this.emoji = emoji;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // Spread horizontally across screen (10% to 90% width)
        this.x = Math.random() * (screenW * 0.8) + screenW * 0.1;
        // Start from middle/lower portion of screen
        this.y = screenH * (0.55 + Math.random() * 0.38);
        
        // Particle size: 36px to 64px
        this.size = Math.random() * 28 + 36;
        // Smooth upward buoyancy float
        this.vy = -(Math.random() * 1.6 + 1.2);
        // Gentle horizontal sway
        this.swaySpeed = Math.random() * 0.03 + 0.015;
        this.swayAmount = Math.random() * 1.4 + 0.4;
        this.phase = Math.random() * Math.PI * 2;
        
        // Soft translucent max opacity (0.45 to 0.70) for ultra clean look
        this.maxOpacity = Math.random() * 0.25 + 0.45;
        this.opacity = 0;
        
        const fps = 60;
        const totalFrames = Math.max(60, Math.round(durationSecs * fps));
        this.fadeInFrames = 15; // 0.25s smooth fade in
        this.fadeOutFrames = totalFrames - this.fadeInFrames;
        this.frameCounter = 0;
        this.totalFrames = totalFrames;
      }

      update() {
        this.frameCounter++;
        this.y += this.vy;
        this.x += Math.sin(this.frameCounter * this.swaySpeed + this.phase) * this.swayAmount;

        // Smooth fade-in and fade-out curve
        if (this.frameCounter < this.fadeInFrames) {
          this.opacity = (this.frameCounter / this.fadeInFrames) * this.maxOpacity;
        } else {
          const remaining = this.totalFrames - this.frameCounter;
          this.opacity = Math.max(0, (remaining / this.fadeOutFrames) * this.maxOpacity);
        }
      }

      draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Soft pastel pink/magenta radial aura glow behind particle (like screenshot 2)
        const glowRadius = this.size * 0.85;
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.28)'); // Soft translucent pink/magenta glow
        grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Render emoji
        ctx.font = `${this.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.restore();
      }
    }

    const animate = () => {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      ctx.clearRect(0, 0, screenW, screenH);

      particles = particles.filter(p => p.frameCounter < p.totalFrames && p.opacity > 0);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const handleTriggerBurst = (e) => {
      const mainEmoji = e.detail?.emoji || '❤️';
      const durationSecs = e.detail?.duration || 3; // 3s for reactions, 5s for burst
      const count = 14; // Lightweight 14 particles for 60fps smooth performance

      // Clear previous particles if new reaction happens fast so screen stays clean
      if (particles.length > 18) {
        particles = particles.slice(-8);
      }

      // Spawn mix of reacted emoji + soft heart accent particles (like image 2)
      const accentEmojis = ['💗', '💖', '💕'];

      for (let i = 0; i < count; i++) {
        const emojiToUse = (i % 3 === 0 && mainEmoji !== '❤️') ? accentEmojis[i % accentEmojis.length] : mainEmoji;
        particles.push(new FloatingParticle(emojiToUse, durationSecs));
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
        zIndex: 99999,
        width: '100vw',
        height: '100vh'
      }}
    />
  );
}
