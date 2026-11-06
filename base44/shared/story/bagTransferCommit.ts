import { BAG_PENDING_KEY, BAG_TRANSFER_VERSION } from './bagTransferPlan.ts';
import { validateContainerFit } from './containerCapacity.ts';
import { canonicalStoryResponsePayload, hashStoryValue, hydrateLatestStoryEntry, commitStoryTransition, storyPayloadFromCommit } from './storyTransition.ts';

const same = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function guardedBagWrite(entity, record, patch) {
  const result = await entity.updateMany({id:record.id,updated_date:record.updated_date},{$set:patch});
  if (!(Number(result?.updated)>0)) throw new Error('The saved state changed. Your transfer is still pending; retry the same selection.');
  return entity.get(record.id);
}
export function committedBagBody(session, character, receipt, alreadyProcessed = false) {
  const entry = (session.story_log || []).find(row=>row.request_id===receipt.request_id);
  return {handled:true,success:true,transfer_committed:true,persistence_confirmed:true,
    clarification_intent_id:receipt.request_id,request_id:receipt.request_id,receipt,already_processed:alreadyProcessed,
    ...(entry ? storyPayloadFromCommit({entry,index:session.story_log.indexOf(entry),persistence_confirmed:true}) : {}),
    narrative:entry?.text,choices:entry?.choices || [],session,character,version:BAG_TRANSFER_VERSION};
}
// Cross-record changes use a durable before/after journal, not a pretend DB
// transaction. Success is exposed only after BOTH images and the receipt verify.
// Interrupted saves retain the pending intent and finish the same plan on retry.
export async function commitBagTransfer({db,session,character,pending,selected}) {
  let plan = pending.commit;
  if (!plan) {
    const item = character.stowed_items?.[selected.index];
    if (!item || await hashStoryValue(item)!==selected.fingerprint) throw new Error('That bag item changed. Your selection is preserved; review the bag before retrying.');
    const stowed = [...character.stowed_items];
    if (Number(item.quantity ?? 1)>1) stowed[selected.index]={...item,quantity:Number(item.quantity)-1}; else stowed.splice(selected.index,1);
    const at=new Date().toISOString(), entityId=item.scene_entity_id || `placed:${pending.id}`;
    const moved={...item,quantity:1,container:pending.intent.destination,scene_entity_id:entityId,
      transfer_provenance:{...(item.transfer_provenance||{}),source:'stowed_items',container:pending.intent.container,destination:pending.intent.destination,request_id:pending.id,at}};
    const after={stowed_items:stowed,inventory:[...(character.inventory || [])]};
    if(pending.intent.destination_kind==='carried') after.inventory.push({...moved,container:null});
    const capacity=validateContainerFit({character:{...character,...after},container:pending.intent.container});
    if(!capacity.totals) throw new Error(capacity.message);
    const receipt={request_id:pending.id,version:BAG_TRANSFER_VERSION,item_id:selected.id,item_name:item.name,quantity:1,source:'stowed_items',source_container:pending.intent.container,
      destination:pending.intent.destination,destination_kind:pending.intent.destination_kind,capacity:capacity.totals,death_provenance:item.death_provenance || null,at};
    const worldItem={...moved,world_status:'placed',location:session.current_location};
    const sceneEntity={...moved,id:entityId,session_id:session.id,location:session.current_location,type:item.status==='dead'||item.alive===false?'corpse':'object',
      transfer_state:'world',affordances:['inspect','stow'],evidence:{authority:'item_transfer',request_id:pending.id,source_item_id:selected.id}};
    const text=`You remove ${item.name} from your ${pending.intent.container} and ${pending.intent.destination_kind==='world' ? `place it ${pending.intent.destination.replace(/^scene ground /,'')}` : 'carry it with you'}. The transfer is recorded.`;
    const choices=hydrateLatestStoryEntry(session).choices;
    const entry={request_id:pending.id,action:'choice',player_choice:pending.action,text,choices,timestamp:at,scene_location:session.current_location,mechanics_status:'complete',
      transfer_transaction:{receipt,success:true},choice_evidence:{response_payload_hash:await hashStoryValue(canonicalStoryResponsePayload({requestId:pending.id,text,choices,skillCheck:null}))},transition_outcome:{combat_trigger:false,enemies:[]}};
    plan={before:{stowed_items:character.stowed_items || [],inventory:character.inventory || []},after,receipt,worldItem:pending.intent.destination_kind==='world'?worldItem:null,sceneEntity:pending.intent.destination_kind==='world'?sceneEntity:null,entry};
    pending={...pending,selected_source_id:selected.id,commit:plan};
    session=await guardedBagWrite(db.entities.GameSession,session,{world_state:{...session.world_state,[BAG_PENDING_KEY]:pending}});
  }
  character=await db.entities.Character.get(character.id);
  const before=Object.keys(plan.before).every(key=>same(character[key] || [],plan.before[key]));
  const after=Object.keys(plan.after).every(key=>same(character[key] || [],plan.after[key]));
  if(!before&&!after) throw new Error('Your possessions changed during the saved transfer. The intent and receipt plan are retained; do not start a different transfer.');
  if(!after) character=await guardedBagWrite(db.entities.Character,character,plan.after);
  const fresh=await db.entities.GameSession.get(session.id);
  if(fresh.world_state?.[BAG_PENDING_KEY]?.id!==pending.id) throw new Error('The pending transfer changed. Keep this selection and retry.');
  const world={...fresh.world_state,[BAG_PENDING_KEY]:null,
    __item_transfer_receipts:[...(fresh.world_state?.__item_transfer_receipts||[]).filter(x=>x.request_id!==pending.id).slice(-49),plan.receipt],
    __container_capacity:{...(fresh.world_state?.__container_capacity||{}),[pending.intent.container]:plan.receipt.capacity}};
  if(plan.worldItem) world.world_items=[...(world.world_items||[]).filter(x=>x.transfer_provenance?.request_id!==pending.id),plan.worldItem];
  if(plan.sceneEntity) world.scene_entities=[...(world.scene_entities||[]).filter(x=>x.id!==plan.sceneEntity.id),plan.sceneEntity];
  session=await guardedBagWrite(db.entities.GameSession,fresh,{world_state:world,story_log:commitStoryTransition(fresh.story_log||[],plan.entry,pending.id).story_log});
  const verified=await db.entities.Character.get(character.id);
  if(!Object.keys(plan.after).every(key=>same(verified[key] || [],plan.after[key]))) throw new Error('Transfer confirmation is incomplete. Retry this same selection; do not repeat the action.');
  return committedBagBody(session,verified,plan.receipt);
}