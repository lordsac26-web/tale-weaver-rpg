import React from 'react';
import { Shield, Eye, Sparkles, Wand2, RefreshCcw, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build feat passive reminders and active abilities.
export function buildFeatAbilities(ctx) {
  const { character, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const charFeats = character.feats || [];
  const featFlags = character._feat_flags || [];
  const hasFeat = (name) => charFeats.includes(name) || featFlags.includes(name.toLowerCase().replace(/\s+/g, '_'));

  if (hasFeat('War Caster')) {
    abilities.push({
      id: 'war_caster',
      name: 'War Caster',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.3)',
      bgColor: 'rgba(28,10,55,0.5)',
      type: 'passive',
      shortDesc: 'Advantage on concentration saves',
      description: 'You have advantage on Constitution saving throws to maintain concentration on spells when you take damage.',
      used: false,
      available: true,
    });
  }

  if (hasFeat('Heavy Armor Master')) {
    const wearingHeavy = (character.equipped?.armor?.armor_type || '').toLowerCase() === 'heavy';
    abilities.push({
      id: 'heavy_armor_master',
      name: 'Heavy Armor Master',
      icon: <Shield className="w-4 h-4" />,
      color: '#93c5fd',
      borderColor: 'rgba(100,160,255,0.3)',
      bgColor: 'rgba(8,20,50,0.5)',
      type: 'passive',
      shortDesc: wearingHeavy ? '-3 nonmagical B/P/S damage (active)' : '-3 B/P/S (equip heavy armor)',
      description: 'While wearing heavy armor, bludgeoning, piercing, and slashing damage from nonmagical attacks is reduced by 3.',
      used: false,
      available: true,
    });
  }

  if (hasFeat('Alert')) {
    abilities.push({
      id: 'alert_feat',
      name: 'Alert',
      icon: <Eye className="w-4 h-4" />,
      color: '#fde68a',
      borderColor: 'rgba(250,220,40,0.3)',
      bgColor: 'rgba(35,28,3,0.5)',
      type: 'passive',
      shortDesc: '+5 initiative, can\'t be surprised',
      description: '+5 bonus to initiative. You cannot be surprised while conscious. Creatures don\'t gain advantage by being hidden from you.',
      used: false,
      available: true,
    });
  }

  // --- Active Feats ---

  if (hasFeat('Fey Teleportation')) {
    const feyUsed = !!shortRestAbilities?.fey_teleportation;
    abilities.push({
      id: 'fey_teleportation',
      name: 'Fey Teleportation',
      icon: <Wand2 className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(28,12,55,0.7)',
      activeBg: 'rgba(50,20,90,0.85)',
      type: 'bonus_action',
      description: 'Cast Misty Step without expending a spell slot. 1/short rest.',
      shortDesc: 'Misty Step (Free)',
      restType: 'short',
      used: feyUsed,
      usedLabel: 'Used (short rest)',
      available: !feyUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, fey_teleportation: true }
        });
        onMessage?.(`✨ Fey Teleportation! ${character.name} casts Misty Step and vanishes in a silvery mist.`);
        onAbilityUsed?.('fey_teleportation', {});
      }
    });
  }

  if (hasFeat('Second Chance')) {
    const chanceUsed = !!shortRestAbilities?.second_chance;
    abilities.push({
      id: 'second_chance',
      name: 'Second Chance',
      icon: <RefreshCcw className="w-4 h-4" />,
      color: '#fca5a5',
      borderColor: 'rgba(252,165,165,0.4)',
      bgColor: 'rgba(60,20,20,0.7)',
      activeBg: 'rgba(90,30,30,0.85)',
      type: 'reaction',
      description: 'When a creature hits you with an attack, you can force that creature to reroll. 1/short rest.',
      shortDesc: 'Force Attack Reroll',
      restType: 'short',
      used: chanceUsed,
      usedLabel: 'Used (short rest)',
      available: !chanceUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, second_chance: true }
        });
        onMessage?.(`🛡️ Second Chance! ${character.name} forces the attacker to reroll!`);
        onAbilityUsed?.('second_chance', {});
      }
    });
  }

  if (hasFeat('Inspiring Leader')) {
    const leaderUsed = !!shortRestAbilities?.inspiring_leader; // Tracking per short rest
    abilities.push({
      id: 'inspiring_leader',
      name: 'Inspiring Leader',
      icon: <Users className="w-4 h-4" />,
      color: '#fde68a',
      borderColor: 'rgba(250,220,40,0.4)',
      bgColor: 'rgba(40,35,5,0.7)',
      activeBg: 'rgba(70,55,8,0.85)',
      type: 'action', // Technically 10 minutes, but simplified for UI
      description: 'Spend 10 minutes inspiring your companions. Up to 6 allies gain Temporary HP equal to your Level + CHA modifier.',
      shortDesc: 'Grant Temp HP (10 min)',
      restType: 'short',
      used: leaderUsed,
      usedLabel: 'Used (short rest)',
      available: !leaderUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, inspiring_leader: true }
        });
        onMessage?.(`🗣️ Inspiring Leader! ${character.name} gives a rousing speech, granting Temporary HP to allies.`);
        onAbilityUsed?.('inspiring_leader', {});
      }
    });
  }

  return abilities;
}