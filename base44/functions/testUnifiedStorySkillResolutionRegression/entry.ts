import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { enforceStorySkillOutcomeInvariant } from '../../shared/story/storySkillCheck.ts';
import { resolveUnifiedStorySkillCheck } from '../../shared/story/unifiedStorySkillResolution.ts';
import { auditRepairPwtWaitHandoff } from '../../shared/repairs/pwtWaitHandoff.ts';
import { validateStorySkillCombatHandoff } from '../../shared/combat/startCombat.ts';
import { hashValue as hash, PROTECTED_DND_IDS as PROTECTED, readProtectedDndState as readProtected } from '../../shared/tests/liveProtection.ts';
import { pwtCondition, pwtModifier, pwtConcentration as concentration } from '../../shared/tests/pwtFixtures.ts';

export default async function testUnifiedStorySkillResolutionRegression(req) {
  const fixtures=[]; const cleanup=[]; const results=[];
  try {
    const base44=createClientFromRequest(req); const db=base44.asServiceRole; const user=await base44.auth.me(); await req.json().catch(()=>({}));
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const protectedBefore=await hash(await readProtected(db)); const token=`UnifiedStoryQA_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const make=async(label,{broken=false,expired=false,duplicate=false}={})=>{
      const character=await base44.entities.Character.create({name:`${token}_${label}`,race:'Human',class:'Ranger',level:5,strength:14,dexterity:19,proficiency_bonus:3,skills:{Stealth:'proficient',Athletics:'proficient'},hp_max:44,hp_current:27,xp:0,inventory:[],conditions:[],active_modifiers:[],is_active:false});
      const modifiers=[pwtModifier(character.id),...(duplicate?[pwtModifier(character.id,{id:`duplicate_${character.id}`})]:[])];
      await db.entities.Character.update(character.id,{conditions:[pwtCondition(character.id)],active_modifiers:modifiers});
      const session=await db.entities.GameSession.create({character_id:character.id,title:label,story_log:[],world_state:{world_clock_timestamp:expired?'2026-08-10T03:00:00.000Z':'2026-08-08T20:51:07.745Z',active_concentration:concentration(character.id,broken?{broken:true}:{})},in_combat:false,combat_state:{},is_active:false});
      fixtures.push({character:character.id,session:session.id}); return {character:await db.entities.Character.get(character.id),session};
    };
    const resolve=async(fixture,id,skill,dc,raw)=>resolveUnifiedStorySkillCheck({db,user,payload:{session_id:fixture.session.id,character_id:fixture.character.id,request_id:`${token}:${id}`,skill,dc,raw_d20:raw,all_rolls:[raw]}});

    const generated=await make('generated'); const generatedResult=await resolve(generated,'generated','Stealth',18,8);
    results.push({name:'generated choice Stealth uses raw8 plus7 plus10 for total25',pass:generatedResult.status===200&&generatedResult.body.modifier===17&&generatedResult.body.final===25&&generatedResult.body.success});
    const wait=await make('wait'); const waitResult=await resolve(wait,'wait','Stealth',14,6);
    results.push({name:'free-text wait Stealth uses raw6 plus7 plus10 for total23',pass:waitResult.status===200&&waitResult.body.final===23&&waitResult.body.success});
    const waitBranch=enforceStorySkillOutcomeInvariant({narrative:'Detected',combat_trigger:true,enemies:[{name:'Void-Stalker'}],condition_update:{target:'player',add:'Exposed'}},'wait while I remain hidden and observe',waitResult.body);
    results.push({name:'display receipt narrative condition and handoff consume one immutable resolution',pass:waitBranch.ok&&waitBranch.result.authoritative_skill_check===waitResult.body.receipt&&waitBranch.result.skill_display.includes('d20 6 + modifier 17 = 23')&&waitBranch.result.condition_update.add==='Stealthed'&&waitBranch.result.combat_trigger===false&&!waitBranch.result.combat_handoff});
    results.push({name:'paused PWT applies exactly once',pass:waitResult.body.breakdown.pwt_active&&waitResult.body.breakdown.components.filter((part)=>part.source==='Pass without Trace').length===1});
    const athletics=await resolve(wait,'athletics','Athletics',12,7);
    results.push({name:'non-Stealth skill is unaffected by PWT',pass:athletics.status===200&&athletics.body.modifier===5&&athletics.body.final===12&&athletics.body.breakdown.effect_bonus===0});
    const expired=await make('expired',{expired:true}); const expiredResult=await resolve(expired,'expired','Stealth',14,6);
    const broken=await make('broken',{broken:true}); const brokenResult=await resolve(broken,'broken','Stealth',14,6);
    results.push({name:'expired and broken concentration exclude PWT',pass:expiredResult.body.modifier===7&&brokenResult.body.modifier===7&&!expiredResult.body.breakdown.pwt_active&&!brokenResult.body.breakdown.pwt_active});
    const duplicate=await make('duplicate',{duplicate:true}); const duplicateResult=await resolve(duplicate,'duplicate','Stealth',14,6);
    results.push({name:'malformed ambiguous PWT modifiers fail closed',pass:duplicateResult.status===409&&duplicateResult.body.writes===0&&duplicateResult.body.breakdown?.ambiguity===true});
    results.push({name:'successful concealment produces no combat or Exposed state',pass:waitBranch.result.combat_trigger===false&&waitBranch.result.enemies.length===0&&waitBranch.result.condition_update.add==='Stealthed'&&waitBranch.result.condition_update.remove.includes('Exposed')});
    const plain=await make('plain',{broken:true}); const failure=await resolve(plain,'failure','Stealth',14,6); const failureBranch=enforceStorySkillOutcomeInvariant({narrative:'Detected',combat_trigger:true,enemies:[{name:'Scout'}],condition_update:{target:'player',add:'Exposed'}},'cross the open clearing',failure.body);
    const persistedFailureSession=await db.entities.GameSession.get(plain.session.id); const validHandoff=validateStorySkillCombatHandoff(persistedFailureSession,failure.body.receipt.request_id,failureBranch.result.combat_handoff); const invalidHandoff=validateStorySkillCombatHandoff(persistedFailureSession,failure.body.receipt.request_id,{resolution_id:'wrong',skill_check:failure.body.receipt});
    results.push({name:'failure without PWT creates combat only from same resolution object',pass:failure.body.success===false&&failureBranch.ok&&failureBranch.result.combat_trigger===true&&failureBranch.result.combat_handoff.skill_check===failure.body.receipt&&failureBranch.result.authoritative_skill_check===failure.body.receipt&&validHandoff.ok&&!invalidHandoff.ok});
    const replay=await resolveUnifiedStorySkillCheck({db,user,payload:{session_id:wait.session.id,character_id:wait.character.id,request_id:`${token}:wait`,skill:'Stealth',dc:14,raw_d20:20,all_rolls:[20]}});
    results.push({name:'idempotent request replay returns original roll with zero writes',pass:replay.status===200&&replay.body.already_processed&&replay.body.writes===0&&replay.body.raw===6&&replay.body.final===23});
    const mismatch=await resolveUnifiedStorySkillCheck({db,user,payload:{session_id:wait.session.id,character_id:generated.character.id,request_id:`${token}:mismatch`,skill:'Stealth',dc:14,raw_d20:6}});
    results.push({name:'Character Session mismatch returns 403',pass:mismatch.status===403&&mismatch.body.writes===0});

    const previousAt='2026-08-11T21:06:49.407Z'; const targetAt='2026-08-11T22:03:47.416Z'; const exposedAt='2026-08-11T22:03:47.728Z'; const previousRepairId=`${token}:prior-repair`;
    await db.entities.Character.update(wait.character.id,{xp:12450,spell_slots:{level_1:1,level_2:1},inventory:[{name:'Arrows',quantity:13},{name:'Dagger',quantity:2}],conditions:[pwtCondition(wait.character.id),{name:'Exposed',source:'story',duration:'combat',applied_at:exposedAt}]});
    const priorReceipt={...generatedResult.body.receipt,repair_request_id:previousRepairId};
    const targetRequest=`${token}:auditor-action`;
    const combat=await db.entities.CombatLog.create({session_id:wait.session.id,character_id:wait.character.id,round:1,combatants:[{id:'void',name:'Void-Stalker',type:'enemy',hp_current:20,hp_max:20,is_conscious:true},{id:wait.character.id,name:wait.character.name,type:'player',hp_current:27,hp_max:44,is_conscious:true},{id:'void-reinforcement',name:'Void-Stalker Reinforcement',type:'enemy',hp_current:20,hp_max:20,is_conscious:true}],current_turn_index:0,log_entries:[{round:1,text:'Combat begins!'}],world_state:{actions_used_this_turn:0,bonus_action_used:false,reaction_used:false,__receipts:[]},is_active:true,result:'ongoing',xp_earned:0,xp_awarded:false});
    const waitFixtureRecord=fixtures.find((entry)=>entry.character===wait.character.id); if(waitFixtureRecord) waitFixtureRecord.combat=combat.id;
    await db.entities.GameSession.update(wait.session.id,{in_combat:true,combat_state:{combat_id:combat.id},story_log:[{timestamp:previousAt,request_id:`${token}:prior`,player_choice:'Hide',text:'Hidden',choices:[],skill_check:priorReceipt},{timestamp:targetAt,request_id:targetRequest,player_choice:'wait while I remain hidden [Skill Check: Stealth DC14 — FAILURE (rolled 13)]',text:'Detected',choices:[{text:'Fight'}]}],world_state:{...wait.session.world_state,__skill_check_receipts:[],__pwt_hide_handoff_repairs:[{request_id:previousRepairId}],active_concentration:concentration(wait.character.id)}});
    const storedCombat=await db.entities.CombatLog.get(combat.id); const auditorContract={characterId:wait.character.id,sessionId:wait.session.id,combatId:combat.id,combatCreatedAt:storedCombat.created_date,storyAt:targetAt,exposedAt,previousStoryAt:previousAt,previousRepairId,expectedHp:27,expectedXp:12450}; const auditorScope={characterId:wait.character.id,sessionId:wait.session.id,combatId:combat.id}; const auditorId=`${token}:auditor-repair`;
    const auditorDry=await auditRepairPwtWaitHandoff({db,scope:auditorScope,requestId:auditorId,mode:'dry_run',contract:auditorContract});
    results.push({name:'second incident auditor derives raw6 only from unique total13 evidence',pass:auditorDry.status===200&&auditorDry.body.failed_guards.length===0&&auditorDry.body.evidence.arithmetic==='13-7=6'&&auditorDry.body.evidence.receipt_candidates.length===0});
    const auditorApply=await auditRepairPwtWaitHandoff({db,scope:auditorScope,requestId:auditorId,mode:'apply',expectedHashes:auditorDry.body.protected_hashes,contract:auditorContract}); const repairedChar=await db.entities.Character.get(wait.character.id); const repairedSession=await db.entities.GameSession.get(wait.session.id);
    results.push({name:'second incident repair preserves resources and restores one Stealthed without combat',pass:auditorApply.status===200&&auditorApply.body.hp_preserved&&repairedChar.hp_current===27&&repairedChar.xp===12450&&repairedChar.inventory.find((item)=>item.name==='Arrows').quantity===13&&repairedChar.inventory.find((item)=>item.name==='Dagger').quantity===2&&repairedChar.conditions.filter((entry)=>entry.name==='Stealthed').length===1&&!repairedChar.conditions.some((entry)=>entry.name==='Exposed')&&!repairedSession.in_combat&&repairedSession.story_log[0].skill_check.repair_request_id===previousRepairId});
    const auditorReplay=await auditRepairPwtWaitHandoff({db,scope:auditorScope,requestId:auditorId,mode:'apply',contract:auditorContract});
    results.push({name:'second incident repair replay writes zero',pass:auditorReplay.status===200&&auditorReplay.body.already_processed&&auditorReplay.body.writes===0});
    results.push({name:'protected live IDs remain unchanged',pass:protectedBefore===await hash(await readProtected(db))});
  } catch(error){results.push({name:'test execution',pass:false,detail:error.message});}
  finally{
    const base44=createClientFromRequest(req); const db=base44.asServiceRole;
    for(const fixture of fixtures.reverse()) for(const [entity,id] of [['CombatLog',fixture.combat],['GameSession',fixture.session],['Character',fixture.character]]){if(!id)continue;let deleted=false,verified_absent=false;try{await db.entities[entity].delete(id);deleted=true;}catch{deleted=true;}try{verified_absent=!(await db.entities[entity].get(id));}catch{verified_absent=true;}cleanup.push({entity,id,deleted,verified_absent});}
  }
  const passed=results.filter((result)=>result.pass).length; const cleanupPassed=cleanup.every((entry)=>entry.deleted&&entry.verified_absent); const allPass=passed===results.length&&cleanupPassed;
  return Response.json({deployment_id:'unified-story-skill-resolution-v1',passed,failed:results.length-passed,total:results.length,all_pass:allPass,results,cleanup,cleanup_passed:cleanupPassed,live_state:{protected_ids:PROTECTED,unchanged:results.some((result)=>result.name.startsWith('protected live')&&result.pass)}},{status:allPass?200:500});
}