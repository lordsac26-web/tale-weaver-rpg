import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { DOMAIN_NAMES } from '../../shared/contentAudit/config.ts';
import { paginateCatalog } from '../../shared/contentAudit/engine.ts';
import { buildContentSourceAudit, SOURCE_AUDIT_DEPLOYMENT_ID } from '../../shared/contentSourceAudit/engine.ts';
import { loadOpen5eSources } from '../../shared/contentSourceAudit/sourceClient.ts';

export default async function contentSourceAuditPhase2(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const input = await req.json(); const requested = Array.isArray(input?.domains) ? input.domains.map(String) : DOMAIN_NAMES;
    const domains = [...new Set(requested)]; const unsupported = domains.filter((domain) => !DOMAIN_NAMES.includes(domain));
    if (unsupported.length) return Response.json({ error: 'Unsupported domains', unsupported, allowed_domains: DOMAIN_NAMES, writes: 0 }, { status: 400 });
    const recordsByDomain = {};
    for (const domain of domains) recordsByDomain[domain] = (await paginateCatalog(base44, domain, Math.min(500, Math.max(50, Number(input?.catalog_page_size) || 250)))).records;
    const sources = await loadOpen5eSources(domains, { timeoutMs: Math.min(10000, Math.max(500, Number(input?.timeout_ms) || 5000)), retries: Math.min(2, Math.max(0, Number(input?.retries) || 1)), pageSize: Math.min(200, Math.max(25, Number(input?.source_page_size) || 100)), maxPages: Math.min(3, Math.max(1, Number(input?.source_page_limit) || 1)) });
    const audit = await buildContentSourceAudit(recordsByDomain, sources.byDomain, { sampleLimit: Math.min(50, Math.max(1, Number(input?.sample_limit) || 20)) });
    const domainsResult = input?.counts_only === true ? Object.fromEntries(Object.entries(audit.domains).map(([domain, result]) => [domain, { counts: result.counts, validation: result.validation, truncated: result.truncated }])) : audit.domains;
    if (input?.report_section === 'sources') return Response.json({ deployment_id: audit.deployment_id, mode: audit.mode, writes: 0, source_metadata: sources.source_metadata, source_reports: sources.source_reports });
    if (input?.report_section === 'summary') return Response.json({ deployment_id: audit.deployment_id, mode: audit.mode, writes: 0, domains: Object.fromEntries(Object.entries(audit.domains).map(([domain, result]) => [domain, { rows: result.counts.local_rows, source: result.counts.source_rows_considered, match: result.counts.source_matches, mismatch: result.counts.source_mismatches, proposals: result.counts.proposals, ambiguity: result.counts.ambiguities, license_blocks: result.counts.license_blocks, identity_collisions: result.counts.identity_collisions, ruleset_conflicts: result.counts.ruleset_conflicts, placeholders: result.counts.placeholder_displays, renderer_fallbacks: result.counts.renderer_fallbacks, unresolved_custom: result.counts.unresolved_custom_conditions }])), source_status: { endpoints: sources.source_reports.length, failed: sources.source_reports.filter((report) => report.error).length, truncated: sources.source_reports.filter((report) => report.truncated).length } });
    return Response.json({ ...audit, domains: domainsResult, source_metadata: sources.source_metadata, source_reports: sources.source_reports, safety: { production_catalog_writes: 0, schemas_changed: false, variants_mutated: false, results_bounded: true }, test_execution_note: 'Run fixture-creating regressions serially; take catalog snapshots only before fixture creation or after verified cleanup.' });
  } catch (error) {
    return Response.json({ deployment_id: SOURCE_AUDIT_DEPLOYMENT_ID, error: error.message || 'Phase 2 source audit failed', writes: 0 }, { status: 500 });
  }
}