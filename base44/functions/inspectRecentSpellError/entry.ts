import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, character_id } = await req.json();
    const [session, character, logs, rolls] = await Promise.all([
      base44.asServiceRole.entities.GameSession.get(session_id),
      base44.asServiceRole.entities.Character.get(character_id),
      base44.asServiceRole.entities.CombatLog.filter({ session_id }, '-updated_date', 3),
      base44.asServiceRole.entities.RollRecord.filter({ character_id }, '-created_date', 30),
    ]);
    return Response.json({
      success: true,
      character: { hp_current: character.hp_current, spell_slots: character.spell_slots, long_rest_abilities: character.long_rest_abilities, updated_date: character.updated_date },
      story_count: (session.story_log || []).length,
      recent_story: (session.story_log || []).slice(-5).map((e, index) => ({ index: (session.story_log || []).length - 5 + index, timestamp: e.timestamp, action: e.action, player_choice: e.player_choice })),
      latest_combat: logs?.[0] ? { id: logs[0].id, updated_date: logs[0].updated_date, result: logs[0].result, is_active: logs[0].is_active, entries: (logs[0].log_entries || []).slice(-15).map(e => ({ round: e.round, actor: e.actor, action: e.action, target: e.target, spell_name: e.spell_name, text: e.text })) } : null,
      recent_rolls: (rolls || []).slice(0, 10).map(r => ({ id: r.id, created_date: r.created_date, roll_type: r.roll_type, context: r.context, description: r.description, result: r.result })),
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
