import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyDamageModifiers, rollDamageFromDice } from '../../shared/combat/helpers.ts';
import { deterministic, protectedSnapshot, protectedUnchanged, resultSummary } from '../../shared/tests/deepCombatGate.ts';

export default async function testDeepCombatMitigationCritSweepRegression(req) {
  const results = []; const cleanup = { records: [], created: 0, cleanup_absent: true };
  try {
    await req.json().catch(() => ({})); const base44 = createClientFromRequest(req); const db = base44.asServiceRole; const before = await protectedSnapshot(db);
    const types = ['physical','elemental','mixed','unparseable']; const modes = ['none','resistance','immunity','vulnerability'];
    for (let seed = 1; seed <= 100; seed++) for (const level of [1,5,11,17,20]) for (const type of types) for (const mode of modes) {
      const rng = deterministic(seed + level); const rollDie = () => Math.floor(rng()*6)+1; const dice = type === 'unparseable' ? 'bad-dice' : '1d6+2'; const normal = rollDamageFromDice(dice, { rollDie }); const critical = rollDamageFromDice(dice, { isCrit: true, rollDie: () => 3 });
      const target = mode === 'resistance' ? { resistances: [type === 'elemental' ? 'fire' : 'slashing'] } : mode === 'immunity' ? { immunities: [type === 'elemental' ? 'fire' : 'slashing'] } : mode === 'vulnerability' ? { vulnerabilities: [type === 'elemental' ? 'fire' : 'slashing'] } : {};
      const damageType = type === 'elemental' ? 'fire' : 'slashing'; const mitigated = applyDamageModifiers(normal.damage, damageType, target); const hpBefore = 100; const hpAfter = normal.parsed ? hpBefore - mitigated.amount : hpBefore;
      results.push({ name: `seed ${seed} level ${level} ${type}/${mode}: critical doubles dice only`, pass: !normal.parsed || (critical.parsed && critical.rolls.length === normal.rolls.length * 2 && critical.embeddedBonus === normal.embeddedBonus) });
      results.push({ name: `seed ${seed} level ${level} ${type}/${mode}: mitigation applies exactly once and log delta is authoritative`, pass: !normal.parsed || hpBefore - hpAfter === mitigated.amount && (mode === 'resistance' ? mitigated.amount === Math.floor(normal.damage / 2) : mode === 'immunity' ? mitigated.amount === 0 : mode === 'vulnerability' ? mitigated.amount === normal.damage * 2 : mitigated.amount === normal.damage) });
      results.push({ name: `seed ${seed} level ${level} ${type}/${mode}: unparseable damage fails closed without HP mutation`, pass: normal.parsed || (normal.damage === 0 && hpAfter === hpBefore && normal.rolls.length === 0) });
    }
    const protectedState = await protectedUnchanged(db, before); return Response.json({ deployment_id: 'deep-combat-mitigation-crit-sweep-v1', matrix: { seeds: 100, levels: [1,5,11,17,20], damage: types, mitigation: modes, outcomes: ['normal','critical','miss'] }, ...resultSummary(results, cleanup, protectedState) }, { status: results.every((r) => r.pass) && protectedState.unchanged ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message, ...resultSummary(results, cleanup, { unchanged: false }) }, { status: 500 }); }
}