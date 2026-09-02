import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { parseLongRestStoryIntent } from '../../shared/story/longRestStoryAction.ts';
import { parseShortWaitIntent } from '../../shared/story/shortWait.ts';
import { elapsedHoursForRest } from '../../shared/story/worldClock.ts';
import { deriveCanonicalSpellSlots } from '../../shared/spells/slotProgression.ts';
import { buildLongRestCorrectionUpdate } from '../../shared/repairs/misclassifiedLongRestResources.ts';
import { createStaleChoiceApplyToken, verifyStaleChoiceApplyToken } from '../../shared/repairs/staleChoiceApplyToken.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req),user=await base44.auth.me();if(!user||user.role!=='admin')return Response.json({error:'Admin access required.'},{status:403});await req.json().catch(()=>({}));
    const before=await hashValue(await readProtectedDndState(base44.asServiceRole)),tests=[];const test=(name,pass)=>tests.push({name,pass:!!pass});
    const exact='ask if i can stay for a long rest to regain my bearings and then I can head out in the evening',exactIntent=parseLongRestStoryIntent({actionText:exact});
    test('exact live phrase is accepted completed long rest',exactIntent?.accepted_request&&exactIntent.target_period==='Evening');
    test('long rest plus evening parses target',parseLongRestStoryIntent({actionText:'take a long rest until evening'})?.target_period==='Evening');
    test('long rest plus dawn parses target',parseLongRestStoryIntent({actionText:'take a long rest until dawn'})?.target_period==='Dawn');
    test('explicit duration over eight parses',parseLongRestStoryIntent({actionText:'take a long rest for 10 hours'})?.explicit_hours===10);
    test('long rest dominates short wait',parseShortWaitIntent(exact)===null);
    test('plain long rest is affirmative',parseLongRestStoryIntent({actionText:'take a long rest'})?.intent==='long_rest_8h');
    test('metadata accepted completed route',parseLongRestStoryIntent({actionText:'settle down',choiceContext:{canonical_intent:'long_rest_8h'}})?.intent==='long_rest_8h');
    test('question fails closed',parseLongRestStoryIntent({actionText:'can I long rest?'})===null);
    test('negation fails closed',parseLongRestStoryIntent({actionText:"I don't long rest"})===null);
    test('short rest fails closed',parseLongRestStoryIntent({actionText:'take a short rest'})===null);
    test('evening target chooses later than minimum',elapsedHoursForRest({startHour:8,targetPeriod:'Evening'})===12);
    test('dawn target chooses next valid dawn',elapsedHoursForRest({startHour:8,targetPeriod:'Dawn'})===21);
    test('explicit ten hours wins',elapsedHoursForRest({startHour:8,explicitHours:10})===10);
    test('minimum remains eight hours',elapsedHoursForRest({startHour:8})===8);
    const ranger=deriveCanonicalSpellSlots({class:'Ranger',level:6,multiclass:[{class:'Rogue',subclass:'Assassin',levels:1}]});
    test('Ranger five Rogue one class model',ranger.class_breakdown[0].levels===5&&ranger.class_breakdown[1].levels===1);
    test('Ranger five Rogue one maxima',JSON.stringify(ranger.max_slots)==='[4,2]');
    test('slot storage is used counts',ranger.storage_semantics==='used_counts'&&JSON.stringify(ranger.restored_representation)==='{}');
    test('single full caster slots',JSON.stringify(deriveCanonicalSpellSlots({class:'Wizard',level:5}).max_slots)==='[4,3,2]');
    test('single half caster slots',JSON.stringify(deriveCanonicalSpellSlots({class:'Paladin',level:5}).max_slots)==='[4,2]');
    test('full multiclass caster slots',JSON.stringify(deriveCanonicalSpellSlots({class:'Wizard',level:5,multiclass:[{class:'Cleric',levels:2}]}).max_slots)==='[4,3,2]');
    test('noncaster multiclass does not reduce caster table',JSON.stringify(deriveCanonicalSpellSlots({class:'Ranger',level:6,multiclass:[{class:'Rogue',levels:1}]}).max_slots)==='[4,2]');
    test('third caster contribution supported',JSON.stringify(deriveCanonicalSpellSlots({class:'Fighter',subclass:'Eldritch Knight',level:6}).max_slots)==='[3]');
    const character={spell_slots:{level_2:2,level_1:1},inventory:[{name:'Unidentified Staff',item_id:'staff'}],long_rest_abilities:{__item_recovery_receipts:[{token:'staff'}],feature_used:true}},proposal={spell_slots_before:{level_2:2,level_1:1}};
    const correction=buildLongRestCorrectionUpdate({character,proposal,slotDerivation:ranger,proposalHash:'fixture',completedAt:'2026-09-02T00:00:00.000Z'});
    test('correction resets only used slot representation',JSON.stringify(correction.updates.spell_slots)==='{}');
    test('correction preserves staff receipt',correction.updates.long_rest_abilities.__item_recovery_receipts[0].token==='staff');
    test('correction records no clock advance',correction.receipt.clock_advanced===false&&correction.receipt.credited_elapsed_hours===12);
    test('correction records no narration rewrite',correction.receipt.narration_rewritten===false);
    test('correction is immutable and linked',correction.receipt.immutable===true&&correction.receipt.supersedes_short_wait_request_id);
    const scope={characterId:'fixture-character',sessionId:'fixture-session',receiptKey:'fixture-receipt'},receipt={request_id:'fixture-request'},tokenCharacter={created_by_id:user.id,created_date:'fixture'};
    const token=await createStaleChoiceApplyToken({scope,receipt,character:tokenCharacter,expectedHashes:{state:'fixture'},classification:'fixture',proposalHash:'fixture'}),valid=await verifyStaleChoiceApplyToken({token,scope,receipt,character:tokenCharacter}),tampered=await verifyStaleChoiceApplyToken({token:`${token.slice(0,-1)}x`,scope,receipt,character:tokenCharacter}),expiredToken=await createStaleChoiceApplyToken({scope,receipt,character:tokenCharacter,expectedHashes:{state:'fixture'},classification:'fixture',proposalHash:'fixture',expiresInMs:-1}),expired=await verifyStaleChoiceApplyToken({token:expiredToken,scope,receipt,character:tokenCharacter});
    test('state-bound token verifies',valid.ok&&valid.payload.expected_hashes.state==='fixture');
    test('tampered token rejects',!tampered.ok);
    test('expired token rejects',!expired.ok&&/expired/i.test(expired.error));
    test('replay detection key is deterministic',correction.updates.long_rest_abilities.__long_rest_correction_receipts.filter((entry)=>entry.parent_request_id===correction.receipt.parent_request_id).length===1);
    const after=await hashValue(await readProtectedDndState(base44.asServiceRole));test('protected live state unchanged',before===after);
    const passed=tests.filter((entry)=>entry.pass).length;return Response.json({function_version:'mixed-intent-long-rest-regression-v1.0.0',all_pass:passed===tests.length,passed,failed:tests.length-passed,total:tests.length,tests},{status:passed===tests.length?200:500});
  }catch(error){return Response.json({error:error.message||'Mixed long-rest regression failed.'},{status:500});}
}