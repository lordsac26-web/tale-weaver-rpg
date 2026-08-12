const DC_FRAGMENT = /\bDC\s*([1-9]\d?)\b/gi;
const loggedConflicts = new Set();

const validDc = (value) => {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().match(/^(?:DC\s*)?([1-9]\d?)$/i);
  return match ? Number(match[1]) : null;
};

export const sanitizeChoiceSkillLabel = (value) => {
  const raw = String(value || '').trim();
  const wrapped = /^\[\s*skill\s*check\s*:/i.test(raw);
  let label = raw.replace(/^\[\s*skill\s*check\s*:\s*/i, '');
  if (wrapped) label = label.replace(/\]\s*$/, '');
  return label
    .replace(/^\s*skill\s*check\s*:\s*/i, '')
    .replace(/[([]\s*DC\s*[1-9]\d?\s*[)\]]/gi, ' ')
    .replace(DC_FRAGMENT, ' ')
    .replace(/\s+\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,-]+|[\s:;,-]+$/g, '')
    .trim();
};

export const normalizeChoiceCheckDisplay = (choice = {}, { logConflicts = false } = {}) => {
  const rawSkill = String(choice.skill_check ?? choice.skill ?? '');
  const embeddedDcs = [...rawSkill.matchAll(DC_FRAGMENT)].map((match) => Number(match[1]));
  const explicitDc = choice.dc ?? choice.difficulty_class;
  const structuredDc = validDc(explicitDc);
  const dc = structuredDc ?? embeddedDcs[0] ?? null;
  const conflictingDcs = structuredDc === null
    ? embeddedDcs.slice(1).filter((value) => value !== dc)
    : embeddedDcs.filter((value) => value !== structuredDc);
  const skillLabel = sanitizeChoiceSkillLabel(rawSkill);
  const diagnostic = conflictingDcs.length ? {
    type: 'choice_dc_conflict',
    skill_check: rawSkill,
    embedded_dc_values: embeddedDcs,
    structured_dc: structuredDc,
    selected_dc: dc,
  } : null;

  if (diagnostic && logConflicts) {
    const key = JSON.stringify(diagnostic);
    if (!loggedConflicts.has(key)) {
      loggedConflicts.add(key);
      console.warn('[choice-dc-display] Structured DC overrides conflicting embedded label DC.', diagnostic);
    }
  }

  return {
    skillLabel,
    dc,
    badgeText: skillLabel && dc ? `${skillLabel.toUpperCase()} DC ${dc}` : null,
    diagnostic,
  };
};

export const CHOICE_CHECK_BOUNDARY_CONTRACT = Object.freeze({
  production_render_sites: ['src/components/game/StoryPanel.jsx:inline-choice-map-pill-v3'],
  text_children: 'formatted_badge_text_only',
  separately_appends_dc: false,
});

export const createChoiceCheckBadgeElement = (createElement, choice, elementProps = {}) => {
  const display = normalizeChoiceCheckDisplay(choice, { logConflicts: true });
  return display.badgeText ? createElement('span', elementProps, display.badgeText) : null;
};