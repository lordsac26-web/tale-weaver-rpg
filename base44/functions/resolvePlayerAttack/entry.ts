import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * C1 FIX — Legacy attack resolver, now a THIN PROXY.
 *
 * This function previously reimplemented a stripped-down copy of combatEngine's
 * player_attack (no slot spending, no conditions, no action economy, no turn
 * advancement) — an exploitable divergence. It now forwards the identical payload
 * to combatEngine's player_attack action and returns that response unchanged.
 * Do NOT add combat logic here; combatEngine is the single authority.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, combat_id, character_id, payload } = await req.json();

    const result = await base44.functions.invoke('combatEngine', {
      action: 'player_attack',
      session_id,
      combat_id,
      character_id,
      payload,
    });

    return Response.json(result.data ?? result, { status: result.status || 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});