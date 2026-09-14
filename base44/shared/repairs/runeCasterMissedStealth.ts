import { applyDamageModifiers, statMod } from '../combat/helpers.ts';
import { rollWeaponBaseDamage } from '../combat/weaponDamage.ts';
import { checkReceipt, storeReceipt } from '../combat/authGuard.ts';
import { resolveSneakAttack } from '../combat/sneakAttack.ts';

export const RUNE_CASTER_REPAIR_CONTRACT = {
  combatId: '6aa746e6987af77e96be7413',
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  targetId: 'enemy_thoau9uc9',
  otherTargetId: 'enemy_zdcmtp6rp',
  actorName: "Craig's Ranger",
  targetName: 'Rune-Caster',
  otherTargetName: 'Cultist Guard',
  historicalRequestId: 'story-choice:6a6825edd695bd65a4322256:e004fb4f-6fd3-4344-86f1-83a7af353ace:weapon:0',
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'updated_date'));
const rollDie = (sides, rng) => Math.floor(rng() * sides) + 1;
const attackText = `${RUNE_CASTER_REPAIR_CONTRACT.actorName} misses ${RUNE_CASTER_REPAIR_CONTRACT.targetName}! (Roll: 1+9=10 vs AC 13)`;
const arrowQuantity = (character) => (character.inventory || []).find((entry) => /^arrows$/i.test(entry?.name || ''))?.quantity ?? null;

const protectedHashesFor = async (character, session, combat) => ({
  character: await hash(semantic(character)),
  session: await hash(semantic(session)),
  combat: await hash(semantic(combat)),
  latest_attack: await hash((combat.log_entries || []).at(-1)),
});

