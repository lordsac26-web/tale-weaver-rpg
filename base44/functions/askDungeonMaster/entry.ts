import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';

export default async function askDungeonMaster(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { session_id, question, request_id } = await req.json();
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion || cleanQuestion.length > 600) return Response.json({ error: 'Ask a concise clarification question.' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const character = await base44.asServiceRole.entities.Character.get(session.character_id);
    if (!character || !characterBelongsToUser(character, user)) return Response.json({ error: 'Session does not belong to you' }, { status: 403 });
    const combatId = session.in_combat ? String(session.combat_state?.combat_id || '') : '';
    const combat = combatId ? await base44.asServiceRole.entities.CombatLog.get(combatId) : null;
    const recentStory = (session.story_log || []).slice(-6).map(entry => String(entry?.text || '')).filter(Boolean).join('\n');
    const visibleCombat = (combat?.combatants || []).filter(item => item.type === 'player' || item.is_conscious !== false).map(item => `${item.name}: ${item.type}`).join(', ');
    const prompt = `You are answering out of character in a tabletop RPG. Answer only from the established public facts below. Never invent canon. If an exact detail was not established, say exactly that it was not established. Do not reveal hidden enemies, secrets, DCs, unobserved statistics, future events, or private reasoning. Be concise.\n\nCharacter: ${character.name}\nLocation: ${session.current_location || 'not established'}\nRecent established narration:\n${recentStory || 'No established narration.'}\nVisible combat state: ${visibleCombat || 'No active visible combat.'}\nQuestion: ${cleanQuestion}`;
    const answer = await base44.integrations.Core.InvokeLLM({ prompt });
    return Response.json({ answer: String(answer || '').trim(), request_id: String(request_id || '').slice(0, 120) });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to clarify that right now.' }, { status: 500 });
  }
}