import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';

const CATEGORIES = ['General', 'Quest', 'NPC', 'Location', 'Rumor', 'Secret', 'Reminder', 'Lore'];

export default function CampaignJournal({ sessionId, characterId }) {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [sessionId]);

  const loadNotes = async () => {
    if (!sessionId) return;
    setLoading(true);
    const rows = await base44.entities.PlayerNote.filter({ session_id: sessionId }, '-updated_date', 50);
    setNotes(rows || []);
    setLoading(false);
  };

  const addNote = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const note = await base44.entities.PlayerNote.create({
      title: title.trim() || content.trim().slice(0, 48),
      content: content.trim(),
      category,
      session_id: sessionId,
      character_id: characterId,
      tags: [],
      is_pinned: false,
    });
    setNotes(prev => [note, ...prev]);
    setTitle('');
    setContent('');
    setCategory('General');
    setSaving(false);
  };

  const deleteNote = async (noteId) => {
    await base44.entities.PlayerNote.delete(noteId);
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 py-4" style={{ background: 'rgba(8,5,2,0.72)', borderBottom: '1px solid rgba(180,140,90,0.18)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4" style={{ color: '#f0c040' }} />
            <h2 className="font-fantasy text-sm tracking-widest uppercase" style={{ color: '#f0c040' }}>Campaign Journal</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'rgba(232,213,183,0.78)', fontFamily: 'EB Garamond, serif' }}>
            Save quick notes, NPC names, clues, and reminders. The AI will use these notes when continuing your campaign.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-2">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Optional title, e.g. Captain Merrow"
              className="input-fantasy rounded-xl px-3 py-2 text-sm"
              style={{ fontFamily: 'EB Garamond, serif' }}
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="select-fantasy rounded-xl px-3 py-2 text-sm"
              style={{ minWidth: 140 }}
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Jot down an NPC, clue, suspicious detail, quest reminder..."
              className="input-fantasy flex-1 rounded-xl px-3 py-2 text-sm min-h-[76px] resize-none"
              style={{ fontFamily: 'EB Garamond, serif' }}
            />
            <button
              onClick={addNote}
              disabled={!content.trim() || saving}
              className="btn-fantasy rounded-xl px-4 py-2 self-stretch disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 md:p-7 min-h-0">
        <div className="max-w-4xl mx-auto space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(232,213,183,0.7)' }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(15,10,5,0.55)', border: '1px solid rgba(180,140,90,0.14)' }}>
              <div className="text-4xl mb-3">📓</div>
              <p className="text-sm" style={{ color: 'rgba(232,213,183,0.72)' }}>No notes yet. Add your first clue above.</p>
            </div>
          ) : notes.map(note => (
            <div key={note.id} className="rounded-2xl p-4" style={{ background: 'rgba(18,12,6,0.72)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-fantasy text-sm" style={{ color: '#f8d48a' }}>{note.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(80,50,10,0.75)', border: '1px solid rgba(201,169,110,0.28)', color: '#f0c040' }}>
                      {note.category || 'General'}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'rgba(242,224,198,0.92)', fontFamily: 'EB Garamond, serif' }}>
                    {note.content}
                  </p>
                </div>
                <button onClick={() => deleteNote(note.id)} className="p-2 rounded-lg transition-all" style={{ color: 'rgba(252,165,165,0.68)', border: '1px solid rgba(180,30,30,0.18)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}