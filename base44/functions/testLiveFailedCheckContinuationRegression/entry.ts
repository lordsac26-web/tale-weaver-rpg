import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveFailedCheckCandidate, resolveNarratedStowCandidate } from '../../shared/story/failedCheckContinuation.ts';
import { executeStowAction, classifyStowIntent } from '../../shared/story/stowIntent.ts';
import { guardAndCommitNarratedRecovery } from '../../shared/story/storyRecoveryGuard.ts';
import { resolveGeneratedRecoveryCandidate } from '../../shared/story/generatedRecoveryResolution.ts';
import { resolveUnifiedStorySkillCheck, resolutionFromReceipt } from '../../shared/story/unifiedStorySkillResolution.ts';
import { enforceStorySkillOutcomeInvariant } from '../../shared/story/storySkillCheck.ts';
import { selectStoryChoice } from '../../shared/story/selectedStoryChoice.ts';
import { finalizeGeneratedStoryResult } from '../../shared/story/storyBootstrap.ts';
import { acceptSequencedStoryPayload, commitStoryTransition, hydrateLatestStoryEntry, storyPayloadFromCommit } from '../../shared/story/storyTransition.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req), db = base44.asServiceRole;
  const results = [], fixtures = [], cleanup = [];
  const record = (name, pass, detail) => results.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  let protectedBefore, sourceEvidence;
  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json();
    protectedBefore = await hashValue(await readProtectedDndState(db));
    // Read ONLY. Copy the real accepted scene and orphan receipt to disposable IDs.
    const source = await db.entities.GameSession.get('6a6825edd695bd65a4322256');
    const incidentId = 'story-action:6a6825edd695bd65a4322256:1790800931663:n1o4u5';
    const incident = (source.world_state?.__skill_check_receipts || []).find(r => r.request_id === incidentId);
    if (!incident) throw new Error('The exact September 30 receipt is missing; do not substitute a guessed incident.');
    sourceEvidence = { request_id: incidentId, skill: incident.skill, dc: incident.dc, raw: incident.raw_d20, modifier: incident.modifier_total, final: incident.final_total, success: incident.success, action_recorded: !!incident.action_text, source_scene_request: source.story_log.at(-1).request_id };
    record('exact recorded Athletics failure exists and has no accepted story pair', incident.skill === 'Athletics' && incident.raw_d20 === 6 && incident.modifier_total === 4 && incident.final_total === 10 && incident.dc === 12 && incident.success === false && !source.story_log.some(e => e.request_id === incidentId));
    const tag = `FailedContinuationQA_${Date.now()}`;
    for (const mode of ['ai', 'player']) for (const succeeds of [false, true]) {
      const label = `${mode}-${succeeds ? 'success' : 'failure'}`;
      const character = await base44.entities.Character.create({ name: `${tag}_${label}`, race: 'Human', class: 'Ranger', level: 5, strength: 12, dexterity: 18, intelligence: 10, proficiency_bonus: 3, skills: { Athletics: 'proficient' }, hp_current: 44, hp_max: 44, spell_slots: { level_2: 1 }, inventory: [{ name: 'Arrows', quantity: 18, category: 'Ammunition' }, { name: 'Torch', quantity: 3 }], stowed_items: [], roll_mode: mode, is_active: false });
      fixtures.push(['Character', character.id]);
      const accepted = source.story_log.slice(-2).map((e, i) => ({ ...e, request_id: `${tag}:${label}:source:${i}` }));
      const session = await base44.entities.GameSession.create({ character_id: character.id, title: `${tag}_${label}`, current_location: source.current_location, in_combat: false, combat_state: {}, story_log: accepted, world_state: { infiltration: source.world_state.infiltration, __skill_check_receipts: [], __story_transition_sequence: source.world_state.__story_transition_sequence }, is_active: false });
      fixtures.push(['GameSession', session.id]);
      const requestId = `${tag}:${label}:attempt`, raw = succeeds ? 18 : 6;
      // Synthetic task, clearly labelled: the live task wording was not stored.
      const actionText = 'Attempt to move the fallen remains into my Bag of Holding.';
      const payload = { session_id: session.id, character_id: character.id, request_id: requestId, skill: 'Athletics', dc: 12, action_text: actionText, ...(mode === 'player' ? { raw_d20: raw, all_rolls: [raw], roll_origin: 'player' } : {}) };
      let rolls = 0;
      const roll = await resolveUnifiedStorySkillCheck({ db, user, payload, rollD20Fn: () => { rolls++; return raw; } });
      const receipt = roll.body.receipt, receiptBytes = JSON.stringify(receipt);
      record(`${label}: authoritative immutable roll matches intended branch and mode`, roll.status === 200 && receipt.raw_d20 === raw && receipt.final_total === raw + 4 && receipt.success === succeeds && receipt.roll_origin === mode && rolls === (mode === 'ai' ? 1 : 0));
      record(`${label}: future receipts record exact task and source scene`, receipt.action_text === actionText && receipt.source_story_request_id === accepted.at(-1).request_id);
      const characterBefore = JSON.stringify(await db.entities.Character.get(character.id));
      const model = { narrative: succeeds ? 'The route opens and you identify a viable next approach.' : 'You put the fallen body into your Bag of Holding. You recover exactly 1 arrow.', choices: source.story_log.at(-1).choices, current_recovery: succeeds ? null : { type: 'arrows', quantity: 1 }, combat_trigger: false, enemies: [], loot: [], crafting_outcome: null };
      if (!succeeds) {
        const legacyStow = await executeStowAction({ base44, ownerId: user.id, payload: { session_id: session.id, character_id: character.id, request_id: requestId, action_text: model.narrative, check: receipt } });
        const oldStatus = legacyStow.body.handled && !legacyStow.body.success ? 409 : 200;
        record(`${label}: reproduces original narrated-stow failed_check-to-409 conversion`, !!classifyStowIntent(model.narrative) && legacyStow.body.reason === 'failed_check' && legacyStow.body.writes === 0 && oldStatus === 409);
        const oldReward = await guardAndCommitNarratedRecovery({ base44, sessionId: session.id, characterId: character.id, requestId, check: receipt, narrative: 'You recover exactly 1 arrow.', recovery: model.current_recovery });
        record(`${label}: reproduces original reward failed_check-to-409 conversion`, oldReward.status === 200 && oldReward.body.reason === 'failed_check' && oldReward.body.writes === 0);
        const bounded = await resolveGeneratedRecoveryCandidate({ candidate: model, check: receipt, action: actionText, location: session.current_location, regenerate: async () => model });
        record(`${label}: matched structured awards cannot override a failed roll`, bounded.fallback_used && bounded.result.current_recovery === null && bounded.result.loot.length === 0);
      }
      let corrections = 0;
      let candidate = await resolveFailedCheckCandidate({ candidate: model, check: receipt, regenerate: async () => { corrections++; return model; } });
      record(`${label}: bounded correction keeps the legitimate outcome without a reroll`, corrections === (succeeds ? 0 : 1) && (succeeds || (candidate.current_recovery === null && candidate.xp_earned === 0 && /not completed/.test(candidate.narrative))) && JSON.stringify(receipt) === receiptBytes);
      const stow = await resolveNarratedStowCandidate({ base44, ownerId: user.id, sessionId: session.id, characterId: character.id, requestId, candidate, check: receipt });
      const recovery = await guardAndCommitNarratedRecovery({ base44, sessionId: session.id, characterId: character.id, requestId, check: receipt, narrative: candidate.narrative, recovery: candidate.current_recovery, loot: candidate.loot });
      record(`${label}: actual production candidate gates permit continuation with zero item writes`, stow.status === 200 && !stow.body.handled && stow.body.writes === 0 && recovery.status === 200 && recovery.body.reason === 'not_applicable' && recovery.body.writes === 0);
      candidate = finalizeGeneratedStoryResult(candidate, { location: session.current_location, requestId, previousChoices: accepted.at(-1).choices });
      const invariant = enforceStorySkillOutcomeInvariant(candidate, actionText, resolutionFromReceipt(receipt));
      const fresh = await db.entities.GameSession.get(session.id);
      const entry = { request_id: requestId, timestamp: new Date().toISOString(), action: 'choice', player_choice: actionText, text: invariant.result.narrative, choices: invariant.result.choices, skill_check: receipt };
      const committed = commitStoryTransition(fresh.story_log, entry, requestId);
      await db.entities.GameSession.update(session.id, { story_log: committed.story_log });
      const saved = await db.entities.GameSession.get(session.id), latest = hydrateLatestStoryEntry(saved);
      const response = { ...storyPayloadFromCommit({ ...committed, persistence_confirmed: true }), persistence_confirmed: true };
      record(`${label}: failure/success branch really commits one exact four-choice pair`, invariant.ok && latest.request_id === requestId && latest.choices.length === 4 && latest.entry.skill_check.success === succeeds && acceptSequencedStoryPayload(response, 1, 1).accepted && JSON.stringify(latest.choices) !== JSON.stringify(accepted.at(-1).choices));
      record(`${label}: accepted history and roll bytes are preserved`, JSON.stringify(saved.story_log.slice(0, 2)) === JSON.stringify(accepted) && JSON.stringify(saved.world_state.__skill_check_receipts[0]) === receiptBytes);
      const replay = await resolveUnifiedStorySkillCheck({ db, user, payload: { ...payload, raw_d20: 20, all_rolls: [20] }, rollD20Fn: () => { throw new Error('Retry must not roll'); } });
      const pairReplay = commitStoryTransition(saved.story_log, { ...entry, text: 'Must not replace accepted text' }, requestId);
      record(`${label}: retry reuses the original result, with no double roll or story advance`, replay.body.writes === 0 && replay.body.raw === raw && replay.body.success === succeeds && pairReplay.replayed && JSON.stringify(pairReplay.story_log) === JSON.stringify(saved.story_log));
      record(`${label}: no ammunition, slots, inventory, corpse, HP or character mutation`, JSON.stringify(await db.entities.Character.get(character.id)) === characterBefore);
      const stale = selectStoryChoice({ latestChoices: latest.choices, choiceIndex: 0, choiceText: 'A different stale choice' });
      record(`${label}: stale contracts are separately rejected without writes`, !stale.ok && stale.error_code === 'stale_choice_contract');
      const coherent = { narrative: 'The attempt fails; the bodies slip from your grasp and remain in the tunnel.', choices: latest.choices, current_recovery: null };
      const untouched = await resolveFailedCheckCandidate({ candidate: coherent, check: { ...receipt, success: false }, regenerate: async () => { throw new Error('A lawful failure must not regenerate'); } });
      record(`${label}: legitimate failure narration is preserved verbatim`, untouched.narrative === coherent.narrative);
      let genuineError = false;
      try { await resolveFailedCheckCandidate({ candidate: model, check: { ...receipt, success: false }, regenerate: async () => { throw new Error('internal execution failure'); } }); } catch (error) { genuineError = error.message === 'internal execution failure'; }
      record(`${label}: real execution failures are not relabelled as failed rolls`, succeeds || genuineError);
    }
  } catch (error) { record('fixture execution', false, error.message); }
  finally {
    for (const [entity, id] of fixtures.reverse()) {
      let deleted = false; try { await db.entities[entity].delete(id); deleted = true; } catch (error) { record(`delete ${entity} ${id}`, false, error.message); }
      const remaining = await db.entities[entity].filter({ id });
      cleanup.push({ entity, id, deleted, verified_absent: remaining.length === 0 });
    }
  }
  record('all exact fixture IDs deleted and confirmed absent', cleanup.length === 8 && cleanup.every(x => x.deleted && x.verified_absent));
  const protectedAfter = await hashValue(await readProtectedDndState(db));
  record('protected live state is byte-equivalent before and after', protectedBefore === protectedAfter);
  const passed = results.filter(r => r.pass).length;
  return Response.json({ function_version: 'live-failed-check-continuation-regression-v1.0.0', source_evidence: sourceEvidence, passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, cleanup, protected_before: protectedBefore, protected_after: protectedAfter, protected_unchanged: protectedBefore === protectedAfter }, { status: passed === results.length ? 200 : 500 });
}