import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { auditPwtFutureVolleySetup, LIVE_PWT_FUTURE_VOLLEY_SCOPE } from '../../shared/repairs/pwtFutureVolleySetup.ts';

export default async function auditRepairLatestPwtFutureVolleySetup(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    const character=user?await base44.asServiceRole.entities.Character.get(LIVE_PWT_FUTURE_VOLLEY_SCOPE.characterId).catch(()=>null):null;
    if(!user||!character||!characterBelongsToUser(character,user))return Response.json({error:'Owner authorization required.',writes:0},{status:403});
    const payload=await req.json().catch(()=>({}));if(Object.keys(payload).some((key)=>!['mode','apply_token'].includes(key)))return Response.json({error:'Unsupported field.',writes:0},{status:400});
    const result=await auditPwtFutureVolleySetup({db:base44.asServiceRole,mode:payload.mode,applyToken:payload.apply_token});return Response.json(result.body,{status:result.status});
  }catch(error){return Response.json({error:error.message||'PWT future-volley audit failed.',writes:0},{status:500});}
}