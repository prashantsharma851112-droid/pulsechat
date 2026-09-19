import React, { useRef, useState } from 'react';

export default function WaterMotionContainer({ children, maxWidth = '450px' }) {
  const cardRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});

  const handleMouseMove = (e) => {
    if (!cardRef.current || window.innerWidth < 768) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt angles (max ~6 degrees)
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-5px)`
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)'
    });
  };

  return (
    <div className="water-motion-viewport" onMouseMove={handleMouseMove}>
      {/* Background Fluid Morphs */}
      <div className="water-blob-1" />
      <div className="water-blob-2" />
      <div className="water-blob-3" />

      {/* Floating Water Bubbles */}
      <div className="water-bubble water-bubble-1" />
      <div className="water-bubble water-bubble-2" />
      <div className="water-bubble water-bubble-3" />
      <div className="water-bubble water-bubble-4" />

      {/* 3D Floating Glassmorphism Auth Card */}
      <div
        ref={cardRef}
        className="auth-card-3d"
        style={{ maxWidth, ...tiltStyle }}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
    </div>
  );
}
