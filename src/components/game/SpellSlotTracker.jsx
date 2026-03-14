import React from 'react';
import { Sparkles, Circle, Disc } from 'lucide-react';
import { motion } from 'framer-motion';

const SLOT_COLORS = {
  1: { filled: '#86efac', empty: 'rgba(134,239,172,0.15)', glow: 'rgba(134,239,172,0.3)' },
  2: { filled: '#93c5fd', empty: 'rgba(147,197,253,0.15)', glow: 'rgba(147,197,253,0.3)' },
  3: { filled: '#c4b5fd', empty: 'rgba(196,181,253,0.15)', glow: 'rgba(196,181,253,0.3)' },
  4: { filled: '#fbbf24', empty: 'rgba(251,191,36,0.15)', glow: 'rgba(251,191,36,0.3)' },
  5: { filled: '#fb923c', empty: 'rgba(251,146,60,0.15)', glow: 'rgba(251,146,60,0.3)' },
  6: { filled: '#f87171', empty: 'rgba(248,113,113,0.15)', glow: 'rgba(248,113,113,0.3)' },
  7: { filled: '#e879f9', empty: 'rgba(232,121,249,0.15)', glow: 'rgba(232,121,249,0.3)' },
  8: { filled: '#f0c040', empty: 'rgba(240,192,64,0.15)', glow: 'rgba(240,192,64,0.3)' },
  9: { filled: '#fca5a5', empty: 'rgba(252,165,165,0.15)', glow: 'rgba(252,165,165,0.3)' },
};

