import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LOOT_RARITY } from './lootTables';
import { MAGIC_PROPERTIES } from './itemData';
import { ChevronDown, ChevronUp, Sparkles, Zap, Shield } from 'lucide-react';

/**
 * Displays a single procedural item with rarity glow, stats, enchantments, and description.
 * @param {object} item - The procedural item object
 * @param {number} index - Animation index
 * @param {function} onAction - Optional callback for actions (equip, stash, etc.)
 * @param {string} actionLabel - Label for the action button
 * @param {string} actionIcon - Emoji for the action button
 */
export default function ProceduralItemCard({ item, index = 0, onAction, actionLabel, actionIcon, secondaryAction, secondaryLabel }) {
  const [expanded, setExpanded] = useState(false);
  const r = LOOT_RARITY[item.rarity] || LOOT_RARITY.common;

  const enchantLabels = (item.magic_properties || []).map(key => MAGIC_PROPERTIES[key]?.label || key).filter(Boolean);
  const mods = item.modifiers || {};
  const statBonuses = ['strength','dexterity','constitution','intelligence','wisdom','charisma']
    .filter(s => mods[s]).map(s => `${s.slice(0,3).toUpperCase()} ${mods[s] > 0 ? '+' : ''}${mods[s]}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 300 }}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: expanded ? 'rgba(25,12,4,0.9)' : 'rgba(15,8,3,0.7)',
        border: `1px solid ${expanded ? r.border : 'rgba(184,115,51,0.12)'}`,
        boxShadow: expanded ? r.glow : 'none',
      }}>

      {/* Header row */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: r.bg, border: `1px solid ${r.border}` }}>
          {item.icon || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-fantasy font-bold truncate" style={{ color: r.color }}>{item.name}</span>
            {item.is_procedural && <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(245,158,11,0.6)' }} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
              style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}`, fontSize: '0.55rem' }}>
              {r.label}
            </span>
            {item.requires_attunement && (
              <span className="text-xs" style={{ color: 'rgba(192,132,252,0.6)', fontSize: '0.55rem' }}>✦ Attune</span>
            )}
            {mods.attack_bonus > 0 && (
              <span className="text-xs" style={{ color: 'rgba(252,165,165,0.7)', fontSize: '0.55rem' }}>+{mods.attack_bonus} ATK</span>
            )}
            {mods.armor_class > 0 && (
              <span className="text-xs" style={{ color: 'rgba(147,197,253,0.7)', fontSize: '0.55rem' }}>AC {mods.armor_class}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-fantasy" style={{ color: '#f0c040' }}>{item.base_price}gp</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(184,115,51,0.4)' }} /> :
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(184,115,51,0.4)' }} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(184,115,51,0.1)' }}>

          {/* Description */}
          <p className="text-xs font-serif italic leading-relaxed pt-2" style={{ color: 'rgba(220,190,140,0.85)' }}>
            {item.description}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2">
            {item.damage && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <Zap className="w-3 h-3" style={{ color: '#fca5a5' }} />
                <span className="text-xs font-fantasy" style={{ color: '#fca5a5' }}>{item.damage} {item.damage_type}</span>
              </div>
            )}
            {mods.armor_class > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Shield className="w-3 h-3" style={{ color: '#93c5fd' }} />
                <span className="text-xs font-fantasy" style={{ color: '#93c5fd' }}>AC {mods.armor_class}</span>
              </div>
            )}
            {statBonuses.map(sb => (
              <span key={sb} className="text-xs px-2 py-1 rounded-lg font-fantasy"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#86efac' }}>
                {sb}
              </span>
            ))}
            {mods.save_bonus > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg font-fantasy"
                style={{ background: 'rgba(168,162,158,0.08)', border: '1px solid rgba(168,162,158,0.2)', color: '#d6d3d1' }}>
                +{mods.save_bonus} All Saves
              </span>
            )}
          </div>

          {/* Enchantments */}
          {enchantLabels.length > 0 && (
            <div className="space-y-1">
              <span className="tavern-section-label">Enchantments</span>
              <div className="flex flex-wrap gap-1.5">
                {enchantLabels.map((label, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-fantasy"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#c4b5fd' }}>
                    ✦ {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          {item.source_enemy && (
            <p className="text-xs" style={{ color: 'rgba(212,168,100,0.5)' }}>Looted from: {item.source_enemy}</p>
          )}

          {/* Actions */}
          {(onAction || secondaryAction) && (
            <div className="flex gap-2 pt-1">
              {onAction && (
                <button onClick={() => onAction(item)}
                  className="flex-1 py-2 rounded-xl text-xs font-fantasy btn-fantasy flex items-center justify-center gap-1.5">
                  {actionIcon || '🎒'} {actionLabel || 'Take'}
                </button>
              )}
              {secondaryAction && (
                <button onClick={() => secondaryAction(item)}
                  className="flex-1 py-2 rounded-xl text-xs font-fantasy transition-all flex items-center justify-center gap-1.5"
                  style={{ border: '1px solid rgba(184,115,51,0.3)', color: 'rgba(212,168,100,0.75)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,149,90,0.5)'; e.currentTarget.style.color = '#c9a96e'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(184,115,51,0.3)'; e.currentTarget.style.color = 'rgba(212,168,100,0.75)'; }}>
                  📦 {secondaryLabel || 'To Stash'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}