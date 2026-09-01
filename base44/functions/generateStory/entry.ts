import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { resolveItemRecovery } from '../../shared/story/itemRecovery.ts';
import { executeUtilitySpellCast } from '../../shared/spells/castUtilitySpell.ts';
import { reconcileSessionCombat } from '../../shared/combat/sessionCombatState.ts';
import { factualAftermathFallback, findDeadCombatantContradictions, readCompletedCombatContext } from '../../shared/story/completedCombatContext.ts';
import { isPwt, repairPostRestNarration } from '../../shared/story/postRestResiduals.ts';
import { executePwtCompoundAction } from '../../shared/story/compoundPwtAction.ts';
import { executeLongRestStoryAction } from '../../shared/story/longRestStoryAction.ts';
import { executeThrownWeaponAction, recoverThrownWeapon } from '../../shared/story/thrownWeaponAction.ts';
import { classifyPrecisionAmbushIntent, normalizePendingAmbushRoster, pendingAmbushNarrative, stripGeneratedChoiceAnnotations } from '../../shared/story/generatedChoiceIntent.js';
import { enforceStorySkillOutcomeInvariant } from '../../shared/story/storySkillCheck.ts';
import { resolutionFromReceipt } from '../../shared/story/unifiedStorySkillResolution.ts';
import { recoveryAnnotation } from '../../shared/story/projectileLifecycle.ts';
import { commitNarratedStoryInventoryRecovery, narrationMayPublishRecovery } from '../../shared/story/narratedStoryInventoryCommit.ts';
import { canonicalStoryResponsePayload, commitStoryTransition, hashStoryValue, hydrateLatestStoryEntry, storyPayloadFromCommit, STORY_TRANSITION_VERSION } from '../../shared/story/storyTransition.ts';
import { buildGameHydration, finalizeGeneratedStoryResult } from '../../shared/story/storyBootstrap.ts';

/**
 * AI Story Engine - Master Dungeon Master Edition (JavaScript)
 * Features: Chain-of-Thought reflection, long-term campaign memory, 
 * deep reactivity, cinematic style, refined NC-17 support.
 */

