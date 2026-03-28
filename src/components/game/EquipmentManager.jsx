import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Shield, X, Check, Info } from 'lucide-react';
import EquipmentSlots from './EquipmentSlots';
import { resolveItemBonuses } from './itemBonuses';

// Unified slot definitions — keys match itemData.js EQUIP_SLOTS and itemData CATEGORY_TO_SLOT
// 'mainhand' is the canonical weapon slot; combatEngine reads character.equipped.weapon which
// recalculateStatsFromEquipment writes by aliasing mainhand → weapon
export const EQUIPMENT_SLOTS = {
  mainhand: { label: 'Weapon',    icon: '⚔️',  cats: ['weapon', 'Weapon', 'melee', 'ranged'] },
  offhand:  { label: 'Off Hand',  icon: '🛡️',  cats: ['shield', 'Shield', 'weapon', 'Weapon'] },
  armor:    { label: 'Armor',     icon: '🥋',  cats: ['armor', 'Armor'] },
  helmet:   { label: 'Helmet',    icon: '⛑️',  cats: ['helmet', 'Helmet', 'head', 'headgear'] },
  amulet:   { label: 'Amulet',    icon: '📿',  cats: ['amulet', 'Amulet', 'necklace', 'neck'] },
  cloak:    { label: 'Cloak',     icon: '🧥',  cats: ['cloak', 'Cloak', 'back'] },
  gloves:   { label: 'Gloves',    icon: '🧤',  cats: ['gloves', 'Gloves', 'gauntlets', 'hands'] },
  boots:    { label: 'Boots',     icon: '👢',  cats: ['boots', 'Boots', 'feet'] },
  ring:     { label: 'Ring 1',    icon: '💍',  cats: ['ring', 'Ring'] },
  ring2:    { label: 'Ring 2',    icon: '💍',  cats: ['ring', 'Ring'] },
  belt:     { label: 'Belt',      icon: '🔗',  cats: ['belt', 'Belt'] },
  trinket:  { label: 'Trinket',   icon: '🔮',  cats: ['trinket', 'Wondrous Item', 'magical', 'accessory'] },
};

const RARITY_COLORS = {
  common:    '#e8d5b7',
  uncommon:  '#86efac',
  rare:      '#a78bfa',
  'very rare': '#f0c040',
  legendary: '#fb923c',
};

function getBonusTags(item) {
  const b = item ? resolveItemBonuses(item) : {};
  const tags = [];
  if (b.ac)             tags.push(`🛡️ +${b.ac} AC`);
  if (b.attack)         tags.push(`⚔️ +${b.attack} Atk`);
  if (b.attack_bonus)   tags.push(`⚔️ +${b.attack_bonus} Atk`);
  if (b.damage)         tags.push(`💥 +${b.damage} Dmg`);
  if (b.saving_throws)  tags.push(`✨ +${b.saving_throws} Saves`);
  if (item?.damage || item?.damage_dice) tags.push(`🎲 ${item.damage || item.damage_dice}`);
  if (item?.armor_class) tags.push(`🛡 AC ${item.armor_class}`);
  if (b.ability_scores) {
    Object.entries(b.ability_scores).forEach(([stat, val]) => {
      tags.push(`${stat.slice(0,3).toUpperCase()} ${val > 0 ? '+' : ''}${val}`);
    });
  }
  return tags;
}

