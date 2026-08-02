import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const LIVE_CHARACTER = '6a6825cd07a490fa70a46852';
const LIVE_SESSION = '6a6825edd695bd65a4322256';
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    if (body.action === 'setup') {
      const character = await base44.asServiceRole.entities.Character.create({ name: 'QA Story Healing Ranger', class: 'Ranger', level: 5, race: 'Human', hp_current: 1, hp_max: 44, wisdom: 16, spell_slots: { level_1: 3, level_2: 2 }, spells_known: ['Cure Wounds'], spells_prepared: ['Cure Wounds'], active_modifiers: [], conditions: [], long_rest_abilities: {}, is_active: false });
      const session = await base44.asServiceRole.entities.GameSession.create({ title: 'QA Story Healing', character_id: character.id, status: 'active', in_combat: false, combat_state: {}, story_log: [], current_location: 'QA' });
      return Response.json({ success: true, character_id: character.id, session_id: session.id });
    }
    if (body.action === 'inspect') {
      const character = await base44.asServiceRole.entities.Character.get(body.character_id);
      return Response.json({ success: true, hp_current: character.hp_current, spell_slots: character.spell_slots, long_rest_abilities: character.long_rest_abilities });
    }
    if (body.action === 'cleanup') {
      if (body.session_id) { try { await base44.asServiceRole.entities.GameSession.delete(body.session_id); } catch {} }
      if (body.character_id) { try { await base44.asServiceRole.entities.Character.delete(body.character_id); } catch {} }
      return Response.json({ success: true });
    }
    if (body.action === 'repair_live_interrupted_heal') {
      const [session, character, logs] = await Promise.all([
        base44.asServiceRole.entities.GameSession.get(LIVE_SESSION),
        base44.asServiceRole.entities.Character.get(LIVE_CHARACTER),
        base44.asServiceRole.entities.CombatLog.filter({ session_id: LIVE_SESSION }, '-updated_date', 1),
      ]);
      const slots = character.spell_slots || {};
      const combat = logs?.[0];
      if (session.in_combat || session.combat_state?.combat_id || Number(character.hp_current) !== 1 || Number(slots.level_1) !== 4 || Number(slots.level_2) !== 2 || combat?.result !== 'defeat' || combat?.is_active) {
        return Response.json({ error: 'Live state changed; refusing repair', state: { in_combat: session.in_combat, hp_current: character.hp_current, spell_slots: slots, combat_result: combat?.result, combat_active: combat?.is_active } }, { status: 409 });
      }
      const die = Math.floor(Math.random() * 8) + 1;
      const heal = die + 3;
      const hpAfter = Math.min(Number(character.hp_max) || 44, 1 + heal);
      await base44.asServiceRole.entities.Character.update(LIVE_CHARACTER, { hp_current: hpAfter });
      return Response.json({ success: true, die, wisdom_modifier: 3, heal_amount: heal, hp_before: 1, hp_after: hpAfter, spell_slots: slots });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
