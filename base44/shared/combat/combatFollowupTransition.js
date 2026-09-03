export const COMBAT_FOLLOWUP_TRANSITION_VERSION = 'combat-followup-transition-v1.0.0';

const clean = (value) => String(value ?? '').replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 120);

export function attackBudget(character, worldState = {}) {
  const className = String(character?.class || '').toLowerCase();
  const level = Number(character?.level || 1);
  const total = ['fighter','ranger','paladin','barbarian','monk'].includes(className) && level >= 5 ? (className === 'fighter' && level >= 11 ? (level >= 20 ? 4 : 3) : 2) : 1;
  const used = Number.isFinite(Number(worldState.attacks_used_this_action)) ? Number(worldState.attacks_used_this_action) : Number(worldState.actions_used_this_turn || 0);
  return { total, used: Math.max(0, used), remaining: Math.max(0, total - Math.max(0, used)) };
}

export function buildCombatRequestKey({ combat, sessionId, characterId, targetId = 'none', actionType, suffix = '' }) {
  const world = combat?.world_state || {};
  const slot = Number.isFinite(Number(world.attacks_used_this_action)) ? Number(world.attacks_used_this_action) : Number(world.actions_used_this_turn || 0);
  return [COMBAT_FOLLOWUP_TRANSITION_VERSION, clean(sessionId), clean(combat?.id), `r${Number(combat?.round || 1)}`, `t${Number(combat?.current_turn_index || 0)}`, `a${slot}`, clean(characterId), clean(actionType), clean(targetId), clean(suffix)].filter(Boolean).join(':');
}

export function beginCombatIntent(ref, requestId) {
  if (!requestId || ref.current?.inFlight) return false;
  ref.current = { requestId, inFlight: true };
  return true;
}

export function finishCombatIntent(ref, requestId) {
  if (ref.current?.requestId === requestId) ref.current = { requestId, inFlight: false };
}

export function oneEphemeralCombatError(current, message) {
  const text = String(message || 'That combat action could not be resolved. Refresh and retry.');
  return current === text ? current : text;
}