import React, { useEffect, useRef } from 'react';

export default function ChatLiveWallpaper({ wallpaperId, customImage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!wallpaperId || wallpaperId === 'none' || wallpaperId === 'custom_image' || wallpaperId === 'default' || wallpaperId === 'midnight_amoled' || wallpaperId === 'dark' || wallpaperId === 'light') {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const isLove = wallpaperId === 'love_hearts_live';
    const isNature = wallpaperId === 'nature_forest_live';
    const isOcean = wallpaperId === 'ocean_waves_live';
    const isCyber = wallpaperId === 'cyber_grid_live';

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        const w = canvas.width || 360;
        const h = canvas.height || 640;
        this.x = Math.random() * w;
        this.y = isNature ? -20 : (h + Math.random() * 40);
        this.size = Math.random() * 16 + 14;
        this.vy = isNature ? (Math.random() * 1.2 + 0.6) : -(Math.random() * 1.4 + 0.6);
        this.vx = (Math.random() - 0.5) * 0.8;
        this.opacity = Math.random() * 0.35 + 0.15;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.02;

        if (isLove) {
          const emojis = ['💖', '💗', '💕', '❤️', '🌸'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        } else if (isNature) {
          const emojis = ['🍃', '🌿', '🍂', '🍁', '🌱'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        } else if (isOcean) {
          const emojis = ['🫧', '💧', '🌊', '✨'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        } else if (isCyber) {
          const emojis = ['⚡', '🔮', '✨', '🪐', '🌟'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        }
      }

      update() {
        const h = canvas.height || 640;
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.vRot;

        if (isNature) {
          if (this.y > h + 30) this.reset();
        } else {
          if (this.y < -30) this.reset();
        }
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.font = `${this.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
      }
    }

    const count = 18;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [wallpaperId]);

  if (wallpaperId === 'custom_image') {
    const bgSrc = customImage || (typeof window !== 'undefined' ? localStorage.getItem(`pulsechat_custom_wallpaper_${wallpaperId}`) : null);
    if (bgSrc) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.92,
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      );
    }
  }

  if (wallpaperId === 'love_hearts_live' || wallpaperId === 'nature_forest_live' || wallpaperId === 'ocean_waves_live' || wallpaperId === 'cyber_grid_live') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          background: wallpaperId === 'love_hearts_live'
            ? 'radial-gradient(ellipse at bottom, #2b081c 0%, #0d0208 100%)'
            : wallpaperId === 'nature_forest_live'
              ? 'radial-gradient(ellipse at top, #062419 0%, #020d09 100%)'
              : wallpaperId === 'ocean_waves_live'
                ? 'radial-gradient(ellipse at bottom, #072740 0%, #020c14 100%)'
                : 'radial-gradient(ellipse at center, #1b0730 0%, #080210 100%)'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    );
  }

  return null;
}
