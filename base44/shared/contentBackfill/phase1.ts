import { hashAuditValue, normalizeAuditName, paginateCatalog } from '../contentAudit/engine.ts';
import { COMPLETED_PHASE1_BATCH } from './completedPhase1Batch.ts';

export const PHASE1_DEPLOYMENT_ID = 'content-backfill-phase1-v1';
export const PHASE1_DOMAINS = ['Spell', 'DnDCondition'];
const PROTECTED = [['Character', '6a6825cd07a490fa70a46852'], ['GameSession', '6a6825edd695bd65a4322256'], ['CombatLog', '6a767f23ec36fe219063ae49'], ['CombatLog', '6a77463582a26b50018110ea']];
const APPLY_RECEIPTS = new Map();
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

const protectedSnapshot = async (base44) => Promise.all(PROTECTED.map(async ([entity, id]) => { let record = null; try { record = await base44.asServiceRole.entities[entity].get(id); } catch {} return { entity, id, exists: !!record, hash: await hashAuditValue(record) }; }));
const unrelatedProjection = (record) => { const { description, updated_date, ...unrelated } = record || {}; return unrelated; };
const rememberReceipt = (key, body) => { APPLY_RECEIPTS.set(key, body); if (APPLY_RECEIPTS.size > 100) APPLY_RECEIPTS.delete(APPLY_RECEIPTS.keys().next().value); };
export const forgetPhase1Receipt = (approvalId, proposalHash) => APPLY_RECEIPTS.delete(`${approvalId}:${proposalHash}`);

const matchingCompletedBatch = (approvalId, proposalHash, completedBatch) => {
  const candidate = completedBatch || COMPLETED_PHASE1_BATCH;
  return candidate?.approvalId === approvalId && candidate?.proposalHash === proposalHash ? candidate : null;
};

async function verifyCompletedBatch(base44, batch, scopeIds) {
  const records = await loadPhase1Records(base44, scopeIds);
  const conditions = new Map(records.DnDCondition.map((record) => [record.id, record]));
  const mismatches = [];
  for (const expected of batch.recipients) {
    const record = conditions.get(expected.id);
    const actualHash = record ? await hashAuditValue(record.description) : null;
    if (actualHash !== expected.expectedDescriptionHash) mismatches.push({ recipient_id: expected.id, expected_description_hash: expected.expectedDescriptionHash, actual_description_hash: actualHash, reason: record ? 'description hash mismatch' : 'recipient missing' });
  }
  const remainingPlan = await buildPhase1Plan(records);
  for (const proposal of remainingPlan.proposals.filter((item) => item.domain === 'DnDCondition')) mismatches.push({ recipient_id: proposal.recipient_id, expected_description_hash: proposal.proposed_value_hash, actual_description_hash: proposal.before_value_hash, reason: 'eligible proposal remains' });
  return { mismatches, remainingProposalHash: remainingPlan.proposal_hash };
}

