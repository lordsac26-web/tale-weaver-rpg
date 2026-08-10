import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { DOMAIN_NAMES } from '../../shared/contentAudit/config.ts';
import { hashAuditValue, paginateCatalog } from '../../shared/contentAudit/engine.ts';
import { buildContentSourceAudit, SOURCE_AUDIT_DEPLOYMENT_ID } from '../../shared/contentSourceAudit/engine.ts';
import { fetchJsonBounded, loadOpen5eSources } from '../../shared/contentSourceAudit/sourceClient.ts';

const PROTECTED = [['Character', '6a6825cd07a490fa70a46852'], ['GameSession', '6a6825edd695bd65a4322256'], ['CombatLog', '6a767f23ec36fe219063ae49'], ['CombatLog', '6a77463582a26b50018110ea']];
const snapshotCatalogs = async (base44) => Object.fromEntries(await Promise.all(DOMAIN_NAMES.map(async (domain) => { const records = (await paginateCatalog(base44, domain, 250)).records; return [domain, { count: records.length, updated_date_hash: await hashAuditValue(records.map(({ id, updated_date }) => ({ id, updated_date: updated_date || null }))), content_hash: await hashAuditValue(records) }]; })));
const snapshotProtected = async (base44) => Promise.all(PROTECTED.map(async ([entity, id]) => { let row = null; try { row = await base44.asServiceRole.entities[entity].get(id); } catch {} return { entity, id, exists: !!row, hash: await hashAuditValue(row) }; }));
const jsonResponse = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
const source = (version, key, license = 'CC-BY-4.0', extra = {}) => ({ __source: { api_version: version, endpoint: `/${version}/test/`, document_key: key, document_name: key, document_version: key.includes('2024') ? '2024' : '2014', document_url: 'https://open5e.com/', license, license_url: license ? 'https://creativecommons.org/licenses/by/4.0/' : null, license_present: !!license }, ...extra });

