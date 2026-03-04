import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Plus, ChevronDown, ChevronUp, Loader2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoreEntryModal from './LoreEntryModal';

const DANGER_COLORS = {
  Safe:    { bg: 'rgba(20,80,30,0.5)',  border: 'rgba(40,180,80,0.3)',  text: '#86efac' },
  Low:     { bg: 'rgba(30,60,10,0.5)',  border: 'rgba(80,160,40,0.3)',  text: '#a3e635' },
  Moderate:{ bg: 'rgba(80,50,5,0.5)',   border: 'rgba(200,130,20,0.3)', text: '#fbbf24' },
  High:    { bg: 'rgba(80,20,5,0.5)',   border: 'rgba(200,60,20,0.3)',  text: '#fb923c' },
  Deadly:  { bg: 'rgba(80,5,5,0.5)',    border: 'rgba(180,20,20,0.4)',  text: '#f87171' },
};

const TYPE_ICONS = {
  City: '🏙️', Town: '🏘️', Village: '🏡', Region: '🗺️', Landmark: '🗿',
  Dungeon: '⛏️', Forest: '🌲', Mountain: '⛰️', Coast: '🌊', Ruins: '🏚️',
  Temple: '⛩️', Fortress: '🏰',
};

export default function EncyclopediaLocations({ search }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.Location.list('-created_date', 100).then(data => {
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
      const updated = await base44.entities.Location.update(editing.id, data);
      setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    } else {
      const created = await base44.entities.Location.create(data);
      setEntries(prev => [created, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.Location.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <SectionHeader icon={MapPin} title="Locations of the Realm" color="#4ade80"
        onAdd={() => { setEditing(null); setShowModal(true); }} count={filtered.length} />

      {filtered.length === 0 && <EmptyState message="No locations recorded yet." />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(loc => {
          const danger = DANGER_COLORS[loc.danger_level] || DANGER_COLORS.Safe;
          const icon = TYPE_ICONS[loc.type] || '📍';
          const isOpen = expanded === loc.id;
          return (
            <motion.div key={loc.id} layout
              className="rounded-xl overflow-hidden fantasy-card"
              style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : loc.id)}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{loc.name}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                        style={{ background: danger.bg, border: `1px solid ${danger.border}`, color: danger.text }}>
                        {loc.danger_level || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif' }}>
                      {loc.type}
                    </p>
                    {loc.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {loc.description}
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
                      {loc.notable_features?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#c9a96e' }}>Notable Features</p>
                          <ul className="space-y-1">
                            {loc.notable_features.map((f, i) => (
                              <li key={i} className="text-sm flex gap-2" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                                <span style={{ color: 'rgba(201,169,110,0.4)' }}>✦</span> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {loc.inhabitants?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#c9a96e' }}>Inhabitants</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                            {loc.inhabitants.join(', ')}
                          </p>
                        </div>
                      )}
                      {loc.connected_locations?.length > 0 && (
                        <div>
                          <p className="text-xs font-fantasy mb-1" style={{ color: '#c9a96e' }}>Connected To</p>
                          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                            {loc.connected_locations.join(', ')}
                          </p>
                        </div>
                      )}
                      <EntryActions onEdit={() => { setEditing(loc); setShowModal(true); }} onDelete={() => handleDelete(loc.id)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {showModal && (
        <LoreEntryModal
          type="Location"
          entry={editing}
          fields={locationFields}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}

const locationFields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'select', options: ['City','Town','Village','Region','Landmark','Dungeon','Forest','Mountain','Coast','Ruins','Temple','Fortress'] },
  { key: 'danger_level', label: 'Danger Level', type: 'select', options: ['Safe','Low','Moderate','High','Deadly'] },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'notable_features', label: 'Notable Features', type: 'tags', placeholder: 'Press Enter to add...' },
  { key: 'inhabitants', label: 'Inhabitants', type: 'tags' },
  { key: 'connected_locations', label: 'Connected Locations', type: 'tags' },
  { key: 'image_url', label: 'Image URL', type: 'text' },
];

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(201,169,110,0.5)' }} />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-16">
      <p className="font-fantasy" style={{ color: 'rgba(201,169,110,0.3)' }}>{message}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color, onAdd, count }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" style={{ color }} />
        <h2 className="font-fantasy font-bold text-xl" style={{ color }}>{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-fantasy" style={{ background: 'rgba(40,25,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.5)' }}>
          {count}
        </span>
      </div>
      <button onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
        <Plus className="w-3.5 h-3.5" /> Add Entry
      </button>
    </div>
  );
}

function EntryActions({ onEdit, onDelete }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onEdit} className="text-xs px-3 py-1 rounded-lg font-fantasy transition-all"
        style={{ background: 'rgba(40,25,5,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.6)'}>
        Edit
      </button>
      <button onClick={onDelete} className="text-xs px-3 py-1 rounded-lg font-fantasy transition-all"
        style={{ background: 'rgba(40,5,5,0.6)', border: '1px solid rgba(180,20,20,0.2)', color: 'rgba(248,113,113,0.5)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,113,113,0.5)'}>
        Delete
      </button>
    </div>
  );
}

export { LoadingState, EmptyState, SectionHeader, EntryActions };