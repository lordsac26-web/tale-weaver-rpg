import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { buildClarificationOptions, groundedDisplayName } from '../../shared/story/groundedAction.ts';
import { choicesRepeatPrevious, finalizeGeneratedStoryResult } from '../../shared/story/storyBootstrap.ts';
import { checkStorySceneRevision } from '../../shared/story/storySceneRevision.ts';

// Oct 31 owner bug cluster: the clarification asked "Which object do you mean" and then
// listed a raw inventory dump, one identity twice, and an internal record name — while
// omitting the object he had actually named. These fixtures pin the enumeration
// contract, the reply-binding contract, and the post-commit option refresh.
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LIVE_CATALOG = [
  { id: 'nexus:1', name: 'Final Necrotic Nexus', type: 'object', status: 'alive' },
  { id: 'nexus:1b', name: 'Final Necrotic Nexus', type: 'object', status: 'alive' },
  { id: 'corpse:1', name: "Cultist_Cell's Corpse", type: 'corpse', status: 'dead' },
  { id: 'carried:0:Shortsword', name: 'Shortsword', place: 'carried', quantity: 2 },
  { id: 'carried:1:Explorer’s Pack', name: "Explorer's Pack", place: 'carried', quantity: 1 },
  { id: 'carried:2:Torch', name: 'Torch', place: 'carried', quantity: 1 },
  { id: 'carried:3:Mithral Plate', name: 'Mithral Plate', place: 'carried', quantity: 1 },
  { id: 'fork:1', name: 'Ironwood Tuning Fork', place: 'carried', quantity: 1 },
];
const OWNER_ACTION = 'stealthily place the ironwood tuning fork into the crack and move back to cover';

export default async function testClarificationCandidateEnumerationRegression(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const results = []; const record = (name, pass) => results.push({ name, pass: !!pass });
    const options = buildClarificationOptions({ catalog: LIVE_CATALOG, actionText: OWNER_ACTION });

    // ---- B. Candidate enumeration: relevance, dedupe, player-facing names.
    record('duplicate identity is offered once', options.filter((option) => option.name === 'Final Necrotic Nexus').length === 1);
    record('option ids are unique', new Set(options.map((option) => option.id)).size === options.length);
    record('internal record markers never reach the player', options.every((option) => !option.name.includes('_')));
    record('cell id is stripped from a corpse name', groundedDisplayName({ name: "Cultist_Cell's Corpse" }) === "Cultist's Corpse");
    record('blank names fall back to a readable label', groundedDisplayName({}) === 'an unnamed object' && groundedDisplayName(null) === 'an unnamed object');
    record('the specifically named object is offered first', options[0].name === 'Ironwood Tuning Fork');
    record('whole inventory is never dumped', options.every((option) => !['Shortsword', 'Torch', 'Mithral Plate', "Explorer's Pack"].includes(option.name)));
    record('scene interactables are offered as plausible targets', options.some((option) => option.name === 'Final Necrotic Nexus') && options.some((option) => option.name === "Cultist's Corpse"));
    record('irrelevant carried items are never offered', options.filter((option) => option.id.startsWith('carried:')).length === 0);
    record('option list is bounded', options.length <= 6);
    record('every offered name is the authoritative player-facing name of a saved object', options.every((option) => LIVE_CATALOG.some((entity) => groundedDisplayName(entity) === option.name)));
    record('every option carries an id and a name for the chip contract', options.every((option) => option.id && option.name));
    const crack = buildClarificationOptions({ catalog: [{ id: 'fracture:1', name: 'Hairline Fracture in the Obsidian Base', aliases: ['hairline fracture'], player_aliases: ['crack'], type: 'container' }], actionText: 'place the ironwood tuning fork into the crack' });
    record('a player synonym binds to the established object', crack.length === 1 && crack[0].name === 'Hairline Fracture in the Obsidian Base');
    record('enumeration is deterministic for the same scene', JSON.stringify(buildClarificationOptions({ catalog: LIVE_CATALOG, actionText: OWNER_ACTION })) === JSON.stringify(options));

    // ---- A/E. The materialized ritual set really exists, with provenance.
    const character = await base44.asServiceRole.entities.Character.get('6a6825cd07a490fa70a46852');
    const session = await base44.asServiceRole.entities.GameSession.get('6a6825edd695bd65a4322256');
    const fork = character ? [...(character.inventory || []), ...(character.stowed_items || [])].find((item) => norm(item.name) === norm('Ironwood Tuning Fork')) : null;
    record('materialized fork exists exactly once', !!fork && fork.quantity === 1 && (character.inventory || []).filter((item) => norm(item.name) === norm('Ironwood Tuning Fork')).length === 1);
    record('fork carries the narration provenance that created it', !!fork && fork.provenance?.source === 'story_narration' && /ironwood tuning fork in your belt/.test(fork.provenance.quote || ''));
    const fracture = session ? (session.world_state?.scene_entities || []).find((entity) => norm(entity.name).includes('hairline fracture')) : null;
    record('fracture exists as a scene interactable', !!fracture && fracture.type === 'container');
    record('fracture keeps its evidence quote', /hairline fracture along the base of the monolith/.test(fracture?.evidence?.quote || ''));
    record('fracture answers to the player word "crack"', (fracture?.player_aliases || []).includes('crack'));

    // ---- E. Post-commit refresh + stale-click rejection.
    const prior = [{ text: 'Reassess the node from a safer position before moving.', action_type: 'skill_check', skill_check: 'Perception', dc: 10 }, { text: 'Investigate the clearest unresolved detail in the node.', action_type: 'skill_check', skill_check: 'Investigation', dc: 12 }, { text: 'Advance cautiously through the node while avoiding notice.', action_type: 'skill_check', skill_check: 'Stealth', dc: 11 }, { text: 'Use the terrain around the node to choose a safer route.', action_type: 'skill_check', skill_check: 'Survival', dc: 10 }];
    const committed = finalizeGeneratedStoryResult({ narrative: 'The fork seats into the fracture and the hum drops out of the ritual’s key.', choices: prior, combat_trigger: false }, { location: 'the final necrotic node', requestId: 'clarification-post-commit', previousChoices: prior, lastPlayerAction: OWNER_ACTION });
    record('post-commit options are not the pre-commit set', choicesRepeatPrevious(committed.choices, prior) === false);
    record('post-commit narration is preserved verbatim', /fork seats into the fracture/.test(committed.narrative));
    const staleClick = checkStorySceneRevision({ action: 'choice', choiceIndex: 1, choiceText: prior[1].text, sourceEntryRequestId: 'story-choice:before-clarification', session: { story_log: [{ request_id: 'story-choice:after-clarification', text: 'committed', choices: committed.choices }] } });
    record('a stale post-clarification click is rejected zero-write', staleClick.ok === false && staleClick.body?.writes === 0 && staleClick.body?.error_code === 'stale_scene_revision');

    const passed = results.filter((item) => item.pass).length, allPass = passed === results.length;
    return Response.json({ function_version: 'test-clarification-candidate-enumeration-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: allPass, offered_for_owner_action: options, results }, { status: allPass ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message || 'Clarification candidate regression failed' }, { status: 500 }); }
}