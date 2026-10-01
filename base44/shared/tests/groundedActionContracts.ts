import { validatePlayerText, playerTextCount } from '../story/playerText.ts';
import { materializeSceneCandidates, sceneRevision } from '../story/sceneEvidence.ts';
import { prepareGroundedStoryCommit } from '../story/groundedStoryCommit.ts';
import { resolveGroundedAction } from '../story/groundedAction.ts';
import { hashStoryValue } from '../story/storyTransition.ts';

export async function runGroundedActionContracts() {
  const checks = [], check = (name, ok) => checks.push({ name, pass: !!ok });
  for (const count of [7999, 8000, 8001]) {
    check(`ascii_${count}`, validatePlayerText('a'.repeat(count)).ok === (count <= 8000));
    check(`unicode_${count}`, validatePlayerText('🧙'.repeat(count)).ok === (count <= 8000));
  }
  check('unicode_codepoint_count', playerTextCount('a🧙e\u0301') === 4);
  check('whitespace_normalized_after_validation', validatePlayerText(' a\r\nb\tc ').text === 'a\nb c');
  check('oversize_never_truncated', validatePlayerText('a'.repeat(8001)).text === undefined);
  check('non_string_rejected', !validatePlayerText({ action: 'pretend' }).ok);
  const entry = { request_id: 'fixture-source', action: 'choice', text: 'Two guards are dead beside the wall.', mechanics_status: 'confirmed', scene_location: 'fixture-room' };
  const session = { id: 'fixture-session', current_location: 'fixture-room', world_state: {}, story_log: [entry], combat_state: {} };
  const candidate = { name: 'guards', aliases: ['guard'], type: 'corpse', quantity: 2, status: 'dead', source_request_id: entry.request_id, quote: entry.text };
  const before = await hashStoryValue(session);
  const materialized = await materializeSceneCandidates({ session, entry, candidates: [candidate] });
  check('explicit_narrative_death_without_combat', materialized.accepted.length === 2);
  check('same_alias_distinct_identity', new Set(materialized.accepted.map(x => x.id)).size === 2 && materialized.accepted.every(x => x.aliases.includes('guard')));
  check('exact_death_span_provenance', materialized.accepted.every(x => x.death_provenance.source === 'narrative_derived' && x.evidence.quote === entry.text && x.evidence.span_end === entry.text.length));
  const replayed = await materializeSceneCandidates({ session, entry, candidates: [candidate, candidate] });
  check('idempotent_materialization', JSON.stringify(replayed.accepted) === JSON.stringify(materialized.accepted));
  for (const [label, text] of [['collapsed', 'Two guards collapsed beside the wall.'], ['unconscious', 'Two guards are unconscious beside the wall.'], ['hypothetical', 'If two guards are dead, their bodies could lie here.'], ['unrelated_death', 'A dead rat lies beside two guards.']]) {
    const source = { ...entry, text };
    const result = await materializeSceneCandidates({ session: { ...session, story_log: [source] }, entry: source, candidates: [{ ...candidate, quote: text }] });
    check(`${label}_does_not_prove_death`, result.accepted.length === 0);
  }
  const living = await materializeSceneCandidates({ session, entry, candidates: [candidate], structured: [{ name: 'guard', hp_current: 1, status: 'alive' }] });
  check('structured_living_overrides_narration', living.accepted.length === 0);
  const later = { ...entry, request_id: 'fixture-later', text: 'The guards wake and stand up.' };
  check('subsequent_living_overrides_narration', (await materializeSceneCandidates({ session: { ...session, story_log: [entry, later] }, entry, candidates: [candidate] })).accepted.length === 0);
  check('skill_not_attack_authority', (await materializeSceneCandidates({ session, entry: { ...entry, player_choice: 'Shoot the guards' }, candidates: [candidate] })).accepted.length === 0);
  check('wrong_source_rejected', (await materializeSceneCandidates({ session, entry, candidates: [{ ...candidate, source_request_id: 'other-source' }] })).accepted.length === 0);
  check('invented_identity_rejected', (await materializeSceneCandidates({ session, entry, candidates: [{ ...candidate, name: 'Golden Dragon', aliases: [] }] })).accepted.length === 0);
  check('invented_quantity_rejected', (await materializeSceneCandidates({ session, entry, candidates: [{ ...candidate, quantity: 3 }] })).accepted.length === 0);
  check('pending_source_rejected', (await materializeSceneCandidates({ session, entry: { ...entry, mechanics_status: 'pending' }, candidates: [candidate] })).accepted.length === 0);
  const chestEntry = { request_id: 'fixture-chest', text: 'A wooden chest rests in the alcove.', mechanics_status: 'pending', scene_location: 'fixture-room' };
  const chest = { name: 'wooden chest', aliases: ['chest'], type: 'container', quantity: 1, status: 'unknown', source_request_id: chestEntry.request_id, quote: chestEntry.text };
  const committed = await prepareGroundedStoryCommit({ session, entry: chestEntry, candidates: [chest] });
  check('prop_materialized_in_story_commit_projection', committed.entities.length === 1 && committed.registry.length === 1);
  check('no_inventory_reward_in_prop_projection', !committed.entities[0]?.price && !committed.entities[0]?.gold && !committed.inventory);
  const scene = { ...session, story_log: [entry, { ...chestEntry, mechanics_status: 'confirmed' }], world_state: { preserved: 'original', scene_entities: committed.registry } };
  const character = { id: 'fixture-character', inventory: [], stowed_items: [], conditions: [] };
  let modelCalls = 0;
  const fake = { asServiceRole: { entities: { CombatLog: { filter: async () => [] } } }, integrations: { Core: { InvokeLLM: async ({ response_json_schema }) => { modelCalls++; return response_json_schema.properties.candidates ? { candidates: [] } : { intent: 'inspect', target_ids: [], quantity: 1, destination: '', uncertainty: 'Which object do you mean?' }; } } } };
  const resolved = await resolveGroundedAction({ base44: fake, session: scene, character, actionText: 'Inspect the wooden chest' });
  check('explicit_name_fast_path_avoids_ai', resolved.handled && !resolved.clarification_required && modelCalls === 0);
  check('typed_plan_contains_source_and_revision', resolved.grounded_action?.evidence[0]?.quote === chestEntry.text && !!resolved.grounded_action?.scene_revision);
  const stale = await resolveGroundedAction({ base44: fake, session: scene, character, actionText: 'Inspect the wooden chest', expectedRevision: 'stale-revision' });
  check('stale_revision_zero_write', stale.status === 409 && stale.writes === 0);
  const nextRevision = await sceneRevision(scene, { ...character, inventory: [{ name: 'Rope', quantity: 1 }] });
  check('inventory_change_invalidates_revision', nextRevision !== resolved.grounded_action?.scene_revision);
  const unsupported = await resolveGroundedAction({ base44: fake, session: scene, character, actionText: 'Take the wooden chest' });
  check('unsupported_transfer_cannot_promise_grant', unsupported.clarification_required && unsupported.writes === 0);
  const unknown = await resolveGroundedAction({ base44: fake, session: scene, character, actionText: 'Inspect my invented legendary sword' });
  check('user_assertion_does_not_materialize_item', unknown.clarification_required && unknown.grounded_action.target_ids.length === 0);
  check('fixture_state_unchanged', before === await hashStoryValue(session));
  const passed = checks.filter(x => x.pass).length;
  return { suite_version: 'grounded-action-contracts-v1', coverage: 'in_memory_contracts_only_not_end_to_end', passed, failed: checks.length - passed, total: checks.length, all_pass: passed === checks.length, checks, writes: 0,
    cleanup_verified: true, cleanup: [], fixtures_created: 0, protected_state: { read_or_mutated: false }, release_verified: false };
}