export default async function testContentSourceAuditPhase2(req) {
  const results = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json(); const beforeCatalogs = await snapshotCatalogs(base44); const beforeProtected = await snapshotProtected(base44);

    const fixedFetch = async (url) => {
      const parsed = new URL(url); const version = parsed.pathname.split('/')[1];
      if (parsed.pathname.includes('/documents/')) return jsonResponse({ count: 1, next: null, results: [{ key: version === 'v1' ? 'wotc-srd' : 'srd-2024', name: 'SRD', version: version === 'v1' ? '2014' : '2024', license: { name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } }] });
      return jsonResponse({ count: 1, next: null, results: [{ name: 'Test Spell', key: `${version}_test-spell`, document: { key: version === 'v1' ? 'wotc-srd' : 'srd-2024' }, desc: 'Fixed lawful description.' }] });
    };
    const fixed = await loadOpen5eSources(['Spell'], { fetcher: fixedFetch, timeoutMs: 200, retries: 0, maxPages: 1 });
    results.push({ name: 'fixed Open5e v1 and v2 responses retain source version and license metadata', pass: fixed.byDomain.Spell.length === 2 && fixed.byDomain.Spell.every((row) => row.__source.license_present) && new Set(fixed.byDomain.Spell.map((row) => row.__source.api_version)).size === 2 });

    let timeoutAttempts = 0; const timeout = await fetchJsonBounded('https://api.open5e.com/v2/spells/', { timeoutMs: 100, retries: 1, fetcher: async () => { timeoutAttempts += 1; const error = new Error('aborted'); error.name = 'AbortError'; throw error; } });
    results.push({ name: 'timeout is bounded and retried once', pass: !timeout.ok && timeout.error === 'timeout' && timeoutAttempts === 2 });
    const malformed = await fetchJsonBounded('https://api.open5e.com/v2/spells/', { timeoutMs: 100, fetcher: async () => jsonResponse({ unexpected: [] }) });
    results.push({ name: 'malformed source response fails closed', pass: !malformed.ok && /malformed/.test(malformed.error) });

    const records = {
      Race: [{ id: 'r1', name: '# Elf', description: '# Header', speed: -1, size: 'Unknown', traits: 'bad', raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'elf' } }],
      DnDClass: [{ id: 'c1', name: 'Fighter', raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'fighter' } }],
      Subclass: [{ id: 's1', name: 'Champion', raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'champion' } }],
      Feat: [{ id: 'f1', name: 'Alert', has_engine_support: false, raw_data: { document: { key: 'third-party', version: '1' }, key: 'alert' } }],
      Spell: [{ id: 'sp1', name: 'Fly', description: '', level: 3, raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'fly' } }],
      Equipment: [{ id: 'e1', name: 'Longsword', raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'longsword' } }],
      MagicItem: [{ id: 'm1', name: 'Ring', raw_data: { document: { key: 'srd-2024', version: '2024' }, key: 'ring' } }],
      VendorItem: [{ id: 'v1', name: 'Rope' }],
      Monster: [{ id: 'mo1', name: 'Goblin', traits: '', actions: '', armor_class: '15', hit_points: '7', speed: '30 ft.', challenge: '1/4' }],
      DnDCondition: [{ id: 'd1', name: 'Doomed', description: [], mechanical_effects: {} }, { id: 'd2', name: 'Doomed', description: [], mechanical_effects: {} }],
    };
    const sources = {
      Race: [], DnDClass: [source('v2', 'srd-2024', null, { name: 'Fighter', key: 'fighter', saving_throws: ['Strength', 'Constitution'] })], Subclass: [],
      Feat: [source('v2', 'third-party', 'OGL-1.0a', { name: 'Alert', key: 'alert', benefits: ['Benefit'] })],
      Spell: [source('v1', 'wotc-srd', 'CC-BY-4.0', { name: 'Fly', key: 'fly', desc: '2014 text.' }), source('v2', 'srd-2024', 'CC-BY-4.0', { name: 'Fly', key: 'fly', desc: '2024 text.' })],
      Equipment: [], MagicItem: [], VendorItem: [], Monster: [], DnDCondition: [],
    };
    const audit = await buildContentSourceAudit(records, sources, { sampleLimit: 2 });
    results.push({ name: 'missing license blocks otherwise exact source proposals', pass: audit.domains.DnDClass.counts.license_blocks === 1 && audit.domains.DnDClass.counts.proposals === 0 });
    results.push({ name: '2014 and 2024 Spell variants are not mixed', pass: audit.domains.Spell.counts.ruleset_conflicts === 1 && audit.domains.Spell.proposals.every((proposal) => proposal.ruleset === '2024') });
    results.push({ name: 'third-party variant remains source-scoped', pass: audit.domains.Feat.counts.third_party_variants === 1 && audit.domains.Feat.counts.source_matches === 1 });
    results.push({ name: 'duplicate identity collision is reported without merging', pass: audit.domains.DnDCondition.counts.identity_collisions === 1 });
    results.push({ name: 'race pollution, malformed type, speed, and size are detected without synthetic defaults', pass: Object.values(audit.domains.Race.validation).slice(0, 4).every((count) => count === 1) && audit.domains.Race.counts.proposals === 0 });
    results.push({ name: 'placeholder Monster gets only local renderer fallback and preserves fractional CR', pass: audit.domains.Monster.counts.renderer_fallbacks === 1 && audit.domains.Monster.validation.fractional_cr_preserved === 1 && audit.domains.Monster.proposals[0]?.field === 'renderer_fallback' });
    results.push({ name: 'blank custom conditions stay separate from mechanical backlog', pass: audit.domains.DnDCondition.counts.unresolved_custom_conditions === 2 && audit.domains.DnDCondition.counts.proposals === 0 });
    results.push({ name: 'results are bounded and contain no raw source payloads', pass: JSON.stringify(audit).length < 50000 && Object.values(audit.domains).every((domain) => domain.proposals.length <= 2 && domain.ambiguities.length <= 2) });
    results.push({ name: 'audit declares writes zero and source-preserving safety', pass: audit.writes === 0 && Object.values(audit.domains).every((domain) => domain.safety.read_only && domain.safety.no_schema_fields) });

    const afterCatalogs = await snapshotCatalogs(base44); const afterProtected = await snapshotProtected(base44);
    results.push({ name: 'all current catalog counts, updated dates, and content hashes remain unchanged', pass: JSON.stringify(beforeCatalogs) === JSON.stringify(afterCatalogs) });
    results.push({ name: 'protected IDs remain unchanged', pass: JSON.stringify(beforeProtected) === JSON.stringify(afterProtected) });
    const passed = results.filter((result) => result.pass).length;
    return Response.json({ deployment_id: SOURCE_AUDIT_DEPLOYMENT_ID, passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, zero_write_evidence: { writes: 0, catalogs: beforeCatalogs }, protected_state: beforeProtected, execution_note: 'Fixture-creating regressions must run serially; snapshot only before fixtures or after verified cleanup.' }, { status: passed === results.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ deployment_id: SOURCE_AUDIT_DEPLOYMENT_ID, error: error.message || 'Phase 2 regression failed', results }, { status: 500 });
  }
}