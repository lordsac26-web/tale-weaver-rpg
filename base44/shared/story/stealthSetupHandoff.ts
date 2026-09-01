import { normalizeConditionName } from '../combat/conditions.ts';

export const STEALTH_SETUP_HANDOFF_VERSION = 'stealth-setup-handoff-v1.0.0';

export function classifyStealthSetupIntent(actionText, receipt) {
  const text=String(actionText||'').toLowerCase();
  const successful=receipt?.unified_story_skill_resolution===true&&String(receipt?.skill).toLowerCase()==='stealth'&&receipt?.success===true;
  const concealment=/\b(hide|hiding|hidden|conceal|concealed|avoid(?:ing)? notice|stealth bonus)\b/.test(text);
  const surprise=/\b(surprise|ambush|unseen)\b/.test(text);
  const futureAttack=/\b(?:will|would|then|next|once\b[^.]{0,80}\b(?:done|ready))\b[^.]{0,120}\b(?:attack|strike|shoot|fire|launch|volley|arrow)/.test(text);
  const attackAlreadyResolved=/\b(?:i|we)\s+(?:attack|strike|shoot|fire|launch)\b/.test(text)&&!futureAttack;
  const establishesConcealment=successful&&!attackAlreadyResolved&&concealment&&surprise&&futureAttack;
  return {classification:establishesConcealment?'explicit_future_surprise_setup':'no_structured_stealth_handoff',successful_stealth:successful,concealment_language:concealment,surprise_language:surprise,future_attack_language:futureAttack,attack_already_resolved:attackAlreadyResolved,establishes_concealment:establishesConcealment};
}

export function canonicalStoryStealthedCondition({characterId,sessionId,requestId,receipt}) {
  return {id:`cond_stealthed_${String(requestId||'').replace(/[^a-zA-Z0-9]+/g,'_').slice(-72)}`,name:'stealthed',display_name:'Stealthed',source:'Authoritative Stealth setup',target_id:characterId,caster_id:characterId,applied_at:receipt?.at||new Date().toISOString(),duration_type:'persistent',expires_round:null,expires_at:null,remaining_rounds:null,expiration_timing:'attack_reveal_detection_or_explicit_end',save_dc:null,save_ability:null,save_ends:false,break_on_attack:true,concentration:false,metadata:{session_id:sessionId,source_request_id:requestId,skill_receipt_id:receipt?.id||receipt?.request_id,classification:'explicit_future_surprise_setup',advantage_attribution:'Attacking from Stealthed/concealed'}};
}

export function withCanonicalStoryStealthed(conditions, condition) {
  return [...(conditions||[]).filter((entry)=>normalizeConditionName(typeof entry==='string'?entry:entry?.name)!=='stealthed'),condition];
}