import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, CheckCircle2, Palette, Sparkles, Check } from 'lucide-react';
import { POLL_THEMES, getPollTheme } from './pollThemes';

export default function EditPollModal({ pollData, onClose, onSave }) {
  const [question, setQuestion] = useState(pollData.question || '');
  const [options, setOptions] = useState(
    pollData.options.map(opt => ({ ...opt }))
  );
  const [correctAnswerId, setCorrectAnswerId] = useState(pollData.correctAnswerId || null);
  const [theme, setTheme] = useState(pollData.theme || 'purple');
  const [error, setError] = useState('');

  const currentTheme = getPollTheme(theme);

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = { ...updated[index], text: value };
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, { id: 'opt_new_' + Date.now(), text: '', votes: [] }]);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const removedOpt = options[index];
      // Agar removed option correct tha toh reset karo
      if (correctAnswerId === removedOpt.id) {
        setCorrectAnswerId(null);
      }
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const toggleCorrectAnswer = (optId) => {
    setCorrectAnswerId(prev => prev === optId ? null : optId);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a poll question.');
      return;
    }
    const validOptions = options.map(o => ({ ...o, text: o.text.trim() })).filter(o => o.text);
    if (validOptions.length < 2) {
      setError('Please provide at least 2 non-empty options.');
      return;
    }

    const updatedPollData = {
      ...pollData,
      question: question.trim(),
      options: validOptions,
      correctAnswerId: correctAnswerId || null,
      theme: theme || 'purple'
    };

    onSave(updatedPollData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive" style={{ borderTop: `4px solid ${currentTheme.primary}`, maxWidth: '460px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: currentTheme.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BarChart2 size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Edit Poll
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customize question, answers & theme</span>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', maxHeight: '80vh', overflowY: 'auto' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Color Theme Selector */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Palette size={15} color={currentTheme.primary} />
              <span>Poll Color Theme</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {POLL_THEMES.map(t => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '10px',
                      border: isSelected ? `2px solid ${t.primary}` : '1.5px solid rgba(255,255,255,0.1)',
                      background: isSelected ? t.bgLight : 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: t.gradient,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question */}
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
                <CheckCircle2 size={13} color="#10b981" /> Click circle to mark correct answer
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((opt, i) => {
                const isCorrect = correctAnswerId === opt.id;
                return (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Correct Answer Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleCorrectAnswer(opt.id)}
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
                      value={opt.text}
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
          {correctAnswerId ? (
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
                <div>Correct answer: <strong>{options.find(o => o.id === correctAnswerId)?.text || ''}</strong></div>
                <div style={{ fontSize: '0.73rem', opacity: 0.85, marginTop: '2px', color: 'var(--text-muted)' }}>
                  🔒 Hidden until users vote! Once voted, correct/wrong feedback is revealed.
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              💡 No correct answer marked (standard opinion poll). Click a circle above if you want to make it a quiz!
            </div>
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
