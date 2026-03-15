import React, { useState } from 'react';
import { Trash2, Info, Package, Weight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ITEM_ICONS = {
  weapon: '⚔️',
  armor: '🛡️',
  potion: '🧪',
  scroll: '📜',
  food: '🍖',
  tool: '🔧',
  treasure: '💎',
  misc: '📦',
};

const RARITY_COLORS = {
  common: 'rgba(180,140,90,0.3)',
  uncommon: 'rgba(40,180,80,0.35)',
  rare: 'rgba(60,140,255,0.35)',
  'very rare': 'rgba(160,80,255,0.35)',
  legendary: 'rgba(255,140,40,0.4)',
};

export default function InventoryGrid({ items, onEquip, onDelete, onUse, equippedSlots = {} }) {
  const [selectedItem, setSelectedItem] = useState(null);

  const isEquipped = (item) => {
    return Object.values(equippedSlots).some(equipped => equipped?.name === item.name);
  };

  const getItemIcon = (item) => {
    if (item.icon) return item.icon;
    const cat = (item.category || '').toLowerCase();
    if (cat.includes('weapon')) return ITEM_ICONS.weapon;
    if (cat.includes('armor')) return ITEM_ICONS.armor;
    if (cat.includes('potion')) return ITEM_ICONS.potion;
    if (cat.includes('scroll')) return ITEM_ICONS.scroll;
    if (cat.includes('food')) return ITEM_ICONS.food;
    return ITEM_ICONS.misc;
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
          <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>
            Your inventory is empty
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, idx) => (
            <motion.button
              key={idx}
              onClick={() => setSelectedItem(item)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.02 }}
              className="p-3 rounded-xl text-left transition-all relative"
              style={{
                background: 'rgba(20,13,5,0.7)',
                border: `1px solid ${isEquipped(item) ? '#f0c040' : RARITY_COLORS[item.rarity?.toLowerCase()] || 'rgba(180,140,90,0.2)'}`,
                boxShadow: isEquipped(item) ? '0 0 16px rgba(240,192,64,0.15)' : 'none',
              }}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{getItemIcon(item)}</span>
                {item.quantity > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-fantasy"
                    style={{ background: 'rgba(80,50,10,0.6)', color: '#e8d5b7' }}>
                    ×{item.quantity}
                  </span>
                )}
              </div>
              <div className="font-fantasy text-sm font-bold truncate" style={{ color: '#f0c040' }}>
                {item.name}
              </div>
              <div className="text-xs mt-1 flex items-center gap-2" style={{ color: 'rgba(180,140,90,0.5)' }}>
                {item.weight > 0 && (
                  <span className="flex items-center gap-1">
                    <Weight className="w-3 h-3" />
                    {item.weight * (item.quantity || 1)} lb
                  </span>
                )}
              </div>
              {isEquipped(item) && (
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-xs font-fantasy"
                  style={{ background: 'rgba(240,192,64,0.3)', color: '#f0c040', border: '1px solid rgba(240,192,64,0.4)' }}>
                  E
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            isEquipped={isEquipped(selectedItem)}
            onClose={() => setSelectedItem(null)}
            onEquip={() => { onEquip(selectedItem); setSelectedItem(null); }}
            onUse={() => { onUse(selectedItem); setSelectedItem(null); }}
            onDelete={() => { onDelete(selectedItem); setSelectedItem(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemDetailModal({ item, isEquipped, onClose, onEquip, onUse, onDelete }) {
  const canEquip = item.category && (item.category.toLowerCase().includes('weapon') || item.category.toLowerCase().includes('armor'));
  const canUse = item.category && (item.category.toLowerCase().includes('potion') || item.category.toLowerCase().includes('consumable'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl p-5 rune-border"
        style={{
          background: 'rgba(15,10,5,0.98)',
          border: `2px solid ${RARITY_COLORS[item.rarity?.toLowerCase()] || 'rgba(180,140,90,0.3)'}`,
        }}
        onClick={e => e.stopPropagation()}>
        
        <div className="flex items-start gap-3 mb-4">
          <span className="text-4xl">{item.icon || ITEM_ICONS[item.category?.toLowerCase()] || ITEM_ICONS.misc}</span>
          <div className="flex-1">
            <h3 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
              {item.name}
            </h3>
            {item.rarity && (
              <div className="text-xs capitalize mt-1" style={{ color: RARITY_COLORS[item.rarity?.toLowerCase()] || '#c9a96e' }}>
                {item.rarity}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4 text-sm" style={{ color: 'rgba(201,169,110,0.7)' }}>
          {item.description && (
            <p className="leading-relaxed" style={{ fontFamily: 'EB Garamond, serif' }}>
              {item.description}
            </p>
          )}
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {item.category && (
              <div>
                <span style={{ color: 'rgba(180,140,90,0.5)' }}>Type:</span>
                <span className="ml-1.5" style={{ color: '#e8d5b7' }}>{item.category}</span>
              </div>
            )}
            {item.weight > 0 && (
              <div>
                <span style={{ color: 'rgba(180,140,90,0.5)' }}>Weight:</span>
                <span className="ml-1.5" style={{ color: '#e8d5b7' }}>{item.weight} lb</span>
              </div>
            )}
            {item.damage_dice && (
              <div>
                <span style={{ color: 'rgba(180,140,90,0.5)' }}>Damage:</span>
                <span className="ml-1.5" style={{ color: '#fca5a5' }}>{item.damage_dice}</span>
              </div>
            )}
            {item.armor_class && (
              <div>
                <span style={{ color: 'rgba(180,140,90,0.5)' }}>AC:</span>
                <span className="ml-1.5" style={{ color: '#93c5fd' }}>{item.armor_class}</span>
              </div>
            )}
            {item.quantity > 1 && (
              <div>
                <span style={{ color: 'rgba(180,140,90,0.5)' }}>Quantity:</span>
                <span className="ml-1.5" style={{ color: '#e8d5b7' }}>×{item.quantity}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {canEquip && (
            <button onClick={onEquip}
              className="flex-1 py-2 rounded-lg btn-fantasy text-sm">
              {isEquipped ? 'Unequip' : 'Equip'}
            </button>
          )}
          {canUse && (
            <button onClick={onUse}
              className="flex-1 py-2 rounded-lg btn-arcane text-sm">
              Use
            </button>
          )}
          <button onClick={onDelete}
            className="px-3 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(80,20,10,0.5)', border: '1px solid rgba(180,50,50,0.3)', color: '#fca5a5' }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}