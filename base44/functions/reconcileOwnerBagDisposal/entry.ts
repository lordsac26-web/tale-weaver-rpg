import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { dispositionHash, planItemDispositions, projectDispositionDelta } from '../../shared/story/itemDispositionPlan.ts';
import { commitItemDispositions } from '../../shared/story/itemDispositionCommit.ts';

const SESSION = '6a6825edd695bd65a4322256', CHARACTER = '6a6825cd07a490fa70a46852';
const ITEMS = {
  head: { name: "Ritualist Leader's Severed Head", request: 'story-choice:6a6825edd695bd65a4322256:d22ddd15-1ed1-4e01-9dad-d3bfb31c0324', disposition: 'dropped', location: "Circle of the Reeds - Warden's Arbor", destination: 'the soft moss before Sylvara', quote: 'You pull the severed head of the ritual leader from the Bag of Holding, letting it drop onto the soft moss before Sylvara.' },
  staff: { name: 'Unidentified Staff', request: 'story-action:6a6825edd695bd65a4322256:1793155958904:7gqb5v', disposition: 'destroyed', location: 'Spire of Whispers - Collapsing Ritual Sanctum', destination: 'the eastern ley-line fissure, now within the collapsed Spire ruins', quote: 'As the ritual staff shatters within the fissure, a violent torrent of necrotic energy rips through the Spire’s foundation.' }
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const { mode = 'discover', item, expected_hash } = await req.json().catch(() => ({}));
    if (!ITEMS[item] || !['discover', 'apply'].includes(mode)) return Response.json({ error: 'Choose head or staff, with discover or apply.' }, { status: 400 });
    const db = base44.asServiceRole;
    const [session, character] = await Promise.all([db.entities.GameSession.get(SESSION), db.entities.Character.get(CHARACTER)]);
    if (session.character_id !== character.id) return Response.json({ error: 'Exact scope mismatch' }, { status: 409 });
    const spec = ITEMS[item], requestId = `owner-disposal-reconcile:2026-10-30:${item}`;
    const prior = (character.item_dispositions || []).filter(r => r.request_id === requestId);
    if (prior.length) {
      const committed = await commitItemDispositions({ db, sessionId: SESSION, characterId: CHARACTER, plan: { ok: true, records: prior }, requirePending: false });
      return Response.json({ ok: committed.ok, already_processed: true, writes: committed.writes, capacity: committed.capacity, records: prior });
    }
    const evidence = session.story_log.filter(e => e.request_id === spec.request);
    const matches = (character.stowed_items || []).map((x, i) => ({ x, i })).filter(v => v.x.name === spec.name && v.x.container === 'Bag of Holding' && Number(v.x.quantity ?? 1) === 1);
    if (evidence.length !== 1 || !evidence[0].text.includes(spec.quote) || matches.length !== 1) return Response.json({ error: 'Exact evidence or one-item cardinality guard failed.', writes: 0 }, { status: 409 });
    const plan = await planItemDispositions({ character, session, requestId, narrative: spec.quote, claims: [{ item_ref: `stowed_items:${matches[0].i}`, quantity: 1, disposition: spec.disposition, destination: spec.destination, quote: spec.quote }], location: spec.location, historical: true });
    if (!plan.ok) return Response.json({ error: plan.error, writes: 0 }, { status: 409 });
    // Keep the quoted historical action as evidence without altering its roll,
    // prose, consequences or any other live gameplay fields.
    plan.records = plan.records.map(r => ({ ...r, destination: spec.destination, source_story_request_id: spec.request, source_story_timestamp: evidence[0].timestamp }));
    const expected = await dispositionHash({ session, character });
    const projection = projectDispositionDelta(character, plan.records);
    if (mode === 'discover') return Response.json({ ok: true, writes: 0, expected_hash: expected, records: plan.records, capacity_after: projection.capacity, remaining_names: projection.patch.stowed_items.map(x => x.name) });
    if (expected_hash !== expected) return Response.json({ error: 'Live state changed; discover again before applying.', writes: 0 }, { status: 409 });
    const committed = await commitItemDispositions({ db, sessionId: SESSION, characterId: CHARACTER, plan, requirePending: false });
    return Response.json({ ok: committed.ok, error: committed.body?.error, writes: committed.writes, records: committed.records, capacity: committed.capacity, remaining_names: committed.character?.stowed_items?.map(x => x.name) }, { status: committed.ok ? 200 : 409 });
  } catch (error) {
    return Response.json({ error: error.message, persistence_confirmed: false }, { status: 500 });
  }
}