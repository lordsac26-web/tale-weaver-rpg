export const PLAYER_FACING_TEXT_GUARD_VERSION = 'player-facing-text-guard-v1.0.0';

// Template variables and snake_case state keys must never reach player-facing
// text. The header, narration, and choice composer all render from values that
// originate in world_state (e.g. infiltration.player_position), so every story
// commit passes through this guard and every display label goes through the
// humanizer. A key with no human name falls back to descriptive prose.
const TEMPLATE_TOKEN = /\{\{\s*([^{}]+?)\s*\}\}|\$\{\s*([^}]+?)\s*\}|<%\s*(.+?)\s*%>|%\{\s*([^}]+?)\s*\}/g;
const TEMPLATE_TEST = new RegExp(TEMPLATE_TOKEN.source);
const KNOWN_STATE_TOKENS = new Set([
  'at_objective_entry', 'away_from_objective_entry', 'inside_objective', 'concealed_vantage',
  'committed_to_bait', 'past_bait_rotation_continuing', 'new_patrol_development', 'patrolling_near_objective',
]);
const GENERIC_STATE_TOKEN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b/g;
const GENERIC_STATE_TEST = new RegExp(GENERIC_STATE_TOKEN.source);
const POSITION_PREPOSITIONS = new Set(['at', 'near', 'by', 'inside', 'from', 'away', 'past']);

export const isUnresolvedStateToken = (value) => {
  const text = String(value || '');
  if (!text) return false;
  if (TEMPLATE_TEST.test(text)) return true;
  if (KNOWN_STATE_TOKENS.has(text.trim())) return true;
  return GENERIC_STATE_TEST.test(text);
};

export const humanizeStateToken = (token) => {
  const words = String(token || '').toLowerCase().replace(/[{}$<>%]/g, '').split('_').filter(Boolean);
  while (words.length > 1 && POSITION_PREPOSITIONS.has(words[0])) words.shift();
  return `the ${words.join(' ')}`;
};

export const sanitizePlayerFacingText = (text) => {
  let out = String(text || '');
  const repairs = [];
  const record = (from, to) => { if (from !== to) repairs.push({ from, to }); return to; };
  out = out.replace(TEMPLATE_TOKEN, (match, a, b, c, d) => {
    const inner = String(a ?? b ?? c ?? d ?? match).trim();
    return record(match, humanizeStateToken(inner));
  });
  out = out.replace(/\b(?:at_objective_entry|away_from_objective_entry|inside_objective|concealed_vantage|committed_to_bait|past_bait_rotation_continuing|new_patrol_development|patrolling_near_objective)\b/gi,
    (token) => record(token, humanizeStateToken(token)));
  out = out.replace(GENERIC_STATE_TOKEN, (token) => record(token, humanizeStateToken(token)));
  return { text: out, repairs };
};

export const playerFacingLocationLabel = (value, fallback = 'the current area') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (!isUnresolvedStateToken(raw)) return raw;
  const sanitized = sanitizePlayerFacingText(raw).text.trim();
  return sanitized || fallback;
};

// Last line of defense before a story commit: narration, every choice, and the
// location label are repaired in place, and each repair is reported so the leak
// is visible in logs even after the text is fixed.
export const guardPlayerFacingStoryText = (result) => {
  const repairs = [];
  const narrative = sanitizePlayerFacingText(result?.narrative);
  repairs.push(...narrative.repairs);
  const choices = (Array.isArray(result?.choices) ? result.choices : []).map((choice) => {
    const sanitized = sanitizePlayerFacingText(choice?.text);
    repairs.push(...sanitized.repairs);
    return { ...choice, text: sanitized.text };
  });
  let location_update = result?.location_update;
  if (isUnresolvedStateToken(location_update)) {
    const before = String(location_update);
    location_update = playerFacingLocationLabel(before, '');
    repairs.push({ from: before, to: location_update });
  }
  return { result: { ...result, narrative: narrative.text, choices, location_update }, repairs, guard_version: PLAYER_FACING_TEXT_GUARD_VERSION };
};