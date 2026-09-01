import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { failedChoiceTransitionRepairCore, FAILED_CHOICE_SCOPE } from '../../shared/repairs/failedChoiceTransition.ts';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';

export default async function auditRepairLatestFailedChoiceTransition(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const owner = user ? await base44.asServiceRole.entities.Character.get(FAILED_CHOICE_SCOPE.characterId).catch(() => null) : null;
    if (!user || !owner || !characterBelongsToUser(owner, user)) return Response.json({ error: 'Owner authorization required.', writes: 0 }, { status: 403 });
    const payload = await req.json().catch(() => ({}));
    const allowed = new Set(['mode', 'expected_hashes', 'replacement_narrative', 'replacement_choices', 'proposal_hash']);
    if (Object.keys(payload).some((key) => !allowed.has(key))) return Response.json({ error: 'Unsupported field.', writes: 0 }, { status: 400 });
    const generateChoices = async ({ scene, check }) => {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write one concise, grounded failure continuation for the immutable Athletics check below, then exactly four distinct next choices. Do not reroll, award items, change HP/resources, start combat, or mention facts absent from the scene.\nCHECK: d20 ${check.raw_d20} + ${check.modifier_total} = ${check.final_total} vs DC ${check.dc}: FAILURE.\nSCENE:\n${scene}`,
        response_json_schema: { type: 'object', properties: { narrative: { type: 'string' }, choices: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, skill_check: { type: 'string' }, dc: { type: 'number' }, risk_level: { type: 'string', enum: ['low','medium','high','extreme'] } }, required: ['text','skill_check','dc','risk_level'] } } }, required: ['narrative','choices'] },
      });
      return result;
    };
    const outcome = await failedChoiceTransitionRepairCore({ db: base44.asServiceRole, mode: payload.mode, expectedHashes: payload.expected_hashes, replacementNarrative: payload.replacement_narrative, replacementChoices: payload.replacement_choices, proposalHash: payload.proposal_hash, generateChoices });
    return Response.json(outcome.body, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed-choice transition audit failed.', writes: 0 }, { status: 500 });
  }
}