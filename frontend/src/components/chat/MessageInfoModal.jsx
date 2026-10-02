import React from 'react';
import { X, Check, CheckCheck, Clock, Info, Calendar } from 'lucide-react';

export default function MessageInfoModal({ message, isMine, onClose }) {
  if (!message) return null;

  const msgTime = new Date(message.timestamp || Date.now());
  const formattedFullDate = msgTime.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = msgTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const isRead = message.status === 'read';
  const isDelivered = message.status === 'delivered' || isRead;
  const isSent = message.status !== 'pending';

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div
        className="modal-card modal-responsive"
        style={{
          maxWidth: '420px',
          width: '92vw',
          padding: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'var(--bg-card)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={18} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Message Info
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn-ghost"
            style={{ width: '34px', height: '34px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Preview */}
        <div style={{ padding: '16px 20px', background: 'rgba(99, 102, 241, 0.05)', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            background: isMine ? 'var(--bubble-sent)' : 'var(--bubble-received)',
            color: isMine ? '#fff' : 'var(--text-main)',
            padding: '10px 14px',
            borderRadius: '14px',
            fontSize: '0.88rem',
            wordBreak: 'break-word',
            display: 'inline-block',
            maxWidth: '100%'
          }}>
            {message.type === 'image' && message.mediaUrl ? (
              <div>
                <img
                  src={message.mediaUrl}
                  alt="Media"
                  style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '8px', objectFit: 'cover' }}
                />
                {message.content && <p style={{ margin: '6px 0 0 0' }}>{message.content}</p>}
              </div>
            ) : message.type === 'audio' ? (
              <span>🎵 Voice Message</span>
            ) : message.type === 'gift' ? (
              <span>🎁 3D Sticker</span>
            ) : message.type === 'poll' ? (
              <span>📊 Interactive Poll</span>
            ) : (
              message.content || 'Message'
            )}
          </div>
        </div>

        {/* Status / Receipts Timeline */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>
            Delivery Receipts
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Read Receipt */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isRead ? 'rgba(83, 189, 235, 0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCheck size={18} color={isRead ? '#53bdeb' : '#6b7280'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isRead ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    Read
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isRead ? 'Seen by recipient' : 'Not read yet'}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {isRead ? formattedTime : '—'}
              </span>
            </div>

            {/* Delivered Receipt */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isDelivered ? 'rgba(156, 163, 175, 0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCheck size={18} color={isDelivered ? '#9ca3af' : '#6b7280'} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isDelivered ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    Delivered
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isDelivered ? 'Delivered to recipient device' : 'Pending delivery'}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {isDelivered ? formattedTime : '—'}
              </span>
            </div>

            {/* Sent Receipt */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={18} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Sent
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Transmitted to server
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Date info */}
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} />
              <span>{formattedFullDate}</span>
            </div>
            {message.content && (
              <span>{message.content.length} characters</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right', background: 'rgba(0,0,0,0.1)' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '6px 16px', fontSize: '0.82rem', borderRadius: '10px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
