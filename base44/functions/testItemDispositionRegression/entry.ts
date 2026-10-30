import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { inferDispositionClaims, planItemDispositions, projectDispositionDelta, blockedDispositionAcquisition, ITEM_DISPOSITION_VERSION } from '../../shared/story/itemDispositionPlan.ts';
import { commitItemDispositions } from '../../shared/story/itemDispositionCommit.ts';

export default async function(req) {
  const tests = [];
  const test = (name, pass, detail) => tests.push({ name, pass: !!pass, ...(pass ? {} : { detail: detail === undefined ? null : detail }) });
  let sessionId = null, characterId = null;
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });
    const db = base44.asServiceRole;

    // ---- Pure planner: bag drop, passive anaphora, destruction, no-op text ----
    const fixture = { id: 'c', inventory: [{ name: 'Arrows', quantity: 30 }, { name: 'Bag of Holding', quantity: 1, category: 'Trinket' }], stowed_items: [
      { name: "Ritualist Leader's Severed Head", aliases: ['the head'], quantity: 1, container: 'Bag of Holding', stow_request_id: 'r1' },
      { name: 'Unidentified Staff', quantity: 1, container: 'Bag of Holding', stow_request_id: 'r2' },
      { name: "Weaver's Ledger", quantity: 1, container: 'Bag of Holding', stow_request_id: 'r3' }] };
    const headQuote = 'You pull the severed head of the ritual leader from the Bag of Holding, letting it drop onto the soft moss before Sylvara.';
    const inferred = inferDispositionClaims(fixture, headQuote);
    test('passive/anaphoric bag drop is detected', inferred.some(c => c.item_ref === 'stowed_items:0' && c.disposition === 'dropped'), inferred);
    test('inspection-only prose is not a disposal', inferDispositionClaims(fixture, 'You inspect the Unidentified Staff and weigh it in your hands.').length === 0);
    // The bag is named only as the place the head came OUT of — it is never disposed of.
    test('source container is never disposed of', !inferred.some(c => c.item_ref === 'inventory:1'), inferred);
    test('bag can still be disposed of when it is the object', inferDispositionClaims(fixture, 'You drop the bag of holding into the pit.').some(c => c.item_ref === 'inventory:1'));
    test('failed-attempt prose is not a disposal', inferDispositionClaims(fixture, "You cannot drop the Unidentified Staff; your grip does not open.").length === 0);

    const session = await db.entities.GameSession.create({ character_id: 'pending', title: 'Disposition Fixture (temp)', is_active: false });
    sessionId = session.id;
    const character = await db.entities.Character.create({ created_by_id: user.id, name: 'Disposition Fixture', race: 'Human', class: 'Ranger', level: 7, hp_max: 10, hp_current: 10, inventory: [{ name: 'Arrows', quantity: 30 }], stowed_items: fixture.stowed_items });
    characterId = character.id;
    await db.entities.GameSession.update(session.id, { character_id: character.id, current_location: 'Circle of the Reeds - Warden\'s Arbor' });

    const plan = await planItemDispositions({ character, session: { ...session, character_id: character.id, current_location: "Circle of the Reeds - Warden's Arbor" }, requestId: 'fixture:head', narrative: headQuote, location: "Circle of the Reeds - Warden's Arbor" });
    test('planner accepts the exact narrated drop', plan.ok && plan.records.length === 1, plan);

    const committed = await commitItemDispositions({ db, sessionId: session.id, characterId: character.id, plan, requirePending: false });
    test('drop commits atomically with a receipt', committed.ok && committed.applied && committed.writes > 0, committed.body);
    const afterHead = await db.entities.Character.get(character.id);
    test('dropped item leaves the bag', !(afterHead.stowed_items || []).some(i => i.name === "Ritualist Leader's Severed Head"));
    test('other bag items untouched', (afterHead.stowed_items || []).length === 2);
    test('permanent receipt keeps the original snapshot', (afterHead.item_dispositions || []).some(r => r.item_name === "Ritualist Leader's Severed Head" && r.item_snapshot?.container === 'Bag of Holding'));
    const afterHeadSession = await db.entities.GameSession.get(session.id);
    test('dropped item is placed in the world at that location', (afterHeadSession.world_state?.world_items || []).some(w => w.item_name === "Ritualist Leader's Severed Head" && w.retrievable === true && w.location === "Circle of the Reeds - Warden's Arbor"));

    const replay = await commitItemDispositions({ db, sessionId: session.id, characterId: character.id, plan, requirePending: false });
    test('replay writes nothing', replay.ok && replay.writes === 0, replay);

    const staffQuote = 'As the ritual staff shatters within the fissure, a violent torrent of necrotic energy rips through the Spire’s foundation.';
    const staffPlan = await planItemDispositions({ character: afterHead, session: { ...afterHeadSession }, requestId: 'fixture:staff', narrative: staffQuote, claims: [{ item_ref: 'stowed_items:0', quantity: 1, disposition: 'destroyed', destination: 'the collapsed Spire', quote: staffQuote }], location: 'Spire of Whispers - Ruined Sanctum' });
    test('destruction plan is accepted with its quote', staffPlan.ok && staffPlan.records[0]?.retrievable === false, staffPlan);
    const destroyed = await commitItemDispositions({ db, sessionId: session.id, characterId: character.id, plan: staffPlan, requirePending: false });
    const afterStaff = await db.entities.Character.get(character.id);
    test('destroyed item is removed and marked non-retrievable', destroyed.ok && !(afterStaff.stowed_items || []).some(i => i.name === 'Unidentified Staff') && (afterStaff.item_dispositions || []).some(r => r.item_name === 'Unidentified Staff' && r.retrievable === false));

    // A destroyed identity can never be re-acquired through the recovery path.
    test('destroyed identity is blocked from recovery', !!blockedDispositionAcquisition(afterStaff, { name: 'Unidentified Staff' }));
    test('unrelated item is not blocked', !blockedDispositionAcquisition(afterStaff, { name: 'Arrows' }));

    // Mismatched evidence must be refused (a fabricated quote can never dispose).
    const forged = await planItemDispositions({ character: afterStaff, session: afterHeadSession, requestId: 'fixture:forged', narrative: 'The ledger is safely returned.', claims: [{ item_ref: 'stowed_items:0', quantity: 1, disposition: 'given', quote: 'You burn the ledger' }] });
    test('fabricated evidence is refused', !forged.ok);
    const overQuantity = await planItemDispositions({ character: afterStaff, session: afterHeadSession, requestId: 'fixture:qty', narrative: 'You drop the ledger.', claims: [{ item_ref: 'stowed_items:0', quantity: 2, disposition: 'dropped', quote: 'You drop the ledger.' }] });
    test('quantity beyond possession is refused', !overQuantity.ok);

    // The delta projector must refuse a stale snapshot instead of writing nothing.
    const stale = projectDispositionDelta(afterStaff, [{ ...staffPlan.records[0], receipt_id: 'fixture:stale', quantity_before: 2 }]);
    test('stale snapshot is refused, never a silent no-op', !stale.ok);

    const passed = tests.filter(t => t.pass).length, allPass = passed === tests.length;
    return Response.json({ function_version: 'item-disposition-regression-v1.0.0', item_disposition_version: ITEM_DISPOSITION_VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: allPass, tests }, { status: allPass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Disposition regression failed.', tests }, { status: 500 });
  } finally {
    try { if (sessionId) await base44.asServiceRole.entities.GameSession.delete(sessionId); } catch {}
    try { if (characterId) await base44.asServiceRole.entities.Character.delete(characterId); } catch {}
  }
}