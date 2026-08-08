const usableText = (value) => typeof value === 'string' && value.trim().length > 0;

export const normalizeSpellName = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[’‘`]/g, "'")
  .replace(/[–—]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}' -]/gu, '');

const sourceObject = (source) => typeof source === 'string' ? { name: source } : (source || {});
const text = (value) => usableText(value) ? value.trim() : '';
const canonicalDescription = (spell) => text(spell?.description) || text(spell?.raw_data?.desc) || text(spell?.desc);
const sourceRank = (spell) => {
  const source = String(spell?.source || spell?.raw_data?.source || spell?.raw_data?.document__title || '').toLowerCase();
  return /phb|basic rules|srd|core|2014/.test(source) ? 2 : source ? 1 : 0;
};

export function selectCanonicalSpell(source, candidates = []) {
  const sourceItem = sourceObject(source);
  const normalizedName = normalizeSpellName(sourceItem.name);
  const matches = candidates.filter((candidate) => normalizeSpellName(candidate?.name) === normalizedName);
  return matches.sort((a, b) => {
    const aDescription = text(a?.description);
    const bDescription = text(b?.description);
    const aRaw = text(a?.raw_data?.desc);
    const bRaw = text(b?.raw_data?.desc);
    const aDesc = text(a?.desc);
    const bDesc = text(b?.desc);
    return Number(Boolean(bDescription)) - Number(Boolean(aDescription)) || Number(Boolean(bRaw)) - Number(Boolean(aRaw)) || Number(Boolean(bDesc)) - Number(Boolean(aDesc)) || sourceRank(b) - sourceRank(a) || String(a?.id || '').localeCompare(String(b?.id || ''));
  })[0] || null;
}

export function enrichSpell(source, candidates = []) {
  const sourceItem = sourceObject(source);
  const canonical = selectCanonicalSpell(sourceItem, candidates);
  const description = text(sourceItem.description) || text(canonical?.description) || text(canonical?.raw_data?.desc) || text(sourceItem.raw_data?.desc) || text(sourceItem.desc) || '';
  return { ...sourceItem, ...(canonical || {}), name: canonical?.name || sourceItem.name || '', description, canonical_spell: canonical };
}

export function enrichSpellList(sources = [], candidates = []) {
  return sources.map((source) => enrichSpell(source, candidates));
}

export function getSpellDescriptionFallback(spell = {}) {
  return `No rules description is available for ${spell.name || 'this spell'}.`;
}