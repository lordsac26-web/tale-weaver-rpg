// Strips choice lists that an AI Dungeon Master may have accidentally embedded
// at the end of a narration block. Choices belong in their own button section,
// so we keep the narrative as pure prose for a clean, readable layout.
//
// It removes a trailing run of lines that look like enumerated options or a
// "What do you do?" prompt, while leaving the actual story prose untouched.

const CHOICE_LINE = /^\s*(?:\d+[.)]|[-*•]|[A-D][.)]|Option\s+\d+\s*[:.)-])\s+/i;
const PROMPT_LINE = /^\s*(?:what (?:do|will) you do|what (?:is|will be) your (?:choice|move|next move|action)|choose your|your choices?|your options?)\b.*\??\s*$/i;

export function stripEmbeddedChoices(text) {
  if (!text || typeof text !== 'string') return text;

  const lines = text.split('\n');

  // Walk from the bottom and drop trailing choice/prompt/blank lines.
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1];
    if (line.trim() === '' || CHOICE_LINE.test(line) || PROMPT_LINE.test(line)) {
      end--;
    } else {
      break;
    }
  }

  // Safety: never strip the entire block. If everything looked like a choice,
  // keep the original text rather than rendering nothing.
  if (end === 0) return text.trim();

  return lines.slice(0, end).join('\n').trim();
}