import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Floating damage/crit/miss text overlay for the combat panel.
 * Triggered by changes to `event.key`.
 */
export default function CombatFloatingText({ event }) {
  const [particles, setParticles] = useState([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!event) return;
    const id = ++counterRef.current;
    const xOffset = (Math.random() - 0.5) * 70;
    setParticles(prev => [...prev, { id, ...event, xOffset }]);
    const timer = setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 1500);
    return () => clearTimeout(timer);
  }, [event?.key]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <AnimatePresence>
        {particles.map(p => {
          const isCrit = p.critical;
          const isMiss = !p.hit;
          const color = isCrit ? '#fbbf24' : isMiss ? '#94a3b8' : '#f87171';
          const label = isCrit
            ? `💥 CRITICAL!\n-${p.damage}`
            : isMiss
            ? '✦ MISS'
            : `-${p.damage}`;

          return (
            <motion.div
              key={p.id}
              className="absolute font-fantasy font-bold select-none whitespace-pre-line text-center"
              style={{
                left: `calc(50% + ${p.xOffset}px)`,
                top: '35%',
                transform: 'translateX(-50%)',
                color,
                fontSize: isCrit ? '1.45rem' : isMiss ? '1rem' : '1.15rem',
                lineHeight: 1.2,
                textShadow: isCrit
                  ? `0 0 24px ${color}, 0 0 48px rgba(251,191,36,0.5), 0 2px 10px rgba(0,0,0,0.95)`
                  : `0 2px 10px rgba(0,0,0,0.9)`,
              }}
              initial={{ opacity: 1, y: 0, scale: isCrit ? 1.5 : 1 }}
              animate={{ opacity: 0, y: -80, scale: 0.85 }}
              exit={{}}
              transition={{ duration: 1.4, ease: 'easeOut' }}>
              {label}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}