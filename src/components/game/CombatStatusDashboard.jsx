import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles, TrendingUp, Zap } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getMulticlassSpellSlots } from './multiclassUtils';

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

function getMagicPercent(character) {
  const slotMaximums = getMulticlassSpellSlots(character || {});
  const totalSlots = slotMaximums.reduce((sum, count) => sum + (count || 0), 0);
  if (!totalSlots) return 100;

  const usedSlots = slotMaximums.reduce((sum, maxSlots, index) => {
    const level = index + 1;
    return sum + Math.min(maxSlots || 0, character?.spell_slots?.[`level_${level}`] || 0);
  }, 0);

  return clampPercent(((totalSlots - usedSlots) / totalSlots) * 100);
}

function buildSnapshot({ combat, character, actionsRemaining, actionsPerTurn, bonusActionUsed, reactionUsed }) {
  const player = (combat?.combatants || []).find(c => c.type === 'player');
  const hpCurrent = player?.hp_current ?? character?.hp_current ?? 0;
  const hpMax = player?.hp_max ?? character?.hp_max ?? 1;
  const staminaMax = Math.max(1, (actionsPerTurn || 1) + 2);
  const staminaCurrent = Math.max(0, actionsRemaining || 0) + (!bonusActionUsed ? 1 : 0) + (!reactionUsed ? 1 : 0);

  return {
    id: `${combat?.round || 1}-${combat?.current_turn_index || 0}-${combat?.log_entries?.length || 0}`,
    label: `R${combat?.round || 1}`,
    health: clampPercent((hpCurrent / Math.max(1, hpMax)) * 100),
    stamina: clampPercent((staminaCurrent / staminaMax) * 100),
    magic: getMagicPercent(character),
  };
}

function StatusPill({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 min-w-0"
      style={{ background: 'rgba(12,8,5,0.72)', border: `1px solid ${color}33` }}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <div className="font-fantasy uppercase tracking-widest" style={{ color: 'rgba(232,213,183,0.55)', fontSize: '0.54rem' }}>
          {label}
        </div>
        <div className="font-mono font-bold tabular-nums" style={{ color, fontSize: '0.72rem' }}>
          {value}%
        </div>
      </div>
    </div>
  );
}

export default function CombatStatusDashboard({ combat, character, actionsRemaining, actionsPerTurn, bonusActionUsed, reactionUsed }) {
  const latest = useMemo(() => buildSnapshot({
    combat,
    character,
    actionsRemaining,
    actionsPerTurn,
    bonusActionUsed,
    reactionUsed,
  }), [combat, character, actionsRemaining, actionsPerTurn, bonusActionUsed, reactionUsed]);

  const [history, setHistory] = useState([latest]);

  useEffect(() => {
    setHistory([latest]);
  }, [combat?.id]);

  useEffect(() => {
    setHistory(prev => {
      if (prev[prev.length - 1]?.id === latest.id) {
        return [...prev.slice(0, -1), latest];
      }
      return [...prev, latest].slice(-12);
    });
  }, [latest]);

  const chartData = history.length > 1 ? history : [latest, { ...latest, id: `${latest.id}-now`, label: 'Now' }];

  return (
    <section className="rounded-xl p-3 space-y-3"
      aria-label="Combat status trends dashboard"
      style={{
        background: 'linear-gradient(160deg, rgba(24,12,8,0.86), rgba(12,7,6,0.9))',
        border: '1px solid rgba(201,90,70,0.24)',
        boxShadow: 'inset 0 1px 0 rgba(255,210,160,0.06)',
      }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fca5a5' }} />
          <div>
            <h3 className="font-fantasy uppercase tracking-widest" style={{ color: '#fca5a5', fontSize: '0.62rem' }}>
              Status Trends
            </h3>
            <p style={{ color: 'rgba(232,213,183,0.56)', fontFamily: 'EB Garamond, serif', fontSize: '0.72rem' }}>
              Health, action stamina, and magic over this battle
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatusPill icon={Heart} label="Health" value={latest.health} color="#ef4444" />
        <StatusPill icon={Zap} label="Stamina" value={latest.stamina} color="#f0c040" />
        <StatusPill icon={Sparkles} label="Magic" value={latest.magic} color="#a78bfa" />
      </div>

      <div className="h-28" role="img" aria-label={`Health ${latest.health} percent, stamina ${latest.stamina} percent, magic ${latest.magic} percent`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" stroke="rgba(232,213,183,0.34)" tick={{ fill: 'rgba(232,213,183,0.55)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} stroke="rgba(232,213,183,0.25)" tick={{ fill: 'rgba(232,213,183,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,5,4,0.96)', border: '1px solid rgba(201,90,70,0.32)', borderRadius: 10, color: '#f8ecd6' }}
              formatter={(value, name) => [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            <Line type="monotone" dataKey="health" stroke="#ef4444" strokeWidth={2} dot={false} name="health" />
            <Line type="monotone" dataKey="stamina" stroke="#f0c040" strokeWidth={2} dot={false} name="stamina" />
            <Line type="monotone" dataKey="magic" stroke="#a78bfa" strokeWidth={2} dot={false} name="magic" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="sr-only">
        {chartData.map(point => `Round ${point.label}: health ${point.health}%, stamina ${point.stamina}%, magic ${point.magic}%. `)}
      </div>
    </section>
  );
}