import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { confirmContextualStow } from '../../shared/story/confirmContextualStow.ts';
import { executeItemTransferAction } from '../../shared/story/itemTransfer.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

// Live-shaped single-body / two-body capacity sequences on disposable copies of
// the owner's campaign. The live records are only read (one read-only restore,
// exactly what the owner's client calls on load) and hash-verified unchanged.
const LIVE_CHAR = '6a6825cd07a490fa70a46852', LIVE_SESSION = '6a6825edd695bd65a4322256';
const CANON = 'story-action:6a6825edd695bd65a4322256:1790817659048:q23g5d';
const STALE = 'story-action:6a6825edd695bd65a4322256:1791031542568:b5k2ip';
const strip = ({ id, created_date, updated_date, created_by, created_by_id, ...rest }) => rest;

export default async function(req) {
  const base44 = createClientFromRequest(req), db = base44.asServiceRole, fixtures = [], results = [], cleanup = [], observed = {};
  const record = (name, pass, detail) => results.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  let before, after;
  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    before = await hashValue(await readProtectedDndState(db));
    const [liveChar, liveSession] = await Promise.all([db.entities.Character.get(LIVE_CHAR), db.entities.GameSession.get(LIVE_SESSION)]);
    const live = await confirmContextualStow({ base44, ownerId: liveChar.created_by_id, payload: { session_id: LIVE_SESSION, character_id: LIVE_CHAR, read_only: true, original_request_id: STALE } });
    observed.live_restore = { status: live.status, requested: live.body.requested_request_id, rebound_from: live.body.rebound_from, reason: live.body.stow_transaction?.reason_code, message: live.body.clarification_message || live.body.error, candidates: live.body.stow_transaction?.candidates?.map(x => x.label), writes: live.body.writes };
    record('live read-only restore rebinds the stale local attempt to the canonical saved roll', live.status === 200 && live.body.requested_request_id === CANON && live.body.rebound_from === STALE && live.body.writes === 0);

    const tag = `SingleBodyQA_${Date.now()}`;
    const combats = await db.entities.CombatLog.filter({ session_id: LIVE_SESSION, character_id: LIVE_CHAR }, '-created_date', 8);
    const linked = liveSession.world_state?.last_completed_combat?.combat_id;
    if (linked && !combats.some(x => x.id === linked)) combats.push(...await db.entities.CombatLog.filter({ id: linked }, '-created_date', 1));
    const c = await base44.entities.Character.create({ ...strip(liveChar), name: tag, is_active: false });
    fixtures.push(['Character', c.id]);
    const s = await base44.entities.GameSession.create({ ...strip(liveSession), character_id: c.id, title: tag, is_active: false });
    fixtures.push(['GameSession', s.id]);
    const idMap = new Map();
    for (const combat of [...combats].sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)))) {
      const copy = await base44.entities.CombatLog.create({ ...strip(combat), session_id: s.id, character_id: c.id });
      fixtures.push(['CombatLog', copy.id]); idMap.set(combat.id, copy.id);
    }
    const remap = value => { let text = JSON.stringify(value ?? null); for (const [from, to] of idMap) text = text.split(from).join(to); return JSON.parse(text); };
    const resetClone = async () => {
      await db.entities.Character.update(c.id, { inventory: remap(liveChar.inventory || []), stowed_items: remap(liveChar.stowed_items || []), long_rest_abilities: remap(liveChar.long_rest_abilities || {}) });
      await db.entities.GameSession.update(s.id, { world_state: remap(liveSession.world_state || {}), story_log: remap(liveSession.story_log || []) });
    };
    await resetClone();
    const call = payload => confirmContextualStow({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, ...payload } });
    const snap = async () => hashValue(await Promise.all([db.entities.Character.get(c.id), db.entities.GameSession.get(s.id)]).then(([x, y]) => [x.inventory, x.stowed_items, x.long_rest_abilities, y.story_log, y.world_state]));

    const load = await call({ read_only: true });
    const candidates = load.body.stow_transaction?.candidates || [];
    const guards = candidates.filter(x => /Cultist Guard/i.test(x.name));
    const pick = (guards.length ? guards : candidates);
    observed.clone_candidates = candidates.map(x => x.label);
    record('clone load binds the canonical Stealth 36 attempt', load.status === 200 && load.body.requested_request_id === CANON && load.body.check_receipt?.skill === 'Stealth' && load.body.check_receipt?.final_total === 36);
    record('clone load shows the two-body 806 lb refusal visibly', load.body.stow_transaction?.reason_code === 'container_fit_unverified' && /806 lb/.test(load.body.clarification_message), load.body.clarification_message);
    record('stale local id rebinds on load (no linkage failure)', (await call({ read_only: true, original_request_id: STALE })).body.rebound_from === STALE);

    const h0 = await snap();
    const one = await call({ original_request_id: CANON, selected_source_ids: [pick[0].id] });
    observed.single_select = one.body.clarification_message || one.body.error;
    record('ticking one body returns the specific 646 lb overload refusal', one.status === 200 && one.body.response_kind === 'clarification' && one.body.stow_transaction?.reason_code === 'container_fit_unverified' && /646 lb/.test(one.body.clarification_message) && /146 lb over/.test(one.body.clarification_message), observed.single_select);
    record('single-body refusal reuses the saved roll and writes nothing', one.body.writes === 0 && one.body.check_receipt?.request_id === CANON && h0 === await snap());
    const staleOne = await call({ original_request_id: STALE, selected_source_ids: [pick[0].id] });
    record('submitting on the stale duplicate is re-linked, never resolved as a 2-body partial', staleOne.status === 409 && staleOne.body.error_code === 'stow_attempt_rebound' && staleOne.body.canonical_request_id === CANON && h0 === await snap());
    const typed = await call({ original_request_id: CANON, answer_text: 'stow just 1 body' });
    observed.typed_single = typed.body.clarification_message;
    record('typed "stow just 1 body" reaches the same 646 lb refusal', typed.body.stow_transaction?.reason_code === 'container_fit_unverified' && /646 lb/.test(typed.body.clarification_message) && h0 === await snap(), observed.typed_single);
    const both = await call({ original_request_id: CANON, selected_source_ids: pick.slice(0, 2).map(x => x.id) });
    record('ticking both bodies returns the 806 lb refusal, zero writes', pick.length >= 2 && /806 lb/.test(both.body.clarification_message) && both.body.writes === 0 && h0 === await snap(), both.body.clarification_message);

    const leave = await executeItemTransferAction({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, action_text: "Leave the Rune-Caster's corpse here in the tunnel", request_id: `${tag}:leave-1` } });
    const afterLeave = await db.entities.Character.get(c.id);
    record('bag removal is wired: "Leave the Rune-Caster\'s corpse here in the tunnel" moves exactly one body out', leave.body.success && leave.body.receipt.source === 'stowed_items' && leave.body.receipt.death_state_retained && !afterLeave.stowed_items.some(x => x.name === "Rune-Caster's Corpse") && afterLeave.stowed_items.length === liveChar.stowed_items.length - 1);
    const room = await call({ read_only: true });
    observed.candidates_after_removal = room.body.stow_transaction?.candidates?.map(x => x.label);
    const fitOne = await call({ original_request_id: CANON, selected_source_ids: [pick[0].id] });
    record('after making room, one body commits at exactly 486 / 500 lb', fitOne.body.committed && fitOne.body.writes === 1 && fitOne.body.stow_transaction.receipt.quantity === 1 && fitOne.body.stow_transaction.receipt.capacity?.weight_lb === 486, fitOne.body.message || fitOne.body.error);
    const replay = await call({ original_request_id: CANON, selected_source_ids: [pick[0].id] }), h1 = await snap();
    record('replaying the committed single stow is inert', replay.body.writes === 0 && replay.body.stow_transaction?.already_processed && h1 === await snap());

    await resetClone();
    for (const name of ["Rune-Caster's corpse", "Obsidian Circle Vanguard's corpse"]) await executeItemTransferAction({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, action_text: `Leave the ${name} here in the tunnel`, request_id: `${tag}:leave:${name}` } });
    const fitTwo = await call({ original_request_id: CANON, selected_source_ids: pick.slice(0, 2).map(x => x.id) });
    record('after removing two older bodies, both scene bodies commit at 486 / 500 lb', fitTwo.body.committed && fitTwo.body.stow_transaction.receipt.quantity === 2 && fitTwo.body.stow_transaction.receipt.capacity?.weight_lb === 486, fitTwo.body.message || fitTwo.body.error);
  } catch (error) { results.push({ name: 'execution', pass: false, detail: error.message }); }
  finally {
    for (const [entity, id] of fixtures.reverse()) {
      await db.entities[entity].delete(id);
      cleanup.push({ entity, id, verified_absent: (await db.entities[entity].filter({ id })).length === 0 });
    }
  }
  if (before) { after = await hashValue(await readProtectedDndState(db)); record('protected live before/after hashes identical', before === after); }
  record('every disposable ID verified absent', cleanup.length >= 2 && cleanup.every(x => x.verified_absent));
  const passed = results.filter(x => x.pass).length;
  return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, observed, cleanup, protected_before: before, protected_after: after }, { status: passed === results.length ? 200 : 500 });
}