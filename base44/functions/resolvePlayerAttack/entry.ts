import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Resolves a player's attack action in combat.
 * Handles weapon and spell attacks, crits, damage calculation, and special effects.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { session_id, combat_id, character_id, payload } = await req.json();
  const { target_id, weapon, spell, modifiers = {} } = payload;

  const combatLog = await base44.entities.CombatLog.get(combat_id);
  const character = await base44.entities.Character.get(character_id);

  if (!combatLog || !character) {
    return Response.json({ error: 'Combat or character not found' }, { status: 404 });
  }

  // Security: verify ownership
  if (character.created_by !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

  // Simplified attack resolution (full logic from combatEngine player_attack)
  const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;
  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  let attackRoll = rollD20();
  let attackMod = 0;
  let damageDice = '1d6';
  let damageBonus = 0;
  let isCritical = attackRoll === 20;

  if (spell) {
    const spellAbility = { wizard: 'intelligence', cleric: 'wisdom', sorcerer: 'charisma' }[(character.class || '').toLowerCase()] || 'intelligence';
    attackMod = statMod(character[spellAbility]) + (character.proficiency_bonus || 2);
    damageDice = spell.damage_dice || '2d6';
  } else if (weapon) {
    const isFinesse = (weapon.properties || []).includes('finesse');
    const strMod = statMod(character.strength);
    const dexMod = statMod(character.dexterity);
    const abilityMod = weapon.type === 'ranged' ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
    attackMod = abilityMod + (character.proficiency_bonus || 2);
    damageBonus = abilityMod;
    damageDice = weapon.damage_dice || '1d8';
  }

  const hit = attackRoll !== 1 && (isCritical || (attackRoll + attackMod) >= target.ac);
  let damage = 0;

  if (hit) {
    const dMatch = damageDice.match(/^(\d+)d(\d+)$/);
    const numDice = isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1]);
    for (let i = 0; i < numDice; i++) damage += rollDice(parseInt(dMatch[2]));
    damage += damageBonus;
    damage = Math.max(1, damage);
    target.hp_current = Math.max(0, target.hp_current - damage);
    if (target.hp_current === 0) target.is_conscious = false;
  }

  const logEntry = {
    round: combatLog.round,
    actor: character.name,
    action: spell ? 'spell' : 'attack',
    target: target.name,
    hit,
    critical: isCritical,
    damage,
    text: `${character.name} ${hit ? (isCritical ? 'CRITICALLY strikes' : 'hits') : 'misses'} ${target.name} for ${damage} damage!`
  };

  const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
  await base44.entities.CombatLog.update(combat_id, {
    combatants: updatedCombatants,
    log_entries: [...(combatLog.log_entries || []), logEntry]
  });

  return Response.json({
    hit, damage, log_entry: logEntry, target_hp: target.hp_current
  });
});