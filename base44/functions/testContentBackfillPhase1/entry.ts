import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyPhase1Plan, buildPhase1Plan, loadPhase1Records, PHASE1_DEPLOYMENT_ID } from '../../shared/contentBackfill/phase1.ts';
import { DOMAIN_NAMES } from '../../shared/contentAudit/config.ts';
import { hashAuditValue, paginateCatalog } from '../../shared/contentAudit/engine.ts';

const PROTECTED = [['Character', '6a6825cd07a490fa70a46852'], ['GameSession', '6a6825edd695bd65a4322256'], ['CombatLog', '6a767f23ec36fe219063ae49'], ['CombatLog', '6a77463582a26b50018110ea']];
const catalogSnapshot = async (base44) => Object.fromEntries(await Promise.all(DOMAIN_NAMES.map(async (domain) => { const { records } = await paginateCatalog(base44, domain, 173); return [domain, { count: records.length, updated_date_hash: await hashAuditValue(records.map((row) => ({ id: row.id, updated_date: row.updated_date || null })).sort((a, b) => String(a.id).localeCompare(String(b.id)))), content_hash: await hashAuditValue(records) }]; })));
const protectedSnapshot = async (base44) => Promise.all(PROTECTED.map(async ([entity, id]) => { let record = null; try { record = await base44.asServiceRole.entities[entity].get(id); } catch {} return { entity, id, exists: !!record, hash: await hashAuditValue(record) }; }));
const mechanics = { level: 3, school: 'Transmutation', casting_time: '1 action', range: 'Self', duration: '1 minute', components: 'V, S', concentration: true, ritual: false };

