import React from 'react';

/**
 * Displays active magical effects from equipped items.
 * Props: effects — from computeCharacterStats().effects
 */
export default function ActiveEffectsPanel({ effects }) {
  if (!effects) return null;
  const entries = [];

  if (effects.resistances?.length > 0) {
    entries.push({ icon: '🛡️', label: 'Damage Resistances', value: effects.resistances.join(', '), color: '#60a5fa' });
  }
  if (effects.save_bonus > 0) {
    entries.push({ icon: '⚡', label: 'Save Bonus (all)', value: `+${effects.save_bonus}`, color: '#86efac' });
  }
  if (effects.spell_attack_bonus > 0) {
    entries.push({ icon: '🔮', label: 'Spell Attack Bonus', value: `+${effects.spell_attack_bonus}`, color: '#c4b5fd' });
  }
  if (effects.spell_save_dc_bonus > 0) {
    entries.push({ icon: '✨', label: 'Spell Save DC Bonus', value: `+${effects.spell_save_dc_bonus}`, color: '#c4b5fd' });
  }
  if (effects.no_crits) {
    entries.push({ icon: '🪨', label: 'Adamantine', value: 'Crits become normal hits', color: '#94a3b8' });
  }
  if (effects.regeneration) {
    entries.push({ icon: '💚', label: 'Regeneration', value: `${effects.regeneration}/turn`, color: '#4ade80' });
  }
  if (effects.luck > 0) {
    entries.push({ icon: '🍀', label: 'Lucky', value: `${effects.luck}/day reroll`, color: '#fbbf24' });
  }

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.15)' }}>
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ background: 'rgba(20,30,50,0.5)', borderBottom: '1px solid rgba(96,165,250,0.1)' }}>
        <span className="text-sm">✨</span>
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(96,165,250,0.7)', fontSize: '0.65rem' }}>
          ACTIVE MAGICAL EFFECTS
        </span>
      </div>
      <div className="p-3 space-y-1.5" style={{ background: 'rgba(12,8,4,0.5)' }}>
        {entries.map((e, i) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(15,20,35,0.4)', border: '1px solid rgba(96,165,250,0.08)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{e.icon}</span>
              <span className="text-xs" style={{ color: 'rgba(220,210,190,0.7)', fontFamily: 'EB Garamond, serif' }}>{e.label}</span>
            </div>
            <span className="text-xs font-fantasy font-bold" style={{ color: e.color }}>{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}