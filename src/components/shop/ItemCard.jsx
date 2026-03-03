import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Coins, ShoppingCart } from 'lucide-react';
import { RARITY_META, ITEM_CATEGORY_ICONS } from './vendorData';

export default function ItemCard({ item, vendorType, character, onBuy, mode = 'buy' }) {
  const [expanded, setExpanded] = useState(false);
  const [buying, setBuying] = useState(false);

  const rarity = RARITY_META[item.rarity] || RARITY_META.common;
  const canAfford = (character?.gold || 0) >= item.base_price;
  const inStock = item.stock > 0;
  const canBuy = canAfford && inStock && mode === 'buy';

  const handleBuy = async () => {
    if (!canBuy) return;
    setBuying(true);
    await onBuy(item);
    setTimeout(() => setBuying(false), 800);
  };

  const handleSell = () => {
    onBuy(item); // reuse callback, parent handles sell logic
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'rgba(15,10,5,0.65)',
        border: `1px solid ${inStock ? rarity.border : 'rgba(80,60,30,0.1)'}`,
        boxShadow: inStock && item.rarity !== 'common' ? rarity.glow : 'none',
        opacity: inStock ? 1 : 0.45,
      }}>
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{ background: 'rgba(10,6,3,0.7)', border: `1px solid ${rarity.border}` }}>
          {ITEM_CATEGORY_ICONS[item.category] || item.icon || '📦'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-sm font-medium" style={{ color: rarity.color, fontFamily: 'EB Garamond, serif' }}>
              {item.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
              style={{ background: `${rarity.border}40`, border: `1px solid ${rarity.border}`, color: rarity.color, fontSize: '0.58rem' }}>
              {rarity.icon} {rarity.label}
            </span>
            {!inStock && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(60,10,10,0.4)', color: '#fca5a5', fontSize: '0.58rem' }}>Out of Stock</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>{item.category}</span>
            {item.effect && <span className="text-xs italic" style={{ color: 'rgba(134,239,172,0.55)', fontFamily: 'EB Garamond, serif' }}>{item.effect}</span>}
            {item.stock > 0 && item.stock <= 3 && (
              <span className="text-xs" style={{ color: '#fb923c', fontSize: '0.6rem' }}>Only {item.stock} left!</span>
            )}
          </div>
        </div>

        {/* Price + Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.description && (
            <button onClick={() => setExpanded(v => !v)} className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.35)' }}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Coins className="w-3 h-3" style={{ color: '#f0c040' }} />
              <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>{item.base_price}gp</span>
            </div>
            {mode === 'buy' && (
              <button onClick={handleBuy} disabled={!canBuy}
                className="mt-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-fantasy text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={canBuy ? {
                  background: 'rgba(50,35,5,0.85)',
                  border: '1px solid rgba(201,169,110,0.4)',
                  color: '#f0c040',
                } : {
                  background: 'rgba(20,14,5,0.5)',
                  border: '1px solid rgba(100,80,30,0.2)',
                  color: 'rgba(180,140,90,0.3)',
                }}>
                {buying ? (
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4 }}>✓</motion.span>
                ) : (
                  <><ShoppingCart className="w-3 h-3" /> Buy</>
                )}
              </button>
            )}
            {mode === 'sell' && (
              <button onClick={handleSell}
                className="mt-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-fantasy text-xs transition-all"
                style={{ background: 'rgba(10,40,15,0.7)', border: '1px solid rgba(40,160,80,0.35)', color: '#86efac' }}>
                Sell
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t px-3 pb-3 pt-2"
            style={{ borderColor: 'rgba(180,140,90,0.08)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'IM Fell English, serif', lineHeight: 1.65 }}>
              {item.description}
            </p>
            {item.weight > 0 && (
              <div className="mt-1 text-xs" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>
                Weight: {item.weight} lb
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}