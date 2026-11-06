import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { resolveActionAndAdvance, resetTurnWorldState } from '../../shared/combat/helpers.ts';
import { buildCombatRequestKey } from '../../shared/combat/combatFollowupTransition.js';
import { executePlayerAttackCore } from '../../shared/combat/playerAttackCore.ts';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { handleEnemyTurn } from '../../shared/combat/enemyTurn.ts';

export default async function(req) {
  const client = createClientFromRequest(req);
  const user = await client.auth.me();
  if (!user || user.role !== 'admin') return Response.json({error:'Admin required'}, {status:403});
  const tests = [], check = (name, pass) => tests.push({name, pass:!!pass});
  // Isolated memory store: production handlers, no writes to campaign records.
  const ch = {id:'player',name:'Ranger fixture',class:'Ranger',level:7,race:'Human',hp_current:59,hp_max:59,dexterity:18,strength:10,wisdom:14,proficiency_bonus:3,inventory:[{name:'Arrows',quantity:20}],conditions:[],active_modifiers:[]};
  const s = {id:'session',character_id:ch.id,in_combat:true,combat_state:{combat_id:'combat'},world_state:{}};
  const c = {id:'combat',session_id:s.id,character_id:ch.id,round:3,current_turn_index:1,is_active:true,result:'ongoing',log_entries:[],world_state:{actions_used_this_turn:0,attacks_used_this_action:1,attacks_remaining:1},combatants:[{id:'dead',type:'enemy',is_conscious:false,hp_current:0},{id:ch.id,name:ch.name,type:'player',is_conscious:true,hp_current:59,hp_max:59,ac:22,conditions:[]},{id:'enemy',name:'Guard',type:'enemy',is_conscious:true,hp_current:200,hp_max:200,ac:30,attack_bonus:4,damage_dice:'1d8',cr:0.5,conditions:[]}]};
  const records = {Character:ch,GameSession:s,CombatLog:c};
  const entities = Object.fromEntries(Object.entries(records).map(([name,record])=>[name,{get:async()=>structuredClone(record),update:async(id,patch)=>{Object.assign(record,structuredClone(patch));return structuredClone(record);}}]));
  const base44 = {asServiceRole:{entities}};
  const weapon = {name:'Longbow',type:'ranged',damage_dice:'1d8',properties:['Ammunition (150/600)']};
  try {
    const reset = resetTurnWorldState(c);
    check('turn reset clears both counters and remaining projection',reset.actions_used_this_turn===0&&reset.attacks_used_this_action===0&&reset.attacks_remaining===0);
    c.world_state = reset;
    const first = resolveActionAndAdvance(c,c.combatants,ch);
    check('first action synchronizes counters',first.worldState.actions_used_this_turn===1&&first.worldState.attacks_used_this_action===1);
    const second = resolveActionAndAdvance({...c,world_state:first.worldState},c.combatants,ch);
    check('second action clears both counters on handoff',second.worldState.actions_used_this_turn===0&&second.worldState.attacks_used_this_action===0&&second.actionsRemaining===0);
    // Reproduce the legacy collision: a1 was used for the FIRST attack, and is
    // still the displayed counter. The next legitimate attack must not reuse it.
    const args = {combat:c,sessionId:s.id,characterId:ch.id,targetId:'enemy',actionType:'attack'};
    const keyBefore = buildCombatRequestKey(args);
    c.log_entries.push({request_id:keyBefore,round:2,action:'attack'});
    check('committed log rotates key even when stale slot stays unchanged',buildCombatRequestKey(args)!==keyBefore);
    check('same snapshot rerender retains request identity',buildCombatRequestKey(args)===buildCombatRequestKey(args));
    for (let round=3;round<=5;round++) {
      const keys=[];
      for (let attack=0;attack<2;attack++) {
        const key=buildCombatRequestKey(args); keys.push(key);
        const input={base44,sessionId:s.id,combatId:c.id,characterId:ch.id,payload:{target_id:'enemy',weapon,modifiers:{}},requestId:key,handler:handlePlayerAttack,rollD20Fn:()=>2};
        const outcome=await executePlayerAttackCore(input);
        check(`round ${round} attack ${attack+1} resolves`,outcome.status===200);
        const saved=JSON.stringify(records);
        const replay=await executePlayerAttackCore(input);
        check(`round ${round} attack ${attack+1} replay is zero-write`,replay.status===409&&JSON.stringify(records)===saved);
      }
      check(`round ${round} distinct attacks advance to enemy`,keys[0]!==keys[1]&&c.current_turn_index===2);
      await handleEnemyTurn({base44,session_id:s.id,combat_id:c.id,internal:{rollD20:()=>1,chooseTactic:()=>({id:'default',numAttacks:1,attackBonus:0,bonusDamage:0,desc:'attacks!'})}});
      check(`round ${round+1} enemy handoff resets both counters`,c.round===round+1&&c.current_turn_index===1&&c.world_state.actions_used_this_turn===0&&c.world_state.attacks_used_this_action===0);
    }
    check('six committed attacks consume six arrows only',ch.inventory[0].quantity===14);
    const passed=tests.filter(t=>t.pass).length;
    return Response.json({passed,failed:tests.length-passed,total:tests.length,all_pass:passed===tests.length,tests,live_writes:0},{status:passed===tests.length?200:500});
  } catch(error) { return Response.json({error:error.message,tests,live_writes:0},{status:500}); }
}