// ─── Equip Modal ───────────────────────────────────────────────────────────────
function EquipModal({ slot, slotMeta, eligibleItems, onEquip, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden rune-border"
        style={{
          background: 'rgba(15,10,5,0.98)',
          border: '1px solid rgba(180,140,90,0.3)',
          boxShadow: '0 0 60px rgba(0,0,0,0.9)',
          maxHeight: '80vh',
        }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
            {slotMeta.icon} Equip {slotMeta.label}
          </h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgba(180,140,90,0.4)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {eligibleItems.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
              No items available for this slot.<br />
              <span className="text-xs opacity-60">Visit the Market or loot enemies to find gear.</span>
            </div>
          ) : (
            eligibleItems.map((item, i) => {
              const color = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
              const tags = getBonusTags(item);
              return (
                <button key={i} onClick={() => onEquip(slot, item)}
                  className="w-full p-4 rounded-xl text-left transition-all fantasy-card"
                  style={{ background: 'rgba(25,15,5,0.7)', border: `1px solid rgba(180,140,90,0.2)` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-lg">{item.icon || slotMeta.icon}</span>
                        <h3 className="font-fantasy font-bold text-sm" style={{ color }}>
                          {item.name}
                        </h3>
                        {item.rarity && item.rarity !== 'common' && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                            style={{ background: 'rgba(30,15,5,0.7)', border: `1px solid ${color}44`, color, fontSize: '0.6rem' }}>
                            {item.rarity}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs mb-2 leading-relaxed" style={{ color: 'rgba(220,190,140,0.65)', fontFamily: 'EB Garamond, serif' }}>
                          {item.description}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag, t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-xs badge-gold">{tag}</span>
                          ))}
                        </div>
                      )}
                      {item.requires_attunement && (
                        <p className="text-xs mt-1" style={{ color: 'rgba(196,181,253,0.5)' }}>⚡ Requires Attunement</p>
                      )}
                    </div>
                    <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: '#86efac' }} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Paperdoll Grid ────────────────────────────────────────────────────────────
function PaperdollGrid({ equipped, onSlotClick, onUnequip }) {
  const slots = Object.entries(EQUIPMENT_SLOTS);
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {slots.map(([slotKey, meta]) => {
        const item = equipped[slotKey];
        const color = item ? (RARITY_COLORS[item.rarity] || RARITY_COLORS.common) : null;
        return (
          <div key={slotKey} className="relative group">
            <button onClick={() => item ? null : onSlotClick(slotKey)}
              className="w-full rounded-lg p-2 text-center transition-all"
              style={{
                background: item ? 'rgba(20,40,15,0.6)' : 'rgba(10,5,2,0.5)',
                border: item ? `1px solid ${color}55` : '1px solid rgba(184,115,51,0.1)',
                boxShadow: item ? `0 0 8px ${color}22` : 'none',
                minHeight: '68px',
              }}>
              <div className="text-lg mb-0.5">{item ? (item.icon || meta.icon) : meta.icon}</div>
              <p className="text-xs font-fantasy leading-tight truncate"
                style={{ color: item ? color : 'rgba(180,140,80,0.5)', fontSize: '0.6rem' }}>
                {item ? item.name : meta.label}
              </p>
              <p className="text-xs" style={{ color: 'rgba(180,140,80,0.35)', fontSize: '0.58rem' }}>{meta.label}</p>
            </button>
            {/* Unequip button on hover */}
            {item && (
              <button onClick={() => onUnequip(slotKey)}
                className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Unequip ${item.name}`}
                style={{ background: 'rgba(60,20,20,0.9)', border: '1px solid rgba(200,50,50,0.4)' }}>
                <X className="w-2.5 h-2.5" style={{ color: '#fca5a5' }} />
              </button>
            )}
            {/* Click equipped item to swap */}
            {item && (
              <button onClick={() => onSlotClick(slotKey)}
                className="absolute bottom-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Change item"
                style={{ background: 'rgba(20,40,60,0.9)', border: '1px solid rgba(60,120,200,0.4)' }}>
                <Sword className="w-2.5 h-2.5" style={{ color: '#93c5fd' }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Active Bonuses Summary ────────────────────────────────────────────────────
function ActiveBonusesSummary({ equipped }) {
  const allTags = [];
  Object.entries(equipped).forEach(([slot, item]) => {
    if (!item) return;
    const meta = EQUIPMENT_SLOTS[slot];
    const tags = getBonusTags(item);
    tags.forEach(tag => allTags.push({ slot: meta?.label || slot, tag, itemName: item.name }));
  });
  if (allTags.length === 0) return null;
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(10,30,15,0.4)', border: '1px solid rgba(40,160,80,0.15)' }}>
      <div className="tavern-section-label mb-2">Active Equipment Bonuses</div>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(20,50,20,0.6)', border: '1px solid rgba(40,160,80,0.25)', color: '#86efac' }}
            title={`From: ${t.itemName}`}>
            {t.tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main EquipmentManager ─────────────────────────────────────────────────────
export default function EquipmentManager({ character, onUpdateCharacter }) {
  const [showEquipModal, setShowEquipModal] = useState(null); // slot key string

  const inventory = character?.inventory || [];
  const equipped  = character?.equipped  || {};

  const getEligibleItems = (slot) => {
    const cats = EQUIPMENT_SLOTS[slot]?.cats || [];
    // For ring2, exclude already ring1-equipped item
    return inventory.filter(item => {
      const itemCat = (item.type || item.category || '').toLowerCase();
      const matches = cats.some(c => itemCat.includes(c) || c.includes(itemCat));
      if (!matches) return false;
      // Prevent equipping same item in both ring slots
      if (slot === 'ring2' && equipped.ring?.name === item.name) return false;
      if (slot === 'ring' && equipped.ring2?.name === item.name) return false;
      return true;
    });
  };

  const handleEquip = async (slot, item) => {
    if (slot === 'armor' && character.race === 'Tortle') return; // Tortle natural armor

    // Store the full item object — CombatPanel reads equipped.weapon directly
    const newEquipped = { ...equipped, [slot]: item };
    const recalc = recalculateStats(character, newEquipped, inventory);
    // recalc.equipped includes the weapon alias (mainhand → weapon)
    await onUpdateCharacter({ ...recalc, equipped: recalc.equipped || newEquipped });
    setShowEquipModal(null);
  };

  const handleUnequip = async (slot) => {
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    // Also remove the weapon alias if unequipping mainhand
    if (slot === 'mainhand') delete newEquipped.weapon;
    const recalc = recalculateStats(character, newEquipped, inventory);
    await onUpdateCharacter({ ...recalc, equipped: recalc.equipped || newEquipped });
  };

  return (
    <div className="space-y-4">
      {/* Paperdoll */}
      <div>
        <p className="tavern-section-label mb-3">Equipment Slots (click empty slot to equip)</p>
        <PaperdollGrid
          equipped={equipped}
          onSlotClick={setShowEquipModal}
          onUnequip={handleUnequip}
        />
      </div>

      {/* Active Bonuses */}
      <ActiveBonusesSummary equipped={equipped} />

      {/* Equip Modal */}
      <AnimatePresence>
        {showEquipModal && (
          <EquipModal
            slot={showEquipModal}
            slotMeta={EQUIPMENT_SLOTS[showEquipModal]}
            eligibleItems={getEligibleItems(showEquipModal)}
            onEquip={handleEquip}
            onClose={() => setShowEquipModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat Recalculation ────────────────────────────────────────────────────────
// Called whenever equipment changes — updates AC and active_modifiers on the character
export function recalculateStats(character, equipped, inventory) {
  const updates = {};
  let acBonus = 0;
  let attackBonus = 0;
  let damageBonus = 0;
  let savingThrowBonus = 0;
  const abilitySetScores = {};   // "set to X" items
  const abilityAddBonuses = {};  // "+N" items

  // Iterate over equipped slot values (full item objects)
  Object.values(equipped).forEach(item => {
    if (!item || typeof item !== 'object') return;
    // Use centralized resolver: known items > form fields > regex
    const b = resolveItemBonuses(item);
    if (b.ac)            acBonus += b.ac;
    if (b.attack)        attackBonus += b.attack;
    if (b.attack_bonus)  attackBonus += b.attack_bonus;
    if (b.damage)        damageBonus += b.damage;
    if (b.saving_throws) savingThrowBonus += b.saving_throws;

    // "Set" ability scores (e.g. CON becomes 19)
    if (b.ability_scores) {
      Object.entries(b.ability_scores).forEach(([stat, val]) => {
        abilitySetScores[stat] = Math.max(abilitySetScores[stat] || 0, val);
      });
    }
    // Additive ability scores (e.g. +1 DEX)
    if (b.ability_score_adds) {
      Object.entries(b.ability_score_adds).forEach(([stat, val]) => {
        abilityAddBonuses[stat] = (abilityAddBonuses[stat] || 0) + val;
      });
    }
  });

  // Apply ability score changes
  ['strength','dexterity','constitution','intelligence','wisdom','charisma'].forEach(stat => {
    const baseStat = character[`_base_${stat}`] || character[stat] || 10;
    let finalStat = baseStat;

    // "Set" items override to a fixed value (only if higher)
    if (abilitySetScores[stat]) {
      finalStat = Math.max(baseStat, abilitySetScores[stat]);
    }

    // Additive bonuses stack on top
    if (abilityAddBonuses[stat]) {
      finalStat += abilityAddBonuses[stat];
    }

    if (finalStat !== (character[stat] || 10)) {
      updates[stat] = Math.min(30, finalStat);
    }
  });

  // Compute AC using effective stats (with equipment-modified ability scores)
  const effectiveChar = { ...character, ...updates };
  const dexMod = Math.floor(((effectiveChar.dexterity || 10) - 10) / 2);
  const wisMod = Math.floor(((effectiveChar.wisdom    || 10) - 10) / 2);
  const conMod = Math.floor(((effectiveChar.constitution || 10) - 10) / 2);

  // Best unarmored AC
  let bestAC = 10 + dexMod;
  if (!equipped.armor) {
    if (character.class === 'Monk')        bestAC = Math.max(bestAC, 10 + dexMod + wisMod);
    else if (character.class === 'Barbarian') bestAC = Math.max(bestAC, 10 + dexMod + conMod);
  }

  // Racial natural armor — always available as an alternative
  if (character.race === 'Tortle')       bestAC = Math.max(bestAC, 17);
  else if (character.race === 'Lizardfolk') bestAC = Math.max(bestAC, 13 + dexMod);

  // Equipped armor (slot key: 'armor')
  const armorItem = equipped.armor;
  if (armorItem?.armor_class) {
    const acVal = parseInt(armorItem.armor_class) || 10;
    const type = armorItem.armor_type || 'light';
    let armorAC;
    if (type === 'heavy') armorAC = acVal;
    else if (type === 'medium') armorAC = acVal + Math.min(dexMod, 2);
    else armorAC = acVal + dexMod;
    bestAC = Math.max(bestAC, armorAC);
  }

  // Shield bonus
  if (equipped.offhand?.category === 'Shield') bestAC += 2;
  // Cloak/ring AC bonus
  if (equipped.cloak?.ac_bonus) bestAC += equipped.cloak.ac_bonus;
  if (equipped.ring?.ac_bonus)  bestAC += equipped.ring.ac_bonus;
  if (equipped.ring2?.ac_bonus) bestAC += equipped.ring2.ac_bonus;

  updates.armor_class = bestAC + acBonus;

  // Alias mainhand → weapon so CombatPanel can always read character.equipped.weapon
  if (equipped.mainhand) {
    const w = equipped.mainhand;
    const dmgStr = w.damage || w.damage_dice || '1d6';
    updates.equipped = {
      ...equipped,
      weapon: {
        ...w,
        damage_dice: dmgStr.split(' ')[0] || '1d6',
        damage_type: w.damage_type || 'slashing',
        attack_bonus: w.attack_bonus || 0,
        damage_bonus: w.damage_bonus || 0,
        type: w.type || 'melee',
        properties: w.properties || [],
      }
    };
  } else {
    updates.equipped = equipped;
  }

  // Store bonuses as active_modifiers for the combat engine
  const modifiers = [];
  if (attackBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'attack', value: attackBonus });
  if (damageBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'damage', value: damageBonus });
  if (savingThrowBonus > 0) modifiers.push({ source: 'equipment', applies_to: 'saving_throws', value: savingThrowBonus });

  updates.active_modifiers = [
    ...(character.active_modifiers || []).filter(m => m.source !== 'equipment'),
    ...modifiers,
  ];

  return updates;
}