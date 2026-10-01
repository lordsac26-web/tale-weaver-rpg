import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveStoryStowTransition } from '../../shared/story/storyStowTransition.ts';
import { buildStoryClarification, confirmPersistedStoryPair, finishStoryPersistence } from '../../shared/story/storyPersistence.ts';
import { canonicalStoryResponsePayload, hashStoryValue, commitStoryTransition, acceptSequencedStoryPayload } from '../../shared/story/storyTransition.ts';
import { resolveUnifiedStorySkillCheck } from '../../shared/story/unifiedStorySkillResolution.ts';
import { executeStowAction } from '../../shared/story/stowIntent.ts';
import { selectStoryChoice } from '../../shared/story/selectedStoryChoice.ts';
import { finalizeGeneratedStoryResult } from '../../shared/story/storyBootstrap.ts';
import { resolveFailedCheckCandidate } from '../../shared/story/failedCheckContinuation.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req), db = base44.asServiceRole;
  const results = [], fixtures = [], cleanup = [];
  const record = (name, pass) => results.push({ name, pass: !!pass });
  let before, sourceEvidence;
  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    await req.json();
    before = await hashValue(await readProtectedDndState(db));
    const source = await db.entities.GameSession.get('6a6825edd695bd65a4322256');
    const sourceCharacter = await db.entities.Character.get(source.character_id);
    const incidentId = 'story-action:6a6825edd695bd65a4322256:1790817659048:q23g5d';
    const incident = source.world_state.__skill_check_receipts.find(x => x.request_id === incidentId);
    if (!incident || incident.action_text !== 'stealthily place the corpses in the bag of holding') throw new Error('Exact new incident evidence is missing; do not substitute the earlier Athletics failure.');
    sourceEvidence = { request_id: incidentId, action_text: incident.action_text, raw: incident.raw_d20, modifier: incident.modifier_total, final: incident.final_total, dc: incident.dc, success: incident.success, at: incident.at, accepted_pair_present: source.story_log.some(x => x.request_id === incidentId) };
    record('new live receipt is Stealth19+17=36 success, not Athletics failure', incident.raw_d20 === 19 && incident.final_total === 36 && incident.dc === 14 && incident.success && !sourceEvidence.accepted_pair_present);
    const tag = `PersistenceQA_${Date.now()}`;
    for (const mode of ['ai', 'player']) for (const success of [false, true]) for (const selected of [false, true]) {
      const label = `${mode}-${success ? 'success' : 'failure'}-${selected ? 'selected' : 'custom'}`;
      const { id: ignoreId, created_date: ignoreCreated, updated_date: ignoreUpdated, created_by: ignoreOwner, created_by_id: ignoreOwnerId, ...characterData } = sourceCharacter;
      const c = await base44.entities.Character.create({ ...characterData, name: `${tag}_${label}`, roll_mode: mode, is_active: false });
      fixtures.push(['Character', c.id]);
      const sourceEntry = structuredClone(source.story_log.at(-1));
      sourceEntry.request_id = `${tag}:${label}:source`;
      if (selected) sourceEntry.choices[0] = { text: incident.action_text, action_type: 'skill_check', skill_check: 'Stealth', dc: success ? 14 : 30, recovery: null };
      sourceEntry.choice_evidence.response_payload_hash = await hashStoryValue(canonicalStoryResponsePayload({ requestId: sourceEntry.request_id, text: sourceEntry.text, choices: sourceEntry.choices, skillCheck: sourceEntry.skill_check }));
      const s = await base44.entities.GameSession.create({ character_id: c.id, title: `${tag}_${label}`, story_log: [sourceEntry], current_location: source.current_location, world_state: { ...source.world_state, __skill_check_receipts: [], active_concentration: { ...source.world_state.active_concentration, character_id: c.id, target_id: c.id, caster_id: c.id } }, in_combat: false, combat_state: {}, is_active: false });
      fixtures.push(['GameSession', s.id]);
      // Remap effect identities in the disposable character only; no live effect writes.
      await db.entities.Character.update(c.id, { conditions: c.conditions.map(x => ({ ...x, target_id: x.target_id === sourceCharacter.id ? c.id : x.target_id, caster_id: x.caster_id === sourceCharacter.id ? c.id : x.caster_id })), active_modifiers: c.active_modifiers.map(x => ({ ...x, character_id: x.character_id === sourceCharacter.id ? c.id : x.character_id, target_id: x.target_id === sourceCharacter.id ? c.id : x.target_id, caster_id: x.caster_id === sourceCharacter.id ? c.id : x.caster_id })) });
      const characterBefore = await hashValue(await db.entities.Character.get(c.id));
      const id = `${tag}:${label}:attempt`, raw = success ? 19 : 1;
      const payload = { session_id: s.id, character_id: c.id, request_id: id, action_text: incident.action_text, skill: 'Stealth', dc: success ? 14 : 30, ...(mode === 'player' ? { raw_d20: raw, all_rolls: [raw], roll_origin: 'player' } : {}) };
      let rolls = 0;
      const resolved = await resolveUnifiedStorySkillCheck({ db, user, payload, rollD20Fn: () => { rolls++; return raw; } });
      const receipt = resolved.body.receipt;
      record(`${label}: authoritative roll preserves branch and mode`, receipt?.success === success && receipt.roll_origin === mode && receipt.raw_d20 === raw && rolls === (mode === 'ai' ? 1 : 0));
      const selection = selectStoryChoice({ latestChoices: sourceEntry.choices, ...(selected ? { choiceIndex: 0, choiceText: incident.action_text } : { customInput: incident.action_text }), context: { check: receipt } });
      record(`${label}: exact custom/selected contract uses intended action`, selection.ok && selection.contract.text === incident.action_text);
      const stow = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: s.id, character_id: c.id, request_id: id, action_text: selection.contract.text, check: receipt } });
      if (success) {
        const old = { narrative: stow.body.message, choices: [], clarification_required: true, preserve_scene: true, writes: 0 };
        record(`${label}: reproduces exact pre-fix persistence_unconfirmed branch`, stow.body.clarification_required && acceptSequencedStoryPayload(old, 1, 1).reason === 'persistence_unconfirmed');
        const production = await resolveStoryStowTransition({ base44, ownerId: user.id, session: await db.entities.GameSession.get(s.id), characterId: c.id, requestId: id, actionText: selection.contract.text, check: receipt });
        const clarified = production.response;
        record(`${label}: shared production stow branch returns verified clarification`, clarified?.status === 200 && clarified.body.response_kind === 'clarification');
        const afterClarification = await db.entities.GameSession.get(s.id);
        record(`${label}: fresh preserved pair is confirmed without fake narrative commit`, clarified.status === 200 && clarified.body.response_kind === 'clarification' && clarified.body.writes === 0 && acceptSequencedStoryPayload(clarified.body, 1, 1).accepted && afterClarification.story_log.length === 1 && clarified.body.check_receipt.request_id === id);
        const second = await buildStoryClarification({ db, sessionId: s.id, characterId: c.id, requestId: id, sourceRequestId: sourceEntry.request_id, stow: stow.body });
        record(`${label}: repeated clarification is read-only and keeps same roll and scene`, second.status === 200 && JSON.stringify(second.body.check_receipt) === JSON.stringify(receipt) && JSON.stringify(afterClarification.story_log) === JSON.stringify((await db.entities.GameSession.get(s.id)).story_log));
      } else record(`${label}: failed stow remains legitimate zero-write outcome`, stow.body.reason === 'failed_check' && stow.body.writes === 0);
      const candidate = await resolveFailedCheckCandidate({ candidate: { narrative: success ? 'The route is inspected; no corpse was moved.' : 'The attempt fails; the bodies remain where they were.', choices: sourceEntry.choices, current_recovery: null, loot: [], hp_change: 0 }, check: receipt });
      const result = finalizeGeneratedStoryResult(candidate, { location: s.current_location, requestId: id, previousChoices: sourceEntry.choices });
      const entry = { request_id: id, text: result.narrative, choices: result.choices, player_choice: incident.action_text, skill_check: receipt, mechanics_status: 'pending' };
      const expectedHash = await hashStoryValue(canonicalStoryResponsePayload({ requestId: id, text: entry.text, choices: entry.choices, skillCheck: receipt }));
      entry.choice_evidence = { response_payload_hash: expectedHash };
      const fresh = await db.entities.GameSession.get(s.id);
      await db.entities.GameSession.update(s.id, { story_log: commitStoryTransition(fresh.story_log, entry, id).story_log });
      const partialBefore = await hashValue(await db.entities.GameSession.get(s.id));
      const partial = await confirmPersistedStoryPair({ readSession: () => db.entities.GameSession.get(s.id), requestId: id, expectedHash });
      record(`${label}: staged/partial write cannot replay as completed or duplicate consequences`, partial.status === 409 && partial.body.error_code === 'partial_mechanics_commit' && partial.body.partial_write_possible && partialBefore === await hashValue(await db.entities.GameSession.get(s.id)));
      const finished = await finishStoryPersistence({ db, sessionId: s.id, requestId: id, expectedHash });
      const saved = await db.entities.GameSession.get(s.id);
      record(`${label}: response uses actual post-write reread and complete marker`, finished.status === 200 && finished.body.story_entry.mechanics_status === 'complete' && JSON.stringify(finished.body.story_entry) === JSON.stringify(saved.story_log.at(-1)) && acceptSequencedStoryPayload(finished.body, 1, 1).accepted && saved.story_log.at(-1).skill_check.success === success);
      const bytes = await hashValue(saved);
      const retryRoll = await resolveUnifiedStorySkillCheck({ db, user, payload: { ...payload, raw_d20: 20, all_rolls: [20] }, rollD20Fn: () => { throw new Error('Retry must not roll'); } });
      const retry = await finishStoryPersistence({ db, sessionId: s.id, requestId: id, expectedHash });
      record(`${label}: lost-response retry reuses original roll and story with zero writes`, retryRoll.body.writes === 0 && retryRoll.body.raw === raw && retry.status === 200 && bytes === await hashValue(await db.entities.GameSession.get(s.id)));
      record(`${label}: HP/damage ammo slots stowed items and inventory unchanged`, characterBefore === await hashValue(await db.entities.Character.get(c.id)));
      const corrupt = structuredClone(saved); corrupt.story_log.at(-1).text = 'An unverified replacement';
      const mismatch = await confirmPersistedStoryPair({ readSession: async () => corrupt, requestId: id, expectedHash });
      record(`${label}: hash corruption fails closed rather than trusting persistence flag`, mismatch.status === 409 && mismatch.body.error_code === 'persisted_pair_hash_mismatch');
      const ambiguous = structuredClone(saved); ambiguous.story_log.push(structuredClone(saved.story_log.at(-1)));
      const duplicate = await confirmPersistedStoryPair({ readSession: async () => ambiguous, requestId: id });
      record(`${label}: ambiguous request identity fails closed without mutations`, duplicate.status === 409 && duplicate.body.error_code === 'ambiguous_request_entries');
      let reads = 0;
      const delayed = await confirmPersistedStoryPair({ readSession: async () => ++reads < 3 ? { ...saved, story_log: [sourceEntry] } : saved, requestId: id, expectedHash, afterWrite: true });
      record(`${label}: delayed visibility uses bounded authoritative rereads`, delayed.status === 200 && reads === 3);
      const missing = await confirmPersistedStoryPair({ readSession: async () => ({ ...saved, story_log: [sourceEntry] }), requestId: id, expectedHash, afterWrite: true });
      record(`${label}: permanently missing post-write entry reports uncertainty, never writes zero`, missing.status === 409 && missing.body.partial_write_possible && missing.body.writes === null);
      record(`${label}: original failed source scene remains byte-identical`, JSON.stringify((await db.entities.GameSession.get(s.id)).story_log[0]) === JSON.stringify(sourceEntry));
    }
  } catch (error) { results.push({ name: 'execution', pass: false, detail: error.message }); }
  finally {
    for (const [entity, id] of fixtures.reverse()) {
      await db.entities[entity].delete(id);
      cleanup.push({ entity, id, verified_absent: (await db.entities[entity].filter({ id })).length === 0 });
    }
  }
  record('all 16 exact fixture IDs confirmed absent', cleanup.length === 16 && cleanup.every(x => x.verified_absent));
  const after = await hashValue(await readProtectedDndState(db));
  record('actual protected before/after hashes match', before === after);
  const passed = results.filter(x => x.pass).length;
  return Response.json({ version: 'live-story-persistence-regression-v1', source_evidence: sourceEvidence, passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, cleanup, protected_before: before, protected_after: after, protected_unchanged: before === after }, { status: passed === results.length ? 200 : 500 });
}