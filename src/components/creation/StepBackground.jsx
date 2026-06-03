import React from 'react';
import { BACKGROUNDS, ALIGNMENTS } from '@/components/game/gameData';
import AlignmentRadar from '@/components/game/AlignmentRadar';

const BG_ICONS = {
  Acolyte: '⛪', Criminal: '🗡️', 'Folk Hero': '🌾', Noble: '👑', Outlander: '🌲',
  Sage: '📚', Soldier: '⚔️', Charlatan: '🎭', Hermit: '🕯️', Sailor: '⚓',
  Spy: '🕵️', Entertainer: '🎪', 'Guild Artisan': '🔨', Urchin: '🏚️',
  Pirate: '🏴‍☠️', Knight: '🛡️', Gladiator: '🏟️', 'Haunted One': '👻',
  'Far Traveler': '🗺️', Anthropologist: '🔭', 'City Watch': '⚖️',
  'Mercenary Veteran': '💰', 'Clan Crafter': '⚒️', Investigator: '🔍',
  Archaeologist: '🏺', 'Witchlight Hand': '✨', Ruined: '💀',
};

const alignmentToScores = (alignment) => {
  const law_chaos = alignment?.includes('Lawful') ? 15 : alignment?.includes('Chaotic') ? -15 : 0;
  const good_evil = alignment?.includes('Good') ? 15 : alignment?.includes('Evil') ? -15 : 0;
  return { good_evil, law_chaos, sanity: 0 };
};

const scoreToAlignment = (scores = {}) => {
  const order = (scores.law_chaos || 0) >= 10 ? 'Lawful' : (scores.law_chaos || 0) <= -10 ? 'Chaotic' : 'Neutral';
  const moral = (scores.good_evil || 0) >= 10 ? 'Good' : (scores.good_evil || 0) <= -10 ? 'Evil' : 'Neutral';
  return order === 'Neutral' && moral === 'Neutral' ? 'True Neutral' : `${order} ${moral}`;
};

export default function StepBackground({ character, set }) {
  const selected = BACKGROUNDS.find(b => b.name === character.background);
  const scores = character.alignment_scores || alignmentToScores(character.alignment);

  const setAlignment = (alignment) => {
    const nextScores = character.alignment_mode === 'dynamic' ? alignmentToScores(alignment) : scores;
    set('alignment', alignment);
    if (character.alignment_mode === 'dynamic') set('alignment_scores', nextScores);
  };

  const setMode = (mode) => {
    set('alignment_mode', mode);
    if (mode === 'dynamic') set('alignment_scores', alignmentToScores(character.alignment));
  };

  const setScore = (key, value) => {
    const nextScores = { ...scores, [key]: Number(value) };
    set('alignment_scores', nextScores);
    set('alignment', scoreToAlignment(nextScores));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Background & Alignment</h2>
        <p className="text-amber-400/50 text-sm">Choose your history, starting alignment, and whether future choices can change your moral path.</p>
      </div>

      <div className="bg-slate-800/40 border border-amber-700/25 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMode('static')} className={`px-3 py-2 rounded-lg border text-sm ${character.alignment_mode !== 'dynamic' ? 'bg-amber-900/40 border-amber-500 text-amber-200' : 'bg-slate-900/40 border-slate-700 text-slate-400'}`}>Static Alignment</button>
          <button onClick={() => setMode('dynamic')} className={`px-3 py-2 rounded-lg border text-sm ${character.alignment_mode === 'dynamic' ? 'bg-purple-900/40 border-purple-500 text-purple-200' : 'bg-slate-900/40 border-slate-700 text-slate-400'}`}>Dynamic Alignment</button>
        </div>

        <div>
          <div className="text-amber-400/80 text-xs uppercase tracking-widest mb-2">Starting Alignment</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALIGNMENTS.map(alignment => (
              <button key={alignment} onClick={() => setAlignment(alignment)}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${character.alignment === alignment ? 'border-amber-500 bg-amber-900/30 text-amber-100' : 'border-slate-700 bg-slate-900/30 text-slate-400 hover:border-amber-700/60'}`}>
                {alignment}
              </button>
            ))}
          </div>
        </div>

        {character.alignment_mode === 'dynamic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1 text-slate-400"><span>Evil</span><span>Good</span></div>
                <input type="range" min="-25" max="25" value={scores.good_evil || 0} onChange={(e) => setScore('good_evil', e.target.value)} className="w-full accent-amber-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 text-slate-400"><span>Chaotic</span><span>Lawful</span></div>
                <input type="range" min="-25" max="25" value={scores.law_chaos || 0} onChange={(e) => setScore('law_chaos', e.target.value)} className="w-full accent-purple-500" />
              </div>
              <p className="text-xs text-slate-500">A hidden stability scale also tracks logical vs. erratic problem solving during the campaign, but the exact value is intentionally obscured.</p>
            </div>
            <AlignmentRadar character={character} compact />
          </div>
        )}
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