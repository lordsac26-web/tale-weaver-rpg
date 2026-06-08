// D&D 5E Core Data — Expanded with Subclasses, Multiclassing, Subraces, Skills
 
export const RACES = {
  Human: {
    traits: ['Extra Skill Proficiency', 'Extra Feat', 'Versatile'],
    stat_bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'one extra language'],
    description: 'Versatile and ambitious, humans excel at everything. Their extra feat and skill make them exceptional generalists.',
    subraces: [
      { name: 'Variant Human', stat_bonuses: {}, stat_choices: 2, traits: ['Two +1 ability score increases of your choice', 'One bonus skill proficiency', 'One feat at 1st level'], description: 'Variant rule: Choose two different +1 ability score increases, gain one extra skill proficiency, and select one feat at 1st level.' },
    ],
  },
  Elf: {
    traits: ['Darkvision (60 ft)', 'Fey Ancestry', 'Trance', 'Keen Senses (Perception proficiency)', 'Trance (4hr rest)'],
    stat_bonuses: { dexterity: 2 },
    skill_proficiencies: ['Perception'],
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
    skill_proficiencies: ['Perception', 'Stealth'],
    speed: 30, size: 'Medium',
    languages: ['Common', 'one extra'],
    description: 'Curious cat-folk from a distant land, Tabaxi are driven by an insatiable hunger for stories, secrets, and shiny trinkets. They travel the world collecting experiences.',
    subraces: [],
  },
  Kenku: {
    traits: ['Expert Forgery (copy handwriting/craftwork with advantage)', 'Mimicry (mimic sounds/voices heard, WIS insight contest to detect)', 'Kenku Training (proficiency in 2 of: Acrobatics, Deception, Stealth, Sleight of Hand)'],
    stat_bonuses: { dexterity: 2, wisdom: 1 },
    skill_proficiencies: ['Acrobatics', 'Stealth'],
    skill_choices: { count: 2, options: ['Acrobatics', 'Deception', 'Stealth', 'Sleight of Hand'] },
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
    skill_proficiencies: ['Perception', 'Stealth'],
    skill_choices: { count: 2, options: ['Animal Handling', 'Nature', 'Perception', 'Stealth', 'Survival'] },
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
  Minotaur: {
    traits: ['Horns (1d6 + STR piercing unarmed attack)', 'Goring Rush (dash ≥20 ft, bonus horn attack)', 'Hammering Horns (push Large or smaller 10 ft on horn hit)', 'Labyrinthine Recall (perfect recall of paths traveled)'],
    stat_bonuses: { strength: 2, constitution: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Minotaur'],
    description: 'Powerful bull-headed warriors with an innate sense of direction. Minotaurs are fierce in battle and never forget a path they\'ve traveled.',
    subraces: [],
  },
  Tortle: {
    traits: ['Natural Armor (AC 17, cannot benefit from worn armor)', 'Shell Defense (bonus action: AC becomes 19, prone, speed 0, advantage on STR/CON saves; action to emerge)', 'Hold Breath (1 hour)', 'Claws (1d4 slashing unarmed attack)', 'Survival Instinct (proficiency in Survival)'],
    stat_bonuses: { strength: 2, wisdom: 1 },
    skill_proficiencies: ['Survival'],
    natural_armor: 17,
    speed: 30, size: 'Medium',
    languages: ['Common', 'Aquan'],
    description: 'Peaceful turtle-folk with impenetrable shells. Tortles wander the world seeking enlightenment and protecting nature. Their natural armor makes them formidable without equipment.',
    subraces: [],
  },
  Warforged: {
    traits: [
      'Constructed Resilience (advantage on saves vs being poisoned; resistance to poison damage; immune to disease; do not need to eat, drink, or breathe; immune to being put to magical sleep)',
      'Sentry\'s Rest (when you take a long rest, spend 6 hours in an inactive but conscious motionless state — you remain aware of your surroundings and gain the normal benefits of a long rest without sleeping)',
      'Integrated Protection (your body has built-in defensive layers. Unarmored AC = 11 + DEX modifier. You can don only armor you are proficient with; it merges into your body over 1 hour and cannot be removed against your will)',
      'Specialized Design (gain one skill proficiency and one tool proficiency of your choice, reflecting your original purpose)',
      'Composite Plating (your natural plating counts as worn armor; while not wearing other armor you gain a +1 bonus to AC, stacking with Integrated Protection)',
      'Tireless Construct (you cannot gain levels of exhaustion from lack of sleep, and forced-march/marching fatigue affects you at half rate)',
    ],
    stat_bonuses: { constitution: 2 },
    stat_choices: 1,
    skill_proficiencies: [],
    tool_proficiencies: 1,
    natural_armor_bonus: 1,
    speed: 30, size: 'Medium',
    languages: ['Common', 'one extra language'],
    description: 'Living constructs forged for war and imbued with sentience. Warforged blend the durability of metal, stone, and wood with the adaptability of flesh and a spark of true consciousness. They do not sleep, cannot be poisoned, and are immune to disease — making them relentless warriors and tireless adventurers who carry the purpose of their creation into every battle.',
    subraces: [
      { name: 'Envoy', stat_bonuses: { intelligence: 1 }, traits: ['Integrated Tool (one set of artisan\'s or thieves\' tools is built into your body; you have proficiency with it and can use it without holding it)', 'Specialized Protocols (gain proficiency in one additional skill of your choice)', 'Quick-Calc Mind (advantage on Intelligence (Investigation) checks to recall technical or constructed-object lore)'], description: 'Envoys were built for diplomacy, craft, and specialized labor rather than the front line. A tool is integrated directly into their frame, and their refined cognition makes them superb problem-solvers and negotiators.' },
      { name: 'Juggernaut', stat_bonuses: { strength: 1 }, traits: ['Iron Fists (your unarmed strikes deal 1d6 bludgeoning damage)', 'Powerful Build (count as one size larger for carrying capacity and for pushing, dragging, or lifting)', 'Siege Frame (advantage on saving throws against being knocked prone or moved against your will)'], description: 'The largest and most heavily armored of the Warforged, Juggernauts were forged as living siege engines. They smash through fortifications and hold the line where lesser soldiers break.' },
      { name: 'Skirmisher', stat_bonuses: { dexterity: 1 }, traits: ['Light Step (your speed increases by 5 ft while you are not wearing heavy armor)', 'Integrated Weapon (one light or finesse weapon folds into your body; you can draw or stow it instantly and never be disarmed of it)', 'Evasive Servos (when you take the Dash action, opportunity attacks against you have disadvantage this turn)'], description: 'Lightweight Warforged built for reconnaissance and rapid strikes. Skirmishers move with uncanny quiet and speed, favored by scouts, rangers, and infiltrators.' },
      { name: 'Bulwark', stat_bonuses: { constitution: 1 }, traits: ['Living Shield (as a reaction when a creature within 5 ft is hit by an attack, you can impose -2 to that attack\'s damage by interposing your plated frame; usable proficiency-bonus times per long rest)', 'Reinforced Chassis (your Composite Plating AC bonus increases to +2 while you are not wearing other armor)', 'Anchored Stance (you have advantage on Strength (Athletics) checks to resist being shoved or grappled)'], description: 'Defensive constructs designed to guard high-value targets. Bulwarks plant themselves between danger and their allies, their reinforced plating turning aside blows meant for others.' },
      { name: 'Reflector', stat_bonuses: { wisdom: 1 }, traits: ['Mirror Plating (you have resistance to radiant damage and advantage on saving throws against being blinded)', 'Spell Deflection (when you succeed on a saving throw against a spell that targets only you, you take no damage instead of half; usable once per short rest)', 'Calibrated Senses (you gain proficiency in Perception and ignore the effects of bright glare or sudden light)'], description: 'Arcane-warding constructs plated in mirror-bright alloy, built to escort mages and survive magical bombardment. Reflectors turn hostile magic aside and shine like beacons in the dark.' },
    ],
    warforged_feats: [
      { name: 'Armor of the Colossus', desc: 'Your Integrated Protection AC bonus increases to +2. The first creature that hits you with a melee attack on each of its turns takes 1d6 + your STR modifier bludgeoning damage from your retaliating plates.', prerequisite: 'Warforged' },
      { name: 'Enhanced Arcane Focus', desc: 'You can use your body as a spellcasting focus. You gain +1 to spell attack rolls, your spell save DC increases by 1, and your spells ignore the verbal/material components of any focus you would normally need to hold.', prerequisite: 'Warforged, spellcasting feature' },
      { name: 'Integrated Defense Protocol', desc: 'As a reaction when you take damage, you gain resistance to that damage type until the start of your next turn. You can use this a number of times equal to your proficiency bonus, regaining all uses on a short or long rest.', prerequisite: 'Warforged' },
      { name: 'Warforged Resilience', desc: 'Increase your Constitution by 1 (max 20). You have advantage on death saving throws, and on a successful death save you regain 1 hit point instead of merely stabilizing.', prerequisite: 'Warforged' },
      { name: 'Self-Repair Protocol', desc: 'As a bonus action you can spend one Hit Die to heal yourself, regaining HP equal to the die roll + your CON modifier. You can do this a number of times equal to your proficiency bonus per long rest.', prerequisite: 'Warforged' },
      { name: 'Overclocked Servos', desc: 'Increase your Dexterity or Constitution by 1 (max 20). Once per short rest you can take the Dash or Disengage action as a bonus action.', prerequisite: 'Warforged' },
      { name: 'Adamantine Core', desc: 'Increase your Constitution by 1 (max 20). You are immune to critical hits while you are not wearing armor other than your Composite Plating, as attacks glance off your hardened core.', prerequisite: 'Warforged' },
    ],
  },

  // ── NEW RACES ──────────────────────────────────────────────────────────────

  Aarakocra: {
    traits: ['Flight (50 ft fly speed, cannot wear medium/heavy armor to fly)', 'Talons (1d4 slashing unarmed strike)', 'Darkvision (60 ft)', 'Wind Caller (Gust of Wind 1/long rest at level 3)'],
    stat_bonuses: { dexterity: 2, wisdom: 1 },
    skill_proficiencies: ['Perception'],
    speed: 25, fly_speed: 50, size: 'Medium',
    languages: ['Common', 'Aarakocra', 'Auran'],
    description: 'Bird-folk from the Elemental Plane of Air who serve as scouts and messengers. Aarakocra soar above the clouds and are fiercely protective of their mountain homes. Their flight makes them exceptionally mobile — but they cannot wear medium or heavy armor while flying.',
    subraces: [],
  },

  Changeling: {
    traits: ['Shapechanger (change appearance as action: face, hair, voice, skin — but not equipment or size)', 'Changeling Instincts (proficiency in 2 of: Deception, Insight, Intimidation, Persuasion)', 'Unsettling Visage (reaction when hit: impose disadvantage on attacker\'s roll, 1/short rest)'],
    stat_bonuses: { charisma: 2 },
    stat_choices: 1,
    speed: 30, size: 'Medium',
    languages: ['Common', 'two extra languages'],
    description: 'Natural shapeshifters who can alter their appearance at will. Changelings are masters of disguise and social manipulation, blending seamlessly into any society. Their true form is whatever they choose it to be.',
    subraces: [
      { name: 'Traveler', stat_bonuses: { dexterity: 1 }, traits: ['Fluid Steps (Disengage as bonus action while transformed)', 'Mimicry (copy voices heard within 1 min; WIS Insight vs. Deception to detect)'], description: 'Changelings who wander the world, mastering movement and mimicry.' },
      { name: 'Pretender', stat_bonuses: { intelligence: 1 }, traits: ['False Memory (implant a false memory of you into one creature per short rest, WIS save DC 8+prof+CHA)', 'Social Chameleon (proficiency in Persuasion if not already)'], description: 'Changelings who specialize in long-term infiltration and social manipulation.' },
    ],
  },

  Goblin: {
    traits: ['Darkvision (60 ft)', 'Fury of the Small (once per short rest: add level to damage vs creature larger than you)', 'Nimble Escape (Disengage or Hide as bonus action)', 'Small (advantage squeezing through tight spaces)'],
    stat_bonuses: { dexterity: 2, constitution: 1 },
    speed: 30, size: 'Small',
    languages: ['Common', 'Goblin'],
    description: 'Cunning and small, goblins are survivors who thrive in the margins of society. Often dismissed as nuisances, goblins who turn their talents toward heroism prove to be nimble, resourceful, and surprisingly fierce.',
    subraces: [
      { name: 'Nilbog', stat_bonuses: { charisma: 1 }, traits: ['Nilbogism (when creature targets you with attack, it must make WIS save DC 8+prof+CHA or be forced to target another creature)', 'Trickster\'s Luck (advantage on Deception checks to create diversions)'], description: 'Goblins touched by the trickster spirit of the Nilbog — chaos incarnate.' },
      { name: 'Boggle', stat_bonuses: { intelligence: 1 }, traits: ['Oil Puddle (create slick oil puddle 5 ft as bonus action, lasts 1 minute; any creature moving through makes DC 12 DEX save or falls prone)', 'Dimensional Rift (teleport up to 30 ft 1/short rest)'], description: 'Goblins descended from boggle fey, capable of minor dimensional tricks.' },
    ],
  },

  Hobgoblin: {
    traits: ['Darkvision (60 ft)', 'Martial Training (light/medium armor + 2 martial weapons of choice)', 'Saving Face (add number of allies within 30 ft to a failed ability check/attack/save, 1/short rest)', 'Fey Ancestry (advantage on saves vs charmed, cannot be put to sleep by magic)'],
    stat_bonuses: { constitution: 2, intelligence: 1 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Goblin'],
    description: 'Disciplined and militaristic, hobgoblins are the soldiers of the goblinoid races. They prize order, strategy, and martial excellence above all else. Their military culture produces formidable warriors who fight with precision and coordination.',
    subraces: [
      { name: 'Devastator', stat_bonuses: { strength: 1 }, traits: ['Army Arcana (when you cast a spell, choose one ally — they gain 1d6 temp HP)', 'Battle Ready (use INT instead of STR or DEX for attack/damage rolls with magic weapons)'], description: 'Hobgoblin warmages who blend arcane power with military discipline.' },
      { name: 'Iron Shadows', stat_bonuses: { dexterity: 1 }, traits: ['Specialized Training (proficiency in Stealth and Acrobatics)', 'Infiltrator (Disguise Self 1/long rest; advantage on Stealth in dim light or darkness)'], description: 'Elite hobgoblin spies and assassins trained to operate behind enemy lines.' },
    ],
  },

  Kobold: {
    traits: ['Darkvision (60 ft)', 'Draconic Cry (bonus action: all enemies within 10 ft have disadvantage on saves vs your allies until start of your next turn, 1/short rest)', "Dragon's Gift (choose one: Draconic Resilience — +1 HP/level; or Draconic Senses — advantage on Perception; or Draconic Scales — +1 AC unarmored)", 'Pack Tactics (advantage on attacks vs creature if ally is adjacent to it and you are not incapacitated)'],
    stat_bonuses: { dexterity: 2, intelligence: 1 },
    speed: 30, size: 'Small',
    languages: ['Common', 'Draconic'],
    description: 'Small, cunning dragon-kin who combine pack tactics with a fierce survival instinct. Kobolds who overcome their cowardly reputation become clever and dangerous foes. Their deep connection to dragons fills them with either terror or ambition.',
    subraces: [
      { name: 'Dragonwrought', stat_bonuses: { charisma: 1 }, traits: ['Draconic Lineage (choose dragon type: gain resistance to its damage, breath weapon 2d6 in 15 ft cone/line, 1/long rest)'], description: 'Kobolds with a direct draconic bloodline who can breathe elemental energy.' },
      { name: 'Urds (Winged)', stat_bonuses: { wisdom: 1 }, traits: ['Flight (30 ft fly speed)', 'Sunlight Sensitivity (disadvantage on attack rolls and Perception in direct sunlight)'], description: 'Rare winged kobolds, shunned by their kin but gifted with flight.' },
    ],
  },

  Orc: {
    traits: ['Darkvision (60 ft)', 'Adrenaline Rush (Dash as bonus action; gain temp HP = proficiency bonus; usable proficiency bonus times per long rest)', 'Powerful Build (count as Large for carry/push/lift)', 'Relentless Endurance (when reduced to 0 HP, drop to 1 HP instead, 1/long rest)'],
    stat_bonuses: { strength: 2, constitution: 1 },
    skill_proficiencies: ['Intimidation'],
    speed: 30, size: 'Medium',
    languages: ['Common', 'Orc'],
    description: 'Powerful and driven, orcs have a long history as both warriors and survivors. Their great strength and relentless endurance make them formidable combatants. Orcs who find purpose in adventure bring that same ferocity to protecting their companions.',
    subraces: [
      { name: 'Gruumsh\'s Chosen', stat_bonuses: { wisdom: 1 }, traits: ['Eye of Gruumsh (if you have the Blinded condition while raging, you can still see normally; your eye glows red)', 'Orcish Fury (once per short rest: add one weapon die of extra damage on a hit)'], description: 'Orcs bearing the mark of their war god, with uncanny senses and savage fury.' },
      { name: 'Luthic\'s Blessed', stat_bonuses: { intelligence: 1 }, traits: ['Mending Claws (touch ally as action: heal 1d4+WIS mod HP, 2/long rest)', 'Cavern Delver (climb speed = walk speed; can move through difficult terrain made of stone without penalty)'], description: 'Orcs devoted to the cave mother, balancing orcish might with nurturing power.' },
    ],
  },

  Tiefling: {
    traits: ['Darkvision (60 ft)', 'Hellish Resistance (fire resistance)', 'Infernal Legacy (Thaumaturgy cantrip; Hellish Rebuke at 3rd; Darkness at 5th)'],
    stat_bonuses: { intelligence: 1, charisma: 2 },
    speed: 30, size: 'Medium',
    languages: ['Common', 'Infernal'],
    description: 'Touched by infernal magic, tieflings wield dark power. Though distrusted, their strength and magic are undeniable.',
    subraces: [
      { name: 'Asmodeus (Standard)', stat_bonuses: { intelligence: 1, charisma: 2 }, traits: ['Thaumaturgy cantrip', 'Hellish Rebuke (2nd level, 1/long rest)', 'Darkness (2nd level, 1/long rest)'], description: 'The classic tiefling lineage descended from the Lord of the Nine Hells.' },
      { name: 'Dispater', stat_bonuses: { dexterity: 1, charisma: 2 }, traits: ['Thaumaturgy cantrip', 'Disguise Self (1/long rest)', 'Detect Thoughts (1/long rest)'], description: 'Tieflings touched by the Iron Duke, masters of disguise and manipulation.' },
      { name: 'Fierna', stat_bonuses: { wisdom: 1, charisma: 2 }, traits: ['Friends cantrip', 'Charm Person (1/long rest)', 'Suggestion (1/long rest)'], description: 'Tieflings of Fierna\'s line, supernaturally persuasive and beguiling.' },
      { name: 'Glasya', stat_bonuses: { dexterity: 1, charisma: 2 }, traits: ['Minor Illusion cantrip', 'Disguise Self (1/long rest)', 'Invisibility (1/long rest)'], description: 'Tieflings of the Mistress of the Erinyes, skilled in illusion and escape.' },
      { name: 'Levistus', stat_bonuses: { constitution: 1, charisma: 2 }, traits: ['Ray of Frost cantrip', 'Armor of Agathys (1/long rest)', 'Darkness (1/long rest)'], description: 'Tieflings of the Lord of Stygia, cold-blooded and calculating.' },
      { name: 'Mammon', stat_bonuses: { intelligence: 1, charisma: 2 }, traits: ['Mage Hand cantrip', 'Tenser\'s Floating Disk (1/long rest)', 'Arcane Lock (1/long rest)'], description: 'Tieflings of the Lord of Minauros, gifted with arcane theft and acquisition.' },
      { name: 'Mephistopheles', stat_bonuses: { intelligence: 1, charisma: 2 }, traits: ['Mage Hand cantrip', 'Burning Hands (1/long rest)', 'Flame Blade (1/long rest)'], description: 'Tieflings of the Lord of Cania, masters of arcane flame.' },
      { name: 'Zariel', stat_bonuses: { strength: 1, charisma: 2 }, traits: ['Thaumaturgy cantrip', 'Searing Smite (1/long rest)', 'Branding Smite (1/long rest)'], description: 'Tieflings of the fallen angel Zariel, built for righteous warfare.' },
      { name: 'Baalzebul', stat_bonuses: { intelligence: 1, charisma: 2 }, traits: ['Thaumaturgy cantrip', 'Ray of Sickness (1/long rest)', 'Crown of Madness (1/long rest)'], description: 'Tieflings of the Lord of Flies, spreading corruption and madness.' },
    ],
  },

  Centaur: {
    traits: ['Equine Build (count as Large for carry; cannot mount other creatures)', 'Charge (if you move 30+ ft straight toward target and hit with melee, deal extra 1d6 damage)', 'Hooves (1d6+STR bludgeoning unarmed strike)', 'Natural Affinity (proficiency in one of: Animal Handling, Medicine, Nature, or Survival)'],
    stat_bonuses: { strength: 2, wisdom: 1 },
    skill_proficiencies: ['Survival'],
    speed: 40, size: 'Medium',
    languages: ['Common', 'Sylvan'],
    description: 'Half-humanoid, half-horse beings who roam open plains and deep forests. Centaurs are proud, fierce, and deeply connected to the natural world. Their powerful frames and charging attack make them fearsome in open combat.',
    subraces: [
      { name: 'Lagonna-Band', stat_bonuses: { wisdom: 1 }, traits: ['Lore of the Lagonna (proficiency in History and Medicine)', 'Seer\'s Gallop (Diviniation cantrip of your choice)'], description: 'Diplomatic centaurs of the white band, scholars and lorekeepers.' },
      { name: 'Pheres-Band', stat_bonuses: { strength: 1 }, traits: ['Warrior\'s Gallop (bonus action: move up to 10 ft toward an enemy after making a melee attack)', 'Trampling Charge (when you use Charge, target must make STR save DC 8+prof+STR or be knocked prone)'], description: 'Warlike centaurs of the red band, raiders and fierce warriors.' },
    ],
  },

  Leonin: {
    traits: ['Darkvision (60 ft)', 'Claws (1d4+STR slashing unarmed strike; climb speed 20 ft)', "Daunting Roar (bonus action: all creatures within 10 ft must make WIS save DC 8+prof+CON or be frightened until end of your next turn; 1/short rest)", "Hunter's Instincts (proficiency in one of: Athletics, Intimidation, Perception, or Survival)"],
    stat_bonuses: { constitution: 2, strength: 1 },
    skill_proficiencies: ['Intimidation'],
    speed: 35, size: 'Medium',
    languages: ['Common', 'Leonin'],
    description: 'Proud lion-folk who guard the sun-drenched plains of their homeland. Leonin are fierce protectors who value strength, community, and honor above all else. Their terrifying roar and powerful claws make them natural warriors and leaders.',
    subraces: [],
  },

  Harengon: {
    traits: ['Hare-Trigger (add proficiency bonus to Initiative rolls)', 'Leporine Senses (proficiency in Perception)', 'Lucky Footwork (when you fail a DEX saving throw, use your reaction to add 1d4 to the roll — possibly turning the failure into a success)', 'Rabbit Hop (bonus action jump = proficiency bonus × 5 ft without triggering opportunity attacks; usable proficiency bonus times per long rest)'],
    stat_bonuses: { dexterity: 2 },
    stat_choices: 1,
    skill_proficiencies: ['Perception'],
    speed: 30, size: 'Medium',
    languages: ['Common', 'Sylvan'],
    description: 'Rabbit-folk from the Feywild who bounded into the material plane full of energy and curiosity. Harengon are alert, quick, and blessed with supernatural luck — their powerful legs let them leap out of danger in an instant.',
    subraces: [],
  },

  Owlin: {
    traits: ['Flight (fly speed = walking speed; cannot wear medium/heavy armor and fly)', 'Darkvision (120 ft)', 'Keen Senses (proficiency in Perception)', 'Silent Feathers (proficiency in Stealth)'],
    stat_bonuses: { wisdom: 2 },
    stat_choices: 1,
    skill_proficiencies: ['Perception', 'Stealth'],
    fly_speed: 30, speed: 30, size: 'Medium',
    languages: ['Common', 'Auran', 'one extra'],
    description: 'Owl-folk from the Feywild who value silence, wisdom, and the night. Owlin glide soundlessly through darkness on powerful wings, using keen senses to hunt and observe. Their exceptional darkvision and innate stealth make them exceptional scouts and rangers.',
    subraces: [],
  },

  Bugbear: {
    traits: ['Darkvision (60 ft)', 'Long-Limbed (melee reach is 5 ft greater than size on first round of combat)', 'Powerful Build (count as Large for carry/push/lift)', 'Sneaky (proficiency in Stealth)', 'Surprise Attack (extra 2d6 damage on first hit against creature that has not yet taken a turn in combat)'],
    stat_bonuses: { strength: 2, dexterity: 1 },
    skill_proficiencies: ['Stealth'],
    speed: 30, size: 'Medium',
    languages: ['Common', 'Goblin'],
    description: 'Hulking, hairy goblinoids who are master ambushers. Bugbears combine surprising stealth with savage strength, making them terrifying hunters. Despite their brutish reputation, bugbears are patient stalkers who prefer to strike from hiding.',
    subraces: [],
  },

  'Ogrekin (Half-Ogre)': {
    traits: ['Powerful Build (count as Large for carry/push/lift; advantage on STR checks and saves)', 'Natural Armor (AC = 11 + CON modifier when unarmored)', 'Ogre Resilience (resistance to bludgeoning damage)', 'Savage Slam (1d8+STR bludgeoning unarmed strike)', 'Intimidating Presence (proficiency in Intimidation; when you make a Intimidation check, add CON modifier on top of CHA modifier)'],
    stat_bonuses: { strength: 2, constitution: 2 },
    speed: 30, size: 'Large',
    languages: ['Common', 'Giant'],
    description: 'Half-ogre humanoids who combine ogre brawn with human wit. Ogrekin are massive and powerful, their natural armor and savage strength making them walking fortresses. Often outcasts from both societies, those who find their place among adventurers become invaluable front-line powerhouses.',
    subraces: [
      { name: 'Hill Ogrekin', stat_bonuses: { constitution: 1 }, traits: ['Toughened Hide (Natural Armor AC increases by +1)', 'Regeneration (regain 1 HP at the start of your turn if you have at least 1 HP remaining; only while below half max HP)'], description: 'Ogrekin with the thickest hides, almost trollish in their resilience.' },
      { name: 'Stone Ogrekin', stat_bonuses: { strength: 1 }, traits: ['Rock Throw (ranged attack: 30/60 ft, 2d6+STR bludgeoning; can use any rock or debris as improvised weapon without penalty)', 'Earthen Stomp (melee attack: all creatures within 5 ft must make DEX save DC 8+prof+STR or fall prone, 1/short rest)'], description: 'Ogrekin descended from stone ogre lines, hurling boulders and shaking the earth.' },
    ],
  },
};
 
export const CLASSES = {
  Fighter: {
    hit_die: 10, primary_stat: 'strength', saves: ['strength', 'constitution'],
    armor_prof: ['all armor', 'shields'], weapon_prof: ['simple weapons', 'martial weapons'],
    skills: ['Athletics', 'Acrobatics', 'Animal Handling', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    skill_count: 2,
    subclasses: [
      { name: 'Champion', desc: 'The straightforward path of raw physical excellence. Improved Critical lets you score critical hits on a roll of 19-20 (18-20 at 15th level), Remarkable Athlete adds half your proficiency to physical checks and improves your running jumps, and an Additional Fighting Style broadens your battlefield versatility — capped by Survivor, which regenerates HP each turn in the thick of combat.', features: { 3: ['Improved Critical (crit on 19-20)'], 7: ['Remarkable Athlete (+½ prof to STR/DEX/CON checks, better jumps)'], 10: ['Additional Fighting Style'], 15: ['Superior Critical (crit on 18-20)'], 18: ['Survivor (regain 5+CON HP each turn while below half HP)'] } },
      { name: 'Battle Master', desc: 'The tactician\'s archetype, built around Superiority Dice (start with 4d8) that fuel Maneuvers — Trip Attack, Disarm, Riposte, Commander\'s Strike, Precision Attack and more. Student of War grants an artisan\'s tool proficiency, Know Your Enemy reads a foe\'s strengths, and your dice grow to d10s then d12s as you master the art of war.', features: { 3: ['Combat Superiority (4d8, 3 maneuvers)', 'Student of War'], 7: ['Know Your Enemy', 'Superiority Dice (5d8)'], 10: ['Improved Combat Superiority (d10)', 'Extra Maneuvers'], 15: ['Relentless (regain 1 die when you roll initiative with none)'], 18: ['Improved Combat Superiority (d12)'] } },
      { name: 'Eldritch Knight', desc: 'A martial spellblade blending steel and arcane magic. You learn Wizard spells (focused on Abjuration & Evocation), forge a Weapon Bond so your blade can never be disarmed and returns to your hand, and gain War Magic to cast a cantrip and attack in the same turn — culminating in Eldritch Strike (your hits weaken enemy saves) and a second bonded weapon attack.', features: { 3: ['Spellcasting (INT, Abjuration & Evocation)', 'Weapon Bond'], 7: ['War Magic (cantrip + weapon attack as bonus action)'], 10: ['Eldritch Strike (your hits give enemies disadvantage on your next spell save)'], 15: ['Arcane Charge (teleport 30 ft when you Action Surge)'], 18: ['Improved War Magic (cast a 1st-level spell + attack)'] } },
      { name: 'Cavalier', desc: 'A guardian of the saddle and protector of allies. Born to the Saddle keeps you mounted and mobile, Unwavering Mark punishes enemies who ignore you and dare to strike your friends, Warding Maneuver lets you shield an ally as a reaction, and later features make you nearly impossible to knock down or move against your will.', features: { 3: ['Born to the Saddle', 'Unwavering Mark (mark foes; punish them for attacking others)', 'Bonus Proficiency'], 7: ['Warding Maneuver (reaction: add 1d8 to ally AC + reduce damage)'], 10: ['Hold the Line (enemies provoke when they move near you; their speed drops to 0 on a hit)'], 15: ['Ferocious Charger (knock prone after a 10+ ft charge)'], 18: ['Vigilant Defender (a reaction opportunity attack against every other creature\'s turn)'] } },
      { name: 'Samurai', desc: 'A disciplined warrior of indomitable focus. Fighting Spirit grants advantage on attacks and temporary HP as a bonus action, Elegant Courtier adds Wisdom to a Charisma save and grants a social proficiency, Rapid Strike trades advantage for an extra attack, and Strength Before Death lets you defy a killing blow with one final flurry of action.', features: { 3: ['Fighting Spirit (3/long rest: advantage on attacks + temp HP)', 'Bonus Proficiency'], 7: ['Elegant Courtier (add WIS to a CHA save; proficiency in Persuasion/Wisdom)'], 10: ['Tireless Spirit (regain a Fighting Spirit use on initiative)'], 15: ['Rapid Strike (trade advantage for one extra attack)'], 18: ['Strength Before Death (reaction at 0 HP: take a full turn before falling)'] } },
      { name: 'Arcane Archer', desc: 'A ranger-mage of the bow who infuses arrows with magic. Choose Arcane Shot options — Banishing, Bursting, Grasping, Piercing, Seeking and more — fired 2/short rest, gain Arcane Archer Lore (a skill or Druidcraft/Prestidigitation cantrip), Curving Shot to redirect a missed magic arrow, and Magic Arrow making every arrow magical and able to seek targets behind cover.', features: { 3: ['Arcane Archer Lore', 'Arcane Shot (2 options, 2/short rest)'], 7: ['Curving Shot (reroll a missed magic-arrow at another target)', 'Magic Arrow (all arrows count as magical)'], 10: ['Extra Arcane Shot option', 'Ever-Ready Shot (regain a use on initiative)'], 15: ['Additional Arcane Shot option'], 18: ['Improved Shots (+2d6 to all Arcane Shot damage)'] } },
      { name: 'Psi Warrior', desc: 'A fighter awakened to latent psionic power, channeling the mind as a weapon. You gain Psionic Energy Dice that fuel Protective Field (reduce damage to yourself or an ally), Psionic Strike (bonus force damage on a hit), and Telekinetic Movement (move objects and creatures). Higher levels grant a psionic step, telekinetic flight, and the power to deflect attacks with your mind.', features: { 3: ['Psionic Power (Energy Dice)', 'Protective Field', 'Psionic Strike', 'Telekinetic Movement'], 7: ['Telekinetic Adept (Psi-Powered Leap + Telekinetic Thrust)'], 10: ['Guarded Mind (resistance to psychic damage; end charm/fright by spending a die)'], 15: ['Bulwark of Force (grant yourself/allies half cover as a bonus action)'], 18: ['Telekinetic Master (cast Telekinesis at will; bonus attack while concentrating)'] } },
      { name: 'Rune Knight', desc: 'A fighter who masters giant runes to enhance body and gear. Inscribe magical Runes (Cloud, Fire, Frost, Stone, Storm, Hill) onto equipment for passive and activated boons, grow to Large size with Giant\'s Might for bonus damage and advantage on Strength, hurl enemies with Runic Shield and Great Stature, and ultimately master every rune at once.', features: { 3: ['Bonus Proficiencies (smith\'s tools, Giant language)', 'Rune Carver (2 runes)', "Giant's Might (grow Large, +1d6 damage 1/turn, advantage on STR)"], 7: ['Runic Shield (reaction: force an attacker to reroll a hit)', 'Additional Rune'], 10: ['Great Stature (permanent height + Giant\'s Might damage is 1d8)'], 15: ['Master of Runes (invoke each rune twice per rest)'], 18: ['Runic Juggernaut (Giant\'s Might makes you Huge, +1d10 damage, +5 ft reach)'] } },
      { name: 'Echo Knight', desc: 'A warrior who summons a spectral duplicate from a war-torn dimension. Manifest Echo creates a ghostly double you can attack through, swap places with, and strike around corners. Unleash Incarnation grants an extra attack through your echo, while later levels let you teleport, shield yourself, and even briefly conjure two echoes at once.', features: { 3: ['Manifest Echo (summon a spectral double; attack + move through it)', 'Unleash Incarnation (extra attack through the echo)'], 7: ['Echo Avatar (see/hear through your echo up to 1,000 ft)'], 10: ['Shadow Martyr (echo intercepts an attack on an ally)'], 15: ['Reclaim Potential (gain temp HP when your echo is destroyed)'], 18: ['Legion of One (manifest two echoes; regain Unleash uses on initiative)'] } },
      { name: 'Purple Dragon Knight (Banneret)', desc: 'An inspiring battlefield commander who empowers allies. Rallying Cry shares your Second Wind healing with nearby companions, Royal Envoy grants expertise in Persuasion, Inspiring Surge lets allies act when you Action Surge, and Bulwark extends Indomitable to a friend — a leader who makes the whole party stronger.', features: { 3: ['Rallying Cry (Second Wind also heals 3 allies for your level)', 'Bonus Proficiency'], 7: ['Royal Envoy (expertise in Persuasion; extra social proficiency)'], 10: ['Inspiring Surge (Action Surge grants an ally an extra attack)'], 15: ['Bulwark (share Indomitable rerolls with an ally)'], 18: ['Improved Inspiring Surge (aid two allies)'] } },
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
      { name: 'Scout', desc: 'Skirmisher (move half speed as reaction when enemy ends turn next to you). Survivalist (Nature + Survival proficiency and expertise). Superior Mobility. Ambush Master. Sudden Strike.', features: { 3: ['Skirmisher', 'Survivalist'], 9: ['Superior Mobility'], 13: ['Ambush Master'], 17: ['Sudden Strike'] } },
      { name: 'Mastermind', desc: 'Master of Intrigue (disguise kit + forgery kit + gaming set proficiency; mimic accents). Master of Tactics (Help as bonus action, 30 ft range). Misdirection. Soul of Deceit.', features: { 3: ['Master of Intrigue', 'Master of Tactics'], 9: ['Misdirection'], 13: ['Soul of Deceit'] } },
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
      { name: 'College of Whispers', desc: 'Psychic Blades (extra 2d6 psychic on Sneak Attack). Words of Terror (frighten creature with conversation). Mantle of Whispers (steal shadow/identity of dying humanoid). Shadow Lore.', features: { 3: ['Psychic Blades', 'Words of Terror'], 6: ['Mantle of Whispers'], 14: ['Shadow Lore'] } },
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
      { name: 'Circle of Dreams', desc: 'Balm of the Summer Court (pool of d6s = ½ level; heal + bonus movement as bonus action). Hearth of Moonlight and Shadow (short rest creates magical campsite). Hidden Paths (teleport). Walker in Dreams.', features: { 2: ['Balm of the Summer Court'], 6: ['Hearth of Moonlight and Shadow'], 10: ['Hidden Paths'], 14: ['Walker in Dreams'] } },
      { name: 'Circle of the Shepherd', desc: 'Speech of the Woods (Sylvan + speak with animals at will). Spirit Totem (summon spirit aura: Bear/Hawk/Unicorn). Mighty Summoner (+2 HP per HD to summoned creatures). Guardian Spirit. Faithful Summons.', features: { 2: ['Speech of the Woods', 'Spirit Totem'], 6: ['Mighty Summoner'], 10: ['Guardian Spirit'], 14: ['Faithful Summons'] } },
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
      { name: 'Way of the Drunken Master', desc: 'Drunken Technique (Tumble: Disengage + extra 10 ft on Flurry). Tipsy Sway (redirect attacks to other targets). Drunkard\'s Luck (reroll saves/attacks/checks 1/long rest). Intoxicated Frenzy (extra Flurry strikes).', features: { 3: ['Drunken Technique'], 6: ['Tipsy Sway'], 11: ["Drunkard's Luck"], 17: ['Intoxicated Frenzy'] } },
      { name: 'Way of the Long Death', desc: 'Touch of Death (gain temp HP when you kill, = WIS + monk level). Hour of Reaping (cause fear aura). Mastery of Death (spend 1 Ki to avoid death). Touch of the Long Death (spend 1-10 Ki for 2d10 necrotic per Ki).', features: { 3: ['Touch of Death'], 6: ['Hour of Reaping'], 11: ['Mastery of Death'], 17: ['Touch of the Long Death'] } },
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
      { name: 'Shadow Magic', desc: 'Eyes of the Dark (Darkness spell 1/long rest; cast it using 2 sorcery points with see-through ability). Strength of the Grave (save to stay at 1 HP). Hound of Ill Omen (summon shadow mastiff). Shadow Walk. Umbral Form.', features: { 1: ['Eyes of the Dark', 'Strength of the Grave'], 6: ['Hound of Ill Omen'], 14: ['Shadow Walk'], 18: ['Umbral Form'] } },
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
      { name: 'The Celestial', desc: "Expanded Spell List (healing + radiant spells). Healing Light (pool of d6s = 1+warlock level; heal as bonus action). Radiant Soul (+CHA radiant/fire damage). Celestial Resilience (temp HP on short rest). Searing Vengeance.", features: { 1: ['Expanded Spell List', 'Healing Light'], 6: ['Radiant Soul'], 10: ['Celestial Resilience'], 14: ['Searing Vengeance'] } },
      { name: 'The Hexblade', desc: 'Hexblade\'s Curse (curse target: +proficiency to damage, crit on 19-20, regain HP if it dies). Hex Warrior (CHA instead of STR/DEX for one weapon). Accursed Specter. Armor of Hexes. Master of Hexes.', features: { 1: ["Hexblade's Curse", 'Hex Warrior'], 6: ['Accursed Specter'], 10: ['Armor of Hexes'], 14: ['Master of Hexes'] } },
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
  { name: 'Pirate', skills: ['Athletics', 'Perception'], feature: "Bad Reputation (people fear you; can get away with minor criminal acts in port towns)", equipment: ['Belaying pin', 'Silk rope 50ft', '10 gp'], tool_profs: ["Navigator's tools", 'vehicles (water)'] },
  { name: 'Knight', skills: ['History', 'Persuasion'], feature: 'Retainers (2 loyal commoners and 1 noble squire serve you)', equipment: ['Fine clothes', 'Signet ring', 'Banner', '25 gp'], tool_profs: ['one gaming set'], languages: 1 },
  { name: 'Gladiator', skills: ['Acrobatics', 'Performance'], feature: 'By Popular Demand (can always find food/lodging in exchange for performances)', equipment: ['Inexpensive but unusual weapon', 'Costume', '15 gp'], tool_profs: ['disguise kit', 'one musical instrument'] },
  { name: 'Haunted One', skills: ['Arcana', 'Survival'], feature: 'Heart of Darkness (commoners do your bidding out of fear; monster hunters seek you out)', equipment: ['Monster hunter\'s pack', 'Holy symbol', '1 gp'], tool_profs: [], languages: 2 },
  { name: 'Far Traveler', skills: ['Insight', 'Perception'], feature: 'All Eyes on You (local rulers/scholars/merchants want to know where you\'re from)', equipment: ['Traveler\'s clothes', 'Maps of your homeland', '10 gp'], tool_profs: ['one musical instrument or gaming set'], languages: 1 },
  { name: 'Anthropologist', skills: ['Insight', 'Religion'], feature: 'Adept Linguist (communicate with any humanoid through gestures and expressions)', equipment: ['Leather-bound diary', 'Ink and quill', 'Trinket', '10 gp'], tool_profs: [], languages: 2 },
  { name: 'City Watch', skills: ['Athletics', 'Insight'], feature: 'Watcher\'s Eye (easily find city watch posts; can navigate criminal organizations)', equipment: ['Uniform', 'Manacles', '10 gp'], tool_profs: [], languages: 2 },
  { name: 'Mercenary Veteran', skills: ['Athletics', 'Persuasion'], feature: 'Mercenary Life (recall any mercenary company you\'ve heard of; always find work)', equipment: ['Uniform', 'Insignia of rank', 'Gaming set', '10 gp'], tool_profs: ['vehicles (land)', 'one gaming set'] },
  { name: 'Clan Crafter', skills: ['History', 'Insight'], feature: 'Respect of the Stout Folk (free lodging among dwarves; 50% discount on artisan goods)', equipment: ["Maker's mark chisel", 'Traveler\'s clothes', '5 gp gem', '10 gp'], tool_profs: ["one artisan's tools"], languages: 1 },
  { name: 'Investigator', skills: ['Insight', 'Investigation'], feature: 'Official Inquiry (access restricted areas; compel testimony from witnesses)', equipment: ['Magnifying glass', 'Notebook', 'Manacles', '10 gp'], tool_profs: [], languages: 2 },
  { name: 'Archaeologist', skills: ['History', 'Survival'], feature: 'Historical Knowledge (identify the age and origin of ancient objects and ruins)', equipment: ['Hooded lantern', 'Miner\'s pick', 'Traveler\'s clothes', '25 gp'], tool_profs: ["Cartographer's tools or navigator's tools"], languages: 1 },
  { name: 'Witchlight Hand', skills: ['Performance', 'Sleight of Hand'], feature: 'Carnival Familiar (pass through any carnival for free; recognized by other carnival folk)', equipment: ['Disguise kit', 'Musical instrument', 'Carnival ticket', '8 gp'], tool_profs: ['disguise kit', 'one musical instrument'] },
  { name: 'Ruined', skills: ['Deception', 'Survival'], feature: 'Favor of the Fallen (desperate people help you; the forgotten share information with you)', equipment: ['Signet ring of lost house', 'Tattered noble clothes', '3 gp'], tool_profs: [], languages: 1 },
];
 
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const PROFICIENCY_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
 
export const calcStatMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
export const calcModDisplay = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
export const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Artificer'];
 
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
 
// ─── Exhaustion (PHB p.291) ──────────────────────────────────────────────────
// Cumulative levels 1-6. Each level includes the effects of all lower levels.
export const EXHAUSTION_EFFECTS = [
  { level: 0, label: 'None', effects: [] },
  { level: 1, label: 'Exhaustion 1', effects: ['Disadvantage on ability checks'] },
  { level: 2, label: 'Exhaustion 2', effects: ['Disadvantage on ability checks', 'Speed halved'] },
  { level: 3, label: 'Exhaustion 3', effects: ['Disadvantage on ability checks', 'Speed halved', 'Disadvantage on attack rolls and saving throws'] },
  { level: 4, label: 'Exhaustion 4', effects: ['Disadvantage on ability checks', 'Speed halved', 'Disadvantage on attacks & saves', 'HP maximum halved'] },
  { level: 5, label: 'Exhaustion 5', effects: ['Disadvantage on ability checks', 'Speed reduced to 0', 'Disadvantage on attacks & saves', 'HP maximum halved'] },
  { level: 6, label: 'Exhaustion 6', effects: ['Death'] },
];

// Returns which roll categories suffer disadvantage at a given exhaustion level.
export function exhaustionRollPenalties(level) {
  const lvl = Math.max(0, Math.min(6, level || 0));
  return {
    ability_checks: lvl >= 1, // includes skills
    attacks: lvl >= 3,
    saves: lvl >= 3,
  };
}

// Effective speed after exhaustion: halved at 2-4, 0 at 5+.
export function exhaustionEffectiveSpeed(baseSpeed, level) {
  const lvl = Math.max(0, Math.min(6, level || 0));
  if (lvl >= 5) return 0;
  if (lvl >= 2) return Math.floor((baseSpeed || 30) / 2);
  return baseSpeed || 30;
}

// Effective max HP after exhaustion: halved at 4+.
export function exhaustionEffectiveMaxHP(baseMaxHP, level) {
  const lvl = Math.max(0, Math.min(6, level || 0));
  if (lvl >= 4) return Math.floor((baseMaxHP || 0) / 2);
  return baseMaxHP || 0;
}

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
// PHB p.175: a passive check is 10 + all modifiers. If the character has
// advantage on the check, add 5; if disadvantage, subtract 5.
export function calcPassiveScore(character, skill, { advantage = false, disadvantage = false } = {}) {
  const stat    = SKILL_STAT_MAP[skill];
  const mod     = calcStatMod(character[stat]);
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  const skills  = character.skills || {};
  const profLevel = skills[skill];
  const hasExpertise = skills[`${skill}_expertise`];
 
  // Bard level 2+: Jack of All Trades — add half proficiency (rounded down)
  // to any ability check not already using proficiency (PHB p.54)
  const isJoat = character.class === 'Bard' && (character.level || 1) >= 2;
 
  let profContrib = 0;
  if (hasExpertise)                              profContrib = profBonus * 2;
  else if (profLevel === 'proficient' || profLevel === true) profContrib = profBonus;
  else if (isJoat)                               profContrib = Math.floor(profBonus / 2);
 
  // Advantage/disadvantage modify passive scores by ±5 (they cancel if both apply)
  let advMod = 0;
  if (advantage && !disadvantage) advMod = 5;
  else if (disadvantage && !advantage) advMod = -5;
 
  return 10 + mod + profContrib + advMod;
}
 
// ─── Carry Capacity ──────────────────────────────────────────────────────────
export function calcCarryCapacity(character) {
  const baseCapacity = (character.strength || 10) * 15;
  // Powerful Build (Goliath, Firbolg) — count as one size larger for carry capacity
  if (['Goliath', 'Firbolg'].includes(character.race)) {
    return baseCapacity * 2;
  }
  return baseCapacity;
}
 
export function getEncumbrance(character) {
  const inv = character.inventory || [];
  const totalWeight = inv.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);
  const cap = calcCarryCapacity(character);
  if (totalWeight > cap) return { level: 'heavily', label: 'Heavily Encumbered', penalty: '-20 ft speed, disadvantage STR/DEX/CON checks' };
  if (totalWeight > cap * 0.666) return { level: 'encumbered', label: 'Encumbered', penalty: '-10 ft speed' };
  return { level: 'normal', label: 'Unencumbered', penalty: null };
}

// ─── Racial Ability Helpers ─────────────────────────────────────────────────
export function getRacialAbilities(race) {
  const raceData = RACES[race];
  if (!raceData) return [];
  
  const abilities = [];
  
  // Warforged-specific abilities — surface all base traits, the chosen variant, and Warforged feats
  if (race === 'Warforged') {
    abilities.push({
      name: 'Constructed Resilience',
      desc: 'Advantage on saves vs being poisoned; resistance to poison damage; immune to disease; no need to eat, drink, or breathe; immune to magical sleep.',
      type: 'passive'
    });
    abilities.push({
      name: "Sentry's Rest",
      desc: 'Long rest in a 6-hour inactive but conscious state — you remain aware of your surroundings and gain the full benefits of a long rest without sleeping.',
      type: 'passive'
    });
    abilities.push({
      name: 'Integrated Protection',
      desc: 'Unarmored AC = 11 + DEX modifier. Armor merges into your body over 1 hour and cannot be removed against your will.',
      type: 'passive'
    });
    abilities.push({
      name: 'Composite Plating',
      desc: 'Your natural plating counts as worn armor; while not wearing other armor you gain a +1 bonus to AC (stacks with Integrated Protection).',
      type: 'passive'
    });
    abilities.push({
      name: 'Specialized Design',
      desc: 'Proficiency in one skill and one tool of your choice, reflecting your original purpose.',
      type: 'passive'
    });
    abilities.push({
      name: 'Tireless Construct',
      desc: 'You cannot gain exhaustion from lack of sleep, and forced-march fatigue affects you at half rate.',
      type: 'passive'
    });
    return abilities;
  }

  // Tortle-specific abilities
  if (race === 'Tortle') {
    abilities.push({
      name: 'Natural Armor',
      desc: 'AC 17 (cannot wear armor)',
      type: 'passive'
    });
    abilities.push({
      name: 'Shell Defense',
      desc: 'Bonus action: withdraw into shell. AC becomes 19, prone, speed 0, advantage on STR/CON saves. Use your action to emerge.',
      type: 'bonus_action',
      usage: 'at-will'
    });
    abilities.push({
      name: 'Claws',
      desc: '1d4 slashing unarmed attack',
      type: 'attack'
    });
    abilities.push({
      name: 'Hold Breath',
      desc: 'Can hold breath for up to 1 hour',
      type: 'passive'
    });
  }
  
  return abilities;
}