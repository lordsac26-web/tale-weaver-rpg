import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { resolveBagTransferClarification } from '../../shared/story/bagTransferClarification.ts';
import { BAG_PENDING_KEY, parseBagTransfer, bagTransferCandidates } from '../../shared/story/bagTransferPlan.ts';
import controller from '../../shared/tests/groundedClarificationController.js';
import { buildClarificationOptions, resolveGroundedAction } from '../../shared/story/groundedAction.ts';
import { buildGroundedContext } from '../../shared/story/groundedSceneContext.ts';
import { normalizeEntityName } from '../../shared/story/entityNameMatch.ts';

export default async function(req) {
  const client=createClientFromRequest(req), user=await client.auth.me();
  if(!user || user.role!=='admin')return Response.json({error:'Admin required'},{status:403});
  const tests=[],check=(name,pass)=>tests.push({name,pass:!!pass});
  // Actual coordinator + frontend-controller mirror over guarded memory records.
  // No live campaign records or external model calls are read or written.
  const action='remove a dead body from the Bag of Holding and place it near the dead guards';
  const corpse=name=>({name,quantity:1,container:'Bag of Holding',status:'dead',alive:false,category:'Corpse',death_provenance:{combat_id:'prior-encounter',combatant_id:name},provenance:{source:'verified_stow'}});
  const s={id:'s',character_id:'c',updated_date:'1',in_combat:false,current_location:'Administrative Corridor',story_log:[{request_id:'source',text:'Two dead guards lie here.',choices:[1,2,3,4].map(n=>({text:`Scene choice ${n}`,action_type:'utility'}))}],world_state:{scene_entities:[{id:'door',name:'iron-bound office door'},{id:'guard',name:'Magistrate Guard'},{id:'pipe',name:'rusted piping fixture'}]}};
  const c={id:'c',updated_date:'1',inventory:[{name:'Bag of Holding',quantity:1}],stowed_items:[{name:"Weaver's Ledger",quantity:1,container:'Bag of Holding'},corpse("Rune-Caster's Corpse"),corpse("Obsidian Circle Vanguard's Corpse"),{name:'Obsidian Medallion',quantity:1,container:'Bag of Holding'}]};
  const initialRecords=structuredClone({GameSession:s,Character:c});
  const records={GameSession:s,Character:c};let tick=1,failFinal=false,failCharacter=false,forceConflict=false;
  const db={entities:Object.fromEntries(Object.entries(records).map(([name,row])=>[name,{get:async()=>structuredClone(row),updateMany:async(query,patch)=>{
    if(forceConflict){forceConflict=false;return {updated:0};}
    if(failCharacter&&name==='Character'){failCharacter=false;throw new Error('injected character interruption');}
    if(failFinal&&name==='GameSession'&&patch.$set.world_state?.[BAG_PENDING_KEY]===null){failFinal=false;throw new Error('injected final interruption');}
    if(query.updated_date!==row.updated_date)return {updated:0};Object.assign(row,structuredClone(patch.$set),{updated_date:String(++tick)});return {updated:1};
  }}]))};
  const run=async payload=>resolveBagTransferClarification({db,session:structuredClone(s),character:structuredClone(c),...payload});
  const storageMap=new Map(),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
  let resolved=null,networkFail=false;
  const invoke=async(name,p)=>{
    if(networkFail){networkFail=false;throw new Error('injected network failure');}
    const r=await run({actionText:p.action||'',requestId:p.request_id,intentId:p.clarification_intent_id,selectedId:p.selected_source_id,answerText:p.answer_text,operation:p.clarification_operation});
    if(r.status>=400)throw {response:{status:r.status,data:r.body},message:r.body.error};return {data:r.body};
  };
  const makeController=()=>controller({sessionId:s.id,characterId:c.id,invoke,storage,onResolved:async data=>{resolved=data;}});
  try {
    const parsed=parseBagTransfer(action);
    check('composite retrieval preserves explicit ground destination',parsed.destination_kind==='world'&&parsed.destination==='scene ground near the dead guards');
    const initial=await run({actionText:action,requestId:'intent:1'});
    const opts=initial.body.clarification_options;
    check('ambiguity candidates contain only the two stowed corpses',opts.length===2&&opts[0].name==="Rune-Caster's Corpse"&&opts[1].name==="Obsidian Circle Vanguard's Corpse");
    check('clarification persists original action and destination without moving contents',s.world_state[BAG_PENDING_KEY].id==='intent:1'&&c.stowed_items.length===4&&!s.world_state.world_items);
    let ui=makeController();ui.install(initial.body);ui.setReply(opts[0].name);
    ui=makeController();await ui.restore();
    check('modal round trip restores original intent and typed reply',ui.snapshot().state.original.action===action&&ui.snapshot().state.reply===opts[0].name&&ui.snapshot().state.data.clarification_intent_id==='intent:1');
    networkFail=true;await ui.submit(opts[0].name,opts[0].id);
    check('failed binding remains visible and preserves intent for retype',ui.snapshot().pending&&!!ui.snapshot().error&&s.world_state[BAG_PENDING_KEY].id==='intent:1');
    const bad=await ui.submit('iron-bound office door','door');
    check('role-invalid selection cannot commit or erase pending',bad===false&&c.stowed_items.length===4&&ui.snapshot().pending);
    const done=await ui.submit(opts[0].name,opts[0].id);
    check('option submit commits and closes only after confirmation',done===true&&!ui.snapshot().pending&&resolved?.transfer_committed&&resolved?.persistence_confirmed);
    check('explicit destination completes without second clarification',s.world_state.world_items?.length===1&&s.world_state.world_items[0].container==='scene ground near the dead guards');
    check('bag decrements one corpse and leaves all other items untouched',c.stowed_items.length===3&&!c.stowed_items.some(x=>x.name===opts[0].name)&&c.stowed_items.some(x=>x.name===opts[1].name));
    check('scene corpse preserves original death provenance',s.world_state.scene_entities.some(x=>x.name===opts[0].name&&x.alive===false&&x.evidence.authority==='item_transfer'&&x.death_provenance.combat_id==='prior-encounter'));
    check('receipt and capacity committed with scene and story',s.world_state.__item_transfer_receipts.length===1&&s.world_state.__container_capacity['Bag of Holding'].weight_lb===167&&s.story_log.at(-1).transfer_transaction.receipt.request_id==='intent:1');
    const saved=JSON.stringify(records);await run({intentId:'intent:1',selectedId:opts[0].id,answerText:opts[0].name});
    check('duplicate submit is zero-write',JSON.stringify(records)===saved);
    const next=await run({actionText:action,requestId:'intent:2'});
    ui=makeController();ui.install({...next.body,clarification_kind:'bag_transfer'});
    failFinal=true;await ui.submit(opts[1].name,next.body.bag_transfer.selected_source_id);
    check('interrupted final save retains durable selected before-after plan',ui.snapshot().pending&&!!s.world_state[BAG_PENDING_KEY]?.commit&&!!ui.snapshot().error);
    ui=makeController();await ui.restore();await ui.submit(opts[1].name,next.body.bag_transfer.selected_source_id);
    check('retry after reload finishes same transfer exactly once',resolved?.receipt?.request_id==='intent:2'&&s.world_state.world_items.length===2&&s.world_state.__item_transfer_receipts.length===2&&c.stowed_items.length===2);
    check('ledger and medallion remain, no rolls or resource changes',c.stowed_items.map(x=>x.name).join('|')==="Weaver's Ledger|Obsidian Medallion"&&!c.spell_slots&&!c.hp_current);
    Object.assign(s,structuredClone(initialRecords.GameSession));Object.assign(c,structuredClone(initialRecords.Character));
    const third=await run({actionText:action,requestId:'intent:3'});
    const thirdOptions=third.body.clarification_options;
    ui=makeController();ui.install(third.body);
    const multiple=await ui.submit(thirdOptions.map(x=>x.name).join(' or '));
    check('a reply naming both source candidates does not arbitrarily move one',!multiple&&ui.snapshot().pending&&c.stowed_items.length===4);
    failCharacter=true;await ui.submit(thirdOptions[0].name,thirdOptions[0].id);
    check('character-write failure changes no possessions or scene and retains plan',c.stowed_items.length===4&&!s.world_state.world_items&&!!s.world_state[BAG_PENDING_KEY]?.commit);
    await ui.submit(thirdOptions[0].name);
    check('typed full-name fallback finishes the original saved intent',resolved?.receipt?.request_id==='intent:3'&&c.stowed_items.length===3&&s.world_state.world_items.length===1);
    Object.assign(s,structuredClone(initialRecords.GameSession));Object.assign(c,structuredClone(initialRecords.Character));
    forceConflict=true;const beforeConflict=JSON.stringify(records);
    try{await run({actionText:action,requestId:'intent:conflict'});}catch{}
    check('concurrent pending creation is refused without overwriting records',JSON.stringify(records)===beforeConflict);
    const reset=()=>{Object.assign(s,structuredClone(initialRecords.GameSession));Object.assign(c,structuredClone(initialRecords.Character));};
    const authoritative="Obsidian Circle Vanguard's Corpse";
    const variants=[authoritative,'Obsidian Circle Vanguard\u2019s Corpse','  OBSIDIAN\u00a0Circle\tVanguard\u2019s   Corpse!!!  ','\u201cObsidian Circle Vanguard\u02bcs Corpse\u201d.','Obsidian Circle Van\u200bguard\u2019s Corpse'];
    for(const [i,pasted] of variants.entries()){
      reset();
      const directAction=`remove ${pasted} from the bag and place near the iron-bound office door`;
      const direct=await run({actionText:directAction,requestId:`exact:${i}`});
      check(`pasted authoritative name variant ${i} commits zero-prompt`,direct.body.transfer_committed===true&&!direct.body.clarification_required&&!direct.body.bag_transfer&&direct.body.receipt.item_name===authoritative);
      const placed=s.world_state.world_items?.[0];
      check(`named composite ${i} preserves destination provenance and capacity`,placed?.name===authoritative&&placed?.container==='scene ground near the iron-bound office door'&&placed?.death_provenance.combat_id==='prior-encounter'&&s.world_state.__container_capacity['Bag of Holding'].weight_lb===167&&c.stowed_items.length===3&&s.story_log.at(-1).request_id===`exact:${i}`);
      const after=JSON.stringify(records);
      await run({actionText:directAction,requestId:`exact:${i}`});
      check(`original named request ${i} replays zero-write`,JSON.stringify(records)===after);
      const absent=await run({actionText:directAction,requestId:`absent:${i}`});
      check(`absent pasted corpse ${i} never substitutes the other corpse`,absent.status===409&&JSON.stringify(records)===after);
    }
    check('ASCII curly and modifier apostrophes normalize identically',variants.every(value=>normalizeEntityName(value)===normalizeEntityName(authoritative)));
    reset();
    const ballast=Array.from({length:75},(_,i)=>({name:`Stored ledger ${i}`,quantity:1,container:'Bag of Holding'}));
    c.stowed_items=[...ballast,...c.stowed_items,{...corpse('Other pack Corpse'),container:'Backpack'}];
    c.inventory.push(corpse('Carried Corpse'));
    const scope=await bagTransferCandidates(c,parseBagTransfer(action));
    check('both corpses beyond index 64 are enumerated without bag container or scene candidates',scope.length===2&&scope.some(x=>x.name===authoritative)&&scope.every(x=>x.index>64&&/Rune-Caster|Obsidian Circle Vanguard/.test(x.name)));
    const expanded=await run({actionText:action,requestId:'complete:two'});
    check('ambiguous endpoint response offers the complete two-corpse scope',expanded.body.clarification_options.length===2&&expanded.body.clarification_options.some(x=>x.name===authoritative));
    ui=makeController();ui.install(expanded.body);
    const pastedOption=expanded.body.clarification_options.find(x=>x.name===authoritative);
    await ui.submit(pastedOption.name,pastedOption.id);
    check('previously omitted corpse chip binds and commits its exact identity',!ui.snapshot().pending&&resolved?.receipt?.item_name===authoritative&&s.world_state.world_items?.[0]?.name===authoritative);
    reset();c.stowed_items=Array.from({length:80},(_,i)=>corpse(`Stored body ${i} Corpse`));
    const many=await bagTransferCandidates(c,parseBagTransfer(action));
    check('all 80 relevant sources survive enumeration',many.length===80&&many[79].index===79);
    const options=buildClarificationOptions({catalog:many,actionText:'Inspect Stored body 79 Corpse'});
    check('generic chip renderer receives all 80 ranked candidates without a limit',options.length===80&&options[0].name==='Stored body 79 Corpse');
    let modelCalls=0;
    const fake={asServiceRole:{entities:{CombatLog:{filter:async()=>[]}}},integrations:{Core:{InvokeLLM:async()=>{modelCalls++;throw new Error('Exact name must not invoke the model');}}}};
    const context=await buildGroundedContext({base44:fake,session:s,character:c});
    check('grounded context retains complete stowed ownership projection',context.owned.filter(x=>x.place==='stowed').length===80);
    const inspected=await resolveGroundedAction({base44:fake,session:s,character:c,actionText:'Inspect Stored body 79 Corpse.'});
    check('exact name past index 64 resolves without a model or prompt',!inspected.clarification_required&&inspected.grounded_action?.target_ids[0]===many[79].id&&modelCalls===0);
    const passed=tests.filter(x=>x.pass).length;
    return Response.json({passed,failed:tests.length-passed,total:tests.length,all_pass:passed===tests.length,tests,live_writes:0},{status:passed===tests.length?200:500});
  }catch(error){return Response.json({error:error.message||String(error),tests,live_writes:0},{status:500});}
}