import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deriveConditionBadges, isPassWithoutTraceIdentity } from '../../shared/spells/conditionIdentity.js';
import { executeUtilitySpellCast } from '../../shared/spells/castUtilitySpell.ts';
import { PWT_REPAIR_CONTRACT, repairDuplicatePwtCondition } from '../../shared/repairs/duplicatePwtConditionRepair.ts';

const LIVE_IDS = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const legacy = { name: 'Pass Without Trace', source: 'story', duration: 'scene', applied_at: PWT_REPAIR_CONTRACT.legacyAppliedAt };
const canonical = (id) => ({ id: PWT_REPAIR_CONTRACT.canonicalConditionId, name: 'pass without trace', display_name: 'Pass Without Trace', source: 'Pass without Trace', target_id: id, caster_id: id, applied_at: '2026-08-10T01:10:46.874Z', duration_type: 'timestamp', expires_at: '2026-08-10T02:10:46.874Z', concentration: true, metadata: {} });
const modifier = (id) => ({ id: PWT_REPAIR_CONTRACT.canonicalModifierId, source: 'Pass without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, concentration: true, character_id: id, target_id: id, caster_id: id, applied_at: '2026-08-10T01:10:46.874Z', expires_at: '2026-08-10T02:10:46.874Z' });

export default async function testPassWithoutTraceBadgeDedupRegression(req) {
  const fixtures = []; const cleanup = []; const results = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me(); await req.json().catch(() => ({}));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const liveBefore = await Promise.all(LIVE_IDS.map((id, index) => base44.asServiceRole.entities[index ? 'GameSession' : 'Character'].get(id)));
    const liveHash = await hash(liveBefore);
    const token = `PwtBadgeQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const make = async (label, override = {}) => {
      const character = await base44.entities.Character.create({ name: `${token}_${label}`, race: 'Human', class: 'Ranger', level: 5, wisdom: 16, hp_max: 30, hp_current: 30, spell_slots: {}, spells_known: ['Pass without Trace'], spells_prepared: ['Pass without Trace'], conditions: [], active_modifiers: [], long_rest_abilities: {}, inventory: [], is_active: false, ...override });
      const c = canonical(character.id); const m = modifier(character.id);
      await base44.asServiceRole.entities.Character.update(character.id, { conditions: override.conditions || [{ name: 'Alert' }, legacy, c], active_modifiers: override.active_modifiers || [m] });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: `${token}_${label}`, story_log: [], world_state: { active_concentration: { spell_name: 'Pass without Trace', character_id: character.id, target_id: character.id, caster_id: character.id, concentration: true, expires_at: c.expires_at, request_id: `${token}:prior` } }, is_active: false });
      fixtures.push({ character: character.id, session: session.id }); return { character: await base44.asServiceRole.entities.Character.get(character.id), session };
    };
    const synthetic = canonical('fixture');
    const badges = deriveConditionBadges([{ name: 'Alert' }, legacy, synthetic], [modifier('fixture')]);
    results.push({ name: 'legacy plus canonical condition and modifier derive one PWT badge', pass: badges.filter(isPassWithoutTraceIdentity).length === 1 });
    results.push({ name: 'case punctuation and whitespace aliases collapse', pass: deriveConditionBadges([{ name: 'Pass-Without   Trace' }, { name: 'pass without trace' }], []).length === 1 });
    results.push({ name: 'structured canonical condition wins preference', pass: badges.find(isPassWithoutTraceIdentity)?.id === PWT_REPAIR_CONTRACT.canonicalConditionId });
    results.push({ name: 'unrelated conditions remain distinct', pass: badges.some((entry) => entry.name === 'Alert') && badges.length === 2 });
    const valid = await make('valid'); const scope = { characterId: valid.character.id, sessionId: valid.session.id };
    results.push({ name: 'fixture begins with exactly one canonical plus10 modifier', pass: valid.character.active_modifiers.filter(isPassWithoutTraceIdentity).length === 1 && Number(valid.character.active_modifiers[0].bonus) === 10 });
    const cast = await executeUtilitySpellCast({ base44, user, payload: { character_id: valid.character.id, session_id: valid.session.id, action_text: 'cast Pass without Trace on myself', request_id: `${token}:recast` } });
    const afterCast = await base44.asServiceRole.entities.Character.get(valid.character.id);
    results.push({ name: 'authoritative active concentration recast returns already active without stacking', pass: cast.status === 200 && cast.body?.already_active === true && afterCast.active_modifiers.filter(isPassWithoutTraceIdentity).length === 1 && afterCast.conditions.filter(isPassWithoutTraceIdentity).length === 2 && afterCast.spell_slots?.level_2 === undefined });
    const wrong = await make('wrong-link');
    const wrongResult = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope: { characterId: valid.character.id, sessionId: wrong.session.id }, requestId: `${token}:wrong`, mode: 'apply' });
    results.push({ name: 'wrong linkage rejects with zero writes', pass: wrongResult.status === 409 && wrongResult.body.writes === 0 });
    const ambiguous = await make('ambiguous');
    await base44.asServiceRole.entities.Character.update(ambiguous.character.id, { conditions: [{ name: 'Alert' }, legacy, canonical(ambiguous.character.id), canonical(ambiguous.character.id)] });
    const ambiguousResult = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope: { characterId: ambiguous.character.id, sessionId: ambiguous.session.id }, requestId: `${token}:ambiguous`, mode: 'apply' });
    results.push({ name: 'ambiguous canonical duplicates reject with zero writes', pass: ambiguousResult.status === 409 && ambiguousResult.body.writes === 0 });
    const dryRun = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'dry_run' });
    const applied = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply' });
    const repaired = await base44.asServiceRole.entities.Character.get(valid.character.id);
    results.push({ name: 'dry run writes zero and apply removes only legacy story residue', pass: dryRun.status === 200 && dryRun.body.writes === 0 && applied.status === 200 && applied.body.writes === 1 && repaired.conditions.length === 2 && repaired.conditions[0].name === 'Alert' && repaired.conditions.filter(isPassWithoutTraceIdentity).length === 1 && repaired.conditions.find(isPassWithoutTraceIdentity)?.id === PWT_REPAIR_CONTRACT.canonicalConditionId });
    const replay = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply' });
    results.push({ name: 'request replay is state-idempotent with zero writes', pass: replay.status === 200 && replay.body.already_processed === true && replay.body.writes === 0 });
    const liveAfter = await Promise.all(LIVE_IDS.map((id, index) => base44.asServiceRole.entities[index ? 'GameSession' : 'Character'].get(id)));
    results.push({ name: 'protected live Character and GameSession remain unchanged', pass: liveHash === await hash(liveAfter) });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false, verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const passed = results.filter((result) => result.pass).length; const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); const allPass = passed === results.length && cleanupPassed;
  return Response.json({ deployment_id: 'pwt-badge-dedup-repair-v1', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_passed: cleanupPassed, live_state: { protected_ids: LIVE_IDS, unchanged: results.some((result) => result.name.startsWith('protected live') && result.pass) } }, { status: allPass ? 200 : 500 });
}