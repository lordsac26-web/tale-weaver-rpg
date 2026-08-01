import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const combatId = '6a6d1a9ad247691b6a827fc2';
  const sessionId = '6a6825edd695bd65a4322256';
  const combat = await base44.asServiceRole.entities.CombatLog.get(combatId);
  if (!combat || combat.session_id !== sessionId) return Response.json({ error: 'Scoped combat not found' }, { status: 404 });
  if (!combat.is_active && combat.result === 'defeat') return Response.json({ success: true, already_repaired: true, combat_id: combatId });
  await base44.asServiceRole.entities.CombatLog.update(combatId, {
    is_active: false, result: 'defeat', total_rounds: combat.round || 3,
    session_title: 'The Bones of Sunwatch Keep', character_name: "Craig's Ranger",
    location: 'Sunwatch Keep, Central Courtyard', encounter_date: combat.updated_date || new Date().toISOString(),
  });
  return Response.json({ success: true, repaired: true, combat_id: combatId });
});
