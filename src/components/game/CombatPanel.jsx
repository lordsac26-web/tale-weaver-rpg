import React, { useState } from 'react';
import { Loader2, SkipForward, Swords, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod, PROFICIENCY_BY_LEVEL } from './gameData';
import CombatSpellSelector from './CombatSpellSelector';
import { SPELL_DETAILS } from './spellData';
import CombatDiceRoller from './CombatDiceRoller';
import CombatLog from './CombatLog';
import InitiativeTracker from './InitiativeTracker';
import ActionPointBar from './ActionPointBar';

const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger'];

function getActionsPerTurn(character) {
  if (!character) return 1;
  const features = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
  const charClass = (character.class || '').toLowerCase();
  const level = character.level || 1;
  let actions = 1;
  if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) actions = 2;
  if (charClass === 'fighter' && level >= 11) actions = 3;
  if (charClass === 'fighter' && level >= 20) actions = 4;
  if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
  return actions;
}

export default function CombatPanel({ combat, character, onPlayerAttack, onNextTurn, onFlee, loading }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [action, setAction] = useState('attack');
  const [selectedSpell, setSelectedSpell] = useState(null);
  const [selectedSpellLevel, setSelectedSpellLevel] = useState(null);
  const [selectedSpellBaseLevel, setSelectedSpellBaseLevel] = useState(null);
  const [showDice, setShowDice] = useState(false);

  if (!combat) return null;

  const { combatants, initiative_order, log_entries, round, current_turn_index, world_state } = combat;
  const enemies = (combatants || []).filter(c => c.type === 'enemy');
  const player = (combatants || []).find(c => c.type === 'player');
  const currentCombatant = combatants?.[current_turn_index];
  const isPlayerTurn = currentCombatant?.type === 'player';
  const isCaster = SPELLCASTING_CLASSES.includes(character?.class);
  const actionsPerTurn = getActionsPerTurn(character);
  const actionsUsed = world_state?.actions_used_this_turn || 0;
  const actionsRemaining = Math.max(0, actionsPerTurn - actionsUsed);

  // Derive a useful attack modifier for the dice roller display
  const charLevel = character?.level || 1;
  const profBonus = PROFICIENCY_BY_LEVEL[(charLevel - 1)] || 2;
  const strMod = calcStatMod(character?.strength || 10);
  const dexMod = calcStatMod(character?.dexterity || 10);
  const equippedWeapon = character?.equipped?.weapon || null;
  const isRanged = equippedWeapon?.type === 'ranged';
  const attackMod = (isRanged ? dexMod : strMod) + profBonus + (equippedWeapon?.attack_bonus || 0);

  const handleSelectSpell = (spellName, baseLevel) => {
    setSelectedSpell(spellName);
    setSelectedSpellBaseLevel(baseLevel);
    setSelectedSpellLevel(baseLevel);
  };

  const handleAction = () => {
    if (!selectedTarget) return;
    if (action === 'spell' && selectedSpell) {
      const details = SPELL_DETAILS[selectedSpell] || {};
      onPlayerAttack(selectedTarget, 'spell', {
        name: selectedSpell,
        damage_dice: details.damage_dice || '2d6',
        damage_type: details.damage_type || 'force',
        attack_type: details.attack_type || 'ranged_spell_attack',
        save_type: details.save_type || null,
        is_utility: details.is_utility || false,
        heal_dice: details.heal_dice || null,
        slot_level: selectedSpellLevel || selectedSpellBaseLevel || 1,
        base_level: selectedSpellBaseLevel || 1,
      });
    } else if (action === 'attack') {
      const weapon = character?.equipped?.weapon || { damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0, type: 'melee' };
      onPlayerAttack(selectedTarget, 'attack', weapon);
    } else {
      onPlayerAttack(selectedTarget, action);
    }
  };

  const canAct = isPlayerTurn && selectedTarget && (action !== 'spell' || selectedSpell);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgba(8,3,3,0.95)' }}>
      {/* Header — Combat Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 combat-active"
        style={{
          background: 'linear-gradient(90deg, rgba(80,5,5,0.9), rgba(50,5,5,0.95))',
          borderBottom: '1px solid rgba(180,30,30,0.4)',
        }}>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4" style={{ color: '#fca5a5' }} />
          <span className="font-fantasy font-bold text-sm tracking-widest" style={{ color: '#fca5a5', textShadow: '0 0 10px rgba(220,50,50,0.5)' }}>
            COMBAT
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'rgba(180,100,100,0.6)', fontFamily: 'EB Garamond, serif' }}>Now:</span>
          <span className="font-fantasy font-semibold" style={{ color: '#fde68a' }}>{currentCombatant?.name || '?'}</span>
          {isPlayerTurn && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-2 py-0.5 rounded-full font-fantasy text-xs badge-green">
              Your Turn
            </motion.span>
          )}
        </div>
      </div>

      {/* Initiative Tracker */}
      <InitiativeTracker
        combatants={combatants || []}
        currentTurnIndex={current_turn_index}
        round={round}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — targets + actions */}
        <div className="flex flex-col w-1/2 overflow-hidden" style={{ borderRight: '1px solid rgba(180,50,50,0.2)' }}>

          {/* Enemy targets */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(180,100,100,0.5)', fontSize: '0.65rem' }}>SELECT TARGET</div>
            {enemies.map(enemy => {
              const hpPct = Math.max(0, (enemy.hp_current / enemy.hp_max) * 100);
              const isSelected = selectedTarget === enemy.id;
              return (
                <motion.button key={enemy.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { if (isPlayerTurn && enemy.is_conscious) setSelectedTarget(enemy.id); }}
                  disabled={!isPlayerTurn || !enemy.is_conscious}
                  className="w-full p-3 rounded-xl text-left transition-all fantasy-card"
                  style={!enemy.is_conscious ? {
                    opacity: 0.3, cursor: 'not-allowed',
                    background: 'rgba(10,5,5,0.3)', border: '1px solid rgba(100,50,50,0.15)'
                  } : isSelected ? {
                    background: 'rgba(80,5,5,0.7)', border: '1px solid rgba(220,50,50,0.6)',
                    boxShadow: '0 0 16px rgba(180,30,30,0.2)'
                  } : {
                    background: 'rgba(25,8,8,0.6)', border: '1px solid rgba(180,50,50,0.2)',
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-fantasy font-medium text-sm" style={{ color: isSelected ? '#fca5a5' : '#ffb3b3' }}>
                      {enemy.name}
                    </span>
                    {!enemy.is_conscious
                      ? <span className="text-xs italic" style={{ color: '#6b7280', fontFamily: 'EB Garamond, serif' }}>💀 Defeated</span>
                      : <span className="flex items-center gap-1.5 text-xs">
                          <span style={{ color: 'rgba(147,197,253,0.7)', fontFamily: 'EB Garamond, serif' }}>AC {enemy.ac}</span>
                          {enemy.initiative_total !== undefined && (
                            <span style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>• Init {enemy.initiative_total}</span>
                          )}
                        </span>
                    }
                  </div>
                  {enemy.is_conscious && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full overflow-hidden neuro-inset">
                          <motion.div
                            className="h-full rounded-full"
                            animate={{ width: `${hpPct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                              background: hpPct > 50 ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
                                hpPct > 25 ? 'linear-gradient(90deg, #b45309, #d97706)' :
                                'linear-gradient(90deg, #7f1d1d, #dc2626)'
                            }} />
                        </div>
                        <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: '#fca5a5' }}>
                          {enemy.hp_current}/{enemy.hp_max}
                        </span>
                      </div>
                      {enemy.ai_behavior && (
                        <p className="text-xs mt-1 italic" style={{ color: 'rgba(180,100,100,0.4)', fontFamily: 'IM Fell English, serif' }}>
                          {enemy.ai_behavior}
                        </p>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Action panel */}
          {isPlayerTurn ? (
            <div className="flex-shrink-0 p-3 space-y-2"
              style={{ borderTop: '1px solid rgba(180,50,50,0.2)', background: 'rgba(10,3,3,0.85)' }}>

              {/* Action point bar */}
              <ActionPointBar
                actionsTotal={actionsPerTurn}
                actionsUsed={actionsUsed}
                bonusActionUsed={world_state?.bonus_action_used || false}
                reactionUsed={world_state?.reaction_used || false}
              />

              {/* Action tabs */}
              <div className="flex gap-1.5">
                <button onClick={() => { setAction('attack'); setSelectedSpell(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                  style={action === 'attack' ? {
                    background: 'rgba(80,5,5,0.75)', border: '1px solid rgba(220,50,50,0.55)', color: '#fca5a5',
                    boxShadow: '0 0 8px rgba(180,30,30,0.15)'
                  } : { background: 'rgba(15,5,5,0.5)', border: '1px solid rgba(180,50,50,0.15)', color: 'rgba(180,100,100,0.5)' }}>
                  ⚔️ Attack
                </button>
                {isCaster && (
                  <button onClick={() => setAction('spell')}
                    className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                    style={action === 'spell' ? {
                      background: 'rgba(50,10,90,0.75)', border: '1px solid rgba(160,80,255,0.55)', color: '#d4b3ff',
                      boxShadow: '0 0 8px rgba(130,60,220,0.15)'
                    } : { background: 'rgba(10,5,20,0.5)', border: '1px solid rgba(120,60,200,0.15)', color: 'rgba(160,100,220,0.4)' }}>
                    🔮 Spell
                  </button>
                )}
                <button onClick={() => { setAction('item'); setSelectedSpell(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                  style={action === 'item' ? {
                    background: 'rgba(10,50,20,0.7)', border: '1px solid rgba(40,160,80,0.5)', color: '#86efac'
                  } : { background: 'rgba(5,15,10,0.5)', border: '1px solid rgba(40,120,60,0.15)', color: 'rgba(80,160,100,0.4)' }}>
                  🧪 Item
                </button>
                <button onClick={onFlee}
                  className="px-2 py-2 rounded-lg text-xs font-fantasy transition-all"
                  style={{ background: 'rgba(20,15,5,0.5)', border: '1px solid rgba(200,130,20,0.25)', color: 'rgba(220,150,30,0.6)' }}>
                  🏃
                </button>
              </div>

              {/* Spell selector */}
              {action === 'spell' && (
                <div className="max-h-44 overflow-y-auto">
                  <CombatSpellSelector
                    character={character}
                    onSelectSpell={handleSelectSpell}
                    selectedSpell={selectedSpell}
                    selectedSlotLevel={selectedSpellLevel}
                    onSelectSlotLevel={setSelectedSpellLevel}
                  />
                </div>
              )}

              {/* Inline dice roller toggle */}
              <div className="flex items-center gap-2">
                <button onClick={() => setShowDice(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-fantasy transition-all px-2 py-1 rounded-lg"
                  style={showDice ? {
                    background: 'rgba(60,40,8,0.6)', border: '1px solid rgba(201,169,110,0.4)', color: '#c9a96e'
                  } : {
                    color: 'rgba(180,140,90,0.35)', border: '1px solid transparent'
                  }}>
                  <Dices className="w-3 h-3" /> {showDice ? 'Hide Dice' : 'Roll'}
                </button>
              </div>
              <AnimatePresence>
                {showDice && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <CombatDiceRoller modifier={attackMod} label="Attack Roll" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action button */}
              <motion.button onClick={handleAction} disabled={!canAct || loading || actionsRemaining === 0}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-fantasy font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={canAct && !loading ? {
                  background: 'linear-gradient(135deg, rgba(100,10,10,0.9), rgba(70,5,5,0.95))',
                  border: '1px solid rgba(220,50,50,0.6)',
                  color: '#fca5a5',
                  boxShadow: '0 0 12px rgba(180,30,30,0.2)',
                  letterSpacing: '0.05em',
                } : {
                  background: 'rgba(20,10,10,0.5)',
                  border: '1px solid rgba(100,50,50,0.2)',
                  color: 'rgba(150,80,80,0.4)',
                  cursor: 'not-allowed',
                }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                {loading ? 'Resolving...' :
                  actionsRemaining === 0 ? 'No Actions Left' :
                  !selectedTarget ? 'Select a Target' :
                  action === 'spell' && !selectedSpell ? 'Select a Spell' :
                  action === 'spell' ? `Cast ${selectedSpell}` :
                  `Strike ${combatants?.find(c => c.id === selectedTarget)?.name || ''}`}
              </motion.button>
            </div>
          ) : (
            <div className="flex-shrink-0 p-3 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(180,50,50,0.15)', background: 'rgba(10,3,3,0.7)' }}>
              <span className="text-xs italic" style={{ color: 'rgba(180,100,100,0.5)', fontFamily: 'EB Garamond, serif' }}>
                ⚔️ {currentCombatant?.name}'s turn...
              </span>
              <button onClick={onNextTurn} disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-fantasy flex items-center gap-1.5 btn-fantasy">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                Process Turn
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Visual Combat Log */}
        <div className="flex flex-col w-1/2 overflow-hidden">
          <CombatLog logEntries={log_entries || []} player={player} />
        </div>
      </div>
    </div>
  );
}