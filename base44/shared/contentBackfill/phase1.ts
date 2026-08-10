import { hashAuditValue, normalizeAuditName, paginateCatalog } from '../contentAudit/engine.ts';

export const PHASE1_DEPLOYMENT_ID = 'content-backfill-phase1-v1';
export const PHASE1_DOMAINS = ['Spell', 'DnDCondition'];
const PLACEHOLDER = /^(?:n\/?a|none|unknown|tbd|todo|placeholder|no description|description unavailable|not available|coming soon|-+)\.?$/i;
const collapse = (value) => String(value ?? '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim();
const pathValue = (record, path) => path.split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, record);
const usableText = (value) => {
  const text = Array.isArray(value) ? value.filter((item) => typeof item === 'string').map(collapse).filter(Boolean).join(' • ') : collapse(value);
  return text && !PLACEHOLDER.test(text) ? text : '';
};
const normalizeProse = (value) => usableText(value).toLocaleLowerCase('en-US');
const sourceMeta = (record) => {
  const raw = record?.raw_data && typeof record.raw_data === 'object' ? record.raw_data : {};
  const documentValue = raw.document;
  const document = collapse(typeof documentValue === 'object' ? documentValue?.name || documentValue?.title || documentValue?.key : documentValue) || collapse(raw.source_document || raw.source || raw.url || raw.key) || 'unknown';
  const version = collapse((typeof documentValue === 'object' ? documentValue?.version : '') || raw.version || raw.document_version || raw.revision) || 'unknown';
  const key = collapse((typeof documentValue === 'object' ? documentValue?.key : '') || raw.key || raw.url) || document;
  const joined = `${document} ${version} ${key}`.toLowerCase();
  const srd = /srd\s*5[._ -]?2/.test(joined) ? '5.2' : /srd\s*5[._ -]?1/.test(joined) ? '5.1' : null;
  const thirdParty = /third.?party|homebrew|3pp/.test(joined);
  return { document, version, key, srd, third_party: thirdParty };
};
const donorText = (record) => {
  for (const path of ['description', 'raw_data.desc']) {
    const value = pathValue(record, path); const text = usableText(value);
    if (text) return { path, value: collapse(value), normalized: normalizeProse(value) };
  }
  return null;
};
const spellDisplayBlank = (record) => !['description', 'effect_summary', 'visual_summary', 'raw_data.desc', 'raw_data.description'].some((path) => usableText(pathValue(record, path)));
const normalizedMechanic = (value) => Array.isArray(value) ? value.map(collapse).filter(Boolean).sort().join('|').toLowerCase() : collapse(value).toLowerCase();
const spellMechanicsMatch = (recipient, donor) => {
  if (normalizedMechanic(recipient.level) !== normalizedMechanic(donor.level) || normalizedMechanic(recipient.school) !== normalizedMechanic(donor.school)) return false;
  for (const field of ['casting_time', 'range', 'duration', 'components', 'concentration', 'ritual']) {
    const recipientValue = normalizedMechanic(recipient[field]); const donorValue = normalizedMechanic(donor[field]);
    if (recipientValue && recipientValue !== donorValue) return false;
  }
  return true;
};
const precedence = (recipient, donor) => {
  const recipientSource = sourceMeta(recipient); const donorSource = sourceMeta(donor);
  if (recipientSource.srd && !donorSource.srd) return -1;
  if (recipientSource.third_party !== donorSource.third_party && recipientSource.srd) return -1;
  if (recipientSource.key !== 'unknown' && recipientSource.key === donorSource.key && recipientSource.version === donorSource.version) return 30;
  if (recipientSource.document !== 'unknown' && recipientSource.document === donorSource.document && recipientSource.version === donorSource.version) return 30;
  if (donorSource.srd === '5.2') return 20;
  if (donorSource.srd === '5.1') return 10;
  return donorSource.third_party ? 0 : 5;
};
const groupRows = (records) => {
  const groups = new Map();
  for (const record of records) { const name = normalizeAuditName(record?.name) || '(missing-name)'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(record); }
  return groups;
};
const clusterHash = async (group) => hashAuditValue(await Promise.all(group.map(async (record) => ({ id: record.id, name: normalizeAuditName(record.name), description_hash: await hashAuditValue(record.description), source: sourceMeta(record), mechanics: { level: record.level, school: record.school, casting_time: record.casting_time, range: record.range, duration: record.duration, components: record.components, concentration: record.concentration, ritual: record.ritual } }))));

