import React from 'react';
import { Check, Shield, Heart, Zap, Star } from 'lucide-react';
import { calcStatMod, calcModDisplay } from '@/components/game/gameData';
import { SPELL_DETAILS } from '@/components/game/spellData';

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const GENDER_ICONS = { male: '♂', female: '♀', nonbinary: '⚧', other: '✦' };

export default function StepReview({ character }) {
  const knownSpells = (character.spells_known || []);
  const cantrips = knownSpells.filter(s => (SPELL_DETAILS[s]?.level ?? 1) === 0);
  const spells = knownSpells.filter(s => (SPELL_DETAILS[s]?.level ?? 1) > 0);
  const proficientSkills = Object.entries(character.skills || {}).filter(([, v]) => v === 'proficient').map(([k]) => k);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-amber-300">Your Hero</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Identity Card */}
          <div className="flex gap-4 bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            {character.portrait ? (
              <img src={character.portrait} alt="Portrait" className="w-20 h-20 rounded-xl object-cover border border-amber-600/40 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-700/50 border border-slate-600/40 flex items-center justify-center text-3xl flex-shrink-0">
                {character.race === 'Elf' ? '🧝' : character.race === 'Dwarf' ? '⛏️' : character.race === 'Dragonborn' ? '🐉' : character.race === 'Tiefling' ? '😈' : '🧙'}
              </div>
            )}
            <div>
              <div className="text-2xl font-bold text-amber-200 leading-tight">{character.name || 'Unnamed Hero'}</div>
              <div className="text-amber-400/70 text-sm">
                {character.gender && <span className="mr-1">{GENDER_ICONS[character.gender]}</span>}
                Level {character.level} {character.race} {character.class}
                {character.subclass ? ` (${character.subclass})` : ''}
              </div>
              <div className="text-slate-400 text-xs mt-0.5">{character.alignment} · {character.background}</div>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Heart, color: 'text-red-400', val: character.hp_max, label: 'HP' },
              { icon: Shield, color: 'text-blue-400', val: character.armor_class, label: 'AC' },
              { icon: Zap, color: 'text-yellow-400', val: character.speed, label: 'Spd' },
              { icon: Star, color: 'text-amber-400', val: `+${character.proficiency_bonus || 2}`, label: 'Prof' },
            ].map(({ icon: Icon, color, val, label }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/40">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <div className="font-bold text-amber-200 text-sm">{val}</div>
                <div className="text-slate-500 text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Ability Scores */}
          <div className="grid grid-cols-3 gap-2">
            {STATS.map(stat => {
              const val = character[stat] || 10;
              const mod = calcStatMod(val);
              return (
                <div key={stat} className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-3 text-center">
                  <div className="text-slate-500 text-xs uppercase">{STAT_LABELS[stat]}</div>
                  <div className="text-2xl font-bold text-amber-300">{val}</div>
                  <div className={`text-xs font-medium ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(mod)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Skills */}
          {proficientSkills.length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Proficient Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {proficientSkills.map(s => (
                  <span key={s} className="bg-green-900/30 text-green-300 text-xs px-2 py-1 rounded-full border border-green-700/50 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />{s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Inventory preview */}
          {(character.inventory || []).length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Starting Equipment</div>
              <div className="flex flex-wrap gap-1.5">
                {(character.inventory || []).slice(0, 6).map((item, i) => (
                  <span key={i} className="bg-slate-700/50 text-amber-200 text-xs px-2 py-1 rounded-full">{item.name}</span>
                ))}
                {(character.inventory || []).length > 6 && (
                  <span className="text-slate-500 text-xs px-2 py-1">+{character.inventory.length - 6} more</span>
                )}
              </div>
            </div>
          )}

          {/* Spells */}
          {knownSpells.length > 0 && (
            <div className="bg-purple-900/10 border border-purple-700/30 rounded-xl p-4">
              <div className="text-purple-400/80 text-xs uppercase tracking-widest mb-2">Spells Known ({knownSpells.length})</div>
              {cantrips.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-1">Cantrips</div>
                  <div className="flex flex-wrap gap-1">
                    {cantrips.map(s => <span key={s} className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">{s}</span>)}
                  </div>
                </div>
              )}
              {spells.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Spells</div>
                  <div className="flex flex-wrap gap-1">
                    {spells.slice(0, 8).map(s => <span key={s} className="bg-purple-900/30 text-purple-300 text-xs px-2 py-0.5 rounded border border-purple-700/40">{s}</span>)}
                    {spells.length > 8 && <span className="text-slate-500 text-xs">+{spells.length - 8} more</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Backstory snippet */}
          {character.backstory && (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Backstory</div>
              <p className="text-amber-100/70 text-sm leading-relaxed line-clamp-4">{character.backstory}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}