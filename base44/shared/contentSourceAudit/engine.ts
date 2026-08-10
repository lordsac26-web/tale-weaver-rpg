import { hashAuditValue, normalizeAuditName } from '../contentAudit/engine.ts';

export const SOURCE_AUDIT_DEPLOYMENT_ID = 'content-source-audit-phase2-v1';
const PLACEHOLDER = /^(?:n\/?a|none|unknown|tbd|todo|placeholder|no description|description unavailable|not available|coming soon|-+)?\.?$/i;
const HEADER = /^\s{0,3}#{1,6}\s+/m;
const collapse = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const pathValue = (record, path) => path.split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, record);
const usable = (value) => { const text = Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item : item?.desc || item?.name || '').map(collapse).filter(Boolean).join(' • ') : collapse(value); return text && !PLACEHOLDER.test(text) ? text : ''; };
const sourceKey = (record) => { const raw = record?.raw_data || {}; const doc = raw.document; return collapse((typeof doc === 'object' ? doc?.key : doc) || raw.document_key || raw.source_document || raw.source || record?.__source?.document_key || 'unknown').toLowerCase(); };
const sourceVersion = (record) => { const raw = record?.raw_data || {}; const doc = raw.document; return collapse((typeof doc === 'object' ? doc?.version || doc?.gamesystem?.key : '') || raw.version || raw.document_version || record?.__source?.document_version || 'unknown').toLowerCase(); };
const rawKey = (record) => collapse(record?.raw_data?.key || record?.raw_data?.url || record?.key || record?.slug || 'unknown').toLowerCase();
const ruleset = (record) => { const joined = `${sourceKey(record)} ${sourceVersion(record)} ${rawKey(record)}`; if (/2024|5[._ -]?2|srd-2024/.test(joined)) return '2024'; if (/2014|5[._ -]?1|wotc-srd|srd-2014/.test(joined)) return '2014'; return 'unknown'; };
const thirdParty = (record) => !/^(?:unknown|wotc-srd|srd-2024|srd-2014|srd5[._-]?[12])$/.test(sourceKey(record)) && !/^srd/.test(sourceKey(record));
const summary = (value) => { const text = usable(value); return text ? `${text.slice(0, 180)}${text.length > 180 ? '…' : ''}` : '(empty)'; };
const blank = (value) => !usable(value);
const sourceDescription = (row) => usable(row.desc || row.description || row.text);
const sourceField = (row, field) => {
  const aliases = {
    description: ['desc', 'description', 'text'], speed: ['speed', 'walk'], size: ['size'], traits: ['traits'], languages: ['languages'], ability_score_increase: ['ability_score_increase', 'ability_scores'],
    saving_throw_proficiencies: ['saving_throws', 'saving_throw_proficiencies'], armor_proficiencies: ['armor_proficiencies', 'armor'], weapon_proficiencies: ['weapon_proficiencies', 'weapons'], skill_choices: ['skill_choices', 'skills'], features_by_level: ['features_by_level', 'features', 'levels'], spell_slots_by_level: ['spell_slots_by_level', 'spell_slots'], class_name: ['parent_class', 'class_name', 'subclass_of'],
    benefits: ['benefits'], category: ['category', 'type'], prerequisite: ['prerequisite', 'prerequisites'], cost: ['cost'], weight: ['weight'], properties: ['properties'], rarity: ['rarity'], requires_attunement: ['requires_attunement', 'attunement'], modifiers: ['modifiers'], charges: ['charges'],
  };
  for (const alias of aliases[field] || [field]) { const value = pathValue(row, alias); if (value !== undefined && value !== null && value !== '') return value; }
  return undefined;
};
const proposalFields = {
  Race: ['speed', 'size', 'traits', 'languages', 'ability_score_increase'], Subclass: ['class_name', 'features_by_level'], DnDClass: ['saving_throw_proficiencies', 'armor_proficiencies', 'weapon_proficiencies', 'skill_choices', 'features_by_level', 'spell_slots_by_level'], Feat: ['benefits', 'category', 'prerequisite'], Spell: ['description'], Equipment: ['cost', 'weight', 'properties'], MagicItem: ['rarity', 'requires_attunement', 'modifiers', 'charges'], VendorItem: [], Monster: ['description'], DnDCondition: ['description'],
};
const validationCounts = (domain, records) => {
  const result = { markdown_header_pollution: 0, malformed_array_or_type: 0, invalid_speed: 0, invalid_size: 0, fractional_cr_preserved: 0 };
  for (const row of records) {
    if (HEADER.test(String(row.name || '')) || HEADER.test(String(row.description || ''))) result.markdown_header_pollution += 1;
    if (domain === 'Race') { if (row.speed !== undefined && !(Number(row.speed) > 0)) result.invalid_speed += 1; if (row.size && !['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].includes(row.size)) result.invalid_size += 1; if (row.traits !== undefined && !Array.isArray(row.traits)) result.malformed_array_or_type += 1; }
    if (domain === 'Monster' && /\//.test(String(row.challenge || ''))) result.fractional_cr_preserved += 1;
  }
  return result;
};
const displayBlank = (domain, row) => domain === 'Monster' ? blank(row.traits) && blank(row.actions) : domain === 'DnDCondition' ? blank(row.description) : blank(row.description);
const fallbackMonster = (row) => [row.meta, row.armor_class && `AC ${row.armor_class}`, row.hit_points && `HP ${row.hit_points}`, row.speed && `Speed ${row.speed}`, row.challenge && `CR ${row.challenge}`, usable(row.actions) && `Actions: ${summary(row.actions)}`].filter(Boolean).join('; ');

export async function buildContentSourceAudit(recordsByDomain, sourcesByDomain, options = {}) {
  const limit = Math.min(50, Math.max(1, Number(options.sampleLimit) || 20)); const domains = {};
  for (const [domain, records] of Object.entries(recordsByDomain)) {
    const sourceRows = sourcesByDomain[domain] || []; const byName = new Map();
    for (const row of sourceRows) { const name = normalizeAuditName(row.name); if (!byName.has(name)) byName.set(name, []); byName.get(name).push(row); }
    const counts = { local_rows: records.length, source_rows_considered: sourceRows.length, source_matches: 0, source_mismatches: 0, proposals: 0, ambiguities: 0, license_blocks: 0, identity_collisions: 0, ruleset_conflicts: 0, third_party_variants: 0, placeholder_displays: 0, renderer_fallbacks: 0, unresolved_custom_conditions: 0 };
    const proposals = []; const ambiguities = []; const identities = new Map();
    for (const row of records) {
      const name = normalizeAuditName(row.name); const candidates = byName.get(name) || []; const localSource = sourceKey(row); const localRuleset = ruleset(row);
      const exact = candidates.filter((candidate) => localSource !== 'unknown' && sourceKey(candidate) === localSource && (localRuleset === 'unknown' || ruleset(candidate) === 'unknown' || ruleset(candidate) === localRuleset));
      const conflicts = candidates.filter((candidate) => localRuleset !== 'unknown' && ruleset(candidate) !== 'unknown' && ruleset(candidate) !== localRuleset); counts.ruleset_conflicts += conflicts.length ? 1 : 0;
      counts.third_party_variants += candidates.some(thirdParty) ? 1 : 0;
      if (exact.length) counts.source_matches += 1; else if (candidates.length) counts.source_mismatches += 1;
      if (displayBlank(domain, row)) counts.placeholder_displays += 1;
      const contentHash = await hashAuditValue({ name: row.name, description: row.description, raw_data: row.raw_data });
      const identity = `${name}|${localSource}|${sourceVersion(row)}|${rawKey(row)}|${contentHash}`; identities.set(identity, [...(identities.get(identity) || []), row.id]);
      const licensed = exact.filter((candidate) => candidate.__source?.license_present);
      if (exact.length && !licensed.length) counts.license_blocks += 1;
      if (exact.length > 1 && new Set(await Promise.all(exact.map((candidate) => hashAuditValue(candidate)))).size > 1) { counts.ambiguities += 1; if (ambiguities.length < limit) ambiguities.push({ id: row.id, name: row.name, reason: 'duplicate exact-source identity collision', candidate_keys: exact.map(rawKey) }); continue; }
      const selected = licensed[0];
      if (selected) for (const field of proposalFields[domain] || []) {
        if (!blank(pathValue(row, field))) continue;
        const value = field === 'description' ? sourceDescription(selected) : sourceField(selected, field); if (value === undefined || value === null || value === '') continue;
        if (domain === 'Spell' && localRuleset !== 'unknown' && ruleset(selected) !== 'unknown' && localRuleset !== ruleset(selected)) continue;
        if (proposals.length < limit) proposals.push({ record_id: row.id, name: row.name, field, source_identity: `${selected.__source.document_key}:${rawKey(selected)}`, source_api: selected.__source.api_version, ruleset: ruleset(selected), license: selected.__source.license, proposed_value_hash: await hashAuditValue(value), proposed_value_summary: summary(value), confidence: 'high', review_required: true, mutation: false }); counts.proposals += 1;
      }
      if (!selected && candidates.length) { counts.ambiguities += 1; if (ambiguities.length < limit) ambiguities.push({ id: row.id, name: row.name, reason: conflicts.length ? 'ruleset/source conflict' : exact.length ? 'license missing' : 'same-name source variant only', local_source: localSource, candidate_sources: candidates.slice(0, 5).map((candidate) => ({ key: sourceKey(candidate), ruleset: ruleset(candidate), api: candidate.__source?.api_version })) }); }
      if (domain === 'Monster' && displayBlank(domain, row) && !sourceDescription(selected || {})) { const fallback = fallbackMonster(row); if (fallback) { counts.renderer_fallbacks += 1; if (proposals.length < limit) proposals.push({ record_id: row.id, name: row.name, field: 'renderer_fallback', proposed_value_hash: await hashAuditValue(fallback), proposed_value_summary: summary(fallback), confidence: 'high', review_required: true, mutation: false, source_identity: 'existing-local-stat-action-fields' }); counts.proposals += 1; } }
      if (domain === 'DnDCondition' && displayBlank(domain, row) && !candidates.length) counts.unresolved_custom_conditions += 1;
    }
    const collisions = [...identities.entries()].filter(([, ids]) => ids.length > 1); counts.identity_collisions = collisions.length;
    domains[domain] = { counts, validation: validationCounts(domain, records), proposals, ambiguities, identity_collision_samples: collisions.slice(0, limit).map(([identity, ids]) => ({ identity_hash: identity.split('|').pop(), ids })), truncated: { proposals: counts.proposals > proposals.length, ambiguities: counts.ambiguities > ambiguities.length }, safety: { read_only: true, writes: 0, preserves_source_variants: true, no_schema_fields: true, no_prose_to_mechanics: true } };
  }
  return { deployment_id: SOURCE_AUDIT_DEPLOYMENT_ID, mode: 'read_only_source_audit', writes: 0, domains };
}