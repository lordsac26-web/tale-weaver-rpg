import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { choicesRepeatPrevious, choiceSetSimilarity, finalizeGeneratedStoryResult, groundedFallbackChoices } from '../../shared/story/storyBootstrap.ts';
import { checkStorySceneRevision, STORY_SCENE_REVISION_VERSION } from '../../shared/story/storySceneRevision.ts';
import { acceptSequencedStoryPayload, commitStoryTransition, hydrateLatestStoryEntry, storyPayloadFromCommit } from '../../shared/story/storyTransition.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

// SUCCESS-path fixture family. The failure paths are covered by
// testConsecutiveStoryChoiceRegression (38) and testFailedSkillChoiceRefreshRegression
// (25); this suite pins the successful skill-check turn: fresh options must be
// materially new, a stale revision click must be rejected zero-write, and a reload
// between narration and choice-pick must render the current options.

const LOCATION = 'The third and final necrotic harmonic node in the Whispering Fens';
const PRIOR_SET = [
  { text: `Reassess ${LOCATION} from a safer position before moving.`, action_type: 'skill_check', skill_check: 'Perception', dc: 10, risk_level: 'low' },
  { text: `Investigate the clearest unresolved detail in ${LOCATION}.`, action_type: 'skill_check', skill_check: 'Investigation', dc: 12, risk_level: 'medium' },
  { text: `Advance cautiously through ${LOCATION} while avoiding notice.`, action_type: 'skill_check', skill_check: 'Stealth', dc: 11, risk_level: 'medium' },
  { text: `Use the terrain around ${LOCATION} to choose a safer route.`, action_type: 'skill_check', skill_check: 'Survival', dc: 10, risk_level: 'low' },
];
// Exactly what the model returned live: the previous list restated with one verb change.
const REPEATED_MODEL_SET = [
  { ...PRIOR_SET[0], text: `Examine ${LOCATION} from a safer position before moving. Check it from a different angle.` },
  { ...PRIOR_SET[1] },
  { ...PRIOR_SET[2] },
  { ...PRIOR_SET[3] },
];
const COMPLETED_ACTION = `Advance cautiously through ${LOCATION} while avoiding notice.`;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default async function testSuccessfulChoiceAdvanceRegression(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const results = []; const fixtures = []; const cleanup = []; const record = (name, pass) => results.push({ name, pass: !!pass });
    try {
      // ---- 1. The production guard must reject a restated list, not pass it through.
      record('live repeated set is detected as a repeat', choicesRepeatPrevious(REPEATED_MODEL_SET, PRIOR_SET) === true);
      const firstGuard = finalizeGeneratedStoryResult(
        { narrative: 'You slip through the fens unheard and reach the node unchallenged.', choices: REPEATED_MODEL_SET, combat_trigger: false },
        { location: LOCATION, requestId: 'success-advance-first', previousChoices: PRIOR_SET, lastPlayerAction: COMPLETED_ACTION },
      );
      record('repeated success choices are replaced by the guard', firstGuard.choice_guard.replaced === true && firstGuard.choice_guard.reason === 'identical_to_preceding');
      record('replacement keeps four legal options', firstGuard.choices.length === 4 && firstGuard.choices.every((choice) => choice.text && choice.skill_check && Number.isFinite(Number(choice.dc))));
      record('replacement is materially new, not a restated list', choicesRepeatPrevious(firstGuard.choices, PRIOR_SET) === false);
      record('replacement never re-offers the action just completed', firstGuard.choices.every((choice) => normalize(choice.text) !== normalize(COMPLETED_ACTION)));
      record('replacement leaves the narration untouched', firstGuard.narrative === 'You slip through the fens unheard and reach the node unchallenged.');

      // ---- 2. The regression that mattered: a second guarded turn must not return the
      // same set. The old template only changed one verb, so the list looked frozen.
      const secondGuard = finalizeGeneratedStoryResult(
        { narrative: 'The node pulses once and the moss beneath it curls away.', choices: firstGuard.choices, combat_trigger: false },
        { location: LOCATION, requestId: 'success-advance-second', previousChoices: firstGuard.choices, lastPlayerAction: firstGuard.choices[0].text },
      );
      record('consecutive guarded turns produce different options', JSON.stringify(secondGuard.choices) !== JSON.stringify(firstGuard.choices));
      record('consecutive replacement stays materially new', choicesRepeatPrevious(secondGuard.choices, firstGuard.choices) === false);
      record('consecutive replacement is still four legal options', secondGuard.choices.length === 4 && new Set(secondGuard.choices.map((choice) => choice.text)).size === 4);
      const thirdFallback = groundedFallbackChoices({ location: LOCATION, requestId: 'success-advance-second', previousChoices: firstGuard.choices });
      record('fallback selection is deterministic', JSON.stringify(thirdFallback) === JSON.stringify(secondGuard.choices));
      record('fallback drops the trailing sentence period duplication', secondGuard.choices.every((choice) => !choice.text.includes('..')));

      // ---- 3. Stale revision click is rejected zero-write; a current one proceeds.
      const character = await base44.entities.Character.create({ name: `SuccessAdvance_${Date.now()}`, race: 'Human', class: 'Ranger', level: 5, dexterity: 14, wisdom: 16, proficiency_bonus: 3, hp_current: 40, hp_max: 40, is_active: false });
      fixtures.push(['Character', character.id]);
      const priorEntry = { timestamp: '2026-10-30T11:10:00.000Z', request_id: 'success-advance-source', action: 'choice', text: 'You hold still and listen to the fens.', choices: PRIOR_SET };
      const committedEntry = { timestamp: '2026-10-30T11:11:37.000Z', request_id: 'success-advance-committed', action: 'choice', text: 'You move with the silence of a predator.', choices: firstGuard.choices, skill_check: { request_id: 'success-advance-committed', skill: 'Stealth', dc: 11, raw_d20: 5, all_rolls: [2, 5], modifier_total: 17, final_total: 22, success: true, advantage_sources: ['Boots of Elvenkind'] } };
      const session = await base44.entities.GameSession.create({ character_id: character.id, title: 'Successful advance fixture', current_location: LOCATION, story_log: [priorEntry, committedEntry], world_state: { __skill_check_receipts: [] }, in_combat: false, combat_state: {}, is_active: false });
      fixtures.push(['GameSession', session.id]);

      const stale = checkStorySceneRevision({ action: 'choice', choiceIndex: 2, choiceText: COMPLETED_ACTION, sourceEntryRequestId: 'success-advance-source', session });
      record('stale revision click is rejected', stale.ok === false && stale.status === 409 && stale.body?.error_code === 'stale_scene_revision');
      record('stale rejection writes nothing and demands a refresh', stale.body?.writes === 0 && stale.body?.refresh_required === true && stale.body?.preserve_scene === true);
      record('stale rejection names the authoritative revision', stale.body?.expected_request_id === 'success-advance-committed' && stale.body?.provided_request_id === 'success-advance-source');
      record('rejection message tells the player the scene advanced', /scene advanced/i.test(String(stale.body?.error || '')) && /reload/i.test(String(stale.body?.error || '')));
      record('stale rejection carries the revision contract version', stale.body?.revision_version === STORY_SCENE_REVISION_VERSION);
      const current = checkStorySceneRevision({ action: 'choice', choiceIndex: 1, choiceText: firstGuard.choices[1].text, sourceEntryRequestId: 'success-advance-committed', session });
      record('current revision click is accepted', current.ok === true && current.enforced === true && current.reason === 'current_revision');
      record('declared-index click is treated as a clicked option', checkStorySceneRevision({ action: 'choice', choiceIndex: 0, choiceText: '', sourceEntryRequestId: 'success-advance-source', session }).ok === false);
      record('non-clicked continuations are never revision-gated', checkStorySceneRevision({ action: 'choice', choiceText: '', sourceEntryRequestId: 'success-advance-source', session }).enforced === false
        && checkStorySceneRevision({ action: 'choice', choiceText: '', sourceEntryRequestId: 'victory-aftermath:any', session }).ok === true);
      record('known legacy risk: a stale click whose text still exists at the same index is accepted by text matching alone', checkStorySceneRevision({ action: 'choice', choiceIndex: 2, choiceText: COMPLETED_ACTION, sourceEntryRequestId: 'success-advance-committed', session }).ok === true);

      // ---- 4. Reload between narration and choice-pick renders the CURRENT options.
      const writes = await base44.asServiceRole.entities.GameSession.get(session.id);
      const reloaded = hydrateLatestStoryEntry(writes);
      record('reload hydrates the post-success narration', reloaded.request_id === 'success-advance-committed' && /silence of a predator/.test(reloaded.text));
      record('reload hydrates the post-success options, not the stale ones', JSON.stringify(reloaded.choices) === JSON.stringify(committedEntry.choices) && choicesRepeatPrevious(reloaded.choices, PRIOR_SET) === false);
      record('reload keeps the successful Stealth receipt intact', reloaded.entry.skill_check.final_total === 22 && reloaded.entry.skill_check.success === true && reloaded.entry.skill_check.advantage_sources[0] === 'Boots of Elvenkind');

      // ---- 5. Replay of the committed request still returns the stored pair (the
      // revision lock runs after replay, so a legitimate retry is never rejected).
      const replay = commitStoryTransition(writes.story_log, committedEntry, 'success-advance-committed');
      record('replay reuses the committed pair and writes zero entries', replay.replayed === true && replay.story_log.length === writes.story_log.length);
      const response = { ...storyPayloadFromCommit({ entry: replay.entry, index: replay.index, persistence_confirmed: true }), persistence_confirmed: true };
      const accepted = acceptSequencedStoryPayload(response, 2, 2);
      record('replayed success response equals the persisted pair', accepted.accepted === true && JSON.stringify(accepted.hydration.choices) === JSON.stringify(committedEntry.choices));
      record('the committed revision therefore always matches a replayed click', checkStorySceneRevision({ action: 'choice', choiceIndex: 2, choiceText: COMPLETED_ACTION, sourceEntryRequestId: replay.entry.request_id, session: { story_log: replay.story_log } }).ok === true);
      record('a late second response for the same turn is superseded', acceptSequencedStoryPayload(response, 1, 2).accepted === false);
      record('fixture remembers the live similarity, so the guard is not fooled by shared location tokens', choiceSetSimilarity(firstGuard.choices, PRIOR_SET) < 0.95);
    } finally {
      for (const [entity, id] of fixtures.reverse()) { let absent = false; try { await base44.asServiceRole.entities[entity].delete(id); } catch {} try { absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { absent = true; } cleanup.push({ entity, id, absent }); }
    }
    record('cleanup fixtures absent', cleanup.every((item) => item.absent));
    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('protected live IDs unchanged', protectedBefore === protectedAfter);
    const passed = results.filter((item) => item.pass).length, allPass = passed === results.length;
    return Response.json({ function_version: 'test-successful-choice-advance-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup }, { status: allPass ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message || 'Successful choice advance regression failed' }, { status: 500 }); }
}