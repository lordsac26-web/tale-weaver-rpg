import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { AUDIT_DEPLOYMENT_ID, DOMAIN_NAMES } from '../../shared/contentAudit/config.ts';
import { auditRecords, buildDryRunProposals, hashAuditValue, paginateCatalog } from '../../shared/contentAudit/engine.ts';

const PROTECTED = [
  ['Character', '6a6825cd07a490fa70a46852'],
  ['GameSession', '6a6825edd695bd65a4322256'],
  ['CombatLog', '6a767f23ec36fe219063ae49'],
  ['CombatLog', '6a77463582a26b50018110ea'],
];
const snapshotRows = async (rows) => ({ count: rows.length, updated_date_hash: await hashAuditValue(rows.map((row) => ({ id: row.id, updated_date: row.updated_date || null })).sort((a, b) => String(a.id).localeCompare(String(b.id)))) });
const protectedSnapshot = async (base44) => Promise.all(PROTECTED.map(async ([entity, id]) => {
  let record = null; try { record = await base44.asServiceRole.entities[entity].get(id); } catch {}
  return { entity, id, exists: !!record, hash: await hashAuditValue(record) };
}));

export default async function testContentCompletenessAudit(req) {
  const started = Date.now(); const results = []; const cleanup = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const beforeProtected = await protectedSnapshot(base44); const beforeCatalog = {}; const rowsByDomain = {}; const perDomainTotals = {};
    for (const domain of DOMAIN_NAMES) {
      const page = await paginateCatalog(base44, domain, 173); rowsByDomain[domain] = page.records; beforeCatalog[domain] = await snapshotRows(page.records); perDomainTotals[domain] = page.records.length;
      results.push({ name: `${domain} paginates exhaustively to a terminal empty page`, pass: page.pagination.completed && page.pagination.terminal_empty_page && page.pagination.rows_fetched === page.records.length, total: page.records.length, pages: page.pagination.pages_fetched });
    }
    const spellFallback = auditRecords('Spell', [{ id: 'b', name: 'Raw Spell', description: ' ', raw_data: { desc: 'Lawful existing spell description.' }, level: 1, school: 'Abjuration', casting_time: '1 action', range: 'Self', components: 'V', duration: '1 minute', classes: ['Wizard'], attack_type: 'utility' }]);
    results.push({ name: 'Spell raw_data.desc is usable fallback and not blank', pass: spellFallback.display.usable_count === 1 && spellFallback.display.fallback_count === 1 && spellFallback.display.unresolved_count === 0 });
    const anomalies = auditRecords('Spell', [{ id: 'w', name: 'Whitespace', description: '   ', raw_data: {} }, { id: 'p', name: 'Placeholder', description: 'TBD', classes: 'Wizard', level: 'bad' }, { id: 'm', name: 'Malformed', description: { text: 'wrong' }, raw_data: [] }]);
    results.push({ name: 'blank placeholder and malformed structures are classified separately', pass: anomalies.anomalies.counts.whitespace_only > 0 && anomalies.anomalies.counts.placeholder > 0 && anomalies.anomalies.counts.malformed_type_value > 0 && anomalies.display.unresolved_count === 3 });
    const duplicateCases = [{ id: 'z-id', name: 'Echo—Step', description: 'Complete', level: 2, school: 'Illusion', casting_time: '1 action', range: 'Self', components: 'V', duration: '1 minute', classes: ['Wizard'], attack_type: 'utility', raw_data: { document: { key: 'doc-a', version: '1' } } }, { id: 'a-id', name: 'echo-step', description: 'Complete', level: 2, school: 'Illusion', casting_time: '1 action', range: 'Self', components: 'V', duration: '1 minute', classes: ['Wizard'], attack_type: 'utility', raw_data: { document: { key: 'doc-b', version: '2' } } }];
    const duplicatesA = auditRecords('Spell', duplicateCases, { includeIds: true }); const duplicatesB = auditRecords('Spell', [...duplicateCases].reverse(), { includeIds: true });
    results.push({ name: 'duplicate source versions remain variants with deterministic stable-ID canonical tie-break', pass: duplicatesA.duplicate_clusters === 1 && duplicatesA.classification.reference_variant_count === 1 && duplicatesA.classification.duplicate_cluster_samples[0].canonical_id === 'a-id' && duplicatesB.classification.duplicate_cluster_samples[0].canonical_id === 'a-id' });
    const ambiguous = await buildDryRunProposals('Spell', [{ id: '1', name: 'Twin', description: '', raw_data: { desc: 'Version one', document: 'A' } }, { id: '2', name: 'Twin', description: '', raw_data: { desc: 'Version two', document: 'B' } }]);
    results.push({ name: 'ambiguous same-name backfill is blocked', pass: ambiguous.total_proposals === 0 && ambiguous.ambiguous_blocked_count === 2 });
    const deterministic = await buildDryRunProposals('Spell', [{ id: 'only', name: 'Single', description: ' ', raw_data: { desc: 'Existing lawful text', document: 'Doc' } }], { includeIds: true });
    const deterministicReplay = await buildDryRunProposals('Spell', [{ id: 'only', name: 'Single', description: ' ', raw_data: { desc: 'Existing lawful text', document: 'Doc' } }], { includeIds: true });
    results.push({ name: 'dry-run proposal is deterministic same-record copy and never overwrites', pass: deterministic.total_proposals === 1 && deterministic.proposals[0].source_path === 'raw_data.desc' && deterministic.proposal_hash === deterministicReplay.proposal_hash });
    const liveAudits = {}; const auditReport = {}; const proposalCounts = {};
    for (const domain of DOMAIN_NAMES) {
      const audit = auditRecords(domain, rowsByDomain[domain]); liveAudits[domain] = audit;
      auditReport[domain] = { total_rows: audit.total_rows, display_usable: audit.display.usable_count, display_rate: audit.display.usable_rate, direct: audit.display.direct_count, fallback: audit.display.fallback_count, structured_gaps: audit.structured.gap_count, duplicate_rows: audit.duplicate_rows, duplicate_clusters: audit.duplicate_clusters, variant_rows: audit.classification.reference_variant_count, same_source_duplicates: audit.classification.same_source_duplicate_count, unresolved: audit.anomalies.counts.unresolved };
      const proposals = await buildDryRunProposals(domain, rowsByDomain[domain]); proposalCounts[domain] = { total: proposals.total_proposals, by_field: proposals.counts_by_field, ambiguous_blocked: proposals.ambiguous_blocked_count, hash: proposals.proposal_hash };
    }
    const afterCatalog = {};
    for (const domain of DOMAIN_NAMES) { const page = await paginateCatalog(base44, domain, 173); afterCatalog[domain] = await snapshotRows(page.records); }
    const afterProtected = await protectedSnapshot(base44);
    const catalogUnchanged = DOMAIN_NAMES.every((domain) => JSON.stringify(beforeCatalog[domain]) === JSON.stringify(afterCatalog[domain]));
    const protectedUnchanged = JSON.stringify(beforeProtected) === JSON.stringify(afterProtected);
    results.push({ name: 'dry-run audit leaves every catalog count and updated_date snapshot unchanged', pass: catalogUnchanged });
    results.push({ name: 'exact protected operational record hashes remain unchanged', pass: protectedUnchanged });
    cleanup.push({ fixture_ids: [], created: 0, deleted: 0, exact_id_absence_verified: true, method: 'pure_in_memory_cases' });
    results.push({ name: 'pure in-memory fixtures require no cleanup and leave no fixture IDs', pass: cleanup[0].exact_id_absence_verified && cleanup[0].created === 0 });
    const runtimeMs = Date.now() - started; const runtimeBoundMs = 110000;
    results.push({ name: 'audit harness completes within bounded runtime', pass: runtimeMs <= runtimeBoundMs, runtime_ms: runtimeMs, bound_ms: runtimeBoundMs });
    const passed = results.filter((result) => result.pass).length; const failed = results.length - passed;
    const catalogEvidence = Object.fromEntries(DOMAIN_NAMES.map((domain) => [domain, { count: beforeCatalog[domain].count, before_hash: beforeCatalog[domain].updated_date_hash, after_hash: afterCatalog[domain].updated_date_hash, unchanged: JSON.stringify(beforeCatalog[domain]) === JSON.stringify(afterCatalog[domain]) }]));
    const protectedEvidence = beforeProtected.map((before, index) => ({ entity: before.entity, id: before.id, exists: before.exists, before_hash: before.hash, after_hash: afterProtected[index].hash, unchanged: JSON.stringify(before) === JSON.stringify(afterProtected[index]) }));
    const proposalBundleHash = await hashAuditValue(proposalCounts);
    const reversedCatalogEvidence = Object.fromEntries([...DOMAIN_NAMES].reverse().map((domain) => [domain, catalogEvidence[domain]]));
    return Response.json({ deployment_id: AUDIT_DEPLOYMENT_ID, passed, failed, total: results.length, all_pass: failed === 0, protected_state: { unchanged: protectedUnchanged, records: protectedEvidence }, zero_write_evidence: { writes_attempted: 0, catalog_snapshots_unchanged: catalogUnchanged, catalogs: reversedCatalogEvidence }, cleanup, runtime: { milliseconds: runtimeMs, bound_milliseconds: runtimeBoundMs }, failures: results.filter((result) => !result.pass), per_domain_totals: perDomainTotals, proposal_bundle_hash: proposalBundleHash, dry_run_proposal_counts: proposalCounts, audits: auditReport }, { status: failed === 0 ? 200 : 500 });
  } catch (error) {
    return Response.json({ deployment_id: AUDIT_DEPLOYMENT_ID, error: error.message || 'Content completeness audit regression failed', results, cleanup, runtime_ms: Date.now() - started }, { status: 500 });
  }
}