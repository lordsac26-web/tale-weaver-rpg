import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { executeRecoveryTransaction } from '../../shared/story/recoveryTransaction.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();if(!user||user.role!=='admin')return Response.json({error:'Admin access required.'},{status:403});await req.json().catch(()=>({}));
    const before=await hashValue(await readProtectedDndState(base44.asServiceRole));
    let character={id:'fixture-character',created_by_id:user.id,inventory:[{name:'Arrows',quantity:18}],long_rest_abilities:{}},session={id:'fixture-session',character_id:character.id,current_location:'fixture'};
    const fake={asServiceRole:{entities:{Character:{get:async()=>structuredClone(character),update:async(_id,updates)=>(character={...character,...structuredClone(updates)})},GameSession:{get:async()=>structuredClone(session)},CombatLog:{get:async()=>null}}}};
    const item={item_id:'fixture-unidentified-staff',name:'Unidentified Staff',category:'Staff',type:'Magic Item',quantity:1,stackable:false,is_magic:true,is_identified:false,description:'A heavy, gnarled piece of darkwood wrapped in the defiled iconography of the Seventh Patrol.',icon_key:'Staff'};
    const args={base44:fake,ownerId:user.id,sessionId:session.id,characterId:character.id,requestId:'fixture-staff-request',outcome:{check:{success:true},recovery:{type:'item',item}}};
    const applied=await executeRecoveryTransaction(args),replay=await executeRecoveryTransaction(args),staffs=character.inventory.filter((entry)=>entry.item_id===item.item_id),after=await hashValue(await readProtectedDndState(base44.asServiceRole));
    const tests=[{name:'fixture apply writes once',pass:applied.body.writes===1},{name:'fixture replay writes zero',pass:replay.body.writes===0&&replay.body.already_processed===true},{name:'one unresolved staff only',pass:staffs.length===1&&staffs[0].is_identified===false&&!staffs[0].rarity},{name:'description and icon preserved',pass:staffs[0].description===item.description&&staffs[0].icon_key==='Staff'},{name:'protected live state unchanged',pass:before===after}],passed=tests.filter((entry)=>entry.pass).length;
    return Response.json({function_version:'test-narrated-staff-repair-fixture-v1.1.0',all_pass:passed===tests.length,passed,total:tests.length,tests},{status:passed===tests.length?200:500});
  }catch(error){return Response.json({error:error.message||'Staff repair fixture failed.'},{status:500});}
}