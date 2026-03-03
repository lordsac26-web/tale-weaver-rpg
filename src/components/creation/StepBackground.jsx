import React from 'react';
import { BACKGROUNDS, ALIGNMENTS } from '@/components/game/gameData';

const BG_ICONS = {
  Acolyte: '⛪', Criminal: '🗡️', 'Folk Hero': '🌾', Noble: '👑', Outlander: '🌲',
  Sage: '📚', Soldier: '⚔️', Charlatan: '🎭', Hermit: '🕯️', Sailor: '⚓'
};

export default function StepBackground({ character, set }) {
  const selected = BACKGROUNDS.find(b => b.name === character.background);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Background</h2>
        <p className="text-amber-400/50 text-sm">Your background grants bonus skills, equipment, and roleplay hooks.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BACKGROUNDS.map(bg => (
          <button key={bg.name} onClick={() => set('background', bg.name)}
            className={`p-4 rounded-xl border text-left transition-all group ${character.background === bg.name ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700/50 bg-slate-800/30 hover:border-blue-700/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{BG_ICONS[bg.name] || '🎒'}</span>
              <span className="font-bold text-blue-200">{bg.name}</span>
            </div>
            <div className="text-blue-400/70 text-xs mb-2">✦ {bg.feature}</div>
            <div className="text-slate-400 text-xs">Skills: {bg.skills.join(', ')}</div>
            <div className="text-slate-500 text-xs mt-1">Gear: {bg.equipment.slice(0, 2).join(', ')}{bg.equipment.length > 2 ? '...' : ''}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-blue-900/10 border border-blue-700/30 rounded-xl p-4 mt-2">
          <div className="font-bold text-blue-200 mb-1">{selected.name}</div>
          <div className="text-blue-400/80 text-sm mb-2">Feature: <span className="text-blue-300">{selected.feature}</span></div>
          <div className="text-sm text-slate-400">
            <span className="text-slate-300">Skills: </span>{selected.skills.join(', ')}<br />
            <span className="text-slate-300">Equipment: </span>{selected.equipment.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}