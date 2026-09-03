import { characterBelongsToUser } from '../combat/authGuard.ts';
import { addStructuredCondition, buildStructuredCondition } from '../combat/conditions.ts';
import { normalizeSpellText, resolveKnownTypedSpell } from './typedSpellParser.ts';
import { canonicalSpellTargetProfile, resolveCanonicalSpellTarget, SPELL_TARGETING_VERSION } from './spellTargeting.ts';
import { conditionIdentityKey, isPassWithoutTraceIdentity, preferStructuredCondition } from './conditionIdentity.js';
import { getMaxSlotsForLevel } from './slotProgression.ts';

const normalize = normalizeSpellText;
const respond = (status, body) => ({ status, body });
const ordinal = (level) => level === 1 ? '1st' : level === 2 ? '2nd' : level === 3 ? '3rd' : `${level}th`;
const normalizeSpellSlots = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, used]) => /^level_[1-9]\d*$/.test(key) && Number.isFinite(Number(used)) && Number(used) >= 0).map(([key, used]) => [key, Number(used)]));
};
const maxSlots = getMaxSlotsForLevel;
export const SPELL_TRANSACTION_VERSION = 'authoritative-spell-transaction-v1.1.0';
const hashMechanicalState = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const stateProjection = (character, session = null) => ({ character: { hp_current: character.hp_current, hp_max: character.hp_max, spell_slots: character.spell_slots || {}, conditions: character.conditions || [], active_modifiers: character.active_modifiers || [], inventory: character.inventory || [] }, session: session ? { in_combat: !!session.in_combat, combat_state: session.combat_state || {}, active_concentration: session.world_state?.active_concentration || null, last_spell_cast: session.world_state?.last_spell_cast || null } : null });
const durationExpiry = (spell, now) => { const match=String(spell.duration||'').match(/(\d+)\s*(minute|hour|round)/i); if(!match)return null; const unit=match[2].toLowerCase(),multiplier=unit==='hour'?3600000:unit==='round'?6000:60000; return new Date(now+Number(match[1])*multiplier).toISOString(); };

