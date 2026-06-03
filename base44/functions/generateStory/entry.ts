import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI Story Engine - generates narrative, choices, events, NPC dialogue
 * Accepts: { session_id, action, choice_index, custom_input }
 *
 * Fixes & optimizations:
 * - Enemy schema now enforces exact fields combatEngine expects (fixes "undefined" enemy names & HP)
 * - Monster list capped at 8, loaded in parallel with other data
 * - Conditions removed from context (not used downstream, saves tokens)
 * - Story log sliced to last 3 entries (reduces prompt size, speeds up LLM response)
 * - Backstory capped at 200 chars
 * - Magic items removed from context (unused in story generation)
 * - Combat prompt injection ensures AI always returns valid enemy objects
 * - Location/quest/session updates batched into single DB write
 * - XP award uses character data already loaded (avoids extra DB fetch)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, custom_input } = await req.json();

  // Load session + character (user-scoped since they belong to the user)
  const session = await base44.entities.GameSession.get(session_id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const character = await base44.entities.Character.get(session.character_id);

  // Load low-CR monsters appropriate for character level
  const charLevel = character?.level || 1;
  const monsters = await base44.entities.Monster.list('-created_date', 50);
  
  // Parse CR from challenge string (e.g., "0.25 (50 XP)", "1 (200 XP)")
  const parseCR = (crStr) => {
    if (!crStr) return 999;
    const match = crStr.match(/^([\d.\/]+)/);
    if (!match) return 999;
    const crPart = match[1];
    if (crPart.includes('/')) {
      const [num, denom] = crPart.split('/');
      return parseFloat(num) / parseFloat(denom);
    }
    return parseFloat(crPart) || 999;
  };

  // Parse HP average from strings like "11 (2d8+2)"
  const parseHP = (hpStr) => {
    if (typeof hpStr === 'number') return hpStr;
    if (!hpStr) return 10;
    const match = hpStr.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 10;
  };

  // Parse AC from strings like "13 (natural armor)"
  const parseAC = (acStr) => {
    if (typeof acStr === 'number') return acStr;
    if (!acStr) return 10;
    const match = acStr.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 10;
  };

  // Strict CR filtering based on character level
  const maxCR = charLevel <= 2 ? 0.5 : charLevel <= 4 ? 1 : charLevel <= 6 ? 2 : Math.floor(charLevel / 2);
  
  const appropriateMonsters = monsters
    .map(m => ({ ...m, cr_numeric: parseCR(m.challenge) }))
    .filter(m => m.cr_numeric <= maxCR)
    .sort((a, b) => a.cr_numeric - b.cr_numeric)
    .slice(0, 15);

  // If no monsters available, allow story to continue — just disable combat triggers
  const combatBlocked = appropriateMonsters.length === 0;

  const monsterNames = appropriateMonsters.map(m => {
    const hp = parseHP(m.hit_points);
    const ac = parseAC(m.armor_class);
    const xpByCR = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800 };
    const xp = xpByCR[m.cr_numeric] || Math.floor(m.cr_numeric * 200);
    return `${m.name} (CR ${m.challenge}, AC ${ac}, HP ${hp}, XP ${xp})`;
  }).join('; ');

  // Spell-slot usage summary (spell_slots tracks USED counts per level)
  const slotSummary = (() => {
    const slots = character?.spell_slots || {};
    const used = Object.entries(slots).filter(([, v]) => (v || 0) > 0)
      .map(([k, v]) => `${k.replace('level_', 'L')}:${v} used`);
    return used.length ? used.join(', ') : 'all available';
  })();

  // Active concentration spell, if any (stored on the session's combat world_state)
  const concentration = session.combat_state?.concentration_spell || session.world_state?.concentration_spell || null;

  // Build compact character summary
  const charSummary = character ? `${character.name}, Lvl ${character.level} ${character.race} ${character.class} | HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'} | Spell slots: ${slotSummary}${concentration ? ` | Concentrating on: ${concentration}` : ''} | Background: ${(character.backstory || 'Unknown').slice(0, 200)}` : '';

  const worldSummary = `Location: ${session.current_location || 'Unknown'} | Season: ${session.season} | Time: ${session.time_of_day} | Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'} | Reputation: ${session.reputation || 0}${session.adult_mode ? ' | Adult mode: ON' : ''}`;

  // Only last 3 log entries to reduce token usage and speed up response
  const recentLog = (session.story_log || []).slice(-3).map(e => e.text).join('\n');

  const gameDataContext = combatBlocked
    ? `No monsters available in the database — do NOT trigger combat in this scene.`
    : `Available monsters (use EXACT stats when spawning enemies): ${monsterNames}`;

  // Strict enemy schema — enforces all fields combatEngine needs
  const enemyItemSchema = {
    type: 'object',
    properties: {
      name:          { type: 'string', description: 'Monster name exactly as listed above' },
      hp:            { type: 'number', description: 'Maximum hit points as an integer, e.g. 11' },
      current_hp:    { type: 'number', description: 'Current hit points at the START of combat. If the narrative described this enemy as already wounded/injured, set this BELOW hp to reflect the damage. If unharmed, set equal to hp.' },
      starting_conditions: { type: 'array', items: { type: 'string' }, description: 'Conditions the enemy already has when combat begins because of the narrative (e.g. "incapacitated", "prone", "stunned", "restrained"). Empty array if none.' },
      ac:            { type: 'number', description: 'Armor class as an integer, e.g. 13' },
      attack_bonus:  { type: 'number', description: 'Attack roll bonus, e.g. 4' },
      damage_dice:   { type: 'string', description: 'Damage dice string e.g. "1d6", "2d4"' },
      damage_bonus:  { type: 'number', description: 'Flat damage bonus added to roll, e.g. 2' },
      dexterity:     { type: 'number', description: 'Dexterity stat for initiative, e.g. 12' },
      cr:            { type: 'number', description: 'Challenge rating as decimal, e.g. 0.25, 1, 2' },
      xp:            { type: 'number', description: 'XP reward on defeat, e.g. 100' },
    },
    required: ['name', 'hp', 'ac', 'attack_bonus', 'damage_dice', 'damage_bonus', 'cr', 'xp']
  };

  const choiceItemSchema = {
    type: 'object',
    properties: {
      text:        { type: 'string' },
      skill_check: { type: 'string', description: 'D&D 5e skill: Persuasion, Athletics, Perception, Deception, Stealth, Insight, Investigation, Arcana, Intimidation, Acrobatics, Survival, History, Medicine, Religion, etc.' },
      dc:          { type: 'number', description: 'DC 10-25. Easy=10, Moderate=15, Hard=20, Near-impossible=25' },
      risk_level:  { type: 'string', enum: ['low','medium','high','extreme'] }
    }
  };

  let prompt = '';
  let responseSchema = null;

  if (action === 'start') {
    // Build rich character context for varied intros
    const charClass = character?.class || 'Fighter';
    const charRace = character?.race || 'Human';
    const charAlignment = character?.alignment || 'Neutral';
    const charBackground = character?.background || '';
    const charBackstory = (character?.backstory || '').slice(0, 300);
    const charSubclass = character?.subclass || '';
    const sessionSetting = session.setting || 'High Fantasy';
    const storySeed = session.story_seed || '';

    prompt = `You are the Dungeon Master for a ${sessionSetting} RPG. Begin a UNIQUE and ORIGINAL adventure.

CHARACTER DETAILS (use these to tailor the opening):
- Name: ${character?.name || 'Hero'}
- Race: ${charRace} | Class: ${charClass}${charSubclass ? ` (${charSubclass})` : ''} | Level: ${character?.level || 1}
- Alignment: ${charAlignment}
- Background: ${charBackground || 'Unknown'}
- Backstory: ${charBackstory || 'None provided'}
Full stats: ${charSummary}

WORLD STATE:
${worldSummary}

${gameDataContext}

${storySeed ? `PLAYER'S STORY SEED (incorporate this theme/direction): ${storySeed}` : `No story seed provided — create an ORIGINAL scenario from scratch based on the character details above.`}

CRITICAL INSTRUCTIONS FOR THE OPENING:
1. DO NOT start at a tavern, inn, or crossroads unless the story seed specifically asks for it. Be creative with locations!
2. The opening scenario MUST be influenced by the character's race, class, alignment, and background:
   - A Rogue might start mid-heist, in a thieves' guild, overhearing a conspiracy, or fleeing a crime scene
   - A Cleric might begin at a temple receiving a divine vision, tending to plague victims, or investigating a desecrated shrine
   - A Wizard might be in a library discovering a forbidden tome, at an arcane academy, or investigating a magical anomaly
   - A Ranger might start tracking something in the wilderness, discovering unnatural corruption, or at a frontier outpost
   - A Paladin might be on a holy mission, mediating a dispute, or confronting an injustice
   - A Barbarian might be in tribal lands, a fighting pit, arriving in an unfamiliar city, or defending their homeland
   - A Bard might be mid-performance, gathering intelligence at a noble's court, or following a legendary tale
   - A Druid might be in a sacred grove, sensing imbalance in nature, or confronting encroaching civilization
   - A Warlock might be dealing with their patron's demands, investigating occult activity, or hiding their nature
   - A Monk might be at a monastery, on a spiritual pilgrimage, or meditating when disrupted
   - A Sorcerer might be dealing with uncontrolled magic, fleeing persecution, or discovering the source of their power
   - A Fighter might be on guard duty, in a military camp, escorting a caravan, or returning from a mission
   - An Artificer might be in a workshop, at a trade fair, or investigating a malfunctioning construct
3. Race should flavor the world: Elves in ancient forests or elegant cities, Dwarves near mountains or forges, Tieflings facing prejudice, Halflings in pastoral villages, etc.
4. Alignment matters: Good characters encounter people in need; Evil characters encounter opportunities for power; Chaotic characters face authority; Lawful characters face moral dilemmas.
5. The ${sessionSetting} setting defines the tone: Dark Fantasy = gritty/horror, Sci-Fi = technology/space, Cyberpunk = neon/corporate, Historical = grounded/realistic, Anime = dramatic/stylized.
6. Season (${session.season}) and time (${session.time_of_day}) should be woven into atmospheric descriptions.
${session.adult_mode ? '7. Mature/gritty tone permitted — lean into the dark and morally complex.' : ''}

Write an immersive opening narrative (3-4 paragraphs) that:
- Sets a UNIQUE location appropriate to the character (return this in location_update)
- Creates an immediately compelling situation with stakes
- References the character's abilities, background, or nature naturally
- Ends with tension, mystery, or a decision point

Provide exactly 4 choices. Include skill checks and DCs on 2-3 of them. Use skills appropriate to the character's strengths AND weaknesses — Persuasion, Deception, Intimidation, Perception, Investigation, Athletics, Stealth, Insight, Acrobatics, Survival, Arcana, History, Medicine, Religion. DCs: 10=trivial, 15=moderate, 20=hard, 25=extreme.

CRITICAL: Do NOT trigger combat in the opening scene. Focus on exploration, NPC interaction, discovery, or investigation first. Combat should emerge naturally after 3-5 player choices.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:       { type: 'string' },
        choices:         { type: 'array', items: choiceItemSchema },
        location_update: { type: 'string' },
        quest_trigger:   { type: 'string' },
        npc_present:     { type: 'string' }
      }
    };

  } else if (action === 'choice') {
    const selectedChoice = choice_index !== undefined
      ? `Player selected choice ${choice_index + 1}`
      : `Player action: ${custom_input}`;

    const skillCheckNote = selectedChoice.includes('[Skill Check:')
      ? `IMPORTANT: A skill check outcome is in the action text (SUCCESS or FAILURE). Reflect it directly — do not contradict it. On SUCCESS: describe overcoming the challenge vividly. On FAILURE: describe a setback or consequence.`
      : '';

    const combatNote = `COMBAT PACING AND BALANCING RULES — READ CAREFULLY:

1. COMBAT FREQUENCY: Combat should be RARE and MEANINGFUL, not constant. The story should feature:
   - Rich exploration and NPC interactions (60-70% of gameplay)
   - Environmental puzzles and discovery (15-20%)
   - Combat encounters (10-15% — roughly 1 in every 6-8 player choices)
   
2. EARLY GAME PROTECTION: For level 1-2 characters, avoid combat in:
   - The opening scene (first choice)
   - The first 3-5 player actions
   - Scenarios where the player is deliberately avoiding conflict
   - Unless the player explicitly seeks out danger or attacks first

3. ENCOUNTER DESIGN — IF combat_trigger becomes true:
   The enemies array is REQUIRED and MUST use these exact fields:
   - name (string, use monster names from the list above)
   - hp (integer - use the HP number shown)
   - ac (integer - use the AC number shown)
   - attack_bonus (integer 2-4)
   - damage_dice (string like "1d6" or "1d8")
   - damage_bonus (integer 1-3)
   - dexterity (integer 10-14)
   - cr (decimal number from the list)
   - xp (integer from the list)

4. STRICT CR LIMITS BY LEVEL:
   - Level 1: ONLY CR 0-0.125 creatures (Rat, Kobold, etc.). Spawn 1 enemy ONLY.
   - Level 2: CR 0.125-0.25 creatures (Goblin, Wolf). Spawn 1-2 enemies MAX.
   - Level 3-4: CR 0.25-0.5 creatures. Spawn 1-2 enemies.
   - Level 5-6: CR 0.5-1 creatures. Spawn 2-3 enemies.
   - Level 7+: CR 1-2 creatures. Spawn 2-4 enemies.

5. NEVER spawn CR ${character?.level || 1}+ enemies for a level ${character?.level || 1} character.
6. Pull exact stats (HP, AC, attack bonus, damage) from the monster list above — do not invent values.
7. CARRY NARRATIVE STATE INTO COMBAT: The combat encounter MUST reflect what you just narrated. If the narrative described an enemy as wounded, bleeding, struck, or otherwise hurt, set its current_hp BELOW its max hp accordingly (e.g. a badly wounded foe might start at 30-50% HP). If the narrative described an enemy as incapacitated, prone, stunned, or restrained, include those exact conditions in starting_conditions. NEVER spawn an enemy at full health when the narrative said it was already harmed or incapacitated — that contradicts the story.

REMEMBER: A level 1 character has ~10 HP. Two bandits (CR 0.125 each with 11 HP, +3 attack, 1d6+1 damage) can easily kill them in 2 rounds. Be conservative with early encounters.`;

    prompt = `You are the Dungeon Master. Continue the story based on the player's choice.
Character: ${charSummary}
World: ${worldSummary}
${gameDataContext}
Recent Story:
${recentLog}

Player Action: ${selectedChoice}
${skillCheckNote}

Write the consequence narrative (2-3 paragraphs) reacting directly to the action and any skill check outcome. Then provide 4 new choices. Consider active conditions, reputation, environment (${session.season}, ${session.time_of_day}).${session.adult_mode ? ' Mature content permitted.' : ''}

HIT POINTS: If the narrative heals the character (potion, spell, rest, divine blessing, etc.) set hp_change to a POSITIVE integer equal to the HP restored. If the narrative harms the character (trap, fall, environmental hazard, etc.) set hp_change to a NEGATIVE integer equal to the damage taken. If HP is unchanged, omit hp_change or set it to 0. The character currently has ${character?.hp_current ?? '?'}/${character?.hp_max ?? '?'} HP — never heal above max. Whatever number you narrate (e.g. "healed for 10 HP") MUST match hp_change exactly.

LOOT: If the narrative has the player find, take, loot, search up, or receive any physical items (weapons, armor, potions, scrolls, gear, treasure, trinkets), you MUST list each one in the loot array as a structured item so it gets added to their pack. If they find coins, put them in loot_coins. The items you describe in prose MUST match the items in the loot array exactly — never describe looting something without also adding it to loot. If nothing was acquired, leave loot empty.
${combatNote}`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:         { type: 'string' },
        choices:           { type: 'array', items: choiceItemSchema },
        combat_trigger:    { type: 'boolean' },
        enemies:           { type: 'array', items: enemyItemSchema },
        reputation_change: { type: 'number' },
        hp_change:         { type: 'number', description: 'Integer change to the character HP from this scene. Positive = healing, negative = damage. Must match the amount narrated. 0 or omit if unchanged.' },
        xp_earned:         { type: 'number' },
        loot: {
          type: 'array',
          description: 'Real items the player picks up / loots in this scene. ONLY include items the narrative explicitly says the player found, took, looted, or was given. Each becomes a real inventory item. Leave empty if nothing was acquired.',
          items: {
            type: 'object',
            properties: {
              name:        { type: 'string', description: 'Item name, e.g. "Cultist Dagger", "Health Potion", "Silver Ring"' },
              type:        { type: 'string', description: 'Item category: weapon, armor, potion, scroll, gear, treasure, misc' },
              quantity:    { type: 'number', description: 'How many were picked up (default 1)' },
              description: { type: 'string', description: 'Short description of the item' },
              value:       { type: 'number', description: 'Approximate value in gold pieces (0 if worthless)' }
            },
            required: ['name']
          }
        },
        loot_coins: {
          type: 'object',
          description: 'Coins the player picks up in this scene. Omit or use 0 if no coins were found.',
          properties: {
            gold:   { type: 'number' },
            silver: { type: 'number' },
            copper: { type: 'number' }
          }
        },
        location_update:   { type: 'string' },
        quest_update: { type: 'object', properties: { new_quest: { type: 'string', description: 'Title of a newly discovered quest to add' }, completed_quest: { type: 'string', description: 'Title of an existing quest that was just completed' } } },
        new_condition:     { type: 'string' },
        plot_flag:         { type: 'string' }
      }
    };

  } else if (action === 'combat_narrate') {
    prompt = `You are the Dungeon Master narrating a combat round.
Character: ${charSummary}
World: ${worldSummary}
Combat context: ${custom_input}

Write a vivid 1-2 paragraph combat narrative for this round.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:   { type: 'string' },
        atmosphere:  { type: 'string' }
      }
    };

  } else if (action === 'generate_event') {
    prompt = `Generate a random encounter or event appropriate for:
Character: ${charSummary}
World: ${worldSummary}
${gameDataContext}
Type: ${custom_input || 'random'}

Create a context-appropriate event (combat, social, environmental, or discovery).
If it's a combat event, use the enemy schema with real monster stats.`;

    responseSchema = {
      type: 'object',
      properties: {
        event_type:     { type: 'string' },
        narrative:      { type: 'string' },
        choices:        { type: 'array', items: choiceItemSchema },
        combat_trigger: { type: 'boolean' },
        enemies:        { type: 'array', items: enemyItemSchema }
      }
    };
  }

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: responseSchema,
    add_context_from_internet: false
  });

  // Batch all session updates into a single DB write
  if (result.narrative) {
    const updatedLog = [
      ...(session.story_log || []),
      {
        timestamp: new Date().toISOString(),
        action,
        player_choice: custom_input ?? choice_index,
        text: result.narrative,
        choices: result.choices || []
      }
    ].slice(-50); // keep last 50 entries

    const updateData = { story_log: updatedLog };
    if (result.location_update)   updateData.current_location = result.location_update;
    if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
    if (result.plot_flag)         updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
    if (result.combat_trigger)    updateData.in_combat = true;
    else if (action === 'choice') updateData.in_combat = false; // clear stale combat flag after non-combat choices

    // Process quest updates — add/complete quests from AI response
    if (result.quest_update) {
      const activeQuests = session.active_quests || [];
      const completedQuests = session.completed_quests || [];
      if (result.quest_update.new_quest) {
        activeQuests.push({ title: result.quest_update.new_quest, timestamp: new Date().toISOString() });
        updateData.active_quests = activeQuests;
      }
      if (result.quest_update.completed_quest) {
        const idx = activeQuests.findIndex(q => q.title === result.quest_update.completed_quest);
        if (idx >= 0) {
          const [done] = activeQuests.splice(idx, 1);
          completedQuests.push({ ...done, completed_at: new Date().toISOString() });
          updateData.active_quests = activeQuests;
          updateData.completed_quests = completedQuests;
        }
      }
    }

    // Single DB write for session
    await base44.entities.GameSession.update(session_id, updateData);

    // Apply new condition to character if AI returned one
    if (result.new_condition && character) {
      const currentConditions = character.conditions || [];
      const condName = result.new_condition;
      const alreadyHas = currentConditions.some(c => (typeof c === 'string' ? c : c.name) === condName);
      if (!alreadyHas) {
        await base44.entities.Character.update(character.id, {
          conditions: [...currentConditions, { name: condName, source: 'story', applied_at: new Date().toISOString() }]
        });
      }
    }

    // Award XP for non-combat story beats only.
    // Combat victory XP is awarded exclusively in combatEngine to prevent double-awarding.
    const isCombatVictoryCallback = custom_input?.includes('combat has ended in victory');
    if (result.xp_earned && character && !isCombatVictoryCallback) {
      await base44.entities.Character.update(character.id, {
        xp: (character.xp || 0) + result.xp_earned
      });
    }

    // Apply narrative HP change (healing/damage described in the story) to the character.
    // Clamp between 0 and hp_max so we never overheal or go negative.
    if (result.hp_change && character && typeof result.hp_change === 'number') {
      const newHp = Math.max(0, Math.min(character.hp_max || 0, (character.hp_current || 0) + result.hp_change));
      if (newHp !== character.hp_current) {
        await base44.entities.Character.update(character.id, { hp_current: newHp });
        result.hp_current = newHp; // surface to frontend for immediate UI sync
      }
    }

    // Apply narrative LOOT — turn described items/coins into REAL inventory entries.
    // Items found in the story (searching bodies, chests, gifts) are appended to the
    // character's inventory; coins are added to their purse. Mirrors hp_change handling.
    if (character && (Array.isArray(result.loot) && result.loot.length > 0 || result.loot_coins)) {
      const lootUpdate = {};
      if (Array.isArray(result.loot) && result.loot.length > 0) {
        const newItems = result.loot
          .filter(it => it && it.name)
          .map(it => ({
            name: it.name,
            type: it.type || 'misc',
            quantity: it.quantity && it.quantity > 0 ? it.quantity : 1,
            description: it.description || '',
            value: it.value || 0,
            source: 'story_loot',
            acquired_at: new Date().toISOString(),
          }));
        if (newItems.length > 0) {
          lootUpdate.inventory = [...(character.inventory || []), ...newItems];
        }
      }
      const coins = result.loot_coins || {};
      if (coins.gold)   lootUpdate.gold   = (character.gold   || 0) + coins.gold;
      if (coins.silver) lootUpdate.silver = (character.silver || 0) + coins.silver;
      if (coins.copper) lootUpdate.copper = (character.copper || 0) + coins.copper;
      if (Object.keys(lootUpdate).length > 0) {
        await base44.entities.Character.update(character.id, lootUpdate);
      }
    }

    // Validate combat trigger: if true, enemies must exist and be non-empty
    // Also block combat if no appropriate monsters are in the database
    if (result.combat_trigger && (!result.enemies || result.enemies.length === 0)) {
      result.combat_trigger = false;
    }
    if (combatBlocked && result.combat_trigger) {
      result.combat_trigger = false;
      result.enemies = [];
    }
  }

    return Response.json(result);
  } catch (error) {
    console.error('Story generation error:', error);
    return Response.json({ error: error.message || 'Story generation failed' }, { status: 500 });
  }
});