import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildSkillCheckReceipt, resolveAuthoritativeSkillModifier } from '../../shared/skills/authoritativeSkillModifier.ts';
import { auditRepairLatestPwtStealth } from '../../shared/repairs/latestPwtStealthResolution.ts';
import { concealmentAttributions, consumeBreakOnAttackConditions, getAttackConcealment } from '../../shared/combat/conditions.ts';
import { pwtCondition, pwtModifier, pwtConcentration as concentration } from '../../shared/tests/pwtFixtures.ts';

const LIVE_IDS = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const storyLog = (receipt, success = false) => Array.from({ length: 60 }, (_, index) => index === 59 ? { timestamp: '2026-08-10T18:49:58.409Z', request_id: 'fixture-story-action', action: 'choice', player_choice: `Attempt the ritual strike. [Skill Check: Stealth DC16 — ${success ? 'SUCCESS' : 'FAILURE'}]`, text: 'The ritual continues.', choices: [], ...(receipt ? { skill_check: receipt } : {}) } : { timestamp: `fixture-${index}`, text: `Entry ${index}`, choices: [] });

export default async function testPausedPwtStealthModifierRegression(req) {
  const fixtures = []; const cleanup = []; const results = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me(); await req.json().catch(() => ({}));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const liveBefore = await Promise.all(LIVE_IDS.map((id, index) => base44.asServiceRole.entities[index ? 'GameSession' : 'Character'].get(id))); const liveHash = await hash(liveBefore);
    const token = `PausedPwtQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const make = async (label, options = {}) => {
      const character = await base44.entities.Character.create({ name: `${token}_${label}`, race: 'Human', class: 'Ranger', level: 5, dexterity: 19, proficiency_bonus: 3, skills: { Stealth: 'proficient' }, hp_max: 30, hp_current: 30, xp: 0, inventory: [], gold: 0, silver: 0, copper: 0, conditions: [], active_modifiers: [], is_active: false });
      const conditions = options.conditions || [pwtCondition(character.id), ...(options.stealthed ? [{ name: 'Stealthed', source: 'story', duration: 'scene', applied_at: '2026-08-10T18:49:58.866Z' }] : [])];
      const modifiers = options.modifiers || [pwtModifier(character.id)];
      await base44.asServiceRole.entities.Character.update(character.id, { conditions, active_modifiers: modifiers });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: label, story_log: [], world_state: { world_clock_timestamp: options.gameClock || '2026-08-08T20:51:07.745Z', active_concentration: concentration(character.id, options.concentration || {}) }, is_active: false });
      const current = await base44.asServiceRole.entities.Character.get(character.id);
      const breakdown = resolveAuthoritativeSkillModifier({ character: current, session, skill: 'Stealth' });
      const receipt = options.raw == null ? null : buildSkillCheckReceipt({ requestId: 'fixture-story-action', raw: options.raw, allRolls: [options.raw], dc: 16, success: options.recordedSuccess ?? false, breakdown: { ...breakdown, total: 7, effect_bonus: 0, pwt_active: false }, advantageSources: [] });
      await base44.asServiceRole.entities.GameSession.update(session.id, { story_log: storyLog(receipt, options.recordedSuccess), world_state: { ...session.world_state, __skill_check_receipts: receipt ? [{ ...receipt, story_index: 59 }] : [] } });
      fixtures.push({ character: character.id, session: session.id });
      return { character: await base44.asServiceRole.entities.Character.get(character.id), session: await base44.asServiceRole.entities.GameSession.get(session.id), breakdown };
    };

    const paused = await make('paused', { raw: 4, stealthed: false });
    results.push({ name: 'paused resumed PWT remains active despite elapsed wall clock', pass: paused.breakdown.ok && paused.breakdown.pwt_active && paused.breakdown.effect_bonus === 10 });
    results.push({ name: 'base plus7 and PWT plus10 resolve total plus17', pass: paused.breakdown.base_skill === 7 && paused.breakdown.total === 17 && paused.breakdown.components.some((component) => component.source === 'Pass without Trace' && component.value === 10) });
    results.push({ name: 'canonical condition modifier and session concentration link exactly', pass: paused.breakdown.concentration_linked === true });
    results.push({ name: 'PWT bonus appears exactly once', pass: paused.breakdown.components.filter((component) => component.source === 'Pass without Trace').length === 1 });
    const expired = await make('game-expired', { gameClock: '2026-08-10T03:10:46.874Z' });
    results.push({ name: 'game-time expired effect is excluded', pass: expired.breakdown.ok && !expired.breakdown.pwt_active && expired.breakdown.total === 7 });
    const broken = await make('concentration-broken', { concentration: { broken: true } });
    results.push({ name: 'broken concentration excludes PWT', pass: broken.breakdown.ok && !broken.breakdown.pwt_active && broken.breakdown.total === 7 });
    const duplicate = await make('duplicate', { modifiers: [] });
    await base44.asServiceRole.entities.Character.update(duplicate.character.id, { active_modifiers: [pwtModifier(duplicate.character.id), pwtModifier(duplicate.character.id, { id: 'duplicate' })] });
    const duplicateBreakdown = resolveAuthoritativeSkillModifier({ character: await base44.asServiceRole.entities.Character.get(duplicate.character.id), session: duplicate.session, skill: 'Stealth' });
    results.push({ name: 'ambiguous duplicate plus10 effects fail closed', pass: !duplicateBreakdown.ok && duplicateBreakdown.ambiguity === true });
    const wrong = await make('wrong-link');
    const wrongBreakdown = resolveAuthoritativeSkillModifier({ character: paused.character, session: wrong.session, skill: 'Stealth' });
    results.push({ name: 'wrong Character Session linkage rejects', pass: !wrongBreakdown.ok });

    const scope = { characterId: paused.character.id, sessionId: paused.session.id };
    const beforeRepair = { character: await base44.asServiceRole.entities.Character.get(scope.characterId), session: await base44.asServiceRole.entities.GameSession.get(scope.sessionId) };
    const repairDryRun = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'dry_run' });
    const repaired = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply', preconditionHashes: repairDryRun.body.protected_hashes });
    const afterRepair = { character: await base44.asServiceRole.entities.Character.get(scope.characterId), session: await base44.asServiceRole.entities.GameSession.get(scope.sessionId) };
    results.push({ name: 'original d20 outcome correction reuses four and changes failure to success at total21', pass: repaired.status === 200 && repaired.body.original_d20_reused === 4 && repaired.body.outcome_changed === true && afterRepair.session.story_log[59].skill_check.raw_d20 === 4 && afterRepair.session.story_log[59].skill_check.final_total === 21 && afterRepair.session.story_log[59].skill_check.success === true });
    results.push({ name: 'correction performs no reroll double story attack damage or unrelated mechanics mutation', pass: afterRepair.session.story_log.length === 60 && afterRepair.session.story_log[59].skill_check.all_rolls.length === 1 && repaired.body.writes === 2 && beforeRepair.character.hp_current === afterRepair.character.hp_current && beforeRepair.character.inventory.length === afterRepair.character.inventory.length && beforeRepair.character.xp === afterRepair.character.xp });
    const replay = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope, requestId: `${token}:repair`, mode: 'apply' });
    results.push({ name: 'repair request replay writes zero', pass: replay.status === 200 && replay.body.already_processed === true && replay.body.writes === 0 });

    const missing = await make('missing-d20-certain-success', { stealthed: true });
    const missingScope = { characterId: missing.character.id, sessionId: missing.session.id };
    const missingBefore = { character: await base44.asServiceRole.entities.Character.get(missingScope.characterId), session: await base44.asServiceRole.entities.GameSession.get(missingScope.sessionId) };
    const missingDryRun = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: missingScope, requestId: `${token}:missing-d20`, mode: 'dry_run' });
    const missingRepair = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: missingScope, requestId: `${token}:missing-d20`, mode: 'apply', preconditionHashes: missingDryRun.body.protected_hashes });
    const missingAfter = { character: await base44.asServiceRole.entities.Character.get(missingScope.characterId), session: await base44.asServiceRole.entities.GameSession.get(missingScope.sessionId) };
    const missingReceipt = missingAfter.session.story_log[59].skill_check;
    results.push({ name: 'missing d20 repairs only when minimum roll proves deterministic success', pass: missingDryRun.body.guards.original_d20_available === false && missingDryRun.body.guards.deterministic_success_without_d20 === true && missingRepair.status === 200 && missingReceipt.success === true });
    results.push({ name: 'deterministic legacy repair fabricates no d20 or exact total', pass: missingReceipt.raw_d20 === null && missingReceipt.final_total === null && missingReceipt.all_rolls.length === 0 });
    results.push({ name: 'deterministic legacy receipt stores minimum total and plus17 attribution', pass: missingReceipt.minimum_total === 18 && missingReceipt.modifier_total === 17 && missingReceipt.modifier_breakdown.base_skill === 7 && missingReceipt.modifier_breakdown.effect_bonus === 10 && /original d20 was not persisted/i.test(missingReceipt.legacy_note) });
    results.push({ name: 'deterministic repair preserves one story entry and changes only its outcome marker', pass: missingAfter.session.story_log.length === missingBefore.session.story_log.length && /SUCCESS/.test(missingAfter.session.story_log[59].player_choice) && !/FAILURE/.test(missingAfter.session.story_log[59].player_choice) && missingAfter.session.story_log[59].text === missingBefore.session.story_log[59].text });
    results.push({ name: 'deterministic repair preserves exactly one existing Stealthed condition', pass: missingAfter.character.conditions.filter((condition) => condition.name === 'Stealthed').length === 1 && missingRepair.body.writes === 1 });
    results.push({ name: 'deterministic repair causes no attack damage or unrelated character mutation', pass: missingDryRun.body.attack_or_damage_already_occurred === false && missingBefore.character.hp_current === missingAfter.character.hp_current && JSON.stringify(missingBefore.character.inventory) === JSON.stringify(missingAfter.character.inventory) && missingBefore.character.xp === missingAfter.character.xp });
    const missingReplay = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: missingScope, requestId: `${token}:missing-d20`, mode: 'apply' });
    results.push({ name: 'deterministic missing-d20 repair replay writes zero', pass: missingReplay.status === 200 && missingReplay.body.already_processed === true && missingReplay.body.writes === 0 });

    const already = await make('already-success', { raw: 10, recordedSuccess: true, stealthed: true });
    const alreadyScope = { characterId: already.character.id, sessionId: already.session.id };
    const alreadyDryRun = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: alreadyScope, requestId: `${token}:metadata`, mode: 'dry_run' });
    const alreadyResult = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: alreadyScope, requestId: `${token}:metadata`, mode: 'apply', preconditionHashes: alreadyDryRun.body.protected_hashes });
    const alreadyAfter = await base44.asServiceRole.entities.Character.get(already.character.id);
    results.push({ name: 'already successful check receives metadata-only repair and keeps Stealthed', pass: alreadyResult.status === 200 && alreadyResult.body.writes === 1 && alreadyResult.body.outcome_changed === false && alreadyAfter.conditions.some((condition) => condition.name === 'Stealthed') });

    const stealthConditions = [{ name: 'Alert' }, { name: 'Stealthed', source: 'story', duration: 'scene' }];
    const concealment = getAttackConcealment(stealthConditions); const attributions = concealmentAttributions(stealthConditions); const revealed = consumeBreakOnAttackConditions(stealthConditions);
    results.push({ name: 'attack from Stealthed grants one attributed advantage source', pass: concealment.length === 1 && attributions.length === 1 && attributions[0] === 'Attacking from Stealthed/concealed' });
    results.push({ name: 'attack reveal consumes Stealthed while preserving unrelated conditions', pass: revealed.length === 1 && revealed[0].name === 'Alert' });

    const liveAfter = await Promise.all(LIVE_IDS.map((id, index) => base44.asServiceRole.entities[index ? 'GameSession' : 'Character'].get(id)));
    results.push({ name: 'protected live Character and GameSession remain unchanged', pass: liveHash === await hash(liveAfter) });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false, verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const passed = results.filter((result) => result.pass).length; const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); const allPass = passed === results.length && cleanupPassed;
  return Response.json({ deployment_id: 'paused-pwt-stealth-resolution-v1', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_passed: cleanupPassed, live_state: { protected_ids: LIVE_IDS, unchanged: results.some((result) => result.name.startsWith('protected live') && result.pass) } }, { status: allPass ? 200 : 500 });
}