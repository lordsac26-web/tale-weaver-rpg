import React, { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Search, Info, Lock } from 'lucide-react';
import { FEATS, FEAT_CATEGORIES, CATEGORY_COLORS, canTakeFeat, meetsPrerequisite, meetsRaceReq, meetsCasterReq } from '@/components/game/featData';
import { CLASSES } from '@/components/game/gameData';

// How many feats can this character take based on level / class
function getMaxFeats(character) {
  const level = character.level || 1;
  const cls = character.class;
  const race = character.race;
  
  // ASI levels per class
  const ASI_LEVELS = {
    Fighter: [4, 6, 8, 12, 14, 16, 19],
    Rogue: [4, 8, 10, 12, 16, 19],
    default: [4, 8, 12, 16, 19],
  };
  const levels = ASI_LEVELS[cls] || ASI_LEVELS.default;
  let feats = levels.filter(l => l <= level).length;
  
  // Variant Human gets +1 bonus feat at level 1
  if (race === 'Human' && character.subrace === 'Variant Human') {
    feats += 1;
  }
  
  return feats;
}

export default function StepFeats({ character, set }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const selectedFeats = character.feats || [];
  const maxFeats = getMaxFeats(character);

  const toggle = (featName) => {
    const current = [...selectedFeats];
    const idx = current.indexOf(featName);
    if (idx !== -1) {
      current.splice(idx, 1);
    } else if (current.length < maxFeats) {
      current.push(featName);
    }
    set('feats', current);
  };

  const filtered = useMemo(() => {
    return FEATS.filter(feat => {
      const matchSearch = !search || feat.name.toLowerCase().includes(search.toLowerCase()) ||
        feat.description.toLowerCase().includes(search.toLowerCase()) ||
        feat.tags?.some(t => t.includes(search.toLowerCase()));
      const matchCategory = category === 'All' || feat.category === category;
      const available = canTakeFeat(feat, character);
      if (!showUnavailable && !available && !selectedFeats.includes(feat.name)) return false;
      return matchSearch && matchCategory;
    });
  }, [search, category, character, showUnavailable, selectedFeats]);

  const available = filtered.filter(f => canTakeFeat(f, character));
  const unavailable = filtered.filter(f => !canTakeFeat(f, character));
  const displayList = showUnavailable ? filtered : available;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Feats</h2>
        <p className="text-amber-400/50 text-sm">
          At certain levels, instead of an Ability Score Improvement, you may take a feat.
          You have <span className="text-amber-300 font-bold">{maxFeats}</span> feat slot{maxFeats !== 1 ? 's' : ''} at level {character.level}.
          <span className="ml-2 text-green-400">({selectedFeats.length}/{maxFeats} chosen)</span>
        </p>
        {maxFeats === 0 && (
          <div className="mt-2 text-sm text-slate-500 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
            ℹ️ {character.class || 'Your class'} doesn't gain feat slots until level 4. You can still browse and plan ahead — feats will be selectable once you reach the appropriate level.
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search feats..."
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-8 pr-3 py-2 text-sm text-amber-100 placeholder-slate-500 outline-none focus:border-amber-600/50" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-amber-100 outline-none">
          <option>All</option>
          {FEAT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowUnavailable(v => !v)}
          className={`px-3 py-2 rounded-xl border text-xs transition-all ${showUnavailable ? 'border-slate-500 bg-slate-700/40 text-slate-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600'}`}>
          {showUnavailable ? 'Hide' : 'Show'} locked
        </button>
      </div>

      {/* Selected feats summary */}
      {selectedFeats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFeats.map(name => (
            <button key={name} onClick={() => toggle(name)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/30 border border-amber-600/50 text-amber-200 text-xs hover:bg-amber-900/50 transition-all">
              <Check className="w-3 h-3" /> {name} <span className="text-amber-400/60">×</span>
            </button>
          ))}
        </div>
      )}

      {/* Feat list */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {displayList.length === 0 && (
          <div className="text-slate-500 text-center py-8 text-sm">No feats match your search.</div>
        )}
        {displayList.map(feat => {
          const isSelected = selectedFeats.includes(feat.name);
          const isExpanded = expanded === feat.name;
          const available = canTakeFeat(feat, character);
          const locked = !available && !isSelected;
          const cantSelect = !isSelected && selectedFeats.length >= maxFeats;

          return (
            <div key={feat.name}
              className={`rounded-xl border transition-all ${
                isSelected ? 'border-amber-500/60 bg-amber-900/15' :
                locked ? 'border-slate-700/30 bg-slate-800/20 opacity-60' :
                'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
              }`}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : feat.name)}>
                {/* Select button */}
                <button
                  onClick={e => { e.stopPropagation(); if (!locked && !cantSelect) toggle(feat.name); else if (isSelected) toggle(feat.name); }}
                  disabled={locked || (cantSelect && !isSelected) || maxFeats === 0}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'bg-amber-600 border-amber-500' :
                    locked || cantSelect || maxFeats === 0 ? 'border-slate-600 cursor-not-allowed' :
                    'border-slate-500 hover:border-amber-500'
                  }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                  {locked && <Lock className="w-2.5 h-2.5 text-slate-600" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-amber-100">{feat.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[feat.category] || 'text-slate-400 bg-slate-700/30 border-slate-600/30'}`}>
                      {feat.category}
                    </span>
                    {feat.prerequisite && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${available ? 'text-green-400/70 border-green-700/30' : 'text-red-400/70 border-red-700/30'}`}>
                        Req: {feat.prerequisite}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {feat.benefits.slice(0, 2).map((b, i) => (
                      <span key={i} className="text-xs text-slate-400">{b}{i < Math.min(1, feat.benefits.length - 1) ? ' ·' : ''}</span>
                    ))}
                    {feat.benefits.length > 2 && <span className="text-xs text-slate-600">+{feat.benefits.length - 2} more</span>}
                  </div>
                </div>

                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
                  <p className="text-sm text-amber-100/70 leading-relaxed">{feat.description}</p>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">Benefits</div>
                    <div className="space-y-1">
                      {feat.benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-green-300">
                          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" />
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                  {feat.tags && (
                    <div className="flex flex-wrap gap-1">
                      {feat.tags.map(tag => (
                        <span key={tag} className="text-xs text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                  {locked && (
                    <div className="text-xs text-red-400/80 bg-red-900/10 border border-red-800/30 rounded-lg px-3 py-2">
                      ⚠️ Prerequisite not met: {feat.prerequisite}
                      {feat.race_req && ` · Race: ${feat.race_req.join(' or ')}`}
                      {feat.caster_only && ' · Requires spellcasting'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}