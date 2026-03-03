import React from 'react';
import { CLASSES, ALIGNMENTS } from '@/components/game/gameData';
import { Input } from '@/components/ui/input';

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

const CLASS_ICONS = {
  Fighter: '⚔️', Rogue: '🗡️', Wizard: '🔮', Cleric: '✨', Ranger: '🏹',
  Paladin: '🛡️', Barbarian: '🪓', Bard: '🎵', Druid: '🌿', Monk: '👊', Sorcerer: '💫', Warlock: '👁️'
};

export default function StepClassInfo({ character, set }) {
  const selectedClass = CLASSES[character.class];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Name & Class</h2>
        <p className="text-amber-400/50 text-sm mb-4">Define your hero's identity and calling.</p>
      </div>

      {/* Name + Level + Alignment row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Hero Name</label>
          <Input value={character.name} onChange={e => set('name', e.target.value)}
            placeholder="Enter name..."
            className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500" />
        </div>
        <div>
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Starting Level</label>
          <div className="flex items-center gap-3 h-10">
            <input type="range" min={1} max={20} value={character.level}
              onChange={e => set('level', Number(e.target.value))}
              className="flex-1 accent-amber-500" />
            <span className="text-amber-300 font-bold text-lg w-8">{character.level}</span>
          </div>
        </div>
        <div>
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Alignment</label>
          <select value={character.alignment} onChange={e => set('alignment', e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-600 rounded-md text-amber-100 px-3 py-2 text-sm outline-none">
            {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Class Grid */}
      <div>
        <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-2 block">Choose Class</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(CLASSES).map(([cls, data]) => (
            <button key={cls} onClick={() => { set('class', cls); set('subclass', ''); }}
              className={`p-3 rounded-xl border text-left transition-all ${character.class === cls ? 'border-purple-500 bg-purple-900/20' : 'border-slate-700/50 bg-slate-800/30 hover:border-purple-700/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CLASS_ICONS[cls] || '⚡'}</span>
                <span className="font-bold text-purple-200 text-sm">{cls}</span>
              </div>
              <div className="text-slate-500 text-xs">d{data.hit_die} · {data.saves.map(s => STAT_LABELS[s]).join('/')}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Class Details */}
      {selectedClass && (
        <div className="bg-purple-900/10 border border-purple-700/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CLASS_ICONS[character.class]}</span>
            <div>
              <div className="font-bold text-purple-200">{character.class}</div>
              <div className="text-purple-400/60 text-sm">{selectedClass.description}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-slate-300">Features: </span>
            {Object.entries(selectedClass.features || {}).map(([lvl, feats]) =>
              parseInt(lvl) <= character.level ? `Lv.${lvl}: ${feats.join(', ')}` : null
            ).filter(Boolean).join(' · ')}
          </div>

          {/* Subclass */}
          <div>
            <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-2 block">Subclass (optional)</label>
            <div className="flex flex-wrap gap-2">
              {selectedClass.subclasses.map(sub => (
                <button key={sub} onClick={() => set('subclass', character.subclass === sub ? '' : sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${character.subclass === sub ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-amber-700/50'}`}>
                  {sub}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}