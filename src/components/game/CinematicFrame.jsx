import React from 'react';
import { motion } from 'framer-motion';

/**
 * CinematicFrame - Production-quality window framing with ornate borders
 * Creates a polished, immersive game viewport
 */
export default function CinematicFrame({ children, inCombat = false, title = '' }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Outer ornate frame */}
      <motion.div 
        className="absolute inset-0 pointer-events-none z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Top border with decorative elements */}
        <div className="absolute top-0 left-0 right-0 h-3" style={{
          background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.4) 20%, rgba(201,169,110,0.4) 80%, transparent)',
          borderTop: '2px solid rgba(201,169,110,0.6)',
          borderBottom: '1px solid rgba(201,169,110,0.3)',
        }}>
          {/* Corner ornaments */}
          <div className="absolute top-0 left-0 w-8 h-8" style={{
            borderLeft: '3px solid rgba(201,169,110,0.8)',
            borderBottom: '3px solid rgba(201,169,110,0.8)',
          }} />
          <div className="absolute top-0 right-0 w-8 h-8" style={{
            borderRight: '3px solid rgba(201,169,110,0.8)',
            borderBottom: '3px solid rgba(201,169,110,0.8)',
          }} />
        </div>

        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-3" style={{
          background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.4) 20%, rgba(201,169,110,0.4) 80%, transparent)',
          borderBottom: '2px solid rgba(201,169,110,0.6)',
          borderTop: '1px solid rgba(201,169,110,0.3)',
        }}>
          {/* Corner ornaments */}
          <div className="absolute bottom-0 left-0 w-8 h-8" style={{
            borderLeft: '3px solid rgba(201,169,110,0.8)',
            borderTop: '3px solid rgba(201,169,110,0.8)',
          }} />
          <div className="absolute bottom-0 right-0 w-8 h-8" style={{
            borderRight: '3px solid rgba(201,169,110,0.8)',
            borderTop: '3px solid rgba(201,169,110,0.8)',
          }} />
        </div>

        {/* Left border */}
        <div className="absolute top-3 bottom-3 left-0 w-2" style={{
          background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.3) 10%, rgba(201,169,110,0.3) 90%, transparent)',
          borderLeft: '2px solid rgba(201,169,110,0.5)',
          borderRight: '1px solid rgba(201,169,110,0.2)',
        }} />

        {/* Right border */}
        <div className="absolute top-3 bottom-3 right-0 w-2" style={{
          background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.3) 10%, rgba(201,169,110,0.3) 90%, transparent)',
          borderRight: '2px solid rgba(201,169,110,0.5)',
          borderLeft: '1px solid rgba(201,169,110,0.2)',
        }} />

        {/* Title bar (top center) */}
        {title && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 px-6 py-1" style={{
            background: 'rgba(20,13,5,0.8)',
            border: '1px solid rgba(201,169,110,0.4)',
            borderRadius: '9999px',
            backdropFilter: 'blur(4px)',
          }}>
            <span className="text-xs font-fantasy tracking-widest" style={{ 
              color: inCombat ? '#fca5a5' : '#f0c040',
              textShadow: inCombat ? '0 0 10px rgba(220,38,38,0.5)' : '0 0 10px rgba(201,169,110,0.4)'
            }}>
              {title}
            </span>
          </div>
        )}

        {/* Combat indicator overlay */}
        {inCombat && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              boxShadow: [
                'inset 0 0 20px rgba(220,38,38,0.1)',
                'inset 0 0 40px rgba(220,38,38,0.2)',
                'inset 0 0 20px rgba(220,38,38,0.1)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
      }} />

      {/* Content area */}
      <div className="relative h-full w-full overflow-hidden" style={{
        background: 'rgba(8,5,2,0.95)',
      }}>
        {children}
      </div>

      {/* Scanline effect (subtle) */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.02]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }} />
    </div>
  );
}