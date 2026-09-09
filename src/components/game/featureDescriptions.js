export const FEATURE_DESCRIPTIONS = {
  'Sneak Attack (1d6)': 'Once per turn, deal an extra 1d6 damage with a finesse or ranged weapon when you have advantage, or when an active ally is within 5 feet of the target and you do not have disadvantage.',
  "Thieves' Cant": 'You know the secret mix of dialect, jargon, and code used by rogues to hide messages in ordinary conversation.',
};

export const featureDescription = feature => {
  if (typeof feature === 'object') return feature?.description || feature?.desc || '';
  return FEATURE_DESCRIPTIONS[feature] || '';
};