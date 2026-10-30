import { dispositionHash, dispositionWorldItem, projectDispositionDelta } from './itemDispositionPlan.ts';

const refuse = (error, partial = false) => ({ ok: false, status: 409, body: { error, error_code: 'item_disposition_unconfirmed', preserve_scene: true, persistence_confirmed: false, partial_write_possible: partial } });

// The inventory delta AND permanent receipt/archive share one conditional
// Character write. Session/world projection is recoverable from that receipt.
// Story entries stay pending (hidden by hydration) until both are confirmed.
export async function commitItemDispositions({ db, sessionId, characterId, plan, requirePending = true }) {
  if (!plan.ok) return refuse(plan.error);
  if (!plan.records.length) return { ok: true, applied: false, writes: 0 };
  let [session, character] = await Promise.all([db.entities.GameSession.get(sessionId), db.entities.Character.get(characterId)]);
  if (session.character_id !== characterId || plan.records.some(x => x.session_id !== sessionId || x.character_id !== characterId)) return refuse('Disposal scope mismatch.');
  if (requirePending && !session.story_log?.some(e => e.request_id === plan.records[0].request_id && e.mechanics_status === 'pending')) return refuse('Disposal must belong to the pending story action.');
  const prior = character.item_dispositions || [];
  const missing = plan.records.filter(r => !prior.some(p => p.receipt_id === r.receipt_id));
  for (const r of plan.records) {
    const p = prior.find(x => x.receipt_id === r.receipt_id);
    if (p && await dispositionHash({ ...p, recorded_at: null }) !== await dispositionHash({ ...r, recorded_at: null })) return refuse('The retry changed its disposal evidence.');
  }
  let writes = 0;
  if (missing.length) {
    const delta = projectDispositionDelta(character, missing);
    if (!delta.ok) return refuse(delta.error);
    await db.entities.Character.updateMany({ id: characterId, updated_date: character.updated_date }, { $set: delta.patch });
    writes++;
    character = await db.entities.Character.get(characterId);
    if (!plan.records.every(r => character.item_dispositions?.some(p => p.receipt_id === r.receipt_id && p.item_id === r.item_id))) return refuse('Inventory changed during disposal; success was refused.', true);
  }
  // Always use a fresh world state, never the pre-generation snapshot.
  session = await db.entities.GameSession.get(sessionId);
  const world = [...(session.world_state?.world_items || [])];
  const absent = plan.records.filter(r => !world.some(w => w.disposition_receipt_id === r.receipt_id));
  if (absent.length) {
    const receipts = session.world_state?.__item_disposition_receipts || [];
    const nextWorld = { ...(session.world_state || {}), world_items: [...world, ...absent.map(dispositionWorldItem)], __item_disposition_receipts: [...receipts, ...absent.filter(r => !receipts.some(x => x.receipt_id === r.receipt_id))] };
    await db.entities.GameSession.updateMany({ id: sessionId, updated_date: session.updated_date }, { $set: { world_state: nextWorld } });
    writes++;
    session = await db.entities.GameSession.get(sessionId);
  }
  if (!plan.records.every(r => session.world_state?.world_items?.some(w => w.disposition_receipt_id === r.receipt_id && w.quantity === r.quantity && w.retrievable === r.retrievable))) return refuse('Disposal is recorded but its world placement is unconfirmed. Success remains paused.', true);
  return { ok: true, applied: true, already_processed: writes === 0, writes, records: plan.records, character, session, capacity: projectDispositionDelta(character, []).capacity };
}

export async function confirmItemDispositionReceipts({ db, session, entry }) {
  const records = entry.item_disposition_plan?.records || [];
  if (!records.length) return true;
  const character = await db.entities.Character.get(session.character_id);
  return records.every(r => character.item_dispositions?.some(p => p.receipt_id === r.receipt_id && p.item_id === r.item_id) && session.world_state?.world_items?.some(w => w.disposition_receipt_id === r.receipt_id));
}