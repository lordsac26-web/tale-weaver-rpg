import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, RefreshCw, Coins, Package, ShoppingBag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ItemCard from './ItemCard';
import HaggleModal from './HaggleModal';
import TransactionToast from './TransactionToast';
import { VENDOR_TYPE_META, BUY_BACK_CATEGORIES, TRANSACTION_FLAVOR, REST_FLAVOR, ITEM_CATEGORY_ICONS } from './vendorData';
import VendorDialogue from './VendorDialogue';
import StockRefreshBanner from './StockRefreshBanner';

export default function VendorShop({ vendor, character, onBack, onCharacterUpdate }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('buy'); // buy | sell
  const [vendorData, setVendorData] = useState(vendor);
  const [char, setChar] = useState(character);
  const [transaction, setTransaction] = useState(null);
  const [haggleItem, setHaggleItem] = useState(null);
  const [showGreeting, setShowGreeting] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [aiDialogueContext, setAiDialogueContext] = useState({ context: 'greeting', itemName: '', itemDesc: '' });

  const meta = VENDOR_TYPE_META[vendor.type] || VENDOR_TYPE_META.general;
  const isResting = vendor.type === 'tavern_inn' || vendor.type === 'tavern_pub';

  useEffect(() => {
    const t = setTimeout(() => setShowGreeting(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const buyBack = BUY_BACK_CATEGORIES[vendor.type] || [];
  const sellableInventory = (char?.inventory || []).filter(inv =>
    buyBack.includes(inv.category) && inv.quantity > 0
  );

  const shopItems = (vendorData.items || []).filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || item.category === filterCategory;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...new Set((vendorData.items || []).map(i => i.category).filter(Boolean))];

  const fireTransaction = (type, itemName, amount, newBalance, flavorText) => {
    setTransaction({ id: Date.now(), type, itemName, amount, newBalance, flavor: flavorText });
  };

  const handleBuy = async (item, overridePrice = null) => {
    const price = overridePrice ?? item.base_price;
    if ((char?.gold || 0) < price) return;

    // Deduct gold from character
    const newGold = (char?.gold || 0) - price;
    const invItem = {
      name: item.name, category: item.category, rarity: item.rarity, quantity: 1,
      weight: item.weight || 0, cost: price, cost_unit: 'gp',
      description: item.description, icon: item.icon,
      effect: item.effect || '',
    };
    const newInventory = [...(char?.inventory || []), invItem];
    const updatedChar = { ...char, gold: newGold, inventory: newInventory };
    setChar(updatedChar);
    await base44.entities.Character.update(char.id, { gold: newGold, inventory: newInventory });

    // Reduce stock in vendor
    const newItems = vendorData.items.map(i =>
      i.name === item.name ? { ...i, stock: Math.max(0, (i.stock || 0) - 1) } : i
    );
    const updatedVendor = { ...vendorData, items: newItems };
    setVendorData(updatedVendor);
    await base44.entities.Vendor.update(vendor.id, { items: newItems });

    const flavorKey = vendor.type;
    const flavor = TRANSACTION_FLAVOR.buy[flavorKey] || TRANSACTION_FLAVOR.buy.general;
    fireTransaction('buy', item.name, price, newGold, flavor);
    setAiDialogueContext({ context: 'buy', itemName: item.name, itemDesc: item.description });
    onCharacterUpdate?.(updatedChar);

    // Handle rest at inn
    if (item.category === 'Service' && item.effect?.includes('Long rest')) {
      const hpRestored = char.hp_max || char.hp_current;
      const restoredChar = { ...updatedChar, hp_current: hpRestored };
      await base44.entities.Character.update(char.id, { hp_current: hpRestored });
      setChar(restoredChar);
      onCharacterUpdate?.(restoredChar);
    }
  };

  const handleSell = async (invItem) => {
    // Sell at 50% of cost
    const salePrice = Math.floor((invItem.cost || 10) * 0.5);
    const vendorHasGold = (vendorData.gold_reserve || 200) >= salePrice;
    if (!vendorHasGold) {
      fireTransaction('sell', invItem.name, 0, char.gold, "\"I don't have enough coin for that right now,\" they admit.");
      return;
    }

    const newGold = (char?.gold || 0) + salePrice;
    const newInventory = [...(char?.inventory || [])];
    const idx = newInventory.findIndex(i => i.name === invItem.name);
    if (idx !== -1) {
      if (newInventory[idx].quantity > 1) {
        newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity - 1 };
      } else {
        newInventory.splice(idx, 1);
      }
    }

    const updatedChar = { ...char, gold: newGold, inventory: newInventory };
    setChar(updatedChar);
    await base44.entities.Character.update(char.id, { gold: newGold, inventory: newInventory });

    // Add to vendor stock
    const existingIdx = vendorData.items.findIndex(i => i.name === invItem.name);
    let newItems = [...vendorData.items];
    if (existingIdx !== -1) {
      newItems[existingIdx] = { ...newItems[existingIdx], stock: (newItems[existingIdx].stock || 0) + 1 };
    }
    const updatedVendor = { ...vendorData, items: newItems, gold_reserve: (vendorData.gold_reserve || 200) - salePrice };
    setVendorData(updatedVendor);
    await base44.entities.Vendor.update(vendor.id, { items: newItems, gold_reserve: updatedVendor.gold_reserve });

    const flavor = TRANSACTION_FLAVOR.sell[vendor.type] || TRANSACTION_FLAVOR.sell.general;
    fireTransaction('sell', invItem.name, salePrice, newGold, flavor);
    setAiDialogueContext({ context: 'sell', itemName: invItem.name, itemDesc: invItem.description });
    onCharacterUpdate?.(updatedChar);
  };

  const handleHaggleAccept = async (finalPrice) => {
    setHaggleItem(null);
    await handleBuy(haggleItem, finalPrice);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d0a07' }}>
      {/* Header */}
      <div className="flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: `1px solid ${meta.borderColor}` }}>
        {/* Top accent */}
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-2xl">{vendor.portrait_emoji || meta.icon}</div>
          <div className="flex-1">
            <h2 className="font-fantasy font-bold text-base" style={{ color: meta.color }}>{vendor.name}</h2>
            <p className="text-xs" style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'EB Garamond, serif' }}>
              {meta.label} · {vendor.location}
            </p>
          </div>
          {/* Gold display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(40,25,5,0.6)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <Coins className="w-3.5 h-3.5" style={{ color: '#f0c040' }} />
            <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>{char?.gold || 0}gp</span>
          </div>
        </div>

        {/* AI Dialogue bubble */}
        <div className="mx-4 mb-3">
          <VendorDialogue
            key={`${aiDialogueContext.context}-${aiDialogueContext.itemName}`}
            vendor={vendor}
            character={char}
            context={aiDialogueContext.context}
            itemName={aiDialogueContext.itemName}
            itemDescription={aiDialogueContext.itemDesc}
            autoLoad={true}
          />
        </div>

        {/* Stock refresh info */}
        {vendorData.last_stock_refresh && !vendor.is_traveling && (
          <div className="px-4 pb-2">
            <StockRefreshBanner lastRefresh={vendorData.last_stock_refresh} refreshDays={vendorData.refresh_interval_days || 3} />
          </div>
        )}

        {/* Tabs: Buy / Sell */}
        <div className="flex gap-1 px-4 pb-3">
          {[
            ['buy', `🛍️ Browse (${(vendorData.items || []).filter(i => i.stock > 0).length})`],
            ...(sellableInventory.length > 0 ? [['sell', `💰 Sell (${sellableInventory.length})`]] : []),
          ].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 rounded-lg text-xs font-fantasy transition-all"
              style={activeTab === tab ? {
                background: meta.bg,
                border: `1px solid ${meta.borderColor}`,
                color: meta.color,
              } : {
                background: 'rgba(15,10,5,0.5)',
                border: '1px solid rgba(180,140,90,0.1)',
                color: 'rgba(180,140,90,0.4)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      {activeTab === 'buy' && (
        <div className="flex gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(10,6,3,0.9)', borderBottom: '1px solid rgba(180,140,90,0.08)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(180,140,90,0.3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm input-fantasy" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All' : `${ITEM_CATEGORY_ICONS[c] || '📦'} ${c}`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Item Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'buy' && (
          <>
            {shopItems.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-10" style={{ color: '#c9a96e' }} />
                <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.25)' }}>Nothing found.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Rest option first for inns */}
                {shopItems
                  .sort((a, b) => {
                    const catOrder = ['Service', 'Potion', 'Food', 'Drink', 'Weapon', 'Armor', 'Tool', 'Misc'];
                    return (catOrder.indexOf(a.category) || 99) - (catOrder.indexOf(b.category) || 99);
                  })
                  .map((item, i) => (
                    <div key={i} className="group relative">
                      <ItemCard item={item} vendorType={vendor.type} character={char}
                        onBuy={(it) => handleBuy(it)} mode="buy" />
                      {/* Haggle button overlay */}
                      {vendor.type !== 'tavern_inn' && vendor.type !== 'tavern_pub' && item.stock > 0 && (
                        <button
                          onClick={() => { setHaggleItem(item); setAiDialogueContext({ context: 'haggle_intro', itemName: item.name, itemDesc: String(item.base_price) }); }}
                          className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded-lg text-xs font-fantasy"
                          style={{ background: 'rgba(30,20,5,0.85)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.5)' }}>
                          Haggle
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'sell' && (
          <>
            {sellableInventory.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-10" style={{ color: '#c9a96e' }} />
                <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.25)' }}>
                  {vendor.type === 'brothel' ? "We don't buy goods, darling." : "Nothing to sell here."}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs px-1 mb-2" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
                  Selling at 50% of item value. Vendor gold: {vendorData.gold_reserve || 0}gp
                </div>
                {sellableInventory.map((inv, i) => (
                  <ItemCard key={i} item={{ ...inv, base_price: Math.floor((inv.cost || 10) * 0.5), stock: inv.quantity || 1 }}
                    vendorType={vendor.type} character={char}
                    onBuy={() => handleSell(inv)} mode="sell" />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Haggle Modal */}
      <AnimatePresence>
        {haggleItem && (
          <HaggleModal item={haggleItem} vendor={vendor} character={char}
            onAccept={handleHaggleAccept}
            onClose={() => setHaggleItem(null)} />
        )}
      </AnimatePresence>

      {/* Transaction Toast */}
      <AnimatePresence>
        {transaction && (
          <TransactionToast transaction={transaction} onDone={() => setTransaction(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}