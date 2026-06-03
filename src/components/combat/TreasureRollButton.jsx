import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Coins, Sparkles, Loader2, Check, Gift, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RARITY_COLORS = {
  common: { text: '#d4a574', bg: 'rgba(70,45,20,0.5)', border: 'rgba(180,120,60,0.3)' },
  uncommon: { text: '#86efac', bg: 'rgba(10,50,25,0.5)', border: 'rgba(40,160,80,0.3)' },
  rare: { text: '#93c5fd', bg: 'rgba(10,25,60,0.5)', border: 'rgba(60,100,200,0.3)' },
  legendary: { text: '#fde68a', bg: 'rgba(60,45,5,0.5)', border: 'rgba(200,160,40,0.4)' },
};

/**
 * TreasureRollButton — Generates loot from defeated enemies and adds it to the character's inventory.
 *
 * Props:
 *  - combatLog: The CombatLog record (needs enemies_faced, id, character_id)
 *  - character: The Character record
 *  - onLootCollected: (updatedCharacter, lootData) => void — called after items are added
 */
export default function TreasureRollButton({ combatLog, character, onLootCollected }) {
  const [rolling, setRolling] = useState(false);
  const [lootResult, setLootResult] = useState(null);
  const [collected, setCollected] = useState(false);
  const [collecting, setCollecting] = useState(false);

  if (!combatLog || !character) return null;

  // Don't show if already looted
  const alreadyLooted = combatLog.loot_collected &&
    ((combatLog.loot_collected.gold > 0) ||
     (combatLog.loot_collected.silver > 0) ||
     (combatLog.loot_collected.items?.length > 0));

  if (alreadyLooted || combatLog.result !== 'victory') return null;

  const enemies = combatLog.enemies_faced || [];
  const avgCR = enemies.length > 0
    ? enemies.reduce((sum, e) => sum + (parseFloat(e.cr) || 1), 0) / enemies.length
    : 1;

  // Detect enemy type from name/meta for loot tables
  const guessEnemyType = (name = '') => {
    const lower = name.toLowerCase();
    if (/undead|zombie|skeleton|ghost|wight|lich|vampire|wraith/.test(lower)) return 'undead';
    if (/dragon|wyrm|drake/.test(lower)) return 'dragon';
    if (/demon|devil|fiend|imp/.test(lower)) return 'demon';
    if (/wolf|bear|spider|beast|boar|hawk|rat/.test(lower)) return 'beast';
    if (/golem|construct|animated|shield guardian/.test(lower)) return 'construct';
    if (/elemental|mephit|genie/.test(lower)) return 'elemental';
    return 'humanoid';
  };

  const primaryEnemyType = enemies.length > 0 ? guessEnemyType(enemies[0].name) : 'humanoid';

  const handleRoll = async () => {
    setRolling(true);
    const result = await base44.functions.invoke('generateLoot', {
      level: character.level || 1,
      enemy_type: primaryEnemyType,
      enemy_cr: avgCR,
      num_enemies: enemies.length,
      character_class: character.class || null,
    });
    setLootResult(result.data);
    setRolling(false);
  };

  const handleCollect = async () => {
    if (!lootResult) return;
    setCollecting(true);

    const allItems = [...(lootResult.items || [])];
    if (lootResult.artifact) allItems.push(lootResult.artifact);

    const updatedGold = (character.gold || 0) + (lootResult.coins?.gold || 0);
    const updatedSilver = (character.silver || 0) + (lootResult.coins?.silver || 0);
    const updatedCopper = (character.copper || 0) + (lootResult.coins?.copper || 0);
    const updatedInventory = [...(character.inventory || []), ...allItems];

    // Update character in DB
    await base44.entities.Character.update(character.id, {
      gold: updatedGold,
      silver: updatedSilver,
      copper: updatedCopper,
      inventory: updatedInventory,
    });

    // Save loot snapshot to combat log
    const lootSnapshot = {
      gold: lootResult.coins?.gold || 0,
      silver: lootResult.coins?.silver || 0,
      copper: lootResult.coins?.copper || 0,
      items: allItems,
    };
    await base44.entities.CombatLog.update(combatLog.id, { loot_collected: lootSnapshot });

    const updatedChar = {
      ...character,
      gold: updatedGold,
      silver: updatedSilver,
      copper: updatedCopper,
      inventory: updatedInventory,
    };

    setCollected(true);
    setCollecting(false);
    onLootCollected?.(updatedChar, lootSnapshot);
  };

  // Not yet rolled
  if (!lootResult) {
    return (
      <motion.button
        onClick={handleRoll}
        disabled={rolling}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-fantasy text-sm transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(100,60,20,0.8), rgba(60,35,10,0.9))',
          border: '1px solid rgba(232,184,109,0.5)',
          color: '#fde68a',
          boxShadow: '0 0 14px rgba(184,115,51,0.2)',
        }}>
        {rolling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Rolling for treasure...
          </>
        ) : (
          <>
            <Gift className="w-4 h-4" />
            Roll for Treasure
          </>
        )}
      </motion.button>
    );
  }

  // Loot rolled — show results + collect button
  const coins = lootResult.coins || {};
  const items = lootResult.items || [];
  const artifact = lootResult.artifact;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(12,8,4,0.8)', border: '1px solid rgba(232,184,109,0.25)' }}>

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(232,184,109,0.15)', background: 'rgba(30,20,8,0.6)' }}>
        <Sparkles className="w-4 h-4" style={{ color: '#fbbf24' }} />
        <span className="font-fantasy text-xs tracking-widest" style={{ color: '#fde68a' }}>TREASURE FOUND</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Coins */}
        {(coins.gold > 0 || coins.silver > 0 || coins.copper > 0) && (
          <div className="flex gap-3 flex-wrap">
            {coins.gold > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg badge-gold">
                <Coins className="w-3 h-3" /> {coins.gold} gp
              </span>
            )}
            {coins.silver > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'rgba(60,65,80,0.5)', border: '1px solid rgba(160,165,190,0.3)', color: '#c8cede' }}>
                <Coins className="w-3 h-3" /> {coins.silver} sp
              </span>
            )}
            {coins.copper > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'rgba(70,45,20,0.5)', border: '1px solid rgba(180,120,60,0.3)', color: '#d4a574' }}>
                <Coins className="w-3 h-3" /> {coins.copper} cp
              </span>
            )}
          </div>
        )}

        {/* Items */}
        {(items.length > 0 || artifact) && (
          <div className="space-y-1.5">
            {items.map((item, i) => {
              const rc = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
              return (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: rc.bg, border: `1px solid ${rc.border}` }}>
                  <Package className="w-3 h-3 flex-shrink-0" style={{ color: rc.text }} />
                  <span style={{ color: rc.text }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: 'rgba(180,140,90,0.5)' }}>×{item.quantity}</span>}
                  <span className="ml-auto text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>{item.rarity}</span>
                </div>
              );
            })}
            {artifact && (
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs"
                style={{
                  background: (RARITY_COLORS[artifact.rarity] || RARITY_COLORS.rare).bg,
                  border: `1px solid ${(RARITY_COLORS[artifact.rarity] || RARITY_COLORS.rare).border}`,
                  boxShadow: '0 0 12px rgba(130,70,210,0.15)',
                }}>
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c4b5fd' }} />
                <span className="font-bold" style={{ color: (RARITY_COLORS[artifact.rarity] || RARITY_COLORS.rare).text }}>
                  {artifact.name}
                </span>
                <span className="ml-auto badge-arcane px-1.5 py-0.5 rounded">{artifact.rarity}</span>
              </motion.div>
            )}
          </div>
        )}

        {/* Collect Button */}
        <button
          onClick={handleCollect}
          disabled={collecting || collected}
          className="w-full py-2 rounded-xl font-fantasy text-sm transition-all flex items-center justify-center gap-2"
          style={collected ? {
            background: 'rgba(22,80,40,0.6)',
            border: '1px solid rgba(40,160,80,0.35)',
            color: '#86efac',
          } : {
            background: 'linear-gradient(135deg, rgba(80,50,15,0.85), rgba(50,30,8,0.9))',
            border: '1px solid rgba(201,169,110,0.45)',
            color: '#fde68a',
          }}>
          {collected ? (
            <><Check className="w-4 h-4" /> Added to Inventory</>
          ) : collecting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Collecting...</>
          ) : (
            <><Package className="w-4 h-4" /> Collect All & Add to Inventory</>
          )}
        </button>
      </div>
    </motion.div>
  );
}