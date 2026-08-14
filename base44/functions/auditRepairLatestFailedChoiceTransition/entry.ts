import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { failedChoiceTransitionRepairCore } from '../../shared/repairs/failedChoiceTransition.ts';

export default async function auditRepairLatestFailedChoiceTransition(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const allowed = new Set(['mode', 'expected_hashes', 'replacement_choices', 'proposal_hash']);
    if (Object.keys(payload).some((key) => !allowed.has(key))) return Response.json({ error: 'Unsupported field.', writes: 0 }, { status: 400 });
    const generateChoices = async (narrative) => {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate exactly four distinct next-action choices grounded ONLY in this already-committed D&D scene. Do not advance narration, resolve actions, roll dice, alter state, or mention facts absent from the scene. Each choice needs text, skill_check, dc 5-25, and risk_level.\n\nSCENE:\n${narrative}`,
        response_json_schema: { type: 'object', properties: { choices: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, skill_check: { type: 'string' }, dc: { type: 'number' }, risk_level: { type: 'string', enum: ['low','medium','high','extreme'] } }, required: ['text','skill_check','dc','risk_level'] } } }, required: ['choices'] },
      });
      return result.choices;
    };
    const outcome = await failedChoiceTransitionRepairCore({ db: base44.asServiceRole, mode: payload.mode, expectedHashes: payload.expected_hashes, replacementChoices: payload.replacement_choices, proposalHash: payload.proposal_hash, generateChoices });
    return Response.json(outcome.body, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed-choice transition audit failed.', writes: 0 }, { status: 500 });
  }
}