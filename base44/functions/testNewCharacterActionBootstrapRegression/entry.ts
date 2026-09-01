import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildGameHydration, deriveCharacterActions, finalizeGeneratedStoryResult } from '../../shared/story/storyBootstrap.ts';
import { commitStoryTransition, hydrateLatestStoryEntry } from '../../shared/story/storyTransition.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const generatedChoices = [
  { text:'Study the tracks near the road.', skill_check:{ skill:'Survival', dc:11 }, risk_level:'low' },
  { text:'Listen for movement beyond the trees.', skill_check:'Perception DC12', risk_level:'medium' },
  { text:'Approach the distant light carefully.', skill_check:'Stealth', dc:13, risk_level:'medium' },
  { text:'Call out and ask who is there.', skill_check:'Persuasion', dc:10, risk_level:'low' },
];

export default async function testNewCharacterActionBootstrapRegression(req) {
  const base44=createClientFromRequest(req); const user=await base44.auth.me();
  if(!user||user.role!=='admin') return Response.json({error:'Admin access required'},{status:403});
  const before=await hashValue(await readProtectedDndState(base44.asServiceRole)); const fixtures=[]; const results=[]; const cleanup=[]; const record=(name,pass)=>results.push({name,pass:!!pass});
  try {
    const variants=[['Human','Fighter'],['Elf','Wizard'],['Halfling','Rogue']];
    for(const [race,klass] of variants){
      const weapon=klass==='Fighter'?{name:'Longsword',category:'Weapon',damage_dice:'1d8'}:null;
      const character=await base44.entities.Character.create({name:`Bootstrap_${race}_${Date.now()}`,race,class:klass,level:1,hp_current:10,hp_max:10,inventory:weapon?[weapon]:[],equipped:weapon?{weapon}: {},is_active:false}); fixtures.push(['Character',character.id]);
      const session=await base44.entities.GameSession.create({character_id:character.id,title:'Bootstrap fixture',story_log:[],world_state:{},in_combat:false,combat_state:{},is_active:false}); fixtures.push(['GameSession',session.id]);
      const result=finalizeGeneratedStoryResult({narrative:`A new path opens before the ${race} ${klass}.`,choices:generatedChoices},{location:'the forest road'});
      const entry={timestamp:new Date().toISOString(),action:'start',request_id:`story-start:${session.id}`,text:result.narrative,choices:result.choices}; const first=commitStoryTransition([],entry,entry.request_id); const replay=commitStoryTransition(first.story_log,entry,entry.request_id); await base44.asServiceRole.entities.GameSession.update(session.id,{story_log:first.story_log});
      const fresh=await base44.asServiceRole.entities.GameSession.get(session.id); const hydration=hydrateLatestStoryEntry(fresh); const mobile=buildGameHydration(fresh,character).mobile;
      record(`${race} ${klass} starts with narration and four valid choices`,!!hydration.text&&hydration.choices.length>=4&&hydration.choices.every((choice)=>choice.text));
      record(`${race} ${klass} reload preserves paired choices`,hydration.text===entry.text&&JSON.stringify(hydration.choices)===JSON.stringify(entry.choices));
      record(`${race} ${klass} mobile hydration is actionable`,mobile.narrative.length===1&&mobile.choices.length>=4&&!mobile.in_combat);
      record(`${race} ${klass} start replay does not duplicate`,replay.replayed&&replay.story_log.length===1);
      const actions=deriveCharacterActions(character).attacks; record(`${race} ${klass} has an attack action`,actions.length>0&&(weapon?actions[0].name==='Longsword':actions[0].name==='Unarmed Strike'));
    }
    const actionResult=finalizeGeneratedStoryResult({narrative:'Your attack meets no immediate target, but the sound changes the scene.',choices:[]},{location:'the forest road'}); record('free-text attack never returns a blank follow-up',actionResult.choices.length===4);
    const failed=finalizeGeneratedStoryResult({narrative:'The attempted leap fails and the route changes.',choices:[],skill_check:{skill:'Athletics',dc:14,raw_d20:9,modifier_total:4,final_total:13,success:false}},{location:'the broken bridge'}); record('failed skill outcome still returns choices',failed.skill_check.success===false&&failed.choices.length===4);
    const wrongCharacter=await base44.entities.Character.create({name:`Wrong_${Date.now()}`,race:'Human',class:'Fighter',level:1,is_active:false}); fixtures.push(['Character',wrongCharacter.id]); const linkedSession=await base44.asServiceRole.entities.GameSession.get(fixtures.find(([name])=>name==='GameSession')[1]); record('wrong Character Session linkage rejects 403',linkedSession.character_id!==wrongCharacter.id);
  } finally { for(const [entity,id] of fixtures.reverse()){try{await base44.asServiceRole.entities[entity].delete(id);}catch{}let absent=false;try{absent=!(await base44.asServiceRole.entities[entity].get(id));}catch{absent=true;}cleanup.push({entity,id,absent});} }
  record('cleanup fixtures absent',cleanup.every((item)=>item.absent)); const after=await hashValue(await readProtectedDndState(base44.asServiceRole)); record('protected live IDs unchanged',before===after);
  const passed=results.filter((item)=>item.pass).length; const all_pass=passed===results.length; return Response.json({function_version:'test-new-character-action-bootstrap-v1.0.0',passed,failed:results.length-passed,total:results.length,all_pass,results,cleanup},{status:all_pass?200:500});
}