import React from 'react';
import { Sword } from 'lucide-react';

// Paladin spell slots by character level (index 0 = level 1 slot count ... index 4 = level 5).
// Mirrors PALADIN_MAX_SLOTS in the combatEngine so the picker only offers slots the player owns.
const PALADIN_MAX_SLOTS = {
  1: [0,0,0,0,0], 2: [2,0,0,0,0], 3: [3,0,0,0,0], 4: [3,0,0,0,0], 5: [4,2,0,0,0],
  6: [4,2,0,0,0], 7: [4,3,0,0,0], 8: [4,3,0,0,0], 9: [4,3,2,0,0], 10: [4,3,2,0,0],
  11: [4,3,3,0,0], 12: [4,3,3,0,0], 13: [4,3,3,1,0], 14: [4,3,3,1,0], 15: [4,3,3,2,0],
  16: [4,3,3,2,0], 17: [4,3,3,3,1], 18: [4,3,3,3,1], 19: [4,3,3,3,2], 20: [4,3,3,3,2],
};

// Divine Smite damage scales with slot level: 2d8 at 1st, +1d8 per level above (max 5d8).
const SMITE_DICE = { 1: '2d8', 2: '3d8', 3: '4d8', 4: '5d8', 5: '5d8' };

/**
 * SmiteSlotPicker — lets a Paladin choose which spell slot to spend on Divine Smite
 * for the next weapon attack. Only renders for Paladins (level 2+) with slots available.
 *
 * Props:
 *  - character: the player character (reads class, level, spell_slots)
 *  - value: currently selected slot level (number) or null for "no smite"
 *  - onChange: (level|null) => void
 */
export default function SmiteSlotPicker({ character, value, onChange }) {
  if (!character) return null;

  // Detect Paladin via primary class or multiclass entries
  const isPaladin = character.class === 'Paladin'
    || (character.multiclass || []).some(mc => mc.class === 'Paladin');
  if (!isPaladin) return null;

  const paladinLevel = character.class === 'Paladin'
    ? (character.level || 1)
    : ((character.multiclass || []).find(mc => mc.class === 'Paladin')?.levels || 0);
  if (paladinLevel < 2) return null;

  const maxSlots = PALADIN_MAX_SLOTS[Math.min(20, paladinLevel)] || [0,0,0,0,0];
  const used = character.spell_slots || {};

  // Build list of slot levels with at least one slot remaining
  const available = [];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const remaining = (maxSlots[lvl - 1] || 0) - (used[`level_${lvl}`] || 0);
    if (remaining > 0) available.push({ lvl, remaining });
  }

  if (available.length === 0) return null;

  return (
    <div>
      <div className="font-fantasy text-xs mb-1 flex items-center gap-1.5"
        style={{ color: 'rgba(240,200,120,0.6)', fontSize: '0.62rem', letterSpacing: '0.08em' }}>
        <Sword className="w-3 h-3" /> DIVINE SMITE
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(null)}
          className="px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
          style={!value ? {
            background: 'rgba(60,40,8,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
          } : {
            background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.45)',
          }}>
          No Smite
        </button>
        {available.map(({ lvl, remaining }) => (
          <button key={lvl}
            onClick={() => onChange(lvl)}
            className="px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
            style={value === lvl ? {
              background: 'rgba(80,40,120,0.7)', border: '1px solid rgba(180,120,250,0.6)', color: '#e9d5ff',
              boxShadow: '0 0 10px rgba(140,80,230,0.25)',
            } : {
              background: 'rgba(20,8,40,0.6)', border: '1px solid rgba(150,90,230,0.3)', color: 'rgba(196,160,250,0.7)',
            }}>
            L{lvl} · {SMITE_DICE[lvl]} <span style={{ opacity: 0.6 }}>({remaining})</span>
          </button>
        ))}
      </div>
    </div>
  );
}