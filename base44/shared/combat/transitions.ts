// Authoritative combat transition handlers — flee, de-escalation resolve, and
// loot collection. These replace browser-scoped CombatLog/Character writes with
// server-authoritative, idempotent backend actions (defect #1).
//
// All handlers validate the full ownership chain (defect #4) and use request-id
// idempotency receipts (defect #3) to prevent double-award of XP/loot or
// duplicate combat-end writes.
import {
  requireUser, validateCombatOwnership, checkReceipt, storeReceipt,
} from './authGuard.ts';
import { awardVictoryXP } from './persistence.ts';

// ─── FLEE COMBAT ────────────────────────────────────────────────────────────
// Ends the active combat with result='fled'. The flee roll itself is done by
// the caller (rollDice function); this handler only performs the authoritative
// state transition. Idempotent: a replay returns the prior outcome.
export async function handleFleeCombat(ctx) {
  const { base44, session_id, combat_id, character_id, request_id, payload } = ctx;
  const { user, error: authError } = await requireUser(base44);
  if (authError) return authError;

  const { session, character, combat, error } = await validateCombatOwnership(base44,
    { session_id, combat_id, character_id, user });
  if (error) return error;
  if (!combat) return Response.json({ error: 'combat_id is required' }, { status: 400 });
  if (!combat.is_active) {
    return Response.json({ error: 'Combat is already ended', result: combat.result, already_ended: true },
      { status: 409 });
  }

  // Idempotency: replay returns the prior outcome
  const prior = checkReceipt(combat.world_state, request_id);
  if (prior) return Response.json({ ...prior, idempotent_replay: true });

  const fleeSuccess = !!(payload?.flee_success);
  const logEntry = {
    round: combat.round, actor: character.name, action: 'flee',
    text: fleeSuccess
      ? `🏃 ${character.name} flees from combat!`
      : `${character.name} attempts to flee but the combat continues.`,
  };

  if (fleeSuccess) {
    const newWorldState = storeReceipt(combat.world_state, request_id, 'flee_combat', { success: true, result: 'fled' });
    await base44.asServiceRole.entities.CombatLog.update(combat_id, {
      is_active: false, result: 'fled',
      log_entries: [...(combat.log_entries || []), logEntry],
      world_state: newWorldState,
    });
    await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false, combat_state: {} });
  } else {
    // Failed flee — combat continues, just log the attempt (no state transition)
    const newWorldState = storeReceipt(combat.world_state, request_id, 'flee_combat', { success: false });
    await base44.asServiceRole.entities.CombatLog.update(combat_id, {
      log_entries: [...(combat.log_entries || []), logEntry],
      world_state: newWorldState,
    });
  }

  return Response.json({
    success: fleeSuccess, result: fleeSuccess ? 'fled' : 'ongoing',
    combat_ended: fleeSuccess, log_entry: logEntry,
  });
}

// ─── RESOLVE COMBAT (de-escalation) ──────────────────────────────────────────
// Ends the active combat with result='resolved' (peaceful de-escalation via
// skill check). The skill check is done by the caller; this handler performs
// the authoritative state transition. Idempotent.
export async function handleResolveCombat(ctx) {
  const { base44, session_id, combat_id, character_id, request_id, payload } = ctx;
  const { user, error: authError } = await requireUser(base44);
  if (authError) return authError;

  const { session, character, combat, error } = await validateCombatOwnership(base44,
    { session_id, combat_id, character_id, user });
  if (error) return error;
  if (!combat) return Response.json({ error: 'combat_id is required' }, { status: 400 });
  if (!combat.is_active) {
    return Response.json({ error: 'Combat is already ended', result: combat.result, already_ended: true },
      { status: 409 });
  }

  const prior = checkReceipt(combat.world_state, request_id);
  if (prior) return Response.json({ ...prior, idempotent_replay: true });

  const skillName = String(payload?.skill || 'skill');
  const logEntry = {
    round: combat.round, actor: character.name, action: 'resolve',
    text: `🕊️ ${character.name} de-escalates the situation with a successful ${skillName} check. Combat ends peacefully.`,
  };

  const newWorldState = storeReceipt(combat.world_state, request_id, 'resolve_combat',
    { success: true, result: 'resolved' });
  await base44.asServiceRole.entities.CombatLog.update(combat_id, {
    is_active: false, result: 'resolved',
    log_entries: [...(combat.log_entries || []), logEntry],
    world_state: newWorldState,
  });
  await base44.asServiceRole.entities.GameSession.update(session_id, { in_combat: false, combat_state: {} });

  return Response.json({
    success: true, result: 'resolved', combat_ended: true, log_entry: logEntry,
  });
}

