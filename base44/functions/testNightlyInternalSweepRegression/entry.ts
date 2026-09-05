import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { executeNightlyRegressionSweep, MANDATORY_NIGHTLY_SUITES, PROTECTED_NIGHTLY_IDS, validateNightlySuiteManifest } from '../../shared/nightlyRegressionSweep.ts';

const hashValue = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const readProtected = async (db) => Promise.all([
  db.entities.Character.get(PROTECTED_NIGHTLY_IDS.Character[0]),
  db.entities.GameSession.get(PROTECTED_NIGHTLY_IDS.GameSession[0]),
  ...PROTECTED_NIGHTLY_IDS.CombatLog.map((id) => db.entities.CombatLog.get(id)),
]);

export default async function(req) {
  const results = [];
  let testRecordId = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const db = base44.asServiceRole;
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const runKey = `nightly-sweep-regression-${date}-${Date.now()}`;
    const before = await hashValue(await readProtected(db));
    const first = await executeNightlyRegressionSweep({ base44, runKey, environment: 'test' });
    testRecordId = first.id;
    const afterFirstRecords = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
    results.push({ name: 'orchestrator on-demand returns all_pass and writes one aggregate', pass: first.all_pass === true && afterFirstRecords.length === 1 && first.functions_run?.length === 14 });
    const replay = await executeNightlyRegressionSweep({ base44, runKey, environment: 'test' });
    const afterReplayRecords = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
    results.push({ name: 'same-day run-key replay is idempotent with no duplicate', pass: replay.already_processed === true && afterReplayRecords.length === 1 && afterReplayRecords[0].id === afterFirstRecords[0].id });
    const missing = validateNightlySuiteManifest(MANDATORY_NIGHTLY_SUITES.slice(0, -1));
    results.push({ name: 'missing mandatory suite fails closed before execution', pass: !missing.valid && missing.missing.includes('testAskDMRegression') });
    const after = await hashValue(await readProtected(db));
    results.push({ name: 'protected live Character Session and CombatLogs remain unchanged', pass: before === after && first.protected_unchanged === true });
    results.push({ name: 'all disposable suite fixtures are cleanup verified', pass: first.cleanup_verified === true && first.suite_details?.disposable_residue?.length === 0 });
    const passed = results.filter((result) => result.pass).length;
    return Response.json({ function_version: 'test-nightly-internal-sweep-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, verification: first }, { status: passed === results.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Nightly internal sweep regression failed', results, all_pass: false }, { status: 500 });
  } finally {
    if (testRecordId) {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.NightlySweepResult.delete(testRecordId).catch(() => null);
    }
  }
}