import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireUser } from '../../shared/combat/authGuard.ts';
import { executeUtilitySpellCast, SPELL_TRANSACTION_VERSION } from '../../shared/spells/castUtilitySpell.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, error: authError } = await requireUser(base44);
    if (authError) return authError;
    const outcome = await executeUtilitySpellCast({ base44, user, payload: await req.json() });
    return Response.json({ ...outcome.body, function_version: 'cast-utility-spell-v1.1.0', transaction_version: outcome.body?.transaction_version || SPELL_TRANSACTION_VERSION }, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Typed spell cast failed' }, { status: 500 });
  }
});