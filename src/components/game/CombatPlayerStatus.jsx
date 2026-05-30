import React from 'react';
import { Swords, Shield, Heart } from 'lucide-react';

/**
 * Compact player status display for the CombatPanel.
 * Shows HP, AC, and current turn state.
 */
export default function CombatPlayerStatus({ character, combat }) {
  if (!character) return null;

  const hpPercent = Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100));
  const hpColor = hpPercent > 60 ? '#22c55e' : hpPercent > 30 ? '#eab308' : '#dc2626';

  return (
    <div className="p-3 rounded-lg" style={{ 
      background: 'rgba(5, 8, 15, 0.4)', 
      border: '1px solid rgba(80, 100, 180, 0.15)'
    }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0" 
          style={{ 
            backgroundImage: character.portrait ? `url(${character.portrait})` : 'none',
            backgroundColor: '#1a0e06',
            border: '2px solid rgba(201,169,110,0.5)'
          }}>
          {!character.portrait && (
            <span className="font-fantasy text-sm self-center text-center text-blue-300">
              {character.name?.slice(0,2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="font-fantasy text-sm font-bold" style={{ color: '#f0c040' }}>
            {character.name}
          </div>
          <div className="text-xs" style={{ color: 'rgba(232,213,183,0.6)' }}>
            Level {character.level} {character.race} {character.class}
          </div>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="font-fantasy font-bold flex items-center gap-1" style={{ color: '#fca5a5' }}>
            <Heart className="w-3 h-3" /> HP
          </span>
          <span className="font-mono" style={{ color: '#fca5a5' }}>
            {character.hp_current} / {character.hp_max}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-900/70 overflow-hidden">
          <div 
            className="h-full transition-all duration-300"
            style={{ 
              width: `${hpPercent}%`,
              background: `linear-gradient(90deg, ${hpColor}, ${hpColor}dd)`
            }}
          />
        </div>
      </div>

      {/* AC & Speed */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" style={{ color: '#93c5fd' }} />
          <span style={{ color: 'rgba(232,213,183,0.7)' }}>AC:</span>
          <span className="font-fantasy font-bold" style={{ color: '#93c5fd' }}>
            {character.armor_class}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Swords className="w-3 h-3" style={{ color: '#fbbf24' }} />
          <span style={{ color: 'rgba(232,213,183,0.7)' }}>Speed:</span>
          <span className="font-fantasy" style={{ color: '#fbbf24' }}>
            {character.speed || 30}ft
          </span>
        </div>
      </div>
    </div>
  );
}