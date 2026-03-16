import React from 'react';
import { SkillTooltip } from './GameTooltip';
import { calcStatMod, calcModDisplay } from './gameData';

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

// Cycles: none → proficient → expert → none
function nextProfLevel(current) {
  if (current === 'expert') return null;
  if (current === 'proficient' || current === true) return 'expert';
  return 'proficient';
}

function getProfLabel(level) {
  if (level === 'expert') return 'E';
  if (level === 'proficient' || level === true) return 'P';
  return '—';
}

/**
 * A single interactive skill row.
 * Props:
 *   skill       — skill name
 *   stat        — ability stat key
 *   character   — character object
 *   profBonus   — current proficiency bonus
 *   onToggle    — (skill, newLevel) => void  (newLevel = 'proficient' | 'expert' | null)
 *   readonly    — if true, hides the toggle button
 */
export default function SkillProficiencyRow({ skill, stat, character, profBonus, onToggle, readonly = false }) {
  const statMod = calcStatMod(character[stat] || 10);
  const profLevel = character.skills?.[skill];
  const isExpert = profLevel === 'expert';
  const isProficient = isExpert || profLevel === 'proficient' || profLevel === true;
  const bonus = isExpert ? profBonus * 2 : isProficient ? profBonus : 0;
  const total = statMod + bonus;

  // Bard Jack of All Trades: add half proficiency to non-proficient skills
  const isJoat = character.class === 'Bard' && (character.level || 1) >= 2 && !isProficient;
  const joatBonus = isJoat ? Math.floor(profBonus / 2) : 0;
  const displayTotal = total + joatBonus;

  const dotColor = isExpert
    ? '#f0c040'
    : isProficient
    ? '#86efac'
    : isJoat
    ? 'rgba(147,197,253,0.5)'
    : 'rgba(80,60,30,0.4)';

  const dotShadow = isExpert
    ? '0 0 4px rgba(240,192,64,0.5)'
    : isProficient
    ? '0 0 4px rgba(134,239,172,0.3)'
    : 'none';

  const handleClick = () => {
    if (readonly || !onToggle) return;
    onToggle(skill, nextProfLevel(profLevel));
  };

  return (
    <div
      className="flex items-center justify-between py-1.5 px-3 rounded-lg transition-all select-none"
      style={{ borderBottom: '1px solid rgba(180,140,90,0.06)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,20,8,0.5)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Left: indicator + name + stat */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Proficiency dot — click to cycle */}
        <button
          onClick={handleClick}
          disabled={readonly}
          title={
            readonly ? undefined
            : isExpert ? 'Click to remove expertise'
            : isProficient ? 'Click to set expertise'
            : 'Click to add proficiency'
          }
          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            background: dotColor,
            boxShadow: dotShadow,
            border: '1px solid rgba(180,140,90,0.2)',
            cursor: readonly ? 'default' : 'pointer',
            fontSize: '0.45rem',
            fontWeight: 700,
            color: isExpert ? '#5a3a00' : isProficient ? '#0a3015' : 'rgba(180,140,90,0.5)',
          }}
        >
          {!readonly && getProfLabel(profLevel)}
        </button>

        <SkillTooltip name={skill} position="right">
          <span className="text-sm truncate" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif' }}>
            {skill}
          </span>
        </SkillTooltip>

        <span className="text-xs flex-shrink-0" style={{ color: 'rgba(180,140,90,0.35)' }}>
          ({STAT_LABELS[stat]})
        </span>

        {/* Proficiency badge */}
        {(isProficient || isJoat) && !readonly && (
          <span
            className="text-xs px-1 py-0.5 rounded flex-shrink-0"
            style={{
              background: isExpert ? 'rgba(80,50,5,0.5)' : isJoat ? 'rgba(10,20,50,0.5)' : 'rgba(10,40,20,0.5)',
              border: `1px solid ${isExpert ? 'rgba(240,192,64,0.3)' : isJoat ? 'rgba(147,197,253,0.2)' : 'rgba(134,239,172,0.2)'}`,
              color: isExpert ? '#f0c040' : isJoat ? 'rgba(147,197,253,0.7)' : '#86efac',
              fontSize: '0.55rem',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.05em',
            }}
          >
            {isExpert ? 'EXPERT' : isJoat ? 'JoAT' : 'PROF'}
          </span>
        )}
      </div>

      {/* Right: modifier */}
      <span
        className="font-fantasy font-bold text-sm flex-shrink-0 ml-2"
        style={{ color: displayTotal >= 0 ? '#86efac' : '#fca5a5' }}
      >
        {calcModDisplay(displayTotal)}
      </span>
    </div>
  );
}