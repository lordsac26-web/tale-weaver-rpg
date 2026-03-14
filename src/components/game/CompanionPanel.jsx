import React, { useState } from 'react';
import { Heart, Shield, Zap, Eye, EyeOff, Sparkles, Swords, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod, calcModDisplay } from './gameData';
 
const COMPANION_PRESETS = {
  familiar: {
    Owl: { creature_type: 'Owl', hp_max: 1, ac: 11, speed: 5, fly: 60, str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7, 
      abilities: [{ name: 'Flyby', desc: 'No opportunity attacks when flying out of reach' }, { name: 'Keen Hearing/Sight', desc: 'Advantage on Perception checks' }],
      attacks: [{ name: 'Talons', bonus: 3, damage_dice: '1d1', damage_type: 'slashing' }], emoji: '🦉',
      initiative_bonus: 1, class_requirement: 'Wizard/Warlock', spell_required: 'Find Familiar', casting_time: '1 hour ritual' },
    Cat: { creature_type: 'Cat', hp_max: 2, ac: 12, speed: 40, climb: 30, str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks relying on smell' }],
      attacks: [{ name: 'Claws', bonus: 0, damage_dice: '1d1', damage_type: 'slashing' }], emoji: '🐈',
      initiative_bonus: 2, class_requirement: 'Wizard/Warlock', spell_required: 'Find Familiar' },
    Raven: { creature_type: 'Raven', hp_max: 1, ac: 12, speed: 10, fly: 50, str: 2, dex: 14, con: 8, int: 2, wis: 12, cha: 6,
      abilities: [{ name: 'Mimicry', desc: 'Can mimic simple sounds' }],
      attacks: [{ name: 'Beak', bonus: 4, damage_dice: '1d1', damage_type: 'piercing' }], emoji: '🐦‍⬛',
      initiative_bonus: 2, class_requirement: 'Wizard/Warlock', spell_required: 'Find Familiar' },
    Bat: { creature_type: 'Bat', hp_max: 1, ac: 12, speed: 5, fly: 30, str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4,
      abilities: [{ name: 'Echolocation', desc: 'Blindsight 60 ft.' }, { name: 'Keen Hearing', desc: 'Advantage on hearing-based Perception' }],
      attacks: [{ name: 'Bite', bonus: 0, damage_dice: '1d1', damage_type: 'piercing' }], emoji: '🦇',
      initiative_bonus: 2, class_requirement: 'Wizard/Warlock', spell_required: 'Find Familiar' },
    Pseudodragon: { creature_type: 'Pseudodragon', hp_max: 7, ac: 13, speed: 15, fly: 60, str: 6, dex: 15, con: 13, int: 10, wis: 12, cha: 10,
      abilities: [{ name: 'Magic Resistance', desc: 'Advantage on saves vs spells' }, { name: 'Limited Telepathy', desc: 'Communicate simple ideas within 100 ft' }],
      attacks: [{ name: 'Sting', bonus: 4, damage_dice: '1d4+2', damage_type: 'piercing', special: 'DC 11 CON save or poisoned for 1 hour' }], emoji: '🐉',
      initiative_bonus: 2, class_requirement: 'Warlock (Pact of Chain)', spell_required: 'Find Familiar (Pact boon)' },
    Imp: { creature_type: 'Imp', hp_max: 10, ac: 13, speed: 20, fly: 40, str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14,
      abilities: [{ name: 'Shapechanger', desc: 'Can polymorph into rat/raven/spider' }, { name: 'Devil\'s Sight', desc: 'See in magical darkness 120 ft' }, { name: 'Magic Resistance', desc: 'Advantage on saves vs spells' }],
      attacks: [{ name: 'Sting', bonus: 5, damage_dice: '1d4+3', damage_type: 'piercing', special: 'DC 11 CON save or 3d6 poison' }], emoji: '😈',
      initiative_bonus: 3, class_requirement: 'Warlock (Pact of Chain)', spell_required: 'Find Familiar (Pact boon)' },
  },
  beast_companion: {
    Wolf: { creature_type: 'Wolf', hp_max: 11, ac: 13, speed: 40, str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
      abilities: [{ name: 'Keen Hearing/Smell', desc: 'Advantage on Perception checks' }, { name: 'Pack Tactics', desc: 'Advantage on attacks if ally within 5 ft of target' }],
      attacks: [{ name: 'Bite', bonus: 4, damage_dice: '2d4+2', damage_type: 'piercing', special: 'DC 11 STR save or knocked prone' }], emoji: '🐺',
      initiative_bonus: 2, class_requirement: 'Ranger (Beast Master)', level_required: 3 },
    Bear: { creature_type: 'Bear', hp_max: 13, ac: 11, speed: 40, climb: 30, str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on smell-based Perception' }],
      attacks: [{ name: 'Bite', bonus: 3, damage_dice: '1d6+2', damage_type: 'piercing' }, { name: 'Claws', bonus: 3, damage_dice: '2d4+2', damage_type: 'slashing' }], emoji: '🐻',
      initiative_bonus: 0, class_requirement: 'Ranger (Beast Master)', level_required: 3, size: 'Medium', cr: 0.5 },
    Panther: { creature_type: 'Panther', hp_max: 13, ac: 12, speed: 50, climb: 40, str: 14, dex: 15, con: 10, int: 3, wis: 14, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on smell-based Perception' }, { name: 'Pounce', desc: 'If moves 20 ft+ and hits, DC 12 STR save or prone, bonus claw attack' }],
      attacks: [{ name: 'Bite', bonus: 4, damage_dice: '1d6+2', damage_type: 'piercing' }, { name: 'Claw', bonus: 4, damage_dice: '1d4+2', damage_type: 'slashing' }], emoji: '🐆',
      initiative_bonus: 2, class_requirement: 'Ranger (Beast Master)', level_required: 3, cr: 0.25 },
    Hawk: { creature_type: 'Hawk', hp_max: 7, ac: 13, speed: 10, fly: 80, str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6,
      abilities: [{ name: 'Keen Sight', desc: 'Advantage on sight-based Perception' }],
      attacks: [{ name: 'Talons', bonus: 4, damage_dice: '1d4+2', damage_type: 'slashing' }], emoji: '🦅',
      initiative_bonus: 3, class_requirement: 'Ranger (Beast Master)', level_required: 3, cr: 0 },
    Boar: { creature_type: 'Boar', hp_max: 11, ac: 11, speed: 40, str: 13, dex: 11, con: 12, int: 2, wis: 9, cha: 5,
      abilities: [{ name: 'Charge', desc: 'If moves 20 ft+ and hits, +1d6 damage and DC 11 STR save or prone' }, { name: 'Relentless', desc: 'If reduced to 0 HP, make DC 10 CON save to drop to 1 HP instead (once per rest)' }],
      attacks: [{ name: 'Tusk', bonus: 3, damage_dice: '1d6+1', damage_type: 'slashing' }], emoji: '🐗',
      initiative_bonus: 0, class_requirement: 'Ranger (Beast Master)', level_required: 3, cr: 0.25 },
  },
};
 
