import React, { useState } from 'react';
import { Plus, Trash2, Shield, Sword, Package, ArrowUpDown, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const ITEM_CATEGORIES = ['Weapon', 'Armor', 'Potion', 'Tool', 'Adventuring Gear', 'Magic Item', 'Ammunition', 'Currency', 'Other'];

const CATEGORY_ICONS = {
  Weapon: '⚔️', Armor: '🛡️', Potion: '🧪', Tool: '🔧',
  'Adventuring Gear': '🎒', 'Magic Item': '✨', Ammunition: '🏹', Currency: '💰', Other: '📦'
};

const DEFAULT_ITEM = { name: '', category: 'Other', quantity: 1, weight: 0, cost: 0, cost_unit: 'gp', damage: '', armor_class: 0, attack_bonus: 0, description: '', equipped: false };

function CurrencyPanel({ character, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ gold: character.gold || 0, silver: character.silver || 0, copper: character.copper || 0 });

  // Auto-convert: 100cp = 1sp, 10sp = 1gp
  const convertAll = () => {
    let { gold, silver, copper } = values;
    const totalCopper = gold * 1000 + silver * 100 + copper;
    const newGold = Math.floor(totalCopper / 1000);
    const remainingAfterGold = totalCopper % 1000;
    const newSilver = Math.floor(remainingAfterGold / 100);
    const newCopper = remainingAfterGold % 100;
    const updated = { gold: newGold, silver: newSilver, copper: newCopper };
    setValues(updated);
    onUpdate(updated);
    setEditing(false);
  };

  const save = () => { onUpdate(values); setEditing(false); };

  return (
    <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.18)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.65rem' }}>TREASURY</span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={convertAll} className="text-xs font-fantasy transition-colors" style={{ color: '#93c5fd' }}>Convert</button>
              <button onClick={save} className="text-xs font-fantasy transition-colors" style={{ color: '#86efac' }}>Save</button>
              <button onClick={() => { setValues({ gold: character.gold||0, silver: character.silver||0, copper: character.copper||0 }); setEditing(false); }} className="text-xs font-fantasy" style={{ color: 'rgba(180,140,90,0.4)' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs font-fantasy transition-colors" style={{ color: 'rgba(201,169,110,0.4)' }}>Edit</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'gold', label: 'Gold', color: '#f0c040', bg: 'rgba(60,40,5,0.5)', border: 'rgba(201,169,110,0.25)' },
          { key: 'silver', label: 'Silver', color: '#e2e8f0', bg: 'rgba(30,30,40,0.5)', border: 'rgba(150,160,180,0.2)' },
          { key: 'copper', label: 'Copper', color: '#fb923c', bg: 'rgba(40,20,5,0.5)', border: 'rgba(180,80,30,0.25)' }
        ].map(({ key, label, color, bg, border }) => (
          <div key={key} className="rounded-lg p-2 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xs mb-0.5" style={{ color: 'rgba(180,150,100,0.45)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
            {editing ? (
              <input type="number" min="0" value={values[key]}
                onChange={e => setValues(v => ({ ...v, [key]: parseInt(e.target.value) || 0 }))}
                className="w-full text-center bg-transparent outline-none font-fantasy font-bold text-base"
                style={{ color }}
              />
            ) : (
              <div className="font-fantasy font-bold text-base" style={{ color }}>{values[key] || 0}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddItemForm({ onAdd, onCancel }) {
  const [item, setItem] = useState({ ...DEFAULT_ITEM });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (k, v) => setItem(prev => ({ ...prev, [k]: v }));

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,10,4,0.8)', border: '1px solid rgba(180,140,90,0.2)' }}>
      <div className="font-fantasy text-sm" style={{ color: '#c9a96e' }}>Add Item</div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Item name *" value={item.name} onChange={e => set('name', e.target.value)}
          className="col-span-2 rounded-lg px-3 py-1.5 text-sm input-fantasy" />
        <select value={item.category} onChange={e => set('category', e.target.value)} className="rounded-lg px-2 py-1.5 text-sm select-fantasy">
          {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 1)}
          className="rounded-lg px-3 py-1.5 text-sm input-fantasy" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="number" placeholder="Weight (lb)" min="0" step="0.1" value={item.weight || ''} onChange={e => set('weight', parseFloat(e.target.value) || 0)}
          className="rounded-lg px-3 py-1.5 text-sm input-fantasy" />
        <input type="number" placeholder="Cost" min="0" value={item.cost || ''} onChange={e => set('cost', parseFloat(e.target.value) || 0)}
          className="rounded-lg px-3 py-1.5 text-sm input-fantasy" />
        <select value={item.cost_unit} onChange={e => set('cost_unit', e.target.value)} className="rounded-lg px-2 py-1.5 text-sm select-fantasy">
          <option value="gp">GP</option>
          <option value="sp">SP</option>
          <option value="cp">CP</option>
        </select>
      </div>

      <button onClick={() => setShowAdvanced(v => !v)}
        className="text-xs font-fantasy flex items-center gap-1 transition-colors"
        style={{ color: 'rgba(201,169,110,0.45)' }}>
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {item.category === 'Weapon' || item.category === 'Armor' ? 'Combat stats' : 'More details'}
      </button>

      {showAdvanced && (
        <div className="space-y-2">
          {item.category === 'Weapon' && (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Damage (e.g. 1d8 slashing)" value={item.damage} onChange={e => set('damage', e.target.value)}
                className="col-span-2 rounded-lg px-3 py-1.5 text-xs input-fantasy" />
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>Atk+:</span>
                <input type="number" value={item.attack_bonus} onChange={e => set('attack_bonus', parseInt(e.target.value) || 0)}
                  className="flex-1 rounded px-2 py-1 text-xs input-fantasy" />
              </div>
            </div>
          )}
          {item.category === 'Armor' && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>AC value:</span>
              <input type="number" min="0" value={item.armor_class} onChange={e => set('armor_class', parseInt(e.target.value) || 0)}
                className="w-20 rounded px-2 py-1 text-xs input-fantasy" />
            </div>
          )}
          <textarea placeholder="Notes / description" value={item.description} onChange={e => set('description', e.target.value)} rows={2}
            className="w-full rounded-lg px-3 py-1.5 text-xs input-fantasy resize-none" />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={() => { if (item.name) onAdd(item); }} disabled={!item.name}
          className="flex-1 py-2 rounded-lg text-sm btn-fantasy disabled:opacity-40">
          Add to Inventory
        </button>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm"
          style={{ border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.4)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function InventoryTab({ character, onUpdate }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [filterCategory, setFilterCategory] = useState('all');
  const [equippedItems, setEquippedItems] = useState(character.equipped || {});

  const inventory = character.inventory || [];

  const handleAddItem = (item) => {
    const newInventory = [...inventory, item];
    onUpdate({ inventory: newInventory });
    setShowAddForm(false);
  };

  const handleRemoveItem = (index) => {
    const newInventory = inventory.filter((_, i) => i !== index);
    onUpdate({ inventory: newInventory });
  };

  const handleEquipItem = (item, index) => {
    const slot = item.category === 'Weapon' ? 'weapon' : item.category === 'Armor' ? 'armor' : null;
    if (!slot) return;

    const newInventory = inventory.map((it, i) => {
      if (it.category === item.category) return { ...it, equipped: false };
      return it;
    });
    newInventory[index] = { ...item, equipped: !item.equipped };

    const newEquipped = { ...equippedItems };
    if (!item.equipped) {
      newEquipped[slot] = item;
    } else {
      delete newEquipped[slot];
    }

    // Recalculate AC if equipping armor
    const updates = { inventory: newInventory, equipped: newEquipped };
    if (slot === 'armor' && !item.equipped && item.armor_class) {
      updates.armor_class = item.armor_class;
    }

    setEquippedItems(newEquipped);
    onUpdate(updates);
  };

  const sorted = [...inventory]
    .filter(it => filterCategory === 'all' || it.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'weight') return (b.weight || 0) - (a.weight || 0);
      if (sortBy === 'cost') return (b.cost || 0) - (a.cost || 0);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

  const totalWeight = inventory.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);

  return (
    <div className="space-y-3">
      <CurrencyPanel character={character} onUpdate={onUpdate} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Categories</option>
          {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Type</option>
          <option value="weight">Sort: Weight</option>
          <option value="cost">Sort: Value</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          {inventory.length} items · {totalWeight.toFixed(1)} lb
        </span>
      </div>

      {showAddForm && <AddItemForm onAdd={handleAddItem} onCancel={() => setShowAddForm(false)} />}

      {/* Equipped summary */}
      {(equippedItems.weapon || equippedItems.armor) && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(10,30,12,0.5)', border: '1px solid rgba(40,160,80,0.2)' }}>
          <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(86,239,172,0.5)', fontSize: '0.65rem' }}>EQUIPPED</div>
          <div className="flex gap-3 flex-wrap">
            {equippedItems.weapon && (
              <div className="flex items-center gap-2 text-xs">
                <span>⚔️</span>
                <span style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{equippedItems.weapon.name}</span>
                {equippedItems.weapon.damage && <span style={{ color: '#fca5a5' }}>{equippedItems.weapon.damage}</span>}
                {equippedItems.weapon.attack_bonus > 0 && <span style={{ color: '#86efac' }}>+{equippedItems.weapon.attack_bonus}</span>}
              </div>
            )}
            {equippedItems.armor && (
              <div className="flex items-center gap-2 text-xs">
                <span>🛡️</span>
                <span style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{equippedItems.armor.name}</span>
                {equippedItems.armor.armor_class && <span style={{ color: '#93c5fd' }}>AC {equippedItems.armor.armor_class}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory list */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-2">
          <Package className="w-10 h-10 opacity-10" style={{ color: '#c9a96e' }} />
          <span className="text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>
            {filterCategory !== 'all' ? 'No items in this category' : 'Your satchel is empty'}
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((item, i) => {
            const origIndex = inventory.indexOf(item);
            const canEquip = item.category === 'Weapon' || item.category === 'Armor';
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all fantasy-card"
                style={item.equipped ? {
                  background: 'rgba(10,35,12,0.6)',
                  border: '1px solid rgba(40,160,80,0.3)',
                } : {
                  background: 'rgba(15,10,5,0.55)',
                  border: '1px solid rgba(180,140,90,0.1)',
                }}>
                <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{item.name}</span>
                    {item.quantity > 1 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>×{item.quantity}</span>}
                    {item.equipped && <span className="text-xs px-1.5 py-0.5 rounded-full badge-green">Equipped</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>{item.category}</span>
                    {item.weight > 0 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>{item.weight}lb</span>}
                    {item.cost > 0 && <span className="text-xs" style={{ color: '#d97706' }}>{item.cost} {item.cost_unit}</span>}
                    {item.damage && <span className="text-xs" style={{ color: '#fca5a5' }}>{item.damage}</span>}
                    {item.armor_class > 0 && <span className="text-xs" style={{ color: '#93c5fd' }}>AC {item.armor_class}</span>}
                    {item.attack_bonus > 0 && <span className="text-xs" style={{ color: '#86efac' }}>+{item.attack_bonus}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEquip && (
                    <button onClick={() => handleEquipItem(item, origIndex)}
                      className="p-1.5 rounded-lg text-xs border transition-all"
                      style={item.equipped ? {
                        background: 'rgba(10,50,15,0.6)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac'
                      } : {
                        background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)'
                      }}>
                      {item.category === 'Weapon' ? '⚔️' : '🛡️'}
                    </button>
                  )}
                  <button onClick={() => handleRemoveItem(origIndex)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'rgba(180,60,60,0.4)', border: '1px solid transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(80,10,10,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(180,60,60,0.4)'; e.currentTarget.style.background = 'transparent'; }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}