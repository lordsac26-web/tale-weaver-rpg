import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, X, Zap, Shield, Sword } from 'lucide-react';
import { LOOT_RARITY } from './lootTables';

// Stat keys that are meaningful to compare
const COMPARE_STATS = [
  { key: 'armor_class',    label: 'Armor Class',    icon: '🛡️' },
  { key: 'attack_bonus',   label: 'Attack Bonus',   icon: '⚔️' },
  { key: 'damage_dice',    label: 'Damage Dice',    icon: '🎲' },
  { key: 'strength',       label: 'Strength',       icon: '💪' },
  { key: 'dexterity',      label: 'Dexterity',      icon: '🏃' },
  { key: 'constitution',   label: 'Constitution',   icon: '❤️' },
  { key: 'intelligence',   label: 'Intelligence',   icon: '🧠' },
  { key: 'wisdom',         label: 'Wisdom',         icon: '🔮' },
  { key: 'charisma',       label: 'Charisma',       icon: '✨' },
];

function parseNumeric(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Handle dice strings like "1d8" — extract just the die count for rough comparison
    const match = val.match(/(\d+)d(\d+)/);
    if (match) return parseInt(match[1]) * (parseInt(match[2]) / 2 + 0.5);
  }
  return null;
}

function StatRow({ stat, newVal, equippedVal }) {
  const nv = parseNumeric(newVal);
  const ev = parseNumeric(equippedVal);

  const hasNew = newVal !== undefined && newVal !== null;
  const hasEquipped = equippedVal !== undefined && equippedVal !== null;
  if (!hasNew && !hasEquipped) return null;

  let delta = null;
  let deltaColor = 'rgba(212,149,90,0.6)';
  if (nv !== null && ev !== null) {
    delta = nv - ev;
    deltaColor = delta > 0 ? '#86efac' : delta < 0 ? '#fca5a5' : 'rgba(212,149,90,0.5)';
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
      style={{ background: 'rgba(20,10,4,0.5)', borderBottom: '1px solid rgba(184,115,51,0.08)' }}>
      <span className="w-5 text-center flex-shrink-0 text-sm">{stat.icon}</span>
      <span className="flex-1 text-xs font-body" style={{ color: 'rgba(220,190,140,0.85)' }}>{stat.label}</span>

      {/* Equipped value */}
      <span className="text-xs font-fantasy w-10 text-right" style={{ color: 'rgba(212,168,100,0.7)' }}>
        {hasEquipped ? equippedVal : '—'}
      </span>

      <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(184,115,51,0.3)' }} />

      {/* New item value */}
      <span className="text-xs font-fantasy w-10 text-right font-bold" style={{ color: hasNew ? '#f0dfc0' : 'rgba(184,115,51,0.3)' }}>
        {hasNew ? newVal : '—'}
      </span>

      {/* Delta */}
      {delta !== null && delta !== 0 && (
        <span className="text-xs font-fantasy w-8 text-right flex-shrink-0" style={{ color: deltaColor }}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
      {delta === 0 && <span className="w-8 flex-shrink-0" />}
      {delta === null && <span className="w-8 flex-shrink-0" />}
    </div>
  );
}

/**
 * Shows a side-by-side comparison of a new loot item vs. the currently equipped item.
 * @param {object} newItem  - The loot item being considered
 * @param {object} equipped - The character's currently equipped item in the same slot (or null)
 * @param {function} onEquip   - Called when user confirms equipping
 * @param {function} onKeepBag - Called when user chooses to keep in bag only
 * @param {function} onClose   - Called to dismiss
 */
export default function EquipmentComparePanel({ newItem, equipped, onEquip, onKeepBag, onClose }) {
  if (!newItem) return null;

  const rNew = LOOT_RARITY[newItem.rarity] || LOOT_RARITY.common;
  const rEq  = equipped ? (LOOT_RARITY[equipped.rarity] || LOOT_RARITY.common) : null;
  const newMods = newItem.modifiers || {};
  const eqMods  = equipped?.modifiers || {};

  const relevantStats = COMPARE_STATS.filter(s =>
    newMods[s.key] !== undefined || eqMods[s.key] !== undefined
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: 'linear-gradient(160deg, rgba(22,11,4,0.99), rgba(14,7,2,0.99))',
        border: `1px solid ${rNew.border}`,
        boxShadow: `${rNew.glow}, 0 20px 60px rgba(0,0,0,0.8)`,
        maxWidth: '380px',
        width: '100%',
      }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(30,15,5,0.8)', borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: rNew.color }} />
          <span className="font-fantasy text-sm font-bold" style={{ color: rNew.color }}>Compare Equipment</span>
        </div>
        <button onClick={onClose} className="p-1 rounded transition-colors"
          style={{ color: 'rgba(184,115,51,0.35)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(184,115,51,0.35)'}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Item Cards side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* New Item */}
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: rNew.bg, border: `1px solid ${rNew.border}`, boxShadow: rNew.glow }}>
            <div className="text-2xl text-center">{newItem.icon || '📦'}</div>
            <p className="text-xs font-fantasy font-bold text-center" style={{ color: rNew.color }}>{newItem.name}</p>
            <p className="text-center">
              <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                style={{ background: rNew.bg, color: rNew.color, border: `1px solid ${rNew.border}` }}>
                {rNew.label}
              </span>
            </p>
            {newItem.requires_attunement && (
              <p className="text-center text-xs" style={{ color: 'rgba(192,132,252,0.7)' }}>Attunement</p>
            )}
          </div>

          {/* Equipped Item or Empty Slot */}
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: equipped ? rEq.bg : 'rgba(10,5,2,0.4)', border: `1px solid ${equipped ? rEq.border : 'rgba(184,115,51,0.1)'}` }}>
            {equipped ? (
              <>
                <div className="text-2xl text-center">{equipped.icon || '📦'}</div>
                <p className="text-xs font-fantasy font-bold text-center" style={{ color: rEq.color }}>{equipped.name}</p>
                <p className="text-center">
                  <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
                    style={{ background: rEq.bg, color: rEq.color, border: `1px solid ${rEq.border}` }}>
                    {rEq.label}
                  </span>
                </p>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-2 gap-1">
                <Shield className="w-6 h-6 opacity-20" style={{ color: '#c9a96e' }} />
                <p className="text-xs" style={{ color: 'rgba(180,140,80,0.6)' }}>Empty slot</p>
              </div>
            )}
          </div>
        </div>

        {/* Stat comparison */}
        {relevantStats.length > 0 ? (
          <div className="space-y-0.5">
            <p className="tavern-section-label mb-2">Stat Comparison</p>
            <div className="flex items-center gap-2 px-2 pb-1 text-xs" style={{ color: 'rgba(184,115,51,0.35)' }}>
              <span className="w-5 flex-shrink-0" />
              <span className="flex-1" style={{ color: 'rgba(212,168,100,0.65)' }}>Stat</span>
              <span className="w-10 text-right" style={{ color: 'rgba(212,168,100,0.65)' }}>Equipped</span>
              <span className="w-3" />
              <span className="w-10 text-right" style={{ color: 'rgba(212,168,100,0.65)' }}>New</span>
              <span className="w-8 text-right" style={{ color: 'rgba(212,168,100,0.65)' }}>Δ</span>
            </div>
            {relevantStats.map(stat => (
              <StatRow key={stat.key} stat={stat} newVal={newMods[stat.key]} equippedVal={eqMods[stat.key]} />
            ))}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs font-body italic" style={{ color: 'rgba(212,168,100,0.65)' }}>No direct stat comparison available.</p>
          </div>
        )}

        {/* Description */}
        {newItem.description && (
          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(15,8,3,0.6)', border: '1px solid rgba(184,115,51,0.1)' }}>
            <p className="text-xs font-serif italic leading-relaxed" style={{ color: 'rgba(220,190,140,0.85)' }}>
              {newItem.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onEquip}
            className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Equip Now
          </button>
          <button onClick={onKeepBag}
            className="flex-1 py-2.5 rounded-xl text-sm font-fantasy transition-all"
            style={{ background: 'rgba(20,10,4,0.7)', border: '1px solid rgba(184,115,51,0.2)', color: 'rgba(212,149,90,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,149,90,0.4)'; e.currentTarget.style.color = '#c9a96e'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(184,115,51,0.2)'; e.currentTarget.style.color = 'rgba(212,149,90,0.6)'; }}>
            🎒 Keep in Bag
          </button>
        </div>
      </div>
    </motion.div>
  );
}