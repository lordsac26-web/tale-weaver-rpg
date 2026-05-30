import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Coffee, Loader2, Heart, Zap, Flame, Shield, Plus, Minus } from 'lucide-react';
import { getSpellSlotsForLevel } from './spellData';
import CampfireRestAnimation from './CampfireRestAnimation';

export default function RestModal({ character, onClose, onRest }) {
  const [restType, setRestType] = useState(null); // 'short' | 'long'
  const [resting, setResting] = useState(false);
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1); // for short rest player choice

  // Use actual remaining hit dice, not just level (PHB p.186)
  const totalHitDice = character?.level || 1;
  const maxHitDice = character?.hit_dice_remaining ?? totalHitDice;
  const HIT_DIE = { Fighter: 10, Ranger: 10, Paladin: 10, Barbarian: 12, Monk: 8, Rogue: 8, Bard: 8, Cleric: 8, Druid: 8, Warlock: 8, Wizard: 6, Sorcerer: 6, Artificer: 8 };
  const hitDie = HIT_DIE[character?.class] || 8;
  const conMod = Math.floor(((character?.constitution || 10) - 10) / 2);
  const avgHealPerDie = Math.floor(hitDie / 2) + 1 + conMod;

  const handleRest = async () => {
    setResting(true);
    // Clamp to actual remaining before sending to backend
    await onRest(restType, Math.min(hitDiceToSpend, maxHitDice));
    setResting(false);
  };

  // Calculate what gets restored
  const calcRestoration = (type) => {
    const restoration = [];
    
    if (type === 'short') {
      // Short rest: hit dice, some class features
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: 'Spend Hit Dice to heal', color: '#dc2626' });
      
      if (character.class === 'Warlock') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All spell slots restored', color: '#a78bfa' });
      }
      
      if (character.class === 'Fighter') {
        restoration.push({ icon: <Flame className="w-4 h-4" />, text: 'Action Surge restored', color: '#f59e0b' });
        restoration.push({ icon: <Shield className="w-4 h-4" />, text: 'Second Wind restored', color: '#3b82f6' });
      }
      
      if (character.class === 'Monk') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All Ki points restored', color: '#8b5cf6' });
      }
      
      if (character.class === 'Bard') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'Bardic Inspiration restored', color: '#ec4899' });
      }
    } else if (type === 'long') {
      // Long rest: full HP, all spell slots, hit dice, all abilities
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: 'Full HP restored', color: '#22c55e' });
      restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All spell slots restored', color: '#a78bfa' });
      restoration.push({ icon: <Shield className="w-4 h-4" />, text: 'All class abilities restored', color: '#3b82f6' });
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: `½ Hit Dice restored (${Math.max(1, Math.floor((character.level || 1) / 2))})`, color: '#f59e0b' });
      
      if (character.class === 'Wizard') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'Arcane Recovery available', color: '#6366f1' });
      }
    }
    
    return restoration;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden rune-border"
        style={{ background: 'rgba(15,10,5,0.98)', border: '1px solid rgba(180,140,90,0.3)', boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5" style={{ color: '#c9a96e' }} />
            <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>Take a Rest</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: 'rgba(180,140,90,0.4)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!restType ? (
            <>
              <p className="text-sm mb-4" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
                Choose how you wish to rest and recover your strength.
              </p>

              {/* Short Rest */}
              <button
                onClick={() => setRestType('short')}
                className="w-full p-4 rounded-xl text-left transition-all fantasy-card"
                style={{ background: 'rgba(25,15,5,0.7)', border: '1px solid rgba(180,140,90,0.25)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Coffee className="w-5 h-5" style={{ color: '#d97706' }} />
                  <h3 className="font-fantasy font-bold" style={{ color: '#fbbf24' }}>Short Rest (1 hour)</h3>
                </div>
                <p className="text-xs mb-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                  Rest for an hour. Spend Hit Dice (d{hitDie}) to heal.
                  {maxHitDice === 0
                    ? <span className="ml-1" style={{ color: '#ef4444' }}>No dice remaining!</span>
                    : <span className="ml-1" style={{ color: 'rgba(201,169,110,0.5)' }}>({maxHitDice}/{totalHitDice} available)</span>
                  }
                </p>
                <div className="space-y-1">
                  {calcRestoration('short').map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: item.color }}>
                      {item.icon}
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* Long Rest */}
              <button
                onClick={() => setRestType('long')}
                className="w-full p-4 rounded-xl text-left transition-all fantasy-card"
                style={{ background: 'rgba(15,8,25,0.7)', border: '1px solid rgba(140,100,220,0.25)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Moon className="w-5 h-5" style={{ color: '#a78bfa' }} />
                  <h3 className="font-fantasy font-bold" style={{ color: '#c4b5fd' }}>Long Rest (8 hours)</h3>
                </div>
                <p className="text-xs mb-2" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                  Sleep for 8 hours. Full HP and spell slot recovery.
                </p>
                <div className="space-y-1">
                  {calcRestoration('long').map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: item.color }}>
                      {item.icon}
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </button>
            </>
          ) : resting ? (
            <div className="text-center py-2">
              <CampfireRestAnimation restType={restType} />
              <h3 className="font-fantasy font-bold text-lg mb-1 flex items-center justify-center gap-2" style={{ color: '#f0c040' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                {restType === 'short' ? 'Resting by the fire…' : 'Sleeping through the night…'}
              </h3>
              <p className="text-sm" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                Recovering your strength.
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(60,40,10,0.6)', border: '1px solid rgba(201,169,110,0.3)' }}>
                {restType === 'short' ? <Coffee className="w-8 h-8" style={{ color: '#fbbf24' }} /> : <Moon className="w-8 h-8" style={{ color: '#a78bfa' }} />}
              </motion.div>
              <h3 className="font-fantasy font-bold text-lg mb-2" style={{ color: '#f0c040' }}>
                Confirm {restType === 'short' ? 'Short' : 'Long'} Rest
              </h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'EB Garamond, serif' }}>
                You will restore:
              </p>
              <div className="space-y-2 mb-4">
                {calcRestoration(restType).map((item, i) => (
                  <div key={i} className="flex items-center justify-center gap-2 text-sm" style={{ color: item.color }}>
                    {item.icon}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Hit Dice selector for short rest */}
              {restType === 'short' && (
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(60,40,8,0.4)', border: '1px solid rgba(201,169,110,0.2)' }}>
                  <p className="text-xs font-fantasy mb-3" style={{ color: 'rgba(201,169,110,0.7)' }}>
                    How many Hit Dice (d{hitDie}) to spend?
                    <span className="ml-2" style={{ color: maxHitDice === 0 ? '#ef4444' : 'rgba(201,169,110,0.5)' }}>
                      ({maxHitDice}/{totalHitDice} remaining)
                    </span>
                  </p>
                  {maxHitDice === 0 ? (
                    <p className="text-sm text-center" style={{ color: '#ef4444', fontFamily: 'EB Garamond, serif' }}>
                      No Hit Dice remaining — take a long rest to recover them.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-4">
                        <button onClick={() => setHitDiceToSpend(v => Math.max(1, v - 1))}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                          style={{ background: 'rgba(60,30,5,0.7)', border: '1px solid rgba(180,140,90,0.3)', color: '#c9a96e' }}>
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="text-center">
                          <div className="font-fantasy font-bold text-2xl" style={{ color: '#f0c040' }}>{Math.min(hitDiceToSpend, maxHitDice)}</div>
                          <div className="text-xs" style={{ color: 'rgba(201,169,110,0.5)' }}>of {maxHitDice} available</div>
                        </div>
                        <button onClick={() => setHitDiceToSpend(v => Math.min(maxHitDice, v + 1))}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                          style={{ background: 'rgba(60,30,5,0.7)', border: '1px solid rgba(180,140,90,0.3)', color: '#c9a96e' }}>
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-center mt-2" style={{ color: 'rgba(201,169,110,0.5)' }}>
                        Est. ~{Math.min(hitDiceToSpend, maxHitDice) * avgHealPerDie} HP ({Math.min(hitDiceToSpend, maxHitDice)}d{hitDie}{conMod >= 0 ? `+${conMod}` : conMod} each)
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setRestType(null)}
                  disabled={resting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-fantasy transition-all"
                  style={{ background: 'rgba(20,13,5,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                  Cancel
                </button>
                <button
                  onClick={handleRest}
                  disabled={resting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-fantasy btn-fantasy flex items-center justify-center gap-2">
                  {resting ? <Loader2 className="w-4 h-4 animate-spin" /> : restType === 'short' ? <Coffee className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {resting ? 'Resting...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}