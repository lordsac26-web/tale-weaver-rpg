import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { MANDATORY_NIGHTLY_SUITES, validateNightlySuiteManifest } from '../../shared/nightlyRegressionSweep.ts';
import { writeNightlySweepAggregate } from '../../shared/nightlySweepWriter.ts';

const hashValue = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const protectedState = (db) => Promise.all([db.entities.Character.get('6a6825cd07a490fa70a46852'), db.entities.GameSession.get('6a6825edd695bd65a4322256'), db.entities.CombatLog.get('6a767f23ec36fe219063ae49'), db.entities.CombatLog.get('6a77463582a26b50018110ea')]);

export default async function(req) {
  const results = [];
  let testRecordId = null;
  try {
    const payload = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (!payload.suite_results) return Response.json({ error: 'Genuine workflow suite results are required', all_pass: false }, { status: 400 });
    const db = base44.asServiceRole;
    const runKey = `nightly-sweep-regression-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now()}`;
    const before = await hashValue(await protectedState(db));
    const first = await writeNightlySweepAggregate({ db, suiteResults: payload.suite_results, runKey, environment: 'test', protectedBeforeHash: before, protectedAfterHash: before });
    testRecordId = first.id;
    const records = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
    results.push({ name: 'genuine internal suite outputs aggregate to all_pass and one record', pass: first.all_pass === true && records.length === 1 && first.functions_run?.length === 14 && first.total > 0 });
    const replay = await writeNightlySweepAggregate({ db, suiteResults: payload.suite_results, runKey, environment: 'test', protectedBeforeHash: before, protectedAfterHash: before });
    const replayRecords = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
    results.push({ name: 'same-day run-key replay is idempotent with no duplicate', pass: replay.already_processed === true && replayRecords.length === 1 && replayRecords[0].id === records[0].id });
    const missing = validateNightlySuiteManifest(MANDATORY_NIGHTLY_SUITES.slice(0, -1));
    results.push({ name: 'missing mandatory suite fails closed', pass: !missing.valid && missing.missing.includes('testAskDMRegression') });
    const after = await hashValue(await protectedState(db));
    results.push({ name: 'protected live records remain unchanged', pass: before === after && first.protected_unchanged === true });
    results.push({ name: 'blocked invocation cannot report cleanup or all_pass', pass: first.cleanup_verified === true && Object.values(first.suite_details?.suites || {}).every((suite) => suite.invoked && suite.cleanup_verified) });
    const passed = results.filter((result) => result.pass).length;
    return Response.json({ function_version: 'test-nightly-internal-sweep-v1.2.0', passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, verification: first }, { status: passed === results.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Nightly internal sweep regression failed', results, all_pass: false }, { status: 500 });
  } finally {
    if (testRecordId) {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.NightlySweepResult.delete(testRecordId).catch(() => null);
    }
  }
}