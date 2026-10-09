import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { classifyItemTransferIntent, executeItemTransferAction } from '../../shared/story/itemTransfer.ts';
import { classifyStowIntent, resolveStowTarget, executeStowAction } from '../../shared/story/stowIntent.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const fixtures=[]; const results=[]; let diagnostics=null; const record=(name,pass)=>results.push({name,pass:!!pass});
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me();
    if(!user||user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
    await req.json().catch(()=>({}));
    const protectedBefore=await hashValue(await readProtectedDndState(base44.asServiceRole));

    // 1. ROOT CAUSE: "take the staff and use it" must NOT be a world-transfer
    const useAction="take the Unidentified Staff and attempt to figure out a way to reverse the staff's properties in order to suck the necrotic energy out of the land";
    const useClassification=classifyItemTransferIntent(useAction);
    record('"take X and use it" is not classified as a world-transfer',useClassification===null);

    // 2. Correct retrieval still works
    const retrieveAction='retrieve the Unidentified Staff from the bag of holding';
    const retrieveClassification=classifyItemTransferIntent(retrieveAction);
    record('"retrieve X from bag" classifies as a carried retrieval',retrieveClassification?.destination_kind==='carried');

    // 3. Correct world-transfer still works (placement verbs)
    const placeAction='place the staff in the tomb';
    const placeClassification=classifyItemTransferIntent(placeAction);
    record('"place X on altar" classifies as a world transfer',placeClassification?.destination_kind==='world');

    // 4. Stow clarification returns concrete candidates when unresolved
    const unresolvedChar={inventory:[{name:'Longbow',quantity:1},{name:'Shortsword',quantity:2}],stowed_items:[]};
    const unresolvedResult=resolveStowTarget(unresolvedChar,'it');
    record('unresolved stow returns inventory items as candidates',Array.isArray(unresolvedResult.candidates)&&unresolvedResult.candidates.length===2);

    // 5. Stow resolves from world_items fallback
    const worldItemsChar={inventory:[],stowed_items:[]};
    const worldItemsList=[{name:'Unidentified Staff',quantity:1,category:'Staff',world_status:'placed',location:'Ruined Watchtower'}];
    const worldResult=resolveStowTarget(worldItemsChar,'staff',worldItemsList);
    record('stow resolves from world_items fallback',worldResult.kind==='unique'&&worldResult.source==='world_items');

    // 6. Full round-trip: stowed -> retrieve -> inventory -> stow
    const tag=`StowRoundTrip_${Date.now()}`;
    try {
      const character=await base44.entities.Character.create({name:tag,race:'Human',class:'Wizard',level:5,inventory:[{name:'Bag of Holding',quantity:1}],stowed_items:[{name:'Unidentified Staff',quantity:1,container:'Bag of Holding',is_identified:false,category:'Staff',description:'A heavy, gnarled piece of darkwood.'}],is_active:false});
      fixtures.push(['Character',character.id]);
      const session=await base44.entities.GameSession.create({character_id:character.id,title:tag,current_location:'Ruined Watchtower',story_log:[],world_state:{},is_active:false});
      fixtures.push(['GameSession',session.id]);

      // Retrieve from bag
      const retrievePayload={session_id:session.id,character_id:character.id,action_text:retrieveAction,request_id:`${tag}:retrieve`,check:{success:true}};
      const retrieval=await executeItemTransferAction({base44,ownerId:user.id,payload:retrievePayload});
      const charAfterRetrieval=await base44.asServiceRole.entities.Character.get(character.id);
      const staffInInventory=(charAfterRetrieval.inventory||[]).some(i=>i.name==='Unidentified Staff');
      const staffNotStowed=!(charAfterRetrieval.stowed_items||[]).some(i=>i.name==='Unidentified Staff');
      record('retrieval moves staff from bag to inventory',retrieval.body?.success&&staffInInventory&&staffNotStowed);

      // Re-stow from inventory
      const stowPayload={session_id:session.id,character_id:character.id,action_text:'stow the Unidentified Staff in the bag of holding',request_id:`${tag}:restow`,check:{success:true}};
      const stowOutcome=await executeStowAction({base44,ownerId:user.id,payload:stowPayload});
      const charAfterStow=await base44.asServiceRole.entities.Character.get(character.id);
      const staffBackInBag=(charAfterStow.stowed_items||[]).some(i=>i.name==='Unidentified Staff'&&i.container==='Bag of Holding');
      const staffNotInInventory=!(charAfterStow.inventory||[]).some(i=>i.name==='Unidentified Staff');
      record('re-stow moves staff from inventory back to bag',stowOutcome.body?.success&&staffBackInBag&&staffNotInInventory);

      // Idempotent retry
      const stowReplay=await executeStowAction({base44,ownerId:user.id,payload:stowPayload});
      record('stow replay is idempotent',stowReplay.body?.already_processed===true&&stowReplay.body?.writes===0);

      diagnostics={useClassification,retrieveClassification,placeClassification,unresolvedCandidates:unresolvedResult.candidates,worldResult,staffInInventory,staffBackInBag};
    } finally { for(const [entity,id] of fixtures.reverse())await base44.asServiceRole.entities[entity].delete(id).catch(()=>null); }
    const protectedAfter=await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('fixtures clean up and protected records remain unchanged',protectedBefore===protectedAfter);
    const passed=results.filter((item)=>item.pass).length,all_pass=passed===results.length;
    return Response.json({function_version:'test-stow-round-trip-v1.0.0',passed,failed:results.length-passed,total:results.length,all_pass,results,diagnostics:all_pass?undefined:diagnostics},{status:all_pass?200:500});
  } catch(error) { return Response.json({error:error.message||'Stow round-trip regression failed',results,all_pass:false},{status:500}); }
}