const ARTICLES = new Set(['a', 'an', 'the']);

export const normalizeSpellText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/[‐‑–—-]/g, ' ')
  .replace(/[^a-z0-9']+/g, ' ')
  .replace(/'/g, '')
  .trim()
  .replace(/\s+/g, ' ');

const withoutArticles = (value) => normalizeSpellText(value)
  .split(' ')
  .filter((token) => token && !ARTICLES.has(token))
  .join(' ');

const hasCastIntent = (value) => /\b(cast|casting|use|using|invoke|invoking|channel|channeling)\b/i.test(String(value || ''));

const aliasesFor = (name) => {
  const normalized = normalizeSpellText(name);
  if (normalized === 'pass without trace') return ['pass without a trace'];
  return [];
};

export function resolveKnownTypedSpell(character, actionText, requestedName) {
  const known = [...new Set([...(character?.spells_prepared || []), ...(character?.spells_known || [])]
    .filter((name) => typeof name === 'string' && name.trim()))];
  const requested = requestedName ? withoutArticles(requestedName) : '';
  const action = withoutArticles(actionText);
  if (!requested && !hasCastIntent(actionText)) return null;

  const matches = known.filter((name) => {
    const canonical = withoutArticles(name);
    const variants = [canonical, ...aliasesFor(name).map(withoutArticles)];
    return requested ? variants.includes(requested) : variants.some((variant) => action.includes(variant));
  });

  return matches.length === 1 ? matches[0] : null;
}

export const isTypedSpellIntent = hasCastIntent;