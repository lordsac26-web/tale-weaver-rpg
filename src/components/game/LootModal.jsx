import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Loader2, Package, X, Coins } from 'lucide-react';
import { CATEGORY_ICONS, ITEM_RARITY } from './itemData';

function LootItem({ item }) {
  const r = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg"
      style={{ background: 'rgba(15,10,5,0.65)', border: `1px solid ${r.border}` }}>
      <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[item.category] || '📦'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-body truncate" style={{ color: r.color }}>{item.name}</div>
        {item.description && (
          <div className="text-xs line-clamp-1" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
            {item.description}
          </div>
        )}
      </div>
      <span className="text-xs flex-shrink-0 font-fantasy" style={{ color: r.color, opacity: 0.8 }}>
        {r.icon} {r.label}
      </span>
    </div>
  );
}

export default function LootModal({ enemies, character, onClose, onCollect }) {
  const [loot, setLoot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLoot();
  }, []);

  const loadLoot = async () => {
    setLoading(true);
    const result = await base44.functions.invoke('generateLoot', {
      enemies: enemies.map(e => ({ name: e.name, cr: e.cr || 1, xp: e.xp || 100 })),
      character_level: character.level || 1,
    });
    setLoot(result.data);
    setLoading(false);
  };

  const handleTakeAll = async () => {
    if (!loot) return;
    setSaving(true);
    const updates = {
      gold:   (character.gold   || 0) + (loot.gold   || 0),
      silver: (character.silver || 0) + (loot.silver || 0),
      copper: (character.copper || 0) + (loot.copper || 0),
      inventory: [
        ...(character.inventory || []),
        ...(loot.items || []).map(it => ({ ...it, quantity: it.quantity || 1, magic_properties: it.magic_properties || [] })),
      ],
    };
    await base44.entities.Character.update(character.id, updates);
    // Pass loot snapshot back so Game.jsx can store it in combat history
    onCollect(updates, {
      gold: loot.gold || 0,
      silver: loot.silver || 0,
      copper: loot.copper || 0,
      items: (loot.items || []).map(it => ({ name: it.name, icon: it.icon, rarity: it.rarity })),
    });
    setSaving(false);
    onClose();
  };

  const hasCoins = loot && (loot.gold > 0 || loot.silver > 0 || loot.copper > 0);
  const hasItems = loot?.items?.length > 0;
  const isEmpty  = !hasCoins && !hasItems;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}>
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, rgba(28,14,5,0.99), rgba(18,9,3,0.99))',
          border: '1px solid rgba(201,169,110,0.35)',
          boxShadow: '0 0 60px rgba(201,169,110,0.08), 0 20px 60px rgba(0,0,0,0.8)',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-fantasy-deco font-bold text-xl text-glow-gold" style={{ color: '#f0c040' }}>
              ⚔️ Victory Spoils
            </h2>
            <p className="text-xs font-body mt-0.5" style={{ color: 'rgba(201,169,110,0.45)' }}>
              You search the fallen...
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(180,140,90,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.35)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a96e' }} />
              <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.45)' }}>Searching bodies...</span>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Package className="w-10 h-10 opacity-20" style={{ color: '#c9a96e' }} />
              <p className="text-sm font-body italic" style={{ color: 'rgba(180,140,90,0.4)' }}>
                Nothing of value remains.
              </p>
            </div>
          ) : (
            <>
              {/* Coins */}
              {hasCoins && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(45,28,5,0.7)', border: '1px solid rgba(201,169,110,0.22)' }}>
                  <div className="font-fantasy text-xs tracking-widest mb-2.5" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.62rem' }}>COINAGE</div>
                  <div className="flex gap-4 justify-center">
                    {loot.gold > 0 && (
                      <div className="text-center">
                        <div className="font-fantasy font-bold text-2xl text-glow-gold" style={{ color: '#f0c040' }}>{loot.gold}</div>
                        <div className="text-xs font-body" style={{ color: 'rgba(180,140,90,0.45)' }}>Gold</div>
                      </div>
                    )}
                    {loot.silver > 0 && (
                      <div className="text-center">
                        <div className="font-fantasy font-bold text-2xl" style={{ color: '#e2e8f0' }}>{loot.silver}</div>
                        <div className="text-xs font-body" style={{ color: 'rgba(180,140,90,0.45)' }}>Silver</div>
                      </div>
                    )}
                    {loot.copper > 0 && (
                      <div className="text-center">
                        <div className="font-fantasy font-bold text-2xl" style={{ color: '#fb923c' }}>{loot.copper}</div>
                        <div className="text-xs font-body" style={{ color: 'rgba(180,140,90,0.45)' }}>Copper</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items */}
              {hasItems && (
                <div className="space-y-1.5">
                  <div className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.62rem' }}>ITEMS FOUND</div>
                  {loot.items.map((item, i) => <LootItem key={i} item={item} />)}
                </div>
              )}

              {/* Flavor text */}
              {loot.flavor_text && (
                <p className="text-xs italic font-serif leading-relaxed" style={{ color: 'rgba(201,169,110,0.38)' }}>
                  "{loot.flavor_text}"
                </p>
              )}
            </>
          )}

          {/* Action buttons */}
          {!loading && (
            <div className="flex gap-2 pt-1">
              {!isEmpty && (
                <button onClick={handleTakeAll} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '🎒'}
                  {saving ? 'Collecting...' : 'Take All'}
                </button>
              )}
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-fantasy"
                style={{ border: '1px solid rgba(180,140,90,0.18)', color: 'rgba(180,140,90,0.5)' }}>
                Leave
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}