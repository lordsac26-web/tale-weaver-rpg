import { advanceWorldClockForWait } from './worldClock.ts';

export const INFILTRATION_ADVANCEMENT_VERSION='infiltration-success-advancement-v1.0.0';
export const INFILTRATION_RECEIPTS_KEY='__infiltration_advancement_receipts';
const INFILTRATION=/\b(guard|patrol|infiltrat|sneak|conceal|hidden|undetected|apothecary|cellar|hatch|service entrance|loading bay|bait|lock|upper.level window)\b/i;
const WAITING=/\b(wait|observe|watch|remain|stay|patient|rotation|shift change|pattern)\b/i;
const STATIC_SUCCESS=/\bno further action is taken\b|\bnothing changes\b|\bremain still and patient\b/i;
const stop=new Set(['the','and','that','this','with','from','into','while','your','for','his','her','their','then','you','are','was','were','have','has','had','attempt','carefully','quietly']);
export const normalizeBeat=(value)=>String(value||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const tokenSet=(value)=>new Set(normalizeBeat(value).split(' ').filter((token)=>token.length>2&&!stop.has(token)));
export function storyBeatSimilarity(left,right){const a=tokenSet(left),b=tokenSet(right),intersection=[...a].filter((token)=>b.has(token)).length,union=new Set([...a,...b]).size;return union?intersection/union:0;}
const choicesText=(choices)=>(Array.isArray(choices)?choices:[]).map((choice)=>choice?.text||'').join(' ');
export const choiceSetSimilarity=(left,right)=>storyBeatSimilarity(choicesText(left),choicesText(right));
const intentKey=(value)=>[...tokenSet(value)].sort().join('_').slice(0,160);
const positionFor=(action,stage)=>/\b(inside|enter|slip inside|cellar|hatch|window|door|pick the lock)\b/i.test(action)?'inside_objective':stage>1?'at_objective_entry':'concealed_vantage';
const threatFor=(stage)=>stage===1?'committed_to_bait':stage===2?'past_bait_rotation_continuing':stage===3?'away_from_objective_entry':'new_patrol_development';
const fallbackChoices=(stage)=>[
  {text:`Use the stage ${stage} opening to move deeper toward the objective.`,action_type:'movement',risk_level:'medium'},
  {text:'Study the newly exposed route for traps or witnesses.',action_type:'skill_check',skill_check:'Perception',dc:12,risk_level:'low'},
  {text:'Secure a quiet exit route before proceeding.',action_type:'skill_check',skill_check:'Stealth',dc:13,risk_level:'medium'},
  {text:'Pause at the new position and reassess the changed patrol pattern.',action_type:'utility',risk_level:'low'},
];
const fallbackNarrative=(plan,success)=>success
  ?`The opening changes decisively: the guard ${plan.after.threat_position.replace(/_/g,' ')}, and you move from ${plan.before.player_position.replace(/_/g,' ')} to ${plan.after.player_position.replace(/_/g,' ')} without being discovered. The infiltration advances to stage ${plan.after.stage}; the previous static moment cannot repeat.`
  :`Your attempt does not create the opening you expected. The guard alters the patrol rhythm and the approach becomes less predictable, forcing you to reassess from your current position rather than replay the same moment.`;
const exactReceipt=(stored,incoming,requestId)=>stored&&incoming&&stored.request_id===requestId&&incoming.request_id===requestId&&stored.unified_story_skill_resolution===true&&JSON.stringify(stored)===JSON.stringify(incoming);

export function planInfiltrationAdvancement({session,actionText,check,requestId}){
  const previous=(session?.story_log||[]).at(-1)||null,sceneText=`${previous?.text||''} ${choicesText(previous?.choices)} ${actionText||''}`;
  if(!INFILTRATION.test(sceneText)||!check||!requestId)return null;
  const persisted=(session?.world_state?.__skill_check_receipts||[]).find((receipt)=>receipt?.request_id===requestId);
  if(!exactReceipt(persisted,check,requestId))return null;
  const receipts=session.world_state?.[INFILTRATION_RECEIPTS_KEY]||[],prior=receipts.find((receipt)=>receipt.request_id===requestId);
  if(prior)return {handled:true,replayed:true,writes:0,success:prior.success,receipt:prior,before:prior.before,after:prior.after,clock:prior.clock||null};
  const before={stage:Number(session.world_state?.infiltration?.stage||0),progress:Number(session.world_state?.infiltration?.progress||0),threat_position:session.world_state?.infiltration?.threat_position||'patrolling_near_objective',guard_awareness:session.world_state?.infiltration?.guard_awareness||'unaware',player_position:session.world_state?.infiltration?.player_position||'concealed_vantage',discovered:session.world_state?.infiltration?.discovered===true};
  const success=check.success===true,key=intentKey(actionText),repeated=key&&key===session.world_state?.infiltration?.last_intent_key;
  if(!success)return {handled:true,replayed:false,writes:0,success:false,before,after:before,clock:null,repeated_intent:repeated,intent_key:key};
  const stage=before.stage+1,after={...before,stage,progress:Math.min(100,before.progress+25),threat_position:threatFor(stage),guard_awareness:'unaware',player_position:positionFor(actionText,stage),discovered:false,last_intent_key:key,last_request_id:requestId,repeated_intent_count:repeated?Number(session.world_state?.infiltration?.repeated_intent_count||0)+1:0};
  const waiting=WAITING.test(actionText),clock=waiting?advanceWorldClockForWait({timeOfDay:session.time_of_day,worldState:session.world_state,elapsedHours:.25}):null;
  const receipt={version:INFILTRATION_ADVANCEMENT_VERSION,immutable:true,request_id:requestId,skill_receipt_id:check.id||check.request_id,success:true,intent_key:key,repeated_intent:repeated,before,after,clock:clock?.clock||null,at:new Date().toISOString()};
  return {handled:true,replayed:false,writes:1,success:true,before,after,clock,repeated_intent:repeated,intent_key:key,receipt};
}

export async function guardInfiltrationBeat({candidate,previousEntry,plan,regenerate}){
  if(!plan)return {result:candidate,guard:{triggered:false,reason:'not_infiltration'}};
  const inspect=(value)=>({narrative_similarity:storyBeatSimilarity(previousEntry?.text,value?.narrative),choice_similarity:choiceSetSimilarity(previousEntry?.choices,value?.choices),static_success:plan.success&&STATIC_SUCCESS.test(value?.narrative||'')});
  let result=candidate,metrics=inspect(result),triggered=metrics.narrative_similarity>=.72||metrics.choice_similarity>=.82||metrics.static_success,regenerated=false;
  if(triggered&&regenerate){const revised=await regenerate({metrics,plan});if(revised?.narrative){result=revised;metrics=inspect(result);regenerated=true;}}
  const stillInvalid=metrics.narrative_similarity>=.72||metrics.choice_similarity>=.82||metrics.static_success;
  if(stillInvalid)result={...result,narrative:fallbackNarrative(plan,plan.success),choices:fallbackChoices(plan.success?plan.after.stage:plan.before.stage),combat_trigger:false,enemies:[]};
  if(plan.success)result={...result,scene_advancement:{version:INFILTRATION_ADVANCEMENT_VERSION,request_id:plan.receipt?.request_id,before:plan.before,after:plan.after,clock:plan.clock?.clock||null,repeated_intent:plan.repeated_intent},combat_trigger:false,enemies:[]};
  return {result,guard:{triggered,regenerated,fallback_used:stillInvalid,reason:metrics.static_success?'static_success':metrics.narrative_similarity>=.72?'near_duplicate_narration':metrics.choice_similarity>=.82?'near_duplicate_choices':'distinct',...metrics}};
}

export function buildInfiltrationSessionUpdate({session,plan}){
  if(!plan?.success||plan.replayed)return null;
  const receipts=session.world_state?.[INFILTRATION_RECEIPTS_KEY]||[];
  const base=plan.clock?.world_state||session.world_state||{};
  return {time_of_day:plan.clock?.time_of_day||session.time_of_day,world_state:{...base,infiltration:plan.after,[INFILTRATION_RECEIPTS_KEY]:[...receipts.slice(-49),plan.receipt]}};
}