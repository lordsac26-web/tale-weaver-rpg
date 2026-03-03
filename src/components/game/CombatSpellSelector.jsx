import React, { useState } from 'react';
import { Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS, getSpellSlotsForLevel, calcSpellSaveDC, calcSpellAttackBonus } from './spellData';

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th'];

export default function CombatSpellSelector({ character, onSelectSpell, selectedSpell, selectedSlotLevel, onSelectSlotLevel }) {
  const [showDetail, setShowDetail] = useState(null);
  const [expandedLevel, setExpandedLevel] = useState(0);

  const knownSpells = character?.spells_known || [];
  const charLevel = character?.level || 1;
  const charClass = character?.class || '';
  const slotMaxArr = getSpellSlotsForLevel(charClass, charLevel);
  const currentSlots = character?.spell_slots || {};
  const spellSaveDC = calcSpellSaveDC(character);
  const spellAttackBonus = calcSpellAttackBonus(character);

  // Group spells by level
  const byLevel = {};
  knownSpells.forEach(name => {
    const details = SPELL_DETAILS[name];
    if (!details) return;
    const lvl = details.level || 0;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(name);
  });

  const hasSlots = slotMaxArr.some(s => s > 0);

  const getRemainingSlots = (level) => {
    if (level === 0) return Infinity; // cantrips always available
    const max = slotMaxArr[level - 1] || 0;
    const used = currentSlots[`level_${level}`] || 0;
    return Math.max(0, max - used);
  };

  if (knownSpells.length === 0) {
    return (
      <div className="text-slate-500 text-xs text-center py-4">
        No spells prepared. Visit the Character Sheet → Spellbook to prepare spells.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Spell stats row */}
      <div className="flex gap-3 text-xs">
        <span className="text-slate-500">Save DC: <span className="text-purple-300 font-bold">{spellSaveDC}</span></span>
        <span className="text-slate-500">Attack: <span className="text-purple-300 font-bold">+{spellAttackBonus}</span></span>
      </div>

      {[0,1,2,3,4,5].map(level => {
        const spells = byLevel[level] || [];
        if (spells.length === 0) return null;
        const remaining = getRemainingSlots(level);
        const isExpanded = expandedLevel === level;

        return (
          <div key={level} className="border border-slate-700/40 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedLevel(isExpanded ? -1 : level)}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${isExpanded ? 'bg-purple-900/20' : 'bg-slate-800/30 hover:bg-slate-700/30'}`}>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-purple-400" />
                <span className="text-xs font-medium text-slate-300">{level === 0 ? 'Cantrips' : `${LEVEL_LABELS[level]} Level`}</span>
                {level > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: slotMaxArr[level - 1] || 0 }).map((_, j) => (
                      <div key={j} className={`w-1.5 h-1.5 rounded-full ${j < remaining ? 'bg-purple-400' : 'bg-slate-700'}`} />
                    ))}
                    {remaining === 0 && level > 0 && <span className="text-xs text-red-400 ml-1">No slots</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">{spells.length}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-2 space-y-1.5 bg-slate-900/40">
                    {/* Slot level selector for multi-level spells */}
                    {level > 0 && level < 5 && spells.some(n => SPELL_DETAILS[n]?.higher_levels) && selectedSpell && SPELL_DETAILS[selectedSpell]?.level === level && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500">Cast at:</span>
                        {[level, level+1, level+2].filter(sl => sl <= 5 && (slotMaxArr[sl-1] || 0) > 0).map(sl => (
                          <button key={sl} onClick={() => onSelectSlotLevel(sl)}
                            className={`px-2 py-0.5 rounded text-xs border transition-all ${selectedSlotLevel === sl ? 'border-purple-500 bg-purple-900/40 text-purple-200' : 'border-slate-600 text-slate-400'}`}>
                            {LEVEL_LABELS[sl]}
                          </button>
                        ))}
                      </div>
                    )}

                    {spells.map(name => {
                      const details = SPELL_DETAILS[name];
                      const isSelected = selectedSpell === name;
                      const canCast = level === 0 || remaining > 0;
                      const dmgColor = DAMAGE_TYPE_COLORS[details?.damage_type] || 'text-amber-300';
                      const isDetailOpen = showDetail === name;

                      return (
                        <div key={name}>
                          <button
                            disabled={!canCast}
                            onClick={() => { if (canCast) onSelectSpell(name, level); }}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                              isSelected ? 'border-purple-500 bg-purple-900/30' :
                              canCast ? 'border-slate-700/40 bg-slate-800/20 hover:border-purple-600/40' :
                              'border-slate-700/20 bg-slate-800/10 opacity-40 cursor-not-allowed'
                            }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm">{details?.attack_type === 'healing' ? '💚' : details?.attack_type === 'saving_throw' ? '🎲' : details?.attack_type?.includes('melee') ? '⚔️' : details?.attack_type === 'auto_hit' ? '✨' : details?.is_utility ? '🔧' : '🎯'}</span>
                                <span className={`text-xs font-medium truncate ${isSelected ? 'text-purple-200' : 'text-slate-300'}`}>{name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {details?.damage_dice && details.damage_dice !== '0' && (
                                  <span className={`text-xs font-mono ${dmgColor}`}>{details.damage_dice}</span>
                                )}
                                {details?.save_type && <span className="text-xs text-yellow-400">{details.save_type[0].toUpperCase()+details.save_type.slice(1)} save</span>}
                                <button onClick={e => { e.stopPropagation(); setShowDetail(isDetailOpen ? null : name); }}
                                  className="p-0.5 text-slate-600 hover:text-slate-300">
                                  <Info className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isDetailOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden px-3 pb-2 bg-slate-900/60 border border-t-0 border-slate-700/30 rounded-b-lg -mt-0.5">
                                <p className="text-xs text-slate-400 leading-relaxed pt-2">{details?.description}</p>
                                {details?.higher_levels && <p className="text-xs text-amber-400/70 mt-1 italic">↑ {details.higher_levels}</p>}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}