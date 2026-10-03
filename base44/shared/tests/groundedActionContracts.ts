import { validatePlayerText, playerTextCount } from '../story/playerText.ts';
import { materializeSceneCandidates, sceneRevision } from '../story/sceneEvidence.ts';
import { prepareGroundedStoryCommit } from '../story/groundedStoryCommit.ts';
import { resolveGroundedAction } from '../story/groundedAction.ts';
import { hashStoryValue } from '../story/storyTransition.ts';
import { readNarrativeCorpseEntities } from '../story/narrativeCorpseSources.ts';
import { validateContainerFit, defaultStowableMeasure } from '../story/containerCapacity.ts';

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
  const kill = { request_id: 'fixture-tunnel-kill', player_choice: 'attempt to take down both guards', text: 'The two remaining cultists pace the corridor. The twin arrows fly with lethal, silent precision, finding their marks before the guards even register your presence. The cultists collapse instantly, their unnatural connection to the Weaver severed as they crumple into the muck, leaving the tunnel silent once more.' };
  const aftermath = { request_id: 'fixture-tunnel-search', player_choice: 'Scavenge the fallen guards for logistical intel.', text: 'You step over the bodies of the cultist vanguard, your boots sinking into the dark silt that now absorbs their pooling, cold blood. Your fingers search their leather armor. However, your search proves fruitless. Frustrated, you stand, the corpses contained within the bag reminding you of the older bodies.' };
  const tunnel = { ...session, story_log: [kill, aftermath] }, tunnelBefore = await hashStoryValue(tunnel);
  const bodies = await readNarrativeCorpseEntities({ session: tunnel });
  check('committed_lethal_volley_and_searched_cold_blood_aftermath_proves_two_deaths', bodies.length === 2);
  check('tunnel_bodies_distinct_named_narrative_identities', new Set(bodies.map(x => x.id)).size === 2 && bodies.every(x => /Tunnel Cultist Guard [12]/.test(x.name) && x.death_provenance.source === 'narrative_derived'));
  check('tunnel_body_identity_stable_on_reload', JSON.stringify(bodies) === JSON.stringify(await readNarrativeCorpseEntities({ session: tunnel })));
  check('old_vanguard_does_not_relabel_tunnel_pair', (await readNarrativeCorpseEntities({ session: tunnel, structured: [{ name: 'Obsidian Circle Vanguard', hp_current: 0 }] })).length === 2);
  check('lethal_volley_without_searched_remains_insufficient', (await readNarrativeCorpseEntities({ session: { ...tunnel, story_log: [kill] } })).length === 0);
  check('cold_blood_without_severed_connection_insufficient', (await readNarrativeCorpseEntities({ session: { ...tunnel, story_log: [{ ...kill, text: 'The two remaining cultists collapse instantly.' }, aftermath] } })).length === 0);
  check('tunnel_living_contradiction_blocks_materialization', (await readNarrativeCorpseEntities({ session: tunnel, structured: [{ name: 'cultists', hp_current: 2, status: 'alive' }] })).length === 0);
  check('tunnel_subsequent_guard_revival_blocks_materialization', (await readNarrativeCorpseEntities({ session: { ...tunnel, story_log: [kill, aftermath, { text: 'The cultists wake and speak.' }] } })).length === 0);
  check('tunnel_pending_kill_cannot_materialize', (await readNarrativeCorpseEntities({ session: { ...tunnel, story_log: [{ ...kill, mechanics_status: 'pending' }, aftermath] } })).length === 0);
  check('tunnel_projection_never_invents_weight_or_volume', bodies.every(x => x.weight === undefined && x.volume_cubic_ft === undefined));
  check('tunnel_materialization_zero_state_mutation', tunnelBefore === await hashStoryValue(tunnel));
  const bagCharacter = { id: 'fixture-bag', inventory: [{ name: 'Bag of Holding', quantity: 1 }], stowed_items: [] };
  const corpseItem = (name) => ({ name, quantity: 1, category: 'Corpse' });
  const twoGuards = validateContainerFit({ character: bagCharacter, container: 'Bag of Holding', incoming: [corpseItem('Tunnel Cultist Guard 1'), corpseItem('Tunnel Cultist Guard 2')] });
  check('capacity_two_medium_corpses_within_canonical_bag', twoGuards.ok === true && twoGuards.totals.weight_lb === 320 && twoGuards.totals.volume_cubic_ft === 16);
  check('capacity_medium_humanoid_corpse_defaults', defaultStowableMeasure(corpseItem('Ritual Overseer')).weight === 160 && defaultStowableMeasure(corpseItem('Ritual Overseer')).volume === 8);
  const liveShape = { id: 'fixture-live', inventory: [{ name: 'Bag of Holding', quantity: 1 }], stowed_items: [
    { name: "Weaver's Ledger", category: 'Book', container: 'Bag of Holding' },
    { name: 'Unidentified Staff', category: 'Staff', container: 'Bag of Holding' },
    corpseItem('Ritual Overseer'), corpseItem('Rune-Caster'), corpseItem('Obsidian Circle Vanguard'),
  ].map((x) => ({ ...x, container: 'Bag of Holding' })) };
  const liveFit = validateContainerFit({ character: liveShape, container: 'Bag of Holding', incoming: [corpseItem('Tunnel Cultist Guard 1'), corpseItem('Tunnel Cultist Guard 2')] });
  check('capacity_live_shape_refused_with_exact_overload_figure', liveFit.ok === false && liveFit.message.includes('806 lb') && liveFit.message.includes('500 lb limit') && Math.abs(liveFit.totals.volume_cubic_ft - 41.1) < 0.01);
  const oreFit = validateContainerFit({ character: bagCharacter, container: 'Bag of Holding', incoming: [{ name: 'Ore Pile', weight: 600, quantity: 1 }] });
  check('capacity_overweight_refusal_specific', oreFit.ok === false && oreFit.message.includes('600 lb') && oreFit.message.includes('500 lb limit'));
  const dragonFit = validateContainerFit({ character: bagCharacter, container: 'Bag of Holding', incoming: [{ name: 'Ancient Drake Corpse', category: 'Corpse', weight: 4000, volume_cubic_ft: 200, dimensions_ft: { width: 15, height: 12 }, quantity: 1 }] });
  check('capacity_dragon_corpse_refused_by_opening', dragonFit.ok === false && dragonFit.message.includes('opening') && dragonFit.message.includes('Ancient Drake Corpse'));
  const passed = checks.filter(x => x.pass).length;
  return { suite_version: 'grounded-action-contracts-v1.2', coverage: 'in_memory_contracts_only_not_end_to_end', passed, failed: checks.length - passed, total: checks.length, all_pass: passed === checks.length, checks, writes: 0,
    cleanup_verified: true, cleanup: [], fixtures_created: 0, protected_state: { read_or_mutated: false }, release_verified: false };
}