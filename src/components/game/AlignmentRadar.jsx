import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

const clamp = (value) => Math.max(-25, Math.min(25, Number(value) || 0));
const normalize = (value) => clamp(value) + 25;

const getScores = (character = {}) => ({
  good_evil: clamp(character.alignment_scores?.good_evil),
  law_chaos: clamp(character.alignment_scores?.law_chaos),
  sanity: clamp(character.alignment_scores?.sanity),
});

const getMoralLabel = (score) => {
  if (score >= 10) return 'Good';
  if (score <= -10) return 'Evil';
  return 'Neutral';
};

const getOrderLabel = (score) => {
  if (score >= 10) return 'Lawful';
  if (score <= -10) return 'Chaotic';
  return 'Neutral';
};

export default function AlignmentRadar({ character, compact = false }) {
  const scores = getScores(character);
  const dynamic = character?.alignment_mode === 'dynamic';

  if (!dynamic) {
    return (
      <div className="rounded-xl p-3" style={{ background: 'rgba(15,10,5,0.55)', border: '1px solid rgba(180,140,90,0.12)' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(201,169,110,0.55)' }}>Alignment</div>
        <div className="font-fantasy text-lg" style={{ color: '#e8d5b7' }}>{character?.alignment || 'True Neutral'}</div>
        <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.45)' }}>Static alignment</div>
      </div>
    );
  }

  const data = [
    { axis: getMoralLabel(scores.good_evil), value: normalize(scores.good_evil) },
    { axis: getOrderLabel(scores.law_chaos), value: normalize(scores.law_chaos) },
    { axis: 'Stability', value: normalize(scores.sanity) },
  ];

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(15,10,5,0.55)', border: '1px solid rgba(180,140,90,0.12)' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-widest" style={{ color: 'rgba(201,169,110,0.55)' }}>Dynamic Alignment</div>
          {!compact && <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.38)' }}>Sanity/stability is intentionally obscured.</div>}
        </div>
        <div className="text-xs px-2 py-1 rounded-full" style={{ color: '#f0c040', background: 'rgba(80,50,10,0.35)', border: '1px solid rgba(201,169,110,0.22)' }}>
          {character?.alignment || 'True Neutral'}
        </div>
      </div>
      <div className={compact ? 'h-36' : 'h-48'}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="rgba(201,169,110,0.18)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: 'rgba(232,213,183,0.72)', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 50]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#f0c040" fill="#c98a45" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg px-2 py-1" style={{ background: 'rgba(10,6,3,0.45)', color: 'rgba(232,213,183,0.7)' }}>Moral drift: {getMoralLabel(scores.good_evil)}</div>
          <div className="rounded-lg px-2 py-1" style={{ background: 'rgba(10,6,3,0.45)', color: 'rgba(232,213,183,0.7)' }}>Order drift: {getOrderLabel(scores.law_chaos)}</div>
        </div>
      )}
    </div>
  );
}