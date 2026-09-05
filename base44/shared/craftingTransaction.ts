import { canonicalAmmoName } from './ammunition.ts';
import { hashValue } from './tests/liveProtection.ts';

export const CRAFTING_TRANSACTION_VERSION='authoritative-crafting-transaction-v1.0.1';
export const CRAFTING_RECEIPTS_KEY='__crafting_receipts';
const icons={Ammunition:{common:'🏹⚪',uncommon:'🏹🟢',rare:'🏹🔵',legendary:'🏹🟠'}};
const norm=(value)=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const positive=(value)=>Number.isInteger(Number(value))&&Number(value)>0;
const identity=(item)=>String(item?.crafting_identity||item?.item_id||item?.equipment_id||'');
const findStacks=(inventory,name)=>inventory.map((item,index)=>({item,index})).filter(({item})=>norm(item?.name)===norm(name));

export function craftingNarrationNeedsReceipt(actionText,narration){return /\b(?:craft|make|shape|knap|fletch)\w*\b/i.test(actionText||'')&&/\b(?:ammunition|arrows?|bolts?)\b/i.test(`${actionText||''} ${narration||''}`)&&/\b(?:final arrow|received|added to (?:your|the) (?:inventory|quiver)|crafted|produced|secured the means)\b/i.test(narration||'');}

export function planCraftingTransaction({character,session,requestId,recipe,check}){
  if(!requestId||!recipe?.recipe_id||!positive(recipe.yield_quantity)||!recipe.output?.name)return {ok:false,status:400,reason:'exact_recipe_and_yield_required'};
  if(recipe.invocation_type==='druidcraft_cantrip')return {ok:false,status:409,reason:'druidcraft_cantrip_cannot_create_combat_ammunition'};
  if(check?.success!==true)return {ok:false,status:409,reason:'successful_check_required'};
  if(recipe.completed!==true)return {ok:false,status:409,reason:'crafting_progress_is_not_completed_output'};
  if(!positive(recipe.time_minutes)||!recipe.tool?.name||!recipe.tool?.provenance)return {ok:false,status:409,reason:'crafting_tool_and_time_provenance_required'};
  if(!Array.isArray(recipe.ingredients)||recipe.ingredients.length===0)return {ok:false,status:409,reason:'structured_ingredients_required'};
  const output={...recipe.output,quantity:Number(recipe.yield_quantity),category:'Ammunition',stackable:true,unit:recipe.output.unit||'piece',rarity:recipe.output.rarity||'common',compatible_ammo_type:recipe.output.compatible_ammo_type||null,compatible_weapon:recipe.output.compatible_weapon||null,source:recipe.output.source||'Authoritative Crafting',recipe_id:recipe.recipe_id,provenance:recipe.provenance||null,icon:icons.Ammunition[recipe.output.rarity||'common']||icons.Ammunition.common};
  if(output.attack_bonus||output.damage_bonus||output.damage_modifier||output.range_modifier)return {ok:false,status:409,reason:'unsupported_ammunition_bonus'};
  const inventory=(character.inventory||[]).map((item)=>({...item})),ingredients=[];
  for(const required of recipe.ingredients||[]){
    if(!positive(required.quantity)||!required.name)return {ok:false,status:409,reason:'ambiguous_ingredient'};
    if(required.source==='scene_resource'){
      const resources=session.world_state?.__scene_resources||[];
      const exact=resources.filter((resource)=>resource?.provenance_id===required.provenance_id&&norm(resource?.name)===norm(required.name)&&Number(resource?.quantity)>=Number(required.quantity));
      if(exact.length!==1||required.consumed!==false)return {ok:false,status:409,reason:'scene_resource_provenance_or_atomicity_invalid'};
      ingredients.push({...required,quantity_before:Number(exact[0].quantity),quantity_after:Number(exact[0].quantity),consumed:false});continue;
    }
    const matches=findStacks(inventory,required.name).filter(({item})=>Number(item.quantity)>=Number(required.quantity));
    if(matches.length!==1)return {ok:false,status:409,reason:'ingredient_missing_or_ambiguous'};
    const target=matches[0],before=Number(target.item.quantity),after=before-Number(required.quantity);
    inventory[target.index]={...target.item,quantity:after};ingredients.push({...required,source:'inventory',quantity_before:before,quantity_after:after,consumed:true});
  }
  const canonical=canonicalAmmoName(output.name),ordinary=canonical&&recipe.mechanically_identical===true;
  let outputIndex=-1;
  if(ordinary)outputIndex=inventory.findIndex((item)=>canonicalAmmoName(item?.name)===canonical);
  else {const matches=inventory.map((item,index)=>({item,index})).filter(({item})=>identity(item)&&identity(item)===identity(output));if(matches.length>1)return {ok:false,status:409,reason:'ambiguous_special_ammunition_stack'};outputIndex=matches[0]?.index??-1;}
  const beforeOutput=outputIndex>=0?Number(inventory[outputIndex].quantity||0):0;
  if(outputIndex>=0)inventory[outputIndex]={...inventory[outputIndex],quantity:beforeOutput+output.quantity};else inventory.push({...output,name:ordinary?canonical:output.name,crafting_identity:ordinary?undefined:(output.crafting_identity||`${recipe.recipe_id}:${norm(output.name)}`)});
  return {ok:true,status:200,inventory,ingredients,output:{...output,name:ordinary?canonical:output.name,quantity_before:beforeOutput,quantity_after:beforeOutput+output.quantity,mechanically_identical:!!ordinary},writes:1};
}

export async function executeCraftingTransaction({base44,ownerId=null,characterId,sessionId,requestId,recipe,check}){
  const [character,session]=await Promise.all([base44.asServiceRole.entities.Character.get(characterId),base44.asServiceRole.entities.GameSession.get(sessionId)]);
  if(!character||!session||session.character_id!==characterId||(ownerId&&character.created_by_id!==ownerId))return {status:403,body:{applied:false,reason:'character_session_mismatch',writes:0}};
  const receipts=character.long_rest_abilities?.[CRAFTING_RECEIPTS_KEY]||[],inputHash=await hashValue({characterId,sessionId,requestId,recipe,check_success:check?.success===true});
  const prior=receipts.find((receipt)=>receipt.request_id===requestId);
  if(prior)return prior.input_hash===inputHash?{status:200,body:{applied:true,already_processed:true,receipt:prior,writes:0}}:{status:409,body:{applied:false,reason:'idempotency_scope_mismatch',writes:0}};
  const plan=planCraftingTransaction({character,session,requestId,recipe,check});if(!plan.ok)return {status:plan.status,body:{applied:false,reason:plan.reason,writes:0}};
  const beforeHash=await hashValue(character.inventory||[]),afterHash=await hashValue(plan.inventory);
  const receipt={version:CRAFTING_TRANSACTION_VERSION,immutable:true,transaction_type:'crafting',request_id:requestId,character_id:characterId,session_id:sessionId,input_hash:inputHash,recipe_id:recipe.recipe_id,canonical_item:plan.output.name,yield_quantity:Number(recipe.yield_quantity),output:plan.output,ingredients:plan.ingredients,provenance:recipe.provenance||null,inventory_before_hash:beforeHash,inventory_after_hash:afterHash,at:new Date().toISOString()};
  const abilities={...(character.long_rest_abilities||{}),[CRAFTING_RECEIPTS_KEY]:[...receipts.slice(-49),receipt]};
  await base44.asServiceRole.entities.Character.update(characterId,{inventory:plan.inventory,long_rest_abilities:abilities});
  return {status:200,body:{applied:true,already_processed:false,receipt,inventory:plan.inventory,writes:1}};
}