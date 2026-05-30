import React from 'react';
import { Shield, Eye, Sparkles } from 'lucide-react';

// Build feat passive reminders (War Caster, Heavy Armor Master, Alert).
export function buildFeatAbilities(ctx) {
  const { character } = ctx;
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

  return abilities;
}