import { classifyStowIntent, executeStowAction } from './stowIntent.ts';
import { buildStoryClarification } from './storyPersistence.ts';
import { pendingCorpseReceipt, restoreCorpseStow } from './pendingCorpseStow.ts';
import { confirmCorpseStowReceipt } from './confirmCorpseStowReceipt.ts';
import { validatePlayerText } from './playerText.ts';

export async function confirmContextualStow({ base44, ownerId, payload }) {
  const checkedAnswer = validatePlayerText(payload.answer_text || '', true);
  if (!checkedAnswer.ok) return { status: 400, body: checkedAnswer };
  const db = base44.asServiceRole;
  const [session, character] = await Promise.all([db.entities.GameSession.get(payload.session_id), db.entities.Character.get(payload.character_id)]);
  if (!ownerId || character.created_by_id !== ownerId || session.character_id !== character.id) return { status: 403, body: { error: 'This character and campaign do not belong to you.', writes: 0 } };
  const id = String(payload.original_request_id || '').slice(0, 120);
  if (payload.read_only === true) {
    const pending = pendingCorpseReceipt(session, character, id || null);
    if (id && !pending) return { status: 409, body: { error: 'The saved stow intent no longer matches this scene. Your reply remains saved; keep the attempt paused.', writes: 0 } };
    const restored = await restoreCorpseStow({ base44, session, character, receipt: pending });
    // Tell the client its saved reply pointed at a superseded duplicate roll so it
    // can adopt the canonical attempt instead of failing the linkage check.
    return id && pending && pending.request_id !== id && restored.status === 200 ? { ...restored, body: { ...restored.body, rebound_from: id } } : restored;
  }
  const bound = pendingCorpseReceipt(session, character, id);
  if (bound && bound.request_id !== id) return { status: 409, body: { error: 'That reply was attached to a later duplicate roll. It is being re-linked to your saved attempt — confirm again. Nothing has been moved.', error_code: 'stow_attempt_rebound', canonical_request_id: bound.request_id, writes: 0 } };
  const matches = (session.world_state?.__skill_check_receipts || []).filter(x => x.request_id === id && x.unified_story_skill_resolution === true);
  const receipt = matches[0], parsed = classifyStowIntent(receipt?.action_text);
  if (matches.length !== 1 || !parsed || !/\b(?:corpses|bodies)\b/i.test(parsed.item_phrase)) return { status: 409, body: { error: 'I cannot link that answer to a saved corpse-stow attempt. Nothing has been moved.', writes: 0 } };
  const preserved = await buildStoryClarification({ db, sessionId: session.id, characterId: character.id, requestId: id, sourceRequestId: receipt.source_story_request_id, stow: { message: 'Which bodies did you mean?' } });
  if (preserved.status !== 200) return preserved;
  const result = await executeStowAction({ base44, ownerId, payload: { session_id: session.id, character_id: character.id, request_id: id, action_text: receipt.action_text, check: receipt,
    source_story_request_id: receipt.source_story_request_id, contextual_stow: true, selected_source_ids: payload.selected_source_ids, answer_text: checkedAnswer.text } });
  if (result.status >= 400) return result;
  if (result.body.clarification_required) return buildStoryClarification({ db, sessionId: session.id, characterId: character.id, requestId: id, sourceRequestId: receipt.source_story_request_id, stow: result.body });
  if (!result.body.success) return { status: 200, body: { ...preserved.body, response_kind: 'stow_confirmation', committed: false, message: 'The original check did not succeed. No bodies have been moved.', stow_transaction: result.body, writes: 0 } };
  const confirmed = await buildStoryClarification({ db, sessionId: session.id, characterId: character.id, requestId: id, sourceRequestId: receipt.source_story_request_id, stow: result.body });
  if (confirmed.status !== 200) return { status: confirmed.status, body: { ...confirmed.body, partial_write_possible: result.body.writes > 0, writes: result.body.writes } };
  const bag = await confirmCorpseStowReceipt(db, character.id, id, parsed.container);
  if (!bag.ok) return { status: 409, body: { error: 'The bag contents could not yet be confirmed after the stow. Keep this original attempt paused; your reply and roll must not be replaced.', error_code: 'stow_receipt_confirmation_pending', preserve_scene: true, partial_write_possible: true, writes: result.body.writes } };
  return { status: 200, body: { ...confirmed.body, response_kind: 'stow_confirmation', committed: true, authoritative_bag_reread: true, message: result.body.already_processed ? 'These bodies were already secured by this attempt; nothing was moved again.' : `Stowed ${result.body.stow.item_name} in ${parsed.container}.`,
    stow_transaction: { ...result.body, receipt: bag.receipt }, character_inventory: bag.character.inventory, character_stowed_items: bag.character.stowed_items, writes: result.body.writes } };
}