const CONDITION_PLACEHOLDERS = new Set(['', 'none', 'normal', 'no condition', 'no conditions', 'n/a', 'null', 'undefined']);
const TEMPORARY_STORY_CONDITIONS = new Set([
  'silenced', 'silence', 'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious', 'hidden', 'marked target', 'alert', 'rejuvenated'
]);
const conditionName = (value) => String(typeof value === 'string' ? value : value?.name || '').trim();
const conditionKey = (value) => conditionName(value).toLowerCase();
const validConditionName = (value) => !CONDITION_PLACEHOLDERS.has(conditionKey(value));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, choice_text, custom_input, choice_context: incomingChoiceContext, request_id, story_sequence } = await req.json();

    let session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const combatState = await reconcileSessionCombat(base44, session_id);
    session = combatState.session;

    const character = await base44.asServiceRole.entities.Character.get(session.character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    if (!characterBelongsToUser(character, user)) {
      return Response.json({ error: 'Session character does not belong to the authenticated user' }, { status: 403 });
    }
    if (action === 'hydrate') return Response.json(buildGameHydration(session, character));
    const storyRequestId = String(request_id || '').slice(0, 120);
    if (action === 'start') {
      const existingOpening = hydrateLatestStoryEntry(session);
      if (existingOpening.text && existingOpening.choices.length >= 4) return Response.json({ narrative: existingOpening.text, choices: existingOpening.choices, ...storyPayloadFromCommit({ entry: existingOpening.entry, index: existingOpening.index }), already_processed: true });
    }
    let authoritativeChoiceContext = incomingChoiceContext && typeof incomingChoiceContext === 'object' ? incomingChoiceContext : {};
    if (action === 'choice' && authoritativeChoiceContext?.check?.raw_d20 != null) {
      const incomingCheck = authoritativeChoiceContext.check;
      const persistedCheck = (session.world_state?.__skill_check_receipts || []).find((entry) => entry?.request_id === incomingCheck.request_id && entry?.unified_story_skill_resolution === true);
      if (!persistedCheck || persistedCheck.request_id !== storyRequestId || JSON.stringify(persistedCheck) !== JSON.stringify(incomingCheck)) return Response.json({ error: 'The story skill receipt is not the persisted authoritative resolution.', invalid: true, writes: 0 }, { status: 409 });
      authoritativeChoiceContext = { ...authoritativeChoiceContext, check: persistedCheck, authoritative_skill_resolution: resolutionFromReceipt(persistedCheck) };
    }
    const completedCombat = await readCompletedCombatContext(base44, session) || (authoritativeChoiceContext?.completed_combat && typeof authoritativeChoiceContext.completed_combat === 'object'
      ? authoritativeChoiceContext.completed_combat : null);
    const selectedChoice = action === 'choice' ? stripGeneratedChoiceAnnotations(choice_text || custom_input || `Selected choice ${Number(choice_index || 0) + 1}`) : '';
    const ambushIntent = action === 'choice' ? classifyPrecisionAmbushIntent(selectedChoice) : null;
    if (ambushIntent && (!authoritativeChoiceContext?.check || !Number.isFinite(Number(authoritativeChoiceContext.check.raw_d20)) || !Number.isFinite(Number(authoritativeChoiceContext.check.final_total)))) return Response.json({ error: 'Precision stealth strikes require a fresh persisted Stealth setup receipt before narration.', invalid: true }, { status: 409 });
    if (action === 'choice' && storyRequestId) {
      const longRest = await executeLongRestStoryAction({ base44, ownerId: user.id, payload: { session_id, character_id: character.id, action_text: selectedChoice, choice_context: authoritativeChoiceContext, request_id: storyRequestId } });
      if (longRest.body?.handled) return Response.json({ narrative: longRest.body.narration, choices: [], long_rest: longRest.body }, { status: longRest.status });
      const compound = await executePwtCompoundAction({ base44, user, payload: { session_id, character_id: character.id, action_text: selectedChoice, request_id: storyRequestId, skill_dc: authoritativeChoiceContext?.skill_dc } });
      if (compound.body?.handled) {
        if (compound.status >= 400) return Response.json(compound.body, { status: compound.status });
        const freshSession = await base44.asServiceRole.entities.GameSession.get(session_id);
        const existing = (freshSession?.story_log || []).find((entry) => entry?.request_id === storyRequestId);
        if (existing?.text) return Response.json({ narrative: existing.text, choices: existing.choices || [], compound_action: compound.body, already_processed: true });
        const entry = { timestamp: new Date().toISOString(), action: 'choice', request_id: storyRequestId, player_choice: selectedChoice, text: compound.body.narration, choices: [], compound_action: { child_ids: compound.body.child_ids, plan: compound.body.plan, skill: compound.body.skill } };
        await base44.asServiceRole.entities.GameSession.update(session_id, { story_log: [...(freshSession?.story_log || []), entry].slice(-60) });
        return Response.json({ narrative: compound.body.narration, choices: [], compound_action: compound.body });
      }
    }
    let authoritativeWeaponAction = null;
    if (action === 'choice') {
      const thrownOutcome = await executeThrownWeaponAction({
        base44,
        user,
        payload: { session_id, character_id: character.id, action_text: selectedChoice, request_id: storyRequestId, weapon_attack: authoritativeChoiceContext?.weapon_attack },
      });
      if (thrownOutcome.body?.handled) {
        if (thrownOutcome.status >= 400) return Response.json(thrownOutcome.body, { status: thrownOutcome.status });
        authoritativeWeaponAction = thrownOutcome.body;
      }
      if (authoritativeChoiceContext?.thrown_recovery) {
        const recoveryOutcome = await recoverThrownWeapon({ base44, user, payload: { session_id, character_id: character.id, request_id: storyRequestId, ...authoritativeChoiceContext.thrown_recovery, check: authoritativeChoiceContext.check } });
        if (recoveryOutcome.status >= 400) return Response.json(recoveryOutcome.body, { status: recoveryOutcome.status });
      }
    }
    let authoritativeRecovery = null;
    let itemRecovery = { applied: false, writes: 0 };
    if (action === 'choice' && authoritativeChoiceContext?.recovery) {
      const recovery = authoritativeChoiceContext.recovery;
      const check = authoritativeChoiceContext.check || { success: recovery.rule?.type === 'automatic_recovery' };
      const committed = await commitNarratedStoryInventoryRecovery({ base44, sessionId:session_id, characterId:character.id, requestId:storyRequestId, check, recovery });
      if (!committed.body?.applied) return Response.json({ error:committed.body?.reason || 'Recovery did not commit.', invalid:true, writes:0 }, { status:committed.status >= 400 ? committed.status : 409 });
      itemRecovery = { applied:true, already_processed:!!committed.body.already_processed, recovered_items:committed.body.recovered_items || [], item_recovery:{ request_id:storyRequestId, recovered_items:committed.body.recovered_items || [], quantity:(committed.body.recovered_items || []).reduce((sum,item)=>sum+Number(item.quantity || 0),0), item_name:(committed.body.recovered_items || []).map((item)=>item.canonical_item).join(' and '), inventory_result:committed.body.receipt?.inventory_result }, writes:committed.body.writes };
      authoritativeRecovery = { recovery, check, applied:true, recovered_items:itemRecovery.recovered_items, annotation:recoveryAnnotation({ recovery, resolution:check, applied:true, recoveredItems:itemRecovery.recovered_items }) };
    }
    let authoritativeSpellCast = null;
    if (action === 'choice' && storyRequestId) {
      const castOutcome = await executeUtilitySpellCast({
        base44,
        user,
        payload: { session_id, character_id: character.id, action_text: selectedChoice, request_id: `${storyRequestId}:intent:0` },
      });
      if (castOutcome.status >= 400) return Response.json(castOutcome.body, { status: castOutcome.status });
      if (castOutcome.body?.spell_detected) authoritativeSpellCast = castOutcome.body;
    }
    if (action === 'choice' && storyRequestId) {
      const existingIndex = (session.story_log || []).findIndex((entry) => entry?.request_id === storyRequestId);
      const existing = existingIndex >= 0 ? session.story_log[existingIndex] : null;
      if (existing?.text) return Response.json({ narrative: existing.text, choices: Array.isArray(existing.choices) ? existing.choices : [], ...storyPayloadFromCommit({ entry: existing, index: existingIndex }), already_processed: true, ...(existing.item_recovery ? { item_recovery: { ...existing.item_recovery, already_processed: true } } : {}) });
      // Skill receipts are persisted atomically by resolveStorySkillCheck. Do not stage
      // blank story entries here; failed invariant checks must leave story state untouched.
    }
    const charLevel = character.level || 1;

    // ====================== MONSTER LOADING ======================
    const monsters = await base44.asServiceRole.entities.Monster.list('-created_date', 50);
    
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

    const journalNotes = await base44.asServiceRole.entities.PlayerNote.filter({ session_id }, '-updated_date', 20);
    const journalSummary = journalNotes.length
      ? journalNotes.map(note => `- [${note.category || 'General'}] ${note.title}: ${String(note.content || '').slice(0, 200)}`).join('\n')
      : 'No campaign journal notes yet.';

    const campaignMemory = session.campaign_memory || "This is still early in the campaign. Major events and relationships will be tracked here.";

    // PERMANENT KEY EVENTS — critical, story-defining player actions that must never
    // be forgotten (e.g. swallowing the amulet). These are surfaced on EVERY turn so
    // the story engine keeps referencing them, no matter how long ago they happened.
    const keyEvents = Array.isArray(session.key_events) ? session.key_events : [];
    const keyEventsSummary = keyEvents.length
      ? keyEvents.map(ev => `• ${ev.summary}`).join('\n')
      : 'None recorded yet.';

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
PERMANENT KEY EVENTS (these are established, irreversible facts — always honor and reference them when relevant; never contradict or forget them):
${keyEventsSummary}
CAMPAIGN MEMORY: ${campaignMemory}
JOURNAL NOTES: ${journalSummary}
RECENT EVENTS: ${recentLog}
${gameDataContext}
${authoritativeSpellCast ? `AUTHORITATIVE SPELL RESULT: ${authoritativeSpellCast.spell_name} ${authoritativeSpellCast.already_processed ? 'was already processed; do not repeat it.' : `was cast at level ${authoritativeSpellCast.slot_level}.`} ${authoritativeSpellCast.concentration ? 'Concentration is active.' : ''} ${String(authoritativeSpellCast.spell_name || '').toLowerCase() === 'pass without trace' ? '+10 Stealth is active for the spell duration; narrate these facts exactly and do not deduct another slot.' : 'Do not deduct another slot or invent a different mechanical outcome.'}` : ''}
${authoritativeWeaponAction ? `AUTHORITATIVE THROWN-WEAPON RESULT: exactly one ${authoritativeWeaponAction.weapon_attack.item_name} (${authoritativeWeaponAction.weapon_attack.item_id}) was consumed. Target: ${authoritativeWeaponAction.weapon_attack.target}. Outcome: ${authoritativeWeaponAction.weapon_attack.hit ? 'hit' : 'miss'}${authoritativeWeaponAction.weapon_attack.kill ? ' and confirmed kill' : ''}. Narrate only this result; never invent a kill without confirmed kill.` : ''}
${authoritativeRecovery ? `AUTHORITATIVE PROJECTILE RECOVERY: ${authoritativeRecovery.annotation} This inventory result is already committed when successful. Never claim any other item or quantity.` : ''}
${completedCombat ? `COMPLETED COMBAT CONTEXT: Combat ${completedCombat.combat_id} ended in ${completedCombat.result}. Dead enemies: ${(completedCombat.defeated_enemies || completedCombat.dead_enemies || []).map((enemy) => enemy.name || enemy.id).join(', ') || 'all listed enemies'}. This is aftermath narration only: combat_trigger MUST be false, enemies MUST be [], and no dead enemy may escape or re-engage.` : ''}
${authoritativeChoiceContext?.authoritative_skill_resolution ? `AUTHORITATIVE SKILL CHECK: ${authoritativeChoiceContext.check.skill} DC${authoritativeChoiceContext.check.dc}; original d20 ${authoritativeChoiceContext.check.raw_d20} + authoritative modifier ${authoritativeChoiceContext.check.modifier_total} = ${authoritativeChoiceContext.check.final_total}; ${authoritativeChoiceContext.check.success ? 'SUCCESS' : 'FAILURE'}. The narration, condition update, HP change, and combat trigger must honor this exact receipt.` : ''}
${ambushIntent ? `PENDING AMBUSH CONTRACT: This action resolves ONLY the Stealth setup phase. Do not narrate an arrow release, weapon attack, hit, damage, target defeat, concentration break, or death. If combat starts, the living ritual target must appear exactly once in enemies with complete HP and AC; the actual strike will be resolved later through player_attack.` : ''}
${Number(character.exhaustion_level || 0) === 0 && session.world_state?.post_rest_continuity?.rested ? 'POST-REST FACT: the character is fully rested and alert. Do not describe fatigue, tiredness, weariness, raggedness, sleeplessness, or exhaustion unless a new structured mechanic explicitly causes it.' : ''}
${Number(character.exhaustion_level || 0) === 0 && session.world_state?.post_rest_continuity?.rested ? 'POST-REST FACT: the character completed a successful rest and is not exhausted. Do not describe fatigue, tiredness, weariness, raggedness, sleeplessness, or impaired focus unless a new mechanical effect explicitly causes it.' : ''}
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

Write a rich, atmospheric 3-4 paragraph opening narrative. End with clear tension. Provide exactly 4 meaningful choices in the structured "choices" field ONLY (include skill checks + DCs on 2-3 of them). A choice that genuinely recovers arrows must include structured recovery {type:"arrows", quantity:1-20}; a specific tangible item must include {type:"item", item:{item_id?, name, quantity, stackable, category, rarity, description, source}}. Otherwise recovery must be null. Set location_update. No combat in the opening scene.

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
                           risk_level: { type: 'string', enum: ['low','medium','high','extreme'] },
                           recovery: { type: 'object', properties: { type: { type: 'string', enum: ['arrows', 'item'] }, quantity: { type: 'number' }, item: { type: 'object', properties: { item_id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'number' }, stackable: { type: 'boolean' }, category: { type: 'string' }, rarity: { type: 'string' }, description: { type: 'string' }, source: { type: 'string' } } } } }
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
      const playerAction = selectedChoice || (choice_index !== undefined
        ? `Player selected choice ${choice_index + 1}`
        : `Player custom action: ${custom_input}`);

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

