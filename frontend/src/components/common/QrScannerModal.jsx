import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Zap, ZapOff, AlertCircle, KeyRound, Check, Upload, Image as ImageIcon } from 'lucide-react';
import jsQR from 'jsqr';
import { useBackHandler } from '../../utils/backNavigation';

/**
 * Mobile-Optimized QR Scanner Modal for Device-to-Device Chat Transfer.
 * Supports:
 * 1. Hardware BarcodeDetector with pure-JS jsQR live stream fallback.
 * 2. 3-tier camera constraint fallback (ideal 720p -> facingMode -> any video).
 * 3. Native system camera / gallery photo snap fallback via file input (works 100% reliably everywhere, including non-HTTPS).
 * 4. Manual pairing code text input fallback.
 */
export default function QrScannerModal({ isOpen, onClose, onScanSuccess, title = 'Scan QR Code' }) {
  const [hasPermission, setHasPermission] = useState(null); // null = requesting, true = granted, false = denied
  const [errorMessage, setErrorMessage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isScanningRef = useRef(true);
  const fileInputRef = useRef(null);

  useBackHandler(() => {
    if (isOpen) {
      handleClose();
      return true;
    }
    return false;
  }, isOpen);

  const stopStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleClose = () => {
    isScanningRef.current = false;
    stopStream();
    onClose?.();
  };

  const startCamera = async () => {
    stopStream();
    setErrorMessage(null);
    setHasPermission(null);
    isScanningRef.current = true;

    try {
      const getUserMediaFn = (
        navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
        navigator?.getUserMedia?.bind(navigator) ||
        navigator?.webkitGetUserMedia?.bind(navigator) ||
        navigator?.mozGetUserMedia?.bind(navigator)
      );

      if (!getUserMediaFn) {
        throw new Error('Live camera streaming is not supported in this browser context (e.g. non-HTTPS). Tap "Snap Photo of QR" below!');
      }

      let stream = null;
      let lastErr = null;

      // Tier 1: Try with preferred facingMode and 720p resolution
      try {
        stream = await getUserMediaFn({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        lastErr = err1;
      }

      // Tier 2: Try with basic facingMode
      if (!stream) {
        try {
          stream = await getUserMediaFn({
            video: { facingMode: facingMode },
            audio: false
          });
        } catch (err2) {
          lastErr = err2;
        }
      }

      // Tier 3: Try with any video stream
      if (!stream) {
        try {
          stream = await getUserMediaFn({
            video: true,
            audio: false
          });
        } catch (err3) {
          lastErr = err3;
        }
      }

      if (!stream) {
        throw lastErr || new Error('Could not access any camera on this device.');
      }

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play().catch(() => {});
      }

      // Check for torch capability
      const track = stream.getVideoTracks()?.[0];
      if (track?.getCapabilities) {
        const capabilities = track.getCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      }

      startScanLoop();
    } catch (err) {
      console.warn('QR Scanner camera init error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Tap "Snap Photo of QR" below, or allow camera in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera found on this device. Tap "Snap Photo of QR" or enter code manually.');
      } else {
        setErrorMessage(err.message || 'Unable to access live camera.');
      }
    }
  };

  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas context not available');

          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data) {
            isScanningRef.current = false;
            stopStream();
            setIsProcessingFile(false);
            onScanSuccess?.(code.data);
          } else {
            setIsProcessingFile(false);
            setErrorMessage('No QR code detected in this photo. Please hold the phone closer to the QR code and try again.');
            setHasPermission(false);
          }
        } catch (err) {
          console.warn('QR decode from image error:', err);
          setIsProcessingFile(false);
          setErrorMessage('Failed to decode QR image. Please try again.');
          setHasPermission(false);
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setErrorMessage('Could not load image file.');
        setHasPermission(false);
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      setErrorMessage('Failed to read image.');
      setHasPermission(false);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Failed to toggle torch:', e);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (isOpen && !showManualInput) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, showManualInput]);

  const startScanLoop = () => {
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window;
    let nativeDetector = null;
    if (hasNativeBarcodeDetector) {
      try {
        nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (_) {
        nativeDetector = null;
      }
    }

    let lastScanTime = 0;
    const SCAN_INTERVAL_MS = 100; // Fast 10 scans/second without heavy CPU load

    const scanFrame = async (timestamp) => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
        if (timestamp - lastScanTime >= SCAN_INTERVAL_MS) {
          lastScanTime = timestamp;

          try {
            let foundRawValue = null;

            // 1. Fast Native Hardware Scanner (Chrome / Android WebView)
            if (nativeDetector) {
              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  foundRawValue = barcodes[0].rawValue;
                }
              } catch (_) {}
            }

            // 2. Pure-JS Fallback Scanner via jsQR
            if (!foundRawValue && video.videoWidth > 0 && video.videoHeight > 0) {
              const canvas = canvasRef.current || document.createElement('canvas');
              if (!canvasRef.current) canvasRef.current = canvas;

              // Downscale to max 640px for rapid real-time decoding
              const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
              const w = Math.floor(video.videoWidth * scale);
              const h = Math.floor(video.videoHeight * scale);

              if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
              }

              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert'
                });
                if (code && code.data) {
                  foundRawValue = code.data;
                }
              }
            }

            if (foundRawValue && isScanningRef.current) {
              isScanningRef.current = false;
              stopStream();
              onScanSuccess?.(foundRawValue);
              return;
            }
          } catch (scanErr) {
            console.warn('Scan frame error:', scanErr);
          }
        }
      }

      if (isScanningRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    isScanningRef.current = false;
    stopStream();
    onScanSuccess?.(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 10005,
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={handleClose}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#09090b',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.2)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="interactive-tap"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden native camera/gallery input for 100% reliable QR photo scan fallback */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleImageFileSelect}
          style={{ display: 'none' }}
        />

        {/* Viewfinder or Fallback Body */}
        {!showManualInput ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '340px',
              background: '#000',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {hasPermission === true && (
              <>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />

                {/* Reticle Target Area with Glowing Corners */}
                <div
                  style={{
                    position: 'absolute',
                    width: '220px',
                    height: '220px',
                    borderRadius: '18px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                    border: '2px solid rgba(16, 185, 129, 0.6)',
                    pointerEvents: 'none'
                  }}
                >
                  {/* Top-left corner */}
                  <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '24px', height: '24px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: '16px' }} />
                  {/* Top-right corner */}
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '24px', height: '24px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: '16px' }} />
                  {/* Bottom-left corner */}
                  <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '24px', height: '24px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: '16px' }} />
                  {/* Bottom-right corner */}
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: '16px' }} />

                  {/* Laser Scan Animation Line */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '0',
                      left: '0',
                      right: '0',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
                      boxShadow: '0 0 8px #10b981',
                      animation: 'scanLine 2s linear infinite'
                    }}
                  />
                </div>

                {/* Floating Viewfinder Controls (Torch + Flip + Snap) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '14px',
                    zIndex: 10
                  }}
                >
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className="interactive-tap"
                      style={{
                        background: torchOn ? '#10b981' : 'rgba(0, 0, 0, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: torchOn ? '#000' : '#fff',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Toggle Torch"
                    >
                      {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="interactive-tap"
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Switch Camera"
                  >
                    <RefreshCw size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="interactive-tap"
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#38bdf8',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Snap or Upload Photo"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              </>
            )}

            {hasPermission === null && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', border: '3px solid rgba(16, 185, 129, 0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Starting camera...</span>
              </div>
            )}

            {hasPermission === false && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={36} color="#ef4444" />
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>Camera Unavailable</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, maxWidth: '300px' }}>{errorMessage}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '260px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="interactive-tap"
                    disabled={isProcessingFile}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <Camera size={17} />
                    <span>{isProcessingFile ? 'Scanning photo...' : 'Snap Photo of QR Code'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="interactive-tap"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Enter Pairing Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="interactive-tap"
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: '#64748b',
                      border: 'none',
                      fontWeight: 500,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Retry Live Camera</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Manual Pairing Code Entry Fallback */
          <form onSubmit={handleManualSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              If your camera cannot scan, paste the pairing code text copied from your old phone:
            </div>
            <textarea
              rows={4}
              placeholder="Paste pairing code here..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="interactive-tap"
              style={{
                padding: '12px',
                borderRadius: '12px',
                background: manualCode.trim() ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: manualCode.trim() ? '#000' : 'rgba(255, 255, 255, 0.3)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Check size={16} />
              <span>Connect With Code</span>
            </button>
          </form>
        )}

        {/* Footer Toggle for Manual Code Input */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="interactive-tap"
            disabled={isProcessingFile}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Camera size={14} />
            <span>{isProcessingFile ? 'Scanning...' : 'Snap Photo'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            style={{
              background: 'none',
              border: 'none',
              color: '#10b981',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <KeyRound size={13} />
            <span>{showManualInput ? 'Use Camera' : 'Manual Code'}</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
