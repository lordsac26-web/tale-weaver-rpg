import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Coins, Gift, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LootModal - Collect loot from defeated enemies with
 * coin distribution and item selection.
 */
export default function LootModal({ enemies = [], character, onClose, onCollect }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState(false);

  if (!character) return null;

  // Generate loot based on enemy CR
  const generateLoot = () => {
    const loot = {
      gold: 0,
      silver: 0,
      copper: 0,
      items: [],
    };

    enemies.forEach(enemy => {
      const cr = enemy.cr || 1;
      // Gold based on CR (DMG p.136)
      loot.gold += Math.floor(cr * 10 * (1 + Math.random()));
      
      // Chance for items based on CR
      if (Math.random() < Math.min(0.3 * cr, 0.9)) {
        const itemTable = getItemForCR(cr);
        if (itemTable) {
          loot.items.push({
            ...itemTable,
            quantity: 1,
            source: enemy.name,
          });
        }
      }
    });

    return loot;
  };

  const getItemForCR = (cr) => {
    if (cr < 1) return { name: 'Minor Potion', category: 'consumable', rarity: 'common', value: 10, weight: 0.5, icon: '🧪' };
    if (cr < 5) return { name: 'Potion of Healing', category: 'consumable', rarity: 'common', value: 50, weight: 0.5, icon: '🧪' };
    if (cr < 10) return { name: 'Magic Weapon +1', category: 'weapon', rarity: 'uncommon', value: 200, weight: 3, icon: '⚔️' };
    if (cr < 15) return { name: 'Rare Magic Item', category: 'magic', rarity: 'rare', value: 500, weight: 2, icon: '💎' };
    return { name: 'Legendary Artifact', category: 'artifact', rarity: 'legendary', value: 2000, weight: 5, icon: '👑' };
  };

  const loot = generateLoot();

  const handleCollect = async () => {
    setCollecting(true);
    
    const updates = {
      gold: (character.gold || 0) + loot.gold,
      silver: (character.silver || 0) + loot.silver,
      copper: (character.copper || 0) + loot.copper,
      inventory: [...(character.inventory || []), ...selectedItems],
    };

    await onCollect(updates, loot);
    setCollected(true);
    setCollecting(false);
  };

  const toggleItem = (item) => {
    setSelectedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'rgba(12,8,4,0.98)', border: '1px solid rgba(180,140,90,0.3)' }}
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 sticky top-0"
          style={{ background: 'rgba(30,20,8,0.95)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6" style={{ color: '#fbbf24' }} />
            <div>
              <h2 className="font-fantasy font-bold text-xl" style={{ color: '#f0c040' }}>Loot Collection</h2>
              <p className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
                {enemies.length} enemy{enemies.length > 1 ? 'ies' : 'y'} defeated
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(180,140,90,0.5)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Coins */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-5 h-5" style={{ color: '#fbbf24' }} />
              <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>COINS FOUND</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                <div className="text-2xl font-fantasy font-bold" style={{ color: '#fbbf24' }}>{loot.gold}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Gold Pieces</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                <div className="text-2xl font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{loot.silver}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Silver Pieces</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                <div className="text-2xl font-fantasy font-bold" style={{ color: '#9ca3af' }}>{loot.copper}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Copper Pieces</div>
              </div>
            </div>
          </div>

          {/* Items */}
          {loot.items.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5" style={{ color: '#c4b5fd' }} />
                <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.6)' }}>MAGIC ITEMS</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {loot.items.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedItems.includes(item) 
                        ? 'border-green-500 bg-green-900/20' 
                        : 'border-purple-500/30 bg-purple-900/10 hover:border-purple-500/50'
                    }`}
                    onClick={() => toggleItem(item)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{item.icon}</div>
                      <div className="flex-1">
                        <div className="font-fantasy text-sm font-bold" style={{ color: '#c4b5fd' }}>{item.name}</div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>
                          {item.rarity} · {item.category}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(232,213,183,0.6)' }}>
                          From: {item.source}
                        </div>
                      </div>
                      {selectedItems.includes(item) && (
                        <div className="text-green-400 text-xl">✓</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Total Value */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-fantasy" style={{ color: 'rgba(201,169,110,0.6)' }}>Total Value:</span>
              <span className="text-xl font-fantasy font-bold" style={{ color: '#fbbf24' }}>
                {loot.gold + selectedItems.reduce((sum, item) => sum + (item.value || 0), 0)} gp
              </span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleCollect}
            disabled={collecting || collected}
            className="w-full py-3 rounded-xl font-fantasy font-bold text-sm transition-all"
            style={collected ? {
              background: 'rgba(40,100,60,0.8)',
              border: '1px solid rgba(40,160,80,0.4)',
              color: '#86efac',
            } : {
              background: 'linear-gradient(135deg, rgba(100,60,20,0.9), rgba(60,40,10,0.95))',
              border: '1px solid rgba(201,169,110,0.5)',
              color: '#f0c040',
              boxShadow: '0 0 20px rgba(201,169,110,0.2)',
            }}
          >
            {collected ? '✓ Loot Collected' : collecting ? 'Collecting...' : `Collect ${selectedItems.length > 0 ? `${selectedItems.length} Items + ` : ''}${loot.gold} Gold`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}