import React, { useState } from 'react';
import { X, Clock, Calendar, Send, Sparkles, AlertCircle } from 'lucide-react';

export default function ScheduleMessageModal({ initialText = '', onSchedule, onClose }) {
  const [text, setText] = useState(initialText);

  // Helper to get formatted local datetime string for datetime-local input
  const getMinDateTimeLocal = () => {
    const d = new Date(Date.now() + 60 * 1000); // at least 1 min in future
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper to get tonight's 12:00 AM (midnight)
  const getTonightMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  // Helper to get tomorrow 9:00 AM
  const getTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  // Helper for in N minutes
  const getFutureTime = (minutes) => {
    return Date.now() + minutes * 60 * 1000;
  };

  const [selectedTimestamp, setSelectedTimestamp] = useState(() => getTonightMidnight());
  const [customDateTime, setCustomDateTime] = useState('');

  const handlePresetSelect = (ts) => {
    setSelectedTimestamp(ts);
    setCustomDateTime('');
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomDateTime(val);
    if (val) {
      const parsed = new Date(val).getTime();
      if (!isNaN(parsed)) {
        setSelectedTimestamp(parsed);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) {
      alert('Please enter a message to schedule!');
      return;
    }
    if (selectedTimestamp <= Date.now()) {
      alert('Scheduled time must be in the future!');
      return;
    }
    onSchedule({
      text: text.trim(),
      scheduledTimestamp: selectedTimestamp
    });
  };

  const formatTargetPreview = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 12000 }}>
      <div
        className="modal-card modal-responsive"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          padding: '20px',
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          animation: 'pulseModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Schedule Message ⏰
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Send automatically at the exact chosen time
              </p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn-ghost" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Message Input Box */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
            Message Content:
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message (e.g. Happy Birthday 🎂❤️, Don't forget tomorrow's meeting!)..."
            rows={3}
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '10px 14px',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.45
            }}
          />
        </div>

        {/* Quick Presets */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Quick Time Presets:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {/* Preset 1: Midnight Birthday Wish */}
            <button
              type="button"
              onClick={() => handlePresetSelect(getTonightMidnight())}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '12px',
                background: selectedTimestamp === getTonightMidnight() ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-card)',
                border: selectedTimestamp === getTonightMidnight() ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                color: selectedTimestamp === getTonightMidnight() ? '#f59e0b' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>🎂</span>
              <div>
                <div>Tonight 12:00 AM</div>
                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Birthday Wish</span>
              </div>
            </button>

            {/* Preset 2: Tomorrow Morning 9:00 AM */}
            <button
              type="button"
              onClick={() => handlePresetSelect(getTomorrowMorning())}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '12px',
                background: selectedTimestamp === getTomorrowMorning() ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-card)',
                border: selectedTimestamp === getTomorrowMorning() ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                color: selectedTimestamp === getTomorrowMorning() ? '#f59e0b' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>🌅</span>
              <div>
                <div>Tomorrow 9:00 AM</div>
                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Morning Greeting</span>
              </div>
            </button>

            {/* Preset 3: In 30 Minutes */}
            <button
              type="button"
              onClick={() => handlePresetSelect(getFutureTime(30))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '12px',
                background: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(30)) < 60000) ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-card)',
                border: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(30)) < 60000) ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                color: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(30)) < 60000) ? '#f59e0b' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>⏱️</span>
              <div>
                <div>In 30 Minutes</div>
                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Quick reminder</span>
              </div>
            </button>

            {/* Preset 4: In 1 Hour */}
            <button
              type="button"
              onClick={() => handlePresetSelect(getFutureTime(60))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '12px',
                background: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(60)) < 60000) ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-card)',
                border: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(60)) < 60000) ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                color: (selectedTimestamp > Date.now() && Math.abs(selectedTimestamp - getFutureTime(60)) < 60000) ? '#f59e0b' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>⏳</span>
              <div>
                <div>In 1 Hour</div>
                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Later today</span>
              </div>
            </button>
          </div>
        </div>

        {/* Custom Date & Time Picker */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
            Or Pick Custom Date & Time:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              min={getMinDateTimeLocal()}
              value={customDateTime}
              onChange={handleCustomChange}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: customDateTime ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        {/* Preview Selected Schedule */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Clock size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
            Scheduled for: <strong style={{ color: '#f59e0b' }}>{formatTargetPreview(selectedTimestamp)}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ borderRadius: '12px', padding: '10px 18px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary"
            style={{
              borderRadius: '12px',
              padding: '10px 22px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
            }}
          >
            <Send size={16} /> Schedule Now 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
