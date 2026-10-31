import { classifyLegacyChoiceAction } from './choiceActionContract.js';
import { resolveStoryAttackTarget } from './storyAttackTarget.ts';

export const SCENE_COMBAT_TARGET_VERSION = 'scene-combat-target-v1.0.0';

// Only current, living registry identities can supply authoritative combat stats.
// Objects marked "alive", historical corpses and transferred entities are not foes.
export function sceneCombatRoster(session) {
  return (session?.world_state?.scene_entities || []).filter(entity =>
    entity?.type === 'creature' && entity.status === 'alive' && entity.alive !== false
    && entity.location === session.current_location && (!entity.transfer_state || entity.transfer_state === 'world')
    && Number(entity.combat_stats?.current_hp ?? entity.combat_stats?.hp) > 0
    && Number(entity.combat_stats?.ac) > 0
  ).map(entity => ({ ...entity.combat_stats, name: entity.name, scene_entity_id: entity.id,
    source_request_id: entity.source_request_id, aliases: entity.aliases || [],
    authoritative_scene_stats: true, ...(Number.isFinite(entity.distance_feet) ? { distance_feet: entity.distance_feet } : {}) }));
}

// Evaluation is read-only. No target is a clarification, NEVER a Perception check.
export function preflightStoryAttack({ actionText, session }) {
  const contract = classifyLegacyChoiceAction(actionText);
  if (!contract) return { handled: false };
  const roster = sceneCombatRoster(session);
  const target = resolveStoryAttackTarget({ targetRef: contract.weapon_attack.target_ref, enemies: roster, requireAuthoritativeRoster: true });
  if (!target.ok) return { handled: true, status: 409, body: {
    error: roster.length ? 'Which living enemy do you mean? Name one of the enemies in this scene.' : 'No living combat-ready target is registered in this scene. No skill check or attack was rolled; the scene is unchanged.',
    error_code: target.reason, candidates: roster.map(enemy => enemy.name), requires_check: false, skill: null, dc: null,
    action_type: 'weapon_attack', preserve_scene: true, writes: 0, scene_combat_target_version: SCENE_COMBAT_TARGET_VERSION,
  } };
  return { handled: true, status: 200, body: { ...contract, action: actionText, outcome_type: 'attack',
    weapon_attack: { ...contract.weapon_attack, target_ref: target.target.scene_entity_id, target_name: target.target.name },
    target_name: target.target.name, target_entity_id: target.target.scene_entity_id, requires_check: false, skill: null, dc: null,
    risk_level: 'high', reasoning: `Attack ${target.target.name} with your ${contract.weapon_attack.weapon_hint}; initiative, the attack roll, ammunition and damage resolve through structured combat, not a skill check.`,
    writes: 0, scene_combat_target_version: SCENE_COMBAT_TARGET_VERSION } };
}