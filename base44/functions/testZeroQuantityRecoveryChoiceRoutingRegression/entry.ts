import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeChoiceActionContract } from '../../shared/story/choiceActionContract.js';
import { classifyCraftingAwardIntent, CHOICE_AWARD_ROUTING_VERSION } from '../../shared/story/choiceAwardRouting.js';
import { executeCraftingTransaction, CRAFTING_TRANSACTION_VERSION } from '../../shared/craftingTransaction.ts';
import { commitStoryTransition } from '../../shared/story/storyTransition.ts';
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
    record('skill check zero recovery becomes no award and bypasses crafting', skill.recovery === null && !skillIntent.requires_validation);
    const skillEntry = { request_id: 'skill-zero', action: 'choice', player_choice: skill.text, text: 'The ledger reveals a useful connection.', choices: nextChoices('skill'), skill_check: { request_id: 'skill-zero', unified_story_skill_resolution: true, success: true, raw_d20: 16, modifier_total: 0, final_total: 16, dc: 14, skill: 'Investigation' } };
    const skillCommit = commitStoryTransition(session.story_log, skillEntry, 'skill-zero');
    await db.entities.GameSession.update(session.id, { story_log: skillCommit.story_log });
    session = await db.entities.GameSession.get(session.id);
    record('plain skill check commits narration and four choices', session.story_log.at(-1)?.request_id === 'skill-zero' && session.story_log.at(-1)?.choices?.length === 4);

    const weapon = normalizeChoiceActionContract({ text: 'Strike the target.', action_type: 'weapon_attack', weapon_attack: { target_ref: 'target' }, recovery: { type: 'arrows', quantity: 0 } });
    const utility = normalizeChoiceActionContract({ text: 'Read the sign.', action_type: 'utility', recovery: { type: 'arrows', quantity: 0 } });
    record('weapon and other zero recoveries become no award', weapon.recovery === null && utility.recovery === null);

    const partial = { crafting_contract: true, completed: true, yield_quantity: 3, output: { name: 'Arrows' } };
    const partialIntent = classifyCraftingAwardIntent({ actionText: 'Craft arrows.', craftingOutcome: partial, narrative: 'The work is complete.' });
    const beforeInvalid = JSON.stringify(session.story_log);
    const invalid = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:invalid`, recipe: partial, check: { success: true } });
    session = await db.entities.GameSession.get(session.id);
    record('genuine crafting without recipe fails exact recipe and yield gate', partialIntent.requires_validation && invalid.body?.reason === 'exact_recipe_and_yield_required' && invalid.body?.writes === 0);
    record('failed crafting cannot mutate story without committed receipt', JSON.stringify(session.story_log) === beforeInvalid);

    const recipe = { crafting_contract: true, recipe_id: 'fixture-arrows', completed: true, time_minutes: 30, tool: { name: "Woodcarver's Tools", provenance: 'fixture bench' }, mechanically_identical: true, yield_quantity: 3, output: { name: 'Arrows', unit: 'arrow', rarity: 'common', compatible_ammo_type: 'Arrows', compatible_weapon: 'Bow' }, ingredients: [{ name: 'Wood Shafts', quantity: 3, source: 'inventory' }, { name: 'Flint', quantity: 3, source: 'inventory' }], provenance: { type: 'fixture' } };
    const validIntent = classifyCraftingAwardIntent({ actionText: 'Craft arrows.', craftingOutcome: recipe, narrative: 'You crafted and received three arrows.' });
    const committed = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:valid`, recipe, check: { success: true } });
    character = await db.entities.Character.get(character.id);
    record('nonzero valid crafting yield commits once', validIntent.requires_validation && committed.body?.applied && committed.body?.writes === 1 && character.inventory.find((item) => item.name === 'Arrows')?.quantity === 5);
    const replay = await executeCraftingTransaction({ base44, characterId: character.id, sessionId: session.id, requestId: `${tag}:valid`, recipe, check: { success: true } });
    record('crafting replay is idempotent', replay.body?.already_processed === true && replay.body?.writes === 0 && (await db.entities.Character.get(character.id)).inventory.find((item) => item.name === 'Arrows')?.quantity === 5);
    const replayStory = commitStoryTransition(session.story_log, skillEntry, 'skill-zero');
    record('story replay cannot double commit', replayStory.replayed && replayStory.story_log.filter((entry) => entry.request_id === 'skill-zero').length === 1);
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
  return Response.json({ function_version: 'test-zero-quantity-recovery-routing-v1.0.0', routing_version: CHOICE_AWARD_ROUTING_VERSION, crafting_version: CRAFTING_TRANSACTION_VERSION, passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_verified: cleanup.every((item) => item.verified_absent) }, { status: allPass ? 200 : 500 });
}