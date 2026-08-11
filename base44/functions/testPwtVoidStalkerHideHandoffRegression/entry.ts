import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyAuthoritativeStorySkillOutcome, resolveStorySkillCheck } from '../../shared/story/storySkillCheck.ts';
import { auditRepairPwtVoidStalkerHideHandoff } from '../../shared/repairs/pwtVoidStalkerHideHandoff.ts';
import { hashValue as hash, PROTECTED_DND_IDS as PROTECTED, readProtectedDndState as readProtected } from '../../shared/tests/liveProtection.ts';
import { handlePwtHideAuditRequest } from '../../shared/repairs/pwtHideAuditEndpoint.ts';
const pwtCondition = (id) => ({ id:`cond_${id}`,name:'pass without trace',source:'Pass without Trace',target_id:id,caster_id:id,concentration:true,applied_at:'2026-08-11T20:00:00.000Z',expires_at:'2026-08-11T22:00:00.000Z' });
const pwtModifier = (id) => ({ id:`mod_${id}`,source:'Pass without Trace',effect:'skill_bonus',skill:'Stealth',bonus:10,character_id:id,target_id:id,caster_id:id,concentration:true,applied_at:'2026-08-11T20:00:00.000Z',expires_at:'2026-08-11T22:00:00.000Z' });
const concentration = (id) => ({ spell_name:'Pass without Trace',character_id:id,target_id:id,caster_id:id,concentration:true,request_id:`cast_${id}`,applied_at:'2026-08-11T20:00:00.000Z',expires_at:'2026-08-11T22:00:00.000Z' });

