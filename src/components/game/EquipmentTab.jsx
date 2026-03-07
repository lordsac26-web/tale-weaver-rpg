import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Star, ArrowLeftRight, Check, Package, Trash2 } from 'lucide-react';
import { LOOT_RARITY } from './lootTables';
import EquipmentComparePanel from './EquipmentComparePanel';
import { base44 } from '@/api/base44Client';

// Equipment slots definition
const SLOTS = [
  { key: 'weapon',    label: 'Weapon',    icon: '⚔️',  fallback: 'Unarmed' },
  { key: 'armor',     label: 'Armor',     icon: '🛡️',  fallback: 'No Armor' },
  { key: 'accessory', label: 'Accessory', icon: '📿',  fallback: 'None' },
  { key: 'helmet',    label: 'Helmet',    icon: '⛑️',  fallback: 'None' },
  { key: 'boots',     label: 'Boots',     icon: '👢',  fallback: 'None' },
  { key: 'gloves',    label: 'Gloves',    icon: '🧤',  fallback: 'None' },
];

const EQUIPPABLE_CATEGORIES = {
  weapon:    ['weapon'],
  armor:     ['armor', 'clothing'],
  accessory: ['accessory', 'magical'],
  helmet:    ['armor'],
  boots:     ['armor', 'clothing'],
  gloves:    ['armor', 'clothing'],
};

