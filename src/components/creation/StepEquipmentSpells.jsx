import React, { useState } from 'react';
import { Package, Sparkles, Check, ShoppingCart } from 'lucide-react';
import { CLASSES, BACKGROUNDS } from '@/components/game/gameData';
import { SPELLS_BY_CLASS, SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS, CANTRIPS_KNOWN } from '@/components/game/spellData';
import { EquipmentTooltip } from '@/components/game/GameTooltip';
import { ALL_STANDARD_ITEMS } from '@/components/game/standardItems';
import StartingGearPicker from './StartingGearPicker';

const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'];

// Starting equipment defined by item name + quantity.
// resolveStartingGear() below matches these to the full standardItems database.
const STARTING_EQUIPMENT_DEFS = {
  Fighter: [
    { name: 'Chain Mail', qty: 1 },
    { name: 'Longsword', qty: 1 },
    { name: "Explorer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 59 } },
    { name: 'Shield', qty: 1 },
    { name: 'Handaxe', qty: 2 },
  ],
  Rogue: [
    { name: "Thieves' Tools", qty: 1 },
    { name: 'Shortsword', qty: 1 },
    { name: 'Dagger', qty: 2 },
    { name: "Burglar's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 44 } },
    { name: 'Leather Armor', qty: 1 },
  ],
  Wizard: [
    { name: 'Quarterstaff', qty: 1 },
    { name: 'Spellbook', qty: 1 },
    { name: "Scholar's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 22 } },
    { name: 'Component Pouch', qty: 1 },
    { name: 'Arcane Focus (Crystal)', qty: 1 },
  ],
  Cleric: [
    { name: 'Mace', qty: 1 },
    { name: 'Chain Mail', qty: 1 },
    { name: 'Holy Symbol', qty: 1 },
    { name: "Priest's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 24 } },
    { name: 'Shield', qty: 1 },
  ],
  Ranger: [
    { name: 'Scale Mail', qty: 1 },
    { name: 'Shortbow', qty: 1 },
    { name: 'Arrows (20)', qty: 1 },
    { name: 'Shortsword', qty: 2 },
    { name: "Dungeoneer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 61 } },
  ],
  Paladin: [
    { name: 'Chain Mail', qty: 1 },
    { name: 'Longsword', qty: 1 },
    { name: 'Shield', qty: 1 },
    { name: 'Holy Symbol', qty: 1 },
    { name: "Priest's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 24 } },
  ],
  Barbarian: [
    { name: 'Greataxe', qty: 1 },
    { name: 'Handaxe', qty: 2 },
    { name: "Explorer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 59 } },
    { name: 'Javelin', qty: 4 },
  ],
  Bard: [
    { name: 'Rapier', qty: 1 },
    { name: 'Lute', qty: 1 },
    { name: "Diplomat's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 36 } },
    { name: 'Leather Armor', qty: 1 },
    { name: 'Dagger', qty: 1 },
  ],
  Druid: [
    { name: 'Shield', qty: 1 },
    { name: 'Scimitar', qty: 1 },
    { name: 'Druidic Focus (Sprig of Mistletoe)', qty: 1 },
    { name: "Explorer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 59 } },
    { name: 'Leather Armor', qty: 1 },
  ],
  Monk: [
    { name: 'Shortsword', qty: 1 },
    { name: "Dungeoneer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 61 } },
    { name: 'Dart', qty: 10 },
  ],
  Sorcerer: [
    { name: 'Light Crossbow', qty: 1 },
    { name: 'Bolts (20)', qty: 1 },
    { name: 'Component Pouch', qty: 1 },
    { name: "Dungeoneer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 61 } },
    { name: 'Dagger', qty: 2 },
    { name: 'Arcane Focus (Crystal)', qty: 1 },
  ],
  Warlock: [
    { name: 'Light Crossbow', qty: 1 },
    { name: 'Bolts (20)', qty: 1 },
    { name: 'Arcane Focus (Crystal)', qty: 1 },
    { name: "Scholar's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 22 } },
    { name: 'Leather Armor', qty: 1 },
    { name: 'Dagger', qty: 2 },
  ],
  Artificer: [
    { name: 'Light Crossbow', qty: 1 },
    { name: 'Bolts (20)', qty: 1 },
    { name: "Dungeoneer's Pack", qty: 1, fallback: { category: 'Adventuring Gear', weight: 61 } },
    { name: "Thieves' Tools", qty: 1 },
    { name: 'Leather Armor', qty: 1 },
    { name: 'Dagger', qty: 1 },
  ],
};

/**
 * Resolve starting gear definitions into full item objects from the standardItems database.
 * Each item gets full stats (damage, armor_class, properties, equip_slot, etc.)
 * and a proper `quantity` field instead of "×N" baked into the name.
 */
function resolveStartingGear(defs) {
  if (!defs) return [];
  return defs.map(def => {
    // Try to find the item in the standard database (case-insensitive match)
    const match = ALL_STANDARD_ITEMS.find(i => i.name.toLowerCase() === def.name.toLowerCase());
    if (match) {
      return { ...match, quantity: def.qty || 1 };
    }
    // Fallback: create a basic item with whatever data we have
    return {
      name: def.name,
      category: def.fallback?.category || 'Adventuring Gear',
      weight: def.fallback?.weight || 1,
      cost: 0,
      cost_unit: 'gp',
      rarity: 'common',
      quantity: def.qty || 1,
    };
  });
}

const CATEGORY_ICONS = {
  Weapon: '⚔️', Armor: '🛡️', Shield: '🛡️', Potion: '🧪',
  Ammunition: '🏹', Tool: '🔧', 'Adventuring Gear': '🎒',
};
const getItemIcon = (item) => CATEGORY_ICONS[item.category] || '📦';
const STARTING_GOLD = { Fighter: 175, Rogue: 100, Wizard: 100, Cleric: 125, Ranger: 125, Paladin: 150, Barbarian: 75, Bard: 125, Druid: 50, Monk: 12, Sorcerer: 75, Warlock: 100 };

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th'];

export default function StepEquipmentSpells({ character, set }) {
  const [activeTab, setActiveTab] = useState('equipment');
  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const classEquipment = resolveStartingGear(STARTING_EQUIPMENT_DEFS[character.class]);
  const bgData = BACKGROUNDS.find(b => b.name === character.background);
  // Resolve background equipment through the standard DB too
  const bgEquipment = (bgData?.equipment || []).map(name => {
    const match = ALL_STANDARD_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (match) return { ...match, quantity: 1 };
    return { name, category: 'Adventuring Gear', weight: 1, cost: 0, cost_unit: 'gp', rarity: 'common', quantity: 1 };
  });

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
        <EquipmentSubTab character={character} set={set}
          classEquipment={classEquipment} bgEquipment={bgEquipment} />
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
            {maxSpellsKnown < 999 && (
              <span className={`px-3 py-1 rounded-lg border ${totalSpellCount >= maxSpellsKnown ? 'border-purple-600/50 bg-purple-900/20 text-purple-300' : 'border-slate-600 text-slate-400'}`}>
                Spells Known: {totalSpellCount}/{maxSpellsKnown}
              </span>
            )}
            {character.class && ['Cleric', 'Druid', 'Paladin', 'Ranger'].includes(character.class) && (
              <span className="px-3 py-1 rounded-lg border border-slate-600 text-slate-400 text-xs italic">
                (Prepared caster — select spells now, prepare later)
              </span>
            )}
          </div>

          {[0,1,2,3,4,5].map(level => {
            const spells = classSpells[level === 0 ? 'cantrips' : level] || [];
            if (spells.length === 0) return null;
            const isCantripLocked = level === 0 && cantripCount >= maxCantrips;
            const isSpellLevelLocked = level > 0 && totalSpellCount >= maxSpellsKnown;

            return (
              <div key={level}>
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span>{LEVEL_LABELS[level]} {level > 0 ? 'Level' : ''}</span>
                  {level > 0 && maxSpellsKnown < 999 && <span className="text-purple-400">(limited by spells known)</span>}
                  {level > 0 && maxSpellsKnown >= 999 && <span className="text-blue-400">(choose freely)</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {spells.map(name => {
                    const details = SPELL_DETAILS[name];
                    const isSelected = selectedSpells.has(name);
                    const locked = !isSelected && (level === 0 ? isCantripLocked : isSpellLevelLocked);
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

// ─── Equipment Sub-Tab with Default vs Custom choice ──────────────────────────
function EquipmentSubTab({ character, set, classEquipment, bgEquipment }) {
  const [mode, setMode] = useState('default'); // 'default' | 'custom'
  const allDefaultGear = [...classEquipment, ...bgEquipment];
  const hasCustomized = character._gear_customized;

  const acceptDefault = () => {
    set('inventory', allDefaultGear);
    set('gold', STARTING_GOLD[character.class] || 50);
    set('_gear_customized', false);
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setMode('default'); acceptDefault(); }}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'default'
              ? 'bg-amber-900/40 text-amber-200 border border-amber-700/40'
              : 'text-slate-400 border border-slate-700/30 hover:border-slate-600'
          }`}>
          <Package className="w-4 h-4" />
          Accept Default Gear
        </button>
        <button onClick={() => setMode('custom')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'custom'
              ? 'bg-amber-900/40 text-amber-200 border border-amber-700/40'
              : 'text-slate-400 border border-slate-700/30 hover:border-slate-600'
          }`}>
          <ShoppingCart className="w-4 h-4" />
          Pick Your Own
        </button>
      </div>

      {mode === 'default' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-yellow-400 font-bold">💰 {STARTING_GOLD[character.class] || 50} gp</span>
            <span className="text-slate-500">starting gold</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allDefaultGear.map((item, i) => (
              <EquipmentTooltip key={i} itemName={item.name} position="top">
                <div className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:border-slate-600 transition-all cursor-help">
                  <span className="text-xl">{getItemIcon(item)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-amber-200 text-sm font-medium">
                      {item.name}
                      {(item.quantity || 1) > 1 && <span className="text-amber-400/60 ml-1">×{item.quantity}</span>}
                    </div>
                    <div className="text-slate-500 text-xs flex items-center gap-2">
                      <span className="capitalize">{item.category || 'Gear'}</span>
                      {item.damage && <span className="text-red-400">{item.damage}</span>}
                      {item.armor_class > 0 && <span className="text-blue-400">AC {item.armor_class}</span>}
                      <span>{((item.weight || 0) * (item.quantity || 1)).toFixed(1)}lb</span>
                    </div>
                  </div>
                  {bgEquipment.includes(item) && <span className="ml-auto text-xs text-blue-400 flex-shrink-0">Background</span>}
                </div>
              </EquipmentTooltip>
            ))}
          </div>
          <p className="text-xs text-slate-500 italic">This is the standard starting equipment for your class and background.</p>
        </div>
      )}

      {mode === 'custom' && (
        <div>
          <p className="text-xs text-amber-400/60 mb-3">Spend your starting gold on any equipment you want. Leftover gold is yours to keep.</p>
          <StartingGearPicker
            character={character}
            classGold={STARTING_GOLD[character.class] || 150}
            onUpdateInventory={(items) => { set('inventory', items); set('_gear_customized', true); }}
            onUpdateGold={(gold) => set('gold', gold)}
          />
        </div>
      )}
    </div>
  );
}