import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Sword, Shield, Package, Sparkles, Droplet, Weight, Coins, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  weapon: { icon: Sword, label: 'Weapons', color: '#fca5a5' },
  armor: { icon: Shield, label: 'Armor', color: '#93c5fd' },
  consumable: { icon: Droplet, label: 'Consumables', color: '#86efac' },
  magic: { icon: Sparkles, label: 'Magic Items', color: '#d4b3ff' },
  misc: { icon: Package, label: 'Miscellaneous', color: '#fde68a' }
};

const RARITY_COLORS = {
  common: { bg: 'rgba(120,120,120,0.15)', border: 'rgba(156,163,175,0.3)', text: '#d1d5db' },
  uncommon: { bg: 'rgba(20,80,20,0.15)', border: 'rgba(74,222,128,0.3)', text: '#86efac' },
  rare: { bg: 'rgba(20,60,140,0.15)', border: 'rgba(96,165,250,0.3)', text: '#93c5fd' },
  'very rare': { bg: 'rgba(80,20,140,0.15)', border: 'rgba(192,132,252,0.3)', text: '#c084fc' },
  legendary: { bg: 'rgba(140,60,10,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' }
};

export default function Inventory() {
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadCharacter();
  }, []);

  const loadCharacter = async () => {
    const user = await base44.auth.me();
    const chars = await base44.entities.Character.filter({ created_by: user.email, is_active: true });
    if (chars[0]) setCharacter(chars[0]);
    setLoading(false);
  };

  const calcCarryCapacity = (str) => (str || 10) * 15;
  const calcTotalWeight = (inventory) => (inventory || []).reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0);

  const equipItem = async (item) => {
    if (!character) return;
    
    const slot = item.category === 'weapon' ? 'weapon' : 
                 item.category === 'armor' ? 'armor' : null;
    
    if (!slot) {
      toast.error('This item cannot be equipped');
      return;
    }

    const currentEquipped = character.equipped || {};
    const updates = { equipped: { ...currentEquipped, [slot]: item } };
    
    // Auto-calculate AC for armor
    if (slot === 'armor' && item.armor_class) {
      const baseAC = parseInt(item.armor_class) || 10;
      const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);
      const maxDexBonus = item.armor_type === 'heavy' ? 0 : item.armor_type === 'medium' ? 2 : 99;
      updates.armor_class = baseAC + Math.min(dexMod, maxDexBonus);
    }

    await base44.entities.Character.update(character.id, updates);
    setCharacter(prev => ({ ...prev, ...updates }));
    toast.success(`Equipped ${item.name}`);
    setSelectedItem(null);
  };

  const unequipItem = async (slot) => {
    if (!character?.equipped?.[slot]) return;
    
    const updates = { equipped: { ...character.equipped, [slot]: null } };
    
    // Reset AC if unequipping armor
    if (slot === 'armor') {
      const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);
      updates.armor_class = 10 + dexMod;
    }

    await base44.entities.Character.update(character.id, updates);
    setCharacter(prev => ({ ...prev, ...updates }));
    toast.success('Item unequipped');
  };

  const useConsumable = async (item) => {
    if (!character) return;
    
    const inventory = character.inventory || [];
    const itemIndex = inventory.findIndex(i => i.name === item.name);
    if (itemIndex === -1) return;

    // Parse effect
    let updates = {};
    const effect = item.effect || '';
    
    if (effect.includes('restore') || effect.includes('heal')) {
      const hpMatch = effect.match(/(\d+)d(\d+)/);
      let healing = 0;
      if (hpMatch) {
        const [_, num, sides] = hpMatch;
        for (let i = 0; i < parseInt(num); i++) {
          healing += Math.floor(Math.random() * parseInt(sides)) + 1;
        }
      } else {
        const flatMatch = effect.match(/(\d+)\s*hp/i);
        if (flatMatch) healing = parseInt(flatMatch[1]);
      }
      
      if (healing > 0) {
        updates.hp_current = Math.min(character.hp_max, (character.hp_current || 0) + healing);
        toast.success(`Restored ${healing} HP!`);
      }
    }

    // Remove or decrement item
    const updatedInventory = [...inventory];
    if (item.quantity > 1) {
      updatedInventory[itemIndex] = { ...item, quantity: item.quantity - 1 };
    } else {
      updatedInventory.splice(itemIndex, 1);
    }
    updates.inventory = updatedInventory;

    await base44.entities.Character.update(character.id, updates);
    setCharacter(prev => ({ ...prev, ...updates }));
    setSelectedItem(null);
  };

  const dropItem = async (item) => {
    if (!character) return;
    const inventory = character.inventory || [];
    const updatedInventory = inventory.filter(i => i.name !== item.name || i.quantity !== item.quantity);
    await base44.entities.Character.update(character.id, { inventory: updatedInventory });
    setCharacter(prev => ({ ...prev, inventory: updatedInventory }));
    toast.success(`Dropped ${item.name}`);
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment-bg">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full"
          style={{ borderColor: 'rgba(201,169,110,0.3)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment-bg">
        <div className="text-center">
          <p className="font-fantasy" style={{ color: 'rgba(201,169,110,0.6)' }}>No active character found</p>
          <button onClick={() => navigate('/Home')}
            className="mt-4 px-6 py-2 rounded-xl btn-fantasy">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const inventory = character.inventory || [];
  const equipped = character.equipped || {};
  const totalWeight = calcTotalWeight(inventory);
  const carryCapacity = calcCarryCapacity(character.strength);
  const weightPct = (totalWeight / carryCapacity) * 100;

  const filteredInventory = inventory.filter(item => {
    const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
    const searchMatch = !searchQuery || 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <div className="min-h-screen parchment-bg" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="glass-panel border-b-0 rounded-none p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/Home')}
              className="p-2 rounded-lg transition-all"
              style={{ color: 'rgba(201,169,110,0.5)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-fantasy font-bold text-glow-gold" style={{ color: '#f0c040' }}>
              Inventory
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(60,40,8,0.5)', border: '1px solid rgba(201,169,110,0.25)' }}>
              <Coins className="w-4 h-4" style={{ color: '#fbbf24' }} />
              <span className="font-fantasy text-sm" style={{ color: '#f0c040' }}>
                {character.gold || 0}<span className="text-xs ml-0.5">gp</span>
              </span>
              <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)' }}>·</span>
              <span className="font-fantasy text-sm" style={{ color: '#d4d4d8' }}>
                {character.silver || 0}<span className="text-xs ml-0.5">sp</span>
              </span>
              <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)' }}>·</span>
              <span className="font-fantasy text-sm" style={{ color: '#b87333' }}>
                {character.copper || 0}<span className="text-xs ml-0.5">cp</span>
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(40,20,8,0.5)', border: '1px solid rgba(201,169,110,0.25)' }}>
              <Weight className="w-4 h-4" style={{ color: 'rgba(201,169,110,0.6)' }} />
              <span className="font-mono text-sm" style={{ color: weightPct > 100 ? '#fca5a5' : '#e8d5b7' }}>
                {totalWeight.toFixed(1)} / {carryCapacity} lbs
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT - Equipped Items */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-fantasy font-bold text-lg mb-4 flex items-center gap-2"
              style={{ color: '#f0c040' }}>
              <Sword className="w-5 h-5" />
              Equipped Gear
            </h2>

            <div className="space-y-3">
              {['weapon', 'armor', 'shield', 'accessory'].map(slot => {
                const item = equipped[slot];
                return (
                  <div key={slot} className="stat-box rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-fantasy tracking-wider uppercase"
                        style={{ color: 'rgba(201,169,110,0.5)' }}>
                        {slot}
                      </span>
                      {item && (
                        <button onClick={() => unequipItem(slot)}
                          className="text-xs px-2 py-0.5 rounded transition-all"
                          style={{
                            background: 'rgba(80,20,20,0.4)',
                            border: '1px solid rgba(180,50,50,0.3)',
                            color: 'rgba(252,165,165,0.7)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(220,80,80,0.5)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(180,50,50,0.3)'}>
                          Unequip
                        </button>
                      )}
                    </div>
                    {item ? (
                      <div>
                        <p className="font-fantasy font-semibold text-sm mb-1" style={{ color: '#e8d5b7' }}>
                          {item.name}
                        </p>
                        {item.damage_dice && (
                          <p className="text-xs" style={{ color: 'rgba(252,165,165,0.7)' }}>
                            Damage: {item.damage_dice} {item.damage_type ? `(${item.damage_type})` : ''}
                          </p>
                        )}
                        {item.armor_class && (
                          <p className="text-xs" style={{ color: 'rgba(147,197,253,0.7)' }}>
                            AC: {item.armor_class}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-xs mt-1 italic" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
                            {item.description.slice(0, 80)}...
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: 'rgba(201,169,110,0.25)' }}>
                        Empty slot
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(201,169,110,0.15)' }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(80,20,20,0.3)' }}>
                  <p className="text-xs" style={{ color: 'rgba(252,165,165,0.5)' }}>Attack Bonus</p>
                  <p className="font-fantasy font-bold text-lg" style={{ color: '#fca5a5' }}>
                    +{(equipped.weapon?.attack_bonus || 0) + Math.floor(((character.strength || 10) - 10) / 2)}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(20,60,140,0.3)' }}>
                  <p className="text-xs" style={{ color: 'rgba(147,197,253,0.5)' }}>Armor Class</p>
                  <p className="font-fantasy font-bold text-lg" style={{ color: '#93c5fd' }}>
                    {character.armor_class || 10}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT - Inventory Items */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-fantasy font-bold text-lg flex items-center gap-2"
                style={{ color: '#f0c040' }}>
                <Package className="w-5 h-5" />
                Backpack
                <span className="text-sm font-normal" style={{ color: 'rgba(201,169,110,0.5)' }}>
                  ({inventory.length} items)
                </span>
              </h2>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'rgba(201,169,110,0.3)' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className="pl-9 pr-3 py-1.5 rounded-lg text-sm input-fantasy w-48"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setSelectedCategory('all')}
                className="px-3 py-1.5 rounded-lg text-xs font-fantasy transition-all"
                style={selectedCategory === 'all' ? {
                  background: 'rgba(80,50,10,0.6)',
                  border: '1px solid rgba(201,169,110,0.5)',
                  color: '#f0c040'
                } : {
                  background: 'rgba(20,13,5,0.4)',
                  border: '1px solid rgba(180,140,90,0.2)',
                  color: 'rgba(201,169,110,0.5)'
                }}>
                All Items
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button key={key} onClick={() => setSelectedCategory(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-fantasy transition-all flex items-center gap-1.5"
                    style={selectedCategory === key ? {
                      background: 'rgba(80,50,10,0.6)',
                      border: '1px solid rgba(201,169,110,0.5)',
                      color: config.color
                    } : {
                      background: 'rgba(20,13,5,0.4)',
                      border: '1px solid rgba(180,140,90,0.2)',
                      color: 'rgba(201,169,110,0.5)'
                    }}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </button>
                );
              })}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
              {filteredInventory.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <Package className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(201,169,110,0.2)' }} />
                  <p className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.4)' }}>
                    {searchQuery ? 'No items match your search' : 'Your backpack is empty'}
                  </p>
                </div>
              ) : (
                filteredInventory.map((item, idx) => {
                  const rarityStyle = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
                  const categoryConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.misc;
                  const Icon = categoryConfig.icon;
                  
                  return (
                    <motion.button key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedItem(item)}
                      className="stat-box rounded-xl p-3 text-left transition-all fantasy-card"
                      style={{
                        background: rarityStyle.bg,
                        borderColor: rarityStyle.border
                      }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: categoryConfig.color }} />
                          <span className="font-fantasy font-semibold text-sm" style={{ color: rarityStyle.text }}>
                            {item.name}
                          </span>
                        </div>
                        {item.quantity > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-fantasy"
                            style={{
                              background: 'rgba(201,169,110,0.2)',
                              border: '1px solid rgba(201,169,110,0.3)',
                              color: '#f0c040'
                            }}>
                            ×{item.quantity}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-2 line-clamp-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                        {item.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-fantasy" style={{ color: 'rgba(201,169,110,0.4)' }}>
                          {item.rarity || 'common'}
                        </span>
                        {item.weight > 0 && (
                          <span style={{ color: 'rgba(201,169,110,0.4)' }}>
                            {item.weight * (item.quantity || 1)} lbs
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setSelectedItem(null)}>
            
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel rounded-2xl p-6 max-w-md w-full relative">
              
              <button onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-all"
                style={{ color: 'rgba(201,169,110,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.4)'}>
                <X className="w-4 h-4" />
              </button>

              {/* Item Header */}
              <div className="flex items-start gap-3 mb-4">
                {(() => {
                  const Icon = CATEGORY_CONFIG[selectedItem.category]?.icon || Package;
                  return <Icon className="w-6 h-6 mt-1" style={{ color: CATEGORY_CONFIG[selectedItem.category]?.color || '#fde68a' }} />;
                })()}
                <div className="flex-1">
                  <h3 className="font-fantasy font-bold text-xl mb-1"
                    style={{ color: RARITY_COLORS[selectedItem.rarity]?.text || '#e8d5b7' }}>
                    {selectedItem.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-fantasy px-2 py-0.5 rounded-full badge-gold">
                      {selectedItem.rarity || 'common'}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)' }}>
                      {selectedItem.category || 'misc'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-4">
                {selectedItem.damage_dice && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(201,169,110,0.6)' }}>Damage:</span>
                    <span className="font-fantasy" style={{ color: '#fca5a5' }}>
                      {selectedItem.damage_dice} {selectedItem.damage_type && `(${selectedItem.damage_type})`}
                    </span>
                  </div>
                )}
                {selectedItem.armor_class && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(201,169,110,0.6)' }}>Armor Class:</span>
                    <span className="font-fantasy" style={{ color: '#93c5fd' }}>{selectedItem.armor_class}</span>
                  </div>
                )}
                {selectedItem.weight > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(201,169,110,0.6)' }}>Weight:</span>
                    <span style={{ color: '#e8d5b7' }}>{selectedItem.weight} lbs</span>
                  </div>
                )}
                {selectedItem.value && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(201,169,110,0.6)' }}>Value:</span>
                    <span style={{ color: '#fbbf24' }}>{selectedItem.value} gp</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedItem.description && (
                <div className="mb-4 p-3 rounded-lg neuro-inset">
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Effect */}
              {selectedItem.effect && (
                <div className="mb-4 p-3 rounded-lg"
                  style={{ background: 'rgba(40,80,20,0.2)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Effect:</p>
                  <p className="text-sm" style={{ color: '#86efac', fontFamily: 'EB Garamond, serif' }}>
                    {selectedItem.effect}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {(selectedItem.category === 'weapon' || selectedItem.category === 'armor') && (
                  <button onClick={() => equipItem(selectedItem)}
                    className="w-full py-2.5 rounded-xl font-fantasy font-semibold text-sm btn-fantasy">
                    Equip {selectedItem.category}
                  </button>
                )}
                
                {selectedItem.category === 'consumable' && (
                  <button onClick={() => { useConsumable(selectedItem); }}
                    className="w-full py-2.5 rounded-xl font-fantasy font-semibold text-sm transition-all"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20,80,40,0.8), rgba(10,50,20,0.9))',
                      border: '1px solid rgba(74,222,128,0.4)',
                      color: '#86efac'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.6)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(40,160,80,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    Use Item
                  </button>
                )}

                <button onClick={() => dropItem(selectedItem)}
                  className="w-full py-2 rounded-xl font-fantasy text-sm transition-all"
                  style={{
                    background: 'rgba(60,20,20,0.5)',
                    border: '1px solid rgba(180,50,50,0.3)',
                    color: 'rgba(252,165,165,0.7)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(220,80,80,0.5)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(180,50,50,0.3)'}>
                  Drop Item
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}