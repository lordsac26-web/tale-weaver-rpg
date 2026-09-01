import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { hydrateLatestStoryEntry } from '../../shared/story/storyTransition.ts';

export default async function auditNewCharacterBootstrap(req) {
  const base44=createClientFromRequest(req); const user=await base44.auth.me();
  if(!user) return Response.json({error:'Unauthorized'},{status:401});
  await req.json().catch(()=>({}));
  const [sessions,characters]=await Promise.all([base44.asServiceRole.entities.GameSession.list('-created_date',200),base44.asServiceRole.entities.Character.list('-created_date',200)]);
  const owned=new Map(characters.filter((character)=>characterBelongsToUser(character,user)).map((character)=>[character.id,character]));
  const affected=sessions.filter((session)=>owned.has(session.character_id)&&!session.in_combat).filter((session)=>{const hydration=hydrateLatestStoryEntry(session);return !hydration.text||hydration.choices.length===0;}).map((session)=>session.id);
  return Response.json({function_version:'audit-new-character-bootstrap-v1.0.0',read_only:true,writes:0,count:affected.length,session_ids:affected});
}