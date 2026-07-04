import React from 'react';
import { Swords, Sparkles, Heart, Target, Zap } from 'lucide-react';

/**
 * Generic subclass feature surfacing for the combat panel, keyed off
 * character.class + character.subclass.
 *
 * - Bard colleges are handled in bardSubclasses.jsx.
 * - Battle Master & Rune Knight are handled in fighterSubclasses.jsx.
 * - Entries marked ⚙ are wired directly into the combat engine and apply
 *   automatically (no button press needed).
 * - Every OTHER subclass gets a fallback pill pointing the player at the
 *   free-text Act window, where the DM engine adjudicates its features.
 */

const SUBCLASS_UNLOCK_LEVEL = { Cleric: 1, Sorcerer: 1, Warlock: 1, Druid: 2, Wizard: 2 };

const pill = ({ id, name, icon, color, description, shortDesc, type = 'passive' }) => ({
  id,
  name,
  icon,
  type,
  color,
  borderColor: `${color}55`,
  bgColor: 'rgba(18,14,8,0.6)',
  description,
  shortDesc,
  used: false,
  available: true,
});

export function buildGenericSubclassAbilities(ctx) {
  const { character, level } = ctx;
  const charClass = character?.class || '';
  const subclass = (character?.subclass || '').trim();
  const sub = subclass.toLowerCase();
  const abilities = [];

  if (!subclass) return abilities;
  if (charClass === 'Bard') return abilities; // colleges handled in bardSubclasses
  if (level < (SUBCLASS_UNLOCK_LEVEL[charClass] || 3)) return abilities;

  // Subclasses with dedicated interactive panels elsewhere — no fallback pill.
  let hasDedicated =
    (charClass === 'Fighter' && (sub.includes('rune knight') || sub.includes('battle master')));

  // ── Engine-wired subclass mechanics (apply automatically) ─────────────────
  if (charClass === 'Fighter' && sub.includes('champion')) {
    hasDedicated = true;
    abilities.push(pill({
      id: 'improved_critical',
      name: level >= 15 ? 'Superior Critical' : 'Improved Critical',
      icon: <Swords className="w-4 h-4" />,
      color: '#fcd34d',
      shortDesc: `Crit on ${level >= 15 ? '18-20' : '19-20'} — automatic`,
      description: `⚙ Your weapon attacks score a critical hit on a roll of ${level >= 15 ? '18-20' : '19-20'} (PHB p.72). The combat engine applies this automatically to every attack you make.`,
    }));
  }

  if (charClass === 'Ranger' && sub.includes('hunter')) {
    hasDedicated = true;
    abilities.push(pill({
      id: 'colossus_slayer',
      name: 'Colossus Slayer',
      icon: <Target className="w-4 h-4" />,
      color: '#6ee7b7',
      shortDesc: '+1d8 vs wounded targets — automatic',
      description: '⚙ Once per turn, when you hit a creature that is below its hit point maximum, you deal an extra 1d8 damage (PHB p.93). The combat engine applies this automatically.',
    }));
  }

  if (charClass === 'Cleric' && sub.includes('life')) {
    hasDedicated = true;
    abilities.push(pill({
      id: 'disciple_of_life',
      name: 'Disciple of Life',
      icon: <Heart className="w-4 h-4" />,
      color: '#86efac',
      shortDesc: 'Healing spells +2 + spell level — automatic',
      description: '⚙ Whenever you cast a healing spell, it restores an extra 2 + the spell\'s level HP (PHB p.60). The combat engine applies this automatically to your healing spells.',
    }));
  }

  // Warlock: Agonizing Blast is a feature, not a patron — show it for any patron who knows it.
  if (charClass === 'Warlock') {
    const hasAgonizing = (character.features || []).some(f =>
      String(typeof f === 'string' ? f : f?.name || '').toLowerCase().includes('agonizing blast'));
    if (hasAgonizing) {
      abilities.push(pill({
        id: 'agonizing_blast',
        name: 'Agonizing Blast',
        icon: <Zap className="w-4 h-4" />,
        color: '#c4b5fd',
        shortDesc: 'Eldritch Blast +CHA per beam — automatic',
        description: '⚙ Your Eldritch Blast beams each add your Charisma modifier to damage (PHB p.110). The combat engine applies this automatically when you cast Eldritch Blast.',
      }));
    }
  }

  // ── Fallback: every other subclass is playable via the Act window ─────────
  if (!hasDedicated) {
    abilities.push(pill({
      id: 'subclass_features',
      name: subclass,
      icon: <Sparkles className="w-4 h-4" />,
      color: '#d8b4fe',
      shortDesc: 'Use features via the Act window ↓',
      description: `Your ${subclass} features are on your character sheet (Features tab). To use one in combat, describe it in the free-text Act window below — the DM engine adjudicates the rolls, damage, and effects for you.`,
    }));
  }

  return abilities;
}