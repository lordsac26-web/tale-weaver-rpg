import { parseCompositeAction, COMPOSITE_ACTION_CONTRACT_VERSION } from './compositeActionContract.js';
import { resolveCanonicalSpellTarget } from '../spells/spellTargeting.ts';
import { getMaxSlotsForLevel } from '../spells/slotProgression.ts';
import { planAmmunitionUse } from '../ammunitionTransaction.ts';
import { normalizeSpellText } from '../spells/typedSpellParser.ts';

export const COMPOSITE_ACTION_PREFLIGHT_VERSION='composite-action-preflight-v1.0.0';
export function preflightCompositeAction({text,session,character,spell,sceneText='',extraActions=0,sequentialTiming=null}:any){
  const plan=parseCompositeAction(text);if(!plan)return {handled:false};
  const errors:any[]=[];
  if(!session||!character||session.character_id!==character.id)errors.push({code:'binding_invalid',message:'The session and character binding is invalid.'});
  if(session?.in_combat)errors.push({code:'story_combat_conflict',message:'This story plan cannot run while an authoritative combat is active.'});
  const spellChild=plan.children[0],attackChild=plan.children[1];
  const canonical=spell&&normalizeSpellText(spell.name)===normalizeSpellText(spellChild.spell_name)?spell:null;
  if(!canonical)errors.push({code:'canonical_spell_missing',message:`Canonical spell data is unavailable for ${spellChild.spell_name}.`});
  const target=canonical?resolveCanonicalSpellTarget({spell:canonical,actionText:text}):null;
  if(target&&!target.ok)errors.push({code:target.code,message:target.error});
  const level=Math.max(0,Number(canonical?.level)||0),used=Number(character?.spell_slots?.[`level_${level}`])||0,max=level?getMaxSlotsForLevel(character,level):0;
  if(level>0&&(max<=0||used>=max))errors.push({code:'slot_unavailable',message:`No level-${level} spell slot is available.`});
  const weapon=character?.equipped?.weapon||character?.equipped?.mainhand;
  if(!weapon||String(weapon.type||'').toLowerCase()!=='ranged')errors.push({code:'ranged_weapon_required',message:'A ranged weapon must be equipped for the shot.'});
  const ammo=weapon?planAmmunitionUse(character?.inventory||[],weapon,1):{ok:false};
  if(weapon&&!ammo.ok)errors.push({code:'ammunition_unavailable',message:ammo.error||'Required ammunition is unavailable.'});
  const targetPresent=!!attackChild.target_ref&&new RegExp(`\\b${attackChild.target_ref}\\b`,'i').test(String(sceneText||text));
  if(!targetPresent)errors.push({code:'scene_target_unresolved',message:'The guard is not a resolvable target in the authoritative scene.'});
  const actionCost=plan.children.length;
  const legalExtra=Number(extraActions)>0;
  const legalSequence=sequentialTiming&&sequentialTiming.allowed===true&&Number(sequentialTiming.elapsed_rounds)>0;
  if(actionCost>1&&!legalExtra&&!legalSequence)errors.push({code:'action_economy_conflict',message:'Casting Silence and firing the bow each require an action; no supported extra action or legal sequential timing was supplied.'});
  const alternatives=[{action_type:'spell_cast',label:'Cast Silence at a fixed point covering the escape route',consequence:'This concentration spell would replace Pass without Trace only if the cast commits.'},{action_type:'weapon_attack',label:'Take the precision shot now',consequence:'Resolve one ranged weapon attack; hit or miss consumes one arrow.'}];
  return {handled:true,valid:errors.length===0,version:COMPOSITE_ACTION_CONTRACT_VERSION,preflight_version:COMPOSITE_ACTION_PREFLIGHT_VERSION,plan:{...plan,children:plan.children.map((child:any)=>child.action_type==='spell_cast'?{...child,canonical_spell:canonical?{name:canonical.name,level,casting_time:canonical.casting_time,components:canonical.components,range:canonical.range,duration:canonical.duration,concentration:!!canonical.concentration}:null,target_result:target}:child),action_economy:{required_actions:actionCost,extra_actions:Number(extraActions)||0,sequential_timing:sequentialTiming||null,legal:actionCost<=1||legalExtra||legalSequence},receipt_chain:{parent_key:plan.parent_key,child_keys:plan.children.map((child:any)=>child.key),committed:false}},errors,alternatives,writes:0};
}