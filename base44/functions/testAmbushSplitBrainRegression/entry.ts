import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { auditRepairAmbushSplitBrain, deriveAuthoritativeTargetState } from '../../shared/repairs/ambushSplitBrain.ts';
import { classifyPrecisionAmbushIntent, normalizePendingAmbushRoster, pendingAmbushNarrative, stripGeneratedChoiceAnnotations } from '../../shared/story/generatedChoiceIntent.js';
import { concealmentAttributions } from '../../shared/combat/conditions.ts';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { executePlayerAttackCore } from '../../shared/combat/playerAttackCore.ts';

const LIVE = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const pwt = (id) => ({ id: `pwt_${id}`, name: 'pass without trace', source: 'Pass without Trace', target_id: id, caster_id: id, concentration: true, applied_at: '2026-08-10T01:10:46.874Z', expires_at: '2026-08-10T02:10:46.874Z' });
const modifier = (id) => ({ id: `pwt_mod_${id}`, source: 'Pass without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, concentration: true, target_id: id, caster_id: id, applied_at: '2026-08-10T01:10:46.874Z', expires_at: '2026-08-10T02:10:46.874Z' });
const sourceTarget = { id: 'fixture_necromancer', name: 'Necromancer', hp_current: 27, hp_max: 27, ac: 13, initiative_roll: 9, initiative_mod: 2, initiative_total: 11, attack_bonus: 4, damage_dice: '1d8', damage_bonus: 2, cr: 2, xp: 450 };

export default async function testAmbushSplitBrainRegression(req) {
  const fixtures = []; const cleanup = []; const results = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me(); await req.json().catch(() => ({}));
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const liveHash = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(LIVE[0]), base44.asServiceRole.entities.GameSession.get(LIVE[1])]));
    const token = `AmbushSplitQA_${Date.now()}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 5, dexterity: 19, proficiency_bonus: 3, skills: { Stealth: 'proficient' }, hp_max: 44, hp_current: 30, armor_class: 18, inventory: [{ name: 'Arrows', quantity: 12 }], conditions: [], active_modifiers: [], is_active: false });
    await base44.asServiceRole.entities.Character.update(character.id, { conditions: [pwt(character.id), { name: 'Stealthed', source: 'story', duration: 'scene' }], active_modifiers: [modifier(character.id)] });
    const choice = 'Attempt a precision long-range strike at the ritual master. [Skill Check: Stealth DC16 — FAILURE (d20 7 + 7 = 14)]';
    const receipt = { id: `${token}:skill`, request_id: `${token}:skill`, raw_d20: 7, all_rolls: [7], dc: 16, modifier_total: 7, final_total: 14, success: false };
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: true, story_log: [{ timestamp: '2026-08-10T18:49:58.409Z', player_choice: 'Older surgical strike. [Skill Check: Stealth DC16 — SUCCESS]', text: 'Older action.' }, { timestamp: '2026-08-10T19:22:33.466Z', request_id: `${token}:skill`, player_choice: choice, text: 'The arrow bites true and the necromancer dies.' }], world_state: { world_clock_timestamp: '2026-08-08T20:51:07.745Z', active_concentration: { spell_name: 'Pass without Trace', character_id: character.id, target_id: character.id, caster_id: character.id, concentration: true }, __skill_check_receipts: [receipt] }, is_active: false });
    const skeletons = [1,2,3].map((n) => ({ id: `s${n}`, name: n === 3 ? 'Skeleton Reinforcement' : 'Skeleton', type: 'enemy', hp_current: 16, hp_max: 16, ac: 13, is_conscious: true, initiative_total: 10 - n }));
    const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, character_name: character.name, round: 1, current_turn_index: 0, is_active: true, result: 'ongoing', combatants: [{ id: character.id, name: character.name, type: 'player', hp_current: 30, hp_max: 44, is_conscious: true, initiative_total: 15 }, ...skeletons], initiative_order: [], log_entries: [{ text: 'Combat begins.' }], world_state: { ambush_source_target: sourceTarget } });
    await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
    fixtures.push(['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]);
    const scope = { characterId: character.id, sessionId: session.id };

    const clean = stripGeneratedChoiceAnnotations(choice);
    results.push({ name: 'stale generated choice outcome roll and total are stripped to intent', pass: !/Skill Check|FAILURE|d20|14/.test(clean) && !!classifyPrecisionAmbushIntent(clean) });
    const normalized = normalizePendingAmbushRoster([{ ...sourceTarget, hp: 27 }]);
    results.push({ name: 'pending ambush roster requires one living complete target', pass: normalized.ok && normalized.target.current_hp === 27 && normalized.target.authoritative_state === 'alive_pending_attack' });
    results.push({ name: 'narrative before attack receipt states setup only and no kill', pass: /strike itself is still pending/i.test(pendingAmbushNarrative('Necromancer')) && !/dies|dead|killed/i.test(pendingAmbushNarrative('Necromancer')) });
    const ambushAttribution = concealmentAttributions([{ name: 'Stealthed', source: 'story', duration: 'scene' }]);
    results.push({ name: 'successful Stealthed setup grants exactly one attributed attack advantage source', pass: ambushAttribution.length === 1 && ambushAttribution[0] === 'Attacking from Stealthed/concealed' });

    const dry = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'dry_run' });
    results.push({ name: 'raw7 plus authoritative17 is total24 success with one PWT plus10', pass: dry.body.corrected_stealth.raw_d20 === 7 && dry.body.corrected_stealth.total === 24 && dry.body.corrected_stealth.breakdown.components.filter((entry) => entry.source === 'Pass without Trace' && entry.value === 10).length === 1 });
    const applied = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply', expectedHashes: dry.body.protected_hashes });
    const [afterChar, afterSession, afterCombat] = await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id), base44.asServiceRole.entities.CombatLog.get(combat.id)]);
    results.push({ name: 'missing attack receipt restores pending target without fabricated attack damage or death', pass: applied.status === 200 && applied.body.pending_attack && afterCombat.combatants.filter((entry) => /necromancer/i.test(entry.name)).length === 1 && afterCombat.log_entries.length === 1 });
    results.push({ name: 'corrected setup receipt persists raw7 all rolls breakdown total24 DC16 success', pass: afterSession.story_log[1].skill_check.raw_d20 === 7 && afterSession.story_log[1].skill_check.all_rolls.length === 1 && afterSession.story_log[1].skill_check.final_total === 24 && afterSession.story_log[1].skill_check.success });
    results.push({ name: 'three skeletons and player turn are preserved', pass: afterCombat.combatants.filter((entry) => /skeleton/i.test(entry.name)).length === 3 && afterCombat.combatants[afterCombat.current_turn_index].id === character.id });
    results.push({ name: 'single Stealthed condition and unrelated HP inventory remain unchanged', pass: afterChar.conditions.filter((entry) => entry.name === 'Stealthed').length === 1 && afterChar.hp_current === 30 && afterChar.inventory[0].quantity === 12 });
    results.push({ name: 'lethal prose is minimally replaced by successful setup pending attack', pass: /approach succeeds/i.test(afterSession.story_log[1].text) && /still pending/i.test(afterSession.story_log[1].text) && !/dies|dead|bites true/i.test(afterSession.story_log[1].text) });
    const replay = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply' });
    results.push({ name: 'repair replay writes zero and creates no second combat', pass: replay.body.already_processed && replay.body.writes === 0 && (await base44.asServiceRole.entities.CombatLog.filter({ session_id: session.id })).length === 1 });
    const uiPayload = { target_id: sourceTarget.id, weapon: { name: 'Longbow', damage_dice: '1d8', damage_type: 'piercing', type: 'ranged', properties: [], attack_bonus: 0, damage_bonus: 0 }, spell: null, modifiers: {}, twin_target_id: null };
    let ambushRollIndex = 0; const ambushRolls = [3, 17];
    const productionAttack = await executePlayerAttackCore({ base44, sessionId: session.id, combatId: combat.id, characterId: character.id, ownerId: user.id, requestId: `${token}:ui-attack`, payload: uiPayload, handler: handlePlayerAttack, rollD20Fn: () => ambushRolls[Math.min(ambushRollIndex++, ambushRolls.length - 1)] });
    results.push({ name: 'repaired ambush uses real production player_attack payload with exactly two d20s', pass: productionAttack.status === 200 && productionAttack.body.all_rolls?.length === 2 && productionAttack.body.log_entry?.advantage === true });
    results.push({ name: 'real production attack persists request and Stealthed attribution before display', pass: productionAttack.body.log_entry?.request_id === `${token}:ui-attack` && productionAttack.body.log_entry?.advantage_sources?.length === 1 && /Attacking from Stealthed\/concealed/.test(productionAttack.body.log_entry?.text || '') });

    const dead = deriveAuthoritativeTargetState([{ id: 'a', action: 'player_attack', outcome: { target_hp: 0, log_entry: { target: 'Necromancer' } } }]);
    const alive = deriveAuthoritativeTargetState([{ id: 'b', action: 'player_attack', outcome: { target_hp: 4, log_entry: { target: 'Necromancer' } } }]);
    results.push({ name: 'authoritative committed hit damage may exclude dead target', pass: dead.ok && dead.committed && dead.alive === false });
    results.push({ name: 'authoritative committed attack keeps living target', pass: alive.ok && alive.committed && alive.alive === true && alive.hp === 4 });
    results.push({ name: 'ambiguous target attack receipts fail closed', pass: deriveAuthoritativeTargetState([{ action: 'player_attack', outcome: { target_hp: 0, log_entry: { target: 'Necromancer' } } }, { action: 'player_attack', outcome: { target_hp: 2, log_entry: { target: 'Ritual Master' } } }]).ambiguous });
    const mismatch = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope, requestId: `${token}:hash`, mode: 'apply', expectedHashes: { ...dry.body.protected_hashes, character: 'wrong' } });
    results.push({ name: 'hash mismatch rejects with zero writes', pass: mismatch.status === 409 && mismatch.body.writes === 0 });
    const wrongSession = await base44.asServiceRole.entities.GameSession.create({ character_id: 'wrong', title: `${token}_wrong`, story_log: [], is_active: false }); fixtures.unshift(['GameSession', wrongSession.id]);
    const wrong = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope: { characterId: character.id, sessionId: wrongSession.id }, requestId: `${token}:wrong`, mode: 'dry_run' });
    results.push({ name: 'wrong Character Session linkage fails closed', pass: wrong.body.guards.exact_linkage === false && wrong.body.writes === 0 });
    results.push({ name: 'protected live IDs remain unchanged', pass: liveHash === await hash(await Promise.all([base44.asServiceRole.entities.Character.get(LIVE[0]), base44.asServiceRole.entities.GameSession.get(LIVE[1])])) });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally { const base44 = createClientFromRequest(req); for (const [entity,id] of fixtures) { let deleted=false, verified_absent=false; try { await base44.asServiceRole.entities[entity].delete(id); deleted=true; } catch {} try { verified_absent=!(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent=true; } cleanup.push({entity,id,deleted,verified_absent}); } }
  const passed=results.filter((entry)=>entry.pass).length; const cleanupPassed=cleanup.every((entry)=>entry.deleted&&entry.verified_absent); const allPass=passed===results.length&&cleanupPassed;
  return Response.json({ deployment_id:'ambush-split-brain-v1',passed,failed:results.length-passed,total:results.length,all_pass:allPass,results,cleanup,cleanup_passed:cleanupPassed,live_state:{protected_ids:LIVE,unchanged:results.some((entry)=>entry.name==='protected live IDs remain unchanged'&&entry.pass)}},{status:allPass?200:500});
}