Write 2-3 vivid, immersive paragraphs. Provide exactly 4 new choices in the structured "choices" field ONLY. Honor any skill check outcomes exactly. Make narrated HP changes, loot, and alignment shifts match the structured fields precisely. For a concrete item gained by the CURRENT action, set current_recovery to an exact structured object: {type:"arrows", quantity:1-20} or {type:"item", item:{item_id?, name, quantity, stackable, category, rarity, description, source}}. Otherwise current_recovery must be null. Never claim that an item was found or recovered unless current_recovery is exact and the authoritative check succeeded. A choice that genuinely recovers arrows must include structured recovery {type:"arrows", quantity:1-20}; otherwise recovery must be null.

CONDITION CONTRACT: condition_update is ONLY for a real mechanical status affecting the PLAYER CHARACTER. Set target to "player" only when the player is actually affected; use "other" for an enemy/NPC effect and "none" when no player condition changes. Never use placeholder labels such as "None", "Normal", or "N/A". Use the remove field when a prior player condition ends. Choose duration "scene", "combat", or "persistent" accurately. Enemy conditions that begin combat belong in that enemy's starting_conditions, never on the player.

KEY EVENT TRACKING: If this turn produces a CRITICAL, story-defining, irreversible development — something that must shape every future scene (e.g. the player swallows/consumes a magic item, kills or spares a major NPC, makes a binding pact, gains/loses a unique power, destroys an artifact, makes a permanent vow or transformation) — set the "key_event" field to a concise one-sentence summary of that fact written in past tense (e.g. "Blade swallowed the unknown power-exuding amulet, which now resides inside him."). Only set "key_event" for genuinely permanent, plot-defining moments — leave it empty for routine actions.

