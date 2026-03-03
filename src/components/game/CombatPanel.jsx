import React, { useState } from 'react';
import { Sword, Shield, Zap, Heart, Loader2, SkipForward, Scroll } from 'lucide-react';
import { calcStatMod } from './gameData';

const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger'];

// How many actions per turn based on class/level/features
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

  if (!combat) return null;

  const { combatants, initiative_order, log_entries, round, current_turn_index, world_state } = combat;
  const enemies = (combatants || []).filter(c => c.type === 'enemy');
  const player = (combatants || []).find(c => c.type === 'player');
  const currentCombatant = combatants?.[current_turn_index];
  const isPlayerTurn = currentCombatant?.type === 'player';
  const isCaster = SPELLCASTING_CLASSES.includes(character?.class);
  const spells = (character?.spells_known || []).filter(s => s && s.length > 0);
  const actionsPerTurn = getActionsPerTurn(character);
  const actionsUsed = world_state?.actions_used_this_turn || 0;
  const actionsRemaining = Math.max(0, actionsPerTurn - actionsUsed);

  const handleAction = () => {
    if (!selectedTarget) return;
    if (action === 'spell' && selectedSpell) {
      onPlayerAttack(selectedTarget, 'spell', { name: selectedSpell, damage_dice: '2d6' });
    } else if (action === 'attack') {
      const weapon = character?.equipped?.weapon || { damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0, type: 'melee' };
      onPlayerAttack(selectedTarget, 'attack', weapon);
    } else {
      onPlayerAttack(selectedTarget, action);
    }
  };

  const canAct = isPlayerTurn && selectedTarget && (action !== 'spell' || selectedSpell);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 overflow-hidden">
      {/* Header */}
      <div className="bg-red-900/30 border-b border-red-700/40 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sword className="w-4 h-4 text-red-400" />
          <span className="text-red-300 font-bold text-sm">COMBAT — Round {round}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Turn:</span>
          <span className="text-amber-300 font-medium">{currentCombatant?.name || '?'}</span>
          {isPlayerTurn && <span className="bg-green-800/60 text-green-300 px-2 py-0.5 rounded-full">Your Turn</span>}
        </div>
      </div>

      {/* Main layout: left = action panel, right = log */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — targets + actions */}
        <div className="flex flex-col w-1/2 border-r border-slate-700/40 overflow-hidden">

          {/* Initiative strip */}
          <div className="px-3 py-2 border-b border-slate-700/30 flex-shrink-0">
            <div className="flex gap-1.5 flex-wrap">
              {(initiative_order || []).map((c, i) => {
                const combatant = combatants?.find(cb => cb.id === c.id);
                const isActive = i === current_turn_index;
                const isDead = combatant && !combatant.is_conscious;
                return (
                  <div key={c.id} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    isDead ? 'opacity-30 line-through text-slate-500' :
                    isActive ? 'bg-amber-900/40 border border-amber-500 text-amber-200' :
                    combatant?.type === 'player' ? 'bg-blue-900/20 border border-blue-700/40 text-blue-300' :
                    'bg-red-900/10 border border-red-700/30 text-red-400'
                  }`}>
                    {c.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enemies list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Select Target</div>
            {enemies.map(enemy => (
              <button key={enemy.id}
                onClick={() => { if (isPlayerTurn && enemy.is_conscious) setSelectedTarget(enemy.id); }}
                disabled={!isPlayerTurn || !enemy.is_conscious}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  !enemy.is_conscious ? 'opacity-40 cursor-not-allowed border-slate-700/30 bg-slate-800/10' :
                  selectedTarget === enemy.id ? 'border-red-500 bg-red-900/30' :
                  isPlayerTurn ? 'border-slate-700/50 bg-slate-800/30 hover:border-red-600/60 cursor-pointer' :
                  'border-slate-700/50 bg-slate-800/20 cursor-not-allowed opacity-60'
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm text-red-200">{enemy.name}</span>
                  {!enemy.is_conscious
                    ? <span className="text-xs text-slate-500 italic">Defeated</span>
                    : <span className="text-xs text-blue-300">AC {enemy.ac}</span>
                  }
                </div>
                {enemy.is_conscious && (
                  <div className="flex items-center gap-2">
                    <Heart className="w-3 h-3 text-red-400 flex-shrink-0" />
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full transition-all rounded-full ${
                        (enemy.hp_current / enemy.hp_max) > 0.5 ? 'bg-green-500' :
                        (enemy.hp_current / enemy.hp_max) > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} style={{ width: `${Math.max(0, (enemy.hp_current / enemy.hp_max) * 100)}%` }} />
                    </div>
                    <span className="text-red-300 text-xs font-mono">{enemy.hp_current}/{enemy.hp_max}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Action panel */}
          {isPlayerTurn ? (
            <div className="border-t border-slate-700/40 p-3 space-y-2.5 bg-slate-900/80 flex-shrink-0">
              {/* Actions remaining indicator */}
              {actionsPerTurn > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Actions:</span>
                  {Array.from({ length: actionsPerTurn }).map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full border ${i < actionsRemaining ? 'bg-amber-400 border-amber-500' : 'bg-slate-700 border-slate-600'}`} />
                  ))}
                  <span className="text-xs text-amber-300 ml-1">{actionsRemaining} left</span>
                </div>
              )}
              {/* Action type tabs */}
              <div className="flex gap-1.5">
                <button onClick={() => { setAction('attack'); setSelectedSpell(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs border capitalize transition-all ${action === 'attack' ? 'border-red-500 bg-red-900/30 text-red-200' : 'border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
                  ⚔️ Attack
                </button>
                {isCaster && (
                  <button onClick={() => setAction('spell')}
                    className={`flex-1 py-1.5 rounded-lg text-xs border capitalize transition-all ${action === 'spell' ? 'border-purple-500 bg-purple-900/30 text-purple-200' : 'border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
                    🔮 Spell
                  </button>
                )}
                <button onClick={() => { setAction('item'); setSelectedSpell(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs border capitalize transition-all ${action === 'item' ? 'border-green-500 bg-green-900/30 text-green-200' : 'border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
                  🧪 Item
                </button>
                <button onClick={onFlee} className="px-2 py-1.5 rounded-lg text-xs border border-orange-700/50 text-orange-400 hover:bg-orange-900/20">
                  🏃
                </button>
              </div>

              {/* Spell selector */}
              {action === 'spell' && (
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {spells.length === 0 ? (
                    <div className="text-slate-500 text-xs text-center py-2">No spells known</div>
                  ) : spells.map(spell => (
                    <button key={spell} onClick={() => setSelectedSpell(spell)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        selectedSpell === spell ? 'border-purple-500 bg-purple-900/30 text-purple-200' : 'border-slate-700/40 text-slate-300 hover:border-purple-700/50'
                      }`}>
                      {spell}
                    </button>
                  ))}
                </div>
              )}

              {/* Attack button */}
              <button onClick={handleAction} disabled={!canAct || loading || actionsRemaining === 0}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  canAct ? 'bg-red-800/70 hover:bg-red-700 border border-red-600/50 text-red-200' : 'bg-slate-800/40 border border-slate-700/30 text-slate-500 cursor-not-allowed'
                }`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sword className="w-4 h-4" />}
                {loading ? 'Attacking...' :
                  !selectedTarget ? 'Select a target' :
                  action === 'spell' && !selectedSpell ? 'Select a spell' :
                  action === 'spell' ? `Cast ${selectedSpell}` :
                  `Attack ${combatants?.find(c => c.id === selectedTarget)?.name || ''}`}
              </button>
            </div>
          ) : (
            <div className="border-t border-slate-700/40 p-3 bg-slate-900/80 flex items-center justify-between flex-shrink-0">
              <span className="text-slate-400 text-xs italic">{currentCombatant?.name}'s turn...</span>
              <button onClick={onNextTurn} disabled={loading}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-xs flex items-center gap-1.5">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                Process Turn
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Combat Log */}
        <div className="flex flex-col w-1/2 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/30 flex-shrink-0">
            <div className="text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Scroll className="w-3 h-3" /> Combat Log
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {(log_entries || []).slice().reverse().map((entry, i) => (
              <div key={i} className={`text-xs py-1.5 px-2 rounded border-l-2 ${
                entry.hit === true ? 'border-amber-500 text-amber-200 bg-amber-900/10' :
                entry.hit === false ? 'border-slate-600 text-slate-400 bg-slate-800/20' :
                'border-blue-700/40 text-blue-300 bg-blue-900/10'
              }`}>
                {entry.text}
              </div>
            ))}
          </div>
          {/* Player HP mini bar */}
          {player && (
            <div className="border-t border-slate-700/30 px-3 py-2 bg-slate-900/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Heart className="w-3 h-3 text-green-400 flex-shrink-0" />
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    (player.hp_current / player.hp_max) > 0.5 ? 'bg-green-500' :
                    (player.hp_current / player.hp_max) > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${Math.max(0, (player.hp_current / player.hp_max) * 100)}%` }} />
                </div>
                <span className="text-green-300 text-xs font-mono">{player.hp_current}/{player.hp_max}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}