import { parseCompositeAction, COMPOSITE_ACTION_FRONTEND_VERSION } from './compositeActionContract.js';

export const COMPOSITE_UI_TRANSITION_VERSION=COMPOSITE_ACTION_FRONTEND_VERSION;
export const COMPOSITE_UI_COPY={stationary:'Silence creates a stationary point-area and cannot be attached to a moving arrow.',concentration:'Pass without Trace is replaced only after a valid Silence cast commits.',economy:'Casting Silence and taking the precision shot require two actions without an extra-action feature.',fixedPoint:'Cast Silence at a fixed scene point covering the escape route',precisionShot:'Take the precision shot now'};
export const COMPOSITE_UI_CONTRACT={dispatch_order:'composite_preflight_before_spell_only',full_parent_retained:true,stable_parent_key:true,rejected_preflight:{writes:0,preserve_scene:true,preserve_choices:true,success_narration:false,loading_residue:false},valid_preflight:{receipt_chain_before_narration:true,replay_writes:0},routes:{composite_action:'composite_preflight',weapon_attack:'story_weapon_attack',skill_check:'resolve_story_skill_check'},mobile:{viewport:'100dvh',stacking:'intrinsic_min_h_0',scroll_owners:1,safe_area:true},inputs:['keyboard','touch'],network:{stale_response:'reject',retry:'same_parent_key'},narration:{interrupt_on_mechanics:false}};

export function routeStoryAction(choice={}){
  if(choice.action_type==='composite_action'||parseCompositeAction(choice.text))return 'composite_preflight';
  if(choice.action_type==='weapon_attack')return 'story_weapon_attack';
  if(choice.action_type==='skill_check')return 'resolve_story_skill_check';
  return 'story_action';
}

export function buildCompositePreflightRequest({text,classifier={},sessionId,characterId,source='free_text'}={}){
  const parsed=classifier?.composite_plan?.plan||classifier?.plan||parseCompositeAction(text);
  if(classifier?.action_type!=='composite_action'&&!parsed)return null;
  const parentKey=classifier?.parent_key||parsed?.parent_key||classifier?.composite_plan?.plan?.parent_key;
  if(!parentKey)return null;
  return {endpoint:'evaluatePlayerAction',parent_key:parentKey,request_id:`composite-preflight:${sessionId}:${parentKey}`,payload:{action:String(text||''),action_type:'composite_action',parent_key:parentKey,composite_plan:parsed,request_id:`composite-preflight:${sessionId}:${parentKey}`,session_id:sessionId,character_id:characterId,source}};
}

export function acceptCompositePreflightResponse(response,expectedParentKey){
  const actual=response?.composite_plan?.plan?.parent_key||response?.parent_key||null;
  return {accepted:response?.action_type==='composite_action'&&actual===expectedParentKey,reason:actual!==expectedParentKey?'stale_parent_key':response?.action_type!=='composite_action'?'wrong_action_type':null};
}