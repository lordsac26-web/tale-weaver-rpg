import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Coins, Gem, ScrollText, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];

const RARITY_META = {
  common: { label: 'Common', color: '#e8d5b7', border: 'rgba(180,150,100,0.28)', baseCost: 100 },
  uncommon: { label: 'Uncommon', color: '#86efac', border: 'rgba(40,160,80,0.38)', baseCost: 350 },
  rare: { label: 'Rare', color: '#93c5fd', border: 'rgba(60,120,220,0.42)', baseCost: 1200 },
  'very rare': { label: 'Very Rare', color: '#c084fc', border: 'rgba(168,85,247,0.46)', baseCost: 4500 },
  legendary: { label: 'Legendary', color: '#f0c040', border: 'rgba(201,169,110,0.55)', baseCost: 12000 },
};

function normalizeRarity(rarity) {
  const value = String(rarity || 'uncommon').toLowerCase().replace(/_/g, ' ').trim();
  if (value.includes('legendary')) return 'legendary';
  if (value.includes('very')) return 'very rare';
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
}

function getMagicItemCost(item) {
  const rarity = normalizeRarity(item.rarity);
  const meta = RARITY_META[rarity] || RARITY_META.uncommon;
  const attunementCost = item.requires_attunement ? Math.round(meta.baseCost * 0.2) : 0;
  const chargeCost = item.charges ? Number(item.charges) * Math.round(meta.baseCost * 0.04) : 0;
  return meta.baseCost + attunementCost + chargeCost;
}

function getMechanicalSummary(item) {
  const entries = [];
  if (item.requires_attunement) entries.push('Requires attunement');
  if (item.charges) entries.push(`${item.charges} charges`);
  if (item.recharge) entries.push(`Recharge: ${item.recharge}`);
  Object.entries(item.modifiers || {}).slice(0, 3).forEach(([key, value]) => {
    const label = key.replace(/_/g, ' ');
    entries.push(`${label}: ${typeof value === 'number' && value > 0 ? '+' : ''}${value}`);
  });
  return entries;
}

function buildInventoryItem(item) {
  const rarity = normalizeRarity(item.rarity);
  return {
    name: item.identified_name || item.name,
    category: item.category || 'Wondrous Item',
    rarity,
    base_price: getMagicItemCost(item),
    price: getMagicItemCost(item),
    cost: getMagicItemCost(item),
    quantity: 1,
    weight: item.category === 'Potion' ? 0.5 : 1,
    description: item.description || item.unidentified_description || '',
    effect: getMechanicalSummary(item).join(' · '),
    requires_attunement: !!item.requires_attunement,
    charges: item.charges || null,
    recharge: item.recharge || null,
    modifiers: item.modifiers || {},
    is_magic: true,
    magic_item_id: item.id,
    icon: item.category === 'Potion' ? '🧪' : item.category === 'Weapon' ? '⚔️' : item.category === 'Armor' ? '🛡️' : '💎',
  };
}

function MagicItemCard({ item, character, onBuy }) {
  const [buying, setBuying] = useState(false);
  const rarity = normalizeRarity(item.rarity);
  const meta = RARITY_META[rarity] || RARITY_META.uncommon;
  const cost = getMagicItemCost(item);
  const canAfford = (character?.gold || 0) >= cost;
  const mechanics = getMechanicalSummary(item);

  const handleBuy = async () => {
    if (!canAfford) return;
    setBuying(true);
    await onBuy(item);
    setBuying(false);
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,10,5,0.68)', border: `1px solid ${meta.border}`, boxShadow: rarity !== 'common' ? `0 0 16px ${meta.border}` : 'none' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(10,6,3,0.72)', border: `1px solid ${meta.border}` }}>
          <Gem className="w-5 h-5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-fantasy font-bold text-sm leading-tight" style={{ color: meta.color }}>{item.identified_name || item.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: 'rgba(232,213,183,0.55)' }}>
            <span>{meta.label}</span>
            <span>·</span>
            <span>{item.category || 'Wondrous Item'}</span>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'rgba(232,213,183,0.66)', fontFamily: 'EB Garamond, serif' }}>
        {item.description || item.unidentified_description || 'A magical item with unusual properties.'}
      </p>

      {mechanics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mechanics.map(text => (
            <span key={text} className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(80,50,120,0.28)', border: '1px solid rgba(168,85,247,0.28)', color: '#ddd6fe' }}>
              {text}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(180,140,90,0.1)' }}>
        <div className="flex items-center gap-1.5 font-fantasy font-bold" style={{ color: '#fbbf24' }}>
          <Coins className="w-4 h-4" /> {cost} gp
        </div>
        <button onClick={handleBuy} disabled={!canAfford || buying} className="px-3 py-1.5 rounded-lg font-fantasy text-xs disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: 'rgba(50,35,5,0.85)', border: '1px solid rgba(201,169,110,0.42)', color: '#f0c040' }}>
          {buying ? 'Buying...' : canAfford ? 'Buy' : 'Too Costly'}
        </button>
      </div>
    </div>
  );
}

export default function MagicItemMarket({ character, onTransaction }) {
  const { data: magicItems = [], isLoading } = useQuery({
    queryKey: ['market-magic-items'],
    queryFn: () => base44.entities.MagicItem.list('name', 80),
  });

  const groupedItems = useMemo(() => {
    return RARITY_ORDER.reduce((groups, rarity) => {
      groups[rarity] = magicItems.filter(item => normalizeRarity(item.rarity) === rarity).slice(0, 8);
      return groups;
    }, {});
  }, [magicItems]);

  const handleBuy = async (item) => {
    const inventoryItem = buildInventoryItem(item);
    const newGold = (character.gold || 0) - inventoryItem.price;
    const newInventory = [...(character.inventory || []), inventoryItem];
    await base44.entities.Character.update(character.id, { gold: newGold, inventory: newInventory });
    await onTransaction({ gold: newGold, inventory: newInventory });
  };

  if (!character) return null;

  return (
    <section className="mt-8 rounded-2xl p-4" style={{ background: 'rgba(12,8,4,0.82)', border: '1px solid rgba(168,85,247,0.22)' }}>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(45,20,75,0.5)', border: '1px solid rgba(168,85,247,0.3)' }}>
          <Wand2 className="w-5 h-5" style={{ color: '#c084fc' }} />
        </div>
        <div>
          <h2 className="font-fantasy-deco font-bold text-lg" style={{ color: '#d8b4fe' }}>Arcane Relic Exchange</h2>
          <p className="text-sm" style={{ color: 'rgba(232,213,183,0.62)', fontFamily: 'EB Garamond, serif' }}>
            Magic items grouped by rarity, priced by power, attunement, and charges.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm" style={{ color: 'rgba(232,213,183,0.55)' }}>Summoning the relic catalogue...</div>
      ) : magicItems.length === 0 ? (
        <div className="py-8 text-center text-sm" style={{ color: 'rgba(232,213,183,0.55)' }}>No magic items are available yet.</div>
      ) : (
        <div className="space-y-6">
          {RARITY_ORDER.map(rarity => groupedItems[rarity]?.length > 0 && (
            <div key={rarity}>
              <div className="flex items-center gap-2 mb-3">
                {rarity === 'common' ? <ScrollText className="w-4 h-4" /> : rarity === 'legendary' ? <Sparkles className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                <h3 className="font-fantasy uppercase tracking-widest text-xs" style={{ color: RARITY_META[rarity].color }}>{RARITY_META[rarity].label}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedItems[rarity].map(item => (
                  <MagicItemCard key={item.id} item={item} character={character} onBuy={handleBuy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}