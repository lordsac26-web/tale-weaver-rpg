import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { resolveStowResume } from '../../shared/story/stowResume.ts';
import { pendingCorpseReceipt } from '../../shared/story/pendingCorpseStow.ts';
import { classifyStowIntent } from '../../shared/story/stowIntent.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req), db = base44.asServiceRole, fixtures = [], results = [], cleanup = [];
  const record = (name, pass) => results.push({ name, pass: !!pass });
  let before, after;
  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    before = await hashValue(await readProtectedDndState(db));
    const tag = `StowResumeQA_${Date.now()}`;
    const c = await base44.entities.Character.create({ name: tag, race: 'Human', class: 'Rogue', level: 5, is_active: false, inventory: [], stowed_items: [], long_rest_abilities: {} });
    fixtures.push(['Character', c.id]);
    const origin = `${tag}:origin`, action = "put the two corpses in the bag of holding'";
    const receipt = (request_id, skill, raw, dc = 12, success = true) => ({ request_id, id: request_id, action_text: action, source_story_request_id: origin, skill, raw_d20: raw, all_rolls: [raw], modifier_total: 16, final_total: raw + 16, dc, success, roll_origin: 'ai', unified_story_skill_resolution: true });
    const s = await base44.entities.GameSession.create({ character_id: c.id, title: tag, current_location: 'Tunnel', story_log: [{ request_id: origin, text: 'The two guards lie dead in the tunnel.', choices: [] }], is_active: false, world_state: { __skill_check_receipts: [receipt(`${tag}:r1`, 'Stealth', 20), receipt(`${tag}:r2`, 'Stealth', 21), receipt(`${tag}:r3`, 'Athletics', 7)] } });
    fixtures.push(['GameSession', s.id]);
    let session = await db.entities.GameSession.get(s.id);
    let character = await db.entities.Character.get(c.id);
    const parsed = classifyStowIntent(action);
    record('the live wording parses as a corpse stow into the bag', parsed?.container === 'Bag of Holding' && /\bcorpses\b/i.test(parsed.item_phrase));
    const resume = resolveStowResume({ session, character, actionText: action });
    record('a repeated stow resumes the earliest saved corpse check, no new roll', resume?.request_id === `${tag}:r1` && resume?.resume.skill === 'Stealth' && resume?.resume.final_total === 36 && resume?.resume.dc === 12 && resume?.resume.success === true);
    record('the later duplicate rolls are reported as superseded', resume?.superseded_request_ids.join(',') === `${tag}:r2,${tag}:r3`);
    record('canonical pending binding matches the resumed attempt', pendingCorpseReceipt(session, character)?.request_id === `${tag}:r1`);
    const stateBefore = await Promise.all([db.entities.Character.get(c.id), db.entities.GameSession.get(s.id)]);
    resolveStowResume({ session, character, actionText: action });
    record('resume evaluation is read-only for character and session', JSON.stringify(await db.entities.Character.get(c.id)) === JSON.stringify(stateBefore[0]) && JSON.stringify(await db.entities.GameSession.get(s.id)) === JSON.stringify(stateBefore[1]));
    await db.entities.GameSession.update(s.id, { world_state: { __skill_check_receipts: [receipt(`${tag}:r1`, 'Stealth', 3, 12, false), receipt(`${tag}:r2`, 'Athletics', 4, 12, false)] } });
    session = await db.entities.GameSession.get(s.id);
    record('a group with no successful saved check is not resumed', resolveStowResume({ session, character, actionText: action }) === null);
    await db.entities.GameSession.update(s.id, { world_state: { __skill_check_receipts: [receipt(`${tag}:r1`, 'Stealth', 20), receipt(`${tag}:r2`, 'Stealth', 21), receipt(`${tag}:r3`, 'Athletics', 7)] } });
    session = await db.entities.GameSession.get(s.id);
    await db.entities.Character.update(c.id, { long_rest_abilities: { __stow_receipts: [{ token: `${tag}:r1` }] } });
    character = await db.entities.Character.get(c.id);
    record('a committed attempt is never resumed or auto-rebound', resolveStowResume({ session, character, actionText: action }) === null && pendingCorpseReceipt(session, character) === undefined);
    record('explicit committed id still restores already-secured state; superseded explicit id clears', pendingCorpseReceipt(session, character, `${tag}:r1`)?.request_id === `${tag}:r1` && pendingCorpseReceipt(session, character, `${tag}:r3`) === undefined);
    await db.entities.Character.update(c.id, { long_rest_abilities: {} });
    character = await db.entities.Character.get(c.id);
    await db.entities.GameSession.update(s.id, { story_log: [{ request_id: `${origin}:new`, text: 'A different room.', choices: [] }] });
    const moved = await db.entities.GameSession.get(s.id);
    record('a saved roll from an older scene is never resumed or rebound', resolveStowResume({ session: moved, character, actionText: action }) === null && pendingCorpseReceipt(moved, character) === undefined);
  } catch (error) { results.push({ name: 'execution', pass: false, detail: error.message }); }
  finally {
    for (const [entity, id] of fixtures.reverse()) {
      await db.entities[entity].delete(id);
      cleanup.push({ entity, id, verified_absent: (await db.entities[entity].filter({ id })).length === 0 });
    }
  }
  if (before) { after = await hashValue(await readProtectedDndState(db)); record('protected before/after hashes identical', before === after); }
  record('exact disposable IDs absent', cleanup.length === 2 && cleanup.every(x => x.verified_absent));
  const passed = results.filter(x => x.pass).length;
  return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, cleanup, protected_before: before, protected_after: after, protected_unchanged: before === after }, { status: passed === results.length ? 200 : 500 });
}