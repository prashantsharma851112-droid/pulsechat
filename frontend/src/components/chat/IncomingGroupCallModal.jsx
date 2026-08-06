import React from 'react';
import { Phone, PhoneOff, Video, Users } from 'lucide-react';

export default function IncomingGroupCallModal({ callData, onAccept, onDecline }) {
  const isVideo = callData?.isVideo;

  return (
    <div className="incoming-call-overlay" style={{ zIndex: 12500 }}>
      <div className="incoming-call-card" style={{ maxWidth: '400px' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={callData?.callerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callData?.callerName}`}
            alt="Group Caller"
            className="incoming-avatar-ring"
            style={{ width: '84px', height: '84px', borderRadius: '24px', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--accent)', color: '#fff', padding: '4px', borderRadius: '50%', border: '2px solid #0f172a' }}>
            <Users size={14} />
          </div>
        </div>

        <h3 className="incoming-caller-name" style={{ marginTop: '1rem', marginBottom: '0.2rem' }}>
          {callData?.groupName || 'Group Call'}
        </h3>
        <p className="incoming-call-type" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {callData?.callerName} started a Group {isVideo ? 'Video' : 'Voice'} Call
        </p>

        <div className="incoming-actions-row" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={onDecline}
            className="inc-action-btn inc-decline"
            title="Decline Call"
            style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <PhoneOff size={24} />
          </button>

          <button
            onClick={onAccept}
            className="inc-action-btn inc-accept"
            title="Accept & Join Group Call"
            style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#10b981', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {isVideo ? <Video size={24} /> : <Phone size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
}
