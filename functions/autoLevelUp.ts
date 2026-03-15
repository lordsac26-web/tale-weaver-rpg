import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
 
/**
 * Automated Leveling System
 * Checks XP thresholds and automatically levels up characters.
 * Updates: HP max, proficiency bonus, new features, spell slots,
 * armor class (Monk/Barbarian/natural-armor races), and initiative.
 */
 
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const PROFICIENCY_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
 
const CLASS_HIT_DICE = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8, Artificer: 8,
  Wizard: 6, Sorcerer: 6,
};
 
const RACIAL_HP_BONUSES = {
  'Hill Dwarf': 1, // Dwarven Toughness: +1 HP per level (PHB p.20)
};
 
const calcStatMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
 
// ── Spell slot tables per class per level (index 0 = 1st-level slots, etc.) ──
const SPELL_SLOTS = {
  Wizard:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Sorcerer: { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Cleric:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Druid:    { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Bard:     { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Paladin:  { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  Ranger:   { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  Warlock:  { 1:[1,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[0,2,0,0,0,0,0,0,0], 4:[0,2,0,0,0,0,0,0,0], 5:[0,0,2,0,0,0,0,0,0], 6:[0,0,2,0,0,0,0,0,0], 7:[0,0,0,2,0,0,0,0,0], 8:[0,0,0,2,0,0,0,0,0], 9:[0,0,0,0,2,0,0,0,0], 10:[0,0,0,0,2,0,0,0,0], 11:[0,0,0,0,3,0,0,0,0], 12:[0,0,0,0,3,0,0,0,0], 13:[0,0,0,0,3,0,0,0,0], 14:[0,0,0,0,3,0,0,0,0], 15:[0,0,0,0,3,0,0,0,0], 16:[0,0,0,0,3,0,0,0,0], 17:[0,0,0,0,4,0,0,0,0], 18:[0,0,0,0,4,0,0,0,0], 19:[0,0,0,0,4,0,0,0,0], 20:[0,0,0,0,4,0,0,0,0] },
  Artificer:{ 1:[2,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
};
 
const NON_CASTERS = ['Fighter', 'Barbarian', 'Rogue', 'Monk'];
 
/** Build a fresh spell_slots object (tracks slots used, starting at 0). */
function buildSpellSlots(charClass, level) {
  const table = SPELL_SLOTS[charClass];
  if (!table || NON_CASTERS.includes(charClass)) return {};
  const slots = table[level] || [];
  const result = {};
  slots.forEach((max, i) => {
    if (max > 0) result[`level_${i + 1}`] = 0;
  });
  return result;
}
 
/** Recalculate armor class for classes/races that derive AC from stats. */
function recalcArmorClass(character) {
  const dexMod = calcStatMod(character.dexterity || 10);
  const wisMod = calcStatMod(character.wisdom    || 10);
  const conMod = calcStatMod(character.constitution || 10);
 
  // Skip if character is wearing armor — AC is set by the armor, not stats
  const equippedArmor = character.equipped && character.equipped.armor;
  if (equippedArmor) return null;
 
  if (character.class === 'Monk')       return 10 + dexMod + wisMod;
  if (character.class === 'Barbarian')  return 10 + dexMod + conMod;
  if (character.race  === 'Lizardfolk') return 13 + dexMod;
  if (character.race  === 'Tortle')     return 17;
  if (character.race  === 'Warforged')  return 11 + dexMod;
  return null;
}
 
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 
    const { character_id } = await req.json();
 
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
 
    const currentLevel = character.level || 1;
    const currentXP    = character.xp    || 0;
 
    if (currentLevel >= 20) {
      return Response.json({ leveled_up: false, message: 'Already at max level (20)', current_level: currentLevel });
    }
 
    const nextLevelThreshold = XP_THRESHOLDS[currentLevel];
    if (currentXP < nextLevelThreshold) {
      return Response.json({
        leveled_up: false, message: 'Not enough XP',
        current_xp: currentXP, xp_needed: nextLevelThreshold, current_level: currentLevel,
      });
    }
 
    // Support gaining multiple levels at once
    let newLevel = currentLevel;
    while (newLevel < 20 && currentXP >= XP_THRESHOLDS[newLevel]) newLevel++;
 
    if (newLevel === currentLevel) {
      return Response.json({ leveled_up: false, message: 'No level gain' });
    }
 
    // ── HP increase ──────────────────────────────────────────────────────────
    const hitDie        = CLASS_HIT_DICE[character.class] || 8;
    const conMod        = calcStatMod(character.constitution || 10);
    const racialHPBonus = RACIAL_HP_BONUSES[character.race] || 0;
    const levelsGained  = newLevel - currentLevel;
    const avgHPPerLevel = Math.floor(hitDie / 2) + 1 + conMod + racialHPBonus;
    const hpIncrease    = levelsGained * avgHPPerLevel;
    const newMaxHP      = (character.hp_max || 0) + hpIncrease;
    const newProfBonus  = PROFICIENCY_BY_LEVEL[newLevel - 1];
 
    // ── Spell slots ──────────────────────────────────────────────────────────
    const newSpellSlots = buildSpellSlots(character.class, newLevel);
    const existingUsed  = character.spell_slots || {};
    const newSlotTable  = (SPELL_SLOTS[character.class] && SPELL_SLOTS[character.class][newLevel]) || [];
    Object.keys(newSpellSlots).forEach(key => {
      const lvlIdx        = parseInt(key.replace('level_', '')) - 1;
      const maxAtNewLevel = newSlotTable[lvlIdx] || 0;
      const prevUsed      = existingUsed[key] || 0;
      newSpellSlots[key]  = Math.min(prevUsed, maxAtNewLevel);
    });
 
    // ── AC and initiative recalculation ─────────────────────────────────────
    const newAC         = recalcArmorClass(character);
    const newInitiative = calcStatMod(character.dexterity || 10);
 
    // ── Class features for gained levels ────────────────────────────────────
    const newFeatures = [];
    const CLASS_FEATURES = {
      Fighter: {
        1: ['Fighting Style', 'Second Wind'],
        2: ['Action Surge'],
        3: ['Martial Archetype'],
        4: ['Ability Score Improvement'],
        5: ['Extra Attack'],
        6: ['Ability Score Improvement'],
        7: ['Archetype Feature'],
        8: ['Ability Score Improvement'],
        9: ['Indomitable'],
        11: ['Extra Attack (2)'],
        12: ['Ability Score Improvement'],
        14: ['Ability Score Improvement'],
        15: ['Archetype Feature'],
        16: ['Ability Score Improvement'],
        17: ['Action Surge (2)', 'Indomitable (2)'],
        18: ['Archetype Feature'],
        19: ['Ability Score Improvement'],
        20: ['Extra Attack (3)'],
      },
      Rogue: {
        1: ['Expertise', 'Sneak Attack (1d6)', "Thieves' Cant"],
        2: ['Cunning Action'],
        3: ['Roguish Archetype'],
        5: ['Uncanny Dodge'],
        7: ['Evasion'],
        11: ['Reliable Talent'],
        14: ['Blindsense'],
        15: ['Slippery Mind'],
        18: ['Elusive'],
        20: ['Stroke of Luck'],
      },
      Wizard: {
        1: ['Spellcasting', 'Arcane Recovery'],
        2: ['Arcane Tradition'],
        18: ['Spell Mastery'],
        20: ['Signature Spells'],
      },
      Cleric: {
        1: ['Spellcasting', 'Divine Domain'],
        2: ['Channel Divinity', 'Turn Undead'],
        5: ['Destroy Undead (CR ½)'],
        8: ['Destroy Undead (CR 1)', 'Divine Strike'],
        10: ['Divine Intervention'],
        14: ['Destroy Undead (CR 3)'],
        17: ['Destroy Undead (CR 4)'],
        20: ['Divine Intervention Improvement'],
      },
      Ranger: {
        1: ['Favored Enemy', 'Natural Explorer'],
        2: ['Fighting Style', 'Spellcasting'],
        3: ['Ranger Archetype', 'Primeval Awareness'],
        5: ['Extra Attack'],
        8: ['Land\'s Stride'],
        10: ['Hide in Plain Sight'],
        14: ['Vanish'],
        18: ['Feral Senses'],
        20: ['Foe Slayer'],
      },
      Paladin: {
        1: ['Divine Sense', 'Lay on Hands'],
        2: ['Fighting Style', 'Spellcasting', 'Divine Smite'],
        3: ['Divine Health', 'Sacred Oath'],
        5: ['Extra Attack'],
        6: ['Aura of Protection'],
        10: ['Aura of Courage'],
        11: ['Improved Divine Smite'],
        14: ['Cleansing Touch'],
        18: ['Aura improvements'],
        20: ['Sacred Oath Capstone'],
      },
      Barbarian: {
        1: ['Rage', 'Unarmored Defense'],
        2: ['Reckless Attack', 'Danger Sense'],
        3: ['Primal Path'],
        5: ['Extra Attack', 'Fast Movement'],
        7: ['Feral Instinct'],
        9: ['Brutal Critical (1 die)'],
        11: ['Relentless Rage'],
        13: ['Brutal Critical (2 dice)'],
        15: ['Persistent Rage'],
        17: ['Brutal Critical (3 dice)'],
        18: ['Indomitable Might'],
        20: ['Primal Champion'],
      },
      Bard: {
        1: ['Spellcasting', 'Bardic Inspiration (d6)'],
        2: ['Jack of All Trades', 'Song of Rest'],
        3: ['Bard College', 'Expertise'],
        5: ['Bardic Inspiration (d8)', 'Font of Inspiration'],
        6: ['Countercharm'],
        10: ['Bardic Inspiration (d10)', 'Magical Secrets'],
        14: ['Magical Secrets'],
        15: ['Bardic Inspiration (d12)'],
        20: ['Superior Inspiration'],
      },
      Druid: {
        1: ['Druidic', 'Spellcasting'],
        2: ['Wild Shape', 'Druid Circle'],
        4: ['Wild Shape improvement (CR ½)'],
        8: ['Wild Shape improvement (CR 1)'],
        18: ['Timeless Body', 'Beast Spells'],
        20: ['Archdruid'],
      },
      Monk: {
        1: ['Unarmored Defense', 'Martial Arts'],
        2: ['Ki', 'Unarmored Movement'],
        3: ['Monastic Tradition', 'Deflect Missiles'],
        4: ['Slow Fall'],
        5: ['Extra Attack', 'Stunning Strike'],
        6: ['Ki-Empowered Strikes'],
        7: ['Evasion', 'Stillness of Mind'],
        10: ['Purity of Body'],
        13: ['Tongue of the Sun and Moon'],
        14: ['Diamond Soul'],
        15: ['Timeless Body'],
        18: ['Empty Body'],
        20: ['Perfect Self'],
      },
      Sorcerer: {
        1: ['Spellcasting', 'Sorcerous Origin'],
        2: ['Font of Magic'],
        3: ['Metamagic (2)'],
        10: ['Metamagic (3)'],
        17: ['Metamagic (4)'],
        20: ['Sorcerous Restoration'],
      },
      Warlock: {
        1: ['Otherworldly Patron', 'Pact Magic'],
        2: ['Eldritch Invocations'],
        3: ['Pact Boon'],
        11: ['Mystic Arcanum (6th)'],
        13: ['Mystic Arcanum (7th)'],
        15: ['Mystic Arcanum (8th)'],
        17: ['Mystic Arcanum (9th)'],
        20: ['Eldritch Master'],
      },
      Artificer: {
        1: ['Magical Tinkering', 'Spellcasting'],
        2: ['Infuse Item'],
        3: ['Artificer Specialist'],
        5: ['Infuse Item (4 items)'],
        6: ['Tool Expertise'],
        7: ['Flash of Genius'],
        9: ['Infuse Item (5 items)'],
        10: ['Magic Item Adept'],
        11: ['Spell-Storing Item'],
        13: ['Infuse Item (6 items)'],
        14: ['Magic Item Savant'],
        17: ['Infuse Item (7 items)'],
        18: ['Magic Item Master'],
        20: ['Soul of Artifice'],
      },
    };
 
    for (let lvl = currentLevel + 1; lvl <= newLevel; lvl++) {
      const classFeatures = CLASS_FEATURES[character.class];
      if (classFeatures && classFeatures[lvl]) {
        newFeatures.push(...classFeatures[lvl]);
      }
    }
 
    // ── Build update payload ─────────────────────────────────────────────────
    const updates = {
      level:             newLevel,
      hp_max:            newMaxHP,
      hp_current:        character.hp_current + hpIncrease,
      proficiency_bonus: newProfBonus,
      initiative:        newInitiative,
    };
 
    if (newAC !== null) updates.armor_class = newAC;
 
    if (Object.keys(newSpellSlots).length > 0) {
      updates.spell_slots = newSpellSlots;
    }
 
    const existingFeatures = character.features || [];
    const mergedFeatures = [...new Set([...existingFeatures, ...newFeatures])];
    if (newFeatures.length > 0) updates.features = mergedFeatures;
 
    await base44.entities.Character.update(character_id, updates);
 
    return Response.json({
      leveled_up:            true,
      old_level:             currentLevel,
      new_level:             newLevel,
      levels_gained:         levelsGained,
      hp_increase:           hpIncrease,
      new_hp_max:            newMaxHP,
      new_proficiency_bonus: newProfBonus,
      new_features:          newFeatures,
      spell_slots_updated:   Object.keys(newSpellSlots).length > 0,
      ac_updated:            newAC !== null,
      message:               `🎉 Level Up! ${character.name} is now level ${newLevel}!`,
    });
 
  } catch (error) {
    console.error('Level up error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});