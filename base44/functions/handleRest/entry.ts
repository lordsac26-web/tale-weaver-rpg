import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Spell slot progression by class
const SPELL_SLOTS_BY_CLASS = {
  Wizard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Sorcerer: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Bard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Cleric: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Druid: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Paladin: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Ranger: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Artificer: [[0],[2],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Warlock: [[1],[2],[2],[2],[2],[2],[2],[2],[2],[2],[3],[3],[3],[3],[3],[3],[4],[4],[4],[4]],
};

/**
 * Handle Short and Long Rests
 * Restores HP, spell slots, hit dice, and class abilities per D&D 5E rules
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { character_id, rest_type, hit_dice_to_spend } = await req.json();

  const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
  const character = chars[0];
  if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

  const charClass = character.class;
  const charLevel = character.level || 1;
  const currentSlots = character.spell_slots || {};
  const maxSlots = SPELL_SLOTS_BY_CLASS[charClass]?.[charLevel - 1] || [];

  const updates = {};
  const restorations = [];

  // Hit die size by class (PHB)
  const HIT_DIE = { Fighter: 10, Rogue: 8, Wizard: 6, Cleric: 8, Ranger: 10, Paladin: 10, Barbarian: 12, Bard: 8, Druid: 8, Monk: 8, Sorcerer: 6, Warlock: 8, Artificer: 8 };
  const hitDie = HIT_DIE[charClass] || 8;
  const conMod = Math.floor(((character.constitution || 10) - 10) / 2);

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

    // Wizard: reset Arcane Recovery availability
    if (charClass === 'Wizard') {
      updates.arcane_recovery_used = false;
      restorations.push('Arcane Recovery available');
    }

    if (charClass === 'Fighter') {
      restorations.push('Action Surge & Second Wind recovered');
    }
    if (charClass === 'Monk') restorations.push('Ki points recharged');
    if (charClass === 'Bard' && charLevel >= 5) restorations.push('Bardic Inspiration recovered');

    // Reset all short-rest ability tracking (Action Surge, Second Wind, Arcane Recovery, etc.)
    // arcane_recovery is gated by arcane_recovery_used flag (long rest only) — reset here to allow use again if not yet used
    updates.short_rest_abilities = {};

  } else if (rest_type === 'long') {
    // LONG REST (8 hours)
    
    // Random encounter check (20% chance)
    const encounterRoll = Math.random();
    if (encounterRoll < 0.2) {
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
    const restNarrative = narratives[Math.floor(Math.random() * narratives.length)];
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

    // Remove one level of exhaustion (PHB p.186/291: a long rest reduces exhaustion by 1)
    const currentExhaustion = character.exhaustion_level || 0;
    if (currentExhaustion > 0) {
      updates.exhaustion_level = Math.max(0, currentExhaustion - 1);
      restorations.push(`Exhaustion reduced to level ${updates.exhaustion_level}`);
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

    updates.death_saves_success = 0;
    updates.death_saves_failure = 0;
    updates.short_rest_abilities = {};
    updates.long_rest_abilities = {};
    restorations.push('All abilities recharged');
  }

  await base44.asServiceRole.entities.Character.update(character_id, updates);

  const updatedChars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
  const healing = updates.hp_current != null ? updates.hp_current - (character.hp_current || 0) : 0;
  
  return Response.json({
    character: updatedChars[0],
    healing,
    rest_type,
    restorations,
    narrative: rest_type === 'long' ? restNarrative : undefined
  });
});