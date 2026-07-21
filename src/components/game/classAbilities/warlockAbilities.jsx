import React from 'react';
import { Zap, Swords, Eye, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Warlock abilities: Pact Magic, Mystic Arcanum, combat invocations.
export function buildWarlockAbilities(ctx) {
  const { character, level, combat, selectedTargetId, bonusActionUsed, shortRestAbilities = {}, onMessage } = ctx;
  const abilities = [];
  const isHexblade = (character?.subclass || '').toLowerCase().includes('hexblade');
  const inCombat = !!combat?.id;

  // ── Hexblade: Hexblade's Curse + Hex Warrior (XGtE p.55) ──
  if (isHexblade) {
    const curseUsed = !!shortRestAbilities.hexblade_curse_used;
    const profBonus = character?.proficiency_bonus || 2;
    abilities.push({
      id: 'hexblade_curse',
      name: "Hexblade's Curse",
      icon: <Eye className="w-4 h-4" />,
      color: '#e879f9', borderColor: 'rgba(220,100,250,0.45)', bgColor: 'rgba(40,5,50,0.7)',
      type: 'bonus_action',
      description: `Bonus Action: curse a target — +${profBonus} damage against it, your attacks crit on 19-20, and when it dies you regain ${level + Math.max(0, Math.floor(((character?.charisma || 10) - 10) / 2))} HP. 1/short rest.`,
      shortDesc: `Curse target (+${profBonus} dmg, crit 19-20)`,
      restType: 'short',
      used: curseUsed,
      usedLabel: 'Used (short rest)',
      available: inCombat && !curseUsed && !bonusActionUsed,
      onUse: async () => {
        try {
          const res = await base44.functions.invoke('combatActions', {
            action: 'hexblade_curse', combat_id: combat?.id, session_id: combat?.session_id,
            character_id: character?.id, payload: { target_id: selectedTargetId },
          });
          if (res.data?.invalid) { onMessage?.(res.data.error); return; }
          if (res.data?.log_entry) onMessage?.(res.data.log_entry.text);
          window.dispatchEvent(new CustomEvent('reload-combat'));
        } catch (err) { console.error('hexblade_curse failed:', err); }
      },
    });
    abilities.push({
      id: 'hex_warrior',
      name: 'Hex Warrior',
      icon: <Swords className="w-4 h-4" />,
      color: '#d8b4fe', borderColor: 'rgba(190,140,255,0.3)', bgColor: 'rgba(28,10,50,0.55)',
      type: 'passive',
      description: 'Your weapon attacks automatically use Charisma when it beats Strength/Dexterity. (Engine: automated)',
      shortDesc: 'Auto: CHA-based weapon attacks',
      used: false, available: true,
    });
  }

  // Pact Magic (passive)
  abilities.push({
    id: 'pact_magic',
    name: 'Pact Magic',
    icon: <Zap className="w-4 h-4" />,
    color: '#c4b5fd', borderColor: 'rgba(160,120,255,0.35)', bgColor: 'rgba(28,10,55,0.65)',
    type: 'passive',
    description: 'Your spell slots recover on a Short Rest. All slots are cast at your highest available pact slot level.',
    shortDesc: 'Short rest spell recovery',
    used: false, available: true,
  });

  // Combat-relevant Invocations (passive display of which are active)
  const charFeatures = (character?.features || []).map(f => String(typeof f === 'string' ? f : f?.name || '').toLowerCase());
  const INVOCATIONS = [
    { name: 'Agonizing Blast', match: 'agonizing blast', desc: 'Eldritch Blast deals +CHA mod damage per beam. (Engine: automated)' },
    { name: 'Repelling Blast', match: 'repelling blast', desc: 'Eldritch Blast hits push the target 10 feet. (Engine: automated)' },
    { name: 'Thirsting Blade', match: 'thirsting blade', desc: 'Extra Attack with your pact weapon (L5+). (Engine: automated in action economy)' },
    { name: 'Lifedrinker', match: 'lifedrinker', desc: 'At L12, add CHA mod to pact weapon damage. (Engine: automated)' },
    { name: 'Improved Pact Weapon', match: 'improved pact weapon', desc: '+1 to attack and damage with pact weapon; any weapon can be a spellcasting focus. (Engine: +1 atk/dmg automated)' },
  ];

  for (const inv of INVOCATIONS) {
    const hasIt = charFeatures.some(f => f.includes(inv.match));
    if (hasIt) {
      abilities.push({
        id: `invocation_${inv.match.replace(/\s+/g, '_')}`,
        name: inv.name,
        icon: <Wand2 className="w-4 h-4" />,
        color: '#a78bfa', borderColor: 'rgba(160,120,255,0.3)', bgColor: 'rgba(20,8,45,0.6)',
        type: 'passive',
        description: inv.desc,
        shortDesc: 'Invocation (active)',
        used: false, available: true,
      });
    }
  }

  // Mystic Arcanum (PHB p.108): one spell per level at 11/13/15/17, cast once per long rest
  const MYSTIC_ARCANUM_LEVELS = [
    { level: 11, slot: '6th', spells: ['Circle of Death', 'Conjure Fey', 'Create Undead', 'Eyebite', 'Flesh to Stone', 'Magic Jar', 'Mass Haste', 'Planar Ally', 'Sunbeam', 'Transport via Plants', 'True Seeing', 'Wall of Ice', 'Wall of Thorns', 'Wind Walk', 'Word of Recall'] },
    { level: 13, slot: '7th', spells: ['Conjure Celestial', 'Divine Word', 'Etherealness', 'Finger of Death', 'Forcecage', 'Mirage Arcane', 'Mordenkainen\'s Sword', 'Prismatic Spray', 'Project Image', 'Regenerate', 'Resurrection', 'Reverse Gravity', 'Sequester', 'Simulacrum', 'Symbol', 'Teleport'] },
    { level: 15, slot: '8th', spells: ['Animal Shapes', 'Antimagic Field', 'Antipathy/Sympathy', 'Clone', 'Control Weather', 'Demiplane', 'Dominate Monster', 'Earthquake', 'Feeblemind', 'Glibness', 'Holy Aura', 'Incendiary Cloud', 'Mighty Fortress', 'Mind Blank', 'Power Word Stun', 'Sunburst', 'Tsunami'] },
    { level: 17, slot: '9th', spells: ['Astral Projection', 'Foresight', 'Imprisonment', 'Mass Heal', 'Meteor Swarm', 'Power Word Kill', 'Prismatic Wall', 'Shapechange', 'Storm of Vengeance', 'Time Stop', 'True Polymorph', 'Weird', 'Wish'] },
  ];

  for (const arcanum of MYSTIC_ARCANUM_LEVELS) {
    if (level >= arcanum.level) {
      abilities.push({
        id: `mystic_arcanum_${arcanum.level}`,
        name: `Mystic Arcanum (${arcanum.slot})`,
        icon: <Swords className="w-4 h-4" />,
        color: '#f0abfc', borderColor: 'rgba(230,100,255,0.35)', bgColor: 'rgba(35,5,45,0.6)',
        type: 'passive',
        description: `Cast one ${arcanum.slot}-level spell per long rest without a slot. Available: ${arcanum.spells.slice(0, 5).join(', ')}... Track usage in your spell management.`,
        shortDesc: `1 ${arcanum.slot}-level spell/long rest`,
        used: false, available: true,
      });
    }
  }

  return abilities;
}