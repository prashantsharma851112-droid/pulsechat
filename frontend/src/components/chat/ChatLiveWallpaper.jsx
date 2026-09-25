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
    const isMatrix = wallpaperId === 'matrix_code_live';
    const isStarry = wallpaperId === 'starry_galaxy_live';
    const isFirefly = wallpaperId === 'firefly_night_live';

    class Particle {
      constructor(isInitial = false) {
        this.reset(isInitial);
      }

      reset(isInitial = false) {
        const w = canvas.width || window.innerWidth || 360;
        const h = canvas.height || window.innerHeight || 640;
        this.x = Math.random() * w;
        if (isInitial) {
          this.y = Math.random() * h;
        } else {
          this.y = (isNature || isMatrix) ? -20 : (h + Math.random() * 40);
        }
        this.size = isMatrix ? (Math.random() * 12 + 12) : (Math.random() * 16 + 14);
        this.vy = (isNature || isMatrix) ? (Math.random() * 1.6 + 0.8) : -(Math.random() * 1.4 + 0.6);
        this.vx = isMatrix ? 0 : (Math.random() - 0.5) * 0.8;
        this.opacity = Math.random() * 0.35 + 0.15;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = isMatrix ? 0 : (Math.random() - 0.5) * 0.02;

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
        } else if (isMatrix) {
          const emojis = ['0', '1', '🟢', '⚡', '1', '0', '❇️'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        } else if (isStarry) {
          const emojis = ['✨', '⭐', '🌟', '💫', '🪐', '🌌'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        } else if (isFirefly) {
          const emojis = ['✨', '🟡', '💡', '🌟', '💛'];
          this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        }
      }

      update() {
        const h = canvas.height || window.innerHeight || 640;
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.vRot;

        if (isNature || isMatrix) {
          if (this.y > h + 30) this.reset(false);
        } else {
          if (this.y < -30) this.reset(false);
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

    const count = isMatrix ? 32 : 22;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(true));
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

  const isLiveWallpaper =
    wallpaperId === 'love_hearts_live' ||
    wallpaperId === 'nature_forest_live' ||
    wallpaperId === 'ocean_waves_live' ||
    wallpaperId === 'cyber_grid_live' ||
    wallpaperId === 'matrix_code_live' ||
    wallpaperId === 'starry_galaxy_live' ||
    wallpaperId === 'firefly_night_live';

  if (isLiveWallpaper) {
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
                : wallpaperId === 'matrix_code_live'
                  ? 'radial-gradient(ellipse at center, #021a0d 0%, #000904 100%)'
                  : wallpaperId === 'starry_galaxy_live'
                    ? 'radial-gradient(ellipse at top, #110d2c 0%, #04020f 100%)'
                    : wallpaperId === 'firefly_night_live'
                      ? 'radial-gradient(ellipse at bottom, #1c1902 0%, #080701 100%)'
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
