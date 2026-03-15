import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { User, Loader2, ChevronLeft, Dices, Swords, Map, ShoppingBag, Eye, Paintbrush, Scroll, BookMarked } from 'lucide-react';
import { SKILL_STAT_MAP, calcStatMod, PROFICIENCY_BY_LEVEL } from '@/components/game/gameData';
import { motion, AnimatePresence } from 'framer-motion';
import HUD from '@/components/game/HUD';
import StoryPanel from '@/components/game/StoryPanel';
import CombatPanel from '@/components/game/CombatPanel';
import CharacterSheet from '@/components/game/CharacterSheet';
import DiceRoller from '@/components/game/DiceRoller';
import SceneVisualizerModal from '@/components/game/SceneVisualizerModal';
import CharacterPortraitGenerator from '@/components/game/CharacterPortraitGenerator';
import ActionProposalModal from '@/components/game/ActionProposalModal';
import DeathModal from '@/components/game/DeathModal';
import DeathSavesModal from '@/components/game/DeathSavesModal';
import LootModal from '@/components/game/LootModal.jsx';
import CompanionPanel from '@/components/game/CompanionPanel';
import RestModal from '@/components/game/RestModal';

export default function Game() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [combat, setCombat] = useState(null);
  const [narrative, setNarrative] = useState([]);
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storyLoading, setStoryLoading] = useState(false);
  const [combatLoading, setCombatLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCharSheet, setShowCharSheet] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);

  const [started, setStarted] = useState(false);
  const [showSceneVisualizer, setShowSceneVisualizer] = useState(false);
  const [showPortraitGen, setShowPortraitGen] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [evaluatingAction, setEvaluatingAction] = useState(false);
  const [lastCombatEvent, setLastCombatEvent] = useState(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [defeatedEnemies, setDefeatedEnemies] = useState([]);
  const [companions, setCompanions] = useState([]);
  const [showCompanions, setShowCompanions] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showDeathSaves, setShowDeathSaves] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);

  const loadState = useCallback(async () => {
    if (!sessionId) { navigate(createPageUrl('Home')); return; }
    const sessions = await base44.entities.GameSession.filter({ id: sessionId });
    const sess = sessions[0];
    if (!sess) { navigate(createPageUrl('Home')); return; }
    setSession(sess);

    const chars = await base44.entities.Character.filter({ id: sess.character_id });
    const loadedChar = chars[0] || null;
    setCharacter(loadedChar);

    if (chars[0]) {
      const comps = await base44.entities.Companion.filter({ character_id: chars[0].id });
      setCompanions(comps);
    }

    if (sess.story_log?.length > 0) {
      setNarrative(prev => {
        if (prev.length > 0) return prev; // already have narrative, don't overwrite
        const restored = sess.story_log.slice(-10).map(e => ({ type: 'narration', text: e.text }));
        return restored;
      });
      setStarted(true);
      const lastEntry = sess.story_log[sess.story_log.length - 1];
      if (lastEntry?.choices?.length > 0) setChoices(lastEntry.choices);
    }

    if (sess.in_combat && sess.combat_state?.combat_id) {
      const logs = await base44.entities.CombatLog.filter({ id: sess.combat_state.combat_id });
      if (logs[0]?.is_active) setCombat(logs[0]);
    }
    
    // If character is at 0 HP on load, show death saves modal immediately
    // (covers both fresh 0HP and mid-save-sequence resumes)
    if (loadedChar?.hp_current === 0) {
      setShowDeathSaves(true);
    }
    
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadState(); }, [sessionId]);

  const startAdventure = async () => {
    setStoryLoading(true);
    setStarted(true);
    try {
      const result = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'start' });
      const data = result.data;
      setNarrative([{ type: 'narration', text: data.narrative }]);
      setChoices(data.choices || []);
      await loadState();
    } catch (err) {
      console.error('Failed to start adventure:', err);
      setNarrative([{ type: 'narration', text: 'The tale hesitates... Please try beginning your adventure again.' }]);
    } finally {
      setStoryLoading(false);
    }
  };

  // Compute skill check modifier from character stats + proficiency
  const computeSkillModifier = (skillName) => {
    if (!character) return 0;
    const stat = SKILL_STAT_MAP[skillName];
    const base = stat ? calcStatMod(character[stat]) : 0;
    const prof = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
    // character.skills stores exact skill name as key, value is 'proficient', 'expert', or true (legacy)
    const skillVal = (character.skills || {})[skillName];
    const isProficient = skillVal === 'proficient' || skillVal === true;
    const isExpert = skillVal === 'expert';
    return base + (isExpert ? prof * 2 : isProficient ? prof : 0);
  };

  // Generate brief feedback text for a skill check result
  const getSkillFeedback = (skill, success, roll, dc, nat) => {
    if (nat === 20) {
      const nat20 = {
        Persuasion: "Your words flow with an almost magical charm — they're completely won over.",
        Deception: "Your lie is so convincing, even you almost believe it.",
        Intimidation: "Pure primal terror washes over them. They will not forget this.",
        Perception: "Every detail snaps into razor focus. You miss nothing.",
        Investigation: "The truth reveals itself as if lit by spotlight.",
        Athletics: "Your body moves with godlike grace. No obstacle stands a chance.",
        Stealth: "You become shadow itself.",
        Insight: "Their soul is an open book to you.",
        Acrobatics: "You move like water — effortless perfection.",
      };
      return nat20[skill] || "A perfect roll — fate itself bends in your favor.";
    }
    if (nat === 1) {
      const nat1 = {
        Persuasion: "You somehow manage to offend them worse than if you'd said nothing.",
        Deception: "Your tells are catastrophically obvious. They see right through you.",
        Intimidation: "You trip over your threat. They're not even slightly impressed.",
        Perception: "You stare directly at the clue and see nothing. Embarrassing.",
        Investigation: "You conclude confidently... and completely wrong.",
        Athletics: "You pull something. Or trip. Possibly both.",
        Stealth: "A cat, a child, and a sleeping guard all hear you.",
        Insight: "You've never been more wrong about anyone in your life.",
        Acrobatics: "Gravity wins. Comprehensively.",
      };
      return nat1[skill] || "Catastrophic failure. The dice gods are displeased.";
    }
    const margin = Math.abs(roll - dc);
    if (success) {
      if (margin >= 10) return `An exceptional ${skill} check — you exceeded expectations by a wide margin.`;
      if (margin >= 5) return `A solid ${skill} check. Handled with confidence.`;
      return `A narrow success. Your ${skill} just barely carries the day.`;
    } else {
      if (margin >= 10) return `A poor ${skill} roll. You were never close to meeting the challenge.`;
      if (margin >= 5) return `Not quite enough. Your ${skill} falls measurably short.`;
      return `Agonizingly close — your ${skill} fails by the slimmest of margins.`;
    }
  };

  const handleChoice = async (choiceIndex) => {
    const choice = choices[choiceIndex];
    setNarrative(prev => [...prev, { type: 'player_action', text: choice.text }]);
    setChoices([]);

    let skillSuccess = undefined;

    if (choice.skill_check && choice.dc) {
      setStoryLoading(true);
      const raw = Math.floor(Math.random() * 20) + 1;
      const modifier = computeSkillModifier(choice.skill_check);
      const final = raw + modifier;
      const success = final >= choice.dc;
      skillSuccess = success;
      const feedback = getSkillFeedback(choice.skill_check, success, final, choice.dc, raw);
      setNarrative(prev => [...prev, {
        type: 'skill_check',
        skill: choice.skill_check,
        dc: choice.dc,
        raw,
        modifier,
        final,
        success,
        feedback,
        character_name: character?.name,
      }]);
    }

    setStoryLoading(true);
    try {
      const result = await base44.functions.invoke('generateStory', {
        session_id: sessionId,
        action: 'choice',
        choice_index: choiceIndex,
        custom_input: choice.skill_check
          ? `${choice.text} [Skill Check: ${choice.skill_check} DC${choice.dc} — ${skillSuccess ? 'SUCCESS' : 'FAILURE'}]`
          : choice.text,
      });
      const data = result.data;

      if (data.narrative) setNarrative(prev => [...prev, { type: 'narration', text: data.narrative }]);
      if (data.xp_earned) setNarrative(prev => [...prev, { type: 'xp_gain', text: `+${data.xp_earned} XP earned!` }]);

      if (data.combat_trigger && data.enemies?.length > 0) {
        setNarrative(prev => [...prev, { type: 'combat_start', text: 'Combat begins!' }]);
        await startCombat(data.enemies);
      } else {
        setChoices(data.choices || []);
      }

      await loadState();
    } catch (err) {
      console.error('Failed to process choice:', err);
      setNarrative(prev => [...prev, { type: 'narration', text: 'The Dungeon Master pauses... Something went awry. Please try again.' }]);
    } finally {
      setStoryLoading(false);
    }
  };

  // Intercept custom input — send to DM for adjudication first
  const handleCustomInput = async () => {
    if (!customInput.trim()) return;
    const text = customInput;
    setCustomInput('');
    setEvaluatingAction(true);

    try {
      const result = await base44.functions.invoke('evaluatePlayerAction', {
        action: text,
        character,
        session_context: `${session?.current_location || ''} — ${narrative.filter(e => e.type === 'narration').slice(-1)[0]?.text?.slice(0, 200) || ''}`
      });
      setPendingProposal({ ...result.data, action: text });
    } catch (err) {
      console.error('Failed to evaluate action:', err);
      setCustomInput(text); // restore the player's input so they don't lose it
    } finally {
      setEvaluatingAction(false);
    }
  };

  const executeProposedAction = async (proposal) => {
    setPendingProposal(null);
    const { action, requires_check, skill, dc } = proposal;

    setNarrative(prev => [...prev, { type: 'player_action', text: action }]);
    setChoices([]);

    let checkResult = '';
    if (requires_check && skill && dc) {
      const raw = Math.floor(Math.random() * 20) + 1;
      const modifier = computeSkillModifier(skill);
      const final = raw + modifier;
      const success = final >= dc;
      const feedback = getSkillFeedback(skill, success, final, dc, raw);
      setNarrative(prev => [...prev, { type: 'skill_check', skill, dc, raw, modifier, final, success, feedback, character_name: character?.name }]);
      checkResult = ` [Skill Check: ${skill} DC${dc} — ${success ? 'SUCCESS' : 'FAILURE'} (rolled ${final})]`;
    }

    setStoryLoading(true);
    try {
      const result = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'choice', custom_input: action + checkResult });
      const data = result.data;
      if (data.narrative) setNarrative(prev => [...prev, { type: 'narration', text: data.narrative }]);
      if (data.xp_earned) setNarrative(prev => [...prev, { type: 'xp_gain', text: `+${data.xp_earned} XP!` }]);
      if (data.combat_trigger && data.enemies?.length > 0) {
        setNarrative(prev => [...prev, { type: 'combat_start', text: 'Combat begins!' }]);
        await startCombat(data.enemies);
      } else {
        setChoices(data.choices || []);
      }
      await loadState();
    } catch (err) {
      console.error('Failed to execute action:', err);
      setNarrative(prev => [...prev, { type: 'narration', text: 'The Dungeon Master pauses... Something went awry. Please try again.' }]);
    } finally {
      setStoryLoading(false);
    }
  };

  const startCombat = async (enemies) => {
    const result = await base44.functions.invoke('combatEngine', {
      action: 'start_combat',
      session_id: sessionId,
      character_id: character?.id,
      payload: { enemies }
    });

    // Load the full CombatLog from DB to ensure combat state matches DB exactly
    const logs = await base44.entities.CombatLog.filter({ id: result.data.combat_id });
    if (logs[0]) setCombat(logs[0]);

    await loadState();
  };

  const reloadCombat = async (combatId) => {
    const logs = await base44.entities.CombatLog.filter({ id: combatId });
    if (logs[0]) setCombat(logs[0]);
  };

  const handlePlayerAttack = async (targetId, actionType, weaponOrSpell, modifiers = {}) => {
    if (!combat?.id && !session?.combat_state?.combat_id) return;
    const combatId = combat?.id || session?.combat_state?.combat_id;
    setCombatLoading(true);

    const isSpell = actionType === 'spell';
    const weapon = isSpell ? null : (weaponOrSpell || character?.equipped?.weapon || { damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0, type: 'melee' });
    const spell = isSpell ? weaponOrSpell : null;

    const result = await base44.functions.invoke('combatEngine', {
      action: 'player_attack', session_id: sessionId, combat_id: combatId,
      character_id: character?.id, payload: { target_id: targetId, weapon, spell, modifiers }
    });

    const data = result.data;

    // Emit floating combat text event
    if (data.log_entry) {
      setLastCombatEvent({
        key: Date.now(),
        hit: data.hit,
        critical: data.log_entry.critical,
        damage: data.damage || 0,
      });
    }

    setNarrative(prev => [...prev, {
      type: 'roll_result', text: data.log_entry?.text || 'Attack resolved.', success: data.hit
    }]);

    // CRITICAL: Reload combat state immediately to update action tracking
    await reloadCombat(combatId);

    if (data.actions_remaining > 0 && !data.combat_ended) {
      setNarrative(prev => [...prev, {
        type: 'roll_result',
        text: `${data.actions_remaining} action${data.actions_remaining > 1 ? 's' : ''} remaining this turn.`,
        success: true
      }]);
      setCombatLoading(false);
      return; // Stop here - player still has actions
    }

    // No actions remaining - process enemy turns
    if (!data.combat_ended) {
      await processEnemyTurns(combatId);
    }

    if (data.combat_ended) {
      if (data.result === 'victory') {
        // Grab combatants from the freshly reloaded log (not stale combat state)
        const freshLogs = await base44.entities.CombatLog.filter({ id: combatId });
        const freshCombat = freshLogs[0];
        const victoriousEnemies = (freshCombat?.combatants || combat?.combatants || []).filter(c => c.type === 'enemy');
        setDefeatedEnemies(victoriousEnemies);
        setShowLootModal(true);
        setNarrative(prev => [...prev, { type: 'narration', text: '⚔️ Victory! The battle is won. Your enemies lie defeated.' }]);
        await saveCombatHistory(combatId, 'victory', victoriousEnemies, freshCombat?.round);
        const storyResult = await base44.functions.invoke('generateStory', {
          session_id: sessionId, action: 'choice', custom_input: 'The combat has ended in victory.'
        });
        if (storyResult.data?.narrative) setNarrative(prev => [...prev, { type: 'narration', text: storyResult.data.narrative }]);
        setChoices(storyResult.data?.choices || []);
      } else if (data.result === 'defeat') {
        const freshLogs = await base44.entities.CombatLog.filter({ id: combatId });
        const freshCombat = freshLogs[0];
        const defeatedEnemyList = (freshCombat?.combatants || combat?.combatants || []).filter(c => c.type === 'enemy');
        await saveCombatHistory(combatId, 'defeat', defeatedEnemyList, freshCombat?.round);
        // Per 5e: player reaches 0 HP → death saving throws, not instant death
        setShowDeathSaves(true);
      }
      setCombat(null);
    }
    await loadState();
    setCombatLoading(false);
  };

  const processEnemyTurns = async (combatId) => {
    // Record the starting round — enemies should only act once per round.
    // When the round advances (turn wraps around), stop and let the player go next.
    const initialLogs = await base44.entities.CombatLog.filter({ id: combatId });
    const startRound = initialLogs[0]?.round || 1;

    let attempts = 0;
    while (attempts < 10) {
      attempts++;
      const logs = await base44.entities.CombatLog.filter({ id: combatId });
      const log = logs[0];
      if (!log || !log.is_active) break;
      // Stop when a new round has begun — prevents enemies from acting twice
      if (log.round > startRound) break;
      const current = log.combatants[log.current_turn_index];
      if (current?.type === 'player') break;
      
      // Stop if player is dead
      const playerCombatant = log.combatants.find(c => c.type === 'player');
      if (!playerCombatant?.is_conscious) break;

      if (current?.type === 'enemy' && current?.is_conscious) {
        // Add delay between enemy actions to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const result = await base44.functions.invoke('combatEngine', {
          action: 'enemy_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
        });
        const data = result.data;
        if (data.log_entry) {
            // Enemy hitting the player is bad for the player — show red (success: false)
            setNarrative(prev => [...prev, { type: 'roll_result', text: data.log_entry.text, success: data.log_entry.hit === false }]);
            // Floating text for enemy attacks on player
            setLastCombatEvent({
              key: Date.now(),
              hit: data.log_entry.hit,
              critical: data.log_entry.critical,
              damage: data.log_entry.damage || 0,
            });
          }
        if (data.player_at_zero_hp) {
          // Per 5e: dropping to 0 HP triggers death saving throws, not instant death
          setShowDeathSaves(true);
          setCombat(null);
          // Clear the in_combat flag on the session so resume doesn't loop back into combat
          await base44.entities.GameSession.update(sessionId, { in_combat: false });
          break;
        }
        await reloadCombat(combatId);
        await loadState();
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        await base44.functions.invoke('combatEngine', {
          action: 'next_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
        });
        await reloadCombat(combatId);
      }
    }
  };

  // Saves a completed encounter snapshot to the CombatLog for history tracking
  // Takes an optional freshRound param to avoid reading from stale combat state closure
  const saveCombatHistory = async (combatId, result, enemies, freshRound) => {
    if (!combatId) return;
    const enemySnapshot = enemies.map(e => ({
      name: e.name,
      max_hp: e.max_hp || e.hp,
      cr: e.cr || null,
    }));
    // Fetch current round from DB if not provided, to avoid stale closure on combat?.round
    let totalRounds = freshRound;
    if (totalRounds == null) {
      const logs = await base44.entities.CombatLog.filter({ id: combatId });
      totalRounds = logs[0]?.round || 0;
    }
    await base44.entities.CombatLog.update(combatId, {
      result,
      is_active: false,
      enemies_faced: enemySnapshot,
      session_title: session?.title || 'Unknown Campaign',
      character_name: character?.name || '',
      location: session?.current_location || '',
      total_rounds: totalRounds,
      encounter_date: new Date().toISOString(),
    });
  };

  const handleNextTurn = async () => {
    const combatId = combat?.id || session?.combat_state?.combat_id;
    if (!combatId) return;
    
    // Check if player is dead
    if (character?.hp_current <= 0) {
      setShowDeathSaves(true);
      return;
    }
    
    setCombatLoading(true);
    await processEnemyTurns(combatId);
    await reloadCombat(combatId);
    await loadState();
    setCombatLoading(false);
  };

  const handleEndTurn = async () => {
    const combatId = combat?.id || session?.combat_state?.combat_id;
    if (!combatId) return;
    
    // Check if player is dead
    if (character?.hp_current <= 0) {
      setShowDeathSaves(true);
      return;
    }
    
    setCombatLoading(true);
    
    // Advance to next turn and reset action tracking
    await base44.functions.invoke('combatEngine', {
      action: 'next_turn',
      session_id: sessionId,
      combat_id: combatId,
      character_id: character?.id,
      payload: {}
    });
    
    await reloadCombat(combatId);
    await processEnemyTurns(combatId);
    await loadState();
    setCombatLoading(false);
  };

  const handleMiracle = async () => {
    // Miracle succeeded - restore character to full HP
    await base44.entities.Character.update(character.id, {
      hp_current: character.hp_max,
      conditions: []
    });
    setShowDeathModal(false);
    setNarrative(prev => [...prev, {
      type: 'narration',
      text: '✨ The gods heard your plea! You awaken gasping — it was all a terrible dream. You are restored to full health.'
    }]);
    await loadState();
  };

  const handleDeath = async () => {
    // Reset character HP to full for next adventure
    await base44.entities.Character.update(character.id, {
      hp_current: character.hp_max,
      conditions: [],
      death_saves_success: 0,
      death_saves_failure: 0
    });
    
    setShowDeathModal(false);
    navigate(createPageUrl('Home'));
  };

  const handleFlee = async () => {
    setNarrative(prev => [...prev, { type: 'player_action', text: 'You attempt to flee the battle!' }]);
    const rollResult = await base44.functions.invoke('rollDice', {
      session_id: sessionId, character_id: character?.id,
      roll_type: 'acrobatics', dice: '1d20', dc: 12, context: 'Fleeing combat'
    });
    const roll = rollResult.data;
    if (roll.success) {
      setNarrative(prev => [...prev, { type: 'roll_result', text: `Acrobatics: ${roll.final_result} vs DC 12 — You escape!`, success: true }]);
      const combatId = combat?.id || session?.combat_state?.combat_id;
      if (combatId) await base44.entities.CombatLog.update(combatId, { is_active: false, result: 'fled' });
      await base44.entities.GameSession.update(sessionId, { in_combat: false });
      setCombat(null);
      const storyResult = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'choice', custom_input: 'You fled from combat successfully.' });
      if (storyResult.data?.narrative) setNarrative(prev => [...prev, { type: 'narration', text: storyResult.data.narrative }]);
      setChoices(storyResult.data?.choices || []);
    } else {
      setNarrative(prev => [...prev, { type: 'roll_result', text: `Acrobatics: ${roll.final_result} vs DC 12 — You fail to escape!`, success: false }]);
    }
    await loadState();
  };

  const handleCompanionUpdate = async (action, companionData) => {
    if (action === 'create') {
      const newComp = await base44.entities.Companion.create({ ...companionData, character_id: character.id });
      setCompanions(prev => [...prev, newComp]);
    } else if (action === 'update') {
      await base44.entities.Companion.update(companionData.id, companionData);
      setCompanions(prev => prev.map(c => c.id === companionData.id ? companionData : c));
    }
  };

  const handleCompanionAttack = async (companion, attack) => {
    if (!combat?.id && !session?.combat_state?.combat_id) return;
    const combatId = combat?.id || session?.combat_state?.combat_id;
    
    // D&D 5E Rule: Standard familiars can't attack (only Help/Dash/Disengage/Dodge/Hide)
    if (companion.type === 'familiar' && !companion.can_attack) {
      setNarrative(prev => [...prev, {
        type: 'roll_result',
        text: `${companion.name} can't attack — familiars can only Help, Dash, Disengage, Dodge, or Hide. (Pact of Chain familiars are the exception)`,
        success: false
      }]);
      return;
    }
    
    // Beast companion uses bonus action (Ranger: Beast Master)
    // Pact familiars act independently on their own initiative
    
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const isCrit = attackRoll === 20;
    const isMiss = attackRoll === 1;
    
    // Beast Master companions add ranger's proficiency bonus to attacks
    let finalBonus = attack.bonus || 0;
    if (companion.type === 'beast_companion' && character?.class === 'Ranger') {
      const profBonus = character.proficiency_bonus || 2;
      finalBonus += profBonus;
    }
    
    const hitRoll = attackRoll + finalBonus;
    
    // Find target (first conscious enemy)
    const target = combat?.combatants?.find(c => c.type === 'enemy' && c.is_conscious);
    if (!target) return;
    
    const hit = !isMiss && (isCrit || hitRoll >= target.ac);
    let damageTotal = 0;
    
    if (hit) {
      // Parse damage dice (e.g. "2d4+2")
      const diceMatch = attack.damage_dice.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (diceMatch) {
        const numDice = isCrit ? parseInt(diceMatch[1]) * 2 : parseInt(diceMatch[1]);
        const sides = parseInt(diceMatch[2]);
        const flatBonus = parseInt(diceMatch[3] || 0);
        
        for (let i = 0; i < numDice; i++) {
          damageTotal += Math.floor(Math.random() * sides) + 1;
        }
        damageTotal += flatBonus;
        
        // Beast companions add proficiency to damage at level 3+
        if (companion.type === 'beast_companion' && character?.class === 'Ranger' && (character?.level || 1) >= 3) {
          damageTotal += character.proficiency_bonus || 2;
        }
      }
    }
    
    setNarrative(prev => [...prev, {
      type: 'roll_result',
      text: `${companion.name} ${isCrit ? 'CRITS' : 'attacks'} ${target.name} with ${attack.name}! ${hit ? `Hit! ${damageTotal} ${attack.damage_type} damage. ${attack.special || ''}` : 'Miss!'} (${attackRoll}+${finalBonus}=${hitRoll} vs AC ${target.ac})`,
      success: hit
    }]);
    
    if (hit && damageTotal > 0) {
      target.hp = Math.max(0, target.hp - damageTotal);
      if (target.hp === 0) target.is_conscious = false;
      await base44.entities.CombatLog.update(combatId, { combatants: combat.combatants });
      await reloadCombat(combatId);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a07' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ border: '2px solid rgba(201,169,110,0.3)', boxShadow: '0 0 30px rgba(201,169,110,0.1)' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a96e' }} />
        </div>
        <p className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>Preparing your world...</p>
      </div>
    </div>
  );

  const inCombat = session?.in_combat && combat;

  return (
    <div className="h-screen flex flex-col parchment-bg overflow-hidden" style={{ color: '#e8d5b7' }}>
      {/* HUD */}
      <HUD character={character} session={session} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(8,5,2,0.9)',
          borderBottom: '1px solid rgba(180,140,90,0.15)',
          backdropFilter: 'blur(8px)',
        }}>
        <button onClick={() => navigate(createPageUrl('Home'))}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: 'rgba(201,169,110,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm flex-1 italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'IM Fell English, serif' }}>
          {session?.title || 'Adventure'}
        </span>

        {inCombat && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-fantasy text-xs badge-blood combat-active">
            <Swords className="w-3 h-3" /> In Combat
          </div>
        )}

        <button onClick={() => setShowDiceRoller(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={showDiceRoller ? {
            background: 'rgba(80,50,10,0.7)',
            border: '1px solid rgba(201,169,110,0.5)',
            color: '#f0c040',
          } : {
            background: 'rgba(20,13,5,0.7)',
            border: '1px solid rgba(180,140,90,0.2)',
            color: 'rgba(201,169,110,0.6)',
          }}>
          <Dices className="w-3.5 h-3.5" /> Dice
        </button>

        {!inCombat && (
          <button onClick={() => setShowRestModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
            style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(100,70,180,0.2)', color: 'rgba(168,139,253,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,100,220,0.45)'; e.currentTarget.style.color = '#c4b5fd'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(100,70,180,0.2)'; e.currentTarget.style.color = 'rgba(168,139,253,0.6)'; }}>
            🌙 Rest
          </button>
        )}

        <button onClick={() => setShowCompanions(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={showCompanions ? {
            background: 'rgba(80,50,10,0.7)',
            border: '1px solid rgba(201,169,110,0.5)',
            color: '#f0c040',
          } : {
            background: 'rgba(20,13,5,0.7)',
            border: '1px solid rgba(180,140,90,0.2)',
            color: 'rgba(201,169,110,0.6)',
          }}>
          🐾 Pets
        </button>


        <button onClick={() => navigate(createPageUrl('CombatHistory'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,60,40,0.2)', color: 'rgba(252,165,165,0.55)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,80,60,0.45)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,60,40,0.2)'; e.currentTarget.style.color = 'rgba(252,165,165,0.55)'; }}>
          <BookMarked className="w-3.5 h-3.5" /> History
        </button>

        <button onClick={() => navigate(createPageUrl('Market') + `?session_id=${sessionId}&character_id=${character?.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(200,150,20,0.2)', color: 'rgba(240,192,64,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)'; e.currentTarget.style.color = '#f0c040'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(200,150,20,0.2)'; e.currentTarget.style.color = 'rgba(240,192,64,0.6)'; }}>
          <ShoppingBag className="w-3.5 h-3.5" /> Market
        </button>

        <button onClick={() => navigate(createPageUrl('WorldMap') + `?session_id=${sessionId}&character_id=${character?.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(140,60,220,0.2)', color: 'rgba(192,132,252,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,60,220,0.45)'; e.currentTarget.style.color = '#c084fc'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,60,220,0.2)'; e.currentTarget.style.color = 'rgba(192,132,252,0.6)'; }}>
          <Map className="w-3.5 h-3.5" /> Travel
        </button>

        {started && !inCombat && (
          <button onClick={() => setShowSceneVisualizer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
            style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(120,60,180,0.25)', color: 'rgba(192,132,252,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,100,240,0.5)'; e.currentTarget.style.color = '#d8b4fe'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(120,60,180,0.25)'; e.currentTarget.style.color = 'rgba(192,132,252,0.6)'; }}>
            <Eye className="w-3.5 h-3.5" /> Visualize
          </button>
        )}

        <button onClick={() => setShowPortraitGen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'; e.currentTarget.style.color = '#c9a96e'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.2)'; e.currentTarget.style.color = 'rgba(201,169,110,0.6)'; }}>
          <Paintbrush className="w-3.5 h-3.5" /> Portrait
        </button>

        <button onClick={() => navigate(createPageUrl('CharacterSheetPage') + `?character_id=${character?.id}&session_id=${sessionId}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(140,100,220,0.2)', color: 'rgba(180,140,255,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,120,255,0.5)'; e.currentTarget.style.color = '#c4b5fd'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,100,220,0.2)'; e.currentTarget.style.color = 'rgba(180,140,255,0.6)'; }}>
          <Scroll className="w-3.5 h-3.5" /> Full Sheet
        </button>

        <button onClick={() => setShowCharSheet(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'; e.currentTarget.style.color = '#c9a96e'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,90,0.2)'; e.currentTarget.style.color = 'rgba(201,169,110,0.6)'; }}>
          <User className="w-3.5 h-3.5" /> Sheet
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {inCombat ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden min-h-0">
            <div className="overflow-hidden flex flex-col min-h-0" style={{ borderRight: '1px solid rgba(180,30,30,0.2)' }}>
              <StoryPanel narrative={narrative} choices={[]} loading={storyLoading}
                onChoice={() => {}} customInput={customInput}
                setCustomInput={setCustomInput} onCustomSubmit={() => {}} />
            </div>
            <div className="overflow-hidden">
              <CombatPanel combat={combat} character={character}
                onPlayerAttack={handlePlayerAttack}
                onNextTurn={handleNextTurn}
                onEndTurn={handleEndTurn}
                onFlee={handleFlee}
                loading={combatLoading}
                lastCombatEvent={lastCombatEvent}
                onCharacterUpdate={setCharacter} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden min-h-0">
            {!started ? (
              <div className="flex items-center justify-center h-full p-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="text-center max-w-lg">
                  <motion.div
                    animate={{ rotate: [0, 3, -3, 0], filter: ['drop-shadow(0 0 20px rgba(201,169,110,0.4))', 'drop-shadow(0 0 40px rgba(201,169,110,0.8))', 'drop-shadow(0 0 20px rgba(201,169,110,0.4))'] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-7xl mb-6">⚔️</motion.div>
                  <h2 className="text-3xl font-fantasy font-bold mb-5 text-glow-gold" style={{ color: '#f0c040' }}>
                    Your Adventure Awaits
                  </h2>
                  <p className="mb-8 leading-relaxed" style={{ color: 'rgba(232,213,183,0.65)', fontFamily: 'IM Fell English, serif', fontSize: '1.1rem' }}>
                    {session?.story_seed || 'The realm is full of mystery and danger. Your legend begins now.'}
                  </p>
                  <motion.button onClick={startAdventure} disabled={storyLoading}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-10 py-4 rounded-2xl text-base btn-fantasy flex items-center gap-3 mx-auto disabled:opacity-50"
                    style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
                    {storyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>🎲</span>}
                    {storyLoading ? 'Weaving your world...' : 'Begin the Story'}
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              <StoryPanel 
                narrative={narrative} 
                choices={character?.hp_current <= 0 ? [] : choices} 
                loading={storyLoading}
                onChoice={character?.hp_current <= 0 ? () => {} : handleChoice} 
                customInput={customInput}
                setCustomInput={character?.hp_current <= 0 ? () => {} : setCustomInput} 
                onCustomSubmit={character?.hp_current <= 0 ? () => {} : handleCustomInput} />
            )}
          </div>
        )}
      </div>

      {/* Dice Roller Side Panel */}
      <AnimatePresence>
        {showDiceRoller && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-80 z-40 shadow-2xl overflow-y-auto"
            style={{ borderLeft: '1px solid rgba(180,140,90,0.2)', background: 'rgba(8,5,2,0.97)' }}>
            <button onClick={() => setShowDiceRoller(false)}
              className="absolute top-3 left-3 p-1.5 rounded-lg z-10 transition-colors"
              style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(20,13,5,0.7)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <DiceRoller character={character} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Companions Side Panel */}
      <AnimatePresence>
        {showCompanions && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-96 z-40 shadow-2xl overflow-y-auto"
            style={{ borderLeft: '1px solid rgba(180,140,90,0.2)', background: 'rgba(8,5,2,0.97)' }}>
            <button onClick={() => setShowCompanions(false)}
              className="absolute top-3 left-3 p-1.5 rounded-lg z-10 transition-colors"
              style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(20,13,5,0.7)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <CompanionPanel 
              character={character}
              companions={companions}
              onUpdate={handleCompanionUpdate}
              onAttack={handleCompanionAttack} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character Sheet Modal */}
      {showCharSheet && (
        <CharacterSheet character={character} onClose={() => setShowCharSheet(false)}
          onCharacterUpdate={setCharacter} />
      )}

      {/* Scene Visualizer */}
      <AnimatePresence>
        {showSceneVisualizer && (
          <SceneVisualizerModal
            narrative={narrative}
            session={session}
            character={character}
            onClose={() => setShowSceneVisualizer(false)} />
        )}
      </AnimatePresence>

      {/* Character Portrait Generator */}
      <AnimatePresence>
        {showPortraitGen && (
          <CharacterPortraitGenerator
            character={character}
            onClose={() => setShowPortraitGen(false)}
            onSavePortrait={(url) => setCharacter(prev => ({ ...prev, portrait: url }))} />
        )}
      </AnimatePresence>



      {/* Loot Modal — shown after victory */}
      <AnimatePresence>
        {showLootModal && character && (
          <LootModal
            enemies={defeatedEnemies}
            character={character}
            onClose={() => setShowLootModal(false)}
            onCollect={async (updates, lootSnapshot) => {
              // Use functional updater to get current character state, avoiding stale closure
              setCharacter(prev => {
                const coinParts = [];
                if ((updates.gold   || 0) > (prev.gold   || 0)) coinParts.push(`+${(updates.gold   || 0) - (prev.gold   || 0)} gp`);
                if ((updates.silver || 0) > (prev.silver || 0)) coinParts.push(`+${(updates.silver || 0) - (prev.silver || 0)} sp`);
                if ((updates.copper || 0) > (prev.copper || 0)) coinParts.push(`+${(updates.copper || 0) - (prev.copper || 0)} cp`);
                if ((updates.inventory?.length || 0) > (prev.inventory?.length || 0)) {
                  const newCount = (updates.inventory?.length || 0) - (prev.inventory?.length || 0);
                  coinParts.push(`${newCount} item${newCount > 1 ? 's' : ''} added`);
                }
                if (coinParts.length > 0) {
                  setNarrative(n => [...n, { type: 'xp_gain', text: `💰 Looted: ${coinParts.join(' · ')}` }]);
                }
                return { ...prev, ...updates };
              });
              // Persist loot snapshot to combat history record
              if (lootSnapshot && session?.combat_state?.combat_id) {
                await base44.entities.CombatLog.update(session.combat_state.combat_id, {
                  loot_collected: lootSnapshot,
                });
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Action Proposal / DM Adjudication Modal */}
      <AnimatePresence>
        {pendingProposal && (
          <ActionProposalModal
            proposal={pendingProposal}
            onConfirm={() => executeProposedAction(pendingProposal)}
            onCancel={() => setPendingProposal(null)} />
        )}
      </AnimatePresence>

      {/* Evaluating Action Spinner */}
      <AnimatePresence>
        {evaluatingAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full"
            style={{ background: 'rgba(10,6,3,0.92)', border: '1px solid rgba(201,169,110,0.3)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c9a96e' }} />
            <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.7)' }}>DM is considering...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Death Saves Modal — D&D 5e: reaching 0 HP triggers death saving throws */}
      <AnimatePresence>
        {showDeathSaves && character && (
          <DeathSavesModal
            character={character}
            onStabilize={async (roll) => {
              setShowDeathSaves(false);
              // Update local state immediately so HUD reflects the change without waiting for loadState
              setCharacter(prev => prev ? { ...prev, hp_current: 1, death_saves_success: 0, death_saves_failure: 0, conditions: [] } : prev);
              setNarrative(prev => [...prev, {
                type: 'narration',
                text: roll === 20
                  ? `✨ Natural 20! ${character.name} surges back to life with 1 HP — fate is not done with them yet.`
                  : `${character.name} stabilizes and regains 1 HP — the immediate danger has passed.`
              }]);
              await loadState();
            }}
            onDeath={() => {
              // 3 failures: actual death → show final death modal
              setShowDeathSaves(false);
              setShowDeathModal(true);
            }}
            onClose={() => setShowDeathSaves(false)}
          />
        )}
      </AnimatePresence>

      {/* Death Modal — shown only after 3 failed death saves */}
      <AnimatePresence>
        {showDeathModal && character && (
          <DeathModal
            character={character}
            onMiracle={handleMiracle}
            onDeath={handleDeath}
            onClose={() => setShowDeathModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Rest Modal */}
      <AnimatePresence>
        {showRestModal && character && (
          <RestModal
            character={character}
            onClose={() => setShowRestModal(false)}
            onRest={async (restType) => {
              const result = await base44.functions.invoke('handleRest', {
                character_id: character.id,
                rest_type: restType
              });

              // Check for interrupted rest
              if (result.data.interrupted) {
                setNarrative(prev => [...prev, {
                  type: 'narration',
                  text: `⚠️ ${result.data.encounter_message}`
                }]);
                setShowRestModal(false);
                // Trigger random encounter
                const encounterResult = await base44.functions.invoke('generateStory', {
                  session_id: sessionId,
                  action: 'generate_event',
                  custom_input: 'random_encounter'
                });
                if (encounterResult.data?.narrative) {
                  setNarrative(prev => [...prev, { type: 'narration', text: encounterResult.data.narrative }]);
                }
                if (encounterResult.data?.combat_trigger && encounterResult.data?.enemies) {
                  await startCombat(encounterResult.data.enemies);
                } else if (encounterResult.data?.choices) {
                  setChoices(encounterResult.data.choices);
                }
                return;
              }

              setCharacter(result.data.character);
              const restText = result.data.narrative 
                ? `🌙 ${result.data.narrative} ${result.data.restorations.join(', ')}.`
                : `🌙 You take a ${restType} rest. ${result.data.restorations.join(', ')}.`;
              
              setNarrative(prev => [...prev, {
                type: 'narration',
                text: restText
              }]);
              setShowRestModal(false);
              await loadState();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}