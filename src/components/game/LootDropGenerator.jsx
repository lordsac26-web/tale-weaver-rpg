import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Coins, Sparkles, Sword, X, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const RARITY_COLORS = {
  common: { border: 'rgba(180,140,90,0.3)', bg: 'rgba(20,15,10,0.5)', text: '#e8d5b7', glow: 'none' },
  uncommon: { border: 'rgba(40,160,80,0.5)', bg: 'rgba(10,30,15,0.5)', text: '#86efac', glow: '0 0 12px rgba(40,160,80,0.3)' },
  rare: { border: 'rgba(60,100,220,0.6)', bg: 'rgba(10,20,40,0.5)', text: '#93c5fd', glow: '0 0 16px rgba(60,100,220,0.4)' },
  very_rare: { border: 'rgba(150,90,230,0.6)', bg: 'rgba(30,15,45,0.5)', text: '#c4b5fd', glow: '0 0 20px rgba(150,90,230,0.4)' },
  legendary: { border: 'rgba(200,100,50,0.8)', bg: 'rgba(40,20,10,0.5)', text: '#fbbf24', glow: '0 0 24px rgba(200,100,50,0.5)' },
};

export default function LootDropGenerator({ character, enemy, onClose, onComplete }) {
  const [generating, setGenerating] = useState(false);
  const [loot, setLoot] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await base44.functions.invoke('generateLoot', {
        level: character?.level || 1,
        enemy_cr: enemy?.cr || 1,
        enemy_type: enemy?.type || 'humanoid',
        num_enemies: enemy?.count || 1,
        character_class: character?.class || null,
      });

      setLoot(result.data);
      // Auto-select all items
      if (result.data.items) {
        setSelectedItems(result.data.items.map((_, i) => i));
      }
      toast.success('Loot generated!');
    } catch (error) {
      console.error('Loot generation failed:', error);
      toast.error(error.message || 'Failed to generate loot');
    }
    setGenerating(false);
  };

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const itemsToCollect = loot.items?.filter((_, i) => selectedItems.includes(i)) || [];
      
      const updates = {
        gold: (character.gold || 0) + (loot.coins?.gold || 0),
        silver: (character.silver || 0) + (loot.coins?.silver || 0),
        copper: (character.copper || 0) + (loot.coins?.copper || 0),
        inventory: [...(character.inventory || []), ...itemsToCollect],
      };

      if (onComplete) {
        await onComplete(updates, loot);
      }
      
      setCollected(true);
      toast.success(`Collected ${loot.coins?.gold || 0} gp and ${itemsToCollect.length} items!`);
    } catch (error) {
      console.error('Collection failed:', error);
      toast.error(error.message || 'Failed to collect loot');
    }
    setCollecting(false);
  };

  const toggleItem = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const getItemIcon = (item) => {
    if (item.type === 'weapon') return '⚔️';
    if (item.type === 'armor') return '🛡️';
    if (item.type === 'consumable') return '🧪';
    if (item.type === 'accessory') return '💍';
    if (item.type === 'gear') return '🎒';
    if (item.type === 'tool') return '🔧';
    if (item.type === 'material') return '💎';
    return '📦';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{ 
          border: '1px solid rgba(201,169,110,0.3)', 
          background: 'linear-gradient(160deg, rgba(15,10,7,0.98), rgba(8,5,2,0.99))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6" style={{ color: '#fbbf24' }} />
            <div>
              <h2 className="font-fantasy text-lg" style={{ color: '#c9a96e' }}>Loot Drop</h2>
              <p className="text-xs" style={{ color: 'rgba(212,149,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {enemy?.name || 'Enemy'} · CR {enemy?.cr || 1}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.4)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!loot && !generating && (
            /* Generate Screen */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Sword className="w-20 h-20 mx-auto mb-4" style={{ color: 'rgba(180,140,90,0.2)' }} />
              <h3 className="font-fantasy text-xl mb-2" style={{ color: '#f0d090' }}>Generate Loot</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                Generate randomized loot based on enemy challenge rating. Items will be biased toward your class ({character?.class}).
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)', border: '1px solid rgba(180,140,90,0.2)' }}>
                  <div className="text-xs text-slate-500 mb-1">Enemy CR</div>
                  <div className="font-fantasy font-bold text-lg" style={{ color: '#fbbf24' }}>{enemy?.cr || 1}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)', border: '1px solid rgba(180,140,90,0.2)' }}>
                  <div className="text-xs text-slate-500 mb-1">Character Level</div>
                  <div className="font-fantasy font-bold text-lg" style={{ color: '#86efac' }}>{character?.level || 1}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)', border: '1px solid rgba(180,140,90,0.2)' }}>
                  <div className="text-xs text-slate-500 mb-1">Enemies</div>
                  <div className="font-fantasy font-bold text-lg" style={{ color: '#93c5fd' }}>{enemy?.count || 1}</div>
                </div>
              </div>
              <Button onClick={handleGenerate} className="btn-fantasy px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Loot
              </Button>
            </motion.div>
          )}

          {generating && (
            /* Generating Screen */
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: '#fbbf24' }} />
              <p className="font-fantasy text-lg" style={{ color: '#f0d090' }}>Generating loot...</p>
            </div>
          )}

          {loot && !collected && (
            /* Loot Display Screen */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Tier Badge */}
              <div className="flex items-center justify-center gap-2">
                <Badge className="badge-gold" style={{ fontSize: '0.7rem', padding: '0.375rem 0.75rem' }}>
                  {loot.tier?.toUpperCase()} TIER
                </Badge>
                {loot.artifact && (
                  <Badge className="badge-arcane" style={{ fontSize: '0.7rem', padding: '0.375rem 0.75rem' }}>
                    ✨ ARTIFACT FOUND!
                  </Badge>
                )}
              </div>

              {/* Coins */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="w-5 h-5" style={{ color: '#fbbf24' }} />
                  <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>COINS FOUND</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#fbbf24' }}>{loot.coins?.gold || 0}</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Gold Pieces</div>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#e8d5b7' }}>{loot.coins?.silver || 0}</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Silver Pieces</div>
                  </div>
                  <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(20,15,10,0.5)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#9ca3af' }}>{loot.coins?.copper || 0}</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Copper Pieces</div>
                  </div>
                </div>
              </div>

              {/* Items */}
              {loot.items && loot.items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5" style={{ color: '#c4b5fd' }} />
                    <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.6)' }}>ITEMS FOUND</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {loot.items.map((item, idx) => {
                      const rarityStyle = RARITY_COLORS[item.rarity?.toLowerCase()] || RARITY_COLORS.common;
                      const isSelected = selectedItems.includes(idx);
                      
                      return (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => toggleItem(idx)}
                          className={`p-4 rounded-xl text-left transition-all border-2 ${
                            isSelected 
                              ? 'border-green-500 bg-green-900/20' 
                              : 'hover:border-amber-500/60'
                          }`}
                          style={{ 
                            background: rarityStyle.bg,
                            borderColor: rarityStyle.border,
                            boxShadow: isSelected ? '0 0 16px rgba(40,160,80,0.3)' : rarityStyle.glow,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">{getItemIcon(item)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-fantasy font-bold text-sm truncate" style={{ color: rarityStyle.text }}>
                                {item.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="badge-gold" style={{ fontSize: '0.6rem' }}>
                                  {item.rarity}
                                </Badge>
                                <span className="text-xs" style={{ color: 'rgba(212,149,90,0.5)' }}>
                                  {item.type}
                                </span>
                              </div>
                              {item.effect && (
                                <div className="text-xs mt-2 italic" style={{ color: 'rgba(232,213,183,0.6)' }}>
                                  {item.effect}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div className="text-green-400 text-xl">✓</div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Artifact */}
              {loot.artifact && (
                <div className="p-4 rounded-xl border-2" 
                  style={{ 
                    background: 'rgba(40,20,10,0.6)', 
                    borderColor: 'rgba(200,100,50,0.8)',
                    boxShadow: '0 0 24px rgba(200,100,50,0.4)'
                  }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5" style={{ color: '#fbbf24' }} />
                    <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(251,191,36,0.8)' }}>LEGENDARY ARTIFACT</h3>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">👑</div>
                    <div className="flex-1">
                      <div className="font-fantasy font-bold" style={{ color: '#fbbf24' }}>{loot.artifact.name}</div>
                      <div className="text-xs mt-1" style={{ color: 'rgba(251,191,36,0.6)' }}>{loot.artifact.effect}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(201,169,110,0.2)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-fantasy" style={{ color: 'rgba(201,169,110,0.6)' }}>Total Value:</span>
                  <span className="text-xl font-fantasy font-bold" style={{ color: '#fbbf24' }}>
                    {loot.summary?.total_gold_value || 0} gp
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {collected && (
            /* Collection Complete Screen */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <CheckCircle className="w-20 h-20 mx-auto mb-4 text-green-500" />
              <h3 className="font-fantasy text-2xl mb-2" style={{ color: '#86efac' }}>Loot Collected!</h3>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)', border: '1px solid rgba(180,140,90,0.2)' }}>
                  <div className="text-2xl font-fantasy font-bold" style={{ color: '#fbbf24' }}>{loot.coins?.gold || 0}</div>
                  <div className="text-xs text-slate-500">Gold Collected</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)', border: '1px solid rgba(180,140,90,0.2)' }}>
                  <div className="text-2xl font-fantasy font-bold" style={{ color: '#93c5fd' }}>{selectedItems.length}</div>
                  <div className="text-xs text-slate-500">Items Collected</div>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Items have been added to your inventory
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
          {collected ? (
            <Button onClick={onClose} className="btn-fantasy px-8">
              Close
            </Button>
          ) : loot && !collecting ? (
            <>
              <Button variant="outline" onClick={() => { setLoot(null); setSelectedItems([]); }} className="btn-fantasy">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button onClick={handleCollect} className="btn-fantasy px-8">
                <Coins className="w-4 h-4 mr-2" />
                Collect Loot
              </Button>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}