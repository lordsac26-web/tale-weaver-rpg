import React, { useState } from 'react';
import { Package, Sparkles, Check } from 'lucide-react';
import { CLASSES, BACKGROUNDS } from '@/components/game/gameData';
import { SPELLS_BY_CLASS, SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS, CANTRIPS_KNOWN } from '@/components/game/spellData';

const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'];

const STARTING_EQUIPMENT = {
  Fighter: [
    { name: 'Chain Mail', type: 'armor', weight: 55 },
    { name: 'Longsword', type: 'weapon', weight: 3 },
    { name: "Explorer's Pack", type: 'gear', weight: 59 },
    { name: 'Shield', type: 'armor', weight: 6 },
    { name: 'Handaxe ×2', type: 'weapon', weight: 4 },
  ],
  Rogue: [
    { name: "Thieves' Tools", type: 'tool', weight: 1 },
    { name: 'Short Sword', type: 'weapon', weight: 2 },
    { name: 'Dagger ×2', type: 'weapon', weight: 2 },
    { name: "Burglar's Pack", type: 'gear', weight: 44 },
    { name: 'Leather Armor', type: 'armor', weight: 10 },
  ],
  Wizard: [
    { name: 'Quarterstaff', type: 'weapon', weight: 4 },
    { name: 'Spellbook', type: 'focus', weight: 3 },
    { name: "Scholar's Pack", type: 'gear', weight: 22 },
    { name: 'Component Pouch', type: 'focus', weight: 2 },
    { name: 'Arcane Focus', type: 'focus', weight: 1 },
  ],
  Cleric: [
    { name: 'Mace', type: 'weapon', weight: 4 },
    { name: 'Chain Mail', type: 'armor', weight: 55 },
    { name: 'Holy Symbol', type: 'focus', weight: 1 },
    { name: "Priest's Pack", type: 'gear', weight: 24 },
    { name: 'Shield', type: 'armor', weight: 6 },
  ],
  Ranger: [
    { name: 'Scale Mail', type: 'armor', weight: 45 },
    { name: 'Shortbow + 20 Arrows', type: 'weapon', weight: 3 },
    { name: 'Short Sword ×2', type: 'weapon', weight: 4 },
    { name: "Dungeoneer's Pack", type: 'gear', weight: 61 },
  ],
  Paladin: [
    { name: 'Chain Mail', type: 'armor', weight: 55 },
    { name: 'Longsword', type: 'weapon', weight: 3 },
    { name: 'Shield', type: 'armor', weight: 6 },
    { name: 'Holy Symbol', type: 'focus', weight: 1 },
    { name: "Priest's Pack", type: 'gear', weight: 24 },
  ],
  Barbarian: [
    { name: 'Greataxe', type: 'weapon', weight: 7 },
    { name: 'Handaxe ×2', type: 'weapon', weight: 4 },
    { name: "Explorer's Pack", type: 'gear', weight: 59 },
    { name: 'Javelin ×4', type: 'weapon', weight: 8 },
  ],
  Bard: [
    { name: 'Rapier', type: 'weapon', weight: 2 },
    { name: 'Lute', type: 'focus', weight: 2 },
    { name: "Diplomat's Pack", type: 'gear', weight: 36 },
    { name: 'Leather Armor', type: 'armor', weight: 10 },
    { name: 'Dagger', type: 'weapon', weight: 1 },
  ],
  Druid: [
    { name: 'Wooden Shield', type: 'armor', weight: 6 },
    { name: 'Scimitar', type: 'weapon', weight: 3 },
    { name: 'Druidic Focus', type: 'focus', weight: 1 },
    { name: "Explorer's Pack", type: 'gear', weight: 59 },
    { name: 'Leather Armor', type: 'armor', weight: 10 },
  ],
  Monk: [
    { name: 'Short Sword', type: 'weapon', weight: 2 },
    { name: "Dungeoneer's Pack", type: 'gear', weight: 61 },
    { name: 'Dart ×10', type: 'weapon', weight: 2.5 },
  ],
  Sorcerer: [
    { name: 'Light Crossbow + 20 Bolts', type: 'weapon', weight: 7 },
    { name: 'Component Pouch', type: 'focus', weight: 2 },
    { name: "Dungeoneer's Pack", type: 'gear', weight: 61 },
    { name: 'Dagger ×2', type: 'weapon', weight: 2 },
    { name: 'Arcane Focus', type: 'focus', weight: 1 },
  ],
  Warlock: [
    { name: 'Light Crossbow + 20 Bolts', type: 'weapon', weight: 7 },
    { name: 'Arcane Focus', type: 'focus', weight: 1 },
    { name: "Scholar's Pack", type: 'gear', weight: 22 },
    { name: 'Leather Armor', type: 'armor', weight: 10 },
    { name: 'Dagger ×2', type: 'weapon', weight: 2 },
  ],
};

