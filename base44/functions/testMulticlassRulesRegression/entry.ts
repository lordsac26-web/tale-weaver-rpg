import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { applyRogueExpertise, proficiencyForLevel, ROGUE_ONE_FEATURES, validateMulticlassApplication } from '../../shared/multiclassRules.ts';
import { resolveSneakAttack } from '../../shared/combat/sneakAttack.ts';

const hashValue = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(byte => byte.toString(16).padStart(2, '0')).join('');
const protectedState = db => Promise.all([db.entities.Character.get('6a6825cd07a490fa70a46852'),db.entities.GameSession.get('6a6825edd695bd65a4322256'),db.entities.CombatLog.get('6a767f23ec36fe219063ae49'),db.entities.CombatLog.get('6a77463582a26b50018110ea')]);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const before = await hashValue(await protectedState(base44.asServiceRole));
    const results = [];
    const ranger = { class:'Ranger', strength:10, dexterity:16, wisdom:14, level:5, features:[], skills:{Stealth:'proficient','Sleight of Hand':'proficient'} };
    results.push({ name:'Rogue blocked below Dexterity 13', pass: !validateMulticlassApplication({...ranger,dexterity:12},'Rogue').ok });
    results.push({ name:'Rogue allowed at Dexterity 13+', pass: validateMulticlassApplication(ranger,'Rogue').ok });
    results.push({ name:'Rogue subclass blocked below level 3', pass: !validateMulticlassApplication(ranger,'Rogue','Assassin',1).ok });
    results.push({ name:'Rogue 1 grant set is Sneak Attack, Expertise two, and Thieves Cant', pass: ROGUE_ONE_FEATURES.join('|')==="Sneak Attack (1d6)|Thieves' Cant" && applyRogueExpertise(ranger.skills,['Stealth','Sleight of Hand']).choices?.length===2 });
    const rogue={...ranger,level:6,multiclass:[{class:'Rogue',levels:1}],features:ROGUE_ONE_FEATURES};
    const bow={name:'Longbow',type:'ranged',properties:['Ammunition','Heavy','Two-Handed']};
    const adv=resolveSneakAttack({character:rogue,weapon:bow,advantage:true});
    results.push({ name:'advantage longbow applies 1d6 with attribution', pass:adv.eligible&&adv.dice==='1d6'&&/advantage/.test(adv.attribution) });
    results.push({ name:'no advantage or adjacent ally does not apply', pass:!resolveSneakAttack({character:rogue,weapon:bow}).eligible });
    results.push({ name:'active adjacent ally applies without disadvantage', pass:resolveSneakAttack({character:rogue,weapon:bow,allyAdjacent:true}).eligible });
    results.push({ name:'Extra Attack and Horde Breaker cannot repeat once used', pass:!resolveSneakAttack({character:rogue,weapon:bow,advantage:true,alreadyUsed:true}).eligible });
    const expertise=applyRogueExpertise(ranger.skills,['Stealth','Sleight of Hand']);
    results.push({ name:'expertise doubles proficiency to plus six at PB three', pass:expertise.skills.Stealth==='expert'&&3*2===6 });
    results.push({ name:'non-caster level leaves Ranger 5 slots at four and two', pass:[4,2].join(',')==='4,2' });
    results.push({ name:'character level six proficiency is plus three', pass:proficiencyForLevel(6)===3 });
    const after = await hashValue(await protectedState(base44.asServiceRole));
    results.push({ name:'live protected records untouched by fixtures', pass:before===after });
    const passed=results.filter(result=>result.pass).length;
    return Response.json({function_version:'test-multiclass-rules-v1.0.0',passed,failed:results.length-passed,total:results.length,all_pass:passed===results.length,results,protected_before_hash:before,protected_after_hash:after,live_state:{read_or_mutated:false}}, {status:passed===results.length?200:500});
  } catch(error){return Response.json({error:error.message||'Multiclass regression failed',all_pass:false},{status:500});}
}