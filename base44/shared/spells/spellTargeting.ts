import { normalizeSpellText } from './typedSpellParser.ts';

export const SPELL_TARGETING_VERSION = 'canonical-spell-targeting-v1.0.0';
const MOVING_ATTACHMENT = /\bon\s+(?:the\s+|an?\s+)?(arrow|bolt|ammunition|weapon|projectile)\b/i;
const FIXED_POINT = /\b(?:at|over|around|centered\s+on|covering)\s+(?:the\s+|an?\s+)?([^,.]+?)(?=\s+(?:and|then)\s+(?:shoot|fire|attack|loose|release)\b|[,.]|$)/i;

export function canonicalSpellTargetProfile(spell:any={}) {
  const description=String(spell.description||spell.effect_summary||'');
  const lower=description.toLowerCase();
  const pointTarget=/\bcentered on a point\b|\bpoint you choose\b|\bpoint within range\b/.test(lower);
  const creatureTarget=!pointTarget&&/\btarget creature\b|\bcreature (?:you can see|within range|you touch)\b/.test(lower);
  const radius=Number(lower.match(/(\d+)\s*-?foot-radius/)?.[1]||0)||null;
  const range=Number(String(spell.range||'').match(/(\d+)/)?.[1]||0)||null;
  return {version:SPELL_TARGETING_VERSION,kind:pointTarget?'point_area':creatureTarget?'creature':'unspecified',range_feet:range,area_radius_feet:radius,concentration:spell.concentration===true,casting_time:String(spell.casting_time||''),components:String(spell.components||''),duration:String(spell.duration||''),canonical_name:String(spell.name||'')};
}

export function resolveCanonicalSpellTarget({spell,actionText,target}:any) {
  const profile=canonicalSpellTargetProfile(spell);
  const text=String(actionText||'');
  if(profile.kind==='point_area'){
    const attachment=text.match(MOVING_ATTACHMENT);
    if(attachment)return {ok:false,status:409,profile,target:null,code:'moving_object_attachment_invalid',error:`${spell.name} creates a stationary area centered on a point; it cannot be attached to a moving ${attachment[1].toLowerCase()}. Choose a fixed point within ${profile.range_feet||'the spell’s'}-foot range.`};
    const supplied=target&&typeof target==='object'&&target.kind==='point'?String(target.anchor||'').trim():'';
    const parsed=String(text.match(FIXED_POINT)?.[1]||'').trim();
    const anchor=supplied||parsed;
    if(!anchor)return {ok:false,status:409,profile,target:null,code:'structured_point_required',error:`${spell.name} requires a specific fixed point or scene anchor within ${profile.range_feet||'its'}-foot range.`};
    const distance=Number(target?.distance_feet);
    if(Number.isFinite(distance)&&profile.range_feet&&distance>profile.range_feet)return {ok:false,status:409,profile,target:null,code:'point_out_of_range',error:`The chosen point is ${distance} feet away, beyond ${spell.name}’s ${profile.range_feet}-foot range.`};
    return {ok:true,status:200,profile,target:{kind:'point',anchor:normalizeSpellText(anchor),display_anchor:anchor,distance_feet:Number.isFinite(distance)?distance:null,within_range:!Number.isFinite(distance)||!profile.range_feet||distance<=profile.range_feet,stationary:true}};
  }
  if(profile.kind==='creature'){
    const creature=target&&typeof target==='object'&&target.kind==='creature'&&target.id?target:null;
    return creature?{ok:true,status:200,profile,target:creature}:{ok:false,status:409,profile,target:null,code:'creature_target_required',error:`${spell.name} requires a specific valid creature target.`};
  }
  return {ok:true,status:200,profile,target:target||{kind:'self',id:null}};
}