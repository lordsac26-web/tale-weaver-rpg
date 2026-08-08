import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isCanonicalPwt, matchPostRestPwtResidue } from '../../shared/story/postRestRepairMatcher.ts';

const CHARACTER_ID = '6a6825cd07a490fa70a46852';
const SESSION_ID = '6a6825edd695bd65a4322256';
const COMBAT_ID = '6a77463582a26b50018110ea';
const REPAIR_ID = 'repair-post-rest-continuity-20260808';
const EXPECTED_CONDITION_ID = 'cond_pass_without_trace_1786201357801_7itvpo';
const EXPECTED_MODIFIER_ID = 'typed_spell_pass_without_trace_1786201357801';
const EXPECTED_REQUEST_ID = 'reconcile-pwt-patrol-20260808T0952ET';
const EXPECTED_APPLIED_AT = '2026-08-08T15:02:37.801Z';
const hash = (value) => Array.from(new TextEncoder().encode(JSON.stringify(value))).reduce((total, byte) => ((total * 31) + byte) >>> 0, 0).toString(16);

export default async function repairCraigPostRestContinuity(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const payload = await req.json();
    if (payload?.repair_id !== REPAIR_ID || payload?.character_id !== CHARACTER_ID || payload?.session_id !== SESSION_ID || payload?.combat_id !== COMBAT_ID) return Response.json({ error: 'This repair is restricted to the protected Craig records.' }, { status: 400 });
    const db = base44.asServiceRole;
    const [character, session, combat] = await Promise.all([db.entities.Character.get(CHARACTER_ID), db.entities.GameSession.get(SESSION_ID), db.entities.CombatLog.get(COMBAT_ID)]);
    if (!character || !session || !combat || session.character_id !== CHARACTER_ID || !session.in_combat || session.combat_state?.combat_id !== COMBAT_ID) return Response.json({ error: 'Protected combat/session state does not match.' }, { status: 409 });
    const continuity = session.world_state?.post_rest_continuity;
    if (continuity?.repair_id === REPAIR_ID) return Response.json({ success: true, already_processed: true, repair_id: REPAIR_ID, writes: 0 });
    if (Number(character.exhaustion_level) !== 0 || Number(character.hp_current) !== 44 || Number(character.hp_max) !== 44 || Number(character.hit_dice_remaining) !== 5 || Number(character.hit_dice_max) !== 5 || Number(session.world_state?.clock_hour) !== 8 || session.time_of_day !== 'Morning') return Response.json({ error: 'Known completed-rest state was not present; no update applied.' }, { status: 409 });
    const conditions = Array.isArray(character.conditions) ? character.conditions : [];
    const modifiers = Array.isArray(character.active_modifiers) ? character.active_modifiers : [];
    const residue = matchPostRestPwtResidue({
      conditions, modifiers, worldState: session.world_state,
      expected: {
        condition_id: EXPECTED_CONDITION_ID, modifier_id: EXPECTED_MODIFIER_ID, request_id: EXPECTED_REQUEST_ID, applied_at: EXPECTED_APPLIED_AT,
        optional_condition_id: payload.expected_condition_id, optional_modifier_id: payload.expected_modifier_id, optional_request_id: payload.expected_request_id, optional_applied_at: payload.expected_applied_at,
      },
    });
    if (!residue.matched || !Number(character.spell_slots?.level_2)) return Response.json({ error: 'Known invalid Pass without Trace residue was not present; no update applied.' }, { status: 409 });
    const removedConditions = [residue.condition];
    const removedModifiers = [residue.modifier];
    const storyLog = Array.isArray(session.story_log) ? session.story_log : [];
    const index = storyLog.length - 1;
    const originalEntry = storyLog[index];
    if (!originalEntry?.text) return Response.json({ error: 'No displayed story entry found; no update applied.' }, { status: 409 });
    const replacements = [
      ['mind is a storm of fatigue and frustration', 'mind is clear, focused, and alert'],
      ['eyes struggle to track', 'eyes keenly track'],
      ['due to exhaustion', 'with renewed focus'],
      ['weary bones', 'rested limbs'],
      ['ragged', 'steady and refreshed'],
    ];
    let text = originalEntry.text;
    const changed_phrases = [];
    for (const [from, to] of replacements) { if (text.toLowerCase().includes(from)) { text = text.replace(new RegExp(from, 'ig'), to); changed_phrases.push(from); } }
    if (!changed_phrases.length) return Response.json({ error: 'Known fatigue prose was not present; no update applied.' }, { status: 409 });
    const before = { character, session_mechanics: { world_state: session.world_state, time_of_day: session.time_of_day }, narration: originalEntry.text, combat_state: session.combat_state };
    const nextWorld = { ...(session.world_state || {}) };
    if (residue.concentration && isCanonicalPwt(residue.concentration) && String(residue.concentration.request_id || '') === EXPECTED_REQUEST_ID) delete nextWorld.active_concentration;
    if (residue.lastSpellCast && isCanonicalPwt(residue.lastSpellCast) && String(residue.lastSpellCast.request_id || '') === EXPECTED_REQUEST_ID) { nextWorld.last_expired_spell = { ...residue.lastSpellCast, expired_by: 'completed_long_rest', expired_at: nextWorld.last_rest_completed_at || new Date().toISOString() }; delete nextWorld.last_spell_cast; }
    nextWorld.post_rest_continuity = { rested: true, exhausted: false, completed_at: nextWorld.last_rest_completed_at || null, clock_hour: 8, period: 'Morning', expired_effects: ['Pass without Trace'], repair_id: REPAIR_ID };
    const nextCharacter = { conditions: conditions.filter((entry) => entry !== residue.condition), active_modifiers: modifiers.filter((entry) => entry !== residue.modifier), spell_slots: {} };
    const nextStoryLog = storyLog.map((entry, entryIndex) => entryIndex === index ? { ...entry, text } : entry);
    await db.entities.Character.update(CHARACTER_ID, nextCharacter);
    await db.entities.GameSession.update(SESSION_ID, { world_state: nextWorld, story_log: nextStoryLog });
    const after = { character: { ...character, ...nextCharacter }, session_mechanics: { world_state: nextWorld, time_of_day: session.time_of_day }, narration: text, combat_state: session.combat_state };
    return Response.json({ success: true, repair_id: REPAIR_ID, hashes: { character: { before: hash(before.character), after: hash(after.character) }, session_mechanics: { before: hash(before.session_mechanics), after: hash(after.session_mechanics) }, narration: { before: hash(before.narration), after: hash(after.narration) }, combat_state: { before: hash(before.combat_state), after: hash(after.combat_state) } }, removed: { conditions: removedConditions, modifiers: removedModifiers }, slots: { before: character.spell_slots || {}, after: {} }, narration: { changed_phrases, before_hash: hash(originalEntry.text), after_hash: hash(text) }, unchanged_fields: ['exhaustion_level', 'hp_current', 'hp_max', 'hit_dice_remaining', 'hit_dice_max', 'inventory', 'currency', 'XP', 'equipment', 'spells_known', 'spells_prepared', 'identity', 'in_combat', 'combat_state', 'CombatLog combatants', 'CombatLog initiative', 'CombatLog turn', 'CombatLog logs', 'quests', 'location', 'time_of_day', 'rest receipts'] });
  } catch (error) { return Response.json({ error: error.message || 'Post-rest continuity repair failed' }, { status: 500 }); }
}