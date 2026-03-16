import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wind, Shield, Flame, Eye, Swords, Heart, ChevronDown, Sparkles, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calcStatMod, PROFICIENCY_BY_LEVEL } from './gameData';

/**
 * ClassAbilitiesPanel — shows prominently all class-specific combat abilities
 * available to the current character (Second Wind, Action Surge, Stances, etc.)
 * Abilities that consume resources track usage and show remaining counts.
 */
export default function ClassAbilitiesPanel({ character, combat, worldState, onAbilityUsed, onMessage }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!character) return null;

  const charClass = character.class || '';
  const level = character.level || 1;
  const profBonus = PROFICIENCY_BY_LEVEL[(level - 1)] || 2;
  const shortRestAbilities = character.short_rest_abilities || {};
  const longRestAbilities = character.long_rest_abilities || {};
  const bonusActionUsed = worldState?.bonus_action_used || false;

  // Build ability list based on class + level
  const abilities = [];

  // ── FIGHTER ─────────────────────────────────────────────────────────────────
  if (charClass === 'Fighter') {
    // Second Wind — bonus action, heals 1d10+level HP, 1/short rest
    const secondWindUsed = !!shortRestAbilities.second_wind;
    abilities.push({
      id: 'second_wind',
      name: 'Second Wind',
      icon: <Wind className="w-4 h-4" />,
      color: '#86efac',
      borderColor: 'rgba(40,180,80,0.4)',
      bgColor: 'rgba(8,45,18,0.7)',
      activeBg: 'rgba(15,70,30,0.85)',
      type: 'bonus_action',
      description: `Bonus Action: Regain 1d10+${level} HP (${Math.floor(Math.random() * 10) + 1 + level} avg). 1/short rest.`,
      shortDesc: `Heal 1d10+${level} HP`,
      restType: 'short',
      used: secondWindUsed,
      usedLabel: 'Used (short rest)',
      available: level >= 1,
      onUse: async () => {
        const healAmount = Math.floor(Math.random() * 10) + 1 + level;
        const newHp = Math.min(character.hp_max, (character.hp_current || 0) + healAmount);
        await base44.entities.Character.update(character.id, {
          hp_current: newHp,
          short_rest_abilities: { ...shortRestAbilities, second_wind: true }
        });
        onMessage?.(`💨 Second Wind! ${character.name} heals ${healAmount} HP (now ${newHp}/${character.hp_max}).`);
        onAbilityUsed?.('second_wind', { heal: healAmount, newHp });
      }
    });

    // Action Surge — use additional action, 1/short rest (2/short rest at level 17)
    const actionSurgeUsed = !!shortRestAbilities.action_surge;
    if (level >= 2) {
      abilities.push({
        id: 'action_surge',
        name: 'Action Surge',
        icon: <Zap className="w-4 h-4" />,
        color: '#fde68a',
        borderColor: 'rgba(220,200,40,0.45)',
        bgColor: 'rgba(40,35,5,0.7)',
        activeBg: 'rgba(70,55,8,0.85)',
        type: 'free',
        description: 'Gain one additional Action this turn. Once per short rest.',
        shortDesc: '+1 Action this turn',
        restType: 'short',
        used: actionSurgeUsed,
        usedLabel: 'Used (short rest)',
        available: true,
        onUse: async () => {
          await base44.entities.Character.update(character.id, {
            short_rest_abilities: { ...shortRestAbilities, action_surge: true }
          });
          onMessage?.(`⚡ Action Surge! ${character.name} gains an extra action this turn!`);
          onAbilityUsed?.('action_surge', {});
        }
      });
    }

    // Fighting Style reminder (passive — shown as info pill)
    if (character.fighting_style) {
      abilities.push({
        id: 'fighting_style',
        name: 'Fighting Style',
        icon: <Shield className="w-4 h-4" />,
        color: '#93c5fd',
        borderColor: 'rgba(100,160,255,0.3)',
        bgColor: 'rgba(8,20,50,0.5)',
        type: 'passive',
        shortDesc: character.fighting_style,
        description: getFightingStyleDesc(character.fighting_style),
        used: false,
        available: true,
      });
    }

    // Indomitable — reroll failed saving throw, 1/long rest (level 9+)
    if (level >= 9) {
      const indomitableUsed = !!longRestAbilities.indomitable;
      abilities.push({
        id: 'indomitable',
        name: 'Indomitable',
        icon: <Shield className="w-4 h-4" />,
        color: '#c4b5fd',
        borderColor: 'rgba(160,120,255,0.35)',
        bgColor: 'rgba(30,10,60,0.6)',
        activeBg: 'rgba(55,20,100,0.8)',
        type: 'reaction',
        description: 'Reroll one failed saving throw. Must use the new roll. 1/long rest.',
        shortDesc: 'Reroll failed save',
        restType: 'long',
        used: indomitableUsed,
        usedLabel: 'Used (long rest)',
        available: true,
        onUse: async () => {
          await base44.entities.Character.update(character.id, {
            long_rest_abilities: { ...longRestAbilities, indomitable: true }
          });
          onMessage?.(`🛡️ Indomitable! ${character.name} rerolls a failed saving throw!`);
          onAbilityUsed?.('indomitable', {});
        }
      });
    }
  }

  // ── BARBARIAN ────────────────────────────────────────────────────────────────
  if (charClass === 'Barbarian') {
    const RAGE_USES = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,6,6,6,6,Infinity];
    const maxRages = RAGE_USES[level - 1] ?? 2;
    const usedRages = longRestAbilities.rage_uses_spent || 0; // rages reset on long rest
    const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
    const ragesLeft = maxRages === Infinity ? '∞' : Math.max(0, maxRages - usedRages);
    abilities.push({
      id: 'rage',
      name: 'Rage',
      icon: <Flame className="w-4 h-4" />,
      color: '#fca5a5',
      borderColor: 'rgba(220,60,40,0.45)',
      bgColor: 'rgba(45,5,5,0.7)',
      activeBg: 'rgba(80,10,8,0.85)',
      type: 'bonus_action',
      description: `Bonus Action. +${rageDamage} melee damage, resist B/P/S. Advantage on STR checks/saves. ${ragesLeft}/${maxRages === Infinity ? '∞' : maxRages} remaining.`,
      shortDesc: `+${rageDamage} dmg, resist B/P/S (${ragesLeft} left)`,
      restType: 'long',
      used: ragesLeft <= 0,
      usedLabel: 'No rages left',
      available: ragesLeft > 0,
    });

    // Reckless Attack
    abilities.push({
      id: 'reckless_attack',
      name: 'Reckless Attack',
      icon: <Swords className="w-4 h-4" />,
      color: '#fbbf24',
      borderColor: 'rgba(250,180,30,0.35)',
      bgColor: 'rgba(40,25,3,0.6)',
      type: 'passive_toggle',
      description: 'On your first attack: gain advantage on all STR attacks this turn. BUT enemies have advantage against you until your next turn.',
      shortDesc: 'Advantage + enemies adv vs you',
      used: false,
      available: true,
    });
  }

  // ── PALADIN ──────────────────────────────────────────────────────────────────
  if (charClass === 'Paladin') {
    // Lay on Hands
    const lohMax = level * 5;
    const lohUsed = longRestAbilities.lay_on_hands_used || 0;
    const lohLeft = Math.max(0, lohMax - lohUsed);
    abilities.push({
      id: 'lay_on_hands',
      name: 'Lay on Hands',
      icon: <Heart className="w-4 h-4" />,
      color: '#86efac',
      borderColor: 'rgba(40,200,100,0.4)',
      bgColor: 'rgba(8,40,18,0.7)',
      activeBg: 'rgba(15,65,30,0.85)',
      type: 'action',
      description: `Action. Heal up to ${lohLeft} HP remaining (pool of ${lohMax}). 1 HP cures disease/poison instead.`,
      shortDesc: `Heal up to ${lohLeft}/${lohMax} HP`,
      restType: 'long',
      used: lohLeft <= 0,
      usedLabel: `Pool depleted (${lohMax} on long rest)`,
      available: lohLeft > 0,
      onUse: async () => {
        const heal = Math.min(lohLeft, character.hp_max - (character.hp_current || 0));
        const newHp = (character.hp_current || 0) + heal;
        await base44.entities.Character.update(character.id, {
          hp_current: newHp,
          long_rest_abilities: { ...longRestAbilities, lay_on_hands_used: lohUsed + heal }
        });
        onMessage?.(`🙏 Lay on Hands! ${character.name} heals ${heal} HP (${newHp}/${character.hp_max}).`);
        onAbilityUsed?.('lay_on_hands', { heal, newHp });
      }
    });

    // Divine Smite reminder
    if (level >= 2) {
      abilities.push({
        id: 'divine_smite',
        name: 'Divine Smite',
        icon: <Zap className="w-4 h-4" />,
        color: '#fde047',
        borderColor: 'rgba(250,220,40,0.4)',
        bgColor: 'rgba(35,30,3,0.6)',
        type: 'passive',
        description: 'On melee hit: expend a spell slot (no action). Deal +2d8 radiant per slot level (max 5d8). Enable via Combat Modifiers panel.',
        shortDesc: 'Toggle in Modifiers ↓',
        used: false,
        available: true,
      });
    }
  }

  // ── ROGUE ────────────────────────────────────────────────────────────────────
  if (charClass === 'Rogue') {
    const sneakDice = Math.ceil(level / 2);
    abilities.push({
      id: 'sneak_attack',
      name: 'Sneak Attack',
      icon: <Eye className="w-4 h-4" />,
      color: '#a78bfa',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(25,10,50,0.65)',
      type: 'passive',
      description: `Once/turn: +${sneakDice}d6 damage with finesse/ranged weapon when you have advantage OR an ally is adjacent to target. Toggle in Modifiers.`,
      shortDesc: `+${sneakDice}d6 damage once/turn`,
      used: false,
      available: true,
    });

    // Cunning Action
    if (level >= 2) {
      abilities.push({
        id: 'cunning_action',
        name: 'Cunning Action',
        icon: <Zap className="w-4 h-4" />,
        color: '#818cf8',
        borderColor: 'rgba(130,130,255,0.35)',
        bgColor: 'rgba(15,15,45,0.6)',
        type: 'bonus_action',
        description: 'Bonus Action: Dash, Disengage, or Hide.',
        shortDesc: 'Dash/Disengage/Hide (bonus action)',
        used: bonusActionUsed,
        usedLabel: 'Bonus action used',
        available: !bonusActionUsed,
        onUse: async () => {
          onMessage?.(`🎯 Cunning Action! ${character.name} takes a bonus Dash/Disengage/Hide!`);
          onAbilityUsed?.('cunning_action', {});
        }
      });
    }
  }

  // ── MONK ─────────────────────────────────────────────────────────────────────
  if (charClass === 'Monk') {
    const kiLeft = character.ki_points_remaining ?? level;
    if (level >= 2) {
      abilities.push({
        id: 'flurry_of_blows',
        name: 'Flurry of Blows',
        icon: <Swords className="w-4 h-4" />,
        color: '#818cf8',
        borderColor: 'rgba(130,110,255,0.4)',
        bgColor: 'rgba(15,12,45,0.7)',
        type: 'bonus_action',
        description: `Bonus Action after Attack: 2 unarmed strikes. Costs 1 Ki. (${kiLeft} Ki remaining)`,
        shortDesc: `2 unarmed strikes (1 Ki — ${kiLeft} left)`,
        used: kiLeft <= 0,
        usedLabel: 'No Ki remaining',
        available: kiLeft > 0,
      });

      abilities.push({
        id: 'patient_defense',
        name: 'Patient Defense',
        icon: <Shield className="w-4 h-4" />,
        color: '#67e8f9',
        borderColor: 'rgba(100,230,250,0.35)',
        bgColor: 'rgba(5,25,35,0.65)',
        type: 'bonus_action',
        description: `Bonus Action: Take the Dodge action. Attacks against you have disadvantage. Costs 1 Ki. (${kiLeft} Ki remaining)`,
        shortDesc: `Dodge (1 Ki — ${kiLeft} left)`,
        used: kiLeft <= 0 || bonusActionUsed,
        usedLabel: kiLeft <= 0 ? 'No Ki' : 'Bonus action used',
        available: kiLeft > 0 && !bonusActionUsed,
      });
    }
  }

  // ── WIZARD ───────────────────────────────────────────────────────────────────
  if (charClass === 'Wizard' && level >= 2) {
    const arcaneUsed = !!shortRestAbilities.arcane_recovery;
    abilities.push({
      id: 'arcane_recovery',
      name: 'Arcane Recovery',
      icon: <Zap className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(28,12,55,0.7)',
      activeBg: 'rgba(50,20,90,0.85)',
      type: 'special',
      description: `Once per long rest during a short rest, recover spell slots totaling up to ${Math.ceil(level / 2)} levels combined.`,
      shortDesc: `Recover ${Math.ceil(level / 2)} spell slot levels`,
      restType: 'short',
      used: arcaneUsed,
      usedLabel: 'Used (long rest)',
      available: !arcaneUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, arcane_recovery: true }
        });
        onMessage?.(`✨ Arcane Recovery! ${character.name} recovers spell slots (up to ${Math.ceil(level / 2)} levels).`);
        onAbilityUsed?.('arcane_recovery', {});
      }
    });
  }

  // ── BARD ─────────────────────────────────────────────────────────────────────
  if (charClass === 'Bard') {
    const dieMod = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';
    const chaBonus = calcStatMod(character.charisma || 10);
    const maxInspire = chaBonus > 0 ? chaBonus : 1;
    const usedInspire = shortRestAbilities.bardic_inspiration_used || 0;
    const inspireLeft = Math.max(0, maxInspire - usedInspire);
    abilities.push({
      id: 'bardic_inspiration',
      name: 'Bardic Inspiration',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#fb923c',
      borderColor: 'rgba(250,140,50,0.4)',
      bgColor: 'rgba(40,20,5,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: Grant an ally a ${dieMod} to add to one ability check, attack, or save. ${inspireLeft}/${maxInspire} remaining.`,
      shortDesc: `Grant ally ${dieMod} die (${inspireLeft} left)`,
      restType: level >= 5 ? 'short' : 'long',
      used: inspireLeft <= 0,
      usedLabel: `All uses spent (refills on ${level >= 5 ? 'short' : 'long'} rest)`,
      available: inspireLeft > 0,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, bardic_inspiration_used: usedInspire + 1 }
        });
        onMessage?.(`🎵 Bardic Inspiration! ${character.name} grants a ${dieMod} inspiration die!`);
        onAbilityUsed?.('bardic_inspiration', {});
      }
    });
  }

  // ── CLERIC ───────────────────────────────────────────────────────────────────
  if (charClass === 'Cleric') {
    const turnUsed = shortRestAbilities.turn_undead_used || 0;
    const maxTurn = 1 + Math.floor(level / 3);
    const turnLeft = Math.max(0, maxTurn - turnUsed);
    abilities.push({
      id: 'channel_divinity',
      name: 'Channel Divinity',
      icon: <Shield className="w-4 h-4" />,
      color: '#fde047',
      borderColor: 'rgba(250,220,40,0.4)',
      bgColor: 'rgba(35,28,3,0.65)',
      type: 'action',
      description: `Action: Turn Undead — undead must make WIS save DC ${8 + profBonus + calcStatMod(character.wisdom || 10)} or be turned. ${turnLeft} use(s) left.`,
      shortDesc: `Turn Undead (${turnLeft} uses)`,
      restType: 'short',
      used: turnLeft <= 0,
      usedLabel: 'Used (short rest)',
      available: turnLeft > 0,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, turn_undead_used: turnUsed + 1 }
        });
        onMessage?.(`✨ Channel Divinity! ${character.name} attempts to Turn Undead!`);
        onAbilityUsed?.('channel_divinity', {});
      }
    });
  }

  // ── DRUID ────────────────────────────────────────────────────────────────────
  if (charClass === 'Druid') {
    const wildShapeUsed = shortRestAbilities.wild_shape_uses || 0;
    const wildShapeMax = 2;
    const wildShapeLeft = Math.max(0, wildShapeMax - wildShapeUsed);
    abilities.push({
      id: 'wild_shape',
      name: 'Wild Shape',
      icon: <Flame className="w-4 h-4" />,
      color: '#86efac',
      borderColor: 'rgba(40,180,80,0.4)',
      bgColor: 'rgba(8,40,15,0.7)',
      type: 'action',
      description: `Action or Bonus Action (Moon druid): Transform into a beast you've seen. CR limit: ${level < 4 ? '¼' : level < 8 ? '½' : Math.floor(level / 3)}. ${wildShapeLeft}/2 remaining.`,
      shortDesc: `Transform into beast (${wildShapeLeft}/2)`,
      restType: 'short',
      used: wildShapeLeft <= 0,
      usedLabel: 'No uses left (short rest)',
      available: wildShapeLeft > 0,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, wild_shape_uses: wildShapeUsed + 1 }
        });
        onMessage?.(`🐺 Wild Shape! ${character.name} transforms!`);
        onAbilityUsed?.('wild_shape', {});
      }
    });
  }

  // ── WARLOCK ──────────────────────────────────────────────────────────────────
  if (charClass === 'Warlock') {
    abilities.push({
      id: 'pact_magic',
      name: 'Pact Magic',
      icon: <Zap className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.35)',
      bgColor: 'rgba(28,10,55,0.65)',
      type: 'passive',
      description: 'Your spell slots recover on a Short Rest. All slots are cast at your highest available slot level.',
      shortDesc: 'Short rest spell recovery',
      used: false,
      available: true,
    });
  }

  if (abilities.length === 0) return null;

  const typeLabel = { action: 'Action', bonus_action: 'Bonus', reaction: 'Reaction', passive: 'Passive', free: 'Free', special: 'Special', passive_toggle: 'Toggle' };
  const typeColor = { action: '#fde68a', bonus_action: '#86efac', reaction: '#93c5fd', passive: 'rgba(180,160,120,0.6)', free: '#fbbf24', special: '#c4b5fd', passive_toggle: '#fbbf24' };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(8,5,2,0.8)', border: '1px solid rgba(180,140,90,0.2)' }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-fantasy"
        style={{ color: 'rgba(220,180,100,0.8)', background: 'rgba(30,20,5,0.6)' }}>
        <span className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: '#f0c040' }} />
          Class Abilities
          <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(60,40,8,0.8)', border: '1px solid rgba(212,149,90,0.3)', color: '#f0c040', fontSize: '0.6rem' }}>
            {charClass} Lv.{level}
          </span>
        </span>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="p-2 grid grid-cols-1 gap-1.5" style={{ borderTop: '1px solid rgba(180,140,90,0.1)' }}>
              {abilities.map(ability => {
                const isClickable = ability.onUse && ability.available && !ability.used;
                const isPassive = ability.type === 'passive';
                return (
                  <motion.button
                    key={ability.id}
                    whileTap={isClickable ? { scale: 0.98 } : {}}
                    onClick={isClickable ? ability.onUse : undefined}
                    disabled={ability.used || isPassive}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                    style={ability.used || !ability.available ? {
                      background: 'rgba(10,8,4,0.4)',
                      border: '1px solid rgba(60,45,20,0.15)',
                      opacity: 0.45,
                      cursor: 'not-allowed',
                    } : isPassive ? {
                      background: 'rgba(15,12,5,0.5)',
                      border: `1px solid ${ability.borderColor}`,
                      cursor: 'default',
                    } : {
                      background: ability.bgColor,
                      border: `1px solid ${ability.borderColor}`,
                      boxShadow: `0 0 8px ${ability.borderColor}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = ability.activeBg || ability.bgColor; }}
                    onMouseLeave={e => { if (isClickable) e.currentTarget.style.background = ability.bgColor; }}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        background: ability.used ? 'rgba(20,15,5,0.4)' : `${ability.bgColor}`,
                        border: `1px solid ${ability.used ? 'rgba(60,45,20,0.2)' : ability.borderColor}`,
                        color: ability.used ? 'rgba(100,80,40,0.3)' : ability.color,
                      }}>
                      {ability.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-fantasy text-xs font-semibold"
                          style={{ color: ability.used ? 'rgba(120,100,60,0.4)' : ability.color }}>
                          {ability.name}
                        </span>
                        <span className="px-1 py-0.5 rounded text-xs"
                          style={{
                            background: 'rgba(20,15,5,0.5)',
                            color: ability.used ? 'rgba(80,60,30,0.3)' : typeColor[ability.type] || '#c9a96e',
                            fontSize: '0.55rem',
                            fontFamily: 'Cinzel, serif',
                            letterSpacing: '0.05em',
                          }}>
                          {typeLabel[ability.type] || ability.type}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 truncate"
                        style={{ color: ability.used ? 'rgba(100,80,40,0.3)' : 'rgba(200,175,130,0.6)', fontFamily: 'EB Garamond, serif', fontSize: '0.65rem' }}>
                        {ability.used ? ability.usedLabel : ability.shortDesc}
                      </div>
                    </div>

                    {/* Status dot */}
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={ability.used ? {
                        background: 'rgba(60,45,20,0.3)',
                        border: '1px solid rgba(80,60,25,0.2)',
                      } : isPassive ? {
                        background: ability.color,
                        boxShadow: `0 0 4px ${ability.color}88`,
                        opacity: 0.5,
                      } : {
                        background: ability.color,
                        boxShadow: `0 0 6px ${ability.color}99`,
                      }} />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getFightingStyleDesc(style) {
  const styles = {
    'Archery': '+2 bonus to ranged attack rolls.',
    'Defense': '+1 AC while wearing armor.',
    'Dueling': '+2 damage when wielding a single one-handed weapon and no other weapon.',
    'Great Weapon Fighting': 'Reroll 1s and 2s on damage dice for two-handed weapons.',
    'Protection': 'Use reaction to impose disadvantage on an attack against an adjacent ally.',
    'Two-Weapon Fighting': 'Add ability modifier to the off-hand weapon attack damage.',
  };
  return styles[style] || `${style} fighting style active.`;
}