import { executeUtilitySpellCast } from '../spells/castUtilitySpell.ts';
import { rollD20 } from '../dice.ts';
import { resolveStorySkillCheck } from './storySkillCheck.ts';

const pwtPattern = /\bpass\s+without\s+(?:a\s+)?trace\b/i;
const dependentPattern = /\b(hide|hiding|sneak|sneaking|stealth)\b/i;

export function parsePwtCompoundIntent(actionText) {
  const text = String(actionText || '').trim();
  const hasCast = /\b(cast|casting|use|using|invoke|invoking|channel|channeling)\b/i.test(text);
  if (!hasCast || !pwtPattern.test(text) || !dependentPattern.test(text)) return null;
  return { steps: [{ type: 'cast', spell_name: 'Pass without Trace' }, { type: 'skill', skill: 'Stealth', action: 'Hide' }] };
}

export async function executePwtCompoundAction({ base44, user, payload }) {
  const plan = parsePwtCompoundIntent(payload?.action_text);
  if (!plan) return { status: 200, body: { handled: false, plan: [] } };
  const parentId = String(payload?.request_id || '').slice(0, 100);
  if (!parentId) return { status: 400, body: { error: 'request_id is required for compound actions', invalid: true } };
  const castId = `${parentId}:cast:0`;
  const skillId = `${parentId}:skill:1`;
  const cast = await executeUtilitySpellCast({ base44, user, payload: { session_id: payload.session_id, character_id: payload.character_id, spell_name: 'Pass without Trace', action_text: payload.action_text, request_id: castId } });
  if (cast.status >= 400 || !cast.body?.success || !cast.body?.spell_detected) return { status: cast.status, body: { ...cast.body, handled: true, plan: plan.steps, child_ids: { cast: castId, skill: skillId }, narration: null } };
  const [character, session] = await Promise.all([base44.asServiceRole.entities.Character.get(payload.character_id), base44.asServiceRole.entities.GameSession.get(payload.session_id)]);
  if (!character || !session || session.character_id !== character.id) return { status: 403, body: { error: 'Compound action linkage is invalid.', handled: true, plan: plan.steps, child_ids: { cast: castId, skill: skillId } } };
  const receipts = Array.isArray(session.world_state?.__compound_action_receipts) ? session.world_state.__compound_action_receipts : [];
  const prior = receipts.find((receipt) => receipt?.id === skillId);
  if (prior) return { status: 200, body: { handled: true, plan: plan.steps, child_ids: { cast: castId, skill: skillId }, cast: cast.body, skill: prior, already_processed: true, narration: prior.narration } };
  const raw = rollD20();
  const dc = Math.max(5, Number(payload?.skill_dc) || 15);
  const resolution = resolveStorySkillCheck({ character, session, skill: 'Stealth', dc, requestId: skillId, raw, allRolls: [raw] });
  if (!resolution.ok) return { status: 409, body: { error: resolution.error, handled: true, plan: plan.steps, child_ids: { cast: castId, skill: skillId }, invalid: true } };
  const skill = { ...resolution.receipt, action: 'Hide', raw: resolution.raw, total: resolution.final, breakdown: resolution.breakdown, narration: resolution.success ? `Pass without Trace is active. Your Hide check succeeds (${resolution.raw} + ${resolution.modifier} = ${resolution.final} vs DC ${dc}).` : `Pass without Trace remains active, but your Hide check fails (${resolution.raw} + ${resolution.modifier} = ${resolution.final} vs DC ${dc}).` };
  await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: { ...(session.world_state || {}), __compound_action_receipts: [...receipts.filter((receipt) => receipt?.id !== skillId).slice(-23), skill] } });
  return { status: 200, body: { handled: true, plan: plan.steps, child_ids: { cast: castId, skill: skillId }, cast: cast.body, skill, narration: skill.narration } };
}