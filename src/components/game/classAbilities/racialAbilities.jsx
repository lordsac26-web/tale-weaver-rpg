import React from 'react';
import { Ghost, Volume2, Zap, Shield, Dices, Footprints, Swords, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calcStatMod } from '../gameData';

// Build racial combat abilities (actives via the combatActions backend, plus
// passive reminders for traits the engine applies automatically).
export function buildRacialAbilities(ctx) {
  const { character, combat, profBonus, bonusActionUsed, shortRestAbilities, longRestAbilities, onMessage, onCharacterUpdate } = ctx;
  const abilities = [];
  const race = character.race || '';
  const inCombat = !!combat?.id;

  const invokeCombatAction = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('combatActions', {
        action, combat_id: combat?.id, session_id: combat?.session_id,
        character_id: character?.id, payload,
      });
      const data = res.data;
      if (data?.invalid) { onMessage?.(data.error || 'Action not available.'); return null; }
      if (data?.log_entry) onMessage?.(data.log_entry.text);
      const updated = await base44.entities.Character.get(character?.id);
      onCharacterUpdate?.(() => updated);
      window.dispatchEvent(new CustomEvent('reload-combat'));
      return data;
    } catch (err) { console.error(`${action} failed:`, err); return null; }
  };

  const passive = (id, name, icon, desc, usedFlag = false, usedLabel = '') => ({
    id, name, icon,
    color: '#c4b5fd', borderColor: 'rgba(150,120,220,0.3)', bgColor: 'rgba(22,14,40,0.5)',
    type: 'passive', description: desc, shortDesc: usedFlag ? usedLabel : 'Automatic',
    used: usedFlag, usedLabel, available: true,
  });

  // ── Firbolg: Hidden Step ──
  if (race === 'Firbolg') {
    const used = !!shortRestAbilities.hidden_step_used;
    abilities.push({
      id: 'hidden_step', name: 'Hidden Step',
      icon: <Ghost className="w-4 h-4" />,
      color: '#a5f3fc', borderColor: 'rgba(60,180,200,0.4)', bgColor: 'rgba(5,35,40,0.6)',
      type: 'bonus_action',
      description: 'Bonus Action: turn invisible until you attack. Attacks against you have disadvantage. 1/short rest.',
      shortDesc: 'Turn invisible',
      restType: 'short', used, usedLabel: 'Used (short rest)',
      available: inCombat && !used && !bonusActionUsed,
      onUse: () => invokeCombatAction('hidden_step'),
    });
  }

  // ── Leonin: Daunting Roar ──
  if (race === 'Leonin') {
    const used = !!shortRestAbilities.daunting_roar_used;
    const dc = 8 + (profBonus || 2) + calcStatMod(character.constitution || 10);
    abilities.push({
      id: 'daunting_roar', name: 'Daunting Roar',
      icon: <Volume2 className="w-4 h-4" />,
      color: '#fdba74', borderColor: 'rgba(230,140,60,0.4)', bgColor: 'rgba(45,22,4,0.6)',
      type: 'bonus_action',
      description: `Bonus Action: enemies within 10ft make a WIS save (DC ${dc}) or are frightened. 1/short rest.`,
      shortDesc: `Frighten enemies (DC ${dc})`,
      restType: 'short', used, usedLabel: 'Used (short rest)',
      available: inCombat && !used && !bonusActionUsed,
      onUse: () => invokeCombatAction('daunting_roar'),
    });
  }

  // ── Orc: Adrenaline Rush ──
  if (race === 'Orc') {
    const used = longRestAbilities.adrenaline_rush_used || 0;
    const max = profBonus || 2;
    abilities.push({
      id: 'adrenaline_rush', name: 'Adrenaline Rush',
      icon: <Zap className="w-4 h-4" />,
      color: '#fca5a5', borderColor: 'rgba(220,80,60,0.4)', bgColor: 'rgba(45,8,5,0.6)',
      type: 'bonus_action',
      description: `Bonus Action: Dash and gain ${max} temp HP. ${Math.max(0, max - used)}/${max} uses per long rest.`,
      shortDesc: `Dash + ${max} temp HP (${Math.max(0, max - used)}/${max})`,
      restType: 'long', used: used >= max, usedLabel: 'Exhausted (long rest)',
      available: inCombat && used < max && !bonusActionUsed,
      onUse: () => invokeCombatAction('adrenaline_rush'),
    });
  }

  // ── Passive reminders (engine applies these automatically) ──
  if (race === 'Goliath') {
    abilities.push(passive('stones_endurance', "Stone's Endurance", <Shield className="w-4 h-4" />,
      "Reaction (automatic): when hit, reduce the damage by 1d12 + CON. 1/short rest — the engine applies it to the first hit each rest.",
      !!shortRestAbilities.stones_endurance_used, 'Used (short rest)'));
  }
  if (race === 'Half-Orc') {
    abilities.push(passive('relentless_endurance', 'Relentless Endurance', <Shield className="w-4 h-4" />,
      'Automatic: when reduced to 0 HP, drop to 1 HP instead. 1/long rest. Savage Attacks (+1 die on melee crits) is also automatic.',
      !!longRestAbilities.relentless_endurance_used, 'Used (long rest)'));
  }
  if (race === 'Halfling') {
    abilities.push(passive('halfling_lucky', 'Lucky', <Dices className="w-4 h-4" />,
      'Automatic: natural 1s on attack rolls, ability checks, and saving throws are rerolled once (new roll stands).'));
  }
  if (race === 'Kobold') {
    abilities.push(passive('pack_tactics', 'Pack Tactics', <Swords className="w-4 h-4" />,
      'Automatic: advantage on attack rolls while a summoned companion fights alongside you.'));
  }
  if (race === 'Bugbear') {
    abilities.push(passive('surprise_attack', 'Surprise Attack', <Eye className="w-4 h-4" />,
      'Automatic: +2d6 damage on your first hit in round 1, once per combat.'));
  }
  if (race === 'Tabaxi') {
    abilities.push(passive('feline_agility', 'Feline Agility', <Footprints className="w-4 h-4" />,
      'Movement: double your speed for one turn; recharges after a turn in which you move 0 ft. (Narrative — declare it when moving.)'));
  }
  if (race === 'Minotaur') {
    abilities.push(passive('goring_rush', 'Goring Rush / Hammering Horns', <Swords className="w-4 h-4" />,
      'After Dashing 20+ ft you may make a bonus horn attack (1d6+STR); on a horn hit you may push a Large or smaller foe 10 ft. (Narrative — use the Act box.)'));
  }

  return abilities;
}