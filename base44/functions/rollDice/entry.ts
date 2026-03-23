import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
    const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
    const profBonus = character.proficiency_bonus || 2;

    // Normalize roll_type: lowercase, replace spaces with underscores
    const normalizedRollType = roll_type.toLowerCase().replace(/\s+/g, '_');

    // Determine spellcasting ability based on class
    const spellcastingAbilityMap = {
      wizard: 'intelligence', eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
      cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
      bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
    };
    const charClass = (character.class || '').toLowerCase();
    const spellcastingAbility = spellcastingAbilityMap[charClass] || 'intelligence';
    const spellMod = statMod(character[spellcastingAbility]);

    // Helper: proficiency for a skill key
    const skillProf = (key) => {
      const val = character.skills?.[key];
      return val === 'expert' ? profBonus * 2 : val === 'proficient' ? profBonus : 0;
    };

    const rollModMap = {
      // Attacks
      'attack_melee': statMod(character.strength) + (character.equipped?.weapon?.attack_bonus || 0),
      'attack_ranged': statMod(character.dexterity) + (character.equipped?.weapon?.attack_bonus || 0),
      'attack_spell': spellMod + profBonus + (character.equipped?.spellcasting_focus?.bonus || 0),
      // Initiative
      'initiative': statMod(character.dexterity),
      // Raw ability checks
      'strength_check': statMod(character.strength),
      'dexterity_check': statMod(character.dexterity),
      'constitution_check': statMod(character.constitution),
      'intelligence_check': statMod(character.intelligence),
      'wisdom_check': statMod(character.wisdom),
      'charisma_check': statMod(character.charisma),
      // Saving throws
      'strength_save': statMod(character.strength) + (character.saving_throws?.strength ? profBonus : 0),
      'dexterity_save': statMod(character.dexterity) + (character.saving_throws?.dexterity ? profBonus : 0),
      'constitution_save': statMod(character.constitution) + (character.saving_throws?.constitution ? profBonus : 0),
      'intelligence_save': statMod(character.intelligence) + (character.saving_throws?.intelligence ? profBonus : 0),
      'wisdom_save': statMod(character.wisdom) + (character.saving_throws?.wisdom ? profBonus : 0),
      'charisma_save': statMod(character.charisma) + (character.saving_throws?.charisma ? profBonus : 0),
      // Skills (STR)
      'athletics': statMod(character.strength) + skillProf('athletics'),
      // Skills (DEX)
      'acrobatics': statMod(character.dexterity) + skillProf('acrobatics'),
      'sleight_of_hand': statMod(character.dexterity) + skillProf('sleight_of_hand'),
      'stealth': statMod(character.dexterity) + skillProf('stealth'),
      // Skills (INT)
      'arcana': statMod(character.intelligence) + skillProf('arcana'),
      'history': statMod(character.intelligence) + skillProf('history'),
      'investigation': statMod(character.intelligence) + skillProf('investigation'),
      'nature': statMod(character.intelligence) + skillProf('nature'),
      'religion': statMod(character.intelligence) + skillProf('religion'),
      // Skills (WIS)
      'animal_handling': statMod(character.wisdom) + skillProf('animal_handling'),
      'insight': statMod(character.wisdom) + skillProf('insight'),
      'medicine': statMod(character.wisdom) + skillProf('medicine'),
      'perception': statMod(character.wisdom) + skillProf('perception'),
      'survival': statMod(character.wisdom) + skillProf('survival'),
      // Skills (CHA)
      'deception': statMod(character.charisma) + skillProf('deception'),
      'intimidation': statMod(character.charisma) + skillProf('intimidation'),
      'performance': statMod(character.charisma) + skillProf('performance'),
      'persuasion': statMod(character.charisma) + skillProf('persuasion'),
    };

    // Look up by normalized roll type — also try common aliases and partial matches
    const aliasMap = {
      // Raw stat names -> check key
      'strength': 'strength_check', 'str': 'strength_check',
      'dexterity': 'dexterity_check', 'dex': 'dexterity_check',
      'constitution': 'constitution_check', 'con': 'constitution_check',
      'intelligence': 'intelligence_check', 'int': 'intelligence_check',
      'wisdom': 'wisdom_check', 'wis': 'wisdom_check',
      'charisma': 'charisma_check', 'cha': 'charisma_check',
      // "X check" -> strip " check"
      'strength_check': 'strength_check', 'dexterity_check': 'dexterity_check',
      'constitution_check': 'constitution_check', 'intelligence_check': 'intelligence_check',
      'wisdom_check': 'wisdom_check', 'charisma_check': 'charisma_check',
      // Saving throws aliases
      'strength_saving_throw': 'strength_save', 'dexterity_saving_throw': 'dexterity_save',
      'constitution_saving_throw': 'constitution_save', 'intelligence_saving_throw': 'intelligence_save',
      'wisdom_saving_throw': 'wisdom_save', 'charisma_saving_throw': 'charisma_save',
    };

    // Clean up common suffixes/prefixes so "Charisma Check" -> "charisma"
    let lookupKey = normalizedRollType
      .replace(/_check$/, '')   // "charisma_check" -> "charisma"
      .replace(/_save$/, '_save')
      .replace(/_saving_throw$/, '_save');

    // Try direct map first, then alias, then stripped key, then partial match
    const resolvedKey =
      rollModMap[normalizedRollType] !== undefined ? normalizedRollType :
      rollModMap[aliasMap[normalizedRollType]] !== undefined ? aliasMap[normalizedRollType] :
      rollModMap[aliasMap[lookupKey]] !== undefined ? aliasMap[lookupKey] :
      rollModMap[lookupKey] !== undefined ? lookupKey :
      // Partial match: find first key containing the roll_type word
      Object.keys(rollModMap).find(k => k.includes(lookupKey) || lookupKey.includes(k.replace(/_check|_save/, ''))) || null;

    if (resolvedKey && rollModMap[resolvedKey] !== undefined) {
      const baseMod = rollModMap[resolvedKey];
      modifiersApplied.push({ source: `${resolvedKey} (stat+skill)`, value: baseMod, type: 'base' });
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