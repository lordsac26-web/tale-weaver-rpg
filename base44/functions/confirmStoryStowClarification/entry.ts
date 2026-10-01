import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { confirmContextualStow } from '../../shared/story/confirmContextualStow.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json();
    if (!payload.session_id || !payload.character_id || (!payload.original_request_id && payload.read_only !== true) || (payload.selected_source_ids !== undefined && (!Array.isArray(payload.selected_source_ids) || payload.selected_source_ids.length > 8))) return Response.json({ error: 'Choose the bodies for the saved attempt.', writes: 0 }, { status: 400 });
    const result = await confirmContextualStow({ base44, ownerId: user.id, payload });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'The saved stow attempt could not be confirmed. Keep this attempt paused.', partial_write_possible: true }, { status: 500 });
  }
}