async function spellPlan(records) {
  const proposals = []; const ambiguity_blocks = [];
  for (const [name, group] of groupRows(records)) for (const recipient of group.filter(spellDisplayBlank)) {
    const matching = group.filter((candidate) => candidate.id !== recipient.id && donorText(candidate) && spellMechanicsMatch(recipient, candidate));
    const permitted = matching.map((donor) => ({ donor, rank: precedence(recipient, donor), text: donorText(donor) })).filter((entry) => entry.rank >= 0);
    if (!permitted.length) { ambiguity_blocks.push({ domain: 'Spell', recipient_id: recipient.id, normalized_name: name, reason: matching.length ? 'all mechanically matching donors rejected by source policy' : 'no mechanically matching donor' }); continue; }
    const topRank = Math.max(...permitted.map((entry) => entry.rank)); const top = permitted.filter((entry) => entry.rank === topRank);
    const proseHashes = new Map();
    for (const entry of top) { const hash = await hashAuditValue(entry.text.normalized); if (!proseHashes.has(hash)) proseHashes.set(hash, []); proseHashes.get(hash).push(entry); }
    if (proseHashes.size !== 1) { ambiguity_blocks.push({ domain: 'Spell', recipient_id: recipient.id, normalized_name: name, reason: 'conflicting top-precedence donor prose', donor_ids: top.map((entry) => entry.donor.id), prose_hashes: [...proseHashes.keys()] }); continue; }
    const selected = [...proseHashes.values()][0].sort((a, b) => String(a.donor.id).localeCompare(String(b.donor.id)))[0];
    proposals.push({ domain: 'Spell', recipient_id: recipient.id, donor_id: selected.donor.id, donor_ids: top.map((entry) => entry.donor.id).sort(), normalized_name: name, field: 'description', source_path: selected.text.path, source_document: sourceMeta(selected.donor), recipient_source_document: sourceMeta(recipient), before_value_hash: await hashAuditValue(recipient.description), donor_value_hash: await hashAuditValue(selected.text.value), proposed_value_hash: await hashAuditValue(selected.text.value), proposed_value: selected.text.value, cluster_hash: await clusterHash(group), reason: 'blank display recovered from unanimous top-precedence mechanically matching same-name donor' });
  }
  return { proposals, ambiguity_blocks };
}

async function conditionPlan(records) {
  const proposals = []; const ambiguity_blocks = [];
  for (const [name, group] of groupRows(records)) {
    const recipients = group.filter((record) => !collapse(Array.isArray(record.description) ? record.description.join(' ') : record.description));
    if (!recipients.length) continue;
    const populated = group.filter((record) => collapse(Array.isArray(record.description) ? record.description.join(' ') : record.description));
    const usable = populated.filter((record) => usableText(record.description));
    if (!usable.length) { for (const recipient of recipients) ambiguity_blocks.push({ domain: 'DnDCondition', recipient_id: recipient.id, normalized_name: name, reason: populated.length ? 'only placeholder donors available' : 'no populated same-name donor' }); continue; }
    const hashes = new Map();
    for (const donor of populated) { const hash = await hashAuditValue(normalizeProse(donor.description)); if (!hashes.has(hash)) hashes.set(hash, []); hashes.get(hash).push(donor); }
    if (hashes.size !== 1 || populated.some((record) => !usableText(record.description))) { for (const recipient of recipients) ambiguity_blocks.push({ domain: 'DnDCondition', recipient_id: recipient.id, normalized_name: name, reason: hashes.size > 1 ? 'conflicting populated same-name descriptions' : 'placeholder donor makes cluster non-unanimous', donor_ids: populated.map((record) => record.id), prose_hashes: [...hashes.keys()] }); continue; }
    const donors = [...usable].sort((a, b) => String(a.id).localeCompare(String(b.id))); const donor = donors[0]; const value = donor.description;
    for (const recipient of recipients) proposals.push({ domain: 'DnDCondition', recipient_id: recipient.id, donor_id: donor.id, donor_ids: donors.map((record) => record.id), normalized_name: name, field: 'description', source_path: 'description', source_document: { document: 'unknown', version: 'unknown', key: 'DnDCondition', srd: null, third_party: false }, before_value_hash: await hashAuditValue(recipient.description), donor_value_hash: await hashAuditValue(value), proposed_value_hash: await hashAuditValue(value), proposed_value: value, cluster_hash: await clusterHash(group), reason: 'blank description recovered from unanimous non-placeholder same-name condition donors' });
  }
  return { proposals, ambiguity_blocks };
}

