import React, { useState } from 'react';
import { Plus, Trash2, Package, ChevronDown, ChevronUp, Search, Sparkles, ShieldCheck, X, FlaskConical } from 'lucide-react';
import ConsumableUseModal from './ConsumableUseModal';
import {
  ITEM_RARITY, EQUIP_SLOTS, CATEGORY_TO_SLOT, ALL_ITEM_CATEGORIES, CATEGORY_ICONS,
  MAGIC_PROPERTIES, SRD_MAGIC_ITEMS, getEquipConstraints, computeAC
} from './itemData';
import { searchMagicItems } from './open5eApi';
import { motion, AnimatePresence } from 'framer-motion';

const RARITIES = Object.keys(ITEM_RARITY);

const DEFAULT_ITEM = {
  name: '', category: 'Other', equip_slot: null, quantity: 1, weight: 0,
  cost: 0, cost_unit: 'gp', damage: '', damage_type: '', armor_class: 0,
  armor_type: 'light', attack_bonus: 0, description: '', rarity: 'common',
  requires_attunement: false, magic_properties: [], is_magic: false,
};

// ─── Currency Panel ────────────────────────────────────────────────────────────
function CurrencyPanel({ character, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ gold: character.gold || 0, silver: character.silver || 0, copper: character.copper || 0 });

  const convertAll = () => {
    const totalCopper = values.gold * 1000 + values.silver * 100 + values.copper;
    const updated = {
      gold: Math.floor(totalCopper / 1000),
      silver: Math.floor((totalCopper % 1000) / 100),
      copper: totalCopper % 100,
    };
    setValues(updated); onUpdate(updated); setEditing(false);
  };

  const save = () => { onUpdate(values); setEditing(false); };

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.18)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.65rem' }}>TREASURY</span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={convertAll} className="text-xs font-fantasy" style={{ color: '#93c5fd' }}>Convert</button>
              <button onClick={save} className="text-xs font-fantasy" style={{ color: '#86efac' }}>Save</button>
              <button onClick={() => setEditing(false)} className="text-xs font-fantasy" style={{ color: 'rgba(180,140,90,0.4)' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.4)' }}>Edit</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'gold',   label: 'Gold',   color: '#f0c040', bg: 'rgba(60,40,5,0.5)',  border: 'rgba(201,169,110,0.25)' },
          { key: 'silver', label: 'Silver', color: '#e2e8f0', bg: 'rgba(30,30,40,0.5)', border: 'rgba(150,160,180,0.2)' },
          { key: 'copper', label: 'Copper', color: '#fb923c', bg: 'rgba(40,20,5,0.5)',  border: 'rgba(180,80,30,0.25)' },
        ].map(({ key, label, color, bg, border }) => (
          <div key={key} className="rounded-lg p-2 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xs mb-0.5" style={{ color: 'rgba(180,150,100,0.45)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
            {editing ? (
              <input type="number" min="0" value={values[key]}
                onChange={e => setValues(v => ({ ...v, [key]: parseInt(e.target.value) || 0 }))}
                className="w-full text-center bg-transparent outline-none font-fantasy font-bold text-base" style={{ color }} />
            ) : (
              <div className="font-fantasy font-bold text-base" style={{ color }}>{values[key] || 0}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Equipped Paperdoll ────────────────────────────────────────────────────────
function EquipmentPaperdoll({ equipped, onUnequip }) {
  const slotOrder = ['helmet','cloak','amulet','mainhand','armor','offhand','gloves','ring','belt','boots','trinket'];
  const hasAny = Object.values(equipped).some(Boolean);
  if (!hasAny) return null;

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(10,25,15,0.5)', border: '1px solid rgba(40,160,80,0.18)' }}>
      <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(86,239,172,0.45)', fontSize: '0.65rem' }}>EQUIPPED</div>
      <div className="grid grid-cols-2 gap-1.5">
        {slotOrder.map(slot => {
          const item = equipped[slot];
          if (!item) return null;
          const slotDef = EQUIP_SLOTS[slot];
          const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
          return (
            <div key={slot} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(10,20,10,0.5)', border: `1px solid ${rarity.border}` }}>
              <span className="text-sm flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate" style={{ color: rarity.color, fontFamily: 'EB Garamond, serif' }}>{item.name}</div>
                <div className="text-xs" style={{ color: 'rgba(180,140,90,0.3)', fontSize: '0.6rem' }}>{slotDef?.label}</div>
              </div>
              <button onClick={() => onUnequip(slot)}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
                style={{ color: 'rgba(180,60,60,0.5)' }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Item Rarity Badge ─────────────────────────────────────────────────────────
function RarityBadge({ rarity }) {
  const r = ITEM_RARITY[rarity] || ITEM_RARITY.common;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
      style={{ background: `${r.glow}`, border: `1px solid ${r.border}`, color: r.color, fontSize: '0.6rem' }}>
      {r.icon} {r.label}
    </span>
  );
}

// ─── Magic Property Badge ──────────────────────────────────────────────────────
function MagicPropBadge({ propKey }) {
  const prop = MAGIC_PROPERTIES[propKey];
  if (!prop) return null;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
      style={{ background: 'rgba(80,30,120,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: '#d4b3ff', fontSize: '0.6rem' }}
      title={prop.desc}>
      {prop.label}
    </span>
  );
}

// ─── Add / Edit Item Form ──────────────────────────────────────────────────────
function AddItemForm({ onAdd, onCancel }) {
  const [item, setItem] = useState({ ...DEFAULT_ITEM });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState('custom'); // 'custom' | 'srd' | 'lookup'

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

  // Auto-set equip_slot from category
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
              {(item.category === 'Weapon') && (
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

    {/* Consumable Use Modal */}
    <AnimatePresence>
      {consumableModal && (
        <ConsumableUseModal
          item={consumableModal.item}
          character={character}
          onUse={handleConsumableUsed}
          onClose={() => setConsumableModal(null)}
        />
      )}
    </AnimatePresence>
  );
}

// ─── Item Row ──────────────────────────────────────────────────────────────────
const CONSUMABLE_CATEGORIES = ['Potion', 'Ammunition', 'Adventuring Gear'];

function ItemRow({ item, origIndex, equipped, onEquip, onRemove, onIdentify, onUseConsumable }) {
  const [expanded, setExpanded] = useState(false);
  const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
  const slot = item.equip_slot || CATEGORY_TO_SLOT[item.category];
  const canEquip = !!slot;
  const isEquipped = canEquip && Object.entries(equipped).some(([s, i]) => i && i === item);
  const isUnidentifiedMagic = item.is_magic && !item.is_identified;
  const isConsumable = CONSUMABLE_CATEGORIES.includes(item.category);

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={isEquipped ? { background: 'rgba(10,35,12,0.6)', border: `1px solid ${rarity.border}` } :
        { background: 'rgba(15,10,5,0.55)', border: `1px solid rgba(180,140,90,0.1)` }}>
      <div className="flex items-center gap-2 p-2.5">
        <span className="text-base flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium" style={{ color: rarity.color, fontFamily: 'EB Garamond, serif' }}>{item.name}</span>
            {item.quantity > 1 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>×{item.quantity}</span>}
            <RarityBadge rarity={item.rarity || 'common'} />
            {item.requires_attunement && <span className="text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(60,20,80,0.5)', border: '1px solid rgba(160,80,220,0.3)', color: '#c4b5fd', fontSize: '0.58rem' }}>Attune</span>}
            {isEquipped && <span className="text-xs px-1.5 py-0.5 rounded-full badge-green">Equipped</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>{item.category}</span>
            {item.weight > 0 && <span className="text-xs" style={{ color: 'rgba(180,140,90,0.3)' }}>{item.weight}lb</span>}
            {item.cost > 0 && <span className="text-xs" style={{ color: '#d97706' }}>{item.cost}{item.cost_unit}</span>}
            {item.damage && <span className="text-xs" style={{ color: '#fca5a5' }}>{item.damage}</span>}
            {item.armor_class > 0 && <span className="text-xs" style={{ color: '#93c5fd' }}>AC {item.armor_class}</span>}
            {item.attack_bonus > 0 && <span className="text-xs" style={{ color: '#86efac' }}>+{item.attack_bonus} atk</span>}
            {item.is_magic && <Sparkles className="w-3 h-3" style={{ color: '#c084fc' }} />}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(item.magic_properties?.length > 0 || item.description) && (
            <button onClick={() => setExpanded(v => !v)} className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.4)' }}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {isUnidentifiedMagic && (
           <button onClick={() => onIdentify?.(item)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={{ background: 'rgba(80,30,120,0.5)', border: '1px solid rgba(140,80,220,0.4)', color: '#d4b3ff' }}
             title="Identify Item">
             <Sparkles className="w-3.5 h-3.5" />
           </button>
          )}
          {isConsumable && (
           <button onClick={() => onUseConsumable?.(item, origIndex)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={{ background: 'rgba(10,40,15,0.5)', border: '1px solid rgba(40,160,80,0.3)', color: '#86efac' }}
             title="Use Item">
             <FlaskConical className="w-3.5 h-3.5" />
           </button>
          )}
          {canEquip && (
           <button onClick={() => onEquip(item, origIndex, slot)}
             className="p-1.5 rounded-lg text-xs border transition-all"
             style={isEquipped ? {
               background: 'rgba(10,50,15,0.6)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac'
             } : {
               background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)'
             }}
             title={isEquipped ? 'Unequip' : `Equip (${EQUIP_SLOTS[slot]?.label})`}>
             <ShieldCheck className="w-3.5 h-3.5" />
           </button>
          )}
          <button onClick={() => onRemove(origIndex)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(180,60,60,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(80,10,10,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(180,60,60,0.4)'; e.currentTarget.style.background = 'transparent'; }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-3 pb-2">
            {item.magic_properties?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {item.magic_properties.map(p => <MagicPropBadge key={p} propKey={p} />)}
              </div>
            )}
            {item.description && (
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {item.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main InventoryTab ─────────────────────────────────────────────────────────
export default function InventoryTab({ character, onUpdate, onIdentify }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [equipped, setEquipped] = useState(character.equipped || {});
  const [consumableModal, setConsumableModal] = useState(null); // { item, index }

  const inventory = character.inventory || [];

  const handleAddItem = (item) => {
    const newInventory = [...inventory, item];
    onUpdate({ inventory: newInventory });
    setShowAddForm(false);
  };

  const handleRemoveItem = (index) => {
    const removedItem = inventory[index];
    const newInventory = inventory.filter((_, i) => i !== index);
    // also unequip if equipped
    const newEquipped = { ...equipped };
    Object.entries(newEquipped).forEach(([slot, it]) => {
      if (it && it === removedItem) delete newEquipped[slot];
    });
    setEquipped(newEquipped);
    onUpdate({ inventory: newInventory, equipped: newEquipped });
  };

  const handleEquipItem = (item, index, slot) => {
    const newEquipped = { ...equipped };
    const isCurrentlyEquipped = Object.entries(newEquipped).some(([s, i]) => i && i === item);

    if (isCurrentlyEquipped) {
      // Unequip
      Object.entries(newEquipped).forEach(([s, i]) => { if (i === item) delete newEquipped[s]; });
    } else {
      const constraint = getEquipConstraints(newEquipped, item);
      if (!constraint.canEquip) {
        alert(constraint.reason);
        return;
      }
      // For rings, support dual slot
      if (slot === 'ring') {
        if (!newEquipped.ring) newEquipped.ring = item;
        else if (!newEquipped.ring2) newEquipped.ring2 = item;
        else newEquipped.ring = item; // replace first
      } else {
        newEquipped[slot] = item;
      }
      // Handle two-handed: clear offhand
      const isTwoHanded = (item.magic_properties || []).includes('Two-Handed') || item.properties?.includes('Two-Handed');
      if (slot === 'mainhand' && isTwoHanded) delete newEquipped.offhand;
    }

    // Recompute AC
    const newAC = computeAC(character, newEquipped);
    setEquipped(newEquipped);
    onUpdate({ equipped: newEquipped, armor_class: newAC });
  };

  const handleUseConsumable = (item, index) => {
    setConsumableModal({ item, index });
  };

  const handleConsumableUsed = (item, updates) => {
    // Consume 1 quantity or remove entirely
    const inventory = character.inventory || [];
    const idx = consumableModal.index;
    let newInventory;
    if ((item.quantity || 1) > 1) {
      newInventory = inventory.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it);
    } else {
      newInventory = inventory.filter((_, i) => i !== idx);
    }
    onUpdate({ ...updates, inventory: newInventory });
    setConsumableModal(null);
  };

  const handleUnequip = (slot) => {
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    const newAC = computeAC(character, newEquipped);
    setEquipped(newEquipped);
    onUpdate({ equipped: newEquipped, armor_class: newAC });
  };

  const sorted = [...inventory]
    .filter(it => filterCategory === 'all' || it.category === filterCategory)
    .filter(it => filterRarity === 'all' || it.rarity === filterRarity)
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'rarity') {
        const order = ['common','uncommon','rare','epic','legendary','artifact','wondrous'];
        return order.indexOf(b.rarity) - order.indexOf(a.rarity);
      }
      if (sortBy === 'weight') return (b.weight || 0) - (a.weight || 0);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

  const totalWeight = inventory.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);
  const magicCount = inventory.filter(it => it.is_magic || it.rarity !== 'common').length;

  return (
    <div className="space-y-2">
      <CurrencyPanel character={character} onUpdate={onUpdate} />
      <EquipmentPaperdoll equipped={equipped} onUnequip={handleUnequip} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Types</option>
          {ALL_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
        <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Rarities</option>
          {RARITIES.map(r => <option key={r} value={r}>{ITEM_RARITY[r].icon} {ITEM_RARITY[r].label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="name">Name</option>
          <option value="rarity">Rarity</option>
          <option value="category">Type</option>
          <option value="weight">Weight</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          {inventory.length} items{magicCount > 0 ? ` · ${magicCount} ✨` : ''} · {totalWeight.toFixed(1)}lb
        </span>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AddItemForm onAdd={handleAddItem} onCancel={() => setShowAddForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item List */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-2">
          <Package className="w-10 h-10 opacity-10" style={{ color: '#c9a96e' }} />
          <span className="text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>
            {filterCategory !== 'all' || filterRarity !== 'all' ? 'No items match filters' : 'Your satchel is empty'}
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
           {sorted.map((item, i) => {
             const origIndex = inventory.indexOf(item);
             return (
               <ItemRow key={i} item={item} origIndex={origIndex}
                 equipped={equipped} onEquip={handleEquipItem} onRemove={handleRemoveItem}
                 onIdentify={onIdentify} onUseConsumable={handleUseConsumable} />
             );
           })}
         </div>
      )}
    </div>
  );
}