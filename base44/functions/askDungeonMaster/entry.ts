import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { answerAskDMQuestion, buildAskDMContext } from '../../shared/askDMContext.ts';

export default async function askDungeonMaster(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Not authorized.' }, { status: 401 });
    const input = await req.json();
    const question = String(input?.question || '').trim();
    if (!question || question.length > 600) return Response.json({ error: 'Ask a concise clarification question.' }, { status: 400 });
    const context = await buildAskDMContext(base44, user, input);
    if (context.error) return context.error;
    return Response.json({ answer: answerAskDMQuestion(question, context.visible), request_id: String(input?.request_id || '').slice(0, 120), read_only: true });
  } catch {
    return Response.json({ error: 'Unable to provide that clarification.' }, { status: 500 });
  }
}