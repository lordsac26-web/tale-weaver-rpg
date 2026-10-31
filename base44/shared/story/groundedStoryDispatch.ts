import { resolveGroundedAction } from './groundedAction.ts';
import { isCorpseLootAction } from './corpseLootGrounding.ts';
import { commitCorpseLoot } from './corpseLootTransaction.ts';

// Shared pre-mechanics dispatch: identity cannot be reinterpreted by a later model.
export default async function groundedStoryDispatch({ base44, session, character, actionText, choiceContext, requestId, storySequence }) {
  const loot = isCorpseLootAction(actionText);
  if (!loot && !choiceContext?.grounded_action) return { plan: null };
  const grounding = await resolveGroundedAction({ base44, session, character, actionText,
    answerText: choiceContext?.ground_answer_text || '', expectedRevision: choiceContext?.grounded_action?.scene_revision,
    requestId, boundIds: choiceContext?.grounded_action?.target_ids || [] });
  if (grounding.status >= 400 || grounding.clarification_required || grounding.action_blocked) return { response: { status: grounding.status >= 400 ? grounding.status : 409,
    body: { ...grounding, context: undefined, error: grounding.error || grounding.reasoning, preserve_scene: true } } };
  if (loot) return { response: await commitCorpseLoot({ base44, session, character, requestId, actionText, grounding, storySequence }) };
  return { plan: grounding.grounded_action };
}