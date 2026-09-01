import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { LIVE_STALE_CHOICE_SCOPE, staleChoiceTransitionRepairCore } from '../../shared/repairs/staleChoiceTransition.ts';

export default async function auditRepairLatestStaleChoiceTransition(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const character = user ? await base44.asServiceRole.entities.Character.get(LIVE_STALE_CHOICE_SCOPE.characterId).catch(() => null) : null;
    if (!user || !character || !characterBelongsToUser(character, user)) return Response.json({ error: 'Owner authorization required.', writes: 0 }, { status: 403 });
    const payload = await req.json().catch(() => ({}));
    const allowed = new Set(['mode', 'response_format', 'apply_token']);
    if (Object.keys(payload).some((key) => !allowed.has(key))) return Response.json({ error: 'Unsupported field.', writes: 0 }, { status: 400 });
    if (payload.response_format && (payload.response_format !== 'guard_only' || !['discover', 'dry_run'].includes(payload.mode))) return Response.json({ error: 'guard_only is accepted only for discover or dry_run.', writes: 0 }, { status: 400 });
    const outcome = await staleChoiceTransitionRepairCore({ db: base44.asServiceRole, mode: payload.mode, responseFormat: payload.response_format, applyToken: payload.apply_token });
    return Response.json(outcome.body, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Stale-choice transition audit failed.', writes: 0 }, { status: 500 });
  }
}