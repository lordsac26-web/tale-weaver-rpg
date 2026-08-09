import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { executeAskDungeonMasterPayload } from '../../shared/askDungeonMasterCore.ts';

export default async function askDungeonMaster(req) {
  try {
    const outcome = await executeAskDungeonMasterPayload(createClientFromRequest(req), await req.json());
    return Response.json(outcome.body, { status: outcome.status });
  } catch {
    return Response.json({ error: 'Unable to provide that clarification.' }, { status: 500 });
  }
}