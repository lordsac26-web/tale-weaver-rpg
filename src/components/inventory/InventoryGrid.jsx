import React, { useState } from 'react';
import { Coins, Weight, Trash2, Info, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Enhanced InventoryGrid with detailed item information,
 * weight tracking, value display, and improved interactions.
 */
export default function InventoryGrid({ items = [], onEquip, onDelete, onUse, onSell, equippedSlots = {} }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(180,140,90,0.2)' }} />
        <p className="font-fantasy text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>Your inventory is empty</p>
      </div>
    );
  }

  const getTotalWeight = () => {
    return items.reduce((total, item) => {
      const itemWeight = parseFloat(item.weight) || 0;
      const quantity = item.quantity || 1;
      return total + (itemWeight * quantity);
    }, 0);
  };

  const getTotalValue = () => {
    return items.reduce((total, item) => {
      const itemValue = parseFloat(item.value) || 0;
      const quantity = item.quantity || 1;
      return total + (itemValue * quantity);
    }, 0);
  };

  const isEquipped = (item) => {
    return Object.values(equippedSlots).some(equipped => equipped?.name === item.name);
  };

  const getItemRarityStyle = (rarity) => {
    const styles = {
      common: { border: 'rgba(180,140,90,0.2)', bg: 'rgba(20,15,10,0.5)', text: '#e8d5b7' },
      uncommon: { border: 'rgba(40,160,80,0.4)', bg: 'rgba(10,30,15,0.5)', text: '#86efac' },
      rare: { border: 'rgba(60,100,220,0.5)', bg: 'rgba(10,20,40,0.5)', text: '#93c5fd' },
      very_rare: { border: 'rgba(150,90,230,0.5)', bg: 'rgba(30,15,45,0.5)', text: '#c4b5fd' },
      legendary: { border: 'rgba(200,100,50,0.6)', bg: 'rgba(40,20,10,0.5)', text: '#fbbf24' },
    };
    return styles[rarity?.toLowerCase()] || styles.common;
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>Total Items</div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>{items.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
              <Weight className="w-3 h-3" /> Weight
            </div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#86efac' }}>{getTotalWeight().toFixed(1)} lb</div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
              <Coins className="w-3 h-3" /> Value
            </div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#fbbf24' }}>{getTotalValue()} gp</div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, idx) => {
            const rarityStyle = getItemRarityStyle(item.rarity);
            const equipped = isEquipped(item);
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="relative group"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => { setSelectedItem(item); setShowDetails(true); }}
                      className="aspect-square rounded-xl border-2 p-3 cursor-pointer transition-all fantasy-card"
                      style={{
                        background: rarityStyle.bg,
                        borderColor: equipped ? 'rgba(40,160,80,0.6)' : rarityStyle.border,
                        boxShadow: equipped ? '0 0 12px rgba(40,160,80,0.2)' : 'none',
                      }}
                    >
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="text-2xl mb-1">{item.icon || '📦'}</div>
                        <div className="text-xs font-fantasy font-medium truncate w-full" style={{ color: rarityStyle.text }}>
                          {item.name}
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-xs mt-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(60,40,10,0.8)', color: '#f0c040' }}>
                            ×{item.quantity}
                          </div>
                        )}
                        {equipped && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top"
                    className="max-w-xs"
                    style={{ background: 'rgba(10,5,2,0.95)', border: '1px solid rgba(180,140,90,0.3)', color: '#e8d5b7' }}
                  >
                    <div className="space-y-1">
                      <p className="font-fantasy font-bold text-sm" style={{ color: rarityStyle.text }}>{item.name}</p>
                      {item.category && (
                        <p className="text-xs capitalize" style={{ color: 'rgba(232,213,183,0.6)' }}>{item.category}</p>
                      )}
                      {item.weight && (
                        <p className="text-xs" style={{ color: 'rgba(232,213,183,0.6)' }}>Weight: {item.weight} lb</p>
                      )}
                      {item.value && (
                        <p className="text-xs" style={{ color: '#fbbf24' }}>Value: {item.value} gp</p>
                      )}
                      <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(232,213,183,0.7)' }}>
                        {item.description || 'No description available'}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Quick Actions (visible on hover) */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
                  {!equipped && onEquip && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEquip(item); }}
                      className="p-1.5 rounded-lg bg-green-600/80 hover:bg-green-600 transition-colors"
                      title="Equip"
                    >
                      <span className="text-xs">🛡️</span>
                    </button>
                  )}
                  {onUse && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUse(item); }}
                      className="p-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 transition-colors"
                      title="Use"
                    >
                      <span className="text-xs">✨</span>
                    </button>
                  )}
                  {onSell && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSell(item); }}
                      className="p-1.5 rounded-lg bg-yellow-600/80 hover:bg-yellow-600 transition-colors"
                      title="Sell"
                    >
                      <span className="text-xs">💰</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                      className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Item Details Modal */}
        {showDetails && selectedItem && (
          <ItemDetailsModal
            item={selectedItem}
            onClose={() => setShowDetails(false)}
            onEquip={onEquip}
            onUse={onUse}
            onSell={onSell}
            onDelete={onDelete}
            isEquipped={isEquipped(selectedItem)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Item Details Modal Component
function ItemDetailsModal({ item, onClose, onEquip, onUse, onSell, onDelete, isEquipped }) {
  const rarityColors = {
    common: '#e8d5b7',
    uncommon: '#86efac',
    rare: '#93c5fd',
    very_rare: '#c4b5fd',
    legendary: '#fbbf24',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(12,8,4,0.98)', border: '1px solid rgba(180,140,90,0.3)' }}
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <h3 className="font-fantasy font-bold text-lg" style={{ color: rarityColors[item.rarity?.toLowerCase()] || '#e8d5b7' }}>
            {item.name}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(180,140,90,0.5)' }}>
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Icon & Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(20,15,10,0.6)', border: '1px solid rgba(180,140,90,0.2)' }}>
              {item.icon || '📦'}
            </div>
            <div className="flex-1">
              <div className="text-sm capitalize mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>{item.category}</div>
              <div className="text-sm" style={{ color: '#86efac' }}>Weight: {item.weight || 0} lb</div>
              <div className="text-sm" style={{ color: '#fbbf24' }}>Value: {item.value || 0} gp</div>
            </div>
          </div>

          {/* Description */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.1)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
              {item.description || 'No description available.'}
            </p>
          </div>

          {/* Properties */}
          {item.properties && item.properties.length > 0 && (
            <div>
              <div className="text-xs mb-2 font-fantasy tracking-widest" style={{ color: 'rgba(180,140,90,0.4)' }}>PROPERTIES</div>
              <div className="flex flex-wrap gap-2">
                {item.properties.map((prop, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(60,40,10,0.6)', color: '#f0c040', border: '1px solid rgba(201,169,110,0.2)' }}>
                    {prop}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'rgba(180,140,90,0.1)' }}>
            {!isEquipped && onEquip && (
              <button onClick={() => { onEquip(item); onClose(); }}
                className="flex-1 py-2.5 rounded-lg font-fantasy text-sm transition-all"
                style={{ background: 'rgba(40,100,60,0.8)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac' }}>
                🛡️ Equip
              </button>
            )}
            {onUse && (
              <button onClick={() => { onUse(item); onClose(); }}
                className="flex-1 py-2.5 rounded-lg font-fantasy text-sm transition-all"
                style={{ background: 'rgba(40,60,100,0.8)', border: '1px solid rgba(60,100,220,0.4)', color: '#93c5fd' }}>
                ✨ Use
              </button>
            )}
            {onSell && (
              <button onClick={() => { onSell(item); onClose(); }}
                className="flex-1 py-2.5 rounded-lg font-fantasy text-sm transition-all"
                style={{ background: 'rgba(100,80,40,0.8)', border: '1px solid rgba(200,160,80,0.4)', color: '#fbbf24' }}>
                💰 Sell
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(item); onClose(); }}
                className="px-3 py-2.5 rounded-lg transition-all"
                style={{ background: 'rgba(100,40,40,0.8)', border: '1px solid rgba(200,80,80,0.4)', color: '#fca5a5' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}