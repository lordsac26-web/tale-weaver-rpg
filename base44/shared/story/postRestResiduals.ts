export const hashValue = (value) => Array.from(new TextEncoder().encode(JSON.stringify(value))).reduce((total, byte) => ((total * 31) + byte) >>> 0, 0).toString(16);
export const spellKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export const isPwt = (value) => ['name', 'display_name', 'source', 'spell_name'].some((key) => spellKey(typeof value === 'object' ? value?.[key] : value) === 'passwithouttrace');
export const PWT_CONDITION_ID = 'cond_pass_without_trace_1786201357801_7itvpo';
export const PWT_APPLIED_AT = '2026-08-08T15:02:37.801Z';

export const repairPostRestNarration = (text) => {
  const replacements = [];
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).map((sentence) => {
    const original = sentence;
    let next = sentence
      .replace(/weary mind/ig, 'clear, alert mind')
      .replace(/(?:suffer(?:ing|s)? from |experienc(?:ing|es) |due to )?exhaustion/ig, 'full-rest clarity')
      .replace(/\b(?:fatigued|fatigue|tired|weary|ragged|sleepless|spent)\b/ig, 'fully rested')
      .replace(/(?:lingering remnants? of (?:your |the )?(?:pre-rest )?magic|lingering magical remnants?)(?:\s+(?:still )?(?:mask(?:ing)?|conceal(?:ing)?|hide|obscur(?:ing)?)\s+(?:your |his )?movements?)?/ig, 'no active magical concealment');
    if (next !== original) replacements.push({ before: original, after: next });
    return next;
  });
  return { text: sentences.join(' '), replacements };
};

export const hasPostRestResidualNarration = (text) => /\b(?:fatigue|fatigued|tired|weary|ragged|sleepless|spent|exhaustion)\b|lingering remnants? of (?:your |the )?(?:pre-rest )?magic/i.test(String(text || ''));

export const combatWithoutPlayerConditions = (combat) => ({ ...combat, combatants: (combat?.combatants || []).map((entry) => entry?.type === 'player' ? { ...entry, conditions: undefined } : entry) });