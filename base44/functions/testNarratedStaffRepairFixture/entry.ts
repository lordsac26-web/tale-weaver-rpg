import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { executeRecoveryTransaction } from '../../shared/story/recoveryTransaction.ts';
import { formatAuditorResponse } from '../../shared/repairs/auditorResponse.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user||user.role!=='admin')return Response.json({error:'Admin access required.'},{status:403});
    await req.json().catch(()=>({}));
    const before=await hashValue(await readProtectedDndState(base44.asServiceRole));
    const cleanup=[];const results=[];const record=(name,pass)=>results.push({name,pass:!!pass});
    let character=null,session=null;
    try{
      character=await base44.entities.Character.create({name:`StaffRepairFixture_${Date.now()}`,race:'Human',class:'Wizard',level:5,hp_current:30,hp_max:30,inventory:[{name:'Arrows',quantity:18}],conditions:[{name:'Alert',duration:'persistent'}],active_modifiers:[],is_active:false});cleanup.push(['Character',character.id]);
      session=await base44.entities.GameSession.create({character_id:character.id,title:'Staff repair fixture',time_of_day:'Evening',world_state:{clock_hour:20,elapsed_hours:20},story_log:[],in_combat:false,is_active:false});cleanup.push(['GameSession',session.id]);
      const item={item_id:'fixture-unidentified-staff',name:'Unidentified Staff',display_name:'Unidentified Staff',category:'Staff',type:'Magic Item',quantity:1,stackable:false,is_magic:true,is_identified:false,identity_status:'unresolved',identification_status:'unidentified',description:'A heavy, gnarled piece of darkwood wrapped in the defiled iconography of the Seventh Patrol.',unidentified_description:'A heavy, gnarled piece of darkwood wrapped in the defiled iconography of the Seventh Patrol.',icon_key:'Staff',scene_provenance:{request_id:'fixture-staff-request',source_story_index:46}};
      const compact=formatAuditorResponse({success:true,mode:'dry_run',function_version:'narrated-unidentified-staff-pickup-repair-v1.0.3',classification:'narrated_unique_staff_pickup_missing_inventory',safe_to_repair:true,writes:0,guards:{exact:true},proposal_hash:'fixture-hash',apply_token:'complete.fixture.token'},'token_only');
      record('compact output complete',compact.all_guards_true&&compact.apply_token==='complete.fixture.token'&&!('proposal' in compact)&&Object.keys(compact).length===9);
      const args={base44,ownerId:user.id,sessionId:session.id,characterId:character.id,requestId:'fixture-staff-request',outcome:{check:{success:true},recovery:{type:'item',item}}};
      const applied=await executeRecoveryTransaction(args),replay=await executeRecoveryTransaction(args),fresh=await base44.asServiceRole.entities.Character.get(character.id);
      const staffs=(fresh.inventory||[]).filter((entry)=>entry.item_id==='fixture-unidentified-staff');
      record('fixture applies exact unresolved staff once',applied.body.writes===1&&staffs.length===1&&staffs[0].description===item.description&&staffs[0].icon_key==='Staff'&&staffs[0].is_identified===false&&!staffs[0].rarity);
      record('fixture replay writes zero',replay.body.writes===0&&replay.body.already_processed===true&&staffs.length===1);
    }finally{
      for(const [entity,id] of cleanup.reverse())await base44.asServiceRole.entities[entity].delete(id).catch(()=>null);
    }
    const after=await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('protected live IDs unchanged',before===after);
    const allPass=results.every((result)=>result.pass);
    return Response.json({function_version:'test-narrated-staff-repair-fixture-v1.0.0',all_pass:allPass,passed:results.filter((result)=>result.pass).length,total:results.length,results},{status:allPass?200:500});
  }catch(error){return Response.json({error:error.message||'Staff repair fixture failed.'},{status:500});}
}