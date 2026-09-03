import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireUser } from '../../shared/combat/authGuard.ts';
import { executeUtilitySpellCast, SPELL_TRANSACTION_VERSION } from '../../shared/spells/castUtilitySpell.ts';

const HEALING_FUNCTION_VERSION = 'cast-character-sheet-healing-v1.1.0';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { user, error: authError } = await requireUser(base44);
    if (authError) return authError;
    const outcome = await executeUtilitySpellCast({ base44, user, payload: { ...(await req.json()), require_healing: true } });
    return Response.json({ ...outcome.body, healing_function_version: HEALING_FUNCTION_VERSION, transaction_version: outcome.body?.transaction_version || SPELL_TRANSACTION_VERSION }, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Character sheet healing cast failed' }, { status: 500 });
  }
}