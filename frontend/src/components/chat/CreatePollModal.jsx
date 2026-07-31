import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';

export default function CreatePollModal({ onClose, onCreatePoll }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [error, setError] = useState('');

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
      setOptions(options.filter((_, i) => i !== index));
    }
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

    const pollData = {
      question: question.trim(),
      options: validOptions.map((optText, i) => ({
        id: 'opt_' + i + '_' + Date.now(),
        text: optText,
        votes: []
      })),
      isMultipleChoice
    };

    onCreatePoll(pollData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-responsive">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Create Poll</h3>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div className="error-banner">{error}</div>}

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

          <div>
            <label className="form-label">Options</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                  />
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
              ))}
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={isMultipleChoice}
              onChange={(e) => setIsMultipleChoice(e.target.checked)}
            />
            Allow multiple choices
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create & Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}
