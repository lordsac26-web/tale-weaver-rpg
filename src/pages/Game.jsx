import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { User, Map, Loader2, ChevronLeft } from 'lucide-react';
import HUD from '@/components/game/HUD';
import StoryPanel from '@/components/game/StoryPanel';
import CombatPanel from '@/components/game/CombatPanel';
import CharacterSheet from '@/components/game/CharacterSheet';

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
  const [started, setStarted] = useState(false);

  const loadState = useCallback(async () => {
    if (!sessionId) { navigate(createPageUrl('Home')); return; }
    const sessions = await base44.entities.GameSession.filter({ id: sessionId });
    const sess = sessions[0];
    if (!sess) { navigate(createPageUrl('Home')); return; }
    setSession(sess);

    const chars = await base44.entities.Character.filter({ id: sess.character_id });
    setCharacter(chars[0] || null);

    // Restore story log to narrative
    if (sess.story_log?.length > 0 && narrative.length === 0) {
      const restored = sess.story_log.slice(-10).map(e => ({ type: 'narration', text: e.text }));
      setNarrative(restored);
      setStarted(true);
      // Restore the last set of choices so the player can continue
      const lastEntry = sess.story_log[sess.story_log.length - 1];
      if (lastEntry?.choices?.length > 0) {
        setChoices(lastEntry.choices);
      }
    }

    // Load active combat
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

  const handleChoice = async (choiceIndex) => {
    const choice = choices[choiceIndex];
    setNarrative(prev => [...prev, { type: 'player_action', text: choice.text }]);
    setChoices([]);

    // If choice has a skill check, perform roll first
    if (choice.skill_check && choice.dc) {
      setStoryLoading(true);
      const rollResult = await base44.functions.invoke('rollDice', {
        session_id: sessionId,
        character_id: character?.id,
        roll_type: choice.skill_check.toLowerCase().replace(/ /g, '_'),
        dice: '1d20',
        dc: choice.dc,
        context: choice.text
      });
      const roll = rollResult.data;
      setNarrative(prev => [...prev, {
        type: 'roll_result',
        text: `${choice.skill_check} check: rolled ${roll.raw_total} + ${roll.modifier_total} = ${roll.final_result} vs DC ${choice.dc} — ${roll.success ? 'SUCCESS!' : 'FAILURE'}`,
        success: roll.success
      }]);
    }

    setStoryLoading(true);
    const result = await base44.functions.invoke('generateStory', {
      session_id: sessionId,
      action: 'choice',
      choice_index: choiceIndex,
      custom_input: choice.text
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
    setStoryLoading(false);
  };

  const handleCustomInput = async () => {
    if (!customInput.trim()) return;
    const text = customInput;
    setCustomInput('');
    setNarrative(prev => [...prev, { type: 'player_action', text }]);
    setChoices([]);
    setStoryLoading(true);

    const result = await base44.functions.invoke('generateStory', {
      session_id: sessionId, action: 'choice', custom_input: text
    });
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
    setStoryLoading(false);
  };

  const startCombat = async (enemies) => {
    const result = await base44.functions.invoke('combatEngine', {
      action: 'start_combat',
      session_id: sessionId,
      character_id: character?.id,
      payload: { enemies }
    });
    setCombat({ ...result.data, id: result.data.combat_id });
    await loadState();
  };

  const handlePlayerAttack = async (targetId, actionType) => {
    if (!combat?.id && !session?.combat_state?.combat_id) return;
    const combatId = combat?.id || session?.combat_state?.combat_id;
    setCombatLoading(true);

    const weapon = character?.equipped?.weapon || { damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0, type: 'melee' };
    const result = await base44.functions.invoke('combatEngine', {
      action: 'player_attack',
      session_id: sessionId,
      combat_id: combatId,
      character_id: character?.id,
      payload: { target_id: targetId, weapon }
    });

    const data = result.data;
    setNarrative(prev => [...prev, {
      type: 'roll_result',
      text: data.log_entry?.text || 'Attack resolved.',
      success: data.hit
    }]);

    if (data.combat_ended) {
      if (data.result === 'victory') {
        setNarrative(prev => [...prev, { type: 'narration', text: '⚔️ Victory! The battle is won. Your enemies lie defeated.' }]);
        const storyResult = await base44.functions.invoke('generateStory', {
          session_id: sessionId, action: 'choice', custom_input: 'The combat has ended in victory.'
        });
        if (storyResult.data?.narrative) setNarrative(prev => [...prev, { type: 'narration', text: storyResult.data.narrative }]);
        setChoices(storyResult.data?.choices || []);
      } else if (data.result === 'defeat') {
        setNarrative(prev => [...prev, { type: 'narration', text: '💀 You have fallen in battle. Darkness takes you...' }]);
        setChoices([]);
      }
      setCombat(null);
    } else {
      // Reload combat
      await reloadCombat(combatId);
      // Auto-process enemy turns
      await processEnemyTurns(combatId);
    }
    await loadState();
    setCombatLoading(false);
  };

  const processEnemyTurns = async (combatId) => {
    // Process turns until it's the player's turn again
    let attempts = 0;
    while (attempts < 10) {
      attempts++;
      const logs = await base44.entities.CombatLog.filter({ id: combatId });
      const log = logs[0];
      if (!log || !log.is_active) break;
      const current = log.combatants[log.current_turn_index];
      if (current?.type === 'player') break;

      if (current?.type === 'enemy' && current?.is_conscious) {
        const result = await base44.functions.invoke('combatEngine', {
          action: 'enemy_turn',
          session_id: sessionId,
          combat_id: combatId,
          character_id: character?.id,
          payload: {}
        });
        const data = result.data;
        if (data.log_entry) {
          setNarrative(prev => [...prev, {
            type: 'roll_result',
            text: data.log_entry.text,
            success: !data.log_entry.hit
          }]);
        }
        if (data.player_dead) {
          setNarrative(prev => [...prev, { type: 'narration', text: '💀 You have fallen in battle...' }]);
          setCombat(null);
          break;
        }
        await reloadCombat(combatId);
        await loadState();
      } else {
        const result = await base44.functions.invoke('combatEngine', {
          action: 'next_turn', session_id: sessionId, combat_id: combatId, character_id: character?.id, payload: {}
        });
        await reloadCombat(combatId);
      }
    }
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

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );

  const inCombat = session?.in_combat && combat;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100 flex flex-col">
      {/* HUD */}
      <HUD character={character} session={session} />

      {/* Toolbar */}
      <div className="bg-slate-900/80 border-b border-slate-700/40 px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate(createPageUrl('Home'))} className="text-slate-400 hover:text-slate-200">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-slate-400 text-sm flex-1">{session?.title || 'Adventure'}</span>
        <button onClick={() => setShowCharSheet(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg text-sm text-amber-300 transition-all">
          <User className="w-3.5 h-3.5" /> Character
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex overflow-hidden">
        {inCombat ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
            <div className="overflow-hidden flex flex-col border-r border-slate-700/50">
              <StoryPanel narrative={narrative} choices={[]} loading={storyLoading}
                onChoice={() => {}} customInput={customInput}
                setCustomInput={setCustomInput} onCustomSubmit={() => {}} />
            </div>
            <div className="overflow-hidden">
              <CombatPanel combat={combat} character={character}
                onPlayerAttack={handlePlayerAttack}
                onNextTurn={handleNextTurn}
                onFlee={handleFlee}
                loading={combatLoading} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {!started ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center max-w-lg">
                  <div className="text-6xl mb-6">⚔️</div>
                  <h2 className="text-3xl font-bold text-amber-300 mb-4">Your Adventure Awaits</h2>
                  <p className="text-amber-400/60 mb-8 leading-relaxed">
                    {session?.story_seed || 'The realm is full of mystery and danger. Your legend begins now.'}
                  </p>
                  <button onClick={startAdventure} disabled={storyLoading}
                    className="px-8 py-4 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold rounded-2xl text-lg transition-all flex items-center gap-3 mx-auto">
                    {storyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>🎲</span>}
                    {storyLoading ? 'Weaving your world...' : 'Begin the Story'}
                  </button>
                </div>
              </div>
            ) : (
              <StoryPanel narrative={narrative} choices={choices} loading={storyLoading}
                onChoice={handleChoice}
                customInput={customInput} setCustomInput={setCustomInput}
                onCustomSubmit={handleCustomInput} />
            )}
          </div>
        )}
      </div>

      {/* Character Sheet Modal */}
      {showCharSheet && <CharacterSheet character={character} onClose={() => setShowCharSheet(false)} />}
    </div>
  );
}