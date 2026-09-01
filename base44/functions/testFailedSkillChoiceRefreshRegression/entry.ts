import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { acceptSequencedStoryPayload, commitStoryTransition, hydrateLatestStoryEntry, storyPayloadFromCommit } from '../../shared/story/storyTransition.ts';
import { failedChoiceTransitionRepairCore } from '../../shared/repairs/failedChoiceTransition.ts';
import { executeAskDungeonMasterCore } from '../../shared/askDungeonMasterCore.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';
import { commitNarratedStoryInventoryRecovery, containsExactRecoveryClaim, narrationMayPublishRecovery } from '../../shared/story/narratedStoryInventoryCommit.ts';

const choices = (prefix) => [1,2,3,4].map((n) => ({ text: `${prefix} option ${n}`, skill_check: n % 2 ? 'Athletics' : 'Perception', dc: 10 + n, risk_level: 'medium' }));

export default async function testFailedSkillChoiceRefreshRegression(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const cleanup = []; const results = []; const fixtures = [];
    const record = (name, pass) => results.push({ name, pass: !!pass });
    try {
      const character = await base44.entities.Character.create({ name: `ChoiceRefresh_${Date.now()}`, race: 'Human', class: 'Ranger', level: 1, hp_current: 10, hp_max: 10, inventory: [], is_active: false });
      record('idiomatic recovery language does not claim inventory', !containsExactRecoveryClaim('You recover your footing, balance, breath, composure, strength, and momentum from injury.'));
      record('existing carried documents do not claim inventory', !containsExactRecoveryClaim('You tighten your grip on the already-carried documents held in your satchel.'));
      record('exact unstructured seven-arrow award is rejected', containsExactRecoveryClaim('You recover 7 arrows from the mud.') && !narrationMayPublishRecovery({ narrative: 'You recover 7 arrows from the mud.', committed: false }));
      const oldChoices = choices('old'); const failedChoices = choices('failed-new'); const successChoices = choices('success-new');
      const failedReceipt = { id: 'dash-failed', request_id: 'dash-failed', skill: 'Athletics', dc: 14, raw_d20: 9, modifier_total: 4, final_total: 13, success: false, at: '2026-08-14T00:00:00.000Z', unified_story_skill_resolution: true };
      const session = await base44.entities.GameSession.create({ character_id: character.id, title: 'Choice refresh fixture', story_log: [{ timestamp: '2026-08-13T23:59:00.000Z', request_id: 'prior', player_choice: 'Wait', text: 'Prior scene', choices: oldChoices }], world_state: { __skill_check_receipts: [failedReceipt] }, is_active: false });
      fixtures.push(['GameSession',session.id],['Character',character.id]);
      const recoveryOnce = await commitNarratedStoryInventoryRecovery({ base44, sessionId: session.id, characterId: character.id, requestId: 'structured-seven-arrows', check: { success: true }, recovery: { type: 'arrows', quantity: 7 } });
      const recoveryReplay = await commitNarratedStoryInventoryRecovery({ base44, sessionId: session.id, characterId: character.id, requestId: 'structured-seven-arrows', check: { success: true }, recovery: { type: 'arrows', quantity: 7 } });
      const recoveredCharacter = await base44.asServiceRole.entities.Character.get(character.id);
      record('structured plus seven arrows commits once', recoveryOnce.body?.writes === 1 && recoveryReplay.body?.writes === 0 && recoveryReplay.body?.already_processed === true && recoveredCharacter.inventory?.find((item)=>item.name === 'Arrows')?.quantity === 7);
      const failedEntry = { timestamp: '2026-08-14T00:00:01.000Z', request_id: 'dash-failed', action: 'choice', player_choice: 'Dash rapidly through the ruins', text: 'The failed dash changes the scene.', choices: failedChoices, skill_check: failedReceipt };
      const failedCommit = commitStoryTransition(session.story_log, failedEntry, 'dash-failed');
      await base44.asServiceRole.entities.GameSession.update(session.id, { story_log: failedCommit.story_log });
      record('failed Dash appends one new entry', failedCommit.story_log.length === 2);
      record('failed Dash commits non-identical new choices', JSON.stringify(failedCommit.entry.choices) !== JSON.stringify(oldChoices));
      record('failed roll remains immutable without reroll', failedCommit.entry.skill_check.raw_d20 === 9 && failedCommit.entry.skill_check.final_total === 13 && failedCommit.entry.skill_check.success === false);
      const failedPayload = storyPayloadFromCommit(failedCommit); const failedUi = acceptSequencedStoryPayload(failedPayload, 1, 1);
      record('latest text and choices pair matches UI payload', failedUi.accepted && failedUi.hydration.text === failedEntry.text && JSON.stringify(failedUi.hydration.choices) === JSON.stringify(failedChoices));
      const reloaded = await base44.asServiceRole.entities.GameSession.get(session.id); const hydration = hydrateLatestStoryEntry(reloaded);
      record('reload hydrates same latest pair', hydration.text === failedEntry.text && JSON.stringify(hydration.choices) === JSON.stringify(failedChoices));
      const missing = acceptSequencedStoryPayload({ narrative: 'missing choices' }, 2, 2); const empty = acceptSequencedStoryPayload({ narrative: 'empty', choices: [] }, 3, 3);
      record('missing response choices clear rather than retain old', missing.accepted && missing.hydration.choices.length === 0);
      record('empty response choices clear rather than retain old', empty.accepted && empty.hydration.choices.length === 0);
      const late = acceptSequencedStoryPayload(failedPayload, 1, 2); record('late response cannot restore stale choices', !late.accepted);
      const successEntry = { ...failedEntry, timestamp: '2026-08-14T00:01:00.000Z', request_id: 'dash-success', player_choice: 'Dash succeeds', text: 'The successful dash changes the scene.', choices: successChoices, skill_check: { ...failedReceipt, request_id: 'dash-success', raw_d20: 18, final_total: 22, success: true } };
      const successCommit = commitStoryTransition(failedCommit.story_log, successEntry, 'dash-success'); record('successful check also refreshes choices', JSON.stringify(successCommit.entry.choices) === JSON.stringify(successChoices) && JSON.stringify(successChoices) !== JSON.stringify(failedChoices));
      const replay = commitStoryTransition(failedCommit.story_log, failedEntry, 'dash-failed'); record('replay is idempotent with no duplicate entry', replay.replayed && replay.story_log.length === failedCommit.story_log.length);
      record('failed transition has no duplicate request entry', failedCommit.story_log.filter((entry) => entry.request_id === 'dash-failed').length === 1);
      const beforeAsk = await base44.asServiceRole.entities.GameSession.get(session.id); const ask = await executeAskDungeonMasterCore(base44, { session_id: session.id, character_id: character.id, question: 'What can I see?', request_id: 'ask-fixture' }); const afterAsk = await base44.asServiceRole.entities.GameSession.get(session.id);
      record('Ask DM is read-only and does not advance choices', ask.body?.read_only === true && JSON.stringify(beforeAsk.story_log) === JSON.stringify(afterAsk.story_log));
      const wrongScope = { characterId: character.id, sessionId: 'missing', receiptKey: 'repair-fixture' }; const wrong = await failedChoiceTransitionRepairCore({ db: base44.asServiceRole, mode: 'discover', scope: wrongScope, generateChoices: async()=>choices('repair') });
      record('wrong Character Session linkage rejects 403', wrong.status === 403);
      const staleSession = await base44.entities.GameSession.create({ character_id: character.id, title: 'Repair fixture', story_log: [{ timestamp:'2026-08-13T23:58:00.000Z',request_id:'repair-prior',player_choice:'Wait',text:'Prior',choices:oldChoices }, { timestamp:'2026-08-14T00:00:01.000Z',request_id:'repair-dash',player_choice:'Dash rapidly',text:'Committed failed dash scene',choices:oldChoices,skill_check:{...failedReceipt,request_id:'repair-dash'} }], world_state:{__skill_check_receipts:[{...failedReceipt,request_id:'repair-dash',id:'repair-dash'}]}, is_active:false }); fixtures.push(['GameSession',staleSession.id]);
      const repairScope={characterId:character.id,sessionId:staleSession.id,receiptKey:'repair-fixture'}; const dry=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'dry_run',scope:repairScope,generateChoices:async()=>choices('repair')}); const applied=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'apply',scope:repairScope,expectedHashes:dry.body.hashes,replacementNarrative:dry.body.replacement_narrative,replacementChoices:dry.body.replacement_choices,proposalHash:dry.body.proposal_hash,generateChoices:async()=>choices('repair')}); const repairReplay=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'apply',scope:repairScope,expectedHashes:dry.body.hashes,replacementNarrative:dry.body.replacement_narrative,replacementChoices:dry.body.replacement_choices,proposalHash:dry.body.proposal_hash,generateChoices:async()=>choices('repair')});
      record('guarded stale repair preserves failed result', applied.body?.postconditions?.failed_result_preserved && applied.body?.postconditions?.character_and_inventory_unchanged);
      record('repair replay writes zero', repairReplay.body?.replayed && repairReplay.body?.writes === 0);
      const orphanReceipt={...failedReceipt,request_id:'orphan-dash',id:'orphan-dash'}; const orphanSession=await base44.entities.GameSession.create({character_id:character.id,title:'Orphan fixture',story_log:[{timestamp:'2026-08-13T23:59:00.000Z',request_id:'orphan-source',player_choice:'Wait',text:'The flooded path narrows.',choices:oldChoices.map((item,index)=>index===3?{...item,text:'Dash rapidly through the flooded path',skill_check:'Athletics',dc:14}:item)}],world_state:{__skill_check_receipts:[orphanReceipt]},is_active:false}); fixtures.push(['GameSession',orphanSession.id]);
      const orphanScope={characterId:character.id,sessionId:orphanSession.id,receiptKey:'orphan-repair-fixture',requestId:'orphan-dash',expected:{skill:'Athletics',dc:14,raw_d20:9,modifier_total:4,final_total:13,success:false}}; const orphanDry=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'dry_run',scope:orphanScope,generateChoices:async()=>({narrative:'Your failed dash leaves the flooded route blocked, forcing a different approach.',choices:choices('orphan-fresh')})}); const orphanApply=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'apply',scope:orphanScope,expectedHashes:orphanDry.body.hashes,replacementNarrative:orphanDry.body.replacement_narrative,replacementChoices:orphanDry.body.replacement_choices,proposalHash:orphanDry.body.proposal_hash,generateChoices:async()=>({})}); const orphanAfter=await base44.asServiceRole.entities.GameSession.get(orphanSession.id); const orphanReplay=await failedChoiceTransitionRepairCore({db:base44.asServiceRole,mode:'apply',scope:orphanScope,expectedHashes:orphanDry.body.hashes,replacementNarrative:orphanDry.body.replacement_narrative,replacementChoices:orphanDry.body.replacement_choices,proposalHash:orphanDry.body.proposal_hash,generateChoices:async()=>({})});
      record('orphan failed receipt appends one fresh paired entry', orphanApply.body?.writes===1 && orphanAfter.story_log.length===2 && orphanAfter.story_log.at(-1)?.request_id==='orphan-dash' && orphanAfter.story_log.at(-1)?.choices?.[0]?.text.includes('orphan-fresh'));
      record('orphan repair replay writes zero', orphanReplay.body?.replayed && orphanReplay.body?.writes===0);
    } finally {
      for(const [entity,id] of fixtures.reverse()){let absent=false;try{await base44.asServiceRole.entities[entity].delete(id);}catch{}try{absent=!(await base44.asServiceRole.entities[entity].get(id));}catch{absent=true;}cleanup.push({entity,id,absent});}
    }
    record('cleanup fixtures absent', cleanup.every((item)=>item.absent));
    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole)); record('protected live IDs unchanged', protectedBefore === protectedAfter);
    const passed=results.filter((item)=>item.pass).length; const allPass=passed===results.length;
    return Response.json({ function_version:'test-failed-skill-choice-refresh-v2.0.1',passed,failed:results.length-passed,total:results.length,all_pass:allPass,results,cleanup },{status:allPass?200:500});
  } catch(error){return Response.json({error:error.message||'Regression failed'},{status:500});}
}