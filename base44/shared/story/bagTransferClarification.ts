import { BAG_PENDING_KEY, BAG_TRANSFER_VERSION, bagNorm, parseBagTransfer, bagTransferCandidates, bagClarificationBody } from './bagTransferPlan.ts';
import { guardedBagWrite, commitBagTransfer, committedBagBody } from './bagTransferCommit.ts';
import { sceneRevision } from './sceneEvidence.ts';

// Called only after the endpoint has checked the session/character owner chain.
export async function resolveBagTransferClarification({db,session,character,actionText='',requestId='',intentId='',selectedId='',answerText='',operation='',confirm=false}) {
  let pending=session.world_state?.[BAG_PENDING_KEY];
  const parsed=parseBagTransfer(actionText);
  const result=body=>({handled:true,status:200,body});
  const fail=(message,status=409)=>({handled:true,status,body:{error:message,preserve_pending:true,clarification_intent_id:pending?.id || intentId,writes:0,version:BAG_TRANSFER_VERSION}});
  const prior=intentId && (session.world_state?.__item_transfer_receipts||[]).find(x=>x.request_id===intentId&&x.version===BAG_TRANSFER_VERSION);
  if(prior) return result(committedBagBody(session,character,prior,true));
  if(operation==='restore') return result(pending ? bagClarificationBody(pending) : {pending:false,writes:0});
  if(operation==='cancel') {
    if(pending?.commit) return fail('This transfer is already saving. Retry the same selection to finish it before cancelling.');
    if(pending && pending.id===intentId) await guardedBagWrite(db.entities.GameSession,session,{world_state:{...session.world_state,[BAG_PENDING_KEY]:null}});
    return result({cancelled:true,writes:pending?1:0});
  }
  if(!pending&&!parsed&&!intentId) return {handled:false};
  if(session.in_combat) return fail('Finish combat before moving an item out of the bag. Your reply is preserved.');
  if(intentId&&pending?.id!==intentId) return fail('That saved clarification is not available. Retype the full removal action; no item was moved.');
  if(!pending) {
    if(!requestId) return fail('The saved action needs a request identity. Retype the full removal action.',400);
    const candidates=await bagTransferCandidates(character,parsed);
    if(!candidates.length) return fail(`No matching source item is recorded inside ${parsed.container}. Review its contents and retype the item name.`);
    pending={id:String(requestId).slice(0,120),version:BAG_TRANSFER_VERSION,action:actionText,intent:parsed,
      scene_revision:await sceneRevision(session,character),location:session.current_location,candidates};
    session=await guardedBagWrite(db.entities.GameSession,session,{world_state:{...session.world_state,[BAG_PENDING_KEY]:pending}});
  } else if(parsed&&bagNorm(actionText)!==bagNorm(pending.action)&&!intentId) {
    return result(bagClarificationBody(pending,'Your original removal is still pending. Choose its source below, or cancel it before starting a different action.'));
  }
  if(pending.commit) {
    if(selectedId&&selectedId!==pending.selected_source_id) return fail('The original selection is already saving. Retry that same item; the destination cannot change.');
    const body=await commitBagTransfer({db,session,character,pending,selected:pending.candidates.find(x=>x.id===pending.selected_source_id)});
    return result(body);
  }
  const answer=bagNorm(answerText || (!parsed&&actionText ? actionText : ''));
  const matches=pending.candidates.filter(x=>selectedId ? x.id===selectedId : answer && (bagNorm(x.name)===answer || bagNorm(x.id)===answer || answer.includes(bagNorm(x.name))));
  const selected=matches.length===1 ? matches[0] : null;
  if((selectedId||answer)&&!selected) return result(bagClarificationBody(pending,'That reply did not identify one of the saved bag contents. Choose a listed item or type its full name; your original removal and destination are preserved.'));
  if(!selected&&!confirm) {
    if(pending.candidates.length===1) return result({action:pending.action,action_type:'utility',requires_check:false,skill:null,dc:null,risk_level:'low',request_id:pending.id,
      clarification_intent_id:pending.id,bag_transfer:{intent_id:pending.id,selected_source_id:pending.candidates[0].id},
      reasoning:`Remove ${pending.candidates[0].name} from ${pending.intent.container} and move it to ${pending.intent.destination}. No roll is needed.`,writes:0});
    return result(bagClarificationBody(pending));
  }
  const chosen=selected || (pending.candidates.length===1 ? pending.candidates[0] : null);
  if(!chosen) return result(bagClarificationBody(pending));
  if(await sceneRevision(session,character)!==pending.scene_revision) return fail('The scene or bag changed while you were replying. The original intent is preserved. Cancel this clarification and retype the removal against the current scene.');
  console.info('Bag clarification selection bound',JSON.stringify({intent_id:pending.id,selected_source_id:chosen.id,version:BAG_TRANSFER_VERSION}));
  return result(await commitBagTransfer({db,session,character,pending,selected:chosen}));
}