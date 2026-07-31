import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const stripSystem = (record) => {
  const { id, created_date, updated_date, created_by, created_by_id, ...data } = record || {};
  return data;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action = 'setup', character_id, session_id, combat_id } = await req.json();
    const db = base44.asServiceRole.entities;
    if (action === 'setup') {
      const sourceChar = await db.Character.get('6a6825cd07a490fa70a46852');
      const sourceSession = await db.GameSession.get('6a6825edd695bd65a4322256');
      const qaChar = await db.Character.create({ ...stripSystem(sourceChar), name: 'QA Enemy Turn Ranger', hp_current: 30, hp_max: 30, conditions: [], active_modifiers: [], is_active: false });
      const qaSession = await db.GameSession.create({ ...stripSystem(sourceSession), title: 'QA Enemy Turn Session', character_id: qaChar.id, story_log: [], in_combat: true, combat_state: {} });
      const qaCombat = await db.CombatLog.create({
        session_id: qaSession.id,
        combatants: [
          { id: qaChar.id, name: qaChar.name, type: 'player', initiative_roll: 10, initiative_mod: 4, initiative_total: 14, hp_current: 30, hp_max: 30, ac: 16, conditions: [], is_conscious: true },
          { id: 'qa_enemy_turn_skeleton', name: 'QA Skeleton', type: 'enemy', initiative_roll: 15, initiative_mod: 2, initiative_total: 17, hp_current: 10, hp_max: 10, ac: 13, attack_bonus: 5, damage_dice: '1d6', damage_bonus: 2, conditions: [], is_conscious: true, cr: 0.25, xp: 50, archetype: 'brute', attack_type: 'melee' }
        ],
        initiative_order: [
          { id: 'qa_enemy_turn_skeleton', name: 'QA Skeleton', initiative_value: 17, initiative: 17 },
          { id: qaChar.id, name: qaChar.name, initiative_value: 14, initiative: 14 }
        ],
        current_turn_index: 1,
        round: 1,
        is_active: true,
        result: 'ongoing',
        log_entries: [],
        world_state: { actions_used_this_turn: 0, bonus_action_used: false, reaction_used: false },
        xp_earned: 0,
        xp_awarded: false,
        enemies_faced: [],
      });
      await db.GameSession.update(qaSession.id, { combat_state: { combat_id: qaCombat.id } });
      return Response.json({ success: true, character_id: qaChar.id, session_id: qaSession.id, combat_id: qaCombat.id });
    }
    if (action === 'status') {
      const c = await db.Character.get(character_id); const s = await db.GameSession.get(session_id); const l = await db.CombatLog.get(combat_id);
      return Response.json({ success: true, hp_current: c?.hp_current, session_in_combat: s?.in_combat, current_turn_index: l?.current_turn_index, round: l?.round, log_entries: l?.log_entries, combatants: l?.combatants });
    }
    if (action === 'cleanup') {
      if (combat_id) await db.CombatLog.delete(combat_id);
      if (session_id) await db.GameSession.delete(session_id);
      if (character_id) await db.Character.delete(character_id);
      return Response.json({ success: true, deleted: { character_id, session_id, combat_id } });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'QA harness error' }, { status: 500 });
  }
});
