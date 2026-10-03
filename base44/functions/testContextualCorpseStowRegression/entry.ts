import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { executeStowAction } from '../../shared/story/stowIntent.ts';
import { resolveStoryStowTransition } from '../../shared/story/storyStowTransition.ts';
import { confirmContextualStow } from '../../shared/story/confirmContextualStow.ts';
import { readContextualCorpseSources } from '../../shared/story/contextualCorpseStow.ts';
import { canonicalStoryResponsePayload, hashStoryValue, acceptSequencedStoryPayload } from '../../shared/story/storyTransition.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req), db = base44.asServiceRole, fixtures = [], results = [], cleanup = [];
  const record = (name, pass) => results.push({ name, pass: !!pass });
  let before, after;
  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    await req.json();
    before = await hashValue(await readProtectedDndState(db));
    const tag = `ContextCorpseQA_${Date.now()}`;
    for (const mode of ['ai', 'player']) {
      const c = await base44.entities.Character.create({ name: `${tag}_${mode}`, race: 'Human', class: 'Ranger', level: 5, roll_mode: mode, is_active: false,
        hp_current: 40, hp_max: 40, spell_slots: { level_2: 1 }, inventory: [{ name: 'Bag of Holding', quantity: 1, capacity_weight_lb: 500, capacity_volume_cubic_ft: 64, opening_width_ft: 2 }, { name: 'Arrows', quantity: 10 }], stowed_items: [] });
      fixtures.push(['Character', c.id]);
      const origin = `${tag}:${mode}:source`, request = `${tag}:${mode}:attempt`, action = 'stealthily place the corpses in the bag of holding';
      const scene = { request_id: origin, text: 'Two cultist guards lie dead in the maintenance tunnel.', choices: Array.from({ length: 4 }, (_, i) => ({ text: `Inspect route ${i + 1}`, action_type: 'utility' })) };
      scene.choice_evidence = { response_payload_hash: await hashStoryValue(canonicalStoryResponsePayload({ requestId: origin, text: scene.text, choices: scene.choices })) };
      const receipt = { request_id: request, id: request, action_text: action, source_story_request_id: origin, skill: 'Stealth', raw_d20: 19, all_rolls: [19], modifier_total: 17, final_total: 36, dc: 14, success: true, roll_origin: mode, unified_story_skill_resolution: true };
      const s = await base44.entities.GameSession.create({ character_id: c.id, title: `${tag}_${mode}`, current_location: 'Maintenance Tunnel', story_log: [scene], is_active: false, world_state: { __skill_check_receipts: [receipt] } });
      fixtures.push(['GameSession', s.id]);
      const guards = [1, 2].map(i => ({ id: `${mode}_guard_${i}`, name: `Cultist Guard ${i}`, type: 'enemy', status: 'dead', hp_current: 0, is_conscious: false, weight: 100, volume_cubic_ft: 6, dimensions_ft: { width: 1, height: 1 } }));
      const combat = await base44.entities.CombatLog.create({ session_id: s.id, character_id: c.id, result: 'victory', is_active: false, location: s.current_location, combatants: guards });
      fixtures.push(['CombatLog', combat.id]);
      const call = (id, extra = {}) => executeStowAction({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, request_id: id, action_text: action, check: receipt, source_story_request_id: origin, ...extra } });
      const protectedResources = x => hashValue([x.hp_current, x.hp_max, x.spell_slots, x.gold, x.conditions, x.active_modifiers, x.roll_mode, x.inventory.find(i => i.name === 'Arrows')]);
      const resources = await protectedResources(c), sceneBefore = await hashValue(await db.entities.GameSession.get(s.id));
      const first = await call(request), snapshot = await db.entities.Character.get(c.id);
      record(`${mode}: unambiguous plural resolves both verified identities in one update`, first.body.writes === 1 && first.body.receipt.items.length === 2 && snapshot.stowed_items.length === 2 && snapshot.stowed_items.every(x => x.alive === false && x.death_provenance.status === 'dead' && x.stow_request_id === request));
      const bytes = await hashValue(snapshot), replay = await call(request);
      record(`${mode}: atomic set replay is exactly-once and byte-inert`, replay.body.writes === 0 && replay.body.already_processed && bytes === await hashValue(await db.entities.Character.get(c.id)));
      record(`${mode}: stow never advances scene or consumes roll/resources`, sceneBefore === await hashValue(await db.entities.GameSession.get(s.id)) && resources === await protectedResources(snapshot));
      await db.entities.Character.update(c.id, { stowed_items: [snapshot.stowed_items[0]], long_rest_abilities: {} });
      const remaining = await readContextualCorpseSources({ base44, session: s, character: await db.entities.Character.get(c.id) });
      record(`${mode}: already-stowed body excluded, remaining scene body stays distinct`, remaining.candidates.length === 1 && remaining.candidates[0].name === 'Cultist Guard 2' && remaining.already.length === 1);
      const onlyRemaining = await call(`${request}:remaining`);
      record(`${mode}: stows only the remaining corpse without a duplicate`, onlyRemaining.body.receipt.quantity === 1 && (await db.entities.Character.get(c.id)).stowed_items.length === 2);
      await db.entities.Character.update(c.id, { stowed_items: [], long_rest_abilities: {} });
      // Canonical capacity: missing measures take conservative defaults and never pause the set as unknowns.
      const defaulted = await call(`${request}:fit`);
      record(`${mode}: missing measures take conservative defaults and commit atomically`, defaulted.body.writes === 1 && defaulted.body.receipt.quantity === 2 && defaulted.body.receipt.capacity?.total_weight_lb === 200 && defaulted.body.receipt.capacity?.total_volume_cubic_ft === 12 && (await db.entities.Character.get(c.id)).stowed_items.length === 2);
      await db.entities.Character.update(c.id, { stowed_items: [], long_rest_abilities: {} });
      await db.entities.CombatLog.update(combat.id, { combatants: [guards[0], { ...guards[1], dimensions_ft: { width: 9, height: 9 } }] });
      const oversizedBefore = await hashValue(await db.entities.Character.get(c.id)), oversized = await call(`${request}:oversize`);
      record(`${mode}: oversized opening refusal is specific, named and zero-write`, oversized.body.clarification_required && oversized.body.writes === 0 && oversizedBefore === await hashValue(await db.entities.Character.get(c.id)) && /opening/.test(oversized.body.message) && oversized.body.message.includes('Cultist Guard 2'));
      await db.entities.CombatLog.update(combat.id, { combatants: [guards[0], { ...guards[1], weight: 600 }] });
      const overweight = await call(`${request}:overweight`);
      record(`${mode}: overweight refusal reports the exact limit and figure`, overweight.body.clarification_required && overweight.body.writes === 0 && /against its 500 lb limit/.test(overweight.body.message) && overweight.body.message.includes('700 lb'));
      await db.entities.CombatLog.update(combat.id, { combatants: guards });
      const other = await base44.entities.CombatLog.create({ session_id: s.id, character_id: c.id, result: 'victory', is_active: false, location: s.current_location,
        combatants: [{ ...guards[0], id: `${mode}_other_guard`, name: 'Sanctum Guard' }] });
      fixtures.push(['CombatLog', other.id]);
      const ambiguousBefore = await hashValue(await db.entities.Character.get(c.id));
      const ambiguous = await resolveStoryStowTransition({ base44, ownerId: user.id, session: await db.entities.GameSession.get(s.id), characterId: c.id, requestId: request, actionText: action, check: receipt });
      record(`${mode}: genuinely ambiguous recent defeat groups get natural named clarification`, ambiguous.response?.body.response_kind === 'clarification' && ambiguous.response.body.stow_transaction.candidates.length === 3 && /Cultist Guard 1/.test(ambiguous.response.body.clarification_message) && /Sanctum Guard/.test(ambiguous.response.body.clarification_message) && !/does not resolve|one source|item_phrase/.test(ambiguous.response.body.clarification_message));
      record(`${mode}: clarification confirms preserved pair and writes zero`, acceptSequencedStoryPayload(ambiguous.response.body, 1, 1).accepted && ambiguousBefore === await hashValue(await db.entities.Character.get(c.id)) && sceneBefore === await hashValue(await db.entities.GameSession.get(s.id)));
      const chosen = ambiguous.response.body.stow_transaction.candidates.filter(x => x.name.startsWith('Cultist'));
      const confirmed = await confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, original_request_id: request, selected_source_ids: chosen.map(x => x.id), raw_d20: 20 } });
      const followed = await db.entities.Character.get(c.id);
      record(`${mode}: follow-up reuses exact original Stealth36vs14 and original request`, confirmed.body.committed && confirmed.body.writes === 1 && JSON.stringify(confirmed.body.check_receipt) === JSON.stringify(receipt) && followed.stowed_items.length === 2 && followed.stowed_items.every(x => x.stow_request_id === request) && sceneBefore === await hashValue(await db.entities.GameSession.get(s.id)));
      const followBytes = await hashValue(followed), again = await confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, original_request_id: request, selected_source_ids: chosen.map(x => x.id) } });
      record(`${mode}: repeated follow-up cannot duplicate bodies or resources`, again.body.writes === 0 && again.body.stow_transaction.already_processed && followBytes === await hashValue(await db.entities.Character.get(c.id)));
      await db.entities.Character.update(c.id, { stowed_items: [], long_rest_abilities: {} });
      const invalidIds = await confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, original_request_id: request, selected_source_ids: ['corpse:invented:kill'] } });
      record(`${mode}: invented or foreign source identity cannot commit`, invalidIds.body.response_kind === 'clarification' && invalidIds.body.writes === 0 && (await db.entities.Character.get(c.id)).stowed_items.length === 0);
      const named = await confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, original_request_id: request, answer_text: 'Cultist Guard 1' } });
      record(`${mode}: naturally named answer resolves saved attempt without reroll`, named.body.committed && named.body.stow_transaction.receipt.quantity === 1 && JSON.stringify(named.body.check_receipt) === JSON.stringify(receipt));
      await db.entities.Character.update(c.id, { stowed_items: [], long_rest_abilities: {} });
      await db.entities.CombatLog.update(combat.id, { location: 'Older battlefield' });
      await db.entities.CombatLog.update(other.id, { location: 'Older sanctum', combatants: [{ ...guards[0], name: 'Living Guard', hp_current: 12, is_conscious: true }] });
      await db.entities.GameSession.update(s.id, { story_log: [{ ...scene, text: 'The two remaining cultists collapse instantly. You step over the bodies of the cultist vanguard.', choice_evidence: { response_payload_hash: await hashStoryValue(canonicalStoryResponsePayload({ requestId: origin, text: 'The two remaining cultists collapse instantly. You step over the bodies of the cultist vanguard.', choices: scene.choices })) } }] });
      const noDeathBefore = await hashValue(await db.entities.Character.get(c.id)), noDeath = await call(`${request}:no-death`);
      record(`${mode}: narrative-only deaths and historical bodies do not invent current sources`, noDeath.body.clarification_required && noDeath.body.candidates.length === 0 && /two cultists/.test(noDeath.body.message) && noDeathBefore === await hashValue(await db.entities.Character.get(c.id)));
      const staleScene = { ...scene, request_id: `${origin}:new` };
      staleScene.choice_evidence.response_payload_hash = await hashStoryValue(canonicalStoryResponsePayload({ requestId: staleScene.request_id, text: staleScene.text, choices: staleScene.choices }));
      await db.entities.GameSession.update(s.id, { story_log: [scene, staleScene] });
      const staleBefore = await hashValue(await db.entities.Character.get(c.id)), stale = await confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, original_request_id: request, selected_source_ids: chosen.map(x => x.id) } });
      record(`${mode}: stale clarification preserves scene and rejects without writes`, stale.status === 409 && staleBefore === await hashValue(await db.entities.Character.get(c.id)));
    }
  } catch (error) { results.push({ name: 'execution', pass: false, detail: error.message }); }
  finally { for (const [entity, id] of fixtures.reverse()) { await db.entities[entity].delete(id); cleanup.push({ entity, id, verified_absent: (await db.entities[entity].filter({ id })).length === 0 }); } }
  if (before) { after = await hashValue(await readProtectedDndState(db)); record('protected before/after hashes identical', before === after); }
  record('all eight exact disposable IDs absent', cleanup.length === 8 && cleanup.every(x => x.verified_absent));
  const passed = results.filter(x => x.pass).length;
  return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, cleanup, protected_before: before, protected_after: after, protected_unchanged: before === after }, { status: passed === results.length ? 200 : 500 });
}