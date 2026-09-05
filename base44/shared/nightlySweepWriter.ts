import { MANDATORY_NIGHTLY_SUITES, NIGHTLY_SWEEP_VERSION, validateNightlySuiteManifest } from './nightlyRegressionSweep.ts';

const THRESHOLDS = { testLongRestRegression: 26, testTypedUtilitySpellRegression: 19, testAskDMRegression: 9 };

const dateKey = () => `nightly-sweep-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
const cleanupOk = (data) => {
  if (!data || data.cleanup_passed === false || data.cleanup_verified === false) return false;
  if (Array.isArray(data.cleanup) && data.cleanup.length) return data.cleanup.every((item) => item?.verified_absent !== false);
  return true;
};
const zeroWritesOk = (name, data) => {
  if (name !== 'testAskDMRegression') return true;
  const counts = Object.values(data?.zero_write_entity_counts || {});
  const snapshots = data?.snapshots || {};
  return counts.length > 0 && counts.every((value) => Number(value) === 0) && snapshots.story_before === snapshots.story_after && snapshots.combat_before === snapshots.combat_after && snapshots.updated_dates_unchanged === true;
};
const protectedClaimOk = (data) => data?.live_state?.read_or_mutated !== true && data?.protected_state?.read_or_mutated !== true && data?.protected_live_state?.read_or_mutated !== true;

export function summarizeNightlySuites(suiteResults) {
  const names = Object.keys(suiteResults || {});
  const manifest = validateNightlySuiteManifest(names);
  const suites = {};
  let passed = 0;
  let failed = 0;
  let total = 0;
  for (const name of MANDATORY_NIGHTLY_SUITES) {
    const data = suiteResults?.[name];
    const suitePassed = Number(data?.passed || 0);
    const suiteFailed = Number(data?.failed ?? Math.max(0, Number(data?.total || 0) - suitePassed));
    const suiteTotal = Number(data?.total || suitePassed + suiteFailed);
    const minimum = THRESHOLDS[name] || 1;
    const cleanup = cleanupOk(data);
    const zeroWrites = zeroWritesOk(name, data);
    const protectedSafe = protectedClaimOk(data);
    const invoked = !!data && !data.error && suiteTotal > 0;
    const ok = invoked && data.all_pass === true && suiteFailed === 0 && suiteTotal >= minimum && cleanup && zeroWrites && protectedSafe;
    passed += suitePassed;
    failed += suiteFailed + (!ok && suiteFailed === 0 ? 1 : 0);
    total += suiteTotal + (!ok && suiteFailed === 0 ? 1 : 0);
    suites[name] = { status: ok ? 'passed' : 'failed', invoked, passed: suitePassed, failed: suiteFailed, total: suiteTotal, minimum_total: minimum, all_pass: data?.all_pass === true, cleanup_verified: cleanup, zero_semantic_writes: zeroWrites, protected_safe: protectedSafe, ...(data?.error ? { error: String(data.error) } : {}) };
  }
  const cleanupVerified = manifest.valid && Object.values(suites).every((suite) => suite.invoked && suite.cleanup_verified);
  const protectedUnchanged = manifest.valid && Object.values(suites).every((suite) => suite.protected_safe);
  const allPass = manifest.valid && cleanupVerified && protectedUnchanged && Object.values(suites).every((suite) => suite.status === 'passed');
  return { manifest, suites, passed, failed, total, cleanup_verified: cleanupVerified, protected_unchanged: protectedUnchanged, all_pass: allPass };
}

export async function writeNightlySweepAggregate({ db, suiteResults, runKey, environment = 'production', startedAt, protectedBeforeHash = null, protectedAfterHash = null }) {
  const key = runKey || dateKey();
  const existing = await db.entities.NightlySweepResult.filter({ run_key: key }, '-created_date', 10);
  if (existing.length) return { ...existing[0], already_processed: true, sweep_version: NIGHTLY_SWEEP_VERSION };
  const summary = summarizeNightlySuites(suiteResults);
  const started = startedAt || new Date().toISOString();
  const completed = new Date().toISOString();
  const protectedUnchanged = summary.protected_unchanged && (!protectedBeforeHash || !protectedAfterHash || protectedBeforeHash === protectedAfterHash);
  const allPass = summary.all_pass && protectedUnchanged;
  const aggregate = {
    run_key: key,
    started_at: started,
    completed_at: completed,
    status: allPass ? 'passed' : 'failed',
    functions_run: Object.keys(suiteResults || {}),
    passed: summary.passed,
    failed: summary.failed,
    total: summary.total,
    all_pass: allPass,
    suite_details: { suites: summary.suites, manifest: summary.manifest, protected_before_hash: protectedBeforeHash, protected_after_hash: protectedAfterHash, sweep_version: NIGHTLY_SWEEP_VERSION },
    cleanup_verified: summary.cleanup_verified,
    protected_unchanged: protectedUnchanged,
    environment,
    notes: allPass ? 'All mandatory internal workflow suites passed.' : 'Missing, blocked, or failing suites caused a fail-closed result.',
  };
  try {
    const record = await db.entities.NightlySweepResult.create(aggregate);
    return { ...record, already_processed: false, sweep_version: NIGHTLY_SWEEP_VERSION };
  } catch (error) {
    const raced = await db.entities.NightlySweepResult.filter({ run_key: key }, '-created_date', 10);
    if (raced.length) return { ...raced[0], already_processed: true, sweep_version: NIGHTLY_SWEEP_VERSION };
    throw error;
  }
}