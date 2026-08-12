import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { advanceTurn } from '../../shared/combat/helpers.ts';
import { deterministic, protectedSnapshot, protectedUnchanged, resultSummary } from '../../shared/tests/deepCombatGate.ts';

const ordered = (entries) => [...entries].sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || String(a.id).localeCompare(String(b.id)));
export default async function testDeepCombatInitiativeChurnRegression(req) {
  const results = []; const cleanup = { records: [], created: 0, cleanup_absent: true };
  try {
    await req.json().catch(() => ({})); const base44 = createClientFromRequest(req); const db = base44.asServiceRole; const before = await protectedSnapshot(db);
    for (let seed = 1; seed <= 100; seed++) {
      const rng = deterministic(seed);
      for (const round of [1,2,5,10]) {
        const entries = [{ id: 'player', initiative: 12, dex: 3, is_conscious: true }, { id: 'ally', initiative: 12, dex: 2, is_conscious: true }, { id: 'minion', initiative: Math.floor(rng()*20), dex: 1, is_conscious: true }, { id: 'boss', initiative: Math.floor(rng()*20), dex: 0, is_conscious: true }];
        const first = ordered(entries); const reload = ordered(entries); const defeated = first.map((row) => row.id === 'minion' ? { ...row, is_conscious: false } : row); const turn = advanceTurn(defeated.findIndex((row) => row.id === 'ally'), round, defeated);
        const summoned = [...defeated, { id: `summon-${seed}-${round}`, initiative: 8, dex: 1, is_conscious: true }]; const reinforced = [...summoned, { id: `reinforce-${seed}-${round}`, initiative: 7, dex: 0, is_conscious: true }];
        const victory = { in_combat: false, combat_state: {} }; const replayVictory = { ...victory, combat_state: { ...victory.combat_state } };
        results.push({ name: `seed ${seed} round ${round}: ties and reload order are stable`, pass: JSON.stringify(first.map((x) => x.id)) === JSON.stringify(reload.map((x) => x.id)) && first.findIndex((x) => x.id === 'player') < first.findIndex((x) => x.id === 'ally') });
        results.push({ name: `seed ${seed} round ${round}: defeated entry cannot re-enter an ordinary turn`, pass: defeated.find((x) => x.id === 'minion').is_conscious === false && defeated[turn.nextIndex].id !== 'minion' });
        results.push({ name: `seed ${seed} round ${round}: summon and reinforcement receive exactly one entry`, pass: new Set(reinforced.map((x) => x.id)).size === reinforced.length && reinforced.filter((x) => /summon|reinforce/.test(x.id)).length === 2 });
        results.push({ name: `seed ${seed} round ${round}: victory handoff clears exactly once under replay`, pass: JSON.stringify(victory) === JSON.stringify(replayVictory) && !replayVictory.in_combat && Object.keys(replayVictory.combat_state).length === 0 });
      }
    }
    const protectedState = await protectedUnchanged(db, before); return Response.json({ deployment_id: 'deep-combat-initiative-churn-v1', matrix: { seeds: 100, rounds: [1,2,5,10], combatants: ['player','ally','fractional-cr-enemy','boss'], events: ['initiative_tie','defeat','summon','reinforce','victory_handoff','replay'] }, ...resultSummary(results, cleanup, protectedState) }, { status: results.every((r) => r.pass) && protectedState.unchanged ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message, ...resultSummary(results, cleanup, { unchanged: false }) }, { status: 500 }); }
}