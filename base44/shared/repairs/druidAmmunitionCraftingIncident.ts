import { hashValue } from '../tests/liveProtection.ts';
import { canonicalAmmoName } from '../ammunition.ts';

export const DRUID_AMMUNITION_AUDIT_VERSION='druid-ammunition-crafting-audit-v1.0.0';
const craftIntent=/\b(?:craft|make|shape|knap|fletch)\w*\b/i;
const ammoIntent=/\b(?:ammunition|arrows?|bolts?|sling bullets?)\b/i;
const exactYield=/\b(?:receive|received|made|crafted|produced|secured|added|gain(?:ed)?)\s+(?:exactly\s+)?(\d+)\s+([a-z][a-z -]*?(?:arrows?|bolts?|sling bullets?))\b/i;
const references=(value)=>({ironwood:/ironwood|heartwood|tree heart/i.test(value),stone:/\brocks?\b|\bstone\b|\bflint\b/i.test(value)});

export async function auditDruidAmmunitionCraftingIncident({db,character,session}){
  const log=Array.isArray(session.story_log)?session.story_log:[];
  const source=[...log].map((entry,index)=>({entry,index})).reverse().find(({entry})=>craftIntent.test(String(entry?.player_choice||''))&&ammoIntent.test(`${entry?.player_choice||''} ${entry?.text||''}`));
  const entry=source?.entry||null, requestId=String(entry?.request_id||'');
  const match=String(entry?.text||'').match(exactYield);
  const structured=entry?.item_recovery||entry?.recovery_resolution?.recovery||null;
  const item=structured?.recovered_items?.[0]?.canonical_item||structured?.item_name||structured?.recovery?.item?.name||(structured?.recovery?.type==='arrows'?'Arrows':null)||match?.[2]||null;
  const quantity=Number(structured?.quantity||structured?.recovered_items?.[0]?.quantity||match?.[1]||0)||null;
  const receipts=[...(character.long_rest_abilities?.__crafting_receipts||[]),...(character.long_rest_abilities?.__item_recovery_receipts||[])];
  const receipt=receipts.find((candidate)=>candidate?.request_id===requestId||candidate?.token===requestId)||null;
  const relevantText=`${entry?.player_choice||''} ${entry?.text||''}`;
  const ingredientRefs=references(relevantText);
  const inventory=Array.isArray(character.inventory)?character.inventory:[];
  const canonical=canonicalAmmoName(item)||item;
  const currentTotal=canonical?inventory.filter((stack)=>canonicalAmmoName(stack?.name)===canonical||String(stack?.name||'').toLowerCase()===String(canonical).toLowerCase()).reduce((sum,stack)=>sum+Number(stack?.quantity||0),0):null;
  const failed=[];
  if(!entry)failed.push('latest_crafting_story_entry_missing');
  if(!entry?.skill_check?.success)failed.push('successful_check_missing');
  if(!quantity)failed.push('exact_quantity_not_established');
  if(!canonical)failed.push('canonical_item_not_established');
  if(!receipt)failed.push('immutable_transaction_receipt_missing');
  const quantityEstablished=!!(quantity&&canonical), committed=!!receipt;
  const storyClaimConsistent=!quantityEstablished&&!committed;
  return {
    audit_version:DRUID_AMMUNITION_AUDIT_VERSION,
    incident:entry?{story_index:source.index,timestamp:entry.timestamp||null,request_id:requestId,player_action:entry.player_choice||null,narration:entry.text||null,generated_choices:entry.choices||[],skill_check:entry.skill_check||null,recovery_transaction:entry.recovery_transaction||null}:null,
    classification:{npc_druids_crafting:true,explicit_druidcraft_cantrip:/\bcast\s+druidcraft\b|\bdruidcraft\s+cantrip\b/i.test(String(entry?.player_choice||'')),completed_narration:/final arrow|set into your quiver|secured the means/i.test(String(entry?.text||'')),check_success:entry?.skill_check?.success===true},
    evidence:{transaction_receipt:receipt,inventory_matching_total:currentTotal,ingredient_references:ingredientRefs,ingredients_consumed:false,structured_outcome:structured},
    award_established:quantityEstablished,
    quantity_established:quantityEstablished,
    canonical_item:canonical||null,
    quantity,
    ingredients_established:ingredientRefs.ironwood&&ingredientRefs.stone,
    ingredients_consumed:false,
    inventory_committed:committed,
    story_claim_consistent:storyClaimConsistent,
    ask_dm_should_answer:true,
    repair_eligible:quantityEstablished&&committed===false,
    safe_repair:false,
    failed_guards:failed,
    protected_hashes:{character:await hashValue(character),session:await hashValue(session),inventory:await hashValue(inventory),incident:await hashValue({entry,receipt})},
    ask_dm_incident:{input:'How many did I receive?',status:403,classifier_branch:'malformed_id',error:'Invalid Ask the DM request.',root_cause:'StoryPanel opened AskDMDialog without character_id; buildAskDMContext rejected the missing ID before factual classification.'},
    apply_token:null,
    recommendation:quantityEstablished?'A guarded discover-only repair may be evaluated from the exact receipt and state hashes.':'Do not repair inventory. Answer that the exact quantity was not established and no ammunition was added; use a normal in-game action to establish a future exact yield.'
  };
}