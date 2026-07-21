import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sync Subclass features_by_level — updates existing Subclass entity records
 * with the full multi-level feature data from gameData.jsx, and creates
 * missing Artificer subclass records.
 *
 * Admin-only. Idempotent: safe to run multiple times.
 */

// Full subclass features extracted from gameData.jsx CLASSES[class].subclasses
// Keyed by class → subclass name → { level: [feature names] }
const SUBCLASS_DATA = {
  Fighter: {
    'Champion': { 3: ['Improved Critical (crit on 19-20)'], 7: ['Remarkable Athlete (+½ prof to STR/DEX/CON checks, better jumps)'], 10: ['Additional Fighting Style'], 15: ['Superior Critical (crit on 18-20)'], 18: ['Survivor (regain 5+CON HP each turn while below half HP)'] },
    'Battle Master': { 3: ['Combat Superiority (4d8, 3 maneuvers)', 'Student of War'], 7: ['Know Your Enemy', 'Superiority Dice (5d8)'], 10: ['Improved Combat Superiority (d10)', 'Extra Maneuvers'], 15: ['Relentless (regain 1 die when you roll initiative with none)'], 18: ['Improved Combat Superiority (d12)'] },
    'Eldritch Knight': { 3: ['Spellcasting (INT, Abjuration & Evocation)', 'Weapon Bond'], 7: ['War Magic (cantrip + weapon attack as bonus action)'], 10: ['Eldritch Strike (your hits give enemies disadvantage on your next spell save)'], 15: ['Arcane Charge (teleport 30 ft when you Action Surge)'], 18: ['Improved War Magic (cast a 1st-level spell + attack)'] },
    'Cavalier': { 3: ['Born to the Saddle', 'Unwavering Mark (mark foes; punish them for attacking others)', 'Bonus Proficiency'], 7: ['Warding Maneuver (reaction: add 1d8 to ally AC + reduce damage)'], 10: ['Hold the Line (enemies provoke when they move near you; their speed drops to 0 on a hit)'], 15: ['Ferocious Charger (knock prone after a 10+ ft charge)'], 18: ["Vigilant Defender (a reaction opportunity attack against every other creature's turn)"] },
    'Samurai': { 3: ['Fighting Spirit (3/long rest: advantage on attacks + temp HP)', 'Bonus Proficiency'], 7: ['Elegant Courtier (add WIS to a CHA save; proficiency in Persuasion/Wisdom)'], 10: ['Tireless Spirit (regain a Fighting Spirit use on initiative)'], 15: ['Rapid Strike (trade advantage for one extra attack)'], 18: ['Strength Before Death (reaction at 0 HP: take a full turn before falling)'] },
    'Arcane Archer': { 3: ['Arcane Archer Lore', 'Arcane Shot (2 options, 2/short rest)'], 7: ['Curving Shot (reroll a missed magic-arrow at another target)', 'Magic Arrow (all arrows count as magical)'], 10: ['Extra Arcane Shot option', 'Ever-Ready Shot (regain a use on initiative)'], 15: ['Additional Arcane Shot option'], 18: ['Improved Shots (+2d6 to all Arcane Shot damage)'] },
    'Psi Warrior': { 3: ['Psionic Power (Energy Dice)', 'Protective Field', 'Psionic Strike', 'Telekinetic Movement'], 7: ['Telekinetic Adept (Psi-Powered Leap + Telekinetic Thrust)'], 10: ['Guarded Mind (resistance to psychic damage; end charm/fright by spending a die)'], 15: ['Bulwark of Force (grant yourself/allies half cover as a bonus action)'], 18: ['Telekinetic Master (cast Telekinesis at will; bonus attack while concentrating)'] },
    'Rune Knight': { 3: ["Bonus Proficiencies (smith's tools, Giant language)", 'Rune Carver (2 runes)', "Giant's Might (grow Large, +1d6 damage 1/turn, advantage on STR)"], 7: ['Runic Shield (reaction: force an attacker to reroll a hit)', 'Additional Rune'], 10: ["Great Stature (permanent height + Giant's Might damage is 1d8)"], 15: ['Master of Runes (invoke each rune twice per rest)'], 18: ["Runic Juggernaut (Giant's Might makes you Huge, +1d10 damage, +5 ft reach)"] },
    'Echo Knight': { 3: ['Manifest Echo (summon a spectral double; attack + move through it)', 'Unleash Incarnation (extra attack through the echo)'], 7: ['Echo Avatar (see/hear through your echo up to 1,000 ft)'], 10: ['Shadow Martyr (echo intercepts an attack on an ally)'], 15: ['Reclaim Potential (gain temp HP when your echo is destroyed)'], 18: ['Legion of One (manifest two echoes; regain Unleash uses on initiative)'] },
    'Purple Dragon Knight (Banneret)': { 3: ['Rallying Cry (Second Wind also heals 3 allies for your level)', 'Bonus Proficiency'], 7: ['Royal Envoy (expertise in Persuasion; extra social proficiency)'], 10: ['Inspiring Surge (Action Surge grants an ally an extra attack)'], 15: ['Bulwark (share Indomitable rerolls with an ally)'], 18: ['Improved Inspiring Surge (aid two allies)'] },
  },
  Rogue: {
    'Thief': { 3: ['Fast Hands', 'Second-Story Work'], 9: ['Supreme Sneak'], 13: ['Use Magic Device'] },
    'Arcane Trickster': { 3: ['Spellcasting', 'Mage Hand Legerdemain'], 9: ['Magical Ambush'], 13: ['Versatile Trickster'] },
    'Assassin': { 3: ['Assassinate', 'Bonus Proficiencies'], 9: ['Infiltration Expertise'], 13: ['Impostor'] },
    'Swashbuckler': { 3: ['Fancy Footwork', 'Rakish Audacity'], 9: ['Panache'], 13: ['Elegant Maneuver'] },
    'Inquisitive': { 3: ['Ear for Deceit', 'Eye for Detail', 'Insightful Fighting'] },
    'Scout': { 3: ['Skirmisher', 'Survivalist'], 9: ['Superior Mobility'], 13: ['Ambush Master'], 17: ['Sudden Strike'] },
    'Mastermind': { 3: ['Master of Intrigue', 'Master of Tactics'], 9: ['Misdirection'], 13: ['Soul of Deceit'] },
  },
  Wizard: {
    'School of Evocation': { 2: ['Evocation Savant', 'Sculpt Spells'], 6: ['Potent Cantrip'], 10: ['Empowered Evocation'], 14: ['Overchannel'] },
    'School of Abjuration': { 2: ['Abjuration Savant', 'Arcane Ward'], 6: ['Projected Ward'], 10: ['Improved Abjuration'] },
    'School of Illusion': { 2: ['Illusion Savant', 'Improved Minor Illusion'], 6: ['Malleable Illusions'], 10: ['Illusory Self'] },
    'School of Necromancy': { 2: ['Necromancy Savant', 'Grim Harvest'], 6: ['Undead Thralls'], 10: ['Inured to Undeath'] },
    'School of Divination': { 2: ['Divination Savant', 'Portent'], 6: ['Expert Divination'], 10: ['The Third Eye'] },
    'School of Conjuration': { 2: ['Conjuration Savant', 'Minor Conjuration'], 6: ['Benign Transposition'], 10: ['Focused Conjuration'] },
  },
  Cleric: {
    'Life Domain': { 1: ['Bonus Proficiency (Heavy Armor)', 'Disciple of Life'], 2: ['Preserve Life'], 6: ['Blessed Healer'] },
    'Light Domain': { 1: ['Bonus Cantrip', 'Warding Flare'], 2: ['Radiance of the Dawn'], 6: ['Improved Flare'] },
    'War Domain': { 1: ['Bonus Proficiencies', 'War Priest'], 2: ['Guided Strike'], 6: ["War God's Blessing"] },
    'Trickery Domain': { 1: ['Blessing of the Trickster'], 2: ['Invoke Duplicity'], 6: ['Cloak of Shadows'] },
    'Nature Domain': { 1: ['Acolyte of Nature', 'Bonus Proficiency'], 2: ['Charm Animals and Plants'], 6: ['Dampen Elements'] },
    'Knowledge Domain': { 1: ['Blessings of Knowledge'], 2: ['Visions of the Past'], 6: ['Read Thoughts'] },
  },
  Ranger: {
    'Hunter': { 3: ["Hunter's Prey"], 7: ['Defensive Tactics'], 11: ['Multiattack'] },
    'Beast Master': { 3: ["Ranger's Companion"], 7: ['Exceptional Training'], 11: ['Bestial Fury'] },
    'Gloom Stalker': { 3: ['Dread Ambusher', 'Umbral Sight'], 7: ['Iron Mind'], 11: ["Stalker's Flurry"] },
    'Horizon Walker': { 3: ['Detect Portal', 'Planar Warrior'], 7: ['Ethereal Step'], 11: ['Distant Strike'] },
  },
  Paladin: {
    'Oath of Devotion': { 3: ['Sacred Weapon', 'Turn the Unholy'], 7: ['Aura of Devotion'], 15: ['Purity of Spirit'], 20: ['Holy Nimbus'] },
    'Oath of the Ancients': { 3: ["Nature's Wrath", 'Turn the Faithless'], 7: ['Aura of Warding'], 15: ['Undying Sentinel'], 20: ['Elder Champion'] },
    'Oath of Vengeance': { 3: ['Abjure Enemy', 'Vow of Enmity'], 7: ['Relentless Avenger'], 15: ['Soul of Vengeance'], 20: ['Avenging Angel'] },
    'Oath of Conquest': { 3: ['Conquering Presence', 'Guided Strike'], 7: ['Aura of Conquest'], 15: ['Scornful Rebuke'] },
    'Oathbreaker': { 3: ['Control Undead', 'Dreadful Aspect'], 7: ['Aura of Hate'], 15: ['Supernatural Resistance'] },
  },
  Barbarian: {
    'Path of the Berserker': { 3: ['Frenzy', 'Mindless Rage'], 6: ['Intimidating Presence'], 10: ['Retaliation'] },
    'Path of the Totem Warrior': { 3: ['Spirit Seeker', 'Totem Spirit'], 6: ['Aspect of the Beast'], 10: ['Spirit Walker'], 14: ['Totemic Attunement'] },
    'Path of the Storm Herald': { 3: ['Storm Aura'], 6: ['Storm Soul'], 10: ['Shielding Storm'], 14: ['Raging Storm'] },
    'Path of the Zealot': { 3: ['Divine Fury', 'Warrior of the Gods'], 6: ['Fanatical Focus'], 10: ['Zealous Presence'] },
  },
  Bard: {
    'College of Lore': { 3: ['Bonus Proficiencies', 'Cutting Words'], 6: ['Additional Magical Secrets'], 14: ['Peerless Skill'] },
    'College of Valor': { 3: ['Bonus Proficiencies', 'Combat Inspiration'], 6: ['Extra Attack'], 14: ['Battle Magic'] },
    'College of Glamour': { 3: ['Mantle of Inspiration', 'Enthralling Performance'], 6: ['Mantle of Majesty'], 14: ['Unbreakable Majesty'] },
    'College of Swords': { 3: ['Bonus Proficiency', 'Fighting Style', 'Blade Flourish'], 6: ['Extra Attack'], 14: ["Master's Flourish"] },
    'College of Whispers': { 3: ['Psychic Blades', 'Words of Terror'], 6: ['Mantle of Whispers'], 14: ['Shadow Lore'] },
  },
  Druid: {
    'Circle of the Land': { 2: ['Bonus Cantrip', 'Natural Recovery'], 3: ['Circle Spells'], 6: ["Land's Stride"] },
    'Circle of the Moon': { 2: ['Combat Wild Shape', 'Circle Forms'], 6: ['Primal Strike'], 10: ['Elemental Wild Shape'], 14: ['Thousand Forms'] },
    'Circle of Spores': { 2: ['Halo of Spores', 'Symbiotic Entity'], 6: ['Fungal Infestation'], 10: ['Spreading Spores'] },
    'Circle of Dreams': { 2: ['Balm of the Summer Court'], 6: ['Hearth of Moonlight and Shadow'], 10: ['Hidden Paths'], 14: ['Walker in Dreams'] },
    'Circle of the Shepherd': { 2: ['Speech of the Woods', 'Spirit Totem'], 6: ['Mighty Summoner'], 10: ['Guardian Spirit'], 14: ['Faithful Summons'] },
  },
  Monk: {
    'Way of the Open Hand': { 3: ['Open Hand Technique'], 6: ['Wholeness of Body'], 11: ['Tranquility'], 17: ['Quivering Palm'] },
    'Way of Shadow': { 3: ['Shadow Arts'], 6: ['Shadow Step'], 11: ['Cloak of Shadows'], 17: ['Opportunist'] },
    'Way of the Four Elements': { 3: ['Disciple of the Elements'], 6: ['Extra Elemental Discipline'], 11: ['Extra Elemental Discipline'], 17: ['Extra Elemental Discipline'] },
    'Way of the Kensei': { 3: ['Path of the Kensei'], 6: ['One with the Blade'], 11: ['Sharpen the Blade'], 17: ['Unerring Accuracy'] },
    'Way of the Drunken Master': { 3: ['Drunken Technique'], 6: ['Tipsy Sway'], 11: ["Drunkard's Luck"], 17: ['Intoxicated Frenzy'] },
    'Way of the Long Death': { 3: ['Touch of Death'], 6: ['Hour of Reaping'], 11: ['Mastery of Death'], 17: ['Touch of the Long Death'] },
  },
  Sorcerer: {
    'Draconic Bloodline': { 1: ['Dragon Ancestor', 'Draconic Resilience'], 6: ['Elemental Affinity'], 14: ['Dragon Wings'], 18: ['Draconic Presence'] },
    'Wild Magic': { 1: ['Wild Magic Surge', 'Tides of Chaos'], 6: ['Bend Luck'], 14: ['Controlled Chaos'], 18: ['Spell Bombardment'] },
    'Divine Soul': { 1: ['Divine Magic', 'Favored by the Gods'], 6: ['Empowered Healing'], 14: ['Otherworldly Wings'], 18: ['Unearthly Recovery'] },
    'Storm Sorcery': { 1: ['Wind Speaker', 'Tempestuous Magic'], 6: ['Heart of the Storm'], 14: ['Storm Guide'], 18: ['Wind Soul'] },
    'Shadow Magic': { 1: ['Eyes of the Dark', 'Strength of the Grave'], 6: ['Hound of Ill Omen'], 14: ['Shadow Walk'], 18: ['Umbral Form'] },
  },
  Warlock: {
    'The Archfey': { 1: ['Fey Presence'], 6: ['Misty Escape'], 10: ['Beguiling Defenses'], 14: ['Dark Delirium'] },
    'The Fiend': { 1: ["Dark One's Blessing"], 6: ["Dark One's Own Luck"], 10: ['Fiendish Resilience'], 14: ['Hurl Through Hell'] },
    'The Great Old One': { 1: ['Awakened Mind'], 6: ['Entropic Ward'], 10: ['Thought Shield'], 14: ['Create Thrall'] },
    'The Undead': { 1: ['Form of Dread'], 6: ['Grave Touched'], 10: ['Necrotic Husk'], 14: ['Spirit Projection'] },
    'The Celestial': { 1: ['Expanded Spell List', 'Healing Light'], 6: ['Radiant Soul'], 10: ['Celestial Resilience'], 14: ['Searing Vengeance'] },
    'The Hexblade': { 1: ["Hexblade's Curse", 'Hex Warrior'], 6: ['Accursed Specter'], 10: ['Armor of Hexes'], 14: ['Master of Hexes'] },
  },
  Artificer: {
    'Alchemist': { 3: ['Tools Required', 'Experimental Elixir'], 5: ['Alchemical Savant'], 9: ['Restorative Reagents'], 15: ['Chemical Mastery'] },
    'Armorer': { 3: ['Tools Required', 'Arcane Armor', 'Armor Model'], 5: ['Extra Attack'], 9: ['Armor Modifications'], 15: ['Perfected Armor'] },
    'Artillerist': { 3: ['Tools Required', 'Eldritch Cannon'], 5: ['Arcane Firearm'], 9: ['Explosive Cannon'], 15: ['Fortified Position'] },
    'Battle Smith': { 3: ['Tools Required', 'Battle Ready', 'Steel Defender'], 5: ['Extra Attack'], 9: ['Arcane Jolt'], 15: ['Improved Defender'] },
  },
};

