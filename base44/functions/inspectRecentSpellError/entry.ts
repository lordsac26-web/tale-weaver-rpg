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
      recent_story: (session.story_log || []).slice(-12).map((e, index) => ({ index: (session.story_log || []).length - 12 + index, timestamp: e.timestamp, action: e.action, player_choice: e.player_choice, text: String(e.text || '').slice(0, 500) })),
      recent_combat: (logs || []).map(l => ({ id: l.id, updated_date: l.updated_date, result: l.result, is_active: l.is_active, entries: (l.log_entries || []).slice(-12) })),
      recent_rolls: (rolls || []).map(r => ({ id: r.id, created_date: r.created_date, updated_date: r.updated_date, roll_type: r.roll_type, context: r.context, description: r.description, result: r.result, metadata: r.metadata })),
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
