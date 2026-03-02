import React, { useRef, useEffect } from 'react';
import { Loader2, Scroll } from 'lucide-react';

const RISK_COLORS = {
  low: 'border-green-600/40 hover:border-green-500/80 hover:bg-green-900/20',
  medium: 'border-yellow-600/40 hover:border-yellow-500/80 hover:bg-yellow-900/20',
  high: 'border-orange-600/40 hover:border-orange-500/80 hover:bg-orange-900/20',
  extreme: 'border-red-600/40 hover:border-red-500/80 hover:bg-red-900/20'
};

const RISK_BADGE = {
  low: 'bg-green-900/50 text-green-300',
  medium: 'bg-yellow-900/50 text-yellow-300',
  high: 'bg-orange-900/50 text-orange-300',
  extreme: 'bg-red-900/50 text-red-300'
};

export default function StoryPanel({ narrative, choices, loading, onChoice, customInput, setCustomInput, onCustomSubmit }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrative, loading]);

  return (
    <div className="flex flex-col h-full">
      {/* Narrative Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        {narrative.map((entry, i) => (
          <div key={i} className="animate-fade-in">
            {entry.type === 'narration' && (
              <div className="prose prose-invert max-w-none">
                <p className="text-amber-100/90 leading-8 text-base font-serif whitespace-pre-wrap">{entry.text}</p>
              </div>
            )}
            {entry.type === 'player_action' && (
              <div className="flex justify-end">
                <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl px-4 py-2 max-w-md text-blue-200 text-sm italic">
                  You: {entry.text}
                </div>
              </div>
            )}
            {entry.type === 'roll_result' && (
              <div className="flex justify-center">
                <div className={`px-4 py-2 rounded-xl border text-sm font-medium ${
                  entry.success ? 'bg-green-900/30 border-green-700/40 text-green-300' : 'bg-red-900/30 border-red-700/40 text-red-300'
                }`}>
                  🎲 {entry.text}
                </div>
              </div>
            )}
            {entry.type === 'combat_start' && (
              <div className="text-center py-2">
                <div className="inline-block bg-red-900/40 border border-red-700/60 text-red-300 font-bold px-6 py-2 rounded-xl text-sm tracking-widest uppercase">
                  ⚔️ Combat Begins! ⚔️
                </div>
              </div>
            )}
            {entry.type === 'xp_gain' && (
              <div className="text-center">
                <span className="text-amber-400 text-sm font-medium">✨ {entry.text}</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-amber-400/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm italic">The story unfolds...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Choices */}
      {!loading && choices.length > 0 && (
        <div className="border-t border-slate-700/50 p-4 space-y-2 bg-slate-900/80">
          <div className="text-amber-400/60 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
            <Scroll className="w-3 h-3" /> What do you do?
          </div>
          {choices.map((choice, i) => (
            <button key={i} onClick={() => onChoice(i)}
              className={`w-full text-left p-4 rounded-xl border bg-slate-800/40 transition-all duration-200 ${RISK_COLORS[choice.risk_level || 'low']}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-amber-600/70 font-bold text-sm flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-amber-100 text-sm leading-relaxed">{choice.text}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {choice.skill_check && choice.dc && (
                    <span className={`text-xs px-2 py-1 rounded-full border border-transparent ${RISK_BADGE[choice.risk_level || 'medium']}`}>
                      {choice.skill_check} DC {choice.dc}
                    </span>
                  )}
                  {choice.risk_level && (
                    <span className={`text-xs px-2 py-1 rounded-full ${RISK_BADGE[choice.risk_level]}`}>
                      {choice.risk_level}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Custom input */}
          <div className="flex gap-2 mt-3">
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && customInput.trim() && onCustomSubmit()}
              placeholder="Or type your own action..."
              className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-amber-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-600/50"
            />
            <button onClick={onCustomSubmit} disabled={!customInput.trim()}
              className="px-4 py-2 bg-amber-800/60 hover:bg-amber-700 border border-amber-600/50 rounded-xl text-amber-200 text-sm transition-all disabled:opacity-40">
              Do it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}