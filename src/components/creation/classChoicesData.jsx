// D&D 5E class/race features that require player choices during character creation

export const FAVORED_ENEMIES = [
  'Aberrations', 'Beasts', 'Celestials', 'Constructs', 'Dragons',
  'Elementals', 'Fey', 'Fiends', 'Giants', 'Monstrosities',
  'Oozes', 'Plants', 'Undead', 'Humanoids (two types)',
];

export const FAVORED_TERRAINS = [
  'Arctic', 'Coast', 'Desert', 'Forest', 'Grassland',
  'Mountain', 'Swamp', 'Underdark',
];

export const FIGHTING_STYLES = {
  Fighter: [
    { id: 'archery', name: 'Archery', desc: '+2 bonus to attack rolls with ranged weapons.' },
    { id: 'defense', name: 'Defense', desc: '+1 bonus to AC while wearing armor.' },
    { id: 'dueling', name: 'Dueling', desc: '+2 damage when wielding a melee weapon in one hand and no other weapons.' },
    { id: 'great_weapon', name: 'Great Weapon Fighting', desc: 'Reroll 1s and 2s on damage dice with two-handed melee weapons.' },
    { id: 'protection', name: 'Protection', desc: 'Use reaction to impose disadvantage on an attack against an adjacent ally (requires shield).' },
    { id: 'two_weapon', name: 'Two-Weapon Fighting', desc: 'Add your ability modifier to the damage of the second attack with two-weapon fighting.' },
  ],
  Ranger: [
    { id: 'archery', name: 'Archery', desc: '+2 bonus to attack rolls with ranged weapons.' },
    { id: 'defense', name: 'Defense', desc: '+1 bonus to AC while wearing armor.' },
    { id: 'dueling', name: 'Dueling', desc: '+2 damage when wielding a melee weapon in one hand and no other weapons.' },
    { id: 'two_weapon', name: 'Two-Weapon Fighting', desc: 'Add your ability modifier to the damage of the second attack with two-weapon fighting.' },
  ],
  Paladin: [
    { id: 'defense', name: 'Defense', desc: '+1 bonus to AC while wearing armor.' },
    { id: 'dueling', name: 'Dueling', desc: '+2 damage when wielding a melee weapon in one hand and no other weapons.' },
    { id: 'great_weapon', name: 'Great Weapon Fighting', desc: 'Reroll 1s and 2s on damage dice with two-handed melee weapons.' },
    { id: 'protection', name: 'Protection', desc: 'Use reaction to impose disadvantage on an attack against an adjacent ally (requires shield).' },
  ],
};

export const DRACONIC_ANCESTRY_OPTIONS = [
  { type: 'Black',   damage: 'Acid',      breath: '5x30 ft line (DEX save)' },
  { type: 'Blue',    damage: 'Lightning',  breath: '5x30 ft line (DEX save)' },
  { type: 'Brass',   damage: 'Fire',       breath: '5x30 ft line (DEX save)' },
  { type: 'Bronze',  damage: 'Lightning',  breath: '5x30 ft line (DEX save)' },
  { type: 'Copper',  damage: 'Acid',       breath: '5x30 ft line (DEX save)' },
  { type: 'Gold',    damage: 'Fire',       breath: '15 ft cone (DEX save)' },
  { type: 'Green',   damage: 'Poison',     breath: '15 ft cone (CON save)' },
  { type: 'Red',     damage: 'Fire',       breath: '15 ft cone (DEX save)' },
  { type: 'Silver',  damage: 'Cold',       breath: '15 ft cone (CON save)' },
  { type: 'White',   damage: 'Cold',       breath: '15 ft cone (CON save)' },
];

export const TOTEM_SPIRITS = [
  { id: 'bear',  name: 'Bear',  desc: 'While raging, you have resistance to all damage except psychic.' },
  { id: 'eagle', name: 'Eagle', desc: 'While raging, others have disadvantage on opportunity attacks against you; Dash as bonus action.' },
  { id: 'wolf',  name: 'Wolf',  desc: 'While raging, allies have advantage on melee attacks against any creature within 5 ft of you.' },
];

export const WARLOCK_PACT_BOONS = [
  { id: 'chain', name: 'Pact of the Chain', desc: 'You learn Find Familiar and can summon a special familiar (imp, pseudodragon, quasit, or sprite).' },
  { id: 'blade', name: 'Pact of the Blade', desc: 'You can create a magical pact weapon in your empty hand. You are proficient with it.' },
  { id: 'tome',  name: 'Pact of the Tome', desc: 'You receive a Book of Shadows with three cantrips from any class\'s spell list.' },
];

