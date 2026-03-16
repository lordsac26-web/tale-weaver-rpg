import React, { useState } from 'react';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import {
  ITEM_RARITY, CATEGORY_TO_SLOT, ALL_ITEM_CATEGORIES, CATEGORY_ICONS,
  MAGIC_PROPERTIES, SRD_MAGIC_ITEMS
} from './itemData';
import { searchMagicItems } from './open5eApi';

const RARITIES = Object.keys(ITEM_RARITY);

const DEFAULT_ITEM = {
  name: '', category: 'Other', equip_slot: null, quantity: 1, weight: 0,
  cost: 0, cost_unit: 'gp', damage: '', damage_type: '', armor_class: 0,
  armor_type: 'light', attack_bonus: 0, description: '', rarity: 'common',
  requires_attunement: false, magic_properties: [], is_magic: false,
};

function RarityBadge({ rarity }) {
  const r = ITEM_RARITY[rarity] || ITEM_RARITY.common;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
      style={{ background: `${r.glow}`, border: `1px solid ${r.border}`, color: r.color, fontSize: '0.6rem' }}>
      {r.icon} {r.label}
    </span>
  );
}

export default function AddItemForm({ onAdd, onCancel }) {
  const [item, setItem] = useState({ ...DEFAULT_ITEM });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState('custom');

  const set = (k, v) => setItem(prev => ({ ...prev, [k]: v }));

  const toggleMagicProp = (propKey) => {
    const existing = item.magic_properties || [];
    if (existing.includes(propKey)) {
      set('magic_properties', existing.filter(p => p !== propKey));
    } else {
      set('magic_properties', [...existing, propKey]);
      if (!item.is_magic) set('is_magic', true);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchMagicItems(searchQuery);
    setSearchResults(results.slice(0, 8));
    setSearching(false);
  };

  const selectSRDItem = (srdItem) => {
    setItem({ ...DEFAULT_ITEM, ...srdItem });
    setTab('custom');
  };

  const handleCategoryChange = (cat) => {
    set('category', cat);
    set('equip_slot', CATEGORY_TO_SLOT[cat] || null);
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,10,4,0.9)', border: '1px solid rgba(180,140,90,0.2)' }}>
      {/* Tabs */}
      <div className="flex gap-1 mb-1">
        {[['custom','Custom Item'],['srd','SRD Presets'],['lookup','Open5e Search']].map(([t,label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs px-2 py-1 rounded font-fantasy transition-all"
            style={tab === t ? { background: 'rgba(80,50,10,0.8)', border: '1px solid rgba(201,169,110,0.4)', color: '#f0c040' } :
              { background: 'transparent', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* SRD Presets */}
      {tab === 'srd' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {SRD_MAGIC_ITEMS.map((srdItem, i) => {
            const r = ITEM_RARITY[srdItem.rarity] || ITEM_RARITY.common;
            return (
              <button key={i} onClick={() => selectSRDItem(srdItem)}
                className="w-full text-left p-2 rounded-lg transition-all"
                style={{ background: 'rgba(15,10,5,0.6)', border: `1px solid ${r.border}` }}>
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[srdItem.category] || '📦'}</span>
                  <span className="text-sm flex-1" style={{ color: r.color, fontFamily: 'EB Garamond, serif' }}>{srdItem.name}</span>
                  <RarityBadge rarity={srdItem.rarity} />
                </div>
                <div className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                  {srdItem.description?.slice(0, 80)}...
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Open5e Lookup */}
      {tab === 'lookup' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search magic items..." className="flex-1 rounded-lg px-3 py-1.5 text-sm input-fantasy" />
            <button onClick={handleSearch} className="px-3 py-1.5 rounded-lg btn-fantasy text-xs">
              {searching ? '...' : <Search className="w-4 h-4" />}
            </button>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => selectSRDItem(r)}
                className="w-full text-left p-2 rounded-lg transition-all"
                style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.12)' }}>
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[r.category] || '📦'}</span>
                  <span className="text-sm flex-1" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{r.name}</span>
                  <RarityBadge rarity={r.rarity} />
                </div>
              </button>
            ))}
            {!searching && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-4 text-xs" style={{ color: 'rgba(180,140,90,0.3)' }}>No results found.</div>
            )}
          </div>
        </div>
      )}

      {/* Custom Item Form */}
      {tab === 'custom' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Item name *" value={item.name} onChange={e => set('name', e.target.value)}
              className="col-span-2 rounded-lg px-3 py-1.5 text-sm input-fantasy" />
            <select value={item.category} onChange={e => handleCategoryChange(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm select-fantasy">
              {ALL_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={item.rarity} onChange={e => set('rarity', e.target.value)} className="rounded-lg px-2 py-1.5 text-sm select-fantasy">
              {RARITIES.map(r => <option key={r} value={r}>{ITEM_RARITY[r].label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 1)} className="rounded-lg px-3 py-1.5 text-sm input-fantasy" />
            <input type="number" placeholder="Weight (lb)" min="0" step="0.1" value={item.weight || ''} onChange={e => set('weight', parseFloat(e.target.value) || 0)} className="rounded-lg px-3 py-1.5 text-sm input-fantasy" />
            <div className="flex gap-1">
              <input type="number" placeholder="Cost" min="0" value={item.cost || ''} onChange={e => set('cost', parseFloat(e.target.value) || 0)} className="flex-1 rounded-lg px-2 py-1.5 text-sm input-fantasy" />
              <select value={item.cost_unit} onChange={e => set('cost_unit', e.target.value)} className="w-14 rounded-lg px-1 py-1.5 text-xs select-fantasy">
                <option value="gp">GP</option><option value="sp">SP</option><option value="cp">CP</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="magic-toggle" checked={item.is_magic} onChange={e => set('is_magic', e.target.checked)} className="w-3 h-3" />
            <label htmlFor="magic-toggle" className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>Magical Item</label>
            <input type="checkbox" id="attune-toggle" checked={item.requires_attunement} onChange={e => set('requires_attunement', e.target.checked)} className="w-3 h-3 ml-2" />
            <label htmlFor="attune-toggle" className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>Requires Attunement</label>
          </div>

          <button onClick={() => setShowAdvanced(v => !v)}
            className="text-xs font-fantasy flex items-center gap-1" style={{ color: 'rgba(201,169,110,0.45)' }}>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Combat / Magic Stats
          </button>

          {showAdvanced && (
            <div className="space-y-2">
              {item.category === 'Weapon' && (
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Damage (e.g. 1d8 slashing)" value={item.damage} onChange={e => set('damage', e.target.value)} className="col-span-2 rounded-lg px-3 py-1.5 text-xs input-fantasy" />
                  <input placeholder="Damage type" value={item.damage_type} onChange={e => set('damage_type', e.target.value)} className="rounded-lg px-3 py-1.5 text-xs input-fantasy" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>Atk+:</span>
                    <input type="number" value={item.attack_bonus} onChange={e => set('attack_bonus', parseInt(e.target.value) || 0)} className="flex-1 rounded px-2 py-1 text-xs input-fantasy" />
                  </div>
                </div>
              )}
              {(item.category === 'Armor' || item.category === 'Shield') && (
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>AC:</span>
                    <input type="number" min="0" value={item.armor_class} onChange={e => set('armor_class', parseInt(e.target.value) || 0)} className="w-16 rounded px-2 py-1 text-xs input-fantasy" />
                  </div>
                  <select value={item.armor_type || 'light'} onChange={e => set('armor_type', e.target.value)} className="rounded px-2 py-1 text-xs select-fantasy">
                    <option value="light">Light</option><option value="medium">Medium</option><option value="heavy">Heavy</option>
                  </select>
                </div>
              )}
              {item.is_magic && (
                <div>
                  <div className="text-xs mb-1.5 font-fantasy" style={{ color: 'rgba(192,132,252,0.6)' }}>Magic Properties:</div>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {Object.entries(MAGIC_PROPERTIES).map(([key, prop]) => (
                      <button key={key} onClick={() => toggleMagicProp(key)}
                        className="text-xs px-1.5 py-0.5 rounded font-fantasy transition-all"
                        style={(item.magic_properties || []).includes(key) ? {
                          background: 'rgba(80,30,120,0.6)', border: '1px solid rgba(140,80,220,0.5)', color: '#d4b3ff'
                        } : {
                          background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)'
                        }}>
                        {prop.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea placeholder="Notes / description" value={item.description} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full rounded-lg px-3 py-1.5 text-xs input-fantasy resize-none" />
            </div>
          )}
        </>
      )}

      {tab !== 'srd' && tab !== 'lookup' && (
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
      )}
      {(tab === 'srd' || tab === 'lookup') && (
        <button onClick={onCancel} className="w-full py-2 rounded-lg text-sm text-center"
          style={{ border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.4)' }}>
          Cancel
        </button>
      )}
    </div>
  );
}