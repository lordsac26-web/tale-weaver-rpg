import React, { useState } from 'react';
import { Heart, Shield, Zap, Eye, EyeOff, Sparkles, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod, calcModDisplay } from './gameData';

const COMPANION_PRESETS = {
  familiar: {
    Owl: { creature_type: 'Owl', hp_max: 1, ac: 11, speed: 5, fly: 60, str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7, 
      abilities: [{ name: 'Flyby', desc: 'No opportunity attacks when flying out of reach' }, { name: 'Keen Hearing/Sight', desc: 'Advantage on Perception checks' }],
      attacks: [{ name: 'Talons', bonus: 3, damage_dice: '1d1', damage_type: 'slashing' }], emoji: '🦉' },
    Cat: { creature_type: 'Cat', hp_max: 2, ac: 12, speed: 40, str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks relying on smell' }],
      attacks: [{ name: 'Claws', bonus: 0, damage_dice: '1d1', damage_type: 'slashing' }], emoji: '🐈' },
    Raven: { creature_type: 'Raven', hp_max: 1, ac: 12, speed: 10, fly: 50, str: 2, dex: 14, con: 8, int: 2, wis: 12, cha: 6,
      abilities: [{ name: 'Mimicry', desc: 'Can mimic simple sounds' }],
      attacks: [{ name: 'Beak', bonus: 4, damage_dice: '1d1', damage_type: 'piercing' }], emoji: '🐦‍⬛' },
    Bat: { creature_type: 'Bat', hp_max: 1, ac: 12, speed: 5, fly: 30, str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4,
      abilities: [{ name: 'Echolocation', desc: 'Blindsight 60 ft.' }, { name: 'Keen Hearing', desc: 'Advantage on hearing-based Perception' }],
      attacks: [{ name: 'Bite', bonus: 0, damage_dice: '1d1', damage_type: 'piercing' }], emoji: '🦇' },
    Toad: { creature_type: 'Toad', hp_max: 1, ac: 11, speed: 20, str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3,
      abilities: [{ name: 'Amphibious', desc: 'Can breathe air and water' }],
      attacks: [], emoji: '🐸' },
    Spider: { creature_type: 'Spider', hp_max: 1, ac: 12, speed: 20, climb: 20, str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2,
      abilities: [{ name: 'Spider Climb', desc: 'Can climb difficult surfaces' }, { name: 'Web Sense', desc: 'Knows location of creatures on its web' }],
      attacks: [{ name: 'Bite', bonus: 4, damage_dice: '1d1', damage_type: 'piercing' }], emoji: '🕷️' },
    Snake: { creature_type: 'Snake', hp_max: 2, ac: 12, speed: 30, swim: 30, str: 2, dex: 16, con: 11, int: 1, wis: 10, cha: 3,
      abilities: [{ name: 'Poison', desc: 'Bite deals poison damage' }],
      attacks: [{ name: 'Bite', bonus: 5, damage_dice: '1d2', damage_type: 'piercing' }], emoji: '🐍' },
  },
  beast_companion: {
    Wolf: { creature_type: 'Wolf', hp_max: 11, ac: 13, speed: 40, str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
      abilities: [{ name: 'Keen Hearing/Smell', desc: 'Advantage on Perception checks' }, { name: 'Pack Tactics', desc: 'Advantage on attacks if ally is near target' }],
      attacks: [{ name: 'Bite', bonus: 4, damage_dice: '2d4+2', damage_type: 'piercing' }], emoji: '🐺' },
    Bear: { creature_type: 'Bear', hp_max: 13, ac: 11, speed: 40, climb: 30, str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on smell-based Perception' }],
      attacks: [{ name: 'Bite', bonus: 3, damage_dice: '1d6+2', damage_type: 'piercing' }, { name: 'Claws', bonus: 3, damage_dice: '2d4+2', damage_type: 'slashing' }], emoji: '🐻' },
    Panther: { creature_type: 'Panther', hp_max: 13, ac: 12, speed: 50, climb: 40, str: 14, dex: 15, con: 10, int: 3, wis: 14, cha: 7,
      abilities: [{ name: 'Keen Smell', desc: 'Advantage on smell-based Perception' }, { name: 'Pounce', desc: 'Knock target prone on charge' }],
      attacks: [{ name: 'Bite', bonus: 4, damage_dice: '1d6+2', damage_type: 'piercing' }, { name: 'Claw', bonus: 4, damage_dice: '1d4+2', damage_type: 'slashing' }], emoji: '🐆' },
    Hawk: { creature_type: 'Hawk', hp_max: 7, ac: 13, speed: 10, fly: 80, str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6,
      abilities: [{ name: 'Keen Sight', desc: 'Advantage on sight-based Perception' }],
      attacks: [{ name: 'Talons', bonus: 4, damage_dice: '1d4+2', damage_type: 'slashing' }], emoji: '🦅' },
    Boar: { creature_type: 'Boar', hp_max: 11, ac: 11, speed: 40, str: 13, dex: 11, con: 12, int: 2, wis: 9, cha: 5,
      abilities: [{ name: 'Charge', desc: 'Bonus damage on charge attack' }, { name: 'Relentless', desc: 'Once per day, drop to 1 HP instead of 0' }],
      attacks: [{ name: 'Tusk', bonus: 3, damage_dice: '1d6+1', damage_type: 'slashing' }], emoji: '🐗' },
  },
};

export default function CompanionPanel({ character, companions, onUpdate, onAttack }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanion, setNewCompanion] = useState({ type: 'familiar', creature_type: 'Owl' });
  const [selectedPreset, setSelectedPreset] = useState(null);

  const activeCompanions = companions.filter(c => c.is_summoned);

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
    await onUpdate('create', newCompanion);
    setShowAddModal(false);
    setNewCompanion({ type: 'familiar', creature_type: 'Owl' });
    setSelectedPreset(null);
  };

  const toggleSummon = async (companion) => {
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
                  <select value={newCompanion.type} onChange={e => setNewCompanion({ ...newCompanion, type: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-sm select-fantasy">
                    <option value="familiar">Familiar (Wizard/Warlock)</option>
                    <option value="beast_companion">Beast Companion (Ranger)</option>
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
                    <div>
                      <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>NAME</label>
                      <input value={newCompanion.name || ''} onChange={e => setNewCompanion({ ...newCompanion, name: e.target.value })}
                        placeholder={`e.g. ${selectedPreset.creature_type === 'Owl' ? 'Hoot' : selectedPreset.creature_type === 'Wolf' ? 'Fang' : 'Shadow'}`}
                        className="w-full rounded-lg px-3 py-2 text-sm input-fantasy" />
                    </div>

                    <div className="p-3 rounded-lg" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                      <div className="text-xs font-fantasy mb-2" style={{ color: 'rgba(201,169,110,0.7)' }}>STATS</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>HP: <span className="font-bold" style={{ color: '#86efac' }}>{selectedPreset.hp_max}</span></div>
                        <div>AC: <span className="font-bold" style={{ color: '#93c5fd' }}>{selectedPreset.ac}</span></div>
                        <div>Speed: <span className="font-bold" style={{ color: '#fbbf24' }}>{selectedPreset.speed}</span></div>
                      </div>
                    </div>
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