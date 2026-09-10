import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canonicalStoryConditionName, evaluateActiveEffects, normalizeStoryConditions } from '../../shared/story/activeEffects.ts';
import { executeAskDungeonMasterCore } from '../../shared/askDungeonMasterCore.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function testStatusTruthRegression(req) {
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
      const now = Date.parse('2026-09-09T20:00:00.000Z');
      const expiredAt = '2026-09-02T23:00:00.000Z';
      const conditions = [
        { name: 'Pass without Trace', source: 'Pass without Trace', duration: 'persistent', expires_at: expiredAt },
        { name: 'Longstrider', source: 'story', duration: 'persistent' },
        { name: 'Protected by the Circle', source: 'story', duration: 'persistent', applied_at: '2026-08-14T00:40:56.687Z' },
        { name: 'Protected by the Circle of the Reeds', source: 'story', duration: 'persistent', applied_at: '2026-08-14T00:34:17.063Z' },
        { name: 'Blessed by the Reeds', source: 'story', duration: 'persistent', applied_at: '2026-09-02T12:14:44.079Z' },
        { name: 'Blessed by the Circle', source: 'story', duration: 'persistent', applied_at: '2026-09-03T04:03:09.432Z' },
        { name: 'Wanted', source: 'story', duration: 'persistent' },
      ];
      const character = { level: 6, class: 'Ranger', multiclass: [{ class: 'Rogue', subclass: '', levels: 1 }], spell_slots: {}, conditions, active_modifiers: [], attuned_items: [], exhaustion_level: 0 };
      const session = { world_state: { active_concentration: { spell_name: 'Pass without Trace', concentration: true, expires_at: expiredAt } } };
      const truth = evaluateActiveEffects({ character, session, now });
      record('expired PWT condition and concentration are excluded from active effects', !truth.active.some((entry) => /pass without trace/i.test(entry.name)) && truth.expired.some((entry) => /pass without trace/i.test(entry.name)));
      record('near-duplicate persistent conditions normalize to stable canonical names', canonicalStoryConditionName('Protected by the Circle') === 'Protected by the Circle of the Reeds' && canonicalStoryConditionName('Blessed by the Reeds') === 'Blessed by the Circle of the Reeds' && normalizeStoryConditions(conditions).filter((entry) => /circle of the reeds/i.test(entry.name)).length === 2);
      const merged = normalizeStoryConditions(conditions).find((entry) => entry.name === 'Protected by the Circle of the Reeds');
      record('normalization keeps the earliest applied_at', merged?.applied_at === '2026-08-14T00:34:17.063Z');
      record('active effects show source mechanical effect and duration', truth.active.some((entry) => entry.name === 'Longstrider' && entry.source === 'story' && String(entry.mechanical_effect).includes('+10') && entry.remaining_duration === 'persistent'));
      record('spell slots are explicit per level max and used', JSON.stringify(truth.spell_slots) === JSON.stringify([{ level: 1, max: 4, used: 0, remaining: 4 }, { level: 2, max: 2, used: 0, remaining: 2 }]));
      record('hindrances classify from authoritative state', truth.hindrances.some((entry) => entry.name === 'Wanted'));

      const tag = `StatusTruthQA_${Date.now()}`;
      const c = await base44.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 6, multiclass: [{ class: 'Rogue', subclass: '', levels: 1 }], spell_slots: {}, conditions, active_modifiers: [], attuned_items: ['Ring of Protection'], is_active: false });
      fixtures.push(['Character', c.id]);
      const s = await base44.entities.GameSession.create({ character_id: c.id, title: tag, story_log: [{ request_id: `${tag}:seed`, text: 'The reeds whisper.', choices: [{ text: 'Watch' }] }], world_state: { active_concentration: { spell_name: 'Pass without Trace', concentration: true, expires_at: expiredAt } }, is_active: false });
      fixtures.push(['GameSession', s.id]);
      const ask = (question, requestId) => executeAskDungeonMasterCore(base44, { session_id: s.id, character_id: c.id, question, request_id: `${tag}:${requestId}` });
      const stateBefore = await hashValue([await base44.asServiceRole.entities.Character.get(c.id), await base44.asServiceRole.entities.GameSession.get(s.id)]);
      const buffs = await ask('What are my current buffs?', 'buffs');
      const hindering = await ask("What's hindering me?", 'hindering');
      const slots = await ask('How many spell slots do I have left?', 'slots');
      const spells = await ask('What active spells do I have?', 'spells');
      const attuned = await ask('What am I attuned to?', 'attuned');
      const stateAfter = await hashValue([await base44.asServiceRole.entities.Character.get(c.id), await base44.asServiceRole.entities.GameSession.get(s.id)]);
      record('buffs answer matches authoritative active effects exactly', buffs.body?.classification === 'established_fact' && /Longstrider/.test(buffs.body.answer) && /Protected by the Circle of the Reeds/.test(buffs.body.answer) && /Wanted/.test(buffs.body.answer) && !/Pass without Trace/i.test(buffs.body.answer));
      record('hindrance query answers from authoritative state', hindering.body?.classification === 'established_fact' && /Wanted/.test(hindering.body.answer) && !/Longstrider/.test(hindering.body.answer));
      record('spell slot query is explicit max and used per level', slots.body?.classification === 'established_fact' && /level 1: 4\/4 available \(0 used\)/i.test(slots.body.answer) && /level 2: 2\/2 available \(0 used\)/i.test(slots.body.answer));
      record('active spell query answers none without live concentration', /no active spell effects/i.test(spells.body.answer));
      record('attunement query answers authoritative attunements', attuned.body?.classification === 'established_fact' && /Ring of Protection/.test(attuned.body.answer));
      record('state queries are zero-write and leave choices unchanged', stateBefore === stateAfter);
    } finally {
      for (const [entity, id] of fixtures.reverse()) { try { await base44.asServiceRole.entities[entity].delete(id); } catch {} }
    }
    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('cleanup complete and protected live IDs unchanged', protectedBefore === protectedAfter);
    const passed = results.filter((item) => item.pass).length;
    const allPass = passed === results.length;
    return Response.json({ function_version: 'test-status-truth-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results }, { status: allPass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Status truth regression failed' }, { status: 500 });
  }
}