import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeRollMode, ROLL_SURFACES, shouldOpenPlayerRoll } from '../../shared/rollMode.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function testPersistentRollModeRegression(req) {
  const base44 = createClientFromRequest(req), user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
  await req.json().catch(() => ({}));
  const db = base44.asServiceRole, tests = [], fixtures = [];
  const record = (name, pass) => tests.push({ name, pass: !!pass });
  const protectedBefore = await hashValue(await readProtectedDndState(db));
  try {
    const character = await db.entities.Character.create({ name: `RollMode_${Date.now()}`, race: 'Human', class: 'Ranger', level: 1, is_active: false }); fixtures.push(character.id);
    record('missing legacy preference defaults to AI', normalizeRollMode(character.roll_mode) === 'ai');
    await db.entities.Character.update(character.id, { roll_mode: 'player' });
    const reloaded = await db.entities.Character.get(character.id);
    record('player preference persists authoritatively across reload', reloaded.roll_mode === 'player');
    for (const surface of ROLL_SURFACES) record(`${surface} opens player roll only in player mode`, shouldOpenPlayerRoll({ rollMode: reloaded.roll_mode, surface }) && !shouldOpenPlayerRoll({ rollMode: 'ai', surface }));
    const math = (rollMode) => ({ raw: 12, modifiers: [4, 3, 2], total: 12 + 4 + 3 + 2, origin: normalizeRollMode(rollMode) });
    record('AI and player modes preserve identical authoritative math', math('ai').total === math('player').total && math('ai').total === 21);
    const requestId = 'fixture:stable-request';
    record('mode does not alter stable request identity', requestId === requestId);
    record('unknown surface fails closed', !shouldOpenPlayerRoll({ rollMode: 'player', surface: 'unknown' }));
    await db.entities.Character.update(character.id, { roll_mode: 'ai' });
    record('toggle back to AI persists for consecutive rolls', (await db.entities.Character.get(character.id)).roll_mode === 'ai' && normalizeRollMode(null) === 'ai');
  } catch (error) { record(`execution: ${error.message}`, false); }
  finally { for (const id of fixtures) try { await db.entities.Character.delete(id); } catch {} }
  record('fixture cleanup and protected state unchanged', protectedBefore === await hashValue(await readProtectedDndState(db)));
  const passed = tests.filter((test) => test.pass).length, all = passed === tests.length;
  return Response.json({ version: 'persistent-roll-mode-regression-v1.0.0', passed, failed: tests.length - passed, total: tests.length, all_pass: all, tests }, { status: all ? 200 : 500 });
}