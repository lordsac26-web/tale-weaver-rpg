import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

import { useNavigate } from 'react-router-dom';
import { User, Loader2, ChevronLeft, Swords } from 'lucide-react';
import { SKILL_STAT_MAP, calcStatMod, PROFICIENCY_BY_LEVEL } from '@/components/game/gameData';
import { recalculateStats } from '@/components/game/EquipmentManager';
import { getEquipmentAdvantage, rollD20WithAdvantage } from '@/components/game/equipmentAdvantage';
import { motion, AnimatePresence } from 'framer-motion';
import HUD from '@/components/game/HUD';
import StoryPanel from '@/components/game/StoryPanel';
import CombatPanel from '@/components/game/CombatPanel';
import CharacterSheet from '@/components/game/CharacterSheet';
import DiceRoller from '@/components/game/DiceRoller';
import SceneVisualizerModal from '@/components/game/SceneVisualizerModal';
import CharacterPortraitGenerator from '@/components/game/CharacterPortraitGenerator';
import ActionProposalModal from '@/components/game/ActionProposalModal';
import CombatActProposalModal from '@/components/game/CombatActProposalModal';
import DeathModal from '@/components/game/DeathModal';
import DeathSavesModal from '@/components/game/DeathSavesModal';
import LootModal from '@/components/game/LootModal.jsx';
import CompanionPanel from '@/components/game/CompanionPanel';
import RestModal from '@/components/game/RestModal';
import GameToolbar from '@/components/game/GameToolbar';
import CampaignJournal from '@/components/game/CampaignJournal';
import { stopAllNarration } from '@/components/game/narrationControl';

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
  const [combatProposal, setCombatProposal] = useState(null); // DM ruling on a free-text combat action
  const [actEvaluating, setActEvaluating] = useState(false);
  const [lastCombatEvent, setLastCombatEvent] = useState(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [defeatedEnemies, setDefeatedEnemies] = useState([]);
  const [companions, setCompanions] = useState([]);
  const [showCompanions, setShowCompanions] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showDeathSaves, setShowDeathSaves] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);
  const [mainViewTab, setMainViewTab] = useState('story');
  const [combatViewTab, setCombatViewTab] = useState('combat'); // 'story' | 'combat' | 'journal' — for mobile

  const loadState = useCallback(async () => {
    if (!sessionId) { navigate('/Home'); return; }
    const sessions = await base44.entities.GameSession.filter({ id: sessionId });
    const sess = sessions[0];
    if (!sess) { navigate('/Home'); return; }
    setSession(sess);

    let chars = await base44.entities.Character.filter({ id: sess.character_id });
    let loadedChar = chars[0] || null;

    // Self-heal orphaned sessions: if the session points to a character that no
    // longer exists (e.g. it was deleted/recreated), fall back to the user's most
    // recent character and repair the session link so future calls work.
    if (!loadedChar) {
      const myChars = await base44.entities.Character.list('-created_date', 1);
      if (myChars[0]) {
        loadedChar = myChars[0];
        chars = [loadedChar];
        await base44.entities.GameSession.update(sessionId, { character_id: loadedChar.id });
      }
    }

    // Recalculate stats from equipment on every load to fix any stale/double-counted values
    if (loadedChar?.equipped && Object.keys(loadedChar.equipped).length > 0) {
      const recalc = recalculateStats(loadedChar, loadedChar.equipped, loadedChar.inventory || []);
      const needsUpdate = recalc.armor_class !== loadedChar.armor_class;
      if (needsUpdate) {
        loadedChar = { ...loadedChar, ...recalc };
        // Persist the corrected values to DB so they stay fixed
        await base44.entities.Character.update(loadedChar.id, { armor_class: recalc.armor_class });
      }
    }
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

  // Stop narration the moment the player leaves the Game screen — covers the
  // back button, in-app navigation, and closing/refreshing the browser tab.
  // This is a safety net on top of StoryPanel's own cleanup so audio never
  // keeps playing after the campaign window closes.
  useEffect(() => {
    window.addEventListener('beforeunload', stopAllNarration);
    return () => {
      stopAllNarration();
      window.removeEventListener('beforeunload', stopAllNarration);
    };
  }, []);

  // Listen for HUD quick-rest button event (Suggestion #7)
  useEffect(() => {
    const handler = () => setShowRestModal(true);
    window.addEventListener('open-rest-modal', handler);
    return () => window.removeEventListener('open-rest-modal', handler);
  }, []);

  // Reload combat when a server-authoritative ability (e.g. Action Surge) changes combat state
  useEffect(() => {
    const handler = () => {
      const combatId = combat?.id || session?.combat_state?.combat_id;
      if (combatId) reloadCombat(combatId);
    };
    window.addEventListener('reload-combat', handler);
    return () => window.removeEventListener('reload-combat', handler);
  }, [combat?.id, session?.combat_state?.combat_id]);

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
      // Check equipped items for advantage/disadvantage on this skill
      const equipAdv = getEquipmentAdvantage(character?.equipped, choice.skill_check);
      const { roll: raw, allRolls, hadAdvantage, hadDisadvantage } = rollD20WithAdvantage(equipAdv.advantage, equipAdv.disadvantage);
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
        allRolls,
        hadAdvantage,
        hadDisadvantage,
        advantageSources: equipAdv.sources,
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
      if (data.hp_change) {
        setNarrative(prev => [...prev, { type: 'xp_gain', text: data.hp_change > 0 ? `❤️ Healed +${data.hp_change} HP` : `💔 Took ${Math.abs(data.hp_change)} damage` }]);
        if (typeof data.hp_current === 'number') setCharacter(prev => prev ? { ...prev, hp_current: data.hp_current } : prev);
      }

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
      const equipAdv = getEquipmentAdvantage(character?.equipped, skill);
      const { roll: raw, allRolls, hadAdvantage, hadDisadvantage } = rollD20WithAdvantage(equipAdv.advantage, equipAdv.disadvantage);
      const modifier = computeSkillModifier(skill);
      const final = raw + modifier;
      const success = final >= dc;
      const feedback = getSkillFeedback(skill, success, final, dc, raw);
      setNarrative(prev => [...prev, { type: 'skill_check', skill, dc, raw, allRolls, hadAdvantage, hadDisadvantage, advantageSources: equipAdv.sources, modifier, final, success, feedback, character_name: character?.name }]);
      checkResult = ` [Skill Check: ${skill} DC${dc} — ${success ? 'SUCCESS' : 'FAILURE'} (rolled ${final}${hadAdvantage ? ', with advantage' : ''}${hadDisadvantage ? ', with disadvantage' : ''})]`;
    }

    setStoryLoading(true);
    try {
      const result = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'choice', custom_input: action + checkResult });
      const data = result.data;
      if (data.narrative) setNarrative(prev => [...prev, { type: 'narration', text: data.narrative }]);
      if (data.xp_earned) setNarrative(prev => [...prev, { type: 'xp_gain', text: `+${data.xp_earned} XP!` }]);
      if (data.hp_change) {
        setNarrative(prev => [...prev, { type: 'xp_gain', text: data.hp_change > 0 ? `❤️ Healed +${data.hp_change} HP` : `💔 Took ${Math.abs(data.hp_change)} damage` }]);
        if (typeof data.hp_current === 'number') setCharacter(prev => prev ? { ...prev, hp_current: data.hp_current } : prev);
      }
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

  // ===== Free-text "Act" during combat — DM adjudicates first =====
  // Build a compact scene summary the DM can reason over.
  const buildCombatContext = () => {
    const enemies = (combat?.combatants || []).filter(c => c.type === 'enemy');
    const enemyLines = enemies.map(e => {
      const hp = e.hp_current ?? e.hp ?? 0;
      const pct = e.hp_max ? Math.round((hp / e.hp_max) * 100) : 100;
      return `${e.name} (${e.is_conscious ? `${pct}% HP` : 'defeated'})`;
    }).join(', ');
    const player = (combat?.combatants || []).find(c => c.type === 'player');
    const playerHp = player ? `${player.hp_current ?? character?.hp_current}/${player.hp_max ?? character?.hp_max} HP` : '';
    return `Round ${combat?.round || 1}. ${character?.name} (${playerHp}) vs ${enemyLines || 'enemies'}.`;
  };

  const handleCombatAct = async (text) => {
    setActEvaluating(true);
    try {
      const livingEnemies = (combat?.combatants || [])
        .filter(c => c.type === 'enemy' && (c.is_conscious ?? true))
        .map(e => e.name);
      const result = await base44.functions.invoke('evaluatePlayerAction', {
        action: text,
        character,
        in_combat: true,
        combat_context: buildCombatContext(),
        combat_enemies: livingEnemies,
        session_context: narrative.filter(e => e.type === 'narration').slice(-1)[0]?.text?.slice(0, 250) || '',
      });
      setCombatProposal({ ...result.data, action: text });
    } catch (err) {
      console.error('Failed to evaluate combat action:', err);
      setNarrative(prev => [...prev, { type: 'roll_result', text: 'The DM could not consider that action. Try again.', success: false }]);
    } finally {
      setActEvaluating(false);
    }
  };

  // Apply a DM-granted reward (coins / healing / items) to the real Character record
  // so narrated rewards become actual game mechanics, not just flavor text.
  const applyCombatReward = async (reward) => {
    if (!reward) return;
    const gold = reward.gold || 0, silver = reward.silver || 0, copper = reward.copper || 0;
    const heal = reward.hp_heal || 0;
    const newItems = Array.isArray(reward.items) ? reward.items : [];
    if (!gold && !silver && !copper && !heal && newItems.length === 0) return;

    const updates = {};
    if (gold)   updates.gold   = (character?.gold   || 0) + gold;
    if (silver) updates.silver = (character?.silver || 0) + silver;
    if (copper) updates.copper = (character?.copper || 0) + copper;
    if (heal)   updates.hp_current = Math.min(character?.hp_max || 0, (character?.hp_current || 0) + heal);
    if (newItems.length) updates.inventory = [...(character?.inventory || []), ...newItems];

    await base44.entities.Character.update(character.id, updates);
    setCharacter(prev => prev ? { ...prev, ...updates } : prev);

    const parts = [];
    if (gold)   parts.push(`+${gold} gp`);
    if (silver) parts.push(`+${silver} sp`);
    if (copper) parts.push(`+${copper} cp`);
    if (heal)   parts.push(`❤️ +${heal} HP`);
    if (newItems.length) parts.push(`${newItems.length} item${newItems.length > 1 ? 's' : ''}`);
    if (parts.length) setNarrative(prev => [...prev, { type: 'xp_gain', text: `💰 Gained: ${parts.join(' · ')}` }]);
  };

  // Resolve a DM-approved free-text combat action: roll any required check, chain into
  // a real attack roll when it's an attack, apply rewards, and end combat on de-escalation.
  const executeCombatAction = async (proposal) => {
    setCombatProposal(null);
    const { action, requires_check, skill, dc, outcome_type, ends_combat_on_success, target_name, reward } = proposal;
    const combatId = combat?.id || session?.combat_state?.combat_id;

    setNarrative(prev => [...prev, { type: 'player_action', text: action }]);

    // continue_combat with no check — just remind the player to use combat actions
    if (outcome_type === 'continue_combat' && !requires_check) {
      setNarrative(prev => [...prev, { type: 'roll_result', text: '⚔️ Use your Attack or Spell action to carry this out.', success: true }]);
      return;
    }

    let success = true;
    if (requires_check && skill && dc) {
      const equipAdv = getEquipmentAdvantage(character?.equipped, skill);
      const { roll: raw, allRolls, hadAdvantage, hadDisadvantage } = rollD20WithAdvantage(equipAdv.advantage, equipAdv.disadvantage);
      const modifier = computeSkillModifier(skill);
      const final = raw + modifier;
      success = final >= dc;
      const feedback = getSkillFeedback(skill, success, final, dc, raw);
      setNarrative(prev => [...prev, { type: 'skill_check', skill, dc, raw, allRolls, hadAdvantage, hadDisadvantage, advantageSources: equipAdv.sources, modifier, final, success, feedback, character_name: character?.name }]);
    }

    // ATTACK outcome — the action is a strike. If a setup check was required it must
    // succeed first; then fire a REAL attack roll through the combat engine.
    if (outcome_type === 'attack') {
      if (requires_check && !success) {
        setNarrative(prev => [...prev, { type: 'roll_result', text: `Your ${skill} maneuver fails — you can't line up the strike. The action is wasted.`, success: false }]);
        await applyCombatReward(reward);
        return;
      }
      // Find the target the DM named (fallback: first conscious enemy)
      const enemies = (combat?.combatants || []).filter(c => c.type === 'enemy' && (c.is_conscious ?? true));
      const target = enemies.find(e => e.name?.toLowerCase() === (target_name || '').toLowerCase()) || enemies[0];
      if (!target) {
        setNarrative(prev => [...prev, { type: 'roll_result', text: 'There is no valid target to strike.', success: false }]);
        return;
      }
      if (requires_check) {
        setNarrative(prev => [...prev, { type: 'roll_result', text: `✓ ${skill} succeeds — you set up the strike on ${target.name}!`, success: true }]);
      }
      // Reuse the standard attack pipeline so damage, action economy, and enemy turns all apply
      await handlePlayerAttack(target.id, 'attack', character?.equipped?.weapon || null);
      await applyCombatReward(reward);
      return;
    }

    // De-escalation success → end combat and return to story
    if (outcome_type === 'de_escalate' && ends_combat_on_success && success) {
      setCombatLoading(true);
      try {
        if (combatId) await base44.entities.CombatLog.update(combatId, { is_active: false, result: 'resolved' });
        await base44.entities.GameSession.update(sessionId, { in_combat: false });
        setCombat(null);
        const storyResult = await base44.functions.invoke('generateStory', {
          session_id: sessionId, action: 'choice',
          custom_input: `${action} — the player successfully de-escalated the fight with a ${skill} check. Combat ends peacefully; narrate the resolution.`,
        });
        if (storyResult.data?.narrative) setNarrative(prev => [...prev, { type: 'narration', text: storyResult.data.narrative }]);
        setChoices(storyResult.data?.choices || []);
      } catch (err) {
        console.error('De-escalation failed to resolve:', err);
      } finally {
        await loadState();
        setCombatLoading(false);
      }
      return;
    }

    // Otherwise: narrate the outcome inside combat (no turn consumed, combat continues)
    const resultWord = requires_check ? (success ? 'succeeds' : 'fails') : 'acts';
    setNarrative(prev => [...prev, {
      type: 'roll_result',
      text: outcome_type === 'de_escalate'
        ? (success ? 'Your words land, but the enemies remain wary — the tension holds.' : 'Your attempt to talk them down falls flat. The fight goes on.')
        : `Your improvised action ${resultWord}. The battle continues.`,
      success,
    }]);

    // Apply any DM-granted reward (loot grabbed mid-fight, potion quaffed, etc.) — only on success when a check was involved
    if (!requires_check || success) await applyCombatReward(reward);
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

    // Twinned Spell metamagic targets a second creature — lift it to payload top-level
    const twinTargetId = modifiers?.twin_target_id || null;

    const result = await base44.functions.invoke('combatEngine', {
      action: 'player_attack', session_id: sessionId, combat_id: combatId,
      character_id: character?.id, payload: { target_id: targetId, weapon, spell, modifiers, twin_target_id: twinTargetId }
    });

    const data = result.data;

    // Invalid action (e.g. out of ammunition) — surface message, don't consume the turn
    if (data?.invalid) {
      setNarrative(prev => [...prev, { type: 'roll_result', text: data.error || 'That action is not available.', success: false }]);
      setCombatLoading(false);
      return;
    }

    // Emit floating combat text event + haptic feedback
    if (data.log_entry) {
      setLastCombatEvent({
        key: Date.now(),
        hit: data.hit,
        critical: data.log_entry.critical,
        damage: data.damage || 0,
      });
      // Haptic feedback on mobile (Suggestion #4)
      if (navigator.vibrate) {
        if (data.log_entry.critical) navigator.vibrate([50, 30, 50, 30, 80]);
        else if (data.hit) navigator.vibrate(40);
        else navigator.vibrate([20, 40, 20]);
      }
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
      await reloadCombat(combatId); // keep UI in sync
      setCombatLoading(false);
      return; // Stop here - player still has actions
    }

    // No actions remaining - process enemy turns
    if (!data.combat_ended) {
      await processEnemyTurns(combatId);
    }

    // Sync character HP from DB after enemy turns (prevents stale closure HP display)
    const freshChars = await base44.entities.Character.filter({ id: character?.id });
    if (freshChars[0]) setCharacter(prev => ({ ...prev, hp_current: freshChars[0].hp_current }));

    if (data.combat_ended) {
      if (data.result === 'victory') {
        // Grab combatants from the freshly reloaded log (not stale combat state)
        const freshLogs = await base44.entities.CombatLog.filter({ id: combatId });
        const freshCombat = freshLogs[0];
        const victoriousEnemies = (freshCombat?.combatants || []).filter(c => c.type === 'enemy');
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
    // Single loadState at end of full turn resolution (not after every sub-step)
    await loadState();
    setCombatLoading(false);
  };

  // Two-Weapon Fighting bonus-action off-hand strike (PHB p.195)
  const handleOffhandAttack = async (targetId, modifiers = {}) => {
    const combatId = combat?.id || session?.combat_state?.combat_id;
    if (!combatId) return;
    setCombatLoading(true);
    const result = await base44.functions.invoke('combatEngine', {
      action: 'offhand_attack', session_id: sessionId, combat_id: combatId,
      character_id: character?.id, payload: { target_id: targetId, modifiers }
    });
    const data = result.data;
    if (data?.invalid) {
      setNarrative(prev => [...prev, { type: 'roll_result', text: data.error || 'Off-hand attack not available.', success: false }]);
      setCombatLoading(false);
      return;
    }
    if (data?.log_entry) {
      setLastCombatEvent({ key: Date.now(), hit: data.hit, critical: data.log_entry.critical, damage: data.damage || 0 });
      setNarrative(prev => [...prev, { type: 'roll_result', text: data.log_entry.text, success: data.hit }]);
    }
    await reloadCombat(combatId);
    if (data?.combat_ended && data?.result === 'victory') {
      const freshLogs = await base44.entities.CombatLog.filter({ id: combatId });
      const freshCombat = freshLogs[0];
      const victoriousEnemies = (freshCombat?.combatants || []).filter(c => c.type === 'enemy');
      setDefeatedEnemies(victoriousEnemies);
      setShowLootModal(true);
      await saveCombatHistory(combatId, 'victory', victoriousEnemies, freshCombat?.round);
      setCombat(null);
    }
    await loadState();
    setCombatLoading(false);
  };

  // Legendary Actions (MM): a legendary creature spends actions at the END of another
  // creature's turn. We resolve up to 3 at the end of the player's turn.
  const processLegendaryActions = async (combatId) => {
    const logs = await base44.entities.CombatLog.filter({ id: combatId });
    const log = logs[0];
    if (!log || !log.is_active) return;
    const hasLegendary = (log.combatants || []).some(c => c.type === 'enemy' && c.is_conscious && c.is_legendary);
    const player = (log.combatants || []).find(c => c.type === 'player');
    if (!hasLegendary || !player?.is_conscious) return;

    let safety = 0;
    while (safety < 3) {
      safety++;
      const res = await base44.functions.invoke('combatEngine', {
        action: 'legendary_action', session_id: sessionId, combat_id: combatId,
        character_id: character?.id, payload: {}
      });
      if (res.data?.skipped || (res.data?.legendary_actions_remaining ?? 0) < 0) break;
      if (res.data?.log_entry) {
        setNarrative(prev => [...prev, { type: 'roll_result', text: res.data.log_entry.text, success: res.data.log_entry.hit === false }]);
        setLastCombatEvent({ key: Date.now(), hit: res.data.log_entry.hit, critical: res.data.log_entry.critical, damage: res.data.log_entry.damage || 0 });
      }
      await new Promise(r => setTimeout(r, 500));
      await reloadCombat(combatId);
      if ((res.data?.legendary_actions_remaining ?? 0) <= 0) break;
    }
    await loadState();
  };

  const processEnemyTurns = async (combatId) => {
    // Legendary actions fire at the end of the player's turn, before enemies act.
    await processLegendaryActions(combatId);

    // Record the starting round — enemies should only act once per round.
    // When the round advances, stop and let the player go next.
    const initialLogs = await base44.entities.CombatLog.filter({ id: combatId });
    const startRound = initialLogs[0]?.round || 1;
    if (!initialLogs[0]) return; // combat log gone — bail out cleanly

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

      // Stop if no conscious enemies remain
      const hasLivingEnemies = log.combatants.some(c => c.type === 'enemy' && c.is_conscious);
      if (!hasLivingEnemies) break;
      
      // If player is downed (0 HP), enemies can still attack to inflict death-save failures (PHB p.197)
      const playerCombatant = log.combatants.find(c => c.type === 'player');
      if (!playerCombatant?.is_conscious) {
        // Let the current enemy attack the downed player, then surface the result
        if (current?.type === 'enemy' && current?.is_conscious) {
          await new Promise(resolve => setTimeout(resolve, 600));
          const downedRes = await base44.functions.invoke('combatEngine', {
            action: 'enemy_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
          });
          if (downedRes.data?.log_entry) {
            setNarrative(prev => [...prev, { type: 'roll_result', text: downedRes.data.log_entry.text, success: !downedRes.data.hit }]);
          }
          // Refresh death-save state and re-show the modal
          await loadState();
          setShowDeathSaves(true);
          continue;
        }
        break;
      }

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
          await loadState(); // sync HP to 0 before showing modal
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
    
    // Check if player is at 0 HP
    if (character?.hp_current <= 0) {
      setShowDeathSaves(true);
      return;
    }
    
    setCombatLoading(true);
    
    // Advance past the player turn and reset action tracking
    await base44.functions.invoke('combatEngine', {
      action: 'next_turn',
      session_id: sessionId,
      combat_id: combatId,
      character_id: character?.id,
      payload: {}
    });
    
    // Reload to get the updated turn index before processing enemies
    await reloadCombat(combatId);
    
    // Only process enemy turns if combat is still active
    const freshLogs = await base44.entities.CombatLog.filter({ id: combatId });
    if (freshLogs[0]?.is_active) {
      await processEnemyTurns(combatId);
    }
    
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
    navigate('/Home');
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
      // Clone combatants array to avoid direct state mutation
      const updatedCombatants = (combat.combatants || []).map(c => {
        if (c.id === target.id) {
          const currentHp = c.hp_current ?? c.hp ?? 0;
          const newHp = Math.max(0, currentHp - damageTotal);
          return { ...c, hp_current: newHp, is_conscious: newHp > 0 };
        }
        return c;
      });
      await base44.entities.CombatLog.update(combatId, { combatants: updatedCombatants });
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
        <p className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(220,190,140,0.85)' }}>Preparing your world...</p>
      </div>
    </div>
  );

  const inCombat = session?.in_combat && combat;

  return (
    <div className="h-screen flex flex-col parchment-bg overflow-hidden" style={{ color: '#e8d5b7' }}>
      {/* HUD */}
      <HUD character={character} session={session} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{
          background: 'rgba(8,5,2,0.9)',
          borderBottom: '1px solid rgba(180,140,90,0.15)',
          backdropFilter: 'blur(8px)',
        }}>
        <button onClick={() => navigate('/Home')}
          className="p-1.5 rounded-lg transition-all flex-shrink-0"
          style={{ color: 'rgba(201,169,110,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm italic truncate min-w-0 flex-shrink" style={{ color: 'rgba(222,192,142,0.9)', fontFamily: 'IM Fell English, serif' }}>
          {session?.title || 'Adventure'}
        </span>

        {inCombat && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full font-fantasy text-xs badge-blood combat-active flex-shrink-0">
            <Swords className="w-3 h-3" /> <span className="hidden sm:inline">In Combat</span>
          </div>
        )}

        <div className="ml-auto">
          <GameToolbar
            sessionId={sessionId}
            characterId={character?.id}
            inCombat={inCombat}
            started={started}
            showDiceRoller={showDiceRoller}
            setShowDiceRoller={setShowDiceRoller}
            showCompanions={showCompanions}
            setShowCompanions={setShowCompanions}
            setShowRestModal={setShowRestModal}
            setShowSceneVisualizer={setShowSceneVisualizer}
            setShowPortraitGen={setShowPortraitGen}
            setShowCharSheet={setShowCharSheet}
          />
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {inCombat ? (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Mobile tab switcher — only visible on small screens */}
            <div className="flex lg:hidden flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,30,30,0.2)', background: 'rgba(10,3,3,0.8)' }}>
              {['story', 'combat'].map(tab => (
                <button key={tab} onClick={() => setCombatViewTab(tab)}
                  className="flex-1 py-2 text-xs font-fantasy uppercase tracking-widest transition-all"
                  style={combatViewTab === tab ? {
                    color: tab === 'combat' ? '#fca5a5' : '#f0c040',
                    borderBottom: `2px solid ${tab === 'combat' ? '#dc2626' : '#c9a96e'}`,
                    background: tab === 'combat' ? 'rgba(60,5,5,0.4)' : 'rgba(40,25,8,0.4)',
                  } : {
                    color: 'rgba(180,120,100,0.4)', borderBottom: '2px solid transparent',
                  }}>
                  {tab === 'combat' ? '⚔️ Combat' : '📜 Story'}
                </button>
              ))}
            </div>
            {/* Desktop: side-by-side. Mobile: tabbed */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden min-h-0">
              <div className={`overflow-hidden flex flex-col min-h-0 ${combatViewTab !== 'story' ? 'hidden lg:flex' : ''}`}
                style={{ borderRight: '1px solid rgba(180,30,30,0.2)' }}>
                <StoryPanel narrative={narrative} choices={[]} loading={storyLoading}
                  onChoice={() => {}} customInput={customInput}
                  setCustomInput={setCustomInput} onCustomSubmit={handleCustomInput} />
              </div>
              <div className={`overflow-hidden ${combatViewTab !== 'combat' ? 'hidden lg:block' : ''}`}>
                <CombatPanel combat={combat} character={character}
                  onPlayerAttack={handlePlayerAttack}
                  onOffhandAttack={handleOffhandAttack}
                  onNextTurn={handleNextTurn}
                  onEndTurn={handleEndTurn}
                  onFlee={handleFlee}
                  loading={combatLoading}
                  lastCombatEvent={lastCombatEvent}
                  onCharacterUpdate={setCharacter}
                  onCombatAct={handleCombatAct}
                  actEvaluating={actEvaluating} />
              </div>
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
                  <p className="mb-8 leading-relaxed" style={{ color: 'rgba(238,222,196,0.95)', fontFamily: 'IM Fell English, serif', fontSize: '1.1rem' }}>
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
              <div className="h-full flex flex-col overflow-hidden">
                <div className="flex flex-shrink-0" style={{ background: 'rgba(8,5,2,0.72)', borderBottom: '1px solid rgba(180,140,90,0.16)' }}>
                  {[['story', '📜 Story'], ['journal', '📓 Journal']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setMainViewTab(key)}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-fantasy uppercase tracking-widest transition-all"
                      style={mainViewTab === key ? {
                        color: '#f0c040',
                        borderBottom: '2px solid #c9a96e',
                        background: 'rgba(60,38,12,0.45)',
                      } : {
                        color: 'rgba(201,169,110,0.52)',
                        borderBottom: '2px solid transparent',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  {mainViewTab === 'journal' ? (
                    <CampaignJournal sessionId={sessionId} characterId={character?.id} />
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
              </div>
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

      {/* Combat Act — DM Adjudication Modal */}
      <AnimatePresence>
        {combatProposal && (
          <CombatActProposalModal
            proposal={combatProposal}
            onConfirm={() => executeCombatAction(combatProposal)}
            onCancel={() => setCombatProposal(null)} />
        )}
      </AnimatePresence>

      {/* Evaluating Action Spinner (covers both exploration and combat "DM is thinking") */}
      <AnimatePresence>
        {(evaluatingAction || actEvaluating) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full"
            style={{ background: 'rgba(10,6,3,0.92)', border: '1px solid rgba(201,169,110,0.3)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c9a96e' }} />
            <span className="text-xs font-fantasy" style={{ color: 'rgba(225,192,142,0.95)' }}>DM is considering...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Death Saves Modal — D&D 5e: reaching 0 HP triggers death saving throws */}
      <AnimatePresence>
        {showDeathSaves && character && (
          <DeathSavesModal
            character={character}
            combat={combat}
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
            onRest={async (restType, hitDiceToSpend) => {
              if (!character?.id) {
                setNarrative(prev => [...prev, { type: 'narration', text: '⚠️ Unable to rest — no character is linked to this session.' }]);
                setShowRestModal(false);
                return;
              }
              const result = await base44.functions.invoke('handleRest', {
                character_id: character.id,
                rest_type: restType,
                hit_dice_to_spend: hitDiceToSpend,
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

              // Build a flavorful rest narration. Long rests come with a backend narrative;
              // short rests get a brief campfire-flavored intro generated here.
              const shortRestFlavor = [
                'You catch your breath beside a low fire, tending wounds and steadying your nerves.',
                'A quiet hour passes. You sharpen your gear, eat a little, and let the ache fade.',
                'You lean against the stone and rest your eyes for a while, regaining your composure.',
                'The brief respite does you good — your breathing slows and your strength returns.',
              ];
              const intro = restType === 'long'
                ? (result.data.narrative || 'You sleep through the night and wake restored.')
                : shortRestFlavor[Math.floor(Math.random() * shortRestFlavor.length)];
              const icon = restType === 'long' ? '🌙' : '☕';

              setNarrative(prev => [...prev, {
                type: 'narration',
                text: `${icon} ${intro} ${result.data.restorations.join(', ')}.`
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