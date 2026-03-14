/**
 * D&D 5E Item System
 * Full item rarity, equip slots, magical properties per SRD rules
 */

// ─── Rarity System ────────────────────────────────────────────────────────────
export const ITEM_RARITY = {
  common:    { label: 'Common',    color: '#9ca3af', glow: 'rgba(156,163,175,0.3)', border: 'rgba(156,163,175,0.25)', icon: '⚪' },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', glow: 'rgba(74,222,128,0.3)',  border: 'rgba(74,222,128,0.25)',  icon: '🟢' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: 'rgba(96,165,250,0.3)',  border: 'rgba(96,165,250,0.25)',  icon: '🔵' },
  epic:      { label: 'Epic',      color: '#c084fc', glow: 'rgba(192,132,252,0.35)', border: 'rgba(192,132,252,0.3)', icon: '🟣' },
  legendary: { label: 'Legendary', color: '#fb923c', glow: 'rgba(251,146,60,0.4)',  border: 'rgba(251,146,60,0.3)',  icon: '🟠' },
  artifact:  { label: 'Artifact',  color: '#f0c040', glow: 'rgba(240,192,64,0.5)',  border: 'rgba(240,192,64,0.4)',  icon: '⭐' },
  wondrous:  { label: 'Wondrous',  color: '#f472b6', glow: 'rgba(244,114,182,0.35)', border: 'rgba(244,114,182,0.3)', icon: '✨' },
};

// ─── Equipment Slots (D&D 5E rules) ───────────────────────────────────────────
// Rules: 1 armor, 1 shield, 2 rings, 1 amulet/necklace, 1 cloak, 1 helmet,
//        1 gloves, 1 boots, 1 belt, 2 weapons (main + offhand) or 1 two-handed
export const EQUIP_SLOTS = {
  mainhand:  { label: 'Main Hand',   icon: '⚔️',  max: 1 },
  offhand:   { label: 'Off Hand',    icon: '🛡️',  max: 1 },
  armor:     { label: 'Armor',       icon: '🥋',  max: 1 },
  helmet:    { label: 'Helmet',      icon: '⛑️',  max: 1 },
  cloak:     { label: 'Cloak',       icon: '🧥',  max: 1 },
  gloves:    { label: 'Gloves',      icon: '🧤',  max: 1 },
  boots:     { label: 'Boots',       icon: '👢',  max: 1 },
  belt:      { label: 'Belt',        icon: '🔗',  max: 1 },
  ring:      { label: 'Ring',        icon: '💍',  max: 2 },
  amulet:    { label: 'Amulet',      icon: '📿',  max: 1 },
  trinket:   { label: 'Trinket',     icon: '🔮',  max: 1 },
};

// ─── Item Category → Default Slot mapping ─────────────────────────────────────
export const CATEGORY_TO_SLOT = {
  'Weapon':           'mainhand',
  'Armor':            'armor',
  'Shield':           'offhand',
  'Helmet':           'helmet',
  'Cloak':            'cloak',
  'Gloves':           'gloves',
  'Boots':            'boots',
  'Belt':             'belt',
  'Ring':             'ring',
  'Amulet':           'amulet',
  'Wondrous Item':    'trinket',
  'Potion':           null,  // not equipped
  'Ammunition':       null,
  'Tool':             null,
  'Adventuring Gear': null,
  'Other':            null,
};

export const ALL_ITEM_CATEGORIES = [
  'Weapon', 'Armor', 'Shield', 'Helmet', 'Cloak', 'Gloves', 'Boots', 'Belt',
  'Ring', 'Amulet', 'Wondrous Item', 'Potion', 'Ammunition', 'Tool', 'Adventuring Gear', 'Other'
];

export const CATEGORY_ICONS = {
  Weapon: '⚔️', Armor: '🥋', Shield: '🛡️', Helmet: '⛑️', Cloak: '🧥',
  Gloves: '🧤', Boots: '👢', Belt: '🔗', Ring: '💍', Amulet: '📿',
  'Wondrous Item': '✨', Potion: '🧪', Ammunition: '🏹', Tool: '🔧',
  'Adventuring Gear': '🎒', Other: '📦',
};

