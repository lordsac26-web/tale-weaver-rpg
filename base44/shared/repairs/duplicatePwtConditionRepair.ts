import { conditionIdentityKey, isPassWithoutTraceIdentity } from '../spells/conditionIdentity.js';

export const PWT_REPAIR_CONTRACT = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  legacyAppliedAt: '2026-08-10T01:06:14.812Z',
  canonicalConditionId: 'cond_pass_without_trace_1786324246874_wgt5cv',
  canonicalModifierId: 'typed_spell_pass_without_trace_1786324246874',
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const exactLegacy = (condition) => condition && typeof condition === 'object' && condition.name === 'Pass Without Trace' && condition.source === 'story' && condition.duration === 'scene' && condition.applied_at === PWT_REPAIR_CONTRACT.legacyAppliedAt && !condition.id && !condition.target_id && !condition.caster_id && !condition.concentration;
const exactCanonical = (condition, characterId) => condition?.id === PWT_REPAIR_CONTRACT.canonicalConditionId && conditionIdentityKey(condition) === 'pass without trace' && condition.target_id === characterId && condition.caster_id === characterId && condition.duration_type === 'timestamp' && !!condition.expires_at && condition.concentration === true;
const exactModifier = (modifier, characterId) => modifier?.id === PWT_REPAIR_CONTRACT.canonicalModifierId && isPassWithoutTraceIdentity(modifier) && modifier.effect === 'skill_bonus' && modifier.skill === 'Stealth' && Number(modifier.bonus) === 10 && modifier.target_id === characterId && modifier.caster_id === characterId && modifier.character_id === characterId && modifier.concentration === true;

export async function repairDuplicatePwtCondition({ db, scope, requestId, mode = 'dry_run' }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combats] = await Promise.all([
    db.entities.Character.get(scope.characterId),
    db.entities.GameSession.get(scope.sessionId),
    db.entities.CombatLog.filter({ session_id: scope.sessionId }, 'id', 500),
  ]);
  if (!character || !session) return { status: 409, body: { error: 'Protected repair records are missing', request_id: requestId, writes: 0 } };
  const conditions = Array.isArray(character.conditions) ? character.conditions : [];
  const modifiers = Array.isArray(character.active_modifiers) ? character.active_modifiers : [];
  const pwtConditions = conditions.filter(isPassWithoutTraceIdentity);
  const legacy = pwtConditions.filter(exactLegacy);
  const canonical = pwtConditions.filter((condition) => exactCanonical(condition, scope.characterId));
  const pwtModifiers = modifiers.filter(isPassWithoutTraceIdentity);
  const canonicalModifiers = pwtModifiers.filter((modifier) => exactModifier(modifier, scope.characterId));
  const concentration = session.world_state?.active_concentration;
  const alreadyRepaired = legacy.length === 0 && pwtConditions.length === 1 && canonical.length === 1 && pwtModifiers.length === 1 && canonicalModifiers.length === 1;
  const guards = {
    exact_linkage: session.character_id === scope.characterId,
    exact_condition_shape: (legacy.length === 1 && canonical.length === 1 && pwtConditions.length === 2) || alreadyRepaired,
    exact_modifier_shape: pwtModifiers.length === 1 && canonicalModifiers.length === 1,
    authoritative_concentration_link: isPassWithoutTraceIdentity(concentration) && concentration?.character_id === scope.characterId && concentration?.target_id === scope.characterId && concentration?.caster_id === scope.characterId && concentration?.concentration === true && concentration?.expires_at === canonical[0]?.expires_at && canonicalModifiers[0]?.expires_at === canonical[0]?.expires_at,
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  const protectedHashes = {
    character_unrelated: await hash(semantic(character, ['conditions'])),
    session: await hash(semantic(session)),
    combats: await hash((combats || []).map((combat) => semantic(combat))),
    canonical_condition: canonical[0] ? await hash(canonical[0]) : null,
    canonical_modifier: canonicalModifiers[0] ? await hash(canonicalModifiers[0]) : null,
    unrelated_conditions: await hash(conditions.filter((condition) => !isPassWithoutTraceIdentity(condition))),
  };
  const diagnostics = { request_id: requestId, mode, writes: 0, guards, failed_guards: failedGuards, counts: { pwt_conditions: pwtConditions.length, legacy_residue: legacy.length, canonical_conditions: canonical.length, pwt_modifiers: pwtModifiers.length, canonical_plus10_modifiers: canonicalModifiers.length, combat_records: combats.length }, protected_hashes: protectedHashes, proposed_removal: legacy[0] || null };
  if (failedGuards.length) return { status: 409, body: { error: 'Protected repair invariants failed; no write was made.', ...diagnostics } };
  if (alreadyRepaired) return { status: 200, body: { success: true, already_processed: true, ...diagnostics } };
  if (mode === 'dry_run') return { status: 200, body: { success: true, dry_run: true, already_processed: false, ...diagnostics } };
  const nextConditions = conditions.filter((condition) => condition !== legacy[0]);
  await db.entities.Character.update(scope.characterId, { conditions: nextConditions });
  const [afterCharacter, afterSession, afterCombats] = await Promise.all([
    db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.filter({ session_id: scope.sessionId }, 'id', 500),
  ]);
  const afterPwt = (afterCharacter.conditions || []).filter(isPassWithoutTraceIdentity);
  const postconditions = {
    exactly_one_canonical_condition: afterPwt.length === 1 && exactCanonical(afterPwt[0], scope.characterId),
    exactly_one_canonical_modifier: (afterCharacter.active_modifiers || []).filter(isPassWithoutTraceIdentity).length === 1 && exactModifier((afterCharacter.active_modifiers || []).filter(isPassWithoutTraceIdentity)[0], scope.characterId),
    character_unrelated_unchanged: protectedHashes.character_unrelated === await hash(semantic(afterCharacter, ['conditions'])),
    unrelated_conditions_unchanged: protectedHashes.unrelated_conditions === await hash((afterCharacter.conditions || []).filter((condition) => !isPassWithoutTraceIdentity(condition))),
    canonical_condition_unchanged: protectedHashes.canonical_condition === await hash(afterPwt[0]),
    canonical_modifier_unchanged: protectedHashes.canonical_modifier === await hash((afterCharacter.active_modifiers || []).filter(isPassWithoutTraceIdentity)[0]),
    session_unchanged: protectedHashes.session === await hash(semantic(afterSession)),
    combats_unchanged: protectedHashes.combats === await hash((afterCombats || []).map((combat) => semantic(combat))),
  };
  const failedPostconditions = Object.entries(postconditions).filter(([, pass]) => !pass).map(([name]) => name);
  if (failedPostconditions.length) return { status: 500, body: { error: 'Persisted repair postconditions failed', request_id: requestId, writes: 1, failed_postconditions: failedPostconditions, postconditions } };
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, mode, writes: 1, removed_condition: legacy[0], remaining_pwt_condition: afterPwt[0], protected_hashes: protectedHashes, postconditions } };
}