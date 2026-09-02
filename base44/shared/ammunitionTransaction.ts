import { ammoForWeapon, authoritativeAmmoUnits, availableAmmo, canonicalAmmoName, normalizeAmmoStack } from './ammunition.ts';
import { appendRecoverableItem, buildRecoverableItem } from './story/recoveryTransaction.ts';
import { hashStoryValue } from './story/storyTransition.ts';

export const AMMUNITION_TRANSACTION_VERSION='authoritative-ammunition-transaction-v1.0.0';
export const AMMO_RECEIPTS='__ammo_attack_receipts';
const normalize=(value)=>String(value||'').toLowerCase().trim();
const stableIdentity=(item,index)=>String(item?.instance_id||item?.item_id||item?.equipment_id||`inventory-index:${index}`);

export function weaponAmmunitionRequirement(weapon){
  const properties=(weapon?.properties||[]).map(normalize),usesAmmo=normalize(weapon?.type)==='ranged'&&properties.some((property)=>/^ammunition(?:\s|\(|$)/.test(property));
  return usesAmmo?{required:true,ammo_name:ammoForWeapon(weapon?.name),weapon_name:String(weapon?.name||''),range_metadata:properties.filter((property)=>property.startsWith('ammunition'))}:{required:false,ammo_name:null,weapon_name:String(weapon?.name||''),range_metadata:[]};
}

export function planAmmunitionUse(inventory,weapon,attackCount=1){
  const requirement=weaponAmmunitionRequirement(weapon),count=Number(attackCount);
  if(!requirement.required)return {ok:true,required:false,consumed:0,inventory:[...(inventory||[])],remaining:null,stacks:[]};
  if(!requirement.ammo_name)return {ok:false,status:400,error:'The weapon ammunition type is not supported.'};
  if(!Number.isInteger(count)||count<1)return {ok:false,status:400,error:'A positive structured attack-roll count is required.'};
  const before=availableAmmo(inventory||[],requirement.ammo_name);
  if(before<count)return {ok:false,status:400,error:`Insufficient ammunition (${requirement.ammo_name}): need ${count}, have ${before}.`,available:before,required_count:count};
  let remainingToConsume=count;const stacks=[];
  const next=(inventory||[]).map((item,index)=>{
    if(remainingToConsume<=0||canonicalAmmoName(item?.name)!==requirement.ammo_name)return item;
    const units=authoritativeAmmoUnits(item);if(units<=0)return item;
    const consumed=Math.min(units,remainingToConsume);remainingToConsume-=consumed;stacks.push({identity:stableIdentity(item,index),index,quantity_before:units,quantity_after:units-consumed,consumed});
    return {...normalizeAmmoStack(item),quantity:units-consumed};
  });
  return {ok:true,required:true,ammo_name:requirement.ammo_name,weapon_name:requirement.weapon_name,range_metadata:requirement.range_metadata,consumed:count,quantity_before:before,quantity_after:before-count,remaining:before-count,inventory:next,stacks};
}

export async function commitAuthoritativeAmmunition({base44,ownerId=null,characterId,sessionId,combatId=null,requestId,weapon,attackRolls,attackResults=[],source='structured_combat_attack',location=null}){
  const count=Number(attackRolls);if(!requestId)return {status:400,body:{success:false,error:'requestId is required.',writes:0}};
  const [character,session]=await Promise.all([base44.asServiceRole.entities.Character.get(characterId),base44.asServiceRole.entities.GameSession.get(sessionId)]);
  if(!character||!session||session.character_id!==characterId||(ownerId&&character.created_by_id!==ownerId))return {status:403,body:{success:false,error:'Ammunition ownership chain is invalid.',writes:0}};
  const receipts=character.long_rest_abilities?.[AMMO_RECEIPTS]||[],prior=receipts.find((entry)=>entry.request_id===requestId);
  if(prior)return {status:200,body:{success:true,already_processed:true,writes:0,receipt:prior,inventory:character.inventory||[]}};
  const plan=planAmmunitionUse(character.inventory||[],weapon,count);
  if(!plan.ok)return {status:plan.status||409,body:{success:false,invalid:true,error:plan.error,writes:0,available:plan.available}};
  if(!plan.required)return {status:200,body:{success:true,ammunition_required:false,already_processed:false,writes:0,receipt:null,inventory:character.inventory||[]}};
  const beforeHash=await hashStoryValue(character.inventory||[]),afterHash=await hashStoryValue(plan.inventory),receipt={version:AMMUNITION_TRANSACTION_VERSION,immutable:true,request_id:requestId,character_id:characterId,session_id:sessionId,combat_id:combatId,source,weapon:{name:plan.weapon_name,identity:String(weapon?.instance_id||weapon?.item_id||weapon?.equipment_id||weapon?.canonical_item_id||plan.weapon_name),properties:weapon?.properties||[]},ammo_name:plan.ammo_name,attack_roll_count:count,attack_results:(attackResults||[]).map((entry)=>({target_id:entry.target_id||null,target:entry.target||null,raw_d20:entry.raw_d20,all_rolls:entry.all_rolls||[],hit:entry.hit===true,advantage:entry.advantage===true,advantage_sources:entry.advantage_sources||[],feature:entry.feature||null})),consumed:plan.consumed,quantity_before:plan.quantity_before,quantity_after:plan.quantity_after,remaining:plan.quantity_after,consumed_index:plan.stacks[0]?.index??null,stacks:plan.stacks,inventory_before_hash:beforeHash,inventory_after_hash:afterHash,range_property_is_metadata:true,at:new Date().toISOString()};
  let abilities={...(character.long_rest_abilities||{}),[AMMO_RECEIPTS]:[...receipts.slice(-74),receipt]};
  abilities=appendRecoverableItem(abilities,buildRecoverableItem({originRequestId:requestId,characterId,sessionId,combatId,location:location||session.current_location,canonicalName:plan.ammo_name,quantity:count,sourceAction:source,itemSnapshot:{name:plan.ammo_name,category:'Ammunition',quantity:count,unit:plan.ammo_name==='Arrows'?'arrow':plan.ammo_name==='Bolts'?'bolt':'sling bullet',stack_semantics:'individual'}}));
  await base44.asServiceRole.entities.Character.update(characterId,{inventory:plan.inventory,long_rest_abilities:abilities});
  return {status:200,body:{success:true,already_processed:false,writes:1,receipt,inventory:plan.inventory}};
}