// ─── Weapon Properties ────────────────────────────────────────────────────────
export const WEAPON_PROPERTIES = [
  'Finesse', 'Light', 'Heavy', 'Thrown', 'Reach', 'Versatile',
  'Two-Handed', 'Loading', 'Ammunition', 'Range', 'Special',
];

// Two-handed weapons block the offhand slot
export const TWO_HANDED_WEAPONS = ['Greatsword', 'Greataxe', 'Maul', 'Halberd', 'Glaive', 'Pike', 'Lance', 'Longbow', 'Heavy Crossbow'];

// ─── Armor Types ──────────────────────────────────────────────────────────────
export const ARMOR_TYPES = {
  light:   { label: 'Light Armor',  dex_cap: null, stealth_dis: false },
  medium:  { label: 'Medium Armor', dex_cap: 2,    stealth_dis: true  },
  heavy:   { label: 'Heavy Armor',  dex_cap: 0,    stealth_dis: true  },
  shield:  { label: 'Shield',       dex_cap: null, stealth_dis: false },
};

// ─── Magic Properties ─────────────────────────────────────────────────────────
export const MAGIC_PROPERTIES = {
  // Offensive
  '+1_weapon':          { label: '+1 Magic Weapon',    desc: '+1 to attack and damage rolls.',              effect: { attack_bonus: 1, damage_bonus: 1 } },
  '+2_weapon':          { label: '+2 Magic Weapon',    desc: '+2 to attack and damage rolls.',              effect: { attack_bonus: 2, damage_bonus: 2 } },
  '+3_weapon':          { label: '+3 Magic Weapon',    desc: '+3 to attack and damage rolls.',              effect: { attack_bonus: 3, damage_bonus: 3 } },
  'vorpal':             { label: 'Vorpal',              desc: 'Severs head on a natural 20 (if creature has one).', effect: { vorpal: true } },
  'sharpness':          { label: 'Sharpness',          desc: 'Ignore resistances to slashing damage.',      effect: { ignore_resistance: 'slashing' } },
  'flaming':            { label: 'Flaming',             desc: '+1d6 fire damage on each hit.',               effect: { extra_damage: '1d6', extra_damage_type: 'fire' } },
  'frost':              { label: 'Frost',               desc: '+1d6 cold damage on each hit.',               effect: { extra_damage: '1d6', extra_damage_type: 'cold' } },
  'shock':              { label: 'Shock',               desc: '+1d6 lightning damage on each hit.',          effect: { extra_damage: '1d6', extra_damage_type: 'lightning' } },
  'venom':              { label: 'Venom',               desc: '+1d4 poison damage on each hit. Target makes CON DC 13 or is Poisoned.', effect: { extra_damage: '1d4', extra_damage_type: 'poison', save_dc: 13, save_stat: 'constitution', condition: 'poisoned' } },
  'thunderstrike':      { label: 'Thunderstrike',      desc: '+2d6 thunder damage. On crit: target is deafened for 1 min.', effect: { extra_damage: '2d6', extra_damage_type: 'thunder' } },
  'radiant_burst':      { label: 'Radiant Burst',      desc: '+1d8 radiant damage. Undead take double.', effect: { extra_damage: '1d8', extra_damage_type: 'radiant' } },
  'soul_drain':         { label: 'Soul Drain',         desc: '+1d6 necrotic damage. You regain HP equal to the necrotic dealt.', effect: { extra_damage: '1d6', extra_damage_type: 'necrotic', lifesteal: true } },
  // Defensive
  '+1_armor':           { label: '+1 Armor',            desc: '+1 to Armor Class.',                          effect: { ac_bonus: 1 } },
  '+2_armor':           { label: '+2 Armor',            desc: '+2 to Armor Class.',                          effect: { ac_bonus: 2 } },
  '+3_armor':           { label: '+3 Armor',            desc: '+3 to Armor Class.',                          effect: { ac_bonus: 3 } },
  'adamantine':         { label: 'Adamantine',          desc: 'Any critical hit against you becomes a normal hit.', effect: { no_crits: true } },
  'mithral':            { label: 'Mithral',             desc: 'No Stealth disadvantage; no minimum Strength.', effect: { no_stealth_dis: true } },
  'resistance_fire':    { label: 'Fire Resistance',    desc: 'Resistance to fire damage.',                  effect: { resistance: 'fire' } },
  'resistance_cold':    { label: 'Cold Resistance',    desc: 'Resistance to cold damage.',                  effect: { resistance: 'cold' } },
  'resistance_lightning': { label: 'Lightning Resistance', desc: 'Resistance to lightning damage.',         effect: { resistance: 'lightning' } },
  'resistance_poison':  { label: 'Poison Resistance',  desc: 'Resistance to poison damage and advantage on poison saves.', effect: { resistance: 'poison' } },
  // Stat bonuses
  'str_plus1':          { label: 'Strength +1',         desc: 'Your Strength score increases by 1 (max 20).', effect: { stat_bonus: { strength: 1 } } },
  'dex_plus1':          { label: 'Dexterity +1',        desc: 'Your Dexterity score increases by 1 (max 20).', effect: { stat_bonus: { dexterity: 1 } } },
  'con_plus1':          { label: 'Constitution +1',     desc: 'Your Constitution score increases by 1 (max 20).', effect: { stat_bonus: { constitution: 1 } } },
  'int_plus1':          { label: 'Intelligence +1',     desc: 'Your Intelligence score increases by 1 (max 20).', effect: { stat_bonus: { intelligence: 1 } } },
  'wis_plus1':          { label: 'Wisdom +1',           desc: 'Your Wisdom score increases by 1 (max 20).', effect: { stat_bonus: { wisdom: 1 } } },
  'cha_plus1':          { label: 'Charisma +1',         desc: 'Your Charisma score increases by 1 (max 20).', effect: { stat_bonus: { charisma: 1 } } },
  'con_19':             { label: 'Constitution 19',     desc: 'Your Constitution score becomes 19 while wearing this (if lower).', effect: { stat_set: { constitution: 19 } } },
  'str_of_giant':       { label: 'Strength of Giant',  desc: 'Your Strength score becomes 21 while wearing this (if lower).', effect: { stat_set: { strength: 21 } } },
  // Utility
  'darkvision':         { label: 'Darkvision',          desc: 'You gain darkvision out to 60 ft (or +60 ft if you already have it).', effect: { sense: 'darkvision_60' } },
  'featherfall':        { label: 'Featherfall',         desc: 'You fall no faster than 60 ft per round and take no falling damage.', effect: { featherfall: true } },
  'free_action':        { label: 'Freedom of Movement', desc: 'Ignore difficult terrain; immunity to paralyzed/restrained conditions.', effect: { freedom_of_movement: true } },
  'true_sight':         { label: 'Truesight',           desc: 'You can see through illusions and invisibility out to 30 ft.', effect: { sense: 'truesight_30' } },
  'spell_storing':      { label: 'Spell Storing',       desc: 'Can store a spell of up to 5th level, releasing it on command.', effect: { spell_storing: true } },
  'luck':               { label: 'Luck',                desc: 'Once per day, reroll one d20 and take either result.', effect: { luck: 1 } },
  'regeneration':       { label: 'Regeneration',        desc: 'Regain 1d6 HP at the start of each of your turns if you have at least 1 HP.', effect: { regeneration: '1d6' } },
  'spellcasting_plus1': { label: '+1 Spellcasting',     desc: '+1 to spell attack rolls and spell save DC.', effect: { spell_attack_bonus: 1, spell_save_dc_bonus: 1 } },
  'spellcasting_plus2': { label: '+2 Spellcasting',     desc: '+2 to spell attack rolls and spell save DC.', effect: { spell_attack_bonus: 2, spell_save_dc_bonus: 2 } },
  'concentration_adv':  { label: 'Concentration Aid',  desc: 'Advantage on Constitution saves to maintain concentration.', effect: { concentration_advantage: true } },
  'saving_throw_plus1': { label: '+1 All Saves',        desc: '+1 bonus to all saving throws.',              effect: { save_bonus: 1 } },
  'saving_throw_plus2': { label: '+2 All Saves',        desc: '+2 bonus to all saving throws.',              effect: { save_bonus: 2 } },
};

