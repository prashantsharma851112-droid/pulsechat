import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function IncomingCallModal({ callData, onAccept, onDecline }) {
  if (!callData) return null;

  const { callerName, callerAvatar, isVideo } = callData;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <div className="incoming-avatar-ring">
          <img
            src={callerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerName || 'caller'}`}
            alt="Caller"
            className="incoming-avatar"
          />
        </div>

        <h3 className="incoming-caller-name">{callerName || 'Incoming Call'}</h3>
        <p className="incoming-call-type">
          {isVideo ? 'Incoming Pulse Video Call...' : 'Incoming Pulse Audio Call...'}
        </p>

        <div className="incoming-actions">
          <button className="call-btn btn-decline" onClick={onDecline} title="Decline Call">
            <PhoneOff size={24} />
          </button>
          <button className="call-btn btn-accept" onClick={onAccept} title="Accept Call">
            {isVideo ? <Video size={24} /> : <Phone size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
}
