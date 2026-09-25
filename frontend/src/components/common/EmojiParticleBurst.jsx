import React, { useEffect, useRef } from 'react';

export default function EmojiParticleBurst() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    let animationFrameId;
    let particles = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    class LightParticle {
      constructor(emoji, durationSecs = 3) {
        this.emoji = emoji;
        // Spawns smoothly across screen width
        this.x = Math.random() * (canvas.width * 0.86) + canvas.width * 0.07;
        // Starts in middle/lower half of screen
        this.y = canvas.height * (0.55 + Math.random() * 0.4);
        this.size = Math.random() * 26 + 34; // 34px to 60px soft light size
        this.vy = -(Math.random() * 1.8 + 1.2); // Silky smooth slow upward float
        this.swaySpeed = Math.random() * 0.035 + 0.015;
        this.swayAmount = Math.random() * 1.2 + 0.4;
        this.phase = Math.random() * Math.PI * 2;
        
        // Very light, soft, translucent opacity (0.15 to 0.40 max opacity)
        this.maxOpacity = Math.random() * 0.25 + 0.15;
        this.opacity = 0;
        
        const totalFrames = Math.max(60, Math.round(durationSecs * 60));
        this.fadeInFrames = 18; // 0.3s soft fade in
        this.fadeOutFrames = totalFrames - this.fadeInFrames;
        this.frameCounter = 0;
        this.totalFrames = totalFrames;
      }

      update() {
        this.frameCounter++;
        this.y += this.vy;
        this.x += Math.sin(this.frameCounter * this.swaySpeed + this.phase) * this.swayAmount;

        // Smooth fade-in then fade-out curve
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
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.opacity;

        // Soft pastel glow aura behind particle
        const glowRadius = this.size * 0.9;
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        grad.addColorStop(0, 'rgba(236, 72, 153, 0.3)'); // Soft pink/magenta glow like image 2
        grad.addColorStop(1, 'rgba(236, 72, 153, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Render emoji
        ctx.font = `${this.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.restore();
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      const emoji = e.detail?.emoji || '💗';
      // 3 seconds for message reaction, 5 seconds for emoji burst action
      const durationSecs = e.detail?.duration || (e.detail?.count > 30 ? 5 : 3);
      // Low particle count (12 - 14 particles) for zero lag 60fps silk performance
      const particleCount = 13;

      // Keep screen clean if multiple bursts triggered fast
      if (particles.length > 25) {
        particles = particles.slice(-10);
      }

      for (let i = 0; i < particleCount; i++) {
        particles.push(new LightParticle(emoji, durationSecs));
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
