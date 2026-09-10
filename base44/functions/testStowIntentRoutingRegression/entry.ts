import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { classifyStowIntent, executeStowAction } from '../../shared/story/stowIntent.ts';
import { parseThrownWeaponIntent } from '../../shared/story/thrownWeaponAction.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function testStowIntentRoutingRegression(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const fixtures = [];
    const results = [];
    const record = (name, pass) => results.push({ name, pass: !!pass });
    try {
      const liveA = classifyStowIntent("toss the tainted iron shafts in the quiver into my bag of holding (adding to the weaver's ledger/booklet already inside)");
      const liveB = classifyStowIntent('toss the quiver of iron shafts into my bag of holding - no dc needed');
      record('live phrasing a routes to stow with Bag of Holding destination', liveA?.type === 'stow' && liveA.container === 'Bag of Holding');
      record('live phrasing b routes to stow with Bag of Holding destination', liveB?.type === 'stow' && liveB.container === 'Bag of Holding');
      record('thrown attack at a creature is not stow', classifyStowIntent('throw my dagger at the cultist leader') === null);
      record('thrown attack into a non-container is not stow', classifyStowIntent('hurl the javelin into the pit') === null);
      record('pack of creatures is not a stow container', classifyStowIntent('throw the alchemist fire into the pack of gnolls') === null);
      record('stow phrasing never parses as a thrown weapon attack', parseThrownWeaponIntent('toss the quiver of iron shafts into my bag of holding') === null);
      record('genuine thrown weapon attack still parses', parseThrownWeaponIntent('throw my dagger at the cultist leader')?.type === 'thrown_weapon_attack');

      const tag = `StowQA_${Date.now()}`;
      const character = await base44.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 3, inventory: [{ name: 'Torch', quantity: 2, description: 'A burning torch.' }, { name: 'Arrows', quantity: 12, category: 'Ammunition' }, { name: 'Bag of Holding', quantity: 1 }], is_active: false });
      fixtures.push(['Character', character.id]);
      const session = await base44.entities.GameSession.create({ character_id: character.id, title: tag, story_log: [], is_active: false });
      fixtures.push(['GameSession', session.id]);

      const first = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, action_text: 'toss the torch into my bag of holding', request_id: 'stow-fixture-torch' } });
      const replay = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, action_text: 'toss the torch into my bag of holding', request_id: 'stow-fixture-torch' } });
      const afterStow = await base44.asServiceRole.entities.Character.get(character.id);
      record('stow commits once and moves exactly one unit with provenance', first.status === 200 && first.body?.writes === 1 && afterStow.inventory?.find((item) => item.name === 'Torch')?.quantity === 1 && afterStow.stowed_items?.some((item) => item.name === 'Torch' && item.quantity === 1 && item.container === 'Bag of Holding' && !!item.provenance?.source));
      record('stow replay is inert', replay.body?.already_processed === true && replay.body?.writes === 0);

      const allStow = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, action_text: 'stash all the arrows in my bag of holding', request_id: 'stow-fixture-arrows-all' } });
      const afterAll = await base44.asServiceRole.entities.Character.get(character.id);
      record('whole-stack stow moves the full quantity', allStow.body?.writes === 1 && !afterAll.inventory?.some((item) => item.name === 'Arrows') && afterAll.stowed_items?.find((item) => item.name === 'Arrows')?.quantity === 12);

      const ambiguousBefore = await base44.asServiceRole.entities.Character.get(character.id);
      const ambiguous = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, action_text: 'toss the tainted iron shafts in the quiver into my bag of holding', request_id: 'stow-fixture-ambiguous' } });
      const ambiguousAfter = await base44.asServiceRole.entities.Character.get(character.id);
      record('ambiguous stow asks in-narration clarification without hard error or writes', ambiguous.status === 200 && ambiguous.body?.clarification_required === true && ambiguous.body?.writes === 0 && JSON.stringify(ambiguousAfter.inventory) === JSON.stringify(ambiguousBefore.inventory) && JSON.stringify(ambiguousAfter.stowed_items) === JSON.stringify(ambiguousBefore.stowed_items));

      const retry = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, action_text: 'toss the torch into my bag of holding', request_id: 'stow-fixture-ambiguous' } });
      const afterRetry = await base44.asServiceRole.entities.Character.get(character.id);
      record('retry under the same request id after a clarification commits the stow', retry.body?.writes === 1 && afterRetry.stowed_items?.find((item) => item.name === 'Torch')?.quantity === 2);

      const orphan = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: 'ffffffffffffffffffffffff', character_id: character.id, action_text: 'toss the torch into my bag of holding', request_id: 'stow-fixture-orphan' } });
      record('invalid linkage rejects without writes', orphan.status === 403 && orphan.body?.writes === 0);
    } finally {
      for (const [entity, id] of fixtures.reverse()) { try { await base44.asServiceRole.entities[entity].delete(id); } catch {} }
    }
    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('cleanup complete and protected live IDs unchanged', protectedBefore === protectedAfter);
    const passed = results.filter((item) => item.pass).length;
    const allPass = passed === results.length;
    return Response.json({ function_version: 'test-stow-intent-routing-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results }, { status: allPass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Stow intent routing regression failed' }, { status: 500 });
  }
}