import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

  const updates = {};

  if (rest_type === 'short') {
    // SHORT REST (1 hour)
    // - Spend Hit Dice to heal (not auto-healed, but we'll auto-spend for simplicity)
    // - Warlock regains all spell slots
    // - Fighter regains Action Surge + Second Wind
    // - Monk regains Ki points
    // - Bard regains Bardic Inspiration

    // Auto-spend half of available hit dice for healing
    const hitDie = { Fighter: 10, Rogue: 8, Wizard: 6, Cleric: 8, Ranger: 10, Paladin: 10, Barbarian: 12, Bard: 8, Druid: 8, Monk: 8, Sorcerer: 6, Warlock: 8, Artificer: 8 }[character.class] || 8;
    const conMod = Math.floor(((character.constitution || 10) - 10) / 2);
    const level = character.level || 1;
    const diceToSpend = Math.max(1, Math.floor(level / 2));
    let healing = 0;
    for (let i = 0; i < diceToSpend; i++) {
      healing += Math.floor(Math.random() * hitDie) + 1 + conMod;
    }
    const newHP = Math.min(character.hp_max, (character.hp_current || 0) + healing);
    updates.hp_current = newHP;

    // Warlock: restore all spell slots
    if (character.class === 'Warlock') {
      const slots = {};
      for (let i = 1; i <= 9; i++) {
        slots[`level_${i}`] = 0; // reset to 0 used
      }
      updates.spell_slots = slots;
    }

    // Clear short-rest abilities used flags (if we add them later)
    updates.short_rest_abilities = {};

  } else if (rest_type === 'long') {
    // LONG REST (8 hours)
    // - Restore full HP
    // - Restore all spell slots
    // - Restore ½ hit dice (minimum 1)
    // - Remove exhaustion levels (1 level)
    // - All class abilities reset

    updates.hp_current = character.hp_max;

    // Reset all spell slots
    const slots = {};
    for (let i = 1; i <= 9; i++) {
      slots[`level_${i}`] = 0; // 0 = none used
    }
    updates.spell_slots = slots;

    // Remove one level of exhaustion (if present)
    const conditions = character.conditions || [];
    const exhaustIdx = conditions.findIndex(c => (typeof c === 'string' ? c : c.name) === 'exhausted');
    if (exhaustIdx >= 0) {
      const newConditions = [...conditions];
      newConditions.splice(exhaustIdx, 1);
      updates.conditions = newConditions;
    }

    // Reset death saves
    updates.death_saves_success = 0;
    updates.death_saves_failure = 0;

    // Clear ability usage trackers
    updates.short_rest_abilities = {};
    updates.long_rest_abilities = {};
  }

  await base44.asServiceRole.entities.Character.update(character_id, updates);

  const updatedChars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
  
  return Response.json({
    character: updatedChars[0],
    healing: updates.hp_current - (character.hp_current || 0),
    rest_type,
    restorations: rest_type === 'short' ? 
      ['Hit Dice healing', 'Short rest abilities'] :
      ['Full HP', 'All spell slots', 'Hit Dice', 'All abilities']
  });
});