import { resolveSemanticSceneReference, SEMANTIC_SCENE_REFERENCE_VERSION } from './semanticSceneReference.ts';
import { hashStoryValue } from './storyTransition.ts';

export const isCorpseLootAction = text => /\b(?:loot|search|rifle|rummage)\b/i.test(text || '') && !/\b(?:cast|attack|shoot|stow|drop)\b/i.test(text || '') && (/\bloot\b/i.test(text) || /\b(?:bod(?:y|ies)|corpses?|cultists?|acolytes?|guards?|him|her|dead|fallen|killed)\b/i.test(text));

export async function groundCorpseLoot({ base44, session, context, actionText, answerText = '', requestId = '', boundIds = [] }) {
  const key = (await hashStoryValue([context.revision, String(actionText).toLowerCase().trim()])).slice(0, 32);
  const pending = (session.world_state?.__loot_clarifications || []).find(row => row.key === key || (requestId && row.request_id === requestId));
  if (pending && (pending.action !== actionText || pending.revision !== context.revision)) return { handled: true, status: 409, action_blocked: true, clarification_required: false, error: 'The pending search belongs to an earlier scene or action. No loot was taken.', writes: 0 };
  const candidates = context.entities.filter(entity => entity.status === 'dead' && entity.type === 'corpse' && entity.death_provenance);
  const selected = await resolveSemanticSceneReference({ base44, catalog: candidates, actionText, answerText, boundIds,
    optionIds: pending?.option_ids || [] });
  const attempts = Number(pending?.attempts || 0) + (answerText ? 1 : 0);
  if (!selected.target && (selected.terminal || attempts >= 1)) {
    const reason = selected.terminal ? selected.reason : 'This search still has no supported target after clarification, so it is stopped. No roll or loot was granted.';
    return { handled: true, status: 200, action_blocked: true, clarification_required: false, clarification_attempts: attempts, reasoning: reason, error: reason, writes: 0 };
  }
  if (!selected.target) {
    if (requestId && !pending) {
      const fresh = await base44.asServiceRole.entities.GameSession.get(session.id);
      if (fresh.updated_date !== session.updated_date) return { handled: true, status: 409, action_blocked: true, error: 'The scene changed; review it before searching.', writes: 0 };
      const row = { key, request_id: requestId, action: actionText, revision: context.revision, attempts: 1, option_ids: (selected.options || []).map(option => option.id) };
      await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: { ...fresh.world_state, __loot_clarifications: [...(fresh.world_state?.__loot_clarifications || []).slice(-15), row] } });
    }
    return { handled: true, status: 200, clarification_required: true, clarification_attempts: 1, reasoning: selected.reason,
      clarification_options: selected.options || [], grounded_action: { intent: 'loot', scene_revision: context.revision, target_ids: [] }, writes: 0 };
  }
  const target = selected.target;
  return { handled: true, status: 200, clarification_required: false, requires_check: false, action_type: 'utility', skill: null, dc: null, risk_level: 'low',
    reasoning: `${selected.assumption ? `${selected.assumption} ` : ''}Search ${target.name}. Only recorded recoverable contents can be taken; an empty result will also be saved.`,
    grounded_action: { version: SEMANTIC_SCENE_REFERENCE_VERSION, session_id: session.id, scene_revision: context.revision, intent: 'loot',
      target_ids: [target.id], targets: [target], quantity: 1, assumption: selected.assumption || '', evidence: [target.death_provenance] },
    clarification_attempts: attempts, ground_answer_text: answerText, context, writes: 0 };
}