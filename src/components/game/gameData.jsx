// D&D 5E Core Data — Expanded with Subclasses, Multiclassing, Subraces, Skills

export const RACES = {
  Human: {
    traits: ['Extra Skill Proficiency', 'Extra Feat', 'Versatile'],
    stat_bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'one extra language'],
    description: 'Versatile and ambitious, humans excel at everything. Their extra feat and skill make them exceptional generalists.',
    subraces: [],
  },
  Elf: {
    traits: ['Darkvision (60 ft)', 'Fey Ancestry', 'Trance', 'Keen Senses (Perception proficiency)', 'Trance (4hr rest)'],
    stat_bonuses: { dexterity: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Elvish'],
    description: 'Ancient and graceful, elves are deeply connected to magic and nature. They resist being charmed and never sleep.',
    subraces: [
      { name: 'High Elf', stat_bonuses: { intelligence: 1 }, traits: ['Cantrip (Wizard list)', 'Extra Language', 'Longsword/Shortsword/Shortbow/Longbow proficiency'] },
      { name: 'Wood Elf', stat_bonuses: { wisdom: 1 }, traits: ['Fleet of Foot (35 ft speed)', 'Mask of the Wild', 'Longsword/Shortsword/Shortbow/Longbow proficiency'], speed: 35 },
      { name: 'Drow (Dark Elf)', stat_bonuses: { charisma: 1 }, traits: ['Superior Darkvision (120 ft)', 'Sunlight Sensitivity', 'Drow Magic (Dancing Lights, Faerie Fire, Darkness)', 'Rapier/Shortsword/Hand Crossbow proficiency'] },
    ],
  },
  Dwarf: {
    traits: ['Darkvision (60 ft)', 'Stonecunning', 'Dwarven Resilience (poison resistance + advantage)', 'Tool Proficiency', 'Combat Training (battleaxe, handaxe, throwing hammer, warhammer)'],
    stat_bonuses: { constitution: 2 },
    speed: 25, size: 'Medium',
    languages: ['Common', 'Dwarvish'],
    description: 'Stout and hardy, dwarves are master craftsmen and fierce warriors. Speed is never reduced by heavy armor.',
    subraces: [
      { name: 'Hill Dwarf', stat_bonuses: { wisdom: 1 }, traits: ['Dwarven Toughness (+1 HP per level)'] },
      { name: 'Mountain Dwarf', stat_bonuses: { strength: 2 }, traits: ['Dwarven Armor Training (light + medium armor)'] },
    ],
  },
  Halfling: {
    traits: ['Lucky (reroll 1s on attack/ability/save)', 'Brave (advantage vs frightened)', 'Halfling Nimbleness (move through larger creature spaces)', 'Naturally Stealthy'],
    stat_bonuses: { dexterity: 2 },
    speed: 25, size: 'Small',
    languages: ['Common', 'Halfling'],
    description: 'Small but resourceful, halflings have remarkable luck and brave hearts that belie their small stature.',
    subraces: [
      { name: 'Lightfoot', stat_bonuses: { charisma: 1 }, traits: ['Naturally Stealthy (hide behind larger creatures)'] },
      { name: 'Stout', stat_bonuses: { constitution: 1 }, traits: ['Stout Resilience (poison resistance + advantage)'] },
    ],
  },
  Gnome: {
    traits: ['Darkvision (60 ft)', 'Gnome Cunning (advantage on INT/WIS/CHA saves vs magic)', 'Tinker (construct tiny clockwork devices)'],
    stat_bonuses: { intelligence: 2 },
    speed: 25, size: 'Small',
    languages: ['Common', 'Gnomish'],
    description: 'Clever inventors and tricksters with a zest for life. Their natural cunning wards them against magical influence.',
    subraces: [
      { name: 'Forest Gnome', stat_bonuses: { dexterity: 1 }, traits: ['Natural Illusionist (Minor Illusion cantrip)', 'Speak with Small Beasts'] },
      { name: 'Rock Gnome', stat_bonuses: { constitution: 1 }, traits: ['Artificer\'s Lore (+2× proficiency on Arcana with magic/alchemical items)', 'Tinker'] },
    ],
  },
  'Half-Elf': {
    traits: ['Darkvision (60 ft)', 'Fey Ancestry', 'Skill Versatility (proficiency in 2 skills)', 'Two extra language choices'],
    stat_bonuses: { charisma: 2 },
    stat_choices: 2, // pick 2 stats to get +1
    speed: 30, size: 'Medium',
    languages: ['Common', 'Elvish', 'one extra'],
    description: 'Bridging two worlds, half-elves combine elven grace with human versatility. Their social nature opens doors.',
    subraces: [],
  },
  'Half-Orc': {
    traits: ['Darkvision (60 ft)', 'Menacing (Intimidation proficiency)', 'Relentless Endurance (drop to 1 HP instead of 0, 1/long rest)', 'Savage Attacks (extra die on melee crit)'],
    stat_bonuses: { strength: 2, constitution: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Orc'],
    description: 'Fierce and powerful, half-orcs refuse to fall. Their orcish blood makes them terrifying warriors who thrive in battle.',
    subraces: [],
  },
  Tiefling: {
    traits: ['Darkvision (60 ft)', 'Hellish Resistance (fire resistance)', 'Infernal Legacy (Thaumaturgy cantrip; Hellish Rebuke at 3rd; Darkness at 5th)'],
    stat_bonuses: { intelligence: 1, charisma: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Infernal'],
    description: 'Touched by infernal magic, tieflings wield dark power. Though distrusted, their strength and magic are undeniable.',
    subraces: [],
  },
  Dragonborn: {
    traits: ['Draconic Ancestry (choose dragon type)', 'Breath Weapon (2× proficiency bonus, uses Constitution save)', 'Damage Resistance (matching ancestry type)'],
    stat_bonuses: { strength: 2, charisma: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Draconic'],
    description: 'Born of dragons, dragonborn command respect and awe. Each bears the legacy of a specific draconic ancestor.',
    subraces: [],
    draconic_ancestry_options: ['Black (acid)', 'Blue (lightning)', 'Brass (fire)', 'Bronze (lightning)', 'Copper (acid)', 'Gold (fire)', 'Green (poison)', 'Red (fire)', 'Silver (cold)', 'White (cold)'],
  },
  Aasimar: {
    traits: ['Darkvision (60 ft)', 'Celestial Resistance (resistance to necrotic and radiant damage)', 'Healing Hands (heal HP = level, 1/long rest)', 'Light Bearer (Light cantrip)'],
    stat_bonuses: { wisdom: 1, charisma: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Celestial'],
    description: 'Touched by divine power, aasimar carry a spark of the Upper Planes. They are blessed by celestial beings to protect the mortal world.',
    subraces: [
      { name: 'Protector Aasimar', stat_bonuses: { wisdom: 1, charisma: 2 }, traits: ['Radiant Soul (grow wings, fly speed = walking, +radiant damage on attacks, 1 min/long rest)'] },
      { name: 'Scourge Aasimar', stat_bonuses: { constitution: 1, charisma: 2 }, traits: ['Radiant Consumption (emit radiant light, deal radiant damage to nearby creatures + self, 1 min/long rest)'] },
      { name: 'Fallen Aasimar', stat_bonuses: { strength: 1, charisma: 2 }, traits: ['Necrotic Shroud (frighten nearby creatures, +necrotic damage on attacks, 1 min/long rest)'] },
    ],
  },
  Genasi: {
    traits: ['Constitution +2', 'Darkvision (60 ft)', 'Subrace determines element and additional traits'],
    stat_bonuses: { constitution: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Primordial'],
    description: 'Born of the elemental planes, genasi carry the power of wind, earth, fire, or water in their blood. Choose a subrace to determine your element.',
    subraces: [
      { name: 'Air Genasi', stat_bonuses: { dexterity: 1 }, traits: ['Unending Breath (hold breath indefinitely)', 'Mingle with the Wind (Levitate 1/long rest)'], languages: ['Common', 'Primordial'] },
      { name: 'Earth Genasi', stat_bonuses: { strength: 1 }, traits: ['Earth Walk (move across difficult stone terrain without penalty)', 'Merge with Stone (Pass Without Trace 1/long rest)'] },
      { name: 'Fire Genasi', stat_bonuses: { intelligence: 1 }, traits: ['Darkvision (60 ft)', 'Fire Resistance', 'Reach to the Blaze (Produce Flame cantrip; Burning Hands 1/long rest)'] },
      { name: 'Water Genasi', stat_bonuses: { wisdom: 1 }, traits: ['Amphibious (breathe air and water)', 'Swim speed 30 ft', 'Call to the Wave (Shape Water cantrip; Create/Destroy Water 1/long rest)'] },
    ],
  },
  Goliath: {
    traits: ['Natural Athlete (Athletics proficiency)', 'Stone\'s Endurance (reduce damage by 1d12+CON as reaction, 1/short rest)', 'Powerful Build (count as Large for carry/push/lift)', 'Mountain Born (resist cold, acclimated to high altitude)'],
    stat_bonuses: { strength: 2, constitution: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Giant'],
    description: 'Towering mountain-dwellers who push themselves to greatness. Goliaths are fiercely competitive and driven by an unrelenting desire to prove themselves.',
    subraces: [],
  },
  Firbolg: {
    traits: ['Firbolg Magic (Detect Magic + Disguise Self 1/short rest, can appear shorter)', 'Hidden Step (become invisible as bonus action until end of turn/next attack, 1/short rest)', 'Powerful Build (count as Large for carry/push/lift)', 'Speech of Beast and Leaf (communicate simple ideas with beasts/plants)'],
    stat_bonuses: { wisdom: 2, strength: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Elvish', 'Giant'],
    description: 'Gentle giant-kin who live in seclusion, deeply connected to the natural world. Firbolgs prefer peace but are fierce protectors of their forest homes.',
    subraces: [],
  },
  Tabaxi: {
    traits: ['Darkvision (60 ft)', 'Feline Agility (double speed until you move 0 ft, then recharge)', 'Cat\'s Claws (climb speed 20 ft, 1d4 slashing unarmed)', 'Cat\'s Talent (proficiency in Perception and Stealth)'],
    stat_bonuses: { dexterity: 2, charisma: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'one extra'],
    description: 'Curious cat-folk from a distant land, Tabaxi are driven by an insatiable hunger for stories, secrets, and shiny trinkets. They travel the world collecting experiences.',
    subraces: [],
  },
  Kenku: {
    traits: ['Expert Forgery (copy handwriting/craftwork with advantage)', 'Mimicry (mimic sounds/voices heard, WIS insight contest to detect)', 'Kenku Training (proficiency in 2 of: Acrobatics, Deception, Stealth, Sleight of Hand)'],
    stat_bonuses: { dexterity: 2, wisdom: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Auran'],
    description: 'Flightless avian humanoids who communicate through mimicry of sounds and voices. Once cursed by their master, Kenku now wander the world in search of their lost voices.',
    subraces: [],
  },
  Triton: {
    traits: ['Amphibious (breathe air and water)', 'Control Air and Water (Fog Cloud + Gust of Wind + Wall of Water, 1/long rest each)', 'Darkvision (60 ft)', 'Emissary of the Sea (communicate with beasts that breathe water)', 'Guardians of the Depths (resistance to cold, ignore underwater difficult terrain)'],
    stat_bonuses: { strength: 1, constitution: 1, charisma: 1 },
    speed: 30, size: 'Medium',
    swim_speed: 30,
    languages: ['Common', 'Primordial'],
    description: 'Sea-folk who have long patrolled the ocean depths, guarding against abyssal threats. Triton are proud and noble, sometimes struggling to understand surface-dwellers.',
    subraces: [],
  },
  Lizardfolk: {
    traits: ['Bite (1d6 piercing unarmed attack)', 'Cunning Artisan (craft simple items from slain creatures using bonus action)', 'Hold Breath (15 minutes)', 'Hunter\'s Lore (2 proficiencies from: Animal Handling, Nature, Perception, Stealth, Survival)', 'Natural Armor (AC 13+DEX unarmored)', 'Hungry Jaws (bonus action bite as bonus action after biting; gain temp HP = CON mod, 1/short rest)'],
    stat_bonuses: { constitution: 2, wisdom: 1 },
    speed: 30, size: 'Medium',
    swim_speed: 30,
    languages: ['Common', 'Draconic'],
    description: 'Scaled humanoids of the swamps and coasts, Lizardfolk view the world through an utterly pragmatic lens. They excel at survival and are fearsome in combat.',
    subraces: [],
  },
  'Yuan-ti Pureblood': {
    traits: ['Darkvision (60 ft)', 'Innate Spellcasting (Poison Spray cantrip; Animal Friendship on snakes at will; Suggestion + Cause Fear 1/long rest)', 'Magic Resistance (advantage on saves vs spells/magical effects)', 'Poison Immunity'],
    stat_bonuses: { intelligence: 1, charisma: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Abyssal', 'Draconic'],
    description: 'The most human-seeming of the yuan-ti, purebloods are the most numerous of their serpentine kin. They infiltrate humanoid society while serving their dark masters.',
    subraces: [],
  },
};

export const CLASSES = {
  Fighter: {
    hit_die: 10, primary_stat: 'strength', saves: ['strength', 'constitution'],
    armor_prof: ['all armor', 'shields'], weapon_prof: ['simple weapons', 'martial weapons'],
    skills: ['Athletics', 'Acrobatics', 'Animal Handling', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    skill_count: 2,
    subclasses: [
      { name: 'Champion', desc: 'Improved Critical (crit on 19-20), Remarkable Athlete, Additional Fighting Style.', features: { 3: ['Improved Critical'], 7: ['Remarkable Athlete'], 10: ['Additional Fighting Style'] } },
      { name: 'Battle Master', desc: 'Maneuvers using Superiority Dice (d8s). Tactical flexibility in combat.', features: { 3: ['Combat Superiority (4d8)', 'Student of War'], 7: ['Know Your Enemy'], 10: ['Improved Combat Superiority (d10)'] } },
      { name: 'Eldritch Knight', desc: 'Spellcasting (INT, Abjuration & Evocation), Weapon Bond, War Magic.', features: { 3: ['Spellcasting', 'Weapon Bond'], 7: ['War Magic'], 10: ['Eldritch Strike'] } },
      { name: 'Cavalier', desc: 'Mount-focused. Born to the Saddle, Unwavering Mark, Warding Maneuver.', features: { 3: ['Born to the Saddle', 'Unwavering Mark'], 7: ['Warding Maneuver'] } },
      { name: 'Samurai', desc: 'Fighting Spirit (temp HP + advantage), Elegant Courtier (CHA proficiency).', features: { 3: ['Fighting Spirit', 'Bonus Proficiency'], 7: ['Elegant Courtier'] } },
      { name: 'Arcane Archer', desc: 'Arcane Shot options, Arcane Shot (2/short rest), Curving Shot.', features: { 3: ['Arcane Shot (2 options)'], 7: ['Curving Shot', 'Magic Arrow'] } },
    ],
    description: 'Master of martial combat, skilled with a variety of weapons and armor.',
    features: {
      1: ['Fighting Style', 'Second Wind (1d10+level, bonus action, 1/short rest)'],
      2: ['Action Surge (extra action, 1/short rest)'],
      3: ['Martial Archetype'],
      4: ['Ability Score Improvement'],
      5: ['Extra Attack'],
      6: ['Ability Score Improvement'],
      7: ['Archetype Feature'],
      8: ['Ability Score Improvement'],
      9: ['Indomitable (reroll failed save, 1/long rest)'],
      11: ['Extra Attack (2 total)'],
      20: ['Extra Attack (3 total)'],
    },
    fighting_styles: ['Archery (+2 ranged attack)', 'Defense (+1 AC in armor)', 'Dueling (+2 damage 1 weapon)', 'Great Weapon Fighting (reroll 1/2)', 'Protection (impose disadvantage on attacker)', 'Two-Weapon Fighting (add stat to offhand)'],
  },
  Rogue: {
    hit_die: 8, primary_stat: 'dexterity', saves: ['dexterity', 'intelligence'],
    armor_prof: ['light armor'], weapon_prof: ['simple weapons', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'],
    tools: ["thieves' tools"],
    skills: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
    skill_count: 4,
    subclasses: [
      { name: 'Thief', desc: 'Fast Hands (bonus action for many actions), Second-Story Work (climb without penalty), Supreme Sneak, Use Magic Device.', features: { 3: ['Fast Hands', 'Second-Story Work'], 9: ['Supreme Sneak'], 13: ['Use Magic Device'] } },
      { name: 'Arcane Trickster', desc: 'Spellcasting (INT, Illusion & Enchantment), Mage Hand Legerdemain, Magical Ambush, Versatile Trickster.', features: { 3: ['Spellcasting', 'Mage Hand Legerdemain'], 9: ['Magical Ambush'], 13: ['Versatile Trickster'] } },
      { name: 'Assassin', desc: 'Assassinate (advantage + auto-crit on surprised), Infiltration Expertise, Impostor.', features: { 3: ['Assassinate', 'Bonus Proficiencies'], 9: ['Infiltration Expertise'], 13: ['Impostor'] } },
      { name: 'Swashbuckler', desc: 'Fancy Footwork (no opportunity attacks after melee), Rakish Audacity (Sneak Attack with no ally nearby).', features: { 3: ['Fancy Footwork', 'Rakish Audacity'], 9: ['Panache'], 13: ['Elegant Maneuver'] } },
      { name: 'Inquisitive', desc: 'Ear for Deceit, Eye for Detail, Insightful Fighting (Sneak Attack without ally if Insight contest won).', features: { 3: ['Ear for Deceit', 'Eye for Detail', 'Insightful Fighting'] } },
    ],
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles.',
    features: {
      1: ['Expertise (double proficiency ×2 skills)', 'Sneak Attack (1d6)', "Thieves' Cant"],
      2: ['Cunning Action (Dash/Disengage/Hide as bonus action)'],
      3: ['Roguish Archetype'],
      5: ['Uncanny Dodge (halve damage as reaction)'],
      7: ['Evasion (succeed even on failed DEX save)'],
      11: ['Reliable Talent (treat roll < 10 as 10 on proficient checks)'],
      14: ['Blindsense'],
      18: ['Elusive (attackers never have advantage)'],
      20: ["Stroke of Luck (missed attack becomes hit, 1/short rest)"],
    },
  },
  Wizard: {
    hit_die: 6, primary_stat: 'intelligence', saves: ['intelligence', 'wisdom'],
    armor_prof: [], weapon_prof: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
    skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    skill_count: 2,
    subclasses: [
      { name: 'School of Evocation', desc: 'Sculpt Spells (protect allies in AOE), Potent Cantrip, Empowered Evocation, Overchannel.', features: { 2: ['Evocation Savant', 'Sculpt Spells'], 6: ['Potent Cantrip'], 10: ['Empowered Evocation'], 14: ['Overchannel'] } },
      { name: 'School of Abjuration', desc: 'Arcane Ward (absorbs damage for you), Projected Ward, Improved Abjuration, Spell Resistance.', features: { 2: ['Abjuration Savant', 'Arcane Ward'], 6: ['Projected Ward'], 10: ['Improved Abjuration'] } },
      { name: 'School of Illusion', desc: 'Improved Minor Illusion, Malleable Illusions, Illusory Self (reaction negate attack), Illusory Reality.', features: { 2: ['Illusion Savant', 'Improved Minor Illusion'], 6: ['Malleable Illusions'], 10: ['Illusory Self'] } },
      { name: 'School of Necromancy', desc: 'Grim Harvest (heal from killing spells), Undead Thralls, Inured to Undeath, Command Undead.', features: { 2: ['Necromancy Savant', 'Grim Harvest'], 6: ['Undead Thralls'], 10: ['Inured to Undeath'] } },
      { name: 'School of Divination', desc: 'Portent (replace rolls with d20 rolls at dawn), Expert Divination, The Third Eye, Greater Portent.', features: { 2: ['Divination Savant', 'Portent'], 6: ['Expert Divination'], 10: ['The Third Eye'] } },
      { name: 'School of Conjuration', desc: 'Minor Conjuration (create small objects), Benign Transposition, Focused Conjuration, Durable Summons.', features: { 2: ['Conjuration Savant', 'Minor Conjuration'], 6: ['Benign Transposition'], 10: ['Focused Conjuration'] } },
    ],
    description: 'A scholarly magic-user capable of manipulating the fabric of reality.',
    features: {
      1: ['Spellcasting (INT, spell book)', 'Arcane Recovery (regain slots on short rest)'],
      2: ['Arcane Tradition'],
      18: ['Spell Mastery (cast 1st + 2nd level spells at will)'],
      20: ['Signature Spells (2 free 3rd-level spells per short rest)'],
    },
  },
  Cleric: {
    hit_die: 8, primary_stat: 'wisdom', saves: ['wisdom', 'charisma'],
    armor_prof: ['light armor', 'medium armor', 'shields'], weapon_prof: ['simple weapons'],
    skills: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: [
      { name: 'Life Domain', desc: 'Heavy Armor proficiency. Disciple of Life (+2+spell level healing). Preserve Life (pool = 5×level). Blessed Healer. Divine Strike (radiant). Supreme Healing.', features: { 1: ['Bonus Proficiency (Heavy Armor)', 'Disciple of Life'], 2: ['Preserve Life'], 6: ['Blessed Healer'] } },
      { name: 'Light Domain', desc: 'Bonus cantrip (Light). Warding Flare (impose disadvantage on attacker). Radiance of the Dawn. Improved Flare. Corona of Light.', features: { 1: ['Bonus Cantrip', 'Warding Flare'], 2: ['Radiance of the Dawn'], 6: ['Improved Flare'] } },
      { name: 'War Domain', desc: 'Bonus proficiencies (martial + heavy). War Priest (bonus attack as bonus action). Guided Strike (+10 to attack). War God\'s Blessing.', features: { 1: ['Bonus Proficiencies', 'War Priest'], 2: ['Guided Strike'], 6: ["War God's Blessing"] } },
      { name: 'Trickery Domain', desc: 'Blessing of the Trickster (advantage on Stealth). Invoke Duplicity (illusion copy). Cloak of Shadows. Divine Strike (poison).', features: { 1: ['Blessing of the Trickster'], 2: ['Invoke Duplicity'], 6: ['Cloak of Shadows'] } },
      { name: 'Nature Domain', desc: 'Acolyte of Nature (druid cantrip + skill). Charm Animals and Plants. Dampen Elements (reduce elemental damage). Divine Strike (cold/fire/lightning).', features: { 1: ['Acolyte of Nature', 'Bonus Proficiency'], 2: ['Charm Animals and Plants'], 6: ['Dampen Elements'] } },
      { name: 'Knowledge Domain', desc: 'Blessings of Knowledge (2 languages + skills + expertise). Visions of the Past. Read Thoughts. Potent Spellcasting.', features: { 1: ['Blessings of Knowledge'], 2: ['Visions of the Past'], 6: ['Read Thoughts'] } },
    ],
    description: 'A priestly champion who wields divine magic in service of a higher power.',
    features: {
      1: ['Spellcasting (WIS)', 'Divine Domain', 'Divine Domain Spells'],
      2: ['Channel Divinity (1/short rest)', 'Turn Undead'],
      5: ['Destroy Undead (CR ½)'],
      10: ['Divine Intervention (1/week)'],
    },
  },
  Ranger: {
    hit_die: 10, primary_stat: 'dexterity', saves: ['strength', 'dexterity'],
    armor_prof: ['light armor', 'medium armor', 'shields'], weapon_prof: ['simple weapons', 'martial weapons'],
    skills: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
    skill_count: 3,
    subclasses: [
      { name: 'Hunter', desc: 'Hunter\'s Prey (Colossus Slayer/Giant Killer/Horde Breaker). Defensive Tactics. Multiattack. Superior Hunter\'s Defense.', features: { 3: ["Hunter's Prey"], 7: ['Defensive Tactics'], 11: ['Multiattack'] } },
      { name: 'Beast Master', desc: 'Ranger\'s Companion (animal companion). Exceptional Training. Bestial Fury. Share Spells.', features: { 3: ["Ranger's Companion"], 7: ['Exceptional Training'], 11: ['Bestial Fury'] } },
      { name: 'Gloom Stalker', desc: 'Dread Ambusher (extra attack + damage on first turn in combat). Umbral Sight (invisible in darkness). Iron Mind (WIS save proficiency). Stalker\'s Flurry.', features: { 3: ['Dread Ambusher', 'Umbral Sight'], 7: ['Iron Mind'], 11: ["Stalker's Flurry"] } },
      { name: 'Horizon Walker', desc: 'Detect Portal, Planar Warrior (+1d8 force damage), Ethereal Step, Distant Strike, Spectral Defense.', features: { 3: ['Detect Portal', 'Planar Warrior'], 7: ['Ethereal Step'], 11: ['Distant Strike'] } },
    ],
    description: 'A warrior of the wilderness who hunts the monsters that threaten civilization.',
    features: {
      1: ['Favored Enemy (2 creature types, advantage on tracking)', 'Natural Explorer (choose favored terrain)'],
      2: ['Fighting Style', 'Spellcasting (WIS)'],
      3: ['Ranger Archetype', 'Primeval Awareness'],
      5: ['Extra Attack'],
      8: ['Land\'s Stride (difficult terrain at full speed)'],
      10: ['Natural Explorer (2nd terrain)', 'Hide in Plain Sight (+10 Stealth when hidden)'],
    },
  },
  Paladin: {
    hit_die: 10, primary_stat: 'charisma', saves: ['wisdom', 'charisma'],
    armor_prof: ['all armor', 'shields'], weapon_prof: ['simple weapons', 'martial weapons'],
    skills: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: [
      { name: 'Oath of Devotion', desc: 'Sacred Weapon, Turn the Unholy. Aura of Devotion (immune to charm). Purity of Spirit. Holy Nimbus.', features: { 3: ['Sacred Weapon', 'Turn the Unholy'], 7: ['Aura of Devotion'], 15: ['Purity of Spirit'], 20: ['Holy Nimbus'] } },
      { name: 'Oath of the Ancients', desc: 'Nature\'s Wrath, Turn the Faithless. Aura of Warding (resistance to spell damage). Undying Sentinel. Elder Champion.', features: { 3: ["Nature's Wrath", 'Turn the Faithless'], 7: ['Aura of Warding'], 15: ['Undying Sentinel'], 20: ['Elder Champion'] } },
      { name: 'Oath of Vengeance', desc: 'Abjure Enemy, Vow of Enmity (advantage). Relentless Avenger. Soul of Vengeance. Avenging Angel.', features: { 3: ['Abjure Enemy', 'Vow of Enmity'], 7: ['Relentless Avenger'], 15: ['Soul of Vengeance'], 20: ['Avenging Angel'] } },
      { name: 'Oath of Conquest', desc: 'Conquering Presence, Guided Strike. Aura of Conquest (frightened creatures can\'t move). Scornful Rebuke. Invincible Conqueror.', features: { 3: ['Conquering Presence', 'Guided Strike'], 7: ['Aura of Conquest'], 15: ['Scornful Rebuke'] } },
      { name: 'Oathbreaker', desc: 'Control Undead, Dreadful Aspect. Aura of Hate (+CHA to damage for you + undead). Supernatural Resistance. Dread Lord.', features: { 3: ['Control Undead', 'Dreadful Aspect'], 7: ['Aura of Hate'], 15: ['Supernatural Resistance'] } },
    ],
    description: 'A holy warrior bound to a sacred oath, wielding divine power.',
    features: {
      1: ['Divine Sense (detect celestials/fiends/undead)', 'Lay on Hands (pool = 5×level HP)'],
      2: ['Fighting Style', 'Spellcasting (CHA)', 'Divine Smite (expend slot for radiant bonus damage)'],
      3: ['Divine Health (immune to disease)', 'Sacred Oath'],
      5: ['Extra Attack'],
      6: ['Aura of Protection (+CHA to saves for you + nearby allies)'],
      10: ['Aura of Courage (immune to frightened for you + nearby allies)'],
      11: ['Improved Divine Smite (+1d8 radiant on all melee hits)'],
    },
  },
  Barbarian: {
    hit_die: 12, primary_stat: 'strength', saves: ['strength', 'constitution'],
    armor_prof: ['light armor', 'medium armor', 'shields'], weapon_prof: ['simple weapons', 'martial weapons'],
    skills: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    skill_count: 2,
    subclasses: [
      { name: 'Path of the Berserker', desc: 'Frenzy (extra attack as bonus action while raging, then exhaustion). Mindless Rage (immune to charm/frighten). Intimidating Presence. Retaliation.', features: { 3: ['Frenzy', 'Mindless Rage'], 6: ['Intimidating Presence'], 10: ['Retaliation'] } },
      { name: 'Path of the Totem Warrior', desc: 'Spirit Seeker, Totem Spirit (choose Bear/Eagle/Wolf), Aspect of the Beast, Totemic Attunement.', features: { 3: ['Spirit Seeker', 'Totem Spirit'], 6: ['Aspect of the Beast'], 10: ['Spirit Walker'], 14: ['Totemic Attunement'] } },
      { name: 'Path of the Storm Herald', desc: 'Storm Aura (Desert/Sea/Tundra), Storm Soul, Shielding Storm, Raging Storm.', features: { 3: ['Storm Aura'], 6: ['Storm Soul'], 10: ['Shielding Storm'], 14: ['Raging Storm'] } },
      { name: 'Path of the Zealot', desc: 'Divine Fury (radiant/necrotic damage while raging), Warrior of the Gods (revive without material cost), Fanatical Focus, Zealous Presence.', features: { 3: ['Divine Fury', 'Warrior of the Gods'], 6: ['Fanatical Focus'], 10: ['Zealous Presence'] } },
    ],
    description: 'A fierce warrior of primitive background who can enter a battle rage.',
    features: {
      1: ['Rage (2/long rest, +2 damage, resistance to B/P/S)', 'Unarmored Defense (10+DEX+CON AC)'],
      2: ['Reckless Attack (advantage, but enemies too)', 'Danger Sense (advantage on DEX saves vs visible dangers)'],
      3: ['Primal Path'],
      5: ['Extra Attack', 'Fast Movement (+10 ft speed without armor)'],
      7: ['Feral Instinct (advantage on Initiative)'],
      9: ['Brutal Critical (+1 extra crit die)'],
      11: ['Relentless Rage (DC 10+5 CON to drop to 1 HP)'],
      15: ['Persistent Rage (rage only ends if you choose or fall unconscious)'],
      20: ['Primal Champion (+4 STR, +4 CON)'],
    },
  },
  Bard: {
    hit_die: 8, primary_stat: 'charisma', saves: ['dexterity', 'charisma'],
    armor_prof: ['light armor'], weapon_prof: ['simple weapons', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'],
    skills: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'],
    skill_count: 3,
    subclasses: [
      { name: 'College of Lore', desc: 'Bonus Proficiencies (3 skills). Cutting Words (subtract Bardic Inspiration from enemy roll). Additional Magical Secrets. Peerless Skill.', features: { 3: ['Bonus Proficiencies', 'Cutting Words'], 6: ['Additional Magical Secrets'], 14: ['Peerless Skill'] } },
      { name: 'College of Valor', desc: 'Bonus Proficiencies (medium armor, shields, martial weapons). Combat Inspiration (Bardic die to weapon damage/AC). Extra Attack. Battle Magic.', features: { 3: ['Bonus Proficiencies', 'Combat Inspiration'], 6: ['Extra Attack'], 14: ['Battle Magic'] } },
      { name: 'College of Glamour', desc: 'Mantle of Inspiration (move + temp HP), Enthralling Performance (charm), Mantle of Majesty (Command each turn), Unbreakable Majesty.', features: { 3: ['Mantle of Inspiration', 'Enthralling Performance'], 6: ['Mantle of Majesty'], 14: ['Unbreakable Majesty'] } },
      { name: 'College of Swords', desc: 'Bonus Proficiencies (medium armor, scimitars). Fighting Style. Blade Flourish (3 options using Inspiration dice). Extra Attack. Master\'s Flourish.', features: { 3: ['Bonus Proficiency', 'Fighting Style', 'Blade Flourish'], 6: ['Extra Attack'], 14: ["Master's Flourish"] } },
    ],
    description: 'An inspiring magician whose power echoes the music of creation.',
    features: {
      1: ['Spellcasting (CHA)', 'Bardic Inspiration (d6, CHA modifier uses/long rest)'],
      2: ['Jack of All Trades (+½ proficiency to non-proficient checks)', 'Song of Rest (d6 bonus healing on short rest)'],
      3: ['Bard College', 'Expertise (×2 proficiency on 2 skills)'],
      5: ['Bardic Inspiration (d8)', 'Font of Inspiration (regain on short rest)'],
      6: ['Countercharm (use action to grant advantage vs charm/frighten)'],
      10: ['Magical Secrets (learn 2 spells from any class)', 'Bardic Inspiration (d10)'],
      20: ['Superior Inspiration (restore one Bardic Inspiration if you roll initiative with none)'],
    },
  },
  Druid: {
    hit_die: 8, primary_stat: 'wisdom', saves: ['intelligence', 'wisdom'],
    armor_prof: ['light armor', 'medium armor', 'shields (non-metal)'], weapon_prof: ['clubs', 'daggers', 'darts', 'javelins', 'maces', 'quarterstaffs', 'scimitars', 'sickles', 'slings', 'spears'],
    tools: ["herbalism kit"],
    skills: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
    skill_count: 2,
    subclasses: [
      { name: 'Circle of the Land', desc: 'Bonus Cantrip. Natural Recovery (regain spell slots on short rest). Circle Spells (based on terrain). Land\'s Stride. Nature\'s Ward. Nature\'s Sanctuary.', features: { 2: ['Bonus Cantrip', 'Natural Recovery'], 3: ['Circle Spells'], 6: ["Land's Stride"] } },
      { name: 'Circle of the Moon', desc: 'Combat Wild Shape (wild shape as bonus action, use spell slot to heal), Circle Forms (CR ⅓ of druid level), Elemental Wild Shape, Thousand Forms.', features: { 2: ['Combat Wild Shape', 'Circle Forms'], 6: ['Primal Strike'], 10: ['Elemental Wild Shape'], 14: ['Thousand Forms'] } },
      { name: 'Circle of Spores', desc: 'Halo of Spores (1d4 necrotic reaction). Symbiotic Entity (temporary HP + Halo damage). Fungal Infestation. Spreading Spores. Fungal Body.', features: { 2: ['Halo of Spores', 'Symbiotic Entity'], 6: ['Fungal Infestation'], 10: ['Spreading Spores'] } },
    ],
    description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    features: {
      1: ['Druidic (secret language)', 'Spellcasting (WIS)'],
      2: ['Wild Shape (CR ¼ beasts, 2/short rest)', 'Druid Circle'],
      4: ['Wild Shape improvement (CR ½, swimming)'],
      8: ['Wild Shape improvement (CR 1, flying)'],
      18: ['Timeless Body (age 1 yr per 10)', 'Beast Spells (cast while wildshaped)'],
      20: ['Archdruid (unlimited Wild Shape)'],
    },
  },
  Monk: {
    hit_die: 8, primary_stat: 'dexterity', saves: ['strength', 'dexterity'],
    armor_prof: [], weapon_prof: ['simple weapons', 'shortswords'],
    skills: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
    skill_count: 2,
    subclasses: [
      { name: 'Way of the Open Hand', desc: 'Open Hand Technique (knock prone/push/no reaction after Flurry). Wholeness of Body (heal 3×level, 1/long rest). Tranquility. Quivering Palm.', features: { 3: ['Open Hand Technique'], 6: ['Wholeness of Body'], 11: ['Tranquility'], 17: ['Quivering Palm'] } },
      { name: 'Way of Shadow', desc: 'Shadow Arts (cast darkness/darkvision/pass without trace/silence using Ki). Shadow Step (teleport between shadows). Cloak of Shadows. Opportunist.', features: { 3: ['Shadow Arts'], 6: ['Shadow Step'], 11: ['Cloak of Shadows'], 17: ['Opportunist'] } },
      { name: 'Way of the Four Elements', desc: 'Elemental Disciplines (spend Ki to cast elemental spells). Fangs of the Fire Snake, Fist of Four Thunders, etc.', features: { 3: ['Disciple of the Elements'], 6: ['Extra Elemental Discipline'], 11: ['Extra Elemental Discipline'], 17: ['Extra Elemental Discipline'] } },
      { name: 'Way of the Kensei', desc: 'Path of the Kensei (chosen weapons become monk weapons). One with the Blade. Sharpen the Blade. Unerring Accuracy.', features: { 3: ['Path of the Kensei'], 6: ['One with the Blade'], 11: ['Sharpen the Blade'], 17: ['Unerring Accuracy'] } },
    ],
    description: 'A master of martial arts who channels ki to perform incredible feats.',
    features: {
      1: ['Unarmored Defense (10+WIS+DEX)', 'Martial Arts (DEX instead of STR, bonus unarmed attack)'],
      2: ['Ki (WIS modifier per short rest: Flurry of Blows, Patient Defense, Step of the Wind)', 'Unarmored Movement (+10 ft)'],
      3: ['Monastic Tradition', 'Deflect Missiles'],
      4: ['Slow Fall'],
      5: ['Extra Attack', 'Stunning Strike (spend 1 Ki: CON save or stunned)'],
      6: ['Ki-Empowered Strikes (attacks count as magical)'],
      7: ['Evasion', 'Stillness of Mind (end charm/frighten as action)'],
      10: ['Purity of Body (immune to disease + poison)'],
      13: ['Tongue of the Sun and Moon (understand all spoken languages)'],
      15: ['Diamond Soul (proficiency on all saves)'],
      18: ['Empty Body (invisible + resist non-force, spend 4 Ki: Astral Projection)'],
      20: ['Perfect Self (regain 4 Ki if you have none when rolling initiative)'],
    },
  },
  Sorcerer: {
    hit_die: 6, primary_stat: 'charisma', saves: ['constitution', 'charisma'],
    armor_prof: [], weapon_prof: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
    skills: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
    skill_count: 2,
    subclasses: [
      { name: 'Draconic Bloodline', desc: 'Dragon Ancestor (choose draconic type, language). Draconic Resilience (+1 HP/level, AC 13+DEX unarmored). Elemental Affinity. Dragon Wings. Draconic Presence.', features: { 1: ['Dragon Ancestor', 'Draconic Resilience'], 6: ['Elemental Affinity'], 14: ['Dragon Wings'], 18: ['Draconic Presence'] } },
      { name: 'Wild Magic', desc: 'Wild Magic Surge (1% chance of chaotic effect per spell). Tides of Chaos (advantage 1/long rest). Bend Luck (2 sorcery points to change any roll ±1d4).', features: { 1: ['Wild Magic Surge', 'Tides of Chaos'], 6: ['Bend Luck'], 14: ['Controlled Chaos'], 18: ['Spell Bombardment'] } },
      { name: 'Divine Soul', desc: 'Divine Magic (access Cleric spells). Favored by the Gods (add 2d4 to failed save/attack). Empowered Healing. Otherworldly Wings. Unearthly Recovery.', features: { 1: ['Divine Magic', 'Favored by the Gods'], 6: ['Empowered Healing'], 14: ['Otherworldly Wings'], 18: ['Unearthly Recovery'] } },
      { name: 'Storm Sorcery', desc: 'Wind Speaker (Primordial + 4 elemental languages). Tempestuous Magic (fly 10 ft as bonus action). Heart of the Storm. Storm Guide. Wind Soul.', features: { 1: ['Wind Speaker', 'Tempestuous Magic'], 6: ['Heart of the Storm'], 14: ['Storm Guide'], 18: ['Wind Soul'] } },
    ],
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
    features: {
      1: ['Spellcasting (CHA)', 'Sorcerous Origin'],
      2: ['Font of Magic (Sorcery Points = level; convert to/from spell slots)'],
      3: ['Metamagic (choose 2: Careful/Distant/Empowered/Extended/Heightened/Quickened/Subtle/Twinned)'],
      20: ['Sorcerous Restoration (regain 4 Sorcery Points on short rest)'],
    },
  },
  Warlock: {
    hit_die: 8, primary_stat: 'charisma', saves: ['wisdom', 'charisma'],
    armor_prof: ['light armor'], weapon_prof: ['simple weapons'],
    skills: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
    skill_count: 2,
    subclasses: [
      { name: 'The Archfey', desc: 'Fey Presence (charm/frighten in 10 ft cube, WIS save). Misty Escape (invisible + teleport as reaction when taking damage). Beguiling Defenses. Dark Delirium.', features: { 1: ['Fey Presence'], 6: ['Misty Escape'], 10: ['Beguiling Defenses'], 14: ['Dark Delirium'] } },
      { name: 'The Fiend', desc: "Dark One's Blessing (temp HP = CHA+level on kill). Dark One's Own Luck (add d10 to ability check/save, 1/short rest). Fiendish Resilience. Hurl Through Hell.", features: { 1: ["Dark One's Blessing"], 6: ["Dark One's Own Luck"], 10: ['Fiendish Resilience'], 14: ['Hurl Through Hell'] } },
      { name: 'The Great Old One', desc: "Awakened Mind (telepathy 30 ft). Entropic Ward (impose disadvantage; on miss: advantage next attack vs them). Thought Shield (resist psychic, reflect damage). Create Thrall.", features: { 1: ['Awakened Mind'], 6: ['Entropic Ward'], 10: ['Thought Shield'], 14: ['Create Thrall'] } },
      { name: 'The Undead', desc: 'Form of Dread (frightened target, gain temp HP, necrotic immunity as bonus action). Grave Touched. Necrotic Husk. Spirit Projection.', features: { 1: ['Form of Dread'], 6: ['Grave Touched'], 10: ['Necrotic Husk'], 14: ['Spirit Projection'] } },
    ],
    description: 'A wielder of magic derived from a bargain with an extraplanar entity.',
    features: {
      1: ['Otherworldly Patron', 'Pact Magic (CHA; short rest recovery; always at highest slot level)'],
      2: ['Eldritch Invocations (choose 2; modify Eldritch Blast and grant new abilities)'],
      3: ['Pact Boon (Pact of the Chain/Blade/Tome)'],
      5: ['Eldritch Invocation upgrades'],
      11: ['Mystic Arcanum (6th level spell, 1/long rest)'],
      13: ['Mystic Arcanum (7th)'], 15: ['Mystic Arcanum (8th)'], 17: ['Mystic Arcanum (9th)'],
      20: ['Eldritch Master (regain all pact slots in 1 min, 1/long rest)'],
    },
    eldritch_invocations: [
      'Agonizing Blast (+CHA to Eldritch Blast)', 'Armor of Shadows (Mage Armor at will)', 'Devil\'s Sight (see in magical darkness)',
      'Eldritch Sight (Detect Magic at will)', 'Fiendish Vigor (False Life at will)', 'Gaze of Two Minds (perceive through another)',
      'Repelling Blast (push 10 ft on hit)', 'Thief of Five Fates (Bane 1/long rest)', 'Mask of Many Faces (Disguise Self at will)',
      'Misty Visions (Silent Image at will)', 'One with Shadows (invisible in dim/dark)', 'Sculptor of Flesh (Polymorph 1/long rest)',
    ],
  },
};

  Artificer: {
    hit_die: 8, primary_stat: 'intelligence', saves: ['constitution', 'intelligence'],
    armor_prof: ['light armor', 'medium armor', 'shields'], weapon_prof: ['simple weapons', 'hand crossbows', 'heavy crossbows'],
    tools: ["thieves' tools", "tinker's tools", "one type of artisan's tools"],
    skills: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'],
    skill_count: 2,
    subclasses: [
      { name: 'Alchemist', desc: 'Experimental Elixir (create magical elixirs: healing, swiftness, resilience, boldness, flight, transformation). Alchemical Savant. Restorative Reagents. Chemical Mastery.', features: { 3: ['Tools Required', 'Experimental Elixir'], 5: ['Alchemical Savant'], 9: ['Restorative Reagents'], 15: ['Chemical Mastery'] } },
      { name: 'Armorer', desc: 'Arcane Armor (donned armor becomes magical, don/doff as action). Armor Model (Guardian or Infiltrator). Extra Attack. Armor Modifications. Perfected Armor.', features: { 3: ['Tools Required', 'Arcane Armor', 'Armor Model'], 5: ['Extra Attack'], 9: ['Armor Modifications'], 15: ['Perfected Armor'] } },
      { name: 'Artillerist', desc: 'Eldritch Cannon (force ballista, flamethrower, or protector). Arcane Firearm (+1d8 to spell damage). Explosive Cannon. Fortified Position.', features: { 3: ['Tools Required', 'Eldritch Cannon'], 5: ['Arcane Firearm'], 9: ['Explosive Cannon'], 15: ['Fortified Position'] } },
      { name: 'Battle Smith', desc: 'Battle Ready (use INT for weapon attacks). Steel Defender (mechanical beast companion). Extra Attack. Arcane Jolt (+2d6 force damage or heal an ally). Improved Defender.', features: { 3: ['Tools Required', 'Battle Ready', 'Steel Defender'], 5: ['Extra Attack'], 9: ['Arcane Jolt'], 15: ['Improved Defender'] } },
    ],
    description: 'A master of magical invention who uses tools and ingenuity to craft weapons, armor, and wondrous items.',
    features: {
      1: ['Magical Tinkering (infuse tiny objects with minor magical effects)', 'Spellcasting (INT, uses tools as spellcasting focus)'],
      2: ['Infuse Item (imbue items with magical infusions; number = level)', 'Infusions Known: Enhanced Defense, Enhanced Weapon, Replicate Magic Item, Returning Weapon'],
      3: ['Artificer Specialist', 'The Right Tool for the Job (craft tools with tinker\'s tools)'],
      4: ['Ability Score Improvement'],
      5: ['Arcane Jolt (+2d6 force damage 1/turn)', 'Tool Expertise (double proficiency on tool checks)'],
      6: ['Tool Expertise'],
      7: ['Flash of Genius (add INT to failed check/save as reaction, CHA times/long rest)'],
      10: ['Magic Item Adept (attune to 4 items; craft common/uncommon in half time at half cost)'],
      11: ['Spell-Storing Item (store a 1st or 2nd level spell in an item, CHA uses/long rest)'],
      14: ['Magic Item Savant (attune to 5 items, ignore requirements)'],
      18: ['Magic Item Master (attune to 6 items)'],
      20: ['Soul of Artifice (+1 to all saves per attunement; avoid being reduced to 0 HP as reaction)'],
    },
  },
};

export const BACKGROUNDS = [
  { name: 'Acolyte', skills: ['Insight', 'Religion'], feature: 'Shelter of the Faithful', equipment: ['Holy symbol', 'Prayer book', '15 gp'], tool_profs: [], languages: 2 },
  { name: 'Criminal', skills: ['Deception', 'Stealth'], feature: 'Criminal Contact', equipment: ["Crowbar", "Dark clothes", '15 gp'], tool_profs: ["Thieves' tools", 'one gaming set'] },
  { name: 'Folk Hero', skills: ['Animal Handling', 'Survival'], feature: 'Rustic Hospitality', equipment: ['Craftsman tools', 'Shovel', '10 gp'], tool_profs: ['artisan\'s tools', 'vehicles (land)'] },
  { name: 'Noble', skills: ['History', 'Persuasion'], feature: 'Position of Privilege', equipment: ['Fine clothes', 'Signet ring', '25 gp'], tool_profs: ['one gaming set'], languages: 1 },
  { name: 'Outlander', skills: ['Athletics', 'Survival'], feature: 'Wanderer', equipment: ['Staff', 'Hunting trap', '10 gp'], tool_profs: ['one musical instrument'], languages: 1 },
  { name: 'Sage', skills: ['Arcana', 'History'], feature: 'Researcher', equipment: ['Ink & quill', 'Small knife', '10 gp'], tool_profs: [], languages: 2 },
  { name: 'Soldier', skills: ['Athletics', 'Intimidation'], feature: 'Military Rank', equipment: ['Insignia of rank', 'Trophy', '10 gp'], tool_profs: ['vehicles (land)', 'one gaming set'] },
  { name: 'Charlatan', skills: ['Deception', 'Sleight of Hand'], feature: 'False Identity', equipment: ['Fine clothes', 'Disguise kit', '15 gp'], tool_profs: ['Disguise kit', "Forgery kit"] },
  { name: 'Hermit', skills: ['Medicine', 'Religion'], feature: 'Discovery', equipment: ['Scroll case', 'Herbalism kit', '5 gp'], tool_profs: ['Herbalism kit'], languages: 1 },
  { name: 'Sailor', skills: ['Athletics', 'Perception'], feature: "Ship's Passage", equipment: ['Belaying pin', 'Rope 50ft', '10 gp'], tool_profs: ["Navigator's tools", 'vehicles (water)'] },
  { name: 'Spy', skills: ['Deception', 'Stealth'], feature: 'Criminal Contact', equipment: ['Crowbar', 'Dark clothes', '15 gp'], tool_profs: ["Thieves' tools", 'one gaming set'] },
  { name: 'Entertainer', skills: ['Acrobatics', 'Performance'], feature: 'By Popular Demand', equipment: ['Musical instrument', 'Costume', '15 gp'], tool_profs: ['disguise kit', 'one musical instrument'] },
  { name: 'Guild Artisan', skills: ['Insight', 'Persuasion'], feature: 'Guild Membership', equipment: ['Artisan tools', 'Letter of introduction', '15 gp'], tool_profs: ["one artisan's tools"], languages: 1 },
  { name: 'Urchin', skills: ['Sleight of Hand', 'Stealth'], feature: 'City Secrets', equipment: ['Small knife', 'City map', '10 gp'], tool_profs: ["Disguise kit", "Thieves' tools"] },
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
  blinded:     { icon: '👁️',  color: 'text-gray-400',    description: 'Cannot see, auto-fail sight checks, attacks vs you have advantage.' },
  charmed:     { icon: '💕',  color: 'text-pink-400',    description: 'Cannot attack charmer, charmer has advantage on social checks vs you.' },
  frightened:  { icon: '😱',  color: 'text-yellow-400',  description: 'Disadvantage on checks/attacks near source; cannot willingly move toward it.' },
  paralyzed:   { icon: '⚡',  color: 'text-yellow-500',  description: 'Incapacitated, auto-fail STR/DEX saves, attacks from within 5 ft auto-crit.' },
  poisoned:    { icon: '☠️',  color: 'text-green-400',   description: 'Disadvantage on attack rolls and ability checks.' },
  prone:       { icon: '🛌',  color: 'text-orange-300',  description: 'Must crawl (half speed), melee attacks have advantage, ranged have disadvantage.' },
  stunned:     { icon: '💥',  color: 'text-yellow-400',  description: 'Incapacitated, auto-fail STR/DEX saves, attacks have advantage vs you.' },
  unconscious: { icon: '💤',  color: 'text-gray-400',    description: 'Incapacitated, prone, auto-fail STR/DEX saves, attacks auto-crit within 5 ft.' },
  exhausted:   { icon: '😓',  color: 'text-red-400',     description: 'Level 1-6 penalties: disadvantage on checks → +5 speed reduction → checks & saves → max HP halved → speed 0 → death.' },
  bleeding:    { icon: '🩸',  color: 'text-red-500',     description: '1d4 damage per turn until a successful DC 13 Medicine check or healing received.' },
  invisible:   { icon: '👻',  color: 'text-blue-300',    description: 'Attacks against have disadvantage, your attacks have advantage.' },
  restrained:  { icon: '⛓️',  color: 'text-orange-400',  description: 'Speed 0, attack rolls and DEX saves have disadvantage, attacks against have advantage.' },
  deafened:    { icon: '🔇',  color: 'text-slate-400',   description: 'Cannot hear, auto-fail hearing checks.' },
  petrified:   { icon: '🪨',  color: 'text-stone-400',   description: 'Incapacitated, immune to poison/disease, resistant to all damage.' },
  grappled:    { icon: '🤼',  color: 'text-amber-400',   description: 'Speed becomes 0. Ends if grappler is incapacitated or you are moved away.' },
  concentration_broken: { icon: '🔮', color: 'text-purple-400', description: 'Concentration spell was disrupted.' },
};

export const SKILL_STAT_MAP = {
  Athletics: 'strength',
  Acrobatics: 'dexterity', 'Sleight of Hand': 'dexterity', Stealth: 'dexterity',
  Arcana: 'intelligence', History: 'intelligence', Investigation: 'intelligence', Nature: 'intelligence', Religion: 'intelligence',
  'Animal Handling': 'wisdom', Insight: 'wisdom', Medicine: 'wisdom', Perception: 'wisdom', Survival: 'wisdom',
  Deception: 'charisma', Intimidation: 'charisma', Performance: 'charisma', Persuasion: 'charisma',
};

export const ALL_SKILLS = Object.keys(SKILL_STAT_MAP);

export const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

// ─── Passive Scores ─────────────────────────────────────────────────────────
export function calcPassiveScore(character, skill) {
  const stat = SKILL_STAT_MAP[skill];
  const mod = calcStatMod(character[stat]);
  const prof = (character.skills || {})[skill] ? (PROFICIENCY_BY_LEVEL[character.level - 1] || 2) : 0;
  const expertise = (character.skills || {})[`${skill}_expertise`] ? prof : 0;
  return 10 + mod + prof + expertise;
}

// ─── Carry Capacity ──────────────────────────────────────────────────────────
export function calcCarryCapacity(character) {
  return (character.strength || 10) * 15;
}

export function getEncumbrance(character) {
  const inv = character.inventory || [];
  const totalWeight = inv.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);
  const cap = calcCarryCapacity(character);
  if (totalWeight > cap) return { level: 'heavily', label: 'Heavily Encumbered', penalty: '-20 ft speed, disadvantage STR/DEX/CON checks' };
  if (totalWeight > cap * 0.666) return { level: 'encumbered', label: 'Encumbered', penalty: '-10 ft speed' };
  return { level: 'normal', label: 'Unencumbered', penalty: null };
}