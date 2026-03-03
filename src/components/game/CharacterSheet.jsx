import React, { useState } from 'react';
import { X, Shield, Heart, Zap, Star, Package, Plus, Trash2, ArrowUpDown, Filter, Coins } from 'lucide-react';
import { CLASSES, calcStatMod, calcModDisplay, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP, CONDITIONS } from './gameData';
import { base44 } from '@/api/base44Client';
import SpellbookTab from './SpellbookTab';

const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger'];

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

export default function CharacterSheet({ character: initialCharacter, onClose, onCharacterUpdate }) {
  const [tab, setTab] = useState('stats');
  const [character, setCharacter] = useState(initialCharacter);
  if (!character) return null;

  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;

  const handleUpdateCharacter = async (updates) => {
    const updated = { ...character, ...updates };
    setCharacter(updated);
    await base44.entities.Character.update(character.id, updates);
    onCharacterUpdate?.(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-gradient-to-r from-amber-900/20 to-slate-900">
          <div>
            <h2 className="text-xl font-bold text-amber-200">{character.name}</h2>
            <p className="text-amber-400/60 text-sm">Lv.{character.level} {character.race} {character.class}{character.subclass ? ` · ${character.subclass}` : ''}</p>
            <p className="text-slate-500 text-xs">{character.alignment} · {character.background}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><X className="w-5 h-5" /></button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 divide-x divide-slate-700/50 border-b border-slate-700/50">
          {[
            { icon: Heart, color: 'text-red-400', val: `${character.hp_current}/${character.hp_max}`, label: 'HP' },
            { icon: Shield, color: 'text-blue-400', val: character.armor_class, label: 'AC' },
            { icon: Zap, color: 'text-yellow-400', val: character.speed || 30, label: 'Speed' },
            { icon: Star, color: 'text-amber-400', val: character.xp || 0, label: 'XP' },
          ].map(({ icon: Icon, color, val, label }) => (
            <div key={label} className="p-3 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <div className="font-bold text-amber-200 text-sm">{val}</div>
              <div className="text-slate-500 text-xs">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 overflow-x-auto">
          {['stats', 'skills', 'inventory', ...(isCaster ? ['spells'] : []), 'conditions', 'features'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm capitalize whitespace-nowrap transition-colors ${tab === t ? 'text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}>
              {t === 'spells' ? '🔮 Spells' : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'stats' && (
            <div className="grid grid-cols-3 gap-3">
              {STATS.map(stat => {
                const val = character[stat] || 10;
                const mod = calcStatMod(val);
                const saveProf = CLASSES[character.class]?.saves?.includes(stat);
                const saveMod = mod + (saveProf ? profBonus : 0);
                return (
                  <div key={stat} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-center">
                    <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">{STAT_LABELS[stat]}</div>
                    <div className="text-3xl font-bold text-amber-300 mb-1">{val}</div>
                    <div className={`text-sm font-medium mb-1 ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(mod)}</div>
                    <div className="text-xs text-slate-500">Save: {calcModDisplay(saveMod)}</div>
                  </div>
                );
              })}
              <div className="col-span-3 bg-slate-800/40 rounded-xl p-3 text-center">
                <span className="text-slate-400 text-sm">Proficiency Bonus: </span>
                <span className="text-amber-300 font-bold">+{profBonus}</span>
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-1">
              {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
                const statMod = calcStatMod(character[stat] || 10);
                const profLevel = character.skills?.[skill];
                const bonus = profLevel === 'expert' ? profBonus * 2 : profLevel === 'proficient' ? profBonus : 0;
                const total = statMod + bonus;
                return (
                  <div key={skill} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${profLevel === 'expert' ? 'bg-yellow-400' : profLevel === 'proficient' ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <span className="text-amber-100 text-sm">{skill}</span>
                      <span className="text-slate-500 text-xs">({STAT_LABELS[stat]})</span>
                    </div>
                    <span className={`font-bold text-sm ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(total)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'inventory' && (
            <InventoryTab character={character} onUpdate={handleUpdateCharacter} />
          )}

          {tab === 'conditions' && (
            <div className="space-y-2">
              {(character.conditions || []).length === 0 ? (
                <div className="text-green-400 text-center py-8">✓ No active conditions</div>
              ) : (
                (character.conditions || []).map((cond, i) => {
                  const name = typeof cond === 'string' ? cond : cond.name;
                  const condData = CONDITIONS[name?.toLowerCase()] || {};
                  return (
                    <div key={i} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                      <div className={`font-medium text-sm ${condData.color || 'text-amber-200'}`}>{condData.icon} {name}</div>
                      <div className="text-slate-400 text-xs mt-1">{condData.description}</div>
                      {cond.expires_at && <div className="text-slate-500 text-xs mt-1">Expires: {new Date(cond.expires_at).toLocaleString()}</div>}
                    </div>
                  );
                })
              )}
              {(character.active_modifiers || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Active Modifiers</div>
                  {character.active_modifiers.map((mod, i) => (
                    <div key={i} className="p-2 bg-slate-800/40 rounded-lg border border-slate-700/30 mb-1 flex justify-between text-sm">
                      <span className="text-amber-200">{mod.source}</span>
                      <span className={mod.value >= 0 ? 'text-green-400' : 'text-red-400'}>{mod.value >= 0 ? '+' : ''}{mod.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'spells' && (
            <SpellbookTab character={character} onUpdateCharacter={handleUpdateCharacter} />
          )}

          {tab === 'features' && (
            <div className="space-y-2">
              {(character.features || []).length === 0 ? (
                <div className="text-slate-500 text-center py-8">No features recorded</div>
              ) : (
                (character.features || []).map((feat, i) => (
                  <div key={i} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                    <div className="text-amber-200 text-sm">{feat}</div>
                  </div>
                ))
              )}
              {character.backstory && (
                <div className="mt-4">
                  <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Backstory</div>
                  <div className="text-amber-100/70 text-sm leading-relaxed bg-slate-800/40 rounded-xl p-4">{character.backstory}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}