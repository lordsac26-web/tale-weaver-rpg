import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { auditPrecisionShotRoutingFailure } from '../../shared/repairs/precisionShotChoiceRoutingAudit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json();
    if (payload?.apply) return Response.json({ error: 'This endpoint is read-only and never resolves attacks.' }, { status: 405 });
    const [character, session] = await Promise.all([base44.asServiceRole.entities.Character.get(payload.character_id), base44.asServiceRole.entities.GameSession.get(payload.session_id)]);
    if (!character || !session) return Response.json({ error: 'Character or session not found.' }, { status: 404 });
    if (!characterBelongsToUser(character, user) || session.character_id !== character.id) return Response.json({ error: 'Ownership chain is invalid.' }, { status: 403 });
    return Response.json(await auditPrecisionShotRoutingFailure({ db: base44.asServiceRole, character, session }));
  } catch (error) { return Response.json({ error: error.message || 'Precision-shot incident audit failed.' }, { status: 500 }); }
}