export async function applyPhase1Plan({ base44, proposalHash, approvalId, scopeIds = null, completedBatch = null }) {
  if (!approvalId || typeof approvalId !== 'string') return { status: 400, body: { error: 'approval_id is required', writes: 0 } };
  if (!proposalHash || typeof proposalHash !== 'string') return { status: 400, body: { error: 'proposal_hash is required', writes: 0 } };
  const receiptKey = `${approvalId}:${proposalHash}`;
  const prior = APPLY_RECEIPTS.get(receiptKey);
  if (prior) return { status: 200, body: { ...prior, already_applied: true, writes: 0, applied_count: 0, applied: [] } };
  const completed = matchingCompletedBatch(approvalId, proposalHash, completedBatch);
  if (completed) {
    const verificationScope = scopeIds || new Set(completed.recipients.map((recipient) => recipient.id));
    const verification = await verifyCompletedBatch(base44, completed, verificationScope);
    if (verification.mismatches.length) return { status: 409, body: { error: 'completed batch postconditions do not match', approval_id: approvalId, proposal_hash: proposalHash, writes: 0, postcondition_mismatches: verification.mismatches } };
    return { status: 200, body: { deployment_id: PHASE1_DEPLOYMENT_ID, mode: 'apply', approval_id: approvalId, proposal_hash: proposalHash, already_applied: true, writes: 0, applied_count: 0, original_applied_count: completed.originalAppliedCount, applied: [], applied_ids: completed.recipients.map((recipient) => recipient.id), postconditions_verified: true } };
  }

  const firstRecords = await loadPhase1Records(base44, scopeIds);
  const firstPlan = await buildPhase1Plan(firstRecords);
  if (firstPlan.proposal_hash !== proposalHash) return { status: 409, body: { error: 'stale or incorrect proposal_hash', writes: 0, supplied_proposal_hash: proposalHash, current_proposal_hash: firstPlan.proposal_hash } };

  const immediateRecords = await loadPhase1Records(base44, scopeIds);
  const immediatePlan = await buildPhase1Plan(immediateRecords);
  if (immediatePlan.proposal_hash !== proposalHash) return { status: 409, body: { error: 'proposal set changed during preflight', writes: 0, supplied_proposal_hash: proposalHash, current_proposal_hash: immediatePlan.proposal_hash } };
  const eligible = immediatePlan.proposals.filter((proposal) => proposal.domain === 'DnDCondition' && proposal.field === 'description');
  const beforeProtected = await protectedSnapshot(base44); const before = [];
  for (const proposal of eligible) {
    const recipient = immediateRecords.DnDCondition.find((row) => row.id === proposal.recipient_id);
    const donor = immediateRecords.DnDCondition.find((row) => row.id === proposal.donor_id);
    const current = immediatePlan.proposals.find((item) => item.domain === proposal.domain && item.recipient_id === proposal.recipient_id);
    const recipientHash = recipient ? await hashAuditValue(recipient.description) : null;
    const donorHash = donor ? await hashAuditValue(pathValue(donor, proposal.source_path)) : null;
    if (!recipient || !donor || !current || recipientHash !== proposal.before_value_hash || donorHash !== proposal.donor_value_hash || current.cluster_hash !== proposal.cluster_hash) return { status: 409, body: { error: 'recipient, donor, or cluster changed during preflight', recipient_id: proposal.recipient_id, writes: 0 } };
    before.push({ id: recipient.id, name: recipient.name, before_hash: await hashAuditValue(recipient), description_before_hash: recipientHash, unrelated_before_hash: await hashAuditValue(unrelatedProjection(recipient)), proposed_value: proposal.proposed_value, proposed_value_hash: proposal.proposed_value_hash });
  }
  if (eligible.length) await base44.asServiceRole.entities.DnDCondition.bulkUpdate(eligible.map((proposal) => ({ id: proposal.recipient_id, description: proposal.proposed_value })));

  const applied = [];
  for (const proof of before) {
    const after = await base44.asServiceRole.entities.DnDCondition.get(proof.id);
    const descriptionAfterHash = await hashAuditValue(after?.description);
    const unrelatedAfterHash = await hashAuditValue(unrelatedProjection(after));
    applied.push({ id: proof.id, name: proof.name, before_hash: proof.before_hash, after_hash: await hashAuditValue(after), description_before_hash: proof.description_before_hash, description_after_hash: descriptionAfterHash, expected_description_hash: proof.proposed_value_hash, unrelated_before_hash: proof.unrelated_before_hash, unrelated_after_hash: unrelatedAfterHash, unrelated_fields_unchanged: proof.unrelated_before_hash === unrelatedAfterHash, description_applied: descriptionAfterHash === proof.proposed_value_hash });
  }
  const afterProtected = await protectedSnapshot(base44);
  const protected_state = beforeProtected.map((item, index) => ({ ...item, after_hash: afterProtected[index].hash, unchanged: item.hash === afterProtected[index].hash }));
  const body = { deployment_id: PHASE1_DEPLOYMENT_ID, mode: 'apply', approval_id: approvalId, already_applied: false, writes: applied.length, applied_count: applied.length, original_applied_count: applied.length, proposal_hash: proposalHash, ignored_spell_proposals: immediatePlan.counts.Spell, applied_ids: applied.map((item) => item.id), applied_names: applied.map((item) => item.name), applied, unrelated_fields_unchanged: applied.every((item) => item.unrelated_fields_unchanged), protected_state };
  rememberReceipt(receiptKey, body);
  return { status: 200, body };
}