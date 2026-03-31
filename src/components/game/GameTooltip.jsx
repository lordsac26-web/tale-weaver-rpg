import React, { useState, useRef, useEffect } from 'react';
import { CLASSES, RACES, CONDITIONS, SKILL_STAT_MAP, BACKGROUNDS } from './gameData';
import { SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS } from './spellData';

/**
 * Reusable tooltip for D&D game elements.
 * Wraps children and shows a styled tooltip on hover.
 * 
 * Props:
 *   - content: string | ReactNode  (the tooltip body)
 *   - title: optional string heading
 *   - subtitle: optional string subheading  
 *   - icon: optional emoji or node
 *   - position: 'top' | 'bottom' | 'left' | 'right' (default 'top')
 *   - maxWidth: number (default 280)
 *   - children: the trigger element
 *   - disabled: skip tooltip
 */
export default function GameTooltip({ content, title, subtitle, icon, position = 'top', maxWidth = 280, children, disabled }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);
  const isDisabled = disabled || (!content && !title);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    if (isDisabled || !visible || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    let top, left;

    switch (position) {
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + gap;
        break;
      default: // top
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    setCoords({ top, left });
  }, [visible, position, isDisabled]);

  if (isDisabled) return children;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
        style={{ cursor: 'help' }}>
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-none animate-fade-up"
          style={{
            top: coords.top,
            left: coords.left,
            maxWidth,
            background: 'linear-gradient(160deg, rgba(32,18,6,0.98), rgba(18,9,3,0.99))',
            border: '1px solid rgba(184,115,51,0.45)',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 0 24px rgba(0,0,0,0.8), 0 0 8px rgba(184,115,51,0.15)',
            color: '#e8d5b7',
            fontFamily: 'EB Garamond, serif',
          }}>
          {(title || icon) && (
            <div className="flex items-center gap-2 mb-1.5">
              {icon && <span className="text-base flex-shrink-0">{icon}</span>}
              <div>
                {title && (
                  <div className="font-fantasy font-bold text-xs leading-tight" style={{ color: '#f0c040' }}>
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="text-xs leading-tight" style={{ color: 'rgba(212,149,90,0.7)', fontSize: '0.65rem' }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
          )}
          {content && (
            <div className="text-xs leading-relaxed" style={{ color: 'rgba(232,213,183,0.85)' }}>
              {content}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Pre-built tooltip helpers for common D&D items
// ──────────────────────────────────────────────

/** Tooltip for a spell by name */
export function SpellTooltip({ name, children, position = 'top' }) {
  const spell = SPELL_DETAILS[name];
  if (!spell) return children;
  const schoolColor = SCHOOL_COLORS[spell.school] || '';
  const dmgColor = DAMAGE_TYPE_COLORS[spell.damage_type] || '';
  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;

  return (
    <GameTooltip
      position={position}
      maxWidth={320}
      title={name}
      subtitle={`${levelLabel} · ${spell.school} · ${spell.casting_time}`}
      icon={spell.attack_type === 'healing' ? '💚' : spell.is_utility ? '✨' : '🔮'}
      content={
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'rgba(180,140,90,0.7)' }}>
            <span>Range: {spell.range}</span>
            <span>Duration: {spell.duration}</span>
            {spell.components && <span>Components: {spell.components}</span>}
          </div>
          <p>{spell.description}</p>
          {spell.damage_dice && spell.damage_dice !== '0' && (
            <div className="text-xs" style={{ color: 'rgba(252,165,165,0.8)' }}>
              Damage: {spell.damage_dice} {spell.damage_type}
              {spell.save_type && ` (${spell.save_type} save)`}
            </div>
          )}
          {spell.higher_levels && (
            <div className="text-xs italic" style={{ color: 'rgba(251,191,36,0.7)' }}>
              ↑ {spell.higher_levels}
            </div>
          )}
        </div>
      }>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for a condition by name */
export function ConditionTooltip({ name, children, position = 'top' }) {
  const cond = CONDITIONS[name?.toLowerCase()];
  if (!cond) return children;
  return (
    <GameTooltip
      position={position}
      title={name}
      icon={cond.icon}
      content={cond.description}>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for a class feature by name */
export function FeatureTooltip({ featureName, className, children, position = 'top' }) {
  // Features already contain their description in the string (e.g. "Second Wind (1d10+level...)")
  // Extract the parenthetical as the description
  const match = featureName?.match(/^([^(]+)\(([^)]+)\)$/);
  const title = match ? match[1].trim() : featureName;
  const desc = match ? match[2] : null;

  return (
    <GameTooltip
      position={position}
      title={title}
      subtitle={className ? `${className} Feature` : undefined}
      icon="⚔️"
      content={desc || `A feature of the ${className || 'character'} class.`}>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for a skill */
export function SkillTooltip({ name, children, position = 'top' }) {
  const stat = SKILL_STAT_MAP[name];
  const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
  const SKILL_DESCRIPTIONS = {
    Athletics: 'Covers climbing, jumping, swimming, and feats of physical power.',
    Acrobatics: 'Covers balance, tumbling, and staying on your feet in tricky situations.',
    'Sleight of Hand': 'Covers manual trickery, pickpocketing, and concealing objects.',
    Stealth: 'Covers attempts to hide, move silently, and avoid detection.',
    Arcana: 'Recalls lore about spells, magic items, eldritch symbols, and magical traditions.',
    History: 'Recalls lore about historical events, legendary people, ancient kingdoms, and past disputes.',
    Investigation: 'Covers deduction, searching for clues, and making inferences from evidence.',
    Nature: 'Recalls lore about terrain, plants, animals, weather, and natural cycles.',
    Religion: 'Recalls lore about deities, rites, prayers, religious hierarchies, and holy symbols.',
    'Animal Handling': 'Covers calming domesticated animals, intuiting animal intentions, or controlling a mount.',
    Insight: 'Determines the true intentions of a creature by reading body language and habits.',
    Medicine: 'Covers diagnosing illnesses, stabilizing dying companions, and first aid.',
    Perception: 'Spots, hears, or detects the presence of something through general awareness.',
    Survival: 'Covers tracking, navigating the wild, hunting, and avoiding natural hazards.',
    Deception: 'Covers lying, disguises, fast-talking, misleading, and maintaining a false identity.',
    Intimidation: 'Covers threats, hostile actions, and physical or verbal menacing to influence others.',
    Performance: 'Covers entertaining audiences through music, dance, acting, or storytelling.',
    Persuasion: 'Covers influencing someone through tact, social graces, or good nature.',
  };

  return (
    <GameTooltip
      position={position}
      title={name}
      subtitle={stat ? `${STAT_LABELS[stat]} based` : undefined}
      icon="📋"
      content={SKILL_DESCRIPTIONS[name] || `A ${stat?.toUpperCase() || ''}-based skill check.`}>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for a subclass */
export function SubclassTooltip({ className, subclassName, children, position = 'top' }) {
  const classData = CLASSES[className];
  const subclass = classData?.subclasses?.find(s => s.name === subclassName);
  if (!subclass) return children;

  return (
    <GameTooltip
      position={position}
      maxWidth={320}
      title={subclassName}
      subtitle={`${className} Subclass`}
      icon="🏛️"
      content={subclass.desc}>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for a race */
export function RaceTooltip({ raceName, children, position = 'top' }) {
  const race = RACES[raceName];
  if (!race) return children;
  const bonuses = Object.entries(race.stat_bonuses || {}).map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`).join(', ');

  return (
    <GameTooltip
      position={position}
      maxWidth={320}
      title={raceName}
      subtitle={`${race.size} · Speed ${race.speed} ft${bonuses ? ` · ${bonuses}` : ''}`}
      icon="👤"
      content={
        <div className="space-y-1">
          <p>{race.description}</p>
          {race.traits?.length > 0 && (
            <div className="text-xs" style={{ color: 'rgba(134,239,172,0.7)' }}>
              Traits: {race.traits.join(', ')}
            </div>
          )}
        </div>
      }>
      {children}
    </GameTooltip>
  );
}

/** Tooltip for equipment/items */
export function EquipmentTooltip({ itemName, children, position = 'top' }) {
  // Basic equipment data for common items
  const BASIC_EQUIPMENT = {
    'Chain Mail': { type: 'armor', armor_type: 'heavy', ac: 16, weight: 55, cost: 75, desc: 'Made of interlocking metal rings. Disadvantage on Stealth. Requires STR 13.' },
    'Scale Mail': { type: 'armor', armor_type: 'medium', ac: 14, weight: 45, cost: 50, desc: 'Coat of leather with overlapping metal pieces. Disadvantage on Stealth.' },
    'Leather Armor': { type: 'armor', armor_type: 'light', ac: 11, weight: 10, cost: 10, desc: 'Boiled leather breastplate and shoulder protectors.' },
    'Longsword': { type: 'weapon', damage: '1d8 slashing', versatile: '1d10', weight: 3, cost: 15, desc: 'Versatile (1d10 two-handed). Finesse for Dex builds.' },
    'Short Sword': { type: 'weapon', damage: '1d6 piercing', weight: 2, cost: 10, desc: 'Light, finesse. Good for dual wielding.' },
    'Greataxe': { type: 'weapon', damage: '1d12 slashing', weight: 7, cost: 30, desc: 'Two-handed. Heavy. High damage ceiling.' },
    'Shortbow': { type: 'weapon', damage: '1d6 piercing', range: '80/320 ft', weight: 2, cost: 25, desc: 'Ammunition, two-handed. Ideal for mobile rangers.' },
    'Shield': { type: 'armor', armor_type: 'shield', ac: 2, weight: 6, cost: 10, desc: '+2 AC bonus. Cannot be used with two-handed weapons.' },
    'Handaxe': { type: 'weapon', damage: '1d6 slashing', range: '20/60 ft', weight: 2, cost: 5, desc: 'Light, thrown. Can be dual wielded or thrown.' },
    'Dagger': { type: 'weapon', damage: '1d4 piercing', range: '20/60 ft', weight: 1, cost: 2, desc: 'Finesse, light, thrown. Versatile backup weapon.' },
    'Mace': { type: 'weapon', damage: '1d6 bludgeoning', weight: 4, cost: 5, desc: 'Simple weapon favored by clerics.' },
    'Quarterstaff': { type: 'weapon', damage: '1d6 bludgeoning', versatile: '1d8', weight: 4, cost: 0.2, desc: 'Versatile (1d8 two-handed). Monk weapon.' },
    'Rapier': { type: 'weapon', damage: '1d8 piercing', weight: 2, cost: 25, desc: 'Finesse. Best damage for Dex builds.' },
    'Scimitar': { type: 'weapon', damage: '1d6 slashing', weight: 3, cost: 25, desc: 'Finesse, light. Popular with druids and rogues.' },
    'Light Crossbow': { type: 'weapon', damage: '1d8 piercing', range: '80/320 ft', weight: 5, cost: 25, desc: 'Ammunition, loading, two-handed.' },
  };

  const item = BASIC_EQUIPMENT[itemName];
  if (!item) return children;

  const subtitle = item.type === 'armor' 
    ? `${item.armor_type} armor · AC ${item.ac || '?'}${item.ac === 2 ? ' bonus' : ''}${item.weight ? ` · ${item.weight}lb` : ''}`
    : item.type === 'weapon'
    ? `${item.damage || '?'}${item.range ? ` · ${item.range}` : ''}${item.weight ? ` · ${item.weight}lb` : ''}`
    : item.weight ? `${item.weight}lb` : '';

  return (
    <GameTooltip
      position={position}
      maxWidth={300}
      title={itemName}
      subtitle={subtitle}
      icon={item.type === 'armor' ? '🛡️' : item.type === 'weapon' ? '⚔️' : '📦'}
      content={
        <div className="space-y-1">
          <p className="text-xs leading-relaxed">{item.desc}</p>
          {item.cost && (
            <div className="text-xs" style={{ color: 'rgba(251,191,36,0.7)' }}>
              Value: {item.cost} gp
            </div>
          )}
        </div>
      }>
      {children}
    </GameTooltip>
  );
}