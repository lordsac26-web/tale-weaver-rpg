/**
 * Frontend mirror of base44/shared/spells/conditionIdentity.js
 *
 * Only the identity helpers the client skill math needs are mirrored here;
 * the backend module stays authoritative for condition reconciliation.
 */
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

export const preferStructuredCondition = (conditions = [], identity) => {
  const key = conditionIdentityKey(identity);
  return (conditions || []).filter((condition) => conditionIdentityKey(condition) === key)
    .sort((a, b) => structuredScore(b, 'condition') - structuredScore(a, 'condition'))[0] || null;
};