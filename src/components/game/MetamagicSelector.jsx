import React from 'react';
import { Sparkles } from 'lucide-react';
import { METAMAGIC_OPTIONS, metamagicCost, isMetamagicApplicable, maxSorceryPoints } from './metamagicData';
import { getClassBreakdown } from './multiclassUtils';

/**
 * Sorcerer Metamagic selector for combat. Shows sorcery points and lets the
 * player toggle Quickened / Twinned / Heightened for the pending spell cast.
 *
 * Props:
 *  - character: the player character (reads class, level, metamagic_known, sorcery_points_current)
 *  - spell: the currently-selected spell shape { attack_type, slot_level, is_bonus_action, single_target }
 *  - active: { quickened, twinned, heightened } booleans
 *  - onToggle: (id) => void
 */
export default function MetamagicSelector({ character, spell, active = {}, onToggle }) {
  const sorcererEntry = getClassBreakdown(character || {}).find(entry => entry.className === 'Sorcerer');
  if (!sorcererEntry) return null;
  if ((sorcererEntry.levels || 1) < 3) return null;

  const known = character?.metamagic_known?.length
    ? character.metamagic_known
    : ['Quickened Spell', 'Twinned Spell', 'Heightened Spell']; // sensible default if not set
  const wired = ['Quickened Spell', 'Twinned Spell', 'Heightened Spell'];
  const available = known.filter(k => wired.includes(k));
  if (available.length === 0) return null;

  const spMax = character?.sorcery_points_max || sorcererEntry.levels || maxSorceryPoints(character);
  const spCurrent = character?.sorcery_points_current ?? spMax;
  const slotLevel = spell?.slot_level || 1;

  return (
    <div className="rounded-lg p-2"
      style={{ background: 'rgba(40,10,70,0.45)', border: '1px solid rgba(150,90,230,0.3)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-fantasy flex items-center gap-1" style={{ color: '#c4b5fd', fontSize: '0.62rem', letterSpacing: '0.08em' }}>
          <Sparkles className="w-3 h-3" /> METAMAGIC
        </span>
        <span className="font-mono" style={{ color: '#ddd6fe', fontSize: '0.65rem' }}>
          {spCurrent}/{spMax} SP
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {available.map(name => {
          const opt = METAMAGIC_OPTIONS[name];
          const cost = metamagicCost(name, slotLevel);
          const applicable = !spell || isMetamagicApplicable(name, spell);
          const affordable = spCurrent >= cost;
          const isActive = !!active[opt.id];
          const disabled = !applicable || (!isActive && !affordable);
          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => onToggle?.(opt.id)}
              title={`${opt.desc} (Cost: ${cost} SP)${!applicable ? ' — not applicable to this spell' : ''}`}
              className="px-2 py-1 rounded-md font-fantasy transition-all"
              style={{
                fontSize: '0.6rem',
                background: isActive ? 'rgba(120,70,220,0.55)' : 'rgba(20,8,40,0.6)',
                border: `1px solid ${isActive ? 'rgba(190,140,255,0.7)' : 'rgba(120,70,200,0.25)'}`,
                color: disabled ? 'rgba(150,120,200,0.4)' : isActive ? '#ede9fe' : '#c4b5fd',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {opt.icon} {name.replace(' Spell', '')} <span style={{ opacity: 0.7 }}>({cost})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}