// ─── SRD Magic Items Database ─────────────────────────────────────────────────
export const SRD_MAGIC_ITEMS = [
  // Weapons
  { name: 'Flame Tongue', category: 'Weapon', equip_slot: 'mainhand', rarity: 'rare', requires_attunement: true, damage: '1d8 slashing', damage_type: 'slashing', weight: 4, cost: 0, cost_unit: 'gp', magic_properties: ['flaming'], description: 'As a bonus action, speak its command word to cause flames to erupt from the blade, shedding bright light 40 ft and dim light 40 ft further. The flames last until you use a bonus action to speak the command word again or until you drop or sheathe the sword.', quantity: 1 },
  { name: 'Frost Brand', category: 'Weapon', equip_slot: 'mainhand', rarity: 'rare', requires_attunement: true, damage: '1d8 slashing', damage_type: 'slashing', weight: 4, cost: 0, cost_unit: 'gp', magic_properties: ['frost', '+1_weapon'], description: 'When you hit with an attack, the target takes an extra 1d6 cold damage. In addition, while you hold the sword, you have resistance to fire damage. In freezing temperatures, the blade sheds bright light in a 10-foot radius and dim light for an additional 10 feet.', quantity: 1 },
  { name: 'Vorpal Sword', category: 'Weapon', equip_slot: 'mainhand', rarity: 'legendary', requires_attunement: true, damage: '2d6 slashing', damage_type: 'slashing', weight: 6, cost: 0, cost_unit: 'gp', magic_properties: ['+3_weapon', 'vorpal', 'sharpness'], description: 'On a roll of 20, you cut off one of the target\'s heads (if it has one). If the creature can survive without the lost head, you instead deal an extra 6d8 slashing damage.', quantity: 1 },
  { name: 'Sword of Sharpness', category: 'Weapon', equip_slot: 'mainhand', rarity: 'epic', requires_attunement: true, damage: '2d6 slashing', damage_type: 'slashing', weight: 6, cost: 0, cost_unit: 'gp', magic_properties: ['+1_weapon', 'sharpness'], description: 'When you attack an object with this magic sword and hit, maximize your weapon damage dice against the target. When you attack a creature with this weapon and roll a 20 on the attack roll, that target takes an extra 4d6 slashing damage.', quantity: 1 },
  { name: 'Dagger of Venom', category: 'Weapon', equip_slot: 'mainhand', rarity: 'rare', requires_attunement: false, damage: '1d4 piercing', damage_type: 'piercing', weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['+1_weapon', 'venom'], description: 'You can use a bonus action to cause thick, black poison to coat the blade. The poison remains for 1 minute or until an attack using this weapon hits a creature.', quantity: 1 },
  { name: 'Staff of the Magi', category: 'Weapon', equip_slot: 'mainhand', rarity: 'legendary', requires_attunement: true, attunement_class: ['Sorcerer', 'Warlock', 'Wizard'], damage: '1d6 bludgeoning', damage_type: 'bludgeoning', weight: 4, cost: 0, cost_unit: 'gp', magic_properties: ['+2_weapon', 'spellcasting_plus2', 'spell_storing'], description: 'This staff can be wielded as a magic quarterstaff that grants a +2 bonus to attack and damage rolls made with it. Has 50 charges for the following properties (regain 4d6+2 charges at dawn).', quantity: 1 },
  // Armor
  { name: 'Armor of Invulnerability', category: 'Armor', armor_type: 'heavy', equip_slot: 'armor', rarity: 'legendary', requires_attunement: true, armor_class: 18, weight: 65, cost: 0, cost_unit: 'gp', magic_properties: ['adamantine', 'resistance_fire'], description: 'You have resistance to nonmagical damage while you wear this armor. Additionally, you can use an action to make yourself immune to nonmagical damage for 10 minutes or until you are no longer wearing the armor. Once this special action is used, it can\'t be used again until the next dawn.', quantity: 1 },
  { name: 'Dragon Scale Mail', category: 'Armor', armor_type: 'medium', equip_slot: 'armor', rarity: 'rare', requires_attunement: true, armor_class: 14, weight: 45, cost: 0, cost_unit: 'gp', magic_properties: ['+1_armor', 'resistance_fire'], description: 'Scale mail made from the scales of a dragon. You have resistance to the type of damage associated with the dragon\'s color. Also, you can focus your senses as an action to magically discern the distance and direction to the closest dragon within 30 miles of you.', quantity: 1 },
  { name: 'Mithral Plate', category: 'Armor', armor_type: 'heavy', equip_slot: 'armor', rarity: 'uncommon', requires_attunement: false, armor_class: 18, weight: 35, cost: 0, cost_unit: 'gp', magic_properties: ['mithral'], description: 'Mithral is a light, flexible metal. A mithral chain shirt or breastplate can be worn under normal clothes. If the armor normally imposes disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version of the armor doesn\'t.', quantity: 1 },
  { name: 'Plate of Etherealness', category: 'Armor', armor_type: 'heavy', equip_slot: 'armor', rarity: 'legendary', requires_attunement: true, armor_class: 18, weight: 65, cost: 0, cost_unit: 'gp', magic_properties: ['+1_armor', 'free_action'], description: 'While wearing this armor, you can speak its command word as an action to gain the effect of the etherealness spell, which lasts until you speak the command word as an action to dismiss it or until you doff the armor. Once you use this property, it can\'t be used again for 24 hours.', quantity: 1 },
  // Helmets
  { name: 'Helm of Brilliance', category: 'Helmet', equip_slot: 'helmet', rarity: 'epic', requires_attunement: true, weight: 3, cost: 0, cost_unit: 'gp', magic_properties: ['resistance_fire', 'spellcasting_plus1'], description: 'This dazzling helm is set with 1d10 diamonds, 2d10 rubies, 3d10 fire opals, and 4d10 opals. Any gem pried from the helm crumbles to dust. When all the gems are removed or destroyed, the helm loses its magic.', quantity: 1 },
  { name: 'Helm of Telepathy', category: 'Helmet', equip_slot: 'helmet', rarity: 'uncommon', requires_attunement: true, weight: 2, cost: 0, cost_unit: 'gp', magic_properties: ['true_sight'], description: 'While wearing this helm, you can use an action to cast the detect thoughts spell (save DC 13) from it. As long as you maintain concentration on the spell, you can use a bonus action to send a telepathic message to a creature you are focused on. It can reply—using a bonus action to do so—while your focus on it continues.', quantity: 1 },
  // Cloaks
  { name: 'Cloak of Protection', category: 'Cloak', equip_slot: 'cloak', rarity: 'uncommon', requires_attunement: true, weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['saving_throw_plus1'], description: 'You gain a +1 bonus to AC and saving throws while you wear this cloak.', quantity: 1, ac_bonus: 1 },
  { name: 'Cloak of Elvenkind', category: 'Cloak', equip_slot: 'cloak', rarity: 'uncommon', requires_attunement: true, weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['darkvision'], description: 'While you wear this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage, and you have advantage on Dexterity (Stealth) checks made to hide, as the cloak\'s color shifts to camouflage you.', quantity: 1 },
  { name: 'Cloak of Displacement', category: 'Cloak', equip_slot: 'cloak', rarity: 'rare', requires_attunement: true, weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['saving_throw_plus1', 'adamantine'], description: 'While you wear this cloak, it projects an illusion that makes you appear to be standing in a place near your actual location, causing any creature to have disadvantage on attack rolls against you. If you take damage, the property ceases to function until the start of your next turn.', quantity: 1 },
  // Rings
  { name: 'Ring of Protection', category: 'Ring', equip_slot: 'ring', rarity: 'rare', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['saving_throw_plus1'], description: 'You gain a +1 bonus to AC and saving throws while wearing this ring.', quantity: 1, ac_bonus: 1 },
  { name: 'Ring of Spell Storing', category: 'Ring', equip_slot: 'ring', rarity: 'rare', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['spell_storing', 'spellcasting_plus1'], description: 'This ring stores spells cast into it, holding them until the attuned wearer uses them. The ring can store up to 5 levels worth of spells at a time.', quantity: 1 },
  { name: 'Ring of the Ram', category: 'Ring', equip_slot: 'ring', rarity: 'rare', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['+1_weapon'], description: 'This ring has 3 charges, and it regains 1d3 expended charges daily at dawn. While wearing the ring, you can use an action to expend 1 to 3 of its charges to attack one creature you can see within 60 feet of you.', quantity: 1 },
  { name: 'Ring of Regeneration', category: 'Ring', equip_slot: 'ring', rarity: 'epic', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['regeneration'], description: 'While wearing this ring, you regain 1d6 hit points every 10 minutes, provided that you have at least 1 hit point. If you lose a body part, the ring causes the missing part to regrow and return to full functionality after 1d6 + 1 days.', quantity: 1 },
  // Amulets
  { name: 'Amulet of Health', category: 'Amulet', equip_slot: 'amulet', rarity: 'rare', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['con_19'], description: 'Your Constitution score is 19 while you wear this amulet. It has no effect on you if your Constitution is already 19 or higher.', quantity: 1 },
  { name: 'Amulet of the Planes', category: 'Amulet', equip_slot: 'amulet', rarity: 'epic', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['spell_storing'], description: 'While wearing this amulet, you can use an action to name a location that you are familiar with on another plane of existence and travel there.', quantity: 1 },
  // Boots
  { name: 'Boots of Speed', category: 'Boots', equip_slot: 'boots', rarity: 'rare', requires_attunement: true, weight: 2, cost: 0, cost_unit: 'gp', magic_properties: ['free_action'], description: 'While you wear these boots, you can use a bonus action and click the boots\' heels together. If you do, the boots double your walking speed, and any creature that makes an opportunity attack against you has disadvantage on the attack roll.', quantity: 1 },
  { name: 'Boots of Elvenkind', category: 'Boots', equip_slot: 'boots', rarity: 'uncommon', requires_attunement: false, weight: 2, cost: 0, cost_unit: 'gp', magic_properties: [], description: 'While you wear these boots, your steps make no sound, regardless of the surface you are moving across. You also have advantage on Dexterity (Stealth) checks that rely on moving silently.', quantity: 1 },
  // Gloves
  { name: 'Gloves of Missile Snaring', category: 'Gloves', equip_slot: 'gloves', rarity: 'uncommon', requires_attunement: true, weight: 0.5, cost: 0, cost_unit: 'gp', magic_properties: [], description: 'These gloves seem to almost meld into your hands when you don them. When a ranged weapon attack hits you while you\'re wearing them, you can use your reaction to reduce the damage by 1d10 + your Dexterity modifier.', quantity: 1 },
  { name: 'Gauntlets of Ogre Power', category: 'Gloves', equip_slot: 'gloves', rarity: 'uncommon', requires_attunement: true, weight: 2, cost: 0, cost_unit: 'gp', magic_properties: ['str_of_giant'], description: 'Your Strength score is 19 while you wear these gauntlets. They have no effect on you if your Strength is already 19 or higher.', quantity: 1 },
  // Belts
  { name: 'Belt of Giant Strength', category: 'Belt', equip_slot: 'belt', rarity: 'epic', requires_attunement: true, weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['str_of_giant'], description: 'While wearing this belt, your Strength score changes to a score granted by the belt. If your Strength is already equal to or greater than the belt\'s score, the item has no effect on you.', quantity: 1 },
  { name: 'Belt of Dwarvenkind', category: 'Belt', equip_slot: 'belt', rarity: 'rare', requires_attunement: true, weight: 1, cost: 0, cost_unit: 'gp', magic_properties: ['con_plus1', 'resistance_poison'], description: 'While wearing this belt, you gain the following benefits: your Constitution score increases by 2 (max 20), you have advantage on Charisma (Persuasion) checks made to interact with dwarves.', quantity: 1 },
  // Wondrous
  { name: 'Bag of Holding', category: 'Wondrous Item', equip_slot: 'trinket', rarity: 'uncommon', requires_attunement: false, weight: 15, cost: 0, cost_unit: 'gp', magic_properties: [], description: 'This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet.', quantity: 1 },
  { name: 'Ioun Stone of Mastery', category: 'Wondrous Item', equip_slot: 'trinket', rarity: 'legendary', requires_attunement: true, weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['saving_throw_plus2', 'spellcasting_plus1'], description: 'Your proficiency bonus increases by 1 while this pale green prism orbits your head.', quantity: 1 },
  { name: 'Pearl of Power', category: 'Wondrous Item', equip_slot: 'trinket', rarity: 'uncommon', requires_attunement: true, attunement_class: ['Cleric', 'Druid', 'Paladin', 'Ranger', 'Warlock', 'Wizard', 'Sorcerer', 'Bard'], weight: 0, cost: 0, cost_unit: 'gp', magic_properties: ['spellcasting_plus1'], description: 'While this pearl is on your person, you can use an action to speak its command word and regain one expended spell slot of up to 3rd level. Once you use the pearl, it can\'t be used again until the next dawn.', quantity: 1 },
];

