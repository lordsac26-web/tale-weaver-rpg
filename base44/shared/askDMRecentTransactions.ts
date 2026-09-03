import { canonicalAmmoName } from './ammunition.ts';

export const ASK_DM_CONTEXT_VERSION='ask-dm-context-v2.0.0';
const clean=(value,max=600)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
const quantityQuestion=(q)=>/\bhow many\b|\bwhat ammunition\b|\bwhat (?:did|was) (?:i )?(?:receive|received|crafted|made)\b|\bdid (?:that|it).{0,30}(?:inventory|added)\b/i.test(q);
const craftingText=(value)=>/\b(?:craft|crafted|crafting|make|made|shape|shaped|knap|knapped|fletch|fletched|ammunition|arrows?|bolts?)\b/i.test(value);
const currentTotal=(inventory,name)=>{const canonical=canonicalAmmoName(name);return (inventory||[]).filter((item)=>canonical?canonicalAmmoName(item?.name)===canonical:clean(item?.name,120).toLowerCase()===clean(name,120).toLowerCase()).reduce((sum,item)=>sum+Number(item?.quantity||0),0);};

export function buildRecentTransactionContext(character,session){
  const log=Array.isArray(session?.story_log)?session.story_log:[],latest=log.at(-1)||null;
  const requestId=String(latest?.request_id||'');
  const abilities=character?.long_rest_abilities||{};
  const receipts=[...(abilities.__crafting_receipts||[]),...(abilities.__item_recovery_receipts||[])];
  const receipt=receipts.findLast?.((item)=>item?.request_id===requestId||item?.token===requestId)||[...receipts].reverse().find((item)=>item?.request_id===requestId||item?.token===requestId)||null;
  const storyOutcome=latest?.crafting_transaction?.receipt||latest?.item_recovery||latest?.recovery_resolution||null;
  const evidence=receipt||storyOutcome;
  const name=evidence?.canonical_item||evidence?.item_name||evidence?.output?.name||evidence?.recovered_items?.[0]?.canonical_item||null;
  const quantity=Number(evidence?.yield_quantity||evidence?.quantity||evidence?.output?.quantity||evidence?.recovered_items?.[0]?.quantity||0)||null;
  const latestText=`${latest?.player_choice||''} ${latest?.text||''}`;
  const relevant=craftingText(latestText)||!!evidence;
  const completed=!!evidence||/\b(?:final arrow|received|added to (?:your|the) (?:inventory|quiver)|crafted|produced)\b/i.test(latest?.text||'');
  return {request_id:requestId||null,latest_relevant:relevant,completed_claim:completed,receipt:evidence?{transaction_type:evidence.transaction_type||'story_outcome',request_id:requestId,canonical_item:name,quantity,yield_quantity:quantity,inventory_after_hash:evidence.inventory_after_hash||null}:null,canonical_item:name,awarded_quantity:quantity,current_total:name?currentTotal(character?.inventory||[],name):null,inventory_added:!!evidence,check_success:latest?.skill_check?.success===true,player_action:clean(latest?.player_choice),narration:clean(latest?.text)};
}

export function answerRecentTransactionQuestion(question,recent){
  if(!quantityQuestion(question))return null;
  if(!recent?.latest_relevant)return {classification:'not_established',supporting_fact_keys:[],answer:'The exact quantity was not established in the latest player-visible scene.'};
  if(recent.awarded_quantity&&recent.canonical_item){
    return {classification:'established_fact',supporting_fact_keys:['recent_transaction.receipt','recent_transaction.current_total'],answer:`You received ${recent.awarded_quantity} ${recent.canonical_item}. You currently have ${recent.current_total} ${recent.canonical_item}.`};
  }
  const noAddition=recent.inventory_added===false?' No ammunition was added to inventory.':'';
  const check=recent.check_success?' The check succeeded, but that did not establish a completed inventory transaction.':'';
  return {classification:'not_established',supporting_fact_keys:['recent_transaction'],answer:`The exact quantity was not established.${noAddition}${check}`};
}