const LEVEL_LABELS = ['—', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

// Get spell slots for a class at a specific level
function getSpellSlotsForLevel(charClass, level) {
  const progression = {
    Wizard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
    Sorcerer: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
    Bard: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
    Cleric: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
    Druid: [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
    Paladin: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
    Ranger: [[0],[0],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
    Artificer: [[0],[2],[2],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
    Warlock: [[1],[2],[2],[2],[2],[2],[2],[2],[2],[2],[3],[3],[3],[3],[3],[3],[4],[4],[4],[4]],
  };

  return progression[charClass]?.[level - 1] || [];
}

export default function SpellSlotTracker({ character, onUpdateSlots, compact = false }) {
  const charClass = character?.class || '';
  const charLevel = character?.level || 1;
  const currentSlots = character?.spell_slots || {};

  const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Artificer'];
  
  if (!SPELLCASTING_CLASSES.includes(charClass)) {
    return null;
  }

  const maxSlotsArr = getSpellSlotsForLevel(charClass, charLevel);
  if (maxSlotsArr.length === 0) return null;

  // Warlock uses Pact Magic (special case)
  const isWarlock = charClass === 'Warlock';
  const warlockSlotLevel = isWarlock ? Math.min(5, Math.ceil(charLevel / 2)) : 0;
  const warlockSlots = isWarlock ? maxSlotsArr[0] : 0;

  const toggleSlot = (level, slotIndex) => {
    const key = `level_${level}`;
    const used = currentSlots[key] || 0;
    const max = maxSlotsArr[level - 1] || 0;
    
    if (slotIndex < used) {
      // Clicking used slot: restore it
      const newUsed = used - 1;
      const updated = { ...currentSlots };
      if (newUsed === 0) delete updated[key];
      else updated[key] = newUsed;
      onUpdateSlots(updated);
    } else if (slotIndex === used && used < max) {
      // Clicking first available slot: use it
      const updated = { ...currentSlots, [key]: used + 1 };
      onUpdateSlots(updated);
    }
  };

  if (compact) {
    // Compact view for HUD
    const totalUsed = Object.keys(currentSlots).reduce((sum, key) => sum + (currentSlots[key] || 0), 0);
    const totalMax = maxSlotsArr.reduce((sum, val) => sum + val, 0);
    return (
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
        <span className="font-fantasy text-xs" style={{ color: totalUsed < totalMax ? '#a78bfa' : '#fca5a5' }}>
          {totalMax - totalUsed}/{totalMax}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isWarlock ? (
        // Warlock Pact Magic (all slots same level)
        <div className="p-4 rounded-xl" style={{ background: 'rgba(60,30,120,0.2)', border: '1px solid rgba(140,80,220,0.25)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: '#c4b5fd' }} />
              <span className="font-fantasy text-sm font-bold" style={{ color: '#dfc8ff' }}>
                Pact Magic ({LEVEL_LABELS[warlockSlotLevel]}-level)
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full badge-arcane">
              {warlockSlots - (currentSlots[`level_${warlockSlotLevel}`] || 0)}/{warlockSlots} slots
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: warlockSlots }).map((_, i) => {
              const used = (currentSlots[`level_${warlockSlotLevel}`] || 0);
              const isUsed = i < used;
              const colors = SLOT_COLORS[warlockSlotLevel];
              return (
                <motion.button key={i}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSlot(warlockSlotLevel, i)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: isUsed ? colors.empty : colors.filled,
                    border: `1px solid ${isUsed ? 'rgba(140,80,220,0.2)' : colors.filled}`,
                    boxShadow: isUsed ? 'none' : `0 0 8px ${colors.glow}`,
                  }}>
                  {isUsed ? <Circle className="w-4 h-4" style={{ color: 'rgba(180,140,200,0.3)' }} /> : <Disc className="w-4 h-4" style={{ color: colors.filled }} />}
                </motion.button>
              );
            })}
          </div>
          <div className="text-xs mt-2" style={{ color: 'rgba(196,181,253,0.5)', fontFamily: 'EB Garamond, serif' }}>
            ⚡ Warlocks recover all pact slots on short rest
          </div>
        </div>
      ) : (
        // Standard spell slots (levels 1-9)
        maxSlotsArr.map((max, idx) => {
          if (max === 0) return null;
          const level = idx + 1;
          const used = currentSlots[`level_${level}`] || 0;
          const remaining = max - used;
          const colors = SLOT_COLORS[level] || SLOT_COLORS[1];

          return (
            <div key={level} className="p-3 rounded-xl"
              style={{ background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${colors.filled}33, ${colors.filled}22)`, border: `1px solid ${colors.filled}55` }}>
                    <span className="font-fantasy text-xs font-bold" style={{ color: colors.filled }}>{level}</span>
                  </div>
                  <span className="font-fantasy text-xs" style={{ color: 'rgba(201,169,110,0.7)' }}>
                    {LEVEL_LABELS[level]} Level
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ 
                    background: remaining > 0 ? `${colors.filled}22` : 'rgba(80,20,20,0.3)',
                    color: remaining > 0 ? colors.filled : '#fca5a5',
                    border: `1px solid ${remaining > 0 ? colors.filled+'44' : 'rgba(180,50,50,0.3)'}`
                  }}>
                  {remaining}/{max} slots
                </span>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: max }).map((_, i) => {
                  const isUsed = i < used;
                  return (
                    <motion.button key={i}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => toggleSlot(level, i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={{
                        background: isUsed ? colors.empty : colors.filled,
                        border: `1px solid ${isUsed ? 'rgba(180,140,90,0.15)' : colors.filled}`,
                        boxShadow: isUsed ? 'inset 0 2px 4px rgba(0,0,0,0.5)' : `0 0 6px ${colors.glow}`,
                      }}>
                      {isUsed ? (
                        <Circle className="w-3.5 h-3.5" style={{ color: 'rgba(180,140,90,0.25)' }} />
                      ) : (
                        <Disc className="w-3.5 h-3.5" style={{ color: colors.filled, filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Recovery info */}
      <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(60,30,8,0.3)', color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
        {isWarlock ? (
          '⚡ Pact Magic: All slots recharge on short rest. Always cast at highest available level.'
        ) : charClass === 'Wizard' ? (
          '📚 Arcane Recovery: Once per long rest, recover slots totaling ≤ ½ wizard level on short rest. All slots on long rest.'
        ) : (
          '🌙 All spell slots recover on long rest. Short rests do not restore slots.'
        )}
      </div>
    </div>
  );
}