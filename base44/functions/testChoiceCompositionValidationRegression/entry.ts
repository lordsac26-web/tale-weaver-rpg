import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildCompositionResources, validateComposedChoice, validateComposedChoices, CHOICE_COMPOSITION_VALIDATION_VERSION } from '../../shared/story/choiceCompositionValidation.ts';

export default async function(req) {
  const tests=[]; const test=(name,pass)=>tests.push({name,pass:!!pass});
  try {
    const base44=createClientFromRequest(req), user=await base44.auth.me();
    if(!user||user.role!=='admin') return Response.json({error:'Admin access required.'},{status:403});

    const spell_levels = {
      silence: { level: 2, concentration: true },
      "hunter's mark": { level: 1, concentration: true },
      'ensnaring strike': { level: 1, concentration: true },
      'cure wounds': { level: 1, concentration: false }
    };
    const known = ["hunter's mark", 'ensnaring strike', 'silence', 'cure wounds'];
    const makeResources = ({ level2Used=false, concentration=null, arrows=36 }={}) => buildCompositionResources({
      character: {
        name: 'Fixture', class: 'Ranger', level: 7, multiclass: [{ class: 'Rogue', levels: 2 }],
        spell_slots: level2Used ? { level_2: 2 } : {},
        spells_known: known, spells_prepared: known,
        inventory: [{ name: 'Arrows', quantity: arrows }]
      },
      session: concentration ? { world_state: { active_concentration: { spell_name: concentration } } } : { world_state: {} },
      spell_levels
    });

    // Slot table sanity: Ranger 5 (primary) + Rogue 2 -> HALF[4] = [4, 2].
    const sanity = makeResources({});
    test('ranger 5 / rogue 2 derives L1 4 and L2 2 max slots', sanity.available_slots[1]===4 && sanity.available_slots[2]===2);

    // FIXTURE 1: no Silence options while L2 slots are 0/2.
    const exhausted = makeResources({ level2Used: true });
    const silenceOption = { text: 'Cast Silence centered on the primary ritualist\'s position to stop the wards, then fire.', action_type: 'spell_cast' };
    test('no Silence option while L2 slots are 0/2', validateComposedChoice(silenceOption, exhausted).reason_code==='spell_slots_exhausted');
    test('L1 spell option still offered with L1 slots available', validateComposedChoice({ text: "Cast Hunter's Mark on the lead cultist before striking.", action_type: 'spell_cast' }, exhausted).ok===true);

    // FIXTURE 2: no silence-imbued-object phrasing ever — even with slots available.
    const available = makeResources({});
    test('no silence-imbued-object phrasing ever (independent of slots)', validateComposedChoice({ text: 'Initiate an ambush by targeting the primary ritualist with a silence-imbued arrow to prevent them from casting further necrotic wards.', action_type: 'weapon_attack' }, available).reason_code==='illegal_spell_projectile_phrasing');
    test('non-spell options without imbued phrasing pass unchanged', validateComposedChoice({ text: 'Maintain observation to identify the exact courier.', action_type: 'skill_check' }, available).ok===true);

    // FIXTURE 3: option text must match a legal resolution chain.
    test('legal point-area phrasing passes with an L2 slot available', validateComposedChoice(silenceOption, available).ok===true);
    test('legal phrasing names cast-centered resolution', /cast .*centered on .*position/i.test(silenceOption.text));

    // FIXTURE 4: re-validate at dispatch — state changed between generation and click.
    test('click-time re-validation rejects an option that became invalid', validateComposedChoice(silenceOption, makeResources({ level2Used: true })).ok===false);
    test('concentration occupied blocks a new concentration spell option', validateComposedChoice(silenceOption, makeResources({ concentration: 'pass without trace' })).reason_code==='concentration_occupied');

    // Ammunition gating.
    test('ranged attack option without ammunition is never offered', validateComposedChoice({ text: 'Steady a shot at the lead cultist with my longbow.', action_type: 'weapon_attack', weapon_attack: { attack_mode: 'ranged' } }, makeResources({ arrows: 0 })).reason_code==='no_ammunition');
    test('melee attack option needs no ammunition', validateComposedChoice({ text: 'Strike the cultist with my shortsword.', action_type: 'weapon_attack', weapon_attack: { attack_mode: 'melee' } }, makeResources({ arrows: 0 })).ok===true);

    // Composer filter end-to-end.
    const composed = validateComposedChoices([
      silenceOption,
      { text: 'Attempt to stealthily infiltrate the perimeter.', action_type: 'skill_check' },
      { text: 'Lure the cultists into a natural hazard before engaging.', action_type: 'skill_check' }
    ], exhausted);
    test('composer filter strips invalid options and keeps legal ones', composed.valid_choices.length===2 && composed.rejected.length===1 && composed.rejected[0].reason_code==='spell_slots_exhausted');

    const passed=tests.filter((entry)=>entry.pass).length;
    return Response.json({ function_version:'choice-composition-validation-regression-v1.0.0', composition_version:CHOICE_COMPOSITION_VALIDATION_VERSION, passed, failed:tests.length-passed, total:tests.length, all_pass:passed===tests.length, tests },{status:passed===tests.length?200:500});
  } catch(error){ return Response.json({ error:error.message||'Choice composition validation regression failed.', tests },{status:500}); }
}