import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Filter, Sword, Skull, Footprints, Clock, Coins, Trophy, Shield, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const RESULT_CONFIG = {
  victory: { label: 'Victory', icon: Trophy, color: '#86efac', bg: 'rgba(22,163,74,0.15)', border: 'rgba(40,200,90,0.3)' },
  defeat:  { label: 'Defeat',  icon: Skull,  color: '#fca5a5', bg: 'rgba(153,27,27,0.2)',  border: 'rgba(200,60,50,0.3)' },
  fled:    { label: 'Fled',    icon: Footprints, color: '#fde68a', bg: 'rgba(120,80,10,0.2)', border: 'rgba(200,160,30,0.3)' },
};

export default function CombatHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [filterSession, setFilterSession] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.CombatLog.filter({ is_active: false }),
      base44.entities.GameSession.list('-updated_date', 50),
    ]).then(([rawLogs, sess]) => {
      // Only show completed encounters that have an actual result
      const completed = rawLogs.filter(l => l.result && l.result !== 'ongoing');
      // Sort newest first
      completed.sort((a, b) => new Date(b.encounter_date || b.created_date) - new Date(a.encounter_date || a.created_date));
      setLogs(completed);
      setSessions(sess);
      setLoading(false);
    });
  }, []);

  const dateRangeOptions = [
    { value: 'all',   label: 'All Time' },
    { value: '7d',    label: 'Last 7 Days' },
    { value: '30d',   label: 'Last 30 Days' },
    { value: '90d',   label: 'Last 90 Days' },
  ];

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffs = { '7d': 7, '30d': 30, '90d': 90 };

    return logs.filter(log => {
      if (filterResult !== 'all' && log.result !== filterResult) return false;
      if (filterSession !== 'all' && log.session_id !== filterSession) return false;
      if (filterDateRange !== 'all') {
        const days = cutoffs[filterDateRange];
        const logDate = new Date(log.encounter_date || log.created_date).getTime();
        if (now - logDate > days * 86400000) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const enemyNames = (log.enemies_faced || []).map(e => e.name?.toLowerCase() || '').join(' ');
        const loc = (log.location || '').toLowerCase();
        const charName = (log.character_name || '').toLowerCase();
        const sessionTitle = (log.session_title || '').toLowerCase();
        if (!enemyNames.includes(q) && !loc.includes(q) && !charName.includes(q) && !sessionTitle.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filterResult, filterSession, filterDateRange, search]);

  // Aggregate stats
  const stats = useMemo(() => ({
    total: logs.length,
    victories: logs.filter(l => l.result === 'victory').length,
    defeats: logs.filter(l => l.result === 'defeat').length,
    fled: logs.filter(l => l.result === 'fled').length,
    totalGold: logs.reduce((sum, l) => sum + (l.loot_collected?.gold || 0), 0),
  }), [logs]);

  return (
    <div className="min-h-screen parchment-bg" style={{ color: 'var(--text-bright)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(8,5,2,0.97)', borderBottom: '1px solid rgba(184,115,51,0.25)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(201,169,110,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Sword className="w-4 h-4" style={{ color: 'var(--brass-gold)' }} />
        <h1 className="font-fantasy font-bold text-lg flex-1" style={{ color: 'var(--brass-gold)' }}>Combat History</h1>
        <span className="text-xs font-fantasy" style={{ color: 'rgba(212,149,90,0.45)' }}>
          {filtered.length} / {logs.length} encounters
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Stats Bar */}
        {!loading && logs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'var(--brass-gold)', icon: Sword },
              { label: 'Victories', value: stats.victories, color: '#86efac', icon: Trophy },
              { label: 'Defeats', value: stats.defeats, color: '#fca5a5', icon: Skull },
              { label: 'Gold Looted', value: `${stats.totalGold} gp`, color: '#fde68a', icon: Coins },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-xl p-4 text-center glass-panel">
                <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color }} />
                <div className="font-fantasy font-bold text-xl" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: 'rgba(212,149,90,0.5)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(184,115,51,0.4)' }} />
              <input
                type="text"
                placeholder="Search by enemy, location, character, campaign..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm input-fantasy"
              />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-fantasy transition-all"
              style={{
                background: showFilters ? 'rgba(92,51,24,0.7)' : 'rgba(20,10,4,0.7)',
                border: `1px solid ${showFilters ? 'rgba(212,149,90,0.55)' : 'rgba(184,115,51,0.25)'}`,
                color: showFilters ? 'var(--brass-gold)' : 'rgba(212,149,90,0.6)',
              }}>
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Result Filter */}
                  <div>
                    <label className="tavern-section-label block mb-1.5">Result</label>
                    <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm select-fantasy">
                      <option value="all">All Results</option>
                      <option value="victory">Victory</option>
                      <option value="defeat">Defeat</option>
                      <option value="fled">Fled</option>
                    </select>
                  </div>

                  {/* Campaign Filter */}
                  <div>
                    <label className="tavern-section-label block mb-1.5">Campaign</label>
                    <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm select-fantasy">
                      <option value="all">All Campaigns</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.title || 'Unnamed Campaign'}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="tavern-section-label block mb-1.5">Date Range</label>
                    <select value={filterDateRange} onChange={e => setFilterDateRange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm select-fantasy">
                      {dateRangeOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(filterResult !== 'all' || filterSession !== 'all' || filterDateRange !== 'all') && (
                  <button onClick={() => { setFilterResult('all'); setFilterSession('all'); setFilterDateRange('all'); }}
                    className="mt-2 text-xs font-fantasy transition-colors"
                    style={{ color: 'rgba(212,149,90,0.5)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--brass-gold)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(212,149,90,0.5)'}>
                    Clear filters
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Log List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ border: '2px solid rgba(184,115,51,0.2)' }}>
              <Sword className="w-5 h-5 animate-pulse" style={{ color: 'rgba(184,115,51,0.4)' }} />
            </div>
            <p className="font-fantasy text-sm" style={{ color: 'rgba(184,115,51,0.4)' }}>Loading chronicles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Skull className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(184,115,51,0.15)' }} />
            <p className="font-fantasy" style={{ color: 'rgba(184,115,51,0.35)' }}>
              {logs.length === 0 ? 'No battles recorded yet. Your legend is yet to be written.' : 'No encounters match your search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((log, i) => (
              <EncounterCard
                key={log.id}
                log={log}
                index={i}
                expanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                onNavigate={() => navigate(createPageUrl('Game') + `?session_id=${log.session_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EncounterCard({ log, index, expanded, onToggle, onNavigate }) {
  const resultCfg = RESULT_CONFIG[log.result] || RESULT_CONFIG.victory;
  const ResultIcon = resultCfg.icon;
  const enemies = log.enemies_faced || [];
  const loot = log.loot_collected || {};
  const date = log.encounter_date || log.created_date;
  const hasCoin = (loot.gold > 0) || (loot.silver > 0) || (loot.copper > 0);
  const hasItems = (loot.items?.length || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="rounded-xl overflow-hidden glass-panel fantasy-card cursor-pointer"
      onClick={onToggle}>

      {/* Header Row */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Result badge */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: resultCfg.bg, border: `1px solid ${resultCfg.border}` }}>
          <ResultIcon className="w-4 h-4" style={{ color: resultCfg.color }} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-fantasy font-bold text-sm" style={{ color: resultCfg.color }}>
              {resultCfg.label}
            </span>
            {enemies.length > 0 && (
              <span className="text-sm font-serif truncate" style={{ color: 'var(--parchment)' }}>
                vs. {enemies.map(e => e.name).join(', ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {log.session_title && (
              <span className="text-xs" style={{ color: 'rgba(212,149,90,0.55)', fontFamily: 'EB Garamond, serif' }}>
                📖 {log.session_title}
              </span>
            )}
            {log.location && (
              <span className="text-xs" style={{ color: 'rgba(180,160,120,0.5)', fontFamily: 'EB Garamond, serif' }}>
                📍 {log.location}
              </span>
            )}
            {log.character_name && (
              <span className="text-xs" style={{ color: 'rgba(180,160,120,0.45)', fontFamily: 'EB Garamond, serif' }}>
                ⚔️ {log.character_name}
              </span>
            )}
          </div>
        </div>

        {/* Right: Date + expand arrow */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {date && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(184,115,51,0.4)' }}>
              <Calendar className="w-3 h-3" />
              {format(new Date(date), 'MMM d, yyyy')}
            </span>
          )}
          {log.total_rounds > 0 && (
            <span className="text-xs" style={{ color: 'rgba(184,115,51,0.4)' }}>
              {log.total_rounds} round{log.total_rounds !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 mt-0.5" style={{ color: 'rgba(184,115,51,0.35)' }} />
            : <ChevronDown className="w-4 h-4 mt-0.5" style={{ color: 'rgba(184,115,51,0.35)' }} />}
        </div>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid rgba(184,115,51,0.12)' }}>

              {/* Enemies Detail */}
              {enemies.length > 0 && (
                <div>
                  <p className="tavern-section-label mb-2">Enemies Faced</p>
                  <div className="flex flex-wrap gap-2">
                    {enemies.map((enemy, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(80,12,8,0.5)', border: '1px solid rgba(200,65,40,0.25)' }}>
                        <Shield className="w-3 h-3" style={{ color: '#fca5a5' }} />
                        <span className="text-xs font-serif" style={{ color: '#fca5a5' }}>{enemy.name}</span>
                        {enemy.max_hp && (
                          <span className="text-xs" style={{ color: 'rgba(252,165,165,0.5)' }}>({enemy.max_hp} HP)</span>
                        )}
                        {enemy.cr && (
                          <span className="text-xs badge-blood px-1 rounded">CR {enemy.cr}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loot */}
              {(hasCoin || hasItems) && (
                <div>
                  <p className="tavern-section-label mb-2">Loot Collected</p>
                  <div className="space-y-2">
                    {hasCoin && (
                      <div className="flex gap-3 flex-wrap">
                        {loot.gold > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg badge-gold">
                            🪙 {loot.gold} gp
                          </span>
                        )}
                        {loot.silver > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(60,65,80,0.5)', border: '1px solid rgba(160,165,190,0.3)', color: '#c8cede' }}>
                            🪙 {loot.silver} sp
                          </span>
                        )}
                        {loot.copper > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(70,45,20,0.5)', border: '1px solid rgba(180,120,60,0.3)', color: '#d4a574' }}>
                            🪙 {loot.copper} cp
                          </span>
                        )}
                      </div>
                    )}
                    {hasItems && (
                      <div className="flex flex-wrap gap-2">
                        {loot.items.map((item, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg badge-gold">
                            {item.icon || '📦'} {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* XP */}
              {log.xp_earned > 0 && (
                <div className="flex items-center gap-2">
                  <span className="tavern-section-label">XP Earned</span>
                  <span className="text-sm font-fantasy" style={{ color: 'var(--brass-gold)' }}>
                    +{log.xp_earned} XP
                  </span>
                </div>
              )}

              {/* Combat Log Entries preview */}
              {log.log_entries?.length > 0 && (
                <div>
                  <p className="tavern-section-label mb-2">Battle Summary ({log.log_entries.length} actions)</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {log.log_entries.slice(-6).map((entry, i) => (
                      <p key={i} className="text-xs font-serif" style={{ color: 'rgba(212,180,120,0.6)' }}>
                        • {entry.text || JSON.stringify(entry)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume campaign link */}
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
                className="text-xs font-fantasy px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(38,10,70,0.5)', border: '1px solid rgba(130,70,210,0.3)', color: '#dfc8ff' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(55,18,100,0.65)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(38,10,70,0.5)'; }}>
                ▶ Resume This Campaign
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}