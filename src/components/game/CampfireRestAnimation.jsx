import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated campfire scene shown while the party rests.
 * Purely visual — no game logic. Driven by the `resting` flag in RestModal.
 *
 * Props:
 *  - restType: 'short' | 'long' (affects sky tone + label)
 */
export default function CampfireRestAnimation({ restType = 'short' }) {
  const isLong = restType === 'long';

  // Flame flicker particles
  const flames = [
    { delay: 0,    x: 0,   color: '#ffd166', size: 26 },
    { delay: 0.15, x: -6,  color: '#f59e0b', size: 20 },
    { delay: 0.3,  x: 6,   color: '#ef4444', size: 18 },
  ];

  // Rising embers
  const embers = Array.from({ length: 7 });

  return (
    <div className="relative w-full h-44 rounded-xl overflow-hidden mb-5"
      style={{
        background: isLong
          ? 'linear-gradient(180deg, #0a0a1f 0%, #1a1228 55%, #2a1608 100%)'
          : 'linear-gradient(180deg, #1c1206 0%, #2a1a0a 55%, #34200c 100%)',
        border: '1px solid rgba(180,140,90,0.25)',
      }}>

      {/* Stars (long rest only) */}
      {isLong && Array.from({ length: 14 }).map((_, i) => (
        <motion.div key={`star-${i}`}
          className="absolute rounded-full"
          style={{
            top: `${Math.random() * 45}%`,
            left: `${Math.random() * 100}%`,
            width: 2, height: 2, background: '#fff',
          }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }} />
      ))}

      {/* Glow on the ground */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: 14, width: 160, height: 50, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,160,40,0.35) 0%, transparent 70%)',
          filter: 'blur(6px)',
        }}
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />

      {/* Embers rising */}
      {embers.map((_, i) => (
        <motion.div key={`ember-${i}`}
          className="absolute rounded-full"
          style={{ bottom: 28, left: `${46 + (Math.random() * 8 - 4)}%`, width: 3, height: 3, background: '#fbbf24' }}
          animate={{ y: [-0, -70 - Math.random() * 30], x: [0, (Math.random() * 24 - 12)], opacity: [0, 1, 0] }}
          transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: Math.random() * 2, ease: 'easeOut' }} />
      ))}

      {/* Logs */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 18 }}>
        <div style={{ width: 70, height: 9, background: 'linear-gradient(90deg,#5c3318,#3d2010)', borderRadius: 4, transform: 'rotate(-12deg)', boxShadow: 'inset 0 1px 0 rgba(232,184,109,0.2)' }} />
        <div style={{ width: 70, height: 9, background: 'linear-gradient(90deg,#3d2010,#5c3318)', borderRadius: 4, transform: 'rotate(12deg)', marginTop: -5, boxShadow: 'inset 0 1px 0 rgba(232,184,109,0.2)' }} />
      </div>

      {/* Flames */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-end justify-center" style={{ bottom: 24 }}>
        {flames.map((f, i) => (
          <motion.div key={`flame-${i}`}
            style={{
              width: f.size, height: f.size * 1.6, marginLeft: f.x,
              background: f.color,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              filter: 'blur(1px)',
              transformOrigin: 'bottom center',
              position: i === 0 ? 'relative' : 'absolute',
              boxShadow: `0 0 16px ${f.color}`,
            }}
            animate={{ scaleY: [1, 1.25, 0.9, 1.15, 1], scaleX: [1, 0.9, 1.1, 0.95, 1], opacity: [0.85, 1, 0.9, 1, 0.85] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: f.delay, ease: 'easeInOut' }} />
        ))}
      </div>

      {/* Resting hero silhouette */}
      <motion.div className="absolute" style={{ bottom: 16, left: '26%', fontSize: 30 }}
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        🧙
      </motion.div>

      {/* Sleep "z"s for long rest */}
      {isLong && Array.from({ length: 3 }).map((_, i) => (
        <motion.div key={`z-${i}`}
          className="absolute font-fantasy font-bold"
          style={{ bottom: 50, left: '34%', color: 'rgba(196,181,253,0.7)', fontSize: 12 + i * 4 }}
          animate={{ y: [-0, -30], x: [0, 12], opacity: [0, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}>
          z
        </motion.div>
      ))}

      {/* Label */}
      <div className="absolute top-2 left-0 right-0 text-center">
        <span className="font-fantasy text-xs tracking-widest"
          style={{ color: isLong ? 'rgba(196,181,253,0.8)' : 'rgba(251,191,36,0.85)' }}>
          {isLong ? 'RESTING UNTIL DAWN…' : 'CATCHING YOUR BREATH…'}
        </span>
      </div>
    </div>
  );
}