function ItemCard({ item, isEquipped, onCompare, onEquip, onUnequip, onDrop }) {
  const r = LOOT_RARITY[item.rarity] || LOOT_RARITY.common;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{
        background: isEquipped ? r.bg : 'rgba(15,8,3,0.55)',
        border: `1px solid ${isEquipped ? r.border : 'rgba(184,115,51,0.12)'}`,
        boxShadow: isEquipped ? r.glow : 'none',
      }}>
      {/* Header row */}
      <div className="flex items-center gap-2.5 p-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <span className="text-xl flex-shrink-0">{item.icon || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-fantasy font-bold truncate" style={{ color: r.color }}>{item.name}</span>
            <span className="text-xs px-1 py-0.5 rounded font-fantasy flex-shrink-0"
              style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}`, fontSize: '0.58rem' }}>
              {r.label}
            </span>
            {isEquipped && (
              <span className="text-xs flex-shrink-0 badge-green px-1.5 py-0.5 rounded">Equipped</span>
            )}
          </div>
          {item.category && (
            <span className="text-xs capitalize" style={{ color: 'rgba(212,168,100,0.65)', fontFamily: 'EB Garamond, serif' }}>
              {item.category}
              {item.requires_attunement ? ' · Attunement' : ''}
            </span>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button title="Compare" onClick={() => onCompare(item)}
            className="p-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(38,10,70,0.4)', border: '1px solid rgba(130,70,210,0.2)', color: 'rgba(192,132,252,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#dfc8ff'; e.currentTarget.style.borderColor = 'rgba(160,110,255,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(192,132,252,0.5)'; e.currentTarget.style.borderColor = 'rgba(130,70,210,0.2)'; }}>
            <ArrowLeftRight className="w-3 h-3" />
          </button>
          {isEquipped ? (
            <button title="Unequip" onClick={() => onUnequip(item)}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(60,30,8,0.5)', border: '1px solid rgba(200,140,40,0.3)', color: 'rgba(240,180,80,0.6)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fcd34d'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,180,80,0.6)'; }}>
              <Check className="w-3 h-3" />
            </button>
          ) : (
            <button title="Equip" onClick={() => onEquip(item)}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(10,40,15,0.5)', border: '1px solid rgba(40,160,75,0.25)', color: 'rgba(134,239,172,0.55)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#86efac'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(134,239,172,0.55)'; }}>
              <Sword className="w-3 h-3" />
            </button>
          )}
          <button title="Drop" onClick={() => onDrop(item)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(252,165,165,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(252,165,165,0.35)'; }}>
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(184,115,51,0.1)' }}>
              {item.description && (
                <p className="text-xs font-serif italic leading-relaxed pt-2" style={{ color: 'rgba(220,190,140,0.85)' }}>
                  {item.description}
                </p>
              )}
              {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(item.modifiers).map(([k, v]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded font-fantasy"
                      style={{ background: 'rgba(30,50,80,0.5)', border: '1px solid rgba(96,165,250,0.2)', color: '#93c5fd' }}>
                      {k.replace(/_/g, ' ')}: {typeof v === 'number' && v > 0 ? `+${v}` : v}
                    </span>
                  ))}
                </div>
              )}
              {item.base_price > 0 && (
                <p className="text-xs" style={{ color: 'rgba(212,168,100,0.65)', fontFamily: 'EB Garamond, serif' }}>
                  Value: ~{item.base_price} gp
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Equipped Slot Paperdoll ─────────────────────────────────────────────────
function EquippedSlot({ slot, item }) {
  const r = item ? (LOOT_RARITY[item.rarity] || LOOT_RARITY.common) : null;
  return (
    <div className="rounded-lg p-2.5 text-center"
      style={{
        background: item ? r.bg : 'rgba(10,5,2,0.5)',
        border: `1px solid ${item ? r.border : 'rgba(184,115,51,0.1)'}`,
        boxShadow: item ? r.glow : 'none',
        minHeight: '72px',
      }}>
      <div className="text-xl mb-0.5">{item ? item.icon : slot.icon}</div>
      <p className="text-xs font-fantasy truncate" style={{ color: item ? r.color : 'rgba(180,140,80,0.5)' }}>
        {item ? item.name : slot.fallback}
      </p>
      <p className="text-xs" style={{ color: 'rgba(180,140,80,0.55)', fontSize: '0.65rem' }}>{slot.label}</p>
    </div>
  );
}

// ─── Main EquipmentTab ───────────────────────────────────────────────────────
export default function EquipmentTab({ character, onCharacterUpdate }) {
  const [compareItem, setCompareItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [saving, setSaving] = useState(false);

  const inventory = character.inventory || [];
  const equipped  = character.equipped  || {};

  // Filter to equippable items only
  const equippableCategories = ['weapon', 'armor', 'accessory', 'clothing', 'magical'];
  const equippableItems = inventory.filter(it => equippableCategories.includes(it.category));

  const categories = ['all', ...new Set(equippableItems.map(it => it.category).filter(Boolean))];

  const displayItems = filterCategory === 'all'
    ? equippableItems
    : equippableItems.filter(it => it.category === filterCategory);

  const isEquipped = (item) => {
    return Object.values(equipped).some(eq => eq?.name === item.name);
  };

  const getSlotForItem = (item) => {
    for (const [slot, cats] of Object.entries(EQUIPPABLE_CATEGORIES)) {
      if (cats.includes(item.category)) return slot;
    }
    return null;
  };

  const getEquippedForSlot = (item) => {
    const slot = getSlotForItem(item);
    return slot ? (equipped[slot] || null) : null;
  };

  const handleEquip = async (item) => {
    setSaving(true);
    const slot = getSlotForItem(item);
    if (!slot) { setSaving(false); return; }
    const newEquipped = { ...equipped, [slot]: item };
    await base44.entities.Character.update(character.id, { equipped: newEquipped });
    onCharacterUpdate({ ...character, equipped: newEquipped });
    setSaving(false);
  };

  const handleUnequip = async (item) => {
    setSaving(true);
    const slot = getSlotForItem(item);
    if (!slot) { setSaving(false); return; }
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    await base44.entities.Character.update(character.id, { equipped: newEquipped });
    onCharacterUpdate({ ...character, equipped: newEquipped });
    setSaving(false);
  };

  const handleDrop = async (item) => {
    setSaving(true);
    const newInventory = inventory.filter((_, i) => {
      // Remove first occurrence by name
      const idx = inventory.findIndex(it => it.name === item.name);
      return i !== idx;
    });
    // Also unequip if currently equipped
    const newEquipped = { ...equipped };
    const slot = getSlotForItem(item);
    if (slot && equipped[slot]?.name === item.name) delete newEquipped[slot];

    await base44.entities.Character.update(character.id, { inventory: newInventory, equipped: newEquipped });
    onCharacterUpdate({ ...character, inventory: newInventory, equipped: newEquipped });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Compare overlay */}
      <AnimatePresence>
        {compareItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setCompareItem(null)}>
            <div onClick={e => e.stopPropagation()}>
              <EquipmentComparePanel
                newItem={compareItem}
                equipped={getEquippedForSlot(compareItem)}
                onEquip={() => { handleEquip(compareItem); setCompareItem(null); }}
                onKeepBag={() => setCompareItem(null)}
                onClose={() => setCompareItem(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paperdoll — equipped slots */}
      <div>
        <p className="tavern-section-label mb-3">Currently Equipped</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SLOTS.map(slot => (
            <EquippedSlot key={slot.key} slot={slot} item={equipped[slot.key] || null} />
          ))}
        </div>
      </div>

      <hr className="divider-rune" />

      {/* Inventory items — equippable only */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="tavern-section-label">Equipment in Bag ({equippableItems.length})</p>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className="px-2.5 py-1 rounded-lg text-xs font-fantasy capitalize transition-all"
                style={{
                  background: filterCategory === cat ? 'rgba(92,51,24,0.7)' : 'rgba(20,10,4,0.6)',
                  border: `1px solid ${filterCategory === cat ? 'rgba(212,149,90,0.5)' : 'rgba(184,115,51,0.15)'}`,
                  color: filterCategory === cat ? 'var(--brass-gold)' : 'rgba(212,168,100,0.7)',
                }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {displayItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-15" style={{ color: '#c9a96e' }} />
            <p className="text-sm font-body italic" style={{ color: 'rgba(184,115,51,0.35)' }}>
              {equippableItems.length === 0
                ? 'No equipment in your inventory yet.'
                : 'No items in this category.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item, i) => (
              <ItemCard
                key={`${item.name}-${i}`}
                item={item}
                isEquipped={isEquipped(item)}
                onCompare={setCompareItem}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}