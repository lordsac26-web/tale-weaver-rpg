import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { auditNarrativeRangedAmmoOmission, NARRATIVE_RANGED_SCOPE } from '../../shared/repairs/narrativeRangedAmmoOmission.ts';
import { formatAuditorResponse } from '../../shared/repairs/auditorResponse.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();if(!user)return Response.json({error:'Unauthorized'},{status:401});
    const character=await base44.asServiceRole.entities.Character.get(NARRATIVE_RANGED_SCOPE.characterId);if(!character||character.created_by_id!==user.id)return Response.json({error:'Repair scope does not belong to the authenticated user.'},{status:403});
    const payload=await req.json().catch(()=>({})),mode=payload?.mode==='apply'?'apply':'dry_run',format=payload?.response_format==='token_only'?'token_only':'full';
    const result=await auditNarrativeRangedAmmoOmission({db:base44.asServiceRole,mode,applyToken:payload?.apply_token||null});return Response.json(formatAuditorResponse(result.body,format),{status:result.status});
  }catch(error){return Response.json({error:error.message||'Narrative ammunition audit failed.',writes:0},{status:500});}
}