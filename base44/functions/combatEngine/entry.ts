import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { handleStartCombat } from '../../shared/combat/startCombat.ts';
import { handlePlayerAttack, handleOffhandAttack } from '../../shared/combat/playerAttack.ts';
import { handleEnemyTurn, handleLegendaryAction } from '../../shared/combat/enemyTurn.ts';
import {
  handleActionSurge, handleGrapple, handleDodge,
  handleFlurryOfBlows, handleNextTurn, handleDeathSave,
} from '../../shared/combat/turnActions.ts';
import {
  handleFleeCombat, handleResolveCombat, handleCollectLoot,
} from '../../shared/combat/transitions.ts';
import {
  requireUser, validateCombatOwnership, checkReceipt, storeReceipt,
} from '../../shared/combat/authGuard.ts';

/**
 * Combat Engine — thin HTTP router. All combat logic lives in focused modules
 * under base44/shared/combat/:
 *  - authGuard.ts    user auth, ownership chain validation, idempotency receipts
 *  - helpers.ts      dice, damage modifiers, conditions, attack rolls, action economy
 *  - persistence.ts  XP awarding + end-of-action CombatLog writes
 *  - startCombat.ts  initiative + encounter scaling + CombatLog creation
 *  - playerAttack.ts weapon/spell attack resolution + off-hand attacks
 *  - enemyTurn.ts    enemy AI turns, mitigation, legendary actions
 *  - turnActions.ts  Action Surge, Grapple, Dodge, Flurry, next_turn, death saves
 *  - transitions.ts  flee, resolve (de-escalation), collect_loot — authoritative
 *
 * Monk Patient Defense / Step of the Wind / Stunning Strike live in monkActions;
 * racial abilities in racialActions/combatActions; subclass activations in subclassActions.
 */
Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const { action, session_id, combat_id, character_id, payload, request_id } = await req.json();

  // ── Authentication (defect #4): all combat actions require a logged-in user ──
  const { user, error: authError } = await requireUser(base44);
  if (authError) return authError;

  const ctx = { base44, session_id, combat_id, character_id, payload, user, request_id };

  // Authoritative, read-only combat resume. CombatLog records are created by the
  // service role, so browser-scoped entity reads can be invisible under RLS even
  // when the session legitimately belongs to the player.
  const handleGetCombatState = async ({ base44, session_id, combat_id, payload, user }) => {
    if (!session_id) return Response.json({ error: 'session_id is required' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ state: 'missing_session', combat: null }, { status: 404 });
    const ownership = await validateCombatOwnership(base44, { session_id, character_id: session.character_id, combat_id: combat_id || payload?.combat_id || session.combat_state?.combat_id, user });
    if (ownership.error) return ownership.error;
    const requestedId = combat_id || payload?.combat_id || session.combat_state?.combat_id;
    const referencedId = session.combat_state?.combat_id || null;
    if (!requestedId) return Response.json({ state: 'none', combat: null, session_in_combat: !!session.in_combat });
    if (referencedId && requestedId !== referencedId) {
      return Response.json({ state: 'mismatch', combat: null, combat_id: requestedId, referenced_combat_id: referencedId }, { status: 409 });
    }
    try {
      const combat = await base44.asServiceRole.entities.CombatLog.get(requestedId);
      if (!combat) return Response.json({ state: 'missing', combat: null, combat_id: requestedId });
      return Response.json({ state: combat.is_active ? 'active' : 'completed', combat, combat_id: requestedId, session_in_combat: !!session.in_combat });
    } catch {
      return Response.json({ state: 'missing', combat: null, combat_id: requestedId });
    }
  };

  // Narrow service-role write for completed-combat history. Browser-scoped
  // CombatLog writes can be blocked because combat records are service-created.
  const handleUpdateCombatHistory = async ({ base44, session_id, combat_id, payload, user }) => {
    if (!session_id || !combat_id) return Response.json({ error: 'session_id and combat_id are required' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const ownership = await validateCombatOwnership(base44, { session_id, combat_id, character_id: session.character_id, user });
    if (ownership.error) return ownership.error;
    const combat = ownership.combat;
    if (!combat || combat.session_id !== session.id) {
      return Response.json({ error: 'Combat does not belong to this session' }, { status: 403 });
    }
    const requested = payload?.updates || {};
    const allowed = ['enemies_faced', 'session_title', 'character_name', 'location', 'total_rounds', 'encounter_date', 'loot_collected'];
    const updates = Object.fromEntries(allowed.filter(key => requested[key] !== undefined).map(key => [key, requested[key]]));
    if (!Object.keys(updates).length) return Response.json({ error: 'No permitted history fields supplied' }, { status: 400 });
    await base44.asServiceRole.entities.CombatLog.update(combat_id, updates);
    return Response.json({ success: true, combat_id, updated_fields: Object.keys(updates) });
  };

  // Resolve a free-text combat cast into the same canonical payload used by the
  // Spell button. This endpoint is read-only: the returned payload is then sent
  // through player_attack, which owns slot validation, deduction, action economy,
  // concentration, healing, damage, and combat persistence.
  const handleResolveTypedSpell = async ({ base44, session_id, combat_id, character_id, payload, user }) => {
    if (!session_id || !combat_id || !character_id) return Response.json({ error: 'session_id, combat_id, and character_id are required', invalid: true }, { status: 400 });
    const ownership = await validateCombatOwnership(base44, { session_id, combat_id, character_id, user });
    if (ownership.error) return ownership.error;
    const [session, combat, character] = await Promise.all([
      base44.asServiceRole.entities.GameSession.get(session_id),
      base44.asServiceRole.entities.CombatLog.get(combat_id),
      base44.asServiceRole.entities.Character.get(character_id),
    ]);
    if (!session || !combat || !character || session.character_id !== character_id || combat.session_id !== session_id || session.combat_state?.combat_id !== combat_id || !combat.is_active) {
      return Response.json({ error: 'Active combat, session, and character do not match', invalid: true }, { status: 403 });
    }
    const text = String(payload?.action_text || '');
    if (!/\b(cast|casting|invoke|invoking|use|using|channel|channeling)\b/i.test(text)) return Response.json({ spell_detected: false });
    const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizedText = normalize(text);
    const knownNames = [...new Set([...(character.spells_prepared || []), ...(character.spells_known || [])].filter(Boolean))]
      .sort((a, b) => normalize(b).length - normalize(a).length);
    const spellName = knownNames.find(name => normalizedText.includes(normalize(name)));
    if (!spellName) return Response.json({ spell_detected: false });
    const rows = await base44.asServiceRole.entities.Spell.filter({ name: spellName }, '-updated_date', 1);
    const canonical = rows?.[0];
    if (!canonical) return Response.json({ error: `Canonical spell data is missing for ${spellName}`, invalid: true }, { status: 404 });
    const baseLevel = Math.max(0, Number(canonical.level) || 0);
    const explicitLevel = Number(text.match(/\b(?:level|lvl|at)\s*(\d+)\b/i)?.[1]) || 0;
    const selectedLevel = baseLevel === 0 ? 0 : Math.max(baseLevel, explicitLevel || baseLevel);
    const spellKey = normalize(spellName).replace(/ /g, '_');
    const utilityNames = new Set(['ensnaring strike','pass without trace','silence','detect magic']);
    const isHealing = canonical.attack_type === 'healing';
    const isHuntersMark = normalize(spellName) === 'hunters mark';
    const isUtility = !isHuntersMark && (canonical.attack_type === 'utility' || utilityNames.has(normalize(spellName)) || (!!canonical.concentration && !canonical.damage_dice && !isHealing));
    const diceFromText = String(canonical.description || '').match(/(\d+d\d+)/i)?.[1] || null;
    const spell = {
      name: spellName,
      damage_dice: canonical.damage_dice || (isHealing || isUtility ? '0' : diceFromText || '2d6'),
      damage_type: canonical.damage_type || 'force',
      attack_type: isHealing ? 'healing' : (isUtility ? 'utility' : canonical.attack_type || 'ranged_spell_attack'),
      save_type: canonical.save_type || null,
      is_utility: isUtility,
      heal_dice: isHealing ? (diceFromText || '1d8') : null,
      requires_concentration: !!canonical.concentration,
      special_effects: [spellKey],
      slot_level: selectedLevel,
      base_level: baseLevel,
      components: canonical.components || 'V',
      school: canonical.school || null,
    };
    const combatants = combat.combatants || [];
    const player = combatants.find(c => c.type === 'player' && c.id === character_id) || combatants.find(c => c.type === 'player');
    const enemies = combatants.filter(c => c.type === 'enemy' && c.is_conscious && (c.hp_current ?? c.hp ?? 0) > 0);
    const requestedTarget = enemies.find(e => normalize(e.name) && normalizedText.includes(normalize(e.name)));
    const targetId = (isUtility || isHealing) ? (player?.id || enemies[0]?.id) : (requestedTarget?.id || enemies[0]?.id);
    if (!targetId) return Response.json({ error: 'No valid spell target is available', invalid: true }, { status: 400 });
    return Response.json({ success: true, spell_detected: true, spell, target_id: targetId });
  };

  // Actions that require full ownership-chain validation + idempotency before
  // dispatch. These mutate combat state and must not execute twice for a replay.
  const STATE_ACTIONS = new Set([
    'start_combat', 'player_attack', 'offhand_attack', 'enemy_turn',
    'legendary_action', 'action_surge', 'grapple', 'dodge',
    'flurry_of_blows', 'next_turn', 'death_save',
    'flee_combat', 'resolve_combat', 'collect_loot',
  ]);

  // Actions that are read-only (ownership validated inside, no idempotency)
  const READ_ACTIONS = new Set(['get_combat_state', 'update_combat_history', 'resolve_typed_spell']);

  const HANDLERS = {
    get_combat_state: handleGetCombatState,
    update_combat_history: handleUpdateCombatHistory,
    resolve_typed_spell: handleResolveTypedSpell,
    start_combat: handleStartCombat,
    player_attack: handlePlayerAttack,
    offhand_attack: handleOffhandAttack,
    enemy_turn: handleEnemyTurn,
    legendary_action: handleLegendaryAction,
    action_surge: handleActionSurge,
    grapple: handleGrapple,
    dodge: handleDodge,
    flurry_of_blows: handleFlurryOfBlows,
    next_turn: handleNextTurn,
    death_save: handleDeathSave,
    flee_combat: handleFleeCombat,
    resolve_combat: handleResolveCombat,
    collect_loot: handleCollectLoot,
  };

  const handler = HANDLERS[action];
  if (!handler) return Response.json({ error: 'Unknown action' }, { status: 400 });

  // ── Ownership + idempotency pre-check for state-changing actions ──
  // start_combat validates ownership inside handleStartCombat (it creates the
  // CombatLog, so the combat_id doesn't exist yet). All other state actions
  // validate the full chain here and check for idempotent replays.
  if (STATE_ACTIONS.has(action) && action !== 'start_combat') {
    const { session, character, combat, error: ownErr } = await validateCombatOwnership(base44,
      { session_id, combat_id, character_id, user });
    if (ownErr) return ownErr;
    // Idempotency: a replayed request returns the stored outcome without re-processing
    if (combat && request_id) {
      const prior = checkReceipt(combat.world_state, request_id);
      if (prior) return Response.json({ ...prior, idempotent_replay: true });
    }
  }

  const response = await handler(ctx);
  // One router-level receipt layer covers every combat state transition. Individual
  // handlers may also persist a richer receipt; this only fills a missing receipt
  // after a successful mutation so a network retry returns the cached outcome.
  if (STATE_ACTIONS.has(action) && request_id && response.ok) {
    const body = await response.clone().json();
    const resolvedCombatId = combat_id || body?.combat_id;
    if (resolvedCombatId) {
      const freshCombat = await base44.asServiceRole.entities.CombatLog.get(resolvedCombatId);
      if (freshCombat && !checkReceipt(freshCombat.world_state, request_id)) {
        await base44.asServiceRole.entities.CombatLog.update(resolvedCombatId, {
          world_state: storeReceipt(freshCombat.world_state, request_id, action, body),
        });
      }
    }
    return Response.json({ ...body, correlation_id: request_id }, { status: response.status });
  }
  return response;
  } catch (error) {
    return Response.json({ error: error.message || 'Combat engine error' }, { status: 500 });
  }
});