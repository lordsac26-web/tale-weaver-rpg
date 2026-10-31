import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { resolveSemanticSceneReference } from '../../shared/story/semanticSceneReference.ts';
import { groundCorpseLoot } from '../../shared/story/corpseLootGrounding.ts';
import { commitCorpseLoot, supportedCorpseLoot } from '../../shared/story/corpseLootTransaction.ts';
import { materializeCompletedCombatCorpses, buildCompletedCombatContext } from '../../shared/story/completedCombatContext.ts';
import { prepareGroundedStoryCommit } from '../../shared/story/groundedStoryCommit.ts';
import { compactRestReceipt } from '../../shared/story/restReceiptStorage.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const checks = [], check = (name, pass) => checks.push({ name, pass: !!pass });
    const choices = [1,2,3,4].map(i => ({ text: `Continue ${i}`, action_type: 'utility' }));
    let session = { id: 'fixture-session', character_id: 'fixture-character', updated_date: '1', current_location: 'Third necrotic node collapsed, sector purified.', story_log: [{ request_id: 'fixture-scene', text: 'The cultist is dead.', choices }], world_state: {} };
    let character = { id: 'fixture-character', updated_date: '1', inventory: [], gold: 0, long_rest_abilities: {} };
    const combat = { id: 'fixture-combat', session_id: session.id, character_id: character.id, location: 'Third necrotic node', result: 'victory', is_active: false, encounter_date: '2026-10-31T18:41:00Z', combatants: [{ id: 'enemy-1', name: 'Grey-silk Obsidian Circle Cultist', aliases: ['cultist','grey-silk acolyte'], type: 'enemy', hp_current: 0, is_conscious: false }] };
    const corpse = materializeCompletedCombatCorpses({ session, context: buildCompletedCombatContext(combat) })[0];
    let charWrites = 0;
    const fake = { asServiceRole: { entities: {
      GameSession: { get: async () => structuredClone(session), update: async (id, data) => { session = { ...session, ...structuredClone(data) }; return session; } },
      Character: { get: async () => structuredClone(character), update: async (id, data) => { charWrites++; character = { ...character, ...structuredClone(data) }; return character; } },
      CombatLog: { get: async () => combat }
    } }, integrations: { Core: { InvokeLLM: async () => ({ target_id: '', ambiguous: true, assumption: '' }) } } };
    for (const action of ['loot the cultist','search the body I just killed','loot the nearest corpse','loot him']) {
      const result = await resolveSemanticSceneReference({ base44: fake, catalog: [corpse], actionText: action });
      check(action, result.target?.id === corpse.id);
    }
    for (const reply of ['grey silk','the dead one','him']) {
      const result = await resolveSemanticSceneReference({ base44: fake, catalog: [corpse], actionText: 'loot the cultist', answerText: reply });
      check(`reply_${reply}`, result.target?.id === corpse.id);
    }
    const second = { ...corpse, id: 'corpse-2', name: 'Cultist Guard 2', source_ordinal: 2, aliases: ['cultist','guard'], death_provenance: { ...corpse.death_provenance, combatant_id: 'enemy-2' } };
    const context = { revision: 'fixture-revision', entities: [corpse, second] };
    const initial = await groundCorpseLoot({ base44: fake, session, context, actionText: 'loot the cultist', requestId: 'pending-1' });
    check('one_genuine_ambiguity_prompt', initial.clarification_required && initial.clarification_options.length === 2);
    const ordinal = await groundCorpseLoot({ base44: fake, session, context, actionText: 'loot the cultist', answerText: 'second', requestId: 'pending-1' });
    check('ordinal_binds_saved_offered_order', ordinal.grounded_action?.target_ids[0] === second.id);
    const stopped = await groundCorpseLoot({ base44: fake, session, context, actionText: 'loot the cultist', answerText: 'the dragon', requestId: 'pending-1' });
    check('unresolved_reply_stops_without_reprompt', stopped.action_blocked && !stopped.clarification_required && stopped.writes === 0);
    const hijack = await groundCorpseLoot({ base44: fake, session, context, actionText: 'loot another target', answerText: 'first', requestId: 'pending-1' });
    check('pending_action_cannot_change', hijack.status === 409);
    check('no_generic_treasure_invented', supportedCorpseLoot(corpse, combat).items.length === 0);
    const grounding = { grounded_action: { targets: [corpse], assumption: '' } };
    const first = await commitCorpseLoot({ base44: fake, session, character, requestId: 'loot-1', actionText: 'loot him', grounding });
    check('defeat_to_empty_receipt_and_persisted_story', first.status === 200 && first.body.persistence_confirmed && first.body.loot_receipt.status === 'empty' && character.inventory.length === 0);
    const replay = await commitCorpseLoot({ base44: fake, session, character, requestId: 'loot-2', actionText: 'loot him', grounding });
    check('repeat_body_cannot_award_twice', replay.status === 200 && replay.body.already_searched && charWrites === 1);
    const equipped = { ...second, loot: { recoverable: true, items: [{ name: 'Serrated dagger', quantity: 1, category: 'Weapon' }], coins: { copper: 3 } } };
    const award = await commitCorpseLoot({ base44: fake, session, character, requestId: 'loot-3', actionText: 'loot guard 2', grounding: { grounded_action: { targets: [equipped] } } });
    check('explicit_contents_atomic_with_receipt', award.status === 200 && character.inventory.length === 1 && character.copper === 3 && character.long_rest_abilities.__corpse_loot_receipts.length === 2);
    const historical = { ...corpse, id: 'historical', location: 'Spire of Whispers' };
    const projection = await prepareGroundedStoryCommit({ session: { ...session, world_state: { scene_entities: [historical, corpse] } }, entry: { request_id: 'next', text: 'Silence.', scene_location: 'Another location' }, candidates: [] });
    check('location_label_never_erases_defeat_identities', projection.registry.length === 2);
    check('corpse_keeps_defeat_location', corpse.location === combat.location && !!corpse.defeat_id);
    const compact = compactRestReceipt({ token: 'rest-token', response: { character: { id: character.id, long_rest_abilities: { huge: 'x'.repeat(10000) } }, healing: 20, rest_type: 'long' } });
    check('rest_compaction_preserves_token_outcome', compact.token === 'rest-token' && compact.response.healing === 20 && !compact.response.character && JSON.stringify(compact).length < 300);
    return Response.json({ all_pass: checks.every(row => row.pass), passed: checks.filter(row => row.pass).length, total: checks.length, checks, real_campaign_reads_or_writes: 0, coverage: 'in_memory_backend_contracts_not_browser_QA' });
  } catch (error) { return Response.json({ error: error.message, all_pass: false }, { status: 500 }); }
}