export async function buildPhase1Plan(recordsByDomain) {
  const spell = await spellPlan(recordsByDomain.Spell || []); const condition = await conditionPlan(recordsByDomain.DnDCondition || []);
  const proposals = [...spell.proposals, ...condition.proposals].sort((a, b) => `${a.domain}:${a.recipient_id}`.localeCompare(`${b.domain}:${b.recipient_id}`));
  const ambiguity_blocks = [...spell.ambiguity_blocks, ...condition.ambiguity_blocks].sort((a, b) => `${a.domain}:${a.recipient_id}`.localeCompare(`${b.domain}:${b.recipient_id}`));
  const proposal_hash = await hashAuditValue(proposals);
  return { deployment_id: PHASE1_DEPLOYMENT_ID, mode: 'dry_run', writes: 0, counts: { total: proposals.length, Spell: proposals.filter((item) => item.domain === 'Spell').length, DnDCondition: proposals.filter((item) => item.domain === 'DnDCondition').length, ambiguity_blocks: ambiguity_blocks.length }, proposal_hash, proposals, ambiguity_blocks };
}

export async function loadPhase1Records(base44, scopeIds = null) {
  const records = {};
  for (const domain of PHASE1_DOMAINS) { const page = await paginateCatalog(base44, domain, 200); records[domain] = scopeIds ? page.records.filter((record) => scopeIds.has(record.id)) : page.records; }
  return records;
}

export async function applyPhase1Plan({ base44, submittedPlan, proposalHash, approvalId, scopeIds = null }) {
  if (!approvalId || typeof approvalId !== 'string') return { status: 400, body: { error: 'approval_id is required', writes: 0 } };
  if (!submittedPlan || !Array.isArray(submittedPlan.proposals) || proposalHash !== await hashAuditValue(submittedPlan.proposals)) return { status: 400, body: { error: 'proposal_hash does not match submitted dry-run proposals', writes: 0 } };
  const currentRecords = await loadPhase1Records(base44, scopeIds); const currentPlan = await buildPhase1Plan(currentRecords);
  if (currentPlan.proposal_hash !== proposalHash) {
    let alreadyApplied = submittedPlan.proposals.length > 0;
    for (const proposal of submittedPlan.proposals) {
      const current = currentRecords[proposal.domain]?.find((record) => record.id === proposal.recipient_id);
      if (!current || await hashAuditValue(current.description) !== proposal.proposed_value_hash) { alreadyApplied = false; break; }
    }
    if (alreadyApplied) return { status: 200, body: { deployment_id: PHASE1_DEPLOYMENT_ID, mode: 'apply', approval_id: approvalId, already_applied: true, writes: 0, proposal_hash: proposalHash } };
    return { status: 409, body: { error: 'stale proposal: live recipients, donors, clusters, or proposal set changed', writes: 0, expected_proposal_hash: proposalHash, current_proposal_hash: currentPlan.proposal_hash } };
  }
  for (const proposal of currentPlan.proposals) {
    const recipient = currentRecords[proposal.domain].find((record) => record.id === proposal.recipient_id); const donor = currentRecords[proposal.domain].find((record) => record.id === proposal.donor_id);
    const recipientHash = recipient ? await hashAuditValue(recipient.description) : null; const donorHash = donor ? await hashAuditValue(pathValue(donor, proposal.source_path)) : null;
    if (!recipient || !donor || recipientHash !== proposal.before_value_hash || donorHash !== proposal.donor_value_hash) return { status: 409, body: { error: 'stale proposal record hash', recipient_id: proposal.recipient_id, writes: 0, recipient_hash_match: recipientHash === proposal.before_value_hash, donor_hash_match: donorHash === proposal.donor_value_hash, expected_recipient_hash: proposal.before_value_hash, actual_recipient_hash: recipientHash, expected_donor_hash: proposal.donor_value_hash, actual_donor_hash: donorHash } };
  }
  const domain_results = [];
  for (const domain of PHASE1_DOMAINS) {
    const domainProposals = currentPlan.proposals.filter((proposal) => proposal.domain === domain);
    if (domainProposals.length) await base44.asServiceRole.entities[domain].bulkUpdate(domainProposals.map((proposal) => ({ id: proposal.recipient_id, description: proposal.proposed_value })));
    domain_results.push({ domain, writes: domainProposals.length, ids: domainProposals.map((proposal) => proposal.recipient_id) });
  }
  return { status: 200, body: { deployment_id: PHASE1_DEPLOYMENT_ID, mode: 'apply', approval_id: approvalId, already_applied: false, writes: currentPlan.proposals.length, proposal_hash: proposalHash, domain_results } };
}