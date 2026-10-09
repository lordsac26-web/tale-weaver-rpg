import { executeUtilitySpellCast } from '../spells/castUtilitySpell.ts';

export const IMBUED_PROJECTILE_SPELL_VERSION = 'imbued-projectile-spell-v1.0.0';

const IMBUED_SPELL_PATTERNS = [
  { pattern: /\bsilence[-\s]*imbued\b/i, spell: 'Silence' },
  { pattern: /\bsilenced\s+(?:arrow|bolt|ammunition|projectile)\b/i, spell: 'Silence' },
  { pattern: /\b(?:arrow|bolt|ammunition|projectile)\s+of\s+silence\b/i, spell: 'Silence' },
];

export function classifyImbuedProjectileSpell(actionText, weaponAttackContract) {
  const text = String(actionText || '');
  if (!text) return null;
  for (const entry of IMBUED_SPELL_PATTERNS) {
    if (entry.pattern.test(text)) {
      const targetRef = weaponAttackContract?.target_ref || null;
      if (!targetRef) return { detected: true, spell: entry.spell, targetRef: null, error: 'No target_ref on the weapon_attack contract to anchor the imbued spell.' };
      return { detected: true, spell: entry.spell, targetRef };
    }
  }
  return null;
}

export async function resolveImbuedProjectileSpell({ base44, user, payload }) {
  const { action_text, weapon_attack, request_id, character_id, session_id } = payload || {};
  const classification = classifyImbuedProjectileSpell(action_text, weapon_attack);
  if (!classification?.detected) return { handled: false };
  if (classification.error) return { handled: true, error: classification.error, writes: 0 };

  const spellName = classification.spell;
  const targetRef = classification.targetRef;

  const castOutcome = await executeUtilitySpellCast({
    base44,
    user,
    payload: {
      session_id,
      character_id,
      spell_name: spellName,
      action_text: `Cast ${spellName} centered on the ${targetRef}'s position.`,
      request_id: `${request_id}:imbued:0`,
      target: { kind: 'point_area', anchor: targetRef, within_range: true },
    },
  });

  if (castOutcome.status >= 400) {
    return { handled: true, error: castOutcome.body?.error || `${spellName} could not be cast.`, code: castOutcome.body?.code, writes: castOutcome.body?.writes ?? 0 };
  }
  if (!castOutcome.body?.spell_detected) return { handled: true, skipped: 'spell_not_detected', writes: 0 };
  return { handled: true, cast: castOutcome.body, writes: castOutcome.body?.writes ?? 0 };
}