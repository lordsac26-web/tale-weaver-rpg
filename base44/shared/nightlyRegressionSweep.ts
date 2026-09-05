export const NIGHTLY_SWEEP_VERSION = 'nightly-internal-sweep-v1.0.0';

export const MANDATORY_NIGHTLY_SUITES = [
  'testLongRestRegression',
  'testNarrativeContinuityRegression',
  'testVictoryHandoffRegression',
  'runP1SpellConditionRegression',
  'testScoutRegression',
  'testTypedUtilitySpellRegression',
  'testArrowRecoveryRegression',
  'testStorySessionSyncRegression',
  'testSkeletonEnemyTurnRegression',
  'testHuntersMarkRegression',
  'testItemRecoveryRegression',
  'testContentDetailRegression',
  'testVendorEconomyRegression',
  'testAskDMRegression',
];

export const PROTECTED_NIGHTLY_IDS = {
  Character: ['6a6825cd07a490fa70a46852'],
  GameSession: ['6a6825edd695bd65a4322256'],
  CombatLog: ['6a767f23ec36fe219063ae49', '6a77463582a26b50018110ea'],
};

const THRESHOLDS = { testLongRestRegression: 26, testTypedUtilitySpellRegression: 19, testAskDMRegression: 9 };
const QA_MARKER = /(?:LongRestQA|NarrativeContinuityQA|VictoryHandoffQA|P1QA_|SkeletonQA_|HuntersMarkQA_|ArrowRecoveryQA|StorySyncQA|ItemRecoveryQA|TypedUtilityQA|VendorQA_|AskDMQA_)/;

const hashValue = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const dateKey = (date = new Date()) => `nightly-sweep-${date.toISOString().slice(0, 10).replaceAll('-', '')}`;
const responseData = (value) => value?.data ?? value?.body ?? value;
const cleanupPassed = (data) => {
  if (data?.cleanup_verified === false || data?.cleanup_passed === false) return false;
  if (Array.isArray(data?.cleanup) && data.cleanup.length) return data.cleanup.every((item) => item?.verified_absent !== false);
  return true;
};
const zeroWritePassed = (name, data) => {
  if (name !== 'testAskDMRegression') return true;
  const counts = Object.values(data?.zero_write_entity_counts || {});
  const snapshots = data?.snapshots || {};
  return counts.length > 0 && counts.every((count) => Number(count) === 0) && snapshots.story_before === snapshots.story_after && snapshots.combat_before === snapshots.combat_after && snapshots.updated_dates_unchanged === true;
};

export function validateNightlySuiteManifest(names) {
  const supplied = Array.isArray(names) ? names : [];
  const missing = MANDATORY_NIGHTLY_SUITES.filter((name) => !supplied.includes(name));
  const unexpected = supplied.filter((name) => !MANDATORY_NIGHTLY_SUITES.includes(name));
  const duplicate = supplied.filter((name, index) => supplied.indexOf(name) !== index);
  return { valid: supplied.length === MANDATORY_NIGHTLY_SUITES.length && missing.length === 0 && unexpected.length === 0 && duplicate.length === 0, missing, unexpected, duplicate };
}

async function readProtected(db) {
  const records = {};
  for (const [entity, ids] of Object.entries(PROTECTED_NIGHTLY_IDS)) {
    records[entity] = [];
    for (const id of ids) records[entity].push(await db.entities[entity].get(id).catch(() => null));
  }
  return { hash: await hashValue(records), records_present: Object.fromEntries(Object.entries(records).map(([entity, values]) => [entity, values.map(Boolean)])) };
}

async function findDisposableResidue(db, startedAt) {
  const [characters, sessions, combats, notes, rolls, vendors] = await Promise.all([
    db.entities.Character.filter({ created_date: { $gte: startedAt } }, '-created_date', 500),
    db.entities.GameSession.filter({ created_date: { $gte: startedAt } }, '-created_date', 500),
    db.entities.CombatLog.filter({ created_date: { $gte: startedAt } }, '-created_date', 500),
    db.entities.PlayerNote.filter({ created_date: { $gte: startedAt } }, '-created_date', 500),
    db.entities.RollRecord.filter({ created_date: { $gte: startedAt }, roll_type: 'fixture' }, '-created_date', 500),
    db.entities.Vendor.filter({ created_date: { $gte: startedAt } }, '-created_date', 500),
  ]);
  const residue = [
    ...characters.filter((item) => QA_MARKER.test(String(item.name || ''))).map((item) => ({ entity: 'Character', id: item.id })),
    ...sessions.filter((item) => QA_MARKER.test(String(item.title || ''))).map((item) => ({ entity: 'GameSession', id: item.id })),
    ...combats.filter((item) => QA_MARKER.test(String(item.character_name || ''))).map((item) => ({ entity: 'CombatLog', id: item.id })),
    ...notes.filter((item) => QA_MARKER.test(String(item.title || ''))).map((item) => ({ entity: 'PlayerNote', id: item.id })),
    ...rolls.map((item) => ({ entity: 'RollRecord', id: item.id })),
    ...vendors.filter((item) => QA_MARKER.test(String(item.name || ''))).map((item) => ({ entity: 'Vendor', id: item.id })),
  ];
  return residue;
}

