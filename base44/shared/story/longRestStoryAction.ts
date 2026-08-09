import { executeLongRestCore } from './longRestCore.ts';

const LONG_REST = /\b(take\s+(?:a\s+)?long\s+rest|make\s+camp(?:\s+and)?\s+rest(?:\s+for\s+the\s+night)?|sleep\s+until\s+dawn|rest\s+for\s+the\s+night)\b/i;
const NEGATED = /\b(do\s+not|don't|cannot|can't|should\s+i|can\s+i|how\s+(?:do|can)|what\s+(?:is|does)).{0,40}\b(rest|sleep|camp)\b/i;
const SHORT_ONLY = /\bshort\s+rest\b/i;

export function parseLongRestStoryIntent({ actionText, choiceContext }) {
  const metadataIntent = String(choiceContext?.intent || choiceContext?.rest_intent || choiceContext?.canonical_intent || '').toLowerCase();
  const text = String(actionText || '').trim();
  if (!text || NEGATED.test(text) || SHORT_ONLY.test(text)) return null;
  if (metadataIntent === 'long_rest_8h' || metadataIntent === 'sleep_until_dawn' || LONG_REST.test(text)) {
    return { intent: metadataIntent === 'sleep_until_dawn' || /sleep\s+until\s+dawn/i.test(text) ? 'sleep_until_dawn' : 'long_rest_8h' };
  }
  return null;
}

export async function executeLongRestStoryAction({ base44, ownerId, payload }) {
  const parsed = parseLongRestStoryIntent({ actionText: payload?.action_text, choiceContext: payload?.choice_context });
  if (!parsed) return { status: 200, body: { handled: false } };
  const parentId = String(payload?.request_id || '').slice(0, 100);
  if (!parentId) return { status: 400, body: { handled: true, error: 'request_id is required for long-rest story actions.' } };
  const receiptId = `${parentId}:long-rest:0`;
  const core = await executeLongRestCore({ db: base44.asServiceRole, ownerId, characterId: payload.character_id, sessionId: payload.session_id, requestId: receiptId, intent: parsed.intent });
  if (core.status >= 400 || !core.body?.success) return { status: core.status, body: { ...core.body, handled: true, parsed_intent: parsed, parent_id: parentId, receipt_id: receiptId, narration: null } };
  const [character, session] = await Promise.all([base44.asServiceRole.entities.Character.get(payload.character_id), base44.asServiceRole.entities.GameSession.get(payload.session_id)]);
  if (!character || !session) return { status: 500, body: { handled: true, error: 'Rest committed but authoritative state could not be reloaded.', rest_committed: true, parsed_intent: parsed, parent_id: parentId, receipt_id: receiptId } };
  const existing = (session.story_log || []).find((entry) => entry?.request_id === parentId);
  const narration = `You complete a long rest. ${character.name} is restored to ${character.hp_current}/${character.hp_max} HP, and the world reaches ${session.time_of_day}.`;
  if (!existing?.text) {
    const entry = { timestamp: new Date().toISOString(), action: 'choice', request_id: parentId, player_choice: payload.action_text, text: narration, choices: [], long_rest: { receipt_id: receiptId, intent: parsed.intent, clock: core.body.clock } };
    await base44.asServiceRole.entities.GameSession.update(session.id, { story_log: [...(session.story_log || []), entry].slice(-60) });
  }
  return { status: 200, body: { handled: true, success: true, already_processed: !!core.body.already_processed, parsed_intent: parsed, parent_id: parentId, receipt_id: receiptId, rest: core.body, character, session, narration: existing?.text || narration } };
}