export async function auditRepairRuneCasterMissedStealth({ db, scope, mode, requestId, expectedHashes = null, rng = Math.random }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode dry_run/apply and request_id are required', writes: 0 } };
  const [character, session, combat] = await Promise.all([
    db.entities.Character.get(scope.characterId),
    db.entities.GameSession.get(scope.sessionId),
    db.entities.CombatLog.get(scope.combatId),
  ]);
  if (!character || !session || !combat) return { status: 409, body: { error: 'Protected records are missing', writes: 0 } };

  const prior = checkReceipt(combat.world_state, requestId);
  if (mode === 'apply' && prior?.correction_type === 'missed_stealthed_advantage') {
    return { status: 200, body: { ...prior, already_processed: true, writes: 0 } };
  }

  const contract = RUNE_CASTER_REPAIR_CONTRACT;
  const playerIndex = (combat.combatants || []).findIndex((entry) => entry?.id === scope.characterId);
  const player = (combat.combatants || [])[playerIndex];
  const target = (combat.combatants || []).find((entry) => entry?.id === contract.targetId);
  const otherTarget = (combat.combatants || []).find((entry) => entry?.id === contract.otherTargetId);
  const attacks = (combat.log_entries || []).map((entry, index) => ({ entry, index })).filter(({ entry }) => entry?.action === 'attack');
  const latest = (combat.log_entries || []).at(-1);
  const weapon = character.equipped?.weapon || null;
  const receipts = Array.isArray(combat.world_state?.__receipts) ? combat.world_state.__receipts : [];
  const ammoReceipts = Array.isArray(combat.world_state?.__ammo_receipts) ? combat.world_state.__ammo_receipts : [];
  const historicalReceipt = receipts.filter((entry) => entry?.id === contract.historicalRequestId && entry?.action === 'player_attack');
  const ammoReceipt = ammoReceipts.filter((entry) => entry?.request_id === contract.historicalRequestId);
  const setup = combat.world_state?.ambush_setup;
  const protectedHashes = await protectedHashesFor(character, session, combat);
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const modifierComponents = [
    { type: 'ability', source: 'dexterity', value: statMod(character.dexterity) },
    { type: 'proficiency', source: 'proficiency bonus', value: Number(character.proficiency_bonus || 2) },
    { type: 'fighting_style', source: 'Fighting Style: Archery', value: 2 },
  ];
  const modifierTotal = modifierComponents.reduce((sum, component) => sum + component.value, 0);

  const guards = {
    exact_ids_and_linkage: scope.combatId === contract.combatId && scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && session.character_id === scope.characterId && session.combat_state?.combat_id === scope.combatId && combat.session_id === scope.sessionId && combat.character_id === scope.characterId,
    active_exact_turn: combat.is_active === true && session.in_combat === true && combat.round === 1 && combat.current_turn_index === playerIndex && playerIndex === 1,
    unique_latest_attack: attacks.length === 1 && attacks[0].index === (combat.log_entries || []).length - 1 && latest?.request_id === contract.historicalRequestId && latest?.actor === contract.actorName && latest?.target === contract.targetName,
    exact_invalid_roll: latest?.hit === false && latest?.raw_d20 === 1 && latest?.selected_d20 === 1 && latest?.all_rolls?.length === 1 && latest?.all_rolls?.[0] === 1 && latest?.attack_bonus === 9 && latest?.attack_roll === 10 && latest?.target_ac === 13 && latest?.advantage === false && latest?.text === attackText,
    exact_weapon_and_modifier: weapon?.name === 'Longbow' && weapon?.damage_dice === '1d8' && weapon?.damage_type === 'piercing' && weapon?.type === 'ranged' && modifierTotal === 9,
    exact_ammunition_receipt: arrowQuantity(character) === 17 && ammoReceipt.length === 1 && ammoReceipt[0]?.quantity_before === 18 && ammoReceipt[0]?.quantity_after === 17 && ammoReceipt[0]?.consumed === 1,
    exact_historical_receipt_latest: historicalReceipt.length === 1 && receipts.at(-1)?.id === contract.historicalRequestId && historicalReceipt[0]?.outcome?.hit === false && historicalReceipt[0]?.outcome?.attack_roll === 10,
    successful_stealth_setup_dropped: setup?.setup_success === true && setup?.attack_resolved === true && setup?.consumed_by_request_id === contract.historicalRequestId && setup?.target_name === contract.targetName && setup?.concealed === false,
    rune_caster_unchanged_and_unaware: target?.name === contract.targetName && target?.hp_current === 23 && target?.hp_max === 23 && target?.ac === 13 && target?.is_conscious === true && (target.conditions || []).some((entry) => /unaware of the ranger/i.test(entry?.name || entry)),
    cultist_guard_unchanged: otherTarget?.name === contract.otherTargetName && otherTarget?.hp_current === 12 && otherTarget?.hp_max === 12 && otherTarget?.ac === 12 && otherTarget?.is_conscious === true,
    player_and_action_unchanged: character.hp_current === 43 && player?.hp_current === 43 && combat.world_state?.actions_used_this_turn === 1 && combat.world_state?.attacks_used_this_action === 1 && combat.world_state?.attacks_remaining === 1,
    exact_precondition_hashes: hashesMatch,
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([key]) => key);
  const report = {
    success: failedGuards.length === 0,
    apply_safe: failedGuards.length === 0,
    dry_run: mode === 'dry_run',
    mode,
    request_id: requestId,
    original_attack_request_id: contract.historicalRequestId,
    writes: 0,
    guards,
    failed_guards: failedGuards,
    protected_hashes: protectedHashes,
    observed: {
      round: combat.round,
      current_turn_index: combat.current_turn_index,
      actions_used_this_turn: combat.world_state?.actions_used_this_turn,
      latest_attack: latest,
      rune_caster_hp: target?.hp_current,
      cultist_guard_hp: otherTarget?.hp_current,
      player_hp: player?.hp_current,
      arrows: arrowQuantity(character),
      setup,
    },
  };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length) return { status: 409, body: { error: 'Rune-Caster correction guards failed; no write was made.', ...report } };

  const secondD20 = rollDie(20, rng);
  const selectedD20 = Math.max(1, secondD20);
  const finalTotal = selectedD20 + modifierTotal;
  const critical = selectedD20 === 20;
  const hit = critical || (selectedD20 !== 1 && finalTotal >= target.ac);
  const sneakAttack = resolveSneakAttack({ character, weapon, advantage: true, disadvantage: false, alreadyUsed: combat.world_state?.sneak_attack_used === true });
  let baseDamage = 0;
  let damageRolls = [];
  let sneakDamage = 0;
  let sneakRolls = [];
  if (hit) {
    const base = rollWeaponBaseDamage({
      damageDice: weapon.damage_dice,
      damageBonus: statMod(character.dexterity) + Number(weapon.damage_bonus || 0),
      diceCountOverride: critical ? 2 : 1,
      rollDie: (sides) => rollDie(sides, rng),
    });
    if (!base.parsed) return { status: 409, body: { error: 'Longbow damage is not mechanically resolvable.', writes: 0 } };
    baseDamage = base.damage;
    damageRolls = base.rolls;
    if (sneakAttack.eligible) {
      const match = sneakAttack.dice.match(/^(\d+)d(\d+)$/);
      const count = Number(match?.[1] || 0) * (critical ? 2 : 1);
      const sides = Number(match?.[2] || 0);
      sneakRolls = Array.from({ length: count }, () => rollDie(sides, rng));
      sneakDamage = sneakRolls.reduce((sum, roll) => sum + roll, 0);
    }
  }
  const damage = hit ? applyDamageModifiers(Math.max(1, baseDamage + sneakDamage), weapon.damage_type, target).amount : 0;
  const targetHpAfter = Math.max(0, target.hp_current - damage);
  const advantageAttribution = 'Attacking from Stealthed/concealed';
  const rollBreakdown = {
    roll_type: 'attack',
    roll_origin: 'guarded_correction',
    dice: { mode: 'advantage', rolls: [1, secondD20], selected: selectedD20, advantage_sources: [advantageAttribution], disadvantage_sources: [] },
    modifiers: modifierComponents,
    modifier_total: modifierTotal,
    final_total: finalTotal,
    target_ac: target.ac,
  };
  const sneakReceipt = hit && sneakAttack.eligible ? { dice: sneakAttack.dice, damage: sneakDamage, rolls: sneakRolls, attribution: sneakAttack.attribution, version: sneakAttack.version } : null;
  const correctedLog = {
    ...latest,
    raw_d20: selectedD20,
    selected_d20: selectedD20,
    first_raw_d20: 1,
    second_raw_d20: secondD20,
    all_rolls: [1, secondD20],
    advantage: true,
    disadvantage: false,
    advantage_sources: [advantageAttribution],
    disadvantage_sources: [],
    attack_roll: finalTotal,
    hit,
    critical,
    damage,
    damage_rolls: damageRolls,
    base_damage: baseDamage,
    sneak_attack: sneakReceipt,
    roll_breakdown: rollBreakdown,
    correction_type: 'missed_stealthed_advantage',
    correction_request_id: requestId,
    corrected_at: new Date().toISOString(),
  };
  const rollText = `Advantage [1, ${secondD20}] → ${selectedD20}; ${selectedD20}+${modifierTotal}=${finalTotal} vs AC ${target.ac}`;
  const modifierText = modifierComponents.map((component) => `${component.source} +${component.value}`).join('; ');
  correctedLog.text = hit
    ? `${character.name} hits ${target.name} for ${damage} ${weapon.damage_type} damage! Base ${baseDamage}${sneakReceipt ? ` + Sneak Attack ${sneakDamage} (${sneakRolls.join('+')}) = ${damage}. ${sneakReceipt.attribution}; +${sneakReceipt.dice}.` : '.'} (Roll: ${rollText}) Modifiers: ${modifierText}. Advantage source: ${advantageAttribution}.${targetHpAfter === 0 ? ` ${target.name} falls!` : ` HP: ${targetHpAfter}/${target.hp_max}`}`
    : `${character.name} misses ${target.name}! (Roll: ${rollText}) Modifiers: ${modifierText}. Advantage source: ${advantageAttribution}.`;

  const outcome = {
    immutable: true,
    success: true,
    correction_type: 'missed_stealthed_advantage',
    request_id: requestId,
    original_attack_request_id: contract.historicalRequestId,
    first_d20: 1,
    second_d20: secondD20,
    selected_d20: selectedD20,
    all_rolls: [1, secondD20],
    hit,
    critical,
    attack_bonus: modifierTotal,
    attack_roll: finalTotal,
    damage,
    base_damage: baseDamage,
    damage_rolls: damageRolls,
    sneak_attack: sneakReceipt,
    target_hp_before: target.hp_current,
    target_hp_after: targetHpAfter,
    roll_breakdown: rollBreakdown,
    before_hashes: protectedHashes,
  };
  const nextTarget = { ...target, hp_current: targetHpAfter, is_conscious: targetHpAfter > 0 };
  const nextCombatants = (combat.combatants || []).map((entry) => entry.id === target.id ? nextTarget : entry);
  let nextWorldState = { ...(combat.world_state || {}) };
  if (sneakReceipt) nextWorldState.sneak_attack_used = true;
  nextWorldState = storeReceipt(nextWorldState, requestId, 'repair_missed_stealthed_attack', outcome);

  const [freshCharacter, freshSession, freshCombat] = await Promise.all([
    db.entities.Character.get(scope.characterId),
    db.entities.GameSession.get(scope.sessionId),
    db.entities.CombatLog.get(scope.combatId),
  ]);
  const concurrencyHashes = await protectedHashesFor(freshCharacter, freshSession, freshCombat);
  if (!Object.entries(protectedHashes).every(([key, value]) => concurrencyHashes[key] === value)) {
    return { status: 409, body: { error: 'Protected state changed after dry-run validation; no write was made.', writes: 0, expected_hashes: protectedHashes, changed_hashes: concurrencyHashes } };
  }

  await db.entities.CombatLog.update(combat.id, {
    combatants: nextCombatants,
    log_entries: (combat.log_entries || []).map((entry, index) => index === attacks[0].index ? correctedLog : entry),
    world_state: nextWorldState,
  });
  const [afterCharacter, afterSession, afterCombat] = await Promise.all([
    db.entities.Character.get(scope.characterId),
    db.entities.GameSession.get(scope.sessionId),
    db.entities.CombatLog.get(scope.combatId),
  ]);
  const afterHashes = await protectedHashesFor(afterCharacter, afterSession, afterCombat);
  return {
    status: 200,
    body: {
      ...outcome,
      already_processed: false,
      writes: 1,
      protected_hashes: protectedHashes,
      after_hashes: afterHashes,
      unchanged_hashes: { character: protectedHashes.character === afterHashes.character, session: protectedHashes.session === afterHashes.session },
      arrows_after: arrowQuantity(afterCharacter),
      actions_used_after: afterCombat.world_state?.actions_used_this_turn,
      current_turn_index_after: afterCombat.current_turn_index,
      other_target_after: (afterCombat.combatants || []).find((entry) => entry.id === contract.otherTargetId),
    },
  };
}