import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Shirt, Crown, Footprints, Hand, Gem, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SLOT_CONFIG = {
  head: { icon: Crown, label: 'Head', color: '#c4b5fd', slot: 'head' },
  neck: { icon: Gem, label: 'Neck', color: '#fde68a', slot: 'neck' },
  chest: { icon: Shirt, label: 'Chest', color: '#93c5fd', slot: 'chest' },
  hands: { icon: Hand, label: 'Hands', color: '#86efac', slot: 'hands' },
  ring1: { icon: Gem, label: 'Ring 1', color: '#fbbf24', slot: 'ring' },
  ring2: { icon: Gem, label: 'Ring 2', color: '#fbbf24', slot: 'ring' },
  feet: { icon: Footprints, label: 'Feet', color: '#a78bfa', slot: 'feet' },
  weapon: { icon: Sword, label: 'Main Hand', color: '#fca5a5', slot: 'weapon' },
  offhand: { icon: Shield, label: 'Offhand', color: '#60a5fa', slot: 'shield' },
};

export default function EnhancedEquipmentSlots({ 
  equipped = {}, 
  inventory = [], 
  onEquip, 
  onUnequip,
  character 
}) {
  const [showItemSelector, setShowItemSelector] = useState(null);

  const getSlotItem = (slot) => {
    return equipped[slot] || null;
  };

  const getItemBonusText = (item) => {
    if (!item?.bonuses) return null;
    const parts = [];
    if (item.bonuses.ac) parts.push(`+${item.bonuses.ac} AC`);
    if (item.bonuses.attack) parts.push(`+${item.bonuses.attack} Attack`);
    if (item.bonuses.damage) parts.push(`+${item.bonuses.damage} Damage`);
    if (item.bonuses.saving_throws) parts.push(`+${item.bonuses.saving_throws} Saves`);
    if (item.bonuses.ability_scores) {
      Object.entries(item.bonuses.ability_scores).forEach(([stat, val]) => {
        parts.push(`+${val} ${stat.slice(0, 3).toUpperCase()}`);
      });
    }
    return parts.join(' · ');
  };

  const getEligibleItems = (slotKey) => {
    return inventory.filter(item => {
      const cat = (item.category || '').toLowerCase();
      const type = (item.type || '').toLowerCase();
      
      if (slotKey === 'weapon') return cat.includes('weapon') || type.includes('weapon') || type.includes('sword');
      if (slotKey === 'offhand') return cat.includes('shield') || type.includes('shield');
      if (slotKey.startsWith('ring')) return cat.includes('ring') || type.includes('ring');
      if (slotKey === 'head') return cat.includes('helm') || cat.includes('head') || cat.includes('cap');
      if (slotKey === 'neck') return cat.includes('amulet') || cat.includes('neck') || cat.includes('pendant');
      if (slotKey === 'chest') return cat.includes('armor') || cat.includes('chest') || cat.includes('robe');
      if (slotKey === 'hands') return cat.includes('glove') || cat.includes('hand');
      if (slotKey === 'feet') return cat.includes('boot') || cat.includes('foot') || cat.includes('shoe');
      
      return false;
    });
  };

  const handleSlotClick = (slotKey) => {
    const item = getSlotItem(slotKey);
    if (item) {
      onUnequip(slotKey);
    } else {
      setShowItemSelector(slotKey);
    }
  };

  const handleQuickEquip = (slotKey, item) => {
    onEquip(item, slotKey);
    setShowItemSelector(null);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(SLOT_CONFIG).map(([slotKey, config]) => {
          const item = getSlotItem(slotKey);
          const Icon = config.icon;
          const bonusText = getItemBonusText(item);
          const eligibleItems = getEligibleItems(slotKey);
          const hasItems = eligibleItems.length > 0;

          return (
            <motion.div
              key={slotKey}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="relative rounded-xl p-3 cursor-pointer group glass-panel"
              onClick={() => handleSlotClick(slotKey)}
              style={{
                background: item ? 'rgba(45,22,8,0.95)' : 'rgba(28,13,4,0.85)',
                border: item ? `1px solid ${config.color}66` : '1px solid rgba(184,115,51,0.2)',
                boxShadow: item ? `0 0 16px ${config.color}33, inset 0 1px 0 rgba(232,184,109,0.1)` : 'inset 0 2px 8px rgba(0,0,0,0.65)',
              }}
            >
              {/* Unequip button */}
              {item && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUnequip(slotKey); }}
                  className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  style={{ 
                    background: 'rgba(60,20,20,0.9)', 
                    border: '1px solid rgba(180,50,50,0.5)',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <X className="w-3 h-3" style={{ color: '#fca5a5' }} />
                </button>
              )}

              <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: item ? config.color : 'rgba(180,140,90,0.25)' }} />
              
              <div className="text-xs font-fantasy mb-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                {config.label}
              </div>
              
              {item ? (
                <>
                  <div className="text-xs font-semibold truncate" style={{ color: config.color, textShadow: `0 0 8px ${config.color}66` }}>
                    {item.name}
                  </div>
                  {bonusText && (
                    <div className="text-xs mt-1 truncate" style={{ color: 'rgba(240,192,64,0.7)', fontSize: '0.6rem' }}>
                      {bonusText}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs italic" style={{ color: 'rgba(120,90,50,0.3)' }}>
                  {hasItems ? 'Click to equip' : 'Empty'}
                </div>
              )}

              {/* Item count badge */}
              {eligibleItems.length > 0 && !item && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: config.color, color: '#0a0502' }}>
                  {eligibleItems.length}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Item Selector Modal */}
      <AnimatePresence>
        {showItemSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowItemSelector(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-2xl rounded-2xl overflow-hidden"
              style={{ 
                border: '1px solid rgba(201,169,110,0.3)', 
                background: 'linear-gradient(160deg, rgba(15,10,7,0.98), rgba(8,5,2,0.99))',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
                {(() => {
                  const SlotIcon = SLOT_CONFIG[showItemSelector]?.icon;
                  const slotColor = SLOT_CONFIG[showItemSelector]?.color;
                  const slotLabel = SLOT_CONFIG[showItemSelector]?.label;
                  return SlotIcon ? (
                    <SlotIcon className="w-6 h-6" style={{ color: slotColor }} />
                  ) : null;
                })()}
                <div>
                  <h3 className="font-fantasy text-lg" style={{ color: '#c9a96e' }}>
                    Equip {SLOT_CONFIG[showItemSelector]?.label}
                  </h3>
                  <p className="text-xs" style={{ color: 'rgba(212,149,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                    {getEligibleItems(showItemSelector).length} items available
                  </p>
                </div>
                <button 
                  onClick={() => setShowItemSelector(null)} 
                  className="ml-auto p-1.5 rounded-lg" 
                  style={{ color: 'rgba(201,169,110,0.4)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getEligibleItems(showItemSelector).map((item, idx) => (
                    <motion.button
                      key={item.id || item.name || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleQuickEquip(showItemSelector, item)}
                      className="p-4 rounded-xl text-left transition-all border-2 hover:border-amber-500/60"
                      style={{ 
                        background: 'rgba(20,15,10,0.6)', 
                        border: '1px solid rgba(180,140,90,0.2)' 
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{item.icon || '📦'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-fantasy font-bold text-sm truncate" style={{ color: '#f0d090' }}>
                            {item.name}
                          </div>
                          {item.rarity && (
                            <Badge className="mt-1" style={{ 
                              fontSize: '0.6rem', 
                              background: 'rgba(60,40,10,0.6)', 
                              color: '#f0c040',
                              border: '1px solid rgba(201,169,110,0.2)'
                            }}>
                              {item.rarity}
                            </Badge>
                          )}
                          {item.weight && (
                            <div className="text-xs mt-1" style={{ color: 'rgba(212,149,90,0.5)' }}>
                              Weight: {item.weight} lb
                            </div>
                          )}
                          {item.value && (
                            <div className="text-xs" style={{ color: '#fbbf24' }}>
                              Value: {item.value} gp
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                
                {getEligibleItems(showItemSelector).length === 0 && (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(180,140,90,0.2)' }} />
                    <p className="font-fantasy text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>
                      No suitable items in inventory
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}