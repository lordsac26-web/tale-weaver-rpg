import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Sword, Shirt, Crown, Footprints, Hand, Gem, X } from 'lucide-react';

const SLOT_CONFIG = {
  head: { icon: Crown, label: 'Head', color: '#c4b5fd' },
  neck: { icon: Gem, label: 'Neck', color: '#fde68a' },
  chest: { icon: Shirt, label: 'Chest', color: '#93c5fd' },
  hands: { icon: Hand, label: 'Hands', color: '#86efac' },
  ring1: { icon: Gem, label: 'Ring 1', color: '#fbbf24' },
  ring2: { icon: Gem, label: 'Ring 2', color: '#fbbf24' },
  feet: { icon: Footprints, label: 'Feet', color: '#a78bfa' },
  weapon: { icon: Sword, label: 'Weapon', color: '#fca5a5' },
  offhand: { icon: Shield, label: 'Offhand', color: '#60a5fa' },
};

export default function EquipmentSlots({ equipped = {}, inventory = [], onEquip, onUnequip }) {
  const getSlotItem = (slot) => {
    const itemId = equipped[slot];
    if (!itemId) return null;
    return inventory.find(i => i.id === itemId || i.name === itemId);
  };

  const getItemBonusText = (item) => {
    if (!item?.bonuses) return null;
    const parts = [];
    if (item.bonuses.ac) parts.push(`+${item.bonuses.ac} AC`);
    if (item.bonuses.attack) parts.push(`+${item.bonuses.attack} Attack`);
    if (item.bonuses.damage) parts.push(`+${item.bonuses.damage} Damage`);
    if (item.bonuses.saving_throws) parts.push(`+${item.bonuses.saving_throws} Saves`);
    if (item.bonuses.ability_scores) {
      Object.entries(item.bonuses.ability_scores).forEach(([stat, val]) => {
        parts.push(`+${val} ${stat.slice(0, 3).toUpperCase()}`);
      });
    }
    return parts.join(' · ');
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.entries(SLOT_CONFIG).map(([slotKey, config]) => {
        const item = getSlotItem(slotKey);
        const Icon = config.icon;
        const bonusText = getItemBonusText(item);

        return (
          <motion.div
            key={slotKey}
            whileHover={{ scale: 1.02 }}
            className="stat-box rounded-xl p-3 text-center cursor-pointer group relative"
            onClick={() => {
              if (item) {
                onUnequip(slotKey);
              } else {
                // Show equippable items for this slot
                const eligible = inventory.filter(i => {
                  if (slotKey === 'weapon') return ['weapon', 'melee', 'ranged'].includes(i.type || i.category);
                  if (slotKey === 'offhand') return ['shield', 'weapon'].includes(i.type || i.category);
                  if (slotKey.startsWith('ring')) return (i.type || i.category) === 'ring';
                  return (i.slot || i.type) === slotKey;
                });
                if (eligible.length > 0 && onEquip) {
                  onEquip(slotKey, eligible[0]); // Auto-equip first eligible
                }
              }
            }}>
            
            {/* Unequip button */}
            {item && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnequip(slotKey); }}
                className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(60,20,20,0.8)', border: '1px solid rgba(180,50,50,0.4)' }}>
                <X className="w-2.5 h-2.5" style={{ color: '#fca5a5' }} />
              </button>
            )}

            <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: item ? config.color : 'rgba(180,140,90,0.25)' }} />
            
            <div className="text-xs font-fantasy mb-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontSize: '0.62rem', letterSpacing: '0.05em' }}>
              {config.label}
            </div>
            
            {item ? (
              <>
                <div className="text-xs font-semibold truncate" style={{ color: config.color }}>
                  {item.name}
                </div>
                {bonusText && (
                  <div className="text-xs mt-1 truncate" style={{ color: 'rgba(240,192,64,0.6)', fontSize: '0.6rem' }}>
                    {bonusText}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs italic" style={{ color: 'rgba(120,90,50,0.3)' }}>Empty</div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}