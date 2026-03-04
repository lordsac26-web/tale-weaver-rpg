import React, { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Generic modal for creating/editing lore entries.
 * fields: [{ key, label, type: 'text'|'textarea'|'select'|'tags', options?, required?, placeholder? }]
 */
export default function LoreEntryModal({ type, entry, fields, onSave, onClose }) {
  const [form, setForm] = useState({});
  const [tagInputs, setTagInputs] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial = {};
    const tinits = {};
    fields.forEach(f => {
      if (f.type === 'tags') {
        initial[f.key] = entry?.[f.key] || [];
        tinits[f.key] = '';
      } else {
        initial[f.key] = entry?.[f.key] || '';
      }
    });
    setForm(initial);
    setTagInputs(tinits);
  }, [entry]);

  const handleTagKeyDown = (key, e) => {
    if (e.key === 'Enter' && tagInputs[key]?.trim()) {
      e.preventDefault();
      setForm(prev => ({ ...prev, [key]: [...(prev[key] || []), tagInputs[key].trim()] }));
      setTagInputs(prev => ({ ...prev, [key]: '' }));
    }
  };

  const removeTag = (key, idx) => {
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const requiredFields = fields.filter(f => f.required);
  const canSave = requiredFields.every(f => form[f.key]?.toString().trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(12,8,4,0.98)', border: '1px solid rgba(201,169,110,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(20,13,5,0.5)' }}>
          <h3 className="font-fantasy font-bold text-base" style={{ color: '#c9a96e' }}>
            {entry ? `Edit ${type}` : `Add ${type}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(201,169,110,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.4)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          {fields.map(field => (
            <div key={field.key}>
              <label className="text-xs font-fantasy mb-1.5 block" style={{ color: 'rgba(201,169,110,0.55)' }}>
                {field.label} {field.required && <span style={{ color: '#f87171' }}>*</span>}
              </label>

              {field.type === 'textarea' && (
                <textarea
                  value={form[field.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder || ''}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg text-sm input-fantasy resize-none"
                  style={{ fontFamily: 'EB Garamond, serif', fontSize: '0.95rem', lineHeight: '1.6' }}
                />
              )}

              {field.type === 'select' && (
                <select
                  value={form[field.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm select-fantasy">
                  <option value="">— Select —</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === 'text' && (
                <input
                  value={form[field.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder || ''}
                  className="w-full px-3 py-2 rounded-lg text-sm input-fantasy"
                />
              )}

              {field.type === 'tags' && (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={tagInputs[field.key] || ''}
                      onChange={e => setTagInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                      onKeyDown={e => handleTagKeyDown(field.key, e)}
                      placeholder={field.placeholder || 'Type and press Enter to add...'}
                      className="flex-1 px-3 py-2 rounded-lg text-sm input-fantasy"
                    />
                    <button onClick={() => {
                      if (tagInputs[field.key]?.trim()) {
                        setForm(prev => ({ ...prev, [field.key]: [...(prev[field.key] || []), tagInputs[field.key].trim()] }));
                        setTagInputs(prev => ({ ...prev, [field.key]: '' }));
                      }
                    }} className="px-3 py-2 rounded-lg btn-fantasy">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {form[field.key]?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form[field.key].map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{ background: 'rgba(40,25,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>
                          {tag}
                          <button onClick={() => removeTag(field.key, i)} className="hover:opacity-70 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={saving || !canSave}
            className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {entry ? 'Save Changes' : `Add to Archives`}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-fantasy text-sm transition-all"
            style={{ background: 'rgba(20,13,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.5)' }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}