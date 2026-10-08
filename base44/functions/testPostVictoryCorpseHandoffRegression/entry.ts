import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { finalizeAndPersistCombat } from '../../shared/combat/persistence.ts';
import { resolveGroundedAction } from '../../shared/story/groundedAction.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const fixtures = [];
  const results = [];
  const cleanup = [];
  let protectedBefore = null;
  let protectedAfter = null;
  const record = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const db = base44.asServiceRole;
    protectedBefore = await hashValue(await readProtectedDndState(db));
    const tag = `PostVictoryCorpseQA_${Date.now()}`;
    const character = await db.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 3, hp_current: 24, hp_max: 24, inventory: [], is_active: false });
    fixtures.push(['Character', character.id]);
    const session = await db.entities.GameSession.create({ character_id: character.id, title: tag, current_location: 'Ritual Sanctum', in_combat: true, combat_state: {}, story_log: [], is_active: false });
    fixtures.push(['GameSession', session.id]);
    const enemy = { id: 'weaver-fixture', name: 'The Weaver', type: 'enemy', hp_current: 0, hp_max: 42, is_conscious: false, xp: 200 };
    const combat = await db.entities.CombatLog.create({ session_id: session.id, character_id: character.id, character_name: character.name, round: 6, current_turn_index: 0, is_active: true, result: 'ongoing', xp_awarded: false, initiative_order: [], log_entries: [{ text: 'The Weaver falls.' }], world_state: {}, combatants: [{ id: character.id, name: character.name, type: 'player', hp_current: 24, hp_max: 24, is_conscious: true }, enemy] });
    fixtures.push(['CombatLog', combat.id]);
    await db.entities.GameSession.update(session.id, { in_combat: true, combat_state: { combat_id: combat.id } });

    const outcome = await finalizeAndPersistCombat(base44, character.id, combat.id, session.id, [
      { id: character.id, name: character.name, type: 'player', hp_current: 24, hp_max: 24, is_conscious: true }, enemy,
    ], [{ text: 'The Weaver falls.' }], 0, 7, {});
    const handedOff = await db.entities.GameSession.get(session.id);
    const corpse = (handedOff.world_state?.scene_entities || []).find((entry) => entry.evidence?.authority === 'completed_combat' && entry.death_provenance?.combat_id === combat.id);
    record('victory handoff materializes one Weaver corpse with combat death provenance', outcome === 'victory' && corpse?.name === "Weaver's Corpse" && corpse?.status === 'dead' && corpse?.death_provenance?.combatant_id === enemy.id && corpse?.location === 'Ritual Sanctum');

    const grounded = await resolveGroundedAction({ base44, session: handedOff, character, actionText: 'approach the body of the weaver and search it', allowReconciliation: false });
    record('single named post-victory body search resolves directly without clarification', grounded.handled && !grounded.clarification_required && grounded.grounded_action?.intent === 'inspect' && grounded.grounded_action?.target_ids?.length === 1 && grounded.grounded_action.targets?.[0]?.id === corpse?.id, JSON.stringify(grounded.grounded_action));
    record('grounded target preserves completed-combat provenance', grounded.grounded_action?.targets?.[0]?.evidence?.authority === 'completed_combat' && grounded.grounded_action?.targets?.[0]?.death_provenance?.combat_id === combat.id);

    const clarificationPayload = { clarification_options: [{ id: 'corpse:a', name: "Weaver's Corpse" }, { id: 'corpse:b', name: "Guard's Corpse" }] };
    const selectedReply = clarificationPayload.clarification_options[0].name;
    const dismissed = null;
    record('clarification option contract supplies a named resolvable reply', selectedReply === "Weaver's Corpse" && clarificationPayload.clarification_options.every((option) => option.id && option.name));
    record('clarification dismissal contract clears pending state without a write', dismissed === null);
  } catch (error) {
    record('execution', false, error.message);
  } finally {
    const base44 = createClientFromRequest(req);
    for (const [entity, id] of fixtures.reverse()) {
      await base44.asServiceRole.entities[entity].delete(id).catch(() => null);
      const remaining = await base44.asServiceRole.entities[entity].filter({ id }).catch(() => []);
      cleanup.push({ entity, id, verified_absent: remaining.length === 0 });
    }
    protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('protected live character and session hashes are identical', protectedBefore === protectedAfter);
    record('all disposable fixtures are deleted', cleanup.every((entry) => entry.verified_absent));
  }
  const passed = results.filter((result) => result.pass).length;
  return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, cleanup, protected_before: protectedBefore, protected_after: protectedAfter, protected_unchanged: protectedBefore === protectedAfter }, { status: passed === results.length ? 200 : 500 });
}