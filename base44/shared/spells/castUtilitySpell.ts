import { characterBelongsToUser } from '../combat/authGuard.ts';
import { addStructuredCondition, buildStructuredCondition } from '../combat/conditions.ts';
import { normalizeSpellText, resolveKnownTypedSpell } from './typedSpellParser.ts';
import { conditionIdentityKey, isPassWithoutTraceIdentity, preferStructuredCondition } from './conditionIdentity.js';

const FULL = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF = [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const WARLOCK_PACT = [1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4];
const TABLES = { Wizard: FULL, Sorcerer: FULL, Bard: FULL, Cleric: FULL, Druid: FULL, Paladin: HALF, Ranger: HALF, Artificer: HALF };
const normalize = normalizeSpellText;
const respond = (status, body) => ({ status, body });
const ordinal = (level) => level === 1 ? '1st' : level === 2 ? '2nd' : level === 3 ? '3rd' : `${level}th`;
const normalizeSpellSlots = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, used]) => /^level_[1-9]\d*$/.test(key) && Number.isFinite(Number(used)) && Number(used) >= 0).map(([key, used]) => [key, Number(used)]));
};

function casterContribution(cls, sub, levels) {
  if (['Wizard', 'Sorcerer', 'Bard', 'Cleric', 'Druid'].includes(cls)) return levels;
  if (['Paladin', 'Ranger', 'Artificer'].includes(cls)) return Math.floor(levels / 2);
  return String(sub || '').toLowerCase().includes('eldritch knight') || String(sub || '').toLowerCase().includes('arcane trickster') ? Math.floor(levels / 3) : 0;
}
function maxSlots(character, slotLevel) {
  const level = Math.max(1, Math.min(20, Number(character.level) || 1));
  const index = slotLevel - 1;
  const multiclass = Array.isArray(character.multiclass) && character.multiclass.length > 0;
  if (character.class === 'Warlock' && !multiclass) return slotLevel <= Math.min(5, Math.ceil(level / 2)) ? (WARLOCK_PACT[level - 1] || 0) : 0;
  if (multiclass) {
    let casterLevel = casterContribution(character.class, character.subclass, level);
    for (const mc of character.multiclass) if (mc?.class !== 'Warlock') casterLevel += casterContribution(mc?.class, mc?.subclass, Number(mc?.levels) || 0);
    return casterLevel > 0 ? ((FULL[Math.min(20, casterLevel) - 1] || [])[index] || 0) : 0;
  }
  const sub = String(character.subclass || '').toLowerCase();
  if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
    const casterLevel = Math.floor(level / 3);
    return casterLevel > 0 ? ((FULL[casterLevel - 1] || [])[index] || 0) : 0;
  }
  return (((TABLES[character.class] || [])[level - 1]) || [])[index] || 0;
}
function findKnownSpell(character, actionText, requestedName) {
  return resolveKnownTypedSpell(character, actionText, requestedName);
}
function concentrationModifier(spell, now, characterId, expiresAt = null) {
  const base = { id: `typed_spell_${normalize(spell.name).replace(/ /g, '_')}_${now}`, source: spell.name, effect: 'spell_concentration', concentration: true, caster_id: characterId, character_id: characterId, target_id: characterId, scope: 'self', applied_at: new Date(now).toISOString(), duration: spell.duration || 'Concentration', expiration_rule: expiresAt ? 'timestamp' : 'concentration', ...(expiresAt ? { expires_at: expiresAt } : {}) };
  if (normalize(spell.name) === 'pass without trace') return { ...base, effect: 'skill_bonus', skill: 'Stealth', bonus: 10 };
  if (normalize(spell.name) === 'hunters mark') return { ...base, effect: 'hunters_mark', damage_bonus_dice: '1d6' };
  if (normalize(spell.name) === 'ensnaring strike') return { ...base, effect: 'ensnaring_strike_pending' };
  if (normalize(spell.name) === 'silence') return { ...base, effect: 'silence_area' };
  if (normalize(spell.name) === 'detect magic') return { ...base, effect: 'detect_magic' };
  return base;
}