export default function CompanionPanel({ character, companions, onUpdate, onAttack }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanion, setNewCompanion] = useState({ type: 'familiar', creature_type: 'Owl' });
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [validationError, setValidationError] = useState(null);
 
  const activeCompanions = companions.filter(c => c.is_summoned);
  const charClass = character?.class || '';
  const charLevel = character?.level || 1;
  const charSubclass = character?.subclass || '';
 
  const handleSelectPreset = (type, creatureType) => {
    const preset = COMPANION_PRESETS[type]?.[creatureType];
    if (!preset) return;
    setSelectedPreset(preset);
    setNewCompanion({
      ...newCompanion,
      type,
      creature_type: creatureType,
      ...preset,
    });
  };
 
  const createCompanion = async () => {
    if (!newCompanion.name?.trim()) return;
    
    // Validate class requirements
    const preset = selectedPreset;
    if (preset?.class_requirement) {
      const allowedClasses = preset.class_requirement.split('/').map(c => c.trim());
      const meetsClass = allowedClasses.some(cls => {
        if (cls.includes('(')) {
          const [baseClass, subclassReq] = cls.split('(');
          return charClass === baseClass.trim() && charSubclass.includes(subclassReq.replace(')', '').trim());
        }
        return charClass === cls;
      });
      if (!meetsClass) {
        setValidationError(`This companion requires: ${preset.class_requirement}`);
        return;
      }
    }
    if (preset?.level_required && charLevel < preset.level_required) {
      setValidationError(`This companion requires level ${preset.level_required}+`);
      return;
    }
    
    // Set companion HP to scale with Ranger level for Beast Master
    let finalHP = newCompanion.hp_max;
    if (newCompanion.type === 'beast_companion' && charClass === 'Ranger') {
      // Beast companion HP = 5 + (5 × ranger level) or beast's normal HP, whichever is higher
      finalHP = Math.max(newCompanion.hp_max, 5 + (5 * charLevel));
    }
    
    await onUpdate('create', { ...newCompanion, hp_max: finalHP, hp_current: finalHP });
    setShowAddModal(false);
    setNewCompanion({ type: 'familiar', creature_type: 'Owl' });
    setSelectedPreset(null);
    setValidationError(null);
  };
 
  const toggleSummon = async (companion) => {
    if (!companion.is_summoned) {
      if (companion.type === 'familiar') {
        const hasFindFamiliar = (character?.spells_prepared || character?.spells_known || []).includes('Find Familiar');
        if (!hasFindFamiliar && charClass !== 'Warlock') {
          setValidationError('You need Find Familiar spell prepared to summon a familiar.');
          return;
        }
      } else if (companion.type === 'beast_companion') {
        const otherActiveBeasts = companions.filter(c => c.id !== companion.id && c.type === 'beast_companion' && c.is_summoned);
        if (otherActiveBeasts.length > 0) {
          setValidationError('Rangers can only have one beast companion active at a time.');
          return;
        }
      }
    }
    setValidationError(null);
    await onUpdate('update', { ...companion, is_summoned: !companion.is_summoned });
  };
 
  const hpColor = (current, max) => {
    const pct = (current / max) * 100;
    if (pct > 60) return '#86efac';
    if (pct > 30) return '#fbbf24';
    return '#fca5a5';
  };
 
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.7)' }}>COMPANIONS</h3>
        <button onClick={() => setShowAddModal(true)}
          className="px-3 py-1 rounded-lg text-xs font-fantasy btn-fantasy">
          + Add
        </button>
      </div>
 
      {validationError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(60,10,10,0.7)', border: '1px solid rgba(180,50,50,0.4)', color: '#fca5a5' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span style={{ fontFamily: 'EB Garamond, serif' }}>{validationError}</span>
          <button onClick={() => setValidationError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </motion.div>
      )}
 
      {activeCompanions.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
          No companions summoned
        </p>
      )}
 
      {activeCompanions.map(comp => {
        const hpPct = (comp.hp_current / comp.hp_max) * 100;
        return (
          <motion.div key={comp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel-light rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="text-2xl">{comp.portrait_emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-fantasy font-semibold text-sm" style={{ color: '#f0c040' }}>{comp.name}</div>
                <div className="text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                  {comp.creature_type} · {comp.type === 'familiar' ? 'Familiar' : 'Beast Companion'}
                </div>
              </div>
              <button onClick={() => toggleSummon(comp)}
                className="p-1 rounded transition-colors"
                style={{ color: 'rgba(201,169,110,0.5)' }}>
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
 
            <div className="grid grid-cols-3 gap-2">
              <div className="stat-box rounded-lg px-2 py-1">
                <div className="flex items-center gap-1 justify-center">
                  <Heart className="w-3 h-3" style={{ color: hpColor(comp.hp_current, comp.hp_max) }} />
                  <span className="text-xs font-fantasy font-bold" style={{ color: hpColor(comp.hp_current, comp.hp_max) }}>
                    {comp.hp_current}/{comp.hp_max}
                  </span>
                </div>
              </div>
              <div className="stat-box rounded-lg px-2 py-1">
                <div className="flex items-center gap-1 justify-center">
                  <Shield className="w-3 h-3" style={{ color: '#93c5fd' }} />
                  <span className="text-xs font-fantasy font-bold" style={{ color: '#93c5fd' }}>{comp.armor_class}</span>
                </div>
              </div>
              <div className="stat-box rounded-lg px-2 py-1">
                <div className="flex items-center gap-1 justify-center">
                  <Zap className="w-3 h-3" style={{ color: '#fbbf24' }} />
                  <span className="text-xs font-fantasy font-bold" style={{ color: '#fbbf24' }}>{comp.speed} ft</span>
                </div>
              </div>
            </div>
 
            {comp.attacks?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-fantasy tracking-widest mb-1" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.6rem' }}>ATTACKS</div>
                {comp.attacks.map((atk, i) => (
                  <button key={i}
                    onClick={() => onAttack?.(comp, atk)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-fantasy flex items-center justify-between transition-all btn-combat">
                    <span className="flex items-center gap-1.5">
                      <Swords className="w-3 h-3" />
                      {atk.name}
                    </span>
                    <span style={{ color: 'rgba(255,207,176,0.6)' }}>
                      {calcModDisplay(atk.bonus)} · {atk.damage_dice}
                    </span>
                  </button>
                ))}
                {comp.type === 'familiar' && (
                  <div className="text-xs mt-1 p-2 rounded" style={{ background: 'rgba(80,30,120,0.2)', color: 'rgba(192,132,252,0.6)' }}>
                    ⚠️ Familiars can't attack (except Pact of Chain variants)
                  </div>
                )}
              </div>
            )}
 
            {comp.abilities?.length > 0 && (
              <div className="space-y-1 pt-1" style={{ borderTop: '1px solid rgba(180,140,90,0.15)' }}>
                {comp.abilities.map((ab, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-fantasy font-semibold" style={{ color: 'rgba(240,192,64,0.8)' }}>{ab.name}: </span>
                    <span style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>{ab.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
 
      <div className="space-y-1.5">
        <div className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>UNSUMMONED</div>
        {companions.filter(c => !c.is_summoned).map(comp => (
          <div key={comp.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.1)' }}>
            <span className="text-lg">{comp.portrait_emoji}</span>
            <span className="flex-1 text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>{comp.name}</span>
            <button onClick={() => toggleSummon(comp)}
              className="p-1 rounded transition-colors"
              style={{ color: 'rgba(201,169,110,0.4)' }}>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
 
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowAddModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel rune-border rounded-2xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <h3 className="font-fantasy text-lg font-bold mb-4 text-glow-gold" style={{ color: '#f0c040' }}>
                Add Companion
              </h3>
 
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>TYPE</label>
                  <select value={newCompanion.type} onChange={e => { setNewCompanion({ ...newCompanion, type: e.target.value }); setSelectedPreset(null); }}
                    className="w-full rounded-lg px-3 py-2 text-sm select-fantasy">
                    <option value="familiar">Familiar (Find Familiar spell)</option>
                    <option value="beast_companion">Beast Companion (Ranger: Beast Master)</option>
                    <option value="mount">Mount / Steed</option>
                  </select>
                </div>
 
                <div>
                  <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>CREATURE</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.keys(COMPANION_PRESETS[newCompanion.type] || {}).map(creatureType => {
                      const preset = COMPANION_PRESETS[newCompanion.type][creatureType];
                      return (
                        <button key={creatureType}
                          onClick={() => handleSelectPreset(newCompanion.type, creatureType)}
                          className="p-2 rounded-lg text-center transition-all"
                          style={selectedPreset?.creature_type === creatureType ? {
                            background: 'rgba(80,50,10,0.7)',
                            border: '1px solid rgba(201,169,110,0.5)',
                          } : {
                            background: 'rgba(20,13,5,0.6)',
                            border: '1px solid rgba(180,140,90,0.2)',
                          }}>
                          <div className="text-2xl mb-1">{preset.emoji}</div>
                          <div className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.6)' }}>{creatureType}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
 
                {selectedPreset && (
                  <>
                    <div className="p-2 rounded-lg text-xs" style={{ background: 'rgba(80,30,120,0.2)', border: '1px solid rgba(140,80,220,0.2)', color: 'rgba(192,132,252,0.7)' }}>
                      <strong>Requires:</strong> {selectedPreset.class_requirement || 'Any class'}
                      {selectedPreset.level_required && ` (Level ${selectedPreset.level_required}+)`}
                      {selectedPreset.spell_required && <div className="mt-0.5">📖 {selectedPreset.spell_required}</div>}
                    </div>
 
                    <div>
                      <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>NAME</label>
                      <input value={newCompanion.name || ''} onChange={e => setNewCompanion({ ...newCompanion, name: e.target.value })}
                        placeholder={`e.g. ${selectedPreset.creature_type === 'Owl' ? 'Hoot' : selectedPreset.creature_type === 'Wolf' ? 'Fang' : 'Shadow'}`}
                        className="w-full rounded-lg px-3 py-2 text-sm input-fantasy" />
                    </div>
 
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                      <div className="text-xs font-fantasy mb-2" style={{ color: 'rgba(201,169,110,0.7)' }}>STATS</div>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                        <div>HP: <span className="font-bold" style={{ color: '#86efac' }}>
                          {newCompanion.type === 'beast_companion' && charClass === 'Ranger' 
                            ? Math.max(selectedPreset.hp_max, 5 + (5 * charLevel))
                            : selectedPreset.hp_max}
                        </span></div>
                        <div>AC: <span className="font-bold" style={{ color: '#93c5fd' }}>{selectedPreset.ac}</span></div>
                        <div>Speed: <span className="font-bold" style={{ color: '#fbbf24' }}>{selectedPreset.speed}</span></div>
                      </div>
                      {selectedPreset.fly && <div className="text-xs" style={{ color: 'rgba(147,197,253,0.6)' }}>✈️ Fly {selectedPreset.fly} ft</div>}
                      {selectedPreset.climb && <div className="text-xs" style={{ color: 'rgba(134,239,172,0.6)' }}>🧗 Climb {selectedPreset.climb} ft</div>}
                      {selectedPreset.swim && <div className="text-xs" style={{ color: 'rgba(147,197,253,0.6)' }}>🏊 Swim {selectedPreset.swim} ft</div>}
                    </div>
 
                    {selectedPreset.abilities?.length > 0 && (
                      <div className="p-3 rounded-lg space-y-1" style={{ background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
                        <div className="text-xs font-fantasy mb-1" style={{ color: 'rgba(201,169,110,0.6)' }}>ABILITIES</div>
                        {selectedPreset.abilities.map((ab, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-semibold" style={{ color: '#f0c040' }}>{ab.name}:</span>{' '}
                            <span style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>{ab.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
 
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-fantasy"
                    style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                    Cancel
                  </button>
                  <button onClick={createCompanion} disabled={!newCompanion.name?.trim() || !selectedPreset}
                    className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}