// ─── SRD Potions / Consumables ───────────────────────────────────────────────
export const SRD_CONSUMABLES = [
  { name: 'Potion of Healing', category: 'Potion', rarity: 'common', weight: 0.5, cost: 50, cost_unit: 'gp', quantity: 1, description: 'You regain 2d4+2 hit points when you drink this potion. The potion\'s red liquid glimmers when agitated.', magic_properties: [], is_magic: true },
  { name: 'Potion of Greater Healing', category: 'Potion', rarity: 'uncommon', weight: 0.5, cost: 150, cost_unit: 'gp', quantity: 1, description: 'You regain 4d4+4 hit points when you drink this potion.', magic_properties: [], is_magic: true },
  { name: 'Potion of Superior Healing', category: 'Potion', rarity: 'rare', weight: 0.5, cost: 500, cost_unit: 'gp', quantity: 1, description: 'You regain 8d4+8 hit points when you drink this potion.', magic_properties: [], is_magic: true },
  { name: 'Potion of Supreme Healing', category: 'Potion', rarity: 'epic', weight: 0.5, cost: 1350, cost_unit: 'gp', quantity: 1, description: 'You regain 10d4+20 hit points when you drink this potion.', magic_properties: [], is_magic: true },
  { name: 'Potion of Speed', category: 'Potion', rarity: 'rare', weight: 0.5, cost: 500, cost_unit: 'gp', quantity: 1, description: 'When you drink this potion, you gain the effect of the haste spell for 1 minute. Your speed increases by 15 ft.', magic_properties: [], is_magic: true },
  { name: 'Potion of Strength', category: 'Potion', rarity: 'uncommon', weight: 0.5, cost: 200, cost_unit: 'gp', quantity: 1, description: 'When you drink this potion, your Strength score changes to 21 for 1 hour.', magic_properties: [], is_magic: true },
  { name: 'Potion of Invisibility', category: 'Potion', rarity: 'epic', weight: 0.5, cost: 180, cost_unit: 'gp', quantity: 1, description: 'This potion\'s container looks empty but feels as though it holds liquid. When you drink it, you become invisible for 1 hour.', magic_properties: [], is_magic: true },
  { name: 'Potion of Fire Resistance', category: 'Potion', rarity: 'uncommon', weight: 0.5, cost: 300, cost_unit: 'gp', quantity: 1, description: 'When you drink this potion, you gain resistance to fire damage for 1 hour.', magic_properties: [], is_magic: true },
  { name: 'Antitoxin', category: 'Potion', rarity: 'common', weight: 0.5, cost: 50, cost_unit: 'gp', quantity: 1, description: 'A creature that drinks this vial of liquid gains advantage on saving throws against poison for 1 hour. It also cures the poisoned condition.', magic_properties: [], is_magic: false },
  { name: 'Potion of Mana Restoration', category: 'Potion', rarity: 'rare', weight: 0.5, cost: 250, cost_unit: 'gp', quantity: 1, description: 'When you drink this potion, you regain one expended spell slot of up to 3rd level.', magic_properties: [], is_magic: true },
];

