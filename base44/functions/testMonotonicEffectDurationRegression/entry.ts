import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { evaluateEffectDuration, withGameTimeDuration } from '../../shared/effectDuration.ts';
import { evaluateActiveEffects } from '../../shared/story/activeEffects.ts';
import { resolveAuthoritativeSkillModifier } from '../../shared/skills/authoritativeSkillModifier.ts';
import { advanceWorldClockBySeconds } from '../../shared/story/worldClock.ts';
import { consumeBreakOnAttackConditions } from '../../shared/combat/conditions.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function testMonotonicEffectDurationRegression(req) {
  const base44 = createClientFromRequest(req), user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
  await req.json().catch(() => ({}));
  const tests = [], record = (name, pass) => tests.push({ name, pass: !!pass }), protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const id = 'fixture-character', baseSession = { character_id: id, world_state: { elapsed_game_seconds: 1000 } };
  const modern = withGameTimeDuration({ name: 'Pass without Trace', source: 'Pass without Trace', duration: 'Up to 1 hour', concentration: true }, baseSession, 'Pass without Trace');
  record('overnight wall-clock pause with zero game time preserves PWT', !evaluateEffectDuration({ entry: { ...modern, expires_at: '2020-01-01T00:00:00Z' }, session: baseSession, name: 'Pass without Trace' }).expired);
  record('59 game minutes remains active', !evaluateEffectDuration({ entry: modern, session: { ...baseSession, world_state: { elapsed_game_seconds: 4540 } }, name: 'Pass without Trace' }).expired);
  record('60 game minutes expires exactly', evaluateEffectDuration({ entry: modern, session: { ...baseSession, world_state: { elapsed_game_seconds: 4600 } }, name: 'Pass without Trace' }).expired);
  const sixSeconds = advanceWorldClockBySeconds({ worldState: baseSession.world_state, elapsedSeconds: 6, source: 'combat_round' });
  record('one combat round advances exactly six game seconds', sixSeconds.elapsed_game_seconds === 1006 && sixSeconds.__combat_time_receipts.at(-1).elapsed_seconds === 6);
  const legacy = { name: 'Pass without Trace', source: 'Pass without Trace', applied_at: '2026-09-13T06:26:29Z', expires_at: '2026-09-13T07:26:29Z', concentration: true };
  const legacyResult = evaluateEffectDuration({ entry: legacy, session: baseSession, name: 'Pass without Trace' });
  record('legacy timestamp-only PWT is conservatively active and provenance-tagged', !legacyResult.expired && /legacy_timestamp/.test(legacyResult.migration_provenance || ''));
  const condition = { ...modern, id: 'pwt-condition', target_id: id, caster_id: id, break_on_attack: null };
  const modifier = { ...modern, id: 'pwt-modifier', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, target_id: id, caster_id: id };
  const concentration = { ...modern, spell_name: 'Pass without Trace', character_id: id, target_id: id, caster_id: id };
  const character = { id, dexterity: 18, proficiency_bonus: 3, skills: { Stealth: 'proficient' }, conditions: [condition], active_modifiers: [modifier] };
  const session = { ...baseSession, world_state: { ...baseSession.world_state, active_concentration: concentration } };
  const breakdown = resolveAuthoritativeSkillModifier({ character, session, skill: 'Stealth' });
  record('active PWT produces base plus7 plus10 total17', breakdown.ok && breakdown.base_skill === 7 && breakdown.effect_bonus === 10 && breakdown.total === 17);
  record('story Stealth d20 two reaches corrected total19 against DC17', 2 + breakdown.total === 19 && 19 >= 17);
  record('status truth agrees PWT is active', evaluateActiveEffects({ character, session }).active.some((entry) => /pass without trace/i.test(entry.name)));
  record('attacks do not break PWT', consumeBreakOnAttackConditions([condition]).some((entry) => entry.id === condition.id));
  record('replacement or failed concentration save ends PWT', evaluateEffectDuration({ entry: { ...concentration, broken: true }, session, name: 'Pass without Trace' }).expired);
  record('wrong session linkage rejects modifier resolution', !resolveAuthoritativeSkillModifier({ character, session: { ...session, character_id: 'wrong' }, skill: 'Stealth' }).ok);
  record('protected state unchanged and no fixtures require cleanup', protectedBefore === await hashValue(await readProtectedDndState(base44.asServiceRole)));
  const passed = tests.filter((test) => test.pass).length, all = passed === tests.length;
  return Response.json({ version: 'monotonic-effect-duration-regression-v1.0.0', passed, failed: tests.length - passed, total: tests.length, all_pass: all, tests, writes: 0 }, { status: all ? 200 : 500 });
}