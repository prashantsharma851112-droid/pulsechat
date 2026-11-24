import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

/**
 * High-performance, offline-first SVG QR Code component.
 * Uses zero external network requests and renders scalable vector graphics.
 */
export default function QrCodeView({
  value,
  size = 220,
  level = 'M',
  bgColor = '#ffffff',
  fgColor = '#000000',
  className = '',
  style = {}
}) {
  const [svgString, setSvgString] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!value) {
      setSvgString('');
      return;
    }

    let isMounted = true;
    QRCode.toString(
      value,
      {
        type: 'svg',
        errorCorrectionLevel: level,
        margin: 1,
        color: {
          dark: fgColor,
          light: bgColor
        }
      },
      (err, string) => {
        if (!isMounted) return;
        if (err) {
          console.error('Failed to generate QR code SVG:', err);
          setError(err.message);
        } else {
          setError(null);
          setSvgString(string);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [value, level, bgColor, fgColor]);

  if (error) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          borderRadius: '12px',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '8px',
          ...style
        }}
      >
        Failed to render QR Code
      </div>
    );
  }

  if (!svgString) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bgColor,
          borderRadius: '12px',
          ...style
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '3px solid rgba(0,0,0,0.1)',
            borderTopColor: fgColor,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        padding: '10px',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
