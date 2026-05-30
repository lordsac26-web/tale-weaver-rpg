import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Search, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Level at which each class chooses its subclass (most are 3).
const SUBCLASS_LEVEL = { Cleric: 1, Sorcerer: 1, Warlock: 1, Druid: 2, Wizard: 2 };

/**
 * StepSubclass — lets the player pick a subclass for their class, pulled
 * dynamically from the ingested Subclass entity. Only shows when the character's
 * level meets the class's subclass threshold. Selection is stored on
 * character.subclass (a plain string the rest of the app already reads).
 */
export default function StepSubclass({ character, set }) {
  const [subclasses, setSubclasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const cls = character.class;
  const level = character.level || 1;
  const requiredLevel = SUBCLASS_LEVEL[cls] || 3;
  const unlocked = level >= requiredLevel;

  useEffect(() => {
    if (!cls) { setLoading(false); return; }
    setLoading(true);
    base44.entities.Subclass.filter({ class_name: cls }, 'name', 200)
      .then(res => setSubclasses(res || []))
      .catch(() => setSubclasses([]))
      .finally(() => setLoading(false));
  }, [cls]);

  const flavor = subclasses[0]?.subclass_flavor || 'Subclass';

  const filtered = useMemo(() => {
    if (!search) return subclasses;
    const q = search.toLowerCase();
    return subclasses.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.short_description || '').toLowerCase().includes(q)
    );
  }, [subclasses, search]);

  if (!unlocked) {
    return (
      <div className="space-y-4">
        <Header flavor={flavor} cls={cls} />
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-sm">{cls} chooses a {flavor} at level {requiredLevel}.</p>
          <p className="text-xs text-slate-600 mt-1">You're level {level} — proceed to the next step.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Header flavor={flavor} cls={cls} />
        <div className="flex items-center justify-center py-16 text-amber-400/60">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading {flavor.toLowerCase()}s…
        </div>
      </div>
    );
  }

  if (subclasses.length === 0) {
    return (
      <div className="space-y-4">
        <Header flavor={flavor} cls={cls} />
        <div className="text-center py-12 text-slate-500 text-sm">
          No subclasses found for {cls}. You can proceed without one.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header flavor={flavor} cls={cls} count={subclasses.length} selected={character.subclass} />

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${flavor.toLowerCase()}s…`}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-8 pr-3 py-2 text-sm text-amber-100 placeholder-slate-500 outline-none focus:border-amber-600/50" />
      </div>

      {/* Options */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {filtered.map(sc => {
          const isSelected = character.subclass === sc.name;
          const isExpanded = expanded === sc.name;
          return (
            <div key={sc.id}
              className={`rounded-xl border transition-all ${
                isSelected ? 'border-amber-500/60 bg-amber-900/15' : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
              }`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => set('subclass', isSelected ? '' : sc.name)}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'bg-amber-600 border-amber-500' : 'border-slate-500 hover:border-amber-500'
                  }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : sc.name)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-amber-100">{sc.name}</span>
                    {sc.source && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-600/40 text-slate-400">{sc.source}</span>
                    )}
                  </div>
                  {sc.short_description && (
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{sc.short_description}</div>
                  )}
                </div>
                <button onClick={() => setExpanded(isExpanded ? null : sc.name)} className="flex-shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
              </div>
              {isExpanded && sc.description && (
                <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                  <p className="text-sm text-amber-100/70 leading-relaxed whitespace-pre-line">
                    {sc.description.replace(/[#*]/g, '').slice(0, 1200)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header({ flavor, cls, count, selected }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" /> {flavor}
      </h2>
      <p className="text-amber-400/50 text-sm">
        Choose your {cls} {flavor.toLowerCase()}.
        {count ? <span className="ml-1 text-slate-500">({count} available)</span> : null}
        {selected ? <span className="ml-2 text-green-400">Selected: {selected}</span> : null}
      </p>
    </div>
  );
}