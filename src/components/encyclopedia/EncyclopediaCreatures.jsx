import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import LoreEntryModal from './LoreEntryModal.jsx';
import { LoadingState, EmptyState, SectionHeader, EntryActions } from './EncyclopediaLocations.jsx';

const DANGER_COLORS = {
  Harmless: { bg: 'rgba(20,80,30,0.5)',  border: 'rgba(40,180,80,0.3)',  text: '#86efac' },
  Low:      { bg: 'rgba(30,60,10,0.5)',  border: 'rgba(80,160,40,0.3)',  text: '#a3e635' },
  Moderate: { bg: 'rgba(80,50,5,0.5)',   border: 'rgba(200,130,20,0.3)', text: '#fbbf24' },
  High:     { bg: 'rgba(80,20,5,0.5)',   border: 'rgba(200,60,20,0.3)',  text: '#fb923c' },
  Deadly:   { bg: 'rgba(80,5,5,0.5)',    border: 'rgba(180,20,20,0.4)',  text: '#f87171' },
  Legendary:{ bg: 'rgba(50,5,80,0.5)',   border: 'rgba(160,20,220,0.4)', text: '#d8b4fe' },
};

const TYPE_EMOJI = {
  Beast: '🐾', Humanoid: '👤', Monstrosity: '🦖', Undead: '💀', Fey: '🧚',
  Dragon: '🐉', Elemental: '🔥', Fiend: '👹', Celestial: '✨', Construct: '⚙️',
  Plant: '🌿', Ooze: '🫧', Aberration: '👁️',
};

const creatureFields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'select', options: ['Beast','Humanoid','Monstrosity','Undead','Fey','Dragon','Elemental','Fiend','Celestial','Construct','Plant','Ooze','Aberration'] },
  { key: 'danger_level', label: 'Danger Level', type: 'select', options: ['Harmless','Low','Moderate','High','Deadly','Legendary'] },
  { key: 'habitat', label: 'Habitat', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'behavior', label: 'Behavior', type: 'textarea' },
  { key: 'image_url', label: 'Image URL', type: 'text' },
];

export default function EncyclopediaCreatures({ search }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.CreatureEntry.list('-created_date', 100).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(e =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.type?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editing) {
      const updated = await base44.entities.CreatureEntry.update(editing.id, data);
      setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    } else {
      const created = await base44.entities.CreatureEntry.create(data);
      setEntries(prev => [created, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.CreatureEntry.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <SectionHeader icon={Skull} title="Bestiary" color="#f87171"
        onAdd={() => { setEditing(null); setShowModal(true); }} count={filtered.length} />

      {filtered.length === 0 && <EmptyState message="No creatures catalogued yet." />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(creature => {
          const danger = DANGER_COLORS[creature.danger_level] || DANGER_COLORS.Moderate;
          const emoji = TYPE_EMOJI[creature.type] || '🐾';
          const isOpen = expanded === creature.id;
          return (
            <motion.div key={creature.id} layout
              className="rounded-xl overflow-hidden fantasy-card"
              style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : creature.id)}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{creature.name}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                        style={{ background: danger.bg, border: `1px solid ${danger.border}`, color: danger.text }}>
                        {creature.danger_level || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(248,113,113,0.5)', fontFamily: 'EB Garamond, serif' }}>
                      {creature.type} {creature.habitat ? `· ${creature.habitat}` : ''}
                    </p>
                    {creature.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {creature.description}
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
                      {creature.behavior && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#f87171' }}>Behavior</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>{creature.behavior}</p>
                        </div>
                      )}
                      {creature.image_url && (
                        <img src={creature.image_url} alt={creature.name}
                          className="w-full h-40 object-cover rounded-lg"
                          style={{ border: '1px solid rgba(180,140,90,0.15)' }} />
                      )}
                      <EntryActions onEdit={() => { setEditing(creature); setShowModal(true); }} onDelete={() => handleDelete(creature.id)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {showModal && (
        <LoreEntryModal type="Creature" entry={editing} fields={creatureFields}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}