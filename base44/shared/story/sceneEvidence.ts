import { hashStoryValue } from './storyTransition.ts';
export const SCENE_GROUNDING_VERSION = 'grounded-scene-v1';
export const SCENE_ENTITY_SCHEMA = { type: 'array', maxItems: 24, items: { type: 'object', properties: {
  name: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' }, maxItems: 6 }, type: { type: 'string', enum: ['object', 'container', 'creature', 'corpse'] },
  quantity: { type: 'integer', minimum: 1, maximum: 8 }, status: { type: 'string', enum: ['alive', 'dead', 'unknown'] },
  source_request_id: { type: 'string' }, quote: { type: 'string' }, existing_id: { type: 'string' }
}, required: ['name', 'type', 'quantity', 'status', 'source_request_id', 'quote'] } };
const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hypothetic = /\b(?:if|might|could|would|perhaps|seems?|appears?|pretend|not|isn't|wasn't|aren't|weren't|almost)\b/i;
const explicitDeath = /\b(?:dead|died|killed|slain|lifeless|corpse|corpses)\b/i;
const life = /\b(?:alive|living|breathing|unconscious|stabili[sz]ed|wakes?|awakes?|gets? up|stands? up|escapes?|flees?|speaks?)\b/i;
const harmful = /\b(?:attack|attacks|kill|killing|shoot|shot|strike|striking|volley|stab|slay|take down|dispatch|arrows? fly|release.*arrows?)\b/i;
export async function sceneRevision(session) {
  return hashStoryValue({ session_id: session.id, location: session.current_location || '', latest_request: session.story_log?.at(-1)?.request_id || null, latest_text: session.story_log?.at(-1)?.text || '', entities: session.world_state?.scene_entities || [], combat_state: session.combat_state || {} });
}
export function evidenceEntries(session) {
  return (session.story_log || []).filter(e => e.text && e.mechanics_status !== 'pending' && e.action !== 'combat_narrate');
}
export function validateSceneCandidate({ session, entry, candidate, structured = [], newlyGenerated = false }) {
  const text = String(entry?.text || ''), quote = String(candidate?.quote || ''), start = text.indexOf(quote);
  const reject = reason => ({ ok: false, reason, candidate_name: candidate?.name || 'that object' });
  if (!entry || !quote || start < 0 || !candidate.name || candidate.name.length > 100 || !['object','container','creature','corpse'].includes(candidate.type) || !['alive','dead','unknown'].includes(candidate.status)) return reject('unsupported_source_span');
  if (!Number.isInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 8) return reject('unsupported_quantity');
  const words = [candidate.name, ...(candidate.aliases || [])].map(norm).filter(Boolean);
  if (!words.some(w => norm(quote).includes(w))) return reject('identity_not_in_source');
  if (candidate.quantity > 1 && !new RegExp(`\\b(?:${candidate.quantity}|${['zero','one','two','three','four','five','six','seven','eight'][candidate.quantity]})\\b`, 'i').test(quote)) return reject('distinct_count_unproven');
  if (candidate.quantity === 1 && /\b(?:two|three|four|five|six|seven|eight|several|many)\b/i.test(quote)) return reject('singular_identity_in_plural_span');
  const subsequent = (session.story_log || []).slice(Math.max(0, session.story_log?.indexOf(entry) + 1));
  const matchName = v => words.some(w => norm(v).includes(w));
  const structuredMatches = structured.filter(x => matchName(x.name) || candidate.existing_id === x.id);
  if (candidate.status === 'dead' || candidate.type === 'corpse') {
    if (!explicitDeath.test(quote) || hypothetic.test(quote) || life.test(quote)) return reject('death_not_explicit');
    if (structuredMatches.some(x => x.status === 'alive' || x.alive === true || Number(x.hp_current ?? x.hp) > 0 || x.is_stable === true)) return reject('structured_living_contradiction');
    if (subsequent.some(e => matchName(e.text) && life.test(e.text))) return reject('subsequent_living_contradiction');
    // Narration may establish discovered narrative-mode remains, but may not replace
    // attack/spell resolution, or turn a successful Stealth check into two kills.
    if (session.in_combat || entry.combat_handoff || harmful.test(`${entry.player_choice || ''} ${quote}`) || (newlyGenerated && harmful.test(text))) return reject('mechanical_death_requires_receipt');
    if (structuredMatches.length) return reject('use_existing_mechanical_identity');
  }
  return { ok: true, start, end: start + quote.length };
}
export async function materializeSceneCandidates({ session, entry, candidates, structured = [], newlyGenerated = false }) {
  const accepted = [], rejected = [], seen = new Set();
  for (const candidate of (Array.isArray(candidates) ? candidates : []).slice(0, 24)) {
    const proof = validateSceneCandidate({ session, entry, candidate, structured, newlyGenerated });
    if (!proof.ok) { rejected.push(proof); continue; }
    const sourceHash = await hashStoryValue(entry.text);
    const stem = `scene:${(await hashStoryValue([session.id, entry.request_id || sourceHash, proof.start, proof.end, candidate.type])).slice(0, 24)}`;
    for (let ordinal = 0; ordinal < candidate.quantity; ordinal++) {
      const id = `${stem}:${ordinal + 1}`;
      if (seen.has(id)) continue;
      seen.add(id);
      accepted.push({ id, session_id: session.id, source_request_id: entry.request_id || null, location: session.current_location || '', name: candidate.quantity > 1 ? `${candidate.name} ${ordinal + 1}` : candidate.name,
        aliases: [...new Set([candidate.name, ...(candidate.aliases || [])])].slice(0, 7), type: candidate.type, quantity: 1, status: candidate.status, transfer_state: 'world',
        affordances: candidate.status === 'dead' ? ['inspect','stow'] : candidate.type === 'container' ? ['inspect','open'] : ['inspect'],
        evidence: { authority: 'committed_dm_narration', source_request_id: entry.request_id || null, source_hash: sourceHash, quote: candidate.quote, span_start: proof.start, span_end: proof.end, narrative_derived: true },
        ...(candidate.status === 'dead' ? { alive: false, death_provenance: { source: 'narrative_derived', scene_entity_id: id, source_request_id: entry.request_id || null, source_hash: sourceHash, quote: candidate.quote, span_start: proof.start, span_end: proof.end, status: 'dead' } } : {}) });
    }
  }
  return { accepted, rejected, version: SCENE_GROUNDING_VERSION };
}