import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CLASSES } from './gameData';

const CLASS_ICONS = {
  Fighter: '⚔️', Rogue: '🗡️', Wizard: '🔮', Cleric: '✨', Ranger: '🏹',
  Paladin: '🛡️', Barbarian: '🪓', Bard: '🎵', Druid: '🌿', Monk: '👊',
  Sorcerer: '💫', Warlock: '👁️', Artificer: '🔧', Oracle: '🔮', Witch: '🧹',
};

// Multiclass prerequisites per PHB
const MC_PREREQUISITES = {
  Barbarian: { strength: 13 },
  Bard: { charisma: 13 },
  Cleric: { wisdom: 13 },
  Druid: { wisdom: 13 },
  Fighter: { strength: 13 }, // or DEX 13
  Monk: { dexterity: 13, wisdom: 13 },
  Paladin: { strength: 13, charisma: 13 },
  Ranger: { dexterity: 13, wisdom: 13 },
  Rogue: { dexterity: 13 },
  Sorcerer: { charisma: 13 },
  Warlock: { charisma: 13 },
  Wizard: { intelligence: 13 },
  Artificer: { intelligence: 13 },
  Oracle: { charisma: 13 },
  Witch: { intelligence: 13 },
};

function checkPrerequisites(character, className) {
  const reqs = MC_PREREQUISITES[className];
  if (!reqs) return { met: true, missing: [] };
  const missing = [];
  for (const [stat, min] of Object.entries(reqs)) {
    if ((character[stat] || 10) < min) {
      missing.push(`${stat.charAt(0).toUpperCase() + stat.slice(1)} ${min}`);
    }
  }
  return { met: missing.length === 0, missing };
}

export default function MulticlassManager({ character, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const multiclass = character.multiclass || [];
  const usedClasses = new Set([character.class, ...multiclass.map(mc => mc.class)]);
  const availableClasses = Object.keys(CLASSES).filter(c => !usedClasses.has(c));

  const totalLevel = (character.level || 1) + multiclass.reduce((s, mc) => s + (mc.level || 0), 0);

  const addClass = (className) => {
    const updated = [...multiclass, { class: className, subclass: '', level: 1 }];
    onUpdate({ multiclass: updated });
    setShowAdd(false);
  };

  const removeClass = (idx) => {
    const updated = multiclass.filter((_, i) => i !== idx);
    onUpdate({ multiclass: updated });
  };

  const updateClassLevel = (idx, newLevel) => {
    const updated = multiclass.map((mc, i) => i === idx ? { ...mc, level: Math.max(1, Math.min(20, newLevel)) } : mc);
    onUpdate({ multiclass: updated });
  };

  const updateSubclass = (idx, subclass) => {
    const updated = multiclass.map((mc, i) => i === idx ? { ...mc, subclass } : mc);
    onUpdate({ multiclass: updated });
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(180,140,90,0.12)' }}>
      {/* Header */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 transition-all"
        style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🔀</span>
          <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.6)', fontSize: '0.65rem' }}>
            MULTICLASS
          </span>
          {multiclass.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full badge-gold">
              {multiclass.length} class{multiclass.length > 1 ? 'es' : ''}
            </span>
          )}
          <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
            Total Lv.{totalLevel}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(201,169,110,0.4)' }} />
                   : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(201,169,110,0.4)' }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="p-3 space-y-2" style={{ background: 'rgba(12,8,4,0.5)' }}>
              {/* Primary class (read-only) */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(60,40,8,0.4)', border: '1px solid rgba(212,149,90,0.25)' }}>
                <span className="text-lg">{CLASS_ICONS[character.class] || '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-fantasy font-bold" style={{ color: '#f0c040' }}>
                    {character.class} {character.subclass ? `(${character.subclass})` : ''}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(212,168,100,0.6)' }}>Primary · Level {character.level}</div>
                </div>
                <span className="text-xs badge-gold px-2 py-0.5 rounded-full">Primary</span>
              </div>

              {/* Multiclass entries */}
              {multiclass.map((mc, idx) => {
                const classData = CLASSES[mc.class];
                return (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(30,15,50,0.4)', border: '1px solid rgba(150,90,230,0.2)' }}>
                    <span className="text-lg">{CLASS_ICONS[mc.class] || '⚡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-fantasy font-bold" style={{ color: '#c4b5fd' }}>{mc.class}</div>
                      {/* Subclass selector */}
                      {classData?.subclasses?.length > 0 && (
                        <select value={mc.subclass || ''} onChange={e => updateSubclass(idx, e.target.value)}
                          className="mt-1 text-xs px-2 py-1 rounded select-fantasy w-full max-w-[200px]">
                          <option value="">No subclass</option>
                          {classData.subclasses.map(sub => {
                            const name = typeof sub === 'string' ? sub : sub.name;
                            return <option key={name} value={name}>{name}</option>;
                          })}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateClassLevel(idx, mc.level - 1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all"
                        style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.5)' }}>
                        −
                      </button>
                      <span className="font-fantasy font-bold text-sm w-6 text-center" style={{ color: '#c4b5fd' }}>{mc.level}</span>
                      <button onClick={() => updateClassLevel(idx, mc.level + 1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all"
                        style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.5)' }}>
                        +
                      </button>
                    </div>
                    <button onClick={() => removeClass(idx)}
                      className="p-1 rounded transition-all" style={{ color: 'rgba(252,165,165,0.4)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(252,165,165,0.4)'}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Add multiclass button / picker */}
              {!showAdd ? (
                <button onClick={() => setShowAdd(true)}
                  className="w-full py-2 rounded-lg text-xs font-fantasy flex items-center justify-center gap-1.5 transition-all"
                  style={{ border: '1px dashed rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.5)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)'; e.currentTarget.style.color = '#c9a96e'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,90,0.25)'; e.currentTarget.style.color = 'rgba(201,169,110,0.5)'; }}>
                  <Plus className="w-3 h-3" /> Add Multiclass
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>Select a class:</div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {availableClasses.map(cls => {
                      const { met, missing } = checkPrerequisites(character, cls);
                      return (
                        <button key={cls} onClick={() => met && addClass(cls)} disabled={!met}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                          style={{
                            background: met ? 'rgba(20,13,5,0.7)' : 'rgba(15,10,5,0.4)',
                            border: `1px solid ${met ? 'rgba(180,140,90,0.2)' : 'rgba(100,60,40,0.15)'}`,
                            opacity: met ? 1 : 0.45,
                          }}>
                          <span className="text-sm">{CLASS_ICONS[cls] || '⚡'}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-fantasy truncate" style={{ color: met ? '#e8d5b7' : '#fca5a5' }}>{cls}</div>
                            {!met && <div className="text-xs truncate" style={{ color: 'rgba(252,165,165,0.5)', fontSize: '0.55rem' }}>Need {missing.join(', ')}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setShowAdd(false)}
                    className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.4)' }}>Cancel</button>
                </div>
              )}

              {/* Total level warning */}
              {totalLevel > 20 && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(80,10,10,0.4)', border: '1px solid rgba(200,60,40,0.3)', color: '#fca5a5' }}>
                  ⚠️ Total character level ({totalLevel}) exceeds maximum of 20.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}