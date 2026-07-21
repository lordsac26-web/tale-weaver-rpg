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
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, session_id, combat_id, character_id, payload } = await req.json();
  const ctx = { base44, session_id, combat_id, character_id, payload };

  const HANDLERS = {
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
});