// Merge consumables into SRD_MAGIC_ITEMS export (append)
SRD_MAGIC_ITEMS.push(...SRD_CONSUMABLES);

// ─── Equipment Constraint Rules (D&D 5E) ──────────────────────────────────────
export function getEquipConstraints(equipped, newItem) {
  const slot = newItem.equip_slot || CATEGORY_TO_SLOT[newItem.category];
  if (!slot) return { canEquip: true, reason: null };

  const slotDef = EQUIP_SLOTS[slot];
  if (!slotDef) return { canEquip: true, reason: null };

  // Count how many items are currently in this slot
  const slotItems = Object.values(equipped).filter(i => i && (i.equip_slot || CATEGORY_TO_SLOT[i.category]) === slot);

  // Check two-handed weapon rule
  if (slot === 'mainhand') {
    const isTwoHanded = newItem.properties?.includes('Two-Handed') || TWO_HANDED_WEAPONS.includes(newItem.name);
    if (isTwoHanded && equipped.offhand) {
      return { canEquip: false, reason: 'Two-handed weapons require an empty off-hand.' };
    }
  }
  if (slot === 'offhand') {
    const mh = equipped.mainhand;
    const mhTwoHanded = mh && (mh.properties?.includes('Two-Handed') || TWO_HANDED_WEAPONS.includes(mh?.name));
    if (mhTwoHanded) return { canEquip: false, reason: 'You are wielding a two-handed weapon.' };
  }

  if (slotItems.length >= slotDef.max) {
    return { canEquip: true, replaces: true, reason: `Replaces equipped ${slotDef.label}.` };
  }
  return { canEquip: true, reason: null };
}

