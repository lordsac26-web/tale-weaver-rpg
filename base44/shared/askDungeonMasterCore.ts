import { answerAskDMQuestion, buildAskDMContext } from './askDMContext.ts';
import { ASK_DM_CONTEXT_VERSION } from './askDMRecentTransactions.ts';

const invalidRequest = { error: 'Invalid Ask the DM request.' };

export async function executeAskDungeonMasterCore(base44, input) {
  const question = String(input?.question || '').trim();
  if (!question || question.length > 600) return { status: 400, body: { error: 'Ask a concise clarification question.' }, authorizationStage: 'invalid_question' };
  const context = await buildAskDMContext(base44, input);
  if (context.error) return { status: 403, body: invalidRequest, authorizationStage: context.authorizationStage || 'rejected' };
  return {
    status: 200,
    authorizationStage: 'accepted',
    body: { ...answerAskDMQuestion(question, context.playerVisibleContext), request_id: String(input?.request_id || '').slice(0, 120), read_only: true, context_version: ASK_DM_CONTEXT_VERSION },
  };
}

export async function executeAskDungeonMasterPayload(base44, payload) {
  return executeAskDungeonMasterCore(base44, payload);
}