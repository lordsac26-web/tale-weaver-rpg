import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, ChevronDown, ChevronUp, Sparkles, ShieldCheck, X, FlaskConical } from 'lucide-react';
import ConsumableUseModal from './ConsumableUseModal';
import AddItemForm from './AddItemForm';
import {
  ITEM_RARITY, EQUIP_SLOTS, CATEGORY_TO_SLOT, ALL_ITEM_CATEGORIES, CATEGORY_ICONS,
  MAGIC_PROPERTIES, getEquipConstraints, computeAC
} from './itemData';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveItemBonuses } from './itemBonuses';

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
const CONSUMABLE_CATEGORIES = ['Potion'];
// Detect consumable items by category or name keywords
const isConsumableItem = (item) => {
  if (CONSUMABLE_CATEGORIES.includes(item.category)) return true;
  const name = (item.name || '').toLowerCase();
  if (name.includes('healer') || name.includes('antitoxin') || name.includes('potion')) return true;
  return false;
};

function ItemRow({ item, origIndex, equipped, onEquip, onRemove, onIdentify, onUseConsumable }) {
  const [expanded, setExpanded] = useState(false);
  const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
  const slot = item.equip_slot || CATEGORY_TO_SLOT[item.category];
  const canEquip = !!slot;
  // Use name-based comparison instead of reference equality — after DB reload, objects are different instances
  const isEquipped = canEquip && Object.entries(equipped).some(([s, i]) => i && s !== 'weapon' && i.name === item.name);
  const isUnidentifiedMagic = item.is_magic && !item.is_identified;
  const isConsumable = isConsumableItem(item);

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
    // also unequip if equipped — use name-based match (not reference equality)
    const newEquipped = { ...equipped };
    Object.entries(newEquipped).forEach(([slot, it]) => {
      if (it && slot !== 'weapon' && it.name === removedItem.name) delete newEquipped[slot];
    });
    setEquipped(newEquipped);
    onUpdate({ inventory: newInventory, equipped: newEquipped });
  };

  const handleEquipItem = (item, index, slot) => {
    const newEquipped = { ...equipped };
    // Use name-based comparison — after DB reload, item objects are different instances
    const isCurrentlyEquipped = Object.entries(newEquipped).some(([s, i]) => i && s !== 'weapon' && i.name === item.name);

    if (isCurrentlyEquipped) {
      // Unequip — match by name, not reference
      Object.entries(newEquipped).forEach(([s, i]) => { if (i && s !== 'weapon' && i.name === item.name) delete newEquipped[s]; });
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
// IMPORTANT: Only iterates over real equipment slots — excludes the 'weapon' alias
// to prevent double-counting bonuses from mainhand.
function recalculateStatsFromEquipment(character, equipped, inventory) {
  const updates = {};
  let acBonus = 0;
  let savingThrowBonus = 0;
  const abilitySetScores = {};   // "set to X" items (Amulet of Health, Belt of Giant Strength)
  const abilityAddBonuses = {};  // "+N" items (Hand Wraps +1 DEX)

  // REAL equipment slots only — 'weapon' is an alias for mainhand, skip to avoid double-counting
  const REAL_SLOTS = ['mainhand','offhand','armor','helmet','amulet','cloak','gloves','boots','ring','ring2','belt','trinket'];
  REAL_SLOTS.forEach(slot => {
    const item = equipped[slot];
    if (!item) return;

    // Resolve bonuses using the centralized resolver (known items > form fields > regex)
    const bonuses = resolveItemBonuses(item);
    if (bonuses.ac) acBonus += bonuses.ac;
    if (bonuses.saving_throws) savingThrowBonus += bonuses.saving_throws;

    // "Set" ability scores (e.g. CON becomes 19) — take highest set value
    if (bonuses.ability_scores) {
      Object.entries(bonuses.ability_scores).forEach(([stat, val]) => {
        abilitySetScores[stat] = Math.max(abilitySetScores[stat] || 0, val);
      });
    }

    // Additive ability score bonuses (e.g. +1 DEX) — stack them
    if (bonuses.ability_score_adds) {
      Object.entries(bonuses.ability_score_adds).forEach(([stat, val]) => {
        abilityAddBonuses[stat] = (abilityAddBonuses[stat] || 0) + val;
      });
    }
  });

  // Apply ability score changes
  // "Set" items override the base stat to a fixed value (only if higher than base)
  // "Add" items add to the base (or set) value
  ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(stat => {
    const baseStat = character[`_base_${stat}`] || character[stat] || 10;
    let finalStat = baseStat;

    // Apply "set" (use the set value only if it's higher than base)
    if (abilitySetScores[stat]) {
      finalStat = Math.max(baseStat, abilitySetScores[stat]);
    }

    // Apply additive bonuses on top
    if (abilityAddBonuses[stat]) {
      finalStat += abilityAddBonuses[stat];
    }

    // Only write update if different from current
    if (finalStat !== (character[stat] || 10)) {
      updates[stat] = Math.min(30, finalStat); // D&D hard cap
    }
  });

  // Recalculate AC — use the proper function that handles class/race
  const effectiveChar = { ...character, ...updates };
  updates.armor_class = computeACWithClassRace(effectiveChar, equipped) + acBonus;

  // Expose equipped weapon on character.equipped.weapon for CombatPanel to read
  const weaponItem = equipped.mainhand || null;
  if (weaponItem) {
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

/**
 * Compute AC considering class unarmored defense, racial natural armor, AND equipped armor.
 * Picks the best option per D&D 5e rules: you choose the highest applicable AC calculation.
 */
function computeACWithClassRace(character, equipped) {
  const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);
  const wisMod = Math.floor(((character.wisdom || 10) - 10) / 2);
  const conMod = Math.floor(((character.constitution || 10) - 10) / 2);

  // Start with base 10 + DEX
  let bestAC = 10 + dexMod;

  // Class unarmored defense (only when not wearing armor)
  if (!equipped?.armor) {
    if (character.class === 'Monk') {
      bestAC = Math.max(bestAC, 10 + dexMod + wisMod);
    } else if (character.class === 'Barbarian') {
      bestAC = Math.max(bestAC, 10 + dexMod + conMod);
    }
  }

  // Racial natural armor (Tortle=17 flat, Lizardfolk=13+DEX)
  // Per D&D rules, natural armor is an alternative you can always choose
  if (character.race === 'Tortle') {
    bestAC = Math.max(bestAC, 17);
  } else if (character.race === 'Lizardfolk') {
    bestAC = Math.max(bestAC, 13 + dexMod);
  }

  // Equipped armor overrides base (if wearing armor)
  const armor = equipped?.armor;
  if (armor?.armor_class) {
    const acVal = parseInt(armor.armor_class) || 10;
    const type = armor.armor_type || 'light';
    let armorAC;
    if (type === 'heavy') armorAC = acVal;
    else if (type === 'medium') armorAC = acVal + Math.min(dexMod, 2);
    else armorAC = acVal + dexMod;
    bestAC = Math.max(bestAC, armorAC);
  }

  // Shield bonus (flat +2 per D&D 5e)
  if (equipped?.offhand?.category === 'Shield') bestAC += 2;

  // NOTE: Cloak/ring ac_bonus fields are REMOVED from here.
  // All AC bonuses from magic items are now handled exclusively via resolveItemBonuses() → acBonus
  // in recalculateStatsFromEquipment(). The old code double-counted them.

  return bestAC;
}