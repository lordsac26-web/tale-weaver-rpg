import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Skull, Sparkles, X } from 'lucide-react';

export default function DeathModal({ character, onMiracle, onDeath, onClose }) {
  const [attempting, setAttempting] = useState(false);
  const [miracleResult, setMiracleResult] = useState(null);

  const attemptMiracle = async () => {
    setAttempting(true);
    // 5% chance of miracle
    const success = Math.random() < 0.05;
    
    setTimeout(() => {
      setMiracleResult(success);
      setAttempting(false);
      
      if (success) {
        setTimeout(() => {
          onMiracle();
        }, 2000);
      } else {
        setTimeout(() => {
          onDeath();
        }, 2000);
      }
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)' }}>
      
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative max-w-lg w-full rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(30,10,10,0.98), rgba(15,5,5,0.99))',
          border: '1px solid rgba(180,30,30,0.4)',
          boxShadow: '0 0 80px rgba(180,30,30,0.3), inset 0 1px 0 rgba(255,100,100,0.1)'
        }}>
        
        {/* Close button - only show if no action taken yet */}
        {!attempting && miracleResult === null && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg transition-all z-10"
            style={{
              background: 'rgba(20,10,10,0.6)',
              border: '1px solid rgba(180,50,50,0.3)',
              color: 'rgba(180,100,100,0.5)'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,100,100,0.5)'}>
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-8 text-center">
          {/* Skull Icon */}
          <motion.div
            animate={{
              rotate: [0, -5, 5, -5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-6 w-24 h-24 flex items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(80,5,5,0.4), transparent)',
              boxShadow: '0 0 40px rgba(180,30,30,0.2)'
            }}>
            <Skull className="w-16 h-16" style={{ color: '#dc2626' }} />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-fantasy font-bold mb-4 text-glow-blood"
            style={{ color: '#fca5a5' }}>
            You Have Fallen
          </motion.h2>

          {/* Message based on state */}
          {miracleResult === null && !attempting && (
            <>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-base mb-8 leading-relaxed"
                style={{
                  color: 'rgba(232,213,183,0.7)',
                  fontFamily: 'IM Fell English, serif'
                }}>
                Your vision fades to darkness. The battle is lost... but perhaps the gods have not yet abandoned you.
                <br /><br />
                Will you cry out for a miracle, or accept your fate?
              </motion.p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={attemptMiracle}
                  className="w-full py-4 rounded-xl font-fantasy font-bold text-base transition-all btn-arcane"
                  style={{
                    background: 'linear-gradient(135deg, rgba(65,22,110,0.85), rgba(38,10,75,0.9))',
                    border: '1px solid rgba(150,90,230,0.5)',
                    color: '#dfc8ff',
                    letterSpacing: '0.05em'
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}>
                  <Sparkles className="w-5 h-5 inline mr-2" />
                  Pray for a Miracle
                  <span className="block text-xs mt-1 opacity-60">(5% chance)</span>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={onDeath}
                  className="w-full py-4 rounded-xl font-fantasy font-bold text-base transition-all"
                  style={{
                    background: 'rgba(30,10,10,0.6)',
                    border: '1px solid rgba(180,50,50,0.3)',
                    color: 'rgba(252,165,165,0.7)',
                    letterSpacing: '0.05em'
                  }}
                  whileHover={{ scale: 1.02, borderColor: 'rgba(220,80,80,0.5)' }}
                  whileTap={{ scale: 0.98 }}>
                  <Skull className="w-5 h-5 inline mr-2" />
                  Accept Your Fate
                </motion.button>
              </div>
            </>
          )}

          {/* Attempting Miracle */}
          {attempting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 360]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 mx-auto mb-4">
                <Sparkles className="w-full h-full" style={{ color: '#d4b3ff' }} />
              </motion.div>
              <p className="text-lg" style={{ color: '#dfc8ff', fontFamily: 'Cinzel, serif' }}>
                The gods are listening...
              </p>
            </motion.div>
          )}

          {/* Miracle Success */}
          {miracleResult === true && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}>
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(212,149,90,0.3)',
                    '0 0 60px rgba(212,149,90,0.7)',
                    '0 0 20px rgba(212,149,90,0.3)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'radial-gradient(circle, rgba(212,149,90,0.3), transparent)' }}>
                <Sparkles className="w-16 h-16" style={{ color: '#f0c040' }} />
              </motion.div>
              <h3 className="text-2xl font-fantasy font-bold mb-3 text-glow-gold" style={{ color: '#f0c040' }}>
                A Miracle!
              </h3>
              <p className="text-base" style={{ color: 'rgba(232,213,183,0.9)', fontFamily: 'IM Fell English, serif' }}>
                You awaken with a gasp — it was but a terrible dream. The gods have granted you another chance.
              </p>
            </motion.div>
          )}

          {/* Miracle Failure */}
          {miracleResult === false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>
              <Skull className="w-20 h-20 mx-auto mb-4" style={{ color: '#7f1d1d' }} />
              <h3 className="text-2xl font-fantasy font-bold mb-3" style={{ color: '#dc2626' }}>
                Your Cries Ring Hollow
              </h3>
              <p className="text-base mb-4" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'IM Fell English, serif' }}>
                The darkness claims you. Your tale ends here...
              </p>
              <p className="text-sm italic" style={{ color: 'rgba(180,100,100,0.5)' }}>
                Returning to the tavern...
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}