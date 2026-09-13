import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { classifyItemTransferIntent, executeItemTransferAction } from '../../shared/story/itemTransfer.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const fixtures=[]; const results=[]; const record=(name,pass)=>results.push({name,pass:!!pass});
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me();
    if(!user||user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
    await req.json().catch(()=>({}));
    const protectedBefore=await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('tomb placement classifies as a world transfer',classifyItemTransferIntent("Secure the inquisitor's body in a warded druidic tomb for later study.")?.destination_kind==='world');
    record('bag stow remains outside transfer routing',classifyItemTransferIntent('place the staff in the bag of holding')===null);
    try {
      const tag=`TransferQA_${Date.now()}`;
      const corpse={name:"Inquisitor Leader's Corpse",quantity:1,category:'Corpse',container:'Bag of Holding',alive:false,status:'dead',death_provenance:{combat_id:'fixture-combat'},provenance:{source:'fixture-stow'}};
      const character=await base44.entities.Character.create({name:tag,race:'Human',class:'Ranger',level:5,inventory:[{name:'Bag of Holding',quantity:1}],stowed_items:[{name:"Weaver's Ledger",quantity:1,container:'Bag of Holding'},corpse,{name:'Unidentified Staff',quantity:1,container:'Bag of Holding',is_identified:false}],is_active:false});
      fixtures.push(['Character',character.id]);
      const session=await base44.entities.GameSession.create({character_id:character.id,title:tag,current_location:'Circle of the Reeds',story_log:[],world_state:{},is_active:false});
      fixtures.push(['GameSession',session.id]);
      const payload={session_id:session.id,character_id:character.id,action_text:"Secure the inquisitor's body in a warded druidic tomb for later study.",request_id:`${tag}:place`,check:{success:true}};
      const first=await executeItemTransferAction({base44,ownerId:user.id,payload});
      const replay=await executeItemTransferAction({base44,ownerId:user.id,payload});
      const [afterCharacter,afterSession]=await Promise.all([base44.asServiceRole.entities.Character.get(character.id),base44.asServiceRole.entities.GameSession.get(session.id)]);
      const tomb=(afterSession.world_state?.world_items||[]).filter((item)=>item.name==="Inquisitor Leader's Corpse"&&/tomb/i.test(item.container));
      record('successful placement commits exactly once from bag to tomb',first.body?.writes===2&&!afterCharacter.stowed_items.some((item)=>item.name==="Inquisitor Leader's Corpse")&&tomb.length===1);
      record('transfer retains corpse death state and provenance',tomb[0]?.alive===false&&tomb[0]?.death_provenance?.combat_id==='fixture-combat'&&tomb[0]?.provenance?.source==='fixture-stow');
      record('ledger and unidentified staff remain untouched',afterCharacter.stowed_items.some((item)=>item.name==="Weaver's Ledger")&&afterCharacter.stowed_items.some((item)=>item.name==='Unidentified Staff'&&item.is_identified===false));
      record('replay is idempotent',replay.body?.already_processed===true&&replay.body?.writes===0);
      const failedBefore=await hashValue([afterCharacter.inventory,afterCharacter.stowed_items,afterSession.world_state]);
      const failed=await executeItemTransferAction({base44,ownerId:user.id,payload:{...payload,action_text:'give the unidentified staff to Sylvara',request_id:`${tag}:failed`,check:{success:false}}});
      const failedAfter=await hashValue([(await base44.asServiceRole.entities.Character.get(character.id)).inventory,(await base44.asServiceRole.entities.Character.get(character.id)).stowed_items,(await base44.asServiceRole.entities.GameSession.get(session.id)).world_state]);
      record('failed placement performs no writes',failed.body?.reason==='failed_check'&&failed.body?.writes===0&&failedBefore===failedAfter);
      const ambiguous=await executeItemTransferAction({base44,ownerId:user.id,payload:{...payload,action_text:'place the item in the tomb',request_id:`${tag}:ambiguous`,check:{success:true}}});
      record('unresolved placement requests clarification without writes',ambiguous.body?.clarification_required===true&&ambiguous.body?.writes===0);
    } finally { for(const [entity,id] of fixtures.reverse())await base44.asServiceRole.entities[entity].delete(id).catch(()=>null); }
    const protectedAfter=await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('fixtures clean up and protected records remain unchanged',protectedBefore===protectedAfter);
    const passed=results.filter((item)=>item.pass).length,all_pass=passed===results.length;
    return Response.json({function_version:'test-item-transfer-v1.0.0',passed,failed:results.length-passed,total:results.length,all_pass,results},{status:all_pass?200:500});
  } catch(error) { return Response.json({error:error.message||'Item transfer regression failed',results,all_pass:false},{status:500}); }
}