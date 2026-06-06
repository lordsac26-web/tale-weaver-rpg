import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Spell slot progression by class
const SPELL_SLOTS_BY_CLASS = {
  Wizard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Sorcerer: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Bard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Cleric: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Druid: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Paladin: [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Ranger: [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Artificer: [[2],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Warlock: [[1],[2],[2],[2],[2],[2],[2],[2],[2],[2],[3],[3],[3],[3],[3],[3],[4],[4],[4],[4]],
};

// Multiclass spellcaster slot table, indexed by COMBINED caster level (PHB p.165).
// Index 0 = caster level 1. Warlock Pact Magic is tracked separately and excluded here.
const MULTICLASS_SLOTS = [
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];

// How each class contributes to the multiclass caster level (PHB p.164).
// full = level counts fully; half = level/2 rounded down (Paladin/Ranger);
// third = level/3 rounded down (Eldritch Knight / Arcane Trickster — tracked via subclass).
const CASTER_PROGRESSION = {
  Wizard: 'full', Sorcerer: 'full', Bard: 'full', Cleric: 'full', Druid: 'full',
  Paladin: 'half', Ranger: 'half', Artificer: 'half',
};

// Compute the combined caster level for a (possibly multiclassed) character.
// `multiclass` is an array of { class, subclass, levels }. Falls back to the
// primary class/level when no multiclass data is present.
function computeCasterLevel(character) {
  const classes = [];
  if (Array.isArray(character.multiclass) && character.multiclass.length > 0) {
    for (const mc of character.multiclass) {
      if (mc?.class && mc?.levels) classes.push({ class: mc.class, subclass: mc.subclass, levels: mc.levels });
    }
  } else {
    classes.push({ class: character.class, subclass: character.subclass, levels: character.level || 1 });
  }

  let casterLevel = 0;
  for (const c of classes) {
    const prog = CASTER_PROGRESSION[c.class];
    const sub = (c.subclass || '').toLowerCase();
    const isThirdCaster = sub.includes('eldritch knight') || sub.includes('arcane trickster');
    if (prog === 'full') casterLevel += c.levels;
    else if (prog === 'half') casterLevel += Math.floor(c.levels / 2);
    else if (isThirdCaster) casterLevel += Math.floor(c.levels / 3);
  }
  return casterLevel;
}

/**
 * Handle Short and Long Rests
 * Restores HP, spell slots, hit dice, and class abilities per D&D 5E rules
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { character_id, rest_type, hit_dice_to_spend, had_food_water = true, location_safe = false } = await req.json();

  // Fetch with a USER-SCOPED .get() (same pattern as combatEngine). The player owns
  // their character, so RLS lets this through, and a successful fetch proves ownership.
  // (Previously used asServiceRole + filter({ id }), which returned no rows and caused
  // spurious "Character not found" 404s — the root cause of rests appearing to hang.)
  let character;
  try {
    character = await base44.entities.Character.get(character_id);
  } catch {
    character = null;
  }
  if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

  const charClass = character.class;
  const charLevel = character.level || 1;
  const currentSlots = character.spell_slots || {};
  const isMulticlassed = Array.isArray(character.multiclass) && character.multiclass.length > 0;
  // Multiclass casters use a COMBINED caster level against the multiclass slot table
  // (PHB p.164-165). Single-class characters keep their own class progression.
  const maxSlots = isMulticlassed
    ? (MULTICLASS_SLOTS[computeCasterLevel(character) - 1] || [])
    : (SPELL_SLOTS_BY_CLASS[charClass]?.[charLevel - 1] || []);
  const shortRestAbilities = character.short_rest_abilities || {};

  const updates = {};
  const restorations = [];
  let restNarrative; // declared in outer scope so it's available in the final response for any rest type

  // Hit die size by class (PHB)
  const HIT_DIE = { Fighter: 10, Rogue: 8, Wizard: 6, Cleric: 8, Ranger: 10, Paladin: 10, Barbarian: 12, Bard: 8, Druid: 8, Monk: 8, Sorcerer: 6, Warlock: 8, Artificer: 8 };
  const hitDie = HIT_DIE[charClass] || 8;
  const conMod = Math.floor(((character.constitution || 10) - 10) / 2);
  const chaMod = Math.floor(((character.charisma || 10) - 10) / 2);

  // Current hit dice remaining — initialize to charLevel if field doesn't exist yet (backwards compat)
  const currentHitDiceRemaining = character.hit_dice_remaining ?? charLevel;

  if (rest_type === 'short') {
    // SHORT REST (1 hour) — player chooses how many hit dice to spend (PHB p.186)
    // Cap dice spent to how many the character actually has remaining
    const availableDice = Math.max(0, currentHitDiceRemaining);
    const diceToSpend = Math.min(availableDice, Math.max(1, hit_dice_to_spend || 1));

    if (diceToSpend === 0) {
      return Response.json({ error: 'No hit dice remaining', restorations: [], healing: 0, character });
    }

    let healing = 0;
    for (let i = 0; i < diceToSpend; i++) {
      healing += Math.max(1, Math.floor(Math.random() * hitDie) + 1 + conMod);
    }
    restorations.push(`${diceToSpend}d${hitDie}${conMod >= 0 ? `+${conMod}` : conMod} per die — ${healing} HP restored`);
    const newHP = Math.min(character.hp_max, (character.hp_current || 0) + healing);
    updates.hp_current = newHP;
    // Deduct spent hit dice
    updates.hit_dice_remaining = Math.max(0, currentHitDiceRemaining - diceToSpend);
    restorations.push(`Hit dice remaining: ${updates.hit_dice_remaining}/${charLevel}`);

    // Warlock: restore all pact slots on short rest
    if (charClass === 'Warlock') {
      updates.spell_slots = {};
      restorations.push('All pact slots recovered');
    }

    // NOTE: Wizard Arcane Recovery is once per LONG rest (PHB p.115) — NOT reset on a short rest.

    if (charClass === 'Fighter') {
      restorations.push('Action Surge & Second Wind recovered');
    }
    // Monk: Ki points fully recharge on a short rest (PHB p.78)
    if (charClass === 'Monk' && charLevel >= 2) {
      updates.ki_points_max = charLevel;
      updates.ki_points_remaining = charLevel;
      restorations.push(`Ki points recharged (${charLevel})`);
    }
    // Bard level 5+ (Font of Inspiration): Bardic Inspiration recovers on a short rest (PHB p.54)
    if (charClass === 'Bard' && charLevel >= 5) {
      const biMax = Math.max(1, chaMod);
      updates.bardic_inspiration_max = biMax;
      updates.bardic_inspiration_remaining = biMax;
      restorations.push(`Bardic Inspiration recovered (${biMax})`);
    }

    // Reset short-rest ability tracking (Action Surge, Second Wind, Channel Divinity/Turn Undead,
    // Wild Shape, Artificer infusions, etc.) — these all recharge on a short rest (PHB class tables).
    // EXCEPTION: arcane_recovery is once per LONG rest, so preserve it across short rests.
    updates.short_rest_abilities = { arcane_recovery: !!shortRestAbilities.arcane_recovery };

  } else if (rest_type === 'long') {
    // LONG REST (8 hours)
    
    // Random encounter check (20% chance) — skipped entirely in a safe location (town, inn, etc.)
    const encounterRoll = Math.random();
    if (!location_safe && encounterRoll < 0.2) {
      return Response.json({
        interrupted: true,
        encounter_message: 'Your rest is interrupted! A creature stirs in the darkness...'
      });
    }

    // Generate narrative summary
    const narratives = [
      'You find a sheltered spot and settle in for the night. The crackling of your campfire keeps the darkness at bay.',
      'As you rest, you dream of past victories and future challenges. You awaken refreshed and ready.',
      'The night passes peacefully. Birdsong greets the dawn, and you rise with renewed vigor.',
      'You make camp under the stars. The quiet of the wilderness soothes your weary soul.',
      'Your rest is deep and dreamless. When you wake, you feel completely restored.',
    ];
    restNarrative = narratives[Math.floor(Math.random() * narratives.length)];
    // LONG REST (8 hours)
    updates.hp_current = character.hp_max;
    restorations.push('Full HP restored');

    // Restore hit dice: regain half your total hit dice rounded down, minimum 1 (PHB p.186)
    const hitDiceToRestore = Math.max(1, Math.floor(charLevel / 2));
    updates.hit_dice_remaining = Math.min(charLevel, currentHitDiceRemaining + hitDiceToRestore);
    updates.hit_dice_max = charLevel;
    restorations.push(`${hitDiceToRestore} Hit Dice restored (${updates.hit_dice_remaining}/${charLevel} total)`);

    // Reset all spell slots
    if (maxSlots.length > 0) {
      updates.spell_slots = {};
      restorations.push('All spell slots recovered');
    }

    // Reset Arcane Recovery
    if (charClass === 'Wizard') {
      updates.arcane_recovery_used = false;
    }

    // Remove one level of exhaustion (PHB p.186/291: a long rest reduces exhaustion by 1),
    // but only if the character ingested food and drink during the rest.
    const currentExhaustion = character.exhaustion_level || 0;
    if (currentExhaustion > 0) {
      if (had_food_water) {
        updates.exhaustion_level = Math.max(0, currentExhaustion - 1);
        restorations.push(`Exhaustion reduced to level ${updates.exhaustion_level}`);
      } else {
        restorations.push(`Exhaustion not reduced — no food or water (still level ${currentExhaustion})`);
      }
    }
    // Legacy: also clear a single 'exhausted' condition tag if present
    const conditions = character.conditions || [];
    const exhaustIdx = conditions.findIndex(c => (typeof c === 'string' ? c : c.name) === 'exhausted');
    if (exhaustIdx >= 0) {
      const newConditions = [...conditions];
      newConditions.splice(exhaustIdx, 1);
      updates.conditions = newConditions;
    }

    // Lucky feat: restore luck points to maximum on a long rest (PHB p.167)
    if ((character.luck_points_max || 0) > 0) {
      updates.luck_points_remaining = character.luck_points_max;
      restorations.push(`Luck points restored (${character.luck_points_max})`);
    }

    // Sorcerer Font of Magic: sorcery points = sorcerer level (from level 2),
    // fully restored on a long rest (PHB p.101).
    if (charClass === 'Sorcerer' && charLevel >= 2) {
      const spMax = charLevel;
      updates.sorcery_points_max = spMax;
      updates.sorcery_points_current = spMax;
      restorations.push(`Sorcery points restored (${spMax})`);
    }

    // Monk: Ki fully restored on a long rest (PHB p.78)
    if (charClass === 'Monk' && charLevel >= 2) {
      updates.ki_points_max = charLevel;
      updates.ki_points_remaining = charLevel;
      restorations.push(`Ki points restored (${charLevel})`);
    }
    // Bard: Bardic Inspiration always restored on a long rest (PHB p.53)
    if (charClass === 'Bard') {
      const biMax = Math.max(1, chaMod);
      updates.bardic_inspiration_max = biMax;
      updates.bardic_inspiration_remaining = biMax;
      restorations.push(`Bardic Inspiration restored (${biMax})`);
    }

    updates.death_saves_success = 0;
    updates.death_saves_failure = 0;
    updates.short_rest_abilities = {};
    updates.long_rest_abilities = {};
    restorations.push('All abilities recharged');
  }

  await base44.entities.Character.update(character_id, updates);

  const updatedChar = await base44.entities.Character.get(character_id);
  const healing = updates.hp_current != null ? updates.hp_current - (character.hp_current || 0) : 0;
  
  return Response.json({
    character: updatedChar,
    healing,
    rest_type,
    restorations,
    narrative: rest_type === 'long' ? restNarrative : undefined
  });
});