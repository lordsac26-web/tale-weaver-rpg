import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ownerAttestedSevenArrowRecoveryCore } from '../../shared/repairs/ownerAttestedSevenArrowRecovery.ts';

export default async function applyOwnerAttestedSevenArrowRecovery(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', writes: 0 }, { status: 401 });
    const payload = await req.json().catch(() => ({}));
    const allowed = new Set(['mode', 'expected_hashes']);
    if (Object.keys(payload).some((key) => !allowed.has(key))) return Response.json({ error: 'Only mode and expected_hashes are accepted.', writes: 0 }, { status: 400 });
    const result = await ownerAttestedSevenArrowRecoveryCore({ db: base44.asServiceRole, user, mode: payload.mode, expectedHashes: payload.expected_hashes });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Owner-attested seven-arrow recovery failed.', writes: 0 }, { status: 500 });
  }
}