import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Coins, ChevronRight, Package, ArrowLeftRight } from 'lucide-react';
import { LOOT_RARITY, generateLootForEnemy, generateCoinsForEnemy } from './lootTables';
import EquipmentComparePanel from './EquipmentComparePanel';

// ─── Single loot item card with reveal animation ────────────────────────────
function LootItemCard({ item, index, onCompare, selected, onSelect }) {
  const r = LOOT_RARITY[item.rarity] || LOOT_RARITY.common;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 280 }}
      onClick={() => onSelect(item)}
      className="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: selected ? r.bg : 'rgba(15,8,3,0.6)',
        border: `1px solid ${selected ? r.border : 'rgba(184,115,51,0.12)'}`,
        boxShadow: selected ? r.glow : 'none',
      }}>
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: r.bg, border: `1px solid ${r.border}` }}>
        {item.icon || '📦'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-fantasy font-bold truncate" style={{ color: r.color }}>{item.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-fantasy flex-shrink-0"
            style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}`, fontSize: '0.58rem', opacity: 0.9 }}>
            {r.label}
          </span>
          {item.requires_attunement && (
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(192,132,252,0.6)', fontSize: '0.6rem' }}>✦ Attune</span>
          )}
        </div>
        {item.source_enemy && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(212,168,100,0.65)', fontFamily: 'EB Garamond, serif' }}>
            from {item.source_enemy}
          </p>
        )}
        {item.description && (
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(220,190,140,0.8)', fontFamily: 'EB Garamond, serif' }}>
            {item.description}
          </p>
        )}
      </div>

      {/* Compare button */}
      {item.category !== 'material' && item.category !== 'consumable' && item.category !== 'gem' && item.category !== 'document' && (
        <button
          onClick={e => { e.stopPropagation(); onCompare(item); }}
          className="flex-shrink-0 p-1.5 rounded-lg transition-all"
          style={{ background: 'rgba(38,10,70,0.4)', border: '1px solid rgba(130,70,210,0.25)', color: 'rgba(192,132,252,0.55)' }}
          title="Compare with equipped"
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,110,255,0.5)'; e.currentTarget.style.color = '#dfc8ff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(130,70,210,0.25)'; e.currentTarget.style.color = 'rgba(192,132,252,0.55)'; }}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ─── Coin display row ────────────────────────────────────────────────────────
function CoinRow({ gold, silver, copper }) {
  const coins = [
    { amount: gold,   label: 'Gold',   color: '#f0c040', border: 'rgba(240,192,64,0.3)' },
    { amount: silver, label: 'Silver', color: '#e2e8f0', border: 'rgba(226,232,240,0.25)' },
    { amount: copper, label: 'Copper', color: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  ].filter(c => c.amount > 0);

  if (coins.length === 0) return null;

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(45,28,5,0.7)', border: '1px solid rgba(201,169,110,0.22)' }}>
      <div className="tavern-section-label mb-2.5">Coinage Found</div>
      <div className="flex gap-4 justify-center">
        {coins.map(c => (
          <motion.div key={c.label} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}
            className="text-center">
            <div className="font-fantasy font-bold text-2xl" style={{ color: c.color, textShadow: `0 0 12px ${c.color}55` }}>
              {c.amount}
            </div>
            <div className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.8)' }}>{c.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main LootModal ──────────────────────────────────────────────────────────
/**
 * Props:
 *  enemies     — array of {name, type, cr} combat combatants
 *  character   — current character object
 *  onClose     — dismiss callback
 *  onCollect   — (charUpdates, lootSnapshot) => void
 */
export default function LootModal({ enemies, character, onClose, onCollect }) {
  const [loot, setLoot] = useState(null);          // { gold, silver, copper, items[] }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compareItem, setCompareItem] = useState(null);  // item being compared
  const [selectedItem, setSelectedItem] = useState(null);
  const [collectedItems, setCollectedItems] = useState(new Set()); // names already added

  useEffect(() => { buildLoot(); }, []);

  const buildLoot = () => {
    setLoading(true);
    // Generate loot client-side using type-aware tables (fast, no network)
    const allItems = [];
    let totalGold = 0, totalSilver = 0, totalCopper = 0;

    const enemyList = enemies?.length > 0 ? enemies : [{ name: 'Unknown Enemy', type: 'Humanoid', cr: 1 }];

    enemyList.forEach(enemy => {
      const type = enemy.type || enemy.meta?.split(' ')[0] || 'Humanoid';
      const cr = parseFloat(enemy.cr || enemy.challenge) || 1;

      const items = generateLootForEnemy(enemy.name || 'Enemy', type, cr);
      allItems.push(...items);

      const coins = generateCoinsForEnemy(type, cr);
      totalGold   += coins.gold;
      totalSilver += coins.silver;
      totalCopper += coins.copper;
    });

    // Deduplicate items by name (can happen when multiple same-type enemies)
    const seen = new Set();
    const uniqueItems = allItems.filter(it => {
      if (seen.has(it.name)) return false;
      seen.add(it.name);
      return true;
    });

    setLoot({ gold: totalGold, silver: totalSilver, copper: totalCopper, items: uniqueItems });
    setLoading(false);
  };

  // Map a loot item to inventory-compatible format
  const toInventoryItem = (it) => {
    const LOOT_TO_INV_CATEGORY = {
      weapon: 'Weapon', armor: 'Armor', accessory: 'Wondrous Item',
      clothing: 'Other', material: 'Other', gem: 'Other', magical: 'Wondrous Item',
      consumable: 'Potion', document: 'Other', general: 'Adventuring Gear',
    };
    return {
      name: it.name,
      category: LOOT_TO_INV_CATEGORY[it.category] || it.category || 'Other',
      rarity: it.rarity || 'common',
      quantity: it.quantity || 1,
      weight: it.weight || 0,
      cost: it.base_price || it.cost || 0,
      cost_unit: it.cost_unit || 'gp',
      damage: it.modifiers?.damage_dice || it.damage || '',
      damage_type: it.damage_type || '',
      armor_class: it.modifiers?.armor_class || it.armor_class || 0,
      attack_bonus: it.modifiers?.attack_bonus || it.attack_bonus || 0,
      description: it.description || '',
      requires_attunement: it.requires_attunement || false,
      is_magic: it.is_magic || (it.rarity && it.rarity !== 'common') || false,
      magic_properties: [],
      equip_slot: null,
      source_enemy: it.source_enemy || null,
    };
  };

  // Collect all at once — adds everything to inventory + coin purse
  const handleTakeAll = async () => {
    if (!loot) return;
    setSaving(true);
    const newItems = loot.items.map(toInventoryItem);
    const updates = {
      gold:      (character.gold   || 0) + (loot.gold   || 0),
      silver:    (character.silver || 0) + (loot.silver || 0),
      copper:    (character.copper || 0) + (loot.copper || 0),
      inventory: [...(character.inventory || []), ...newItems],
    };
    await base44.entities.Character.update(character.id, updates);
    const snapshot = {
      gold: loot.gold, silver: loot.silver, copper: loot.copper,
      items: loot.items.map(it => ({ name: it.name, icon: it.icon, rarity: it.rarity })),
    };
    onCollect(updates, snapshot);
    setSaving(false);
    onClose();
  };

  // Equip an item directly from loot (add to inventory + set equipped slot)
  const handleEquipItem = async (item) => {
    if (!item) return;
    setSaving(true);
    const invItem = toInventoryItem(item);
    const equipped = { ...(character.equipped || {}) };
    const slot = item.category === 'weapon' ? 'mainhand' : item.category === 'armor' ? 'armor' : null;
    if (slot) equipped[slot] = invItem;

    const newInventory = [...(character.inventory || []), invItem];
    const updates = { inventory: newInventory, equipped };
    await base44.entities.Character.update(character.id, updates);

    setCollectedItems(prev => new Set([...prev, item.name]));
    setCompareItem(null);
    setSelectedItem(null);
    setSaving(false);
    onCollect(updates, null);
  };

  // Keep in bag only — add to inventory without equipping
  const handleKeepInBag = async (item) => {
    if (!item) return;
    setSaving(true);
    const invItem = toInventoryItem(item);
    const newInventory = [...(character.inventory || []), invItem];
    const updates = { inventory: newInventory };
    await base44.entities.Character.update(character.id, updates);

    setCollectedItems(prev => new Set([...prev, item.name]));
    setCompareItem(null);
    setSelectedItem(null);
    setSaving(false);
    onCollect(updates, null);
  };

  // Get the currently equipped item in the same category for comparison
  const getEquippedForSlot = (item) => {
    const slot = item.category === 'weapon' ? 'weapon' : item.category === 'armor' ? 'armor' : item.category === 'accessory' ? 'accessory' : null;
    return slot ? (character.equipped?.[slot] || null) : null;
  };

  const hasCoins = loot && (loot.gold > 0 || loot.silver > 0 || loot.copper > 0);
  const hasItems = loot?.items?.length > 0;
  const isEmpty  = !hasCoins && !hasItems;
  const allCollected = hasItems && loot.items.every(it => collectedItems.has(it.name));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)' }}>

      {/* Compare overlay */}
      <AnimatePresence>
        {compareItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setCompareItem(null)}>
            <div onClick={e => e.stopPropagation()}>
              <EquipmentComparePanel
                newItem={compareItem}
                equipped={getEquippedForSlot(compareItem)}
                onEquip={() => handleEquipItem(compareItem)}
                onKeepBag={() => handleKeepInBag(compareItem)}
                onClose={() => setCompareItem(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main modal */}
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: 'linear-gradient(160deg, rgba(28,14,5,0.99), rgba(18,9,3,0.99))',
          border: '1px solid rgba(201,169,110,0.35)',
          boxShadow: '0 0 60px rgba(201,169,110,0.08), 0 20px 60px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="font-fantasy-deco font-bold text-xl text-glow-gold" style={{ color: '#f0c040' }}>
              ⚔️ Victory Spoils
            </h2>
            <p className="text-xs font-body mt-0.5" style={{ color: 'rgba(212,180,110,0.75)' }}>
              {loading ? 'Searching the fallen...' : isEmpty ? 'Nothing of value found.' : `${loot.items.length} item${loot.items.length !== 1 ? 's' : ''} found — tap ↔ to compare before equipping`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(180,140,90,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.35)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-5 pb-3 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a96e' }} />
              <span className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.75)' }}>Searching bodies...</span>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <Package className="w-10 h-10 opacity-30" style={{ color: '#c9a96e' }} />
              <p className="text-sm font-body italic" style={{ color: 'rgba(212,180,110,0.7)' }}>Nothing of value remains.</p>
            </div>
          ) : (
            <>
              {/* Coins */}
              {hasCoins && <CoinRow gold={loot.gold} silver={loot.silver} copper={loot.copper} />}

              {/* Items */}
              {hasItems && (
                <div className="space-y-2">
                  <div className="tavern-section-label">Items Found</div>
                  {loot.items.map((item, i) => (
                    <div key={item.name} className="relative">
                      {collectedItems.has(item.name) && (
                        <div className="absolute inset-0 z-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(10,6,2,0.75)', backdropFilter: 'blur(2px)' }}>
                          <span className="text-xs font-fantasy" style={{ color: '#86efac' }}>✓ Collected</span>
                        </div>
                      )}
                      <LootItemCard
                        item={item}
                        index={i}
                        selected={selectedItem?.name === item.name}
                        onSelect={setSelectedItem}
                        onCompare={setCompareItem}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!loading && (
          <div className="px-5 pb-5 pt-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(184,115,51,0.12)' }}>
            {!isEmpty && !allCollected && (
              <button onClick={handleTakeAll} disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '🎒'}
                {saving ? 'Collecting...' : 'Take All'}
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-fantasy transition-all"
              style={{ border: '1px solid rgba(180,140,90,0.35)', color: 'rgba(212,180,110,0.75)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.55)'; e.currentTarget.style.color = '#c9a96e'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,90,0.35)'; e.currentTarget.style.color = 'rgba(212,180,110,0.75)'; }}>
              {allCollected ? '✓ Done' : 'Leave'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}