import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, CheckCircle2 } from 'lucide-react';

export default function EditPollModal({ pollData, onClose, onSave }) {
  const [question, setQuestion] = useState(pollData.question || '');
  const [options, setOptions] = useState(
    pollData.options.map(opt => ({ ...opt }))
  );
  const [correctAnswerId, setCorrectAnswerId] = useState(pollData.correctAnswerId || null);
  const [error, setError] = useState('');

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
      correctAnswerId: correctAnswerId || null
    };

    onSave(updatedPollData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Edit Poll</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Question */}
          <div>
            <label className="form-label">Question</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ask something..."
              value={question}
              onChange={(e) => { setQuestion(e.target.value); setError(''); }}
              autoFocus
            />
          </div>

          {/* Options */}
          <div>
            <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>
              Options
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                (✓ click to mark correct answer)
              </span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((opt, i) => {
                const isCorrect = correctAnswerId === opt.id;
                return (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Correct Answer Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleCorrectAnswer(opt.id)}
                      title={isCorrect ? 'Remove correct answer mark' : 'Mark as correct answer'}
                      style={{
                        background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                        border: isCorrect ? '1.5px solid #10b981' : '1.5px solid rgba(255,255,255,0.15)',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <CheckCircle2 size={16} color={isCorrect ? '#10b981' : 'rgba(255,255,255,0.3)'} />
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
                        boxShadow: isCorrect ? '0 0 0 2px rgba(16,185,129,0.12)' : undefined
                      }}
                    />

                    {isCorrect && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✓ Correct
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

          {/* Correct Answer Info */}
          {correctAnswerId && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '0.8rem',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={14} />
              Correct answer marked: <strong>{options.find(o => o.id === correctAnswerId)?.text || ''}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 20px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
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