CRITICAL: Do NOT list, number, or restate the choices inside the "narrative" text itself. The narrative must be pure prose — never include lines like "1. ...", "2. ...", "What do you do?", or any enumerated options. The choices belong solely in the structured choices array.`;

      responseSchema = {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          choices: { type: 'array', items: { type: 'object', properties: { text: {type:'string'}, skill_check:{type:'string'}, dc:{type:'number'}, risk_level:{type:'string', enum:['low','medium','high','extreme']}, recovery:{ type:'object', properties:{ type:{type:'string', enum:['arrows']}, quantity:{type:'number'} } } } } },
          combat_trigger: { type: 'boolean' },
          enemies: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, hp:{type:'number'}, current_hp:{type:'number'}, starting_conditions:{type:'array', items:{type:'string'}}, ac:{type:'number'}, attack_bonus:{type:'number'}, damage_dice:{type:'string'}, damage_bonus:{type:'number'}, dexterity:{type:'number'}, cr:{type:'number'}, xp:{type:'number'} } } },
          reputation_change: { type: 'number' },
          hp_change: { type: 'number' },
          xp_earned: { type: 'number' },
          loot: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, type:{type:'string'}, quantity:{type:'number'}, description:{type:'string'}, value:{type:'number'} } } },
          loot_coins: { type: 'object', properties: { gold:{type:'number'}, silver:{type:'number'}, copper:{type:'number'} } },
          current_recovery: { type:'object', properties:{ type:{type:'string',enum:['arrows','item']}, quantity:{type:'number'}, item:{type:'object',properties:{name:{type:'string'},quantity:{type:'number'},stackable:{type:'boolean'},category:{type:'string'},rarity:{type:'string'},description:{type:'string'},source:{type:'string'},item_id:{type:'string'}}} } },
          location_update: { type: 'string' },
          quest_update: { type: 'object', properties: { new_quest:{type:'string'}, completed_quest:{type:'string'} } },
          condition_update: {
            type: 'object',
            properties: {
              target: { type: 'string', enum: ['player', 'other', 'none'] },
              add: { type: 'string' },
              remove: { type: 'array', items: { type: 'string' } },
              duration: { type: 'string', enum: ['scene', 'combat', 'persistent'] }
            }
          },
          plot_flag: { type: 'string' },
          key_event: { type: 'string' },
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
    const generateNarrative = (nextPrompt) => base44.integrations.Core.InvokeLLM({
      prompt: nextPrompt,
      response_json_schema: responseSchema,
      temperature: action === 'start' ? 0.85 : 0.73,
      max_tokens: 1400
    });
    let result = await generateNarrative(prompt);
    const postRestNoMagic = Number(character.exhaustion_level || 0) === 0 && session.world_state?.post_rest_continuity?.rested && !isPwt((character.conditions || []).find(isPwt)) && !isPwt(session.world_state?.active_concentration);
    if (postRestNoMagic && result?.narrative) result = { ...result, narrative: repairPostRestNarration(result.narrative).text };
    const contradictions = completedCombat ? findDeadCombatantContradictions(result?.narrative, completedCombat) : [];
    if (contradictions.length) {
      result = await generateNarrative(`${prompt}\n\nCONTINUITY CORRECTION: The prior candidate falsely gave agency to defeated enemies: ${contradictions.map(item => `${item.name} (${item.action})`).join(', ')}. Rewrite the narration with every defeated enemy motionless and unable to act, speak, flee, struggle, or trigger combat.`);
      if (findDeadCombatantContradictions(result?.narrative, completedCombat).length) {
        result = { ...result, narrative: factualAftermathFallback(completedCombat), combat_trigger: false, enemies: [], choices: [] };
      }
    }
    if (ambushIntent) {
      const setupSucceeded = authoritativeChoiceContext.check.success === true;
      const roster = setupSucceeded && result.combat_trigger ? normalizePendingAmbushRoster(result.enemies) : { ok: false, enemies: [] };
      result = { ...result, narrative: pendingAmbushNarrative(ambushIntent.target_hint, setupSucceeded), key_event: '', combat_trigger: setupSucceeded && result.combat_trigger && roster.ok, enemies: roster.ok ? roster.enemies : [], pending_ambush_attack: setupSucceeded && roster.ok ? { request_id: storyRequestId, target_name: roster.target.name, setup_receipt_id: authoritativeChoiceContext.check.id || authoritativeChoiceContext.check.request_id, setup_success: true } : null };
    }

    result = finalizeGeneratedStoryResult(result, { location: result?.location_update || session.current_location || 'the current area', requestId: storyRequestId, previousChoices: hydrateLatestStoryEntry(session).choices });
    const skillInvariant = enforceStorySkillOutcomeInvariant(result, selectedChoice || custom_input, authoritativeChoiceContext?.authoritative_skill_resolution);
    if (!skillInvariant.ok) return Response.json({ error: skillInvariant.error, invalid: true, writes: 0 }, { status: 409 });
    result = skillInvariant.result;
    if (!authoritativeRecovery && action === 'choice' && result.current_recovery) {
      const committed = await commitNarratedStoryInventoryRecovery({ base44, sessionId:session_id, characterId:character.id, requestId:storyRequestId, check:authoritativeChoiceContext.check, recovery:result.current_recovery });
      if (!committed.body?.applied) return Response.json({ error:committed.body?.reason || 'Structured reward did not commit.', invalid:true, writes:0 },{status:committed.status >= 400 ? committed.status : 409});
      itemRecovery = { applied:true, already_processed:!!committed.body.already_processed, recovered_items:committed.body.recovered_items || [], item_recovery:{request_id:storyRequestId,recovered_items:committed.body.recovered_items || [],quantity:(committed.body.recovered_items || []).reduce((sum,item)=>sum+Number(item.quantity||0),0),item_name:(committed.body.recovered_items || []).map((item)=>item.canonical_item).join(' and '),inventory_result:committed.body.receipt?.inventory_result} };
      authoritativeRecovery = { recovery:result.current_recovery, check:authoritativeChoiceContext.check, applied:true, recovered_items:itemRecovery.recovered_items, annotation:recoveryAnnotation({recovery:result.current_recovery,resolution:authoritativeChoiceContext.check,applied:true,recoveredItems:itemRecovery.recovered_items}) };
    }
    if (!narrationMayPublishRecovery({ narrative:result.narrative, committed:authoritativeRecovery?.applied === true })) return Response.json({error:'Exact item-recovery narration requires a committed structured receipt.',invalid:true,writes:0},{status:409});

    // ====================== POST-PROCESSING ======================
    if (authoritativeRecovery) {
      result = { ...result, narrative: authoritativeRecovery.annotation, recovery_resolution: authoritativeRecovery, combat_trigger: false, enemies: [], item_recovery: itemRecovery.applied ? { ...itemRecovery.item_recovery, already_processed: !!itemRecovery.already_processed } : null };
    }

    // Story narration never owns combat linkage. Only startCombat may link a live
    // CombatLog, and invalid legacy linkage is reconciled to story mode above.
    if (completedCombat) {
      result.combat_trigger = false;
      result.enemies = [];
    }

    if (result.narrative) {
      const commitSession = storyRequestId ? await base44.asServiceRole.entities.GameSession.get(session_id) : session;
      const incomingStorySequence = Number(story_sequence || 0);
      const persistedStorySequence = Number(commitSession?.world_state?.__story_transition_sequence || 0);
      if (incomingStorySequence > 0 && persistedStorySequence > incomingStorySequence) return Response.json({ error: 'A newer story transition is already committed.', superseded: true, writes: 0, transition_version: STORY_TRANSITION_VERSION }, { status: 409 });
      const immediatelyPreceding = hydrateLatestStoryEntry(commitSession);
      result = finalizeGeneratedStoryResult(result, { location: result?.location_update || commitSession.current_location || 'the current area', requestId: storyRequestId, previousChoices: immediatelyPreceding.choices });
      const skillCheck = authoritativeChoiceContext?.check?.raw_d20 != null ? authoritativeChoiceContext.check : null;
      const previousChoiceHash = await hashStoryValue(immediatelyPreceding.choices);
      const currentChoiceHash = await hashStoryValue(result.choices);
      const responsePayloadHash = await hashStoryValue(canonicalStoryResponsePayload({ requestId: storyRequestId, text: result.narrative, choices: result.choices, skillCheck }));
      const completedEntry = {
        timestamp: new Date().toISOString(), action,
        ...(storyRequestId ? { request_id: storyRequestId } : {}),
        player_choice: action === 'choice' ? selectedChoice : (custom_input ?? choice_index),
        text: result.narrative, choices: result.choices,
        ...(skillCheck ? { skill_check: skillCheck, skill_display: result.skill_display } : {}),
        choice_evidence: { previous_choice_hash: previousChoiceHash, current_choice_hash: currentChoiceHash, response_payload_hash: responsePayloadHash, guard: result.choice_guard },
        ...(result.combat_handoff ? { combat_handoff: result.combat_handoff } : {}),
        ...(result.item_recovery ? { item_recovery: result.item_recovery } : {}),
        ...(result.recovery_resolution ? { recovery_resolution: result.recovery_resolution } : {})
      };
      result = { ...result, previous_choice_hash: previousChoiceHash, current_choice_hash: currentChoiceHash, response_payload_hash: responsePayloadHash };
      const committedTransition = commitStoryTransition(commitSession.story_log || [], completedEntry, storyRequestId || null);
      const updatedLog = committedTransition.story_log;
      result = { ...result, choices: completedEntry.choices, story_sequence: incomingStorySequence || null, ...storyPayloadFromCommit(committedTransition) };

      const updateData = { story_log: updatedLog };
      if (incomingStorySequence > 0) updateData.world_state = { ...(commitSession.world_state || {}), __story_transition_sequence: incomingStorySequence };

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

      // PERMANENT KEY EVENTS — when the AI flags a critical, irreversible moment,
      // append it to the permanent log. This is never pruned, so the story engine
      // references it on every future turn. Deduped on summary to avoid repeats.
      if (typeof result.key_event === 'string' && result.key_event.trim()) {
        const existingEvents = Array.isArray(session.key_events) ? session.key_events : [];
        const summary = result.key_event.trim();
        const alreadyLogged = existingEvents.some(ev =>
          (ev.summary || '').toLowerCase() === summary.toLowerCase()
        );
        if (!alreadyLogged) {
          updateData.key_events = [
            ...existingEvents,
            { summary, timestamp: new Date().toISOString(), turn: updatedLog.length }
          ];
        }
      }

      if (result.location_update) updateData.current_location = result.location_update;
      if (action === 'start' && result.opening_signature) updateData.opening_signature = result.opening_signature;
      if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
      if (result.plot_flag) updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
      // Combat linkage is intentionally omitted here. Story writes must never
      // revive a stale in_combat flag or create an empty combat state.

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

      await base44.asServiceRole.entities.GameSession.update(session_id, updateData);

      // Target-aware character conditions. Enemy/NPC effects never belong on the
      // Character record, and placeholders such as "None" are always discarded.
      if (character) {
        // Re-read the authoritative exhaustion level + conditions right before
        // reconciling, so a long rest that reduced exhaustion to 0 (and cleared
        // the Exhausted badge) during the LLM call is honored. Never keep or
        // re-add a stale Exhausted/Exhaustion badge when the level is 0.
        const freshChar = await base44.asServiceRole.entities.Character.get(character.id);
        const authoritativeExhaustion = Number((freshChar || character).exhaustion_level || 0);
        const originalConditions = Array.isArray((freshChar || character).conditions) ? (freshChar || character).conditions : [];
        const incoming = result.condition_update && typeof result.condition_update === 'object'
          ? result.condition_update
          : { target: 'none', add: '', remove: [], duration: 'scene' };
        const removals = new Set((Array.isArray(incoming.remove) ? incoming.remove : [])
          .map(conditionKey).filter(Boolean));
        const changingLocation = !!(result.location_update && result.location_update !== session.current_location);
        const leavingCombat = action === 'choice' && !result.combat_trigger && !session.in_combat;
        let nextConditions = originalConditions.filter(cond => {
          const key = conditionKey(cond);
          if (!validConditionName(cond) || removals.has(key)) return false;
          // Exhausted is authoritative only when the mechanical exhaustion level is positive.
          // Purge stale story badges left by earlier narrative turns.
          if ((key === 'exhausted' || key === 'exhaustion') && authoritativeExhaustion <= 0) return false;
          const duration = typeof cond === 'object' ? cond.duration : null;
          if (duration === 'scene' && changingLocation) return false;
          if (duration === 'combat' && leavingCombat) return false;
          // Migrate old story-created temporary records that had no duration metadata.
          if (!duration && typeof cond === 'object' && cond.source === 'story' && !session.in_combat && TEMPORARY_STORY_CONDITIONS.has(key)) return false;
          return true;
        });
        if (incoming.target === 'player' && validConditionName(incoming.add)) {
          const name = conditionName(incoming.add);
          const key = name.toLowerCase();
          // Exhaustion is a mechanical level, not a free-form story badge. Never
          // let narrative output add Exhausted while the authoritative level is 0.
          const mechanicalExhaustion = authoritativeExhaustion;
          const isInvalidExhaustionAdd = (key === 'exhausted' || key === 'exhaustion') && mechanicalExhaustion <= 0;
          if (key === 'stealthed') {
            let foundStealthed = false;
            nextConditions = nextConditions.filter((cond) => {
              if (conditionKey(cond) !== 'stealthed') return true;
              if (foundStealthed) return false;
              foundStealthed = true;
              return true;
            });
          }
          if (!isInvalidExhaustionAdd && !isPwt(name) && !nextConditions.some(cond => conditionKey(cond) === key)) {
            const pwtAttributed = key === 'stealthed' && authoritativeChoiceContext?.check?.modifier_breakdown?.pwt_active === true;
            nextConditions.push({
              name, source: pwtAttributed ? 'Pass without Trace' : 'story', duration: incoming.duration || 'scene',
              applied_at: new Date().toISOString(),
              ...(pwtAttributed ? { caster_id: session.world_state?.active_concentration?.caster_id, target_id: character.id } : {})
            });
          }
        }
        if (JSON.stringify(nextConditions) !== JSON.stringify(originalConditions)) {
          await base44.asServiceRole.entities.Character.update(character.id, { conditions: nextConditions });
        }
      }

      // HP change
      if (result.hp_change && character) {
        const newHp = Math.max(0, Math.min(character.hp_max || 0, (character.hp_current || 0) + result.hp_change));
        if (newHp !== character.hp_current) {
          await base44.asServiceRole.entities.Character.update(character.id, { hp_current: newHp });
        }
      }

      // XP earned — persist to the character record so progress and level-ups are real
      if (result.xp_earned && character) {
        await base44.asServiceRole.entities.Character.update(character.id, {
          xp: (character.xp || 0) + result.xp_earned
        });
      }

      // TODO: Add your full loot + alignment code here if needed
    }

    return Response.json({ ...result, transition_version: result?.transition_version || STORY_TRANSITION_VERSION });

  } catch (error) {
    console.error('Story generation error:', error);
    return Response.json({ error: error.message || 'Story generation failed' }, { status: 500 });
  }
});