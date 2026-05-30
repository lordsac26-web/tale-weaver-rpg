import React from 'react';
import { TrendingUp, Award } from 'lucide-react';

const COMMON_FEATS = [
  { name: 'Lucky', desc: '3 luck points per long rest - reroll d20s or force enemy rerolls' },
  { name: 'Alert', desc: '+5 Initiative, cannot be surprised, hidden attackers get no advantage' },
  { name: 'Tough', desc: '+2 HP per level (retroactive)' },
  { name: 'War Caster', desc: 'Advantage on Concentration saves, cast spells as opportunity attacks' },
  { name: 'Mobile', desc: '+10 speed, Dash ignores difficult terrain, no opportunity attacks after melee' },
  { name: 'Sharpshooter', desc: '-5 attack / +10 damage, ignore half/¾ cover, no long range disadvantage' },
  { name: 'Great Weapon Master', desc: '-5 attack / +10 damage, bonus attack on crit/kill' },
  { name: 'Resilient', desc: 'Pick a stat: +1 to that stat and gain saving throw proficiency' },
  { name: 'Observant', desc: '+5 passive Perception/Investigation, read lips, +1 INT or WIS' },
];

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

export default function StepASI({ character, workflowState, setWorkflowState }) {
  const { asiChoice, statIncreases, selectedFeat } = workflowState;

  const handleStatSelect = (stat) => {
    if (statIncreases.first === stat) {
      setWorkflowState(p => ({ ...p, statIncreases: { first: p.statIncreases.second, second: '' } }));
    } else if (statIncreases.second === stat) {
      setWorkflowState(p => ({ ...p, statIncreases: { ...p.statIncreases, second: '' } }));
    } else if (!statIncreases.first) {
      setWorkflowState(p => ({ ...p, statIncreases: { ...p.statIncreases, first: stat } }));
    } else if (!statIncreases.second) {
      setWorkflowState(p => ({ ...p, statIncreases: { ...p.statIncreases, second: stat } }));
    }
  };

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Ability Score or Feat</h3>
      <p className="text-sm mb-4 font-serif" style={{ color: 'var(--parchment-dim)' }}>
        You can increase two ability scores by 1 each, or select one feat.
      </p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setWorkflowState(p=>({...p, asiChoice: 'stats'}))} className={`flex-1 py-2 rounded-lg text-xs font-fantasy btn-fantasy ${asiChoice === 'stats' ? 'border-glow-gold' : ''}`}>+2 Ability Scores</button>
        <button onClick={() => setWorkflowState(p=>({...p, asiChoice: 'feat'}))} className={`flex-1 py-2 rounded-lg text-xs font-fantasy btn-fantasy ${asiChoice === 'feat' ? 'border-glow-gold' : ''}`}>Take a Feat</button>
      </div>

      {asiChoice === 'stats' ? (
        <div className="grid grid-cols-3 gap-2">
          {STATS.map(stat => (
            <button key={stat} onClick={() => handleStatSelect(stat)}
              disabled={(character[stat] || 10) >= 20}
              className={`py-3 px-3 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-30 ${statIncreases.first === stat || statIncreases.second === stat ? 'border-glow-gold' : ''}`}>
              {stat.toUpperCase()} ({character[stat] || 10})
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {COMMON_FEATS.map(feat => (
            <button key={feat.name} onClick={() => setWorkflowState(p=>({...p, selectedFeat: feat.name}))}
              className={`w-full text-left p-3 rounded-lg fantasy-card ${selectedFeat === feat.name ? 'border-glow-gold' : ''}`}>
              <div className="font-fantasy font-bold">{feat.name}</div>
              <p className="text-xs font-serif" style={{ color: 'var(--parchment-dim)' }}>{feat.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}