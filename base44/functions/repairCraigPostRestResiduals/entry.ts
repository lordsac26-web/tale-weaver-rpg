import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { combatWithoutPlayerConditions, hasPostRestResidualNarration, hashValue, isPwt, PWT_APPLIED_AT, PWT_CONDITION_ID, repairPostRestNarration } from '../../shared/story/postRestResiduals.ts';

const CHARACTER_ID = '6a6825cd07a490fa70a46852';
const SESSION_ID = '6a6825edd695bd65a4322256';
const COMBAT_ID = '6a77463582a26b50018110ea';
const REPAIR_ID = 'repair-post-rest-residuals-20260808';

export default async function repairCraigPostRestResiduals(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const payload = await req.json();
    if (payload?.repair_id !== REPAIR_ID || payload?.character_id !== CHARACTER_ID || payload?.session_id !== SESSION_ID || payload?.combat_id !== COMBAT_ID) return Response.json({ error: 'This repair is restricted to the protected Craig records.' }, { status: 400 });
    const db = base44.asServiceRole;
    const [character, session, combat] = await Promise.all([db.entities.Character.get(CHARACTER_ID), db.entities.GameSession.get(SESSION_ID), db.entities.CombatLog.get(COMBAT_ID)]);
    if (!character || !session || !combat || session.character_id !== CHARACTER_ID || combat.session_id !== SESSION_ID || !session.in_combat || session.combat_state?.combat_id !== COMBAT_ID || !combat.is_active) return Response.json({ error: 'Protected active combat/session state does not match.' }, { status: 409 });
    if (session.world_state?.residual_repairs?.[REPAIR_ID]) return Response.json({ success: true, already_processed: true, repair_id: REPAIR_ID, writes: 0 });
    const conditions = Array.isArray(character.conditions) ? character.conditions : [];
    const modifiers = Array.isArray(character.active_modifiers) ? character.active_modifiers : [];
    const hasAlert = conditions.some((entry) => String(entry?.name || entry).toLowerCase() === 'alert');
    if (Number(character.exhaustion_level) !== 0 || Number(character.hp_current) !== 44 || Number(character.hp_max) !== 44 || Number(character.hit_dice_remaining) !== 5 || Number(character.hit_dice_max) !== 5 || Object.keys(character.spell_slots || {}).length || !hasAlert || conditions.some(isPwt) || modifiers.some(isPwt)) return Response.json({ error: 'Authoritative post-rest character state was not present; no update applied.' }, { status: 409 });
    const player = (combat.combatants || []).find((entry) => entry?.type === 'player' && entry.id === CHARACTER_ID);
    if (!player) return Response.json({ error: 'Active combat player does not match the protected character.' }, { status: 409 });
    const removed = (player.conditions || []).filter((entry) => entry?.id === PWT_CONDITION_ID || (isPwt(entry) && String(entry?.applied_at || '') === PWT_APPLIED_AT));
    if (!removed.length || removed.some((entry) => !isPwt(entry))) return Response.json({ error: 'Only the identified stale Pass without Trace combat condition may be removed.' }, { status: 409 });
    const storyLog = Array.isArray(session.story_log) ? session.story_log : [];
    const entryIndex = storyLog.length - 1;
    const latest = storyLog[entryIndex];
    if (!latest?.text) return Response.json({ error: 'No current narration entry found; no update applied.' }, { status: 409 });
    const narration = repairPostRestNarration(latest.text);
    if (!narration.replacements.length || hasPostRestResidualNarration(narration.text)) return Response.json({ error: 'Current narration did not safely resolve all post-rest residual assertions.' }, { status: 409 });
    const before = { combat: hashValue(combat), combat_nonconditions: hashValue(combatWithoutPlayerConditions(combat)), narration: hashValue(latest), choices: hashValue(latest.choices || []), character: hashValue(character), session_without_narration: hashValue({ ...session, story_log: storyLog.map((entry, index) => index === entryIndex ? { ...entry, text: undefined } : entry) }) };
    const authoritativeConditions = conditions.filter((condition) => !isPwt(condition));
    const combatNativeConditions = (player.conditions || []).filter((condition) => !removed.includes(condition) && !isPwt(condition) && (condition?.source === 'combat' || condition?.duration === 'combat'));
    const refreshedPlayerConditions = [...authoritativeConditions, ...combatNativeConditions.filter((condition) => !authoritativeConditions.some((entry) => String(entry?.id || entry?.name || entry) === String(condition?.id || condition?.name || condition)))];
    const combatants = combat.combatants.map((entry) => entry === player ? { ...entry, conditions: refreshedPlayerConditions } : entry);
    const nextWorld = { ...(session.world_state || {}) };
    if (isPwt(nextWorld.active_concentration)) delete nextWorld.active_concentration;
    if (isPwt(nextWorld.last_spell_cast)) { nextWorld.last_expired_spell = { ...nextWorld.last_spell_cast, expired_by: 'completed_long_rest' }; delete nextWorld.last_spell_cast; }
    nextWorld.residual_repairs = { ...(nextWorld.residual_repairs || {}), [REPAIR_ID]: { completed_at: new Date().toISOString(), combat_id: COMBAT_ID, removed_condition_ids: removed.map((entry) => entry.id) } };
    const nextLog = storyLog.map((entry, index) => index === entryIndex ? { ...entry, text: narration.text } : entry);
    await db.entities.CombatLog.update(COMBAT_ID, { combatants });
    await db.entities.GameSession.update(SESSION_ID, { world_state: nextWorld, story_log: nextLog });
    const afterCombat = { ...combat, combatants };
    const afterLatest = nextLog[entryIndex];
    const after = { combat: hashValue(afterCombat), combat_nonconditions: hashValue(combatWithoutPlayerConditions(afterCombat)), narration: hashValue(afterLatest), choices: hashValue(afterLatest.choices || []), character: hashValue(character), session_without_narration: hashValue({ ...session, world_state: nextWorld, story_log: nextLog.map((entry, index) => index === entryIndex ? { ...entry, text: undefined } : entry) }) };
    return Response.json({ success: true, repair_id: REPAIR_ID, writes: 2, removed_combat_conditions: removed, narration_replacements: narration.replacements, hashes: { before, after }, assertions: { character_hash_unchanged: before.character === after.character, choices_hash_unchanged: before.choices === after.choices, noncondition_combat_hash_unchanged: before.combat_nonconditions === after.combat_nonconditions, combat_id_turn_round_initiative_hp_enemies_logs_unchanged: hashValue({ id: combat.id, current_turn_index: combat.current_turn_index, round: combat.round, initiative_order: combat.initiative_order, combatants: combat.combatants.map(({ conditions, ...entry }) => entry), log_entries: combat.log_entries }) === hashValue({ id: afterCombat.id, current_turn_index: afterCombat.current_turn_index, round: afterCombat.round, initiative_order: afterCombat.initiative_order, combatants: afterCombat.combatants.map(({ conditions, ...entry }) => entry), log_entries: afterCombat.log_entries }), no_pwt_in_character_session_or_combat: !conditions.some(isPwt) && !modifiers.some(isPwt) && !isPwt(nextWorld.active_concentration) && !combatants.flatMap((entry) => entry.conditions || []).some(isPwt), no_fatigue_or_lingering_magic_in_current_narration: !hasPostRestResidualNarration(afterLatest.text) } });
  } catch (error) { return Response.json({ error: error.message || 'Post-rest residual repair failed' }, { status: 500 }); }
}