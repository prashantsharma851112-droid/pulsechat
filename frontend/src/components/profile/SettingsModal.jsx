import React, { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { X, Check } from 'lucide-react';

const THEMES = [
  { id: 'dark', name: '🌙 Dark Mode', color: '#6366f1' },
  { id: 'light', name: '☀️ Light Mode', color: '#4f46e5' },
  { id: 'emerald', name: '💬 Emerald Green (WhatsApp)', color: '#10b981' },
  { id: 'neon', name: '⚡ Cyberpunk Neon', color: '#ec4899' },
  { id: 'sunset', name: '🌅 Sunset Rose', color: '#f43f5e' }
];

export default function SettingsModal({ onClose }) {
  const { theme, changeTheme } = useContext(ThemeContext);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-sidebar)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', width: '90%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3>App Settings & Themes</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>CHOOSE COLOR THEME</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {THEMES.map(t => (
            <div 
              key={t.id} 
              onClick={() => changeTheme(t.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg-card)', border: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.color }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t.name}</span>
              </div>
              {theme === t.id && <Check size={18} color="var(--accent)" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
