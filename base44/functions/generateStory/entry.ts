import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * AI Story Engine - Master Dungeon Master Edition (JavaScript)
 * Features: Chain-of-Thought reflection, long-term campaign memory, 
 * deep reactivity, cinematic style, refined NC-17 support.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, custom_input } = await req.json();

    const session = await base44.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const character = await base44.entities.Character.get(session.character_id);
    const charLevel = character?.level || 1;

    // ====================== MONSTER LOADING ======================
    const monsters = await base44.entities.Monster.list('-created_date', 50);
    
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

    const parseHP = (hpStr) => {
      if (typeof hpStr === 'number') return hpStr;
      if (!hpStr) return 10;
      const match = hpStr.match(/^(\d+)/);
      return match ? parseInt(match[1]) : 10;
    };

    const parseAC = (acStr) => {
      if (typeof acStr === 'number') return acStr;
      if (!acStr) return 10;
      const match = acStr.match(/^(\d+)/);
      return match ? parseInt(match[1]) : 10;
    };

    const maxCR = charLevel <= 2 ? 0.5 : charLevel <= 4 ? 1 : charLevel <= 6 ? 2 : Math.floor(charLevel / 2);
    
    const appropriateMonsters = monsters
      .map(m => ({ ...m, cr_numeric: parseCR(m.challenge) }))
      .filter(m => m.cr_numeric <= maxCR)
      .sort((a, b) => a.cr_numeric - b.cr_numeric)
      .slice(0, 15);

    const combatBlocked = appropriateMonsters.length === 0;

    const monsterNames = appropriateMonsters.map(m => {
      const hp = parseHP(m.hit_points);
      const ac = parseAC(m.armor_class);
      const xpByCR = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800 };
      const xp = xpByCR[m.cr_numeric] || Math.floor(m.cr_numeric * 200);
      return `${m.name} (CR ${m.challenge}, AC ${ac}, HP ${hp}, XP ${xp})`;
    }).join('; ');

    // ====================== CONTEXT BUILDING ======================
    const slotSummary = (() => {
      const slots = character?.spell_slots || {};
      const used = Object.entries(slots).filter(([, v]) => (v || 0) > 0)
        .map(([k, v]) => `${k.replace('level_', 'L')}:${v} used`);
      return used.length ? used.join(', ') : 'all available';
    })();

    const charSummary = character ? `${character.name}, Lvl ${character.level} ${character.race} ${character.class}${character.subclass ? ` (${character.subclass})` : ''} | HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Alignment: ${character.alignment || 'Neutral'} | Stats: STR ${character.strength}, DEX ${character.dexterity}, CON ${character.constitution}, INT ${character.intelligence}, WIS ${character.wisdom}, CHA ${character.charisma} | Skills: ${Object.entries(character.skills || {}).filter(([k,v])=>v).map(([k])=>k).join(', ')} | Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'} | Spell slots: ${slotSummary} | Backstory: ${(character.backstory || 'None').slice(0, 400)}` : '';

    const worldSummary = `Location: ${session.current_location || 'Unknown'} | Season: ${session.season} | Time: ${session.time_of_day} | Weather: ${session.weather || 'clear'} | Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'} | Reputation: ${session.reputation || 0}${session.adult_mode ? ' | Adult mode: ON' : ''}`;

    // Widen the memory window and explicitly surface what the PLAYER did each turn,
    // not just the DM's narration — so deliberate, consequential acts (e.g. swallowing
    // an amulet) stay in context instead of scrolling out after a few turns.
    const recentLog = (session.story_log || []).slice(-8).map(e => {
      const playerLine = (typeof e.player_choice === 'string' && e.player_choice.trim())
        ? `PLAYER: ${e.player_choice.trim()}\n`
        : '';
      return `${playerLine}${e.text}`;
    }).join('\n\n');

    const journalNotes = await base44.entities.PlayerNote.filter({ session_id }, '-updated_date', 20);
    const journalSummary = journalNotes.length
      ? journalNotes.map(note => `- [${note.category || 'General'}] ${note.title}: ${String(note.content || '').slice(0, 200)}`).join('\n')
      : 'No campaign journal notes yet.';

    const campaignMemory = session.campaign_memory || "This is still early in the campaign. Major events and relationships will be tracked here.";

    const adultToneInstruction = session.adult_mode 
      ? `This is an NC-17 / Mature Dark Fantasy campaign. Write like a gritty, intense R-rated or NC-17 story (Game of Thrones, The Witcher, Berserk). Be visceral with violence, gore, betrayal, trauma, profanity, and moral darkness when appropriate. NEVER describe sexual acts, arousal, or explicit views of genitalia. Focus on emotional weight and consequence.`
      : `Maintain a serious, immersive, mature fantasy tone.`;

    const gameDataContext = combatBlocked
      ? `No suitable monsters available — do NOT trigger combat in this scene.`
      : `Available monsters (use EXACT stats when spawning enemies): ${monsterNames}`;

    // ====================== PROMPT BUILDING ======================
    let prompt = '';
    let responseSchema = null;

    const baseContext = `
You are a masterful, reactive Dungeon Master running a living, cinematic campaign.

CHARACTER: ${charSummary}
WORLD STATE: ${worldSummary}
CAMPAIGN MEMORY: ${campaignMemory}
JOURNAL NOTES: ${journalSummary}
RECENT EVENTS: ${recentLog}
${gameDataContext}
`;

    if (action === 'start') {
      prompt = `${baseContext}
${adultToneInstruction}

**DM CHAIN OF THOUGHT (Reflect before writing):**
1. What makes this specific character unique (race, class, alignment, backstory, stats)?
2. How can the opening scene personally tie into their background and motivations?
3. What inciting incident creates immediate stakes while fitting season, time, and setting?
4. How do I make this opening feel fresh and different from previous sessions?
5. What sensory details and tone will pull the player in?

Write a rich, atmospheric 3-4 paragraph opening narrative. End with clear tension. Provide exactly 4 meaningful choices in the structured "choices" field ONLY (include skill checks + DCs on 2-3 of them). Set location_update. No combat in the opening scene.

CRITICAL: Do NOT list, number, or restate the choices inside the "narrative" text itself. The narrative must be pure prose — never include lines like "1. ...", "2. ...", "What do you do?", or any enumerated options. The choices belong solely in the structured choices array.`;

      responseSchema = {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          choices: { type: 'array', items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              skill_check: { type: 'string' },
              dc: { type: 'number' },
              risk_level: { type: 'string', enum: ['low','medium','high','extreme'] }
            }
          }},
          location_update: { type: 'string' },
          quest_trigger: { type: 'string' },
          npc_present: { type: 'string' },
          opening_signature: { type: 'string' }
        }
      };
    } 
    else if (action === 'choice') {
      const playerAction = choice_index !== undefined 
        ? `Player selected choice ${choice_index + 1}` 
        : `Player custom action: ${custom_input}`;

      prompt = `${baseContext}
PLAYER ACTION: ${playerAction}

${adultToneInstruction}

**DM CHAIN OF THOUGHT (Mandatory reflection before writing):**
1. How does this action connect to recent events and campaign memory?
2. How would this character's race, class, alignment, skills, and backstory realistically affect the outcome?
3. What are the short-term and potential long-term consequences?
4. Does this moment advance plot, reveal NPC depth, or change the world?
5. Should combat be triggered? Only when dramatically justified.
6. How do environment (season, time, weather) and current conditions influence the scene?

Write 2-3 vivid, immersive paragraphs. Provide exactly 4 new choices in the structured "choices" field ONLY. Honor any skill check outcomes exactly. Make narrated HP changes, loot, and alignment shifts match the structured fields precisely.

CRITICAL: Do NOT list, number, or restate the choices inside the "narrative" text itself. The narrative must be pure prose — never include lines like "1. ...", "2. ...", "What do you do?", or any enumerated options. The choices belong solely in the structured choices array.`;

      responseSchema = {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          choices: { type: 'array', items: { type: 'object', properties: { text: {type:'string'}, skill_check:{type:'string'}, dc:{type:'number'}, risk_level:{type:'string', enum:['low','medium','high','extreme']} } } },
          combat_trigger: { type: 'boolean' },
          enemies: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, hp:{type:'number'}, current_hp:{type:'number'}, starting_conditions:{type:'array', items:{type:'string'}}, ac:{type:'number'}, attack_bonus:{type:'number'}, damage_dice:{type:'string'}, damage_bonus:{type:'number'}, dexterity:{type:'number'}, cr:{type:'number'}, xp:{type:'number'} } } },
          reputation_change: { type: 'number' },
          hp_change: { type: 'number' },
          xp_earned: { type: 'number' },
          loot: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, type:{type:'string'}, quantity:{type:'number'}, description:{type:'string'}, value:{type:'number'} } } },
          loot_coins: { type: 'object', properties: { gold:{type:'number'}, silver:{type:'number'}, copper:{type:'number'} } },
          location_update: { type: 'string' },
          quest_update: { type: 'object', properties: { new_quest:{type:'string'}, completed_quest:{type:'string'} } },
          new_condition: { type: 'string' },
          plot_flag: { type: 'string' },
          alignment_shift: { type: 'object', properties: { good_evil:{type:'number'}, law_chaos:{type:'number'}, sanity:{type:'number'}, severity:{type:'string', enum:['none','minor','meaningful','critical']}, reason:{type:'string'} } }
        }
      };
    } 
    else if (action === 'combat_narrate') {
      prompt = `${baseContext}
COMBAT CONTEXT: ${custom_input || 'Ongoing fight'}

${adultToneInstruction}

**DM Reflection:** Make this round cinematic, tense, and consistent with previous narration. Use visceral language when appropriate.

Write a gripping 1-2 paragraph combat narrative.`;
      
      responseSchema = {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          atmosphere: { type: 'string' }
        }
      };
    }

    // ====================== LLM CALL ======================
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema,
      temperature: action === 'start' ? 0.85 : 0.73,
      max_tokens: 1400
    });

    // ====================== POST-PROCESSING ======================
    // Authoritatively reconcile the combat flag regardless of whether the LLM
    // returned narrative text: a 'choice' action that does NOT trigger combat must
    // clear in_combat so the client never gets stuck on the combat panel. A
    // combat_trigger sets it true. This runs even when result.narrative is empty.
    if (action === 'choice') {
      await base44.entities.GameSession.update(session_id, {
        in_combat: !!result.combat_trigger,
      });
    }

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
      ].slice(-60);

      const updateData = { story_log: updatedLog };

      // Campaign Memory Refresh — keep a persistent running log of key events so
      // deliberate player actions are never forgotten. A player's custom action is
      // almost always significant intent, so we always record it here.
      const existingMemory = (session.campaign_memory && session.campaign_memory !== "This is still early in the campaign. Major events and relationships will be tracked here.")
        ? session.campaign_memory
        : '';
      let memoryLines = existingMemory ? existingMemory.split('\n').filter(Boolean) : [];

      if (action === 'choice' && typeof custom_input === 'string' && custom_input.trim()) {
        memoryLines.push(`• Player chose to: ${custom_input.trim().slice(0, 160)}`);
      } else if (updatedLog.length % 10 === 0 || action === 'start') {
        memoryLines.push(`• ${(result.narrative || "").slice(0, 200)}`);
      }

      if (memoryLines.length) {
        // Keep the most recent 25 key events to bound prompt size.
        updateData.campaign_memory = memoryLines.slice(-25).join('\n');
      }

      if (result.location_update) updateData.current_location = result.location_update;
      if (action === 'start' && result.opening_signature) updateData.opening_signature = result.opening_signature;
      if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
      if (result.plot_flag) updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
      if (result.combat_trigger) updateData.in_combat = true;
      else if (action === 'choice') updateData.in_combat = false;

      // Quest handling
      if (result.quest_update) {
        const activeQuests = [...(session.active_quests || [])];
        const completedQuests = [...(session.completed_quests || [])];
        if (result.quest_update.new_quest) {
          activeQuests.push({ title: result.quest_update.new_quest, timestamp: new Date().toISOString() });
          updateData.active_quests = activeQuests;
        }
        if (result.quest_update.completed_quest) {
          const idx = activeQuests.findIndex(q => q.title === result.quest_update.completed_quest);
          if (idx >= 0) {
            const done = activeQuests.splice(idx, 1)[0];
            completedQuests.push({ ...done, completed_at: new Date().toISOString() });
            updateData.active_quests = activeQuests;
            updateData.completed_quests = completedQuests;
          }
        }
      }

      await base44.entities.GameSession.update(session_id, updateData);

      // Character condition update
      if (result.new_condition && character) {
        const currentConditions = character.conditions || [];
        const condName = result.new_condition;
        if (!currentConditions.some(c => (typeof c === 'string' ? c : c.name) === condName)) {
          await base44.entities.Character.update(character.id, {
            conditions: [...currentConditions, { name: condName, source: 'story', applied_at: new Date().toISOString() }]
          });
        }
      }

      // HP change
      if (result.hp_change && character) {
        const newHp = Math.max(0, Math.min(character.hp_max || 0, (character.hp_current || 0) + result.hp_change));
        if (newHp !== character.hp_current) {
          await base44.entities.Character.update(character.id, { hp_current: newHp });
        }
      }

      // TODO: Add your full loot + alignment code here if needed
    }

    return Response.json(result);

  } catch (error) {
    console.error('Story generation error:', error);
    return Response.json({ error: error.message || 'Story generation failed' }, { status: 500 });
  }
});