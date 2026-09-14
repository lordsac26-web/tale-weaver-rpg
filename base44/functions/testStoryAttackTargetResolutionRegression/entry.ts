import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { executeStoryWeaponAttack } from '../../shared/story/storyWeaponAttack.ts';
import { resolveStoryAttackTarget } from '../../shared/story/storyAttackTarget.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const VERSION = 'test-story-attack-target-resolution-v1.0.0';

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
  const fixtures = [];
  const tests = [];
  const test = (name, pass, detail = null) => tests.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  try {
    await req.json().catch(() => ({}));
    const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const token = `StoryTarget_${Date.now()}`;
    const weapon = { name: 'Longbow', type: 'ranged', damage_dice: '1d8', damage_type: 'piercing', properties: ['Ammunition (150/600)'] };
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 6, multiclass: [{ class: 'Rogue', levels: 1 }], dexterity: 18, strength: 10, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10, proficiency_bonus: 3, hp_max: 44, hp_current: 44, armor_class: 16, skills: { Stealth: 'proficient' }, class_choices: { fighting_style: 'archery', __review_confirmed: { fighting_style: true } }, fighting_style: 'archery', features: ['Extra Attack', 'Sneak Attack (1d6)'], inventory: [{ name: 'Arrows', category: 'Ammunition', quantity: 5 }], equipped: { weapon, mainhand: weapon }, conditions: [], active_modifiers: [{ id: 'expired_pwt', source: 'Pass without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, concentration: true, applied_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-01-01T01:00:00.000Z' }], is_active: false });
    fixtures.push(['Character', character.id]);
    const stealthReceipt = { id: `${token}:stealth`, request_id: `${token}:stealth`, skill: 'Stealth', raw_d20: 14, all_rolls: [14], dc: 15, modifier_total: 17, final_total: 31, success: true, modifier_breakdown: { total: 17, pwt_active: true }, at: '2026-01-02T00:00:00.000Z', unified_story_skill_resolution: true };
    const session = await base44.entities.GameSession.create({ character_id: character.id, title: token, in_combat: false, combat_state: {}, story_log: [{ timestamp: stealthReceipt.at, request_id: stealthReceipt.request_id, player_choice: 'Move unseen toward the lead rune carver.', text: 'The living lead rune carver is alone and unaware.', skill_check: stealthReceipt, choices: [] }], world_state: { active_concentration: { spell_name: 'Pass without Trace', concentration: true, character_id: character.id, target_id: character.id, caster_id: character.id, applied_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-01-01T01:00:00.000Z' }, __skill_check_receipts: [stealthReceipt] }, is_active: false });
    fixtures.push(['GameSession', session.id]);

    const resolved = resolveStoryAttackTarget({ targetRef: 'Lead Rune Carver', enemies: [], sceneText: session.story_log[0].text, characterLevel: character.level });
    test('named living scene NPC materializes as exactly one complete authoritative target', resolved.ok && resolved.materialized && resolved.enemies.length === 1 && resolved.target.name === 'Lead Rune Carver' && resolved.target.hp > 0 && resolved.target.ac > 0);
    const ambiguous = resolveStoryAttackTarget({ targetRef: 'the target', enemies: [{ name: 'Rune Carver', hp: 10, ac: 12 }, { name: 'Cultist Guard', hp: 10, ac: 12 }], sceneText: 'Two enemies stand together.', characterLevel: 6 });
    test('genuinely ambiguous narrative target requests clarification without materialization', !ambiguous.ok && ambiguous.clarification_required === true);

    const contract = { text: 'Assassinate the lead rune carver with a precise arrow.', action_type: 'weapon_attack', weapon_attack: { target_ref: 'Lead Rune Carver', attack_mode: 'Stealth Attack', declared_attack_count: 1, intent: 'assassinate' } };
    const first = await executeStoryWeaponAttack({ base44, user, sessionId: session.id, requestId: `${token}:attack`, contract, enemies: [], rollSubmission: { origin: 'player', rolls: [4, 16] } });
    const combat = first.body?.combat_id ? await base44.asServiceRole.entities.CombatLog.get(first.body.combat_id) : null;
    if (combat) fixtures.push(['CombatLog', combat.id]);
    test('story attack initializes combat with only the materialized target', first.status === 200 && combat && combat.combatants.filter((entry) => entry.type === 'enemy').length === 1 && combat.combatants.some((entry) => entry.type === 'enemy' && entry.name === 'Lead Rune Carver'));
    test('latest successful Stealth receipt is revalidated without expired PWT and grants attributed advantage', first.body?.advantage === true && first.body?.roll_breakdown?.dice?.mode === 'advantage' && first.body?.advantage_sources?.includes('Attacking from Stealthed/concealed'));
    test('player-controlled story ambush uses two submitted d20s and selects the higher result', first.body?.roll_breakdown?.roll_origin === 'player' && first.body?.roll_breakdown?.dice?.rolls?.length === 2 && first.body?.roll_breakdown?.dice?.selected === 16);
    test('Rogue multiclass Sneak Attack is attributed on an advantaged hit', first.body?.hit === true && first.body?.sneak_attack?.dice === '1d6' && /Sneak Attack/.test(first.body?.sneak_attack?.attribution || ''));
    test('attack modifier breakdown exposes ability proficiency and fighting style', ['ability', 'proficiency', 'fighting_style'].every((type) => first.body?.roll_breakdown?.modifiers?.some((component) => component.type === type)));
    const beforeReplay = combat ? await hashValue(await base44.asServiceRole.entities.CombatLog.get(combat.id)) : null;
    const replay = await executeStoryWeaponAttack({ base44, user, sessionId: session.id, requestId: `${token}:attack`, contract, enemies: [], rollD20Fn: () => 1 });
    const afterReplay = combat ? await hashValue(await base44.asServiceRole.entities.CombatLog.get(combat.id)) : null;
    test('story attack replay is idempotent with no reroll or additional combat write', replay.body?.already_processed === true && replay.body?.writes === 0 && beforeReplay === afterReplay);

    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
    test('protected live state remains unchanged', protectedBefore === protectedAfter);
  } catch (error) {
    tests.push({ name: 'test execution', pass: false, detail: error.message });
  } finally {
    for (const [entity, id] of fixtures.reverse()) {
      try { await base44.asServiceRole.entities[entity].delete(id); } catch {}
    }
  }
  const passed = tests.filter((item) => item.pass).length;
  return Response.json({ function_version: VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: passed === tests.length, tests, writes_to_protected: 0 }, { status: passed === tests.length ? 200 : 500 });
}