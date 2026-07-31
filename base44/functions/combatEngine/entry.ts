import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { handleStartCombat } from '../../shared/combat/startCombat.ts';
import { handlePlayerAttack, handleOffhandAttack } from '../../shared/combat/playerAttack.ts';
import { handleEnemyTurn, handleLegendaryAction } from '../../shared/combat/enemyTurn.ts';
import {
  handleActionSurge, handleGrapple, handleDodge,
  handleFlurryOfBlows, handleNextTurn, handleDeathSave,
} from '../../shared/combat/turnActions.ts';

/**
 * Combat Engine — thin HTTP router. All combat logic lives in focused modules
 * under base44/shared/combat/:
 *  - helpers.ts      dice, damage modifiers, conditions, attack rolls, action economy
 *  - persistence.ts  XP awarding + end-of-action CombatLog writes
 *  - startCombat.ts  initiative + encounter scaling + CombatLog creation
 *  - playerAttack.ts weapon/spell attack resolution + off-hand attacks
 *  - enemyTurn.ts    enemy AI turns, mitigation, legendary actions
 *  - turnActions.ts  Action Surge, Grapple, Dodge, Flurry, next_turn, death saves
 *
 * Monk Patient Defense / Step of the Wind / Stunning Strike live in monkActions;
 * racial abilities in racialActions/combatActions; subclass activations in subclassActions.
 */
Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const { action, session_id, combat_id, character_id, payload } = await req.json();
  const ctx = { base44, session_id, combat_id, character_id, payload };

  // Authoritative, read-only combat resume. CombatLog records are created by the
  // service role, so browser-scoped entity reads can be invisible under RLS even
  // when the session legitimately belongs to the player.
  const handleGetCombatState = async ({ base44, session_id, combat_id, payload }) => {
    if (!session_id) return Response.json({ error: 'session_id is required' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ state: 'missing_session', combat: null }, { status: 404 });
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

  const HANDLERS = {
    get_combat_state: handleGetCombatState,
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
  };

  const handler = HANDLERS[action];
  if (!handler) return Response.json({ error: 'Unknown action' }, { status: 400 });
  return await handler(ctx);
  } catch (error) {
    return Response.json({ error: error.message || 'Combat engine error' }, { status: 500 });
  }
});