export default async function testContentBackfillPhase1(req) {
  const results = []; const fixtures = []; const cleanup = []; let output = null;
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json(); const beforeProtected = await protectedSnapshot(base44); const beforeDry = await catalogSnapshot(base44);
    const liveDry = await buildPhase1Plan(await loadPhase1Records(base44)); const afterDry = await catalogSnapshot(base44);
    results.push({ name: 'live dry-run leaves all ten catalog count, updated_date, and content snapshots unchanged', pass: JSON.stringify(beforeDry) === JSON.stringify(afterDry) && liveDry.writes === 0 });
    const token = `Phase1QA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createSpell = async (suffix, description, source, overrides = {}) => { const row = await base44.entities.Spell.create({ name: `${token}_${suffix}`, description, raw_data: { document: source }, ...mechanics, ...overrides }); fixtures.push(['Spell', row.id]); return row; };
    const createCondition = async (name, description, mechanical_effects = undefined) => { const row = await base44.entities.DnDCondition.create({ name, description, ...(mechanical_effects === undefined ? {} : { mechanical_effects }) }); fixtures.push(['DnDCondition', row.id]); return row; };
    const sameName = `${token}_unanimous`; const spellRecipient = await createSpell('unanimous', '', { key: 'SRD5.2', version: '5.2' }); const donorA = await createSpell('unanimous', 'Unanimous lawful prose.', { key: 'SRD5.2', version: '5.2' }); const donorB = await createSpell('unanimous', 'Unanimous   lawful prose.', { key: 'SRD5.2', version: '5.2' });
    const mismatchRecipient = await createSpell('mismatch', '', { key: 'SRD5.2', version: '5.2' }); await createSpell('mismatch', 'Wrong mechanics.', { key: 'SRD5.2', version: '5.2' }, { range: '120 feet' });
    const thirdRecipient = await createSpell('thirdparty', '', { key: 'SRD5.2', version: '5.2' }); await createSpell('thirdparty', 'Third party prose.', { key: 'Homebrew third-party', version: '1' });
    const conflictRecipient = await createSpell('conflict', '', { key: 'SRD5.2', version: '5.2' }); await createSpell('conflict', 'First prose.', { key: 'SRD5.2', version: '5.2' }); await createSpell('conflict', 'Second prose.', { key: 'SRD5.2', version: '5.2' });
    const filled = await createSpell('filled', 'Already complete.', { key: 'SRD5.2', version: '5.2' }); await createSpell('filled', 'Donor prose.', { key: 'SRD5.2', version: '5.2' });
    const conditionName = `${token}_condition`; const conditionRecipient = await createCondition(conditionName, []); const conditionDonorA = await createCondition(conditionName, ['Same condition prose.'], { keep: true }); await createCondition(conditionName, ['Same   condition prose.']);
    const conditionConflict = `${token}_condition_conflict`; const conditionConflictRecipient = await createCondition(conditionConflict, []); await createCondition(conditionConflict, ['First condition prose.']); await createCondition(conditionConflict, ['Second condition prose.']);
    const conditionPlaceholder = `${token}_condition_placeholder`; const conditionPlaceholderRecipient = await createCondition(conditionPlaceholder, []); await createCondition(conditionPlaceholder, ['TBD']);
    const scopeIds = new Set(fixtures.map(([, id]) => id)); const fixtureRecords = await loadPhase1Records(base44, scopeIds); const plan = await buildPhase1Plan(fixtureRecords);
    const proposalFor = (id) => plan.proposals.find((proposal) => proposal.recipient_id === id); const blockedFor = (id) => plan.ambiguity_blocks.find((block) => block.recipient_id === id);
    results.push({ name: 'unanimous mechanically identical Spell donor is eligible', pass: !!proposalFor(spellRecipient.id) && proposalFor(spellRecipient.id).donor_ids.length === 2 });
    results.push({ name: 'mechanically mismatched Spell donor is rejected', pass: !proposalFor(mismatchRecipient.id) && blockedFor(mismatchRecipient.id)?.reason === 'no mechanically matching donor' });
    results.push({ name: 'third-party donor is rejected for SRD recipient', pass: !proposalFor(thirdRecipient.id) && /source policy/.test(blockedFor(thirdRecipient.id)?.reason || '') });
    results.push({ name: 'conflicting top-precedence Spell prose is rejected', pass: !proposalFor(conflictRecipient.id) && /conflicting/.test(blockedFor(conflictRecipient.id)?.reason || '') });
    results.push({ name: 'already-filled Spell recipient is never proposed', pass: !proposalFor(filled.id) });
    results.push({ name: 'unanimous Condition duplicate is eligible', pass: !!proposalFor(conditionRecipient.id) && proposalFor(conditionRecipient.id).donor_ids.length === 2 });
    results.push({ name: 'conflicting Condition cluster is rejected', pass: !proposalFor(conditionConflictRecipient.id) && /conflicting/.test(blockedFor(conditionConflictRecipient.id)?.reason || '') });
    results.push({ name: 'placeholder-only Condition donor is rejected', pass: !proposalFor(conditionPlaceholderRecipient.id) && /placeholder/.test(blockedFor(conditionPlaceholderRecipient.id)?.reason || '') });
    const stalePlan = await buildPhase1Plan({ Spell: [mismatchRecipient, { ...mismatchRecipient, id: donorA.id, description: 'Temporary donor.', name: mismatchRecipient.name }], DnDCondition: [] });
    await base44.asServiceRole.entities.Spell.update(mismatchRecipient.id, { description: 'Changed after dry-run.' });
    const stale = await applyPhase1Plan({ base44, submittedPlan: stalePlan, proposalHash: stalePlan.proposal_hash, approvalId: `${token}:stale`, scopeIds: new Set([mismatchRecipient.id, donorA.id]) });
    results.push({ name: 'stale recipient hash fails closed with no backfill write', pass: stale.status === 409 && stale.body.writes === 0 });
    const conditionBefore = await base44.asServiceRole.entities.DnDCondition.get(conditionRecipient.id); const conditionDonorBefore = await base44.asServiceRole.entities.DnDCondition.get(conditionDonorA.id);
    const conditionMechanicsBefore = await hashAuditValue(conditionBefore.mechanical_effects); const donorMechanicsBefore = await hashAuditValue(conditionDonorBefore.mechanical_effects);
    const applied = await applyPhase1Plan({ base44, submittedPlan: plan, proposalHash: plan.proposal_hash, approvalId: `${token}:apply`, scopeIds }); const replay = await applyPhase1Plan({ base44, submittedPlan: plan, proposalHash: plan.proposal_hash, approvalId: `${token}:apply`, scopeIds });
    const spellAfter = await base44.asServiceRole.entities.Spell.get(spellRecipient.id); const conditionAfter = await base44.asServiceRole.entities.DnDCondition.get(conditionRecipient.id); const conditionDonorAfter = await base44.asServiceRole.entities.DnDCondition.get(conditionDonorA.id);
    results.push({ name: 'fixture apply writes only two eligible descriptions', pass: applied.status === 200 && applied.body.writes === 2 && spellAfter.description === 'Unanimous lawful prose.' && Array.isArray(conditionAfter.description), diagnostic: applied.body });
    results.push({ name: 'Condition backfill never writes mechanical_effects', pass: await hashAuditValue(conditionAfter.mechanical_effects) === conditionMechanicsBefore && await hashAuditValue(conditionDonorAfter.mechanical_effects) === donorMechanicsBefore });
    results.push({ name: 'fixture apply replay is idempotent with writes zero', pass: replay.status === 200 && replay.body.already_applied === true && replay.body.writes === 0, diagnostic: replay.body });
    const afterProtected = await protectedSnapshot(base44); results.push({ name: 'protected live record hashes remain unchanged', pass: JSON.stringify(beforeProtected) === JSON.stringify(afterProtected) });
    const passed = results.filter((result) => result.pass).length; const failed = results.length - passed;
    output = { deployment_id: PHASE1_DEPLOYMENT_ID, passed, failed, total: results.length, all_pass: failed === 0, failures: results.filter((result) => !result.pass), live_dry_run: { proposal_hash: liveDry.proposal_hash, counts: liveDry.counts, proposal_ids: liveDry.proposals.map((proposal) => proposal.recipient_id), ambiguity_blocks: liveDry.ambiguity_blocks }, zero_write_proof: { dry_run_unchanged: JSON.stringify(beforeDry) === JSON.stringify(afterDry), catalogs: beforeDry }, protected_state: beforeProtected.map((before, index) => ({ ...before, after_hash: afterProtected[index].hash, unchanged: before.hash === afterProtected[index].hash })) };
  } catch (error) {
    output = { deployment_id: PHASE1_DEPLOYMENT_ID, error: error.message || 'Phase 1 regression failed', results };
  } finally {
    const base44 = createClientFromRequest(req);
    for (const [entity, id] of fixtures.reverse()) { let deleted = false; let absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { absent = true; } cleanup.push({ entity, id, deleted, absent }); }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.absent);
  return Response.json({ ...(output || { deployment_id: PHASE1_DEPLOYMENT_ID, error: 'No test output' }), cleanup, cleanup_passed: cleanupPassed }, { status: output?.all_pass && cleanupPassed ? 200 : 500 });
}