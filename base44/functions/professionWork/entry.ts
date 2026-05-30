import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Profession Board - Work for Gold
 * Allows characters to earn money by working for a specified number of days
 */

const PROFESSIONS = [
  {
    name: 'Laborer',
    description: 'Manual labor, carrying goods, construction work',
    daily_wage: { min: 2, max: 5 },
    skill: 'strength',
    requirement: 'None'
  },
  {
    name: 'Craftsman',
    description: 'Skilled craftwork, blacksmithing, carpentry',
    daily_wage: { min: 5, max: 10 },
    skill: 'intelligence',
    requirement: 'Tool proficiency recommended'
  },
  {
    name: 'Performer',
    description: 'Entertainment through music, acting, or storytelling',
    daily_wage: { min: 3, max: 8 },
    skill: 'charisma',
    requirement: 'Performance proficiency recommended'
  },
  {
    name: 'Guard',
    description: 'Standing watch, protecting property',
    daily_wage: { min: 4, max: 7 },
    skill: 'constitution',
    requirement: 'None'
  },
  {
    name: 'Scribe',
    description: 'Copying documents, record keeping',
    daily_wage: { min: 4, max: 8 },
    skill: 'intelligence',
    requirement: 'Literacy required'
  },
  {
    name: 'Hunter',
    description: 'Tracking and hunting game for market',
    daily_wage: { min: 3, max: 6 },
    skill: 'wisdom',
    requirement: 'Survival proficiency recommended'
  },
  {
    name: 'Sailor',
    description: 'Ship work, docking, sailing assistance',
    daily_wage: { min: 3, max: 6 },
    skill: 'strength',
    requirement: 'None'
  },
  {
    name: 'Tavern Worker',
    description: 'Serving drinks, cleaning, kitchen work',
    daily_wage: { min: 2, max: 4 },
    skill: 'dexterity',
    requirement: 'None'
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { character_id, profession_name, days } = await req.json();

    if (!character_id || !profession_name || !days || days < 1 || days > 30) {
      return Response.json({ 
        error: 'Invalid parameters. Days must be between 1 and 30.' 
      }, { status: 400 });
    }

    // Get character
    const characters = await base44.asServiceRole.entities.Character.filter({ id: character_id });
    if (!characters || characters.length === 0) {
      return Response.json({ error: 'Character not found' }, { status: 404 });
    }
    
    const character = characters[0];

    // Find profession
    const profession = PROFESSIONS.find(p => p.name === profession_name);
    if (!profession) {
      return Response.json({ error: 'Profession not found' }, { status: 404 });
    }

    // Calculate earnings with some randomness
    let totalEarnings = 0;
    const workLog = [];
    
    for (let day = 1; day <= days; day++) {
      const dailyWage = Math.floor(
        Math.random() * (profession.daily_wage.max - profession.daily_wage.min + 1) + 
        profession.daily_wage.min
      );
      totalEarnings += dailyWage;
      workLog.push({
        day,
        wage: dailyWage,
        date: new Date(Date.now() + (day - 1) * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Convert to gold/silver/copper (1 gp = 10 sp = 100 cp)
    const gold = Math.floor(totalEarnings / 100);
    const remaining = totalEarnings % 100;
    const silver = Math.floor(remaining / 10);
    const copper = remaining % 10;

    // Update character
    const updatedCharacter = await base44.asServiceRole.entities.Character.update(character_id, {
      gold: (character.gold || 0) + gold,
      silver: (character.silver || 0) + silver,
      copper: (character.copper || 0) + copper
    });

    return Response.json({
      success: true,
      profession: profession.name,
      days_worked: days,
      total_earned_cp: totalEarnings,
      breakdown: {
        gold,
        silver,
        copper
      },
      work_log: workLog,
      character: {
        id: updatedCharacter.id,
        gold: updatedCharacter.gold,
        silver: updatedCharacter.silver,
        copper: updatedCharacter.copper
      }
    });
  } catch (error) {
    console.error('Profession work error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});