export async function executeUtilitySpellCast({ base44, user, payload }) {
  const { session_id, character_id, spell_name, action_text, slot_level, cast_token, request_id, target, require_healing } = payload || {};
  if (!user) return respond(401, { error: 'Unauthorized' });
  if (!character_id) return respond(400, { error: 'character_id is required' });
  const session = session_id ? await base44.asServiceRole.entities.GameSession.get(session_id) : null;
  if (session_id && (!session || session.character_id !== character_id)) return respond(400, { error: 'Session and character do not match' });
  const character = await base44.asServiceRole.entities.Character.get(character_id);
  if (!character) return respond(404, { error: 'Character not found' });
  if (!characterBelongsToUser(character, user)) return respond(403, { error: 'Character does not belong to the authenticated user' });
  const canonicalName = findKnownSpell(character, action_text, spell_name);
  if (!canonicalName) return respond(200, { success: true, spell_detected: false, spell_slots: character.spell_slots || {}, active_modifiers: character.active_modifiers || [] });
  const known = [...(character.spells_known || []), ...(character.spells_prepared || [])].some((spell) => normalize(spell) === normalize(canonicalName));
  if (!known) return respond(400, { error: `${character.name} does not know or have ${canonicalName} prepared`, invalid: true });
  const spellCandidates = await base44.asServiceRole.entities.Spell.filter({ name: canonicalName }, '-updated_date', 50);
  const spell = spellCandidates.find((candidate) => ['utility', 'healing'].includes(String(candidate?.attack_type || '').toLowerCase()) || candidate?.is_utility === true)
    || spellCandidates.find((candidate) => typeof candidate?.description === 'string' && candidate.description.trim())
    || spellCandidates[0];
  if (!spell) return respond(404, { error: `Canonical spell data is missing for ${canonicalName}`, invalid: true });
  const normalizedName = normalize(canonicalName);
  const isHealingSpell = spell.attack_type === 'healing' || normalizedName === 'cure wounds';
  if (require_healing && !isHealingSpell) return respond(400, { error: `${canonicalName} is not a self-healing spell supported by the character sheet.`, invalid: true });
  const isHuntersMark = normalizedName === 'hunters mark';
  const isUtilitySpell = (spell.attack_type === 'utility' || !!spell.is_utility) && !isHuntersMark;
  if (isHuntersMark) return respond(400, { error: "Hunter's Mark requires a hostile combat target. Cast it through the combat spell action.", invalid: true, target_required: true });
  if (!isHealingSpell && !isUtilitySpell) return respond(400, { error: `${canonicalName} requires a valid combat target. Use the combat spell action while an active combat target is available.`, invalid: true, target_required: true });
  const conditions = (character.conditions || []).map((condition) => normalize(typeof condition === 'string' ? condition : condition?.name));
  if ((conditions.includes('silenced') || conditions.includes('silence')) && String(spell.components || 'V').toUpperCase().includes('V')) return respond(400, { error: `${character.name} is silenced and cannot cast ${canonicalName}, which requires a verbal component.`, invalid: true });
  if (conditions.includes('raging')) return respond(400, { error: `${character.name} cannot cast spells while raging.`, invalid: true });
  const baseLevel = Math.max(0, Number(spell.level) || 0);
  const explicit = Number(slot_level) || Number(String(action_text || '').match(/\b(?:level|lvl|at)\s*(\d+)\b/i)?.[1]) || 0;
  const selectedLevel = baseLevel === 0 ? 0 : Math.max(baseLevel, explicit || baseLevel);
  const token = String(request_id || cast_token || '').slice(0, 120);
  if (!token) return respond(400, { error: 'request_id or cast_token is required for idempotent spell casting' });
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities.__typed_spell_casts) ? abilities.__typed_spell_casts : [];
  const prior = receipts.find((receipt) => receipt?.token === token);
  if (prior) {
    const maximum = maxSlots(character, prior.slot_level);
    const normalizedSlots = normalizeSpellSlots(character.spell_slots);
    const used = Number(normalizedSlots[`level_${prior.slot_level}`]) || 0;
    return respond(200, { success: true, spell_detected: true, already_processed: true, receipt_id: prior.receipt_id || token, request_id: token, spell_name: prior.spell_name, slot_level: prior.slot_level, used_slots: used, max_slots: maximum, remaining_slots: Math.max(0, maximum - used), spell_slots: normalizedSlots, active_modifiers: character.active_modifiers || [], concentration: !!spell.concentration, duration: spell.duration, inventory: character.inventory || [], heal_amount: prior.heal_amount || 0, roll_expression: prior.roll_expression || null, roll_total: Number(prior.roll_total ?? prior.heal_amount ?? 0), hp_before: Number(prior.hp_before ?? character.hp_current), hp_after: Number(prior.hp_after ?? character.hp_current), hp_current: character.hp_current, hp_max: character.hp_max });
  }
  const now = Date.now();
  const concentration = session?.world_state?.active_concentration;
  const sessionKeepsConcentration = spell.concentration && normalize(concentration?.spell_name) === normalizedName && concentration?.concentration === true && concentration?.target_id === character_id;
  const active = (character.active_modifiers || []).filter((modifier) => !modifier.expires_at || new Date(modifier.expires_at).getTime() > now || (sessionKeepsConcentration && normalize(modifier.source) === normalizedName && modifier.concentration === true));
  const existing = spell.concentration ? (character.active_modifiers || []).find((modifier) => normalize(modifier.source) === normalizedName && modifier.concentration) : null;
  const structured = preferStructuredCondition(character.conditions, canonicalName);
  const coherentExisting = existing && structured && concentration
    && existing.target_id === character_id && structured.target_id === character_id && concentration.target_id === character_id
    && existing.expires_at === structured.expires_at && existing.expires_at === concentration.expires_at
    && normalize(concentration.spell_name) === normalizedName && concentration.concentration === true;
  if (coherentExisting) return respond(200, { success: true, spell_detected: true, already_active: true, spell_name: canonicalName, slot_level: selectedLevel, spell_slots: character.spell_slots || {}, active_modifiers: active, concentration: true, duration: spell.duration });
  let spellSlots = normalizeSpellSlots(character.spell_slots);
  let maximum = 0;
  let usedAfter = 0;
  if (selectedLevel > 0) {
    maximum = maxSlots(character, selectedLevel);
    const key = `level_${selectedLevel}`;
    const used = Number(spellSlots[key]) || 0;
    if (maximum <= 0 || used >= maximum) return respond(400, { error: `No ${ordinal(selectedLevel)}-level spell slots remaining.`, invalid: true });
    spellSlots = { ...spellSlots, [key]: used + 1 };
    usedAfter = used + 1;
  }
  const isPassWithoutTrace = normalizedName === 'pass without trace';
  const expiresAt = isPassWithoutTrace ? new Date(now + 60 * 60 * 1000).toISOString() : null;
  let activeModifiers = active;
  if (spell.concentration) activeModifiers = [...active.filter((modifier) => !modifier.concentration), concentrationModifier(spell, now, character_id, expiresAt)];
  const isSilence = normalizedName === 'silence';
  const structuredConditions = isPassWithoutTrace
    ? addStructuredCondition((character.conditions || []).filter((condition) => !isPassWithoutTraceIdentity(condition)), buildStructuredCondition({ name: 'pass without trace', source: canonicalName, target_id: character_id, caster_id: character_id, duration_type: 'timestamp', expires_at: expiresAt, concentration: true }))
    : isSilence
      ? (character.conditions || []).filter((condition) => normalize(typeof condition === 'string' ? condition : condition?.name) !== 'pass without trace')
      : (character.conditions || []);
  let healAmount = 0;
  const hpBefore = Number(character.hp_current) || 0;
  let hpCurrent = hpBefore;
  let rollExpression = null;
  let rollTotal = 0;
  const selfHealing = isHealingSpell && (require_healing || target === 'self' || /\b(myself|my self|on me|heal me|my wounds)\b/i.test(String(action_text || '')));
  if (selfHealing) {
    const dice = String(spell.heal_dice || spell.damage_dice || spell.description || '').match(/(\d+)d(\d+)/i);
    const count = (Number(dice?.[1]) || 1) + Math.max(0, selectedLevel - baseLevel);
    const sides = Number(dice?.[2]) || 8;
    const ability = ({ Cleric: 'wisdom', Druid: 'wisdom', Ranger: 'wisdom', Paladin: 'charisma', Bard: 'charisma', Sorcerer: 'charisma', Warlock: 'charisma', Wizard: 'intelligence', Artificer: 'intelligence' })[character.class] || 'wisdom';
    for (let index = 0; index < count; index++) rollTotal += Math.floor(Math.random() * sides) + 1;
    const abilityModifier = Math.floor(((Number(character[ability]) || 10) - 10) / 2);
    rollExpression = `${count}d${sides}${abilityModifier >= 0 ? '+' : ''}${abilityModifier}`;
    healAmount = Math.max(0, rollTotal + abilityModifier);
    rollTotal = healAmount;
    hpCurrent = Math.min(Number(character.hp_max) || hpCurrent, hpCurrent + healAmount);
  }
  let grantedInventory = null;
  const grantedGoodberry = normalizedName === 'goodberry';
  if (grantedGoodberry) {
    const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
    const index = inventory.findIndex((item) => normalize(item?.name) === 'goodberry');
    const expires = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (index >= 0) inventory[index] = { ...inventory[index], quantity: (Number(inventory[index].quantity) || 0) + 10, expires_at: new Date(Math.max(inventory[index].expires_at ? new Date(inventory[index].expires_at).getTime() : 0, now + 24 * 60 * 60 * 1000)).toISOString() };
    else inventory.push({ name: 'Goodberry', category: 'Consumable', quantity: 10, description: 'A transmuted berry that restores 1 Hit Point when eaten and provides enough nourishment to sustain a creature for one day. Expires 24 hours after casting.', expires_at: expires });
    grantedInventory = inventory;
  }
  abilities.__typed_spell_casts = [...receipts.filter((receipt) => receipt?.token !== token).slice(-24), { token, receipt_id: token, spell_name: canonicalName, slot_level: selectedLevel, target_id: character_id, duration: spell.duration || null, expires_at: expiresAt, concentration: !!spell.concentration, heal_amount: healAmount, roll_expression: rollExpression, roll_total: rollTotal, hp_before: hpBefore, hp_after: hpCurrent, granted_goodberry: grantedGoodberry, at: new Date(now).toISOString() }];
  const updates = { spell_slots: spellSlots, active_modifiers: activeModifiers, long_rest_abilities: abilities };
  if (isPassWithoutTrace || isSilence) updates.conditions = structuredConditions;
  if (healAmount > 0) updates.hp_current = hpCurrent;
  if (grantedInventory) updates.inventory = grantedInventory;
  await base44.asServiceRole.entities.Character.update(character_id, updates);
  if (session) {
    const sessionWorldState = {
      ...(session.world_state || {}),
      last_spell_cast: { spell_name: canonicalName, character_id, slot_level: selectedLevel, heal_amount: healAmount, request_id: token, at: new Date(now).toISOString() },
    };
    if (spell.concentration) {
      sessionWorldState.active_concentration = { spell_name: canonicalName, character_id, caster_id: character_id, target_id: character_id, scope: 'self', duration: spell.duration || 'Concentration', applied_at: new Date(now).toISOString(), expires_at: expiresAt, expiration_rule: expiresAt ? 'timestamp' : 'concentration', concentration: true, request_id: token };
    }
    await base44.asServiceRole.entities.GameSession.update(session_id, { world_state: sessionWorldState });
  }
  if (session?.in_combat && session.combat_state?.combat_id) {
    const combat = await base44.asServiceRole.entities.CombatLog.get(session.combat_state.combat_id);
    if (combat?.is_active) {
      const combatants = (combat.combatants || []).map((combatant) => combatant.id === character_id ? { ...combatant, hp_current: hpCurrent, conditions: (isPassWithoutTrace || isSilence) ? structuredConditions : (combatant.conditions || []) } : combatant);
      await base44.asServiceRole.entities.CombatLog.update(combat.id, { combatants, log_entries: [...(combat.log_entries || []), { type: 'spell_cast', spell_name: canonicalName, actor: character.name, target: character.name, round: combat.round || 0, timestamp: new Date(now).toISOString(), request_id: token, heal_amount: healAmount }], world_state: spell.concentration ? { ...(combat.world_state || {}), concentration_spell: canonicalName, concentration_caster: character.name } : (combat.world_state || {}) });
    }
  }
  return respond(200, { success: true, spell_detected: true, already_active: false, receipt_id: token, request_id: token, spell_name: canonicalName, slot_level: selectedLevel, base_level: baseLevel, used_slots: usedAfter, max_slots: maximum, remaining_slots: Math.max(0, maximum - usedAfter), spell_slots: spellSlots, active_modifiers: activeModifiers, concentration: !!spell.concentration, duration: spell.duration, attack_type: spell.attack_type, components: spell.components, inventory: grantedInventory || character.inventory || [], heal_amount: healAmount, roll_expression: rollExpression, roll_total: rollTotal, hp_before: hpBefore, hp_after: hpCurrent, hp_current: hpCurrent, hp_max: character.hp_max });
}