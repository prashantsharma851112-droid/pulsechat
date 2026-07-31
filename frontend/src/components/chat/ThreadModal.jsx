import React, { useState } from 'react';
import { X, Send, GitBranch } from 'lucide-react';

export default function ThreadModal({ message, onClose, currentUser }) {
  const [replies, setReplies] = useState([
    { id: '1', senderName: 'System', content: 'Thread branch created for this message.', time: 'Just now' }
  ]);
  const [text, setText] = useState('');

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setReplies(prev => [...prev, {
      id: 'reply_' + Date.now(),
      senderName: currentUser.displayName,
      content: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setText('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Sub-Thread Branch</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '480px' }}>
          {/* Original Message Banner */}
          <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '10px', borderLeft: '4px solid var(--accent)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '2px' }}>Parent Message</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>{message?.content || message?.type || 'Media message'}</p>
          </div>

          {/* Thread List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px' }}>
            {replies.map(r => (
              <div key={r.id} style={{ background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{r.senderName}</strong>
                  <span>{r.time}</span>
                </div>
                <div>{r.content}</div>
              </div>
            ))}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Reply to thread..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button type="submit" className="btn-primary-round"><Send size={16} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