const ITEM_ICONS = { armor: '🛡️', weapon: '⚔️', focus: '🔮', gear: '🎒', tool: '🔧' };
const STARTING_GOLD = { Fighter: 175, Rogue: 100, Wizard: 100, Cleric: 125, Ranger: 125, Paladin: 150, Barbarian: 75, Bard: 125, Druid: 50, Monk: 12, Sorcerer: 75, Warlock: 100 };

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th'];

export default function StepEquipmentSpells({ character, set }) {
  const [activeTab, setActiveTab] = useState('equipment');
  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const classEquipment = STARTING_EQUIPMENT[character.class] || [];
  const bgData = BACKGROUNDS.find(b => b.name === character.background);
  const bgEquipment = (bgData?.equipment || []).map(e => ({ name: e, type: 'gear', weight: 1 }));

  // Initialize equipment if needed
  const equipment = character.inventory?.length > 0 ? character.inventory : [...classEquipment, ...bgEquipment];
  if (character.inventory?.length === 0 && equipment.length > 0) {
    set('inventory', equipment);
    set('gold', STARTING_GOLD[character.class] || 50);
  }

  // Spell selection with proper 5e limits
  const charLevel = character.level || 1;
  const classSpells = SPELLS_BY_CLASS[character.class] || {};
  const selectedSpells = new Set(character.spells_known || []);

  // Cantrips known (from spellData)
  const maxCantrips = CANTRIPS_KNOWN[character.class]?.[charLevel - 1] || 0;

  // Spells known limits per 5e PHB (only for classes that "know" spells)
  // Full casters that KNOW spells: Wizard, Sorcerer, Bard
  // Full casters that PREPARE spells: Cleric, Druid, Paladin (half), Ranger (half)
  // Warlock: Special - knows spells but has pact slots
  const getMaxSpellsKnown = () => {
    const class_ = character.class;
    if (class_ === 'Wizard') return 6 + charLevel; // PHB p114
    if (class_ === 'Sorcerer') return Math.ceil(charLevel / 2) + charLevel; // PHB p102
    if (class_ === 'Bard') return Math.ceil(charLevel / 2) + charLevel; // PHB p54
    if (class_ === 'Warlock') return Math.ceil(charLevel / 2) + 1; // PHB p107 (Invocations + spells known)
    // Prepared casters (Cleric, Druid, Paladin, Ranger) don't have a "spells known" limit
    // They prepare from entire class list - allow free selection
    return 999; // No practical limit for prepared casters
  };

  const maxSpellsKnown = getMaxSpellsKnown();

  // Count selected spells by level
  const getCantripCount = () => [...selectedSpells].filter(s => {
    const spell = SPELL_DETAILS[s];
    return spell && spell.level === 0;
  }).length;

  const getSpellCountByLevel = (spellLevel) => [...selectedSpells].filter(s => {
    const spell = SPELL_DETAILS[s];
    return spell && spell.level === spellLevel;
  }).length;

  const getTotalSpellCount = () => [...selectedSpells].filter(s => {
    const spell = SPELL_DETAILS[s];
    return spell && spell.level > 0;
  }).length;

  const cantripCount = getCantripCount();
  const totalSpellCount = getTotalSpellCount();

  const toggleSpell = (name, level) => {
    const spell = SPELL_DETAILS[name];
    if (!spell) return; // Safety check

    const updated = new Set(selectedSpells);
    if (updated.has(name)) {
      updated.delete(name);
    } else {
      // Check cantrip limit
      if (level === 0) {
        const currentCantripCount = [...updated].filter(s => SPELL_DETAILS[s]?.level === 0).length;
        if (currentCantripCount >= maxCantrips && maxCantrips > 0) return;
      } else {
        // Check spell-known limit (only for classes that have it)
        const currentSpellCount = [...updated].filter(s => {
          const sp = SPELL_DETAILS[s];
          return sp && sp.level > 0;
        }).length;
        if (currentSpellCount >= maxSpellsKnown) return;
      }
      updated.add(name);
    }
    set('spells_known', [...updated]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Equipment {isCaster ? '& Spells' : ''}</h2>
        <p className="text-amber-400/50 text-sm">Starting gear based on your class and background.</p>
      </div>

      {isCaster && (
        <div className="flex gap-1 bg-slate-800/40 p-1 rounded-xl">
          {[['equipment', '🎒 Equipment'], ['spells', '🔮 Spells']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${activeTab === key ? 'bg-amber-900/40 text-amber-200 border border-amber-700/40' : 'text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-yellow-400 font-bold">💰 {STARTING_GOLD[character.class] || 50} gp</span>
            <span className="text-slate-500">starting gold</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[...classEquipment, ...bgEquipment].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
                <span className="text-xl">{ITEM_ICONS[item.type] || '📦'}</span>
                <div>
                  <div className="text-amber-200 text-sm font-medium">{item.name}</div>
                  <div className="text-slate-500 text-xs capitalize">{item.type} · {item.weight}lb</div>
                </div>
                {bgEquipment.includes(item) && <span className="ml-auto text-xs text-blue-400">Background</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spells Tab */}
      {activeTab === 'spells' && isCaster && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm">
            {maxCantrips > 0 && (
              <span className={`px-3 py-1 rounded-lg border ${cantripCount >= maxCantrips ? 'border-green-600/50 bg-green-900/20 text-green-300' : 'border-slate-600 text-slate-400'}`}>
                Cantrips: {cantripCount}/{maxCantrips}
              </span>
            )}
            <span className={`px-3 py-1 rounded-lg border ${spellCount >= maxSpellsKnown ? 'border-purple-600/50 bg-purple-900/20 text-purple-300' : 'border-slate-600 text-slate-400'}`}>
              Spells: {spellCount}/{maxSpellsKnown}
            </span>
          </div>

          {[0,1,2,3,4,5].map(level => {
            const spells = classSpells[level === 0 ? 'cantrips' : level] || [];
            if (spells.length === 0) return null;
            const isLevelLocked = level > 0 && spellCount >= maxSpellsKnown;
            const isCantripLocked = level === 0 && cantripCount >= maxCantrips;

            return (
              <div key={level}>
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span>{LEVEL_LABELS[level]} {level > 0 ? 'Level' : ''}</span>
                  {level > 0 && <span className="text-purple-400">(choose freely)</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {spells.map(name => {
                    const details = SPELL_DETAILS[name];
                    const isSelected = selectedSpells.has(name);
                    const locked = !isSelected && (level === 0 ? isCantripLocked : isLevelLocked);
                    const dmgColor = DAMAGE_TYPE_COLORS[details?.damage_type] || 'text-amber-300';

                    return (
                      <button key={name}
                        onClick={() => !locked && toggleSpell(name, level)}
                        disabled={locked}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                          isSelected ? 'border-purple-500 bg-purple-900/20' :
                          locked ? 'border-slate-700/20 opacity-40 cursor-not-allowed' :
                          'border-slate-700/40 hover:border-purple-600/40'
                        }`}>
                        <span className="text-sm">{details?.attack_type === 'healing' ? '💚' : details?.attack_type === 'saving_throw' ? '🎲' : details?.is_utility ? '🔧' : '🎯'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-200 truncate">{name}</div>
                          {details && (
                            <div className="text-xs text-slate-500">
                              {details.school && <span className={`${SCHOOL_COLORS[details.school] || 'text-slate-500'}`}>{details.school}</span>}
                              {details.damage_dice && details.damage_dice !== '0' && <span className={`ml-1 ${dmgColor}`}>{details.damage_dice}</span>}
                            </div>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}