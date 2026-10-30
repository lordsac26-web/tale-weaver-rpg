import { validateContainerFit } from './containerCapacity.ts';

export const ITEM_DISPOSITION_VERSION = 'item-disposition-v2.0.0';
export const normDispositionName = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const dispositionIdentity = item => String(item?.instance_id || item?.item_id || item?.equipment_id || item?.scene_entity_id || `${item?.stow_request_id || item?.provenance?.story_request_id || 'legacy'}:${normDispositionName(item?.name)}`);
export const dispositionHash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value ?? null))))).map(x => x.toString(16).padStart(2, '0')).join('');
export const ownedDispositionItems = character => ['inventory', 'stowed_items'].flatMap(source => (character?.[source] || []).map((item, index) => ({ item, source, index, ref: `${source}:${index}` })).filter(x => Number(x.item.quantity ?? 1) > 0));
const aliases = item => [...new Set([item.name, ...(item.aliases || []), /\b(staff|head|dagger|sword|vial|potion|orb|amulet|ledger|medallion)\b/i.exec(item.name || '')?.[1]].filter(Boolean).map(normDispositionName))];
export const dispositionNameMatches = (item, text) => aliases(item).some(a => a && (` ${normDispositionName(text)} `).includes(` ${a} `));
const removal = /\b(?:drop(?:s|ped|ping)?|discard(?:s|ed|ing)?|abandon(?:s|ed|ing)?|left behind|leav(?:e|es|ing)\b[^.!?]*\bbehind|give|gives|gave|giving|hand(?:s|ed|ing)?|entrust(?:s|ed|ing)?|surrender(?:s|ed)?|sell|sold|sacrifice(?:s|d)?|destroy(?:s|ed|ing)?|shatter(?:s|ed|ing)?|smash(?:es|ed|ing)?|burn(?:s|ed|ing)?|consume(?:s|d|ing)?|swallow(?:s|ed|ing)?|drink|drinks|drank|drunk|eat|eats|ate|devour(?:s|ed)?|disintegrat(?:e|es|ed)|expend(?:s|ed)?|used up)\b/i;
const hypothetical = /\b(?:if|could|would|might|may|should|will|intend|plan|try|attempt|almost|not|never|cannot|can't|doesn't|didn't|without)\b/i;
const outcome = text => /\b(?:consume|consumes|consumed|swallow|swallows|swallowed|drink|drinks|drank|drunk|eat|eats|ate|devour|expended|used up)\b/i.test(text) ? 'consumed' : /\b(?:destroy|destroys|destroyed|shatter|shatters|shattered|smash|smashed|burn|burned|disintegrate|disintegrated|sacrifice|sacrificed)\b/i.test(text) ? 'destroyed' : /\b(?:give|gives|gave|hand|hands|handed|entrust|entrusts|entrusted|surrender|sell|sold)\b/i.test(text) ? 'given' : 'dropped';
const destination = text => text.match(/\b(?:onto|on|at|into|to|before|within)\s+([^.!?;]+?)(?:,|$)/i)?.[1]?.trim() || 'the scene';

// This catches direct, passive and same-sentence anaphoric disposal. Structured
// claims are additionally supplied by the final semantic audit in production.
export function inferDispositionClaims(character, narrative) {
  const found = [];
  for (const quote of String(narrative || '').match(/[^.!?]+[.!?]?/g) || []) {
    if (!removal.test(quote) || hypothetical.test(quote)) continue;
    const candidates = ownedDispositionItems(character).filter(x => dispositionNameMatches(x.item, quote));
    if (!candidates.length) continue;
    for (const c of candidates) {
      const matchingOthers = candidates.filter(x => x.ref !== c.ref && aliases(x.item).some(a => aliases(c.item).includes(a)));
      const exact = (` ${normDispositionName(quote)} `).includes(` ${normDispositionName(c.item.name)} `);
      if (matchingOthers.length && !exact) { found.push({ ambiguous: true, quote: quote.trim() }); continue; }
      found.push({ item_ref: c.ref, quantity: Number(c.item.quantity ?? 1) === 1 ? 1 : null, disposition: outcome(quote), destination: destination(quote), quote: quote.trim() });
    }
  }
  return found;
}

export function blockedDispositionAcquisition(character, item) {
  return (character?.item_dispositions || []).find(record => record.retrievable === false && (dispositionIdentity(item) === record.item_id || dispositionNameMatches(record.item_snapshot, item?.name)));
}

export async function planItemDispositions({ character, session, requestId, narrative, claims = [], location, historical = false }) {
  const all = [...claims, ...inferDispositionClaims(character, narrative)];
  if (!all.length) return { ok: true, records: [], version: ITEM_DISPOSITION_VERSION };
  if (!requestId || session.character_id !== character.id) return { ok: false, error: 'Disposal requires an exact character, session and request.' };
  const records = [], owned = ownedDispositionItems(character);
  for (const claim of all) {
    if (claim.ambiguous) return { ok: false, error: 'The narrated disposal does not identify one owned item. Nothing was disposed of.' };
    const selected = owned.find(x => x.ref === claim.item_ref);
    if (!selected || !claim.quote || !String(narrative).includes(claim.quote) || !dispositionNameMatches(selected.item, claim.quote)) return { ok: false, error: 'Disposal evidence does not identify the owned item in an exact narration quote.' };
    if (!['dropped', 'destroyed', 'consumed', 'given'].includes(claim.disposition) || !Number.isInteger(claim.quantity) || claim.quantity < 1 || claim.quantity > Number(selected.item.quantity ?? 1)) return { ok: false, error: 'The disposal type or exact quantity is unconfirmed. No success was committed.' };
    const id = `${requestId}:${dispositionIdentity(selected.item)}`;
    const previous = records.find(x => x.receipt_id === id);
    if (previous) {
      if (previous.disposition !== claim.disposition || previous.quantity !== claim.quantity) return { ok: false, error: 'Conflicting disposal outcomes require clarification.' };
      continue;
    }
    const terminal = ['destroyed', 'consumed'].includes(claim.disposition);
    records.push({ receipt_id: id, request_id: requestId, session_id: session.id, character_id: character.id, version: ITEM_DISPOSITION_VERSION, item_id: dispositionIdentity(selected.item), item_name: selected.item.name, item_snapshot: selected.item, source: selected.source, source_index: selected.index, quantity: claim.quantity, quantity_before: Number(selected.item.quantity ?? 1), quantity_after: Number(selected.item.quantity ?? 1) - claim.quantity, disposition: claim.disposition, retrievable: !terminal, location: location || session.current_location || null, destination: claim.destination || 'the scene', quote: claim.quote, historical_reconciliation: historical, recorded_at: new Date().toISOString() });
  }
  return { ok: true, records, version: ITEM_DISPOSITION_VERSION };
}

export function projectDispositionDelta(character, records) {
  const patch = { inventory: [...(character.inventory || [])], stowed_items: [...(character.stowed_items || [])], item_dispositions: [...(character.item_dispositions || [])] };
  for (const record of records) {
    if (patch.item_dispositions.some(x => x.receipt_id === record.receipt_id)) continue;
    const index = patch[record.source].findIndex(item => dispositionIdentity(item) === record.item_id);
    if (index < 0 || Number(patch[record.source][index].quantity ?? 1) !== record.quantity_before || JSON.stringify(patch[record.source][index]) !== JSON.stringify(record.item_snapshot)) return { ok: false, error: 'Owned item changed before disposal. The action was not completed.' };
    if (record.quantity_after === 0) patch[record.source].splice(index, 1);
    else patch[record.source][index] = { ...patch[record.source][index], quantity: record.quantity_after };
    patch.item_dispositions.push(record);
  }
  const capacity = validateContainerFit({ character: { ...character, ...patch }, container: 'Bag of Holding' });
  return { ok: true, patch, capacity: capacity.totals || null };
}

export function dispositionWorldItem(record) {
  const terminal = !record.retrievable;
  return { ...record.item_snapshot, item_id: record.item_id, quantity: record.quantity, container: record.destination, location: record.location, status: terminal ? record.disposition : record.item_snapshot.status || 'placed', world_status: terminal ? record.disposition : 'placed', retrievable: record.retrievable, disposition_receipt_id: record.receipt_id, disposition_provenance: record };
}