// ─── COLLECT LOOT ───────────────────────────────────────────────────────────
// Awards loot (coins + items) from a completed victory combat to the
// character. Authoritative: reads the exact completed CombatLog by ID, awards
// XP/loot exactly once (guarded by loot_awarded + xp_awarded flags), and
// updates the Character atomically. Idempotent via request_id receipt.
//
// The loot payload is generated by the generateLoot function (already called
// by the frontend) and passed in. This handler only performs the authoritative
// award + persistence, guarded against double-award.
export async function handleCollectLoot(ctx) {
  const { base44, session_id, combat_id, character_id, request_id, payload } = ctx;
  const { user, error: authError } = await requireUser(base44);
  if (authError) return authError;

  const { session, character, combat, error } = await validateCombatOwnership(base44,
    { session_id, combat_id, character_id, user });
  if (error) return error;
  if (!combat) return Response.json({ error: 'combat_id is required' }, { status: 400 });

  // Must be a victory to collect loot
  if (combat.result !== 'victory') {
    return Response.json({ error: 'Loot can only be collected from a victorious combat', invalid: true },
      { status: 400 });
  }

  // Idempotency: replay returns the prior outcome
  const prior = checkReceipt(combat.world_state, request_id);
  if (prior) return Response.json({ ...prior, idempotent_replay: true });

  // Guard: already awarded (prevents double-award even without request_id)
  if (combat.loot_awarded) {
    return Response.json({
      success: true, already_awarded: true,
      loot_collected: combat.loot_collected || null,
      character: { gold: character.gold, silver: character.silver, copper: character.copper },
    });
  }

  const lootResult = payload?.loot_result;
  if (!lootResult) {
    return Response.json({ error: 'loot_result is required in payload', invalid: true }, { status: 400 });
  }

  // Build the loot snapshot
  const allItems = [...(lootResult.items || [])];
  if (lootResult.artifact) allItems.push(lootResult.artifact);
  const lootSnapshot = {
    gold: lootResult.coins?.gold || 0,
    silver: lootResult.coins?.silver || 0,
    copper: lootResult.coins?.copper || 0,
    items: allItems,
  };

  // Atomically update the Character with coins + inventory
  const updatedGold = (character.gold || 0) + lootSnapshot.gold;
  const updatedSilver = (character.silver || 0) + lootSnapshot.silver;
  const updatedCopper = (character.copper || 0) + lootSnapshot.copper;
  const updatedInventory = [...(character.inventory || []), ...allItems];

  await base44.asServiceRole.entities.Character.update(character_id, {
    gold: updatedGold, silver: updatedSilver, copper: updatedCopper, inventory: updatedInventory,
  });

  // Mark the combat log with the loot snapshot + awarded guard
  const newWorldState = storeReceipt(combat.world_state, request_id, 'collect_loot',
    { success: true, loot_collected: lootSnapshot });
  await base44.asServiceRole.entities.CombatLog.update(combat_id, {
    loot_collected: lootSnapshot,
    loot_awarded: true,
    world_state: newWorldState,
    // Preserve enemies_faced and other final-state fields
    enemies_faced: combat.enemies_faced || (combat.combatants || [])
      .filter(c => c.type === 'enemy').map(e => ({ name: e.name, max_hp: e.hp_max, cr: e.cr })),
  });

  // Also ensure victory XP was awarded (guard: xp_awarded)
  if (!combat.xp_awarded) {
    await awardVictoryXP(base44, combat_id, combat.combatants || [], character_id);
  }

  return Response.json({
    success: true, already_awarded: false,
    loot_collected: lootSnapshot,
    character: {
      gold: updatedGold, silver: updatedSilver, copper: updatedCopper,
      inventory: updatedInventory,
    },
  });
}