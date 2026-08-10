import { DOMAIN_CONFIG, DOMAIN_NAMES } from './config.ts';

const PLACEHOLDER = /^(?:n\/?a|none|unknown|tbd|todo|placeholder|no description|description unavailable|not available|coming soon|-+)\.?$/i;
const BOILERPLATE = /(?:lorem ipsum|insert (?:text|description)|sample (?:text|description)|description goes here)/i;
const SOURCE_PATHS = ['raw_data.document', 'raw_data.source_document', 'raw_data.source', 'raw_data.key', 'raw_data.url'];

const getPath = (value, path) => path.split('.').reduce((current, key) => current && typeof current === 'object' ? current[key] : undefined, value);
const collapse = (value) => String(value ?? '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim();
export const normalizeAuditName = (value) => collapse(value).toLocaleLowerCase('en-US');
const textFrom = (value, kind = 'text') => {
  if (kind === 'text_array') return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map(collapse).filter(Boolean).join(' • ') : (typeof value === 'string' ? collapse(value) : '');
  return typeof value === 'string' || typeof value === 'number' ? collapse(value) : '';
};
const textStatus = (value, kind = 'text') => {
  const text = textFrom(value, kind);
  if (!text) return 'blank';
  if (PLACEHOLDER.test(text)) return 'placeholder';
  if (BOILERPLATE.test(text)) return 'boilerplate';
  return 'usable';
};
const validKind = (value, kind) => {
  if (kind === 'text') return textStatus(value) === 'usable';
  if (kind === 'array') return Array.isArray(value) && value.length > 0;
  if (kind === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
  if (kind === 'nonempty_object') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  if (kind === 'boolean') return typeof value === 'boolean';
  if (kind === 'positive_number') return Number.isFinite(Number(value)) && Number(value) > 0;
  if (kind === 'nonnegative_number') return Number.isFinite(Number(value)) && Number(value) >= 0;
  if (kind === 'text_or_number') return textStatus(value) === 'usable' || Number.isFinite(value);
  return false;
};
const malformedKind = (value, kind) => {
  if (value === undefined || value === null || value === '') return false;
  if (kind === 'array') return !Array.isArray(value);
  if (kind === 'object' || kind === 'nonempty_object') return typeof value !== 'object' || Array.isArray(value);
  if (kind === 'boolean') return typeof value !== 'boolean';
  if (kind === 'positive_number' || kind === 'nonnegative_number') return !Number.isFinite(Number(value));
  if (kind === 'text') return typeof value !== 'string';
  return false;
};
const safeSummary = (value) => {
  const text = textFrom(value, Array.isArray(value) ? 'text_array' : 'text');
  return text ? `${text.slice(0, 180)}${text.length > 180 ? '…' : ''}` : '(empty)';
};
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
};
export const hashAuditValue = async (value) => {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sourceMeta = (record) => {
  const raw = record?.raw_data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { document: 'unknown', version: 'unknown', key: 'unknown' };
  const documentValue = raw.document;
  const document = collapse(typeof documentValue === 'object' ? documentValue?.name || documentValue?.title || documentValue?.key : documentValue)
    || collapse(raw.source_document || raw.source || raw.url || raw.key) || 'unknown';
  const version = collapse((typeof documentValue === 'object' ? documentValue?.version : '') || raw.version || raw.document_version || raw.revision) || 'unknown';
  const key = collapse((typeof documentValue === 'object' ? documentValue?.key : '') || raw.key || raw.url) || document;
  return { document, version, key };
};
const displayResolution = (record, config) => {
  for (const candidate of config.display) {
    const value = getPath(record, candidate.path);
    const status = textStatus(value, candidate.kind);
    if (status === 'usable') return { usable: true, path: candidate.path, direct: candidate.direct, text: textFrom(value, candidate.kind) };
  }
  return { usable: false, path: null, direct: false, text: '' };
};
const structuredResolution = (record, config) => {
  const fields = Object.entries(config.structured || {});
  const gaps = []; const malformed = [];
  for (const [path, kind] of fields) {
    const value = getPath(record, path);
    if (!validKind(value, kind)) gaps.push(path);
    if (malformedKind(value, kind)) malformed.push(path);
  }
  return { complete: gaps.length === 0, gaps, malformed, ratio: fields.length ? (fields.length - gaps.length) / fields.length : 1 };
};
const scoreRecord = (record, config) => {
  const display = displayResolution(record, config); const structured = structuredResolution(record, config); const source = sourceMeta(record);
  return Math.round((display.usable ? 40 : 0) + structured.ratio * 40 + (source.document !== 'unknown' ? 12 : 0) + (source.version !== 'unknown' ? 5 : 0) + (textStatus(record.name) === 'usable' ? 3 : 0));
};
const canonicalChoice = (records, config) => {
  const ranked = records.map((record) => ({ record, score: scoreRecord(record, config), source: sourceMeta(record) }))
    .sort((a, b) => b.score - a.score || String(a.record.id || '').localeCompare(String(b.record.id || '')));
  const winner = ranked[0]; const margin = winner.score - (ranked[1]?.score ?? -1);
  const confidence = records.length === 1 || margin >= 10 ? 'high' : margin > 0 ? 'medium' : 'low';
  return { winner, confidence, reason: `highest completeness score ${winner.score}; structured/display/source weighted; stable ID tie-break${margin === 0 ? ' applied' : ''}` };
};
const proposalSource = (record) => {
  for (const path of ['raw_data.desc', 'raw_data.description']) {
    const value = getPath(record, path);
    if (textStatus(value) === 'usable') return { path, value: collapse(value) };
  }
  return null;
};

export function auditRecords(domain, records, options = {}) {
  const config = DOMAIN_CONFIG[domain];
  if (!config) throw new Error(`Unsupported audit domain: ${domain}`);
  const includeIds = options.includeIds === true; const requestedLimit = Number(options.anomalyLimit); const anomalyLimit = Math.min(100, Math.max(0, Number.isFinite(requestedLimit) ? requestedLimit : 25));
  const groups = new Map(); const anomalySamples = []; const anomalyCounts = { whitespace_only: 0, placeholder: 0, boilerplate: 0, malformed_type_value: 0, unresolved: 0 };
  const fallbackPaths = {}; const structuredGaps = {}; const sources = {}; const versions = {};
  let usable = 0; let direct = 0; let fallback = 0; let structuredComplete = 0;
  for (const record of records) {
    const normalizedName = normalizeAuditName(record?.name); const groupKey = normalizedName || '(missing-name)';
    if (!groups.has(groupKey)) groups.set(groupKey, []); groups.get(groupKey).push(record);
    const display = displayResolution(record, config); const structured = structuredResolution(record, config); const source = sourceMeta(record);
    if (display.usable) { usable += 1; if (display.direct) direct += 1; else { fallback += 1; fallbackPaths[display.path] = (fallbackPaths[display.path] || 0) + 1; } }
    if (structured.complete) structuredComplete += 1;
    for (const gap of structured.gaps) structuredGaps[gap] = (structuredGaps[gap] || 0) + 1;
    sources[source.document] = (sources[source.document] || 0) + 1; versions[`${source.document} @ ${source.version}`] = (versions[`${source.document} @ ${source.version}`] || 0) + 1;
    const kinds = [];
    if (typeof record?.name === 'string' && record.name.length > 0 && !record.name.trim()) { anomalyCounts.whitespace_only += 1; kinds.push('whitespace_only_name'); }
    const directDisplay = config.display[0] ? getPath(record, config.display[0].path) : undefined; const directStatus = textStatus(directDisplay, config.display[0]?.kind);
    if (typeof directDisplay === 'string' && directDisplay.length > 0 && !directDisplay.trim()) { anomalyCounts.whitespace_only += 1; kinds.push('whitespace_only_display'); }
    if (directStatus === 'placeholder') { anomalyCounts.placeholder += 1; kinds.push('placeholder_display'); }
    if (directStatus === 'boilerplate') { anomalyCounts.boilerplate += 1; kinds.push('boilerplate_display'); }
    if (structured.malformed.length) { anomalyCounts.malformed_type_value += 1; kinds.push(`malformed:${structured.malformed.join(',')}`); }
    if (!display.usable || !normalizedName) { anomalyCounts.unresolved += 1; kinds.push(!normalizedName ? 'missing_name' : 'no_usable_display'); }
    if (kinds.length && anomalySamples.length < anomalyLimit) anomalySamples.push({ ...(includeIds ? { id: record.id || null } : {}), name: safeSummary(record?.name), normalized_name: normalizedName, kinds, source_document: source.document });
  }
  const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);
  const canonicalSamples = []; let variantRows = 0; let referenceDuplicateRows = 0;
  for (const [name, group] of duplicateGroups) {
    const choice = canonicalChoice(group, config); const canonicalSource = `${choice.winner.source.key}@${choice.winner.source.version}`;
    const distinctSources = new Set(group.map((record) => { const source = sourceMeta(record); return `${source.key}@${source.version}`; }));
    variantRows += Math.max(0, distinctSources.size - 1); referenceDuplicateRows += Math.max(0, group.length - distinctSources.size);
    if (canonicalSamples.length < anomalyLimit) canonicalSamples.push({ normalized_name: name, rows: group.length, source_versions: distinctSources.size, ...(includeIds ? { canonical_id: choice.winner.record.id || null } : {}), confidence: choice.confidence, reason: choice.reason });
  }
  const total = records.length; const unique = groups.size;
  return {
    domain, total_rows: total, normalized_unique_names: unique, duplicate_rows: total - unique, duplicate_clusters: duplicateGroups.length,
    display: { usable_count: usable, usable_rate: total ? Number((usable / total).toFixed(6)) : 1, direct_count: direct, fallback_count: fallback, unresolved_count: total - usable, fallback_paths: fallbackPaths },
    structured: { complete_count: structuredComplete, complete_rate: total ? Number((structuredComplete / total).toFixed(6)) : 1, gap_count: total - structuredComplete, gaps_by_field: structuredGaps },
    anomalies: { counts: anomalyCounts, samples: anomalySamples }, source_distribution: sources, document_version_distribution: versions,
    classification: { canonical_candidate_count: unique, reference_variant_count: variantRows, same_source_duplicate_count: referenceDuplicateRows, duplicate_cluster_samples: canonicalSamples },
  };
}

export async function buildDryRunProposals(domain, records, options = {}) {
  const config = DOMAIN_CONFIG[domain]; const includeIds = options.includeIds === true; const requestedLimit = Number(options.anomalyLimit); const limit = Math.min(100, Math.max(0, Number.isFinite(requestedLimit) ? requestedLimit : 25));
  const groups = new Map();
  for (const record of records) { const name = normalizeAuditName(record?.name) || '(missing-name)'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(record); }
  const all = []; let ambiguousBlocked = 0;
  if (config?.proposalField) for (const [normalizedName, group] of groups) {
    const ambiguous = group.length > 1;
    for (const record of group) {
      const current = getPath(record, config.proposalField); const currentStatus = textStatus(current); const source = proposalSource(record);
      if (!source || currentStatus === 'usable') continue;
      if (ambiguous) { ambiguousBlocked += 1; continue; }
      const meta = sourceMeta(record);
      all.push({ entity: domain, record_id: record.id || null, normalized_name: normalizedName, field: config.proposalField, current_value_summary: safeSummary(current), proposed_value_summary: safeSummary(source.value), source_path: source.path, source_document: meta.document, confidence: meta.document === 'unknown' ? 'medium' : 'high', reason: 'empty current field has deterministic approved fallback content on the same record', ambiguity_flags: [] });
    }
  }
  const hash = await hashAuditValue(all.map((proposal) => ({ ...proposal, proposed_value: proposal.proposed_value_summary })));
  const countsByField = all.reduce((counts, proposal) => ({ ...counts, [proposal.field]: (counts[proposal.field] || 0) + 1 }), {});
  return { total_proposals: all.length, counts_by_field: countsByField, ambiguous_blocked_count: ambiguousBlocked, proposal_hash: hash, proposals: all.slice(0, limit).map(({ record_id, ...proposal }) => includeIds ? { ...proposal, id: record_id } : proposal), returned_proposals: Math.min(all.length, limit), truncated: all.length > limit };
}

export async function paginateCatalog(base44, domain, pageSize = 200) {
  const size = Math.min(500, Math.max(1, Number(pageSize) || 200)); const records = []; let skip = 0; let pageCount = 0;
  while (true) {
    const page = await base44.asServiceRole.entities[domain].list('id', size, skip);
    pageCount += 1;
    if (!Array.isArray(page)) throw new Error(`${domain} pagination returned a non-array page`);
    if (!page.length) break;
    records.push(...page); skip += page.length;
    if (pageCount > 10000) throw new Error(`${domain} pagination safety bound exceeded`);
  }
  return { records, pagination: { requested_page_size: size, pages_fetched: pageCount, rows_fetched: records.length, completed: true, terminal_empty_page: true } };
}

export async function auditDomains(base44, domains = DOMAIN_NAMES, options = {}) {
  const results = {};
  for (const domain of domains) {
    const page = await paginateCatalog(base44, domain, options.pageSize);
    const audit = auditRecords(domain, page.records, options);
    const proposals = options.proposals ? await buildDryRunProposals(domain, page.records, options) : null;
    results[domain] = { ...audit, pagination: page.pagination, ...(proposals ? { dry_run: proposals } : {}) };
  }
  return results;
}

export function compactAudit(audit) {
  return Object.fromEntries(Object.entries(audit).map(([domain, result]) => [domain, {
    total_rows: result.total_rows, normalized_unique_names: result.normalized_unique_names, duplicate_rows: result.duplicate_rows, duplicate_clusters: result.duplicate_clusters,
    display: result.display, structured: result.structured, anomalies: result.anomalies.counts,
    classification: { canonical_candidate_count: result.classification.canonical_candidate_count, reference_variant_count: result.classification.reference_variant_count, same_source_duplicate_count: result.classification.same_source_duplicate_count },
    source_distribution: result.source_distribution, document_version_distribution: result.document_version_distribution, pagination: result.pagination,
  }]));
}

export { DOMAIN_NAMES, SOURCE_PATHS };