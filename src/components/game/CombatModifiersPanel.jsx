import React, { useState } from 'react';
import { Zap, Shield, Flame, Sparkles, Swords, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
 
// D&D 5e Barbarian rage uses per level (PHB table)
const RAGE_USES_BY_LEVEL = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,6,6,6,6,Infinity];
 
export default function CombatModifiersPanel({ character, onToggleModifier, activeModifiers = {} }) {
  const [expanded, setExpanded] = useState(false);
 
  const level     = character?.level || 1;
  const charClass = character?.class || '';
 
  // Per 5e PHB p.173: if both advantage AND disadvantage apply, they cancel to a straight roll
  const bothAdvDis = !!(activeModifiers.advantage && activeModifiers.disadvantage);
 
  const availableModifiers = [];
 
  // ── Barbarian: Rage ─────────────────────────────────────────────────────────
  if (charClass === 'Barbarian') {
    const rageDamage  = level < 9 ? 2 : level < 16 ? 3 : 4;
    const maxRageUses = RAGE_USES_BY_LEVEL[level - 1] ?? 2;
    const usedRages   = character?.rage_uses_spent || 0;
    const ragesLeft   = maxRageUses === Infinity ? '∞' : Math.max(0, maxRageUses - usedRages);
    const outOfRages  = maxRageUses !== Infinity && usedRages >= maxRageUses;
 
    availableModifiers.push({
      id: 'rage',
      name: 'Rage',
      icon: <Flame className="w-3.5 h-3.5" />,
      color: '#fca5a5',
      effect: outOfRages
        ? 'No rages remaining — recharges on long rest'
        : `+${rageDamage} melee dmg, B/P/S resist — ${ragesLeft}/${maxRageUses === Infinity ? '∞' : maxRageUses} remaining`,
      description: `Bonus action. +${rageDamage} melee damage, resistance to bludgeoning/piercing/slashing. Advantage on STR checks/saves. Cannot cast or concentrate on spells. Ends if you don't attack or take damage for a turn. Recharges on long rest.`,
      disabled: outOfRages,
    });
  }
 
  // ── Fighter: Action Surge (level 2+, once per short rest) ───────────────────
  if (charClass === 'Fighter' && level >= 2) {
    const used = !!character?.action_surge_used;
    availableModifiers.push({
      id: 'action_surge',
      name: 'Action Surge',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: '#fde68a',
      effect: used ? 'Used — recharges on short rest' : '+1 full Action this turn',
      description: 'Gain one additional action on your turn. Once per short rest (twice per short rest at level 17). Does not grant an extra bonus action.',
      disabled: used,
    });
  }
 
  // ── Paladin: Divine Smite (level 2+) ────────────────────────────────────────
  if (charClass === 'Paladin' && level >= 2) {
    availableModifiers.push({
      id: 'divine_smite_ready',
      name: 'Divine Smite',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: '#fde047',
      effect: 'On melee hit: expend spell slot for +2d8 radiant per slot level',
      description: 'When you hit with a melee weapon attack, expend a spell slot (no action required). Deal +2d8 radiant damage per slot level (max 5d8). On a critical hit, all smite dice are doubled. Undead and fiends take +1d8 extra.',
    });
  }
 
  // ── Rogue: Sneak Attack — with proper 5e conditions noted ───────────────────
  if (charClass === 'Rogue') {
    const sneakDice = Math.ceil(level / 2);
    availableModifiers.push({
      id: 'sneak_attack_ready',
      name: 'Sneak Attack',
      icon: <Swords className="w-3.5 h-3.5" />,
      color: '#a78bfa',
      effect: `+${sneakDice}d6 damage once per turn — need advantage OR ally adjacent to target`,
      description: `Once per turn, add ${sneakDice}d6 extra damage when using a finesse or ranged weapon AND you have advantage on the roll, OR an ally is within 5 ft of the target (and you don't have disadvantage). Only once per turn regardless of number of attacks.`,
    });
  }
 
  // ── Monk: Flurry of Blows (bonus action, level 2+) ──────────────────────────
  if (charClass === 'Monk' && level >= 2) {
    const kiLeft = character?.ki_points_remaining ?? level;
    availableModifiers.push({
      id: 'flurry_of_blows',
      name: 'Flurry of Blows',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: '#818cf8',
      effect: kiLeft > 0
        ? `BONUS ACTION: 2 unarmed strikes (costs 1 Ki — ${kiLeft} Ki left)`
        : 'No Ki remaining — recharges on short rest',
      description: 'After taking the Attack action, spend 1 Ki point as a BONUS ACTION to make two unarmed strikes. Ki points recharge on a short or long rest.',
      disabled: kiLeft <= 0,
    });
  }
 
  // ── Advantage ────────────────────────────────────────────────────────────────
  availableModifiers.push({
    id: 'advantage',
    name: 'Advantage',
    icon: <ChevronUp className="w-3.5 h-3.5" />,
    color: '#86efac',
    effect: bothAdvDis
      ? '⚠ Cancels with Disadvantage — straight roll'
      : 'Roll 2d20, take higher result',
    description: 'Roll two d20s and take the higher. Sources: hidden attacker, target is prone (melee), target is paralysed/unconscious, ally cast Faerie Fire/Bless. If you also have any source of disadvantage, they cancel out to a straight roll.',
  });
 
  // ── Disadvantage ─────────────────────────────────────────────────────────────
  availableModifiers.push({
    id: 'disadvantage',
    name: 'Disadvantage',
    icon: <ChevronDown className="w-3.5 h-3.5" />,
    color: '#fca5a5',
    effect: bothAdvDis
      ? '⚠ Cancels with Advantage — straight roll'
      : 'Roll 2d20, take lower result',
    description: 'Roll two d20s and take the lower. Sources: attacking at long range, target is invisible, you are poisoned/exhausted, target has cover. If you also have any source of advantage, they cancel out to a straight roll.',
  });
 
  // ── Cover ────────────────────────────────────────────────────────────────────
  availableModifiers.push({
    id: 'half_cover',
    name: 'Target: Half Cover',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: '#93c5fd',
    effect: 'Target +2 AC and DEX saves',
    description: 'Target is behind a low wall, large creature, or corner. +2 bonus to AC and Dexterity saving throws against this attack.',
  });
 
  availableModifiers.push({
    id: 'three_quarters_cover',
    name: 'Target: ¾ Cover',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: '#60a5fa',
    effect: 'Target +5 AC and DEX saves',
    description: 'Target is behind a portcullis, arrow slit, or thick tree trunk. +5 bonus to AC and Dexterity saving throws — significantly harder to hit.',
  });
 
  if (availableModifiers.length === 0) return null;
 
  const activeCount = Object.keys(activeModifiers).filter(k => activeModifiers[k]).length;
 
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: 'rgba(10,8,3,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-fantasy transition-all"
        style={{ color: 'rgba(201,169,110,0.6)' }}>
        <span className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Combat Modifiers {activeCount > 0 && `(${activeCount} active)`}
          {bothAdvDis && (
            <span className="px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(80,50,5,0.8)', color: '#fde68a', border: '1px solid rgba(220,180,40,0.4)', fontSize: '0.58rem' }}>
              ⚠ cancel
            </span>
          )}
        </span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>
 
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1.5 pt-1"
              style={{ borderTop: '1px solid rgba(180,140,90,0.08)' }}>
 
              {/* Adv+Dis cancellation warning banner */}
              {bothAdvDis && (
                <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: 'rgba(60,45,5,0.7)', border: '1px solid rgba(220,180,40,0.35)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#fde68a' }} />
                  <span style={{ color: '#fde68a', fontFamily: 'EB Garamond, serif', fontSize: '0.7rem', lineHeight: 1.4 }}>
                    Both Advantage and Disadvantage are active — per 5e rules they cancel out to a single straight d20 roll.
                  </span>
                </div>
              )}
 
              {availableModifiers.map(mod => {
                const isActive   = !!activeModifiers[mod.id];
                const isDisabled = !!mod.disabled && !isActive;
                return (
                  <button
                    key={mod.id}
                    onClick={() => !isDisabled && onToggleModifier(mod.id)}
                    title={mod.description}
                    disabled={isDisabled}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all text-xs disabled:cursor-not-allowed"
                    style={isDisabled ? {
                      background: 'rgba(10,8,5,0.3)',
                      border: '1px solid rgba(60,50,30,0.1)',
                      color: 'rgba(100,80,50,0.2)',
                      opacity: 0.45,
                    } : isActive ? {
                      background: 'rgba(60,40,10,0.6)',
                      border: `1px solid ${mod.color}55`,
                      color: mod.color,
                    } : {
                      background: 'rgba(15,10,5,0.4)',
                      border: '1px solid rgba(100,70,30,0.2)',
                      color: 'rgba(180,140,90,0.4)',
                    }}>
                    <div className="flex-shrink-0"
                      style={{ color: isActive ? mod.color : isDisabled ? 'rgba(80,60,30,0.2)' : 'rgba(180,140,90,0.3)' }}>
                      {mod.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-fantasy font-semibold" style={{ fontSize: '0.7rem' }}>{mod.name}</div>
                      <div className="font-body italic leading-snug"
                        style={{ color: isActive ? `${mod.color}99` : 'rgba(150,120,80,0.35)', fontSize: '0.62rem' }}>
                        {mod.effect}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                      style={isActive ? {
                        background: mod.color,
                        boxShadow: `0 0 6px ${mod.color}88`,
                      } : {
                        background: 'rgba(40,30,10,0.6)',
                        border: '1px solid rgba(100,70,30,0.3)',
                      }} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}