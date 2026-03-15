import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Coins, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function VendorShop({ vendor, character, onClose, onTransaction }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [mode, setMode] = useState('buy'); // 'buy' | 'sell'
  const [processing, setProcessing] = useState(false);

  const playerGold = character.gold || 0;
  const playerInventory = character.inventory || [];

  const handleBuy = async (item) => {
    if (playerGold < item.price) {
      alert('Not enough gold!');
      return;
    }

    setProcessing(true);
    const newGold = playerGold - item.price;
    const newInventory = [...playerInventory, { ...item, quantity: 1 }];

    await base44.entities.Character.update(character.id, {
      gold: newGold,
      inventory: newInventory,
    });

    onTransaction({ gold: newGold, inventory: newInventory });
    setSelectedItem(null);
    setProcessing(false);
  };

  const handleSell = async (item) => {
    const sellPrice = Math.floor((item.base_price || item.price || 10) * 0.5);
    
    setProcessing(true);
    const newGold = playerGold + sellPrice;
    const newInventory = playerInventory.filter(i => i !== item);

    await base44.entities.Character.update(character.id, {
      gold: newGold,
      inventory: newInventory,
    });

    onTransaction({ gold: newGold, inventory: newInventory });
    setSelectedItem(null);
    setProcessing(false);
  };

  const vendorItems = vendor.items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden rune-border"
        style={{
          background: 'rgba(12,8,4,0.98)',
          border: '1px solid rgba(180,140,90,0.35)',
          boxShadow: '0 0 60px rgba(0,0,0,0.9)',
        }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: 'rgba(30,20,8,0.7)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'rgba(60,40,10,0.6)', border: '1px solid rgba(201,169,110,0.3)' }}>
              {vendor.portrait_emoji || '🏪'}
            </div>
            <div>
              <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>{vendor.name}</h2>
              <p className="text-xs italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {vendor.greeting || 'Welcome, traveler!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(201,169,110,0.4)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Gold */}
        <div className="px-5 py-2 flex items-center justify-between flex-shrink-0"
          style={{ background: 'rgba(8,5,2,0.7)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
          <span className="text-sm" style={{ color: 'rgba(180,140,90,0.5)' }}>Your Gold:</span>
          <div className="flex items-center gap-1.5 font-fantasy font-bold" style={{ color: '#fbbf24' }}>
            <Coins className="w-4 h-4" />
            {playerGold} gp
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 px-5 py-3 flex-shrink-0" style={{ background: 'rgba(10,6,3,0.8)' }}>
          <button onClick={() => setMode('buy')}
            className="flex-1 py-2 rounded-lg font-fantasy text-sm transition-all flex items-center justify-center gap-2"
            style={mode === 'buy' ? {
              background: 'rgba(60,40,10,0.8)',
              border: '1px solid rgba(201,169,110,0.5)',
              color: '#f0c040',
            } : {
              background: 'rgba(20,13,5,0.5)',
              border: '1px solid rgba(180,140,90,0.15)',
              color: 'rgba(180,140,90,0.5)',
            }}>
            <TrendingDown className="w-4 h-4" />
            Buy from {vendor.name}
          </button>
          <button onClick={() => setMode('sell')}
            className="flex-1 py-2 rounded-lg font-fantasy text-sm transition-all flex items-center justify-center gap-2"
            style={mode === 'sell' ? {
              background: 'rgba(60,40,10,0.8)',
              border: '1px solid rgba(201,169,110,0.5)',
              color: '#f0c040',
            } : {
              background: 'rgba(20,13,5,0.5)',
              border: '1px solid rgba(180,140,90,0.15)',
              color: 'rgba(180,140,90,0.5)',
            }}>
            <TrendingUp className="w-4 h-4" />
            Sell Your Items
          </button>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0" style={{ background: 'rgba(8,5,2,0.8)' }}>
          {mode === 'buy' ? (
            vendorItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
                <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>No items in stock</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {vendorItems.map((item, idx) => (
                  <ItemCard
                    key={idx}
                    item={item}
                    mode="buy"
                    playerGold={playerGold}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )
          ) : (
            playerInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
                <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)' }}>Nothing to sell</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {playerInventory.map((item, idx) => (
                  <ItemCard
                    key={idx}
                    item={item}
                    mode="sell"
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Item Detail Modal */}
        <AnimatePresence>
          {selectedItem && (
            <div className="absolute inset-0 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)' }}
              onClick={() => setSelectedItem(null)}>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-xl p-5"
                style={{ background: 'rgba(20,13,5,0.98)', border: '1px solid rgba(180,140,90,0.3)' }}>
                
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{selectedItem.icon || '📦'}</span>
                  <div className="flex-1">
                    <h3 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
                      {selectedItem.name}
                    </h3>
                    {selectedItem.rarity && (
                      <div className="text-xs capitalize mt-1" style={{ color: 'rgba(180,140,90,0.6)' }}>
                        {selectedItem.rarity}
                      </div>
                    )}
                  </div>
                </div>

                {selectedItem.description && (
                  <p className="text-sm mb-4 leading-relaxed" 
                    style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                    {selectedItem.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-4 p-3 rounded-lg"
                  style={{ background: 'rgba(60,40,10,0.4)', border: '1px solid rgba(201,169,110,0.2)' }}>
                  <span className="text-sm" style={{ color: 'rgba(180,140,90,0.6)' }}>
                    {mode === 'buy' ? 'Price:' : 'Sell for:'}
                  </span>
                  <div className="flex items-center gap-1.5 font-fantasy font-bold text-lg" style={{ color: '#fbbf24' }}>
                    <Coins className="w-4 h-4" />
                    {mode === 'buy' ? selectedItem.price : Math.floor((selectedItem.base_price || selectedItem.price || 10) * 0.5)} gp
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSelectedItem(null)}
                    className="flex-1 py-2 rounded-lg text-sm font-fantasy"
                    style={{ background: 'rgba(20,13,5,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => mode === 'buy' ? handleBuy(selectedItem) : handleSell(selectedItem)}
                    disabled={processing || (mode === 'buy' && playerGold < selectedItem.price)}
                    className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50">
                    {processing ? 'Processing...' : mode === 'buy' ? 'Buy' : 'Sell'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ItemCard({ item, mode, playerGold, onClick }) {
  const price = mode === 'buy' ? item.price : Math.floor((item.base_price || item.price || 10) * 0.5);
  const canAfford = mode === 'sell' || playerGold >= price;

  return (
    <button
      onClick={onClick}
      className="p-3 rounded-xl text-left transition-all"
      style={{
        background: canAfford ? 'rgba(20,13,5,0.7)' : 'rgba(40,10,10,0.5)',
        border: `1px solid ${canAfford ? 'rgba(180,140,90,0.2)' : 'rgba(180,50,50,0.3)'}`,
        opacity: canAfford ? 1 : 0.6,
      }}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{item.icon || '📦'}</span>
        {item.quantity > 1 && (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-fantasy"
            style={{ background: 'rgba(80,50,10,0.6)', color: '#e8d5b7' }}>
            ×{item.quantity}
          </span>
        )}
      </div>
      <div className="font-fantasy text-sm font-bold truncate mb-1" style={{ color: '#f0c040' }}>
        {item.name}
      </div>
      <div className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
        <Coins className="w-3 h-3" />
        {price} gp
      </div>
    </button>
  );
}