import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, ChevronDown, ChevronUp, Sparkles, ShieldCheck, X, FlaskConical } from 'lucide-react';
import ConsumableUseModal from './ConsumableUseModal';
import AddItemForm from './AddItemForm';
import {
  ITEM_RARITY, EQUIP_SLOTS, CATEGORY_TO_SLOT, ALL_ITEM_CATEGORIES, CATEGORY_ICONS,
  MAGIC_PROPERTIES, getEquipConstraints, computeAC
} from './itemData';
import { motion, AnimatePresence } from 'framer-motion';
import { parseItemBonuses } from './itemBonuses';

const RARITIES = Object.keys(ITEM_RARITY);

// ─── Currency Panel ────────────────────────────────────────────────────────────
function CurrencyPanel({ character, onUpdate }) {
  const [editing, setEditing] = useState(false);
  // Derive live values from character prop so loot updates are immediately reflected
  const [values, setValues] = useState({ gold: character.gold || 0, silver: character.silver || 0, copper: character.copper || 0 });
  // Sync if character prop changes (e.g. after looting)
  useEffect(() => {
    if (!editing) {
      setValues({ gold: character.gold || 0, silver: character.silver || 0, copper: character.copper || 0 });
    }
  }, [character.gold, character.silver, character.copper]);

  const convertAll = () => {
    const totalCopper = values.gold * 1000 + values.silver * 100 + values.copper;
    const updated = {
      gold: Math.floor(totalCopper / 1000),
      silver: Math.floor((totalCopper % 1000) / 100),
      copper: totalCopper % 100,
    };
    setValues(updated); onUpdate(updated); setEditing(false);
  };

  const save = () => { onUpdate(values); setEditing(false); };

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.18)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.65rem' }}>TREASURY</span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={convertAll} className="text-xs font-fantasy" style={{ color: '#93c5fd' }}>Convert</button>
              <button onClick={save} className="text-xs font-fantasy" style={{ color: '#86efac' }}>Save</button>
              <button onClick={() => setEditing(false)} className="text-xs font-fantasy" style={{ color: 'rgba(180,140,90,0.4)' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.4)' }}>Edit</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'gold',   label: 'Gold',   color: '#f0c040', bg: 'rgba(60,40,5,0.5)',  border: 'rgba(201,169,110,0.25)' },
          { key: 'silver', label: 'Silver', color: '#e2e8f0', bg: 'rgba(30,30,40,0.5)', border: 'rgba(150,160,180,0.2)' },
          { key: 'copper', label: 'Copper', color: '#fb923c', bg: 'rgba(40,20,5,0.5)',  border: 'rgba(180,80,30,0.25)' },
        ].map(({ key, label, color, bg, border }) => (
          <div key={key} className="rounded-lg p-2 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xs mb-0.5" style={{ color: 'rgba(180,150,100,0.45)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
            {editing ? (
              <input type="number" min="0" value={values[key]}
                onChange={e => setValues(v => ({ ...v, [key]: parseInt(e.target.value) || 0 }))}
                className="w-full text-center bg-transparent outline-none font-fantasy font-bold text-base" style={{ color }} />
            ) : (
              <div className="font-fantasy font-bold text-base" style={{ color }}>{values[key] || 0}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Equipped Paperdoll ────────────────────────────────────────────────────────
function EquipmentPaperdoll({ equipped, onUnequip }) {
  const slotOrder = ['helmet','cloak','amulet','mainhand','armor','offhand','gloves','ring','ring2','belt','boots','trinket'];
  const hasAny = Object.values(equipped).some(Boolean);
  if (!hasAny) return null;

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(10,25,15,0.5)', border: '1px solid rgba(40,160,80,0.18)' }}>
      <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(86,239,172,0.45)', fontSize: '0.65rem' }}>EQUIPPED</div>
      <div className="grid grid-cols-2 gap-1.5">
        {slotOrder.map(slot => {
          const item = equipped[slot];
          if (!item) return null;
          const slotDef = EQUIP_SLOTS[slot];
          const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
          return (
            <div key={slot} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(10,20,10,0.5)', border: `1px solid ${rarity.border}` }}>
              <span className="text-sm flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate" style={{ color: rarity.color, fontFamily: 'EB Garamond, serif' }}>{item.name}</div>
                <div className="text-xs" style={{ color: 'rgba(180,140,90,0.3)', fontSize: '0.6rem' }}>{slotDef?.label}</div>
              </div>
              <button onClick={() => onUnequip(slot)}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
                style={{ color: 'rgba(180,60,60,0.5)' }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Item Rarity Badge ─────────────────────────────────────────────────────────
function RarityBadge({ rarity }) {
  const r = ITEM_RARITY[rarity] || ITEM_RARITY.common;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
      style={{ background: `${r.glow}`, border: `1px solid ${r.border}`, color: r.color, fontSize: '0.6rem' }}>
      {r.icon} {r.label}
    </span>
  );
}

// ─── Magic Property Badge ──────────────────────────────────────────────────────
function MagicPropBadge({ propKey }) {
  const prop = MAGIC_PROPERTIES[propKey];
  if (!prop) return null;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
      style={{ background: 'rgba(80,30,120,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: '#d4b3ff', fontSize: '0.6rem' }}
      title={prop.desc}>
      {prop.label}
    </span>
  );
}

// ─── Item Row ──────────────────────────────────────────────────────────────────
const CONSUMABLE_CATEGORIES = ['Potion', 'Ammunition', 'Adventuring Gear'];

function ItemRow({ item, origIndex, equipped, onEquip, onRemove, onIdentify, onUseConsumable }) {
  const [expanded, setExpanded] = useState(false);
  const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
  const slot = item.equip_slot || CATEGORY_TO_SLOT[item.category];
  const canEquip = !!slot;
  const isEquipped = canEquip && Object.entries(equipped).some(([s, i]) => i && i === item);
  const isUnidentifiedMagic = item.is_magic && !item.is_identified;
  const isConsumable = CONSUMABLE_CATEGORIES.includes(item.category);

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={isEquipped ? { background: 'rgba(10,35,12,0.6)', border: `1px solid ${rarity.border}` } :
        { background: 'rgba(15,10,5,0.55)', border: `1px solid rgba(180,140,90,0.1)` }}>
      <div className="flex items-center gap-2 p-2.5">
        <span className="text-base flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium" style={{ color: rarity.color, fontFamily: 'EB Garamond, serif' }}>{item.name}</span>
            {item.quantity > 1 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>×{item.quantity}</span>}
            <RarityBadge rarity={item.rarity || 'common'} />
            {item.requires_attunement && <span className="text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(60,20,80,0.5)', border: '1px solid rgba(160,80,220,0.3)', color: '#c4b5fd', fontSize: '0.58rem' }}>Attune</span>}
            {isEquipped && <span className="text-xs px-1.5 py-0.5 rounded-full badge-green">Equipped</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>{item.category}</span>
            {item.weight > 0 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.3)' }}>{item.weight}lb</span>}
            {item.cost > 0 && <span className="text-xs" style={{ color: '#d97706' }}>{item.cost}{item.cost_unit}</span>}
            {item.damage && <span className="text-xs" style={{ color: '#fca5a5' }}>{item.damage}</span>}
            {item.armor_class > 0 && <span className="text-xs" style={{ color: '#93c5fd' }}>AC {item.armor_class}</span>}
            {item.attack_bonus > 0 && <span className="text-xs" style={{ color: '#86efac' }}>+{item.attack_bonus} atk</span>}
            {item.is_magic && <Sparkles className="w-3 h-3" style={{ color: '#c084fc' }} />}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(item.magic_properties?.length > 0 || item.description) && (
            <button onClick={() => setExpanded(v => !v)} className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.4)' }}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {isUnidentifiedMagic && (
           <button onClick={() => onIdentify?.(item)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={{ background: 'rgba(80,30,120,0.5)', border: '1px solid rgba(140,80,220,0.4)', color: '#d4b3ff' }}
             title="Identify Item">
             <Sparkles className="w-3.5 h-3.5" />
           </button>
          )}
          {isConsumable && (
           <button onClick={() => onUseConsumable?.(item, origIndex)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={{ background: 'rgba(10,40,15,0.5)', border: '1px solid rgba(40,160,80,0.3)', color: '#86efac' }}
             title="Use Item">
             <FlaskConical className="w-3.5 h-3.5" />
           </button>
          )}
          {canEquip && (
           <button onClick={() => onEquip(item, origIndex, slot)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={isEquipped ? {
               background: 'rgba(10,50,15,0.6)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac'
             } : {
               background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)'
             }}
             title={isEquipped ? 'Unequip' : `Equip (${EQUIP_SLOTS[slot]?.label})`}>
             <ShieldCheck className="w-3.5 h-3.5" />
           </button>
          )}
          <button onClick={() => onRemove(origIndex)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(180,60,60,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(80,10,10,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(180,60,60,0.4)'; e.currentTarget.style.background = 'transparent'; }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-3 pb-2">
            {item.magic_properties?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {item.magic_properties.map(p => <MagicPropBadge key={p} propKey={p} />)}
              </div>
            )}
            {item.description && (
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {item.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main InventoryTab ─────────────────────────────────────────────────────────
export default function InventoryTab({ character, onUpdate, onIdentify }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [equipped, setEquipped] = useState(character.equipped || {});
  const [consumableModal, setConsumableModal] = useState(null); // { item, index }

  const inventory = character.inventory || [];

  const handleAddItem = (item) => {
    const newInventory = [...inventory, item];
    onUpdate({ inventory: newInventory });
    setShowAddForm(false);
  };

  const handleRemoveItem = (index) => {
    const removedItem = inventory[index];
    const newInventory = inventory.filter((_, i) => i !== index);
    // also unequip if equipped
    const newEquipped = { ...equipped };
    Object.entries(newEquipped).forEach(([slot, it]) => {
      if (it && it === removedItem) delete newEquipped[slot];
    });
    setEquipped(newEquipped);
    onUpdate({ inventory: newInventory, equipped: newEquipped });
  };

  const handleEquipItem = (item, index, slot) => {
    const newEquipped = { ...equipped };
    const isCurrentlyEquipped = Object.entries(newEquipped).some(([s, i]) => i && i === item);

    if (isCurrentlyEquipped) {
      // Unequip
      Object.entries(newEquipped).forEach(([s, i]) => { if (i === item) delete newEquipped[s]; });
    } else {
      const constraint = getEquipConstraints(newEquipped, item);
      if (!constraint.canEquip) {
        alert(constraint.reason);
        return;
      }
      // For rings, support dual slot
      if (slot === 'ring') {
        if (!newEquipped.ring) newEquipped.ring = item;
        else if (!newEquipped.ring2) newEquipped.ring2 = item;
        else newEquipped.ring = item; // replace first
      } else {
        newEquipped[slot] = item;
      }
      // Handle two-handed: clear offhand
      const isTwoHanded = (item.magic_properties || []).includes('Two-Handed') || item.properties?.includes('Two-Handed');
      if (slot === 'mainhand' && isTwoHanded) delete newEquipped.offhand;
    }

    // Recalculate stats — recalculateStatsFromEquipment sets updates.equipped internally
    const updates = recalculateStatsFromEquipment(character, newEquipped, inventory);
    setEquipped(newEquipped);
    onUpdate(updates);
  };

  const handleUseConsumable = (item, index) => {
    setConsumableModal({ item, index });
  };

  const handleConsumableUsed = (item, updates) => {
    // Consume 1 quantity or remove entirely
    const inventory = character.inventory || [];
    const idx = consumableModal.index;
    let newInventory;
    if ((item.quantity || 1) > 1) {
      newInventory = inventory.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it);
    } else {
      newInventory = inventory.filter((_, i) => i !== idx);
    }
    onUpdate({ ...updates, inventory: newInventory });
    setConsumableModal(null);
  };

  const handleUnequip = (slot) => {
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    const updates = recalculateStatsFromEquipment(character, newEquipped, inventory);
    setEquipped(newEquipped);
    onUpdate(updates);
  };

  const sorted = [...inventory]
    .filter(it => filterCategory === 'all' || it.category === filterCategory)
    .filter(it => filterRarity === 'all' || it.rarity === filterRarity)
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'rarity') {
        const order = ['common','uncommon','rare','epic','legendary','artifact','wondrous'];
        return order.indexOf(b.rarity) - order.indexOf(a.rarity);
      }
      if (sortBy === 'weight') return (b.weight || 0) - (a.weight || 0);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

  const totalWeight = inventory.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);
  const magicCount = inventory.filter(it => it.is_magic || it.rarity !== 'common').length;
  const carryCapacity = (character.strength || 10) * 15;
  const encumbranceLevel = totalWeight > carryCapacity ? 'heavy'
    : totalWeight > carryCapacity * 0.666 ? 'encumbered' : 'normal';

  return (
    <div className="space-y-2">
      <CurrencyPanel character={character} onUpdate={onUpdate} />

      {/* Encumbrance bar */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(20,13,5,0.7)', border: `1px solid ${encumbranceLevel === 'heavy' ? 'rgba(220,50,50,0.4)' : encumbranceLevel === 'encumbered' ? 'rgba(220,150,20,0.3)' : 'rgba(180,140,90,0.15)'}` }}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.62rem' }}>CARRY WEIGHT</span>
          <span className="text-xs font-fantasy" style={{ color: encumbranceLevel === 'heavy' ? '#fca5a5' : encumbranceLevel === 'encumbered' ? '#fde68a' : 'rgba(134,239,172,0.7)' }}>
            {totalWeight.toFixed(1)} / {carryCapacity} lb
            {encumbranceLevel === 'heavy' && ' ⚠ Heavily Encumbered'}
            {encumbranceLevel === 'encumbered' && ' ⚠ Encumbered'}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(8,4,1,0.7)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (totalWeight / carryCapacity) * 100)}%`,
              background: encumbranceLevel === 'heavy' ? 'linear-gradient(90deg, #7f1d1d, #dc2626)'
                : encumbranceLevel === 'encumbered' ? 'linear-gradient(90deg, #b45309, #d97706)'
                : 'linear-gradient(90deg, #166534, #22c55e)'
            }} />
        </div>
        {encumbranceLevel === 'encumbered' && (
          <p className="text-xs mt-1" style={{ color: 'rgba(253,230,138,0.6)', fontFamily: 'EB Garamond, serif' }}>−10 ft speed penalty</p>
        )}
        {encumbranceLevel === 'heavy' && (
          <p className="text-xs mt-1" style={{ color: 'rgba(252,165,165,0.6)', fontFamily: 'EB Garamond, serif' }}>−20 ft speed, disadvantage on STR/DEX/CON checks</p>
        )}
      </div>

      <EquipmentPaperdoll equipped={equipped} onUnequip={handleUnequip} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Types</option>
          {ALL_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
        <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Rarities</option>
          {RARITIES.map(r => <option key={r} value={r}>{ITEM_RARITY[r].icon} {ITEM_RARITY[r].label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="name">Name</option>
          <option value="rarity">Rarity</option>
          <option value="category">Type</option>
          <option value="weight">Weight</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          {inventory.length} items{magicCount > 0 ? ` · ${magicCount} ✨` : ''} · {totalWeight.toFixed(1)}lb
        </span>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AddItemForm onAdd={handleAddItem} onCancel={() => setShowAddForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item List */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-2">
          <Package className="w-10 h-10 opacity-10" style={{ color: '#c9a96e' }} />
          <span className="text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>
            {filterCategory !== 'all' || filterRarity !== 'all' ? 'No items match filters' : 'Your satchel is empty'}
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
           {sorted.map((item, i) => {
             const origIndex = inventory.indexOf(item);
             return (
               <ItemRow key={i} item={item} origIndex={origIndex}
                 equipped={equipped} onEquip={handleEquipItem} onRemove={handleRemoveItem}
                 onIdentify={onIdentify} onUseConsumable={handleUseConsumable} />
             );
           })}
         </div>
      )}

      <ConsumableUseModal
        item={consumableModal?.item}
        character={character}
        onUse={handleConsumableUsed}
        onClose={() => setConsumableModal(null)}
      />
    </div>
  );
}

// Recalculate character stats based on equipped items
function recalculateStatsFromEquipment(character, equipped, inventory) {
  const updates = {};
  let acBonus = 0;
  let savingThrowBonus = 0;
  const abilityBonuses = {};

  Object.entries(equipped).forEach(([slot, item]) => {
    if (!item) return;

    // Auto-parse bonuses from name/description if not cached
    if (!item.bonuses) {
      const parsed = parseItemBonuses(item.name || '', item.description || '');
      if (parsed) item.bonuses = parsed;
    }

    const bonuses = item.bonuses || {};
    if (bonuses.ac) acBonus += bonuses.ac;
    if (bonuses.saving_throws) savingThrowBonus += bonuses.saving_throws;
    if (bonuses.ability_scores) {
      Object.entries(bonuses.ability_scores).forEach(([stat, val]) => {
        abilityBonuses[stat] = Math.max(abilityBonuses[stat] || 0, val);
      });
    }
  });

  // Apply ability score bonuses (set-type items like Headband of Intellect)
  ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(stat => {
    if (abilityBonuses[stat]) {
      updates[stat] = abilityBonuses[stat];
    }
  });

  // Recalculate AC from armor/shield
  updates.armor_class = computeAC(character, equipped) + acBonus;

  // Expose equipped weapon on character.equipped.weapon for CombatPanel to read
  // Normalize: weapon slot can be 'mainhand' or 'weapon' depending on item
  const weaponItem = equipped.mainhand || equipped.weapon || null;
  if (weaponItem) {
    // Build a combat-ready weapon descriptor
    const dmgStr = weaponItem.damage || weaponItem.damage_dice || '1d6';
    const [dice, ...rest] = dmgStr.split(' ');
    updates.equipped = {
      ...equipped,
      weapon: {
        ...weaponItem,
        damage_dice: dice || '1d6',
        damage_type: weaponItem.damage_type || rest.join(' ') || 'slashing',
        attack_bonus: weaponItem.attack_bonus || 0,
        damage_bonus: weaponItem.damage_bonus || 0,
        type: weaponItem.type || 'melee',
        finesse: weaponItem.finesse || ['rapier','shortsword','dagger','hand crossbow','whip','scimitar'].includes((weaponItem.name || '').toLowerCase()),
      }
    };
  } else {
    updates.equipped = equipped;
  }

  // Store equipment bonuses as active_modifiers
  const modifiers = [];
  if (savingThrowBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'saving_throws', value: savingThrowBonus });
  updates.active_modifiers = [
    ...(character.active_modifiers || []).filter(m => m.source !== 'equipment'),
    ...modifiers,
  ];

  return updates;
}