export const AUDITOR_TOKEN_ONLY_FORMAT='token_only';

export function formatAuditorResponse(body,responseFormat){
  if(responseFormat!==AUDITOR_TOKEN_ONLY_FORMAT)return body;
  const guards=body?.guards||{},failedGuards=Object.entries(guards).filter(([,passed])=>!passed).map(([name])=>name);
  const compact={success:body?.success===true,mode:body?.mode||null,function_version:body?.function_version||null,classification:body?.classification||null,safe_to_repair:body?.safe_to_repair===true,writes:Number(body?.writes||0),all_guards_true:failedGuards.length===0,proposal_hash:body?.proposal_hash||null,apply_token:body?.apply_token||null};
  if(body?.error)compact.error=String(body.error).slice(0,180);
  if(failedGuards.length)compact.failed_guards=failedGuards.slice(0,12);
  return compact;
}