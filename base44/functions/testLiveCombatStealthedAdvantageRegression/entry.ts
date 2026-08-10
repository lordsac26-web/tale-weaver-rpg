import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { executePlayerAttackCore } from '../../shared/combat/playerAttackCore.ts';
import { auditRepairMissedStealthedAttackCore } from '../../shared/repairs/missedStealthedAttack.ts';

const LIVE = ['6a7a24fa5fc6300afbbe2507','6a6825cd07a490fa70a46852','6a6825edd695bd65a4322256'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const stealth = { name: 'Stealthed', source: 'story', duration: 'scene' };
const pwt = { name: 'pass without trace', source: 'Pass without Trace', concentration: true };
const pwtMod = { id: 'fixture_pwt', source: 'Pass without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, concentration: true };
const weapon = { name: 'Longbow', damage_dice: '1d8', damage_type: 'piercing', type: 'ranged', properties: [], attack_bonus: 0, damage_bonus: 0 };
export default async function testLiveCombatStealthedAdvantageRegression(req) {
  const fixtures=[]; const cleanup=[]; const results=[];
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me(); await req.json().catch(()=>({}));
    if(!user||user.role!=='admin') return Response.json({error:'Admin access required'},{status:403});
    const before=await hash(await Promise.all([base44.asServiceRole.entities.CombatLog.get(LIVE[0]),base44.asServiceRole.entities.Character.get(LIVE[1]),base44.asServiceRole.entities.GameSession.get(LIVE[2])]));
    const make=async(label,{charConditions=[],combatConditions=[],ac=13,targetHp=40,pwtOnly=false,turn=0,defeated=false}={})=>{
      const token=`StealthAdvQA_${label}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const c=await base44.entities.Character.create({name:token,race:'Human',class:'Ranger',subclass:'Hunter',level:5,dexterity:18,strength:10,constitution:10,proficiency_bonus:3,fighting_style:'archery',features:['Extra Attack','Hunter’s Prey: Horde Breaker'],hp_max:30,hp_current:30,armor_class:15,conditions:pwtOnly?[pwt]:charConditions,active_modifiers:pwtOnly?[pwtMod]:[pwtMod],equipped:{weapon},inventory:[],is_active:false});
      const s=await base44.asServiceRole.entities.GameSession.create({character_id:c.id,title:token,in_combat:true,combat_state:{},is_active:false});
      const target={id:`${token}_target`,name:'Skeleton Reinforcement',type:'enemy',hp_current:defeated?0:targetHp,hp_max:targetHp,ac,is_conscious:!defeated,conditions:[]};
      const other={id:`${token}_other`,name:'Skeleton',type:'enemy',hp_current:20,hp_max:20,ac:13,is_conscious:true,conditions:[]};
      const third={id:`${token}_third`,name:'Skeleton',type:'enemy',hp_current:20,hp_max:20,ac:13,is_conscious:true,conditions:[]};
      const player={id:c.id,name:c.name,type:'player',hp_current:30,hp_max:30,ac:15,is_conscious:true,conditions:pwtOnly?[pwt]:combatConditions};
      const l=await base44.asServiceRole.entities.CombatLog.create({session_id:s.id,character_id:c.id,round:1,current_turn_index:turn,is_active:true,result:'ongoing',combatants:[player,target,other,third],initiative_order:[],log_entries:[],world_state:{actions_used_this_turn:0,concentration_spell:'Pass without Trace',concentration_caster:c.name}});
      await base44.asServiceRole.entities.GameSession.update(s.id,{combat_state:{combat_id:l.id}}); fixtures.push(['CombatLog',l.id],['GameSession',s.id],['Character',c.id]); return {c,s,l,target,other};
    };
    const invoke=async(f,requestId,randoms)=>{let i=0,calls=0;const result=await executePlayerAttackCore({base44,sessionId:f.s.id,combatId:f.l.id,characterId:f.c.id,ownerId:user.id,requestId,handler:handlePlayerAttack,rollD20Fn:()=>{calls++;return Math.floor(randoms[Math.min(i++,randoms.length-1)]*20)+1},payload:{target_id:f.target.id,weapon,spell:null,modifiers:{},twin_target_id:null}});return {value:result,calls}};

    const combatOnly=await make('combat_only',{combatConditions:[pwt,stealth]}); const hit=await invoke(combatOnly,'ui-hit',[0.1,0.8,0]); const hitBody=hit.value.body; const hitLog=await base44.asServiceRole.entities.CombatLog.get(combatOnly.l.id); const hitChar=await base44.asServiceRole.entities.Character.get(combatOnly.c.id);
    results.push({name:'actual UI player_attack payload reads CombatLog-only Stealthed and rolls exactly two d20s',pass:hitBody.all_rolls?.length===2&&hitBody.log_entry?.advantage===true&&hitBody.log_entry?.request_id==='ui-hit'});
    results.push({name:'higher advantage d20 is selected and attribution is persisted and displayed',pass:hitBody.raw_d20===17&&hitBody.log_entry?.selected_d20===17&&hitBody.log_entry?.advantage_sources?.length===1&&/Advantage \[3, 17\].*Attacking from Stealthed\/concealed/.test(hitBody.log_entry?.text||'')});
    results.push({name:'hit consumes one action and Stealthed once while preserving PWT',pass:hitBody.hit&&hitLog.world_state.actions_used_this_turn===1&&!hitLog.combatants[0].conditions.some(x=>x.name==='Stealthed')&&!hitChar.conditions.some(x=>x.name==='Stealthed')&&hitLog.combatants[0].conditions.some(x=>x.name==='pass without trace')&&hitChar.active_modifiers.some(x=>x.source==='Pass without Trace')});

    const charOnly=await make('char_only',{charConditions:[pwt,stealth],ac:30}); const miss=await invoke(charOnly,'ui-miss',[0,0.1]); const missLog=await base44.asServiceRole.entities.CombatLog.get(charOnly.l.id); const missChar=await base44.asServiceRole.entities.Character.get(charOnly.c.id);
    results.push({name:'Character-only Stealthed synchronizes through authoritative attack and miss consumes it',pass:miss.value.body.hit===false&&miss.value.body.all_rolls.length===2&&!missLog.combatants[0].conditions.some(x=>x.name==='Stealthed')&&!missChar.conditions.some(x=>x.name==='Stealthed')});

    const plain=await make('plain'); const straight=await invoke(plain,'ui-straight',[0.5]); results.push({name:'no stealth rolls exactly one d20',pass:straight.value.body.all_rolls.length===1&&straight.value.body.log_entry.advantage===false});
    const onlyPwt=await make('pwt_only',{pwtOnly:true}); const pwtAttack=await invoke(onlyPwt,'ui-pwt',[0.5]); results.push({name:'Pass without Trace alone rolls exactly one d20',pass:pwtAttack.value.body.all_rolls.length===1&&pwtAttack.value.body.log_entry.advantage===false});

    const replayF=await make('replay',{combatConditions:[stealth]}); const first=await invoke(replayF,'ui-replay',[0.2,0.7,0]); const beforeReplay=await base44.asServiceRole.entities.CombatLog.get(replayF.l.id); const second=await invoke(replayF,'ui-replay',[0.99,0.99,0.99]); const afterReplay=await base44.asServiceRole.entities.CombatLog.get(replayF.l.id);
    results.push({name:'request replay performs no reroll damage action or stealth consumption twice',pass:second.value.body.idempotent_replay===true&&second.calls===0&&JSON.stringify(beforeReplay)===JSON.stringify(afterReplay)});

    const wrongTurn=await make('wrong_turn',{combatConditions:[stealth],turn:1}); const wrongTurnResult=await invoke(wrongTurn,'wrong-turn',[0.5]); results.push({name:'wrong turn rejects before RNG and mutation',pass:wrongTurnResult.value.status===409&&wrongTurnResult.calls===0});
    const wrongTarget=await make('wrong_target'); wrongTarget.target.id='missing'; const wrongTargetResult=await invoke(wrongTarget,'wrong-target',[0.5]); results.push({name:'wrong target rejects without action consumption',pass:wrongTargetResult.value.status===404&&(await base44.asServiceRole.entities.CombatLog.get(wrongTarget.l.id)).world_state.actions_used_this_turn===0});
    const defeated=await make('defeated',{defeated:true}); const defeatedResult=await invoke(defeated,'defeated',[0.5]); results.push({name:'defeated target rejects without action consumption',pass:defeatedResult.value.status===409&&(await base44.asServiceRole.entities.CombatLog.get(defeated.l.id)).world_state.actions_used_this_turn===0});

    const repair=await make('repair',{charConditions:[pwt,stealth],combatConditions:[pwt,stealth],targetHp:16});
    await base44.asServiceRole.entities.Character.update(repair.c.id,{inventory:[{name:'Arrows (20)',category:'Ammunition',quantity:0}]});
    const repairCombat=await base44.asServiceRole.entities.CombatLog.get(repair.l.id); const repairMiss={round:1,actor:repair.c.name,action:'attack',target:'Skeleton Reinforcement',hit:false,attack_roll:11,text:`${repair.c.name} misses Skeleton Reinforcement! (Roll: 2+9=11 vs AC 13)`};
    await base44.asServiceRole.entities.CombatLog.update(repair.l.id,{log_entries:[{round:1,text:'Combat begins.'},repairMiss],world_state:{...repairCombat.world_state,actions_used_this_turn:1}});
    const repairScope={combatId:repair.l.id,characterId:repair.c.id,sessionId:repair.s.id}; const repairContract={...repairScope,targetId:repair.target.id,actorName:repair.c.name,targetName:'Skeleton Reinforcement'};
    const dry=await auditRepairMissedStealthedAttackCore({db:base44.asServiceRole,scope:repairScope,contract:repairContract,mode:'dry_run',requestId:'repair-resume'});
    results.push({name:'guarded correction dry run verifies actual incomplete attack and writes zero',pass:dry.status===200&&dry.body.apply_safe&&dry.body.writes===0&&dry.body.observed.first_d20===2,detail:{status:dry.status,failed_guards:dry.body.failed_guards,guards:dry.body.guards}});
    let correctionCalls=0; const applied=await auditRepairMissedStealthedAttackCore({db:base44.asServiceRole,scope:repairScope,contract:repairContract,mode:'apply',requestId:'repair-resume',expectedHashes:dry.body.protected_hashes,rng:()=>{correctionCalls++;return correctionCalls===1?0.75:0}});
    const repairedCombat=await base44.asServiceRole.entities.CombatLog.get(repair.l.id); const repairedChar=await base44.asServiceRole.entities.Character.get(repair.c.id); const repairedEntry=repairedCombat.log_entries.at(-1);
    results.push({name:'guarded apply preserves first d20 and rolls exactly one missing advantage d20',pass:applied.status===200&&applied.body.all_rolls?.[0]===2&&applied.body.all_rolls?.[1]===16&&correctionCalls===2&&repairedEntry.first_raw_d20===2,detail:{status:applied.status,body:applied.body,correctionCalls}});
    results.push({name:'correction keeps action once consumes stealth and preserves PWT and ammunition',pass:repairedCombat.world_state.actions_used_this_turn===1&&!repairedCombat.combatants[0].conditions.some(x=>x.name==='Stealthed')&&!repairedChar.conditions.some(x=>x.name==='Stealthed')&&repairedChar.conditions.some(x=>x.name==='pass without trace')&&repairedChar.inventory[0].quantity===0});
    let replayCalls=0; const correctionReplay=await auditRepairMissedStealthedAttackCore({db:base44.asServiceRole,scope:repairScope,contract:repairContract,mode:'apply',requestId:'repair-resume',expectedHashes:dry.body.protected_hashes,rng:()=>{replayCalls++;return 0.99}});
    results.push({name:'correction replay writes zero uses no RNG and applies no second damage',pass:!!correctionReplay.body.already_processed&&correctionReplay.body.writes===0&&replayCalls===0,detail:{status:correctionReplay.status,body:correctionReplay.body,replayCalls}});
    let mismatchCalls=0; const rejected=await auditRepairMissedStealthedAttackCore({db:base44.asServiceRole,scope:repairScope,contract:repairContract,mode:'apply',requestId:'repair-wrong-hash',expectedHashes:{...dry.body.protected_hashes,combat:'wrong'},rng:()=>{mismatchCalls++;return 0.5}});
    results.push({name:'correction hash mismatch rejects with zero writes and no RNG',pass:rejected.status===409&&rejected.body.writes===0&&mismatchCalls===0});
    results.push({name:'service-role-created CombatLog resolves through shared production core',pass:hit.value.status===200&&hitLog.id===combatOnly.l.id});

    const after=await hash(await Promise.all([base44.asServiceRole.entities.CombatLog.get(LIVE[0]),base44.asServiceRole.entities.Character.get(LIVE[1]),base44.asServiceRole.entities.GameSession.get(LIVE[2])]));
    results.push({name:'protected live IDs remain unchanged',pass:before===after});
  } catch(error){results.push({name:'test execution',pass:false,detail:error.message});}
  finally{const base44=createClientFromRequest(req);for(const [entity,id] of fixtures){let deleted=false,verified_absent=false;try{await base44.asServiceRole.entities[entity].delete(id);deleted=true}catch{}try{verified_absent=!(await base44.asServiceRole.entities[entity].get(id))}catch{verified_absent=true}cleanup.push({entity,id,deleted,verified_absent})}}
  const passed=results.filter(x=>x.pass).length;const cleanupPassed=cleanup.every(x=>x.deleted&&x.verified_absent);const allPass=passed===results.length&&cleanupPassed;return Response.json({deployment_id:'live-stealthed-advantage-v1',passed,failed:results.length-passed,total:results.length,all_pass:allPass,results,cleanup,cleanup_passed:cleanupPassed,live_state:{protected_ids:LIVE,unchanged:results.some(x=>x.name==='protected live IDs remain unchanged'&&x.pass)}},{status:allPass?200:500});
}