export default async function testPwtVoidStalkerHideHandoffRegression(req) {
  const fixtures=[]; const cleanup=[]; const results=[];
  try {
    const base44=createClientFromRequest(req); const db=base44.asServiceRole; const user=await base44.auth.me(); await req.json().catch(()=>({}));
    const protectedBefore=await hash(await readProtected(db)); const token=`VoidHideQA_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const canonicalResponse=await handlePwtHideAuditRequest({base44,user,rawBody:{mode:'dry_run',character_id:PROTECTED[0],session_id:PROTECTED[1],combat_log_id:PROTECTED[2],request_id:`${token}:canonical-contract`}}); const canonicalBody=await canonicalResponse.json();
    results.push({name:'deployed-style canonical snake_case payload reaches guard evaluation',pass:[200,409].includes(canonicalResponse.status)&&canonicalBody.writes===0&&!canonicalBody.expected_fields,detail:{status:canonicalResponse.status,failed_guards:canonicalBody.failed_guards||[],error:canonicalBody.error||null}});
    const make=async(label,{ambiguous=false,postAction=false,mismatch=false,noReceipt=false,hpProven=true,xp=100}={})=>{
      const character=await db.entities.Character.create({name:`${token}_${label}`,race:'Human',class:'Ranger',level:5,dexterity:19,proficiency_bonus:3,skills:{Stealth:'proficient'},hp_max:44,hp_current:30,xp,inventory:[{name:'Dagger',quantity:2}],gold:5,silver:6,copper:7,spell_slots:{level_1:1},conditions:[],active_modifiers:[],is_active:false});
      await db.entities.Character.update(character.id,{conditions:[pwtCondition(character.id)],active_modifiers:[pwtModifier(character.id)]});
      const storyAt='2026-08-11T21:06:49.407Z'; const actionId=`${token}:${label}:action`;
      const session=await db.entities.GameSession.create({character_id:character.id,title:label,story_log:[],world_state:{world_clock_timestamp:'2026-08-11T20:30:00.000Z',active_concentration:concentration(character.id),__skill_check_receipts:[]},in_combat:false,combat_state:{},is_active:false});
      const fresh=await db.entities.Character.get(character.id); const canonical=resolveStorySkillCheck({character:fresh,session,skill:'Stealth',dc:18,requestId:actionId,raw:8,allRolls:[8],at:storyAt});
      const bad={...canonical.receipt,modifier_total:7,final_total:15,success:false,modifier_breakdown:{...canonical.breakdown,effect_bonus:0,total:7,pwt_active:false,concentration_linked:false}};
      const story={timestamp:storyAt,request_id:actionId,action:'choice',player_choice:'Hide from the Void-Stalker [Skill Check: Stealth DC18 — FAILURE (rolled 15)]',text:'The Void-Stalker spots you and combat begins.',choices:[{text:'Fight'}],...(!noReceipt?{skill_check:bad}:{})};
      await db.entities.Character.update(character.id,{hp_current:27,conditions:[pwtCondition(character.id),{name:'Engaged',source:'story',duration:'combat',applied_at:'2026-08-11T21:06:49.746Z'}]});
      const combat=await db.entities.CombatLog.create({session_id:session.id,character_id:character.id,round:1,combatants:[{id:character.id,name:fresh.name,type:'player',hp_current:27,hp_max:44,is_conscious:true},{id:'void',name:'Void-Stalker',type:'enemy',hp_current:20,hp_max:20,is_conscious:true}],initiative_order:[{id:character.id,name:fresh.name,initiative:20},{id:'void',name:'Void-Stalker',initiative:10}],current_turn_index:0,log_entries:[{round:1,text:'Combat begins!'}],world_state:{actions_used_this_turn:0,bonus_action_used:false,reaction_used:false,__receipts:postAction?[{request_id:'attack',action:'player_attack'}]:[]},is_active:true,result:'ongoing',xp_earned:0,xp_awarded:false});
      const before={hp_current:30,xp,inventory_hash:await hash(fresh.inventory||[]),spell_slots_hash:await hash(fresh.spell_slots||{}),abilities_hash:await hash(fresh.long_rest_abilities||{}),currency_hash:await hash({gold:5,silver:6,copper:7}),conditions_hash:await hash([pwtCondition(character.id)])};
      const receipts=noReceipt?[]:ambiguous?[bad,{...bad,id:`${bad.id}:duplicate`}]:[bad];
      const handoffs=hpProven?[{combat_id:combat.id,action_request_id:actionId,pre_event_snapshot:before,failed_branch:{hp_delta:-3}}]:[];
      await db.entities.GameSession.update(session.id,{in_combat:true,combat_state:{combat_id:combat.id},story_log:[story],world_state:{...session.world_state,__skill_check_receipts:receipts,__story_handoff_receipts:handoffs}});
      let other=null; if(mismatch) other=await db.entities.GameSession.create({character_id:'wrong-character',title:'mismatch',story_log:[],world_state:{},is_active:false});
      fixtures.push({character:character.id,session:session.id,combat:combat.id,...(other?{other:other.id}:{})});
      const storedCombat=await db.entities.CombatLog.get(combat.id);
      return {character:await db.entities.Character.get(character.id),session:await db.entities.GameSession.get(session.id),combat:storedCombat,other:other?.id||null,canonical,contract:{characterId:character.id,sessionId:session.id,combatId:combat.id,combatCreatedAt:storedCombat.created_date,storyAt,storyIndex:0,engagedAt:'2026-08-11T21:06:49.746Z',expectedXp:xp,ownerReportedRaw:8,legacyDisplayFallback:true}};
    };

    const fixture=await make('valid');
    results.push({name:'raw8 plus7 base plus10 PWT resolves 25 SUCCESS against DC18',pass:fixture.canonical.ok&&fixture.canonical.modifier===17&&fixture.canonical.final===25&&fixture.canonical.success});
    results.push({name:'paused PWT applies exactly once through unique concentration link',pass:fixture.canonical.breakdown.pwt_active&&fixture.canonical.breakdown.components.filter(v=>v.source==='Pass without Trace').length===1});
    const branch=applyAuthoritativeStorySkillOutcome({narrative:'failure',combat_trigger:true,enemies:[{name:'Void-Stalker'}],hp_change:-3},'Hide from the Void-Stalker',fixture.canonical);
    results.push({name:'display receipt and branch consume one resolved object',pass:branch.authoritative_skill_check===fixture.canonical.receipt&&branch.authoritative_skill_check.final_total===25});
    results.push({name:'successful authoritative Hide starts no combat and adds Stealthed outcome',pass:branch.combat_trigger===false&&branch.enemies.length===0&&branch.condition_update.add==='Stealthed'&&branch.hp_change===0});
    const scope={characterId:fixture.character.id,sessionId:fixture.session.id,combatId:fixture.combat.id}; const repairId=`${token}:repair`;
    const dry=await auditRepairPwtVoidStalkerHideHandoff({db,scope,requestId:repairId,mode:'dry_run',contract:fixture.contract});
    const applied=await auditRepairPwtVoidStalkerHideHandoff({db,scope,requestId:repairId,mode:'apply',expectedHashes:dry.body.protected_hashes,contract:fixture.contract});
    const afterChar=await db.entities.Character.get(scope.characterId); const afterSession=await db.entities.GameSession.get(scope.sessionId); let combatGone=false; try{combatGone=!(await db.entities.CombatLog.get(scope.combatId));}catch{combatGone=true;}
    results.push({name:'safe correction reuses original d20 with no reroll',pass:applied.status===200&&applied.body.original_d20_reused===8&&applied.body.corrected_receipt?.all_rolls?.length===1,detail:{dry_failed:dry.body.failed_guards,apply_status:applied.status,apply_failed:applied.body.failed_guards}});
    results.push({name:'synthetic invalid handoff rolls back exact combat Engaged and proven three HP only',pass:combatGone&&!afterSession.in_combat&&afterChar.hp_current===30&&!afterChar.conditions.some(v=>v.name==='Engaged')&&afterChar.conditions.filter(v=>v.name==='Stealthed').length===1});
    results.push({name:'repair preserves inventory XP slots and currency without action or damage duplication',pass:JSON.stringify(afterChar.inventory)===JSON.stringify(fixture.character.inventory)&&afterChar.xp===fixture.character.xp&&JSON.stringify(afterChar.spell_slots)===JSON.stringify(fixture.character.spell_slots)&&afterChar.gold===fixture.character.gold});
    const replay=await auditRepairPwtVoidStalkerHideHandoff({db,scope,requestId:repairId,mode:'apply',contract:fixture.contract});
    results.push({name:'apply replay performs zero writes',pass:replay.status===200&&replay.body.already_processed&&replay.body.writes===0});

    const legacy=await make('legacy-no-receipt',{noReceipt:true,hpProven:false,xp:12450}); const legacyScope={characterId:legacy.character.id,sessionId:legacy.session.id,combatId:legacy.combat.id};
    const legacyBaseline=await hash({hp_current:legacy.character.hp_current,hp_max:legacy.character.hp_max,xp:legacy.character.xp,inventory:legacy.character.inventory,spell_slots:legacy.character.spell_slots,gold:legacy.character.gold,silver:legacy.character.silver,copper:legacy.character.copper,active_modifiers:legacy.character.active_modifiers});
    const legacyId=`${token}:legacy-repair`; const legacyDry=await auditRepairPwtVoidStalkerHideHandoff({db,scope:legacyScope,requestId:legacyId,mode:'dry_run',contract:legacy.contract});
    results.push({name:'exact no-receipt legacy display independently derives raw8 and reaches all guards',pass:legacyDry.status===200&&legacyDry.body.success&&legacyDry.body.failed_guards.length===0&&legacyDry.body.evidence.legacy_fallback.used&&legacyDry.body.evidence.legacy_fallback.arithmetic==='15-7=8'&&legacyDry.body.evidence.receipt_candidates.length===0});
    const legacyApply=await auditRepairPwtVoidStalkerHideHandoff({db,scope:legacyScope,requestId:legacyId,mode:'apply',expectedHashes:legacyDry.body.protected_hashes,contract:legacy.contract}); const legacyAfter=await db.entities.Character.get(legacy.character.id); const legacySession=await db.entities.GameSession.get(legacy.session.id);
    const legacyAfterHash=await hash({hp_current:legacyAfter.hp_current,hp_max:legacyAfter.hp_max,xp:legacyAfter.xp,inventory:legacyAfter.inventory,spell_slots:legacyAfter.spell_slots,gold:legacyAfter.gold,silver:legacyAfter.silver,copper:legacyAfter.copper,active_modifiers:legacyAfter.active_modifiers});
    results.push({name:'legacy correction preserves unproven HP27 and all protected resources',pass:legacyApply.status===200&&legacyApply.body.hp_restored===0&&legacyApply.body.hp_preserved===true&&legacyAfter.hp_current===27&&legacyAfterHash===legacyBaseline&&legacySession.story_log[0].skill_check?.legacy_display_derived_raw_d20===true});
    const legacyReplay=await auditRepairPwtVoidStalkerHideHandoff({db,scope:legacyScope,requestId:legacyId,mode:'apply',contract:legacy.contract});
    results.push({name:'legacy fallback apply replay writes zero',pass:legacyReplay.status===200&&legacyReplay.body.already_processed&&legacyReplay.body.writes===0});

    const ambiguous=await make('ambiguous',{ambiguous:true}); const ambBefore=await hash([ambiguous.character,ambiguous.session,ambiguous.combat]);
    const amb=await auditRepairPwtVoidStalkerHideHandoff({db,scope:{characterId:ambiguous.character.id,sessionId:ambiguous.session.id,combatId:ambiguous.combat.id},requestId:`${token}:amb`,mode:'apply',expectedHashes:{},contract:ambiguous.contract});
    const ambAfter=await hash([await db.entities.Character.get(ambiguous.character.id),await db.entities.GameSession.get(ambiguous.session.id),await db.entities.CombatLog.get(ambiguous.combat.id)]);
    results.push({name:'ambiguous receipt fails closed with zero writes',pass:amb.status===409&&amb.body.failed_guards.includes('unique_raw8_dc18_receipt')&&amb.body.writes===0&&ambBefore===ambAfter});
    const acted=await make('acted',{postAction:true}); const actedDry=await auditRepairPwtVoidStalkerHideHandoff({db,scope:{characterId:acted.character.id,sessionId:acted.session.id,combatId:acted.combat.id},requestId:`${token}:acted`,mode:'dry_run',contract:acted.contract});
    results.push({name:'post-combat player action blocks repair',pass:actedDry.body.failed_guards.includes('pristine_unadvanced_combat')});
    const mismatch=await make('mismatch',{mismatch:true}); const mismatchResult=await auditRepairPwtVoidStalkerHideHandoff({db,scope:{characterId:mismatch.character.id,sessionId:mismatch.other,combatId:mismatch.combat.id},requestId:`${token}:mismatch`,mode:'dry_run',contract:{...mismatch.contract,sessionId:mismatch.other}});
    results.push({name:'Character Session mismatch returns 403 and zero writes',pass:mismatchResult.status===403&&mismatchResult.body.writes===0});
    results.push({name:'all protected live IDs remain unchanged',pass:protectedBefore===await hash(await readProtected(db))});
  } catch(error){results.push({name:'test execution',pass:false,detail:error.message});}
  finally{
    const base44=createClientFromRequest(req); const db=base44.asServiceRole;
    for(const fixture of fixtures.reverse()) for(const [entity,id] of [['GameSession',fixture.other],['CombatLog',fixture.combat],['GameSession',fixture.session],['Character',fixture.character]]){if(!id)continue;let deleted=false,verified_absent=false;try{const present=await db.entities[entity].get(id);if(present){await db.entities[entity].delete(id);deleted=true;}else deleted=true;}catch{deleted=true;}try{verified_absent=!(await db.entities[entity].get(id));}catch{verified_absent=true;}cleanup.push({entity,id,deleted,verified_absent});}
  }
  const passed=results.filter(v=>v.pass).length; const cleanupPassed=cleanup.every(v=>v.deleted&&v.verified_absent); const allPass=passed===results.length&&cleanupPassed;
  return Response.json({deployment_id:'pwt-void-stalker-hide-handoff-v1',passed,failed:results.length-passed,total:results.length,all_pass:allPass,results,cleanup,cleanup_passed:cleanupPassed,cleanup_verified:cleanupPassed,live_state:{protected_ids:PROTECTED,unchanged:results.some(v=>v.name.startsWith('all protected')&&v.pass)}},{status:allPass?200:500});
}