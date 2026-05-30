import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Coins, TrendingDown } from 'lucide-react';

const RARITY_COLORS = {
  common: '#e8d5b7',
  uncommon: '#86efac',
  rare: '#a78bfa',
  'very rare': '#f0c040',
  legendary: '#fb923c',
};

// Estimate an item's gold value. Prefer explicit price fields, else derive from rarity.
const RARITY_BASE_VALUE = { common: 10, uncommon: 50, rare: 200, 'very rare': 1000, legendary: 5000 };

export function estimateItemValue(item) {
  if (typeof item?.value === 'number') return item.value;
  if (typeof item?.base_price === 'number') return item.base_price;
  if (typeof item?.cost === 'number') return item.cost;
  // "cost" sometimes stored as "15 gp"
  if (typeof item?.cost === 'string') {
    const m = item.cost.match(/(\d+)\s*gp/i);
    if (m) return parseInt(m[1]);
  }
  return RARITY_BASE_VALUE[(item?.rarity || 'common').toLowerCase()] || 5;
}

// Vendors typically buy at half value (PHB selling convention)
const SELL_MULTIPLIER = 0.5;

export default function SellItemModal({ item, onConfirm, onClose }) {
  const maxQty = item.quantity || 1;
  const [qty, setQty] = useState(1);

  const unitValue = estimateItemValue(item);
  const unitSell = Math.max(1, Math.floor(unitValue * SELL_MULTIPLIER));
  const totalGold = unitSell * qty;
  const color = RARITY_COLORS[(item.rarity || 'common').toLowerCase()] || RARITY_COLORS.common;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden rune-border"
        style={{ background: 'rgba(15,10,5,0.98)', border: '1px solid rgba(180,140,90,0.3)', boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <h2 className="font-fantasy font-bold text-lg flex items-center gap-2" style={{ color: '#f0c040' }}>
            <TrendingDown className="w-5 h-5" /> Sell Item
          </h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.4)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon || '📦'}</span>
            <div>
              <h3 className="font-fantasy font-bold" style={{ color }}>{item.name}</h3>
              <p className="text-xs" style={{ color: 'rgba(201,169,110,0.5)' }}>
                Worth {unitValue} gp · sells for {unitSell} gp each
              </p>
            </div>
          </div>

          {maxQty > 1 && (
            <div>
              <label className="text-xs font-fantasy tracking-widest block mb-2" style={{ color: 'rgba(201,169,110,0.6)' }}>
                QUANTITY ({qty} / {maxQty})
              </label>
              <input type="range" min={1} max={maxQty} value={qty}
                onChange={e => setQty(parseInt(e.target.value))}
                className="w-full accent-amber-500" />
            </div>
          )}

          <div className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(40,30,8,0.5)', border: '1px solid rgba(240,192,64,0.25)' }}>
            <span className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.7)' }}>You receive</span>
            <span className="font-fantasy font-bold text-xl flex items-center gap-1.5" style={{ color: '#f0c040' }}>
              <Coins className="w-5 h-5" /> {totalGold} gp
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-fantasy text-sm"
              style={{ background: 'rgba(40,20,8,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
              Cancel
            </button>
            <button onClick={() => onConfirm(item, qty, totalGold)}
              className="flex-1 py-3 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2">
              <Coins className="w-4 h-4" /> Sell for {totalGold} gp
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}