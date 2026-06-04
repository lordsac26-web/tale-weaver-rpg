import React, { useEffect, useState } from 'react';
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
  const [loot, setLoot] = useState(null);
  const [loadingLoot, setLoadingLoot] = useState(true);
  const [lootError, setLootError] = useState(null);

  useEffect(() => {
    if (!character) return;

    const loadLoot = async () => {
      setLoadingLoot(true);
      setLootError(null);
      const challengeCr = enemies.length
        ? enemies.reduce((max, enemy) => Math.max(max, Number(enemy.cr || 1)), 0)
        : 1;
      const enemyType = enemies[0]?.creature_type || enemies[0]?.type_tag || enemies[0]?.meta || enemies[0]?.archetype || 'humanoid';

      try {
        const result = await base44.functions.invoke('generateLoot', {
          level: character.level || 1,
          enemy_type: enemyType,
          enemy_cr: challengeCr,
          num_enemies: Math.max(1, enemies.length),
          character_class: character.class || null,
        });
        const data = result.data;
        const generatedItems = [...(data.items || []), ...(data.artifact ? [data.artifact] : [])];
        setLoot({
          gold: data.coins?.gold || 0,
          silver: data.coins?.silver || 0,
          copper: data.coins?.copper || 0,
          items: generatedItems,
          tier: data.tier,
          summary: data.summary,
        });
      } catch (err) {
        setLootError('Loot generation failed. You can close this and continue the adventure.');
      } finally {
        setLoadingLoot(false);
      }
    };

    loadLoot();
  }, [character?.id, character?.level, character?.class, enemies]);

  if (!character) return null;

  const handleCollect = async () => {
    if (!loot) return;
    setCollecting(true);
    
    const updates = {
      gold: (character.gold || 0) + loot.gold,
      silver: (character.silver || 0) + loot.silver,
      copper: (character.copper || 0) + loot.copper,
      inventory: [...(character.inventory || []), ...selectedItems],
    };

    await base44.entities.Character.update(character.id, updates);
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
                {enemies.length} enemy{enemies.length > 1 ? 'ies' : 'y'} defeated{loot?.tier ? ` · ${loot.tier} challenge loot` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(180,140,90,0.5)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {loadingLoot && (
            <div className="p-5 rounded-xl text-center" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="text-sm font-fantasy tracking-widest" style={{ color: '#f0c040' }}>Rolling treasure...</div>
              <div className="text-xs mt-2" style={{ color: 'rgba(180,140,90,0.55)' }}>Searching the equipment vault for fitting drops.</div>
            </div>
          )}

          {lootError && (
            <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(90,20,20,0.35)', border: '1px solid rgba(220,80,80,0.3)', color: '#fecaca' }}>
              {lootError}
            </div>
          )}

          {loot && (
          <>
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
                <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.6)' }}>LOOT DROPS</h3>
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
                      <div className="text-2xl">{item.icon || (item.category === 'Weapon' ? '⚔️' : item.category === 'Armor' ? '🛡️' : item.category === 'Potion' ? '🧪' : '🎒')}</div>
                      <div className="flex-1">
                        <div className="font-fantasy text-sm font-bold" style={{ color: '#c4b5fd' }}>{item.name}</div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>
                          {item.rarity || 'common'} · {item.category || item.type || 'Item'}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(232,213,183,0.6)' }}>
                          From: {item.source || 'the encounter'}
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
                {loot.gold + selectedItems.reduce((sum, item) => sum + (item.value || item.cost || 0), 0)} gp
              </span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleCollect}
            disabled={collecting || collected || !loot}
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
            {collected ? '✓ Loot Collected' : collecting ? 'Collecting...' : `Collect ${selectedItems.length > 0 ? `${selectedItems.length} Items + ` : ''}${loot?.gold || 0} Gold`}
          </button>
          </>
          )}
        </div>
      </motion.div>
    </div>
  );
}