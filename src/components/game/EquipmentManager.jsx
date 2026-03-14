import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Shield, Shirt, Crown, Gem, X, Check, Info } from 'lucide-react';
import EquipmentSlots from './EquipmentSlots';

export default function EquipmentManager({ character, onUpdateCharacter }) {
  const [showEquipModal, setShowEquipModal] = useState(null); // { slot: string }
  const [selectedItem, setSelectedItem] = useState(null);

  const inventory = character?.inventory || [];
  const equipped = character?.equipped || {};

  const handleEquip = async (slot, item) => {
    const newEquipped = { ...equipped, [slot]: item.id || item.name };
    
    // Calculate and apply bonuses
    const updates = { equipped: newEquipped };
    const recalc = recalculateStats(character, newEquipped, inventory);
    Object.assign(updates, recalc);
    
    await onUpdateCharacter(updates);
    setShowEquipModal(null);
  };

  const handleUnequip = async (slot) => {
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    
    const updates = { equipped: newEquipped };
    const recalc = recalculateStats(character, newEquipped, inventory);
    Object.assign(updates, recalc);
    
    await onUpdateCharacter(updates);
  };

  const getEligibleItems = (slot) => {
    return inventory.filter(item => {
      if (slot === 'weapon') return ['weapon', 'melee', 'ranged'].includes(item.type || item.category);
      if (slot === 'offhand') return ['shield', 'weapon'].includes(item.type || item.category);
      if (slot.startsWith('ring')) return (item.type || item.category) === 'ring';
      if (slot === 'chest') return ['armor', 'chest'].includes(item.type || item.category);
      if (slot === 'head') return ['helmet', 'head', 'headgear'].includes(item.type || item.category);
      if (slot === 'hands') return ['gloves', 'gauntlets', 'hands'].includes(item.type || item.category);
      if (slot === 'feet') return ['boots', 'feet'].includes(item.type || item.category);
      if (slot === 'neck') return ['amulet', 'necklace', 'neck'].includes(item.type || item.category);
      return false;
    });
  };

  return (
    <div className="space-y-4">
      <EquipmentSlots
        equipped={equipped}
        inventory={inventory}
        onEquip={(slot) => setShowEquipModal({ slot })}
        onUnequip={handleUnequip}
      />

      {/* Equip Modal */}
      <AnimatePresence>
        {showEquipModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowEquipModal(null)}>
            
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl overflow-hidden rune-border"
              style={{ background: 'rgba(15,10,5,0.98)', border: '1px solid rgba(180,140,90,0.3)', boxShadow: '0 0 60px rgba(0,0,0,0.9)', maxHeight: '80vh' }}>
              
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
                <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
                  Equip to {showEquipModal.slot.replace(/\d/, ' $&')}
                </h2>
                <button onClick={() => setShowEquipModal(null)} className="p-1 rounded transition-colors" style={{ color: 'rgba(180,140,90,0.4)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
                {getEligibleItems(showEquipModal.slot).map((item, i) => {
                  const bonuses = item.bonuses || {};
                  const hasBonuses = Object.keys(bonuses).length > 0;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => handleEquip(showEquipModal.slot, item)}
                      className="w-full p-4 rounded-xl text-left transition-all fantasy-card"
                      style={{ background: 'rgba(25,15,5,0.7)', border: '1px solid rgba(180,140,90,0.25)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-fantasy font-bold text-sm mb-1" style={{ color: item.rarity === 'legendary' ? '#fbbf24' : item.rarity === 'rare' ? '#a78bfa' : item.rarity === 'uncommon' ? '#86efac' : '#e8d5b7' }}>
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-xs mb-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                              {item.description}
                            </p>
                          )}
                          {hasBonuses && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {bonuses.ac && (
                                <span className="px-2 py-0.5 rounded-full text-xs badge-gold">
                                  🛡️ +{bonuses.ac} AC
                                </span>
                              )}
                              {bonuses.attack && (
                                <span className="px-2 py-0.5 rounded-full text-xs badge-blood">
                                  ⚔️ +{bonuses.attack} Attack
                                </span>
                              )}
                              {bonuses.damage && (
                                <span className="px-2 py-0.5 rounded-full text-xs badge-blood">
                                  💥 +{bonuses.damage} Damage
                                </span>
                              )}
                              {bonuses.saving_throws && (
                                <span className="px-2 py-0.5 rounded-full text-xs badge-arcane">
                                  ✨ +{bonuses.saving_throws} Saves
                                </span>
                              )}
                              {bonuses.ability_scores && Object.entries(bonuses.ability_scores).map(([stat, val]) => (
                                <span key={stat} className="px-2 py-0.5 rounded-full text-xs badge-green">
                                  {stat.slice(0,3).toUpperCase()} +{val}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#86efac' }} />
                      </div>
                    </button>
                  );
                })}
                {getEligibleItems(showEquipModal.slot).length === 0 && (
                  <div className="text-center py-8 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
                    No items available for this slot
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Recalculate character stats based on equipped items
function recalculateStats(character, equipped, inventory) {
  const updates = {};
  let acBonus = 0;
  let attackBonus = 0;
  let damageBonus = 0;
  let savingThrowBonus = 0;
  const abilityBonuses = {};

  Object.values(equipped).forEach(itemIdOrName => {
    const item = inventory.find(i => i.id === itemIdOrName || i.name === itemIdOrName);
    if (!item?.bonuses) return;

    if (item.bonuses.ac) acBonus += item.bonuses.ac;
    if (item.bonuses.attack) attackBonus += item.bonuses.attack;
    if (item.bonuses.damage) damageBonus += item.bonuses.damage;
    if (item.bonuses.saving_throws) savingThrowBonus += item.bonuses.saving_throws;
    if (item.bonuses.ability_scores) {
      Object.entries(item.bonuses.ability_scores).forEach(([stat, val]) => {
        abilityBonuses[stat] = (abilityBonuses[stat] || 0) + val;
      });
    }
  });

  // Apply ability score bonuses to stats
  if (Object.keys(abilityBonuses).length > 0) {
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(stat => {
      if (abilityBonuses[stat]) {
        updates[stat] = (character[stat] || 10) + abilityBonuses[stat];
      }
    });
  }

  // Recalculate AC (base 10 + DEX + bonuses + armor)
  const dexMod = Math.floor(((updates.dexterity || character.dexterity || 10) - 10) / 2);
  const wisMod = Math.floor(((updates.wisdom || character.wisdom || 10) - 10) / 2);
  const conMod = Math.floor(((updates.constitution || character.constitution || 10) - 10) / 2);
  
  let baseAC = 10 + dexMod;
  
  // Class-specific unarmored defense
  if (character.class === 'Monk') {
    baseAC = 10 + dexMod + wisMod;
  } else if (character.class === 'Barbarian') {
    baseAC = 10 + dexMod + conMod;
  }
  
  // Check for equipped armor
  const armor = inventory.find(i => (equipped.chest === i.id || equipped.chest === i.name) && ['armor', 'chest'].includes(i.type || i.category));
  if (armor?.armor_class) {
    baseAC = armor.armor_class;
    if (armor.max_dex_bonus !== undefined) {
      baseAC += Math.min(dexMod, armor.max_dex_bonus);
    } else {
      baseAC += dexMod;
    }
  }
  
  updates.armor_class = baseAC + acBonus;

  // Store bonuses as active_modifiers for combat calculations
  const modifiers = [];
  if (attackBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'attack', value: attackBonus });
  if (damageBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'damage', value: damageBonus });
  if (savingThrowBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'saving_throws', value: savingThrowBonus });
  
  updates.active_modifiers = [
    ...(character.active_modifiers || []).filter(m => m.source !== 'equipment'),
    ...modifiers
  ];

  return updates;
}