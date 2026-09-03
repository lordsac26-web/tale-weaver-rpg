import { authoritativeAmmoUnits, canonicalAmmoName } from '../ammunition.ts';
import { hashValue } from '../tests/liveProtection.ts';

export const DRUID_CRAFTING_REPAIR_VERSION='druid-crafting-incident-repair-v1.0.0';
export const DRUID_CRAFTING_RECEIPT_KEY='__crafting_reconciliation_receipts';
export const DRUID_CRAFTING_INCIDENT={character_id:'6a6825cd07a490fa70a46852',session_id:'6a6825edd695bd65a4322256',story_index:59,request_id:'story-action:6a6825edd695bd65a4322256:1788408540111:inn7cv'};
const signingKey='d9f4c8a60173be42e7d04f69a13c2ed153fbccf803b67df9bd5399ce4f8a6175';
const expected={raw:17,modifier:3,total:20,dc:12,quantityBefore:16,award:20,quantityAfter:36};
const encode=(value)=>btoa(unescape(encodeURIComponent(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value)=>decodeURIComponent(escape(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='))));
const bytes=(value)=>new TextEncoder().encode(value);
const hex=(buffer)=>Array.from(new Uint8Array(buffer)).map((value)=>value.toString(16).padStart(2,'0')).join('');
const stable=(record,omit=[])=>Object.fromEntries(Object.entries(record||{}).filter(([key])=>!['updated_date',...omit].includes(key)));
const characterNonInventory=(character)=>stable(character,['inventory','long_rest_abilities']);
const receiptLists=(character)=>{const abilities=character?.long_rest_abilities||{};return [...(abilities.__crafting_receipts||[]),...(abilities.__item_recovery_receipts||[]),...(abilities[DRUID_CRAFTING_RECEIPT_KEY]||[])];};
const recoveryShape=(entry)=>(entry?.choices||[]).map((choice)=>choice?.recovery||null);
const exactRecovery=(value)=>value&&Object.keys(value).sort().join(',')==='quantity,type'&&value.type==='arrows'&&Number(value.quantity)===expected.award;
const completeNarration=(text)=>/final arrow/i.test(text||'')&&/set into your quiver/i.test(text||'')&&/secured the means/i.test(text||'');
const referencesSceneIngredients=(entry)=>/heartwood|ironwood/i.test(`${entry?.player_choice||''} ${entry?.text||''}`)&&/stone|flint/i.test(`${entry?.player_choice||''} ${entry?.text||''}`)&&/resin/i.test(entry?.text||'');

async function signature(message){const key=await crypto.subtle.importKey('raw',bytes(signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,bytes(message)));}
export async function createDruidRepairApplyToken(payload){const encoded=encode(JSON.stringify(payload));return `${encoded}.${await signature(encoded)}`;}
export async function verifyDruidRepairApplyToken(token,now=Date.now()){
  const [encoded,supplied,...extra]=String(token||'').split('.');if(!encoded||!supplied||extra.length)return {ok:false,reason:'malformed_apply_token'};
  const expectedSignature=await signature(encoded);if(supplied.length!==expectedSignature.length||!supplied.split('').every((char,index)=>char===expectedSignature[index]))return {ok:false,reason:'tampered_apply_token'};
  let payload;try{payload=JSON.parse(decode(encoded));}catch{return {ok:false,reason:'malformed_apply_token'};}
  if(!Number.isFinite(Number(payload.exp))||Number(payload.exp)<=now)return {ok:false,reason:'expired_apply_token'};
  return {ok:true,payload};
}

async function inspect({db,characterId,sessionId}){
  const [character,session]=await Promise.all([db.entities.Character.get(characterId),db.entities.GameSession.get(sessionId)]);
  if(!character||!session)return {status:404,error:'Incident records are missing.',character,session};
  const entry=(session.story_log||[])[DRUID_CRAFTING_INCIDENT.story_index],skill=entry?.skill_check||null,recoveries=recoveryShape(entry),inventory=character.inventory||[];
  const arrowRows=inventory.map((item,index)=>({item,index})).filter(({item})=>canonicalAmmoName(item?.name)==='Arrows');
  const abilities=character.long_rest_abilities||{},ammoReceipts=abilities.__ammo_attack_receipts||[],reconciliation=abilities[DRUID_CRAFTING_RECEIPT_KEY]||[];
  const existingReceipt=reconciliation.find((receipt)=>receipt?.original_request_id===entry?.request_id)||null;
  const first=ammoReceipts.find((receipt)=>receipt?.ammo_name==='Arrows'&&Number(receipt.quantity_before)===18&&Number(receipt.quantity_after)===17&&Number(receipt.consumed)===1);
  const second=ammoReceipts.find((receipt)=>receipt?.ammo_name==='Arrows'&&Number(receipt.quantity_before)===17&&Number(receipt.quantity_after)===16&&Number(receipt.consumed)===1);
  const incidentTime=Date.parse(entry?.timestamp||'');
  const laterInventoryReceipts=[...ammoReceipts,...receiptLists(character)].filter((receipt)=>receipt!==existingReceipt&&receipt?.at&&Date.parse(receipt.at)>incidentTime);
  const hashes={story_entry:await hashValue(entry),skill_receipt:await hashValue(skill),choices_recovery:await hashValue(recoveries),inventory:await hashValue(inventory),session:await hashValue(session),character:await hashValue(character),attack_receipts:await hashValue(ammoReceipts),character_noninventory:await hashValue(characterNonInventory(character))};
  const guards={
    exact_character_session_link:character.id===characterId&&session.id===sessionId&&session.character_id===characterId,
    exact_incident_identity:entry?.request_id===DRUID_CRAFTING_INCIDENT.request_id&&DRUID_CRAFTING_INCIDENT.story_index===59&&(session.story_log||[]).length===60,
    immutable_nature_receipt:skill?.id===entry?.request_id&&skill?.request_id===entry?.request_id&&skill?.skill==='Nature'&&Number(skill.raw_d20)===expected.raw&&Number(skill.modifier_total)===expected.modifier&&Number(skill.final_total)===expected.total&&Number(skill.dc)===expected.dc&&skill.success===true&&skill.unified_story_skill_resolution===true,
    completed_acquisition_narration:completeNarration(entry?.text),
    unanimous_misattached_recovery:recoveries.length===4&&recoveries.every(exactRecovery),
    ordinary_arrows_only:arrowRows.length===1&&arrowRows[0].item.name==='Arrows'&&authoritativeAmmoUnits(arrowRows[0].item)===expected.quantityBefore,
    no_existing_incident_receipt:!receiptLists(character).some((receipt)=>receipt?.request_id===entry?.request_id||receipt?.original_request_id===entry?.request_id),
    exact_two_attack_chain:!!first&&!!second&&ammoReceipts.filter((receipt)=>receipt?.ammo_name==='Arrows').length===2&&first.inventory_after_hash===second.inventory_before_hash&&second.inventory_after_hash===hashes.inventory,
    no_later_inventory_transaction:laterInventoryReceipts.length===0,
    no_active_combat:session.in_combat!==true&&!String(session.combat_state?.combat_id||'').trim(),
    scene_ingredients_not_player_debit:referencesSceneIngredients(entry),
    canonical_output_has_no_special_modifiers:recoveries.every((recovery)=>Object.keys(recovery||{}).length===2),
  };
  return {status:200,character,session,entry,skill,recoveries,inventory,arrowRows,ammoReceipts,existingReceipt,hashes,guards,failed:Object.entries(guards).filter(([,pass])=>!pass).map(([name])=>name)};
}

const compactBody=(inspection,token=null)=>({
  function_version:DRUID_CRAFTING_REPAIR_VERSION,classification:'completed_npc_crafting_with_misattached_unanimous_recovery',safe_to_repair:inspection.failed.length===0,repair_eligible:inspection.failed.length===0,writes:0,
  character_id:inspection.character?.id||null,session_id:inspection.session?.id||null,request_id:inspection.entry?.request_id||null,story_index:DRUID_CRAFTING_INCIDENT.story_index,canonical_item:'Arrows',award_quantity:expected.award,quantity_before:expected.quantityBefore,quantity_after:expected.quantityAfter,
  ingredient_debit:0,guards:inspection.guards||{},failed_guards:inspection.failed||[],expected_hashes:inspection.hashes||{},receipt_key:DRUID_CRAFTING_RECEIPT_KEY,apply_token:token,
});

export async function discoverDruidCraftingIncidentRepair({db,characterId,sessionId,now=Date.now(),tokenTtlMs=15*60*1000}){
  const inspection=await inspect({db,characterId,sessionId});if(inspection.status!==200)return {status:inspection.status,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:inspection.error,writes:0,failed_guards:['records_missing']}};
  let token=null;if(inspection.failed.length===0)token=await createDruidRepairApplyToken({v:DRUID_CRAFTING_REPAIR_VERSION,character_id:characterId,session_id:sessionId,request_id:inspection.entry.request_id,story_index:59,award_quantity:20,expected_hashes:inspection.hashes,iat:now,exp:now+tokenTtlMs});
  return {status:inspection.failed.length?409:200,body:compactBody(inspection,token)};
}

export async function applyDruidCraftingIncidentRepair({db,characterId,sessionId,applyToken,now=Date.now()}){
  const verified=await verifyDruidRepairApplyToken(applyToken,now);if(!verified.ok)return {status:403,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:verified.reason,writes:0,replay:false}};
  const token=verified.payload,identity=token.v===DRUID_CRAFTING_REPAIR_VERSION&&token.character_id===characterId&&token.session_id===sessionId&&token.request_id===DRUID_CRAFTING_INCIDENT.request_id&&Number(token.story_index)===59&&Number(token.award_quantity)===20;
  if(!identity)return {status:403,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:'apply_token_scope_mismatch',writes:0,replay:false}};
  const inspection=await inspect({db,characterId,sessionId});if(inspection.status!==200)return {status:inspection.status,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:inspection.error,writes:0,replay:false}};
  if(inspection.existingReceipt)return {status:200,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,success:true,writes:0,replay:true,quantity_before:inspection.existingReceipt.quantity_before,quantity_after:inspection.existingReceipt.quantity_after,receipt:inspection.existingReceipt,protected_noninventory_fields_unchanged:true}};
  const hashMatch=Object.entries(token.expected_hashes||{}).every(([key,value])=>inspection.hashes[key]===value);if(!hashMatch)return {status:409,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:'stale_live_precondition_hashes',writes:0,replay:false,failed_guards:['exact_precondition_hashes']}};
  if(inspection.failed.length)return {status:409,body:{...compactBody(inspection),error:'repair_guard_failed',apply_token:null}};
  const index=inspection.arrowRows[0].index,nextInventory=inspection.inventory.map((item,itemIndex)=>itemIndex===index?{...item,quantity:expected.quantityAfter}:item);
  const beforeNoninventory=inspection.hashes.character_noninventory,sessionHash=inspection.hashes.session;
  const receipt={version:DRUID_CRAFTING_REPAIR_VERSION,immutable:true,transaction_type:'crafting_reconciliation',original_request_id:inspection.entry.request_id,story_index:59,character_id:characterId,session_id:sessionId,canonical_item:'Arrows',award_quantity:20,quantity_before:16,quantity_after:36,ingredient_debit:0,ingredient_provenance:'scene-provided heartwood/flint/resin; no player-owned debit contract',provenance:'guarded_repair_of_misattached_recovery_metadata',source_choices_recovery_hash:inspection.hashes.choices_recovery,skill_receipt_hash:inspection.hashes.skill_receipt,story_entry_hash:inspection.hashes.story_entry,inventory_before_hash:inspection.hashes.inventory,inventory_after_hash:await hashValue(nextInventory),apply_token_signature:String(applyToken).split('.')[1],at:new Date(now).toISOString()};
  const abilities={...(inspection.character.long_rest_abilities||{}),[DRUID_CRAFTING_RECEIPT_KEY]:[...((inspection.character.long_rest_abilities||{})[DRUID_CRAFTING_RECEIPT_KEY]||[]),receipt]};
  await db.entities.Character.update(characterId,{inventory:nextInventory,long_rest_abilities:abilities});
  const [afterCharacter,afterSession]=await Promise.all([db.entities.Character.get(characterId),db.entities.GameSession.get(sessionId)]),afterRows=(afterCharacter.inventory||[]).filter((item)=>canonicalAmmoName(item?.name)==='Arrows');
  const unchanged=await hashValue(characterNonInventory(afterCharacter))===beforeNoninventory&&await hashValue(afterSession)===sessionHash;
  if(afterRows.length!==1||authoritativeAmmoUnits(afterRows[0])!==36||!unchanged)return {status:500,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,error:'repair_postcondition_failed',writes:1,replay:false,protected_noninventory_fields_unchanged:unchanged}};
  return {status:200,body:{function_version:DRUID_CRAFTING_REPAIR_VERSION,success:true,writes:1,replay:false,canonical_item:'Arrows',award_quantity:20,quantity_before:16,quantity_after:36,ingredient_debit:0,receipt,protected_noninventory_fields_unchanged:true}};
}