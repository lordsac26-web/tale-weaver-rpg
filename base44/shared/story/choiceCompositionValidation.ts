/**
 * Choice Composition Validation
 *
 * The choice generator (composer) must never offer an option that cannot
 * execute end-to-end with the character's authoritative state. This module
 * validates composed options at two points:
 *   1. Composition time — after the LLM generates a choice list (filter).
 *   2. Dispatch time — when a player clicks a displayed option (state may
 *      have changed between generation and click; reject zero-write).
 *
 * Checks: spell slots per level, concentration (one at a time), spells
 * known/prepared, ammunition, and RAW spell-targeting phrasing (never a
 * spell attached to a projectile).
 */

export const CHOICE_COMPOSITION_VALIDATION_VERSION = 'choice-composition-validation-v1.0.0';

import { deriveCanonicalSpellSlots } from '../spells/slotProgression.ts';

const IMBUED_PHRASING = /\b[\w'-]+[-\s]imbued\b/i;
const RANGED_WEAPON = /\b(longbow|shortbow|crossbow|bow|arrow|bolt)\b/i;
const RANGED_INTENT = /\b(shot|shoot|fire|loose|snipe|attack|strike)\b/i;

const norm = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();

/**
 * Build the authoritative resource snapshot used by both composition and
 * dispatch validation. Pure: pass spell_levels ({name: {level, concentration}})
 * when the caller already has catalog data.
 */
export function buildCompositionResources({ character, session, spell_levels }) {
  const slotsUsed = character?.spell_slots || {};
  const maxSlots = deriveCanonicalSpellSlots(character).max_slots;
  const available_slots = {};
  maxSlots.forEach((total, index) => {
    available_slots[index + 1] = Math.max(0, Number(total || 0) - Number(slotsUsed[`level_${index + 1}`] || 0));
  });
  const concentration = session?.world_state?.active_concentration || null;
  const ammunition = { arrow: 0, bolt: 0 };
  for (const item of character?.inventory || []) {
    const name = norm(item?.name);
    if (/\barrows?\b/.test(name)) ammunition.arrow += Number(item?.quantity || 0) || 0;
    if (/\bbolts?\b/.test(name)) ammunition.bolt += Number(item?.quantity || 0) || 0;
  }
  return {
    version: CHOICE_COMPOSITION_VALIDATION_VERSION,
    available_slots,
    concentration_active: concentration ? { spell: norm(concentration.spell_name || concentration.spell) || null } : null,
    spells_known: (character?.spells_known || []).map(norm).filter(Boolean),
    spells_prepared: (character?.spells_prepared || []).map(norm).filter(Boolean),
    spell_levels: spell_levels || {},
    ammunition
  };
}

/**
 * Async builder: re-reads the character and session fresh (state may have
 * changed earlier in the same request, e.g. a slot consumed by the current
 * action's cast) and queries the Spell catalog for levels/concentration.
 */
export async function buildCompositionResourcesForCharacter({ base44, character, session }) {
  const [freshCharacter, freshSession] = await Promise.all([
    base44.asServiceRole.entities.Character.get(character.id),
    base44.asServiceRole.entities.GameSession.get(session.id)
  ]);
  const names = [...new Set((freshCharacter?.spells_known || []).map((s) => String(s || '').trim()).filter(Boolean))];
  const spell_levels = {};
  if (names.length) {
    const catalog = await base44.asServiceRole.entities.Spell.filter({ name: { $in: names } }, '-updated_date', 100);
    for (const spell of catalog) {
      const key = norm(spell?.name);
      if (!key || spell_levels[key]) continue;
      spell_levels[key] = { level: Number(spell?.level), concentration: !!spell?.concentration };
    }
  }
  return buildCompositionResources({ character: freshCharacter, session: freshSession, spell_levels });
}

/** Prompt line injected into the composer so the LLM never offers illegal options. */
export function compositionResourceLine(resources) {
  const slots = Object.entries(resources.available_slots || {}).map(([level, count]) => `L${level}: ${count}`).join(', ') || 'none';
  const concentration = resources.concentration_active?.spell ? `active on ${resources.concentration_active.spell}` : 'none';
  return `CHOICE COMPOSITION RESOURCE & TARGETING CONTRACT (authoritative; every option must pass): Available spell slots: ${slots}. Active concentration: ${concentration}. Before offering ANY option, verify it can execute end-to-end right now: (1) spell slots per level — never offer a spell whose slot level shows 0 available; (2) concentration — never offer a new concentration spell while concentration is active; (3) spells known/prepared — never offer a spell the character does not have prepared; (4) ammunition — never offer a ranged attack option without ammunition; (5) attunement, action economy, and material components with a cost. TARGETING: phrase every spell by its RAW targeting mode — a point-area spell is offered as "cast <spell> centered on <target>'s position, then fire", NEVER as "<spell>-imbued arrow/bolt" or any spell-attached-to-projectile phrasing; the option text must describe a legal resolution chain.`;
}

function findSpellInText(text, resources) {
  const lower = norm(text);
  const names = [...new Set([
    ...Object.keys(resources.spell_levels || {}),
    ...(resources.spells_prepared || []),
    ...(resources.spells_known || [])
  ])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of names) if (lower.includes(name)) return name;
  return null;
}

/**
 * Validate ONE composed choice against the authoritative resources.
 * Returns {ok: true} or {ok: false, reason_code, reason}.
 */
export function validateComposedChoice(choice, resources) {
  const text = String(choice?.text || '');
  const actionType = String(choice?.action_type || '');
  const lower = norm(text);

  // Rule 1: never attach a spell to a projectile — this phrasing is illegal
  // as an offered option (point-area spells resolve centered on a position).
  if (IMBUED_PHRASING.test(text)) {
    return { ok: false, reason_code: 'illegal_spell_projectile_phrasing', reason: 'Options never attach a spell to a projectile (no "X-imbued arrow/bolt" phrasing). Phrase the legal resolution instead, e.g. "cast Silence centered on the ritualist\'s position, then fire".' };
  }

  // Rule 2: spell-intent options must be resource-legal right now.
  const compositeSpell = choice?.children?.find?.((child) => child?.action_type === 'spell_cast')?.spell_name || null;
  const castWords = /\b(cast|casts|casting)\b/i.test(text);
  const spellIntent = actionType === 'spell_cast' || actionType === 'composite_action' || !!compositeSpell || (castWords && !!findSpellInText(text, resources));
  const spellName = norm(choice?.spell_name) || norm(compositeSpell) || (spellIntent ? findSpellInText(text, resources) : null);
  if (spellIntent && spellName) {
    const known = resources.spells_known.includes(spellName);
    const prepared = resources.spells_prepared.length ? resources.spells_prepared.includes(spellName) : known;
    if (!known || !prepared) {
      return { ok: false, reason_code: 'spell_not_prepared', reason: `"${spellName}" is not known/prepared by this character; never offer it.` };
    }
    const meta = (resources.spell_levels || {})[spellName] || {};
    const level = Number(meta.level);
    if (Number.isFinite(level) && resources.available_slots[level] === 0) {
      return { ok: false, reason_code: 'spell_slots_exhausted', reason: `No level-${level} spell slots remain, so "${spellName}" cannot be cast; never offer it.` };
    }
    if (meta.concentration && resources.concentration_active?.spell) {
      return { ok: false, reason_code: 'concentration_occupied', reason: `Concentration is already active (${resources.concentration_active.spell}); never offer another concentration spell.` };
    }
  }

  // Rule 3: ranged attack options require ammunition.
  const ranged = (actionType === 'weapon_attack' && (String(choice?.weapon_attack?.attack_mode || '') === 'ranged' || RANGED_WEAPON.test(text)))
    || (RANGED_WEAPON.test(text) && RANGED_INTENT.test(text));
  if (ranged) {
    const needs = /\bcrossbow|bolt\b/.test(lower) ? 'bolt' : 'arrow';
    if ((resources.ammunition?.[needs] || 0) <= 0) {
      return { ok: false, reason_code: 'no_ammunition', reason: `No ${needs === 'bolt' ? 'bolts' : 'arrows'} remain, so this ranged attack option cannot execute.` };
    }
  }

  return { ok: true };
}

/** Validate a composed choice list; returns the filtered list plus rejection diagnostics. */
export function validateComposedChoices(choices, resources) {
  const valid_choices = [];
  let rejected = [];
  (Array.isArray(choices) ? choices : []).forEach((choice, index) => {
    const verdict = validateComposedChoice(choice, resources);
    if (verdict.ok) valid_choices.push(choice);
    else rejected = rejected.concat([{ index, text: String(choice?.text || '').slice(0, 200), reason_code: verdict.reason_code, reason: verdict.reason }]);
  });
  return { version: CHOICE_COMPOSITION_VALIDATION_VERSION, valid_choices, rejected };
}