export const ELDRITCH_INVOCATIONS = [
  { id: 'agonizing_blast', name: 'Agonizing Blast', desc: 'Add CHA modifier to Eldritch Blast damage.', prereq: 'Eldritch Blast cantrip' },
  { id: 'armor_of_shadows', name: 'Armor of Shadows', desc: 'Cast Mage Armor on yourself at will.' },
  { id: 'devils_sight', name: "Devil's Sight", desc: 'See normally in darkness (magical and nonmagical) out to 120 feet.' },
  { id: 'eldritch_sight', name: 'Eldritch Sight', desc: 'Cast Detect Magic at will.' },
  { id: 'fiendish_vigor', name: 'Fiendish Vigor', desc: 'Cast False Life on yourself at will as a 1st-level spell.' },
  { id: 'mask_of_many_faces', name: 'Mask of Many Faces', desc: 'Cast Disguise Self at will.' },
  { id: 'misty_visions', name: 'Misty Visions', desc: 'Cast Silent Image at will.' },
  { id: 'repelling_blast', name: 'Repelling Blast', desc: 'Push creature 10 feet away on Eldritch Blast hit.', prereq: 'Eldritch Blast cantrip' },
  { id: 'thief_of_five_fates', name: 'Thief of Five Fates', desc: 'Cast Bane once using a warlock spell slot.' },
  { id: 'gaze_of_two_minds', name: 'Gaze of Two Minds', desc: 'Use action to perceive through a willing humanoid\'s senses.' },
];

// Returns the number of invocations known for Warlocks by level
export function getInvocationsKnown(level) {
  if (level < 2) return 0;
  if (level <= 4) return 2;
  if (level <= 6) return 3;
  if (level <= 8) return 4;
  if (level <= 11) return 5;
  if (level <= 14) return 6;
  if (level <= 17) return 7;
  return 8;
}

// Hunter's Prey options (Ranger: Hunter subclass, level 3)
export const HUNTERS_PREY = [
  { id: 'colossus_slayer', name: 'Colossus Slayer', desc: 'Once per turn, deal an extra 1d8 damage to a creature below its hit point maximum.' },
  { id: 'giant_killer', name: 'Giant Killer', desc: 'When a Large or larger creature within 5 ft attacks you, use reaction to attack it.' },
  { id: 'horde_breaker', name: 'Horde Breaker', desc: 'Once per turn, make another attack against a different creature within 5 ft of the original target.' },
];

// Metamagic options (Sorcerer, level 3)
export const METAMAGIC_OPTIONS = [
  { id: 'careful', name: 'Careful Spell', desc: 'Chosen creatures auto-succeed on saves vs your spell (CHA mod creatures, min 1). Cost: 1 SP.' },
  { id: 'distant', name: 'Distant Spell', desc: 'Double range of spell, or make touch spell 30 ft range. Cost: 1 SP.' },
  { id: 'empowered', name: 'Empowered Spell', desc: 'Reroll up to CHA mod damage dice (min 1). Cost: 1 SP.' },
  { id: 'extended', name: 'Extended Spell', desc: 'Double spell duration (max 24 hours). Cost: 1 SP.' },
  { id: 'heightened', name: 'Heightened Spell', desc: 'One target has disadvantage on first save vs spell. Cost: 3 SP.' },
  { id: 'quickened', name: 'Quickened Spell', desc: 'Change casting time from 1 action to 1 bonus action. Cost: 2 SP.' },
  { id: 'subtle', name: 'Subtle Spell', desc: 'Cast without somatic or verbal components. Cost: 1 SP.' },
  { id: 'twinned', name: 'Twinned Spell', desc: 'Target a second creature with a single-target spell. Cost: spell level SP (min 1).' },
];

// Land types for Circle of the Land Druid
export const DRUID_LAND_TYPES = [
  'Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark'
];

/**
 * Returns an array of choice-requirement objects for a given character.
 * Each object: { id, label, description, type, options[], max, minLevel?, condition? }
 * type: 'single' | 'multi'
 */
