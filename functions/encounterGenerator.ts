import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Encounter Generator Function
 * Creates balanced D&D 5e encounters based on party composition
 * Uses standard encounter building guidelines (XP budgets, CR calculations)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partyLevel, partySize, difficulty, environment } = await req.json();

    // Validate inputs
    if (!partyLevel || partyLevel < 1 || partyLevel > 20) {
      return Response.json({ error: 'Invalid party level (1-20)' }, { status: 400 });
    }
    if (!partySize || partySize < 1 || partySize > 8) {
      return Response.json({ error: 'Invalid party size (1-8)' }, { status: 400 });
    }

    // Calculate XP budget based on difficulty
    const xpBudgets = {
      easy: 25,
      medium: 50,
      hard: 75,
      deadly: 100,
    };

    const multiplier = xpBudgets[difficulty] || 50;
    const totalXPBudget = partyLevel * partySize * multiplier;
    const adjustedBudget = adjustBudgetByPartySize(totalXPBudget, partySize);

    // Fetch available monsters
    const monsters = await base44.asServiceRole.entities.Monster.list('-challenge', 50);

    // Generate encounter
    const encounter = buildEncounter(monsters, adjustedBudget, partyLevel, environment);

    return Response.json({
      success: true,
      encounter: {
        name: generateEncounterName(environment),
        difficulty,
        xpBudget: adjustedBudget,
        xpReward: encounter.totalXP,
        adjustmentFactor: encounter.adjustmentFactor,
        creatures: encounter.creatures,
        environment: environment || 'Unknown',
        description: generateEncounterDescription(encounter, environment),
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// XP Budget Adjustment
// ─────────────────────────────────────────────────────────────────────────

function adjustBudgetByPartySize(budget, partySize) {
  // More creatures means higher adjustment (because XP is divided)
  // Fewer creatures means lower adjustment (because encounters are harder)
  const adjustments = {
    1: 0.5,   // Solo creatures are 2x harder
    2: 0.75,
    3: 1.0,
    4: 1.25,
    5: 1.5,
    6: 1.75,
    7: 2.0,
    8: 2.25,
  };
  return Math.round(budget * (adjustments[partySize] || 1.5));
}

// ─────────────────────────────────────────────────────────────────────────
// Encounter Building
// ─────────────────────────────────────────────────────────────────────────

function buildEncounter(monsters, xpBudget, partyLevel, environment) {
  const encounter = {
    creatures: [],
    totalXP: 0,
    adjustmentFactor: 1,
  };

  if (!monsters || monsters.length === 0) {
    return encounter;
  }

  // Filter monsters by CR relevance to party level
  const relevantMonsters = monsters.filter(m => {
    const cr = parseFloat(m.challenge) || 0;
    return cr <= partyLevel + 2 && cr >= Math.max(0, partyLevel - 3);
  });

  if (relevantMonsters.length === 0) {
    return encounter;
  }

  let remaining = xpBudget;
  let creatureCount = 0;
  const maxCreatures = 8;

  // Build encounter by selecting creatures
  while (remaining > 0 && creatureCount < maxCreatures && relevantMonsters.length > 0) {
    const monster = relevantMonsters[Math.floor(Math.random() * relevantMonsters.length)];
    const xpValue = calculateMonsterXP(monster);

    if (xpValue <= remaining) {
      encounter.creatures.push({
        name: monster.name,
        cr: monster.challenge || '0',
        hp: monster.hit_points || '10',
        ac: monster.armor_class || '10',
        xp: xpValue,
      });

      encounter.totalXP += xpValue;
      remaining -= xpValue;
      creatureCount++;
    } else {
      // Try a smaller monster
      const smallerMonsters = relevantMonsters.filter(m => calculateMonsterXP(m) <= remaining);
      if (smallerMonsters.length > 0) {
        const smaller = smallerMonsters[0];
        const xp = calculateMonsterXP(smaller);
        encounter.creatures.push({
          name: smaller.name,
          cr: smaller.challenge || '0',
          hp: smaller.hit_points || '10',
          ac: smaller.armor_class || '10',
          xp,
        });
        encounter.totalXP += xp;
        remaining -= xp;
        creatureCount++;
      } else {
        break;
      }
    }
  }

  // Calculate adjustment factor based on number of creatures
  encounter.adjustmentFactor = calculateAdjustmentFactor(encounter.creatures.length);

  return encounter;
}

// ─────────────────────────────────────────────────────────────────────────
// XP Calculation
// ─────────────────────────────────────────────────────────────────────────

function calculateMonsterXP(monster) {
  const crToXp = {
    0: 10, '1/8': 25, '1/4': 50, '1/2': 100, 1: 200, 2: 450, 3: 700,
    4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000,
    17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
    23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000,
    29: 135000, 30: 155000,
  };
  
  const cr = String(monster.challenge || 0);
  return crToXp[cr] || parseInt(cr) * 100;
}

function calculateAdjustmentFactor(creatureCount) {
  const factors = {
    1: 1,
    2: 1.5,
    3: 2,
    4: 2.5,
    5: 3,
    6: 3.5,
    7: 4,
    8: 5,
  };
  return factors[creatureCount] || 1;
}

// ─────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────

function generateEncounterName(environment) {
  const names = {
    forest: ['Shadows in the Woods', 'Woodland Ambush', 'Deep in the Thicket'],
    cave: ['Cavern of Darkness', 'Underground Lair', 'Echoing Depths'],
    dungeon: ['Chamber of Secrets', 'Dungeon Trap', 'Throne Room'],
    ruins: ['Lost Ruins', 'Ancient Tomb', 'Forgotten Temple'],
    town: ['Street Confrontation', 'Tavern Brawl', 'Town Square Standoff'],
    desert: ['Dunes Encounter', 'Oasis Ambush', 'Sand Storm Battle'],
    mountain: ['Peak Peril', 'Mountain Pass', 'Cliff Side Battle'],
    water: ['River Crossing', 'Lake Encounter', 'Underwater Combat'],
    urban: ['Urban Showdown', 'City Alley Battle', 'Noble District Conflict'],
  };

  const list = names[environment] || names.dungeon;
  return list[Math.floor(Math.random() * list.length)];
}

function generateEncounterDescription(encounter, environment) {
  const creatureList = encounter.creatures.map(c => `${c.name} (CR ${c.cr})`).join(', ');
  const envDesc = environment ? ` in a ${environment}` : '';
  return `An encounter${envDesc} featuring: ${creatureList}. Total XP reward (before adjustment): ${encounter.totalXP}. Apply a ${encounter.adjustmentFactor}x multiplier for party composition.`;
}