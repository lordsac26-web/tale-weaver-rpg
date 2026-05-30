import React from 'react';
import { BookOpen, Check } from 'lucide-react';
import { getSpellsForClass, getMaxSpellLevel, SPELL_DETAILS, SCHOOL_COLORS } from './spellData';

// Number of NEW spells a class may learn when reaching `newLevel`.
// Simplified: known-spell casters learn 1 new spell per level; cantrips at key levels.
const CANTRIP_GAIN_LEVELS = { 4: 1, 10: 1 };

/**
 * Lets the player pick new spells when leveling up.
 * - newCantrips: how many cantrips can be chosen this level
 * - newSpells: how many leveled spells can be chosen this level
 * Selections are reported back via onChange({ cantrips: [], spells: [] }).
 */
export default function SpellSelectionStep({ character, newLevel, selection, onChange }) {
  const charClass = character.class;
  const available = getSpellsForClass(charClass, newLevel);
  const maxLevel = getMaxSpellLevel(charClass, newLevel);
  const known = new Set(character.spells_known || []);

  // No spellcasting for this class
  if (!available || (!available.cantrips?.length && Object.keys(available).filter(k => k !== 'cantrips').length === 0)) {
    return null;
  }

  const newCantrips = CANTRIP_GAIN_LEVELS[newLevel] || 0;
  const newSpells = 1; // one new leveled spell per level for simplicity

  const cantripList = (available.cantrips || []).filter(s => !known.has(s));
  const leveledList = [];
  for (let l = 1; l <= maxLevel; l++) {
    (available[l] || []).forEach(s => { if (!known.has(s)) leveledList.push({ name: s, level: l }); });
  }

  const toggle = (group, name, max) => {
    const current = selection[group] || [];
    let next;
    if (current.includes(name)) next = current.filter(n => n !== name);
    else if (current.length < max) next = [...current, name];
    else next = current; // at limit
    onChange({ ...selection, [group]: next });
  };

  if (newCantrips === 0 && newSpells === 0) return null;

  const SpellButton = ({ name, level, group, max }) => {
    const picked = (selection[group] || []).includes(name);
    const detail = SPELL_DETAILS[name] || {};
    const schoolColor = SCHOOL_COLORS[detail.school] || '';
    return (
      <button onClick={() => toggle(group, name, max)}
        className="w-full text-left p-2.5 rounded-lg transition-all flex items-start justify-between gap-2"
        style={picked ? {
          background: 'rgba(80,30,120,0.6)', border: '1px solid rgba(160,100,240,0.6)', color: '#dfc8ff'
        } : {
          background: 'rgba(20,10,35,0.5)', border: '1px solid rgba(120,70,200,0.2)', color: 'rgba(192,132,252,0.7)'
        }}>
        <div className="min-w-0">
          <div className="font-fantasy font-bold text-sm flex items-center gap-2">
            {name}
            {level > 0 && <span className="text-xs opacity-60">Lv.{level}</span>}
          </div>
          {detail.school && (
            <div className={`text-xs ${schoolColor}`} style={{ fontFamily: 'EB Garamond, serif' }}>
              {detail.school}{detail.damage_dice ? ` · ${detail.damage_dice} ${detail.damage_type || ''}` : ''}
            </div>
          )}
        </div>
        {picked && <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#86efac' }} />}
      </button>
    );
  };

  return (
    <div className="rounded-xl p-4 rune-border"
      style={{ background: 'rgba(40,20,70,0.3)', border: '1px solid rgba(150,90,230,0.3)' }}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: '#c4b5fd' }} />
        <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.7)' }}>LEARN NEW SPELLS</span>
      </div>

      {newCantrips > 0 && cantripList.length > 0 && (
        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)', fontFamily: 'EB Garamond, serif' }}>
            Choose {newCantrips} new cantrip{newCantrips > 1 ? 's' : ''} ({(selection.cantrips || []).length}/{newCantrips}):
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {cantripList.map(name => (
              <SpellButton key={name} name={name} level={0} group="cantrips" max={newCantrips} />
            ))}
          </div>
        </div>
      )}

      {newSpells > 0 && leveledList.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)', fontFamily: 'EB Garamond, serif' }}>
            Choose {newSpells} new spell{newSpells > 1 ? 's' : ''} ({(selection.spells || []).length}/{newSpells}):
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {leveledList.map(({ name, level }) => (
              <SpellButton key={name} name={name} level={level} group="spells" max={newSpells} />
            ))}
          </div>
        </div>
      )}

      {cantripList.length === 0 && leveledList.length === 0 && (
        <p className="text-xs text-center py-3" style={{ color: 'rgba(196,181,253,0.4)' }}>
          You already know all available spells for your class.
        </p>
      )}
    </div>
  );
}

// Exposed so LevelUpModal knows how many spells must be picked before confirming.
export function getRequiredSpellCounts(character, newLevel) {
  const available = getSpellsForClass(character.class, newLevel);
  const hasCasting = available && (available.cantrips?.length || Object.keys(available).some(k => k !== 'cantrips'));
  if (!hasCasting) return { cantrips: 0, spells: 0 };
  const known = new Set(character.spells_known || []);
  const cantripList = (available.cantrips || []).filter(s => !known.has(s));
  const maxLevel = getMaxSpellLevel(character.class, newLevel);
  let leveledRemaining = 0;
  for (let l = 1; l <= maxLevel; l++) {
    leveledRemaining += (available[l] || []).filter(s => !known.has(s)).length;
  }
  return {
    cantrips: Math.min(CANTRIP_GAIN_LEVELS[newLevel] || 0, cantripList.length),
    spells: Math.min(1, leveledRemaining),
  };
}