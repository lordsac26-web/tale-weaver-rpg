import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Scroll, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoreEntryModal from './LoreEntryModal.jsx';
import { LoadingState, EmptyState, SectionHeader, EntryActions } from './EncyclopediaLocations.jsx';

const EVENT_TYPE_STYLES = {
  War:          { color: '#f87171', emoji: '⚔️' },
  Discovery:    { color: '#60a5fa', emoji: '🔭' },
  Founding:     { color: '#4ade80', emoji: '🏛️' },
  Catastrophe:  { color: '#fb923c', emoji: '🔥' },
  Treaty:       { color: '#a78bfa', emoji: '📜' },
  Ascension:    { color: '#fbbf24', emoji: '⭐' },
  Betrayal:     { color: '#f87171', emoji: '🗡️' },
  Prophecy:     { color: '#d8b4fe', emoji: '🔮' },
  Other:        { color: '#c9a96e', emoji: '📖' },
};

const historyFields = [
  { key: 'name', label: 'Event Name', type: 'text', required: true },
  { key: 'event_type', label: 'Event Type', type: 'select', options: ['War','Discovery','Founding','Catastrophe','Treaty','Ascension','Betrayal','Prophecy','Other'] },
  { key: 'date_era', label: 'Date / Era', type: 'text', placeholder: 'e.g. Year 347 of the New Age' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'significance', label: 'Historical Significance', type: 'textarea' },
  { key: 'key_figures', label: 'Key Figures', type: 'tags' },
  { key: 'related_locations', label: 'Related Locations', type: 'tags' },
];

export default function EncyclopediaHistory({ search }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.HistoricalEvent.list('-created_date', 100).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(e =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.date_era?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editing) {
      const updated = await base44.entities.HistoricalEvent.update(editing.id, data);
      setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    } else {
      const created = await base44.entities.HistoricalEvent.create(data);
      setEntries(prev => [created, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.HistoricalEvent.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <SectionHeader icon={Scroll} title="Historical Record" color="#fbbf24"
        onAdd={() => { setEditing(null); setShowModal(true); }} count={filtered.length} />

      {filtered.length === 0 && <EmptyState message="No historical events recorded yet." />}

      {/* Timeline layout */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: 'linear-gradient(180deg, rgba(201,169,110,0.4), rgba(201,169,110,0.05))' }} />
        <div className="space-y-4 pl-14">
          {filtered.map(event => {
            const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.Other;
            const isOpen = expanded === event.id;
            return (
              <motion.div key={event.id} layout className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-8 top-5 w-3 h-3 rounded-full border-2 flex-shrink-0 z-10"
                  style={{ background: 'rgba(10,6,3,0.9)', borderColor: style.color, boxShadow: `0 0 8px ${style.color}50` }} />

                <div className="rounded-xl overflow-hidden fantasy-card"
                  style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
                  <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : event.id)}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{style.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{event.name}</h3>
                          {event.event_type && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                              style={{ background: `${style.color}20`, border: `1px solid ${style.color}40`, color: style.color }}>
                              {event.event_type}
                            </span>
                          )}
                        </div>
                        {event.date_era && (
                          <p className="text-xs mt-0.5 italic" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif' }}>
                            {event.date_era}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                            {event.description}
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
                          {event.significance && (
                            <div>
                              <p className="text-xs font-fantasy mb-1" style={{ color: '#fbbf24' }}>Significance</p>
                              <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{event.significance}</p>
                            </div>
                          )}
                          {event.key_figures?.length > 0 && (
                            <div>
                              <p className="text-xs font-fantasy mb-1" style={{ color: '#fbbf24' }}>Key Figures</p>
                              <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{event.key_figures.join(', ')}</p>
                            </div>
                          )}
                          {event.related_locations?.length > 0 && (
                            <div>
                              <p className="text-xs font-fantasy mb-1" style={{ color: '#fbbf24' }}>Locations</p>
                              <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{event.related_locations.join(', ')}</p>
                            </div>
                          )}
                          <EntryActions onEdit={() => { setEditing(event); setShowModal(true); }} onDelete={() => handleDelete(event.id)} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <LoreEntryModal type="Historical Event" entry={editing} fields={historyFields}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}