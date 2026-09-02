import { advanceWorldClockForWait, getClockHour, getPeriodForHour } from './worldClock.ts';

export const SHORT_WAIT_VERSION='authoritative-short-wait-v1.0.0';
export const TIME_RECEIPTS_KEY='__time_advance_receipts';
const PERIOD_HOUR={Midnight:0,Dawn:5,Morning:8,Midday:12,Afternoon:13,Dusk:17,Evening:20,Night:23};
const WAIT=/\b(wait|stay|pass(?:ing)?\s+(?:the\s+)?time|remain|linger|kill\s+time|head\s+out|leave\s+(?:at|in)|until)\b/i;
const NEGATED=/\b(?:do\s+not|don't|won't|cannot|can't|without)\s+(?:wait|stay|remain|linger)|\b(?:should|could|can|may)\s+(?:i|we)\s+(?:wait|stay)|\?\s*$/i;
const TARGET=/\b(?:until|by|at|in|head\s+out\s+in|leave\s+in)\s+(?:the\s+)?(midnight|dawn|morning|midday|afternoon|dusk|evening|night)\b/i;
const DURATION=/\b(?:(\d+(?:\.\d+)?)|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|a|an|few|couple(?:\s+of)?)\s+(minutes?|hours?)\b/i;
const NUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
const title=(v)=>v.charAt(0).toUpperCase()+v.slice(1).toLowerCase();
const durationMinutes=(text)=>{const m=String(text||'').match(DURATION);if(!m)return null;const token=m[0].toLowerCase(),n=m[1]?Number(m[1]):m[2]?NUM[m[2].toLowerCase()]:token.startsWith('few')?3:token.startsWith('couple')?2:1;return /minute/.test(token)?n:n*60;};
const effectMinutes=(effect)=>{const text=`${effect?.duration||''} ${effect?.source||effect?.name||''}`.toLowerCase();const m=text.match(/(\d+)\s*(minute|hour)/);if(m)return Number(m[1])*(m[2]==='hour'?60:1);if(text.includes('pass without trace'))return 60;return null;};

export function parseShortWaitIntent(actionText){
  const text=String(actionText||'').trim();if(!text||NEGATED.test(text)||!WAIT.test(text))return null;
  const targetMatch=text.match(TARGET),target=targetMatch?title(targetMatch[1]):null,minutes=durationMinutes(text);
  if(!target&&!minutes)return null;
  return {classification:target?'target_period_wait':'explicit_duration_wait',target_period:target,explicit_minutes:minutes,source_text:text};
}
export function planShortWait({intent,timeOfDay,worldState}){
  const beforeHour=getClockHour({timeOfDay,worldState});let minutes=intent.explicit_minutes;
  if(intent.target_period){const targetHour=PERIOD_HOUR[intent.target_period];let hours=(targetHour-beforeHour+24)%24;if(hours===0)hours=24;minutes=hours*60;}
  if(!Number.isFinite(minutes)||minutes<=0)return null;
  return {before_hour:beforeHour,elapsed_minutes:minutes,elapsed_hours:minutes/60,target_period:intent.target_period,after_period:getPeriodForHour((beforeHour+minutes/60)%24)};
}
export function expireEffectsForWait({character,session,elapsedMinutes}){
  const expired=[];
  const modifiers=(character.active_modifiers||[]).filter((effect)=>{const duration=effectMinutes(effect),remove=duration!=null&&elapsedMinutes>=duration;if(remove)expired.push({kind:'modifier',id:effect.id||null,name:effect.source||effect.effect});return !remove;});
  const active=session.world_state?.active_concentration,duration=effectMinutes(active),breakConcentration=!!active&&duration!=null&&elapsedMinutes>=duration;
  if(breakConcentration)expired.push({kind:'concentration',id:active.request_id||null,name:active.spell_name});
  const expiredNames=new Set(expired.map((x)=>String(x.name||'').toLowerCase()));
  const conditions=(character.conditions||[]).filter((effect)=>{const name=String(effect?.source||effect?.name||effect||'').toLowerCase(),timed=effect?.duration_type==='timestamp'||effect?.concentration===true,d=effectMinutes(effect),remove=(timed&&d!=null&&elapsedMinutes>=d)||expiredNames.has(name);if(remove)expired.push({kind:'condition',id:effect?.id||null,name:effect?.display_name||effect?.name||String(effect)});return !remove;});
  return {conditions,active_modifiers:modifiers,active_concentration:breakConcentration?null:active,expired_effects:expired};
}
export async function executeAuthoritativeShortWait({base44,ownerId,sessionId,characterId,requestId,actionText}){
  const intent=parseShortWaitIntent(actionText);if(!intent)return {status:200,body:{handled:false,writes:0}};
  const db=base44.asServiceRole,[session,character]=await Promise.all([db.entities.GameSession.get(sessionId),db.entities.Character.get(characterId)]);
  if(!session||!character||session.character_id!==characterId||(ownerId&&character.created_by_id!==ownerId))return {status:403,body:{handled:true,error:'Character/Session ownership mismatch.',writes:0}};
  if(session.in_combat)return {status:409,body:{handled:true,error:'Time cannot be skipped during active combat.',writes:0}};
  const receipts=session.world_state?.[TIME_RECEIPTS_KEY]||[],prior=receipts.find((r)=>r.request_id===requestId);if(prior)return {status:200,body:{handled:true,success:true,already_processed:true,writes:0,time_advance:prior,session,character}};
  const plan=planShortWait({intent,timeOfDay:session.time_of_day,worldState:session.world_state});if(!plan)return {status:409,body:{handled:true,error:'Wait intent did not resolve to positive game time.',writes:0}};
  const effects=expireEffectsForWait({character,session,elapsedMinutes:plan.elapsed_minutes}),clock=advanceWorldClockForWait({timeOfDay:session.time_of_day,worldState:session.world_state,elapsedHours:plan.elapsed_hours});
  const receipt={request_id:requestId,version:SHORT_WAIT_VERSION,immutable:true,intent,clock:clock.clock,expired_effects:effects.expired_effects,rest:false,resources_restored:false,at:new Date().toISOString()};
  const characterChanged=JSON.stringify([effects.conditions,effects.active_modifiers])!==JSON.stringify([character.conditions||[],character.active_modifiers||[]]);
  if(characterChanged)await db.entities.Character.update(characterId,{conditions:effects.conditions,active_modifiers:effects.active_modifiers});
  const worldState={...clock.world_state,[TIME_RECEIPTS_KEY]:[...receipts.slice(-49),receipt]};if(effects.active_concentration)worldState.active_concentration=effects.active_concentration;else delete worldState.active_concentration;
  try{await db.entities.GameSession.update(sessionId,{time_of_day:clock.time_of_day,world_state:worldState});}catch(error){if(characterChanged)await db.entities.Character.update(characterId,{conditions:character.conditions||[],active_modifiers:character.active_modifiers||[]});return {status:500,body:{handled:true,error:`Clock commit failed; effect changes compensated: ${error.message}`,writes:0,compensated:true}};}
  const [nextSession,nextCharacter]=await Promise.all([db.entities.GameSession.get(sessionId),db.entities.Character.get(characterId)]);
  return {status:200,body:{handled:true,success:true,already_processed:false,writes:characterChanged?2:1,time_advance:receipt,session:nextSession,character:nextCharacter}};
}