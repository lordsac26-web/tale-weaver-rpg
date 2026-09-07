import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeChoiceActionContract } from '../../shared/story/choiceActionContract.js';
import { classifyCraftingAwardIntent, routeChoiceAward, CHOICE_AWARD_ROUTING_VERSION } from '../../shared/story/choiceAwardRouting.js';
import { executeCraftingTransaction, CRAFTING_TRANSACTION_VERSION } from '../../shared/craftingTransaction.ts';
import { commitStoryTransition } from '../../shared/story/storyTransition.ts';
import { matchPersistedStorySkillReceipt, STORY_SKILL_RECEIPT_COMPATIBILITY_VERSION } from '../../shared/story/storySkillReceiptCompatibility.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const nextChoices = (label) => [1, 2, 3, 4].map((index) => ({ text: `${label} option ${index}`, action_type: 'utility', recovery: null }));

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
  await req.json().catch(() => ({}));
  const db = base44.asServiceRole;
  const fixtures = [];
  const cleanup = [];
  const results = [];
  const record = (name, pass) => results.push({ name, pass: !!pass });
  const protectedBefore = await hashValue(await readProtectedDndState(db));
  try {
    const tag = `ZeroRecoveryRoutingQA_${Date.now()}`;
    let character = await db.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 4, intelligence: 12, inventory: [{ name: 'Wood Shafts', quantity: 6 }, { name: 'Flint', quantity: 6 }, { name: 'Arrows', quantity: 2 }], long_rest_abilities: {}, is_active: false });
    fixtures.push(['Character', character.id]);
    let session = await db.entities.GameSession.create({ character_id: character.id, title: tag, current_location: 'fixture archive', story_log: [{ request_id: 'source', text: 'The ledger lies open.', choices: nextChoices('source') }], world_state: {}, is_active: false });
    fixtures.push(['GameSession', session.id]);

    const skill = normalizeChoiceActionContract({ text: 'Examine the merchant ledger.', action_type: 'skill_check', skill_check: 'Investigation', dc: 14, recovery: { type: 'arrows', quantity: 0 } });
    const skillIntent = classifyCraftingAwardIntent({ actionText: skill.text, craftingOutcome: {}, narrative: 'The ledger reveals a useful connection.' });
    const liveStoryAction = { request_id: `story-action:${session.id}:1788769445129:m98nh3`, action: 'choice', choice_context: { action_type: 'skill_check', check: { success: true, raw_d20: 15, modifier_total: 0, final_total: 15, dc: 14, skill: 'Investigation' }, recovery: { type: 'arrows', quantity: 0 } } };
    const oldStoryChoice = { ...liveStoryAction, request_id: `story-choice:${session.id}:fixture`, choice_index: 1, choice_text: 'Examine the merchant ledger.', choice_context: { action_type: 'skill_check', check: { skill: 'Investigation', dc: 14, raw_d20: 16, modifier_total: 0, final_total: 16, success: true, receipt_timestamp: '2026-09-07T19:06:51.397Z' }, recovery: { type: 'arrows', quantity: 0 } } };
    const persistedPublishedReceipt = { id: oldStoryChoice.request_id, request_id: oldStoryChoice.request_id, skill: 'Investigation', raw_d20: 16, all_rolls: [16], dc: 14, modifier_total: 0, final_total: 16, success: true, modifier_breakdown: { base_skill: 0, effect_bonus: 0 }, advantage_sources: [], at: '2026-09-07T19:06:51.397Z', had_advantage: false, had_disadvantage: false, roll_origin: 'server', resolution_id: `story-skill:${oldStoryChoice.request_id}`, unified_story_skill_resolution: true };
    const publishedReceiptMatch = matchPersistedStorySkillReceipt({ persisted: persistedPublishedReceipt, incoming: oldStoryChoice.choice_context.check, requestId: oldStoryChoice.request_id });
    const newRoute = routeChoiceAward({ actionType: liveStoryAction.choice_context.action_type, actionText: skill.text, recovery: liveStoryAction.choice_context.recovery, craftingOutcome: { completed: false, yield_quantity: 0 }, narrative: 'The ledger reveals a useful connection.' });
    const oldRoute = routeChoiceAward({ actionType: oldStoryChoice.choice_context.action_type, actionText: skill.text, recovery: oldStoryChoice.choice_context.recovery, craftingOutcome: { completed: false, yield_quantity: 0 }, narrative: 'The ledger reveals a useful connection.' });
    record('skill check zero recovery becomes no award and bypasses crafting', skill.recovery === null && !skillIntent.requires_validation && newRoute.route === 'none');
    record('story-action and story-choice request formats share one award route', newRoute.route === oldRoute.route && newRoute.version === oldRoute.version);
    record('published compact story-choice receipt resolves to persisted authority', publishedReceiptMatch.ok && publishedReceiptMatch.format === 'legacy_compact' && publishedReceiptMatch.receipt === persistedPublishedReceipt);
    const skillEntry = { request_id: liveStoryAction.request_id, action: 'choice', player_choice: skill.text, text: 'The ledger reveals a useful connection.', choices: nextChoices('skill'), skill_check: { ...liveStoryAction.choice_context.check, request_id: liveStoryAction.request_id, unified_story_skill_resolution: true } };
    const skillCommit = commitStoryTransition(session.story_log, skillEntry, liveStoryAction.request_id);
    await db.entities.GameSession.update(session.id, { story_log: skillCommit.story_log });
    session = await db.entities.GameSession.get(session.id);
    record('production-routed story-action commits narration receipt and four fresh choices', session.story_log.at(-1)?.request_id === liveStoryAction.request_id && session.story_log.at(-1)?.text === skillEntry.text && session.story_log.at(-1)?.skill_check?.raw_d20 === 15 && session.story_log.at(-1)?.choices?.length === 4);

    const weapon = normalizeChoiceActionContract({ text: 'Strike the target.', action_type: 'weapon_attack', weapon_attack: { target_ref: 'target' }, recovery: { type: 'arrows', quantity: 0 } });
    const utility = normalizeChoiceActionContract({ text: 'Read the sign.', action_type: 'utility', recovery: { type: 'arrows', quantity: 0 } });
    record('weapon and other zero recoveries become no award', weapon.recovery === null && utility.recovery === null);
    const structuredRoute = routeChoiceAward({ actionType: 'skill_check', actionText: 'Recover three arrows from the target.', recovery: { type: 'arrows', quantity: 3 }, craftingOutcome: { recipe_id: 'hallucinated-recipe' }, narrative: 'You recover exactly three arrows.' });
    record('nonzero recovery on non-crafting action routes to structured recovery', structuredRoute.route === 'structured_recovery' && structuredRoute.recovery?.quantity === 3 && !structuredRoute.crafting.requires_validation);

    const partial = { crafting_contract: true, completed: true, yield_quantity: 3, output: { name: 'Arrows' } };
    const partialIntent = classifyCraftingAwardIntent({ actionText: 'Craft arrows.', craftingOutcome: partial, narrative: 'The work is complete.' });
    const craftingRoute = routeChoiceAward({ actionType: 'crafting', actionText: 'Craft arrows.', craftingOutcome: partial, narrative: 'The work is complete.' });
    const beforeInvalid = JSON.stringify(session.story_log);
    const invalid = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:invalid`, recipe: partial, check: { success: true } });
    session = await db.entities.GameSession.get(session.id);
    record('genuine crafting without recipe fails exact recipe and yield gate', craftingRoute.route === 'crafting' && partialIntent.requires_validation && invalid.body?.reason === 'exact_recipe_and_yield_required' && invalid.body?.writes === 0);
    record('failed crafting cannot mutate story without committed receipt', JSON.stringify(session.story_log) === beforeInvalid);

    const recipe = { crafting_contract: true, recipe_id: 'fixture-arrows', completed: true, time_minutes: 30, tool: { name: "Woodcarver's Tools", provenance: 'fixture bench' }, mechanically_identical: true, yield_quantity: 3, output: { name: 'Arrows', unit: 'arrow', rarity: 'common', compatible_ammo_type: 'Arrows', compatible_weapon: 'Bow' }, ingredients: [{ name: 'Wood Shafts', quantity: 3, source: 'inventory' }, { name: 'Flint', quantity: 3, source: 'inventory' }], provenance: { type: 'fixture' } };
    const validIntent = classifyCraftingAwardIntent({ actionText: 'Craft arrows.', craftingOutcome: recipe, narrative: 'You crafted and received three arrows.' });
    const committed = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:valid`, recipe, check: { success: true } });
    character = await db.entities.Character.get(character.id);
    record('nonzero valid crafting yield commits once', validIntent.requires_validation && committed.body?.applied && committed.body?.writes === 1 && character.inventory.find((item) => item.name === 'Arrows')?.quantity === 5);
    const replay = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:valid`, recipe, check: { success: true } });
    record('crafting replay is idempotent', replay.body?.already_processed === true && replay.body?.writes === 0 && (await db.entities.Character.get(character.id)).inventory.find((item) => item.name === 'Arrows')?.quantity === 5);
    const replayStory = commitStoryTransition(session.story_log, skillEntry, liveStoryAction.request_id);
    record('story replay cannot double commit', replayStory.replayed && replayStory.story_log.filter((entry) => entry.request_id === liveStoryAction.request_id).length === 1);
  } catch (error) {
    record(`execution: ${error.message}`, false);
  } finally {
    for (const [entity, id] of fixtures.reverse()) {
      let absent = false;
      try { await db.entities[entity].delete(id); } catch {}
      try { absent = !(await db.entities[entity].get(id)); } catch { absent = true; }
      cleanup.push({ entity, id, verified_absent: absent });
    }
  }
  record('cleanup verified', cleanup.every((item) => item.verified_absent));
  record('protected live records unchanged', protectedBefore === await hashValue(await readProtectedDndState(db)));
  const passed = results.filter((result) => result.pass).length;
  const allPass = passed === results.length;
  return Response.json({ function_version: 'test-zero-quantity-recovery-routing-v1.2.0', routing_version: CHOICE_AWARD_ROUTING_VERSION, crafting_version: CRAFTING_TRANSACTION_VERSION, receipt_compatibility_version: STORY_SKILL_RECEIPT_COMPATIBILITY_VERSION, passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_verified: cleanup.every((item) => item.verified_absent) }, { status: allPass ? 200 : 500 });
}