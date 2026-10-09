import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { extractNarratedLoot, materializeNarratedLoot, NARRATED_LOOT_VERSION } from '../../shared/story/narratedLootMaterialization.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const fixtures=[]; const results=[]; let diagnostics=null; const record=(name,pass)=>results.push({name,pass:!!pass});
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me();
    if(!user||user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
    await req.json().catch(()=>({}));
    const protectedBefore=await hashValue(await readProtectedDndState(base44.asServiceRole));

    // 1. Parser extracts named loot from narration
    const narration="With the metallic clatter of the Obsidian Medallion and the lead-lined cylinder landing at your feet, the oppressive violet static that guarded the dais finally dissipates. You move quickly, scooping the Obsidian Medallion and the lead-lined cylinder into the extradimensional maw of your Bag of Holding, where their necrotic signature is immediately muffled by the pocket dimension's stillness.";
    const loot=extractNarratedLoot(narration);
    record('parser extracts obsidian medallion from narration',loot.some(i=>/medallion/i.test(i.name)));
    record('parser extracts lead-lined cylinder from narration',loot.some(i=>/cylinder/i.test(i.name)));

    // 2. Parser handles "take X and Y" pattern
    const takeNarration="You take the Silver Chalice and the Bronze Key from the altar and place them in your backpack.";
    const takeLoot=extractNarratedLoot(takeNarration);
    record('parser extracts silver chalice from take pattern',takeLoot.some(i=>/chalice/i.test(i.name)));
    record('parser extracts bronze key from take pattern',takeLoot.some(i=>/key/i.test(i.name)));

    // 3. Parser does not extract from non-loot narration
    const noLoot="You stand alone in the fracturing ritual chamber, the dust of centuries hanging heavy in the air. The Weaver is dead, the node is dark.";
    const noLootResult=extractNarratedLoot(noLoot);
    record('parser returns empty for non-loot narration',noLootResult.length===0);

    // 4. Full materialization round-trip with fixture
    const tag=`NarratedLoot_${Date.now()}`;
    try {
      const character=await base44.entities.Character.create({name:tag,race:'Human',class:'Wizard',level:5,inventory:[{name:'Bag of Holding',quantity:1}],stowed_items:[],is_active:false});
      fixtures.push(['Character',character.id]);
      const session=await base44.entities.GameSession.create({character_id:character.id,title:tag,current_location:'Test Dungeon',story_log:[],world_state:{},is_active:false});
      fixtures.push(['GameSession',session.id]);

      const testNarration="You scoop the Crystal Orb and the Iron Crown into your Bag of Holding and escape the collapsing chamber.";
      const result=await materializeNarratedLoot({base44,sessionId:session.id,characterId:character.id,requestId:`${tag}:loot`,narrative:testNarration,storyIndex:0});
      record('materialization applies successfully',result.applied===true&&result.writes===1);
      record('materialization reports two items',result.materialized.length===2);

      const updatedChar=await base44.asServiceRole.entities.Character.get(character.id);
      const stowed=updatedChar.stowed_items||[];
      const orbInBag=stowed.some(i=>/crystal orb/i.test(i.name)&&i.container==='Bag of Holding');
      const crownInBag=stowed.some(i=>/iron crown/i.test(i.name)&&i.container==='Bag of Holding');
      record('crystal orb materialized into bag with provenance',orbInBag&&stowed.find(i=>/crystal orb/i.test(i.name))?.provenance?.source==='narrated_loot');
      record('iron crown materialized into bag with provenance',crownInBag&&stowed.find(i=>/iron crown/i.test(i.name))?.provenance?.source==='narrated_loot');

      // 5. Idempotent — re-running does not duplicate
      const replay=await materializeNarratedLoot({base44,sessionId:session.id,characterId:character.id,requestId:`${tag}:loot2`,narrative:testNarration,storyIndex:0});
      record('re-materialization is idempotent',replay.applied===false&&replay.materialized.length===0);

      // 6. Stow round-trip: materialized item can be re-stowed
      const orbInInventory=stowed.find(i=>/crystal orb/i.test(i.name));
      record('materialized item has stowable structure',!!orbInInventory?.name&&!!orbInInventory?.category&&!!orbInInventory?.weight);

      diagnostics={loot,takeLoot,noLootResult,result,stowed:stowed.map(i=>({name:i.name,container:i.container,category:i.category}))};
    } finally { for(const [entity,id] of fixtures.reverse())await base44.asServiceRole.entities[entity].delete(id).catch(()=>null); }
    const protectedAfter=await hashValue(await readProtectedDndState(base44.asServiceRole));
    record('fixtures clean up and protected records remain unchanged',protectedBefore===protectedAfter);
    const passed=results.filter((item)=>item.pass).length,all_pass=passed===results.length;
    return Response.json({function_version:`test-narrated-loot-v${NARRATED_LOOT_VERSION}`,passed,failed:results.length-passed,total:results.length,all_pass,results,diagnostics:all_pass?undefined:diagnostics},{status:all_pass?200:500});
  } catch(error) { return Response.json({error:error.message||'Narrated loot regression failed',results,all_pass:false},{status:500}); }
}