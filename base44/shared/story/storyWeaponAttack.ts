import { handleStartCombat } from '../combat/startCombat.ts';
import { executePlayerAttackCore } from '../combat/playerAttackCore.ts';
import { handlePlayerAttack } from '../combat/playerAttack.ts';
import { getAttackConcealment } from '../combat/conditions.ts';
import { planAmmunitionUse } from '../ammunitionTransaction.ts';

export const STORY_WEAPON_ATTACK_VERSION = 'story-weapon-attack-v1.0.0';
const RECEIPTS = '__story_weapon_attack_receipts';
const responseBody = async (response) => ({ status: response.status, body: await response.json() });

export async function executeStoryWeaponAttack({ base44, user, sessionId, requestId, contract, enemies, rollD20Fn = null }) {
  const session = await base44.asServiceRole.entities.GameSession.get(sessionId).catch(() => null);
  const character = session?.character_id ? await base44.asServiceRole.entities.Character.get(session.character_id).catch(() => null) : null;
  if (!session || !character || character.created_by_id !== user.id || session.character_id !== character.id) return { status: 403, body: { error: 'Story attack ownership chain is invalid.', writes: 0 } };
  const prior = (session.world_state?.[RECEIPTS] || []).find((entry) => entry.request_id === requestId);
  if (prior) return { status: 200, body: { ...prior.response, already_processed: true, writes: 0 } };
  if (session.in_combat) return { status: 409, body: { error: 'The scene entered combat before this choice could resolve. Refresh and use the combat controls.', writes: 0 } };
  if (!requestId || contract?.action_type !== 'weapon_attack') return { status: 400, body: { error: 'A typed weapon attack and stable request ID are required.', writes: 0 } };
  const roster = (enemies || []).filter((enemy) => Number(enemy?.hp) > 0 && Number(enemy?.ac) > 0);
  const targetHint = String(contract.weapon_attack?.target_ref || '').toLowerCase();
  const targetSpec = roster.find((enemy) => targetHint && String(enemy.name || '').toLowerCase().includes(targetHint)) || roster[0];
  if (!targetSpec) return { status: 409, body: { error: 'No living target with complete HP and AC is available. The shot was not rolled and no arrow was used.', writes: 0 } };
  const weapon = character.equipped?.weapon || character.equipped?.mainhand;
  if (!weapon || String(weapon.type || '').toLowerCase() !== 'ranged') return { status: 409, body: { error: 'Equip a ranged weapon before retrying this choice.', writes: 0 } };
  const ammo = planAmmunitionUse(character.inventory || [], weapon, 1);
  if (!ammo.ok) return { status: ammo.status || 409, body: { error: ammo.error, writes: 0 } };

  const concealment = getAttackConcealment(character.conditions || []);
  const ambushSetup = { type: 'narrative_ranged_attack', request_id: requestId, target_name: targetSpec.name, concealed: concealment.length > 0, setup_success: true, advantage_attribution: concealment.length ? 'Attacking from Stealthed/concealed' : null, attack_resolved: false };
  const started = await responseBody(await handleStartCombat({ base44, session_id: sessionId, payload: { enemies: roster, ambush_setup: ambushSetup, story_request_id: requestId } }));
  if (started.status >= 400 || !started.body?.combat_id) return started;
  const target = (started.body.combatants || []).find((entry) => entry.type === 'enemy' && entry.name === targetSpec.name) || (started.body.combatants || []).find((entry) => entry.type === 'enemy');
  if (!target) return { status: 409, body: { error: 'The authoritative combat target could not be bound.', writes: 0 } };
  const attackRequestId = `${requestId}:weapon:0`;
  const attack = await executePlayerAttackCore({ base44, sessionId, combatId: started.body.combat_id, characterId: character.id, requestId: attackRequestId, ownerId: user.id, handler: handlePlayerAttack, rollD20Fn, payload: { target_id: target.id, weapon, modifiers: { action_text: contract.text, nonlethal_intent: contract.weapon_attack?.intent === 'incapacitate_requested' } } });
  if (attack.status >= 400) return attack;
  const freshSession = await base44.asServiceRole.entities.GameSession.get(sessionId);
  const activeCombat = !!(freshSession?.in_combat && freshSession?.combat_state?.combat_id);
  const nonlethalNote = contract.weapon_attack?.intent === 'incapacitate_requested' ? ' A ranged weapon cannot guarantee a nonlethal knockout; the attack resolved normally.' : '';
  const response = { success: true, version: STORY_WEAPON_ATTACK_VERSION, request_id: requestId, attack_request_id: attackRequestId, action_type: 'weapon_attack', combat_id: started.body.combat_id, combat_active: activeCombat, hit: attack.body.hit === true, damage: Number(attack.body.damage) || 0, target: target.name, target_hp: attack.body.target_hp, advantage: attack.body.log_entry?.advantage === true, advantage_sources: attack.body.log_entry?.advantage_sources || [], ammunition: attack.body.log_entry?.ammunition || null, nonlethal_intent: contract.weapon_attack?.intent === 'incapacitate_requested', nonlethal_guaranteed: false, narrative: `${attack.body.log_entry?.text || 'The shot resolves.'}${nonlethalNote}`, writes: 1 };
  const latest = await base44.asServiceRole.entities.GameSession.get(sessionId);
  const receipts = latest.world_state?.[RECEIPTS] || [];
  await base44.asServiceRole.entities.GameSession.update(sessionId, { world_state: { ...(latest.world_state || {}), [RECEIPTS]: [...receipts.filter((entry) => entry.request_id !== requestId).slice(-49), { request_id: requestId, attack_request_id: attackRequestId, completed_at: new Date().toISOString(), response }] } });
  return { status: 200, body: response };
}