import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { classifyExplicitAttackIntent, validateExplicitAttackResolution, enforceExplicitAttackTransition, EXPLICIT_ATTACK_TRANSITION_VERSION } from '../../shared/story/explicitAttackTransition.ts';
import { readNarrativeCorpseEntities } from '../../shared/story/narrativeCorpseSources.ts';
import { readContextualCorpseSources } from '../../shared/story/contextualCorpseStow.ts';
import { reconcileSessionCombat } from '../../shared/combat/sessionCombatState.ts';

const LIVING = (name) => ({ name, hp: 22, current_hp: 22, ac: 13, attack_bonus: 4, damage_dice: '1d6', damage_bonus: 2, dexterity: 12, cr: 0.5, xp: 100 });
const PROSE_MASSACRE = 'You loose three arrows and the cultists are mowed down before they can even draw their daggers. Their bodies slump into the mud, the perimeter cleared.';
const sessionWithCultists = (location = 'Southern Mire, near the second necrotic harmonic node.') => ({
  id: 's1', current_location: location, in_combat: false,
  world_state: { scene_entities: [] },
  story_log: [{ text: 'The remaining cultists scramble below, searching the mists for the source of the strike.', mechanics_status: 'complete' }],
});

export default async function(req) {
  const tests = [];
  const test = (name, pass, detail) => tests.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    // ── 1. Classification: explicit attack on established hostiles ──
    const collective = classifyExplicitAttackIntent({ actionText: 'I choose to attack the remaining cultists', session: sessionWithCultists() });
    test('collective explicit attack classifies as required', collective.required === true && collective.target_kind === 'collective', collective);
    const entitySession = { ...sessionWithCultists(), world_state: { scene_entities: [{ id: 'e1', name: 'Obsidian Circle Cultist', type: 'creature', status: 'alive' }] } };
    test('named living scene entity target classifies as required', classifyExplicitAttackIntent({ actionText: 'I attack the Obsidian Circle Cultist', session: entitySession }).required === true);
    test('attack with no creature target is not required', classifyExplicitAttackIntent({ actionText: 'attack the darkness', session: sessionWithCultists() }).required === false);
    test('observation of cultists is not an attack', classifyExplicitAttackIntent({ actionText: 'observe the cultists from cover', session: sessionWithCultists() }).required === false);
    test('destroying a node is not a creature attack', classifyExplicitAttackIntent({ actionText: 'destroy the necrotic node', session: sessionWithCultists() }).required === false);

    // ── 2. Gate: prose kills are impossible; combat or one clarification ──
    const intent = collective;
    let regenerateCalls = 0;
    const valid = await enforceExplicitAttackTransition({ actionText: 'I choose to attack the remaining cultists', session: sessionWithCultists(),
      candidate: { narrative: 'You set your feet and draw.', combat_trigger: true, enemies: [LIVING('Cultist'), LIVING('Cultist')] },
      regenerate: async () => { regenerateCalls++; return {}; } });
    test('already-valid attack turn is applied without a retry', valid.applied === true && regenerateCalls === 0 && valid.candidate.enemies.length === 2);

    const blocked = await enforceExplicitAttackTransition({ actionText: 'I choose to attack the remaining cultists', session: sessionWithCultists(),
      candidate: { narrative: PROSE_MASSACRE, combat_trigger: false, enemies: [], xp_earned: 250 },
      regenerate: async () => ({ narrative: PROSE_MASSACRE, combat_trigger: false, enemies: [], xp_earned: 250 }) });
    test('narration-only resolution of an attack is blocked', blocked.blocked === true && blocked.gate.reason_code === 'narration_only_attack');

    const rescued = await enforceExplicitAttackTransition({ actionText: 'I choose to attack the remaining cultists', session: sessionWithCultists(),
      candidate: { narrative: PROSE_MASSACRE, combat_trigger: false, enemies: [], xp_earned: 250, loot: [{ name: 'Dagger' }] },
      regenerate: async () => ({ narrative: 'You set your feet; the cultists turn. Steel has not yet met flesh.', combat_trigger: true, enemies: [LIVING('Cultist'), LIVING('Cultist')], xp_earned: 250, loot: [{ name: 'Dagger' }] }) });
    test('retry converts the turn into a live combat handoff', rescued.applied === true && rescued.candidate.combat_trigger === true && rescued.candidate.enemies.length === 2);
    test('combat handoff mints no HP, XP or loot before the first blow', rescued.candidate.hp_change === 0 && rescued.candidate.xp_earned === 0 && rescued.candidate.loot.length === 0 && rescued.candidate.current_recovery === null);
    test('no kill is promoted to a permanent key event', rescued.candidate.key_event === '');

    const emptyCombat = await enforceExplicitAttackTransition({ actionText: 'attack the remaining cultists', session: sessionWithCultists(),
      candidate: { narrative: 'The cultists are cut down.', combat_trigger: true, enemies: [] },
      regenerate: async () => ({ narrative: 'The cultists are cut down.', combat_trigger: true, enemies: [] }) });
    test('combat_trigger without living stat blocks is blocked', emptyCombat.blocked === true && emptyCombat.gate.reason_code === 'combat_without_valid_enemy');
    test('collective attacks either open combat or clarify', validateExplicitAttackResolution({ intent, candidate: { combat_trigger: false, enemies: [] } }).ok === false);

    // ── 3. Narrated defeats stay lootable from the scene registry ──
    const sourceHash = 'f'.repeat(64);
    const corpse = (over = {}) => ({ id: 'scene:c1:1', type: 'corpse', status: 'dead', name: 'Obsidian Circle Cultist', transfer_state: 'world',
      location: 'Threshold of the Spire of Whispers, having purged the outer defenses.',
      evidence: { narrative_derived: true }, death_provenance: { source: 'narrative_derived', scene_entity_id: 'scene:c1:1', source_request_id: 'rid-1', source_hash: sourceHash, status: 'dead' }, ...over });
    const spireSession = (entities, location = 'at the Spire of Whispers threshold') => ({ id: 's2', current_location: location, story_log: [], world_state: { scene_entities: entities } });
    test('registry-backed narrated corpse is discoverable at its scene', (await readNarrativeCorpseEntities({ session: spireSession([corpse()]), structured: [] })).length === 1);
    test('narrated corpse is not lootable from a different node', (await readNarrativeCorpseEntities({ session: spireSession([corpse({ location: 'Southern mire, at the first necrotic harmonic node.' })], 'Southern mire, near the second necrotic harmonic node.'), structured: [] })).length === 0);
    test('already-stowed narrated corpse is not offered again', (await readNarrativeCorpseEntities({ session: spireSession([corpse({ transfer_state: 'stowed' })]), structured: [] })).length === 0);

    // ── 4. Owner playtest state: reconciled massacre + abandoned combat ──
    const live = await base44.asServiceRole.entities.GameSession.get('6a6825edd695bd65a4322256');
    const massacre = 'story-action:6a6825edd695bd65a4322256:1793153866100:r3qi7m';
    const reconciledCorpses = (live?.world_state?.scene_entities || []).filter(e => e.type === 'corpse' && e.source_request_id === massacre);
    test('narrated massacre is materialized as dead cultist corpses', reconciledCorpses.length === 3 && reconciledCorpses.every(e => e.status === 'dead' && e.death_provenance?.source === 'narrative_derived'), { count: reconciledCorpses.length });
    const liveCharacter = await base44.asServiceRole.entities.Character.get(live.character_id);
    const atSpire = await readContextualCorpseSources({ base44, session: { ...live, current_location: 'Threshold of the Spire of Whispers, having purged the outer defenses.' }, character: liveCharacter });
    test('reconciled corpses appear as stowable search results at the scene', atSpire.candidates.filter(x => /obsidian circle cultist/i.test(x.name)).length === 3, { candidates: atSpire.candidates.length });
    const abandoned = await base44.asServiceRole.entities.CombatLog.get('6ac773f61da69a5ba2b25922');
    test('abandoned campaign combat is closed, never active', abandoned.is_active === false && abandoned.result !== 'ongoing', { result: abandoned.result, is_active: abandoned.is_active });
    const abandonedSession = await base44.asServiceRole.entities.GameSession.get('6ac772315e0bbfcbdac23c7c');
    const reconciled = await reconcileSessionCombat(base44, '6ac772315e0bbfcbdac23c7c');
    test('abandoned campaign can never be selected as active combat', reconciled.valid === false, { reason: reconciled.reason, in_combat: abandonedSession.in_combat });

    const passed = tests.filter(t => t.pass).length, allPass = passed === tests.length;
    return Response.json({ function_version: 'explicit-attack-transition-regression-v1.0.0', explicit_attack_transition_version: EXPLICIT_ATTACK_TRANSITION_VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: allPass, tests }, { status: allPass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Explicit attack transition regression failed.', tests }, { status: 500 });
  }
}