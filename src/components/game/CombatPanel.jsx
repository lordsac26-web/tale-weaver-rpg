import React, { useState } from 'react';
import { Heart, Loader2, SkipForward, Scroll, Swords, Shield, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod, PROFICIENCY_BY_LEVEL } from './gameData';
import CombatSpellSelector from './CombatSpellSelector';
import { SPELL_DETAILS } from './spellData';
import CombatDiceRoller from './CombatDiceRoller';

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
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 combat-active"
        style={{
          background: 'linear-gradient(90deg, rgba(80,5,5,0.9), rgba(50,5,5,0.95))',
          borderBottom: '1px solid rgba(180,30,30,0.4)',
        }}>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4" style={{ color: '#fca5a5' }} />
          <span className="font-fantasy font-bold text-sm tracking-widest" style={{ color: '#fca5a5', textShadow: '0 0 10px rgba(220,50,50,0.5)' }}>
            COMBAT — Round {round}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'rgba(180,100,100,0.6)', fontFamily: 'EB Garamond, serif' }}>Turn:</span>
          <span className="font-fantasy font-semibold" style={{ color: '#fde68a' }}>{currentCombatant?.name || '?'}</span>
          {isPlayerTurn && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-2 py-0.5 rounded-full font-fantasy text-xs badge-green">
              Your Turn
            </motion.span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — targets + actions */}
        <div className="flex flex-col w-1/2 overflow-hidden" style={{ borderRight: '1px solid rgba(180,50,50,0.2)' }}>

          {/* Initiative strip */}
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,50,50,0.15)', background: 'rgba(15,5,5,0.5)' }}>
            <div className="flex gap-1.5 flex-wrap">
              {(initiative_order || []).map((c, i) => {
                const combatant = combatants?.find(cb => cb.id === c.id);
                const isActive = i === current_turn_index;
                const isDead = combatant && !combatant.is_conscious;
                return (
                  <div key={c.id} className="px-2 py-0.5 rounded text-xs font-fantasy transition-all"
                    style={isDead ? { opacity: 0.3, textDecoration: 'line-through', color: '#6b7280' } :
                      isActive ? { background: 'rgba(100,65,5,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040', boxShadow: '0 0 8px rgba(201,169,110,0.2)' } :
                      combatant?.type === 'player' ? { background: 'rgba(10,30,70,0.5)', border: '1px solid rgba(60,100,220,0.3)', color: '#93c5fd' } :
                      { background: 'rgba(50,5,5,0.4)', border: '1px solid rgba(180,30,30,0.25)', color: '#fca5a5' }}>
                    {c.name}
                  </div>
                );
              })}
            </div>
          </div>

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
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-fantasy font-medium text-sm" style={{ color: isSelected ? '#fca5a5' : '#ffb3b3' }}>
                      {enemy.name}
                    </span>
                    {!enemy.is_conscious
                      ? <span className="text-xs italic" style={{ color: '#6b7280', fontFamily: 'EB Garamond, serif' }}>Defeated</span>
                      : <span className="flex items-center gap-1 text-xs" style={{ color: '#93c5fd' }}>
                          <Shield className="w-3 h-3" /> {enemy.ac}
                        </span>
                    }
                  </div>
                  {enemy.is_conscious && (
                    <div className="flex items-center gap-2">
                      <Heart className="w-3 h-3 flex-shrink-0" style={{ color: '#dc2626' }} />
                      <div className="flex-1 h-2 rounded-full overflow-hidden neuro-inset">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${hpPct}%`,
                            background: hpPct > 50 ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
                              hpPct > 25 ? 'linear-gradient(90deg, #b45309, #d97706)' :
                              'linear-gradient(90deg, #7f1d1d, #dc2626)'
                          }} />
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: '#fca5a5' }}>{enemy.hp_current}/{enemy.hp_max}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Action panel */}
          {isPlayerTurn ? (
            <div className="flex-shrink-0 p-3 space-y-2.5"
              style={{ borderTop: '1px solid rgba(180,50,50,0.2)', background: 'rgba(10,3,3,0.85)' }}>
              {/* Actions remaining */}
              {actionsPerTurn > 1 && (
                <div className="flex items-center gap-2">
                  <span className="font-fantasy text-xs" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>ACTIONS:</span>
                  {Array.from({ length: actionsPerTurn }).map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border"
                      style={i < actionsRemaining ? {
                        background: '#d97706', border: '1px solid rgba(217,119,6,0.8)',
                        boxShadow: '0 0 6px rgba(217,119,6,0.4)'
                      } : {
                        background: 'rgba(30,20,10,0.8)', border: '1px solid rgba(100,70,20,0.3)'
                      }} />
                  ))}
                  <span className="text-xs font-fantasy" style={{ color: '#f0c040' }}>{actionsRemaining} left</span>
                </div>
              )}

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
                <div className="max-h-52 overflow-y-auto">
                  <CombatSpellSelector
                    character={character}
                    onSelectSpell={handleSelectSpell}
                    selectedSpell={selectedSpell}
                    selectedSlotLevel={selectedSpellLevel}
                    onSelectSlotLevel={setSelectedSpellLevel}
                  />
                </div>
              )}

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
                {currentCombatant?.name}'s turn...
              </span>
              <button onClick={onNextTurn} disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-fantasy flex items-center gap-1.5 btn-fantasy">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                Process Turn
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Combat Log */}
        <div className="flex flex-col w-1/2 overflow-hidden">
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(180,50,50,0.15)', background: 'rgba(15,5,5,0.5)' }}>
            <div className="font-fantasy text-xs tracking-widest flex items-center gap-1.5" style={{ color: 'rgba(180,100,100,0.5)', fontSize: '0.65rem' }}>
              <Scroll className="w-3 h-3" /> COMBAT LOG
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            <AnimatePresence initial={false}>
              {(log_entries || []).slice().reverse().map((entry, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs py-2 px-3 rounded-lg border-l-2"
                  style={entry.hit === true ? {
                    borderLeft: '2px solid rgba(201,169,110,0.6)',
                    background: 'rgba(50,35,5,0.4)',
                    color: '#fde68a',
                  } : entry.hit === false ? {
                    borderLeft: '2px solid rgba(100,60,20,0.4)',
                    background: 'rgba(15,10,5,0.3)',
                    color: 'rgba(180,150,100,0.5)',
                  } : {
                    borderLeft: '2px solid rgba(80,60,200,0.4)',
                    background: 'rgba(15,10,30,0.3)',
                    color: 'rgba(147,197,253,0.7)',
                  }}
                  onAnimationComplete={() => {
                    if (i === 0 && entry.hit === true && navigator.vibrate) navigator.vibrate([20, 10, 20]);
                  }}>
                  {entry.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Player HP */}
          {player && (
            <div className="flex-shrink-0 px-3 py-2.5" style={{ borderTop: '1px solid rgba(180,50,50,0.15)', background: 'rgba(10,3,3,0.6)' }}>
              <div className="flex items-center gap-2">
                <Heart className="w-3 h-3 flex-shrink-0" style={{ color: '#22c55e' }} />
                <div className="flex-1 h-2 rounded-full overflow-hidden neuro-inset">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, (player.hp_current / player.hp_max) * 100)}%`,
                      background: (player.hp_current / player.hp_max) > 0.5 ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
                        (player.hp_current / player.hp_max) > 0.25 ? 'linear-gradient(90deg, #b45309, #d97706)' :
                        'linear-gradient(90deg, #7f1d1d, #dc2626)'
                    }} />
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: '#86efac' }}>{player.hp_current}/{player.hp_max}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}