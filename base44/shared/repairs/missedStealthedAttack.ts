import { applyDamageModifiers, statMod } from '../combat/helpers.ts';
import { rollWeaponBaseDamage } from '../combat/weaponDamage.ts';
import { consumeBreakOnAttackConditions, getAttackConcealment, normalizeConditionName } from '../combat/conditions.ts';
import { checkReceipt, storeReceipt } from '../combat/authGuard.ts';

export const MISSED_STEALTHED_ATTACK_CONTRACT = {
  combatId: '6a7a24fa5fc6300afbbe2507',
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  targetId: 'enemy_8hz789yme',
  actorName: "Craig's Ranger",
  targetName: 'Skeleton Reinforcement',
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'updated_date'));
const conditionCount = (arr, name) => (arr || []).filter((entry) => normalizeConditionName(typeof entry === 'string' ? entry : entry?.name) === name).length;
const exactMissText = (contract) => `${contract.actorName} misses ${contract.targetName}! (Roll: 2+9=11 vs AC 13)`;
const rollD20 = (rng) => Math.floor(rng() * 20) + 1;

const attackBonusFor = (character, weapon) => {
  const dex = statMod(character.dexterity);
  const proficiency = Number(character.proficiency_bonus || 2);
  const archery = String(character.fighting_style || '').toLowerCase() === 'archery' && weapon?.type === 'ranged' ? 2 : 0;
  return dex + proficiency + archery + Number(weapon?.attack_bonus || 0);
};

