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
            <button key={race} onClick={() => set('race', race)}
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
              </div>
              <div className="flex flex-wrap gap-1">
                {data.traits.slice(0, 3).map(t => (
                  <span key={t} className="bg-slate-700/50 text-slate-300 text-xs px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}