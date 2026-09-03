import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { auditInfiltrationSuccessLoop, INFILTRATION_LOOP_AUDIT_VERSION } from '../../shared/repairs/infiltrationSuccessLoopAudit.ts';

const CHARACTER_ID='6a6825cd07a490fa70a46852',SESSION_ID='6a6825edd695bd65a4322256';
export default async function(req){
  try{
    const payload=await req.json().catch(()=>({}));
    if(payload.character_id!==CHARACTER_ID||payload.session_id!==SESSION_ID)return Response.json({function_version:INFILTRATION_LOOP_AUDIT_VERSION,error:'Exact protected incident identifiers are required.',writes:0},{status:403});
    const db=createClientFromRequest(req).asServiceRole;
    const result=await auditInfiltrationSuccessLoop({db,characterId:CHARACTER_ID,sessionId:SESSION_ID});
    return Response.json(result.body,{status:result.status});
  }catch(error){return Response.json({function_version:INFILTRATION_LOOP_AUDIT_VERSION,error:error.message||'Infiltration loop audit failed.',writes:0},{status:500});}
}