import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * spendResource — server-authoritative spending of limited class resources.
 *
 * Replaces direct client-side Character.update calls for resources that could
 * otherwise be tampered with from the browser. Validates class, level, and the
 * remaining pool before deducting. Currently handles:
 *   - resource: "ki"     → Monk Ki points (Flurry of Blows, Patient Defense, Step of the Wind)
 *   - resource: "bardic" → Bardic Inspiration uses
 *
 * Payload: { resource: "ki" | "bardic", character_id: string, amount?: number, ability?: string }
 * Returns: { success, remaining, max, log_text } or { error, invalid }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { resource, character_id, amount = 1, ability } = await req.json();
    if (!character_id) return Response.json({ error: 'character_id required' }, { status: 400 });

    const character = await base44.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    const statMod = (s) => Math.floor(((s || 10) - 10) / 2);
    const charClass = (character.class || '').toLowerCase();
    const level = character.level || 1;
    const cost = Math.max(1, parseInt(amount) || 1);

    // ── KI (Monk) ───────────────────────────────────────────────────────────
    if (resource === 'ki') {
      if (charClass !== 'monk' || level < 2) {
        return Response.json({ error: 'Ki points require Monk level 2+.', invalid: true }, { status: 400 });
      }
      const max = character.ki_points_max ?? level;
      // Initialize the pool on first use if it was never set.
      const remaining = character.ki_points_remaining ?? max;
      if (remaining < cost) {
        return Response.json({ error: `Not enough Ki (need ${cost}, have ${remaining}).`, invalid: true }, { status: 400 });
      }
      const newRemaining = remaining - cost;
      await base44.entities.Character.update(character_id, {
        ki_points_max: max,
        ki_points_remaining: newRemaining,
      });
      const label = ability || 'a Ki ability';
      return Response.json({
        success: true,
        remaining: newRemaining,
        max,
        log_text: `🌀 ${character.name} spends ${cost} Ki on ${label}. (${newRemaining}/${max} Ki remaining)`,
      });
    }

    // ── BARDIC INSPIRATION (Bard) ─────────────────────────────────────────────
    if (resource === 'bardic') {
      if (charClass !== 'bard') {
        return Response.json({ error: 'Bardic Inspiration requires the Bard class.', invalid: true }, { status: 400 });
      }
      const max = character.bardic_inspiration_max ?? Math.max(1, statMod(character.charisma));
      const remaining = character.bardic_inspiration_remaining ?? max;
      if (remaining < cost) {
        return Response.json({ error: `No Bardic Inspiration uses left (refreshes on a rest).`, invalid: true }, { status: 400 });
      }
      const newRemaining = remaining - cost;
      await base44.entities.Character.update(character_id, {
        bardic_inspiration_max: max,
        bardic_inspiration_remaining: newRemaining,
      });
      const die = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';
      return Response.json({
        success: true,
        remaining: newRemaining,
        max,
        die,
        log_text: `🎵 ${character.name} grants a ${die} Bardic Inspiration die! (${newRemaining}/${max} remaining)`,
      });
    }

    return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});