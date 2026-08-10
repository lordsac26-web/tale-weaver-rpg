export const OPEN5E_ORIGIN = 'https://api.open5e.com';

const DOMAIN_ENDPOINTS = {
  Race: [['v1', 'races'], ['v2', 'species']],
  Subclass: [['v1', 'classes'], ['v2', 'classes']],
  DnDClass: [['v1', 'classes'], ['v2', 'classes']],
  Feat: [['v1', 'feats'], ['v2', 'feats']],
  Spell: [['v1', 'spells'], ['v2', 'spells']],
  Equipment: [['v1', 'weapons'], ['v1', 'armor'], ['v2', 'weapons'], ['v2', 'armor'], ['v2', 'items']],
  MagicItem: [['v1', 'magicitems'], ['v2', 'magicitems']],
  VendorItem: [['v2', 'items']],
  Monster: [['v1', 'monsters'], ['v2', 'creatures']],
  DnDCondition: [['v1', 'conditions'], ['v2', 'conditions']],
};

const boundedUrl = (url) => {
  const parsed = new URL(url, OPEN5E_ORIGIN);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.open5e.com') throw new Error('Only lawful HTTPS Open5e endpoints are allowed');
  return parsed.toString();
};

export async function fetchJsonBounded(url, options = {}) {
  const fetcher = options.fetcher || fetch; const timeoutMs = Math.min(10000, Math.max(100, Number(options.timeoutMs) || 5000)); const retries = Math.min(2, Math.max(0, Number(options.retries) || 0));
  let last = 'source request failed';
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(boundedUrl(url), { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
      const data = await response.json();
      if (!data || typeof data !== 'object' || !Array.isArray(data.results)) throw new Error('malformed paginated source response');
      clearTimeout(timer); return { ok: true, data, attempts: attempt + 1 };
    } catch (error) {
      clearTimeout(timer); last = error?.name === 'AbortError' ? 'timeout' : String(error?.message || error);
    }
  }
  return { ok: false, error: last, attempts: retries + 1 };
}

const fetchPages = async (version, endpoint, options, cache) => {
  const pageSize = Math.min(200, Math.max(1, Number(options.pageSize) || 100)); const maxPages = Math.min(3, Math.max(1, Number(options.maxPages) || 1));
  const fields = endpoint === 'documents' && version === 'v2' ? '&fields=key,name,licenses,gamesystem,permalink' : '';
  let url = `${OPEN5E_ORIGIN}/${version}/${endpoint}/?limit=${pageSize}${fields}`; const rows = []; let pages = 0; let error = null; let total = null;
  while (url && pages < maxPages) {
    const key = boundedUrl(url); let result = cache.get(key);
    if (!result) { result = await fetchJsonBounded(key, options); cache.set(key, result); }
    if (!result.ok) { error = result.error; break; }
    pages += 1; total = Number(result.data.count); rows.push(...result.data.results); url = result.data.next ? boundedUrl(result.data.next) : null;
  }
  return { version, endpoint, rows, pages, total: Number.isFinite(total) ? total : rows.length, truncated: !!url || (Number.isFinite(total) && rows.length < total), error };
};

const documentKey = (value) => String(value?.key || value?.slug || value || '').trim().toLowerCase();
const licenseMeta = (document, documents, row = {}) => {
  const key = documentKey(document); const metadata = documents.get(key) || {};
  const license = document?.licenses?.[0] || metadata.licenses?.[0] || document?.license || metadata.license || row.document__license_url || row.license_url || metadata.license_name || metadata.license_url || metadata.license_url_text || null;
  return { document_key: key || 'unknown', document_name: document?.name || metadata.name || row.document__title || 'unknown', document_version: document?.version || metadata.version || metadata.gamesystem?.key || row.document__version || 'unknown', document_url: document?.permalink || metadata.url || metadata.permalink || row.document__url || null, license: license && typeof license === 'object' ? (license.name || license.key || license.url || null) : license, license_url: license && typeof license === 'object' ? (license.url || license.permalink || null) : row.document__license_url || metadata.license_url || null, license_present: !!license };
};

export async function loadOpen5eSources(domains, options = {}) {
  const cache = new Map();
  const docReports = await Promise.all([fetchPages('v1', 'documents', options, cache), fetchPages('v2', 'documents', options, cache)]);
  const documents = new Map();
  for (const report of docReports) for (const row of report.rows) documents.set(documentKey(row), row);
  const unique = new Map();
  for (const domain of domains) for (const [version, endpoint] of DOMAIN_ENDPOINTS[domain] || []) unique.set(`${version}/${endpoint}`, [version, endpoint]);
  const reports = await Promise.all([...unique.values()].map(([version, endpoint]) => fetchPages(version, endpoint, options, cache)));
  const reportMap = new Map(reports.map((report) => [`${report.version}/${report.endpoint}`, report])); const byDomain = {};
  for (const domain of domains) {
    byDomain[domain] = [];
    for (const [version, endpoint] of DOMAIN_ENDPOINTS[domain] || []) {
      const report = reportMap.get(`${version}/${endpoint}`);
      for (const row of report?.rows || []) byDomain[domain].push({ ...row, __source: { api_version: version, endpoint: `/${version}/${endpoint}/`, ...licenseMeta(row.document || row.document__key || row.source, documents, row) } });
    }
  }
  return { byDomain, source_reports: [...docReports, ...reports].map(({ rows, ...report }) => ({ ...report, rows_fetched: rows.length })), source_metadata: { provider: 'Open5e', origin: OPEN5E_ORIGIN, fetched_at: new Date().toISOString(), read_only: true } };
}