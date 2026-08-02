import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const SPELL_RE = /\b(cast|casting|invoke|use|using|hunter'?s mark|cure wounds|ensnaring strike|pass without (?:a )?trace|silence|detect magic|spell)\b/i;
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id } = await req.json();
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    const story = (session?.story_log || []).map((e, i) => ({ index: i, timestamp: e.timestamp, player_choice: e.player_choice }))
      .filter(e => SPELL_RE.test(String(e.player_choice || ''))).slice(-30);
    const logs = await base44.asServiceRole.entities.CombatLog.filter({ session_id }, '-updated_date', 50);
    const combat = [];
    for (const log of logs) {
      for (const [i, e] of (log.combat_history || []).entries()) {
        const raw = JSON.stringify(e);
        if (SPELL_RE.test(raw)) combat.push({ combat_id: log.id, updated_date: log.updated_date, index: i, entry: raw.slice(0, 1000) });
      }
    }
    return Response.json({ success: true, story, combat: combat.slice(-50), spell_slots: (await base44.asServiceRole.entities.Character.get(session.character_id)).spell_slots || {} });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
