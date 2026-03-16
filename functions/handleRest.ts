import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

  const { character_id, rest_type } = await req.json();

  const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
  const character = chars[0];
  if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

  const charClass = character.class;
  const charLevel = character.level || 1;
  const currentSlots = character.spell_slots || {};
  const maxSlots = SPELL_SLOTS_BY_CLASS[charClass]?.[charLevel - 1] || [];

  const updates = {};
  const restorations = [];

  if (rest_type === 'short') {
    // SHORT REST (1 hour)
    const hitDie = { Fighter: 10, Rogue: 8, Wizard: 6, Cleric: 8, Ranger: 10, Paladin: 10, Barbarian: 12, Bard: 8, Druid: 8, Monk: 8, Sorcerer: 6, Warlock: 8, Artificer: 8 }[charClass] || 8;
    const conMod = Math.floor(((character.constitution || 10) - 10) / 2);
    const diceToSpend = Math.max(1, Math.floor(charLevel / 2));
    let healing = 0;
    for (let i = 0; i < diceToSpend; i++) {
      healing += Math.floor(Math.random() * hitDie) + 1 + conMod;
    }
    const newHP = Math.min(character.hp_max, (character.hp_current || 0) + healing);
    updates.hp_current = newHP;
    restorations.push(`${healing} HP restored`);

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
      // Preserve long_rest_abilities, only reset short_rest abilities
    }
    if (charClass === 'Monk') restorations.push('Ki points recharged');
    if (charClass === 'Bard' && charLevel >= 5) restorations.push('Bardic Inspiration recovered');

    // Reset short-rest abilities but preserve arcane_recovery_used (resets on long rest only)
    const preservedShortRest = {};
    if (charClass === 'Wizard' && character.arcane_recovery_used) {
      // arcane_recovery_used is tracked separately; short_rest_abilities.arcane_recovery resets here
    }
    updates.short_rest_abilities = preservedShortRest;

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

    // Reset all spell slots
    if (maxSlots.length > 0) {
      updates.spell_slots = {};
      restorations.push('All spell slots recovered');
    }

    // Reset Arcane Recovery
    if (charClass === 'Wizard') {
      updates.arcane_recovery_used = false;
    }

    // Remove one level of exhaustion
    const conditions = character.conditions || [];
    const exhaustIdx = conditions.findIndex(c => (typeof c === 'string' ? c : c.name) === 'exhausted');
    if (exhaustIdx >= 0) {
      const newConditions = [...conditions];
      newConditions.splice(exhaustIdx, 1);
      updates.conditions = newConditions;
      restorations.push('Exhaustion reduced');
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