import React from 'react';
import { RACES } from '@/components/game/gameData';

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

const GENDERS = [
  { id: 'male', label: 'Male', icon: '♂' },
  { id: 'female', label: 'Female', icon: '♀' },
  { id: 'nonbinary', label: 'Non-binary', icon: '⚧' },
  { id: 'other', label: 'Other / N/A', icon: '✦' },
];

const RACE_ICONS = {
  Human: '🧑', Elf: '🧝', Dwarf: '⛏️', Halfling: '🌿', Gnome: '⚙️',
  'Half-Elf': '🌟', 'Half-Orc': '💪', Tiefling: '😈', Dragonborn: '🐉'
};

export default function StepGenderRace({ character, set }) {
  const race = character.race ? RACES[character.race] : null;
  const subrace = character.subrace && race?.subraces ? race.subraces.find(s => s.name === character.subrace) : null;
  const statChoicesNeeded = (subrace?.stat_choices || race?.stat_choices || 0);
  const chosenStats = character.chosen_stat_bonuses || [];

  const toggleStatChoice = (stat) => {
    const current = character.chosen_stat_bonuses || [];
    if (current.includes(stat)) {
      set('chosen_stat_bonuses', current.filter(s => s !== stat));
    } else if (current.length < statChoicesNeeded) {
      set('chosen_stat_bonuses', [...current, stat]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Gender */}
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Identity</h2>
        <p className="text-amber-400/50 text-sm mb-4">Choose your character's gender — this affects portrait generation.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GENDERS.map(g => (
            <button key={g.id} onClick={() => set('gender', g.id)}
              className={`p-4 rounded-xl border text-center transition-all ${character.gender === g.id ? 'border-pink-500 bg-pink-900/20 text-pink-200' : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-pink-700/40'}`}>
              <div className="text-2xl mb-1">{g.icon}</div>
              <div className="text-sm font-medium">{g.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Race */}
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Race</h2>
        <p className="text-amber-400/50 text-sm mb-4">Your heritage shapes your natural abilities and traits.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(RACES).map(([race, data]) => (
            <button key={race} onClick={() => { set('race', race); set('subrace', ''); }}
              className={`p-4 rounded-xl border text-left transition-all ${character.race === race ? 'border-amber-500 bg-amber-900/30' : 'border-slate-700/50 bg-slate-800/30 hover:border-amber-700/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{RACE_ICONS[race] || '👤'}</span>
                <span className="font-bold text-amber-200">{race}</span>
              </div>
              <p className="text-amber-400/60 text-xs mb-2 leading-relaxed">{data.description}</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {Object.entries(data.stat_bonuses).map(([stat, val]) => (
                  <span key={stat} className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                    {STAT_LABELS[stat]} {val > 0 ? '+' : ''}{val}
                  </span>
                ))}
                {data.stat_choices > 0 && (
                  <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                    +{data.stat_choices} choice{data.stat_choices > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.traits.slice(0, 3).map(t => (
                  <span key={t} className="bg-slate-700/50 text-slate-300 text-xs px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Subrace selection */}
        {character.race && RACES[character.race]?.subraces?.length > 0 && (
          <div className="mt-4">
            <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-2 block">Subrace (optional)</label>
            <div className="flex flex-wrap gap-2">
              {RACES[character.race].subraces.map(sub => (
                <button key={sub.name} onClick={() => { set('subrace', character.subrace === sub.name ? '' : sub.name); set('chosen_stat_bonuses', []); }}
                  className={`px-3 py-2 rounded-lg text-sm border transition-all ${character.subrace === sub.name ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200' : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-emerald-700/50'}`}>
                  <div className="font-medium mb-0.5">{sub.name}</div>
                  <div className="text-xs opacity-70">{sub.description || sub.traits.slice(0, 2).join(' · ')}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stat Choice Selector (for Variant Human, Half-Elf, etc.) */}
        {statChoicesNeeded > 0 && (
          <div className="mt-4 p-4 border border-purple-700/50 bg-purple-900/20 rounded-lg">
            <label className="text-purple-300 text-sm font-medium mb-2 block">
              Choose {statChoicesNeeded} Ability Score{statChoicesNeeded > 1 ? 's' : ''} for +1 Bonus ({chosenStats.length}/{statChoicesNeeded} selected)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.keys(STAT_LABELS).map(stat => (
                <button key={stat} onClick={() => toggleStatChoice(stat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    chosenStats.includes(stat) 
                      ? 'border-purple-500 bg-purple-900/50 text-purple-200' 
                      : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-purple-700/50'
                  }`}>
                  {STAT_LABELS[stat]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}