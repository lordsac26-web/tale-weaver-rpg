import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins } from 'lucide-react';
import { HAGGLE_FLAVOR } from './vendorData';

function rollD20() { return Math.floor(Math.random() * 20) + 1; }

export default function HaggleModal({ item, vendor, character, onAccept, onClose }) {
  const [phase, setPhase] = useState('prompt'); // prompt | rolling | result
  const [roll, setRoll] = useState(null);
  const [finalPrice, setFinalPrice] = useState(item.base_price);
  const [resultDesc, setResultDesc] = useState('');
  const [resultLabel, setResultLabel] = useState('');
  const [resultColor, setResultColor] = useState('#f0c040');

  const chaBonus = Math.floor(((character?.charisma || 10) - 10) / 2);
  const flavor = HAGGLE_FLAVOR[vendor.type] || HAGGLE_FLAVOR.general;

  const handleRoll = () => {
    setPhase('rolling');
    setTimeout(() => {
      const d20 = rollD20();
      const total = d20 + chaBonus;
      let price = item.base_price;
      let label, desc, color;

      if (d20 === 20 || total >= 22) {
        price = 0;
        label = '🌟 Legendary Charm!';
        desc = 'They are completely won over. They insist the item is a gift.';
        color = '#f0c040';
      } else if (total >= 18) {
        price = Math.floor(item.base_price * 0.5);
        label = '✨ Critical Success!';
        desc = '50% discount granted. They look slightly charmed and very confused.';
        color = '#86efac';
      } else if (total >= 14) {
        price = Math.floor(item.base_price * 0.75);
        label = '✅ Success!';
        desc = '25% discount. "Fine, fine. But only because you asked nicely."';
        color = '#86efac';
      } else if (total >= 10) {
        price = Math.floor(item.base_price * 0.9);
        label = '📊 Partial Success';
        desc = '10% off. They shrug. Not impressed, but not offended either.';
        color = '#fde68a';
      } else if (d20 === 1) {
        price = Math.floor(item.base_price * 1.25);
        label = '💀 Critical Fail!';
        desc = 'You insulted them. The price went UP by 25%. They are not happy.';
        color = '#fca5a5';
      } else {
        price = item.base_price;
        label = '❌ Failed';
        desc = 'They remain unmoved. Price stands at full.';
        color = '#fca5a5';
      }

      setRoll({ d20, total, chaBonus });
      setFinalPrice(price);
      setResultLabel(label);
      setResultDesc(desc);
      setResultColor(color);
      setPhase('result');
    }, 900);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(12,9,3,0.97)', border: '1px solid rgba(201,169,110,0.3)', boxShadow: '0 0 60px rgba(201,169,110,0.1), 0 20px 60px rgba(0,0,0,0.8)' }}>

        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.5), transparent)' }} />

        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h3 className="font-fantasy font-bold text-base" style={{ color: '#f0c040' }}>Haggle</h3>
          <button onClick={onClose} style={{ color: 'rgba(180,140,90,0.4)' }}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Item being haggled */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(30,20,5,0.5)', border: '1px solid rgba(201,169,110,0.12)' }}>
            <div className="font-fantasy text-sm font-semibold" style={{ color: '#e8d5b7' }}>{item.name}</div>
            <div className="flex items-center gap-1 mt-1">
              <Coins className="w-3 h-3" style={{ color: '#f0c040' }} />
              <span className="font-fantasy text-sm" style={{ color: '#f0c040' }}>{item.base_price}gp listed</span>
            </div>
          </div>

          {/* Vendor flavor */}
          <div className="rounded-xl px-4 py-3 italic" style={{ background: 'rgba(20,14,5,0.5)', border: '1px solid rgba(180,140,90,0.1)' }}>
            <p className="text-sm" style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
              {flavor[Math.floor(Math.random() * flavor.length)]}
            </p>
          </div>

          {/* CHA modifier info */}
          <div className="text-center text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
            Persuasion check (d20 + CHA modifier {chaBonus >= 0 ? '+' : ''}{chaBonus})
          </div>

          {/* Phase: Prompt */}
          {phase === 'prompt' && (
            <button onClick={handleRoll}
              className="w-full py-3 rounded-xl font-fantasy font-bold text-sm btn-fantasy"
              style={{ letterSpacing: '0.08em' }}>
              🎲 Attempt Persuasion
            </button>
          )}

          {/* Phase: Rolling */}
          {phase === 'rolling' && (
            <div className="text-center py-4">
              <motion.div
                animate={{ rotate: [0, 180, 360, 540, 720], scale: [1, 1.3, 0.9, 1.2, 1] }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="text-5xl mb-3 inline-block">🎲</motion.div>
              <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.6)' }}>Rolling Persuasion...</div>
            </div>
          )}

          {/* Phase: Result */}
          {phase === 'result' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(20,15,5,0.7)', border: `1px solid ${resultColor}30` }}>
                <div className="font-fantasy font-bold text-sm mb-1" style={{ color: resultColor }}>{resultLabel}</div>
                <div className="text-xs mb-2" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                  Rolled {roll.d20} {roll.chaBonus >= 0 ? '+' : ''}{roll.chaBonus} CHA = {roll.total}
                </div>
                <div className="text-xs" style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'IM Fell English, serif' }}>
                  {resultDesc}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm px-1">
                <span style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>Final price:</span>
                <div className="flex items-center gap-1">
                  {finalPrice < item.base_price && (
                    <span className="line-through text-xs" style={{ color: 'rgba(180,60,60,0.5)' }}>{item.base_price}gp</span>
                  )}
                  <span className="font-fantasy font-bold" style={{ color: finalPrice === 0 ? '#86efac' : finalPrice < item.base_price ? '#86efac' : finalPrice > item.base_price ? '#fca5a5' : '#f0c040' }}>
                    {finalPrice === 0 ? 'FREE' : `${finalPrice}gp`}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => onAccept(finalPrice)} disabled={(character?.gold || 0) < finalPrice}
                  className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy disabled:opacity-40">
                  Accept & Buy
                </button>
                <button onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)' }}>
                  Pass
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}