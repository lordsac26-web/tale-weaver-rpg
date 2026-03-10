import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Coffee, Loader2, Heart, Sparkles, Shield, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { CLASSES, SPELLCASTING_CLASSES, calcStatMod, PROFICIENCY_BY_LEVEL } from './gameData';

// ─── Rest type definitions ───────────────────────────────────────────────────
const REST_TYPES = {
  short: {
    label: 'Short Rest',
    icon: Coffee,
    duration: '1 hour',
    color: '#d4955a',
    glow: 'rgba(212,149,90,0.3)',
    description: 'Spend Hit Dice to recover HP. Some abilities recharge on a short rest.',
  },
  long: {
    label: 'Long Rest',
    icon: Moon,
    duration: '8 hours',
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.3)',
    description: 'Fully recover HP, regain all spell slots and abilities. Resets everything.',
  },
};

// ─── Compute what recharges on short vs long rest ────────────────────────────
function getShortRestEffects(character) {
  const effects = [];
  const cls = CLASSES[character?.class];
  if (!cls) return effects;

  // Hit Dice recovery
  const hitDie = cls.hit_die || 8;
  const conMod = calcStatMod(character.constitution || 10);
  effects.push({
    label: 'Spend Hit Dice',
    detail: `Roll ${character.level || 1}d${hitDie} + ${conMod >= 0 ? '+' : ''}${conMod} per die`,
    icon: '❤️',
  });

  // Class-specific short rest features
  const featureMap = {
    Fighter: ['Second Wind', 'Action Surge'],
    Warlock: ['Pact Magic (all slots)'],
    Wizard: ['Arcane Recovery (½ level slots, 1/day)'],
    Monk: ['Ki Points (all)'],
    Bard: ['Bardic Inspiration (Font of Inspiration, level 5+)'],
    Druid: ['Wild Shape (2 uses)'],
    Cleric: ['Channel Divinity (1 use)'],
  };

  if (featureMap[character.class]) {
    featureMap[character.class].forEach(f => {
      effects.push({ label: f, detail: 'Recharges on short rest', icon: '🔄' });
    });
  }

  return effects;
}

function getLongRestEffects(character) {
  const effects = [];
  const cls = CLASSES[character?.class];

  effects.push({ label: 'Full HP Recovery', detail: `Restore to ${character.hp_max || '?'} HP`, icon: '❤️' });
  effects.push({ label: 'Hit Dice Recovery', detail: `Regain ${Math.max(1, Math.floor((character.level || 1) / 2))} spent Hit Dice`, icon: '🎲' });

  if (SPELLCASTING_CLASSES.includes(character?.class)) {
    effects.push({ label: 'All Spell Slots', detail: 'Fully restored', icon: '🔮' });
  }

  // Class-specific long rest features
  const longFeatures = {
    Barbarian: ['Rage uses (fully restored)'],
    Fighter: ['Second Wind', 'Action Surge', 'Indomitable'],
    Paladin: ['Lay on Hands (pool restored)', 'Divine Sense', 'Channel Divinity'],
    Ranger: ['All spell slots'],
    Sorcerer: ['All Sorcery Points restored'],
    Warlock: ['Pact Magic (all slots)', 'Mystic Arcanum'],
    Monk: ['All Ki Points'],
    Cleric: ['All Channel Divinity uses'],
    Wizard: ['All spell slots', 'Arcane Recovery resets'],
    Bard: ['All Bardic Inspiration uses', 'All spell slots'],
    Druid: ['All Wild Shape uses', 'All spell slots'],
    Artificer: ['All Infusions', 'Flash of Genius uses'],
  };

  if (longFeatures[character?.class]) {
    longFeatures[character.class].forEach(f => {
      effects.push({ label: f, detail: 'Recharges on long rest', icon: '✨' });
    });
  }

  // Racial long rest features
  const raceFeatures = {
    'Half-Orc': ['Relentless Endurance'],
    Aasimar: ['Healing Hands', 'Transformation (Radiant Soul/Consumption/Shroud)'],
    Tiefling: ['Infernal Legacy spells'],
    Dragonborn: ['Breath Weapon'],
  };
  if (raceFeatures[character?.race]) {
    raceFeatures[character.race].forEach(f => {
      effects.push({ label: f, detail: 'Racial ability restored', icon: '🧬' });
    });
  }

  // Remove conditions
  effects.push({ label: 'Remove Exhaustion', detail: 'Reduce exhaustion level by 1', icon: '😓' });

  return effects;
}

