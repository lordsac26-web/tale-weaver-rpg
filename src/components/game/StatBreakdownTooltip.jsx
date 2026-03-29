import React, { useState, useRef, useEffect } from 'react';
import { RACES } from './gameData';
import { FEATS } from './featData';
import { resolveItemBonuses } from './itemBonuses';

/**
 * Calculates the breakdown of how a character arrived at a given ability score.
 * Returns an array of { label, value } objects.
 */
export function getStatBreakdown(character, stat) {
  const lines = [];
  const finalScore = character[stat] || 10;

  // 1. Base score (before racial/feat/equipment)
  const baseStat = character[`_base_${stat}`] || null;

  // 2. Racial bonus
  const raceData = RACES[character.race];
  let racialBonus = 0;
  if (raceData) {
    racialBonus = raceData.stat_bonuses?.[stat] || 0;
    // Subrace bonuses
    if (character.subrace && raceData.subraces) {
      const subrace = raceData.subraces.find(s => s.name === character.subrace);
      if (subrace?.stat_bonuses?.[stat]) {
        racialBonus += subrace.stat_bonuses[stat];
      }
    }
  }

  // 3. Feat bonuses
  let featBonus = 0;
  const featSources = [];
  (character.feats || []).forEach(featName => {
    const name = typeof featName === 'string' ? featName : featName?.name;
    const feat = FEATS.find(f => f.name === name);
    if (!feat) return;

    // Direct asi_bonus (e.g. Actor gives +1 CHA)
    if (feat.asi_bonus?.[stat]) {
      featBonus += feat.asi_bonus[stat];
      featSources.push({ name, value: feat.asi_bonus[stat] });
    }

    // Player-chosen stat from feat (e.g. Athlete: +1 STR or DEX)
    if (feat.asi_choices && character.feat_stat_choices?.[name] === stat) {
      featBonus += 1;
      featSources.push({ name, value: 1 });
    }
  });

  // 4. Equipment "set" and "add" bonuses
  let equipSetValue = null; // highest "set to X" value
  let equipSetSource = null;
  let equipAddBonus = 0;
  const equipAddSources = [];
  const equipped = character.equipped || {};

  Object.entries(equipped).forEach(([slot, item]) => {
    if (!item || typeof item !== 'object' || slot === 'weapon') return;
    const bonuses = resolveItemBonuses(item);

    // "Set" ability scores (e.g. CON becomes 19)
    if (bonuses.ability_scores?.[stat]) {
      const val = bonuses.ability_scores[stat];
      if (!equipSetValue || val > equipSetValue) {
        equipSetValue = val;
        equipSetSource = item.name;
      }
    }

    // Additive ability scores (e.g. +1 DEX)
    if (bonuses.ability_score_adds?.[stat]) {
      equipAddBonus += bonuses.ability_score_adds[stat];
      equipAddSources.push({ name: item.name, value: bonuses.ability_score_adds[stat] });
    }
  });

  // Build the breakdown
  // If we have a stored base, use it; otherwise reverse-engineer it
  if (baseStat) {
    lines.push({ label: 'Base Score', value: baseStat });
  } else {
    // Derive: final - racial - feats - equipment adds, clamped by equipment set
    let derivedBase = finalScore;
    if (equipSetValue && equipSetValue > (finalScore - equipAddBonus)) {
      // The "set" item is active — base is whatever was before set + adds
      derivedBase = finalScore - equipAddBonus;
      // The set item overrode the natural base, so we can't know the original base
      // Just show "Base (before equipment)" as the set value minus adds
    } else {
      derivedBase = finalScore - racialBonus - featBonus - equipAddBonus;
    }
    lines.push({ label: 'Base Score', value: Math.max(1, derivedBase) });
  }

  if (racialBonus !== 0) {
    const raceLabel = character.subrace || character.race;
    lines.push({ label: `${raceLabel} Racial`, value: racialBonus });
  }

  featSources.forEach(fs => {
    lines.push({ label: `Feat: ${fs.name}`, value: fs.value });
  });

  if (equipSetValue) {
    lines.push({ label: `${equipSetSource} (set to)`, value: equipSetValue, isSet: true });
  }

  equipAddSources.forEach(es => {
    lines.push({ label: es.name, value: es.value });
  });

  // ASI increases (level-ups) — we can't know exact ASI allocations,
  // but if the math doesn't add up, show the remainder as "Ability Score Improvements"
  const accounted = (baseStat || lines[0]?.value || 10) + racialBonus + featBonus + equipAddBonus;
  const effectiveFinal = equipSetValue ? Math.max(equipSetValue, accounted) + equipAddBonus : finalScore;

  // If there's a gap between accounted and final (and no set item overriding), it's from ASIs
  if (!equipSetValue) {
    const remainder = finalScore - accounted;
    if (remainder > 0) {
      lines.push({ label: 'Ability Score Improvements', value: remainder });
    }
  }

  return { lines, total: finalScore };
}

/**
 * Tooltip component that shows stat breakdown on hover.
 */
export default function StatBreakdownTooltip({ character, stat, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipW = 220;
      const tooltipH = 200;

      let left = rect.left + rect.width / 2 - tooltipW / 2;
      let top = rect.bottom + 8;

      // Clamp to viewport
      if (left < 8) left = 8;
      if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - tooltipW - 8;
      if (top + tooltipH > window.innerHeight - 8) {
        top = rect.top - tooltipH - 8;
      }

      setPos({ top, left });
    }
  }, [show]);

  const { lines, total } = getStatBreakdown(character, stat);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </div>

      {show && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            width: 220,
            background: 'rgba(12,8,3,0.97)',
            border: '1px solid rgba(201,169,110,0.4)',
            boxShadow: '0 0 30px rgba(0,0,0,0.8), 0 0 10px rgba(201,169,110,0.1)',
          }}
        >
          <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.6)', fontSize: '0.6rem' }}>
            SCORE BREAKDOWN
          </div>
          <div className="space-y-1">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs truncate pr-2" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                  {line.label}
                </span>
                <span className="text-xs font-fantasy font-bold flex-shrink-0" style={{
                  color: line.isSet ? '#93c5fd' : line.value > 0 ? '#86efac' : line.value < 0 ? '#fca5a5' : 'rgba(232,213,183,0.7)',
                }}>
                  {line.isSet ? `→ ${line.value}` : (line.value > 0 && i > 0 ? `+${line.value}` : line.value)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-1.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(201,169,110,0.2)' }}>
            <span className="text-xs font-fantasy" style={{ color: '#f0c040' }}>Total</span>
            <span className="text-sm font-fantasy font-bold" style={{ color: '#f0c040' }}>{total}</span>
          </div>
        </div>
      )}
    </>
  );
}