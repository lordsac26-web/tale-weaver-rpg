import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { AMMUNITION_TRANSACTION_VERSION, commitAuthoritativeAmmunition, planAmmunitionUse, weaponAmmunitionRequirement } from '../../shared/ammunitionTransaction.ts';
import { addAmmunition } from '../../shared/ammunition.ts';
import { classifyNarrativeRangedAttackIntent } from '../../shared/story/generatedChoiceIntent.js';
import { concealmentAttributions, getAttackConcealment } from '../../shared/combat/conditions.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();if(!user||user.role!=='admin')return Response.json({error:'Admin access required.'},{status:403});await req.json().catch(()=>({}));
    const before=await hashValue(await readProtectedDndState(base44.asServiceRole)),tests=[];const test=(name,pass)=>tests.push({name,pass:!!pass});
    const bow={name:'Longbow',type:'ranged',properties:['Ammunition (150/600)','Heavy','Two-Handed']},crossbow={name:'Crossbow, light',type:'ranged',properties:['ammunition (range 80/320)','loading']},melee={name:'Longsword',type:'melee',properties:[]},magic={name:'Force Bow',type:'ranged',properties:['magic','two-handed']};
    test('range property is metadata only',weaponAmmunitionRequirement(bow).range_metadata[0]==='ammunition (150/600)'&&weaponAmmunitionRequirement(bow).ammo_name==='Arrows');
    test('one ranged hit consumes one',planAmmunitionUse([{name:'Arrows',quantity:3,stack_semantics:'individual'}],bow,1).quantity_after===2);
    test('one ranged miss consumes one',planAmmunitionUse([{name:'Arrows',quantity:3,stack_semantics:'individual'}],bow,1).consumed===1);
    test('Extra Attack two consumes two structured rolls',planAmmunitionUse([{name:'Arrows',quantity:5,stack_semantics:'individual'}],bow,2).quantity_after===3);
    test('Horde Breaker extra roll consumes individually',planAmmunitionUse([{name:'Arrows',quantity:5,stack_semantics:'individual'}],bow,1).consumed===1);
    test('declared structured volley count consumes exact count',planAmmunitionUse([{name:'Arrows',quantity:8,stack_semantics:'individual'}],bow,3).quantity_after===5);
    test('flavor volley supplies no count',classifyNarrativeRangedAttackIntent('The enemy volley echoes through the trees')===null);
    test('actual story shot transitions',classifyNarrativeRangedAttackIntent('Loose an arrow at the cultist')?.requires_structured_resolution===true);
    test('actual generated choice shot transitions',classifyNarrativeRangedAttackIntent('Fire my longbow from cover')?.weapon_hint==='Longbow');
    test('insufficient arrows fail before roll',planAmmunitionUse([{name:'Arrows',quantity:1}],bow,2).ok===false);
    test('zero arrows fail before roll',planAmmunitionUse([{name:'Arrows',quantity:0}],bow,1).ok===false);
    const split=planAmmunitionUse([{name:'Arrows',quantity:1,item_id:'a'},{name:'Arrows',quantity:3,item_id:'b'}],bow,3);
    test('multiple stacks consume deterministically',split.ok&&split.stacks[0].identity==='a'&&split.stacks[0].consumed===1&&split.stacks[1].identity==='b'&&split.stacks[1].consumed===2);
    test('crossbow consumes bolts not arrows',planAmmunitionUse([{name:'Arrows',quantity:5},{name:'Bolts',quantity:2}],crossbow,1).inventory[0].quantity===5&&planAmmunitionUse([{name:'Arrows',quantity:5},{name:'Bolts',quantity:2}],crossbow,1).inventory[1].quantity===1);
    test('melee consumes no arrows',planAmmunitionUse([{name:'Arrows',quantity:5}],melee,1).required===false);
    test('magic no-ammo weapon consumes no arrows',planAmmunitionUse([{name:'Arrows',quantity:5}],magic,1).required===false);
    test('spell path has no weapon ammo requirement',weaponAmmunitionRequirement(null).required===false);
    test('enemy fire cannot target player transaction without character call',planAmmunitionUse([{name:'Arrows',quantity:5}],melee,1).inventory[0].quantity===5);
    test('purchase adds canonical arrows',addAmmunition([{name:'Arrows',quantity:2,stack_semantics:'individual'}],{name:'Arrows',pack_size:20},1)[0].quantity===22);
    let character={id:'fixture-character',created_by_id:user.id,created_date:'fixture',inventory:[{name:'Arrows',quantity:4,unit:'arrow',stack_semantics:'individual',item_id:'fixture-arrows'}],long_rest_abilities:{}},session={id:'fixture-session',character_id:character.id,current_location:'fixture woods'};
    const fake={asServiceRole:{entities:{Character:{get:async()=>structuredClone(character),update:async(_id,updates)=>(character={...character,...structuredClone(updates)})},GameSession:{get:async()=>structuredClone(session)}}}};
    const args={base44:fake,ownerId:user.id,characterId:character.id,sessionId:session.id,combatId:'fixture-combat',requestId:'fixture-shot',weapon:bow,attackRolls:1,attackResults:[{target_id:'enemy-1',target:'Cultist',raw_d20:7,all_rolls:[7,16],hit:true,advantage:true,advantage_sources:['Attacking from Stealthed/concealed']}],source:'structured_combat_attack'};
    const committed=await commitAuthoritativeAmmunition(args),replay=await commitAuthoritativeAmmunition(args);
    test('service-role transaction writes inventory and receipt together',committed.body.writes===1&&character.inventory[0].quantity===3&&character.long_rest_abilities.__ammo_attack_receipts.length===1);
    test('receipt includes hit roll and advantage attribution',committed.body.receipt.attack_results[0].hit===true&&committed.body.receipt.attack_results[0].advantage_sources[0]==='Attacking from Stealthed/concealed');
    test('same request replay writes zero',replay.body.writes===0&&replay.body.already_processed===true&&character.inventory[0].quantity===3);
    test('receipt version is current',committed.body.receipt.version===AMMUNITION_TRANSACTION_VERSION);
    const hidden={name:'stealthed',break_on_attack:true},pwt={name:'pass without trace',concentration:true};
    test('stealth grants named attack advantage',concealmentAttributions(getAttackConcealment([hidden]))[0]==='Attacking from Stealthed/concealed');
    test('PWT alone grants no attack advantage',getAttackConcealment([pwt]).length===0);
    test('narration retry reuses transaction receipt',replay.body.receipt.request_id==='fixture-shot');
    test('stale different request sees current quantity',planAmmunitionUse(character.inventory,bow,1).quantity_before===3);
    test('thrown weapon is outside arrow transaction',weaponAmmunitionRequirement({name:'Dagger',type:'melee',properties:['Thrown']}).required===false);
    test('no quantity becomes negative',planAmmunitionUse([{name:'Arrows',quantity:1}],bow,2).inventory===undefined);
    const after=await hashValue(await readProtectedDndState(base44.asServiceRole));test('protected live IDs unchanged',before===after);
    const passed=tests.filter((entry)=>entry.pass).length;return Response.json({function_version:'authoritative-ammunition-regression-v1.0.0',transaction_version:AMMUNITION_TRANSACTION_VERSION,all_pass:passed===tests.length,passed,failed:tests.length-passed,total:tests.length,tests},{status:passed===tests.length?200:500});
  }catch(error){return Response.json({error:error.message||'Ammunition transaction regression failed.'},{status:500});}
}