import React, { useState } from 'react';
import { Sword, Shield, Zap, Heart, ChevronRight, Loader2, SkipForward } from 'lucide-react';
import { calcStatMod, calcModDisplay } from './gameData';

export default function CombatPanel({ combat, character, onPlayerAttack, onNextTurn, onFlee, loading }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [action, setAction] = useState('attack');

  if (!combat) return null;

  const { combatants, initiative_order, log_entries, round, current_turn_index } = combat;
  const enemies = (combatants || []).filter(c => c.type === 'enemy');
  const player = (combatants || []).find(c => c.type === 'player');
  const currentCombatant = combatants?.[current_turn_index];
  const isPlayerTurn = currentCombatant?.type === 'player';

  return (
    <div className="flex flex-col h-full bg-slate-900/95">
      {/* Round Header */}
      <div className="bg-red-900/30 border-b border-red-700/40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-red-400" />
          <span className="text-red-300 font-bold">COMBAT - Round {round}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Turn:</span>
          <span className="text-amber-300 font-medium">{currentCombatant?.name || '?'}</span>
          {isPlayerTurn && <span className="bg-green-800/60 text-green-300 text-xs px-2 py-0.5 rounded-full">Your Turn</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Initiative Order */}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Initiative Order</div>
          <div className="flex gap-2 flex-wrap">
            {(initiative_order || []).map((c, i) => {
              const combatant = combatants?.find(cb => cb.id === c.id);
              const isActive = i === current_turn_index;
              const isDead = combatant && !combatant.is_conscious;
              return (
                <div key={c.id} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isDead ? 'border-slate-700/30 bg-slate-800/20 opacity-40 line-through text-slate-500' :
                  isActive ? 'border-amber-500 bg-amber-900/30 text-amber-200' :
                  combatant?.type === 'player' ? 'border-blue-700/50 bg-blue-900/20 text-blue-300' :
                  'border-red-700/30 bg-red-900/10 text-red-400'
                }`}>
                  {c.name} ({c.initiative})
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemies */}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Enemies</div>
          <div className="space-y-2">
            {enemies.map(enemy => (
              <button key={enemy.id} onClick={() => setSelectedTarget(enemy.id)} disabled={!isPlayerTurn || !enemy.is_conscious}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  !enemy.is_conscious ? 'opacity-40 cursor-not-allowed border-slate-700/30' :
                  selectedTarget === enemy.id ? 'border-red-500 bg-red-900/30' :
                  'border-slate-700/50 bg-slate-800/30 hover:border-red-700/50'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-red-200 text-sm">{enemy.name}</span>
                  {!enemy.is_conscious && <span className="text-xs text-slate-500">Defeated</span>}
                </div>
                {enemy.is_conscious && (
                  <div className="flex items-center gap-2">
                    <Heart className="w-3 h-3 text-red-400" />
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(0, (enemy.hp_current / enemy.hp_max) * 100)}%` }} />
                    </div>
                    <span className="text-red-300 text-xs">{enemy.hp_current}/{enemy.hp_max}</span>
                    <Shield className="w-3 h-3 text-blue-400 ml-1" />
                    <span className="text-blue-300 text-xs">{enemy.ac}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Combat Log */}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Combat Log</div>
          <div className="bg-slate-800/40 rounded-xl p-3 space-y-1 max-h-48 overflow-y-auto">
            {(log_entries || []).slice(-10).reverse().map((entry, i) => (
              <div key={i} className={`text-xs py-1 border-b border-slate-700/30 last:border-0 ${
                entry.hit ? 'text-amber-200' : entry.hit === false ? 'text-slate-400' : 'text-slate-300'
              }`}>
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Panel */}
      {isPlayerTurn && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-900/80 space-y-3">
          <div className="flex gap-2">
            {['attack', 'spell', 'item'].map(a => (
              <button key={a} onClick={() => setAction(a)}
                className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition-all ${action === a ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-amber-700/50'}`}>
                {a === 'attack' ? '⚔️' : a === 'spell' ? '🔮' : '🧪'} {a}
              </button>
            ))}
            <button onClick={onFlee} className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-orange-700/50 text-orange-400 hover:bg-orange-900/20">
              🏃 Flee
            </button>
          </div>

          {selectedTarget ? (
            <button onClick={() => onPlayerAttack(selectedTarget, action)} disabled={loading}
              className="w-full py-3 bg-red-800/60 hover:bg-red-700 border border-red-600/50 rounded-xl text-red-200 font-bold flex items-center justify-center gap-2 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sword className="w-4 h-4" />}
              {loading ? 'Attacking...' : `Attack ${combatants?.find(c => c.id === selectedTarget)?.name || ''}`}
            </button>
          ) : (
            <div className="text-center text-slate-500 text-sm py-2">Select a target above</div>
          )}
        </div>
      )}

      {!isPlayerTurn && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-900/80 flex items-center justify-between">
          <span className="text-slate-400 text-sm">{currentCombatant?.name}'s turn...</span>
          <button onClick={onNextTurn} disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-200 text-sm flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
            Process Turn
          </button>
        </div>
      )}
    </div>
  );
}