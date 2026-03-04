import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { StickyNote, Plus, Pin, Trash2, Edit3, X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_STYLES = {
  General:  { color: '#c9a96e', emoji: '📝' },
  Quest:    { color: '#fbbf24', emoji: '⚔️' },
  NPC:      { color: '#60a5fa', emoji: '👤' },
  Location: { color: '#4ade80', emoji: '📍' },
  Rumor:    { color: '#fb923c', emoji: '👂' },
  Secret:   { color: '#f87171', emoji: '🔒' },
  Reminder: { color: '#a78bfa', emoji: '🔔' },
  Lore:     { color: '#d8b4fe', emoji: '📖' },
};

const CATEGORIES = Object.keys(CATEGORY_STYLES);

export default function PlayerNotes({ search }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [form, setForm] = useState({ title: '', content: '', category: 'General', tags: '', related_location: '', related_npc: '', is_pinned: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const data = await base44.entities.PlayerNote.list('-updated_date', 200);
    setNotes(data);
    setLoading(false);
  };

  const filtered = notes.filter(n => {
    const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.content?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'All' || n.category === filterCategory;
    return matchSearch && matchCat;
  });

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  const openCreate = () => {
    setEditingNote(null);
    setForm({ title: '', content: '', category: 'General', tags: '', related_location: '', related_npc: '', is_pinned: false });
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setForm({
      title: note.title || '',
      content: note.content || '',
      category: note.category || 'General',
      tags: (note.tags || []).join(', '),
      related_location: note.related_location || '',
      related_npc: note.related_npc || '',
      is_pinned: note.is_pinned || false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    if (editingNote) {
      const updated = await base44.entities.PlayerNote.update(editingNote.id, data);
      setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
    } else {
      const created = await base44.entities.PlayerNote.create(data);
      setNotes(prev => [created, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setEditingNote(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.PlayerNote.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const togglePin = async (note) => {
    const updated = await base44.entities.PlayerNote.update(note.id, { is_pinned: !note.is_pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(201,169,110,0.5)' }} />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5" style={{ color: '#c9a96e' }} />
          <h2 className="font-fantasy font-bold text-xl" style={{ color: '#c9a96e' }}>Adventurer's Logbook</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-fantasy"
            style={{ background: 'rgba(40,25,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.5)' }}>
            {filtered.length}
          </span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
          <Plus className="w-3.5 h-3.5" /> New Entry
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {['All', ...CATEGORIES].map(cat => {
          const style = CATEGORY_STYLES[cat];
          const active = filterCategory === cat;
          return (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className="px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
              style={{
                background: active ? (style ? `${style.color}20` : 'rgba(201,169,110,0.15)') : 'rgba(16,11,5,0.6)',
                border: active ? `1px solid ${style ? style.color + '50' : 'rgba(201,169,110,0.4)'}` : '1px solid rgba(180,140,90,0.12)',
                color: active ? (style ? style.color : '#c9a96e') : 'rgba(201,169,110,0.4)',
              }}>
              {style?.emoji} {cat}
            </button>
          );
        })}
      </div>

      {/* Note Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl p-6 space-y-4"
              style={{ background: 'rgba(14,9,4,0.98)', border: '1px solid rgba(201,169,110,0.25)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-fantasy font-bold text-base" style={{ color: '#c9a96e' }}>
                  {editingNote ? 'Edit Note' : 'New Log Entry'}
                </h3>
                <button onClick={() => setShowForm(false)} style={{ color: 'rgba(201,169,110,0.4)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Entry title..." className="w-full px-3 py-2 rounded-lg text-sm input-fantasy" />

              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write your notes here... What did you discover? Who did you meet? What secrets have you uncovered?"
                className="w-full px-3 py-2 rounded-lg text-sm input-fantasy resize-none"
                rows={6} style={{ fontFamily: 'EB Garamond, serif', fontSize: '1rem', lineHeight: '1.6' }} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-fantasy mb-1 block" style={{ color: 'rgba(201,169,110,0.5)' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm select-fantasy">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_STYLES[c].emoji} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-fantasy mb-1 block" style={{ color: 'rgba(201,169,110,0.5)' }}>Tags (comma-separated)</label>
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="dragon, dungeon, clue..." className="w-full px-3 py-2 rounded-lg text-sm input-fantasy" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-fantasy mb-1 block" style={{ color: 'rgba(201,169,110,0.5)' }}>Related Location</label>
                  <input value={form.related_location} onChange={e => setForm(f => ({ ...f, related_location: e.target.value }))}
                    placeholder="e.g. Thornhaven..." className="w-full px-3 py-2 rounded-lg text-sm input-fantasy" />
                </div>
                <div>
                  <label className="text-xs font-fantasy mb-1 block" style={{ color: 'rgba(201,169,110,0.5)' }}>Related NPC</label>
                  <input value={form.related_npc} onChange={e => setForm(f => ({ ...f, related_npc: e.target.value }))}
                    placeholder="e.g. Brother Aldric..." className="w-full px-3 py-2 rounded-lg text-sm input-fantasy" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, is_pinned: !f.is_pinned }))}
                  className="w-5 h-5 rounded flex items-center justify-center transition-all"
                  style={{
                    background: form.is_pinned ? 'rgba(201,169,110,0.3)' : 'rgba(10,6,3,0.7)',
                    border: `1px solid ${form.is_pinned ? 'rgba(201,169,110,0.6)' : 'rgba(180,140,90,0.2)'}`,
                  }}>
                  {form.is_pinned && <Check className="w-3 h-3" style={{ color: '#c9a96e' }} />}
                </div>
                <span className="text-sm" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                  📌 Pin this note to the top
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}
                  className="flex-1 py-2 rounded-xl font-fantasy text-sm btn-fantasy disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (editingNote ? 'Save Changes' : 'Add to Logbook')}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl font-fantasy text-sm transition-all"
                  style={{ background: 'rgba(20,13,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.5)' }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📜</p>
          <p className="font-fantasy" style={{ color: 'rgba(201,169,110,0.3)' }}>
            {search ? 'No notes match your search.' : 'Your logbook is empty. Start recording your adventures!'}
          </p>
        </div>
      )}

      {/* Pinned notes */}
      {pinned.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-fantasy mb-3 flex items-center gap-1" style={{ color: 'rgba(201,169,110,0.5)' }}>
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinned.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={handleDelete} onTogglePin={togglePin} />)}
          </div>
        </div>
      )}

      {/* Other notes */}
      {unpinned.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {unpinned.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={handleDelete} onTogglePin={togglePin} />)}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete, onTogglePin }) {
  const style = CATEGORY_STYLES[note.category] || CATEGORY_STYLES.General;
  return (
    <motion.div layout className="rounded-xl p-4 fantasy-card"
      style={{ background: 'rgba(16,11,5,0.85)', border: `1px solid ${note.is_pinned ? 'rgba(201,169,110,0.3)' : 'rgba(180,140,90,0.12)'}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span>{style.emoji}</span>
          <h3 className="font-fantasy font-bold text-sm truncate" style={{ color: '#e8d5b7' }}>{note.title}</h3>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onTogglePin(note)} title="Pin/Unpin"
            className="p-1 rounded transition-all" style={{ color: note.is_pinned ? '#c9a96e' : 'rgba(201,169,110,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = note.is_pinned ? '#c9a96e' : 'rgba(201,169,110,0.25)'}>
            <Pin className="w-3 h-3" />
          </button>
          <button onClick={() => onEdit(note)} className="p-1 rounded transition-all"
            style={{ color: 'rgba(201,169,110,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.3)'}>
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(note.id)} className="p-1 rounded transition-all"
            style={{ color: 'rgba(248,113,113,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,113,113,0.3)'}>
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p className="text-sm leading-relaxed mb-3 line-clamp-4"
        style={{ color: 'rgba(232,213,183,0.65)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>
        {note.content}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
          style={{ background: `${style.color}15`, border: `1px solid ${style.color}30`, color: style.color }}>
          {note.category}
        </span>
        {note.related_location && (
          <span className="text-xs" style={{ color: 'rgba(74,222,128,0.5)', fontFamily: 'EB Garamond, serif' }}>
            📍 {note.related_location}
          </span>
        )}
        {note.related_npc && (
          <span className="text-xs" style={{ color: 'rgba(96,165,250,0.5)', fontFamily: 'EB Garamond, serif' }}>
            👤 {note.related_npc}
          </span>
        )}
      </div>

      {note.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {note.tags.map((tag, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(40,25,5,0.6)', border: '1px solid rgba(180,140,90,0.1)', color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}