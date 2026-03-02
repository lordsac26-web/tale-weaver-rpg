import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Roll Dice Engine - All rolls computed server-side from DB state
 * Accepts: { session_id, character_id, roll_type, dice, dc, context }
 * Fetches active conditions + modifiers from DB before calculating
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { session_id, character_id, roll_type, dice, dc, context, advantage, disadvantage } = await req.json();

  // Parse dice notation e.g. "2d6", "1d20", "4d6"
  const diceMatch = dice.match(/^(\d+)d(\d+)$/i);
  if (!diceMatch) return Response.json({ error: 'Invalid dice notation' }, { status: 400 });

  const numDice = parseInt(diceMatch[1]);
  const diceSides = parseInt(diceMatch[2]);

  // Roll the dice
  let rawRolls = [];
  for (let i = 0; i < numDice; i++) {
    rawRolls.push(Math.floor(Math.random() * diceSides) + 1);
  }

  // Advantage/Disadvantage for d20 rolls
  let effectiveRolls = [...rawRolls];
  if (diceSides === 20 && numDice === 1) {
    if (advantage) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      rawRolls.push(roll2);
      effectiveRolls = [Math.max(rawRolls[0], roll2)];
    } else if (disadvantage) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      rawRolls.push(roll2);
      effectiveRolls = [Math.min(rawRolls[0], roll2)];
    }
  }

  const rawTotal = effectiveRolls.reduce((a, b) => a + b, 0);

  // Fetch character to get modifiers
  let character = null;
  let modifiersApplied = [];
  let modifierTotal = 0;
  let conditionsActive = [];

  if (character_id) {
    try {
      const chars = await base44.asServiceRole.entities.Character.filter({ id: character_id });
      character = chars[0];
    } catch (_e) {}
  }

  if (character) {
    // Active conditions (poisoned = disadv, stunned, etc.)
    const conditions = character.conditions || [];
    conditionsActive = conditions.map(c => c.name || c);

    // Active temporary modifiers
    const activeMods = character.active_modifiers || [];
    
    // Determine which modifiers apply to this roll type
    for (const mod of activeMods) {
      if (!mod.expires_at || new Date(mod.expires_at) > new Date()) {
        if (!mod.applies_to || mod.applies_to === roll_type || mod.applies_to === 'all') {
          modifiersApplied.push({ source: mod.source, value: mod.value, type: mod.type });
          modifierTotal += mod.value;
        }
      }
    }

    // Stat-based modifiers per roll type
    const statMod = (stat) => Math.floor((stat - 10) / 2);
    const profBonus = character.proficiency_bonus || 2;

    const rollModMap = {
      'attack_melee': statMod(character.strength) + (character.equipped?.weapon?.attack_bonus || 0),
      'attack_ranged': statMod(character.dexterity) + (character.equipped?.weapon?.attack_bonus || 0),
      'attack_spell': statMod(character.intelligence) + (character.equipped?.spellcasting_focus?.bonus || 0),
      'initiative': statMod(character.dexterity),
      'strength_check': statMod(character.strength),
      'dexterity_check': statMod(character.dexterity),
      'constitution_check': statMod(character.constitution),
      'intelligence_check': statMod(character.intelligence),
      'wisdom_check': statMod(character.wisdom),
      'charisma_check': statMod(character.charisma),
      'athletics': statMod(character.strength) + (character.skills?.athletics === 'proficient' ? profBonus : character.skills?.athletics === 'expert' ? profBonus * 2 : 0),
      'acrobatics': statMod(character.dexterity) + (character.skills?.acrobatics === 'proficient' ? profBonus : character.skills?.acrobatics === 'expert' ? profBonus * 2 : 0),
      'stealth': statMod(character.dexterity) + (character.skills?.stealth === 'proficient' ? profBonus : character.skills?.stealth === 'expert' ? profBonus * 2 : 0),
      'perception': statMod(character.wisdom) + (character.skills?.perception === 'proficient' ? profBonus : character.skills?.perception === 'expert' ? profBonus * 2 : 0),
      'persuasion': statMod(character.charisma) + (character.skills?.persuasion === 'proficient' ? profBonus : 0),
      'deception': statMod(character.charisma) + (character.skills?.deception === 'proficient' ? profBonus : 0),
      'intimidation': statMod(character.charisma) + (character.skills?.intimidation === 'proficient' ? profBonus : 0),
      'arcana': statMod(character.intelligence) + (character.skills?.arcana === 'proficient' ? profBonus : 0),
      'sleight_of_hand': statMod(character.dexterity) + (character.skills?.sleight_of_hand === 'proficient' ? profBonus : 0),
      'survival': statMod(character.wisdom) + (character.skills?.survival === 'proficient' ? profBonus : 0),
      'investigation': statMod(character.intelligence) + (character.skills?.investigation === 'proficient' ? profBonus : 0),
      'insight': statMod(character.wisdom) + (character.skills?.insight === 'proficient' ? profBonus : 0),
    };

    if (rollModMap[roll_type] !== undefined) {
      const baseMod = rollModMap[roll_type];
      modifiersApplied.push({ source: 'stat+skill', value: baseMod, type: 'base' });
      modifierTotal += baseMod;
    }

    // Condition penalties
    if (conditionsActive.includes('poisoned') && ['attack_melee', 'attack_ranged', 'attack_spell'].includes(roll_type)) {
      modifiersApplied.push({ source: 'Poisoned', value: -2, type: 'condition' });
      modifierTotal -= 2;
    }
    if (conditionsActive.includes('exhausted')) {
      modifiersApplied.push({ source: 'Exhausted', value: -1, type: 'condition' });
      modifierTotal -= 1;
    }
  }

  // Fetch environmental modifiers from session
  if (session_id) {
    try {
      const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
      const session = sessions[0];
      if (session?.environmental_modifiers) {
        for (const envMod of session.environmental_modifiers) {
          if (!envMod.applies_to || envMod.applies_to === roll_type || envMod.applies_to === 'all') {
            modifiersApplied.push({ source: envMod.source, value: envMod.value, type: 'environmental' });
            modifierTotal += envMod.value;
          }
        }
      }
    } catch (_e) {}
  }

  const finalResult = rawTotal + modifierTotal;
  const success = dc !== undefined ? finalResult >= dc : null;

  // Store roll record
  const rollRecord = {
    session_id: session_id || '',
    character_id: character_id || '',
    roll_type,
    dice,
    raw_rolls: rawRolls,
    raw_total: rawTotal,
    modifiers_applied: modifiersApplied,
    modifier_total: modifierTotal,
    final_result: finalResult,
    dc: dc || null,
    success,
    context: context || '',
    conditions_active: conditionsActive
  };

  await base44.asServiceRole.entities.RollRecord.create(rollRecord);

  return Response.json({
    raw_rolls: rawRolls,
    raw_total: rawTotal,
    modifiers_applied: modifiersApplied,
    modifier_total: modifierTotal,
    final_result: finalResult,
    dc,
    success,
    conditions_active: conditionsActive
  });
});