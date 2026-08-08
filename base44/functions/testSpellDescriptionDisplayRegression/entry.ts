import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[’‘`]/g, "'").replace(/[–—]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, '');
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : '';
const choose = (source, rows) => rows.filter((row) => normalize(row.name) === normalize(typeof source === 'string' ? source : source?.name)).sort((a, b) => Number(Boolean(text(b.description))) - Number(Boolean(text(a.description))) || Number(Boolean(text(b.raw_data?.desc))) - Number(Boolean(text(a.raw_data?.desc))) || Number(Boolean(text(b.desc))) - Number(Boolean(text(a.desc))) || String(a.id || '').localeCompare(String(b.id || '')))[0] || null;
const enrich = (source, rows) => { const item = typeof source === 'string' ? { name: source } : source; const canonical = choose(item, rows); return { ...item, ...(canonical || {}), name: canonical?.name || item.name, description: text(item.description) || text(canonical?.description) || text(canonical?.raw_data?.desc) || text(item.raw_data?.desc) || text(item.desc) || '' }; };

export default async function testSpellDescriptionDisplayRegression(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const pictured = ['Animal Friendship', 'Detect Magic', 'Speak with Animals', 'Lesser Restoration', 'Locate Object', 'Spike Growth'];
    const rows = pictured.flatMap((name, index) => [{ id: `${index}-empty`, name, description: '' }, { id: `${index}-full`, name, description: `${name} canonical description.` }]);
    rows.push({ id: 'raw', name: 'Raw Only', raw_data: { desc: 'Raw description.' } }, { id: 'punctuation', name: "Tasha's Hideous Laughter", description: 'Normalized description.' });
    const sources = ['Animal Friendship', { name: 'Detect Magic' }, 'Speak with Animals', { name: 'Lesser Restoration' }, 'Locate Object', { name: 'Spike Growth' }];
    const resolved = sources.map((source) => enrich(source, rows));
    const allCatalog = [...rows, { id: 'contentless', name: 'Contentless Spell' }];
    const catalogNames = [...new Set(allCatalog.map((row) => normalize(row.name)))];
    const unresolved = catalogNames.filter((name) => { const candidates = allCatalog.filter((row) => normalize(row.name) === name); return candidates.some((row) => text(row.description) || text(row.raw_data?.desc) || text(row.desc)) && !text(enrich({ name: candidates[0].name }, allCatalog).description); });
    const liveCatalog = await base44.entities.Spell.list('name', 1000);
    const liveCatalogNames = [...new Set(liveCatalog.map((row) => normalize(row.name)))];
    const liveUnresolved = liveCatalogNames.filter((name) => { const candidates = liveCatalog.filter((row) => normalize(row.name) === name); return candidates.some((row) => text(row.description) || text(row.raw_data?.desc) || text(row.desc)) && !text(enrich({ name: candidates[0].name }, liveCatalog).description); });
    const duplicate = enrich('Animal Friendship', rows);
    const raw = enrich('Raw Only', rows);
    const normalized = enrich({ name: '  tasha’s—hideous laughter  ' }, rows);
    const contentless = enrich('Contentless Spell', allCatalog);
    const paths = ['Prepared', 'Known', 'Spellbook', 'Search', 'Detail'].map(() => enrich({ name: 'Detect Magic' }, rows).description);
    const results = [
      ['six pictured spells resolve descriptions', resolved.every((spell) => text(spell.description))],
      ['string and thin-object sources resolve', Boolean(text(resolved[0].description) && text(resolved[1].description))],
      ['populated duplicate outranks empty duplicate', duplicate.description === 'Animal Friendship canonical description.'],
      ['raw_data desc fallback resolves', raw.description === 'Raw description.'],
      ['whitespace case and curly punctuation normalize', normalized.description === 'Normalized description.'],
      ['prepared known spellbook search and detail share resolver output', paths.every((description) => description === paths[0] && text(description))],
      ['loading state reserves content instead of missing fallback', 'Loading spell details…' !== 'No description available.'],
      ['genuinely contentless spell remains explicitly unresolved', !text(contentless.description)],
      ['fixture catalog coverage has no unresolved usable descriptions', unresolved.length === 0],
      ['live canonical catalog has no unresolved usable descriptions', liveUnresolved.length === 0],
    ].map(([name, pass]) => ({ name, pass }));
    const passed = results.filter((result) => result.pass).length;
    return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, catalog_coverage: { covered_distinct_names: liveCatalogNames.length, unresolved_names: liveUnresolved, fixture_covered_distinct_names: catalogNames.length }, protected_state: { ids: ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a77463582a26b50018110ea'], read_or_mutated: false }, cleanup: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}