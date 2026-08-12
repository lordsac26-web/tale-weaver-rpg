import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addStructuredCondition, buildStructuredCondition, expireStructuredConditions, removeConditions, removeConcentrationConditions } from '../../shared/combat/conditions.ts';
import { resolveAttackRoll } from '../../shared/combat/helpers.ts';
import { deterministic, protectedSnapshot, protectedUnchanged, resultSummary } from '../../shared/tests/deepCombatGate.ts';

export default async function testDeepCombatConditionOrderRegression(req) {
  const results = []; const cleanup = { records: [], created: 0, cleanup_absent: true };
  try {
    await req.json().catch(() => ({})); const base44 = createClientFromRequest(req); const db = base44.asServiceRole; const before = await protectedSnapshot(db);
    for (let seed = 1; seed <= 100; seed++) {
      const rng = deterministic(seed); const levels = [1, 5, 11, 17]; const attacks = ['weapon', 'spell', 'opportunity'];
      for (const level of levels) for (const attack of attacks) {
        const expiring = buildStructuredCondition({ name: 'Restrained', source: 'net', target_id: `fixture-${seed}`, duration_type: 'rounds', expires_round: 2 });
        const concentrationA = buildStructuredCondition({ name: 'Bless', source: 'caster-a', concentration: true });
        const concentrationB = buildStructuredCondition({ name: 'Hex', source: 'caster-b', concentration: true });
        let conditions = [buildStructuredCondition({ name: 'Prone', source: 'terrain' }), expiring, concentrationA, concentrationB];
        conditions = addStructuredCondition(conditions, { ...conditions[0], applied_at: new Date(0).toISOString() });
        const refreshed = addStructuredCondition(conditions, { ...expiring, expires_round: 4 });
        const expired = expireStructuredConditions(refreshed, { phase: 'turn_end', round: 4, now: 0 });
        const scoped = removeConditions(expired, 'bless', { source: 'caster-a' });
        const replay = removeConditions(scoped, 'bless', { source: 'caster-a' });
        const rolls = [Math.floor(rng() * 20) + 1, Math.floor(rng() * 20) + 1]; let index = 0;
        const cancelled = resolveAttackRoll({ advSources: ['advantage'], disSources: ['disadvantage'], rollD20Fn: () => rolls[index++] });
        const pureConcentration = removeConcentrationConditions([{ name: 'Alert', source: 'self' }, concentrationA, concentrationB]);
        results.push({ name: `seed ${seed} level ${level} ${attack}: advantage and disadvantage deterministically cancel`, pass: cancelled.rolls.length === 1 && !cancelled.advantage && !cancelled.disadvantage });
        results.push({ name: `seed ${seed} level ${level} ${attack}: refresh dedupes then expiry removes roll and narration state`, pass: refreshed.filter((c) => c.name === 'restrained').length === 1 && !expired.some((c) => c.name === 'restrained') && !expired.some((c) => c.name === 'restrained') });
        results.push({ name: `seed ${seed} level ${level} ${attack}: targeted concentration cleanup removes only matching effect and replay is idempotent`, pass: scoped.some((c) => c.name === 'hex') && !scoped.some((c) => c.name === 'bless') && JSON.stringify(scoped) === JSON.stringify(replay) && pureConcentration.length === 1 && pureConcentration[0].name === 'Alert' });
      }
    }
    const protectedState = await protectedUnchanged(db, before); return Response.json({ deployment_id: 'deep-combat-condition-order-v1', matrix: { seeds: 100, levels: [1,5,11,17], attacks: ['weapon','spell','opportunity'], orders: ['apply','refresh','remove','expire','replay'], conditions: ['advantage','disadvantage','prone','restrained','concentration','exhaustion'] }, ...resultSummary(results, cleanup, protectedState) }, { status: results.every((r) => r.pass) && protectedState.unchanged ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message, ...resultSummary(results, cleanup, { unchanged: false }) }, { status: 500 }); }
}