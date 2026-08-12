import { hashValue, PROTECTED_DND_IDS, readProtectedDndState } from './liveProtection.ts';

export const deterministic = (seed) => {
  let state = (Number(seed) >>> 0) || 1;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
};
export const protectedSnapshot = async (db) => ({ ids: PROTECTED_DND_IDS, hash: await hashValue(await readProtectedDndState(db)) });
export const protectedUnchanged = async (db, before) => ({ before_hash: before.hash, after_hash: (await protectedSnapshot(db)).hash, unchanged: before.hash === (await protectedSnapshot(db)).hash });
export const fixtureToken = (name) => `${name}_owner_attributed_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
export const cleanupFixtures = async (db, fixtures) => {
  const evidence = [];
  for (const [entity, id] of [...fixtures].reverse()) {
    let deleted = false; let verified_absent = false;
    try { await db.entities[entity].delete(id); deleted = true; } catch {}
    try { verified_absent = !(await db.entities[entity].get(id)); } catch { verified_absent = true; }
    evidence.push({ entity, id, deleted, verified_absent });
  }
  return { records: evidence, created: fixtures.length, cleanup_absent: evidence.every((row) => row.deleted && row.verified_absent) };
};
export const resultSummary = (results, cleanup, protectedState) => {
  const passed = results.filter((result) => result.pass).length;
  const allPass = passed === results.length && cleanup.cleanup_absent && protectedState.unchanged;
  return { passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, protected_hash_evidence: protectedState, live_records_mutated: false, writes: 0 };
};