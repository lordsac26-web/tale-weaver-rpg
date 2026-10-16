import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { classifyItemTransferIntent, resolveItemTransferTarget, executeItemTransferAction, ITEM_TRANSFER_VERSION } from '../../shared/story/itemTransfer.ts';

export default async function(req) {
  const tests=[]; const test=(name,pass)=>tests.push({name,pass:!!pass});
  let fixtureSessionId=null, fixtureCharacterId=null;
  try {
    const base44=createClientFromRequest(req), user=await base44.auth.me();
    if(!user||user.role!=='admin') return Response.json({error:'Admin access required.'},{status:403});
    const db=base44.asServiceRole;

    // PURE CLASSIFIER FIXTURES — the owner's exact misroute text plus variants.
    const misroute='empty one the ritual overseer corpse from my bag of holding';
    const classified=classifyItemTransferIntent(misroute);
    test('empty-from-bag free text classifies as an item transfer', classified?.type==='item_transfer');
    test('empty-from-bag routes as bag-out retrieval to carried inventory', classified?.destination_kind==='carried' && !!classified?.source_hint);
    test('item phrase extracted from the exact misroute text', /ritual overseer/.test(classified?.item_phrase||''));
    test('empty out variant (with out) classifies', classifyItemTransferIntent('empty out the ritual overseer corpse from my bag of holding')?.type==='item_transfer');
    test('empty into a container still classifies (not swallowed)', classifyItemTransferIntent('empty the potion vial into the cistern')?.type==='item_transfer');

    // TARGET RESOLUTION — unique corpse resolution against a fixture character.
    const fixtureCharacter={ id:'fixture', stowed_items:[
      { name:"Ritual Overseer's Corpse", quantity:1, alive:false, container:'Bag of Holding', provenance:{source:'story_log_stow'} },
      { name:'Rune-Caster\u2019s Corpse', quantity:1, container:'Bag of Holding' }
    ], inventory:[{ name:'Arrows', quantity:36 }] };
    const resolved=resolveItemTransferTarget(fixtureCharacter, { world_state:{ world_items:[] } }, 'one the ritual overseer corpse');
    test('corpse phrase resolves uniquely against stowed items', resolved?.kind==='unique' && resolved?.source==='stowed_items');

    // LIVE ATOMIC PATH — temp session/character, real bag-out execute, then replay.
    const session=await db.entities.GameSession.create({ character_id:'pending', title:'Bag-Out Fixture (temp)', is_active:false });
    fixtureSessionId=session.id;
    const character=await db.entities.Character.create({ created_by_id:user.id, name:'BagOut Fixture', race:'Human', class:'Ranger', level:7, hp_max:10, hp_current:10,
      inventory:[{ name:'Arrows', quantity:36 }],
      stowed_items:[{ name:"Ritual Overseer's Corpse", quantity:1, alive:false, container:'Bag of Holding', provenance:{source:'fixture'} },
        { name:'Rune-Caster\u2019s Corpse', quantity:1, container:'Bag of Holding' }] });
    fixtureCharacterId=character.id;
    await db.entities.GameSession.update(session.id, { character_id:character.id, current_location:'The Fens, fixture scene' });

    const outcome=await executeItemTransferAction({ base44, ownerId:null, payload:{ session_id:session.id, character_id:character.id, action_text:misroute, request_id:'bag-out-fixture:1' } });
    test('bag-out transfer commits end-to-end', outcome.body?.handled===true && outcome.body?.success===true);
    const after=await db.entities.Character.get(character.id);
    test('stowed sub-inventory removal applied', (after.stowed_items||[]).some(i=>i.name==="Ritual Overseer's Corpse")===false);
    test('other bag items untouched', (after.stowed_items||[]).some(i=>i.name==="Rune-Caster\u2019s Corpse")===true);
    test('corpse placed at destination', (outcome.body?.receipt?.destination_kind==='world' && outcome.body?.receipt?.destination) || (outcome.body?.receipt?.destination_kind==='carried'));

    const replay=await executeItemTransferAction({ base44, ownerId:null, payload:{ session_id:session.id, character_id:character.id, action_text:misroute, request_id:'bag-out-fixture:1' } });
    test('replay of the same request_id is idempotent (no second mutation)', replay.body?.already_processed===true && replay.body?.writes===0);
    const afterReplay=await db.entities.Character.get(character.id);
    test('replay leaves stowed state unchanged', JSON.stringify(afterReplay.stowed_items?.map(i=>i.name))===JSON.stringify(after.stowed_items?.map(i=>i.name)));

    // Narration-only guard: a text with NO transfer verb never claims a mutation.
    test('pure narration without a transfer verb does not classify', classifyItemTransferIntent('You examine the bag of holding and describe its contents.')===null);
    test('inspection-only look/inspect is not a transfer', classifyItemTransferIntent('inspect the ritual overseer corpse in my bag of holding')===null);

    const passed=tests.filter(t=>t.pass).length, allPass=passed===tests.length;
    return Response.json({ function_version:'bag-out-retrieval-regression-v1.0.0', item_transfer_version:ITEM_TRANSFER_VERSION, passed, failed:tests.length-passed, total:tests.length, all_pass:allPass, tests },{status:allPass?200:500});
  } catch(error){
    return Response.json({ error:error.message||'Bag-out retrieval regression failed.', tests },{status:500});
  } finally {
    try { if(fixtureSessionId) await base44.asServiceRole.entities.GameSession.delete(fixtureSessionId); } catch {}
    try { if(fixtureCharacterId) await base44.asServiceRole.entities.Character.delete(fixtureCharacterId); } catch {}
  }
}