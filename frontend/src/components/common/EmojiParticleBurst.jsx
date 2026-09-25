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

    // Mode 1: Message Reaction Floating Aura Particle (Exact 3 Seconds)
    class ReactionParticle {
      constructor(emoji) {
        this.mode = 'reaction';
        this.emoji = emoji;
        const screenW = window.innerWidth || 360;
        const screenH = window.innerHeight || 640;

        this.x = Math.random() * (screenW * 0.8) + screenW * 0.1;
        this.y = screenH * (0.6 + Math.random() * 0.3);
        this.size = Math.random() * 24 + 34; // 34px - 58px
        this.vy = -(Math.random() * 2.2 + 1.8); // Smooth float disappearing in 3s
        this.swaySpeed = Math.random() * 0.04 + 0.02;
        this.swayAmount = Math.random() * 1.5 + 0.5;
        this.phase = Math.random() * Math.PI * 2;

        this.maxOpacity = Math.random() * 0.2 + 0.5;
        this.opacity = 0;

        this.totalFrames = 180; // Exact 3 seconds at 60fps
        this.fadeInFrames = 15; // 0.25s fade in
        this.fadeOutStart = 110; // Fades out cleanly between 1.8s and 3.0s
        this.frameCounter = 0;
      }

      update() {
        this.frameCounter++;
        this.y += this.vy;
        this.x += Math.sin(this.frameCounter * this.swaySpeed + this.phase) * this.swayAmount;

        if (this.frameCounter <= this.fadeInFrames) {
          this.opacity = (this.frameCounter / this.fadeInFrames) * this.maxOpacity;
        } else if (this.frameCounter >= this.fadeOutStart) {
          const remaining = this.totalFrames - this.frameCounter;
          const fadeLength = this.totalFrames - this.fadeOutStart;
          this.opacity = Math.max(0, (remaining / fadeLength) * this.maxOpacity);
        } else {
          this.opacity = this.maxOpacity;
        }
      }

      draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Soft translucent pink/magenta radial aura glow behind particle
        const glowRadius = this.size * 0.85;
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        grad.addColorStop(0, 'rgba(236, 72, 153, 0.32)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${this.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.restore();
      }
    }

    // Mode 2: Unique 3D Fireworks & Fountain Explosion for Emoji Burst (Exact 5 Seconds)
    class BurstParticle {
      constructor(emoji) {
        this.mode = 'burst';
        this.emoji = emoji;
        const screenW = window.innerWidth || 360;
        const screenH = window.innerHeight || 640;

        // Origin: lower center of screen
        this.x = screenW / 2 + (Math.random() - 0.5) * 40;
        this.y = screenH * 0.7;

        // Radial 360-degree fountain velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 14 + 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 6; // upward fountain initial burst
        this.gravity = 0.22;

        this.size = Math.random() * 26 + 32;
        this.scale = 0.3; // 3D expansion scale
        this.maxScale = Math.random() * 0.6 + 0.8;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.12;

        this.maxOpacity = Math.random() * 0.2 + 0.75;
        this.opacity = 0;

        this.totalFrames = 300; // Exact 5 seconds at 60fps
        this.fadeInFrames = 20; // 0.33s fade in
        this.fadeOutStart = 200; // Fades out between 3.3s and 5.0s
        this.frameCounter = 0;
      }

      update() {
        this.frameCounter++;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.96; // Air resistance
        this.rotation += this.vRot;

        if (this.scale < this.maxScale) {
          this.scale += 0.05;
        }

        if (this.frameCounter <= this.fadeInFrames) {
          this.opacity = (this.frameCounter / this.fadeInFrames) * this.maxOpacity;
        } else if (this.frameCounter >= this.fadeOutStart) {
          const remaining = this.totalFrames - this.frameCounter;
          const fadeLength = this.totalFrames - this.fadeOutStart;
          this.opacity = Math.max(0, (remaining / fadeLength) * this.maxOpacity);
        } else {
          this.opacity = this.maxOpacity;
        }
      }

      draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        // Glowing stardust explosion aura
        const glowRadius = this.size * 0.9;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.4)'); // Gold / cyan explosion glow
        grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${this.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter(p => p.frameCounter < p.totalFrames);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const handleTriggerBurst = (e) => {
      const mode = e.detail?.mode || (e.detail?.duration === 5 ? 'burst' : 'reaction');
      const mainEmoji = e.detail?.emoji || '❤️';

      if (mode === 'reaction') {
        // Clear previous reaction particles so screen stays clean
        particles = particles.filter(p => p.mode !== 'reaction');
        const reactCount = 10;
        const accentEmojis = ['💗', '💖', '💕'];
        for (let i = 0; i < reactCount; i++) {
          const emojiToUse = (i % 3 === 0 && mainEmoji !== '❤️') ? accentEmojis[i % accentEmojis.length] : mainEmoji;
          particles.push(new ReactionParticle(emojiToUse));
        }
      } else {
        // Unique 3D Fireworks Fountain Burst
        particles = particles.filter(p => p.mode !== 'burst');
        const burstCount = 18;
        const sparkEmojis = ['✨', '🌟', '💥', '✨'];
        for (let i = 0; i < burstCount; i++) {
          const itemEmoji = (i % 4 === 0) ? sparkEmojis[i % sparkEmojis.length] : mainEmoji;
          particles.push(new BurstParticle(itemEmoji));
        }
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
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999
      }}
    />
  );
}
