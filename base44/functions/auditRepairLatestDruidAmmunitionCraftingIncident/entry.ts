import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { applyDruidCraftingIncidentRepair, discoverDruidCraftingIncidentRepair, DRUID_CRAFTING_INCIDENT, DRUID_CRAFTING_REPAIR_VERSION } from '../../shared/repairs/druidAmmunitionCraftingRepair.ts';

export default async function(req){
  try{
    const body=await req.json().catch(()=>({})),mode=String(body?.mode||'');
    if(!['discover','apply'].includes(mode))return Response.json({function_version:DRUID_CRAFTING_REPAIR_VERSION,error:'mode must be discover or apply',writes:0},{status:400});
    if(body?.character_id!==DRUID_CRAFTING_INCIDENT.character_id||body?.session_id!==DRUID_CRAFTING_INCIDENT.session_id)return Response.json({function_version:DRUID_CRAFTING_REPAIR_VERSION,error:'Exact protected incident identifiers are required.',writes:0},{status:403});
    const db=createClientFromRequest(req).asServiceRole;
    const result=mode==='discover'
      ?await discoverDruidCraftingIncidentRepair({db,characterId:body.character_id,sessionId:body.session_id})
      :await applyDruidCraftingIncidentRepair({db,characterId:body.character_id,sessionId:body.session_id,applyToken:body.apply_token});
    return Response.json(result.body,{status:result.status});
  }catch(error){return Response.json({function_version:DRUID_CRAFTING_REPAIR_VERSION,error:error.message||'Druid crafting repair failed.',writes:0},{status:500});}
}