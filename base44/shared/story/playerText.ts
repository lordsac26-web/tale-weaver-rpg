export const PLAYER_TEXT_LIMIT = 8000;
export const PLAYER_TEXT_VERSION = 'player-text-codepoints-v1';
export const playerTextCount = value => Array.from(String(value ?? '')).length;
export function validatePlayerText(value, allowEmpty = false) {
  if (typeof value !== 'string') return { ok: false, error: 'Please enter your action as text.', writes: 0 };
  const count = playerTextCount(value);
  if (count > PLAYER_TEXT_LIMIT) return { ok: false, error: `Your message has ${count.toLocaleString('en-US')} characters; the limit is 8,000. Please shorten it. Your draft has not been truncated.`, error_code: 'player_text_too_long', count, limit: PLAYER_TEXT_LIMIT, writes: 0 };
  const text = value.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();
  if (!allowEmpty && !text) return { ok: false, error: 'Please describe what you want to do.', writes: 0 };
  return { ok: true, text, count, limit: PLAYER_TEXT_LIMIT, version: PLAYER_TEXT_VERSION };
}