export function getRequiredChoices(character) {
  const choices = [];
  const cls = character.class;
  const subclass = (character.subclass || '').toLowerCase();
  const level = character.level || 1;
  const race = character.race;

  // ─── Dragonborn: Draconic Ancestry ───
  if (race === 'Dragonborn') {
    choices.push({
      id: 'draconic_ancestry',
      label: 'Draconic Ancestry',
      description: 'Choose the type of dragon that is your ancestor. This determines your breath weapon damage type and resistance.',
      type: 'single',
      options: DRACONIC_ANCESTRY_OPTIONS.map(d => ({
        id: d.type.toLowerCase(),
        name: `${d.type} Dragon`,
        desc: `${d.damage} damage · ${d.breath}`,
      })),
    });
  }

  // ─── Ranger: Favored Enemy ───
  if (cls === 'Ranger') {
    choices.push({
      id: 'favored_enemy',
      label: 'Favored Enemy',
      description: 'Choose a type of creature as your favored enemy. You have advantage on Survival checks to track them and Intelligence checks to recall information about them.',
      type: 'single',
      options: FAVORED_ENEMIES.map(e => ({ id: e.toLowerCase().replace(/\s/g, '_'), name: e, desc: '' })),
    });
    // Second favored enemy at level 6
    if (level >= 6) {
      choices.push({
        id: 'favored_enemy_2',
        label: 'Favored Enemy (2nd)',
        description: 'Choose an additional favored enemy type.',
        type: 'single',
        options: FAVORED_ENEMIES.map(e => ({ id: e.toLowerCase().replace(/\s/g, '_'), name: e, desc: '' })),
      });
    }
  }

  // ─── Ranger: Natural Explorer ───
  if (cls === 'Ranger') {
    choices.push({
      id: 'favored_terrain',
      label: 'Natural Explorer — Favored Terrain',
      description: 'Choose a type of terrain. You are particularly familiar with it and can travel through it with ease.',
      type: 'single',
      options: FAVORED_TERRAINS.map(t => ({ id: t.toLowerCase(), name: t, desc: '' })),
    });
    if (level >= 6) {
      choices.push({
        id: 'favored_terrain_2',
        label: 'Natural Explorer — 2nd Terrain',
        description: 'Choose an additional favored terrain.',
        type: 'single',
        options: FAVORED_TERRAINS.map(t => ({ id: t.toLowerCase(), name: t, desc: '' })),
      });
    }
  }

  // ─── Fighting Style ───
  if (FIGHTING_STYLES[cls] && level >= (cls === 'Ranger' || cls === 'Paladin' ? 2 : 1)) {
    choices.push({
      id: 'fighting_style',
      label: 'Fighting Style',
      description: `Choose a fighting style. You can't take the same Fighting Style more than once.`,
      type: 'single',
      options: FIGHTING_STYLES[cls],
    });
  }

  // ─── Rogue: Expertise (level 1, pick 2 proficient skills) ───
  if (cls === 'Rogue' && level >= 1) {
    choices.push({
      id: 'expertise',
      label: 'Expertise (choose 2 skills)',
      description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make with them.',
      type: 'multi',
      max: 2,
      options: [], // filled dynamically from character.skills
      dynamic: 'proficient_skills',
    });
  }

  // ─── Bard: Expertise (level 3, pick 2 proficient skills) ───
  if (cls === 'Bard' && level >= 3) {
    choices.push({
      id: 'expertise',
      label: 'Expertise (choose 2 skills)',
      description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make with them.',
      type: 'multi',
      max: 2,
      options: [],
      dynamic: 'proficient_skills',
    });
  }

  // ─── Barbarian: Totem Spirit (Path of the Totem Warrior, level 3) ───
  if (cls === 'Barbarian' && subclass.includes('totem') && level >= 3) {
    choices.push({
      id: 'totem_spirit',
      label: 'Totem Spirit',
      description: 'Choose a totem animal spirit. It grants you a feature while raging.',
      type: 'single',
      options: TOTEM_SPIRITS,
    });
  }

  // ─── Warlock: Pact Boon (level 3) ───
  if (cls === 'Warlock' && level >= 3) {
    choices.push({
      id: 'pact_boon',
      label: 'Pact Boon',
      description: 'Your otherworldly patron bestows a gift upon you for your loyal service.',
      type: 'single',
      options: WARLOCK_PACT_BOONS,
    });
  }

  // ─── Warlock: Eldritch Invocations (level 2+) ───
  if (cls === 'Warlock' && level >= 2) {
    const maxInv = getInvocationsKnown(level);
    choices.push({
      id: 'eldritch_invocations',
      label: `Eldritch Invocations (choose ${maxInv})`,
      description: 'Fragments of forbidden knowledge that imbue you with an abiding magical ability.',
      type: 'multi',
      max: maxInv,
      options: ELDRITCH_INVOCATIONS,
    });
  }

  // ─── Sorcerer: Metamagic (level 3, choose 2) ───
  if (cls === 'Sorcerer' && level >= 3) {
    choices.push({
      id: 'metamagic',
      label: 'Metamagic (choose 2)',
      description: 'You gain the ability to twist your spells to suit your needs.',
      type: 'multi',
      max: level >= 10 ? 3 : 2,
      options: METAMAGIC_OPTIONS,
    });
  }

  // ─── Sorcerer: Draconic Bloodline → Dragon Ancestor ───
  if (cls === 'Sorcerer' && subclass.includes('draconic')) {
    choices.push({
      id: 'dragon_ancestor',
      label: 'Dragon Ancestor',
      description: 'Choose the type of dragon ancestor whose power fuels your sorcery.',
      type: 'single',
      options: DRACONIC_ANCESTRY_OPTIONS.map(d => ({
        id: d.type.toLowerCase(),
        name: `${d.type} Dragon`,
        desc: `${d.damage} damage`,
      })),
    });
  }

  // ─── Ranger: Hunter's Prey (Hunter subclass, level 3) ───
  if (cls === 'Ranger' && subclass.includes('hunter') && level >= 3) {
    choices.push({
      id: 'hunters_prey',
      label: "Hunter's Prey",
      description: 'Choose one of the following features.',
      type: 'single',
      options: HUNTERS_PREY,
    });
  }

  // ─── Druid: Circle of the Land → Land Type ───
  if (cls === 'Druid' && subclass.includes('land') && level >= 2) {
    choices.push({
      id: 'druid_land',
      label: 'Circle of the Land — Terrain',
      description: 'Choose the land type that defines your connection to the natural world. This grants you additional circle spells.',
      type: 'single',
      options: DRUID_LAND_TYPES.map(t => ({ id: t.toLowerCase(), name: t, desc: '' })),
    });
  }

  return choices;
}