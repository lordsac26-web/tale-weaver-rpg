import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { AUDIT_DEPLOYMENT_ID, DOMAIN_NAMES } from '../../shared/contentAudit/config.ts';
import { auditDomains, compactAudit } from '../../shared/contentAudit/engine.ts';

export default async function auditContentCompleteness(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const input = await req.json();
    const mode = ['summary', 'domain', 'dry_run_proposals'].includes(input?.mode) ? input.mode : 'summary';
    const domain = input?.domain ? String(input.domain) : null;
    if (domain && !DOMAIN_NAMES.includes(domain)) return Response.json({ error: 'Unsupported domain', allowed_domains: DOMAIN_NAMES }, { status: 400 });
    if (mode === 'domain' && !domain) return Response.json({ error: 'domain is required for domain mode', allowed_domains: DOMAIN_NAMES }, { status: 400 });
    const options = {
      pageSize: Math.min(500, Math.max(1, Number(input?.page_size) || 200)),
      anomalyLimit: Math.min(100, Math.max(0, Number(input?.anomaly_limit) || 25)),
      includeIds: input?.include_ids === true,
      proposals: mode === 'dry_run_proposals',
    };
    const selected = domain ? [domain] : DOMAIN_NAMES;
    const audit = await auditDomains(base44, selected, options);
    const dryRunResult = Object.fromEntries(Object.entries(audit).map(([name, value]) => [name, {
      audit: { total_rows: value.total_rows, display: value.display, structured: value.structured, duplicate_rows: value.duplicate_rows, duplicate_clusters: value.duplicate_clusters, classification: { canonical_candidate_count: value.classification.canonical_candidate_count, reference_variant_count: value.classification.reference_variant_count, same_source_duplicate_count: value.classification.same_source_duplicate_count }, unresolved_count: value.anomalies.counts.unresolved, pagination: value.pagination },
      dry_run: value.dry_run,
    }]));
    const result = mode === 'summary' ? compactAudit(audit) : mode === 'dry_run_proposals' ? dryRunResult : audit;
    return Response.json({ deployment_id: AUDIT_DEPLOYMENT_ID, mode, read_only: true, writes: 0, domains: result });
  } catch (error) {
    return Response.json({ error: error.message || 'Content completeness audit failed' }, { status: 500 });
  }
}