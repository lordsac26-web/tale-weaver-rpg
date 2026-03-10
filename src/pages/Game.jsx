import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { User, Loader2, ChevronLeft, Dices, Swords, Map, ShoppingBag, Eye, Paintbrush, Scroll, BookMarked, Grid3X3 } from 'lucide-react';
import { SKILL_STAT_MAP, calcStatMod, PROFICIENCY_BY_LEVEL } from '@/components/game/gameData';
import { getAlignmentLabel } from '@/components/game/AlignmentBadge';
import { motion, AnimatePresence } from 'framer-motion';
import HUD from '@/components/game/HUD';
import StoryPanel from '@/components/game/StoryPanel';
import CombatPanel from '@/components/game/CombatPanel';
import CharacterSheet from '@/components/game/CharacterSheet';
import DiceRoller from '@/components/game/DiceRoller';
import SceneVisualizerModal from '@/components/game/SceneVisualizerModal';
import CharacterPortraitGenerator from '@/components/game/CharacterPortraitGenerator';
import ActionProposalModal from '@/components/game/ActionProposalModal';
import Dice3DModal from '@/components/dice/Dice3DModal.jsx';
import LootModal from '@/components/game/LootModal.jsx';
import CombatBattleMap from '@/components/battlemap/CombatBattleMap';
import AfterActionReport from '@/components/game/AfterActionReport';

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
  const [show3DDice, setShow3DDice] = useState(false);
  const [started, setStarted] = useState(false);
  const [showSceneVisualizer, setShowSceneVisualizer] = useState(false);
  const [showPortraitGen, setShowPortraitGen] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [evaluatingAction, setEvaluatingAction] = useState(false);
  const [lastCombatEvent, setLastCombatEvent] = useState(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [defeatedEnemies, setDefeatedEnemies] = useState([]);
  const [showBattleMap, setShowBattleMap] = useState(false);
  const [aarData, setAarData] = useState(null);
  const [aarLoading, setAarLoading] = useState(false);
  const [showAAR, setShowAAR] = useState(false);
  const initialRestoreDone = useRef(false);

  const loadState = useCallback(async () => {
    if (!sessionId) { navigate(createPageUrl('Home')); return; }
    const sessions = await base44.entities.GameSession.filter({ id: sessionId });
    const sess = sessions[0];
    if (!sess) { navigate(createPageUrl('Home')); return; }
    setSession(sess);

    const chars = await base44.entities.Character.filter({ id: sess.character_id });
    setCharacter(chars[0] || null);

    // Only restore narrative from story_log on initial page load, not after every action
    if (!initialRestoreDone.current && sess.story_log?.length > 0) {
      initialRestoreDone.current = true;
      // Strip embedded choice text (numbered lists like "1. ...\n2. ...") from restored narration
      const stripChoices = (text) => {
        if (!text) return text;
        // Remove trailing numbered choice blocks (e.g. "\n1. Do something\n2. Do another thing")
        return text.replace(/(\n\s*\d+\.\s+.+){2,}$/g, '').trim();
      };
      const restored = sess.story_log.slice(-10).map(e => ({ type: 'narration', text: stripChoices(e.text) }));
      setNarrative(restored);
      setStarted(true);
      const lastEntry = sess.story_log[sess.story_log.length - 1];
      if (lastEntry?.choices?.length > 0) {
        setChoices(lastEntry.choices);
      }
    }

    if (sess.in_combat && sess.combat_state?.combat_id) {
      const logs = await base44.entities.CombatLog.filter({ id: sess.combat_state.combat_id });
      if (logs[0]?.is_active) setCombat(logs[0]);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadState(); }, [sessionId]);

  const startAdventure = async () => {
    setStoryLoading(true);
    setStarted(true);
    const result = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'start' });
    const data = result.data;
    setNarrative([{ type: 'narration', text: data.narrative }]);
    setChoices(data.choices || []);
    await loadState();
    setStoryLoading(false);
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

  // Process alignment shifts from AI response and emit narrative events
  const processAlignmentShift = (data) => {
    if (!data.alignment_shift || !character) return;
    const lcShift = data.alignment_shift.law_chaos_shift || 0;
    const geShift = data.alignment_shift.good_evil_shift || 0;
    if (lcShift === 0 && geShift === 0) return;

    const oldLC = character.alignment_law_chaos || 0;
    const oldGE = character.alignment_good_evil || 0;
    const newLC = Math.max(-10, Math.min(10, oldLC + lcShift));
    const newGE = Math.max(-10, Math.min(10, oldGE + geShift));
    const oldLabel = getAlignmentLabel(oldLC, oldGE);
    const newLabel = getAlignmentLabel(newLC, newGE);

    const parts = [];
    if (lcShift > 0) parts.push(`⚖️ +${lcShift} Lawful`);
    if (lcShift < 0) parts.push(`🌊 ${lcShift} Chaotic`);
    if (geShift > 0) parts.push(`💚 +${geShift} Good`);
    if (geShift < 0) parts.push(`💀 ${geShift} Evil`);

    if (oldLabel !== newLabel) {
      setNarrative(prev => [...prev, {
        type: 'alignment_shift',
        text: `${oldLabel} → ${newLabel}`,
        details: parts.join(' · '),
      }]);
    } else if (Math.abs(lcShift) >= 2 || Math.abs(geShift) >= 2) {
      setNarrative(prev => [...prev, {
        type: 'alignment_shift',
        text: parts.join(' · '),
        details: `Alignment: ${newLabel} (L/C: ${newLC}, G/E: ${newGE})`,
      }]);
    }

    // Update local character state immediately
    setCharacter(prev => prev ? { ...prev, alignment_law_chaos: newLC, alignment_good_evil: newGE, alignment: newLabel } : prev);
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
    processAlignmentShift(data);

    if (data.combat_trigger && data.enemies?.length > 0) {
      setNarrative(prev => [...prev, { type: 'combat_start', text: 'Combat begins!' }]);
      await startCombat(data.enemies);
    } else {
      setChoices(data.choices || []);
    }

    await loadState();
    setStoryLoading(false);
  };

  // Intercept custom input — send to DM for adjudication first
  const handleCustomInput = async () => {
    if (!customInput.trim()) return;
    const text = customInput;
    setCustomInput('');
    setEvaluatingAction(true);

    const result = await base44.functions.invoke('evaluatePlayerAction', {
      action: text,
      character,
      session_context: `${session?.current_location || ''} — ${narrative.filter(e => e.type === 'narration').slice(-1)[0]?.text?.slice(0, 200) || ''}`
    });
    setEvaluatingAction(false);
    setPendingProposal({ ...result.data, action: text });
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
    const result = await base44.functions.invoke('generateStory', { session_id: sessionId, action: 'choice', custom_input: action + checkResult });
    const data = result.data;
    if (data.narrative) setNarrative(prev => [...prev, { type: 'narration', text: data.narrative }]);
    if (data.xp_earned) setNarrative(prev => [...prev, { type: 'xp_gain', text: `+${data.xp_earned} XP!` }]);
    processAlignmentShift(data);
    if (data.combat_trigger && data.enemies?.length > 0) {
      setNarrative(prev => [...prev, { type: 'combat_start', text: 'Combat begins!' }]);
      await startCombat(data.enemies);
    } else {
      setChoices(data.choices || []);
    }
    await loadState();
    setStoryLoading(false);
  };

  const startCombat = async (enemies) => {
    const result = await base44.functions.invoke('combatEngine', {
      action: 'start_combat', session_id: sessionId, character_id: character?.id, payload: { enemies }
    });
    setCombat({ ...result.data, id: result.data.combat_id });
    setShowBattleMap(true);
    await loadState();
  };

  const handlePlayerAttack = async (targetId, actionType, weaponOrSpell) => {
    if (!combat?.id && !session?.combat_state?.combat_id) return;
    const combatId = combat?.id || session?.combat_state?.combat_id;
    setCombatLoading(true);

    const isSpell = actionType === 'spell';
    const weapon = isSpell ? null : (weaponOrSpell || character?.equipped?.weapon || { damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0, type: 'melee' });
    const spell = isSpell ? weaponOrSpell : null;

    const result = await base44.functions.invoke('combatEngine', {
      action: 'player_attack', session_id: sessionId, combat_id: combatId,
      character_id: character?.id, payload: { target_id: targetId, weapon, spell }
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

    await reloadCombat(combatId);

    if (data.actions_remaining > 0 && !data.combat_ended) {
      setNarrative(prev => [...prev, {
        type: 'roll_result',
        text: `${data.actions_remaining} action${data.actions_remaining > 1 ? 's' : ''} remaining this turn.`,
        success: true
      }]);
    }

    if (data.combat_ended) {
      const endCombatId = combatId;
      if (data.result === 'victory') {
        const victoriousEnemies = (combat?.combatants || []).filter(c => c.type === 'enemy');
        setDefeatedEnemies(victoriousEnemies);
        setShowLootModal(true);
        setNarrative(prev => [...prev, { type: 'narration', text: '⚔️ Victory! The battle is won. Your enemies lie defeated.' }]);
        await saveCombatHistory(endCombatId, 'victory', victoriousEnemies);
        // Generate AAR in background (non-blocking)
        generateAAR(endCombatId);
        const storyResult = await base44.functions.invoke('generateStory', {
          session_id: sessionId, action: 'choice', custom_input: 'The combat has ended in victory.'
        });
        if (storyResult.data?.narrative) setNarrative(prev => [...prev, { type: 'narration', text: storyResult.data.narrative }]);
        setChoices(storyResult.data?.choices || []);
      } else if (data.result === 'defeat') {
        const defeatedEnemyList = (combat?.combatants || []).filter(c => c.type === 'enemy');
        await saveCombatHistory(endCombatId, 'defeat', defeatedEnemyList);
        generateAAR(endCombatId);
        setNarrative(prev => [...prev, { type: 'narration', text: '💀 You have fallen in battle. Darkness takes you...' }]);
        setChoices([]);
      }
      setCombat(null);
    } else {
      await processEnemyTurns(combatId);
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

      if (current?.type === 'enemy' && current?.is_conscious) {
        const result = await base44.functions.invoke('combatEngine', {
          action: 'enemy_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
        });
        const data = result.data;
        if (data.log_entry) {
            setNarrative(prev => [...prev, { type: 'roll_result', text: data.log_entry.text, success: !data.log_entry.hit }]);
            // Floating text for enemy attacks on player
            setLastCombatEvent({
              key: Date.now(),
              hit: data.log_entry.hit,
              critical: data.log_entry.critical,
              damage: data.log_entry.damage || 0,
            });
          }
        if (data.player_dead) {
          setNarrative(prev => [...prev, { type: 'narration', text: '💀 You have fallen in battle...' }]);
          await saveCombatHistory(combatId, 'defeat', (combat?.combatants || []).filter(c => c.type === 'enemy'));
          generateAAR(combatId);
          setCombat(null);
          break;
        }
        await reloadCombat(combatId);
        await loadState();
      } else {
        await base44.functions.invoke('combatEngine', {
          action: 'next_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
        });
        await reloadCombat(combatId);
      }
    }
  };

  // Saves a completed encounter snapshot to the CombatLog for history tracking
  const saveCombatHistory = async (combatId, result, enemies) => {
    if (!combatId) return;
    const enemySnapshot = enemies.map(e => ({
      name: e.name,
      max_hp: e.max_hp || e.hp,
      cr: e.cr || null,
    }));
    await base44.entities.CombatLog.update(combatId, {
      result,
      is_active: false,
      enemies_faced: enemySnapshot,
      session_title: session?.title || 'Unknown Campaign',
      character_name: character?.name || '',
      location: session?.current_location || '',
      total_rounds: combat?.round || 0,
      encounter_date: new Date().toISOString(),
    });
  };

  const generateAAR = async (combatId) => {
    setAarLoading(true);
    setShowAAR(true);
    try {
      const result = await base44.functions.invoke('generateAfterActionReport', {
        combat_id: combatId,
        session_id: sessionId,
        character_id: character?.id,
      });
      setAarData(result.data);
    } catch (e) {
      console.error('AAR generation failed:', e);
      setAarData(null);
    }
    setAarLoading(false);
  };

  const reloadCombat = async (combatId) => {
    const logs = await base44.entities.CombatLog.filter({ id: combatId });
    if (logs[0]) setCombat(logs[0]);
  };

  const handleNextTurn = async () => {
    const combatId = combat?.id || session?.combat_state?.combat_id;
    if (!combatId) return;
    setCombatLoading(true);
    await processEnemyTurns(combatId);
    await reloadCombat(combatId);
    await loadState();
    setCombatLoading(false);
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
      if (combatId) {
        await base44.entities.CombatLog.update(combatId, { is_active: false, result: 'fled' });
        generateAAR(combatId);
      }
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
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-fantasy text-xs badge-blood combat-active">
              <Swords className="w-3 h-3" /> In Combat
            </div>
            <button onClick={() => setShowBattleMap(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
              style={showBattleMap ? {
                background: 'rgba(80,10,10,0.7)', border: '1px solid rgba(220,50,50,0.5)', color: '#fca5a5',
                boxShadow: '0 0 10px rgba(180,30,30,0.15)',
              } : {
                background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,60,40,0.2)', color: 'rgba(252,165,165,0.55)',
              }}>
              <Grid3X3 className="w-3.5 h-3.5" /> Map
            </button>
          </>
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
        <button onClick={() => setShow3DDice(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-fantasy transition-all"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(201,169,110,0.3)', color: 'rgba(240,192,64,0.7)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,192,64,0.6)'; e.currentTarget.style.color = '#f0c040'; e.currentTarget.style.boxShadow = '0 0 12px rgba(240,192,64,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; e.currentTarget.style.color = 'rgba(240,192,64,0.7)'; e.currentTarget.style.boxShadow = 'none'; }}>
          🎲 3D Tower
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
          <div className={`flex-1 grid overflow-hidden min-h-0 ${showBattleMap ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
            <div className="overflow-hidden flex flex-col min-h-0" style={{ borderRight: '1px solid rgba(180,30,30,0.2)' }}>
              <StoryPanel narrative={narrative} choices={[]} loading={storyLoading}
                onChoice={() => {}} customInput={customInput}
                setCustomInput={setCustomInput} onCustomSubmit={() => {}}
                sessionSetting={session?.setting} />
            </div>
            <div className="overflow-hidden">
              <CombatPanel combat={combat} character={character}
                onPlayerAttack={handlePlayerAttack}
                onNextTurn={handleNextTurn}
                onFlee={handleFlee}
                loading={combatLoading}
                lastCombatEvent={lastCombatEvent} />
            </div>
            {showBattleMap && (
              <div className="overflow-hidden hidden lg:block" style={{ borderLeft: '1px solid rgba(180,30,30,0.2)' }}>
                <CombatBattleMap combat={combat} character={character} />
              </div>
            )}
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
              <StoryPanel narrative={narrative} choices={choices} loading={storyLoading}
                onChoice={handleChoice} customInput={customInput}
                setCustomInput={setCustomInput} onCustomSubmit={handleCustomInput}
                sessionSetting={session?.setting} />
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

      {/* 3D Dice Tower Modal */}
      <AnimatePresence>
        {show3DDice && (
          <Dice3DModal character={character} onClose={() => setShow3DDice(false)} />
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
              setCharacter(prev => ({ ...prev, ...updates }));
              const coinParts = [];
              if (updates.gold   > character.gold)   coinParts.push(`+${updates.gold   - character.gold} gp`);
              if (updates.silver > character.silver) coinParts.push(`+${updates.silver - character.silver} sp`);
              if (updates.copper > character.copper) coinParts.push(`+${updates.copper - character.copper} cp`);
              if ((updates.inventory?.length || 0) > (character.inventory?.length || 0)) {
                const newCount = (updates.inventory?.length || 0) - (character.inventory?.length || 0);
                coinParts.push(`${newCount} item${newCount > 1 ? 's' : ''} added`);
              }
              if (coinParts.length > 0) {
                setNarrative(prev => [...prev, { type: 'xp_gain', text: `💰 Looted: ${coinParts.join(' · ')}` }]);
              }
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

      {/* After-Action Report Modal */}
      <AnimatePresence>
        {showAAR && (
          <AfterActionReport
            aar={aarData}
            loading={aarLoading}
            onClose={() => { setShowAAR(false); setAarData(null); }}
            onNarrativeContinue={(bridge) => {
              setNarrative(prev => [...prev, { type: 'narration', text: bridge }]);
            }}
          />
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
    </div>
  );
}