import { characterBelongsToUser } from './combat/authGuard.ts';

const idPattern = /^[a-f0-9]{24}$/i;
const invalid = () => Response.json({ error: 'Invalid Ask the DM request.' }, { status: 400 });

export async function buildAskDMContext(base44, user, input) {
  const sessionId = String(input?.session_id || '').trim();
  const characterId = String(input?.character_id || '').trim();
  const requestedCombatId = String(input?.combat_id || '').trim();
  if (!idPattern.test(sessionId) || !idPattern.test(characterId) || (requestedCombatId && !idPattern.test(requestedCombatId))) return { error: invalid() };

  const [session, character] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(sessionId),
    base44.asServiceRole.entities.Character.get(characterId),
  ]);
  if (!session || !character || session.character_id !== character.id || !characterBelongsToUser(character, user)) return { error: invalid() };

  const linkedCombatId = String(session.combat_state?.combat_id || '').trim();
  if (requestedCombatId && requestedCombatId !== linkedCombatId) return { error: invalid() };
  let combat = null;
  if (linkedCombatId) {
    if (!idPattern.test(linkedCombatId)) return { error: invalid() };
    combat = await base44.asServiceRole.entities.CombatLog.get(linkedCombatId);
    if (!combat || combat.session_id !== session.id || (combat.character_id && combat.character_id !== character.id)) return { error: invalid() };
  }

  const visibleCombatants = (combat?.combatants || [])
    .filter((entry) => entry?.type === 'player' || entry?.is_conscious !== false)
    .map((entry) => String(entry.name || entry.type || '').trim())
    .filter(Boolean);
  return {
    error: null,
    session,
    character,
    combat,
    visible: {
      characterName: String(character.name || 'The character'),
      location: String(session.current_location || '').trim(),
      combatants: visibleCombatants,
      hasNarration: (session.story_log || []).some((entry) => String(entry?.text || '').trim().length > 0),
    },
  };
}

export function answerAskDMQuestion(question, visible) {
  const text = String(question || '').trim();
  const normalized = text.toLowerCase();
  const hiddenRequest = /system prompt|developer prompt|api key|secret|hidden (?:dm )?notes?|future (?:plan|encounter)|hidden (?:dc|stats?|stat)|internal id|chain.?of.?thought|unrelated record/i.test(normalized);
  if (hiddenRequest) return 'OOC clarification: I can only discuss player-visible established facts, not private DM information or internal details.';
  if (/\b(roll|attack|cast|spell|rest|heal|advance time|process combat|take an action)\b/i.test(normalized)) return 'OOC clarification: Ask the DM does not take actions, roll dice, cast spells, rest, or advance the story. Use the game controls when you are ready.';
  if (/how many.{0,40}patrol|patrol.{0,40}how many/i.test(normalized)) return 'It is not established how many members are in the patrol.';
  if (/\b(where|location|where are we)\b/i.test(normalized)) return visible.location ? `OOC clarification: The established location is ${visible.location}.` : 'OOC clarification: The current location is not established.';
  if (/\b(who|combatant|enemy|fighting)\b/i.test(normalized) && visible.combatants.length) return `OOC clarification: The visible combatants are ${visible.combatants.join(', ')}.`;
  if (/\b(character|who am i|my name)\b/i.test(normalized)) return `OOC clarification: Your established character is ${visible.characterName}.`;
  return 'OOC clarification: I can only confirm player-visible established facts. That exact detail is not established.';
}