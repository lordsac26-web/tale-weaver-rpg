// One normalization for pasted authoritative labels and interaction matching.
// Apostrophes disappear rather than splitting a possessive into different tokens.
export const normalizeEntityName = value => String(value || '').normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/gu, '').toLowerCase()
  .replace(/['\u2018\u2019\u02BC\uFF07]/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function containsEntityName(text, name) {
  const needle=normalizeEntityName(name);
  return !!needle && ` ${normalizeEntityName(text)} `.includes(` ${needle} `);
}