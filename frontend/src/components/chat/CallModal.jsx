import React, { useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

export default function CallModal({ user, isVideo, onClose }) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!isVideo);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img src={user.avatar} alt="User" style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--accent)', margin: '0 auto 1rem auto' }} />
        <h2 style={{ fontSize: '1.5rem', color: '#fff' }}>{user.displayName}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{isVideo ? 'Pulse Video Call...' : 'Pulse Audio Call...'}</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <button onClick={() => setMuted(!muted)} style={{ background: muted ? '#ef4444' : 'rgba(255,255,255,0.2)', color: '#fff', padding: '16px', borderRadius: '50%' }}>
          {muted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button onClick={onClose} style={{ background: '#ef4444', color: '#fff', padding: '16px', borderRadius: '50%' }} title="End Call">
          <PhoneOff size={24} />
        </button>

        {isVideo && (
          <button onClick={() => setVideoOff(!videoOff)} style={{ background: videoOff ? '#ef4444' : 'rgba(255,255,255,0.2)', color: '#fff', padding: '16px', borderRadius: '50%' }}>
            {videoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
      </div>
    </div>
  );
}
