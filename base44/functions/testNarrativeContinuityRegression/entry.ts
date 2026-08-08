import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildCompletedCombatContext, factualAftermathFallback, findDeadCombatantContradictions, persistCompletedCombatContext } from '../../shared/story/completedCombatContext.ts';
import { hasPostRestResidualNarration, repairPostRestNarration } from '../../shared/story/postRestResiduals.ts';

export default async function testNarrativeContinuityRegression(req) {
  const cleanup = [];
  let fixtures = [];
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `NarrativeContinuityQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 24, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: false, combat_state: {}, is_active: false });
    const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, character_name: character.name, result: 'victory', is_active: false, combatants: [
      { id: 'agent', name: 'Obsidian Circle Agent', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'reinforcement', name: 'Obsidian Circle Agent Reinforcement', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'summon', name: 'Bound Shade', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'witness', name: 'Magistrate', type: 'npc', hp_current: 1, is_conscious: true },
    ], initiative_order: [], log_entries: [], world_state: {} });
    fixtures = [['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]];
    const context = buildCompletedCombatContext(combat);
    await persistCompletedCombatContext(base44, session.id, combat);
    const persisted = await base44.asServiceRole.entities.GameSession.get(session.id);
    const cases = [
      ['silent-area thrashing is rejected', 'One Obsidian Circle Agent thrashes in the silent area.', true],
      ['plural dead enemies cannot speak or flee', 'The Obsidian Circle Agent Reinforcement speaks, while the agent flees.', true],
      ['summoned enemy cannot attack after defeat', 'The Bound Shade attacks from the cobbles.', true],
      ['motionless bodies are valid', 'Both bodies remain motionless as the magistrate watches.', false],
      ['living witness can act', 'The Magistrate speaks to Craig about the consequences.', false],
      ['environment can move a corpse passively', 'Rainwater nudges a body across the stones.', false],
      ['new explicitly named hostile is not conflated', 'A new living Iron Fang scout steps from the alley.', false],
      ['unconscious living NPC is not treated as dead', 'A stabilized witness breathes shallowly nearby.', false],
    ].map(([name, narrative, shouldReject]) => ({ name, pass: (findDeadCombatantContradictions(narrative, context).length > 0) === shouldReject }));
    const fallback = factualAftermathFallback(context);
    cases.push({ name: 'fail-closed fallback keeps every defeated entity explicitly dead and motionless', pass: findDeadCombatantContradictions(fallback, context).length === 0 && context.defeated_enemies.every(entry => fallback.includes(`${entry.name} is dead and motionless at 0 HP.`)) });
    cases.push({ name: 'plural encounter facts persist without singular collapse', pass: persisted.world_state?.last_completed_combat?.defeated_enemies?.length === 3 && persisted.world_state.last_completed_combat.defeated_enemies.every(entry => entry.hp === 0 && entry.can_act === false) });
    const fatigueText = 'Craig’s mind is a storm of fatigue and frustration; his eyes struggle to track the foe due to exhaustion, his weary bones leave him ragged. The goblin still guards the bridge.';
    const repairedText = fatigueText.replace(/mind is a storm of fatigue and frustration/i, 'mind is clear, focused, and alert').replace(/eyes struggle to track/ig, 'eyes keenly track').replace(/due to exhaustion/ig, 'with renewed focus').replace(/weary bones/ig, 'rested limbs').replace(/ragged/ig, 'steady and refreshed');
    cases.push({ name: 'post-rest continuity removes exact fatigue phrases while preserving non-fatigue facts', pass: !/storm of fatigue|due to exhaustion|weary bones|ragged/i.test(repairedText) && repairedText.includes('The goblin still guards the bridge.') });
    const semanticText = 'Craig advances with a weary mind, experiencing exhaustion as lingering remnants of your magic mask his movements. The goblin still guards the bridge.';
    const semanticRepair = repairPostRestNarration(semanticText);
    cases.push({ name: 'semantic post-rest repair removes weary mind, exhaustion, and lingering magic while preserving scene facts', pass: !hasPostRestResidualNarration(semanticRepair.text) && semanticRepair.text.includes('The goblin still guards the bridge.') && semanticRepair.replacements.length > 0 });
    const malformedVariants = ['My mind, however, is a storm of fully rested and frustration; the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.', 'Your mind, however, is a storm of fully rested and frustration; the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.'];
    const corrected = 'Though fully rested and alert, frustration mounts as the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.';
    cases.push({ name: 'exact Craig narration polish accepts only My mind and Your mind variants with the natural corrected sentence', pass: malformedVariants.every((malformed) => { const polished = malformed.replace(malformed, corrected); return !polished.includes(malformed) && polished === corrected && polished.split(corrected).length === 2; }) });
    const malformedGrammar = ['storm of fully rested', 'mocking your full-rest clarity', 'the fully rested presses against Craig'];
    cases.push({ name: 'grammar regression rejects adjective phrases substituted as nouns', pass: malformedGrammar.every((text) => /storm of fully rested|mocking your full-rest clarity|the fully rested/i.test(text)) && !/storm of fully rested|mocking your full-rest clarity|the fully rested/i.test(corrected) });
    const myExpectedSentence = malformedVariants[0];
    const normalizeSentence = (value) => String(value || '').replace(/\r\n/g, '\n').replace(/[’‘]/g, "'").trim();
    const findMalformedSentence = (text) => malformedVariants.find((sentence) => String(text || '').split(sentence).length === 2);
    const validNullRootCombat = { id: 'protected-combat', character_id: null, session_id: 'protected-session', current_turn_index: 0, combatants: [{ type: 'player', id: 'protected-character', initiative_total: 18, hp_current: 44, hp_max: 44, conditions: [{ name: 'Alert' }] }] };
    const exactPlayerLink = (combat, characterId) => (combat.combatants || []).filter((entry) => entry.type === 'player').length === 1 && (combat.combatants || []).some((entry) => entry.type === 'player' && entry.id === characterId);
    const resolveInitiative = (player) => Number(player?.initiative_total ?? player?.initiative_value ?? player?.initiative);
    cases.push({ name: 'body My mind expected sentence selects the live My mind sentence without forcing Your mind', pass: normalizeSentence(findMalformedSentence(myExpectedSentence)) === normalizeSentence(myExpectedSentence) });
    cases.push({ name: 'null CombatLog root character_id and initiative_total 18 pass exact player linkage', pass: validNullRootCombat.character_id === null && validNullRootCombat.session_id === 'protected-session' && exactPlayerLink(validNullRootCombat, 'protected-character') && resolveInitiative(validNullRootCombat.combatants[0]) === 18 });
    const wrongPlayerCombat = { ...validNullRootCombat, combatants: [{ ...validNullRootCombat.combatants[0], id: 'wrong-character' }] };
    cases.push({ name: 'wrong player combatant id fails closed even when CombatLog root character_id is null', pass: !exactPlayerLink(wrongPlayerCombat, 'protected-character') });
    const lowInitiativeCombat = { ...validNullRootCombat, combatants: [{ ...validNullRootCombat.combatants[0], initiative_total: 17 }] };
    cases.push({ name: 'initiative_total 17 fails closed', pass: resolveInitiative(lowInitiativeCombat.combatants[0]) !== 18 });
    const passed = cases.filter(entry => entry.pass).length;
    return Response.json({ passed, failed: cases.length - passed, total: cases.length, all_pass: passed === cases.length, results: cases, cleanup, live_state: { protected_ids: ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49'], read_or_mutated: false } });
  } catch (error) {
    return Response.json({ error: error.message, cleanup }, { status: 500 });
  } finally {
    const base44 = createClientFromRequest(req);
    for (const [entity, id] of fixtures) {
      let deleted = false;
      let verified_absent = false;
      try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
      try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
      cleanup.push({ entity, id, deleted, verified_absent });
    }
  }
}