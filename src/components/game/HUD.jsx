import React from 'react';
import { Shield, Heart, Star, MapPin, Clock, Swords, Sparkles } from 'lucide-react';
import { CONDITIONS } from './gameData';
import { motion } from 'framer-motion';
import { getSpellSlotsForLevel } from './spellData';
import { ConditionTooltip } from './GameTooltip';
 
export default function HUD({ character, session }) {
  if (!character) return null;
 
  const hpPct = character.hp_max > 0 ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 0;
  const hpBarClass = hpPct > 60 ? 'hp-bar-high' : hpPct > 30 ? 'hp-bar-mid' : 'hp-bar-low';
 
  const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const currentXP = character.xp || 0;
  const level = character.level || 1;
  const xpForNext = xpThresholds[level] || xpThresholds[xpThresholds.length - 1];
  const xpForCurrent = xpThresholds[level - 1] || 0;
  const xpPct = xpForNext > xpForCurrent ? Math.min(100, ((currentXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100) : 100;
 
  const initials = character.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
 
  // Spell slot tracking
  const SPELLCASTING_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Artificer'];
  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const slotMaxArr = isCaster ? getSpellSlotsForLevel(character.class, character.level || 1) : [];
  const currentSlots = character.spell_slots || {};
  const totalSlotsUsed = Object.keys(currentSlots).reduce((sum, key) => sum + (currentSlots[key] || 0), 0);
  const totalSlotsMax = slotMaxArr.reduce((sum, val) => sum + val, 0);
 
  return (
    <div className="glass-panel border-b border-gold/30 px-4 py-2.5 relative overflow-hidden flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(201,169,110,0.25)' }}>
      {/* Top rune line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.5) 30%, rgba(201,169,110,0.5) 70%, transparent)'
      }} />
 
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 md:gap-4">
        {/* Character portrait + name */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-fantasy font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(100,65,15,0.9), rgba(50,30,5,0.95))',
                border: '2px solid rgba(201,169,110,0.5)',
                color: '#f0c040',
                boxShadow: '0 0 12px rgba(201,169,110,0.2), inset 0 2px 4px rgba(0,0,0,0.5)'
              }}>
              {initials}
            </div>
            {session?.in_combat && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: '#8b1a1a', border: '1px solid rgba(220,50,50,0.7)', boxShadow: '0 0 6px rgba(180,30,30,0.6)' }}>
                <Swords className="w-2 h-2 text-red-300" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-fantasy font-semibold text-sm truncate" style={{ color: '#f0c040', textShadow: '0 0 12px rgba(201,169,110,0.4)' }}>
              {character.name}
            </div>
            <div className="text-xs truncate" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
              Lv.{character.level} {character.race} {character.class}
            </div>
          </div>
        </div>
 
        {/* Divider */}
        <div className="hidden md:block w-px h-8 self-center" style={{ background: 'rgba(180,140,90,0.2)' }} />
 
        {/* HP Bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Heart className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <div className="w-20 md:w-28">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold" style={{ color: '#fca5a5', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}>
                {character.hp_current}
              </span>
              <span style={{ color: 'rgba(180,120,120,0.5)', fontSize: '0.65rem' }}>/ {character.hp_max}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden neuro-inset">
              <motion.div
                className={`h-full rounded-full ${hpBarClass}`}
                animate={{ width: `${hpPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
 
        {/* XP Bar */}
        <div className="flex items-center gap-2 hidden sm:flex">
          <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#d97706' }} />
          <div className="w-24">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'rgba(201,169,110,0.8)', fontFamily: 'Cinzel, serif', fontSize: '0.65rem' }}>{currentXP} XP</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden neuro-inset">
              <motion.div
                className="h-full rounded-full xp-bar"
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
 
        {/* AC Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg stat-box">
          <Shield className="w-3.5 h-3.5" style={{ color: '#93c5fd' }} />
          <span className="font-bold text-sm font-fantasy" style={{ color: '#93c5fd' }}>{character.armor_class}</span>
          <span className="text-xs" style={{ color: 'rgba(147,197,253,0.5)', fontFamily: 'EB Garamond, serif' }}>AC</span>
        </div>
 
        {/* Spell Slots (if caster) */}
        {isCaster && totalSlotsMax > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg stat-box">
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
            <span className="font-bold text-sm font-fantasy" style={{ color: totalSlotsUsed < totalSlotsMax ? '#a78bfa' : '#fca5a5' }}>
              {totalSlotsMax - totalSlotsUsed}/{totalSlotsMax}
            </span>
            <span className="text-xs" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'EB Garamond, serif' }}>Slots</span>
          </div>
        )}
 
        {/* Location & Time — hidden on small screens to prevent overflow */}
        {session && (
          <div className="hidden md:flex items-center gap-3 ml-auto" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif', fontSize: '0.75rem' }}>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span className="italic truncate max-w-[120px]">{session.current_location || 'Unknown'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span className="italic">{session.time_of_day}, {session.season}</span>
            </span>
          </div>
        )}
 
        {/* Active Conditions */}
        {(character.conditions || []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {character.conditions.slice(0, 4).map((cond, i) => {
              const condName = typeof cond === 'string' ? cond : cond.name;
              const condData = CONDITIONS[condName?.toLowerCase()] || {};
              return (
                <ConditionTooltip key={i} name={condName} position="bottom">
                  <span className="px-2 py-0.5 rounded-full text-xs badge-blood cursor-default">
                    {condData.icon || '⚫'} {condName}
                  </span>
                </ConditionTooltip>
              );
            })}
          </div>
        )}
      </div>
 
      {/* Bottom rune line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.2) 40%, rgba(201,169,110,0.2) 60%, transparent)'
      }} />
    </div>
  );
}