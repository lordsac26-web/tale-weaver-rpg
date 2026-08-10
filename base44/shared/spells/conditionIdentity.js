export const conditionIdentityKey = (value) => {
  const raw = typeof value === 'object' && value
    ? value.display_name || value.name || value.source || value.spell_name || ''
    : value;
  return String(raw || '').normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
};

export const isPassWithoutTraceIdentity = (value) => conditionIdentityKey(value).replace(/\s+/g, '') === 'passwithouttrace';

const structuredScore = (entry, kind) => {
  if (!entry || typeof entry !== 'object') return kind === 'condition' ? 10 : 0;
  const linked = !!entry.id && !!entry.target_id && !!entry.caster_id;
  const timed = !!entry.duration_type && (!!entry.expires_at || entry.duration_type === 'concentration');
  return (kind === 'condition' ? 20 : 0) + (linked ? 40 : 0) + (timed ? 20 : 0) + (entry.concentration === true ? 10 : 0);
};

export function deriveConditionBadges(conditions = [], modifiers = []) {
  const chosen = new Map();
  const consider = (entry, kind, allowNew) => {
    if (!entry) return;
    const key = conditionIdentityKey(entry);
    if (!key || (!allowNew && !chosen.has(key))) return;
    const candidate = { entry, kind, key, score: structuredScore(entry, kind) };
    const prior = chosen.get(key);
    if (!prior || candidate.score > prior.score) chosen.set(key, candidate);
  };
  for (const condition of conditions || []) consider(condition, 'condition', true);
  for (const modifier of modifiers || []) consider(modifier, 'modifier', false);
  return [...chosen.values()].map(({ entry }) => entry);
}

export const preferStructuredCondition = (conditions = [], identity) => {
  const key = conditionIdentityKey(identity);
  return (conditions || []).filter((condition) => conditionIdentityKey(condition) === key)
    .sort((a, b) => structuredScore(b, 'condition') - structuredScore(a, 'condition'))[0] || null;
};