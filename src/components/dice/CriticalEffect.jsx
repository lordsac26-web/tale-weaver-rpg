import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const CRIT_MESSAGES = [
  "THE GODS SMILE UPON YOU!",
  "LEGEND OF LEGENDS!",
  "FATE BENDS TO YOUR WILL!",
  "UNSTOPPABLE FORCE!",
  "THE REALM TREMBLES!",
];

const FAIL_MESSAGES = [
  "THE DICE GODS ARE DISPLEASED",
  "ABSOLUTE CATASTROPHE",
  "EVEN THE RATS ARE LAUGHING",
  "YOU HAVE ANGERED THE FATES",
  "A BARD WILL SING OF THIS SHAME",
];

function CritHitEffect() {
  useEffect(() => {
    // Burst confetti
    const end = Date.now() + 2000;
    const colors = ['#c9a96e', '#f0c040', '#ffffff', '#ffd700'];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const msg = CRIT_MESSAGES[Math.floor(Math.random() * CRIT_MESSAGES.length)];

  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: [0, 1.4, 1], rotate: [- 15, 10, 0] }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      {/* Radiant burst */}
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.5, repeat: Infinity } }}
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, rgba(240,192,64,0.25), rgba(255,255,255,0.1), rgba(240,192,64,0.25), transparent, rgba(240,192,64,0.2), transparent)',
          filter: 'blur(8px)',
        }}
      />

      <div className="relative text-center">
        {/* 20 number */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], textShadow: ['0 0 40px #f0c040', '0 0 80px #f0c040, 0 0 120px #ffff00', '0 0 40px #f0c040'] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ fontSize: 'clamp(6rem, 20vw, 12rem)', fontFamily: 'Cinzel Decorative, serif', color: '#f0c040', lineHeight: 1, filter: 'drop-shadow(0 0 40px rgba(240,192,64,0.8))' }}
        >
          20
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.2rem, 4vw, 2.5rem)', color: '#fff', letterSpacing: '0.2em', textShadow: '0 0 20px #f0c040' }}
        >
          ⚔️ CRITICAL HIT ⚔️
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ fontFamily: 'IM Fell English, serif', fontSize: 'clamp(0.8rem, 2vw, 1.2rem)', color: 'rgba(240,192,64,0.7)', marginTop: '0.5rem' }}
        >
          {msg}
        </motion.div>
      </div>
    </motion.div>
  );
}

function CritFailEffect() {
  const msg = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.3, 1], rotate: [0, -8, 5, -3, 0] }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.7, type: 'spring' }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      {/* Dark vignette */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.3] }}
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(100,0,0,0.7) 100%)' }}
      />

      {/* Screen crack effect */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.4, 0.2], scale: [0.5, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: '20rem', lineHeight: 1, userSelect: 'none', filter: 'blur(2px)' }}
      >
        💀
      </motion.div>

      <div className="relative text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], color: ['#ff4444', '#ff0000', '#ff4444'] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ fontSize: 'clamp(6rem, 20vw, 12rem)', fontFamily: 'Cinzel Decorative, serif', color: '#cc0000', lineHeight: 1, filter: 'drop-shadow(0 0 30px rgba(200,0,0,0.9))' }}
        >
          1
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.2rem, 4vw, 2.5rem)', color: '#ff6666', letterSpacing: '0.15em', textShadow: '0 0 20px #cc0000' }}
        >
          💀 CRITICAL FAILURE 💀
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ fontFamily: 'IM Fell English, serif', fontSize: 'clamp(0.8rem, 2vw, 1.2rem)', color: 'rgba(255,100,100,0.7)', marginTop: '0.5rem', fontStyle: 'italic' }}
        >
          {msg}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function CriticalEffect({ type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {type === 'crit' && <CritHitEffect key="crit" />}
      {type === 'fail' && <CritFailEffect key="fail" />}
    </AnimatePresence>
  );
}