// ─── Compute healing from short rest hit dice ────────────────────────────────
function rollHitDice(character, diceCount) {
  const cls = CLASSES[character?.class];
  const hitDie = cls?.hit_die || 8;
  const conMod = calcStatMod(character.constitution || 10);
  let totalHealing = 0;
  const rolls = [];

  for (let i = 0; i < diceCount; i++) {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const healing = Math.max(1, roll + conMod); // minimum 1 HP per die
    totalHealing += healing;
    rolls.push({ roll, conMod, total: healing });
  }

  return { totalHealing, rolls };
}

// ─── Main RestModal ──────────────────────────────────────────────────────────
export default function RestModal({ character, session, onClose, onRestComplete }) {
  const [selectedType, setSelectedType] = useState(null);
  const [resting, setResting] = useState(false);
  const [restComplete, setRestComplete] = useState(false);
  const [restResults, setRestResults] = useState(null);
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);

  const maxHitDice = character?.level || 1;

  const executeRest = async (type) => {
    setResting(true);
    const results = { type, healing: 0, effects: [], rolls: [] };

    if (type === 'short') {
      // Roll hit dice for healing
      const { totalHealing, rolls } = rollHitDice(character, hitDiceToSpend);
      const currentHP = character.hp_current || 0;
      const maxHP = character.hp_max || 1;
      const newHP = Math.min(maxHP, currentHP + totalHealing);
      const actualHealing = newHP - currentHP;

      results.healing = actualHealing;
      results.rolls = rolls;
      results.effects = getShortRestEffects(character).map(e => e.label);

      // Persist
      await base44.entities.Character.update(character.id, { hp_current: newHP });

    } else if (type === 'long') {
      const maxHP = character.hp_max || 1;
      const healing = maxHP - (character.hp_current || 0);
      results.healing = healing;
      results.effects = getLongRestEffects(character).map(e => e.label);

      // Full restore
      const updates = { hp_current: maxHP };

      // Remove exhaustion if present
      const conditions = (character.conditions || []).filter(c => {
        const name = typeof c === 'string' ? c : c.name;
        return name?.toLowerCase() !== 'exhausted';
      });
      updates.conditions = conditions;

      // Reset death saves
      updates.death_saves_success = 0;
      updates.death_saves_failure = 0;

      await base44.entities.Character.update(character.id, updates);

      // Update session time
      if (session?.id) {
        await base44.entities.GameSession.update(session.id, {
          time_of_day: 'Morning',
        });
      }
    }

    // Simulate resting duration for immersion
    await new Promise(r => setTimeout(r, 1500));

    setRestResults(results);
    setResting(false);
    setRestComplete(true);

    if (onRestComplete) {
      onRestComplete(type, results);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}>

      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(28,14,5,0.99), rgba(18,9,3,0.99))',
          border: '1px solid rgba(201,169,110,0.3)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-fantasy-deco font-bold text-xl text-glow-gold" style={{ color: '#f0c040' }}>
              {restComplete ? '🌙 Rest Complete' : resting ? '💤 Resting...' : '⛺ Take a Rest'}
            </h2>
            <p className="text-xs font-body mt-0.5" style={{ color: 'rgba(212,180,110,0.7)' }}>
              {character?.name} — HP: {character?.hp_current}/{character?.hp_max}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(180,140,90,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.35)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* Resting animation */}
          {resting && (
            <div className="flex flex-col items-center py-16 gap-4">
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity }}>
                <Moon className="w-16 h-16" style={{ color: '#818cf8' }} />
              </motion.div>
              <span className="font-fantasy text-sm" style={{ color: 'rgba(212,180,110,0.8)' }}>
                {selectedType === 'short' ? 'Resting by the fire...' : 'The night passes peacefully...'}
              </span>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#c9a96e' }} />
            </div>
          )}

          {/* Results screen */}
          {restComplete && restResults && (
            <div className="space-y-4 animate-fade-up">
              {/* Healing */}
              {restResults.healing > 0 && (
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <Heart className="w-8 h-8 mx-auto mb-2" style={{ color: '#22c55e' }} />
                  <div className="font-fantasy font-bold text-2xl" style={{ color: '#22c55e' }}>+{restResults.healing} HP</div>
                  <div className="text-xs font-body mt-1" style={{ color: 'rgba(134,239,172,0.8)' }}>
                    {restResults.type === 'long' ? 'Fully restored!' : 'Healed from hit dice'}
                  </div>
                </div>
              )}

              {/* Hit dice rolls detail */}
              {restResults.rolls?.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(20,12,5,0.6)', border: '1px solid rgba(184,115,51,0.15)' }}>
                  <div className="tavern-section-label mb-2">Hit Dice Rolls</div>
                  <div className="flex flex-wrap gap-2">
                    {restResults.rolls.map((r, i) => (
                      <span key={i} className="px-2 py-1 rounded-lg text-xs font-fantasy"
                        style={{ background: 'rgba(30,18,6,0.7)', border: '1px solid rgba(184,115,51,0.2)', color: '#e8d5b7' }}>
                        🎲 {r.roll}{r.conMod >= 0 ? '+' : ''}{r.conMod} = {r.total}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Effects restored */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(20,12,5,0.6)', border: '1px solid rgba(184,115,51,0.15)' }}>
                <div className="tavern-section-label mb-2">Abilities Restored</div>
                <div className="space-y-1.5">
                  {restResults.effects.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-body" style={{ color: 'rgba(220,190,140,0.85)' }}>
                      <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: '#c9a96e' }} />
                      {e}
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl font-fantasy font-bold text-sm btn-fantasy">
                Continue Adventure
              </button>
            </div>
          )}

          {/* Selection screen */}
          {!resting && !restComplete && (
            <div className="space-y-4">
              {/* Rest type cards */}
              {Object.entries(REST_TYPES).map(([type, config]) => {
                const Icon = config.icon;
                const isSelected = selectedType === type;
                const effects = type === 'short' ? getShortRestEffects(character) : getLongRestEffects(character);
                return (
                  <button key={type} onClick={() => setSelectedType(type)}
                    className="w-full text-left rounded-xl p-4 transition-all"
                    style={{
                      background: isSelected ? 'rgba(40,22,8,0.9)' : 'rgba(20,12,5,0.6)',
                      border: `1px solid ${isSelected ? config.color + '55' : 'rgba(184,115,51,0.12)'}`,
                      boxShadow: isSelected ? `0 0 20px ${config.glow}` : 'none',
                    }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${config.color}15`, border: `1px solid ${config.color}33` }}>
                        <Icon className="w-5 h-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <div className="font-fantasy font-bold text-sm" style={{ color: config.color }}>{config.label}</div>
                        <div className="text-xs" style={{ color: 'rgba(212,180,110,0.6)' }}>{config.duration}</div>
                      </div>
                    </div>
                    <p className="text-xs font-body mb-2" style={{ color: 'rgba(220,190,140,0.75)' }}>{config.description}</p>

                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(184,115,51,0.12)' }}>
                        {effects.map((e, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-body" style={{ color: 'rgba(220,190,140,0.85)' }}>
                            <span>{e.icon}</span> <span className="font-semibold">{e.label}</span>
                            <span style={{ color: 'rgba(200,165,110,0.55)' }}>— {e.detail}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </button>
                );
              })}

              {/* Hit dice selector for short rest */}
              {selectedType === 'short' && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(15,8,3,0.6)', border: '1px solid rgba(184,115,51,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.7)' }}>Hit Dice to Spend</span>
                    <span className="text-xs font-fantasy" style={{ color: '#f0c040' }}>{hitDiceToSpend} / {maxHitDice}</span>
                  </div>
                  <input type="range" min="1" max={maxHitDice} value={hitDiceToSpend}
                    onChange={e => setHitDiceToSpend(parseInt(e.target.value))}
                    className="w-full accent-amber-600" />
                </div>
              )}

              {/* Rest button */}
              {selectedType && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => executeRest(selectedType)}
                  className="w-full py-3 rounded-xl font-fantasy font-bold text-sm"
                  style={{
                    background: selectedType === 'short'
                      ? 'linear-gradient(160deg, #5c3318, #3d2010)'
                      : 'linear-gradient(160deg, rgba(50,30,100,0.9), rgba(30,15,65,0.95))',
                    border: `1px solid ${REST_TYPES[selectedType].color}55`,
                    color: REST_TYPES[selectedType].color,
                    boxShadow: `0 0 16px ${REST_TYPES[selectedType].glow}`,
                  }}>
                  {selectedType === 'short' ? '☕ Take Short Rest' : '🌙 Take Long Rest'}
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}