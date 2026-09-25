import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, CheckCircle2, Palette, Sparkles, Check, Crown } from 'lucide-react';
import { POLL_THEMES, getPollTheme, POLL_AURAS, getPollAura } from './pollThemes';

export default function CreatePollModal({ onClose, onCreatePoll, user, onOpenProModal }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null);
  const [theme, setTheme] = useState('purple');
  const [aura, setAura] = useState('standard');
  const [error, setError] = useState('');

  const currentTheme = getPollTheme(theme);
  const currentAura = getPollAura(aura);
  const isProUser = Boolean(user?.isPro);

  const handleSelectTheme = (t) => {
    if (t.isPro && !isProUser) {
      if (onOpenProModal) onOpenProModal('pro');
      return;
    }
    setTheme(t.id);
  };

  const handleSelectAura = (a) => {
    if (a.isPro && !isProUser) {
      if (onOpenProModal) onOpenProModal('pro');
      return;
    }
    setAura(a.id);
  };

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      if (correctAnswerIndex === index) setCorrectAnswerIndex(null);
      else if (correctAnswerIndex > index) setCorrectAnswerIndex(prev => prev - 1);
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const toggleCorrectAnswer = (index) => {
    setCorrectAnswerIndex(prev => prev === index ? null : index);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a poll question.');
      return;
    }
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      setError('Please provide at least 2 non-empty options.');
      return;
    }

    const builtOptions = validOptions.map((optText, i) => ({
      id: 'opt_' + i + '_' + Date.now(),
      text: optText,
      votes: []
    }));

    const correctAnswerId = correctAnswerIndex !== null && builtOptions[correctAnswerIndex]
      ? builtOptions[correctAnswerIndex].id
      : null;

    const pollData = {
      question: question.trim(),
      options: builtOptions,
      isMultipleChoice,
      correctAnswerId,
      theme: theme || 'purple',
      aura: aura || 'standard'
    };

    onCreatePoll(pollData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ borderTop: `4px solid ${currentTheme.primary}`, maxWidth: '480px', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: currentTheme.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 3px 10px ${currentTheme.glow}`
            }}>
              <BarChart2 size={19} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Create Poll
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interactive polls & animated quiz cards</span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.1rem 1.25rem 2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Color Theme Selector */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Palette size={15} color={currentTheme.primary} />
                <span>Poll Color Theme</span>
              </div>
              {!isProUser && (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                  👑 VIP Themes available
                </span>
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {POLL_THEMES.map(t => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                      padding: '7px 8px',
                      borderRadius: '10px',
                      border: isSelected ? `2px solid ${t.primary}` : '1.5px solid rgba(255,255,255,0.1)',
                      background: isSelected ? t.bgLight : 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: t.gradient,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {t.name.split(' ')[1] || t.name}
                      </span>
                    </div>
                    {t.isPro && (
                      <Crown size={11} color="#f59e0b" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animated Poll Aura Selector */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#f59e0b" />
                <span>Card Aura Decoration</span>
              </div>
              {currentAura.isPro && (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Crown size={12} /> Pro Aura Selected
                </span>
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {POLL_AURAS.map(a => {
                const isSelected = aura === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectAura(a)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: isSelected ? `2px solid ${a.borderColor}` : '1.5px solid rgba(255,255,255,0.1)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '1.05rem', flexShrink: 0 }}>{a.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.77rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#fff' : 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {a.name.replace(' 👑', '')}
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.desc}
                        </div>
                      </div>
                    </div>
                    {a.isPro && (
                      <Crown size={11} color="#f59e0b" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question input */}
          <div>
            <label className="form-label">Question</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ask something..."
              value={question}
              onChange={(e) => { setQuestion(e.target.value); setError(''); }}
              style={{
                border: `1.5px solid ${currentTheme.border}`,
                background: 'rgba(0,0,0,0.2)'
              }}
              autoFocus
            />
          </div>

          {/* Options */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Options
              </label>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={13} color="#10b981" /> Click circle for Quiz answer
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((opt, i) => {
                const isCorrect = correctAnswerIndex === i;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Correct Answer Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCorrectAnswer(i)}
                      title={isCorrect ? 'Correct Answer selected (click to unmark)' : 'Click to mark as correct answer'}
                      style={{
                        background: isCorrect ? '#10b981' : 'rgba(255,255,255,0.06)',
                        border: isCorrect ? '2px solid #10b981' : '1.5px solid rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s ease',
                        boxShadow: isCorrect ? '0 0 10px rgba(16,185,129,0.45)' : 'none'
                      }}
                    >
                      <CheckCircle2 size={18} color={isCorrect ? '#fff' : 'rgba(255,255,255,0.35)'} />
                    </button>

                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      style={{
                        flex: 1,
                        border: isCorrect ? '1.5px solid #10b981' : undefined,
                        background: isCorrect ? 'rgba(16,185,129,0.06)' : undefined,
                        boxShadow: isCorrect ? '0 0 0 2px rgba(16,185,129,0.15)' : undefined
                      }}
                    />

                    {isCorrect && (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#10b981',
                        fontWeight: 700,
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }}>
                        ✓ Correct Answer
                      </span>
                    )}

                    {options.length > 2 && (
                      <button
                        type="button"
                        className="icon-btn-ghost"
                        onClick={() => removeOption(i)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={addOption}
                style={{ marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Option
              </button>
            )}
          </div>

          {/* Correct Answer Explanation Banner */}
          {correctAnswerIndex !== null && options[correctAnswerIndex]?.trim() ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: '#10b981',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div>Correct answer: <strong>{options[correctAnswerIndex]}</strong></div>
                <div style={{ fontSize: '0.73rem', opacity: 0.85, marginTop: '2px', color: 'var(--text-muted)' }}>
                  🔒 Hidden from chat until someone votes! When they click, it reveals if their guess is correct or wrong.
                </div>
              </div>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={isMultipleChoice}
                onChange={(e) => setIsMultipleChoice(e.target.checked)}
              />
              Allow multiple choices
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              style={{
                background: currentTheme.gradient,
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '9px 22px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: `0 4px 12px ${currentTheme.glow}`,
                transition: 'opacity 0.15s'
              }}
            >
              Create & Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
