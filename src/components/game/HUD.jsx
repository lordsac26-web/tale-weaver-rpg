import React from 'react';
import { Shield, Heart, Zap, Star, MapPin, Clock } from 'lucide-react';
import { CONDITIONS, calcStatMod, calcModDisplay } from './gameData';

export default function HUD({ character, session }) {
  if (!character) return null;

  const hpPct = Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100));
  const hpColor = hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500';

  const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000];
  const currentXP = character.xp || 0;
  const level = character.level || 1;
  const xpForNext = xpThresholds[level] || xpThresholds[xpThresholds.length - 1];
  const xpForCurrent = xpThresholds[level - 1] || 0;
  const xpPct = xpForNext > xpForCurrent ? Math.min(100, ((currentXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100) : 100;

  return (
    <div className="bg-slate-900/95 border-b border-slate-700/60 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-4">
        {/* Character Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {character.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-amber-200 text-sm truncate">{character.name}</div>
            <div className="text-amber-400/60 text-xs">Lv.{character.level} {character.race} {character.class}</div>
          </div>
        </div>

        {/* HP Bar */}
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="w-24">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-300 font-medium">{character.hp_current}</span>
              <span className="text-slate-500">/{character.hp_max}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${hpColor} transition-all duration-500`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="w-24">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-300 font-medium">{currentXP}</span>
              <span className="text-slate-500">XP</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* AC */}
        <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-blue-300 font-bold text-sm">{character.armor_class}</span>
          <span className="text-slate-500 text-xs">AC</span>
        </div>

        {/* Location & Time */}
        {session && (
          <div className="flex items-center gap-3 ml-auto text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {session.current_location || 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {session.time_of_day}, {session.season}
            </span>
          </div>
        )}

        {/* Active Conditions */}
        {(character.conditions || []).length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {character.conditions.map((cond, i) => {
              const condName = typeof cond === 'string' ? cond : cond.name;
              const condData = CONDITIONS[condName?.toLowerCase()] || {};
              return (
                <span key={i} title={condData.description || condName}
                  className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 ${condData.color || 'text-slate-300'}`}>
                  {condData.icon || '⚫'} {condName}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}