// Compute total AC from equipped items
export function computeAC(character, equipped) {
  let base = 10;
  const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);

  const armor = equipped?.armor;
  const shield = equipped?.offhand;
  const cloak = equipped?.cloak;
  const ring = equipped?.ring;

  if (armor) {
    const acVal = parseInt(armor.armor_class) || 10;
    const type = armor.armor_type || 'light';
    if (type === 'heavy') base = acVal;
    else if (type === 'medium') base = acVal + Math.min(dexMod, 2);
    else base = acVal + dexMod;
    // magic bonus
    (armor.magic_properties || []).forEach(p => {
      const prop = MAGIC_PROPERTIES[p];
      if (prop?.effect?.ac_bonus) base += prop.effect.ac_bonus;
    });
  } else {
    base = 10 + dexMod;
  }

  if (shield && shield.category === 'Shield') base += 2;
  if (cloak?.ac_bonus) base += cloak.ac_bonus;
  if (ring?.ac_bonus) base += ring.ac_bonus;

  return base;
}

// Flatten all active magic effects from equipped items
export function getActiveEffects(equipped) {
  const effects = {};
  Object.values(equipped || {}).forEach(item => {
    if (!item) return;
    (item.magic_properties || []).forEach(propKey => {
      const prop = MAGIC_PROPERTIES[propKey];
      if (!prop) return;
      const e = prop.effect;
      // Merge effects
      if (e.stat_bonus) Object.assign(effects, { stat_bonuses: { ...(effects.stat_bonuses || {}), ...e.stat_bonus } });
      if (e.stat_set) Object.assign(effects, { stat_sets: { ...(effects.stat_sets || {}), ...e.stat_set } });
      if (e.resistance) effects.resistances = [...(effects.resistances || []), e.resistance];
      if (e.save_bonus) effects.save_bonus = (effects.save_bonus || 0) + e.save_bonus;
      if (e.spell_attack_bonus) effects.spell_attack_bonus = (effects.spell_attack_bonus || 0) + e.spell_attack_bonus;
      if (e.spell_save_dc_bonus) effects.spell_save_dc_bonus = (effects.spell_save_dc_bonus || 0) + e.spell_save_dc_bonus;
      if (e.no_crits) effects.no_crits = true;
      if (e.regeneration) effects.regeneration = e.regeneration;
      if (e.luck) effects.luck = (effects.luck || 0) + e.luck;
    });
  });
  return effects;
}