function findKnownSpell(character, actionText, requestedName) {
  return resolveKnownTypedSpell(character, actionText, requestedName);
}
function concentrationModifier(spell, now, characterId, spellTarget, expiresAt = null) {
  const targetId = spellTarget?.kind === 'point_area' ? `scene_point:${normalize(spellTarget.anchor).replace(/ /g, '_')}` : spellTarget?.id || characterId;
  const base = { id: `typed_spell_${normalize(spell.name).replace(/ /g, '_')}_${now}`, source: spell.name, effect: 'spell_concentration', concentration: true, caster_id: characterId, character_id: characterId, target_id: targetId, scope: spellTarget?.kind === 'point_area' ? 'area' : 'self', spell_target: spellTarget || null, applied_at: new Date(now).toISOString(), duration: spell.duration || 'Concentration', expiration_rule: expiresAt ? 'timestamp' : 'concentration', ...(expiresAt ? { expires_at: expiresAt } : {}) };
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
  const spell = [...spellCandidates].sort((left, right) => {
    const quality = (candidate) => (candidate?.description ? 4 : 0) + (candidate?.components ? 2 : 0) + (candidate?.casting_time ? 1 : 0) + (candidate?.range ? 1 : 0) + (candidate?.duration ? 1 : 0) + (candidate?.attack_type ? 1 : 0);
    return quality(right) - quality(left);
  })[0];
  if (!spell) return respond(404, { error: `Canonical spell data is missing for ${canonicalName}`, invalid: true });
  const normalizedName = normalize(canonicalName);
  const isHealingSpell = spell.attack_type === 'healing' || normalizedName === 'cure wounds';
  const token = String(request_id || cast_token || '').slice(0, 120);
  if (!token) return respond(400, { error: 'request_id or cast_token is required for idempotent spell casting' });
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities.__typed_spell_casts) ? abilities.__typed_spell_casts : [];
  const prior = receipts.find((receipt) => receipt?.request_key === token || receipt?.token === token);
  if (prior) {
    if (normalize(prior.spell_name) !== normalizedName || (require_healing && !prior.is_healing)) return respond(409, { error: 'The request key is already bound to a different spell transaction.', invalid: true, writes: 0, transaction_version: SPELL_TRANSACTION_VERSION });
    const normalizedSlots = normalizeSpellSlots(character.spell_slots);
    return respond(200, { success: true, spell_detected: true, already_processed: true, replayed: true, writes: 0, transaction_version: prior.transaction_version || SPELL_TRANSACTION_VERSION, receipt_id: prior.receipt_id || token, request_id: token, request_key: token, spell_name: prior.spell_name, canonical_spell_id: prior.canonical_spell_id || spell.id, slot_level: prior.slot_level, used_before: prior.used_before, used_after: prior.used_after, used_slots: Number(normalizedSlots[`level_${prior.slot_level}`]) || 0, max_slots: maxSlots(character, prior.slot_level), remaining_slots: Math.max(0, maxSlots(character, prior.slot_level) - (Number(normalizedSlots[`level_${prior.slot_level}`]) || 0)), spell_slots: normalizedSlots, active_modifiers: character.active_modifiers || [], concentration: !!prior.concentration, duration: prior.duration || spell.duration, target: prior.target, target_profile: prior.target_profile, targeting_version: SPELL_TARGETING_VERSION, inventory: character.inventory || [], heal_amount: prior.heal_amount || 0, healing_roll: prior.healing_roll || null, roll_expression: prior.roll_expression || null, roll_total: Number(prior.roll_total ?? prior.heal_amount ?? 0), hp_before: Number(prior.hp_before ?? character.hp_current), hp_after: Number(prior.hp_after ?? character.hp_current), hp_current: character.hp_current, hp_max: character.hp_max, receipt: prior });
  }
  const selfHealing = isHealingSpell && (require_healing || target === 'self' || target?.kind === 'self' || /\b(myself|my self|on me|heal me|my wounds)\b/i.test(String(action_text || '')));
  const targetResolution = selfHealing ? { ok:true, status:200, profile:{ ...canonicalSpellTargetProfile(spell), kind:'self' }, target:{ kind:'self', id:character_id } } : resolveCanonicalSpellTarget({ spell, actionText: action_text, target });
  if (require_healing && !isHealingSpell) return respond(400, { error: `${canonicalName} is not a self-healing spell supported by the character sheet.`, invalid: true });
  const isHuntersMark = normalizedName === 'hunters mark';
  const isPointAreaSpell = targetResolution.profile.kind === 'point_area';
  const isUtilitySpell = ((spell.attack_type === 'utility' || !!spell.is_utility) && !isHuntersMark) || isPointAreaSpell;
  if (isHuntersMark) return respond(400, { error: "Hunter's Mark requires a hostile combat target. Cast it through the combat spell action.", invalid: true, target_required: true });
  if (!targetResolution.ok) return respond(targetResolution.status, { error: targetResolution.error, code: targetResolution.code, invalid: true, target_required: true, target_profile: targetResolution.profile, writes: 0 });
  if (!isHealingSpell && !isUtilitySpell) return respond(400, { error: `${canonicalName} requires a specific valid creature target.`, invalid: true, target_required: true, writes: 0 });
  const conditions = (character.conditions || []).map((condition) => normalize(typeof condition === 'string' ? condition : condition?.name));
  if ((conditions.includes('silenced') || conditions.includes('silence')) && String(spell.components || 'V').toUpperCase().includes('V')) return respond(400, { error: `${character.name} is silenced and cannot cast ${canonicalName}, which requires a verbal component.`, invalid: true });
  if (conditions.includes('raging')) return respond(400, { error: `${character.name} cannot cast spells while raging.`, invalid: true });
  const baseLevel = Math.max(0, Number(spell.level) || 0);
  const explicit = Number(slot_level) || Number(String(action_text || '').match(/\b(?:level|lvl|at)\s*(\d+)\b/i)?.[1]) || 0;
  const selectedLevel = baseLevel === 0 ? 0 : Math.max(baseLevel, explicit || baseLevel);
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
  let usedBefore = selectedLevel > 0 ? Number(spellSlots[`level_${selectedLevel}`]) || 0 : 0;
  let usedAfter = usedBefore;
  if (selectedLevel > 0) {
    maximum = maxSlots(character, selectedLevel);
    const key = `level_${selectedLevel}`;
    const used = Number(spellSlots[key]) || 0;
    if (maximum <= 0 || used >= maximum) return respond(400, { error: `No ${ordinal(selectedLevel)}-level spell slots remaining.`, invalid: true });
    spellSlots = { ...spellSlots, [key]: used + 1 };
    usedAfter = used + 1;
  }
  const isPassWithoutTrace = normalizedName === 'pass without trace';
  const isSilence = normalizedName === 'silence';
  const expiresAt = spell.concentration ? durationExpiry(spell, now) : null;
  const previousConcentration = session?.world_state?.active_concentration || null;
  const previousSource = normalize(previousConcentration?.spell_name || '');
  const replacesConcentration = !!(spell.concentration && previousSource && previousSource !== normalizedName);
  const isReplacedModifier = (modifier) => replacesConcentration && modifier?.concentration === true && (normalize(modifier.source) === previousSource || modifier.id === previousConcentration?.modifier_id);
  const isReplacedCondition = (condition) => replacesConcentration && typeof condition === 'object' && condition?.concentration === true && (normalize(condition.source || condition.name) === previousSource || condition.id === previousConcentration?.condition_id);
  let activeModifiers = active;
  if (spell.concentration) activeModifiers = [...active.filter((modifier) => !isReplacedModifier(modifier) && !(normalize(modifier.source) === normalizedName && modifier.concentration)), concentrationModifier(spell, now, character_id, targetResolution.target, expiresAt)];
  let structuredConditions = (character.conditions || []).filter((condition) => !isReplacedCondition(condition) && !(isPassWithoutTraceIdentity(condition) && (isPassWithoutTrace || replacesConcentration)));
  if (isPassWithoutTrace) structuredConditions = addStructuredCondition(structuredConditions, buildStructuredCondition({ name: 'pass without trace', source: canonicalName, target_id: character_id, caster_id: character_id, duration_type: 'timestamp', expires_at: expiresAt, concentration: true }));
  if (isSilence) structuredConditions = addStructuredCondition(structuredConditions, buildStructuredCondition({ name:'silence', source:canonicalName, target_id:`scene_point:${targetResolution.target.anchor}`, caster_id:character_id, duration_type:'timestamp', expires_at:expiresAt, concentration:true, metadata:{target:targetResolution.target, radius_feet:targetResolution.target.radius_feet, range_feet:targetResolution.target.range_feet, stationary:true} }));
  let healAmount = 0;
  const hpBefore = Number(character.hp_current) || 0;
  let hpCurrent = hpBefore;
  let rollExpression = null;
  let rollTotal = 0;
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
  const at=new Date(now).toISOString();
  const concentrationTargetId=targetResolution.target?.kind==='point_area'?`scene_point:${targetResolution.target.anchor}`:targetResolution.target?.id||character_id;
  const sessionWorldState=session?{...(session.world_state||{}),last_spell_cast:{spell_name:canonicalName,canonical_spell_id:spell.id,character_id,slot_level:selectedLevel,used_before:usedBefore,used_after:usedAfter,heal_amount:healAmount,request_id:token,at}}:null;
  if(sessionWorldState&&spell.concentration)sessionWorldState.active_concentration={spell_name:canonicalName,canonical_spell_id:spell.id,character_id,caster_id:character_id,target_id:concentrationTargetId,target:targetResolution.target,scope:targetResolution.target?.kind==='point_area'?'area':'self',duration:spell.duration||'Concentration',applied_at:at,expires_at:expiresAt,expiration_rule:expiresAt?'timestamp':'concentration',concentration:true,request_id:token};
  const stateHashBefore=await hashMechanicalState(stateProjection(character,session));
  const projectedCharacter={...character,spell_slots:spellSlots,active_modifiers:activeModifiers,conditions:(isPassWithoutTrace||isSilence)?structuredConditions:character.conditions,long_rest_abilities:undefined,hp_current:healAmount>0?hpCurrent:character.hp_current,inventory:grantedInventory||character.inventory};
  const projectedSession=session?{...session,world_state:sessionWorldState}:null;
  const stateHashAfter=await hashMechanicalState(stateProjection(projectedCharacter,projectedSession));
  const replacement=replacesConcentration?{reason:'new_concentration_spell',spell_name:previousConcentration.spell_name||null,request_id:previousConcentration.request_id||null,target_id:previousConcentration.target_id||null,modifier_ids:(character.active_modifiers||[]).filter(isReplacedModifier).map((item)=>item.id||null),condition_ids:(character.conditions||[]).filter(isReplacedCondition).map((item)=>item.id||null)}:null;
  const receipt={token,request_key:token,receipt_id:token,transaction_version:SPELL_TRANSACTION_VERSION,spell_name:canonicalName,canonical_spell_id:spell.id||targetResolution.profile.canonical_id,caster_id:character_id,slot_level:selectedLevel,used_before:usedBefore,used_after:usedAfter,target_id:concentrationTargetId,target:targetResolution.target,target_profile:targetResolution.profile,duration:spell.duration||null,expires_at:expiresAt,concentration:!!spell.concentration,replaces_concentration:replacement,is_healing:isHealingSpell,heal_amount:healAmount,healing_roll:selfHealing?{expression:rollExpression,total:rollTotal}:null,roll_expression:rollExpression,roll_total:rollTotal,hp_before:hpBefore,hp_after:hpCurrent,granted_goodberry:grantedGoodberry,state_hash_before:stateHashBefore,state_hash_after:stateHashAfter,at};
  abilities.__typed_spell_casts=[...receipts.filter((item)=>item?.token!==token&&item?.request_key!==token).slice(-24),receipt];
  const updates={spell_slots:spellSlots,active_modifiers:activeModifiers,long_rest_abilities:abilities};
  if(isPassWithoutTrace||isSilence)updates.conditions=structuredConditions;
  if(healAmount>0)updates.hp_current=hpCurrent;
  if(grantedInventory)updates.inventory=grantedInventory;
  await base44.asServiceRole.entities.Character.update(character_id,updates);
  if(session)await base44.asServiceRole.entities.GameSession.update(session_id,{world_state:sessionWorldState});
  if (session?.in_combat && session.combat_state?.combat_id) {
    const combat = await base44.asServiceRole.entities.CombatLog.get(session.combat_state.combat_id);
    if (combat?.is_active) {
      const combatants = (combat.combatants || []).map((combatant) => combatant.id === character_id ? { ...combatant, hp_current: hpCurrent, conditions: (isPassWithoutTrace || isSilence) ? structuredConditions : (combatant.conditions || []) } : combatant);
      await base44.asServiceRole.entities.CombatLog.update(combat.id, { combatants, log_entries: [...(combat.log_entries || []), { type: 'spell_cast', spell_name: canonicalName, actor: character.name, target: character.name, round: combat.round || 0, timestamp: new Date(now).toISOString(), request_id: token, heal_amount: healAmount }], world_state: spell.concentration ? { ...(combat.world_state || {}), concentration_spell: canonicalName, concentration_caster: character.name } : (combat.world_state || {}) });
    }
  }
  return respond(200, { success: true, spell_detected: true, already_active: false, replayed:false, writes:session?2:1, transaction_version:SPELL_TRANSACTION_VERSION, receipt_id: token, request_id: token, request_key:token, spell_name: canonicalName, canonical_spell_id:spell.id, slot_level: selectedLevel, base_level: baseLevel, used_before:usedBefore, used_after:usedAfter, used_slots: usedAfter, max_slots: maximum, remaining_slots: Math.max(0, maximum - usedAfter), spell_slots: spellSlots, active_modifiers: activeModifiers, concentration: !!spell.concentration, replaces_concentration:replacement, duration: spell.duration, attack_type: spell.attack_type, components: spell.components, target: targetResolution.target, target_profile: targetResolution.profile, targeting_version: SPELL_TARGETING_VERSION, inventory: grantedInventory || character.inventory || [], heal_amount: healAmount, healing_roll:selfHealing?{expression:rollExpression,total:rollTotal}:null, roll_expression: rollExpression, roll_total: rollTotal, hp_before: hpBefore, hp_after: hpCurrent, hp_current: hpCurrent, hp_max: character.hp_max, state_hash_before:stateHashBefore, state_hash_after:stateHashAfter, receipt });
}