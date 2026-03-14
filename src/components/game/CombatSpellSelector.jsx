import React, { useState } from 'react';
import { Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS,
  getSpellSlotsForLevel, calcSpellSaveDC, calcSpellAttackBonus,
  getCantripDamageDice, getEldritchBlastBeams
} from './spellData';
import { SpellTooltip } from './GameTooltip';

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export default function CombatSpellSelector({ character, onSelectSpell, selectedSpell, selectedSlotLevel, onSelectSlotLevel }) {
  const [showDetail,    setShowDetail]    = useState(null);
  const [expandedLevel, setExpandedLevel] = useState(0);

  const preparedSpells = character?.spells_prepared || [];
  const knownSpells    = preparedSpells.length > 0 ? preparedSpells : (character?.spells_known || []);
  const charLevel      = character?.level || 1;
  const charClass      = character?.class || '';
  const slotMaxArr     = getSpellSlotsForLevel(charClass, charLevel);
  const currentSlots   = character?.spell_slots || {};
  const spellSaveDC    = calcSpellSaveDC(character);
  const spellAttackBonus = calcSpellAttackBonus(character);

  // Group spells by level
  const byLevel = {};
  knownSpells.forEach(name => {
    const details = SPELL_DETAILS[name];
    if (!details) return;
    const lvl = details.level ?? 0;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(name);
  });

  const getRemainingSlots = (level) => {
    if (level === 0) return Infinity; // cantrips never run out
    const max  = slotMaxArr[level - 1] || 0;
    const used = currentSlots[`level_${level}`] || 0;
    return Math.max(0, max - used);
  };

  // Fix #10: Build ALL available upcast slot levels for a given base spell level
  // Player can upcast to any slot level they have available, not just +2 above base.
  const getAvailableUpcastLevels = (baseLevel) => {
    const levels = [];
    for (let sl = baseLevel; sl <= 9; sl++) {
      if (sl === 0) continue;
      const slots = sl <= slotMaxArr.length ? (slotMaxArr[sl - 1] || 0) : 0;
      if (slots > 0) levels.push(sl);
    }
    return levels;
  };

  if (knownSpells.length === 0) {
    return (
      <div className="text-slate-500 text-xs text-center py-4">
        No spells prepared. Visit Character Sheet → Spells tab to prepare spells for combat.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Spell stats */}
      <div className="flex gap-3 text-xs">
        <span className="text-slate-500">Save DC: <span className="text-purple-300 font-bold">{spellSaveDC ?? '—'}</span></span>
        <span className="text-slate-500">Attack: <span className="text-purple-300 font-bold">{spellAttackBonus != null ? `+${spellAttackBonus}` : '—'}</span></span>
      </div>

      {[0,1,2,3,4,5,6,7,8,9].map(level => {
        const spells = byLevel[level] || [];
        if (spells.length === 0) return null;
        const remaining  = getRemainingSlots(level);
        const isExpanded = expandedLevel === level;

        return (
          <div key={level} className="border border-slate-700/40 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedLevel(isExpanded ? -1 : level)}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${isExpanded ? 'bg-purple-900/20' : 'bg-slate-800/30 hover:bg-slate-700/30'}`}>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-purple-400" />
                <span className="text-xs font-medium text-slate-300">
                  {level === 0 ? 'Cantrips' : `${LEVEL_LABELS[level]} Level`}
                </span>
                {level > 0 && (
                  <div className="flex items-center gap-0.5">
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

                    {/* Fix #10: Full upcast selector — all available slot levels above base, not just +2 */}
                    {level > 0 && selectedSpell && SPELL_DETAILS[selectedSpell]?.level === level && (
                      (() => {
                        const upcastLevels = getAvailableUpcastLevels(level);
                        if (upcastLevels.length <= 1) return null;
                        return (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs text-slate-500">Cast at slot:</span>
                            {upcastLevels.map(sl => (
                              <button key={sl}
                                onClick={() => onSelectSlotLevel(sl)}
                                className={`px-2 py-0.5 rounded text-xs border transition-all ${
                                  selectedSlotLevel === sl
                                    ? 'border-purple-500 bg-purple-900/40 text-purple-200'
                                    : 'border-slate-600 text-slate-400 hover:border-purple-600/50'
                                }`}>
                                {LEVEL_LABELS[sl]}
                              </button>
                            ))}
                          </div>
                        );
                      })()
                    )}

                    {spells.map(name => {
                      const details    = SPELL_DETAILS[name];
                      const isSelected = selectedSpell === name;
                      const canCast    = level === 0 || remaining > 0;
                      const dmgColor   = DAMAGE_TYPE_COLORS?.[details?.damage_type] || 'text-amber-300';
                      const isDetailOpen = showDetail === name;

                      // Fix #11: Show scaled cantrip dice for current character level
                      const displayDice = level === 0
                        ? getCantripDamageDice(name, charLevel)
                        : details?.damage_dice;

                      // Fix #11: Eldritch Blast special note on beam count
                      const beamNote = name === 'Eldritch Blast'
                        ? ` ×${getEldritchBlastBeams(charLevel)} beams`
                        : '';

                      // Fix #12: Flag bonus action spells clearly
                      const isBonusAction = details?.casting_time?.includes('bonus action');

                      return (
                        <div key={name}>
                          <button
                            disabled={!canCast}
                            onClick={() => { if (canCast) onSelectSpell(name, level); }}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-purple-500 bg-purple-900/30'
                                : canCast
                                ? 'border-slate-700/40 bg-slate-800/20 hover:border-purple-600/40'
                                : 'border-slate-700/20 bg-slate-800/10 opacity-40 cursor-not-allowed'
                            }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm">
                                  {details?.attack_type === 'healing' ? '💚'
                                    : details?.attack_type === 'saving_throw' ? '🎲'
                                    : details?.attack_type?.includes('melee') ? '⚔️'
                                    : details?.attack_type === 'auto_hit' ? '✨'
                                    : details?.is_utility ? '🔧'
                                    : '🎯'}
                                </span>
                                <SpellTooltip name={name} position="right">
                                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-purple-200' : 'text-slate-300'}`}>
                                    {name}
                                  </span>
                                </SpellTooltip>
                                {/* Fix #12: Bonus action badge */}
                                {isBonusAction && (
                                  <span className="flex-shrink-0 px-1 py-0.5 rounded text-xs"
                                    style={{ background: 'rgba(80,50,130,0.5)', color: '#c4b5fd', border: '1px solid rgba(130,80,220,0.3)', fontSize: '0.6rem' }}>
                                    BA
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {displayDice && displayDice !== '0' && (
                                  <span className={`text-xs font-mono ${dmgColor}`}>
                                    {displayDice}{beamNote}
                                    {level === 0 && charLevel >= 5 && (
                                      <span className="text-slate-500 ml-0.5" style={{ fontSize: '0.6rem' }}>
                                        (lv{charLevel >= 17 ? '17' : charLevel >= 11 ? '11' : '5'}+)
                                      </span>
                                    )}
                                  </span>
                                )}
                                {details?.save_type && (
                                  <span className="text-xs text-yellow-400">
                                    {details.save_type[0].toUpperCase() + details.save_type.slice(1)} save
                                  </span>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); setShowDetail(isDetailOpen ? null : name); }}
                                  className="p-0.5 text-slate-600 hover:text-slate-300">
                                  <Info className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isDetailOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden px-3 pb-2 bg-slate-900/60 border border-t-0 border-slate-700/30 rounded-b-lg -mt-0.5">
                                <p className="text-xs text-slate-400 leading-relaxed pt-2">{details?.description}</p>
                                {isBonusAction && (
                                  <p className="text-xs mt-1" style={{ color: '#c4b5fd' }}>
                                    ⚡ <strong>Bonus Action</strong> — does not consume your main action. You can still take the Attack action or cast a cantrip this turn.
                                  </p>
                                )}
                                {level === 0 && (
                                  <p className="text-xs text-blue-400/70 mt-1 italic">
                                    📈 Cantrip damage scales: 1d at lv1, 2d at lv5, 3d at lv11, 4d at lv17.
                                    {name === 'Eldritch Blast' && ' Eldritch Blast fires additional beams at those levels instead.'}
                                  </p>
                                )}
                                {details?.higher_levels && (
                                  <p className="text-xs text-amber-400/70 mt-1 italic">↑ {details.higher_levels}</p>
                                )}
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
