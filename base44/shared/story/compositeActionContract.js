export const COMPOSITE_ACTION_CONTRACT_VERSION='composite-action-contract-v1.0.1';
export const COMPOSITE_ACTION_FRONTEND_VERSION='composite-action-transition-v1.0.1';
const normalize=(value)=>String(value||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const stableKey=(value)=>{let hash=2166136261;for(const char of normalize(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);};

export function parseCompositeAction(text){
  const source=String(text||'').trim();
  const spell=source.match(/\b(?:cast|invoke)\s+([a-z][a-z' -]+?)(?=\s+(?:on|at|over|around|centered|covering)\b|\s+(?:and|then)\s+|$)/i)?.[1]?.trim();
  const weapon=/\b(shoot|fire|loose|release|precision\s+shot|attack\s+with\s+(?:a\s+)?(?:longbow|bow|crossbow))\b/i.test(source);
  if(!spell||!weapon)return null;
  const parent=`composite:${stableKey(source)}`;
  const targetText=source.match(/\b(?:on|at|over|around|centered\s+on|covering)\s+(.+?)(?=\s+(?:and|then)\s+(?:shoot|fire|loose|release|attack)|$)/i)?.[1]?.trim()||null;
  const guard=/\bguard\b/i.test(source)?'guard':null;
  return {version:COMPOSITE_ACTION_CONTRACT_VERSION,action_type:'composite_action',parent_key:parent,text:source,children:[{key:`${parent}:spell:0`,index:0,action_type:'spell_cast',spell_name:spell,target_proposal:targetText},{key:`${parent}:weapon:1`,index:1,action_type:'weapon_attack',weapon_hint:/crossbow/i.test(source)?'Crossbow':'Longbow',target_ref:guard,attack_mode:'ranged',intent:/precision|incapacitate|nonlethal/i.test(source)?'incapacitate_requested':'damage'}],ordered:true};
}