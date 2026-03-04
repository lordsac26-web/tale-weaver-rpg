import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoreEntryModal from './LoreEntryModal.jsx';
import { LoadingState, EmptyState, SectionHeader, EntryActions } from './EncyclopediaLocations.jsx';

const STATUS_STYLES = {
  Alive:     { color: '#4ade80', emoji: '💚' },
  Deceased:  { color: '#f87171', emoji: '💀' },
  Unknown:   { color: '#c9a96e', emoji: '❓' },
  Legendary: { color: '#f0c040', emoji: '⭐' },
  Mythical:  { color: '#d8b4fe', emoji: '✨' },
};

const figureFields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'title_role', label: 'Title / Role', type: 'text', placeholder: 'e.g. Archmage, High Priestess, Merchant King' },
  { key: 'race', label: 'Race', type: 'text' },
  { key: 'alignment', label: 'Alignment', type: 'select', options: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'] },
  { key: 'status', label: 'Status', type: 'select', options: ['Alive','Deceased','Unknown','Legendary','Mythical'] },
  { key: 'description', label: 'Biography', type: 'textarea' },
  { key: 'affiliations', label: 'Affiliations', type: 'tags' },
  { key: 'key_events', label: 'Key Events', type: 'tags' },
  { key: 'image_url', label: 'Image URL', type: 'text' },
];

export default function EncyclopediaFigures({ search }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.ImportantFigure.list('-created_date', 100).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(e =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.title_role?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editing) {
      const updated = await base44.entities.ImportantFigure.update(editing.id, data);
      setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    } else {
      const created = await base44.entities.ImportantFigure.create(data);
      setEntries(prev => [created, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.ImportantFigure.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <SectionHeader icon={Star} title="Notable Figures" color="#60a5fa"
        onAdd={() => { setEditing(null); setShowModal(true); }} count={filtered.length} />

      {filtered.length === 0 && <EmptyState message="No notable figures recorded yet." />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(figure => {
          const statusStyle = STATUS_STYLES[figure.status] || STATUS_STYLES.Unknown;
          const isOpen = expanded === figure.id;
          const initials = figure.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
          return (
            <motion.div key={figure.id} layout
              className="rounded-xl overflow-hidden fantasy-card"
              style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : figure.id)}>
                <div className="flex items-start gap-3">
                  {/* Portrait placeholder or image */}
                  {figure.image_url ? (
                    <img src={figure.image_url} alt={figure.name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                      style={{ border: '1px solid rgba(180,140,90,0.25)' }} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-fantasy font-bold"
                      style={{ background: 'rgba(30,20,5,0.8)', border: '1px solid rgba(180,140,90,0.25)', color: '#c9a96e', fontSize: '1rem' }}>
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{figure.name}</h3>
                      {figure.status && (
                        <span className="text-xs">{statusStyle.emoji}</span>
                      )}
                    </div>
                    {figure.title_role && (
                      <p className="text-xs mt-0.5 italic" style={{ color: 'rgba(96,165,250,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {figure.title_role}
                      </p>
                    )}
                    {figure.race && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
                        {figure.race} {figure.alignment ? `· ${figure.alignment}` : ''}
                      </p>
                    )}
                    {figure.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {figure.description}
                      </p>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(201,169,110,0.4)' }} />
                           : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(201,169,110,0.4)' }} />}
                </div>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(180,140,90,0.1)' }}>
                    <div className="p-4 space-y-3">
                      {figure.affiliations?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#60a5fa' }}>Affiliations</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{figure.affiliations.join(', ')}</p>
                        </div>
                      )}
                      {figure.key_events?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#60a5fa' }}>Key Events</p>
                          <ul className="space-y-1">
                            {figure.key_events.map((ev, i) => (
                              <li key={i} className="text-sm flex gap-2" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                                <span style={{ color: 'rgba(96,165,250,0.4)' }}>✦</span> {ev}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <EntryActions onEdit={() => { setEditing(figure); setShowModal(true); }} onDelete={() => handleDelete(figure.id)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {showModal && (
        <LoreEntryModal type="Notable Figure" entry={editing} fields={figureFields}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}