import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const RARITY_DC = {
  common: 10,
  uncommon: 12,
  rare: 15,
  'very rare': 18,
  legendary: 20,
  artifact: 23,
};

const SKILL_STAT_MAP = {
  Arcana: 'intelligence',
  Investigation: 'intelligence',
};

const calcStatMod = (score) => Math.floor((score - 10) / 2);
const PROFICIENCY_BY_LEVEL = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { character_id, item_id, skill_type } = await req.json();

    if (!character_id || !item_id || !skill_type) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch character and item
    const chars = await base44.entities.Character.filter({ id: character_id });
    const character = chars[0];
    if (!character) {
      return Response.json({ error: 'Character not found' }, { status: 404 });
    }

    const items = await base44.entities.MagicItem.filter({ id: item_id });
    const item = items[0];
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if already identified
    if (item.is_identified) {
      return Response.json({ 
        success: false, 
        message: 'This item is already identified.' 
      });
    }

    // Calculate DC based on rarity
    const dc = RARITY_DC[item.rarity] || 15;

    // Calculate skill modifier
    const statKey = SKILL_STAT_MAP[skill_type];
    const statValue = character[statKey] || 10;
    const baseMod = calcStatMod(statValue);
    const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
    
    const skills = character.skills || {};
    const isProficient = skills[skill_type] || false;
    const hasExpertise = skills[`${skill_type}_expertise`] || false;
    
    const skillModifier = baseMod + (hasExpertise ? profBonus * 2 : isProficient ? profBonus : 0);

    // Roll the dice
    const diceRoll = Math.floor(Math.random() * 20) + 1;
    const totalRoll = diceRoll + skillModifier;
    const success = totalRoll >= dc;

    // If successful, identify the item
    if (success) {
      await base44.entities.MagicItem.update(item_id, {
        is_identified: true,
      });
    }

    return Response.json({
      success,
      diceRoll,
      skillModifier,
      totalRoll,
      dc,
      skillType: skill_type,
      itemName: item.name,
      identifiedName: item.identified_name,
      message: success 
        ? `You successfully identified the ${item.identified_name || 'item'}!` 
        : `You fail to discern the item's true nature.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});