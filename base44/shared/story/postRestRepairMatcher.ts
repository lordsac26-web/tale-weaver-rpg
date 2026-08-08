export const canonicalSpellKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const identityValues = (value) => typeof value === 'object' && value
  ? [value.name, value.display_name, value.source, value.spell_name]
  : [value];

export const isCanonicalPwt = (value) => identityValues(value).some((entry) => canonicalSpellKey(entry) === 'passwithouttrace');

const same = (actual, expected) => expected == null || String(actual || '') === String(expected);

export const matchPostRestPwtResidue = ({ conditions = [], modifiers = [], worldState = {}, expected = {} }) => {
  const condition = conditions.find((entry) => isCanonicalPwt(entry) && (
    same(entry?.id, expected.condition_id) ||
    (String(entry?.applied_at || '') === String(expected.applied_at || '') && expected.applied_at)
  ));
  const modifier = modifiers.find((entry) => isCanonicalPwt(entry) && entry?.effect === 'skill_bonus' && String(entry?.skill || '').toLowerCase() === 'stealth' && Number(entry?.bonus) === 10 && (
    same(entry?.id, expected.modifier_id) ||
    (String(entry?.applied_at || '') === String(expected.applied_at || '') && expected.applied_at)
  ));
  const concentration = worldState?.active_concentration;
  const lastSpellCast = worldState?.last_spell_cast;
  const sessionRefs = [concentration, lastSpellCast].filter((entry) => isCanonicalPwt(entry));
  const matchingReference = sessionRefs.find((entry) => same(entry?.request_id, expected.request_id) || (String(entry?.applied_at || '') === String(expected.applied_at || '') && expected.applied_at));
  const optionalExpectedValid = (!expected.optional_condition_id || conditions.some((entry) => String(entry?.id || '') === expected.optional_condition_id)) && (!expected.optional_modifier_id || modifiers.some((entry) => String(entry?.id || '') === expected.optional_modifier_id)) && (!expected.optional_request_id || sessionRefs.some((entry) => String(entry?.request_id || '') === expected.optional_request_id)) && (!expected.optional_applied_at || [condition, modifier, ...sessionRefs].some((entry) => String(entry?.applied_at || '') === expected.optional_applied_at));
  return { matched: Boolean(condition && modifier && matchingReference && optionalExpectedValid), condition, modifier, concentration, lastSpellCast, matchingReference, optionalExpectedValid };
};