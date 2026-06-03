import React, { useState } from 'react';
import { Info, CheckCircle, Star, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS,
  getCantripDamageDice
} from './spellData';

const ATTACK_ICONS = {
  ranged_spell_attack: '🎯',
  melee_spell_attack: '⚔️',
  saving_throw: '🎲',
  healing: '💚',
  auto_hit: '✨',
  utility: '🔧',
};

export default function SpellCard({ spell, spellName, character, isKnown, isPrepared, onToggleKnown, onTogglePrepared, onCast, canCast, sourceClass, compact = false }) {
  const [showDetail, setShowDetail] = useState(false);
  const details = SPELL_DETAILS[spellName] || spell || {};
  const schoolColor = SCHOOL_COLORS[details.school] || 'text-slate-400';
  const dmgColor = DAMAGE_TYPE_COLORS[details.damage_type] || 'text-amber-300';
  const attackIcon = ATTACK_ICONS[details.attack_type || 'utility'];
  const charLevel = character?.level || 1;
  
  const isConcentration = details.requires_concentration || details.concentration;
  const isRitual = details.is_reaction || details.ritual;
  const isCantrip = details.level === 0;
  const displayDice = isCantrip ? getCantripDamageDice(spellName, charLevel) : details.damage_dice;

  return (
    <div className={`rounded-xl transition-all ${
      isPrepared ? 'glass-panel border-glow-gold' : 
      isKnown ? 'glass-panel-light' : 
      'glass-panel-light opacity-60'
    }`}>
      <div className="flex items-start gap-2.5 p-3">
        <span className="text-base flex-shrink-0 mt-0.5">{attackIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-sm font-fantasy font-medium ${isPrepared ? 'text-glow-gold' : isKnown ? 'text-amber-200' : 'text-slate-300'}`} style={{ color: isPrepared ? '#f0c040' : undefined }}>
              {spellName}
            </span>
            {isPrepared && <span className="px-1.5 py-0.5 rounded-full text-xs badge-gold">READY</span>}
            {sourceClass && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(60,90,140,0.3)', border: '1px solid rgba(100,140,200,0.25)', color: 'rgba(147,197,253,0.8)' }}>
                {sourceClass}
              </span>
            )}
            {details.school && <span className={`text-xs ${schoolColor} opacity-70`}>{details.school}</span>}
            {isConcentration && <span className="text-xs px-1.5 py-0.5 rounded badge-arcane">Concentration</span>}
            {isRitual && <span className="text-xs text-yellow-400 opacity-70">Ritual</span>}
          </div>
          {!compact && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
              {details.casting_time && <span>⏱️ {details.casting_time}</span>}
              {details.range && <span>📍 {details.range}</span>}
              {displayDice && displayDice !== '0' && (
                <span className={`font-mono font-bold ${dmgColor}`}>
                  {displayDice} {details.damage_type}
                  {isCantrip && charLevel >= 5 && <span className="text-xs opacity-50 ml-1">(lv{charLevel})</span>}
                </span>
              )}
              {details.attack_type === 'healing' && details.heal_dice && (
                <span className="font-mono font-bold text-green-400">{details.heal_dice} heal</span>
              )}
              {details.save_type && <span className="text-yellow-400 font-bold">{details.save_type.toUpperCase()} save</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setShowDetail(v => !v)} 
            className="p-1 rounded transition-colors" 
            style={{ color: 'rgba(180,140,90,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.4)'}>
            <Info className="w-3.5 h-3.5" />
          </button>
          {onCast && isPrepared && (
            <button onClick={() => onCast(spellName)}
              disabled={!canCast}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-fantasy transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={canCast ? {
                background: 'linear-gradient(135deg, rgba(120,40,10,0.7), rgba(80,20,5,0.8))',
                border: '1px solid rgba(240,100,40,0.5)',
                color: '#ffcfa0',
                textShadow: '0 0 6px rgba(240,140,60,0.4)',
              } : {
                background: 'rgba(30,15,5,0.4)',
                border: '1px solid rgba(120,60,30,0.2)',
                color: 'rgba(180,140,90,0.3)',
              }}
              title={canCast ? 'Cast this spell (uses a spell slot)' : 'No spell slots remaining'}>
              <Flame className="w-3 h-3" />
              Cast
            </button>
          )}
          {onTogglePrepared && isKnown && (
            <button onClick={() => onTogglePrepared(spellName)}
              className={`p-1 rounded transition-colors ${isPrepared ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
              <CheckCircle className={`w-3.5 h-3.5 ${isPrepared ? 'fill-current' : ''}`} />
            </button>
          )}
          {onToggleKnown && !isKnown && (
            <button onClick={() => onToggleKnown(spellName)}
              className="p-1 rounded transition-colors text-slate-500 hover:text-amber-400">
              <Star className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDetail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-3 pt-2"
            style={{ borderTop: '1px solid rgba(180,140,90,0.1)', background: 'rgba(8,5,2,0.5)' }}>
            {details.visual_summary && (
              <p className="text-xs leading-relaxed italic mb-2" style={{ color: 'rgba(192,132,252,0.75)' }}>✨ {details.visual_summary}</p>
            )}
            {details.effect_summary && (
              <p className="text-xs leading-relaxed font-medium mb-2" style={{ color: 'rgba(147,197,253,0.8)' }}>⚡ {details.effect_summary}</p>
            )}
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
              {details.description || 'No description available.'}
            </p>
            {details.higher_level_scaling && (
              <p className="text-xs italic mb-1" style={{ color: 'rgba(240,192,64,0.7)' }}>
                <strong>At Higher Levels:</strong> {details.higher_level_scaling}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2 text-xs" style={{ color: 'rgba(180,140,90,0.45)' }}>
              {details.components && <span>Components: {details.components}</span>}
              {details.duration && <span>Duration: {details.duration}</span>}
            </div>
            {details.conditions_caused && details.conditions_caused.length > 0 && (
              <p className="text-xs mt-2 px-2 py-1 rounded" style={{ background: 'rgba(80,5,5,0.3)', border: '1px solid rgba(180,30,30,0.2)', color: '#fca5a5' }}>
                <strong>Conditions:</strong> {details.conditions_caused.join(', ')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}