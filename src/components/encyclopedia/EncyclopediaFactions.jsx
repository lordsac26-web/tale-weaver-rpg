import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoreEntryModal from './LoreEntryModal';
import { LoadingState, EmptyState, SectionHeader, EntryActions } from './EncyclopediaLocations';

const ALIGNMENT_COLORS = {
  'Lawful Good':    '#86efac', 'Neutral Good': '#4ade80', 'Chaotic Good': '#a3e635',
  'Lawful Neutral': '#60a5fa', 'True Neutral':  '#c9a96e', 'Chaotic Neutral': '#fb923c',
  'Lawful Evil':    '#f87171', 'Neutral Evil':  '#ef4444', 'Chaotic Evil': '#dc2626',
};

const factionFields = [
  { key: 'name', label: 'Faction Name', type: 'text', required: true },
  { key: 'alignment', label: 'Alignment', type: 'select', options: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'] },
  { key: 'headquarters', label: 'Headquarters', type: 'text' },
  { key: 'symbol', label: 'Symbol / Motto', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'influence', label: 'Sphere of Influence', type: 'textarea' },
  { key: 'goals', label: 'Goals', type: 'tags', placeholder: 'Press Enter to add each goal...' },
  { key: 'notable_members', label: 'Notable Members', type: 'tags' },
  { key: 'image_url', label: 'Image URL', type: 'text' },
];

export default function EncyclopediaFactions({ search }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.Faction.list('-created_date', 100).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(e =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editing) {
      const updated = await base44.entities.Faction.update(editing.id, data);
      setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    } else {
      const created = await base44.entities.Faction.create(data);
      setEntries(prev => [created, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.Faction.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <SectionHeader icon={Users} title="Factions & Orders" color="#a78bfa"
        onAdd={() => { setEditing(null); setShowModal(true); }} count={filtered.length} />

      {filtered.length === 0 && <EmptyState message="No factions recorded yet." />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(faction => {
          const alignColor = ALIGNMENT_COLORS[faction.alignment] || '#c9a96e';
          const isOpen = expanded === faction.id;
          return (
            <motion.div key={faction.id} layout
              className="rounded-xl overflow-hidden fantasy-card"
              style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : faction.id)}>
                <div className="flex items-start gap-3">
                  {/* Shield badge */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${alignColor}15`, border: `1px solid ${alignColor}30` }}>
                    <Users className="w-5 h-5" style={{ color: alignColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{faction.name}</h3>
                      {faction.alignment && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                          style={{ background: `${alignColor}15`, border: `1px solid ${alignColor}30`, color: alignColor }}>
                          {faction.alignment}
                        </span>
                      )}
                    </div>
                    {faction.headquarters && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif' }}>
                        📍 {faction.headquarters}
                      </p>
                    )}
                    {faction.symbol && (
                      <p className="text-xs mt-0.5 italic" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'EB Garamond, serif' }}>
                        "{faction.symbol}"
                      </p>
                    )}
                    {faction.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {faction.description}
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
                      {faction.influence && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#a78bfa' }}>Sphere of Influence</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{faction.influence}</p>
                        </div>
                      )}
                      {faction.goals?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#a78bfa' }}>Goals</p>
                          <ul className="space-y-1">
                            {faction.goals.map((g, i) => (
                              <li key={i} className="text-sm flex gap-2" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                                <span style={{ color: 'rgba(167,139,250,0.4)' }}>✦</span> {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {faction.notable_members?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#a78bfa' }}>Notable Members</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{faction.notable_members.join(', ')}</p>
                        </div>
                      )}
                      <EntryActions onEdit={() => { setEditing(faction); setShowModal(true); }} onDelete={() => handleDelete(faction.id)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {showModal && (
        <LoreEntryModal type="Faction" entry={editing} fields={factionFields}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}