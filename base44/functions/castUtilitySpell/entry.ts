import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireUser, characterBelongsToUser } from '../../shared/combat/authGuard.ts';

const FULL = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF = [[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const ARTIFICER = HALF;
const WARLOCK_PACT = [1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4];
const TABLES = { Wizard: FULL, Sorcerer: FULL, Bard: FULL, Cleric: FULL, Druid: FULL, Paladin: HALF, Ranger: HALF, Artificer: ARTIFICER };

const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hasCastIntent = (text) => /\b(cast|casting|invoke|invoking|use|using|channel|channeling)\b/i.test(String(text || ''));
const casterContribution = (cls, sub, levels) => {
  if (['Wizard','Sorcerer','Bard','Cleric','Druid'].includes(cls)) return levels;
  if (['Paladin','Ranger','Artificer'].includes(cls)) return Math.floor(levels / 2);
  const lower = String(sub || '').toLowerCase();
  if (lower.includes('eldritch knight') || lower.includes('arcane trickster')) return Math.floor(levels / 3);
  return 0;
};
function maxSlots(character, slotLevel) {
  const level = Math.max(1, Math.min(20, Number(character.level) || 1));
  const index = slotLevel - 1;
  const multiclass = Array.isArray(character.multiclass) && character.multiclass.length > 0;
  if (character.class === 'Warlock' && !multiclass) {
    const pactLevel = Math.min(5, Math.ceil(level / 2));
    return slotLevel <= pactLevel ? (WARLOCK_PACT[level - 1] || 0) : 0;
  }
  if (multiclass) {
    let casterLevel = casterContribution(character.class, character.subclass, level);
    for (const mc of character.multiclass) {
      if (mc?.class === 'Warlock') continue;
      casterLevel += casterContribution(mc?.class, mc?.subclass, Number(mc?.levels) || 0);
    }
    return casterLevel > 0 ? ((FULL[Math.min(20, casterLevel) - 1] || [])[index] || 0) : 0;
  }
  const sub = String(character.subclass || '').toLowerCase();
  if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
    const casterLevel = Math.floor(level / 3);
    return casterLevel > 0 ? ((FULL[casterLevel - 1] || [])[index] || 0) : 0;
  }
  return (((TABLES[character.class] || [])[level - 1]) || [])[index] || 0;
}
function ordinal(level) {
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}
function findKnownSpell(character, actionText, requestedName) {
  const names = [...new Set([...(character.spells_prepared || []), ...(character.spells_known || [])].filter(Boolean))];
  if (requestedName) {
    const wanted = normalize(requestedName);
    return names.find(name => normalize(name) === wanted) || null;
  }
  if (!hasCastIntent(actionText)) return null;
  const action = normalize(actionText);
  return names.sort((a, b) => normalize(b).length - normalize(a).length).find(name => action.includes(normalize(name))) || null;
}
function concentrationModifier(spell, now) {
  const name = spell.name;
  const base = { id: `typed_spell_${normalize(name).replace(/ /g, '_')}_${now}`, source: name, effect: 'spell_concentration', concentration: true, applied_at: new Date(now).toISOString(), duration: spell.duration || 'Concentration' };
  if (normalize(name) === 'pass without trace') return { ...base, effect: 'skill_bonus', skill: 'Stealth', bonus: 10 };
  if (normalize(name) === 'hunters mark') return { ...base, effect: 'hunters_mark', damage_bonus_dice: '1d6' };
  if (normalize(name) === 'ensnaring strike') return { ...base, effect: 'ensnaring_strike_pending' };
  if (normalize(name) === 'silence') return { ...base, effect: 'silence_area' };
  if (normalize(name) === 'detect magic') return { ...base, effect: 'detect_magic' };
  return base;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, error: authError } = await requireUser(base44);
    if (authError) return authError;
    const { session_id, character_id, spell_name, action_text, slot_level, cast_token, request_id } = await req.json();
    if (!session_id || !character_id) return Response.json({ error: 'session_id and character_id are required' }, { status: 400 });

    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session || session.character_id !== character_id) return Response.json({ error: 'Session and character do not match' }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    if (!characterBelongsToUser(character, user)) return Response.json({ error: 'Character does not belong to the authenticated user' }, { status: 403 });

    const canonicalName = findKnownSpell(character, action_text, spell_name);
    if (!canonicalName) return Response.json({ success: true, spell_detected: false, spell_slots: character.spell_slots || {}, active_modifiers: character.active_modifiers || [] });
    const known = [...(character.spells_known || []), ...(character.spells_prepared || [])].some(s => normalize(s) === normalize(canonicalName));
    if (!known) return Response.json({ error: `${character.name} does not know or have ${canonicalName} prepared`, invalid: true }, { status: 400 });

    const spellRows = await base44.asServiceRole.entities.Spell.filter({ name: canonicalName }, '-updated_date', 1);
    const spell = spellRows?.[0];
    if (!spell) return Response.json({ error: `Canonical spell data is missing for ${canonicalName}`, invalid: true }, { status: 404 });
    const isHostileTargeted = spell.attack_type !== 'healing' && spell.attack_type !== 'utility' && !spell.is_utility;
    if (isHostileTargeted) {
      return Response.json({ error: `${canonicalName} requires a valid combat target. Use the combat spell action while an active combat target is available.`, invalid: true, target_required: true }, { status: 400 });
    }

    const conditions = (character.conditions || []).map(c => normalize(typeof c === 'string' ? c : c?.name));
    const components = String(spell.components || 'V').toUpperCase();
    if ((conditions.includes('silenced') || conditions.includes('silence')) && components.includes('V')) {
      return Response.json({ error: `${character.name} is silenced and cannot cast ${canonicalName}, which requires a verbal component.`, invalid: true }, { status: 400 });
    }
    if (conditions.includes('raging')) return Response.json({ error: `${character.name} cannot cast spells while raging.`, invalid: true }, { status: 400 });

    const explicit = Number(slot_level) || Number(String(action_text || '').match(/\b(?:level|lvl|at)\s*(\d+)\b/i)?.[1]) || 0;
    const baseLevel = Math.max(0, Number(spell.level) || 0);
    const selectedLevel = baseLevel === 0 ? 0 : Math.max(baseLevel, explicit || baseLevel);
    const token = String(request_id || cast_token || '').slice(0, 120);
    if (!token) return Response.json({ error: 'request_id or cast_token is required for idempotent spell casting' }, { status: 400 });
    const abilities = { ...(character.long_rest_abilities || {}) };
    const receipts = Array.isArray(abilities.__typed_spell_casts) ? abilities.__typed_spell_casts : [];
    const prior = token && receipts.find(r => r?.token === token);
    if (prior) {
      const maximum = maxSlots(character, prior.slot_level);
      const used = Number((character.spell_slots || {})[`level_${prior.slot_level}`]) || 0;
      return Response.json({ success: true, spell_detected: true, already_processed: true, spell_name: prior.spell_name, slot_level: prior.slot_level, used_slots: used, max_slots: maximum, remaining_slots: Math.max(0, maximum - used), spell_slots: character.spell_slots || {}, active_modifiers: character.active_modifiers || [], inventory: character.inventory || [], heal_amount: prior.heal_amount || 0, hp_current: character.hp_current });
    }

    const now = Date.now();
    const active = (character.active_modifiers || []).filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now);
    const existing = spell.concentration ? active.find(m => normalize(m.source) === normalize(canonicalName) && m.concentration) : null;
    if (existing) return Response.json({ success: true, spell_detected: true, already_active: true, spell_name: canonicalName, slot_level: selectedLevel, spell_slots: character.spell_slots || {}, active_modifiers: active });

    let spellSlots = { ...(character.spell_slots || {}) };
    let maximum = 0;
    let usedAfter = 0;
    if (selectedLevel > 0) {
      maximum = maxSlots(character, selectedLevel);
      const key = `level_${selectedLevel}`;
      const used = Number(spellSlots[key]) || 0;
      if (maximum <= 0 || used >= maximum) return Response.json({ error: `No ${ordinal(selectedLevel)}-level spell slots remaining.`, invalid: true }, { status: 400 });
      spellSlots = { ...spellSlots, [key]: used + 1 };
      usedAfter = used + 1;
    }

    let activeModifiers = active;
    if (spell.concentration) activeModifiers = [...active.filter(m => !m.concentration), concentrationModifier(spell, now)];

    // Story-mode healing must complete in the same Character update as slot
    // consumption. Narration is downstream and may fail; it never owns HP state.
    let healAmount = 0;
    let hpCurrent = Number(character.hp_current) || 0;
    const selfTarget = /\b(myself|my self|on me|heal me|my wounds)\b/i.test(String(action_text || ''));
    if (spell.attack_type === 'healing' && selfTarget) {
      const dice = String(spell.description || '').match(/(\d+)d(\d+)/i);
      const baseDiceCount = Number(dice?.[1]) || 1;
      const dieSize = Number(dice?.[2]) || 8;
      const diceCount = baseDiceCount + Math.max(0, selectedLevel - baseLevel);
      const abilityByClass = { Cleric: 'wisdom', Druid: 'wisdom', Ranger: 'wisdom', Paladin: 'charisma', Bard: 'charisma', Sorcerer: 'charisma', Warlock: 'charisma', Wizard: 'intelligence', Artificer: 'intelligence' };
      const ability = abilityByClass[character.class] || 'wisdom';
      const abilityMod = Math.floor(((Number(character[ability]) || 10) - 10) / 2);
      for (let i = 0; i < diceCount; i++) healAmount += Math.floor(Math.random() * dieSize) + 1;
      healAmount = Math.max(0, healAmount + abilityMod);
      hpCurrent = Math.min(Number(character.hp_max) || hpCurrent, hpCurrent + healAmount);
    }

    // Goodberry (PHB p.236): the cast transmutes ten berries that each restore
    // 1 HP and nourish for one day. Grant them as a single consumable inventory
    // stack scoped to this cast's receipt so a retry (same token) can never
    // double-grant. The slot above is already consumed; this only adds berries.
    let grantedInventory = null;
    let grantedGoodberry = false;
    if (normalize(canonicalName) === 'goodberry') {
      grantedGoodberry = true;
      const ttlMs = 24 * 60 * 60 * 1000;
      const inv = Array.isArray(character.inventory) ? [...character.inventory] : [];
      const idx = inv.findIndex(it => normalize(it?.name) === 'goodberry');
      if (idx >= 0) {
        const existing = inv[idx];
        const existingExpiry = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
        inv[idx] = { ...existing, quantity: (Number(existing.quantity) || 0) + 10, expires_at: new Date(Math.max(existingExpiry, now + ttlMs)).toISOString() };
      } else {
        inv.push({ name: 'Goodberry', category: 'Consumable', quantity: 10, description: 'A transmuted berry that restores 1 Hit Point when eaten and provides enough nourishment to sustain a creature for one day. Expires 24 hours after casting.', expires_at: new Date(now + ttlMs).toISOString() });
      }
      grantedInventory = inv;
    }

    if (token) abilities.__typed_spell_casts = [...receipts.filter(r => r?.token !== token).slice(-24), { token, spell_name: canonicalName, slot_level: selectedLevel, heal_amount: healAmount, granted_goodberry: grantedGoodberry, at: new Date(now).toISOString() }];

    const characterUpdates = { spell_slots: spellSlots, active_modifiers: activeModifiers, long_rest_abilities: abilities };
    if (healAmount > 0) characterUpdates.hp_current = hpCurrent;
    if (grantedInventory) characterUpdates.inventory = grantedInventory;
    await base44.asServiceRole.entities.Character.update(character_id, characterUpdates);
    if (session.in_combat && session.combat_state?.combat_id && spell.concentration) {
      const combat = await base44.asServiceRole.entities.CombatLog.get(session.combat_state.combat_id);
      if (combat?.is_active) await base44.asServiceRole.entities.CombatLog.update(combat.id, { world_state: { ...(combat.world_state || {}), concentration_spell: canonicalName, concentration_caster: character.name } });
    }

    return Response.json({ success: true, spell_detected: true, already_active: false, spell_name: canonicalName, slot_level: selectedLevel, base_level: baseLevel, used_slots: usedAfter, max_slots: maximum, remaining_slots: Math.max(0, maximum - usedAfter), spell_slots: spellSlots, active_modifiers: activeModifiers, concentration: !!spell.concentration, duration: spell.duration, attack_type: spell.attack_type, components: spell.components, inventory: grantedInventory || character.inventory || [], heal_amount: healAmount, hp_current: hpCurrent });
  } catch (error) {
    return Response.json({ error: error.message || 'Typed spell cast failed' }, { status: 500 });
  }
});