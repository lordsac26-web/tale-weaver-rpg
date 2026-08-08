import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CHARACTER_ID = '6a6825cd07a490fa70a46852';
const SESSION_ID = '6a6825edd695bd65a4322256';
const COMBAT_ID = '6a77463582a26b50018110ea';
const REPAIR_ID = 'repair-post-rest-continuity-20260808';
const PWT = 'pass without trace';
const hash = (value) => Array.from(new TextEncoder().encode(JSON.stringify(value))).reduce((total, byte) => ((total * 31) + byte) >>> 0, 0).toString(16);
const nameOf = (value) => String(typeof value === 'string' ? value : value?.name || '').trim();
const isPwt = (value) => nameOf(value).toLowerCase() === PWT;

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
    const removedConditions = conditions.filter(isPwt);
    const removedModifiers = modifiers.filter(isPwt);
    if (!removedConditions.length || !removedModifiers.length || !Number(character.spell_slots?.level_2)) return Response.json({ error: 'Known invalid Pass without Trace residue was not present; no update applied.' }, { status: 409 });
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
    const concentration = nextWorld.active_concentration;
    if (isPwt(concentration)) delete nextWorld.active_concentration;
    if (isPwt(nextWorld.last_spell_cast)) { nextWorld.last_expired_spell = { ...nextWorld.last_spell_cast, expired_by: 'completed_long_rest', expired_at: nextWorld.last_rest_completed_at || new Date().toISOString() }; delete nextWorld.last_spell_cast; }
    nextWorld.post_rest_continuity = { rested: true, exhausted: false, completed_at: nextWorld.last_rest_completed_at || null, clock_hour: 8, period: 'Morning', expired_effects: ['Pass without Trace'], repair_id: REPAIR_ID };
    const nextCharacter = { conditions: conditions.filter((entry) => !isPwt(entry)), active_modifiers: modifiers.filter((entry) => !isPwt(entry)), spell_slots: {} };
    const nextStoryLog = storyLog.map((entry, entryIndex) => entryIndex === index ? { ...entry, text } : entry);
    await db.entities.Character.update(CHARACTER_ID, nextCharacter);
    await db.entities.GameSession.update(SESSION_ID, { world_state: nextWorld, story_log: nextStoryLog });
    const after = { character: { ...character, ...nextCharacter }, session_mechanics: { world_state: nextWorld, time_of_day: session.time_of_day }, narration: text, combat_state: session.combat_state };
    return Response.json({ success: true, repair_id: REPAIR_ID, hashes: { character: { before: hash(before.character), after: hash(after.character) }, session_mechanics: { before: hash(before.session_mechanics), after: hash(after.session_mechanics) }, narration: { before: hash(before.narration), after: hash(after.narration) }, combat_state: { before: hash(before.combat_state), after: hash(after.combat_state) } }, removed: { conditions: removedConditions, modifiers: removedModifiers }, slots: { before: character.spell_slots || {}, after: {} }, narration: { changed_phrases, before_hash: hash(originalEntry.text), after_hash: hash(text) }, unchanged_fields: ['exhaustion_level', 'hp_current', 'hp_max', 'hit_dice_remaining', 'hit_dice_max', 'inventory', 'currency', 'XP', 'equipment', 'spells_known', 'spells_prepared', 'identity', 'in_combat', 'combat_state', 'CombatLog combatants', 'CombatLog initiative', 'CombatLog turn', 'CombatLog logs', 'quests', 'location', 'time_of_day', 'rest receipts'] });
  } catch (error) { return Response.json({ error: error.message || 'Post-rest continuity repair failed' }, { status: 500 }); }
}