import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Spell slot progression by class and level
const SPELL_SLOTS_BY_CLASS = {
  Wizard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Sorcerer: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Bard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Cleric: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Druid: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Paladin: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Ranger: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Artificer: [[0],[2],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Warlock: [[1],[2],[2],[2],[2],[2],[2],[2],[2],[2],[3],[3],[3],[3],[3],[3],[4],[4],[4],[4]], // Pact Magic: always at highest level
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { character_id, rest_type } = await req.json();

    if (!character_id || !rest_type) {
      return Response.json({ error: 'Missing character_id or rest_type' }, { status: 400 });
    }

    // Fetch character
    const characters = await base44.entities.Character.filter({ id: character_id });
    const character = characters[0];

    if (!character) {
      return Response.json({ error: 'Character not found' }, { status: 404 });
    }

    const charClass = character.class;
    const charLevel = character.level || 1;
    const currentSlots = character.spell_slots || {};

    // Get max slots for this class/level
    const slotProgression = SPELL_SLOTS_BY_CLASS[charClass];
    if (!slotProgression) {
      // Non-spellcaster
      return Response.json({
        character: { ...character, spell_slots: {} },
        recovered: [],
        message: `${charClass} does not use spell slots.`
      });
    }

    const maxSlots = slotProgression[charLevel - 1] || [];
    let recovered = [];
    let newSlots = { ...currentSlots };

    if (rest_type === 'long') {
      // Long rest: recover ALL spell slots
      newSlots = {};
      for (let i = 1; i <= maxSlots.length; i++) {
        const slotsAtLevel = maxSlots[i - 1] || 0;
        const usedSlots = currentSlots[`level_${i}`] || 0;
        if (usedSlots > 0) {
          recovered.push(`${usedSlots}×${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'}-level slot${usedSlots>1?'s':''}`);
        }
      }

    } else if (rest_type === 'short') {
      // Short rest recovery rules by class
      if (charClass === 'Warlock') {
        // Warlocks recover ALL pact slots on short rest
        const warlockSlotLevel = Math.min(5, Math.ceil(charLevel / 2));
        const warlockSlots = maxSlots[0] || 0; // Warlock "slots" are in index 0
        const usedSlots = currentSlots[`level_${warlockSlotLevel}`] || 0;
        
        if (usedSlots > 0) {
          newSlots = {};
          recovered.push(`All ${warlockSlots} pact slot${warlockSlots>1?'s':''} (${warlockSlotLevel}${warlockSlotLevel===1?'st':warlockSlotLevel===2?'nd':warlockSlotLevel===3?'rd':'th'}-level)`);
        }

      } else if (charClass === 'Wizard') {
        // Arcane Recovery: once per long rest, recover slots with total level ≤ ⌈wizard level / 2⌉
        // Check if already used
        if (character.arcane_recovery_used) {
          recovered = ['Arcane Recovery already used (recharges on long rest)'];
        } else {
          const recoveryPool = Math.ceil(charLevel / 2);
          let remainingPool = recoveryPool;
          
          // Recover highest slots first (up to 5th level)
          for (let level = Math.min(5, maxSlots.length); level >= 1; level--) {
            const maxAtLevel = maxSlots[level - 1] || 0;
            const usedAtLevel = currentSlots[`level_${level}`] || 0;
            
            if (usedAtLevel > 0 && remainingPool >= level) {
              const toRecover = Math.min(usedAtLevel, Math.floor(remainingPool / level));
              if (toRecover > 0) {
                newSlots[`level_${level}`] = Math.max(0, usedAtLevel - toRecover);
                if (newSlots[`level_${level}`] === 0) delete newSlots[`level_${level}`];
                remainingPool -= toRecover * level;
                recovered.push(`${toRecover}×${level}${level===1?'st':level===2?'nd':level===3?'rd':'th'}-level slot${toRecover>1?'s':''}`);
              }
            }
          }
          
          if (recovered.length > 0) {
            // Mark Arcane Recovery as used
            await base44.entities.Character.update(character_id, { arcane_recovery_used: true });
          } else {
            recovered = ['No spell slots to recover with Arcane Recovery'];
          }
        }

      } else {
        // Other classes don't recover spell slots on short rest
        recovered = [`${charClass}s don't recover spell slots on short rest (long rest required)`];
      }
    }

    // Update character with new slot state
    const updates = { spell_slots: newSlots };
    
    // Reset Arcane Recovery on long rest
    if (rest_type === 'long' && charClass === 'Wizard') {
      updates.arcane_recovery_used = false;
    }

    await base44.entities.Character.update(character_id, updates);

    const updatedCharacter = { ...character, ...updates };

    return Response.json({
      character: updatedCharacter,
      recovered,
      message: recovered.length > 0 ? `Recovered: ${recovered.join(', ')}` : 'No spell slots to recover'
    });

  } catch (error) {
    console.error('Spell slot recovery error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});