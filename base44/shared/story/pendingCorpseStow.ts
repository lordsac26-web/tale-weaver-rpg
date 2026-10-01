import { classifyStowIntent } from './stowIntent.ts';
import { resolveContextualCorpseSet } from './contextualCorpseStow.ts';
import { buildStoryClarification } from './storyPersistence.ts';

export function pendingCorpseReceipt(session, character, requestedId) {
  const source = session.story_log?.at(-1)?.request_id;
  return [...(session.world_state?.__skill_check_receipts || [])].reverse().find(x => {
    const parsed = classifyStowIntent(x.action_text);
    return x.unified_story_skill_resolution === true && x.source_story_request_id === source && parsed && /\b(?:corpses|bodies)\b/i.test(parsed.item_phrase)
      && (requestedId ? x.request_id === requestedId : !character.long_rest_abilities?.__stow_receipts?.some(r => r.token === x.request_id))
      && !session.story_log.some(e => e.request_id === x.request_id);
  });
}

// Reconstruct from the saved roll + source scene, not transient narrative cards.
// Hydration is read-only: even a fully eligible source set needs explicit reply.
export async function restoreCorpseStow({ base44, session, character, receipt }) {
  if (!receipt) return { status: 200, body: { response_kind: 'no_pending_stow', writes: 0 } };
  const parsed = classifyStowIntent(receipt.action_text), prior = character.long_rest_abilities?.__stow_receipts?.find(x => x.token === receipt.request_id);
  const resolution = await resolveContextualCorpseSet({ base44, session, character, itemPhrase: parsed.item_phrase, container: parsed.container });
  const stow = { handled: true, contextual_stow: true, clarification_required: true, success: false,
    reason_code: resolution.reason_code || 'confirmation_required', message: resolution.message || `Your saved attempt identifies ${resolution.sources.map(x => x.name).join(' and ')}. Confirm the bodies below to complete that same attempt.`,
    candidates: resolution.candidates.map(x => ({ id: x.id, name: x.name, label: x.label })), already_stowed: resolution.already, writes: 0 };
  const frame = await buildStoryClarification({ db: base44.asServiceRole, sessionId: session.id, characterId: character.id, requestId: receipt.request_id, sourceRequestId: receipt.source_story_request_id, stow });
  if (frame.status !== 200 || !prior) return frame;
  return { status: 200, body: { ...frame.body, response_kind: 'stow_confirmation', committed: true, message: 'This saved attempt already secured these bodies; no body was moved again.',
    stow_transaction: { handled: true, success: true, already_processed: true, receipt: prior, stow: prior, writes: 0 }, character_inventory: character.inventory, character_stowed_items: character.stowed_items, writes: 0 } };
}