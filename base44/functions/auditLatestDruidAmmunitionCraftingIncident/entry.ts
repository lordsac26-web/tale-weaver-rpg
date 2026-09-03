import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { auditDruidAmmunitionCraftingIncident } from '../../shared/repairs/druidAmmunitionCraftingIncident.ts';

const protectedPair={character_id:'6a6825cd07a490fa70a46852',session_id:'6a6825edd695bd65a4322256'};
export default async function(req){
  try{
    const payload=await req.json();
    if(payload?.apply)return Response.json({error:'This incident endpoint is read-only.'},{status:405});
    if(payload?.character_id!==protectedPair.character_id||payload?.session_id!==protectedPair.session_id)return Response.json({error:'Explicit protected incident identifiers are required.'},{status:403});
    const base44=createClientFromRequest(req),db=base44.asServiceRole;
    const [character,session]=await Promise.all([db.entities.Character.get(payload.character_id),db.entities.GameSession.get(payload.session_id)]);
    if(!character||!session||session.character_id!==character.id)return Response.json({error:'Incident linkage is invalid.'},{status:403});
    return Response.json(await auditDruidAmmunitionCraftingIncident({db,character,session}));
  }catch(error){return Response.json({error:error.message||'Crafting incident audit failed.'},{status:500});}
}