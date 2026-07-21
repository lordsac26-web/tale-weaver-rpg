import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Domain/oath/expanded spell lists (PHB). These spells are ALWAYS prepared and
// don't count against the character's prepared spell limit.
// Format: { Class: { subclass_key: { level_unlocked: [spell_names] } } }
const DOMAIN_SPELLS = {
  Cleric: {
    life: { 1: ['Bless','Cure Wounds'], 3: ['Lesser Restoration','Spiritual Weapon'], 5: ['Mass Healing Word','Revivify'], 7: ['Death Ward','Destructive Wave'], 9: ['Mass Cure Wounds','Raise Dead'] },
    light: { 1: ['Burning Hands','Faerie Fire'], 3: ['Flaming Sphere','Scorching Ray'], 5: ['Daylight','Fireball'], 7: ['Guardian of Faith','Wall of Fire'], 9: ['Flame Strike','Scrying'] },
    nature: { 1: ['Animal Friendship','Speak with Animals'], 3: ['Barkskin','Spike Growth'], 5: ['Plant Growth','Wind Wall'], 7: ['Dominate Beast','Grasping Vine'], 9: ['Insect Plague','Tree Stride'] },
    tempest: { 1: ['Fog Cloud','Thunderwave'], 3: ['Gust of Wind','Shatter'], 5: ['Call Lightning','Sleet Storm'], 7: ['Control Water','Ice Storm'], 9: ['Destructive Wave','Insect Plague'] },
    trickery: { 1: ['Charm Person','Disguise Self'], 3: ['Mirror Image','Pass Without Trace'], 5: ['Blink','Dispel Magic'], 7: ['Dimension Door','Polymorph'], 9: ['Dominate Person','Modify Memory'] },
    war: { 1: ['Divine Favor','Shield of Faith'], 3: ['Magic Weapon','Spiritual Weapon'], 5: ["Crusader's Mantle",'Spirit Guardians'], 7: ['Freedom of Movement','Stoneskin'], 9: ['Flame Strike','Hold Monster'] },
    knowledge: { 1: ['Command','Identify'], 3: ['Augury','Suggestion'], 5: ['Nondetection','Speak with Dead'], 7: ['Arcane Eye','Confusion'], 9: ['Legend Lore','Scrying'] },
    death: { 1: ['False Life','Ray of Sickness'], 3: ['Blindness/Deafness','Ray of Enfeeblement'], 5: ['Animate Dead','Vampiric Touch'], 7: ['Blight','Death Ward'], 9: ['Antilife Shell','Cloudkill'] },
    forge: { 1: ['Identify','Searing Smite'], 3: ['Heat Metal','Magic Weapon'], 5: ['Elemental Weapon','Protection from Energy'], 7: ['Fabricate','Wall of Fire'], 9: ['Animate Objects','Creation'] },
    grave: { 1: ['Bane','False Life'], 3: ['Gentle Repose','Ray of Enfeeblement'], 5: ['Revivify','Vampiric Touch'], 7: ['Blight','Death Ward'], 9: ['Antilife Shell','Raise Dead'] },
  },
  Paladin: {
    devotion: { 3: ['Protection from Evil and Good','Sanctuary'], 5: ['Lesser Restoration','Zone of Truth'], 9: ['Beacon of Hope','Dispel Magic'], 13: ['Freedom of Movement','Guardian of Faith'], 17: ['Commune','Flame Strike'] },
    ancients: { 3: ['Ensnaring Strike','Speak with Animals'], 5: ['Misty Step','Moonbeam'], 9: ['Aura of Vitality','Plant Growth'], 13: ['Aura of Life','Ice Storm'], 17: ['Aura of Warding','Greater Restoration'] },
    vengeance: { 3: ['Bane',"Hunter's Mark"], 5: ['Hold Person','Misty Step'], 9: ['Haste','Protection from Energy'], 13: ['Banishment','Dimension Door'], 17: ['Hold Monster','Scrying'] },
    crown: { 3: ['Command','Compelled Duel'], 5: ['Warding Bond','Zone of Truth'], 9: ['Aura of Vitality','Spirit Guardians'], 13: ['Banishment','Guardian of Faith'], 17: ['Circle of Power','Destructive Wave'] },
    conquest: { 3: ['Armor of Agathys','Command'], 5: ['Hold Person','Misty Step'], 9: ['Bestow Curse','Fear'], 13: ['Dominate Beast','Stoneskin'], 17: ['Cloudkill','Dominate Person'] },
    redemption: { 3: ['Sanctuary','Sleep'], 5: ['Calm Emotions','Hold Person'], 9: ['Counterspell','Hypnotic Pattern'], 13: ["Otiluke's Resilient Sphere",'Stoneskin'], 17: ['Banishment','Geas'] },
  },
  // Warlock patron EXPANDED spell lists (PHB/Xanathar's/Tasha's) — H-S2 fix.
  // RAW these expand the options a warlock can learn from; for solo-play usability
  // we grant them as known spells (mirrors how domain/oath spells are handled).
  // Keys are character levels at which each spell tier becomes castable (pact slot level).
  Warlock: {
    archfey: { 1: ['Faerie Fire', 'Sleep'], 3: ['Calm Emotions', 'Phantasmal Force'], 5: ['Blink', 'Plant Growth'], 7: ['Dominate Beast', 'Greater Invisibility'], 9: ['Dominate Person', 'Seeming'] },
    fiend: { 1: ['Burning Hands', 'Command'], 3: ['Blindness/Deafness', 'Scorching Ray'], 5: ['Fireball', 'Stinking Cloud'], 7: ['Fire Shield', 'Wall of Fire'], 9: ['Flame Strike', 'Hallow'] },
    'great old one': { 1: ['Dissonant Whispers', "Tasha's Hideous Laughter"], 3: ['Detect Thoughts', 'Phantasmal Force'], 5: ['Clairvoyance', 'Sending'], 7: ['Dominate Beast', "Evard's Black Tentacles"], 9: ['Dominate Person', 'Telekinesis'] },
    celestial: { 1: ['Cure Wounds', 'Guiding Bolt'], 3: ['Flaming Sphere', 'Lesser Restoration'], 5: ['Daylight', 'Revivify'], 7: ['Guardian of Faith', 'Wall of Fire'], 9: ['Flame Strike', 'Greater Restoration'] },
    hexblade: { 1: ['Shield', 'Wrathful Smite'], 3: ['Blur', 'Branding Smite'], 5: ['Blink', 'Elemental Weapon'], 7: ['Phantasmal Killer', 'Staggering Smite'], 9: ['Banishing Smite', 'Cone of Cold'] },
    undead: { 1: ['Bane', 'False Life'], 3: ['Blindness/Deafness', 'Phantasmal Force'], 5: ['Phantom Steed', 'Speak with Dead'], 7: ['Death Ward', 'Greater Invisibility'], 9: ['Antilife Shell', 'Cloudkill'] },
  },
  // Warlock Mystic Arcanum: granted at levels 11/13/15/17. Player chooses one spell
  // per level. These are NOT auto-prepared — the player selects them. Tracked in
  // long_rest_abilities.mystic_arcanum as { spell_name: false }.
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { character_id } = await req.json();
    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    if (character.created_by !== user.email) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const charClass = character.class || '';
    const subclass = (character.subclass || '').toLowerCase();
    const level = character.level || 1;

    const classSpells = DOMAIN_SPELLS[charClass];
    if (!classSpells) {
      return Response.json({ success: true, message: 'No domain spells for this class.', spells_added: [] });
    }

    const subclassKey = Object.keys(classSpells).find(k => subclass.includes(k));
    if (!subclassKey) {
      return Response.json({ success: true, message: 'No domain spells for this subclass.', spells_added: [] });
    }

    const spellsByLevel = classSpells[subclassKey];
    const spellsToAdd = [];
    for (const [lvl, spells] of Object.entries(spellsByLevel)) {
      if (level >= parseInt(lvl)) spellsToAdd.push(...spells);
    }
    if (spellsToAdd.length === 0) {
      return Response.json({ success: true, message: 'No domain spells unlocked yet.', spells_added: [] });
    }

    const knownSet = new Set(character.spells_known || []);
    const preparedSet = new Set(character.spells_prepared || []);
    const added = [];
    for (const spell of spellsToAdd) {
      if (!knownSet.has(spell)) { knownSet.add(spell); added.push(spell); }
      preparedSet.add(spell); // domain spells are always prepared
    }

    await base44.entities.Character.update(character_id, {
      spells_known: Array.from(knownSet),
      spells_prepared: Array.from(preparedSet),
    });

    return Response.json({
      success: true,
      spells_added: added,
      all_domain_spells: spellsToAdd,
      message: `Auto-prepared ${spellsToAdd.length} domain spells for ${subclassKey} ${charClass}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});