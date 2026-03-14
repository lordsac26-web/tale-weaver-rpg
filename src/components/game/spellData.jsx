/**
 * D&D 5E Spell Data
 * Comprehensive spell list with mechanics for combat integration
 */
 
export const SPELL_SLOTS_BY_CLASS_LEVEL = {
  // Full casters
  Wizard:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Sorcerer: { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Cleric:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Druid:    { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Bard:     { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  // Half casters
  Paladin:  { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  Ranger:   { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  // Pact magic (Warlock)
  Warlock:  { 1:[1,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[0,2,0,0,0,0,0,0,0], 4:[0,2,0,0,0,0,0,0,0], 5:[0,0,2,0,0,0,0,0,0], 6:[0,0,2,0,0,0,0,0,0], 7:[0,0,0,2,0,0,0,0,0], 8:[0,0,0,2,0,0,0,0,0], 9:[0,0,0,0,2,0,0,0,0], 10:[0,0,0,0,2,0,0,0,0], 11:[0,0,0,0,3,0,0,0,0], 12:[0,0,0,0,3,0,0,0,0], 13:[0,0,0,0,3,0,0,0,0], 14:[0,0,0,0,3,0,0,0,0], 15:[0,0,0,0,3,0,0,0,0], 16:[0,0,0,0,3,0,0,0,0], 17:[0,0,0,0,4,0,0,0,0], 18:[0,0,0,0,4,0,0,0,0], 19:[0,0,0,0,4,0,0,0,0], 20:[0,0,0,0,4,0,0,0,0] },
};
 
export const SPELLCASTING_ABILITY = {
  Wizard: 'intelligence',
  Sorcerer: 'charisma',
  Warlock: 'charisma',
  Bard: 'charisma',
  Cleric: 'wisdom',
  Druid: 'wisdom',
  Paladin: 'charisma',
  Ranger: 'wisdom',
  'Eldritch Knight': 'intelligence',
  'Arcane Trickster': 'intelligence',
};
 
// Cantrips per class
export const CANTRIPS_KNOWN = {
  Wizard: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  Sorcerer: [4,4,4,5,5,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6],
  Warlock: [2,2,2,3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  Bard: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Cleric: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  Druid: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Paladin: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  Ranger: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};
 
export const SPELLS_BY_CLASS = {
  Wizard: {
    cantrips: ['Fire Bolt', 'Ray of Frost', 'Prestidigitation', 'Mage Hand', 'Minor Illusion', 'Shocking Grasp', 'Acid Splash', 'Chill Touch', 'Poison Spray', 'Light'],
    1: ['Magic Missile', 'Burning Hands', 'Thunderwave', 'Sleep', 'Shield', 'Mage Armor', 'Detect Magic', 'Find Familiar', 'Charm Person', 'Grease', 'Identify', 'Comprehend Languages'],
    2: ['Misty Step', 'Shatter', 'Scorching Ray', 'Web', 'Invisibility', 'Mirror Image', 'Hold Person', 'Flaming Sphere', 'Darkness'],
    3: ['Fireball', 'Lightning Bolt', 'Counterspell', 'Fly', 'Haste', 'Slow', 'Hypnotic Pattern', 'Dispel Magic', 'Gaseous Form'],
    4: ['Fire Shield', 'Wall of Fire', 'Arcane Eye', 'Polymorph', 'Banishment', 'Confusion', 'Greater Invisibility'],
    5: ['Cone of Cold', 'Teleportation Circle', 'Wall of Force', 'Dominate Person', 'Bigby\'s Hand', 'Cloudkill'],
  },
  Sorcerer: {
    cantrips: ['Fire Bolt', 'Ray of Frost', 'Shocking Grasp', 'Mage Hand', 'Prestidigitation', 'Chill Touch', 'Minor Illusion', 'Light', 'Acid Splash'],
    1: ['Burning Hands', 'Magic Missile', 'Thunderwave', 'Chromatic Orb', 'Mage Armor', 'Shield', 'Sleep', 'Charm Person'],
    2: ['Scorching Ray', 'Misty Step', 'Shatter', 'Mirror Image', 'Invisibility', 'Blur', 'Hold Person'],
    3: ['Fireball', 'Lightning Bolt', 'Fly', 'Haste', 'Slow', 'Counterspell', 'Hypnotic Pattern'],
    4: ['Fire Shield', 'Polymorph', 'Greater Invisibility', 'Wall of Fire', 'Confusion'],
    5: ['Cone of Cold', 'Dominate Person', 'Hold Monster', 'Cloudkill'],
  },
  Warlock: {
    cantrips: ['Eldritch Blast', 'Chill Touch', 'Minor Illusion', 'Prestidigitation', 'Mage Hand', 'Poison Spray', 'True Strike'],
    1: ['Hex', 'Hellish Rebuke', 'Armor of Agathys', 'Arms of Hadar', 'Charm Person', 'Comprehend Languages', 'Expeditious Retreat'],
    2: ['Shatter', 'Hold Person', 'Misty Step', 'Spider Climb', 'Crown of Madness', 'Darkness', 'Enthrall'],
    3: ['Counterspell', 'Fly', 'Hypnotic Pattern', 'Gaseous Form', 'Hunger of Hadar', 'Vampiric Touch'],
    4: ['Banishment', 'Blight', 'Dimension Door', 'Hallucinatory Terrain'],
    5: ['Contact Other Plane', 'Dream', 'Hold Monster', 'Planar Binding', 'Scrying'],
  },
  Cleric: {
    cantrips: ['Sacred Flame', 'Guidance', 'Spare the Dying', 'Resistance', 'Thaumaturgy', 'Toll the Dead', 'Light', 'Mending'],
    1: ['Cure Wounds', 'Healing Word', 'Bless', 'Guiding Bolt', 'Shield of Faith', 'Inflict Wounds', 'Command', 'Divine Favor', 'Detect Magic'],
    2: ['Spiritual Weapon', 'Hold Person', 'Prayer of Healing', 'Aid', 'Augury', 'Blindness/Deafness', 'Calm Emotions', 'Silence'],
    3: ['Mass Healing Word', 'Spirit Guardians', 'Revivify', 'Dispel Magic', 'Bestow Curse', 'Clairvoyance', 'Daylight', 'Meld into Stone'],
    4: ['Banishment', 'Death Ward', 'Divination', 'Freedom of Movement', 'Guardian of Faith', 'Stone Shape'],
    5: ['Flame Strike', 'Greater Restoration', 'Holy Weapon', 'Mass Cure Wounds', 'Raise Dead', 'Scrying'],
  },
  Druid: {
    cantrips: ['Shillelagh', 'Guidance', 'Thorn Whip', 'Produce Flame', 'Druidcraft', 'Mending', 'Poison Spray', 'Resistance'],
    1: ['Entangle', 'Healing Word', 'Cure Wounds', 'Thunderwave', 'Faerie Fire', 'Detect Magic', 'Speak with Animals', 'Jump', 'Longstrider'],
    2: ['Heat Metal', 'Moonbeam', 'Hold Person', 'Spike Growth', 'Barkskin', 'Flaming Sphere', 'Gust of Wind', 'Pass without Trace'],
    3: ['Erupting Earth', 'Conjure Animals', 'Call Lightning', 'Dispel Magic', 'Meld into Stone', 'Sleet Storm', 'Water Breathing'],
    4: ['Blight', 'Confusion', 'Giant Insect', 'Ice Storm', 'Polymorph', 'Stone Shape', 'Stoneskin'],
    5: ['Antilife Shell', 'Awaken', 'Commune with Nature', 'Conjure Elemental', 'Maelstrom', 'Tree Stride'],
  },
  Bard: {
    cantrips: ['Vicious Mockery', 'Minor Illusion', 'Prestidigitation', 'Mage Hand', 'Light', 'Mending', 'True Strike', 'Dancing Lights'],
    1: ['Healing Word', 'Thunderwave', 'Charm Person', 'Faerie Fire', 'Sleep', 'Dissonant Whispers', 'Heroism', 'Tasha\'s Hideous Laughter'],
    2: ['Heat Metal', 'Hold Person', 'Invisibility', 'Shatter', 'Suggestion', 'Cloud of Daggers', 'Crown of Madness', 'Enhance Ability'],
    3: ['Hypnotic Pattern', 'Fear', 'Major Image', 'Sending', 'Slow', 'Dispel Magic', 'Enemies Abound', 'Mass Healing Word'],
    4: ['Confusion', 'Dimension Door', 'Greater Invisibility', 'Hallucinatory Terrain', 'Polymorph'],
    5: ['Dominate Person', 'Dream', 'Hold Monster', 'Mass Cure Wounds', 'Modify Memory', 'Scrying'],
  },
  Paladin: {
    cantrips: [],
    1: ['Bless', 'Command', 'Cure Wounds', 'Detect Evil and Good', 'Divine Favor', 'Heroism', 'Protection from Evil and Good', 'Shield of Faith', 'Thunderous Smite', 'Wrathful Smite'],
    2: ['Aid', 'Branding Smite', 'Find Steed', 'Lesser Restoration', 'Locate Object', 'Magic Weapon', 'Protection from Poison', 'Zone of Truth'],
    3: ['Aura of Vitality', 'Blinding Smite', 'Create Food and Water', 'Crusader\'s Mantle', 'Daylight', 'Dispel Magic', 'Elemental Weapon', 'Magic Circle', 'Remove Curse', 'Revivify'],
    4: ['Aura of Life', 'Aura of Purity', 'Banishment', 'Death Ward', 'Locate Creature', 'Staggering Smite'],
    5: ['Banishing Smite', 'Circle of Power', 'Destructive Wave', 'Dispel Evil and Good', 'Geas', 'Holy Weapon', 'Raise Dead', 'Summon Celestial'],
  },
  Ranger: {
    cantrips: [],
    1: ['Alarm', 'Animal Friendship', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Fog Cloud', 'Goodberry', 'Hunter\'s Mark', 'Jump', 'Longstrider', 'Speak with Animals'],
    2: ['Animal Messenger', 'Barkskin', 'Darkvision', 'Find Traps', 'Lesser Restoration', 'Locate Animals or Plants', 'Locate Object', 'Pass without Trace', 'Protection from Poison', 'Silence', 'Spike Growth'],
    3: ['Conjure Animals', 'Conjure Barrage', 'Daylight', 'Nondetection', 'Plant Growth', 'Protection from Energy', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
    4: ['Conjure Woodland Beings', 'Freedom of Movement', 'Grasping Vine', 'Locate Creature', 'Stoneskin'],
    5: ['Conjure Volley', 'Greater Restoration', 'Swift Quiver', 'Tree Stride'],
  },
};
 
// Detailed spell mechanics
export const SPELL_DETAILS = {
  // === CANTRIPS ===
  'Fire Bolt': { level: 0, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: 'Instantaneous', description: 'A mote of fire hurls at a creature or object.', attack_type: 'ranged_spell_attack', damage_dice: '1d10', damage_type: 'fire', higher_levels: 'Damage increases at levels 5 (2d10), 11 (3d10), 17 (4d10).' },
  'Ray of Frost': { level: 0, school: 'Evocation', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'A frigid beam of blue-white light streaks toward the target. Hit: target\'s speed is reduced by 10ft until next turn.', attack_type: 'ranged_spell_attack', damage_dice: '1d8', damage_type: 'cold', special_effects: ['speed_reduce_10'] },
  'Eldritch Blast': { level: 0, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: 'Instantaneous', description: 'A beam of crackling energy streaks toward a creature. At 5th level, shoot two beams; three at 11th; four at 17th.', attack_type: 'ranged_spell_attack', damage_dice: '1d10', damage_type: 'force' },
  'Shocking Grasp': { level: 0, school: 'Evocation', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', description: 'Lightning springs from your hand. Hit: target can\'t take reactions until start of its next turn. Advantage if target wearing metal.', attack_type: 'melee_spell_attack', damage_dice: '1d8', damage_type: 'lightning', special_effects: ['no_reactions'] },
  'Sacred Flame': { level: 0, school: 'Evocation', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'Flame-like radiance descends on a creature you can see. Target must succeed on a Dexterity saving throw (no cover) or take damage.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '1d8', damage_type: 'radiant' },
  'Vicious Mockery': { level: 0, school: 'Enchantment', casting_time: '1 action', range: '60 ft', components: 'V', duration: 'Instantaneous', description: 'You unleash a string of insults at a creature. It must succeed on a Wisdom saving throw or take psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '1d4', damage_type: 'psychic', special_effects: ['disadvantage_next_attack'] },
  'Chill Touch': { level: 0, school: 'Necromancy', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: '1 round', description: 'Creates a ghostly hand. Ranged spell attack. On hit: target can\'t regain HP until start of your next turn. Undead also have disadvantage on attacks against you.', attack_type: 'ranged_spell_attack', damage_dice: '1d8', damage_type: 'necrotic', special_effects: ['block_healing'] },
  'Acid Splash': { level: 0, school: 'Conjuration', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'Hurl a bubble of acid at one or two adjacent targets. Each target must succeed on a Dexterity save or take acid damage.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '1d6', damage_type: 'acid' },
  'Poison Spray': { level: 0, school: 'Conjuration', casting_time: '1 action', range: '10 ft', components: 'V, S', duration: 'Instantaneous', description: 'You extend your hand toward a creature you can see and project a puff of noxious gas. The creature must succeed on a Constitution saving throw or take poison damage.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '1d12', damage_type: 'poison' },
  'Thorn Whip': { level: 0, school: 'Transmutation', casting_time: '1 action', range: '30 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'Creates a vine-like whip. Melee spell attack. On hit: if target is Large or smaller, pull it 10 ft toward you.', attack_type: 'melee_spell_attack', damage_dice: '1d6', damage_type: 'piercing', special_effects: ['pull_10'] },
  'Produce Flame': { level: 0, school: 'Conjuration', casting_time: '1 action', range: '30 ft', components: 'V, S', duration: '10 minutes', description: 'A flame appears in your hand. You can hurl the flame as a ranged spell attack.', attack_type: 'ranged_spell_attack', damage_dice: '1d8', damage_type: 'fire' },
  'Shillelagh': { level: 0, school: 'Transmutation', casting_time: '1 bonus action', range: 'Self', components: 'V, S, M', duration: '1 minute', description: 'The wood of a club or quarterstaff you are holding is imbued with nature\'s power. For the duration, you can use your spellcasting ability instead of Strength for attack and damage rolls.', attack_type: 'utility', is_utility: true },
  'Guidance': { level: 0, school: 'Divination', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: '1 minute', description: 'Touch one willing creature. Once before the spell ends, the target can roll a d4 and add the result to one ability check.', attack_type: 'utility', is_utility: true },
  'Minor Illusion': { level: 0, school: 'Illusion', casting_time: '1 action', range: '30 ft', components: 'S, M', duration: '1 minute', description: 'Create a sound or image of an object within range.', attack_type: 'utility', is_utility: true },
  'Mage Hand': { level: 0, school: 'Conjuration', casting_time: '1 action', range: '30 ft', components: 'V, S', duration: '1 minute', description: 'A spectral, floating hand appears at a point you choose within range.', attack_type: 'utility', is_utility: true },
  'Prestidigitation': { level: 0, school: 'Transmutation', casting_time: '1 action', range: '10 ft', components: 'V, S', duration: '1 hour', description: 'Minor tricks and cantrips that create useful (but minor) magical effects.', attack_type: 'utility', is_utility: true },
  'Light': { level: 0, school: 'Evocation', casting_time: '1 action', range: 'Touch', components: 'V, M', duration: '1 hour', description: 'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius.', attack_type: 'utility', is_utility: true },
  'Thaumaturgy': { level: 0, school: 'Transmutation', casting_time: '1 action', range: '30 ft', components: 'V', duration: '1 minute', description: 'You manifest a minor wonder within range, causing omens and signs of divine power.', attack_type: 'utility', is_utility: true },
  'Toll the Dead': { level: 0, school: 'Necromancy', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'A dolorous bell tolls around a creature. It must succeed on a Wisdom save or take necrotic damage (1d8, or 1d12 if missing HP).', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '1d8', damage_type: 'necrotic' },
  'Spare the Dying': { level: 0, school: 'Necromancy', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', description: 'You touch a living creature that has 0 hit points. The creature becomes stable.', attack_type: 'utility', is_utility: true },
  'Resistance': { level: 0, school: 'Abjuration', casting_time: '1 action', range: 'Touch', components: 'V, S, M', duration: '1 minute', description: 'Touch a willing creature. Once before the spell ends, it can roll a d4 and add it to a saving throw.', attack_type: 'utility', is_utility: true },
  'Druidcraft': { level: 0, school: 'Transmutation', casting_time: '1 action', range: '30 ft', components: 'V, S', duration: 'Instantaneous', description: 'Whispering to the spirits of nature, you create minor natural effects.', attack_type: 'utility', is_utility: true },
  'Dancing Lights': { level: 0, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S, M', duration: '1 minute', description: 'You create up to four torch-sized lights within range.', attack_type: 'utility', is_utility: true },
  'Mending': { level: 0, school: 'Transmutation', casting_time: '1 minute', range: 'Touch', components: 'V, S, M', duration: 'Instantaneous', description: 'This spell repairs a single break or tear in an object.', attack_type: 'utility', is_utility: true },
  'True Strike': { level: 0, school: 'Divination', casting_time: '1 action', range: '30 ft', components: 'S', duration: '1 round', description: 'You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target\'s defenses. On your next turn, you gain advantage on your first attack roll against the target.', attack_type: 'utility', is_utility: true },
 
  // === LEVEL 1 ===
  'Magic Missile': { level: 1, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: 'Instantaneous', description: 'Three glowing darts of magical force each deal 1d4+1 force damage to a target. They automatically hit.', attack_type: 'auto_hit', num_missiles: 3, damage_dice: '1d4', damage_bonus: 1, damage_type: 'force', higher_levels: 'Each higher slot level adds one more dart.' },
  'Burning Hands': { level: 1, school: 'Evocation', casting_time: '1 action', range: 'Self (15ft cone)', components: 'V, S', duration: 'Instantaneous', description: 'A thin sheet of flames shoots forth in a 15-foot cone. Each creature in the area must make a Dexterity saving throw.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '3d6', damage_type: 'fire', higher_levels: 'Each higher slot adds 1d6.' },
  'Thunderwave': { level: 1, school: 'Evocation', casting_time: '1 action', range: 'Self (15ft cube)', components: 'V, S', duration: 'Instantaneous', description: 'A wave of thunderous force sweeps out from you in a 15-foot cube. Constitution save or take 2d8 thunder damage and be pushed 10 ft. Even on save, takes half damage.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '2d8', damage_type: 'thunder', higher_levels: 'Each higher slot adds 1d8.' },
  'Sleep': { level: 1, school: 'Enchantment', casting_time: '1 action', range: '90 ft', components: 'V, S, M', duration: '1 minute', description: 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many HP of creatures this spell can affect (lowest HP first).', attack_type: 'saving_throw', save_type: 'none', damage_dice: '0', damage_type: 'none', is_utility: true, special_effects: ['sleep'] },
  'Shield': { level: 1, school: 'Abjuration', casting_time: '1 reaction', range: 'Self', components: 'V, S', duration: '1 round', description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack.', attack_type: 'utility', is_utility: true, is_reaction: true },
  'Mage Armor': { level: 1, school: 'Abjuration', casting_time: '1 action', range: 'Touch', components: 'V, S, M', duration: '8 hours', description: 'You touch a willing creature who isn\'t wearing armor, and a protective magical force surrounds it. The target\'s base AC becomes 13 + its Dexterity modifier.', attack_type: 'utility', is_utility: true },
  'Cure Wounds': { level: 1, school: 'Evocation', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', description: 'A creature you touch regains 1d8 + spellcasting modifier hit points.', attack_type: 'healing', heal_dice: '1d8', heal_type: 'hp', higher_levels: 'Each higher slot adds 1d8.' },
  'Healing Word': { level: 1, school: 'Evocation', casting_time: '1 bonus action', range: '60 ft', components: 'V', duration: 'Instantaneous', description: 'A creature of your choice regains 1d4 + spellcasting modifier HP. Does not require touch, can be used as bonus action.', attack_type: 'healing', heal_dice: '1d4', heal_type: 'hp' },
  'Bless': { level: 1, school: 'Enchantment', casting_time: '1 action', range: '30 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'Up to 3 creatures add 1d4 to attack rolls and saving throws.', attack_type: 'utility', is_utility: true, requires_concentration: true },
  'Guiding Bolt': { level: 1, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: 'Instantaneous / 1 round', description: 'A flash of light streaks toward a creature. Ranged spell attack. Hit: 4d6 radiant damage. The next attack against that creature before end of your next turn has advantage.', attack_type: 'ranged_spell_attack', damage_dice: '4d6', damage_type: 'radiant', special_effects: ['next_attack_advantage'], higher_levels: 'Each higher slot adds 1d6.' },
  'Inflict Wounds': { level: 1, school: 'Necromancy', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', description: 'Make a melee spell attack against a creature you can reach. On hit: 3d10 necrotic damage.', attack_type: 'melee_spell_attack', damage_dice: '3d10', damage_type: 'necrotic', higher_levels: 'Each higher slot adds 1d10.' },
  'Hex': { level: 1, school: 'Enchantment', casting_time: '1 bonus action', range: '90 ft', components: 'V, S, M', duration: '1 hour (concentration)', description: 'Curse a creature. Deal extra 1d6 necrotic damage whenever you hit it with an attack. Also choose an ability score; the target has disadvantage on ability checks with it.', attack_type: 'utility', is_utility: true, requires_concentration: true, special_effects: ['hex_damage'] },
  'Chromatic Orb': { level: 1, school: 'Evocation', casting_time: '1 action', range: '90 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'You hurl a 4-inch diameter sphere of energy at a creature. Choose acid, cold, fire, lightning, poison, or thunder damage. Make a ranged spell attack.', attack_type: 'ranged_spell_attack', damage_dice: '3d8', damage_type: 'variable', higher_levels: 'Each higher slot adds 1d8.' },
  'Command': { level: 1, school: 'Enchantment', casting_time: '1 action', range: '60 ft', components: 'V', duration: '1 round', description: 'Speak a one-word command to a creature. It must succeed on a Wisdom saving throw or follow the command on its next turn. Common commands: Approach, Drop, Flee, Grovel, Halt.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, special_effects: ['command'] },
  'Charm Person': { level: 1, school: 'Enchantment', casting_time: '1 action', range: '30 ft', components: 'V, S', duration: '1 hour', description: 'You attempt to charm a humanoid you can see. It must make a Wisdom saving throw or regard you as a friendly acquaintance.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, special_effects: ['charmed'] },
  'Hunter\'s Mark': { level: 1, school: 'Divination', casting_time: '1 bonus action', range: '90 ft', components: 'V', duration: '1 hour (concentration)', description: 'Mark a creature. Deal 1d6 extra damage whenever you hit it with a weapon attack. Also have advantage on Perception and Survival checks to find it.', attack_type: 'utility', is_utility: true, requires_concentration: true, special_effects: ['hunters_mark'] },
  'Divine Favor': { level: 1, school: 'Evocation', casting_time: '1 bonus action', range: 'Self', components: 'V, S', duration: '1 minute (concentration)', description: 'Your prayer empowers you with divine radiance. Until the spell ends, your weapon attacks deal an extra 1d4 radiant damage on a hit.', attack_type: 'utility', is_utility: true, requires_concentration: true },
  'Hellish Rebuke': { level: 1, school: 'Evocation', casting_time: '1 reaction', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'Reaction when damaged: you point your finger, and the creature that damaged you is momentarily surrounded by hellish flames. Dexterity saving throw or 2d10 fire damage.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '2d10', damage_type: 'fire', is_reaction: true, higher_levels: 'Each higher slot adds 1d10.' },
  'Dissonant Whispers': { level: 1, school: 'Enchantment', casting_time: '1 action', range: '60 ft', components: 'V', duration: 'Instantaneous', description: 'Whisper a discordant melody. One creature must make a Wisdom saving throw or take 3d6 psychic damage and use its reaction to move its full speed away from you.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '3d6', damage_type: 'psychic', higher_levels: 'Each higher slot adds 1d6.' },
 
  // === LEVEL 2 ===
  'Misty Step': { level: 2, school: 'Conjuration', casting_time: '1 bonus action', range: 'Self', components: 'V', duration: 'Instantaneous', description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space you can see.', attack_type: 'utility', is_utility: true },
  'Shatter': { level: 2, school: 'Evocation', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'A sudden loud ringing noise, painfully intense, erupts at a point you choose within range in a 10-foot-radius sphere. Constitution saving throw or 3d8 thunder damage. Disadvantage if made of inorganic material.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '3d8', damage_type: 'thunder', higher_levels: 'Each higher slot adds 1d8.' },
  'Scorching Ray': { level: 2, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: 'Instantaneous', description: 'You create three rays of fire and hurl them at targets within range. Each ray requires a separate ranged spell attack and deals 2d6 fire damage on a hit.', attack_type: 'ranged_spell_attack', num_attacks: 3, damage_dice: '2d6', damage_type: 'fire', higher_levels: 'Each higher slot adds one more ray.' },
  'Hold Person': { level: 2, school: 'Enchantment', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'A humanoid of your choice must succeed on a Wisdom saving throw or be paralyzed for the duration. At end of each of its turns, it can make another save.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, special_effects: ['paralyzed'], requires_concentration: true },
  'Spiritual Weapon': { level: 2, school: 'Evocation', casting_time: '1 bonus action', range: '60 ft', components: 'V, S', duration: '1 minute', description: 'You create a floating, spectral weapon. As a bonus action, move it up to 20 ft and make a melee spell attack. Hit: 1d8 + spellcasting modifier force damage.', attack_type: 'melee_spell_attack', damage_dice: '1d8', damage_type: 'force', is_bonus_action: true },
  'Mirror Image': { level: 2, school: 'Illusion', casting_time: '1 action', range: 'Self', components: 'V, S', duration: '1 minute', description: 'Three illusory duplicates of yourself appear in your space. Each time a creature targets you with an attack, roll a d20 to determine if it hits a duplicate instead.', attack_type: 'utility', is_utility: true },
  'Invisibility': { level: 2, school: 'Illusion', casting_time: '1 action', range: 'Touch', components: 'V, S, M', duration: '1 hour (concentration)', description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person. The spell ends for a target that attacks or casts a spell.', attack_type: 'utility', is_utility: true, requires_concentration: true },
  'Heat Metal': { level: 2, school: 'Transmutation', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'Choose a manufactured metal object. Any creature in physical contact must succeed on a Constitution saving throw or take 2d8 fire damage and drop the object (if possible). Bonus action: repeat each turn.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '2d8', damage_type: 'fire', requires_concentration: true },
  'Moonbeam': { level: 2, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-tall cylinder. Each creature entering the beam must Constitution save or take 2d10 radiant damage.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '2d10', damage_type: 'radiant', requires_concentration: true },
  'Crown of Madness': { level: 2, school: 'Enchantment', casting_time: '1 action', range: '120 ft', components: 'V, S', duration: '1 minute (concentration)', description: 'One humanoid you can see must succeed on a Wisdom saving throw or become charmed. The charmed target must use its action to attack the nearest creature other than you.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['charmed', 'madness'] },
 
  // === LEVEL 3 ===
  'Fireball': { level: 3, school: 'Evocation', casting_time: '1 action', range: '150 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'A bright streak flashes from your pointing finger to a point you choose and then blossoms into a fiery explosion. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. Targets take 8d6 fire damage on a failed save, or half on success.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '8d6', damage_type: 'fire', higher_levels: 'Each higher slot adds 1d6.' },
  'Lightning Bolt': { level: 3, school: 'Evocation', casting_time: '1 action', range: 'Self (100ft line)', components: 'V, S, M', duration: 'Instantaneous', description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you. Each creature in the line must make a Dexterity saving throw. 8d6 lightning damage on fail, half on success.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '8d6', damage_type: 'lightning', higher_levels: 'Each higher slot adds 1d6.' },
  'Counterspell': { level: 3, school: 'Abjuration', casting_time: '1 reaction', range: '60 ft', components: 'S', duration: 'Instantaneous', description: 'React to a creature casting a spell: attempt to interrupt it. If spell is level 3 or lower, it automatically fails. For higher level spells, make an ability check (DC 10 + spell level).', attack_type: 'utility', is_utility: true, is_reaction: true },
  'Fly': { level: 3, school: 'Transmutation', casting_time: '1 action', range: 'Touch', components: 'V, S, M', duration: '10 minutes (concentration)', description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration.', attack_type: 'utility', is_utility: true, requires_concentration: true },
  'Haste': { level: 3, school: 'Transmutation', casting_time: '1 action', range: '30 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'Choose a willing creature. Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action each turn.', attack_type: 'utility', is_utility: true, requires_concentration: true, special_effects: ['hasted'] },
  'Hypnotic Pattern': { level: 3, school: 'Illusion', casting_time: '1 action', range: '120 ft', components: 'S, M', duration: '1 minute (concentration)', description: 'You create a twisting pattern of colors in a 30-foot cube. Each creature that can see the pattern must make a Wisdom saving throw or become charmed (incapacitated, speed 0).', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['charmed', 'incapacitated'] },
  'Spirit Guardians': { level: 3, school: 'Conjuration', casting_time: '1 action', range: 'Self (15ft radius)', components: 'V, S, M', duration: '10 minutes (concentration)', description: 'Call forth spirits to protect you. Each hostile creature that enters or starts its turn in a 15-foot-radius area must make a Wisdom saving throw or take 3d8 radiant (or necrotic) damage.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '3d8', damage_type: 'radiant', requires_concentration: true, higher_levels: 'Each higher slot adds 1d8.' },
  'Vampiric Touch': { level: 3, school: 'Necromancy', casting_time: '1 action', range: 'Self', components: 'V, S', duration: '1 minute (concentration)', description: 'The touch of your shadow-wreathed hand can siphon life force. Make a melee spell attack. On a hit, the target takes 3d6 necrotic damage and you regain HP equal to half the damage dealt.', attack_type: 'melee_spell_attack', damage_dice: '3d6', damage_type: 'necrotic', requires_concentration: true, special_effects: ['lifesteal'] },
 
  // === LEVEL 4 ===
  'Polymorph': { level: 4, school: 'Transmutation', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: '1 hour (concentration)', description: 'Transform a creature into a beast. Target must make a Wisdom saving throw or be transformed. New form has own HP; when reduced to 0, creature reverts to original form.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['polymorphed'] },
  'Banishment': { level: 4, school: 'Abjuration', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'You attempt to send one creature to another plane. It must make a Charisma saving throw or be banished. Extraplanar creatures are banished permanently if held for the full minute.', attack_type: 'saving_throw', save_type: 'charisma', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['banished'] },
  'Greater Invisibility': { level: 4, school: 'Illusion', casting_time: '1 action', range: 'Touch', components: 'V, S', duration: '1 minute (concentration)', description: 'You or a creature you touch becomes invisible until the spell ends. Unlike normal invisibility, this spell does NOT end when the target attacks or casts a spell.', attack_type: 'utility', is_utility: true, requires_concentration: true, special_effects: ['invisible'] },
  'Blight': { level: 4, school: 'Necromancy', casting_time: '1 action', range: '30 ft', components: 'V, S', duration: 'Instantaneous', description: 'Necromantic energy washes over a creature. It must make a Constitution saving throw or take 8d8 necrotic damage (half on success). Plants are particularly vulnerable.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '8d8', damage_type: 'necrotic', higher_levels: 'Each higher slot adds 1d8.' },
  'Wall of Fire': { level: 4, school: 'Evocation', casting_time: '1 action', range: '120 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'You create a wall of fire on a solid surface within range. The wall deals 5d8 fire damage to any creature that enters it or starts its turn within 10 ft of it (on one side).', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '5d8', damage_type: 'fire', requires_concentration: true },
  'Ice Storm': { level: 4, school: 'Evocation', casting_time: '1 action', range: '300 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'A hail of rock-hard ice pounds down in a 20-foot-radius, 40-foot-high cylinder. Creatures in the area must make a Dexterity saving throw: 2d8 bludgeoning + 4d6 cold damage, or half on success. Ground becomes difficult terrain.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '4d6', damage_type: 'cold', higher_levels: 'Each higher slot adds 1d8 bludgeoning.' },
 
  // === LEVEL 5 ===
  'Cone of Cold': { level: 5, school: 'Evocation', casting_time: '1 action', range: 'Self (60ft cone)', components: 'V, S, M', duration: 'Instantaneous', description: 'A blast of cold air erupts from your hands in a 60-foot cone. Each creature must make a Constitution saving throw, taking 8d8 cold damage on a fail or half on success. Creatures killed become frozen statues.', attack_type: 'saving_throw', save_type: 'constitution', damage_dice: '8d8', damage_type: 'cold', higher_levels: 'Each higher slot adds 1d8.' },
  'Dominate Person': { level: 5, school: 'Enchantment', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: '1 minute (concentration)', description: 'You attempt to beguile a humanoid. It must make a Wisdom saving throw or be charmed by you for the duration. While charmed, you have telepathic link and can command it each turn.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['dominated'] },
  'Hold Monster': { level: 5, school: 'Enchantment', casting_time: '1 action', range: '90 ft', components: 'V, S, M', duration: '1 minute (concentration)', description: 'Choose a creature you can see. It must make a Wisdom saving throw or be paralyzed for the duration. At end of each of its turns, it can make another save.', attack_type: 'saving_throw', save_type: 'wisdom', damage_dice: '0', damage_type: 'none', is_utility: true, requires_concentration: true, special_effects: ['paralyzed'] },
  'Flame Strike': { level: 5, school: 'Evocation', casting_time: '1 action', range: '60 ft', components: 'V, S, M', duration: 'Instantaneous', description: 'A vertical column of divine fire roars down from the heavens. Each creature in a 10-foot-radius, 40-foot-high cylinder must make a Dexterity saving throw, taking 4d6 fire + 4d6 radiant damage on failure, half on success.', attack_type: 'saving_throw', save_type: 'dexterity', damage_dice: '4d6', damage_type: 'fire', higher_levels: 'Each higher slot adds 1d6 fire and 1d6 radiant.' },
  'Mass Cure Wounds': { level: 5, school: 'Evocation', casting_time: '1 action', range: '60 ft', components: 'V, S', duration: 'Instantaneous', description: 'A wave of healing energy washes out from a point you choose within range. Choose up to 6 creatures; each regains 3d8 + spellcasting modifier HP.', attack_type: 'healing', heal_dice: '3d8', heal_type: 'hp', higher_levels: 'Each higher slot adds 1d8.' },
  'Greater Restoration': { level: 5, school: 'Abjuration', casting_time: '1 action', range: 'Touch', components: 'V, S, M', duration: 'Instantaneous', description: 'You imbue a creature with positive energy to undo a debilitating effect. Remove a charm, petrification, curse, ability score reduction, or HP maximum reduction.', attack_type: 'utility', is_utility: true },
};
 
export function getSpellsForClass(className, level = 1) {
  const spellList = SPELLS_BY_CLASS[className] || {};
  const result = { cantrips: spellList.cantrips || [] };
  for (let l = 1; l <= Math.ceil(level / 2); l++) {
    if (spellList[l]) result[l] = spellList[l];
  }
  return result;
}
 
export function getMaxSpellLevel(className, level) {
  const slots = SPELL_SLOTS_BY_CLASS_LEVEL[className]?.[level];
  if (!slots) return 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1;
  }
  return 0;
}
 
import { PROFICIENCY_BY_LEVEL, calcStatMod } from './gameData';
 
export function getSpellSlotsForLevel(className, level) {
  return SPELL_SLOTS_BY_CLASS_LEVEL[className]?.[level] || [0,0,0,0,0,0,0,0,0];
}
 
export function getSpellcastingAbility(className, subclass = '') {
  return SPELLCASTING_ABILITY[className] || SPELLCASTING_ABILITY[subclass] || null;
}
 
export function calcSpellSaveDC(character) {
  const ability = getSpellcastingAbility(character.class, character.subclass);
  if (!ability) return null;
  const abilityMod = calcStatMod(character[ability] || 10);
  // Use the shared authoritative proficiency table, not a manual formula
  const profBonus  = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  return 8 + abilityMod + profBonus;
}
 
export function calcSpellAttackBonus(character) {
  const ability = getSpellcastingAbility(character.class, character.subclass);
  if (!ability) return null;
  const abilityMod = calcStatMod(character[ability] || 10);
  const profBonus  = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  return abilityMod + profBonus;
}
 
// ── Cantrip damage scaling per 5e rules ────────────────────────────────────
// Cantrips scale at character levels 5, 11, and 17 (not class level).
const CANTRIP_SCALE_DICE = {
  'Fire Bolt':       ['1d10','2d10','3d10','4d10'],
  'Ray of Frost':    ['1d8', '2d8', '3d8', '4d8'],
  'Eldritch Blast':  ['1d10','1d10','1d10','1d10'], // damage per beam; beams = 1/2/3/4
  'Shocking Grasp':  ['1d8', '2d8', '3d8', '4d8'],
  'Sacred Flame':    ['1d8', '2d8', '3d8', '4d8'],
  'Vicious Mockery': ['1d4', '2d4', '3d4', '4d4'],
  'Chill Touch':     ['1d8', '2d8', '3d8', '4d8'],
  'Acid Splash':     ['1d6', '2d6', '3d6', '4d6'],
  'Poison Spray':    ['1d12','2d12','3d12','4d12'],
  'True Strike':     ['0',   '0',   '0',   '0'],
  'Mage Hand':       ['0',   '0',   '0',   '0'],
  'Prestidigitation':['0',   '0',   '0',   '0'],
  'Minor Illusion':  ['0',   '0',   '0',   '0'],
  'Light':           ['0',   '0',   '0',   '0'],
  'Thorn Whip':      ['1d6', '2d6', '3d6', '4d6'],
  'Produce Flame':   ['1d8', '2d8', '3d8', '4d8'],
  'Shillelagh':      ['1d8', '1d8', '1d8', '1d8'], // stays same; uses WIS
  'Guidance':        ['0',   '0',   '0',   '0'],
  'Druidcraft':      ['0',   '0',   '0',   '0'],
  'Mending':         ['0',   '0',   '0',   '0'],
  'Resistance':      ['0',   '0',   '0',   '0'],
};
 
// Returns the correct damage dice string for a cantrip at a given character level
export function getCantripDamageDice(spellName, characterLevel) {
  const table = CANTRIP_SCALE_DICE[spellName];
  if (!table) return SPELL_DETAILS[spellName]?.damage_dice || '1d6';
  const tier = characterLevel >= 17 ? 3 : characterLevel >= 11 ? 2 : characterLevel >= 5 ? 1 : 0;
  return table[tier];
}
 
// Returns the number of Eldritch Blast beams at a given character level
export function getEldritchBlastBeams(characterLevel) {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5)  return 2;
  return 1;
}
 
export const SCHOOL_COLORS = {
  Evocation: 'text-orange-400',
  Abjuration: 'text-blue-400',
  Conjuration: 'text-yellow-400',
  Enchantment: 'text-pink-400',
  Illusion: 'text-purple-400',
  Necromancy: 'text-green-400',
  Transmutation: 'text-teal-400',
  Divination: 'text-cyan-400',
};
 
export const DAMAGE_TYPE_COLORS = {
  fire: 'text-orange-400',
  cold: 'text-blue-300',
  lightning: 'text-yellow-300',
  thunder: 'text-indigo-300',
  acid: 'text-lime-400',
  poison: 'text-green-500',
  necrotic: 'text-purple-400',
  radiant: 'text-yellow-100',
  force: 'text-violet-300',
  psychic: 'text-pink-300',
  piercing: 'text-slate-300',
  slashing: 'text-red-400',
  bludgeoning: 'text-orange-300',
  variable: 'text-amber-300',
};