async function persistExactlyOnce(db, runKey, aggregate) {
  const existing = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
  if (existing.length) return { record: existing[0], already_processed: true };
  try {
    return { record: await db.entities.NightlySweepResult.create(aggregate), already_processed: false };
  } catch (error) {
    const raced = await db.entities.NightlySweepResult.filter({ run_key: runKey }, '-created_date', 10);
    if (raced.length) return { record: raced[0], already_processed: true };
    throw error;
  }
}

export async function executeNightlyRegressionSweep({ base44, runKey, environment = 'production', suiteNames = MANDATORY_NIGHTLY_SUITES }) {
  const db = base44.asServiceRole;
  const key = runKey || dateKey();
  const existing = await db.entities.NightlySweepResult.filter({ run_key: key }, '-created_date', 10);
  if (existing.length) return { ...existing[0], already_processed: true, sweep_version: NIGHTLY_SWEEP_VERSION };
  const manifest = validateNightlySuiteManifest(suiteNames);
  if (!manifest.valid) return { status: 'failed', all_pass: false, failed_closed: true, error: 'mandatory_suite_manifest_invalid', manifest, writes: 0, run_key: key, sweep_version: NIGHTLY_SWEEP_VERSION };

  const startedAt = new Date().toISOString();
  const protectedBefore = await readProtected(db);
  const details = {};
  let passed = 0;
  let failed = 0;
  let total = 0;

  for (const name of suiteNames) {
    const suiteStarted = new Date().toISOString();
    try {
      const invocation = await db.functions.invoke(name, { nightly_internal: true, run_key: key });
      const data = responseData(invocation) || {};
      const suitePassed = Number(data.passed || 0);
      const suiteFailed = Number(data.failed ?? Math.max(0, Number(data.total || 0) - suitePassed));
      const suiteTotal = Number(data.total || suitePassed + suiteFailed);
      const threshold = THRESHOLDS[name] || 1;
      const cleanup = cleanupPassed(data);
      const zeroWrite = zeroWritePassed(name, data);
      const ok = data.all_pass === true && suiteFailed === 0 && suiteTotal >= threshold && cleanup && zeroWrite;
      passed += suitePassed;
      failed += suiteFailed + (ok ? 0 : suiteFailed === 0 ? 1 : 0);
      total += suiteTotal + (ok ? 0 : suiteFailed === 0 ? 1 : 0);
      details[name] = { status: ok ? 'passed' : 'failed', passed: suitePassed, failed: suiteFailed, total: suiteTotal, minimum_total: threshold, all_pass: data.all_pass === true, cleanup_verified: cleanup, zero_semantic_writes: zeroWrite, started_at: suiteStarted, completed_at: new Date().toISOString() };
    } catch (error) {
      failed += 1;
      total += 1;
      details[name] = { status: 'failed', passed: 0, failed: 1, total: 1, minimum_total: THRESHOLDS[name] || 1, all_pass: false, cleanup_verified: false, zero_semantic_writes: false, started_at: suiteStarted, completed_at: new Date().toISOString(), error: String(error?.message || error) };
    }
  }

  const residue = await findDisposableResidue(db, startedAt);
  const protectedAfter = await readProtected(db);
  const protectedUnchanged = protectedBefore.hash === protectedAfter.hash;
  const cleanupVerified = residue.length === 0 && Object.values(details).every((detail) => detail.cleanup_verified);
  const allPass = failed === 0 && cleanupVerified && protectedUnchanged && Object.values(details).every((detail) => detail.status === 'passed');
  const completedAt = new Date().toISOString();
  const aggregate = {
    run_key: key,
    started_at: startedAt,
    completed_at: completedAt,
    status: allPass ? 'passed' : 'failed',
    functions_run: suiteNames,
    passed,
    failed,
    total,
    all_pass: allPass,
    suite_details: { suites: details, manifest, disposable_residue: residue, protected_before: protectedBefore, protected_after: protectedAfter, sweep_version: NIGHTLY_SWEEP_VERSION },
    cleanup_verified: cleanupVerified,
    protected_unchanged: protectedUnchanged,
    environment,
    notes: allPass ? 'All mandatory internal suites passed.' : 'One or more mandatory gates failed closed.',
  };
  const stored = await persistExactlyOnce(db, key, aggregate);
  return { ...stored.record, already_processed: stored.already_processed, sweep_version: NIGHTLY_SWEEP_VERSION };
}