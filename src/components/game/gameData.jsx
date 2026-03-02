// D&D 5E Core Data

export const RACES = {
  Human: { traits: ['Extra Skill Proficiency', 'Extra Feat'], stat_bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 }, speed: 30, description: 'Versatile and ambitious, humans excel at everything.' },
  Elf: { traits: ['Darkvision', 'Fey Ancestry', 'Trance', 'Keen Senses'], stat_bonuses: { dexterity: 2, wisdom: 1 }, speed: 30, description: 'Ancient and graceful, elves are deeply connected to magic and nature.' },
  Dwarf: { traits: ['Darkvision', 'Stonecunning', 'Dwarven Resilience', 'Tool Proficiency'], stat_bonuses: { constitution: 2, wisdom: 1 }, speed: 25, description: 'Stout and hardy, dwarves are master craftsmen and fierce warriors.' },
  Halfling: { traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Naturally Stealthy'], stat_bonuses: { dexterity: 2, charisma: 1 }, speed: 25, description: 'Small but resourceful, halflings have remarkable luck.' },
  Gnome: { traits: ['Darkvision', 'Gnome Cunning', 'Tinker'], stat_bonuses: { intelligence: 2, dexterity: 1 }, speed: 25, description: 'Clever inventors and tricksters with a zest for life.' },
  'Half-Elf': { traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility'], stat_bonuses: { charisma: 2, dexterity: 1, wisdom: 1 }, speed: 30, description: 'Bridging two worlds, half-elves have unmatched charm.' },
  'Half-Orc': { traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'], stat_bonuses: { strength: 2, constitution: 1 }, speed: 30, description: 'Fierce and powerful, half-orcs refuse to fall.' },
  Tiefling: { traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'], stat_bonuses: { intelligence: 1, charisma: 2 }, speed: 30, description: 'Touched by infernal magic, tieflings wield dark power.' },
  Dragonborn: { traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'], stat_bonuses: { strength: 2, charisma: 1 }, speed: 30, description: 'Born of dragons, dragonborn command respect and awe.' }
};

export const CLASSES = {
  Fighter: {
    hit_die: 10, primary_stat: 'strength', saves: ['strength', 'constitution'],
    skills: ['Athletics', 'Acrobatics', 'Animal Handling', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    skill_count: 2,
    subclasses: ['Champion', 'Battle Master', 'Eldritch Knight', 'Cavalier', 'Samurai'],
    description: 'Master of martial combat, skilled with a variety of weapons and armor.',
    features: { 1: ['Fighting Style', 'Second Wind'], 2: ['Action Surge'], 5: ['Extra Attack'] }
  },
  Rogue: {
    hit_die: 8, primary_stat: 'dexterity', saves: ['dexterity', 'intelligence'],
    skills: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
    skill_count: 4,
    subclasses: ['Thief', 'Arcane Trickster', 'Assassin', 'Swashbuckler', 'Inquisitive'],
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles.',
    features: { 1: ['Expertise', 'Sneak Attack', "Thieves' Cant"], 2: ['Cunning Action'], 5: ['Uncanny Dodge'] }
  },
  Wizard: {
    hit_die: 6, primary_stat: 'intelligence', saves: ['intelligence', 'wisdom'],
    skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    skill_count: 2,
    subclasses: ['School of Evocation', 'School of Abjuration', 'School of Illusion', 'School of Necromancy', 'School of Divination'],
    description: 'A scholarly magic-user capable of manipulating the fabric of reality.',
    features: { 1: ['Spellcasting', 'Arcane Recovery'], 2: ['Arcane Tradition'] }
  },
  Cleric: {
    hit_die: 8, primary_stat: 'wisdom', saves: ['wisdom', 'charisma'],
    skills: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: ['Life Domain', 'Light Domain', 'War Domain', 'Trickery Domain', 'Nature Domain'],
    description: 'A priestly champion who wields divine magic in service of a higher power.',
    features: { 1: ['Spellcasting', 'Divine Domain', 'Turn Undead'] }
  },
  Ranger: {
    hit_die: 10, primary_stat: 'dexterity', saves: ['strength', 'dexterity'],
    skills: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
    skill_count: 3,
    subclasses: ['Hunter', 'Beast Master', 'Gloom Stalker', 'Horizon Walker'],
    description: 'A warrior of the wilderness who hunts the monsters that threaten civilization.',
    features: { 1: ['Favored Enemy', 'Natural Explorer'], 2: ['Fighting Style', 'Spellcasting'] }
  },
  Paladin: {
    hit_die: 10, primary_stat: 'charisma', saves: ['wisdom', 'charisma'],
    skills: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: ['Oath of Devotion', 'Oath of the Ancients', 'Oath of Vengeance', 'Oath of Conquest'],
    description: 'A holy warrior bound to a sacred oath, wielding divine power.',
    features: { 1: ['Divine Sense', 'Lay on Hands'], 2: ['Fighting Style', 'Spellcasting', 'Divine Smite'] }
  },
  Barbarian: {
    hit_die: 12, primary_stat: 'strength', saves: ['strength', 'constitution'],
    skills: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    skill_count: 2,
    subclasses: ['Path of the Berserker', 'Path of the Totem Warrior', 'Path of the Storm Herald'],
    description: 'A fierce warrior of primitive background who can enter a battle rage.',
    features: { 1: ['Rage', 'Unarmored Defense'], 2: ['Reckless Attack', 'Danger Sense'] }
  },
  Bard: {
    hit_die: 8, primary_stat: 'charisma', saves: ['dexterity', 'charisma'],
    skills: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'],
    skill_count: 3,
    subclasses: ['College of Lore', 'College of Valor', 'College of Glamour', 'College of Swords'],
    description: 'An inspiring magician whose power echoes the music of creation.',
    features: { 1: ['Spellcasting', 'Bardic Inspiration'], 2: ['Jack of All Trades', 'Song of Rest'] }
  },
  Druid: {
    hit_die: 8, primary_stat: 'wisdom', saves: ['intelligence', 'wisdom'],
    skills: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
    skill_count: 2,
    subclasses: ['Circle of the Land', 'Circle of the Moon', 'Circle of Spores'],
    description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    features: { 1: ['Druidic', 'Spellcasting'], 2: ['Wild Shape'] }
  },
  Monk: {
    hit_die: 8, primary_stat: 'dexterity', saves: ['strength', 'dexterity'],
    skills: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
    skill_count: 2,
    subclasses: ['Way of the Open Hand', 'Way of Shadow', 'Way of the Four Elements', 'Way of the Kensei'],
    description: 'A master of martial arts who channels ki to perform incredible feats.',
    features: { 1: ['Unarmored Defense', 'Martial Arts'], 2: ['Ki', 'Unarmored Movement'] }
  },
  Sorcerer: {
    hit_die: 6, primary_stat: 'charisma', saves: ['constitution', 'charisma'],
    skills: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: ['Draconic Bloodline', 'Wild Magic', 'Divine Soul', 'Storm Sorcery'],
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
    features: { 1: ['Spellcasting', 'Sorcerous Origin'], 2: ['Font of Magic'] }
  },
  Warlock: {
    hit_die: 8, primary_stat: 'charisma', saves: ['wisdom', 'charisma'],
    skills: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
    skill_count: 2,
    subclasses: ['The Archfey', 'The Fiend', 'The Great Old One', 'The Undead'],
    description: 'A wielder of magic derived from a bargain with an extraplanar entity.',
    features: { 1: ['Otherworldly Patron', 'Pact Magic'], 2: ['Eldritch Invocations'] }
  }
};

export const BACKGROUNDS = [
  { name: 'Acolyte', skills: ['Insight', 'Religion'], feature: 'Shelter of the Faithful', equipment: ['Holy symbol', 'Prayer book', '15 gp'] },
  { name: 'Criminal', skills: ['Deception', 'Stealth'], feature: 'Criminal Contact', equipment: ["Crowbar", "Dark clothes", '15 gp'] },
  { name: 'Folk Hero', skills: ['Animal Handling', 'Survival'], feature: 'Rustic Hospitality', equipment: ['Craftsman tools', 'Shovel', '10 gp'] },
  { name: 'Noble', skills: ['History', 'Persuasion'], feature: 'Position of Privilege', equipment: ['Fine clothes', 'Signet ring', '25 gp'] },
  { name: 'Outlander', skills: ['Athletics', 'Survival'], feature: 'Wanderer', equipment: ['Staff', 'Hunting trap', '10 gp'] },
  { name: 'Sage', skills: ['Arcana', 'History'], feature: 'Researcher', equipment: ['Ink & quill', 'Small knife', '10 gp'] },
  { name: 'Soldier', skills: ['Athletics', 'Intimidation'], feature: 'Military Rank', equipment: ['Insignia of rank', 'Trophy', '10 gp'] },
  { name: 'Charlatan', skills: ['Deception', 'Sleight of Hand'], feature: 'False Identity', equipment: ['Fine clothes', 'Disguise kit', '15 gp'] },
  { name: 'Hermit', skills: ['Medicine', 'Religion'], feature: 'Discovery', equipment: ['Scroll case', 'Herbalism kit', '5 gp'] },
  { name: 'Sailor', skills: ['Athletics', 'Perception'], feature: "Ship's Passage", equipment: ['Belaying pin', 'Rope 50ft', '10 gp'] }
];

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const PROFICIENCY_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

export const calcStatMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
export const calcModDisplay = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
export const calcHP = (charClass, level, conMod) => {
  const hd = CLASSES[charClass]?.hit_die || 8;
  return hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
};
export const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
export const roll4d6DropLowest = () => {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)];
  return [...rolls].sort((a, b) => a - b).slice(1).reduce((a, b) => a + b, 0);
};

export const CONDITIONS = {
  blinded: { icon: '👁️', color: 'text-gray-400', description: 'Cannot see, auto-fail sight checks' },
  charmed: { icon: '💕', color: 'text-pink-400', description: 'Cannot attack charmer' },
  frightened: { icon: '😱', color: 'text-yellow-400', description: 'Disadvantage on checks/attacks near source' },
  paralyzed: { icon: '⚡', color: 'text-yellow-500', description: 'Incapacitated, auto-fail Str/Dex saves' },
  poisoned: { icon: '☠️', color: 'text-green-400', description: 'Disadvantage on attack rolls and ability checks' },
  prone: { icon: '🛌', color: 'text-orange-300', description: 'Must crawl, melee attacks have advantage' },
  stunned: { icon: '💥', color: 'text-yellow-400', description: 'Incapacitated, auto-fail Str/Dex saves' },
  unconscious: { icon: '💤', color: 'text-gray-400', description: 'Incapacitated, prone' },
  exhausted: { icon: '😓', color: 'text-red-400', description: 'Cumulative penalties' },
  bleeding: { icon: '🩸', color: 'text-red-500', description: '1d4 damage per turn until stabilized' },
  invisible: { icon: '👻', color: 'text-blue-300', description: 'Attacks against have disadvantage' },
  restrained: { icon: '⛓️', color: 'text-orange-400', description: 'Speed 0, Dex saves have disadvantage' }
};

export const SKILL_STAT_MAP = {
  Athletics: 'strength',
  Acrobatics: 'dexterity', 'Sleight of Hand': 'dexterity', Stealth: 'dexterity',
  Arcana: 'intelligence', History: 'intelligence', Investigation: 'intelligence', Nature: 'intelligence', Religion: 'intelligence',
  'Animal Handling': 'wisdom', Insight: 'wisdom', Medicine: 'wisdom', Perception: 'wisdom', Survival: 'wisdom',
  Deception: 'charisma', Intimidation: 'charisma', Performance: 'charisma', Persuasion: 'charisma'
};

export const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];