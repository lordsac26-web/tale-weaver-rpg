import React, { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_STANDARD_ITEMS, ITEM_CATEGORIES, getItemsByCategory, searchItems } from './standardItems';
import { SRD_MAGIC_ITEMS, ITEM_RARITY, CATEGORY_ICONS, CATEGORY_TO_SLOT } from './itemData';

const ALL_SEARCHABLE = [...ALL_STANDARD_ITEMS, ...SRD_MAGIC_ITEMS];

const normalizeRarity = (rarity) => {
  const value = String(rarity || 'common').toLowerCase();
  if (value.includes('artifact')) return 'artifact';
  if (value.includes('legendary')) return 'legendary';
  if (value.includes('very rare') || value.includes('epic')) return 'epic';
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
};

const normalizeCategory = (category) => {
  const categories = ['Weapon','Armor','Shield','Helmet','Cloak','Gloves','Boots','Belt','Ring','Amulet','Wondrous Item','Potion','Ammunition','Tool','Adventuring Gear','Other'];
  const value = String(category || '').toLowerCase();
  return categories.find(cat => cat.toLowerCase() === value) || 'Wondrous Item';
};

const normalizeMagicEntityItem = (item) => {
  const category = normalizeCategory(item.category);
  const modifiers = item.modifiers || {};
  return {
    name: item.name,
    category,
    equip_slot: CATEGORY_TO_SLOT[category] || null,
    rarity: normalizeRarity(item.rarity),
    requires_attunement: !!item.requires_attunement,
    quantity: 1,
    weight: category === 'Potion' ? 0.5 : 1,
    cost: 0,
    cost_unit: 'gp',
    attack_bonus: modifiers.weapon_bonus || 0,
    damage_bonus: modifiers.weapon_bonus || 0,
    ac_bonus: modifiers.ac_bonus || 0,
    description: item.description || item.unidentified_description || '',
    magic_properties: [],
    is_magic: true,
    magic_item_id: item.id,
  };
};

const dedupeByName = (items) => {
  const seen = new Set();
  return items.filter(item => {
    const key = String(item.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function ItemDatabaseSearch({ onSelectItem, compact = false }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showMagic, setShowMagic] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  const { data: magicDatabaseItems = [] } = useQuery({
    queryKey: ['magic-items-database'],
    queryFn: () => base44.entities.MagicItem.list('name', 1500),
    initialData: [],
  });

  const fullMagicCatalog = useMemo(() => {
    const importedMagicItems = magicDatabaseItems.map(normalizeMagicEntityItem);
    return dedupeByName([...SRD_MAGIC_ITEMS, ...importedMagicItems]);
  }, [magicDatabaseItems]);

  const results = useMemo(() => {
    let pool;
    if (showMagic) {
      const searchable = [...ALL_STANDARD_ITEMS, ...fullMagicCatalog];
      pool = query ? searchItems(query, searchable) : searchable;
    } else {
      const catItems = getItemsByCategory(category);
      pool = query ? searchItems(query, catItems) : catItems;
    }
    return pool.slice(0, 50);
  }, [query, category, showMagic, fullMagicCatalog]);

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(180,140,90,0.35)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search weapons, armor, gear, magic items..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm input-fantasy"
          />
        </div>
        <button
          onClick={() => setShowMagic(v => !v)}
          className="px-3 py-2 rounded-lg text-xs font-fantasy transition-all flex-shrink-0"
          style={showMagic
            ? { background: 'rgba(80,30,120,0.6)', border: '1px solid rgba(140,80,220,0.5)', color: '#d4b3ff' }
            : { background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)' }
          }>
          ✨ Magic Items
        </button>
      </div>

      {/* Category tabs — only when not searching and not showing magic */}
      {!query && !showMagic && !compact && (
        <div className="flex gap-1 flex-wrap">
          {ITEM_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className="px-2 py-1 rounded text-xs font-fantasy transition-all"
              style={category === cat.key
                ? { background: 'rgba(60,40,10,0.8)', border: '1px solid rgba(201,169,110,0.4)', color: '#f0c040' }
                : { border: '1px solid rgba(180,140,90,0.12)', color: 'rgba(180,140,90,0.4)' }
              }>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className={`space-y-1 overflow-y-auto ${compact ? 'max-h-56' : 'max-h-72'}`}>
        {results.length === 0 ? (
          <div className="text-center py-6 text-xs" style={{ color: 'rgba(180,140,90,0.3)' }}>
            No items found{query ? ` for "${query}"` : ''}.
          </div>
        ) : results.map((item, i) => {
          const r = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
          const isExpanded = expandedItem === i;
          return (
            <div key={`${item.name}-${i}`} className="rounded-lg overflow-hidden transition-all"
              style={{ background: 'rgba(15,10,5,0.6)', border: `1px solid ${r.border || 'rgba(180,140,90,0.12)'}` }}>
              <div className="flex items-center gap-2 p-2">
                <span className="text-sm flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm truncate" style={{ color: r.color || '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>
                      {item.name}
                    </span>
                    {item.rarity && item.rarity !== 'common' && (
                      <span className="text-xs px-1 py-0.5 rounded font-fantasy"
                        style={{ background: r.glow, border: `1px solid ${r.border}`, color: r.color, fontSize: '0.55rem' }}>
                        {r.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
                    {item.damage && <span style={{ color: '#fca5a5' }}>{item.damage}</span>}
                    {item.armor_class > 0 && <span style={{ color: '#93c5fd' }}>AC {item.armor_class}</span>}
                    {item.weight > 0 && <span>{item.weight}lb</span>}
                    {item.cost > 0 && <span style={{ color: '#d97706' }}>{item.cost}{item.cost_unit}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(item.description || item.properties?.length > 0) && (
                    <button onClick={() => setExpandedItem(isExpanded ? null : i)}
                      className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.3)' }}>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                  <button onClick={() => onSelectItem({ ...item })}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(10,35,12,0.5)', border: '1px solid rgba(40,160,80,0.3)', color: '#86efac' }}
                    title="Add to inventory">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="px-3 pb-2 pt-0">
                  {item.properties?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {item.properties.map(p => (
                        <span key={p} className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(40,25,8,0.6)', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.6)', fontSize: '0.58rem' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.description && (
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                      {item.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-right" style={{ color: 'rgba(180,140,90,0.25)' }}>
        {results.length} item{results.length !== 1 ? 's' : ''} shown
      </div>
    </div>
  );
}