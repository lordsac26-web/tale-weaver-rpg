import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const LIVE_CHARACTER = '6a6825cd07a490fa70a46852';
const LIVE_SESSION = '6a6825edd695bd65a4322256';
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    if (body.action === 'setup') {
      const character = await base44.asServiceRole.entities.Character.create({
        name: 'QA Typed Spell Ranger', class: 'Ranger', level: 5, race: 'Human',
        hp_current: 30, hp_max: 44, armor_class: 16, dexterity: 18, wisdom: 16,
        proficiency_bonus: 3, spell_slots: {}, active_modifiers: [], conditions: [],
        long_rest_abilities: {}, spells_known: ['Cure Wounds','Detect Magic',"Hunter's Mark",'Ensnaring Strike','Pass without Trace','Silence'],
        spells_prepared: ['Cure Wounds','Detect Magic',"Hunter's Mark",'Pass without Trace','Silence'], is_active: false,
      });
      const session = await base44.asServiceRole.entities.GameSession.create({
        title: 'QA Typed Spell Session', character_id: character.id, status: 'active',
        in_combat: false, combat_state: {}, story_log: [], current_location: 'QA Arena',
      });
      return Response.json({ success: true, character_id: character.id, session_id: session.id });
    }
    if (body.action === 'inspect') {
      const [character, session] = await Promise.all([
        base44.asServiceRole.entities.Character.get(body.character_id),
        base44.asServiceRole.entities.GameSession.get(body.session_id),
      ]);
      return Response.json({ success: true, character, session });
    }
    if (body.action === 'cleanup') {
      const logs = body.session_id ? await base44.asServiceRole.entities.CombatLog.filter({ session_id: body.session_id }, '-created_date', 50) : [];
      for (const log of logs) await base44.asServiceRole.entities.CombatLog.delete(log.id);
      if (body.session_id) { try { await base44.asServiceRole.entities.GameSession.delete(body.session_id); } catch {} }
      if (body.character_id) { try { await base44.asServiceRole.entities.Character.delete(body.character_id); } catch {} }
      return Response.json({ success: true, deleted_logs: logs.length });
    }
    if (body.action === 'repair_current') {
      const session = await base44.asServiceRole.entities.GameSession.get(LIVE_SESSION);
      const character = await base44.asServiceRole.entities.Character.get(LIVE_CHARACTER);
      if (!session || session.character_id !== LIVE_CHARACTER) return Response.json({ error: 'Live session/character mismatch' }, { status: 409 });
      const story = session.story_log || [];
      const cure = story.find(e => e.timestamp === '2026-08-02T02:18:56.126Z' && /cast cure wounds at lvl 2/i.test(String(e.player_choice || '')));
      const detect = story.find(e => e.timestamp === '2026-08-02T02:20:24.274Z' && /cast detect magic/i.test(String(e.player_choice || '')));
      if (!cure || !detect) return Response.json({ error: 'Confirmed typed-cast evidence is missing; refusing repair' }, { status: 409 });
      const slots = character.spell_slots || {};
      if (Number(slots.level_1 || 0) !== 2 || Number(slots.level_2 || 0) !== 1) {
        return Response.json({ error: 'Live slot ledger changed since audit; refusing repair', current: slots }, { status: 409 });
      }
      const repaired = { ...slots, level_1: 3, level_2: 2 };
      await base44.asServiceRole.entities.Character.update(LIVE_CHARACTER, { spell_slots: repaired });
      return Response.json({ success: true, before: slots, after: repaired, reconciled: ['Detect Magic (level 1)','Cure Wounds (level 2)'] });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) { return Response.json({ error: error.message || 'QA harness failed' }, { status: 500 }); }
});
