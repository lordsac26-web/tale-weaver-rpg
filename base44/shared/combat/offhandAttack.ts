import { statMod, resolveAttackRoll, rollDice, getActionsPerTurn, resolveActionAndAdvance } from './helpers.ts';
import { getAttackConcealment } from './conditions.ts';
import { finalizeAndPersistCombat } from './persistence.ts';

// Existing two-weapon handler moved without changing its behavior.
export async function handleOffhandAttack(ctx) {
  const { base44, session_id, combat_id, character_id, payload } = ctx;
  const { target_id, modifiers = {} } = payload;
  const combatLog = await base44.asServiceRole.entities.CombatLog.get(combat_id);
  const character = await base44.asServiceRole.entities.Character.get(character_id);
  const combatants = [...combatLog.combatants];
  const target = combatants.find(c => c.id === target_id);
  if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });
  const offhand = character.equipped?.offhand;
  const mainhand = character.equipped?.weapon || character.equipped?.mainhand;
  const isLight = (w) => (w?.properties || []).map(p => p.toLowerCase()).includes('light')
    || ['dagger','shortsword','scimitar','handaxe','light hammer','club','sickle'].includes((w?.name || '').toLowerCase());
  if (!offhand || !isLight(offhand) || !isLight(mainhand)) {
    return Response.json({ error: 'Two-weapon fighting requires a light melee weapon in each hand.', invalid: true }, { status: 400 });
  }
  if (combatLog.world_state?.bonus_action_used) {
    return Response.json({ error: 'Bonus action already used this turn.', invalid: true }, { status: 400 });
  }
  const strMod = statMod(character.strength);
  const dexMod = statMod(character.dexterity);
  const isFinesse = (offhand.properties || []).map(p => p.toLowerCase()).includes('finesse');
  const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
  const profBonus = character.proficiency_bonus || 2;
  const offConcealment = getAttackConcealment(character.conditions);
  const offAdvSources = [!!modifiers.advantage, offConcealment.length > 0];
  const offDisSources = [!!modifiers.disadvantage, (character.exhaustion_level || 0) >= 3];
  const offTargetConds = (target.conditions || []).map(c => (typeof c === 'string' ? c : c?.name));
  if (['paralyzed', 'stunned', 'unconscious', 'restrained', 'prone', 'blinded'].some(cn => offTargetConds.includes(cn))) {
    offAdvSources.push(true);
  }
  const offRollResult = resolveAttackRoll({
    advSources: offAdvSources,
    disSources: offDisSources,
    forceCrit: offTargetConds.includes('paralyzed') || offTargetConds.includes('unconscious'),
    rerollOnes: (character.race || '') === 'Halfling',
  });
  const attackRoll = offRollResult.roll;
  const isCritical = offRollResult.isCritical;
  const isMiss = offRollResult.isMiss;
  const attackMod = abilityMod + profBonus + (offhand.attack_bonus || 0);
  const totalAttack = attackRoll + attackMod;
  const hit = !isMiss && (isCritical || totalAttack >= target.ac);
  const hasTWFStyle = (character.fighting_style || '').toLowerCase().includes('two-weapon');
  let damage = 0;
  const damageRolls = [];
  if (hit) {
    const dMatch = (offhand.damage_dice || offhand.damage || '1d4').match(/^(\d+)d(\d+)$/);
    const numDice = dMatch ? (isCritical ? parseInt(dMatch[1]) * 2 : parseInt(dMatch[1])) : (isCritical ? 2 : 1);
    const sides = dMatch ? parseInt(dMatch[2]) : 4;
    for (let i = 0; i < numDice; i++) { const r = rollDice(sides); damageRolls.push(r); damage += r; }
    if (hasTWFStyle) damage += abilityMod;
    else if (abilityMod < 0) damage += abilityMod;
    damage += (offhand.damage_bonus || 0);
    damage = Math.max(1, damage);
    target.hp_current = Math.max(0, target.hp_current - damage);
    if (target.hp_current === 0) target.is_conscious = false;
  }
  const logEntry = {
    round: combatLog.round, actor: character.name, action: 'offhand_attack', target: target.name,
    hit, critical: isCritical, attack_roll: totalAttack, damage,
    text: hit
      ? `${character.name} strikes with their off-hand ${offhand.name}${isCritical ? ' (CRIT!)' : ''} for ${damage} damage!${hasTWFStyle ? '' : ' (no ability mod — off-hand)'} (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${offConcealment.length ? ' Advantage: attacking from concealment.' : ''}${target.hp_current === 0 ? ` ${target.name} falls!` : ` HP: ${target.hp_current}/${target.hp_max}`}`
      : `${character.name}'s off-hand ${offhand.name} misses ${target.name}! (Roll: ${attackRoll}+${attackMod}=${totalAttack} vs AC ${target.ac})${offConcealment.length ? ' Advantage: attacking from concealment.' : ''}`
  };
  const updatedCombatants = combatants.map(c => c.id === target_id ? target : c);
  const { worldState: newWorldState } = resolveActionAndAdvance(combatLog, updatedCombatants, character, { isBonusAction: true });
  const result = await finalizeAndPersistCombat(base44, character_id, combat_id, session_id, updatedCombatants,
    [...(combatLog.log_entries || []), logEntry],
    combatLog.current_turn_index, combatLog.round, newWorldState);
  return Response.json({
    hit, damage, damage_rolls: damageRolls, attack_roll: totalAttack, log_entry: logEntry,
    target_hp: target.hp_current, result, combat_ended: result !== 'ongoing',
    bonus_action_used: true, two_weapon_style: hasTWFStyle
  });
}