// Subclass flavor label by class (used when creating new DB records)
const FLAVOR_BY_CLASS = {
  Fighter: 'Martial Archetypes', Rogue: 'Roguish Archetypes', Wizard: 'Arcane Traditions',
  Cleric: 'Divine Domains', Ranger: 'Ranger Archetypes', Paladin: 'Sacred Oaths',
  Barbarian: 'Primal Paths', Bard: 'Bard Colleges', Druid: 'Druid Circles',
  Monk: 'Monastic Traditions', Sorcerer: 'Sorcerous Origins', Warlock: 'Otherworldly Patrons',
  Artificer: 'Artificer Specialists',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    let updated = 0;
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const [className, subclasses] of Object.entries(SUBCLASS_DATA)) {
      for (const [subclassName, featuresByLevel] of Object.entries(subclasses)) {
        try {
          // Find existing record by name + class
          const matches = await base44.asServiceRole.entities.Subclass.filter(
            { class_name: className, name: subclassName }, 'name', 5
          );

          if (matches && matches.length > 0) {
            // Update existing record with full features_by_level
            await base44.asServiceRole.entities.Subclass.update(matches[0].id, {
              features_by_level: featuresByLevel,
            });
            updated++;
          } else {
            // Create missing core subclass record (PHB / Xanathar's / Tasha's etc.)
            const allFeats = Object.values(featuresByLevel).flat();
            const desc = allFeats.join(', ');
            await base44.asServiceRole.entities.Subclass.create({
              name: subclassName,
              class_name: className,
              description: desc,
              short_description: desc.slice(0, 240),
              subclass_flavor: FLAVOR_BY_CLASS[className] || 'Subclass',
              features_by_level: featuresByLevel,
              source: '5e Core Rules',
            });
            created++;
          }
        } catch (e) {
          errors.push(`${className}/${subclassName}: ${e.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      updated,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced subclass features: ${updated} updated, ${created} created, ${skipped} skipped.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});