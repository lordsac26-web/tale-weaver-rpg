import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Package, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ALL_STANDARD_ITEMS, ITEM_CATEGORIES, getItemsByCategory, searchItems,
  EQUIPMENT_PACKS
} from '@/components/game/standardItems';

const BUDGET_DEFAULT = 150; // default starting gold budget for custom gear

export default function StartingGearPicker({ character, classGold, onUpdateInventory, onUpdateGold }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);

  const budget = classGold || BUDGET_DEFAULT;
  const spent = cart.reduce((t, it) => t + (it.cost || 0) * (it.quantity || 1), 0);
  const remaining = Math.max(0, budget - spent);

  const results = useMemo(() => {
    const catItems = getItemsByCategory(category);
    return query ? searchItems(query, catItems) : catItems;
  }, [query, category]);

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.name === item.name);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: (updated[existing].quantity || 1) + 1 };
        return updated;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const adjustQuantity = (index, delta) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = Math.max(1, (item.quantity || 1) + delta);
      return { ...item, quantity: newQty };
    }));
  };

  const addPack = (packName) => {
    const pack = EQUIPMENT_PACKS[packName];
    if (!pack) return;
    addToCart({ name: packName, category: 'Adventuring Gear', weight: pack.weight, cost: pack.cost, cost_unit: 'gp', quantity: 1, description: `Contains: ${pack.items.join(', ')}` });
  };

  const confirmSelection = () => {
    onUpdateInventory(cart);
    onUpdateGold(Math.floor(remaining));
  };

  const totalWeight = cart.reduce((t, it) => t + (it.weight || 0) * (it.quantity || 1), 0);

  return (
    <div className="space-y-4">
      {/* Budget bar */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(30,20,5,0.7)', border: '1px solid rgba(201,169,110,0.25)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.62rem' }}>GOLD BUDGET</span>
          <span className="font-fantasy text-sm" style={{ color: remaining > 0 ? '#f0c040' : '#fca5a5' }}>
            {remaining.toFixed(1)} / {budget} gp remaining
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(8,4,1,0.7)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (spent / budget) * 100)}%`,
              background: spent > budget
                ? 'linear-gradient(90deg, #7f1d1d, #dc2626)'
                : spent > budget * 0.75
                  ? 'linear-gradient(90deg, #b45309, #d97706)'
                  : 'linear-gradient(90deg, #166534, #22c55e)'
            }} />
        </div>
        {spent > budget && (
          <p className="text-xs mt-1" style={{ color: '#fca5a5', fontFamily: 'EB Garamond, serif' }}>
            ⚠ Over budget by {(spent - budget).toFixed(1)} gp
          </p>
        )}
      </div>

      {/* Equipment Packs shortcuts */}
      <div>
        <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.6rem' }}>QUICK ADD — EQUIPMENT PACKS</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EQUIPMENT_PACKS).map(([name, pack]) => (
            <button key={name} onClick={() => addPack(name)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
              style={{ background: 'rgba(20,13,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.6)' }}>
              🎒 {name} <span style={{ color: '#d97706' }}>({pack.cost}gp)</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Item Browser */}
        <div>
          <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.6rem' }}>BROWSE ITEMS</div>
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(180,140,90,0.35)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search weapons, armor, gear..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm input-fantasy" />
          </div>
          {/* Category tabs */}
          <div className="flex gap-1 flex-wrap mb-2">
            {ITEM_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
              <button key={cat.key} onClick={() => { setCategory(cat.key); setQuery(''); }}
                className="px-2 py-1 rounded text-xs font-fantasy transition-all"
                style={category === cat.key
                  ? { background: 'rgba(60,40,10,0.8)', border: '1px solid rgba(201,169,110,0.4)', color: '#f0c040' }
                  : { border: '1px solid rgba(180,140,90,0.12)', color: 'rgba(180,140,90,0.4)' }
                }>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
          {/* Results list */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {results.slice(0, 30).map((item, i) => (
              <div key={`${item.name}-${i}`}
                className="flex items-center gap-2 p-2 rounded-lg transition-all"
                style={{ background: 'rgba(15,10,5,0.55)', border: '1px solid rgba(180,140,90,0.1)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
                    {item.damage && <span style={{ color: '#fca5a5' }}>{item.damage}</span>}
                    {item.armor_class > 0 && <span style={{ color: '#93c5fd' }}>AC {item.armor_class}</span>}
                    {item.weight > 0 && <span>{item.weight}lb</span>}
                    <span style={{ color: '#d97706' }}>{item.cost}{item.cost_unit}</span>
                  </div>
                </div>
                <button onClick={() => addToCart(item)}
                  className="p-1.5 rounded-lg flex-shrink-0 transition-all"
                  style={{ background: 'rgba(10,35,12,0.5)', border: '1px solid rgba(40,160,80,0.3)', color: '#86efac' }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Shopping Cart */}
        <div>
          <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.6rem' }}>
            YOUR GEAR ({cart.length} items · {totalWeight.toFixed(1)}lb)
          </div>
          {cart.length === 0 ? (
            <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(10,6,3,0.5)', border: '1px solid rgba(180,140,90,0.1)' }}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#c9a96e' }} />
              <p className="text-xs" style={{ color: 'rgba(180,140,90,0.3)' }}>Add items from the left to build your loadout</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ background: 'rgba(10,25,12,0.5)', border: '1px solid rgba(40,160,80,0.2)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: '#86efac', fontFamily: 'EB Garamond, serif' }}>
                      {item.name}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
                      {((item.cost || 0) * (item.quantity || 1)).toFixed(1)}gp · {((item.weight || 0) * (item.quantity || 1)).toFixed(1)}lb
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => adjustQuantity(i, -1)}
                      className="w-5 h-5 rounded text-xs flex items-center justify-center"
                      style={{ background: 'rgba(20,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(180,140,90,0.5)' }}>
                      −
                    </button>
                    <span className="text-xs w-5 text-center font-fantasy" style={{ color: '#e8d5b7' }}>
                      {item.quantity || 1}
                    </span>
                    <button onClick={() => adjustQuantity(i, 1)}
                      className="w-5 h-5 rounded text-xs flex items-center justify-center"
                      style={{ background: 'rgba(20,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(180,140,90,0.5)' }}>
                      +
                    </button>
                    <button onClick={() => removeFromCart(i)}
                      className="p-1 rounded ml-1"
                      style={{ color: 'rgba(200,60,60,0.5)' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Confirm button */}
          {cart.length > 0 && (
            <button onClick={confirmSelection}
              className="w-full mt-3 py-2.5 rounded-xl font-fantasy text-sm flex items-center justify-center gap-2 btn-fantasy"
              disabled={spent > budget}>
              <Check className="w-4 h-4" />
              Confirm Gear ({spent.toFixed(1)}gp spent, {remaining.toFixed(1)}gp left)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}