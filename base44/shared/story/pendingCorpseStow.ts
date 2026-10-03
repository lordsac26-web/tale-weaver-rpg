import { classifyStowIntent } from './stowIntent.ts';
import { resolveContextualCorpseSet } from './contextualCorpseStow.ts';
import { buildStoryClarification } from './storyPersistence.ts';
import { confirmCorpseStowReceipt } from './confirmCorpseStowReceipt.ts';

// Canonical pending binding: the EARLIEST successful corpse-stow check from
// the current scene is authoritative; later duplicate rolls for the same
// intent are superseded. Explicit request ids migrate onto the canonical
// attempt while the group is unresolved, and once any attempt committed, an
// explicit id returns that committed receipt (already-secured confirmation)
// while the automatic binding reports nothing pending.
export function pendingCorpseReceipt(session, character, requestedId) {
  const source = session.story_log?.at(-1)?.request_id;
  const attempts = (session.world_state?.__skill_check_receipts || []).filter(x => {
    const parsed = classifyStowIntent(x.action_text);
    return x.unified_story_skill_resolution === true && x.success === true && x.source_story_request_id === source && parsed && /\b(?:corpses|bodies)\b/i.test(parsed.item_phrase)
      && !session.story_log.some(e => e.request_id === x.request_id);
  });
  if (!attempts.length) return undefined;
  const canonical = attempts[0];
  const committed = new Set((character.long_rest_abilities?.__stow_receipts || []).filter(r => attempts.some(x => x.request_id === r.token)).map(r => r.token));
  if (requestedId) {
    const requested = attempts.find(x => x.request_id === requestedId);
    if (!requested) return undefined;
    if (committed.size) return committed.has(requested.request_id) ? requested : undefined;
    return canonical;
  }
  return committed.size ? undefined : canonical;
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
  const bag = await confirmCorpseStowReceipt(base44.asServiceRole, character.id, receipt.request_id, parsed.container);
  if (!bag.ok) return { status: 409, body: { error: 'This attempt has a receipt but its bag contents are not confirmed. Keep the original attempt paused.', writes: 0 } };
  return { status: 200, body: { ...frame.body, response_kind: 'stow_confirmation', committed: true, message: 'This saved attempt already secured these bodies; no body was moved again.',
    stow_transaction: { handled: true, success: true, already_processed: true, receipt: prior, stow: prior, writes: 0 }, authoritative_bag_reread: true, character_inventory: bag.character.inventory, character_stowed_items: bag.character.stowed_items, writes: 0 } };
}