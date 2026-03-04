import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, BookOpen, MapPin, Skull, Scroll, Users, Star, StickyNote, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EncyclopediaLocations from '@/components/encyclopedia/EncyclopediaLocations.jsx';
import EncyclopediaCreatures from '@/components/encyclopedia/EncyclopediaCreatures.jsx';
import EncyclopediaHistory from '@/components/encyclopedia/EncyclopediaHistory.jsx';
import EncyclopediaFactions from '@/components/encyclopedia/EncyclopediaFactions.jsx';
import EncyclopediaFigures from '@/components/encyclopedia/EncyclopediaFigures.jsx';
import PlayerNotes from '@/components/encyclopedia/PlayerNotes.jsx';

const TABS = [
  { id: 'locations',  label: 'Locations',  icon: MapPin,    color: '#4ade80' },
  { id: 'creatures',  label: 'Bestiary',   icon: Skull,     color: '#f87171' },
  { id: 'history',    label: 'History',    icon: Scroll,    color: '#fbbf24' },
  { id: 'factions',   label: 'Factions',   icon: Users,     color: '#a78bfa' },
  { id: 'figures',    label: 'Figures',    icon: Star,      color: '#60a5fa' },
  { id: 'notes',      label: 'My Notes',   icon: StickyNote,color: '#c9a96e' },
];

export default function Encyclopedia() {
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'locations');
  const [search, setSearch] = useState('');

  const tab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen parchment-bg" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to={createPageUrl('Home')}>
            <button className="p-1.5 rounded-lg transition-all" style={{ color: 'rgba(201,169,110,0.5)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>

          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="w-5 h-5" style={{ color: '#c9a96e' }} />
            <h1 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
              Chronicles of the Forgotten Realms
            </h1>
          </div>

          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(201,169,110,0.4)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search the archives..."
              className="pl-8 pr-4 py-1.5 rounded-lg text-sm input-fantasy w-56"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-fantasy whitespace-nowrap transition-all border-b-2"
                style={{
                  color: active ? t.color : 'rgba(201,169,110,0.4)',
                  borderColor: active ? t.color : 'transparent',
                  background: 'transparent',
                }}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile search */}
      <div className="sm:hidden px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(201,169,110,0.4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search the archives..." className="pl-8 pr-4 py-2 rounded-lg text-sm input-fantasy w-full" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}>
            {activeTab === 'locations' && <EncyclopediaLocations search={search} />}
            {activeTab === 'creatures'  && <EncyclopediaCreatures search={search} />}
            {activeTab === 'history'    && <EncyclopediaHistory search={search} />}
            {activeTab === 'factions'   && <EncyclopediaFactions search={search} />}
            {activeTab === 'figures'    && <EncyclopediaFigures search={search} />}
            {activeTab === 'notes'      && <PlayerNotes search={search} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}