export async function auditRepairMissedStealthedAttackCore({ db, scope, mode, requestId, expectedHashes = null, rng = Math.random, contract = MISSED_STEALTHED_ATTACK_CONTRACT }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode dry_run/apply and request_id are required', writes: 0 } };
  const [character, session, combat] = await Promise.all([
    db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.get(scope.combatId),
  ]);
  if (!character || !session || !combat) return { status: 409, body: { error: 'Protected records are missing', writes: 0 } };

  const prior = checkReceipt(combat.world_state, requestId);
  if (mode === 'apply' && prior?.correction_type === 'missed_stealthed_advantage') return { status: 200, body: { ...prior, already_processed: true, writes: 0 } };

  const player = (combat.combatants || []).find((entry) => entry?.type === 'player' && entry.id === scope.characterId);
  const target = (combat.combatants || []).find((entry) => entry?.id === contract.targetId);
  const attacks = (combat.log_entries || []).map((entry, index) => ({ entry, index })).filter(({ entry }) => entry?.action === 'attack');
  const latest = (combat.log_entries || []).at(-1);
  const weapon = character.equipped?.weapon || character.equipped?.mainhand || null;
  const parsed = String(latest?.text || '').match(/Roll:\s*(\d+)\+(\d+)=(\d+)\s+vs AC\s+(\d+)/i);
  const firstD20 = Number(parsed?.[1]);
  const parsedBonus = Number(parsed?.[2]);
  const parsedTotal = Number(parsed?.[3]);
  const parsedAc = Number(parsed?.[4]);
  const calculatedBonus = attackBonusFor(character, weapon);
  const protectedHashes = {
    character: await hash(semantic(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)), latest_attack: await hash(latest),
  };
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const noLaterReceipt = !(combat.world_state?.__receipts || []).some((entry) => entry?.action === 'player_attack');
  const skeletons = (combat.combatants || []).filter((entry) => /skeleton/i.test(entry?.name || ''));
  const guards = {
    exact_ids_and_linkage: scope.combatId === contract.combatId && scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && session.character_id === scope.characterId && session.combat_state?.combat_id === scope.combatId && combat.session_id === scope.sessionId,
    unique_latest_attack: attacks.length === 1 && attacks[0].index === (combat.log_entries || []).length - 1 && latest?.actor === contract.actorName && latest?.target === contract.targetName,
    exact_incomplete_miss: latest?.hit === false && latest?.attack_roll === 11 && latest?.text === exactMissText(contract) && firstD20 === 2 && parsedBonus === 9 && parsedTotal === 11 && parsedAc === 13,
    exact_weapon_and_bonus: weapon?.name === 'Longbow' && weapon?.damage_dice === '1d8' && weapon?.damage_type === 'piercing' && weapon?.type === 'ranged' && calculatedBonus === 9,
    ammunition_already_consumed: (character.inventory || []).some((entry) => /arrow/i.test(entry?.name || '') && Number(entry?.quantity || 0) === 0),
    target_unchanged: target?.hp_current === 16 && target?.hp_max === 16 && target?.ac === 13 && target?.is_conscious === true,
    no_subsequent_action_or_damage: noLaterReceipt && skeletons.length === 3 && skeletons.every((entry) => entry.hp_current === entry.hp_max && entry.is_conscious) && character.hp_current === 30 && player?.hp_current === 30,
    player_turn_action_once: combat.round === 1 && combat.current_turn_index === (combat.combatants || []).findIndex((entry) => entry?.id === scope.characterId) && combat.world_state?.actions_used_this_turn === 1,
    exactly_one_stealthed_each: conditionCount(character.conditions, 'stealthed') === 1 && conditionCount(player?.conditions, 'stealthed') === 1,
    pwt_preserved_and_not_advantage: conditionCount(character.conditions, 'pass without trace') === 1 && getAttackConcealment((character.conditions || []).filter((entry) => normalizeConditionName(entry?.name || entry) === 'pass without trace')).length === 0,
    exact_precondition_hashes: hashesMatch,
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([key]) => key);
  const report = {
    success: failedGuards.length === 0, dry_run: mode === 'dry_run', mode, request_id: requestId, writes: 0, apply_safe: failedGuards.length === 0,
    guards, failed_guards: failedGuards, protected_hashes: protectedHashes,
    observed: { combat_id: combat.id, round: combat.round, current_turn_index: combat.current_turn_index, actions_used_this_turn: combat.world_state?.actions_used_this_turn, latest_attack_index: attacks[0]?.index ?? null, latest_attack: latest, first_d20: firstD20, attack_bonus: parsedBonus, final_total: parsedTotal, ac: parsedAc, target: target ? { id: target.id, hp_current: target.hp_current, hp_max: target.hp_max, ac: target.ac } : null, weapon: weapon ? { name: weapon.name, damage_dice: weapon.damage_dice, damage_type: weapon.damage_type, type: weapon.type, attack_bonus: weapon.attack_bonus || 0, damage_bonus: weapon.damage_bonus || 0, properties: weapon.properties || [] } : null, character_hp: character.hp_current, player_conditions: (player?.conditions || []).map((entry) => ({ name: entry?.name || entry, source: entry?.source || null, duration: entry?.duration || entry?.duration_type || null, concentration: !!entry?.concentration })), character_conditions: (character.conditions || []).map((entry) => ({ name: entry?.name || entry, source: entry?.source || null, duration: entry?.duration || entry?.duration_type || null, concentration: !!entry?.concentration })) },
    repair_proposal: ['Preserve observed first d20 2 and roll exactly one missing advantage d20.', 'Select the higher roll and resolve the same Longbow attack against Skeleton Reinforcement AC 13.', 'Keep actions_used_this_turn at 1 and consume Stealthed once from CombatLog and Character.', 'Preserve Pass without Trace and consume no additional ammunition.', 'Store the corrected attack and idempotency receipt before returning.'],
  };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length) return { status: 409, body: { error: 'Missed advantage repair invariants failed; no write was made.', ...report } };

  const secondD20 = rollD20(rng);
  const selectedD20 = Math.max(2, secondD20);
  const finalTotal = selectedD20 + calculatedBonus;
  const critical = selectedD20 === 20;
  const hit = critical || (selectedD20 !== 1 && finalTotal >= target.ac);
  let damage = 0; let damageRolls = [];
  if (hit) {
    const diceCount = (critical ? 2 : 1) * Number(String(weapon.damage_dice).match(/(\d+)d/)?.[1] || 0);
    const rolled = rollWeaponBaseDamage({ damageDice: weapon.damage_dice, damageBonus: statMod(character.dexterity) + Number(weapon.damage_bonus || 0), diceCountOverride: diceCount, rollDie: (sides) => Math.floor(rng() * sides) + 1 });
    if (!rolled.parsed) return { status: 409, body: { error: 'Weapon damage data is not mechanically resolvable.', writes: 0 } };
    const adjusted = applyDamageModifiers(Math.max(1, rolled.damage), weapon.damage_type, target);
    damage = adjusted.amount; damageRolls = rolled.rolls;
  }
  const nextTargetHp = Math.max(0, target.hp_current - damage);
  const nextTarget = { ...target, hp_current: nextTargetHp, is_conscious: nextTargetHp > 0 };
  const nextPlayer = { ...player, conditions: consumeBreakOnAttackConditions(player.conditions) };
  const nextCombatants = (combat.combatants || []).map((entry) => entry.id === target.id ? nextTarget : entry.id === player.id ? nextPlayer : entry);
  const attribution = 'Attacking from Stealthed/concealed';
  const correctedLog = { ...latest, target_id: target.id, request_id: requestId, weapon: { name: weapon.name, damage_dice: weapon.damage_dice, damage_type: weapon.damage_type, damage_bonus: weapon.damage_bonus || 0, attack_bonus: weapon.attack_bonus || 0, type: weapon.type, properties: weapon.properties || [] }, raw_d20: selectedD20, first_raw_d20: 2, second_raw_d20: secondD20, selected_d20: selectedD20, all_rolls: [2, secondD20], advantage: true, disadvantage: false, advantage_sources: [attribution], attack_bonus: calculatedBonus, attack_roll: finalTotal, target_ac: target.ac, hit, critical, damage, damage_rolls: damageRolls, correction_type: 'missed_stealthed_advantage', corrected_at: new Date().toISOString(), text: hit ? `${character.name} hits ${target.name} for ${damage} ${weapon.damage_type} damage! (Roll: Advantage [2, ${secondD20}] → ${selectedD20}; ${selectedD20}+${calculatedBonus}=${finalTotal} vs AC ${target.ac}) Advantage source: ${attribution}.${nextTargetHp === 0 ? ` ${target.name} falls!` : ` HP: ${nextTargetHp}/${target.hp_max}`}` : `${character.name} misses ${target.name}! (Roll: Advantage [2, ${secondD20}] → ${selectedD20}; ${selectedD20}+${calculatedBonus}=${finalTotal} vs AC ${target.ac}) Advantage source: ${attribution}.` };
  const outcome = { success: true, correction_type: 'missed_stealthed_advantage', request_id: requestId, hit, damage, raw_d20: selectedD20, all_rolls: [2, secondD20], attack_bonus: calculatedBonus, attack_roll: finalTotal, target_ac: target.ac, target_hp: nextTargetHp, log_entry: correctedLog };
  let nextWorldState = { ...(combat.world_state || {}), actions_used_this_turn: 1 };
  if (hit && nextCombatants.some((entry) => entry.type === 'enemy' && entry.id !== target.id && entry.is_conscious && entry.hp_current > 0)) {
    nextWorldState.horde_breaker_available = true; nextWorldState.horde_breaker_origin_target_id = target.id;
  }
  nextWorldState = storeReceipt(nextWorldState, requestId, 'repair_missed_stealthed_attack', outcome);
  await Promise.all([
    db.entities.Character.update(character.id, { conditions: consumeBreakOnAttackConditions(character.conditions) }),
    db.entities.CombatLog.update(combat.id, { combatants: nextCombatants, log_entries: (combat.log_entries || []).map((entry, index) => index === attacks[0].index ? correctedLog : entry), world_state: nextWorldState }),
  ]);
  return { status: 200, body: { ...outcome, already_processed: false, writes: 2, protected_hashes: protectedHashes } };
}